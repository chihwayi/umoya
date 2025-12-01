import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      border: 'border-red-200',
    },
    warning: {
      icon: 'text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700 text-white',
      border: 'border-orange-200',
    },
    info: {
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      border: 'border-blue-200',
    },
  };

  const styles = variantStyles[variant];

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
        <div
          className="bg-white rounded-xl shadow-2xl max-w-md w-full border-2 border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${styles.border}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 ${styles.icon}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
              </div>
              <button
                onClick={onCancel}
                className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-slate-600 leading-relaxed">{message}</p>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmDialog;

