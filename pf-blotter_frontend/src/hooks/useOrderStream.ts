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

export function useOrderStream(): UseOrderStreamReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef<number>(API_CONFIG.sse.initialRetryDelay);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Fetch initial snapshot
  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.snapshot}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (mountedRef.current && isValidOrdersArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.warn('Failed to fetch snapshot:', err);
      // Non-fatal - SSE will provide updates
    }
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    setError(null);

    const es = new EventSource(API_CONFIG.sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      setError(null);
      retryDelayRef.current = API_CONFIG.sse.initialRetryDelay; // Reset backoff
      fetchSnapshot(); // Get initial state
      
      // Periodic refresh every 5s as fallback (in case SSE events are missed)
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      refreshIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          fetchSnapshot();
        }
      }, 5000);
    };

    // Listen for named "update" events from backend
    es.addEventListener('update', (event: MessageEvent) => {
      if (!mountedRef.current) return;
      
      const rawData = event.data;
      if (!rawData || rawData.trim() === '') return;
      
      try {
        const data = JSON.parse(rawData);
        if (isValidOrdersArray(data)) {
          setOrders(data);
        }
      } catch {
        // Parse error - fetch fresh snapshot to recover
        fetchSnapshot();
      }
    });

    // Generic message handler as fallback (for backward compatibility)
    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      
      const rawData = event.data;
      if (!rawData || rawData.trim() === '') return;
      if (rawData.startsWith(':')) return; // SSE comment
      
      try {
        const data = JSON.parse(rawData);
        if (isValidOrdersArray(data)) {
          setOrders(data);
        }
      } catch {
        // Silently ignore - named event handler should catch valid updates
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      
      es.close();
      eventSourceRef.current = null;
      setConnectionStatus('disconnected');
      
      // Clear refresh interval on disconnect
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      
      // Exponential backoff with jitter
      const attempt = Math.log2(retryDelayRef.current / API_CONFIG.sse.initialRetryDelay);
      const delay = calculateBackoffWithJitter(
        attempt,
        API_CONFIG.sse.initialRetryDelay,
        API_CONFIG.sse.maxRetryDelay
      );
      setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s...`);
      
      retryTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          retryDelayRef.current = Math.min(
            retryDelayRef.current * API_CONFIG.sse.retryMultiplier,
            API_CONFIG.sse.maxRetryDelay
          );
          connect();
        }
      }, delay);
    };
  }, [fetchSnapshot]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryDelayRef.current = API_CONFIG.sse.initialRetryDelay;
    connect();
  }, [connect]);

  // Setup and cleanup
  useEffect(() => {
    mountedRef.current = true;
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
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [connect]);

  return { orders, connectionStatus, error, reconnect };
}
