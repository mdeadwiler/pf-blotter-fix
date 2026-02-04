import { useState, useCallback } from 'react';

interface BacktestConfig {
  symbol: string;
  strategy: 'mean_reversion' | 'momentum';
  startingCapital: number;
  orderSize: number;
  threshold: number;
  periods: number;  // Number of price points to simulate
  volatility: number;  // Price volatility %
}

interface Trade {
  period: number;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  pnl: number;
}

interface BacktestResult {
  trades: Trade[];
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  priceHistory: number[];
  equityCurve: number[];
}

const DEFAULT_CONFIG: BacktestConfig = {
  symbol: 'AAPL',
  strategy: 'mean_reversion',
  startingCapital: 100000,
  orderSize: 100,
  threshold: 0.5,
  periods: 252,  // ~1 year of trading days
  volatility: 2.0,
};

// Realistic starting prices
const TICKER_PRICES: Record<string, number> = {
  AAPL: 185, GOOGL: 175, MSFT: 420, NVDA: 875, TSLA: 175, AMZN: 185,
};

export function BacktestPanel() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const generatePriceHistory = useCallback((
    startPrice: number,
    periods: number,
    volatility: number
  ): number[] => {
    const prices: number[] = [startPrice];
    for (let i = 1; i < periods; i++) {
      const change = (Math.random() - 0.5) * 2 * (volatility / 100) * prices[i - 1];
      const drift = 0.0002 * prices[i - 1]; // Small upward drift
      prices.push(Math.max(1, prices[i - 1] + change + drift));
    }
    return prices;
  }, []);

  const calculateSMA = (prices: number[], period: number, index: number): number => {
    const start = Math.max(0, index - period + 1);
    const slice = prices.slice(start, index + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const runBacktest = useCallback(() => {
    setIsRunning(true);
    
    // Simulate async for UI feedback
    setTimeout(() => {
      const startPrice = TICKER_PRICES[config.symbol] || 100;
      const priceHistory = generatePriceHistory(startPrice, config.periods, config.volatility);
      
      const trades: Trade[] = [];
      let position = 0;
      let cash = config.startingCapital;
      let entryPrice = 0;
      const equityCurve: number[] = [config.startingCapital];
      const smaPeriod = 20;
      
      for (let i = smaPeriod; i < priceHistory.length; i++) {
        const price = priceHistory[i];
        const sma = calculateSMA(priceHistory, smaPeriod, i);
        const deviation = ((price - sma) / sma) * 100;
        
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        
        if (config.strategy === 'mean_reversion') {
          if (deviation < -config.threshold && position === 0) {
            signal = 'BUY';
          } else if (deviation > config.threshold && position > 0) {
            signal = 'SELL';
          }
        } else {
          // Momentum
          if (deviation > config.threshold && position === 0) {
            signal = 'BUY';
          } else if (deviation < -config.threshold && position > 0) {
            signal = 'SELL';
          }
        }
        
        if (signal === 'BUY' && cash >= price * config.orderSize) {
          position = config.orderSize;
          cash -= price * config.orderSize;
          entryPrice = price;
          trades.push({
            period: i,
            side: 'BUY',
            price,
            quantity: config.orderSize,
            pnl: 0,
          });
        } else if (signal === 'SELL' && position > 0) {
          const pnl = (price - entryPrice) * position;
          cash += price * position;
          trades.push({
            period: i,
            side: 'SELL',
            price,
            quantity: position,
            pnl,
          });
          position = 0;
        }
        
        // Calculate equity
        const equity = cash + position * price;
        equityCurve.push(equity);
      }
      
      // Close any open position at end
      if (position > 0) {
        const finalPrice = priceHistory[priceHistory.length - 1];
        const pnl = (finalPrice - entryPrice) * position;
        cash += finalPrice * position;
        trades.push({
          period: priceHistory.length - 1,
          side: 'SELL',
          price: finalPrice,
          quantity: position,
          pnl,
        });
      }
      
      // Calculate metrics
      const finalEquity = cash;
      const totalReturn = ((finalEquity - config.startingCapital) / config.startingCapital) * 100;
      
      // Sharpe Ratio (simplified - daily returns)
      const returns: number[] = [];
      for (let i = 1; i < equityCurve.length; i++) {
        returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
      }
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      
      // Max Drawdown
      let peak = equityCurve[0];
      let maxDrawdown = 0;
      for (const equity of equityCurve) {
        if (equity > peak) peak = equity;
        const drawdown = ((peak - equity) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      
      // Win rate
      const winningTrades = trades.filter(t => t.side === 'SELL' && t.pnl > 0).length;
      const totalSellTrades = trades.filter(t => t.side === 'SELL').length;
      const winRate = totalSellTrades > 0 ? (winningTrades / totalSellTrades) * 100 : 0;
      
      // Profit factor
      const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
      
      setResult({
        trades,
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        totalTrades: trades.length,
        profitFactor,
        priceHistory,
        equityCurve,
      });
      
      setIsRunning(false);
    }, 100);
  }, [config, generatePriceHistory]);

  return (
    <div className="mt-6 bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Strategy Backtester
        </h3>
        <button
          onClick={runBacktest}
          disabled={isRunning}
          className="px-4 py-1.5 bg-neon-yellow/20 border border-neon-yellow text-neon-yellow 
                   rounded font-medium hover:bg-neon-yellow/30 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {/* Config inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Symbol</label>
          <select
            value={config.symbol}
            onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            {Object.keys(TICKER_PRICES).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Strategy</label>
          <select
            value={config.strategy}
            onChange={(e) => setConfig(prev => ({ ...prev, strategy: e.target.value as 'mean_reversion' | 'momentum' }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            <option value="mean_reversion">Mean Reversion</option>
            <option value="momentum">Momentum</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Capital ($)</label>
          <input
            type="number"
            value={config.startingCapital}
            onChange={(e) => setConfig(prev => ({ ...prev, startingCapital: parseInt(e.target.value) || 100000 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Order Size</label>
          <input
            type="number"
            value={config.orderSize}
            onChange={(e) => setConfig(prev => ({ ...prev, orderSize: parseInt(e.target.value) || 100 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Threshold %</label>
          <input
            type="number"
            step="0.1"
            value={config.threshold}
            onChange={(e) => setConfig(prev => ({ ...prev, threshold: parseFloat(e.target.value) || 0.5 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Periods</label>
          <input
            type="number"
            value={config.periods}
            onChange={(e) => setConfig(prev => ({ ...prev, periods: parseInt(e.target.value) || 252 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Volatility %</label>
          <input
            type="number"
            step="0.5"
            value={config.volatility}
            onChange={(e) => setConfig(prev => ({ ...prev, volatility: parseFloat(e.target.value) || 2 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-dark-600 pt-4">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <MetricCard
              label="Total Return"
              value={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`}
              color={result.totalReturn >= 0 ? 'text-neon-green' : 'text-neon-red'}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={result.sharpeRatio.toFixed(2)}
              color={result.sharpeRatio >= 1 ? 'text-neon-green' : result.sharpeRatio >= 0 ? 'text-neon-yellow' : 'text-neon-red'}
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${result.maxDrawdown.toFixed(2)}%`}
              color={result.maxDrawdown < 10 ? 'text-neon-green' : result.maxDrawdown < 20 ? 'text-neon-yellow' : 'text-neon-red'}
            />
            <MetricCard
              label="Win Rate"
              value={`${result.winRate.toFixed(1)}%`}
              color={result.winRate >= 50 ? 'text-neon-green' : 'text-neon-yellow'}
            />
            <MetricCard
              label="Total Trades"
              value={result.totalTrades.toString()}
              color="text-white"
            />
            <MetricCard
              label="Profit Factor"
              value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
              color={result.profitFactor >= 1.5 ? 'text-neon-green' : result.profitFactor >= 1 ? 'text-neon-yellow' : 'text-neon-red'}
            />
          </div>
          
          {/* Simple equity curve visualization */}
          <div className="bg-dark-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Equity Curve</div>
            <div className="h-24 flex items-end gap-px">
              {result.equityCurve
                .filter((_, i) => i % Math.ceil(result.equityCurve.length / 100) === 0)
                .map((equity, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const height = ((equity - min) / (max - min)) * 100 || 50;
                  const color = equity >= config.startingCapital ? 'bg-neon-green' : 'bg-neon-red';
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} opacity-70 rounded-t-sm`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Start: ${config.startingCapital.toLocaleString()}</span>
              <span>End: ${(config.startingCapital * (1 + result.totalReturn / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      )}
      
      {!result && (
        <div className="text-center text-gray-500 py-8">
          Configure parameters and click "Run Backtest" to simulate strategy performance
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-dark-700 rounded p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
