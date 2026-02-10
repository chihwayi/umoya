import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationToast, NotificationType } from '../components/NotificationToast';

interface NotificationContextType {
  show: (type: NotificationType, title: string, message: string, duration?: number) => void;
  success: (title: string, message: string, duration?: number) => void;
  error: (title: string, message: string, duration?: number) => void;
  warning: (title: string, message: string, duration?: number) => void;
  info: (title: string, message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const show = useCallback((type: NotificationType, title: string, message: string, duration = 5000) => {
    const id = uuidv4();
    setNotifications((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  const success = useCallback((title: string, message: string, duration?: number) => {
    show('success', title, message, duration);
  }, [show]);

  const error = useCallback((title: string, message: string, duration?: number) => {
    show('error', title, message, duration);
  }, [show]);

  const warning = useCallback((title: string, message: string, duration?: number) => {
    show('warning', title, message, duration);
  }, [show]);

  const info = useCallback((title: string, message: string, duration?: number) => {
    show('info', title, message, duration);
  }, [show]);

  return (
    <NotificationContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      <div className="fixed top-0 right-0 p-6 z-50 flex flex-col gap-4 pointer-events-none w-full max-w-sm">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
