import { useCallback, useState } from 'react';

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

export const usePrompt = () => {
  const [promptState, setPromptState] = useState<PromptOptions & {
    isOpen: boolean;
    value: string;
    onConfirm: ((value: string | null) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    value: '',
    onConfirm: null,
  });

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        ...options,
        isOpen: true,
        value: options.initialValue || '',
        onConfirm: resolve,
      });
    });
  }, []);

  const cancel = useCallback(() => {
    promptState.onConfirm?.(null);
    setPromptState((prev) => ({ ...prev, isOpen: false, onConfirm: null, value: '' }));
  }, [promptState]);

  const confirm = useCallback(() => {
    const value = promptState.value.trim();
    if (promptState.required && !value) return;
    promptState.onConfirm?.(value);
    setPromptState((prev) => ({ ...prev, isOpen: false, onConfirm: null, value: '' }));
  }, [promptState]);

  return {
    promptState,
    setPromptState,
    prompt,
    cancel,
    confirm,
  };
};
