import { useState, useEffect, useCallback, useRef } from 'react';
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

// Simulated stats with realistic values
function generateSimulatedStats(): Stats {
  return {
    totalOrders: Math.floor(150 + Math.random() * 50),
    newOrders: Math.floor(5 + Math.random() * 10),
    partialOrders: Math.floor(2 + Math.random() * 5),
    filledOrders: Math.floor(100 + Math.random() * 30),
    rejectedOrders: Math.floor(Math.random() * 5),
    canceledOrders: Math.floor(10 + Math.random() * 10),
    avgLatencyUs: Math.floor(50 + Math.random() * 100),
    minLatencyUs: Math.floor(10 + Math.random() * 20),
    maxLatencyUs: Math.floor(500 + Math.random() * 500),
    p99LatencyUs: Math.floor(300 + Math.random() * 200),
    totalNotional: Math.floor(1000000 + Math.random() * 500000),
    filledNotional: Math.floor(800000 + Math.random() * 300000),
  };
}

export function PerformanceMetrics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/stats`);
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current) {
          setStats(data);
          setIsLive(true);
        }
        return true;
      }
    } catch {
      // Backend unavailable
    }
    return false;
  }, []);

  const generateLocal = useCallback(() => {
    if (!mountedRef.current) return;
    setStats(prev => {
      // Slightly modify previous stats for realism
      if (prev) {
        return {
          ...prev,
          totalOrders: prev.totalOrders + (Math.random() > 0.7 ? 1 : 0),
          filledOrders: prev.filledOrders + (Math.random() > 0.8 ? 1 : 0),
          avgLatencyUs: Math.floor(prev.avgLatencyUs + (Math.random() - 0.5) * 10),
          filledNotional: prev.filledNotional + Math.floor(Math.random() * 10000),
        };
      }
      return generateSimulatedStats();
    });
    setIsLive(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      const success = await fetchStats();
      if (mountedRef.current) {
        if (success) {
          intervalRef.current = setInterval(fetchStats, 2000);
        } else {
          // Fall back to simulated stats
          generateLocal();
          intervalRef.current = setInterval(generateLocal, 3000);
        }
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStats, generateLocal]);

  if (!stats) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-white/10 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const formatLatency = (us: number): string => {
    if (us === 0) return '-';
    if (us < 1000) return `${us}μs`;
    return `${(us / 1000).toFixed(2)}ms`;
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          Performance
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          isLive 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {isLive ? 'LIVE' : 'SIM'}
        </span>
      </div>

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
