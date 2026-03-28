import React, { useState, useEffect } from 'react';
import { X, Send, User, Users, AlertCircle, Paperclip, FileText } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface MessageComposerProps {
  onClose: () => void;
  onSent: () => void;
  token: string;
  tenantSlug: string;
  replyTo?: any;
  patientId?: string;
  appointmentId?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onClose,
  onSent,
  token,
  tenantSlug,
  replyTo,
  patientId,
  appointmentId,
}) => {
  const { showSuccess, showError } = useNotification();
  const [formData, setFormData] = useState({
    recipient_id: '',
    recipient_role: '',
    recipient_team: '',
    subject: replyTo ? `Re: ${replyTo.subject}` : '',
    message_text: '',
    message_type: 'message',
    priority: 'normal',
    patient_id: patientId || '',
    appointment_id: appointmentId || '',
    requires_response: false,
  });
  const [recipientType, setRecipientType] = useState<'user' | 'role' | 'team'>('user');
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadUsers();
    loadTemplates();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await ehrApi.getUsers(token, tenantSlug);
      setUsers(response.data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await ehrApi.getMessageTemplates(null, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      const variables = {
        patient_name: 'Patient Name', // TODO: Get from context
        doctor_name: 'Dr. Name', // TODO: Get from context
      };
      const response = await ehrApi.applyMessageTemplate(templateId, variables, token, tenantSlug);
      setFormData({
        ...formData,
        subject: response.data.subject,
        message_text: response.data.message,
      });
      setShowTemplates(false);
      showSuccess('Template Applied', 'Message template has been applied');
    } catch (error: any) {
      showError('Failed to apply template', error.message);
    }
  };

  const handleSend = async () => {
    if (!formData.subject.trim() || !formData.message_text.trim()) {
      showError('Validation Error', 'Subject and message are required');
      return;
    }

    if (recipientType === 'user' && !formData.recipient_id) {
      showError('Validation Error', 'Please select a recipient');
      return;
    }

    if (recipientType === 'role' && !formData.recipient_role) {
      showError('Validation Error', 'Please select a role');
      return;
    }

    if (recipientType === 'team' && !formData.recipient_team) {
      showError('Validation Error', 'Please enter a team name');
      return;
    }

    try {
      setSending(true);
      const messageData = {
        ...formData,
        recipient_id: recipientType === 'user' ? formData.recipient_id : null,
        recipient_role: recipientType === 'role' ? formData.recipient_role : null,
        recipient_team: recipientType === 'team' ? formData.recipient_team : null,
      };

      await ehrApi.sendMessage(messageData, token, tenantSlug);
      showSuccess('Message Sent', 'Your message has been sent successfully');
      onSent();
      onClose();
    } catch (error: any) {
      showError('Failed to send message', error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-200/60 bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
          <h2 className="text-2xl font-bold">New Message</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-white/20"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 bg-white/75">
          {/* Recipient Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Send To
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="user"
                  checked={recipientType === 'user'}
                  onChange={(e) => setRecipientType(e.target.value as 'user')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <User className="w-4 h-4" />
                <span className="text-sm text-slate-700">Specific User</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="role"
                  checked={recipientType === 'role'}
                  onChange={(e) => setRecipientType(e.target.value as 'role')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm text-slate-700">Role</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="team"
                  checked={recipientType === 'team'}
                  onChange={(e) => setRecipientType(e.target.value as 'team')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm text-slate-700">Team</span>
              </label>
            </div>

            {recipientType === 'user' && (
              <select
                value={formData.recipient_id}
                onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.role})
                  </option>
                ))}
              </select>
            )}

            {recipientType === 'role' && (
              <select
                value={formData.recipient_role}
                onChange={(e) => setFormData({ ...formData, recipient_role: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a role...</option>
                <option value="doctor">Doctors</option>
                <option value="nurse">Nurses</option>
                <option value="lab_technician">Lab Technicians</option>
                <option value="pharmacist">Pharmacists</option>
                <option value="radiologist">Radiologists</option>
                <option value="admin">Administrators</option>
              </select>
            )}

            {recipientType === 'team' && (
              <input
                type="text"
                value={formData.recipient_team}
                onChange={(e) => setFormData({ ...formData, recipient_team: e.target.value })}
                placeholder="Enter team name..."
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter subject..."
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Message Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type
              </label>
              <select
                value={formData.message_type}
                onChange={(e) => setFormData({ ...formData, message_type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="message">Message</option>
                <option value="task">Task</option>
                <option value="alert">Alert</option>
                <option value="consultation_request">Consultation Request</option>
                <option value="referral_request">Referral Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Templates */}
          <div>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              <FileText className="w-4 h-4" />
              {showTemplates ? 'Hide Templates' : 'Use Template'}
            </button>
            {showTemplates && templates.length > 0 && (
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full rounded bg-white px-3 py-2 text-left transition-colors hover:bg-blue-50"
                  >
                    <div className="text-sm font-medium text-slate-900">{template.name}</div>
                    <div className="text-xs text-slate-500">{template.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={formData.message_text}
              onChange={(e) => setFormData({ ...formData, message_text: e.target.value })}
              placeholder="Type your message..."
              rows={8}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Requires Response */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_response}
                onChange={(e) => setFormData({ ...formData, requires_response: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Requires response</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white/85 p-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-2 text-white hover:from-blue-700 hover:to-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};
