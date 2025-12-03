import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  Share2,
  Calendar,
  User,
  Tag,
  X,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Clock,
  Shield
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ModalPortal from './ModalPortal';
import DocumentViewer from './DocumentViewer';

interface SharedDocument {
  id: string;
  document_id: string;
  document: {
    id: string;
    file_name: string;
    document_type: string;
    description: string;
    file_size: number;
    uploaded_at: string;
    uploaded_by: string;
    patient_id: string;
    tags: any[];
  };
  shared_by: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  shared_at: string;
  permission_level: 'view' | 'download' | 'edit';
  expires_at?: string;
  patient?: {
    first_name: string;
    last_name: string;
    patient_number: string;
  };
}

interface SharedDocumentsListProps {
  token: string;
  tenantSlug: string;
  currentUser?: any;
}

const SharedDocumentsList: React.FC<SharedDocumentsListProps> = ({ token, tenantSlug, currentUser }) => {
  const { showError, showSuccess } = useNotification();
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    loadSharedDocuments();
  }, [token, tenantSlug]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterType]);

  const loadSharedDocuments = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getSharedDocuments(token, tenantSlug);
      setDocuments(response.data || []);
    } catch (error: any) {
      console.error('Error loading shared documents:', error);
      showError(error.response?.data?.message || 'Failed to load shared documents');
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.document.file_name.toLowerCase().includes(term) ||
          doc.document.description?.toLowerCase().includes(term) ||
          doc.patient?.first_name?.toLowerCase().includes(term) ||
          doc.patient?.last_name?.toLowerCase().includes(term) ||
          doc.shared_by.first_name.toLowerCase().includes(term) ||
          doc.shared_by.last_name.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((doc) => doc.document.document_type === filterType);
    }

    setFilteredDocuments(filtered);
  };

  const handleViewDocument = (documentId: string) => {
    setSelectedDocument(documentId);
    setShowViewer(true);
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      // Download logic would go here
      showSuccess('Document download initiated');
    } catch (error: any) {
      showError('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const isExpiringSoon = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getDocumentTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      lab_result: 'bg-purple-100 text-purple-800',
      imaging: 'bg-blue-100 text-blue-800',
      prescription: 'bg-green-100 text-green-800',
      consent: 'bg-yellow-100 text-yellow-800',
      referral: 'bg-pink-100 text-pink-800',
      discharge_summary: 'bg-indigo-100 text-indigo-800',
      progress_note: 'bg-teal-100 text-teal-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'view':
        return <Eye className="w-4 h-4" />;
      case 'download':
        return <Download className="w-4 h-4" />;
      case 'edit':
        return <FileText className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const documentTypes = [...new Set(documents.map(d => d.document.document_type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading shared documents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shared Documents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Documents shared with you by other providers
          </p>
        </div>
        <button
          onClick={loadSharedDocuments}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents, patients, or providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Shared</p>
              <p className="text-2xl font-bold text-blue-900">{documents.length}</p>
            </div>
            <Share2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Can Download</p>
              <p className="text-2xl font-bold text-green-900">
                {documents.filter(d => d.permission_level === 'download' || d.permission_level === 'edit').length}
              </p>
            </div>
            <Download className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Expiring Soon</p>
              <p className="text-2xl font-bold text-yellow-900">
                {documents.filter(d => isExpiringSoon(d.expires_at)).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Lab Results</p>
              <p className="text-2xl font-bold text-purple-900">
                {documents.filter(d => d.document.document_type === 'lab_result').length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Share2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' ? 'No matching documents' : 'No shared documents'}
          </h3>
          <p className="text-gray-500">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Documents shared with you by other providers will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shared By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shared Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((sharedDoc) => {
                  const doc = sharedDoc.document;
                  const expired = isExpired(sharedDoc.expires_at);
                  const expiringSoon = isExpiringSoon(sharedDoc.expires_at);

                  return (
                    <tr key={sharedDoc.id} className={expired ? 'opacity-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <FileText className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.file_name}
                              </p>
                              {expired && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Expired
                                </span>
                              )}
                              {expiringSoon && !expired && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Expiring Soon
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDocumentTypeColor(doc.document_type)}`}>
                                {doc.document_type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatFileSize(doc.file_size)}
                              </span>
                            </div>
                            {doc.description && (
                              <p className="text-xs text-gray-500 mt-1 truncate">{doc.description}</p>
                            )}
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {doc.tags.map((tag: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                                    <Tag className="w-3 h-3" />
                                    {tag.tag_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {sharedDoc.patient ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {sharedDoc.patient.first_name} {sharedDoc.patient.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{sharedDoc.patient.patient_number}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {sharedDoc.shared_by.first_name} {sharedDoc.shared_by.last_name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{sharedDoc.shared_by.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {formatDate(sharedDoc.shared_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(sharedDoc.permission_level)}
                          <span className="text-sm text-gray-700 capitalize">
                            {sharedDoc.permission_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {sharedDoc.expires_at ? (
                          <div className="text-sm">
                            {expired ? (
                              <span className="text-red-600 font-medium">Expired</span>
                            ) : expiringSoon ? (
                              <span className="text-yellow-600 font-medium">{formatDate(sharedDoc.expires_at)}</span>
                            ) : (
                              <span className="text-gray-500">{formatDate(sharedDoc.expires_at)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDocument(doc.id)}
                            disabled={expired}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(sharedDoc.permission_level === 'download' || sharedDoc.permission_level === 'edit') && (
                            <button
                              onClick={() => handleDownload(doc.id, doc.file_name)}
                              disabled={expired}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showViewer && selectedDocument && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Document Viewer</h2>
                <button
                  onClick={() => {
                    setShowViewer(false);
                    setSelectedDocument(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <DocumentViewer
                  documentId={selectedDocument}
                  token={token}
                  tenantSlug={tenantSlug}
                  onClose={() => {
                    setShowViewer(false);
                    setSelectedDocument(null);
                  }}
                  readOnly={true}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default SharedDocumentsList;

