import React, { useState } from 'react';
import { X, Share2, Users, Shield } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface DocumentSharingProps {
  documentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const DocumentSharing: React.FC<DocumentSharingProps> = ({
  documentId,
  tenantSlug,
  token,
  onClose,
}) => {
  const [shareType, setShareType] = useState<'user' | 'role'>('role');
  const [selectedRole, setSelectedRole] = useState('nurse');
  const [permissionLevel, setPermissionLevel] = useState('view');
  const [expiresIn, setExpiresIn] = useState('');
  const [sharing, setSharing] = useState(false);
  const { showSuccess, showError } = useNotification();

  const roles = [
    { value: 'doctor', label: 'All Doctors' },
    { value: 'nurse', label: 'All Nurses' },
    { value: 'lab_tech', label: 'Lab Technicians' },
    { value: 'radiologist', label: 'Radiologists' },
    { value: 'pharmacist', label: 'Pharmacists' },
  ];

  const permissions = [
    { value: 'view', label: 'View Only', desc: 'Can view document' },
    { value: 'download', label: 'View & Download', desc: 'Can view and download' },
    { value: 'edit', label: 'Full Access', desc: 'Can view, download, and edit' },
  ];

  const handleShare = async () => {
    try {
      setSharing(true);

      const shareData: any = {
        permissionLevel,
      };

      if (shareType === 'role') {
        shareData.sharedWithRole = selectedRole;
      }

      if (expiresIn) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
        shareData.expiresAt = expiresAt.toISOString();
      }

      await ehrApi.shareDocument(documentId, shareData, token, tenantSlug);
      showSuccess('Success', 'Document shared successfully');
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to share document');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Share Document
              </h3>
              <p className="text-green-100 text-sm mt-1">Grant access to other users</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Share Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Share With</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setShareType('role')}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  shareType === 'role'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-green-300'
                }`}
              >
                <Users className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-slate-800">Role</p>
                <p className="text-xs text-slate-500">Share with all users in a role</p>
              </button>
              <button
                onClick={() => setShareType('user')}
                disabled
                className="p-4 border-2 border-slate-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                <Shield className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                <p className="font-medium text-slate-600">Specific User</p>
                <p className="text-xs text-slate-500">Coming soon</p>
              </button>
            </div>
          </div>

          {/* Role Selection */}
          {shareType === 'role' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Permission Level */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Permission Level</label>
            <div className="space-y-2">
              {permissions.map((perm) => (
                <label
                  key={perm.value}
                  className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    permissionLevel === perm.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-green-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="permission"
                    value={perm.value}
                    checked={permissionLevel === perm.value}
                    onChange={(e) => setPermissionLevel(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-800">{perm.label}</p>
                    <p className="text-xs text-slate-500">{perm.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Access Expires (Optional)
            </label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Never expires</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full sm:flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full sm:flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 order-1 sm:order-2"
            >
              {sharing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share Document
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSharing;





