import { AdvancedAlgoPanel } from '../AdvancedAlgoPanel';
import { AlgoPanel } from '../AlgoPanel';
import { ErrorBoundary } from '../ErrorBoundary';

export function AlgoTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-800 rounded-lg neon-border p-4">
        <h2 className="text-lg font-medium text-white mb-2">Algorithmic Execution</h2>
        <p className="text-sm text-gray-400">
          Execute orders using industry-standard algorithms. VWAP and TWAP minimize market impact 
          for large orders. Technical strategies generate signals based on price action.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-neon-cyan/10 border border-neon-cyan/30 rounded text-xs text-neon-cyan">VWAP</span>
          <span className="px-2 py-1 bg-neon-cyan/10 border border-neon-cyan/30 rounded text-xs text-neon-cyan">TWAP</span>
          <span className="px-2 py-1 bg-neon-green/10 border border-neon-green/30 rounded text-xs text-neon-green">Bollinger</span>
          <span className="px-2 py-1 bg-neon-green/10 border border-neon-green/30 rounded text-xs text-neon-green">RSI</span>
          <span className="px-2 py-1 bg-neon-yellow/10 border border-neon-yellow/30 rounded text-xs text-neon-yellow">Pairs</span>
          <span className="px-2 py-1 bg-neon-yellow/10 border border-neon-yellow/30 rounded text-xs text-neon-yellow">Breakout</span>
        </div>
      </div>

      {/* Advanced Algo Panel */}
      <ErrorBoundary>
        <AdvancedAlgoPanel />
      </ErrorBoundary>

      {/* Simple Strategies */}
      <details className="group">
        <summary className="cursor-pointer text-gray-400 hover:text-white text-sm flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Simple Strategies (Basic Mean Reversion / Momentum)
        </summary>
        <ErrorBoundary>
          <AlgoPanel />
        </ErrorBoundary>
      </details>
    </div>
  );
}
