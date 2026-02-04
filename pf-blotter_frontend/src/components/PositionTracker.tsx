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
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          Positions
        </h3>
        {totalRealizedPnl !== 0 && (
          <span className={`text-sm font-medium px-3 py-1 rounded-lg ${
            totalRealizedPnl >= 0 
              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
              : 'text-red-400 bg-red-500/10 border border-red-500/20'
          }`}>
            P&L: {totalRealizedPnl >= 0 ? '+' : ''}{formatPrice(totalRealizedPnl)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-4 py-3 text-left text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Symbol</th>
              <th className="px-4 py-3 text-right text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Position</th>
              <th className="px-4 py-3 text-right text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Avg Cost</th>
              <th className="px-4 py-3 text-right text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Notional</th>
              <th className="px-4 py-3 text-right text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Real. P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {positions.map((pos) => (
              <tr key={pos.symbol} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-semibold text-white">{pos.symbol}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${
                  pos.netQty > 0 ? 'text-emerald-400' : pos.netQty < 0 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {pos.netQty > 0 ? '+' : ''}{formatQuantity(pos.netQty)}
                  <span className={`text-[10px] ml-1.5 px-1.5 py-0.5 rounded ${
                    pos.netQty > 0 
                      ? 'text-emerald-400 bg-emerald-500/10' 
                      : pos.netQty < 0 
                        ? 'text-red-400 bg-red-500/10' 
                        : 'text-gray-500 bg-gray-500/10'
                  }`}>
                    {pos.netQty > 0 ? 'LONG' : pos.netQty < 0 ? 'SHORT' : 'FLAT'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {formatPrice(pos.avgCost)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {formatPrice(pos.totalNotional)}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${
                  pos.realizedPnl > 0 ? 'text-emerald-400' : pos.realizedPnl < 0 ? 'text-red-400' : 'text-gray-500'
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
