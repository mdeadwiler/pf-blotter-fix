import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, ConnectionStatus } from '../types/order';
import { API_CONFIG } from '../utils/config';

interface UseOrderStreamReturn {
  orders: Order[];
  connectionStatus: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

// Exponential backoff with jitter (industry standard pattern)
function calculateBackoffWithJitter(
  attempt: number,
  baseMs: number,
  maxMs: number
): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = exponential * 0.3 * Math.random(); // 30% jitter
  return Math.floor(exponential + jitter);
}

// Validate that parsed data is a valid orders array
function isValidOrdersArray(data: unknown): data is Order[] {
  if (!Array.isArray(data)) return false;
  // Quick sanity check on first item if exists
  if (data.length > 0) {
    const first = data[0];
    return typeof first === 'object' && first !== null && 'clOrdId' in first;
  }
  return true; // Empty array is valid
}

// Deep compare orders to avoid unnecessary re-renders
function ordersEqual(a: Order[], b: Order[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].clOrdId !== b[i].clOrdId || 
        a[i].status !== b[i].status || 
        a[i].cumQty !== b[i].cumQty ||
        a[i].avgPx !== b[i].avgPx) {
      return false;
    }
  }
  return true;
}

export function useOrderStream(): UseOrderStreamReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const ordersRef = useRef<Order[]>([]);

  // Update orders only if changed (prevents re-renders)
  const updateOrders = useCallback((newOrders: Order[]) => {
    if (!ordersEqual(ordersRef.current, newOrders)) {
      ordersRef.current = newOrders;
      setOrders(newOrders);
    }
  }, []);

  // Fetch initial snapshot
  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.snapshot}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (mountedRef.current && isValidOrdersArray(data)) {
        updateOrders(data);
      }
    } catch (err) {
      console.warn('Failed to fetch snapshot:', err);
      // Non-fatal - SSE will provide updates
    }
  }, [updateOrders]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!mountedRef.current) return;

    setConnectionStatus('connecting');
    setError(null);

    const es = new EventSource(API_CONFIG.sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      setError(null);
      retryCountRef.current = 0; // Reset retry count on success
      fetchSnapshot(); // Get initial state
    };

    // Listen for named "update" events from backend
    es.addEventListener('update', (event: MessageEvent) => {
      if (!mountedRef.current) return;
      
      const rawData = event.data;
      if (!rawData || rawData.trim() === '') return;
      
      try {
        const data = JSON.parse(rawData);
        if (isValidOrdersArray(data)) {
          updateOrders(data);
        }
      } catch {
        // Parse error - fetch fresh snapshot to recover
        fetchSnapshot();
      }
    });

    // Generic message handler as fallback
    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      
      const rawData = event.data;
      if (!rawData || rawData.trim() === '') return;
      if (rawData.startsWith(':')) return; // SSE comment/keepalive
      
      try {
        const data = JSON.parse(rawData);
        if (isValidOrdersArray(data)) {
          updateOrders(data);
        }
      } catch {
        // Silently ignore parse errors
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      
      es.close();
      eventSourceRef.current = null;
      setConnectionStatus('disconnected');
      
      // Calculate backoff delay
      const delay = calculateBackoffWithJitter(
        retryCountRef.current,
        API_CONFIG.sse.initialRetryDelay,
        API_CONFIG.sse.maxRetryDelay
      );
      
      retryCountRef.current++;
      setError(`Reconnecting in ${Math.round(delay / 1000)}s...`);
      
      // Schedule reconnection
      retryTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [fetchSnapshot, updateOrders]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Setup and cleanup - only run once on mount
  useEffect(() => {
    mountedRef.current = true;
    
    // Initial connection
    connect();

    return () => {
      mountedRef.current = false;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  return { orders, connectionStatus, error, reconnect };
}
