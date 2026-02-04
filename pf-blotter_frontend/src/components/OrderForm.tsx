import { useState, FormEvent, useRef, useEffect, Ref, useCallback } from 'react';
import { API_CONFIG } from '../utils/config';

interface OrderFormProps {
  onOrderSubmitted: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

// Generate unique order ID
function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// Available symbols
const SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA'];

export function OrderForm({ onOrderSubmitted, inputRef }: OrderFormProps) {
  const [clOrdId, setClOrdId] = useState(() => generateOrderId());
  const [symbol, setSymbol] = useState('AAPL');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Limit');
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState('175.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Generate new order ID
  const regenerateOrderId = useCallback(() => {
    setClOrdId(generateOrderId());
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Clear any pending timeouts
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    // Validation
    if (!clOrdId.trim()) {
      setError('Order ID is required');
      return;
    }
    if (!symbol) {
      setError('Symbol is required');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }
    if (qty > 100000) {
      setError('Quantity cannot exceed 100,000');
      return;
    }
    
    // Price validation for Limit orders
    const px = parseFloat(price);
    if (orderType === 'Limit') {
      if (isNaN(px) || px <= 0) {
        setError('Price must be a positive number for Limit orders');
        return;
      }
      if (px > 100000) {
        setError('Price cannot exceed $100,000');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${API_CONFIG.baseUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clOrdId: clOrdId.trim(),
          symbol: symbol.toUpperCase(),
          side,
          orderType,
          quantity: qty,
          price: orderType === 'Market' ? 0 : px,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      setSuccess(`Order ${clOrdId} submitted successfully`);
      
      // Generate new order ID for next order
      setClOrdId(generateOrderId());
      setQuantity('100');
      
      onOrderSubmitted();
      
      // Clear success message after 4s
      successTimeoutRef.current = setTimeout(() => setSuccess(null), 4000);
      
      console.log('[OrderForm] Order submitted:', data);
    } catch (err) {
      let errorMsg = 'Failed to submit order';
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMsg = 'Request timed out - server may be starting up';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMsg = 'Cannot connect to server - check if backend is running';
        } else if (err.message.includes('CORS')) {
          errorMsg = 'Connection blocked (CORS) - backend may need redeployment';
        } else {
          errorMsg = err.message;
        }
      }
      
      setError(errorMsg);
      console.error('[OrderForm] Submit error:', err);
      
      // Clear error after 8s
      errorTimeoutRef.current = setTimeout(() => setError(null), 8000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        New Order
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {/* Order ID */}
        <div>
          <label htmlFor="clOrdId" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Order ID
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="clOrdId"
              type="text"
              value={clOrdId}
              onChange={(e) => setClOrdId(e.target.value)}
              className="w-full px-3 py-2.5 pr-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                       placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 font-mono"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={regenerateOrderId}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
              title="Generate new ID"
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Symbol */}
        <div>
          <label htmlFor="symbol" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Symbol
          </label>
          <select
            id="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
            disabled={isSubmitting}
          >
            {SYMBOLS.map(s => (
              <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
            ))}
          </select>
        </div>

        {/* Order Type */}
        <div>
          <label htmlFor="orderType" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Type
          </label>
          <select
            id="orderType"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as 'Limit' | 'Market')}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
            disabled={isSubmitting}
          >
            <option value="Limit" className="bg-slate-900 text-white">Limit</option>
            <option value="Market" className="bg-slate-900 text-white">Market</option>
          </select>
        </div>

        {/* Side */}
        <div>
          <label htmlFor="side" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Side
          </label>
          <select
            id="side"
            value={side}
            onChange={(e) => setSide(e.target.value as 'Buy' | 'Sell')}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold
                     focus:outline-none focus:ring-2 ${
                       side === 'Buy' 
                         ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 focus:border-emerald-500/50 focus:ring-emerald-500/20'
                         : 'bg-red-500/10 border-red-500/30 text-red-400 focus:border-red-500/50 focus:ring-red-500/20'
                     }`}
            disabled={isSubmitting}
          >
            <option value="Buy" className="bg-slate-900 text-emerald-400">Buy</option>
            <option value="Sell" className="bg-slate-900 text-red-400">Sell</option>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="100"
            min="1"
            max="100000"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 font-mono"
            disabled={isSubmitting}
          />
        </div>

        {/* Price */}
        <div>
          <label htmlFor="price" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Price {orderType === 'Market' && <span className="text-gray-600 normal-case">(MKT)</span>}
          </label>
          <input
            id="price"
            type="number"
            value={orderType === 'Market' ? '' : price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={orderType === 'Market' ? 'Market' : '175.00'}
            min="0.01"
            max="100000"
            step="0.01"
            className={`w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 font-mono
                     ${orderType === 'Market' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting || orderType === 'Market'}
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
              side === 'Buy'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-500'
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-400 hover:to-red-500'
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                {side === 'Buy' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {side}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">Order Failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {success && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}
    </form>
  );
}
