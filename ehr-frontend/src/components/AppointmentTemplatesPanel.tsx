import React, { useState, useEffect } from 'react';
import { FileText, Clock, Plus, Edit, Trash2, XCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';

interface AppointmentTemplate {
  id: string;
  name: string;
  type: string;
  duration: number;
  instructions?: string;
  color?: string;
  createdAt?: string;
}

interface AppointmentTemplatesPanelProps {
  onSelectTemplate: (template: AppointmentTemplate) => void;
  tenantSlug: string;
}

const AppointmentTemplatesPanel: React.FC<AppointmentTemplatesPanelProps> = ({
  onSelectTemplate,
  tenantSlug,
}) => {
  const { showError, showSuccess } = useNotification();
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AppointmentTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'consultation',
    duration: 30,
    instructions: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getAppointmentTemplates(token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      showError('Error', 'Failed to load appointment templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      if (!formData.name.trim()) {
        showError('Validation Error', 'Template name is required');
        return;
      }

      await ehrApi.createAppointmentTemplate(formData, token, tenantSlug);
      showSuccess('Success', 'Template created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', type: 'consultation', duration: 30, instructions: '', color: '#3B82F6' });
      fetchTemplates();
    } catch (error: any) {
      console.error('Error creating template:', error);
      showError('Error', 'Failed to create template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      await ehrApi.deleteAppointmentTemplate(templateId, token, tenantSlug);
      showSuccess('Success', 'Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Error', 'Failed to delete template');
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      consultation: 'bg-blue-100 text-blue-800 border-blue-300',
      follow_up: 'bg-green-100 text-green-800 border-green-300',
      procedure: 'bg-amber-100 text-amber-800 border-amber-300',
      emergency: 'bg-red-100 text-red-800 border-red-300',
      telehealth: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Click a template to quickly create an appointment with pre-filled details
        </p>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setFormData({ name: '', type: 'consultation', duration: 30, instructions: '', color: '#3B82F6' });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: template.color || '#3B82F6' }}
                ></div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTemplate(template);
                    setFormData({
                      name: template.name,
                      type: template.type,
                      duration: template.duration,
                      instructions: template.instructions || '',
                      color: template.color || '#3B82F6',
                    });
                    setShowCreateModal(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Edit template"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className={`px-2 py-1 rounded text-xs ${getTypeColor(template.type)}`}>
                  {template.type.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{template.duration} min</span>
                </div>
              </div>
              {template.instructions && (
                <p className="text-xs text-gray-500">{template.instructions}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No templates available. Create your first template to get started.</p>
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., General Consultation"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="procedure">Procedure</option>
                    <option value="emergency">Emergency</option>
                    <option value="telehealth">Telehealth</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="15"
                    step="15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Please arrive 10 minutes early"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingTemplate ? 'Update' : 'Create'} Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentTemplatesPanel;

