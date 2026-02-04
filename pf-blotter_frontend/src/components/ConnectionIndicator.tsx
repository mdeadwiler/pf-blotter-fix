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
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500';
      case 'disconnected':
      case 'error':
        return 'bg-red-500';
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

  const getStatusBg = () => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'connecting':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'disconnected':
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'connected':
        return 'text-emerald-400';
      case 'connecting':
        return 'text-amber-400';
      case 'disconnected':
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusBg()}`}>
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          {status === 'connected' && (
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()} animate-ping opacity-75`} />
          )}
        </div>
        <span className={`text-xs font-medium ${getStatusTextColor()}`}>{getStatusText()}</span>
      </div>
      
      {(status === 'disconnected' || status === 'error') && (
        <button
          onClick={onReconnect}
          className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 
                     hover:bg-cyan-500/20 transition-all duration-200 
                     border border-cyan-500/20 hover:border-cyan-500/40 font-medium"
        >
          Reconnect
        </button>
      )}
      
      {error && (
        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
          {error}
        </span>
      )}
    </div>
  );
}
