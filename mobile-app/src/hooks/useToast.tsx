import { useState, useCallback } from 'react';
import Toast, { ToastType } from '../components/shared/Toast';

interface ToastState {
  visible: boolean;
  message: string;
  title?: string;
  type: ToastType;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      setToast({
        visible: true,
        message,
        type,
        title,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const ToastComponent = (
    <Toast
      visible={toast.visible}
      message={toast.message}
      title={toast.title}
      type={toast.type}
      onClose={hideToast}
    />
  );

  return {
    showToast,
    hideToast,
    ToastComponent,
  };
};

export default useToast;

