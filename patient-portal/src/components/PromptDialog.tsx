import React from 'react';
import { AlertTriangle, MessageSquareText, X } from 'lucide-react';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  type?: 'danger' | 'warning' | 'info';
  multiline?: boolean;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title,
  message,
  value,
  onChange,
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  placeholder,
  type = 'warning',
  multiline = false,
}) => {
  if (!isOpen) return null;

  const styles =
    type === 'danger'
      ? { iconBg: 'bg-red-100', iconColor: 'text-red-600', button: 'bg-red-600 hover:bg-red-700 text-white' }
      : type === 'info'
        ? { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700 text-white' }
        : { iconBg: 'bg-amber-100', iconColor: 'text-amber-600', button: 'bg-amber-600 hover:bg-amber-700 text-white' };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className={`rounded-xl p-3 ${styles.iconBg}`}>
              {type === 'info' ? <MessageSquareText className={`h-6 w-6 ${styles.iconColor}`} /> : <AlertTriangle className={`h-6 w-6 ${styles.iconColor}`} />}
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-xl font-bold text-gray-900">{title}</h3>
              <p className="text-gray-600">{message}</p>
            </div>
            <button onClick={onCancel} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {multiline ? (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          ) : (
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onCancel} className="rounded-xl bg-gray-100 px-6 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-200">
              {cancelText}
            </button>
            <button onClick={onConfirm} className={`rounded-xl px-6 py-2.5 font-semibold shadow-lg transition-colors hover:shadow-xl ${styles.button}`}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
