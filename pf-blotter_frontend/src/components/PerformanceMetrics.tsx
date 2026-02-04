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
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        Performance
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Latency Stats */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Latency</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Avg</span>
              <span className="font-mono text-emerald-400 font-medium">{formatLatency(stats.avgLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Min</span>
              <span className="font-mono text-cyan-400 font-medium">{formatLatency(stats.minLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Max</span>
              <span className="font-mono text-amber-400 font-medium">{formatLatency(stats.maxLatencyUs)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">P99</span>
              <span className="font-mono text-red-400 font-medium">{formatLatency(stats.p99LatencyUs)}</span>
            </div>
          </div>
        </div>

        {/* Notional Stats */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Notional</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-mono text-white font-medium">{formatPrice(stats.totalNotional)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Filled</span>
              <span className="font-mono text-emerald-400 font-medium">{formatPrice(stats.filledNotional)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fill Rate</span>
              <span className="font-mono text-cyan-400 font-medium">
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
