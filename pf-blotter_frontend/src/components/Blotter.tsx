import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Order } from '../types/order';
import {
  formatPrice,
  formatQuantity,
  formatSide,
  formatTime,
  getStatusClass,
  getSideClass,
} from '../utils/format';
import { API_CONFIG } from '../utils/config';
import { AmendModal } from './AmendModal';

interface BlotterProps {
  orders: Order[];
}

const COLUMNS = [
  { key: 'clOrdId', label: 'ClOrdID', width: 'w-24' },
  { key: 'symbol', label: 'Symbol', width: 'w-20' },
  { key: 'side', label: 'Side', width: 'w-16' },
  { key: 'quantity', label: 'Qty', width: 'w-20', align: 'text-right' },
  { key: 'price', label: 'Price', width: 'w-24', align: 'text-right' },
  { key: 'status', label: 'Status', width: 'w-24' },
  { key: 'leavesQty', label: 'Leaves', width: 'w-20', align: 'text-right' },
  { key: 'cumQty', label: 'Filled', width: 'w-20', align: 'text-right' },
  { key: 'avgPx', label: 'Avg Px', width: 'w-24', align: 'text-right' },
  { key: 'rejectReason', label: 'Reject Reason', width: 'w-40' },
  { key: 'transactTime', label: 'Time', width: 'w-24' },
  { key: 'actions', label: '', width: 'w-32' },
] as const;

export function Blotter({ orders }: BlotterProps) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [amendingOrder, setAmendingOrder] = useState<Order | null>(null);
  const isMountedRef = useRef(true);
  
  // Track mount status for safe state updates
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Memoize reversed orders for newest-first display
  const displayOrders = useMemo(() => [...orders].reverse(), [orders]);

  const handleCancel = useCallback(async (clOrdId: string) => {
    setCancelingId(clOrdId);
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origClOrdId: clOrdId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('Cancel failed:', data.error);
      }
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setCancelingId(null);
      }
    }
  }, []);

  // Can cancel orders that are still open (NEW or PARTIAL)
  const canCancel = (status: string) => ['NEW', 'PARTIAL'].includes(status);

  const renderCell = (order: Order, column: typeof COLUMNS[number]) => {
    switch (column.key) {
      case 'side':
        return (
          <span className={getSideClass(order.side)}>
            {formatSide(order.side)}
          </span>
        );
      case 'quantity':
        return formatQuantity(order.quantity);
      case 'price':
        return formatPrice(order.price);
      case 'status':
        return (
          <span className={`font-semibold ${getStatusClass(order.status)}`}>
            {order.status}
          </span>
        );
      case 'leavesQty':
        return formatQuantity(order.leavesQty);
      case 'cumQty':
        return formatQuantity(order.cumQty);
      case 'avgPx':
        return formatPrice(order.avgPx);
      case 'transactTime':
        return formatTime(order.transactTime);
      case 'rejectReason':
        return order.rejectReason ? (
          <span className="text-red-400 text-xs">{order.rejectReason}</span>
        ) : (
          <span className="text-gray-600">-</span>
        );
      case 'actions':
        return canCancel(order.status) ? (
          <div className="flex gap-1">
            <button
              onClick={() => setAmendingOrder(order)}
              className="px-2.5 py-1 text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 
                       rounded-lg hover:bg-cyan-500/20 transition-all duration-200 font-medium"
              title="Amend order"
            >
              Amend
            </button>
            <button
              onClick={() => handleCancel(order.clOrdId)}
              disabled={cancelingId === order.clOrdId}
              className="px-2.5 py-1 text-xs bg-red-500/10 border border-red-500/30 text-red-400 
                       rounded-lg hover:bg-red-500/20 transition-all duration-200 font-medium disabled:opacity-50"
            >
              {cancelingId === order.clOrdId ? '...' : 'Cancel'}
            </button>
          </div>
        ) : null;
      default:
        return order[column.key as keyof Order] || '-';
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-400">No orders yet</p>
        <p className="text-sm text-gray-600 mt-1">
          Use the form above or CLI sender to create orders
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider ${
                    col.width
                  } ${'align' in col ? col.align : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayOrders.map((order, index) => (
              <tr
                key={order.clOrdId}
                className={`hover:bg-white/[0.02] transition-colors ${
                  index === 0 ? 'animate-fade-in' : ''
                }`}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 whitespace-nowrap ${col.width} ${
                      'align' in col ? col.align : ''
                    } ${col.key === 'quantity' || col.key === 'price' || col.key === 'leavesQty' || col.key === 'cumQty' || col.key === 'avgPx' ? 'font-mono' : ''}`}
                  >
                    {renderCell(order, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Amend Modal */}
      {amendingOrder && (
        <AmendModal
          order={amendingOrder}
          onClose={() => setAmendingOrder(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
