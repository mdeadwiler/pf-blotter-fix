import { useState, useCallback, useMemo } from 'react';

interface SimulationConfig {
  portfolioValue: number;
  expectedReturn: number;    // Daily %
  volatility: number;        // Daily %
  timeHorizon: number;       // Days
  numSimulations: number;
  confidenceLevel: number;   // 95, 99, etc.
}

interface SimulationResult {
  var: number;               // Value at Risk
  cvar: number;              // Conditional VaR (Expected Shortfall)
  expectedValue: number;
  minValue: number;
  maxValue: number;
  percentiles: Record<number, number>;
  histogram: { bin: number; count: number }[];
  samplePaths: number[][];   // A few sample price paths
}

const DEFAULT_CONFIG: SimulationConfig = {
  portfolioValue: 1000000,
  expectedReturn: 0.04,      // 0.04% daily ≈ 10% annually
  volatility: 1.2,           // 1.2% daily ≈ 19% annually
  timeHorizon: 10,           // 10-day VaR (Basel standard)
  numSimulations: 10000,
  confidenceLevel: 95,
};

// Box-Muller transform for normal random numbers
function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function MonteCarloVaR() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      const {
        portfolioValue,
        expectedReturn,
        volatility,
        timeHorizon,
        numSimulations,
        confidenceLevel,
      } = config;

      const mu = expectedReturn / 100;
      const sigma = volatility / 100;
      const finalValues: number[] = [];
      const samplePaths: number[][] = [];

      // Run Monte Carlo simulation
      for (let sim = 0; sim < numSimulations; sim++) {
        let value = portfolioValue;
        const path: number[] = [value];

        // Geometric Brownian Motion: S(t) = S(0) * exp((μ - σ²/2)t + σ√t * Z)
        for (let day = 0; day < timeHorizon; day++) {
          const Z = randomNormal();
          const drift = (mu - 0.5 * sigma * sigma);
          const diffusion = sigma * Z;
          value = value * Math.exp(drift + diffusion);
          path.push(value);
        }

        finalValues.push(value);
        
        // Keep a few sample paths for visualization
        if (sim < 5) {
          samplePaths.push(path);
        }
      }

      // Sort for percentile calculations
      finalValues.sort((a, b) => a - b);

      // Calculate VaR (loss at confidence level)
      const varIndex = Math.floor((1 - confidenceLevel / 100) * numSimulations);
      const varValue = portfolioValue - finalValues[varIndex];

      // Calculate CVaR (average of losses beyond VaR)
      const tailValues = finalValues.slice(0, varIndex + 1);
      const cvarValue = portfolioValue - (tailValues.reduce((a, b) => a + b, 0) / tailValues.length);

      // Calculate percentiles
      const percentiles: Record<number, number> = {};
      [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
        const idx = Math.floor(p / 100 * numSimulations);
        percentiles[p] = finalValues[idx];
      });

      // Build histogram
      const minVal = finalValues[0];
      const maxVal = finalValues[finalValues.length - 1];
      const numBins = 50;
      const binWidth = (maxVal - minVal) / numBins;
      const histogram: { bin: number; count: number }[] = [];
      
      for (let i = 0; i < numBins; i++) {
        const binStart = minVal + i * binWidth;
        const binEnd = binStart + binWidth;
        const count = finalValues.filter(v => v >= binStart && v < binEnd).length;
        histogram.push({ bin: binStart + binWidth / 2, count });
      }

      setResult({
        var: varValue,
        cvar: cvarValue,
        expectedValue: finalValues.reduce((a, b) => a + b, 0) / numSimulations,
        minValue: minVal,
        maxValue: maxVal,
        percentiles,
        histogram,
        samplePaths,
      });

      setIsRunning(false);
    }, 50);
  }, [config]);

  const updateConfig = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Annualize daily params for display
  const annualizedReturn = useMemo(() => config.expectedReturn * 252, [config.expectedReturn]);
  const annualizedVol = useMemo(() => config.volatility * Math.sqrt(252), [config.volatility]);

  return (
    <div className="bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          Monte Carlo VaR Simulator
        </h3>
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className="px-4 py-1.5 bg-neon-red/20 border border-neon-red text-neon-red rounded font-medium hover:bg-neon-red/30 transition-colors disabled:opacity-50"
        >
          {isRunning ? 'Simulating...' : `Run ${config.numSimulations.toLocaleString()} Paths`}
        </button>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Portfolio ($)</label>
          <input
            type="number"
            value={config.portfolioValue}
            onChange={(e) => updateConfig('portfolioValue', parseInt(e.target.value) || 100000)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Daily Return (%)</label>
          <input
            type="number"
            step="0.01"
            value={config.expectedReturn}
            onChange={(e) => updateConfig('expectedReturn', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Daily Vol (%)</label>
          <input
            type="number"
            step="0.1"
            value={config.volatility}
            onChange={(e) => updateConfig('volatility', parseFloat(e.target.value) || 0.1)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Horizon (days)</label>
          <input
            type="number"
            value={config.timeHorizon}
            onChange={(e) => updateConfig('timeHorizon', parseInt(e.target.value) || 1)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Simulations</label>
          <select
            value={config.numSimulations}
            onChange={(e) => updateConfig('numSimulations', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            <option value={1000}>1,000</option>
            <option value={5000}>5,000</option>
            <option value={10000}>10,000</option>
            <option value={50000}>50,000</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Confidence</label>
          <select
            value={config.confidenceLevel}
            onChange={(e) => updateConfig('confidenceLevel', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            <option value={90}>90%</option>
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
        </div>
      </div>

      {/* Annualized params note */}
      <div className="text-xs text-gray-500 mb-4">
        Annualized: Return ≈ {annualizedReturn.toFixed(1)}%, Volatility ≈ {annualizedVol.toFixed(1)}%
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-dark-600 pt-4 space-y-4">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">VaR ({config.confidenceLevel}%)</div>
              <div className="text-xl font-bold text-neon-red">
                -${result.var.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                {(result.var / config.portfolioValue * 100).toFixed(2)}% of portfolio
              </div>
            </div>
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">CVaR (ES)</div>
              <div className="text-xl font-bold text-neon-red">
                -${result.cvar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                Expected Shortfall
              </div>
            </div>
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">Expected Value</div>
              <div className="text-xl font-bold text-neon-green">
                ${result.expectedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                {((result.expectedValue / config.portfolioValue - 1) * 100).toFixed(2)}% return
              </div>
            </div>
            <div className="bg-dark-700 rounded p-3 text-center">
              <div className="text-xs text-gray-500">Range</div>
              <div className="text-sm font-medium text-white">
                ${result.minValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} - 
                ${result.maxValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                Min to Max
              </div>
            </div>
          </div>

          {/* Distribution histogram */}
          <div className="bg-dark-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Terminal Value Distribution</div>
            <div className="h-24 flex items-end gap-px">
              {result.histogram.map((bar, i) => {
                const maxCount = Math.max(...result.histogram.map(h => h.count));
                const height = (bar.count / maxCount) * 100;
                const isVaR = bar.bin <= (config.portfolioValue - result.var);
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${isVaR ? 'bg-neon-red' : 'bg-neon-cyan/60'}`}
                    style={{ height: `${height}%` }}
                    title={`$${bar.bin.toLocaleString(undefined, { maximumFractionDigits: 0 })}: ${bar.count} paths`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>${result.minValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-neon-red">← VaR tail</span>
              <span>${result.maxValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Sample paths */}
          <div className="bg-dark-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Sample Price Paths</div>
            <div className="h-20 relative">
              {result.samplePaths.map((path, pathIdx) => (
                <svg key={pathIdx} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke={`hsl(${pathIdx * 60 + 180}, 70%, 50%)`}
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                    points={path.map((v, i) => {
                      const x = (i / (path.length - 1)) * 100;
                      const min = result.minValue * 0.95;
                      const max = result.maxValue * 1.05;
                      const y = 100 - ((v - min) / (max - min)) * 100;
                      return `${x}%,${y}%`;
                    }).join(' ')}
                  />
                </svg>
              ))}
              {/* Initial value line */}
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-gray-500"
                style={{ 
                  top: `${100 - ((config.portfolioValue - result.minValue * 0.95) / 
                    (result.maxValue * 1.05 - result.minValue * 0.95)) * 100}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Day 0</span>
              <span>Day {config.timeHorizon}</span>
            </div>
          </div>

          {/* Percentiles table */}
          <div>
            <div className="text-xs text-gray-400 mb-2">Distribution Percentiles</div>
            <div className="grid grid-cols-9 gap-1 text-center text-xs">
              {Object.entries(result.percentiles).map(([p, value]) => (
                <div key={p} className="bg-dark-600 rounded py-1">
                  <div className="text-gray-500">{p}th</div>
                  <div className={`font-medium ${
                    parseInt(p) <= (100 - config.confidenceLevel) ? 'text-neon-red' : 'text-white'
                  }`}>
                    ${(value / 1000).toFixed(0)}k
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Theory Note */}
      <div className="mt-4 text-xs text-gray-500 bg-dark-700/50 rounded p-2">
        <strong>Monte Carlo VaR:</strong> Simulates {config.numSimulations.toLocaleString()} price paths using 
        Geometric Brownian Motion. VaR is the loss at the {config.confidenceLevel}th percentile. 
        CVaR (Expected Shortfall) is the average loss beyond VaR—a more conservative tail risk measure 
        required under Basel III.
      </div>
    </div>
  );
}
