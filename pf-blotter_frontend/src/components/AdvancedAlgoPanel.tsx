import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';
import { useToast } from './Toast';

// Strategy types used in industry
type StrategyType = 
  | 'mean_reversion'
  | 'momentum' 
  | 'vwap'           // Volume Weighted Average Price
  | 'twap'           // Time Weighted Average Price
  | 'bollinger'      // Bollinger Bands
  | 'rsi'            // Relative Strength Index
  | 'pairs'          // Pairs Trading / Stat Arb
  | 'breakout';      // Price Breakout

interface AlgoConfig {
  symbol: string;
  symbol2?: string;  // For pairs trading
  enabled: boolean;
  strategy: StrategyType;
  positionLimit: number;
  orderSize: number;
  // Strategy-specific params
  lookbackPeriod: number;
  threshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  bollingerStdDev: number;
  // Execution params
  slices: number;      // For VWAP/TWAP
  intervalMs: number;  // Time between slices
}

interface AlgoState {
  currentPosition: number;
  realizedPnl: number;
  unrealizedPnl: number;
  tradesExecuted: number;
  lastSignal: string;
  indicators: Record<string, number>;
  slicesRemaining: number;
}

const STRATEGY_INFO: Record<StrategyType, { name: string; description: string }> = {
  mean_reversion: {
    name: 'Mean Reversion',
    description: 'Buy below SMA, sell above. Assumes prices revert to mean.',
  },
  momentum: {
    name: 'Momentum',
    description: 'Follow the trend. Buy when rising, sell when falling.',
  },
  vwap: {
    name: 'VWAP Execution',
    description: 'Execute large order in slices targeting Volume Weighted Average Price.',
  },
  twap: {
    name: 'TWAP Execution',
    description: 'Execute large order in equal time slices (Time Weighted Average Price).',
  },
  bollinger: {
    name: 'Bollinger Bands',
    description: 'Buy at lower band, sell at upper band. Uses standard deviation.',
  },
  rsi: {
    name: 'RSI Strategy',
    description: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought).',
  },
  pairs: {
    name: 'Pairs Trading',
    description: 'Statistical arbitrage between correlated assets.',
  },
  breakout: {
    name: 'Breakout',
    description: 'Enter when price breaks above/below recent high/low.',
  },
};

const DEFAULT_CONFIG: AlgoConfig = {
  symbol: 'AAPL',
  symbol2: 'MSFT',
  enabled: false,
  strategy: 'vwap',
  positionLimit: 1000,
  orderSize: 100,
  lookbackPeriod: 20,
  threshold: 0.5,
  rsiOverbought: 70,
  rsiOversold: 30,
  bollingerStdDev: 2,
  slices: 10,
  intervalMs: 5000,
};

