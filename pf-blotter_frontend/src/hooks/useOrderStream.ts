import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, ConnectionStatus } from '../types/order';
import { API_CONFIG } from '../utils/config';

interface UseOrderStreamReturn {
  orders: Order[];
  connectionStatus: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

// Validate that parsed data is a valid orders array
function isValidOrdersArray(data: unknown): data is Order[] {
  if (!Array.isArray(data)) return false;
  if (data.length > 0) {
    const first = data[0];
    return typeof first === 'object' && first !== null && 'clOrdId' in first;
  }
  return true;
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const ordersRef = useRef<Order[]>([]);

  // Update orders only if changed
  const updateOrders = useCallback((newOrders: Order[]) => {
    if (!ordersEqual(ordersRef.current, newOrders)) {
      ordersRef.current = newOrders;
      setOrders(newOrders);
    }
  }, []);

  // Fetch snapshot from REST API
  const fetchSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.snapshot}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (mountedRef.current && isValidOrdersArray(data)) {
        updateOrders(data);
        return true;
      }
    } catch {
      // Network error or timeout
    }
    return false;
  }, [updateOrders]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const es = new EventSource(API_CONFIG.sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        console.log('[SSE] Connected to', API_CONFIG.sseUrl);
        setConnectionStatus('connected');
        setError(null);
        retryCountRef.current = 0;
        fetchSnapshot();
      };

      es.addEventListener('update', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (isValidOrdersArray(data)) {
            updateOrders(data);
          }
        } catch {
          // Parse error - try to recover with snapshot
          fetchSnapshot();
        }
      });

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        const rawData = event.data;
        if (!rawData || rawData.trim() === '' || rawData.startsWith(':')) return;
        
        try {
          const data = JSON.parse(rawData);
          if (isValidOrdersArray(data)) {
            updateOrders(data);
          }
        } catch {
          // Ignore parse errors on generic messages
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        
        console.log('[SSE] Connection error, will retry');
        es.close();
        eventSourceRef.current = null;
        setConnectionStatus('disconnected');
        
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;
        
        setError(`Connection lost. Retrying in ${Math.round(delay / 1000)}s...`);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      };
    } catch (err) {
      console.error('[SSE] Failed to create EventSource:', err);
      setConnectionStatus('error');
      setError('Failed to connect to server');
    }
  }, [fetchSnapshot, updateOrders]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Initial connection
  useEffect(() => {
    mountedRef.current = true;
    
    // Small delay to ensure component is fully mounted
    const initTimeout = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run once

  return { orders, connectionStatus, error, reconnect };
}
