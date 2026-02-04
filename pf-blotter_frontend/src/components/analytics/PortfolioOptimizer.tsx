import { useState, useCallback } from 'react';

interface Asset {
  symbol: string;
  expectedReturn: number;  // Annual %
  volatility: number;      // Annual %
  weight: number;          // Portfolio weight
}

interface PortfolioResult {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  weights: Record<string, number>;
}

interface EfficientFrontierPoint {
  return: number;
  volatility: number;
  sharpe: number;
  weights: Record<string, number>;
}

const DEFAULT_ASSETS: Asset[] = [
  { symbol: 'AAPL', expectedReturn: 12, volatility: 25, weight: 25 },
  { symbol: 'GOOGL', expectedReturn: 15, volatility: 30, weight: 25 },
  { symbol: 'MSFT', expectedReturn: 11, volatility: 22, weight: 25 },
  { symbol: 'NVDA', expectedReturn: 25, volatility: 45, weight: 25 },
];

// Correlation matrix (simplified)
const CORRELATIONS: Record<string, Record<string, number>> = {
  AAPL: { AAPL: 1, GOOGL: 0.65, MSFT: 0.72, NVDA: 0.58 },
  GOOGL: { AAPL: 0.65, GOOGL: 1, MSFT: 0.68, NVDA: 0.62 },
  MSFT: { AAPL: 0.72, GOOGL: 0.68, MSFT: 1, NVDA: 0.55 },
  NVDA: { AAPL: 0.58, GOOGL: 0.62, MSFT: 0.55, NVDA: 1 },
};

const RISK_FREE_RATE = 5.0; // Current T-bill rate

