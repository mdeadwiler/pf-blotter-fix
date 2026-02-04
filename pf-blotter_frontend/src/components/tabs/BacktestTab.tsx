import { AdvancedBacktester } from '../AdvancedBacktester';
import { BacktestPanel } from '../BacktestPanel';
import { ErrorBoundary } from '../ErrorBoundary';

export function BacktestTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-800 rounded-lg neon-border p-4">
        <h2 className="text-lg font-medium text-white mb-2">Strategy Backtesting</h2>
        <p className="text-sm text-gray-400">
          Test trading strategies against synthetic historical data. Analyze risk-adjusted returns 
          with professional metrics used by hedge funds and prop trading desks.
        </p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-dark-700 rounded p-2">
            <div className="text-gray-500">Risk-Adjusted</div>
            <div className="text-white">Sharpe, Sortino, Calmar</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-gray-500">Risk Metrics</div>
            <div className="text-white">VaR, CVaR, Beta</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-gray-500">Cost Modeling</div>
            <div className="text-white">Commission, Slippage</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-gray-500">Risk Mgmt</div>
            <div className="text-white">Stop-Loss, Take-Profit</div>
          </div>
        </div>
      </div>

      {/* Professional Backtester */}
      <ErrorBoundary>
        <AdvancedBacktester />
      </ErrorBoundary>

      {/* Simple Backtester */}
      <details className="group">
        <summary className="cursor-pointer text-gray-400 hover:text-white text-sm flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Simple Backtester (Basic Metrics)
        </summary>
        <ErrorBoundary>
          <BacktestPanel />
        </ErrorBoundary>
      </details>
    </div>
  );
}
