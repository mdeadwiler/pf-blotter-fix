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
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              Order Blotter
            </h2>
            <span className="text-xs text-gray-500 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
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
