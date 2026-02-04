// Web Worker for Monte Carlo VaR simulation
// Runs heavy calculations off the main thread

interface SimulationConfig {
  portfolioValue: number;
  expectedReturn: number;
  volatility: number;
  timeHorizon: number;
  numSimulations: number;
  confidenceLevel: number;
}

interface SimulationResult {
  var: number;
  cvar: number;
  expectedValue: number;
  minValue: number;
  maxValue: number;
  percentiles: Record<number, number>;
  histogram: { bin: number; count: number }[];
  samplePaths: number[][];
}

// Box-Muller transform for normal random numbers
function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runSimulation(config: SimulationConfig): SimulationResult {
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

  // Run Monte Carlo simulation with GBM
  for (let sim = 0; sim < numSimulations; sim++) {
    let value = portfolioValue;
    const path: number[] = [value];

    for (let day = 0; day < timeHorizon; day++) {
      const Z = randomNormal();
      const drift = mu - 0.5 * sigma * sigma;
      const diffusion = sigma * Z;
      value = value * Math.exp(drift + diffusion);
      path.push(value);
    }

    finalValues.push(value);
    
    // Keep sample paths for visualization
    if (sim < 5) {
      samplePaths.push(path);
    }
    
    // Report progress every 10%
    if (sim % Math.floor(numSimulations / 10) === 0) {
      self.postMessage({ type: 'progress', progress: sim / numSimulations });
    }
  }

  // Sort for percentile calculations
  finalValues.sort((a, b) => a - b);

  // VaR
  const varIndex = Math.floor((1 - confidenceLevel / 100) * numSimulations);
  const varValue = portfolioValue - finalValues[varIndex];

  // CVaR (Expected Shortfall)
  const tailValues = finalValues.slice(0, varIndex + 1);
  const cvarValue = portfolioValue - (tailValues.reduce((a, b) => a + b, 0) / tailValues.length);

  // Percentiles
  const percentiles: Record<number, number> = {};
  [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
    const idx = Math.floor(p / 100 * numSimulations);
    percentiles[p] = finalValues[idx];
  });

  // Histogram
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

  return {
    var: varValue,
    cvar: cvarValue,
    expectedValue: finalValues.reduce((a, b) => a + b, 0) / numSimulations,
    minValue: minVal,
    maxValue: maxVal,
    percentiles,
    histogram,
    samplePaths,
  };
}

// Worker message handler
self.onmessage = (e: MessageEvent<SimulationConfig>) => {
  try {
    const result = runSimulation(e.data);
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
};

export {};
