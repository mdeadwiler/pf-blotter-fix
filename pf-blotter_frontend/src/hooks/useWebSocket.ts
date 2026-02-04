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

/**
 * Hybrid WebSocket/SSE hook
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
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState(0);
  const [protocol, setProtocol] = useState<'websocket' | 'sse' | 'none'>('none');
  
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastMessageTimeRef = useRef<number>(Date.now());

  const getWebSocketUrl = useCallback(() => {
    const baseUrl = API_CONFIG.baseUrl;
    // Convert http(s) to ws(s)
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
    setLatencyMs(latency);
    
    if (onMessage) {
      onMessage(data);
    }
  }, [onMessage]);

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setStatus('connected');
        setProtocol('websocket');
        reconnectAttemptsRef.current = 0;
        console.log('[WebSocket] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch {
          handleMessage(event.data);
        }
      };

      ws.onerror = (error) => {
        console.warn('[WebSocket] Error, falling back to SSE:', error);
        onError?.(error);
        // Try SSE fallback
        ws.close();
        connectSSE();
      };

      ws.onclose = () => {
        if (status === 'connected') {
          setStatus('disconnected');
          scheduleReconnect();
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket not supported, use SSE
      connectSSE();
    }
  }, [getWebSocketUrl, handleMessage, onError, status]);

  const connectSSE = useCallback(() => {
    try {
      const sseUrl = getSseUrl();
      const sse = new EventSource(sseUrl);
      
      sse.onopen = () => {
        setStatus('connected');
        setProtocol('sse');
        reconnectAttemptsRef.current = 0;
        console.log('[SSE] Connected');
      };

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch {
          handleMessage(event.data);
        }
      };

      sse.onerror = (error) => {
        console.warn('[SSE] Error:', error);
        setStatus('error');
        onError?.(error);
        sse.close();
        scheduleReconnect();
      };

      sseRef.current = sse;
    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
      setStatus('error');
    }
  }, [getSseUrl, handleMessage, onError]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setStatus('error');
      return;
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      setStatus('connecting');
      connectWebSocket();
    }, reconnectInterval * Math.pow(2, reconnectAttemptsRef.current)); // Exponential backoff
  }, [connectWebSocket, maxReconnectAttempts, reconnectInterval]);

  const send = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    // Close existing connections
    wsRef.current?.close();
    sseRef.current?.close();
    
    // Reset state
    reconnectAttemptsRef.current = 0;
    setStatus('connecting');
    
    // Reconnect
    connectWebSocket();
  }, [connectWebSocket]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    sseRef.current?.close();
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    return cleanup;
  }, [connectWebSocket, cleanup]);

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
