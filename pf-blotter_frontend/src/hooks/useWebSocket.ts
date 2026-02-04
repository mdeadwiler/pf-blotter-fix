import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/config';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  latencyMs: number;
  protocol: 'websocket' | 'sse' | 'none';
  send: (message: string) => void;
  reconnect: () => void;
}

// Exponential backoff with jitter (industry standard)
function calculateBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = exponential * 0.2 * Math.random(); // 20% jitter
  return exponential + jitter;
}

/**
 * Hybrid WebSocket/SSE hook with proper cleanup and backoff
 * Attempts WebSocket first for sub-millisecond latency,
 * falls back to SSE if WebSocket is not available.
 */
export function useWebSocket(
  endpoint: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onError,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState(0);
  const [protocol, setProtocol] = useState<'websocket' | 'sse' | 'none'>('none');
  
  // Use refs to avoid stale closures in callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastMessageTimeRef = useRef<number>(Date.now());
  const mountedRef = useRef(true);
  const statusRef = useRef<ConnectionStatus>('connecting');
  
  // Keep status ref in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Stable refs for callbacks to avoid effect dependency issues
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  const getWebSocketUrl = useCallback(() => {
    const baseUrl = API_CONFIG.baseUrl;
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}${endpoint}`;
  }, [endpoint]);

  const getSseUrl = useCallback(() => {
    return `${API_CONFIG.baseUrl}${endpoint}`;
  }, [endpoint]);

  const handleMessage = useCallback((data: unknown) => {
    const now = Date.now();
    const latency = now - lastMessageTimeRef.current;
    lastMessageTimeRef.current = now;
    // Only update latency if reasonable (< 10s, to filter out reconnection gaps)
    if (latency < 10000) {
      setLatencyMs(latency);
    }
    onMessageRef.current?.(data);
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.onopen = null;
      sseRef.current.onerror = null;
      sseRef.current.onmessage = null;
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setStatus('error');
      return;
    }

    const backoff = calculateBackoff(
      reconnectAttemptsRef.current,
      reconnectInterval,
      30000 // Max 30 seconds
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      reconnectAttemptsRef.current++;
      setStatus('connecting');
      connectWebSocket();
    }, backoff);
  }, [reconnectInterval, maxReconnectAttempts]);

  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;
    
    try {
      cleanup(); // Clean up any existing connections
      
      const sseUrl = getSseUrl();
      const sse = new EventSource(sseUrl);
      sseRef.current = sse;
      
      sse.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        setProtocol('sse');
        reconnectAttemptsRef.current = 0;
        console.log('[SSE] Connected');
      };

      sse.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch {
          handleMessage(event.data);
        }
      };

      sse.onerror = (error) => {
        if (!mountedRef.current) return;
        console.warn('[SSE] Error:', error);
        setStatus('disconnected');
        onErrorRef.current?.(error);
        sse.close();
        sseRef.current = null;
        scheduleReconnect();
      };
    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
      if (mountedRef.current) {
        setStatus('error');
      }
    }
  }, [getSseUrl, handleMessage, cleanup, scheduleReconnect]);

  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current) return;
    
    try {
      cleanup(); // Clean up any existing connections
      
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        setProtocol('websocket');
        reconnectAttemptsRef.current = 0;
        console.log('[WebSocket] Connected');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch {
          handleMessage(event.data);
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;
        console.warn('[WebSocket] Error, falling back to SSE:', error);
        onErrorRef.current?.(error);
        ws.close();
        wsRef.current = null;
        // Try SSE fallback
        connectSSE();
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        
        // Only reconnect if we were previously connected (not during initial connection)
        if (statusRef.current === 'connected') {
          setStatus('disconnected');
          scheduleReconnect();
        }
      };
    } catch {
      // WebSocket not supported, use SSE
      connectSSE();
    }
  }, [getWebSocketUrl, handleMessage, cleanup, connectSSE, scheduleReconnect]);

  const send = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    cleanup();
    reconnectAttemptsRef.current = 0;
    setStatus('connecting');
    connectWebSocket();
  }, [cleanup, connectWebSocket]);

  // Initialize connection - stable effect
  useEffect(() => {
    mountedRef.current = true;
    connectWebSocket();
    
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [endpoint]); // Only re-run if endpoint changes

  return {
    status,
    latencyMs,
    protocol,
    send,
    reconnect,
  };
}

/**
 * Performance metrics for WebSocket vs SSE comparison
 */
export interface TransportMetrics {
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  messagesReceived: number;
  protocol: 'websocket' | 'sse';
}

export function useTransportMetrics(): [TransportMetrics, (latency: number) => void] {
  const [metrics, setMetrics] = useState<TransportMetrics>({
    avgLatencyMs: 0,
    minLatencyMs: Infinity,
    maxLatencyMs: 0,
    messagesReceived: 0,
    protocol: 'sse',
  });

  const recordLatency = useCallback((latency: number) => {
    setMetrics(prev => {
      const newCount = prev.messagesReceived + 1;
      const newAvg = (prev.avgLatencyMs * prev.messagesReceived + latency) / newCount;
      return {
        ...prev,
        avgLatencyMs: newAvg,
        minLatencyMs: Math.min(prev.minLatencyMs, latency),
        maxLatencyMs: Math.max(prev.maxLatencyMs, latency),
        messagesReceived: newCount,
      };
    });
  }, []);

  return [metrics, recordLatency];
}
