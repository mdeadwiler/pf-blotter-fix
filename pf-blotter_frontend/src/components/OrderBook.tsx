import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';
import { formatPrice, formatQuantity } from '../utils/format';

interface BookLevel {
  price: number;
  quantity: number;
}

interface OrderBookData {
  symbol: string;
  lastPrice: number;
  spread: number;
  bids: BookLevel[];
  asks: BookLevel[];
}

interface OrderBookProps {
  symbol?: string;
}

export function OrderBook({ symbol = 'AAPL' }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderBook = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/orderbook?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        setBook(data);
      }
    } catch (err) {
      console.warn('Failed to fetch order book:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchOrderBook();
    // Refresh order book every 2 seconds
    const interval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-white/10 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-gray-500 text-center">
        Order book unavailable
      </div>
    );
  }

  // Calculate max quantity for bar width scaling
  const maxQty = Math.max(
    ...book.bids.map(b => b.quantity),
    ...book.asks.map(a => a.quantity),
    1
  );

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          Order Book
        </h3>
        <span className="text-sm font-mono text-cyan-400 px-2 py-0.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">{book.symbol}</span>
      </div>

      {/* Last Price & Spread */}
      <div className="flex justify-between text-xs text-gray-400 mb-3 pb-2 border-b border-white/5">
        <span>Last: <span className="text-white font-mono font-medium">{formatPrice(book.lastPrice)}</span></span>
        <span>Spread: <span className="text-amber-400 font-mono font-medium">{formatPrice(book.spread)}</span></span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-medium">
        <span>Qty</span>
        <span className="text-center">Price</span>
        <span className="text-right">Qty</span>
      </div>

      {/* Order Book Levels */}
      <div className="space-y-0.5">
        {book.asks.slice().reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="grid grid-cols-3 items-center text-xs relative py-0.5">
            <span className="text-gray-600">-</span>
            <span className="text-center font-mono text-red-400 font-medium">{formatPrice(ask.price)}</span>
            <div className="flex items-center justify-end gap-2">
              <span className="font-mono text-gray-400">{formatQuantity(ask.quantity)}</span>
              <div 
                className="h-3 bg-red-500/20 rounded-l"
                style={{ width: `${(ask.quantity / maxQty) * 60}%` }}
              />
            </div>
          </div>
        ))}

        {/* Spread indicator */}
        <div className="py-1.5 text-center">
          <span className="text-[10px] text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20 font-medium">
            {formatPrice(book.spread)} spread
          </span>
        </div>

        {book.bids.map((bid, i) => (
          <div key={`bid-${i}`} className="grid grid-cols-3 items-center text-xs relative py-0.5">
            <div className="flex items-center gap-2">
              <div 
                className="h-3 bg-emerald-500/20 rounded-r"
                style={{ width: `${(bid.quantity / maxQty) * 60}%` }}
              />
              <span className="font-mono text-gray-400">{formatQuantity(bid.quantity)}</span>
            </div>
            <span className="text-center font-mono text-emerald-400 font-medium">{formatPrice(bid.price)}</span>
            <span className="text-right text-gray-600">-</span>
          </div>
        ))}
      </div>
    </div>
  );
}
