import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Download, Share2, Trash2, Grid, List, Filter, FileText, Tag, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import DocumentUpload from './DocumentUpload';
import DocumentViewer from './DocumentViewer';
import ConfirmDialog from './ConfirmDialog';

interface DocumentListProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showUpload, setShowUpload] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; documentId: string | null }>({
    open: false,
    documentId: null,
  });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadDocuments();
  }, [patientId, typeFilter, tagFilter]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (typeFilter) filters.documentType = typeFilter;
      if (tagFilter) filters.tag = tagFilter;

      const response = await ehrApi.getDocuments(patientId, filters, token, tenantSlug);
      setDocuments(response.data || []);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      showError('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.documentId) return;

    try {
      await ehrApi.deleteDocument(deleteConfirm.documentId, token, tenantSlug);
      showSuccess('Success', 'Document deleted successfully');
      setDeleteConfirm({ open: false, documentId: null });
      loadDocuments();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to delete document');
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    searchTerm
      ? doc.document_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocumentIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return '📊';
    return '📎';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6" />
              Documents
            </h2>
            <p className="text-purple-100 text-sm mt-1">Patient: {patientName}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              Upload
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="clinical_note">Clinical Note</option>
            <option value="lab_result">Lab Result</option>
            <option value="imaging_result">Imaging Result</option>
            <option value="prescription">Prescription</option>
            <option value="consent_form">Consent Form</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium mb-2">No documents found</p>
            <p className="text-sm text-slate-400 mb-4">Upload documents to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Upload Documents
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedDocument(doc);
                  setShowViewer(true);
                }}
              >
                <div className="text-4xl mb-3 text-center">{getDocumentIcon(doc.mime_type)}</div>
                <p className="font-medium text-slate-800 text-sm truncate mb-1">{doc.document_name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(doc.file_size)}</p>
                <p className="text-xs text-slate-500">{formatDate(doc.uploaded_at)}</p>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {doc.tags.slice(0, 2).map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl">{getDocumentIcon(doc.mime_type)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 mb-1">{doc.document_name}</h3>
                      {doc.description && (
                        <p className="text-sm text-slate-600 mb-2">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{doc.document_type?.replace(/_/g, ' ')}</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatDate(doc.uploaded_at)}</span>
                        {doc.version_count > 1 && (
                          <span className="text-blue-600">v{doc.version_count}</span>
                        )}
                        {doc.signature_count > 0 && (
                          <span className="text-green-600">✓ Signed</span>
                        )}
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.map((tag: string) => (
                            <span key={tag} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedDocument(doc);
                        setShowViewer(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, documentId: doc.id })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <DocumentUpload
          patientId={patientId}
          patientName={patientName}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            loadDocuments();
          }}
        />
      )}

      {showViewer && selectedDocument && (
        <DocumentViewer
          documentId={selectedDocument.id}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowViewer(false);
            setSelectedDocument(null);
          }}
          onUpdate={() => {
            loadDocuments();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, documentId: null })}
      />
    </div>
  );
};

export default DocumentList;

