import { PortfolioOptimizer } from '../analytics/PortfolioOptimizer';
import { OptionsPricer } from '../analytics/OptionsPricer';
import { MonteCarloVaR } from '../analytics/MonteCarloVaR';
import { KellyCalculator } from '../analytics/KellyCalculator';
import { ErrorBoundary } from '../ErrorBoundary';

export function AnalyticsTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-800 rounded-lg neon-border p-4">
        <h2 className="text-lg font-medium text-white mb-2">Quantitative Analytics</h2>
        <p className="text-sm text-gray-400">
          Professional tools used by quant researchers, portfolio managers, and risk teams 
          at hedge funds and investment banks.
        </p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-dark-700 rounded p-2">
            <div className="text-neon-green font-medium">Portfolio Optimizer</div>
            <div className="text-gray-500">Markowitz Mean-Variance</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-neon-yellow font-medium">Options Pricer</div>
            <div className="text-gray-500">Black-Scholes + Greeks</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-neon-red font-medium">Monte Carlo VaR</div>
            <div className="text-gray-500">10,000 Path Simulation</div>
          </div>
          <div className="bg-dark-700 rounded p-2">
            <div className="text-neon-cyan font-medium">Kelly Criterion</div>
            <div className="text-gray-500">Optimal Position Sizing</div>
          </div>
        </div>
      </div>

      {/* Portfolio Optimizer */}
      <ErrorBoundary>
        <PortfolioOptimizer />
      </ErrorBoundary>

      {/* Options Pricer */}
      <ErrorBoundary>
        <OptionsPricer />
      </ErrorBoundary>

      {/* Two-column layout for smaller tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBoundary>
          <MonteCarloVaR />
        </ErrorBoundary>
        <ErrorBoundary>
          <KellyCalculator />
        </ErrorBoundary>
      </div>
    </div>
  );
}
