import { useState, useEffect, useRef } from 'react';
import { API_CONFIG } from '../utils/config';
import { formatPrice } from '../utils/format';

interface Tick {
  symbol: string;
  price: number;
  timestamp: string;
  change?: number;  // Price change from previous tick
}

export function MarketDataTicker() {
  const [ticks, setTicks] = useState<Map<string, Tick>>(new Map());
  const prevPrices = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const sseUrl = API_CONFIG.baseUrl.replace('/api', '') + '/marketdata';
    const es = new EventSource(
      API_CONFIG.baseUrl.includes('localhost') 
        ? 'http://localhost:8080/marketdata' 
        : sseUrl
    );

    es.addEventListener('marketdata', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setTicks(prev => {
            const newTicks = new Map(prev);
            for (const tick of data) {
              const prevPrice = prevPrices.current.get(tick.symbol) || tick.price;
              const change = tick.price - prevPrice;
              prevPrices.current.set(tick.symbol, tick.price);
              newTicks.set(tick.symbol, { ...tick, change });
            }
            return newTicks;
          });
        }
      } catch {
        // Ignore parse errors
      }
    });

    es.onerror = () => {
      // Silently handle errors - market data is non-critical
    };

    return () => {
      es.close();
    };
  }, []);

  const tickArray = Array.from(ticks.values());

  if (tickArray.length === 0) {
    return null;
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm border-b border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
          <span className="flex items-center gap-2 text-xs text-gray-500 uppercase whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </span>
          {tickArray.map((tick) => (
            <div 
              key={tick.symbol} 
              className="flex items-center gap-2 whitespace-nowrap px-3 py-1 bg-white/5 rounded-lg border border-white/5"
            >
              <span className="text-sm font-semibold text-white">{tick.symbol}</span>
              <span className={`text-sm font-mono font-medium ${
                tick.change && tick.change > 0 
                  ? 'text-emerald-400' 
                  : tick.change && tick.change < 0 
                    ? 'text-red-400' 
                    : 'text-gray-300'
              }`}>
                {formatPrice(tick.price)}
              </span>
              {tick.change !== undefined && tick.change !== 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  tick.change > 0 
                    ? 'text-emerald-400 bg-emerald-500/10' 
                    : 'text-red-400 bg-red-500/10'
                }`}>
                  {tick.change > 0 ? '▲' : '▼'} {Math.abs(tick.change).toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
