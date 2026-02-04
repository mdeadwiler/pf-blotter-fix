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
    <div className="bg-black/20 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium 
                rounded-lg transition-all duration-200 whitespace-nowrap my-1
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <kbd className={`hidden sm:inline ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono
                ${activeTab === tab.id 
                  ? 'bg-cyan-500/20 text-cyan-400/80' 
                  : 'bg-white/5 text-gray-500 border border-white/10'
                }`}>
                {tab.shortcut}
              </kbd>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
