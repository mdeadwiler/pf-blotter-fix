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
    <div className="bg-dark-800/50 border-b border-dark-600 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
          <span className="text-xs text-gray-500 uppercase whitespace-nowrap">Live</span>
          {tickArray.map((tick) => (
            <div 
              key={tick.symbol} 
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <span className="text-sm font-medium text-gray-300">{tick.symbol}</span>
              <span className={`text-sm font-mono ${
                tick.change && tick.change > 0 
                  ? 'text-neon-green' 
                  : tick.change && tick.change < 0 
                    ? 'text-neon-red' 
                    : 'text-white'
              }`}>
                {formatPrice(tick.price)}
              </span>
              {tick.change !== undefined && tick.change !== 0 && (
                <span className={`text-xs ${
                  tick.change > 0 ? 'text-neon-green' : 'text-neon-red'
                }`}>
                  {tick.change > 0 ? '+' : ''}{tick.change.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
