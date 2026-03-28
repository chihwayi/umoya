import React, { useCallback, useState } from 'react';
import PromptDialog from '../components/PromptDialog';

interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  initialValue?: string;
  multiline?: boolean;
  required?: boolean;
}

interface PromptState extends PromptOptions {
  isOpen: boolean;
  value: string;
  resolver: ((value: string | null) => void) | null;
}

export const usePrompt = () => {
  const [state, setState] = useState<PromptState>({
    isOpen: false,
    title: '',
    message: '',
    value: '',
    resolver: null,
  });

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        value: options.initialValue || '',
        resolver: resolve,
        placeholder: options.placeholder,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        type: options.type,
        multiline: options.multiline,
        required: options.required,
      });
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, resolver: null, value: '' }));
  }, []);

  const cancel = useCallback(() => {
    state.resolver?.(null);
    close();
  }, [close, state]);

  const confirm = useCallback(() => {
    const value = state.value.trim();
    if (state.required && !value) {
      return;
    }
    state.resolver?.(value);
    close();
  }, [close, state]);

  const Dialog = (
    <PromptDialog
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      value={state.value}
      onChange={(value) => setState((prev) => ({ ...prev, value }))}
      onCancel={cancel}
      onConfirm={confirm}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      placeholder={state.placeholder}
      type={state.type}
      multiline={state.multiline}
    />
  );

  return {
    prompt,
    Dialog,
  };
};
