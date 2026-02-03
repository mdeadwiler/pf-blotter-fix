import { useState, FormEvent, useRef, useEffect } from 'react';
import { API_CONFIG } from '../utils/config';

interface OrderFormProps {
  onOrderSubmitted: () => void;
}

export function OrderForm({ onOrderSubmitted }: OrderFormProps) {
  const [clOrdId, setClOrdId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
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

    if (!clOrdId || !symbol || !quantity || !price) {
      setError('All fields are required');
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
          quantity: parseInt(quantity, 10),
          price: parseFloat(price),
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
    <form onSubmit={handleSubmit} className="bg-dark-800 rounded-lg p-4 neon-border">
      <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        New Order
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label htmlFor="clOrdId" className="block text-xs text-gray-400 mb-1">ClOrdID</label>
          <input
            id="clOrdId"
            type="text"
            value={clOrdId}
            onChange={(e) => setClOrdId(e.target.value)}
            placeholder="ORD001"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-sm text-white 
                     placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="symbol" className="block text-xs text-gray-400 mb-1">Symbol</label>
          <input
            id="symbol"
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-sm text-white 
                     placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors uppercase"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="side" className="block text-xs text-gray-400 mb-1">Side</label>
          <select
            id="side"
            value={side}
            onChange={(e) => setSide(e.target.value as 'Buy' | 'Sell')}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-sm text-white 
                     focus:outline-none focus:border-neon-cyan transition-colors"
            disabled={isSubmitting}
          >
            <option value="Buy" className="text-neon-green">Buy</option>
            <option value="Sell" className="text-neon-red">Sell</option>
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-xs text-gray-400 mb-1">Quantity</label>
          <input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="100"
            min="1"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-sm text-white 
                     placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-xs text-gray-400 mb-1">Price</label>
          <input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="150.00"
            min="0.01"
            step="0.01"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-sm text-white 
                     placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 rounded font-medium transition-colors ${
              side === 'Buy'
                ? 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30'
                : 'bg-neon-red/20 border border-neon-red text-neon-red hover:bg-neon-red/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? 'Sending...' : side}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-neon-red">{error}</p>
      )}
      {success && (
        <p className="mt-3 text-sm text-neon-green">{success}</p>
      )}
    </form>
  );
}
