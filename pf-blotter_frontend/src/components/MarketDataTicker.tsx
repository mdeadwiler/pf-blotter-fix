import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';
import { formatPrice } from '../utils/format';

interface Tick {
  symbol: string;
  price: number;
  timestamp: string;
  change?: number;
  percentChange?: number;
}

// Generate realistic market data client-side when backend is unavailable
const SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA'];
const BASE_PRICES: Record<string, number> = {
  AAPL: 178.50,
  GOOGL: 141.25,
  MSFT: 378.90,
  AMZN: 178.75,
  META: 485.20,
  NVDA: 875.30,
  TSLA: 248.60,
};

function generateLocalTick(symbol: string, prevPrice: number): Tick {
  // Random walk with mean reversion
  const volatility = 0.001; // 0.1% per tick
  const meanReversion = 0.05;
  const basePrice = BASE_PRICES[symbol] || 100;
  
  const drift = (basePrice - prevPrice) * meanReversion * 0.01;
  const randomMove = (Math.random() - 0.5) * 2 * prevPrice * volatility;
  const newPrice = Math.max(prevPrice * 0.9, Math.min(prevPrice * 1.1, prevPrice + drift + randomMove));
  
  return {
    symbol,
    price: Math.round(newPrice * 100) / 100,
    timestamp: new Date().toISOString(),
    change: newPrice - prevPrice,
    percentChange: ((newPrice - prevPrice) / prevPrice) * 100,
  };
}

export function MarketDataTicker() {
  const [ticks, setTicks] = useState<Map<string, Tick>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const prevPrices = useRef<Map<string, number>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const localIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Initialize with base prices
  const initializePrices = useCallback(() => {
    const initial = new Map<string, Tick>();
    SYMBOLS.forEach(symbol => {
      const price = BASE_PRICES[symbol];
      prevPrices.current.set(symbol, price);
      initial.set(symbol, {
        symbol,
        price,
        timestamp: new Date().toISOString(),
        change: 0,
        percentChange: 0,
      });
    });
    setTicks(initial);
  }, []);

  // Generate local market data (fallback when backend unavailable)
  const generateLocalData = useCallback(() => {
    if (!mountedRef.current) return;
    
    setTicks(prev => {
      const newTicks = new Map(prev);
      SYMBOLS.forEach(symbol => {
        const prevPrice = prevPrices.current.get(symbol) || BASE_PRICES[symbol];
        const tick = generateLocalTick(symbol, prevPrice);
        prevPrices.current.set(symbol, tick.price);
        newTicks.set(symbol, tick);
      });
      return newTicks;
    });
  }, []);

  // Start local data generation
  const startLocalGeneration = useCallback(() => {
    if (localIntervalRef.current) return;
    
    // Generate data every 1-2 seconds randomly for realism
    const tick = () => {
      generateLocalData();
      if (mountedRef.current && !isConnected) {
        const delay = 1000 + Math.random() * 1000;
        localIntervalRef.current = setTimeout(tick, delay) as unknown as ReturnType<typeof setInterval>;
      }
    };
    tick();
  }, [generateLocalData, isConnected]);

  // Stop local data generation
  const stopLocalGeneration = useCallback(() => {
    if (localIntervalRef.current) {
      clearTimeout(localIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      localIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initializePrices();

    // Try to connect to backend SSE
    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(API_CONFIG.marketDataUrl);
      eventSourceRef.current = es;

      es.addEventListener('marketdata', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            setIsConnected(true);
            stopLocalGeneration();
            
            setTicks(prev => {
              const newTicks = new Map(prev);
              for (const tick of data) {
                const prevPrice = prevPrices.current.get(tick.symbol) || tick.price;
                const change = tick.price - prevPrice;
                prevPrices.current.set(tick.symbol, tick.price);
                newTicks.set(tick.symbol, { 
                  ...tick, 
                  change,
                  percentChange: (change / prevPrice) * 100,
                });
              }
              return newTicks;
            });
          }
        } catch {
          // Ignore parse errors
        }
      });

      es.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        stopLocalGeneration();
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        // Fall back to local generation
        startLocalGeneration();
      };
    };

    // Try SSE first, fall back to local after timeout
    connectSSE();
    
    // If not connected after 3 seconds, start local generation
    const fallbackTimeout = setTimeout(() => {
      if (!isConnected && mountedRef.current) {
        startLocalGeneration();
      }
    }, 3000);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimeout);
      stopLocalGeneration();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [initializePrices, startLocalGeneration, stopLocalGeneration, isConnected]);

  const tickArray = Array.from(ticks.values());

  return (
    <div className="bg-black/30 backdrop-blur-sm border-b border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <span className="flex items-center gap-2 text-xs text-gray-500 uppercase whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            {isConnected ? 'Live' : 'Sim'}
          </span>
          {tickArray.map((tick) => (
            <div 
              key={tick.symbol} 
              className="flex items-center gap-2 whitespace-nowrap px-3 py-1 bg-white/5 rounded-lg border border-white/5"
            >
              <span className="text-sm font-semibold text-white">{tick.symbol}</span>
              <span className={`text-sm font-mono font-medium transition-colors ${
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
