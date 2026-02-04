// API configuration
// In production (Docker/Render), configure via VITE_API_URL

const isDev = import.meta.env.DEV;
const rawApiUrl = import.meta.env.VITE_API_URL || '';

// Normalize API URL - add https:// if missing (Render provides just hostname)
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

const apiUrl = normalizeUrl(rawApiUrl);

export const API_CONFIG = {
  // Backend URL
  // - Dev: direct to localhost:8080
  // - Production: full URL from VITE_API_URL
  baseUrl: isDev ? 'http://localhost:8080' : (apiUrl || '/api'),
  
  // SSE endpoint
  // - Dev: direct connection
  // - Production: backend URL + /events
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
