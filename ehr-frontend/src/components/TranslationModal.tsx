import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { healthEducationApi } from '../services/api';
import { useParams } from 'react-router-dom';

interface TranslationModalProps {
  lessonId: string;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sn', label: 'Shona' },
  { code: 'nd', label: 'Ndebele' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'sw', label: 'Swahili' },
  { code: 'zu', label: 'Zulu' },
  { code: 'af', label: 'Afrikaans' },
];

const TranslationModal: React.FC<TranslationModalProps> = ({ lessonId, onClose }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [saving, setSaving] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('sn');
  const [formData, setFormData] = useState({
    title: '',
    contentBody: '',
  });

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.contentBody.trim()) {
      showError('Validation', 'Title and content are required.');
      return;
    }
    if (!tenantSlug || !token || !lessonId) return;

    setSaving(true);
    try {
      await healthEducationApi.upsertTranslation(
        lessonId,
        {
          languageCode: selectedLanguage,
          title: formData.title,
          contentBody: formData.contentBody,
        },
        token,
        tenantSlug
      );
      showSuccess('Translation saved', `${LANGUAGES.find(l => l.code === selectedLanguage)?.label} translation added.`);
      setFormData({ title: '', contentBody: '' });
      onClose();
    } catch (error: any) {
      showError('Could not save translation', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Add Translation</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Language *</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lesson Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Translated title..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              value={formData.contentBody}
              onChange={(e) => setFormData({ ...formData, contentBody: e.target.value })}
              placeholder="Translated lesson content..."
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleSave}
            disabled={saving || !formData.title.trim() || !formData.contentBody.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader size={16} className="animate-spin" />}
            Save Translation
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

export default TranslationModal;
