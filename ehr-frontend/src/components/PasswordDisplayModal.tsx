import React, { useState } from 'react';
import { X, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useNotification } from './GlobalNotification';

interface PasswordDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  email: string;
  tempPassword: string;
}

const PasswordDisplayModal: React.FC<PasswordDisplayModalProps> = ({ 
  isOpen, 
  onClose, 
  userName, 
  email, 
  tempPassword 
}) => {
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const { showSuccess } = useNotification();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      showSuccess('Copied!', 'Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = tempPassword;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      showSuccess('Copied!', 'Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">User Created Successfully</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Account Created</span>
              </div>
              <p className="text-sm text-green-600">
                New user account has been created for <strong>{userName}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-800">{email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-amber-50 border border-amber-200 rounded-lg font-mono text-lg">
                    {showPassword ? tempPassword : '••••••••'}
                  </div>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-3 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`p-3 rounded-lg transition-colors ${
                      copied 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2">Important Instructions:</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Share this password securely with the user</li>
                <li>• User must change password on first login</li>
                <li>• This password will not be shown again</li>
                <li>• Copy the password before closing this dialog</li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all font-semibold"
            >
              I've Saved the Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordDisplayModal;