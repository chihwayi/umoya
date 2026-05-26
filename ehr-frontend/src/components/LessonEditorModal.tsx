import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { healthEducationApi } from '../services/api';
import { useParams } from 'react-router-dom';

interface LessonEditorModalProps {
  moduleId: string;
  onClose: () => void;
}

const LessonEditorModal: React.FC<LessonEditorModalProps> = ({ moduleId, onClose }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    contentType: 'text',
    contentBody: '',
    durationMinutes: 5,
  });

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.contentBody.trim()) {
      showError('Validation', 'Title and content are required.');
      return;
    }
    if (!tenantSlug || !token || !moduleId) return;

    setCreating(true);
    try {
      await healthEducationApi.addLesson(moduleId, formData, token, tenantSlug);
      showSuccess('Lesson created', formData.title);
      onClose();
    } catch (error: any) {
      showError('Could not create lesson', error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Create New Lesson</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lesson Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Understanding HIV Transmission"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content Type *</label>
            <select
              value={formData.contentType}
              onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="text">Text (Markdown)</option>
              <option value="video_url">Video URL</option>
              <option value="pdf_url">PDF URL</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 5 })}
              min="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              value={formData.contentBody}
              onChange={(e) => setFormData({ ...formData, contentBody: e.target.value })}
              placeholder={
                formData.contentType === 'text'
                  ? 'Enter lesson content in Markdown format...'
                  : formData.contentType === 'video_url'
                  ? 'Enter video URL (YouTube, Vimeo, etc)...'
                  : 'Enter PDF URL...'
              }
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {formData.contentType === 'text' && (
              <p className="text-xs text-slate-500 mt-1">
                Supports Markdown: **bold**, *italic*, [links](url), # headings, etc.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleCreate}
            disabled={creating || !formData.title.trim() || !formData.contentBody.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {creating && <Loader size={16} className="animate-spin" />}
            Create Lesson
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonEditorModal;
