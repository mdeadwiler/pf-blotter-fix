import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';
import { formatPrice } from '../utils/format';

interface Stats {
  totalOrders: number;
  newOrders: number;
  partialOrders: number;
  filledOrders: number;
  rejectedOrders: number;
  canceledOrders: number;
  avgLatencyUs: number;
  minLatencyUs: number;
  maxLatencyUs: number;
  p99LatencyUs: number;
  totalNotional: number;
  filledNotional: number;
}

export function PerformanceMetrics() {
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) {
    return null;
  }

  const formatLatency = (us: number): string => {
    if (us === 0) return '-';
    if (us < 1000) return `${us}μs`;
    return `${(us / 1000).toFixed(2)}ms`;
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 neon-border">
      <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Performance
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Latency Stats */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase">Latency</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Avg</span>
              <span className="font-mono text-neon-green">{formatLatency(stats.avgLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Min</span>
              <span className="font-mono text-neon-cyan">{formatLatency(stats.minLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Max</span>
              <span className="font-mono text-neon-yellow">{formatLatency(stats.maxLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">P99</span>
              <span className="font-mono text-neon-red">{formatLatency(stats.p99LatencyUs)}</span>
            </div>
          </div>
        </div>

        {/* Notional Stats */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase">Notional</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total</span>
              <span className="font-mono text-white">{formatPrice(stats.totalNotional)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Filled</span>
              <span className="font-mono text-neon-green">{formatPrice(stats.filledNotional)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fill Rate</span>
              <span className="font-mono text-neon-cyan">
                {stats.totalOrders > 0 
                  ? `${((stats.filledOrders / stats.totalOrders) * 100).toFixed(1)}%`
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
