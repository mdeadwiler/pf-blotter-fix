// Formatting utilities for display

export const formatPrice = (price: number): string => {
  if (price === 0) return '-';
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatQuantity = (qty: number): string => {
  return qty.toLocaleString('en-US');
};

export const formatSide = (side: '1' | '2'): string => {
  return side === '1' ? 'BUY' : 'SELL';
};

export const formatTime = (isoTime: string): string => {
  if (!isoTime) return '-';
  try {
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTime;
  }
};

export const formatDateTime = (isoTime: string): string => {
  if (!isoTime) return '-';
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTime;
  }
};

// Get CSS class for order status
export const getStatusClass = (status: string): string => {
  switch (status.toUpperCase()) {
    case 'NEW':
      return 'status-new';
    case 'FILLED':
      return 'status-filled';
    case 'REJECTED':
      return 'status-rejected';
    case 'CANCELED':
      return 'status-canceled';
    case 'PARTIAL':
      return 'status-partial';
    default:
      return '';
  }
};

// Get CSS class for side
export const getSideClass = (side: '1' | '2'): string => {
  return side === '1' ? 'side-buy' : 'side-sell';
};
