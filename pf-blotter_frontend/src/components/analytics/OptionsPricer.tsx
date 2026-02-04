import { useState, useMemo } from 'react';

interface OptionInputs {
  spotPrice: number;      // S
  strikePrice: number;    // K
  timeToExpiry: number;   // T (years)
  riskFreeRate: number;   // r (%)
  volatility: number;     // σ (%)
  optionType: 'call' | 'put';
}

interface OptionGreeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface ImpliedVolResult {
  iv: number;
  iterations: number;
}

// Standard normal CDF approximation (Abramowitz and Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Standard normal PDF
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes d1 and d2
function calculateD1D2(S: number, K: number, T: number, r: number, sigma: number): { d1: number; d2: number } {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

// Black-Scholes pricing
function blackScholes(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): number {
  if (T <= 0) return Math.max(0, isCall ? S - K : K - S);
  
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  
  if (isCall) {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

// Calculate all Greeks
function calculateGreeks(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): OptionGreeks {
  const price = blackScholes(S, K, T, r, sigma, isCall);
  
  if (T <= 0) {
    return { price, delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  const sqrtT = Math.sqrt(T);
  const nd1 = normalCDF(d1);
  const nd2 = normalCDF(d2);
  const npd1 = normalPDF(d1);
  
  // Delta
  const delta = isCall ? nd1 : nd1 - 1;
  
  // Gamma (same for calls and puts)
  const gamma = npd1 / (S * sigma * sqrtT);
  
  // Theta (per day)
  const thetaBase = -(S * npd1 * sigma) / (2 * sqrtT);
  const theta = isCall
    ? (thetaBase - r * K * Math.exp(-r * T) * nd2) / 365
    : (thetaBase + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  
  // Vega (per 1% change in vol)
  const vega = S * npd1 * sqrtT / 100;
  
  // Rho (per 1% change in rate)
  const rho = isCall
    ? K * T * Math.exp(-r * T) * nd2 / 100
    : -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;
  
  return { price, delta, gamma, theta, vega, rho };
}

// Newton-Raphson for implied volatility
function impliedVolatility(
  targetPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  isCall: boolean
): ImpliedVolResult {
  let sigma = 0.3; // Initial guess
  const tolerance = 0.0001;
  const maxIterations = 100;
  
  for (let i = 0; i < maxIterations; i++) {
    const price = blackScholes(S, K, T, r, sigma, isCall);
    const vega = calculateGreeks(S, K, T, r, sigma, isCall).vega * 100; // Scale back
    
    if (Math.abs(vega) < 0.0001) break; // Avoid division by zero
    
    const diff = price - targetPrice;
    if (Math.abs(diff) < tolerance) {
      return { iv: sigma * 100, iterations: i + 1 };
    }
    
    sigma = sigma - diff / vega;
    sigma = Math.max(0.01, Math.min(5, sigma)); // Bound sigma
  }
  
  return { iv: sigma * 100, iterations: maxIterations };
}

const DEFAULT_INPUTS: OptionInputs = {
  spotPrice: 185,
  strikePrice: 190,
  timeToExpiry: 0.25, // 3 months
  riskFreeRate: 5,
  volatility: 25,
  optionType: 'call',
};

export function OptionsPricer() {
  const [inputs, setInputs] = useState<OptionInputs>(DEFAULT_INPUTS);
  const [ivTargetPrice, setIvTargetPrice] = useState(8);
  const [showPayoff, setShowPayoff] = useState(false);

  const greeks = useMemo(() => {
    const r = inputs.riskFreeRate / 100;
    const sigma = inputs.volatility / 100;
    return calculateGreeks(
      inputs.spotPrice,
      inputs.strikePrice,
      inputs.timeToExpiry,
      r,
      sigma,
      inputs.optionType === 'call'
    );
  }, [inputs]);

  const ivResult = useMemo(() => {
    const r = inputs.riskFreeRate / 100;
    return impliedVolatility(
      ivTargetPrice,
      inputs.spotPrice,
      inputs.strikePrice,
      inputs.timeToExpiry,
      r,
      inputs.optionType === 'call'
    );
  }, [ivTargetPrice, inputs.spotPrice, inputs.strikePrice, inputs.timeToExpiry, inputs.riskFreeRate, inputs.optionType]);

  // Generate payoff diagram data
  const payoffData = useMemo(() => {
    const spots = [];
    const premium = greeks.price;
    const K = inputs.strikePrice;
    
    for (let s = K * 0.7; s <= K * 1.3; s += K * 0.02) {
      let payoff = inputs.optionType === 'call'
        ? Math.max(0, s - K) - premium
        : Math.max(0, K - s) - premium;
      spots.push({ spot: s, payoff });
    }
    return spots;
  }, [inputs.strikePrice, inputs.optionType, greeks.price]);

  const updateInput = <K extends keyof OptionInputs>(key: K, value: OptionInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-dark-800 rounded-lg neon-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-neon-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Options Pricer (Black-Scholes)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => updateInput('optionType', 'call')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              inputs.optionType === 'call'
                ? 'bg-neon-green/20 border border-neon-green text-neon-green'
                : 'bg-dark-700 border border-dark-500 text-gray-400'
            }`}
          >
            CALL
          </button>
          <button
            onClick={() => updateInput('optionType', 'put')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              inputs.optionType === 'put'
                ? 'bg-neon-red/20 border border-neon-red text-neon-red'
                : 'bg-dark-700 border border-dark-500 text-gray-400'
            }`}
          >
            PUT
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Spot (S)</label>
          <input
            type="number"
            value={inputs.spotPrice}
            onChange={(e) => updateInput('spotPrice', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Strike (K)</label>
          <input
            type="number"
            value={inputs.strikePrice}
            onChange={(e) => updateInput('strikePrice', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Time (yrs)</label>
          <input
            type="number"
            step="0.01"
            value={inputs.timeToExpiry}
            onChange={(e) => updateInput('timeToExpiry', parseFloat(e.target.value) || 0.01)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={inputs.riskFreeRate}
            onChange={(e) => updateInput('riskFreeRate', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Vol σ (%)</label>
          <input
            type="number"
            value={inputs.volatility}
            onChange={(e) => updateInput('volatility', parseFloat(e.target.value) || 1)}
            className="w-full px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
          />
        </div>
      </div>

      {/* Option Price */}
      <div className="bg-dark-700 rounded p-4 mb-4 text-center">
        <div className="text-sm text-gray-400 mb-1">
          {inputs.optionType.toUpperCase()} Option Price
        </div>
        <div className={`text-3xl font-bold ${inputs.optionType === 'call' ? 'text-neon-green' : 'text-neon-red'}`}>
          ${greeks.price.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Premium per share
        </div>
      </div>

      {/* Greeks */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <GreekBox label="Delta (Δ)" value={greeks.delta} format={v => v.toFixed(4)} color="neon-cyan" />
        <GreekBox label="Gamma (Γ)" value={greeks.gamma} format={v => v.toFixed(4)} color="neon-green" />
        <GreekBox label="Theta (Θ)" value={greeks.theta} format={v => v.toFixed(4)} color="neon-red" negative />
        <GreekBox label="Vega (ν)" value={greeks.vega} format={v => v.toFixed(4)} color="neon-yellow" />
        <GreekBox label="Rho (ρ)" value={greeks.rho} format={v => v.toFixed(4)} color="gray-400" />
      </div>

      {/* Greeks Explanation */}
      <div className="grid grid-cols-5 gap-2 mb-4 text-[10px] text-gray-500">
        <div>$1 stock → ${Math.abs(greeks.delta).toFixed(2)} option</div>
        <div>Delta acceleration</div>
        <div>${Math.abs(greeks.theta).toFixed(2)}/day decay</div>
        <div>1% vol → ${greeks.vega.toFixed(2)}</div>
        <div>1% rate → ${greeks.rho.toFixed(2)}</div>
      </div>

      {/* Implied Volatility Calculator */}
      <div className="border-t border-dark-600 pt-4 mb-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Implied Volatility Calculator</h4>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Market Price ($)</label>
            <input
              type="number"
              step="0.1"
              value={ivTargetPrice}
              onChange={(e) => setIvTargetPrice(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
            />
          </div>
          <div className="bg-dark-700 rounded px-3 py-1.5">
            <span className="text-xs text-gray-500">Implied Vol: </span>
            <span className="text-neon-cyan font-semibold">{ivResult.iv.toFixed(2)}%</span>
            <span className="text-xs text-gray-600 ml-2">({ivResult.iterations} iters)</span>
          </div>
        </div>
      </div>

      {/* Payoff Diagram Toggle */}
      <button
        onClick={() => setShowPayoff(!showPayoff)}
        className="text-xs text-gray-400 hover:text-white mb-2 flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${showPayoff ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Payoff Diagram
      </button>

      {showPayoff && (
        <div className="bg-dark-700 rounded p-3">
          <div className="h-24 flex items-center relative">
            <div className="absolute left-0 right-0 h-px bg-gray-600" style={{ top: '50%' }} />
            <div className="flex items-end h-full w-full gap-px">
              {payoffData.map((d, i) => {
                const maxPayoff = Math.max(...payoffData.map(p => Math.abs(p.payoff)));
                const height = (d.payoff / maxPayoff) * 50;
                return (
                  <div
                    key={i}
                    className={`flex-1 ${d.payoff >= 0 ? 'bg-neon-green' : 'bg-neon-red'}`}
                    style={{
                      height: `${Math.abs(height)}%`,
                      marginTop: d.payoff >= 0 ? 'auto' : undefined,
                      marginBottom: d.payoff < 0 ? 'auto' : undefined,
                      transform: d.payoff < 0 ? 'translateY(50%)' : 'translateY(-50%)',
                    }}
                    title={`Spot: $${d.spot.toFixed(0)}, P&L: $${d.payoff.toFixed(2)}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>${(inputs.strikePrice * 0.7).toFixed(0)}</span>
            <span>K=${inputs.strikePrice}</span>
            <span>${(inputs.strikePrice * 1.3).toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Theory Note */}
      <div className="mt-4 text-xs text-gray-500 bg-dark-700/50 rounded p-2">
        <strong>Black-Scholes Model:</strong> C = S·N(d₁) - K·e⁻ʳᵀ·N(d₂). 
        Assumes lognormal prices, constant vol, no dividends, European exercise.
      </div>
    </div>
  );
}

function GreekBox({ 
  label, 
  value, 
  format, 
  color, 
  negative 
}: { 
  label: string; 
  value: number; 
  format: (v: number) => string; 
  color: string;
  negative?: boolean;
}) {
  return (
    <div className="bg-dark-700 rounded p-2 text-center">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-semibold text-${color}`}>
        {negative && value < 0 ? '' : value >= 0 ? '+' : ''}{format(value)}
      </div>
    </div>
  );
}
