import type { ConnectionStatus } from '../types/order';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  error: string | null;
  onReconnect: () => void;
}

export function ConnectionIndicator({ status, error, onReconnect }: ConnectionIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-neon-green';
      case 'connecting':
        return 'bg-neon-yellow';
      case 'disconnected':
      case 'error':
        return 'bg-neon-red';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${getStatusColor()} ${
            status === 'connected' ? 'pulse-connected' : ''
          }`}
        />
        <span className="text-sm text-gray-400">{getStatusText()}</span>
      </div>
      
      {(status === 'disconnected' || status === 'error') && (
        <button
          onClick={onReconnect}
          className="text-xs px-2 py-1 rounded bg-dark-600 text-neon-cyan hover:bg-dark-500 
                     transition-colors border border-neon-cyan/30 hover:border-neon-cyan/50"
        >
          Reconnect
        </button>
      )}
      
      {error && (
        <span className="text-xs text-neon-red">{error}</span>
      )}
    </div>
  );
}
