import { useState, FormEvent, useRef, useEffect, Ref } from 'react';
import { API_CONFIG } from '../utils/config';

interface OrderFormProps {
  onOrderSubmitted: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function OrderForm({ onOrderSubmitted, inputRef }: OrderFormProps) {
  const [clOrdId, setClOrdId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Clear any pending timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    if (!clOrdId || !symbol || !quantity) {
      setError('ClOrdID, Symbol, and Quantity are required');
      return;
    }
    
    // Price required for Limit orders
    if (orderType === 'Limit' && !price) {
      setError('Price is required for Limit orders');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clOrdId,
          symbol: symbol.toUpperCase(),
          side,
          orderType,
          quantity: parseInt(quantity, 10),
          price: orderType === 'Market' ? 0 : parseFloat(price),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Order submission failed');
      } else {
        setSuccess(`Order ${clOrdId} submitted`);
        // Clear form
        setClOrdId('');
        setSymbol('');
        setQuantity('');
        setPrice('');
        onOrderSubmitted();
        // Clear success message after 3s (with cleanup)
        successTimeoutRef.current = setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('Network error - check if gateway is running');
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
        <div>
          <label htmlFor="clOrdId" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            ClOrdID
          </label>
          <input
            ref={inputRef}
            id="clOrdId"
            type="text"
            value={clOrdId}
            onChange={(e) => setClOrdId(e.target.value)}
            placeholder="ORD001"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="symbol" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Symbol
          </label>
          <input
            id="symbol"
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 uppercase"
            disabled={isSubmitting}
          />
        </div>

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
            <option value="Limit">Limit</option>
            <option value="Market">Market</option>
          </select>
        </div>

        <div>
          <label htmlFor="side" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Side
          </label>
          <select
            id="side"
            value={side}
            onChange={(e) => setSide(e.target.value as 'Buy' | 'Sell')}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium
                     focus:outline-none focus:ring-2 ${
                       side === 'Buy' 
                         ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 focus:border-emerald-500/50 focus:ring-emerald-500/20'
                         : 'bg-red-500/10 border-red-500/30 text-red-400 focus:border-red-500/50 focus:ring-red-500/20'
                     }`}
            disabled={isSubmitting}
          >
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
        </div>

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
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 font-mono"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
            Price {orderType === 'Market' && <span className="text-gray-600 normal-case">(MKT)</span>}
          </label>
          <input
            id="price"
            type="number"
            value={orderType === 'Market' ? '' : price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={orderType === 'Market' ? 'Market' : '150.00'}
            min="0.01"
            step="0.01"
            className={`w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white 
                     placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 font-mono
                     ${orderType === 'Market' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSubmitting || orderType === 'Market'}
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-lg font-semibold transition-all duration-200 ${
              side === 'Buy'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-500'
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-400 hover:to-red-500'
            } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending
              </span>
            ) : (
              side
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}
    </form>
  );
}
