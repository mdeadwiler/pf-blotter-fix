// API configuration
// In production (Docker/Render), configure via VITE_API_URL

const isDev = import.meta.env.DEV;
const rawApiUrl = import.meta.env.VITE_API_URL || '';

// Normalize API URL - add https:// if missing (Render provides just hostname)
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

const backendUrl = normalizeUrl(rawApiUrl);

// Log config in dev for debugging
if (isDev) {
  console.log('[Config] DEV mode, using localhost:8080');
} else if (backendUrl) {
  console.log('[Config] PROD mode, backend URL:', backendUrl);
} else {
  console.warn('[Config] PROD mode but no VITE_API_URL set!');
}

export const API_CONFIG = {
  // Backend base URL (no trailing slash)
  // - Dev: localhost:8080
  // - Prod: from VITE_API_URL env var
  baseUrl: isDev ? 'http://localhost:8080' : backendUrl,
  
  // SSE endpoint for order updates
  get sseUrl(): string {
    return `${this.baseUrl}/events`;
  },
  
  // SSE endpoint for market data
  get marketDataUrl(): string {
    return `${this.baseUrl}/marketdata`;
  },
  
  // Endpoints (relative to baseUrl)
  endpoints: {
    health: '/health',
    snapshot: '/snapshot',
    events: '/events',
    marketdata: '/marketdata',
    stats: '/stats',
    orderbook: '/orderbook',
    order: '/order',
    cancel: '/cancel',
    amend: '/amend',
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
