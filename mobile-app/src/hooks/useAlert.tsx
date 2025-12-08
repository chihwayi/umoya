import { useState, useCallback } from 'react';
import AlertModal, { AlertType } from '../components/shared/AlertModal';

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      type: AlertType = 'info',
      options?: {
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
      }
    ) => {
      setAlert({
        visible: true,
        title,
        message,
        type,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        onConfirm: options?.onConfirm,
        onCancel: options?.onCancel,
      });
    },
    []
  );

  const hideAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }));
  }, []);

  const AlertComponent = (
    <AlertModal
      visible={alert.visible}
      title={alert.title}
      message={alert.message}
      type={alert.type}
      confirmText={alert.confirmText}
      cancelText={alert.cancelText}
      onConfirm={alert.onConfirm}
      onCancel={alert.onCancel}
      onClose={hideAlert}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
};

export default useAlert;

