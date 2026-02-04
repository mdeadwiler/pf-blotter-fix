import { useState, useEffect, FormEvent } from 'react';
import { API_CONFIG } from '../utils/config';
import type { Order } from '../types/order';

interface AmendModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}

export function AmendModal({ order, onClose, onSuccess }: AmendModalProps) {
  const [newQuantity, setNewQuantity] = useState(order.quantity.toString());
  const [newPrice, setNewPrice] = useState(order.price.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseInt(newQuantity, 10);
    const px = parseFloat(newPrice);

    // Validate
    if (qty <= 0) {
      setError('Quantity must be positive');
      return;
    }
    if (qty > order.quantity) {
      setError('Cannot increase quantity (only reduce)');
      return;
    }
    if (qty <= order.cumQty) {
      setError(`Quantity must be greater than filled (${order.cumQty})`);
      return;
    }
    if (px <= 0) {
      setError('Price must be positive');
      return;
    }

    // Check if anything changed
    if (qty === order.quantity && Math.abs(px - order.price) < 0.01) {
      setError('No changes made');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origClOrdId: order.clOrdId,
          clOrdId: `${order.clOrdId}_AMD_${Date.now()}`,
          quantity: qty !== order.quantity ? qty : 0,
          price: Math.abs(px - order.price) > 0.001 ? px : 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Amendment failed');
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-dark-800 rounded-lg neon-border w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Amend Order</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Order info */}
          <div className="bg-dark-700 rounded p-3 text-sm">
            <div className="flex justify-between text-gray-400 mb-1">
              <span>Order ID</span>
              <span className="text-white font-mono">{order.clOrdId}</span>
            </div>
            <div className="flex justify-between text-gray-400 mb-1">
              <span>Symbol</span>
              <span className="text-white">{order.symbol}</span>
            </div>
            <div className="flex justify-between text-gray-400 mb-1">
              <span>Side</span>
              <span className={order.side === '1' ? 'text-neon-green' : 'text-neon-red'}>
                {order.side === '1' ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Filled</span>
              <span className="text-white">{order.cumQty} / {order.quantity}</span>
            </div>
          </div>

          {/* Quantity input */}
          <div>
            <label htmlFor="newQty" className="block text-sm text-gray-400 mb-1">
              New Quantity <span className="text-gray-600">(current: {order.quantity})</span>
            </label>
            <input
              id="newQty"
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              min={order.cumQty + 1}
              max={order.quantity}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-white 
                       focus:outline-none focus:border-neon-cyan transition-colors"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-600 mt-1">Can only reduce (min: {order.cumQty + 1})</p>
          </div>

          {/* Price input */}
          <div>
            <label htmlFor="newPrice" className="block text-sm text-gray-400 mb-1">
              New Price <span className="text-gray-600">(current: ${order.price.toFixed(2)})</span>
            </label>
            <input
              id="newPrice"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-500 rounded text-white 
                       focus:outline-none focus:border-neon-cyan transition-colors"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-neon-red">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-dark-600 text-gray-300 rounded font-medium 
                       hover:bg-dark-500 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan 
                       rounded font-medium hover:bg-neon-cyan/30 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Amending...' : 'Amend Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
