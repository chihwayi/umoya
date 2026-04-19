import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function useLiteMode() {
  const [liteMode, setLiteMode] = useState(() => localStorage.getItem('liteMode') === 'true');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const toggleLiteMode = () => {
    const next = !liteMode;
    setLiteMode(next);
    localStorage.setItem('liteMode', String(next));
  };

  return { liteMode, isOnline, toggleLiteMode };
}

export default function LiteModeToggle() {
  const { liteMode, isOnline, toggleLiteMode } = useLiteMode();

  return (
    <div className="flex items-center gap-2">
      {!isOnline && <span className="text-xs text-red-600 font-medium">OFFLINE</span>}
      <button
        onClick={toggleLiteMode}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${liteMode ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-gray-100 text-gray-600'}`}
      >
        {liteMode ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
        {liteMode ? 'Lite Mode ON' : 'Lite Mode'}
      </button>
    </div>
  );
}
