import React, { useState, useEffect } from 'react';
import { X, Download, Share2, Edit, Clock, Tag, FileText, User, Calendar } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import DocumentVersionHistory from './DocumentVersionHistory';
import DocumentSharing from './DocumentSharing';

interface DocumentViewerProps {
  documentId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  tenantSlug,
  token,
  onClose,
  onUpdate,
}) => {
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getDocumentById(documentId, token, tenantSlug);
      setDocument(response.data);
      
      // Get document view URL
      try {
        const viewResponse = await ehrApi.viewDocument(documentId, token, tenantSlug);
        setDocumentUrl(viewResponse.data.redirectUrl);
      } catch (viewError) {
        console.log('Could not load document preview');
      }
    } catch (error: any) {
      showError('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    try {
      setAddingTag(true);
      await ehrApi.addDocumentTag(documentId, newTag.trim(), token, tenantSlug);
      showSuccess('Success', 'Tag added');
      setNewTag('');
      loadDocument();
      onUpdate();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to add tag');
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await ehrApi.removeDocumentTag(documentId, tag, token, tenantSlug);
      showSuccess('Success', 'Tag removed');
      loadDocument();
      onUpdate();
    } catch (error: any) {
      showError('Error', 'Failed to remove tag');
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

  if (loading || !document) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{document.document_name}</h2>
              <p className="text-purple-100 text-sm mt-1">
                {document.patient_first_name} {document.patient_last_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowVersionHistory(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Version History ({document.version_count || 1})
            </button>
            <button
              onClick={() => setShowSharing(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={() => window.open(document.file_url || document.file_path, '_blank')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Type:</span>
              <p className="font-medium text-slate-800">{document.document_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-slate-500">Size:</span>
              <p className="font-medium text-slate-800">{formatFileSize(document.file_size)}</p>
            </div>
            <div>
              <span className="text-slate-500">Uploaded:</span>
              <p className="font-medium text-slate-800">{formatDate(document.uploaded_at)}</p>
            </div>
            <div>
              <span className="text-slate-500">By:</span>
              <p className="font-medium text-slate-800">
                {document.uploaded_by_first_name} {document.uploaded_by_last_name}
              </p>
            </div>
          </div>

          {document.description && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Description</h4>
              <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{document.description}</p>
            </div>
          )}

          {/* Tags */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              Tags
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {document.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                }}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                disabled={addingTag || !newTag.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Document Preview */}
          <div className="bg-slate-100 rounded-lg overflow-hidden">
            {documentUrl && document.mime_type?.includes('pdf') ? (
              <iframe
                src={documentUrl}
                className="w-full h-96 border-0"
                title="Document Preview"
              />
            ) : documentUrl && document.mime_type?.includes('image') ? (
              <img
                src={documentUrl}
                alt="Document Preview"
                className="w-full h-auto max-h-96 object-contain"
              />
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">Document preview will be displayed here</p>
                <p className="text-sm text-slate-500 mt-2">
                  Click Download to view the full document
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {showVersionHistory && (
          <DocumentVersionHistory
            documentId={documentId}
            tenantSlug={tenantSlug}
            token={token}
            onClose={() => setShowVersionHistory(false)}
            onRestore={() => {
              setShowVersionHistory(false);
              loadDocument();
              onUpdate();
            }}
          />
        )}

        {showSharing && (
          <DocumentSharing
            documentId={documentId}
            tenantSlug={tenantSlug}
            token={token}
            onClose={() => setShowSharing(false)}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;


