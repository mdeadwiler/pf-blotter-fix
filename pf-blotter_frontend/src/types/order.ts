// Order type matching backend OrderRecord JSON structure
export interface Order {
  clOrdId: string;
  orderId: string;
  symbol: string;
  side: '1' | '2'; // 1 = Buy, 2 = Sell
  price: number;
  quantity: number;
  leavesQty: number;
  cumQty: number;
  avgPx: number;
  status: OrderStatus;
  rejectReason: string;
  transactTime: string;
  latencyUs: number; // Order → Ack latency in microseconds
}

export type OrderStatus = 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELED' | 'PARTIAL';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// User type for mock auth
export interface User {
  id: string;
  email: string;
  name: string;
}

// Auth state
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
