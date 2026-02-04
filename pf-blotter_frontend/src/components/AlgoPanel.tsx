import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';
import { useToast } from './Toast';

interface AlgoConfig {
  symbol: string;
  enabled: boolean;
  strategy: 'mean_reversion' | 'momentum';
  positionLimit: number;
  orderSize: number;
  threshold: number; // % deviation from mean to trigger
}

interface AlgoState {
  currentPosition: number;
  realizedPnl: number;
  tradesExecuted: number;
  lastSignal: 'BUY' | 'SELL' | 'HOLD';
  avgPrice: number;
  priceHistory: number[];
}

const DEFAULT_CONFIG: AlgoConfig = {
  symbol: 'AAPL',
  enabled: false,
  strategy: 'mean_reversion',
  positionLimit: 500,
  orderSize: 100,
  threshold: 0.5, // 0.5% deviation
};

export function AlgoPanel() {
  const [config, setConfig] = useState<AlgoConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<AlgoState>({
    currentPosition: 0,
    realizedPnl: 0,
    tradesExecuted: 0,
    lastSignal: 'HOLD',
    avgPrice: 0,
    priceHistory: [],
  });
  const { addToast } = useToast();
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  const configRef = useRef(config);
  
  // Keep refs in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const generateOrderId = () => `ALGO_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const submitOrder = useCallback(async (side: 'Buy' | 'Sell', price: number) => {
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
          quantity: cfg.orderSize,
          price: 0,
        }),
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          tradesExecuted: prev.tradesExecuted + 1,
          currentPosition: prev.currentPosition + (side === 'Buy' ? cfg.orderSize : -cfg.orderSize),
        }));
        addToast(`Algo ${side} ${cfg.orderSize} ${cfg.symbol} @ ~${price.toFixed(2)}`, side === 'Buy' ? 'success' : 'warning');
      }
    } catch (err) {
      console.error('Algo order failed:', err);
    }
  }, [addToast]);

  const runStrategy = useCallback(async () => {
    const cfg = configRef.current;
    const st = stateRef.current;
    
    if (!cfg.enabled) return;

    try {
      // Fetch current market data
      const response = await fetch(`${API_CONFIG.baseUrl}/marketdata?symbol=${cfg.symbol}`);
      if (!response.ok) return;
      
      const data = await response.json();
      const currentPrice = data.last || data.bid || 150;
      
      // Update price history (keep last 20 prices)
      const newHistory = [...st.priceHistory, currentPrice].slice(-20);
      
      if (newHistory.length < 5) {
        setState(prev => ({ ...prev, priceHistory: newHistory, avgPrice: currentPrice }));
        return;
      }
      
      // Calculate simple moving average
      const sma = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
      const deviation = ((currentPrice - sma) / sma) * 100;
      
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      
      if (cfg.strategy === 'mean_reversion') {
        // Mean reversion: buy when price is below SMA, sell when above
        if (deviation < -cfg.threshold && st.currentPosition < cfg.positionLimit) {
          signal = 'BUY';
        } else if (deviation > cfg.threshold && st.currentPosition > -cfg.positionLimit) {
          signal = 'SELL';
        }
      } else {
        // Momentum: buy when price is above SMA, sell when below
        if (deviation > cfg.threshold && st.currentPosition < cfg.positionLimit) {
          signal = 'BUY';
        } else if (deviation < -cfg.threshold && st.currentPosition > -cfg.positionLimit) {
          signal = 'SELL';
        }
      }
      
      setState(prev => ({
        ...prev,
        priceHistory: newHistory,
        avgPrice: sma,
        lastSignal: signal,
      }));
      
      // Execute trade
      if (signal === 'BUY') {
        await submitOrder('Buy', currentPrice);
      } else if (signal === 'SELL') {
        await submitOrder('Sell', currentPrice);
      }
      
    } catch (err) {
      console.error('Strategy error:', err);
    }
  }, [submitOrder]);

  // Start/stop algo loop
  useEffect(() => {
    if (config.enabled) {
      intervalRef.current = setInterval(runStrategy, 3000); // Run every 3 seconds
      addToast(`Algo started: ${config.strategy} on ${config.symbol}`, 'info');
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.enabled, config.strategy, config.symbol, runStrategy, addToast]);

  return (
    <div className="mt-6 bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Algo Trading
        </h3>
        <button
          onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={`px-4 py-1.5 rounded font-medium transition-colors ${
            config.enabled 
              ? 'bg-neon-red/20 border border-neon-red text-neon-red hover:bg-neon-red/30'
              : 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30'
          }`}
        >
          {config.enabled ? 'Stop Algo' : 'Start Algo'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Config inputs */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Symbol</label>
          <select
            value={config.symbol}
            onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white
                     disabled:opacity-50"
          >
            {['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Strategy</label>
          <select
            value={config.strategy}
            onChange={(e) => setConfig(prev => ({ ...prev, strategy: e.target.value as 'mean_reversion' | 'momentum' }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white
                     disabled:opacity-50"
          >
            <option value="mean_reversion">Mean Reversion</option>
            <option value="momentum">Momentum</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Order Size</label>
          <input
            type="number"
            value={config.orderSize}
            onChange={(e) => setConfig(prev => ({ ...prev, orderSize: parseInt(e.target.value) || 100 }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white
                     disabled:opacity-50"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Threshold %</label>
          <input
            type="number"
            step="0.1"
            value={config.threshold}
            onChange={(e) => setConfig(prev => ({ ...prev, threshold: parseFloat(e.target.value) || 0.5 }))}
            disabled={config.enabled}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white
                     disabled:opacity-50"
          />
        </div>
      </div>

      {/* Status display */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-dark-600">
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
          <div className="text-xs text-gray-500 mb-1">SMA</div>
          <div className="text-lg font-semibold text-neon-cyan">
            ${state.avgPrice.toFixed(2)}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Signal</div>
          <div className={`text-lg font-semibold ${
            state.lastSignal === 'BUY' ? 'text-neon-green' : 
            state.lastSignal === 'SELL' ? 'text-neon-red' : 'text-gray-400'
          }`}>
            {state.lastSignal}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Status</div>
          <div className={`text-lg font-semibold ${config.enabled ? 'text-neon-green' : 'text-gray-500'}`}>
            {config.enabled ? 'RUNNING' : 'STOPPED'}
          </div>
        </div>
      </div>
      
      {/* Strategy explanation */}
      <div className="mt-4 text-xs text-gray-500 bg-dark-700 rounded p-2">
        <strong className="text-gray-400">
          {config.strategy === 'mean_reversion' ? 'Mean Reversion' : 'Momentum'}:
        </strong>{' '}
        {config.strategy === 'mean_reversion' 
          ? `Buys when price drops ${config.threshold}% below SMA, sells when ${config.threshold}% above.`
          : `Buys when price rises ${config.threshold}% above SMA, sells when ${config.threshold}% below.`
        }
      </div>
    </div>
  );
}
