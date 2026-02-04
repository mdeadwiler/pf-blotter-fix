import { useState, useCallback } from 'react';

type StrategyType = 'mean_reversion' | 'momentum' | 'bollinger' | 'rsi' | 'breakout' | 'pairs';

interface BacktestConfig {
  symbol: string;
  strategy: StrategyType;
  startingCapital: number;
  orderSize: number;
  periods: number;
  volatility: number;
  // Strategy params
  lookbackPeriod: number;
  threshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  bollingerStdDev: number;
  // Cost modeling
  commissionPerTrade: number;
  slippageBps: number; // basis points
  // Risk management
  stopLossPct: number;
  takeProfitPct: number;
}

interface RiskMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  var95: number;          // Value at Risk 95%
  cvar95: number;         // Conditional VaR (Expected Shortfall)
  volatility: number;     // Annualized volatility
  beta: number;           // vs benchmark
  alpha: number;          // Jensen's alpha
  informationRatio: number;
  treynorRatio: number;
  // Costs
  totalCommissions: number;
  totalSlippage: number;
}

interface Trade {
  entry: number;
  exit: number;
  side: 'long' | 'short';
  pnl: number;
  pnlPct: number;
  holdingPeriod: number;
}

const DEFAULT_CONFIG: BacktestConfig = {
  symbol: 'AAPL',
  strategy: 'mean_reversion',
  startingCapital: 100000,
  orderSize: 100,
  periods: 252,
  volatility: 2.0,
  lookbackPeriod: 20,
  threshold: 1.0,
  rsiOverbought: 70,
  rsiOversold: 30,
  bollingerStdDev: 2,
  commissionPerTrade: 1.0,
  slippageBps: 5,
  stopLossPct: 5,
  takeProfitPct: 10,
};

const TICKER_PRICES: Record<string, number> = {
  AAPL: 185, GOOGL: 175, MSFT: 420, NVDA: 875, TSLA: 175, AMZN: 185,
};

