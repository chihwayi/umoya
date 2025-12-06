import React, { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, Download, CheckCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ConfirmDialog from './ConfirmDialog';

interface DocumentVersionHistoryProps {
  documentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onRestore: () => void;
}

const DocumentVersionHistory: React.FC<DocumentVersionHistoryProps> = ({
  documentId,
  tenantSlug,
  token,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreConfirm, setRestoreConfirm] = useState<{ open: boolean; versionId: string | null }>({
    open: false,
    versionId: null,
  });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getDocumentVersions(documentId, token, tenantSlug);
      setVersions(response.data || []);
    } catch (error: any) {
      showError('Error', 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirm.versionId) return;

    try {
      await ehrApi.restoreDocumentVersion(documentId, restoreConfirm.versionId, token, tenantSlug);
      showSuccess('Success', 'Version restored successfully');
      setRestoreConfirm({ open: false, versionId: null });
      onRestore();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to restore version');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Version History
              </h3>
              <p className="text-blue-100 text-sm mt-1">{versions.length} version(s)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium">No version history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.is_current
                      ? 'border-green-300 bg-green-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-800">
                          Version {version.version_number}
                        </span>
                        {version.is_current && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>Uploaded: {formatDate(version.uploaded_at)}</p>
                        <p>By: {version.first_name} {version.last_name}</p>
                        <p>Size: {formatFileSize(version.file_size)}</p>
                        {version.change_summary && (
                          <p className="text-slate-700 mt-2">{version.change_summary}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!version.is_current && (
                        <button
                          onClick={() => setRestoreConfirm({ open: true, versionId: version.id })}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restore Confirmation */}
        <ConfirmDialog
          open={restoreConfirm.open}
          title="Restore Version"
          message="Are you sure you want to restore this version? This will make it the current version."
          confirmText="Restore"
          cancelText="Cancel"
          variant="warning"
          onConfirm={handleRestore}
          onCancel={() => setRestoreConfirm({ open: false, versionId: null })}
        />
      </div>
    </div>
  );
};

export default DocumentVersionHistory;





