import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    // Prevent duplicate notifications with same title and message
    setNotifications(prev => {
      const isDuplicate = prev.some(n => 
        n.title === notification.title && 
        n.message === notification.message &&
        Date.now() - parseInt(n.id, 36) < 1000 // Within 1 second
      );
      
      if (isDuplicate) return prev;
      return [...prev, newNotification];
    });
    
    const duration = notification.duration || 5000;
    setTimeout(() => removeNotification(id), duration);
  }, [removeNotification]);

  const showSuccess = useCallback((title: string, message: string) => {
    showNotification({ type: 'success', title, message });
  }, [showNotification]);

  const showError = useCallback((title: string, message: string) => {
    showNotification({ type: 'error', title, message, duration: 7000 });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message: string) => {
    showNotification({ type: 'warning', title, message, duration: 6000 });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message: string) => {
    showNotification({ type: 'info', title, message });
  }, [showNotification]);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showWarning, showInfo }}>
      {children}
      
      {/* Notification Container - Enhanced with animations */}
      <div className="fixed top-4 right-4 z-[9998] space-y-3 max-w-md w-full pointer-events-none">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={`${getStyles(notification.type)} border-2 rounded-2xl p-5 shadow-2xl backdrop-blur-md pointer-events-auto transform transition-all duration-300 ease-out animate-in slide-in-from-right fade-in`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 rounded-xl bg-white/50 backdrop-blur-sm">
                <div className={notification.type === 'success' ? 'text-emerald-600' : notification.type === 'error' ? 'text-red-600' : notification.type === 'warning' ? 'text-amber-600' : 'text-blue-600'}>
                  {getIcon(notification.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-base text-slate-900">{notification.title}</h4>
                <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition-all duration-200"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar for auto-dismiss */}
            <div className="mt-3 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  notification.type === 'success'
                    ? 'bg-emerald-600'
                    : notification.type === 'error'
                    ? 'bg-red-600'
                    : notification.type === 'warning'
                    ? 'bg-amber-600'
                    : 'bg-blue-600'
                } animate-shrink`}
                style={{
                  animation: `shrink ${notification.duration || 5000}ms linear forwards`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};