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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">New Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Recipient Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Send To
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="user"
                  checked={recipientType === 'user'}
                  onChange={(e) => setRecipientType(e.target.value as 'user')}
                  className="text-blue-600"
                />
                <User className="w-4 h-4" />
                <span className="text-sm">Specific User</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="role"
                  checked={recipientType === 'role'}
                  onChange={(e) => setRecipientType(e.target.value as 'role')}
                  className="text-blue-600"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm">Role</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="team"
                  checked={recipientType === 'team'}
                  onChange={(e) => setRecipientType(e.target.value as 'team')}
                  className="text-blue-600"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm">Team</span>
              </label>
            </div>

            {recipientType === 'user' && (
              <select
                value={formData.recipient_id}
                onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter subject..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Message Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={formData.message_type}
                onChange={(e) => setFormData({ ...formData, message_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="message">Message</option>
                <option value="task">Task</option>
                <option value="alert">Alert</option>
                <option value="consultation_request">Consultation Request</option>
                <option value="referral_request">Referral Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <FileText className="w-4 h-4" />
              {showTemplates ? 'Hide Templates' : 'Use Template'}
            </button>
            {showTemplates && templates.length > 0 && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2 max-h-40 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full text-left px-3 py-2 bg-white rounded hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-sm text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500">{template.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={formData.message_text}
              onChange={(e) => setFormData({ ...formData, message_text: e.target.value })}
              placeholder="Type your message..."
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Requires Response */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_response}
                onChange={(e) => setFormData({ ...formData, requires_response: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Requires response</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};


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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">New Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Recipient Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Send To
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="user"
                  checked={recipientType === 'user'}
                  onChange={(e) => setRecipientType(e.target.value as 'user')}
                  className="text-blue-600"
                />
                <User className="w-4 h-4" />
                <span className="text-sm">Specific User</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="role"
                  checked={recipientType === 'role'}
                  onChange={(e) => setRecipientType(e.target.value as 'role')}
                  className="text-blue-600"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm">Role</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="team"
                  checked={recipientType === 'team'}
                  onChange={(e) => setRecipientType(e.target.value as 'team')}
                  className="text-blue-600"
                />
                <Users className="w-4 h-4" />
                <span className="text-sm">Team</span>
              </label>
            </div>

            {recipientType === 'user' && (
              <select
                value={formData.recipient_id}
                onChange={(e) => setFormData({ ...formData, recipient_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter subject..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Message Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={formData.message_type}
                onChange={(e) => setFormData({ ...formData, message_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="message">Message</option>
                <option value="task">Task</option>
                <option value="alert">Alert</option>
                <option value="consultation_request">Consultation Request</option>
                <option value="referral_request">Referral Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <FileText className="w-4 h-4" />
              {showTemplates ? 'Hide Templates' : 'Use Template'}
            </button>
            {showTemplates && templates.length > 0 && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2 max-h-40 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full text-left px-3 py-2 bg-white rounded hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-sm text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500">{template.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={formData.message_text}
              onChange={(e) => setFormData({ ...formData, message_text: e.target.value })}
              placeholder="Type your message..."
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Requires Response */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_response}
                onChange={(e) => setFormData({ ...formData, requires_response: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Requires response</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

