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
        aria-pressed={liteMode}
        title={
          liteMode
            ? 'Lite Mode is ON — lighter pages and reduced data use for slow/low-bandwidth connections. Click to turn off.'
            : 'Lite Mode — switch on for lighter pages and reduced data use on slow connections.'
        }
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold border transition-colors ${
          liteMode
            ? 'bg-yellow-300 text-yellow-950 border-yellow-500'
            : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-50'
        }`}
      >
        {liteMode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
        <span className="whitespace-nowrap">{liteMode ? 'Lite Mode: On' : 'Lite Mode: Off'}</span>
      </button>
    </div>
  );
}
