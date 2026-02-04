import { useRef, useEffect, useCallback, useState } from 'react';
import type { User, Order } from '../types/order';
import { useOrderStream } from '../hooks/useOrderStream';
import { useSound } from '../hooks/useSound';
import { useTheme } from '../hooks/useTheme';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from './Toast';
import { Blotter } from './Blotter';
import { ConnectionIndicator } from './ConnectionIndicator';
import { OrderForm } from './OrderForm';
import { OrderBook } from './OrderBook';
import { PerformanceMetrics } from './PerformanceMetrics';
import { MarketDataTicker } from './MarketDataTicker';
import { PositionTracker } from './PositionTracker';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AlgoPanel } from './AlgoPanel';
import { BacktestPanel } from './BacktestPanel';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const { orders, connectionStatus, error, reconnect } = useOrderStream();
  const { playFill, playReject, playNew, playCancel, setEnabled: setSoundEnabled, isEnabled: isSoundEnabled } = useSound();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  
  const [soundOn, setSoundOn] = useState(true);
  const orderFormRef = useRef<HTMLInputElement | null>(null);
  const prevOrdersRef = useRef<Map<string, Order>>(new Map());

  // Track order changes for notifications and sounds
  useEffect(() => {
    const prevOrders = prevOrdersRef.current;
    
    for (const order of orders) {
      const prev = prevOrders.get(order.clOrdId);
      
      if (!prev) {
        // New order
        if (order.status === 'NEW') {
          playNew();
          addToast(`Order ${order.clOrdId} submitted`, 'info');
        }
      } else if (prev.status !== order.status) {
        // Status changed
        switch (order.status) {
          case 'FILLED':
            playFill();
            addToast(`Order ${order.clOrdId} FILLED at ${order.avgPx.toFixed(2)}`, 'success');
            break;
          case 'PARTIAL':
            playFill();
            addToast(`Order ${order.clOrdId} partial fill: ${order.cumQty}/${order.quantity}`, 'success');
            break;
          case 'REJECTED':
            playReject();
            addToast(`Order ${order.clOrdId} REJECTED: ${order.rejectReason || 'Unknown'}`, 'error');
            break;
          case 'CANCELED':
            playCancel();
            addToast(`Order ${order.clOrdId} canceled`, 'warning');
            break;
        }
      }
    }
    
    // Update reference
    prevOrdersRef.current = new Map(orders.map(o => [o.clOrdId, o]));
  }, [orders, playFill, playReject, playNew, playCancel, addToast]);

  // Sync sound state
  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, [isSoundEnabled]);

  const toggleSound = useCallback(() => {
    const newState = !soundOn;
    setSoundOn(newState);
    setSoundEnabled(newState);
    addToast(newState ? 'Sound enabled' : 'Sound disabled', 'info');
  }, [soundOn, setSoundEnabled, addToast]);

  const focusOrderForm = useCallback(() => {
    orderFormRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewOrder: focusOrderForm,
    onEscape: () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
    onToggleSound: toggleSound,
    onToggleTheme: () => {
      toggleTheme();
      addToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} theme`, 'info');
    },
  });

  // Show loading skeleton while connecting
  if (connectionStatus === 'connecting' && orders.length === 0) {
    return <LoadingSkeleton />;
  }

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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl md:text-2xl font-bold text-neon-cyan neon-text">
                QuantBlotterSim
              </h1>
              <span className="text-xs text-gray-500 bg-dark-700 px-2 py-1 rounded hidden sm:inline">
                FIX 4.4
              </span>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
              {/* Theme toggle */}
              <button
                onClick={() => {
                  toggleTheme();
                  addToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} theme`, 'info');
                }}
                className="p-2 text-gray-400 hover:text-neon-cyan transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme (T)`}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Sound toggle */}
              <button
                onClick={toggleSound}
                className={`p-2 transition-colors ${soundOn ? 'text-neon-green' : 'text-gray-500'}`}
                title={`${soundOn ? 'Disable' : 'Enable'} sound (S)`}
              >
                {soundOn ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>

              <ConnectionIndicator
                status={connectionStatus}
                error={error}
                onReconnect={reconnect}
              />

              <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-dark-600">
                <div className="text-right hidden sm:block">
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
      <div className="bg-dark-800/50 border-b border-dark-600 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 md:gap-8 min-w-max">
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
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
        {/* Order Entry Form + Order Book + Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <OrderForm onOrderSubmitted={() => {}} inputRef={orderFormRef} />
          </div>
          <div className="hidden md:block">
            <OrderBook symbol="AAPL" />
          </div>
          <div className="hidden md:block">
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

        {/* Algo Trading Panel */}
        <AlgoPanel />

        {/* Backtesting Panel */}
        <BacktestPanel />

        {/* Keyboard shortcuts help */}
        <div className="mt-6 bg-dark-800/50 rounded-lg p-4 border border-dark-600">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
            <span><kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">N</kbd> New order</span>
            <span><kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">Esc</kbd> Unfocus</span>
            <span><kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">S</kbd> Toggle sound</span>
            <span><kbd className="px-1.5 py-0.5 bg-dark-700 rounded text-gray-400">T</kbd> Toggle theme</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-800/80 backdrop-blur border-t border-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <span className="hidden sm:inline">QuantBlotterSim • FIX 4.4 Order Gateway Simulator</span>
          <span className="sm:hidden">QuantBlotterSim</span>
          <span>Real-time streaming</span>
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