export function AdvancedAlgoPanel() {
  const [config, setConfig] = useState<AlgoConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<AlgoState>({
    currentPosition: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    tradesExecuted: 0,
    lastSignal: 'IDLE',
    indicators: {},
    slicesRemaining: 0,
  });
  const { addToast } = useToast();
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceHistoryRef = useRef<number[]>([]);
  const volumeHistoryRef = useRef<number[]>([]);
  const stateRef = useRef(state);
  const configRef = useRef(config);
  
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { configRef.current = config; }, [config]);

  const generateOrderId = () => `ALGO_${config.strategy.toUpperCase()}_${Date.now()}`;

  const submitOrder = useCallback(async (side: 'Buy' | 'Sell', qty: number) => {
    const cfg = configRef.current;
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clOrdId: generateOrderId(),
          symbol: cfg.symbol,
          side,
          orderType: 'Market',
          quantity: qty,
          price: 0,
        }),
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          tradesExecuted: prev.tradesExecuted + 1,
          currentPosition: prev.currentPosition + (side === 'Buy' ? qty : -qty),
        }));
      }
    } catch (err) {
      console.error('Order failed:', err);
    }
  }, []);

  // Calculate RSI
  const calculateRSI = (prices: number[], period: number): number => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Calculate Bollinger Bands
  const calculateBollinger = (prices: number[], period: number, stdDevMult: number) => {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
    
    const slice = prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + stdDevMult * stdDev,
      middle: sma,
      lower: sma - stdDevMult * stdDev,
    };
  };

  // Calculate VWAP
  const calculateVWAP = (prices: number[], volumes: number[]): number => {
    if (prices.length === 0) return 0;
    let sumPV = 0, sumV = 0;
    for (let i = 0; i < prices.length; i++) {
      sumPV += prices[i] * (volumes[i] || 1);
      sumV += volumes[i] || 1;
    }
    return sumPV / sumV;
  };

  // Calculate z-score for pairs trading
  const calculateZScore = (spread: number[], period: number): number => {
    if (spread.length < period) return 0;
    const slice = spread.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    return (spread[spread.length - 1] - mean) / stdDev;
  };

  const runStrategy = useCallback(async () => {
    const cfg = configRef.current;
    const st = stateRef.current;
    
    if (!cfg.enabled) return;

    try {
      // Fetch current price
      const response = await fetch(`${API_CONFIG.baseUrl}/marketdata?symbol=${cfg.symbol}`);
      if (!response.ok) return;
      const data = await response.json();
      const price = data.last || data.bid || 150;
      const volume = data.volume || Math.floor(Math.random() * 10000);
      
      // Update history
      priceHistoryRef.current = [...priceHistoryRef.current, price].slice(-100);
      volumeHistoryRef.current = [...volumeHistoryRef.current, volume].slice(-100);
      const prices = priceHistoryRef.current;
      const volumes = volumeHistoryRef.current;
      
      let signal = 'HOLD';
      const indicators: Record<string, number> = {};
      
      switch (cfg.strategy) {
        case 'vwap': {
          // VWAP execution: slice large order over time
          const vwap = calculateVWAP(prices, volumes);
          indicators.vwap = vwap;
          indicators.price = price;
          
          if (st.slicesRemaining > 0) {
            const sliceQty = Math.ceil(cfg.orderSize / cfg.slices);
            if (price <= vwap * 1.001) { // Execute at or below VWAP
              signal = 'BUY_SLICE';
              await submitOrder('Buy', sliceQty);
              setState(prev => ({ ...prev, slicesRemaining: prev.slicesRemaining - 1 }));
              addToast(`VWAP slice ${cfg.slices - st.slicesRemaining + 1}/${cfg.slices}`, 'info');
            }
          }
          break;
        }
        
        case 'twap': {
          // TWAP: execute equal slices at regular intervals
          if (st.slicesRemaining > 0) {
            const sliceQty = Math.ceil(cfg.orderSize / cfg.slices);
            signal = 'BUY_SLICE';
            await submitOrder('Buy', sliceQty);
            setState(prev => ({ ...prev, slicesRemaining: prev.slicesRemaining - 1 }));
            addToast(`TWAP slice ${cfg.slices - st.slicesRemaining + 1}/${cfg.slices}`, 'info');
          }
          break;
        }
        
        case 'bollinger': {
          const bands = calculateBollinger(prices, cfg.lookbackPeriod, cfg.bollingerStdDev);
          indicators.upper = bands.upper;
          indicators.middle = bands.middle;
          indicators.lower = bands.lower;
          indicators.price = price;
          
          if (price <= bands.lower && st.currentPosition < cfg.positionLimit) {
            signal = 'BUY';
            await submitOrder('Buy', cfg.orderSize);
            addToast(`Bollinger: Buy at lower band $${price.toFixed(2)}`, 'success');
          } else if (price >= bands.upper && st.currentPosition > -cfg.positionLimit) {
            signal = 'SELL';
            await submitOrder('Sell', cfg.orderSize);
            addToast(`Bollinger: Sell at upper band $${price.toFixed(2)}`, 'warning');
          }
          break;
        }
        
        case 'rsi': {
          const rsi = calculateRSI(prices, cfg.lookbackPeriod);
          indicators.rsi = rsi;
          
          if (rsi <= cfg.rsiOversold && st.currentPosition < cfg.positionLimit) {
            signal = 'BUY';
            await submitOrder('Buy', cfg.orderSize);
            addToast(`RSI ${rsi.toFixed(0)}: Oversold, buying`, 'success');
          } else if (rsi >= cfg.rsiOverbought && st.currentPosition > -cfg.positionLimit) {
            signal = 'SELL';
            await submitOrder('Sell', cfg.orderSize);
            addToast(`RSI ${rsi.toFixed(0)}: Overbought, selling`, 'warning');
          }
          break;
        }
        
        case 'breakout': {
          if (prices.length < cfg.lookbackPeriod) break;
          const lookback = prices.slice(-cfg.lookbackPeriod - 1, -1);
          const high = Math.max(...lookback);
          const low = Math.min(...lookback);
          indicators.high = high;
          indicators.low = low;
          indicators.price = price;
          
          if (price > high && st.currentPosition < cfg.positionLimit) {
            signal = 'BUY';
            await submitOrder('Buy', cfg.orderSize);
            addToast(`Breakout: Price broke above $${high.toFixed(2)}`, 'success');
          } else if (price < low && st.currentPosition > -cfg.positionLimit) {
            signal = 'SELL';
            await submitOrder('Sell', cfg.orderSize);
            addToast(`Breakdown: Price broke below $${low.toFixed(2)}`, 'warning');
          }
          break;
        }
        
        case 'pairs': {
          // Simplified pairs trading - in production would fetch both prices
          const spread = prices.map((p) => p - (prices[0] || 100)); // Simplified spread
          const zScore = calculateZScore(spread, cfg.lookbackPeriod);
          indicators.zScore = zScore;
          
          if (zScore < -cfg.threshold && st.currentPosition < cfg.positionLimit) {
            signal = 'BUY_SPREAD';
            await submitOrder('Buy', cfg.orderSize);
            addToast(`Pairs: z-score ${zScore.toFixed(2)}, buying spread`, 'success');
          } else if (zScore > cfg.threshold && st.currentPosition > -cfg.positionLimit) {
            signal = 'SELL_SPREAD';
            await submitOrder('Sell', cfg.orderSize);
            addToast(`Pairs: z-score ${zScore.toFixed(2)}, selling spread`, 'warning');
          }
          break;
        }
        
        case 'mean_reversion':
        case 'momentum':
        default: {
          const sma = prices.slice(-cfg.lookbackPeriod).reduce((a, b) => a + b, 0) / 
                      Math.min(prices.length, cfg.lookbackPeriod);
          const deviation = ((price - sma) / sma) * 100;
          indicators.sma = sma;
          indicators.deviation = deviation;
          
          const isMeanReversion = cfg.strategy === 'mean_reversion';
          if ((isMeanReversion ? deviation < -cfg.threshold : deviation > cfg.threshold) && 
              st.currentPosition < cfg.positionLimit) {
            signal = 'BUY';
            await submitOrder('Buy', cfg.orderSize);
          } else if ((isMeanReversion ? deviation > cfg.threshold : deviation < -cfg.threshold) && 
                     st.currentPosition > -cfg.positionLimit) {
            signal = 'SELL';
            await submitOrder('Sell', cfg.orderSize);
          }
        }
      }
      
      setState(prev => ({ ...prev, lastSignal: signal, indicators }));
      
    } catch (err) {
      console.error('Strategy error:', err);
    }
  }, [submitOrder, addToast]);

  // Start VWAP/TWAP execution
  const startExecution = () => {
    setState(prev => ({ ...prev, slicesRemaining: config.slices }));
    setConfig(prev => ({ ...prev, enabled: true }));
  };

  // Use ref for strategy function to avoid effect dependency issues
  const runStrategyRef = useRef(runStrategy);
  useEffect(() => {
    runStrategyRef.current = runStrategy;
  }, [runStrategy]);

  // Stable interval management - only depends on config changes, not callback
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (config.enabled) {
      const interval = config.strategy === 'twap' || config.strategy === 'vwap' 
        ? config.intervalMs 
        : 3000;
      
      // Use ref to call latest strategy function
      intervalRef.current = setInterval(() => {
        runStrategyRef.current();
      }, interval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [config.enabled, config.strategy, config.intervalMs]);

  const isExecutionAlgo = config.strategy === 'vwap' || config.strategy === 'twap';

  return (
    <div className="mt-6 bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Advanced Algo Trading
        </h3>
        {isExecutionAlgo ? (
          <button
            onClick={startExecution}
            disabled={config.enabled}
            className={`px-4 py-1.5 rounded font-medium transition-colors ${
              config.enabled 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30'
            }`}
          >
            {config.enabled ? `Executing (${state.slicesRemaining} left)` : `Start ${config.strategy.toUpperCase()}`}
          </button>
        ) : (
          <button
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-1.5 rounded font-medium transition-colors ${
              config.enabled 
                ? 'bg-neon-red/20 border border-neon-red text-neon-red hover:bg-neon-red/30'
                : 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30'
            }`}
          >
            {config.enabled ? 'Stop' : 'Start'}
          </button>
        )}
      </div>

      {/* Strategy selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {(Object.keys(STRATEGY_INFO) as StrategyType[]).map(strat => (
          <button
            key={strat}
            onClick={() => setConfig(prev => ({ ...prev, strategy: strat, enabled: false }))}
            disabled={config.enabled}
            className={`px-3 py-2 rounded text-xs transition-colors ${
              config.strategy === strat
                ? 'bg-neon-cyan/30 border border-neon-cyan text-neon-cyan'
                : 'bg-dark-700 border border-dark-500 text-gray-400 hover:border-gray-400'
            } disabled:opacity-50`}
          >
            {STRATEGY_INFO[strat].name}
          </button>
        ))}
      </div>

      {/* Strategy description */}
      <div className="bg-dark-700 rounded p-2 mb-4 text-xs text-gray-400">
        <strong className="text-gray-300">{STRATEGY_INFO[config.strategy].name}:</strong>{' '}
        {STRATEGY_INFO[config.strategy].description}
      </div>

      {/* Config inputs - show relevant ones based on strategy */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Symbol</label>
          <select
            value={config.symbol}
            onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
          >
            {['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Order Size</label>
          <input
            type="number"
            value={config.orderSize}
            onChange={(e) => setConfig(prev => ({ ...prev, orderSize: parseInt(e.target.value) || 100 }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
          />
        </div>

        {(config.strategy === 'vwap' || config.strategy === 'twap') && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slices</label>
              <input
                type="number"
                value={config.slices}
                onChange={(e) => setConfig(prev => ({ ...prev, slices: parseInt(e.target.value) || 10 }))}
                disabled={config.enabled}
                className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Interval (ms)</label>
              <input
                type="number"
                value={config.intervalMs}
                onChange={(e) => setConfig(prev => ({ ...prev, intervalMs: parseInt(e.target.value) || 5000 }))}
                disabled={config.enabled}
                className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
              />
            </div>
          </>
        )}

        {config.strategy === 'rsi' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Overbought</label>
              <input
                type="number"
                value={config.rsiOverbought}
                onChange={(e) => setConfig(prev => ({ ...prev, rsiOverbought: parseInt(e.target.value) || 70 }))}
                disabled={config.enabled}
                className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Oversold</label>
              <input
                type="number"
                value={config.rsiOversold}
                onChange={(e) => setConfig(prev => ({ ...prev, rsiOversold: parseInt(e.target.value) || 30 }))}
                disabled={config.enabled}
                className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
              />
            </div>
          </>
        )}

        {config.strategy === 'bollinger' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Std Dev</label>
            <input
              type="number"
              step="0.5"
              value={config.bollingerStdDev}
              onChange={(e) => setConfig(prev => ({ ...prev, bollingerStdDev: parseFloat(e.target.value) || 2 }))}
              disabled={config.enabled}
              className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Lookback</label>
          <input
            type="number"
            value={config.lookbackPeriod}
            onChange={(e) => setConfig(prev => ({ ...prev, lookbackPeriod: parseInt(e.target.value) || 20 }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white disabled:opacity-50"
          />
        </div>
      </div>

      {/* Live indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-dark-600">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Position</div>
          <div className={`text-lg font-semibold ${state.currentPosition > 0 ? 'text-neon-green' : state.currentPosition < 0 ? 'text-neon-red' : 'text-white'}`}>
            {state.currentPosition > 0 ? '+' : ''}{state.currentPosition}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Trades</div>
          <div className="text-lg font-semibold text-white">{state.tradesExecuted}</div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Signal</div>
          <div className={`text-lg font-semibold ${
            state.lastSignal.includes('BUY') ? 'text-neon-green' : 
            state.lastSignal.includes('SELL') ? 'text-neon-red' : 'text-gray-400'
          }`}>
            {state.lastSignal}
          </div>
        </div>

        {/* Dynamic indicators based on strategy */}
        {Object.entries(state.indicators).slice(0, 3).map(([key, value]) => (
          <div key={key} className="text-center">
            <div className="text-xs text-gray-500 mb-1">{key.toUpperCase()}</div>
            <div className="text-lg font-semibold text-neon-cyan">
              {typeof value === 'number' ? (value as number).toFixed(2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
