import type { User } from '../types/order';
import { useOrderStream } from '../hooks/useOrderStream';
import { Blotter } from './Blotter';
import { ConnectionIndicator } from './ConnectionIndicator';
import { OrderForm } from './OrderForm';
import { OrderBook } from './OrderBook';
import { PerformanceMetrics } from './PerformanceMetrics';
import { MarketDataTicker } from './MarketDataTicker';
import { PositionTracker } from './PositionTracker';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const { orders, connectionStatus, error, reconnect } = useOrderStream();

  // Calculate summary stats
  const stats = {
    total: orders.length,
    new: orders.filter((o) => o.status === 'NEW').length,
    partial: orders.filter((o) => o.status === 'PARTIAL').length,
    filled: orders.filter((o) => o.status === 'FILLED').length,
    rejected: orders.filter((o) => o.status === 'REJECTED').length,
    canceled: orders.filter((o) => o.status === 'CANCELED').length,
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-neon-cyan neon-text">
                PF-BLOTTER
              </h1>
              <span className="text-xs text-gray-500 bg-dark-700 px-2 py-1 rounded">
                FIX 4.4
              </span>
            </div>

            <div className="flex items-center gap-6">
              <ConnectionIndicator
                status={connectionStatus}
                error={error}
                onReconnect={reconnect}
              />

              <div className="flex items-center gap-3 pl-6 border-l border-dark-600">
                <div className="text-right">
                  <p className="text-sm text-white">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-400 hover:text-neon-red transition-colors"
                  title="Sign out"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Market Data Ticker */}
      <MarketDataTicker />

      {/* Stats bar */}
      <div className="bg-dark-800/50 border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-8">
            <StatBadge label="Total" value={stats.total} color="text-white" />
            <StatBadge label="New" value={stats.new} color="text-neon-cyan" />
            <StatBadge label="Partial" value={stats.partial} color="text-neon-yellow" />
            <StatBadge label="Filled" value={stats.filled} color="text-neon-green" />
            <StatBadge label="Rejected" value={stats.rejected} color="text-neon-red" />
            <StatBadge label="Canceled" value={stats.canceled} color="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-20">
        {/* Order Entry Form + Order Book + Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <OrderForm onOrderSubmitted={() => {}} />
          </div>
          <div>
            <OrderBook symbol="AAPL" />
          </div>
          <div>
            <PerformanceMetrics />
          </div>
        </div>

        {/* Order Blotter */}
        <div className="mt-6 bg-dark-800 rounded-lg neon-border overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Order Blotter</h2>
            <span className="text-xs text-gray-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Blotter orders={orders} />
        </div>

        {/* Position Tracker */}
        <PositionTracker orders={orders} />

        {/* Instructions */}
        <div className="mt-6 bg-dark-800/50 rounded-lg p-4 border border-dark-600">
          <h3 className="text-sm font-medium text-gray-400 mb-2">CLI Commands</h3>
          <div className="text-xs text-gray-500 space-y-1 font-mono">
            <p>Send order: <span className="text-neon-green">nos A1 AAPL Buy 100 150.00</span></p>
            <p>Cancel order: <span className="text-neon-yellow">cancel A1 C1</span></p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-800/80 backdrop-blur border-t border-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <span>PF-Blotter • FIX 4.4 Order Gateway Simulator</span>
          <span>SSE Port: 8080 • Low-latency streaming</span>
        </div>
      </footer>
    </div>
  );
}

// Stat badge component
function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 uppercase">{label}</span>
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
    </div>
  );
}
