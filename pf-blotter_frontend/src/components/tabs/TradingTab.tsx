import { Ref } from 'react';
import { Order } from '../../types/order';
import { Blotter } from '../Blotter';
import { OrderForm } from '../OrderForm';
import { OrderBook } from '../OrderBook';
import { PerformanceMetrics } from '../PerformanceMetrics';
import { PositionTracker } from '../PositionTracker';
import { ErrorBoundary } from '../ErrorBoundary';

interface TradingTabProps {
  orders: Order[];
  orderFormRef: Ref<HTMLInputElement>;
  onOrderSubmitted: () => void;
}

export function TradingTab({ orders, orderFormRef, onOrderSubmitted }: TradingTabProps) {
  return (
    <div className="space-y-6">
      {/* Order Entry + Order Book + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <ErrorBoundary>
            <OrderForm onOrderSubmitted={onOrderSubmitted} inputRef={orderFormRef} />
          </ErrorBoundary>
        </div>
        <div className="hidden md:block">
          <ErrorBoundary>
            <OrderBook symbol="AAPL" />
          </ErrorBoundary>
        </div>
        <div className="hidden md:block">
          <ErrorBoundary>
            <PerformanceMetrics />
          </ErrorBoundary>
        </div>
      </div>

      {/* Order Blotter */}
      <ErrorBoundary>
        <div className="bg-dark-800 rounded-lg neon-border overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Order Blotter</h2>
            <span className="text-xs text-gray-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Blotter orders={orders} />
        </div>
      </ErrorBoundary>

      {/* Position Tracker */}
      <ErrorBoundary>
        <PositionTracker orders={orders} />
      </ErrorBoundary>
    </div>
  );
}
