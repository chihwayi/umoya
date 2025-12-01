import { useState, useCallback } from 'react';

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const useConfirmation = () => {
  const [confirmation, setConfirmation] = useState<ConfirmationOptions & { isOpen: boolean; onConfirm: (() => void) | null }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmation({
        ...options,
        isOpen: true,
        onConfirm: () => {
          setConfirmation(prev => ({ ...prev, isOpen: false, onConfirm: null }));
          resolve(true);
        },
      });
    });
  }, []);

  const cancel = useCallback(() => {
    setConfirmation(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  }, []);

  return {
    confirmation,
    confirm,
    cancel,
  };
};

