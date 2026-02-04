import { ReactNode } from 'react';

export type TabId = 'trading' | 'algo' | 'backtest' | 'analytics';

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
  shortcut: string;
}

export const TABS: Tab[] = [
  {
    id: 'trading',
    label: 'Trading',
    shortcut: '1',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'algo',
    label: 'Algo Execution',
    shortcut: '2',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'backtest',
    label: 'Backtesting',
    shortcut: '3',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortcut: '4',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="bg-dark-800 border-b border-dark-600">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium 
                border-b-2 transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-dark-700/50'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[10px] bg-dark-700 rounded text-gray-500">
                {tab.shortcut}
              </kbd>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
