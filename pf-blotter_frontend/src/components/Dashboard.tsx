import { useRef, useEffect, useCallback, useState } from 'react';
import type { User, Order } from '../types/order';
import { useOrderStream } from '../hooks/useOrderStream';
import { useSound } from '../hooks/useSound';
import { useTheme } from '../hooks/useTheme';
import { useToast } from './Toast';
import { ConnectionIndicator } from './ConnectionIndicator';
import { MarketDataTicker } from './MarketDataTicker';
import { LoadingSkeleton } from './LoadingSkeleton';
import { TabNavigation, TabId, TABS } from './TabNavigation';
import { TradingTab } from './tabs/TradingTab';
import { AlgoTab } from './tabs/AlgoTab';
import { BacktestTab } from './tabs/BacktestTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { ErrorBoundary } from './ErrorBoundary';

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
  const [activeTab, setActiveTab] = useState<TabId>('trading');
  const orderFormRef = useRef<HTMLInputElement | null>(null);
  const prevOrdersRef = useRef<Map<string, Order>>(new Map());

  // Track order changes for notifications and sounds
  useEffect(() => {
    const prevOrders = prevOrdersRef.current;
    
    for (const order of orders) {
      const prev = prevOrders.get(order.clOrdId);
      
      if (!prev) {
        if (order.status === 'NEW') {
          playNew();
          addToast(`Order ${order.clOrdId} submitted`, 'info');
        }
      } else if (prev.status !== order.status) {
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
    if (activeTab !== 'trading') {
      setActiveTab('trading');
      setTimeout(() => orderFormRef.current?.focus(), 100);
    } else {
      orderFormRef.current?.focus();
    }
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          focusOrderForm();
          break;
        case 's':
          e.preventDefault();
          toggleSound();
          break;
        case 't':
          e.preventDefault();
          toggleTheme();
          addToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} theme`, 'info');
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          const tabIndex = parseInt(e.key) - 1;
          if (tabIndex < TABS.length) {
            setActiveTab(TABS[tabIndex].id);
          }
          break;
        case 'escape':
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusOrderForm, toggleSound, toggleTheme, theme, addToast]);

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

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'trading':
        return (
          <TradingTab
            orders={orders}
            orderFormRef={orderFormRef}
            onOrderSubmitted={() => {}}
          />
        );
      case 'algo':
        return <AlgoTab />;
      case 'backtest':
        return <BacktestTab />;
      case 'analytics':
        return <AnalyticsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neon-cyan neon-text">
                QuantBlotterSim
              </h1>
              <span className="text-[10px] text-gray-500 bg-dark-700 px-1.5 py-0.5 rounded hidden sm:inline">
                FIX 4.4
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={() => {
                  toggleTheme();
                  addToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} theme`, 'info');
                }}
                className="p-1.5 text-gray-400 hover:text-neon-cyan transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme (T)`}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Sound toggle */}
              <button
                onClick={toggleSound}
                className={`p-1.5 transition-colors ${soundOn ? 'text-neon-green' : 'text-gray-500'}`}
                title={`${soundOn ? 'Disable' : 'Enable'} sound (S)`}
              >
                {soundOn ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              <div className="flex items-center gap-2 pl-3 border-l border-dark-600">
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-white leading-tight">{user.name}</p>
                  <p className="text-[10px] text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-gray-400 hover:text-neon-red transition-colors"
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Stats bar (only show on Trading tab) */}
      {activeTab === 'trading' && (
        <div className="bg-dark-800/50 border-b border-dark-600 overflow-x-auto flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center gap-4 md:gap-6 min-w-max text-sm">
              <StatBadge label="Total" value={stats.total} color="text-white" />
              <StatBadge label="New" value={stats.new} color="text-neon-cyan" />
              <StatBadge label="Partial" value={stats.partial} color="text-neon-yellow" />
              <StatBadge label="Filled" value={stats.filled} color="text-neon-green" />
              <StatBadge label="Rejected" value={stats.rejected} color="text-neon-red" />
              <StatBadge label="Canceled" value={stats.canceled} color="text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <ErrorBoundary>
            {renderActiveTab()}
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur border-t border-dark-600 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">QuantBlotterSim • FIX 4.4 Order Gateway</span>
            <span className="sm:hidden">QuantBlotterSim</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Shortcuts:</span>
            <kbd className="px-1 bg-dark-700 rounded text-[10px]">N</kbd>
            <span className="hidden md:inline text-[10px]">Order</span>
            <kbd className="px-1 bg-dark-700 rounded text-[10px]">1-4</kbd>
            <span className="hidden md:inline text-[10px]">Tabs</span>
            <kbd className="px-1 bg-dark-700 rounded text-[10px]">S</kbd>
            <span className="hidden md:inline text-[10px]">Sound</span>
            <kbd className="px-1 bg-dark-700 rounded text-[10px]">T</kbd>
            <span className="hidden md:inline text-[10px]">Theme</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 uppercase">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
