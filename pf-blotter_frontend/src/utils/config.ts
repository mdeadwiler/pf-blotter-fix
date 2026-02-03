// API configuration
// In production (Docker), nginx proxies /api/* and /events to backend

const isDev = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_API_URL;

export const API_CONFIG = {
  // Backend URL
  // - Dev: direct to localhost:8080
  // - Docker: nginx proxies /api/* to backend:8080
  baseUrl: isDev ? 'http://localhost:8080' : (apiUrl || '/api'),
  
  // SSE endpoint
  // - Dev: direct connection
  // - Docker: nginx proxies /events to backend
  sseUrl: isDev ? 'http://localhost:8080/events' : (apiUrl ? `${apiUrl}/events` : '/events'),
  
  // Endpoints
  endpoints: {
    health: '/health',
    snapshot: '/snapshot',
    events: '/events',
    stats: '/stats',
    orderbook: '/orderbook',
  },
  
  // SSE reconnection settings
  sse: {
    initialRetryDelay: 1000,    // 1 second
    maxRetryDelay: 30000,       // 30 seconds
    retryMultiplier: 2,         // Exponential backoff
  },
} as const;

// Helper to build full URL
export const buildUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseUrl}${endpoint}`;
};
