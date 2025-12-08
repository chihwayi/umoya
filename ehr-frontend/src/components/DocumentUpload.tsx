import React, { useState, useCallback } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle, Tag } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface DocumentUploadProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FileWithMetadata {
  file: File;
  documentType: string;
  description: string;
  tags: string[];
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const documentTypes = [
    'clinical_note',
    'lab_result',
    'imaging_result',
    'prescription',
    'consent_form',
    'insurance_document',
    'referral_letter',
    'discharge_summary',
    'operative_report',
    'pathology_report',
    'other',
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const filesWithMetadata: FileWithMetadata[] = newFiles.map((file) => ({
      file,
      documentType: 'other',
      description: '',
      tags: [],
      uploading: false,
      uploaded: false,
      error: null,
    }));
    setFiles((prev) => [...prev, ...filesWithMetadata]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileMetadata = (index: number, field: string, value: any) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const addTag = (index: number, tag: string) => {
    if (!tag.trim()) return;
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index && !f.tags.includes(tag.trim())
          ? { ...f, tags: [...f.tags, tag.trim()] }
          : f
      )
    );
  };

  const removeTag = (index: number, tag: string) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f
      )
    );
  };

  const uploadFile = async (fileData: FileWithMetadata, index: number) => {
    const formData = new FormData();
    formData.append('file', fileData.file);
    formData.append('patientId', patientId);
    formData.append('documentType', fileData.documentType);
    formData.append('documentName', fileData.file.name);
    if (fileData.description) {
      formData.append('description', fileData.description);
    }

    try {
      // Update status
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, uploading: true, error: null } : f))
      );

      // Upload document
      const response = await ehrApi.uploadDocument(formData, token, tenantSlug);

      // Add tags if any
      if (fileData.tags.length > 0) {
        for (const tag of fileData.tags) {
          try {
            await ehrApi.addDocumentTag(response.data.id, tag, token, tenantSlug);
          } catch (tagError) {
            console.error('Failed to add tag:', tagError);
          }
        }
      }

      // Update status
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, uploading: false, uploaded: true } : f
        )
      );
    } catch (error: any) {
      console.error('Upload failed:', error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, uploading: false, error: error.response?.data?.message || 'Upload failed' }
            : f
        )
      );
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);

    const uploadPromises = files
      .filter((f) => !f.uploaded && !f.uploading)
      .map((f, i) => {
        const originalIndex = files.indexOf(f);
        return uploadFile(f, originalIndex);
      });

    await Promise.all(uploadPromises);

    // Wait a bit for state updates to complete
    setTimeout(() => {
      setFiles((currentFiles) => {
        const allUploaded = currentFiles.every((f) => f.uploaded);
        const failedCount = currentFiles.filter((f) => f.error).length;
        
        if (allUploaded) {
          showSuccess('Success', `${currentFiles.length} document(s) uploaded successfully`);
        } else if (failedCount > 0) {
          showError('Partial Upload', `${failedCount} document(s) failed to upload`);
        }
        
        // Always call onSuccess to refresh the document list if any files uploaded
        if (currentFiles.some(f => f.uploaded)) {
          onSuccess();
        }
        
        return currentFiles;
      });
      setUploading(false);
    }, 100);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Upload className="w-6 h-6" />
                Upload Documents
              </h2>
              <p className="text-blue-100 text-sm mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium text-slate-700 mb-2">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Supports PDF, images, Word docs, and more
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
            >
              Choose Files
            </label>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Files to Upload ({files.length})</h3>
              {files.map((fileData, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    fileData.uploaded
                      ? 'border-green-300 bg-green-50'
                      : fileData.error
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {fileData.uploaded ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : fileData.error ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <File className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{fileData.file.name}</p>
                          <p className="text-sm text-slate-500">
                            {formatFileSize(fileData.file.size)} • {fileData.file.type || 'Unknown type'}
                          </p>
                        </div>
                        {!fileData.uploaded && !fileData.uploading && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {!fileData.uploaded && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Document Type
                              </label>
                              <select
                                value={fileData.documentType}
                                onChange={(e) => updateFileMetadata(index, 'documentType', e.target.value)}
                                disabled={fileData.uploading}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                              >
                                {documentTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type.replace(/_/g, ' ')}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={fileData.description}
                                onChange={(e) => updateFileMetadata(index, 'description', e.target.value)}
                                disabled={fileData.uploading}
                                placeholder="Brief description..."
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Tags (press Enter to add)
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {fileData.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    onClick={() => removeTag(index, tag)}
                                    className="hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="Add tags..."
                              disabled={fileData.uploading}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value) {
                                  addTag(index, e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                            />
                          </div>
                        </>
                      )}

                      {fileData.uploading && (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-slate-600">Uploading...</span>
                        </div>
                      )}

                      {fileData.uploaded && (
                        <p className="text-sm text-green-600 font-medium">✓ Uploaded successfully</p>
                      )}

                      {fileData.error && (
                        <p className="text-sm text-red-600">{fileData.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              {files.some((f) => f.uploaded) ? 'Close' : 'Cancel'}
            </button>
            {files.length > 0 && !files.every((f) => f.uploaded) && (
              <button
                onClick={handleUploadAll}
                disabled={uploading || files.length === 0}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {files.filter((f) => !f.uploaded).length} File(s)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;







