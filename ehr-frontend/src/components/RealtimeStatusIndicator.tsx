import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface RealtimeStatusIndicatorProps {
  isConnected?: boolean;
  lastUpdate?: Date;
  isUpdating?: boolean;
  error?: string | null;
}

const RealtimeStatusIndicator: React.FC<RealtimeStatusIndicatorProps> = ({
  isConnected = true,
  lastUpdate,
  isUpdating = false,
  error = null
}) => {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');

  useEffect(() => {
    if (!lastUpdate) return;

    const updateTimeSince = () => {
      const now = new Date();
      const diff = now.getTime() - lastUpdate.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) {
        setTimeSinceUpdate(`${seconds}s ago`);
      } else if (minutes < 60) {
        setTimeSinceUpdate(`${minutes}m ago`);
      } else {
        setTimeSinceUpdate(`${hours}h ago`);
      }
    };

    updateTimeSince();
    const interval = setInterval(updateTimeSince, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  const getStatusColor = () => {
    if (error) return 'text-red-600';
    if (!isConnected) return 'text-red-600';
    if (isUpdating) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-4 h-4" />;
    if (!isConnected) return <WifiOff className="w-4 h-4" />;
    if (isUpdating) return <RefreshCw className="w-4 h-4 animate-spin" />;
    return <Wifi className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (!isConnected) return 'Disconnected';
    if (isUpdating) return 'Updating...';
    return 'Connected';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>
      {lastUpdate && !isUpdating && !error && (
        <span className="text-gray-500 text-xs">
          {timeSinceUpdate}
        </span>
      )}
      {error && (
        <span className="text-red-500 text-xs">
          {error}
        </span>
      )}
    </div>
  );
};

export default RealtimeStatusIndicator;
