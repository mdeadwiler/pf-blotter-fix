import { useState, useMemo } from 'react';

interface KellyInputs {
  winProbability: number;     // % chance of winning
  winAmount: number;          // $ or % gained on win
  lossAmount: number;         // $ or % lost on loss
  bankroll: number;           // Total capital
  kellyFraction: number;      // Fraction of Kelly to use (1 = full Kelly)
}

interface KellyResult {
  fullKelly: number;          // Optimal fraction
  fractionalKelly: number;    // Adjusted by fraction
  optimalBetSize: number;     // $ amount to bet
  expectedValue: number;      // Expected return per bet
  expectedGrowth: number;     // Log-optimal growth rate
  ruinProbability: number;    // Chance of going broke (simplified)
  doublingTime: number;       // Expected bets to double
}

const DEFAULT_INPUTS: KellyInputs = {
  winProbability: 55,
  winAmount: 100,
  lossAmount: 100,
  bankroll: 100000,
  kellyFraction: 0.5,  // Half-Kelly is common practice
};

export function KellyCalculator() {
  const [inputs, setInputs] = useState<KellyInputs>(DEFAULT_INPUTS);

  const result = useMemo<KellyResult>(() => {
    const p = inputs.winProbability / 100;
    const q = 1 - p;
    const b = inputs.winAmount / inputs.lossAmount; // Odds ratio
    
    // Kelly formula: f* = (p * b - q) / b = p - q/b
    const fullKelly = Math.max(0, (p * b - q) / b);
    const fractionalKelly = fullKelly * inputs.kellyFraction;
    
    // Optimal bet size
    const optimalBetSize = fractionalKelly * inputs.bankroll;
    
    // Expected value per bet (as % of bet)
    const ev = p * inputs.winAmount - q * inputs.lossAmount;
    const evPercent = (ev / inputs.lossAmount) * 100;
    
    // Expected log growth (geometric return)
    // G = p * log(1 + f*b) + q * log(1 - f*)
    const f = fractionalKelly;
    const growth = f > 0 && f < 1
      ? p * Math.log(1 + f * b) + q * Math.log(1 - f)
      : 0;
    
    // Simplified ruin probability (exact formula is complex)
    // This is an approximation: (q/p)^n where n is units
    const ruinProb = fullKelly <= 0 ? 100 : Math.min(100, Math.pow(q / p, inputs.bankroll / inputs.lossAmount / 10) * 100);
    
    // Doubling time (bets needed to double at growth rate)
    const doublingTime = growth > 0 ? Math.log(2) / growth : Infinity;
    
    return {
      fullKelly: fullKelly * 100,
      fractionalKelly: fractionalKelly * 100,
      optimalBetSize,
      expectedValue: evPercent,
      expectedGrowth: growth * 100,
      ruinProbability: ruinProb,
      doublingTime,
    };
  }, [inputs]);

  const updateInput = <K extends keyof KellyInputs>(key: K, value: KellyInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  // Generate growth curve data for different Kelly fractions
  const growthCurve = useMemo(() => {
    const p = inputs.winProbability / 100;
    const q = 1 - p;
    const b = inputs.winAmount / inputs.lossAmount;
    
    const points: { fraction: number; growth: number }[] = [];
    for (let f = 0; f <= 2; f += 0.05) {
      const kelly = (p * b - q) / b;
      const actualF = kelly * f;
      if (actualF > 0 && actualF < 1) {
        const g = p * Math.log(1 + actualF * b) + q * Math.log(1 - actualF);
        points.push({ fraction: f * 100, growth: g * 100 });
      } else {
        points.push({ fraction: f * 100, growth: 0 });
      }
    }
    return points;
  }, [inputs.winProbability, inputs.winAmount, inputs.lossAmount]);

  // Check if we have an edge
  const hasEdge = result.fullKelly > 0;

  return (
    <div className="bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Kelly Criterion Calculator
        </h3>
        <div className={`text-xs px-2 py-1 rounded ${
          hasEdge 
            ? 'bg-neon-green/20 text-neon-green border border-neon-green/30' 
            : 'bg-neon-red/20 text-neon-red border border-neon-red/30'
        }`}>
          {hasEdge ? 'POSITIVE EDGE' : 'NO EDGE'}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Win Probability (%)</label>
          <input
            type="number"
            value={inputs.winProbability}
            onChange={(e) => updateInput('winProbability', Math.min(99, Math.max(1, parseFloat(e.target.value) || 50)))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Win Amount ($)</label>
          <input
            type="number"
            value={inputs.winAmount}
            onChange={(e) => updateInput('winAmount', Math.max(1, parseFloat(e.target.value) || 100))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Loss Amount ($)</label>
          <input
            type="number"
            value={inputs.lossAmount}
            onChange={(e) => updateInput('lossAmount', Math.max(1, parseFloat(e.target.value) || 100))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bankroll ($)</label>
          <input
            type="number"
            value={inputs.bankroll}
            onChange={(e) => updateInput('bankroll', Math.max(1, parseInt(e.target.value) || 10000))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Kelly Fraction</label>
          <select
            value={inputs.kellyFraction}
            onChange={(e) => updateInput('kellyFraction', parseFloat(e.target.value))}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          >
            <option value={0.25}>Quarter Kelly (25%)</option>
            <option value={0.5}>Half Kelly (50%)</option>
            <option value={0.75}>3/4 Kelly (75%)</option>
            <option value={1}>Full Kelly (100%)</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-dark-700 rounded p-3 text-center">
          <div className="text-xs text-gray-500">Full Kelly %</div>
          <div className={`text-xl font-bold ${hasEdge ? 'text-neon-cyan' : 'text-gray-400'}`}>
            {result.fullKelly.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">of bankroll</div>
        </div>
        <div className="bg-dark-700 rounded p-3 text-center">
          <div className="text-xs text-gray-500">Optimal Bet Size</div>
          <div className="text-xl font-bold text-neon-green">
            ${result.optimalBetSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500">{inputs.kellyFraction * 100}% Kelly</div>
        </div>
        <div className="bg-dark-700 rounded p-3 text-center">
          <div className="text-xs text-gray-500">Expected Value</div>
          <div className={`text-xl font-bold ${result.expectedValue > 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            {result.expectedValue > 0 ? '+' : ''}{result.expectedValue.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">per bet</div>
        </div>
        <div className="bg-dark-700 rounded p-3 text-center">
          <div className="text-xs text-gray-500">Growth Rate</div>
          <div className={`text-xl font-bold ${result.expectedGrowth > 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            {result.expectedGrowth.toFixed(3)}%
          </div>
          <div className="text-xs text-gray-500">per bet (log)</div>
        </div>
      </div>

      {/* Additional metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dark-600 rounded p-2 text-center">
          <div className="text-xs text-gray-500">Odds (b)</div>
          <div className="text-sm font-medium text-white">
            {(inputs.winAmount / inputs.lossAmount).toFixed(2)}:1
          </div>
        </div>
        <div className="bg-dark-600 rounded p-2 text-center">
          <div className="text-xs text-gray-500">Doubling Time</div>
          <div className="text-sm font-medium text-white">
            {result.doublingTime === Infinity ? '∞' : `~${Math.ceil(result.doublingTime)} bets`}
          </div>
        </div>
        <div className="bg-dark-600 rounded p-2 text-center">
          <div className="text-xs text-gray-500">Risk of Ruin</div>
          <div className={`text-sm font-medium ${result.ruinProbability < 1 ? 'text-neon-green' : 'text-neon-yellow'}`}>
            {result.ruinProbability < 0.01 ? '<0.01%' : result.ruinProbability.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Growth rate curve */}
      <div className="bg-dark-700 rounded p-3 mb-4">
        <div className="text-xs text-gray-400 mb-2">Growth Rate vs Kelly Fraction</div>
        <div className="h-24 flex items-end gap-px relative">
          {growthCurve.map((point, i) => {
            const maxGrowth = Math.max(...growthCurve.map(p => p.growth));
            const height = maxGrowth > 0 ? (point.growth / maxGrowth) * 100 : 0;
            const isOptimal = Math.abs(point.fraction - inputs.kellyFraction * 100) < 5;
            const isOverbet = point.fraction > 100;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-colors ${
                  isOptimal ? 'bg-neon-green' : isOverbet ? 'bg-neon-red/50' : 'bg-neon-cyan/40'
                }`}
                style={{ height: `${Math.max(2, height)}%` }}
                title={`${point.fraction.toFixed(0)}% Kelly: ${point.growth.toFixed(3)}% growth`}
              />
            );
          })}
          {/* Mark full Kelly */}
          <div 
            className="absolute bottom-0 w-px h-full bg-white/30"
            style={{ left: '50%' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>Full Kelly (100%)</span>
          <span>200% (overbet)</span>
        </div>
      </div>

      {/* Common scenarios */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Quick Scenarios</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Coin flip edge', win: 55, odds: 1 },
            { label: 'Sports betting', win: 52, odds: 0.91 },
            { label: 'Blackjack counter', win: 51, odds: 1 },
            { label: 'Strong edge', win: 60, odds: 1 },
            { label: 'Options (2:1)', win: 40, odds: 2 },
          ].map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => {
                updateInput('winProbability', scenario.win);
                updateInput('winAmount', scenario.odds * 100);
                updateInput('lossAmount', 100);
              }}
              className="px-2 py-1 bg-dark-600 hover:bg-dark-500 rounded text-xs text-gray-300 transition-colors"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theory Note */}
      <div className="text-xs text-gray-500 bg-dark-700/50 rounded p-2">
        <strong>Kelly Criterion:</strong> f* = (p·b - q) / b, where p = win probability, q = 1-p, 
        b = win/loss ratio. Maximizes long-term geometric growth. Most practitioners use fractional 
        Kelly (25-50%) to reduce variance and drawdowns. Overbetting (&gt;100% Kelly) has negative 
        expected growth despite positive EV.
      </div>
    </div>
  );
}
