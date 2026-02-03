import { useMemo } from 'react';
import type { Order } from '../types/order';
import { formatPrice, formatQuantity } from '../utils/format';

interface Position {
  symbol: string;
  netQty: number;          // Positive = long, negative = short
  avgCost: number;         // Average cost basis
  realizedPnl: number;     // P&L from closed positions
  totalNotional: number;   // Total value at avg cost
}

interface PositionTrackerProps {
  orders: Order[];
  currentPrices?: Map<string, number>;  // Optional live prices for unrealized P&L
}

export function PositionTracker({ orders, currentPrices: _currentPrices }: PositionTrackerProps) {
  const positions = useMemo(() => {
    const posMap = new Map<string, Position>();

    // Process only filled orders
    const filledOrders = orders.filter(
      o => o.status === 'FILLED' || o.status === 'PARTIAL'
    );

    for (const order of filledOrders) {
      if (order.cumQty === 0) continue;

      const existing = posMap.get(order.symbol) || {
        symbol: order.symbol,
        netQty: 0,
        avgCost: 0,
        realizedPnl: 0,
        totalNotional: 0,
      };

      const qty = order.side === '1' ? order.cumQty : -order.cumQty;  // Buy = +, Sell = -
      const value = order.avgPx * Math.abs(order.cumQty);

      // Update position
      const newNetQty = existing.netQty + qty;
      
      // Simple FIFO-ish P&L calculation
      if (existing.netQty !== 0 && Math.sign(qty) !== Math.sign(existing.netQty)) {
        // Closing position - realize P&L
        const closingQty = Math.min(Math.abs(qty), Math.abs(existing.netQty));
        const pnl = (order.avgPx - existing.avgCost) * closingQty * Math.sign(existing.netQty);
        existing.realizedPnl += pnl;
      }

      // Update average cost for new/increased positions
      if (newNetQty !== 0) {
        if (Math.sign(newNetQty) === Math.sign(qty)) {
          // Adding to position
          const totalValue = existing.avgCost * Math.abs(existing.netQty) + value;
          existing.avgCost = totalValue / Math.abs(newNetQty);
        }
      }

      existing.netQty = newNetQty;
      existing.totalNotional = Math.abs(existing.netQty) * existing.avgCost;
      
      posMap.set(order.symbol, existing);
    }

    return Array.from(posMap.values()).filter(p => p.netQty !== 0 || p.realizedPnl !== 0);
  }, [orders]);

  if (positions.length === 0) {
    return null;
  }

  // Calculate totals
  const totalRealizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);

  return (
    <div className="bg-dark-800 rounded-lg p-4 neon-border mt-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-neon-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Positions
        {totalRealizedPnl !== 0 && (
          <span className={`ml-auto text-sm ${totalRealizedPnl >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            P&L: {totalRealizedPnl >= 0 ? '+' : ''}{formatPrice(totalRealizedPnl)}
          </span>
        )}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-600">
              <th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Symbol</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500 uppercase">Position</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500 uppercase">Avg Cost</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500 uppercase">Notional</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500 uppercase">Real. P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {positions.map((pos) => (
              <tr key={pos.symbol} className="hover:bg-dark-700/50">
                <td className="px-2 py-2 font-medium text-white">{pos.symbol}</td>
                <td className={`px-2 py-2 text-right font-mono ${
                  pos.netQty > 0 ? 'text-neon-green' : pos.netQty < 0 ? 'text-neon-red' : 'text-gray-400'
                }`}>
                  {pos.netQty > 0 ? '+' : ''}{formatQuantity(pos.netQty)}
                  <span className="text-xs text-gray-500 ml-1">
                    {pos.netQty > 0 ? 'LONG' : pos.netQty < 0 ? 'SHORT' : 'FLAT'}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono text-gray-300">
                  {formatPrice(pos.avgCost)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-gray-300">
                  {formatPrice(pos.totalNotional)}
                </td>
                <td className={`px-2 py-2 text-right font-mono ${
                  pos.realizedPnl > 0 ? 'text-neon-green' : pos.realizedPnl < 0 ? 'text-neon-red' : 'text-gray-400'
                }`}>
                  {pos.realizedPnl !== 0 ? (pos.realizedPnl > 0 ? '+' : '') : ''}
                  {formatPrice(pos.realizedPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