export function AdvancedBacktester() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [_trades, setTrades] = useState<Trade[]>([]);
  const [equityCurve, setEquityCurve] = useState<number[]>([]);
  const [drawdownCurve, setDrawdownCurve] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Suppress unused variable warnings
  void _trades;

  const generatePrices = (start: number, n: number, vol: number): number[] => {
    const prices = [start];
    for (let i = 1; i < n; i++) {
      const dailyVol = vol / Math.sqrt(252);
      const change = (Math.random() - 0.48) * 2 * dailyVol / 100 * prices[i-1]; // Slight upward drift
      prices.push(Math.max(1, prices[i-1] + change));
    }
    return prices;
  };

  const calculateSMA = (prices: number[], idx: number, period: number): number => {
    const start = Math.max(0, idx - period + 1);
    const slice = prices.slice(start, idx + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const calculateRSI = (prices: number[], idx: number, period: number): number => {
    if (idx < period) return 50;
    let gains = 0, losses = 0;
    for (let i = idx - period + 1; i <= idx; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    return 100 - (100 / (1 + gains / losses));
  };

  const calculateBollinger = (prices: number[], idx: number, period: number, mult: number) => {
    const sma = calculateSMA(prices, idx, period);
    const slice = prices.slice(Math.max(0, idx - period + 1), idx + 1);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / slice.length;
    const std = Math.sqrt(variance);
    return { upper: sma + mult * std, lower: sma - mult * std, middle: sma };
  };

  const runBacktest = useCallback(() => {
    setIsRunning(true);
    
    setTimeout(() => {
      const prices = generatePrices(TICKER_PRICES[config.symbol] || 100, config.periods, config.volatility);
      const benchmarkReturns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
      
      let cash = config.startingCapital;
      let position = 0;
      let entryPrice = 0;
      let entryIdx = 0;
      const equity: number[] = [cash];
      const allTrades: Trade[] = [];
      let totalCommissions = 0;
      let totalSlippage = 0;
      
      for (let i = config.lookbackPeriod; i < prices.length; i++) {
        const price = prices[i];
        let signal: 'buy' | 'sell' | 'hold' = 'hold';
        
        // Generate signal based on strategy
        switch (config.strategy) {
          case 'mean_reversion': {
            const sma = calculateSMA(prices, i, config.lookbackPeriod);
            const dev = ((price - sma) / sma) * 100;
            if (dev < -config.threshold) signal = 'buy';
            else if (dev > config.threshold) signal = 'sell';
            break;
          }
          case 'momentum': {
            const sma = calculateSMA(prices, i, config.lookbackPeriod);
            const dev = ((price - sma) / sma) * 100;
            if (dev > config.threshold) signal = 'buy';
            else if (dev < -config.threshold) signal = 'sell';
            break;
          }
          case 'rsi': {
            const rsi = calculateRSI(prices, i, config.lookbackPeriod);
            if (rsi < config.rsiOversold) signal = 'buy';
            else if (rsi > config.rsiOverbought) signal = 'sell';
            break;
          }
          case 'bollinger': {
            const bands = calculateBollinger(prices, i, config.lookbackPeriod, config.bollingerStdDev);
            if (price < bands.lower) signal = 'buy';
            else if (price > bands.upper) signal = 'sell';
            break;
          }
          case 'breakout': {
            const slice = prices.slice(i - config.lookbackPeriod, i);
            const high = Math.max(...slice);
            const low = Math.min(...slice);
            if (price > high) signal = 'buy';
            else if (price < low) signal = 'sell';
            break;
          }
        }
        
        // Check stop-loss / take-profit
        if (position !== 0) {
          const pnlPct = ((price - entryPrice) / entryPrice) * 100 * (position > 0 ? 1 : -1);
          if (pnlPct <= -config.stopLossPct || pnlPct >= config.takeProfitPct) {
            signal = position > 0 ? 'sell' : 'buy';
          }
        }
        
        // Execute trades with cost modeling
        if (signal === 'buy' && position <= 0) {
          if (position < 0) {
            // Close short
            const slippage = price * (config.slippageBps / 10000);
            const exitPrice = price + slippage;
            const pnl = (entryPrice - exitPrice) * Math.abs(position) - config.commissionPerTrade;
            allTrades.push({
              entry: entryPrice,
              exit: exitPrice,
              side: 'short',
              pnl,
              pnlPct: ((entryPrice - exitPrice) / entryPrice) * 100,
              holdingPeriod: i - entryIdx,
            });
            cash += entryPrice * Math.abs(position) + pnl;
            totalSlippage += slippage * Math.abs(position);
            totalCommissions += config.commissionPerTrade;
            position = 0;
          }
          // Open long
          const slippage = price * (config.slippageBps / 10000);
          const buyPrice = price + slippage;
          const qty = Math.min(config.orderSize, Math.floor(cash / buyPrice));
          if (qty > 0) {
            cash -= buyPrice * qty + config.commissionPerTrade;
            position = qty;
            entryPrice = buyPrice;
            entryIdx = i;
            totalSlippage += slippage * qty;
            totalCommissions += config.commissionPerTrade;
          }
        } else if (signal === 'sell' && position >= 0) {
          if (position > 0) {
            // Close long
            const slippage = price * (config.slippageBps / 10000);
            const exitPrice = price - slippage;
            const pnl = (exitPrice - entryPrice) * position - config.commissionPerTrade;
            allTrades.push({
              entry: entryPrice,
              exit: exitPrice,
              side: 'long',
              pnl,
              pnlPct: ((exitPrice - entryPrice) / entryPrice) * 100,
              holdingPeriod: i - entryIdx,
            });
            cash += exitPrice * position;
            totalSlippage += slippage * position;
            totalCommissions += config.commissionPerTrade;
            position = 0;
          }
          // Open short (simplified - just track position)
          position = -config.orderSize;
          entryPrice = price;
          entryIdx = i;
        }
        
        equity.push(cash + position * price);
      }
      
      // Close final position
      if (position !== 0) {
        const finalPrice = prices[prices.length - 1];
        const pnl = position > 0 
          ? (finalPrice - entryPrice) * position 
          : (entryPrice - finalPrice) * Math.abs(position);
        allTrades.push({
          entry: entryPrice,
          exit: finalPrice,
          side: position > 0 ? 'long' : 'short',
          pnl,
          pnlPct: ((finalPrice - entryPrice) / entryPrice) * 100 * (position > 0 ? 1 : -1),
          holdingPeriod: prices.length - entryIdx,
        });
        cash += position > 0 ? finalPrice * position : entryPrice * Math.abs(position) + pnl;
      }
      
      // Calculate returns
      const returns = equity.slice(1).map((e, i) => (e - equity[i]) / equity[i]);
      const negativeReturns = returns.filter(r => r < 0);
      
      // Drawdown calculation
      let peak = equity[0];
      const drawdowns: number[] = [];
      let maxDD = 0;
      let maxDDDuration = 0;
      let currentDDDuration = 0;
      
      for (let i = 0; i < equity.length; i++) {
        if (equity[i] > peak) {
          peak = equity[i];
          if (currentDDDuration > maxDDDuration) maxDDDuration = currentDDDuration;
          currentDDDuration = 0;
        } else {
          currentDDDuration++;
        }
        const dd = (peak - equity[i]) / peak;
        drawdowns.push(dd * 100);
        if (dd > maxDD) maxDD = dd;
      }
      
      // Calculate metrics
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const downDev = Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / Math.max(negativeReturns.length, 1));
      
      const totalReturn = ((equity[equity.length - 1] - config.startingCapital) / config.startingCapital) * 100;
      const annualizedReturn = Math.pow(1 + totalReturn / 100, 252 / config.periods) - 1;
      const annualizedVol = stdDev * Math.sqrt(252) * 100;
      
      const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      const sortino = downDev > 0 ? (avgReturn / downDev) * Math.sqrt(252) : 0;
      const calmar = maxDD > 0 ? annualizedReturn / maxDD : 0;
      
      // VaR and CVaR
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const var95Idx = Math.floor(returns.length * 0.05);
      const var95 = -sortedReturns[var95Idx] * 100;
      const cvar95 = -sortedReturns.slice(0, var95Idx + 1).reduce((a, b) => a + b, 0) / (var95Idx + 1) * 100;
      
      // Trade statistics
      const winningTrades = allTrades.filter(t => t.pnl > 0);
      const losingTrades = allTrades.filter(t => t.pnl < 0);
      const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length) : 0;
      
      // Beta and Alpha (vs benchmark)
      const benchmarkAvg = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
      const covariance = returns.slice(0, benchmarkReturns.length).reduce((sum, r, i) => 
        sum + (r - avgReturn) * (benchmarkReturns[i] - benchmarkAvg), 0) / benchmarkReturns.length;
      const benchmarkVar = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - benchmarkAvg, 2), 0) / benchmarkReturns.length;
      const beta = benchmarkVar > 0 ? covariance / benchmarkVar : 1;
      const alpha = (avgReturn - beta * benchmarkAvg) * 252;
      
      // Information and Treynor ratios
      const trackingError = Math.sqrt(returns.slice(0, benchmarkReturns.length).reduce((sum, r, i) => 
        sum + Math.pow(r - benchmarkReturns[i], 2), 0) / benchmarkReturns.length) * Math.sqrt(252);
      const infoRatio = trackingError > 0 ? (annualizedReturn - benchmarkAvg * 252) / trackingError : 0;
      const treynor = beta !== 0 ? annualizedReturn / beta : 0;
      
      setMetrics({
        totalReturn,
        annualizedReturn: annualizedReturn * 100,
        sharpeRatio: sharpe,
        sortinoRatio: sortino,
        calmarRatio: calmar,
        maxDrawdown: maxDD * 100,
        maxDrawdownDuration: maxDDDuration,
        winRate: allTrades.length > 0 ? (winningTrades.length / allTrades.length) * 100 : 0,
        profitFactor: avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0,
        avgWin,
        avgLoss,
        payoffRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
        totalTrades: allTrades.length,
        longTrades: allTrades.filter(t => t.side === 'long').length,
        shortTrades: allTrades.filter(t => t.side === 'short').length,
        var95,
        cvar95,
        volatility: annualizedVol,
        beta,
        alpha: alpha * 100,
        informationRatio: infoRatio,
        treynorRatio: treynor * 100,
        totalCommissions,
        totalSlippage,
      });
      
      setTrades(allTrades);
      setEquityCurve(equity);
      setDrawdownCurve(drawdowns);
      setIsRunning(false);
    }, 100);
  }, [config]);

  return (
    <div className="mt-6 bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Professional Backtester
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

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Strategy</label>
          <select
            value={config.strategy}
            onChange={(e) => setConfig(prev => ({ ...prev, strategy: e.target.value as StrategyType }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            <option value="mean_reversion">Mean Reversion</option>
            <option value="momentum">Momentum</option>
            <option value="bollinger">Bollinger Bands</option>
            <option value="rsi">RSI</option>
            <option value="breakout">Breakout</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Capital ($)</label>
          <input type="number" value={config.startingCapital}
            onChange={(e) => setConfig(prev => ({ ...prev, startingCapital: parseInt(e.target.value) || 100000 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Periods</label>
          <input type="number" value={config.periods}
            onChange={(e) => setConfig(prev => ({ ...prev, periods: parseInt(e.target.value) || 252 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Commission ($)</label>
          <input type="number" step="0.5" value={config.commissionPerTrade}
            onChange={(e) => setConfig(prev => ({ ...prev, commissionPerTrade: parseFloat(e.target.value) || 1 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Slippage (bps)</label>
          <input type="number" value={config.slippageBps}
            onChange={(e) => setConfig(prev => ({ ...prev, slippageBps: parseInt(e.target.value) || 5 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Stop Loss %</label>
          <input type="number" step="0.5" value={config.stopLossPct}
            onChange={(e) => setConfig(prev => ({ ...prev, stopLossPct: parseFloat(e.target.value) || 5 }))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white" />
        </div>
      </div>

      {/* Results */}
      {metrics && (
        <div className="border-t border-dark-600 pt-4 space-y-4">
          {/* Risk-adjusted returns */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Risk-Adjusted Returns</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <Metric label="Sharpe" value={metrics.sharpeRatio.toFixed(2)} good={metrics.sharpeRatio >= 1} />
              <Metric label="Sortino" value={metrics.sortinoRatio.toFixed(2)} good={metrics.sortinoRatio >= 1.5} />
              <Metric label="Calmar" value={metrics.calmarRatio.toFixed(2)} good={metrics.calmarRatio >= 1} />
              <Metric label="Info Ratio" value={metrics.informationRatio.toFixed(2)} good={metrics.informationRatio >= 0.5} />
              <Metric label="Treynor" value={`${metrics.treynorRatio.toFixed(1)}%`} good={metrics.treynorRatio >= 10} />
              <Metric label="Alpha" value={`${metrics.alpha >= 0 ? '+' : ''}${metrics.alpha.toFixed(2)}%`} good={metrics.alpha > 0} />
            </div>
          </div>

          {/* Risk metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Risk Metrics</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <Metric label="Max DD" value={`-${metrics.maxDrawdown.toFixed(1)}%`} good={metrics.maxDrawdown < 20} bad />
              <Metric label="DD Duration" value={`${metrics.maxDrawdownDuration}d`} good={metrics.maxDrawdownDuration < 30} bad />
              <Metric label="VaR 95%" value={`-${metrics.var95.toFixed(2)}%`} good={metrics.var95 < 3} bad />
              <Metric label="CVaR 95%" value={`-${metrics.cvar95.toFixed(2)}%`} good={metrics.cvar95 < 5} bad />
              <Metric label="Volatility" value={`${metrics.volatility.toFixed(1)}%`} good={metrics.volatility < 20} />
              <Metric label="Beta" value={metrics.beta.toFixed(2)} good={Math.abs(metrics.beta) < 1.5} />
            </div>
          </div>

          {/* Trade statistics */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Trade Statistics</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <Metric label="Total" value={metrics.totalTrades.toString()} />
              <Metric label="Win Rate" value={`${metrics.winRate.toFixed(0)}%`} good={metrics.winRate >= 50} />
              <Metric label="Profit Factor" value={metrics.profitFactor.toFixed(2)} good={metrics.profitFactor >= 1.5} />
              <Metric label="Avg Win" value={`$${metrics.avgWin.toFixed(0)}`} />
              <Metric label="Avg Loss" value={`$${metrics.avgLoss.toFixed(0)}`} />
              <Metric label="Payoff" value={metrics.payoffRatio.toFixed(2)} good={metrics.payoffRatio >= 1.5} />
            </div>
          </div>

          {/* Returns and costs */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Returns & Costs</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <Metric label="Total Return" value={`${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn.toFixed(1)}%`} good={metrics.totalReturn > 0} />
              <Metric label="Annualized" value={`${metrics.annualizedReturn >= 0 ? '+' : ''}${metrics.annualizedReturn.toFixed(1)}%`} good={metrics.annualizedReturn > 0} />
              <Metric label="Long/Short" value={`${metrics.longTrades}/${metrics.shortTrades}`} />
              <Metric label="Commissions" value={`$${metrics.totalCommissions.toFixed(0)}`} />
              <Metric label="Slippage" value={`$${metrics.totalSlippage.toFixed(0)}`} />
              <Metric label="Net Costs" value={`$${(metrics.totalCommissions + metrics.totalSlippage).toFixed(0)}`} />
            </div>
          </div>

          {/* Equity curve */}
          <div className="bg-dark-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Equity Curve</div>
            <div className="h-20 flex items-end gap-px">
              {equityCurve
                .filter((_, i) => i % Math.ceil(equityCurve.length / 100) === 0)
                .map((eq, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const height = ((eq - min) / (max - min)) * 100 || 50;
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${eq >= config.startingCapital ? 'bg-neon-green' : 'bg-neon-red'} opacity-60 rounded-t-sm`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
            </div>
          </div>

          {/* Drawdown curve */}
          <div className="bg-dark-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Drawdown</div>
            <div className="h-16 flex items-start gap-px">
              {drawdownCurve
                .filter((_, i) => i % Math.ceil(drawdownCurve.length / 100) === 0)
                .map((dd, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-neon-red opacity-60 rounded-b-sm"
                    style={{ height: `${Math.min(dd * 2, 100)}%` }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? (bad ? 'text-neon-red' : 'text-neon-green') : 'text-white';
  return (
    <div className="bg-dark-600 rounded p-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
