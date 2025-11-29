import React, { useState, useCallback } from 'react';
import ConfirmationDialog, { ConfirmationType } from '../components/ConfirmationDialog';

interface ConfirmationOptions {
  title: string;
  message: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  onConfirm: (() => void) | null;
  isLoading?: boolean;
}

/**
 * Hook for showing beautiful confirmation dialogs
 * Replaces browser confirm() with custom UI
 */
export const useConfirmation = () => {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const confirm = useCallback(
    (options: ConfirmationOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: options.type || 'warning',
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          icon: options.icon,
          onConfirm: () => {
            setState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            resolve(true);
          },
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (state.onConfirm) {
      state.onConfirm();
    }
  }, [state.onConfirm]);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const Dialog = (
    <ConfirmationDialog
      isOpen={state.isOpen}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      isLoading={state.isLoading}
      icon={state.icon}
    />
  );

  return {
    confirm,
    setLoading,
    Dialog,
  };
};