export function PortfolioOptimizer() {
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [frontier, setFrontier] = useState<EfficientFrontierPoint[]>([]);
  const [targetReturn, setTargetReturn] = useState(15);
  const [optimizationMode, setOptimizationMode] = useState<'maxSharpe' | 'minVar' | 'targetReturn'>('maxSharpe');

  // Calculate portfolio variance using correlation matrix
  const calculateVariance = useCallback((weights: number[], assetList: Asset[]): number => {
    let variance = 0;
    for (let i = 0; i < assetList.length; i++) {
      for (let j = 0; j < assetList.length; j++) {
        const corr = CORRELATIONS[assetList[i].symbol]?.[assetList[j].symbol] || (i === j ? 1 : 0.5);
        variance += weights[i] * weights[j] * 
          (assetList[i].volatility / 100) * (assetList[j].volatility / 100) * corr;
      }
    }
    return variance;
  }, []);

  // Calculate portfolio return
  const calculateReturn = useCallback((weights: number[], assetList: Asset[]): number => {
    return weights.reduce((sum, w, i) => sum + w * assetList[i].expectedReturn, 0);
  }, []);

  // Generate random weights that sum to 1
  const randomWeights = useCallback((n: number): number[] => {
    const weights = Array(n).fill(0).map(() => Math.random());
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  }, []);

  // Monte Carlo optimization (simplified for browser)
  const optimize = useCallback(() => {
    const n = assets.length;
    if (n === 0) return;

    let bestSharpe = -Infinity;
    let bestMinVar = Infinity;
    let bestTargetWeights: number[] = [];
    let bestSharpeWeights: number[] = [];
    let bestMinVarWeights: number[] = [];
    let closestToTarget = Infinity;

    const frontierPoints: EfficientFrontierPoint[] = [];
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const weights = randomWeights(n);
      const ret = calculateReturn(weights, assets);
      const variance = calculateVariance(weights, assets);
      const vol = Math.sqrt(variance) * 100;
      const sharpe = (ret - RISK_FREE_RATE) / vol;

      // Track best Sharpe
      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestSharpeWeights = weights;
      }

      // Track minimum variance
      if (vol < bestMinVar) {
        bestMinVar = vol;
        bestMinVarWeights = weights;
      }

      // Track closest to target return
      if (Math.abs(ret - targetReturn) < closestToTarget) {
        closestToTarget = Math.abs(ret - targetReturn);
        bestTargetWeights = weights;
      }

      // Sample points for efficient frontier
      if (i % 100 === 0) {
        frontierPoints.push({
          return: ret,
          volatility: vol,
          sharpe,
          weights: assets.reduce((acc, a, idx) => ({ ...acc, [a.symbol]: weights[idx] * 100 }), {}),
        });
      }
    }

    // Select weights based on optimization mode
    let selectedWeights: number[];
    switch (optimizationMode) {
      case 'minVar':
        selectedWeights = bestMinVarWeights;
        break;
      case 'targetReturn':
        selectedWeights = bestTargetWeights;
        break;
      default:
        selectedWeights = bestSharpeWeights;
    }

    const finalReturn = calculateReturn(selectedWeights, assets);
    const finalVariance = calculateVariance(selectedWeights, assets);
    const finalVol = Math.sqrt(finalVariance) * 100;

    setResult({
      expectedReturn: finalReturn,
      volatility: finalVol,
      sharpeRatio: (finalReturn - RISK_FREE_RATE) / finalVol,
      weights: assets.reduce((acc, a, i) => ({ ...acc, [a.symbol]: selectedWeights[i] * 100 }), {}),
    });

    // Sort frontier by volatility for chart
    setFrontier(frontierPoints.sort((a, b) => a.volatility - b.volatility));
  }, [assets, optimizationMode, targetReturn, calculateReturn, calculateVariance, randomWeights]);

  const updateAsset = (index: number, field: keyof Asset, value: number) => {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  return (
    <div className="bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          Portfolio Optimizer (Markowitz)
        </h3>
        <button
          onClick={optimize}
          className="px-4 py-1.5 bg-neon-green/20 border border-neon-green text-neon-green rounded font-medium hover:bg-neon-green/30 transition-colors"
        >
          Optimize
        </button>
      </div>

      {/* Optimization Mode */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'maxSharpe', label: 'Max Sharpe' },
          { id: 'minVar', label: 'Min Variance' },
          { id: 'targetReturn', label: 'Target Return' },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setOptimizationMode(mode.id as typeof optimizationMode)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              optimizationMode === mode.id
                ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan'
                : 'bg-dark-700 border border-dark-500 text-gray-400 hover:border-gray-400'
            }`}
          >
            {mode.label}
          </button>
        ))}
        {optimizationMode === 'targetReturn' && (
          <input
            type="number"
            value={targetReturn}
            onChange={(e) => setTargetReturn(parseFloat(e.target.value) || 10)}
            className="w-20 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-sm text-white"
            placeholder="Target %"
          />
        )}
      </div>

      {/* Asset Inputs */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-2">Symbol</th>
              <th className="pb-2">Expected Return (%)</th>
              <th className="pb-2">Volatility (%)</th>
              <th className="pb-2">Current Weight (%)</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, i) => (
              <tr key={asset.symbol}>
                <td className="py-1 text-white font-medium">{asset.symbol}</td>
                <td className="py-1">
                  <input
                    type="number"
                    value={asset.expectedReturn}
                    onChange={(e) => updateAsset(i, 'expectedReturn', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-white"
                  />
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    value={asset.volatility}
                    onChange={(e) => updateAsset(i, 'volatility', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-white"
                  />
                </td>
                <td className="py-1 text-gray-400">{asset.weight.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-dark-600 pt-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Optimal Portfolio</h4>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">Expected Return</div>
              <div className="text-lg font-semibold text-neon-green">{result.expectedReturn.toFixed(2)}%</div>
            </div>
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">Volatility</div>
              <div className="text-lg font-semibold text-neon-yellow">{result.volatility.toFixed(2)}%</div>
            </div>
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">Sharpe Ratio</div>
              <div className={`text-lg font-semibold ${result.sharpeRatio >= 1 ? 'text-neon-green' : 'text-white'}`}>
                {result.sharpeRatio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Optimal Weights */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">Optimal Weights</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(result.weights).map(([symbol, weight]) => (
                <div key={symbol} className="bg-dark-600 rounded px-3 py-1.5">
                  <span className="text-white font-medium">{symbol}</span>
                  <span className="text-neon-cyan ml-2">{(weight as number).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Efficient Frontier Visualization */}
          {frontier.length > 0 && (
            <div className="bg-dark-700 rounded p-3">
              <div className="text-xs text-gray-500 mb-2">Efficient Frontier</div>
              <div className="h-32 flex items-end gap-px relative">
                {frontier.slice(0, 50).map((point, i) => {
                  const height = (point.sharpe + 1) / 3 * 100; // Normalize Sharpe for display
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-sm transition-colors ${
                        point.sharpe >= result.sharpeRatio - 0.1 && point.sharpe <= result.sharpeRatio + 0.1
                          ? 'bg-neon-green'
                          : 'bg-neon-cyan/40'
                      }`}
                      style={{ height: `${Math.max(10, height)}%` }}
                      title={`Return: ${point.return.toFixed(1)}%, Vol: ${point.volatility.toFixed(1)}%, Sharpe: ${point.sharpe.toFixed(2)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low Vol</span>
                <span>High Vol</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Theory Note */}
      <div className="mt-4 text-xs text-gray-500 bg-dark-700/50 rounded p-2">
        <strong>Markowitz Mean-Variance:</strong> Finds the portfolio with the best risk-adjusted return 
        given asset returns, volatilities, and correlations. Risk-free rate: {RISK_FREE_RATE}% (T-bills).
      </div>
    </div>
  );
}
