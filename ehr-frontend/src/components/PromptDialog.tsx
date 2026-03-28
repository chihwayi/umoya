import React from 'react';
import { AlertTriangle, MessageSquareText, X } from 'lucide-react';
import ModalPortal from './ModalPortal';

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
  isLoading?: boolean;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
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
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const styles =
    type === 'danger'
      ? {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          border: 'border-red-200',
        }
      : type === 'info'
        ? {
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
            border: 'border-blue-200',
          }
        : {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
            border: 'border-amber-200',
          };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className={`w-full max-w-lg rounded-2xl border bg-white shadow-2xl ${styles.border}`}>
          <div className="flex items-start gap-4 border-b border-slate-200 px-6 py-5">
            <div className={`rounded-xl p-3 ${styles.iconBg}`}>
              <div className={styles.iconColor}>
                {type === 'info' ? <MessageSquareText className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
            </div>
            {!isLoading && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="space-y-4 px-6 py-5">
            {multiline ? (
              <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            ) : (
              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-2xl bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`rounded-xl px-5 py-2.5 font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PromptDialog;
