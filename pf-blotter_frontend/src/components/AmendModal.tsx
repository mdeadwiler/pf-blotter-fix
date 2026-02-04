import { useState, useEffect, FormEvent, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseInt(newQuantity, 10);
    const px = parseFloat(newPrice);

    // Validate
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number');
      return;
    }
    if (qty > order.quantity) {
      setError('Cannot increase quantity (only reduce allowed)');
      return;
    }
    if (qty <= order.cumQty) {
      setError(`Quantity must be greater than filled amount (${order.cumQty})`);
      return;
    }
    if (isNaN(px) || px <= 0) {
      setError('Price must be a positive number');
      return;
    }

    // Check if anything changed
    if (qty === order.quantity && Math.abs(px - order.price) < 0.01) {
      setError('No changes made to the order');
      return;
    }

    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_CONFIG.baseUrl}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origClOrdId: order.clOrdId,
          clOrdId: `${order.clOrdId}_AMD_${Date.now()}`,
          quantity: qty !== order.quantity ? qty : 0,
          price: Math.abs(px - order.price) > 0.001 ? px : 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error || `Amendment failed (HTTP ${response.status})`);
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out');
      } else {
        setError('Network error - check connection');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            Amend Order
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Order Summary */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order ID</span>
              <span className="text-white font-mono">{order.clOrdId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Symbol</span>
              <span className="text-white font-medium">{order.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Side</span>
              <span className={order.side === '1' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                {order.side === '1' ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fill Progress</span>
              <span className="text-white font-mono">{order.cumQty} / {order.quantity}</span>
            </div>
            {order.cumQty > 0 && (
              <div className="pt-2">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${(order.cumQty / order.quantity) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* New Quantity */}
          <div>
            <label htmlFor="newQty" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
              New Quantity <span className="text-gray-600 normal-case">(current: {order.quantity})</span>
            </label>
            <input
              id="newQty"
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              min={order.cumQty + 1}
              max={order.quantity}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white font-mono
                       focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              disabled={isSubmitting}
            />
            <p className="text-[10px] text-gray-600 mt-1.5">Can only reduce quantity (minimum: {order.cumQty + 1})</p>
          </div>

          {/* New Price */}
          <div>
            <label htmlFor="newPrice" className="block text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
              New Price <span className="text-gray-600 normal-case">(current: ${order.price.toFixed(2)})</span>
            </label>
            <input
              id="newPrice"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white font-mono
                       focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              disabled={isSubmitting}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg font-medium 
                       hover:bg-white/10 hover:text-white transition-all"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold
                       shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:from-cyan-400 hover:to-cyan-500
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Amending...
                </span>
              ) : (
                'Amend Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
