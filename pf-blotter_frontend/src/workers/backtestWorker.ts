// Web Worker for strategy backtesting
// Runs heavy calculations off the main thread

type StrategyType = 'mean_reversion' | 'momentum' | 'bollinger' | 'rsi' | 'breakout';

interface BacktestConfig {
  symbol: string;
  strategy: StrategyType;
  startingCapital: number;
  orderSize: number;
  periods: number;
  volatility: number;
  lookbackPeriod: number;
  threshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  bollingerStdDev: number;
  commissionPerTrade: number;
  slippageBps: number;
  stopLossPct: number;
  takeProfitPct: number;
}

interface Trade {
  entry: number;
  exit: number;
  side: 'long' | 'short';
  pnl: number;
  pnlPct: number;
  holdingPeriod: number;
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
  var95: number;
  cvar95: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  treynorRatio: number;
  totalCommissions: number;
  totalSlippage: number;
}

const TICKER_PRICES: Record<string, number> = {
  AAPL: 185, GOOGL: 175, MSFT: 420, NVDA: 875, TSLA: 175, AMZN: 185,
};

function generatePrices(start: number, n: number, vol: number): number[] {
  const prices = [start];
  for (let i = 1; i < n; i++) {
    const dailyVol = vol / Math.sqrt(252);
    const change = (Math.random() - 0.48) * 2 * dailyVol / 100 * prices[i-1];
    prices.push(Math.max(1, prices[i-1] + change));
  }
  return prices;
}

function calculateSMA(prices: number[], idx: number, period: number): number {
  const start = Math.max(0, idx - period + 1);
  const slice = prices.slice(start, idx + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calculateRSI(prices: number[], idx: number, period: number): number {
  if (idx < period) return 50;
  let gains = 0, losses = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calculateBollinger(prices: number[], idx: number, period: number, mult: number) {
  const sma = calculateSMA(prices, idx, period);
  const slice = prices.slice(Math.max(0, idx - period + 1), idx + 1);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / slice.length;
  const std = Math.sqrt(variance);
  return { upper: sma + mult * std, lower: sma - mult * std, middle: sma };
}

function runBacktest(config: BacktestConfig): { metrics: RiskMetrics; trades: Trade[]; equity: number[]; drawdowns: number[] } {
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
    
    // Stop-loss / take-profit
    if (position !== 0) {
      const pnlPct = ((price - entryPrice) / entryPrice) * 100 * (position > 0 ? 1 : -1);
      if (pnlPct <= -config.stopLossPct || pnlPct >= config.takeProfitPct) {
        signal = position > 0 ? 'sell' : 'buy';
      }
    }
    
    // Execute trades
    if (signal === 'buy' && position <= 0) {
      if (position < 0) {
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
      // Open short
      position = -config.orderSize;
      entryPrice = price;
      entryIdx = i;
    }
    
    equity.push(cash + position * price);
    
    // Progress reporting
    if (i % Math.floor(prices.length / 10) === 0) {
      self.postMessage({ type: 'progress', progress: i / prices.length });
    }
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
  }
  
  // Calculate metrics
  const returns = equity.slice(1).map((e, i) => (e - equity[i]) / equity[i]);
  const negativeReturns = returns.filter(r => r < 0);
  
  // Drawdown
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
  
  // Beta and Alpha
  const benchmarkAvg = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
  const covariance = returns.slice(0, benchmarkReturns.length).reduce((sum, r, i) => 
    sum + (r - avgReturn) * (benchmarkReturns[i] - benchmarkAvg), 0) / benchmarkReturns.length;
  const benchmarkVar = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - benchmarkAvg, 2), 0) / benchmarkReturns.length;
  const beta = benchmarkVar > 0 ? covariance / benchmarkVar : 1;
  const alpha = (avgReturn - beta * benchmarkAvg) * 252;
  
  const trackingError = Math.sqrt(returns.slice(0, benchmarkReturns.length).reduce((sum, r, i) => 
    sum + Math.pow(r - benchmarkReturns[i], 2), 0) / benchmarkReturns.length) * Math.sqrt(252);
  const infoRatio = trackingError > 0 ? (annualizedReturn - benchmarkAvg * 252) / trackingError : 0;
  const treynor = beta !== 0 ? annualizedReturn / beta : 0;
  
  const metrics: RiskMetrics = {
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
  };
  
  return { metrics, trades: allTrades, equity, drawdowns };
}

// Worker message handler
self.onmessage = (e: MessageEvent<BacktestConfig>) => {
  try {
    const result = runBacktest(e.data);
    self.postMessage({ type: 'result', ...result });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
};

export {};
