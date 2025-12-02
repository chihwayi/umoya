import React, { useState, useEffect } from 'react';
import { X, Save, Send, FileText, Building2, User, AlertCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralFormProps {
  patientId: string;
  patientName: string;
  referral?: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReferralForm: React.FC<ReferralFormProps> = ({
  patientId,
  patientName,
  referral,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    referralType: referral?.referral_type || 'specialist',
    specialty: referral?.specialty || '',
    referredToFacilityName: referral?.referred_to_facility_name || '',
    referredToFacilityAddress: referral?.referred_to_facility_address || '',
    referredToFacilityPhone: referral?.referred_to_facility_phone || '',
    referredToFacilityEmail: referral?.referred_to_facility_email || '',
    priority: referral?.priority || 'normal',
    urgency: referral?.urgency || 'routine',
    reason: referral?.reason || '',
    clinicalSummary: referral?.clinical_summary || '',
    relevantHistory: referral?.relevant_history || '',
    currentMedications: referral?.current_medications || '',
    allergies: referral?.allergies || '',
    diagnosticTestsOrdered: referral?.diagnostic_tests_ordered || '',
    requestedServices: referral?.requested_services || '',
    referralDate: referral?.referral_date || new Date().toISOString().split('T')[0],
    requestedAppointmentDate: referral?.requested_appointment_date || '',
  });

  const [facilities, setFacilities] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadFacilities();
    loadTemplates();
  }, []);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralFacilities({}, token, tenantSlug);
      setFacilities(response.data || []);
    } catch (error) {
      console.error('Failed to load facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await ehrApi.getReferralTemplates({}, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;

      setFormData((prev) => ({
        ...prev,
        referralType: template.referral_type,
        specialty: template.specialty || '',
        priority: templateData.priority || prev.priority,
        urgency: templateData.urgency || prev.urgency,
        reason: templateData.reason || prev.reason,
        requestedServices: templateData.requestedServices || prev.requestedServices,
      }));
      setSelectedTemplate(templateId);
    }
  };

  const handleFacilitySelect = (facilityId: string) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (facility) {
      setFormData((prev) => ({
        ...prev,
        referredToFacilityName: facility.facility_name,
        referredToFacilityAddress: facility.address || '',
        referredToFacilityPhone: facility.phone || '',
        referredToFacilityEmail: facility.email || '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent, sendImmediately: boolean = false) => {
    e.preventDefault();

    if (!formData.referredToFacilityName || !formData.reason) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const referralData = {
        ...formData,
        status: sendImmediately ? 'sent' : 'draft',
      };

      if (referral) {
        // Update existing referral
        await ehrApi.updateReferral(referral.id, referralData, token, tenantSlug);
        showSuccess('Success', 'Referral updated successfully');
      } else {
        // Create new referral
        const response = await ehrApi.createReferral(patientId, referralData, token, tenantSlug);

        if (sendImmediately) {
          // Send the referral
          await ehrApi.sendReferral(response.data.id, 'email', token, tenantSlug);
          showSuccess('Success', 'Referral created and sent successfully');
        } else {
          showSuccess('Success', 'Referral saved as draft');
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save referral:', error);
      showError('Error', error.response?.data?.message || 'Failed to save referral');
    } finally {
      setSubmitting(false);
    }
  };

  const referralTypes = [
    { value: 'specialist', label: 'Specialist' },
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'imaging', label: 'Imaging' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'hospitalization', label: 'Hospitalization' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'mental_health', label: 'Mental Health' },
    { value: 'dental', label: 'Dental' },
    { value: 'ophthalmology', label: 'Ophthalmology' },
    { value: 'cardiology', label: 'Cardiology' },
    { value: 'oncology', label: 'Oncology' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="w-6 h-6" />
                {referral ? 'Edit Referral' : 'New Referral'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Template Selection */}
          {!referral && templates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Use a Template (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Referral Type & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Referral Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.referralType}
                onChange={(e) => setFormData({ ...formData, referralType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {referralTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Urgency</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergent">Emergent</option>
              </select>
            </div>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Specialty</label>
            <input
              type="text"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              placeholder="e.g., Cardiology, Orthopedics"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Facility Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800">Referred To</h3>
            </div>

            {facilities.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select from Directory
                </label>
                <select
                  onChange={(e) => handleFacilitySelect(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a facility...</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.facility_name} - {facility.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.referredToFacilityName}
                  onChange={(e) => setFormData({ ...formData, referredToFacilityName: e.target.value })}
                  placeholder="Enter facility name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.referredToFacilityPhone}
                    onChange={(e) => setFormData({ ...formData, referredToFacilityPhone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.referredToFacilityEmail}
                    onChange={(e) => setFormData({ ...formData, referredToFacilityEmail: e.target.value })}
                    placeholder="Email address"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.referredToFacilityAddress}
                  onChange={(e) => setFormData({ ...formData, referredToFacilityAddress: e.target.value })}
                  placeholder="Facility address"
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Reason for Referral */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Describe the reason for this referral..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Clinical Summary */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical Summary</label>
            <textarea
              value={formData.clinicalSummary}
              onChange={(e) => setFormData({ ...formData, clinicalSummary: e.target.value })}
              placeholder="Provide clinical summary and findings..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Relevant History</label>
              <textarea
                value={formData.relevantHistory}
                onChange={(e) => setFormData({ ...formData, relevantHistory: e.target.value })}
                placeholder="Medical history relevant to referral..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
              <textarea
                value={formData.currentMedications}
                onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                placeholder="List current medications..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="Known allergies..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Diagnostic Tests Ordered</label>
              <textarea
                value={formData.diagnosticTestsOrdered}
                onChange={(e) => setFormData({ ...formData, diagnosticTestsOrdered: e.target.value })}
                placeholder="Tests ordered or completed..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Requested Services */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Requested Services</label>
            <textarea
              value={formData.requestedServices}
              onChange={(e) => setFormData({ ...formData, requestedServices: e.target.value })}
              placeholder="What services are you requesting from the referred facility..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Referral Date</label>
              <input
                type="date"
                value={formData.referralDate}
                onChange={(e) => setFormData({ ...formData, referralDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Requested Appointment Date</label>
              <input
                type="date"
                value={formData.requestedAppointmentDate}
                onChange={(e) => setFormData({ ...formData, requestedAppointmentDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save as Draft
                </>
              )}
            </button>
            {!referral && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Save & Send
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralForm;


import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralFormProps {
  patientId: string;
  patientName: string;
  referral?: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReferralForm: React.FC<ReferralFormProps> = ({
  patientId,
  patientName,
  referral,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    referralType: referral?.referral_type || 'specialist',
    specialty: referral?.specialty || '',
    referredToFacilityName: referral?.referred_to_facility_name || '',
    referredToFacilityAddress: referral?.referred_to_facility_address || '',
    referredToFacilityPhone: referral?.referred_to_facility_phone || '',
    referredToFacilityEmail: referral?.referred_to_facility_email || '',
    priority: referral?.priority || 'normal',
    urgency: referral?.urgency || 'routine',
    reason: referral?.reason || '',
    clinicalSummary: referral?.clinical_summary || '',
    relevantHistory: referral?.relevant_history || '',
    currentMedications: referral?.current_medications || '',
    allergies: referral?.allergies || '',
    diagnosticTestsOrdered: referral?.diagnostic_tests_ordered || '',
    requestedServices: referral?.requested_services || '',
    referralDate: referral?.referral_date || new Date().toISOString().split('T')[0],
    requestedAppointmentDate: referral?.requested_appointment_date || '',
  });

  const [facilities, setFacilities] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadFacilities();
    loadTemplates();
  }, []);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralFacilities({}, token, tenantSlug);
      setFacilities(response.data || []);
    } catch (error) {
      console.error('Failed to load facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await ehrApi.getReferralTemplates({}, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;

      setFormData((prev) => ({
        ...prev,
        referralType: template.referral_type,
        specialty: template.specialty || '',
        priority: templateData.priority || prev.priority,
        urgency: templateData.urgency || prev.urgency,
        reason: templateData.reason || prev.reason,
        requestedServices: templateData.requestedServices || prev.requestedServices,
      }));
      setSelectedTemplate(templateId);
    }
  };

  const handleFacilitySelect = (facilityId: string) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (facility) {
      setFormData((prev) => ({
        ...prev,
        referredToFacilityName: facility.facility_name,
        referredToFacilityAddress: facility.address || '',
        referredToFacilityPhone: facility.phone || '',
        referredToFacilityEmail: facility.email || '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent, sendImmediately: boolean = false) => {
    e.preventDefault();

    if (!formData.referredToFacilityName || !formData.reason) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const referralData = {
        ...formData,
        status: sendImmediately ? 'sent' : 'draft',
      };

      if (referral) {
        // Update existing referral
        await ehrApi.updateReferral(referral.id, referralData, token, tenantSlug);
        showSuccess('Success', 'Referral updated successfully');
      } else {
        // Create new referral
        const response = await ehrApi.createReferral(patientId, referralData, token, tenantSlug);

        if (sendImmediately) {
          // Send the referral
          await ehrApi.sendReferral(response.data.id, 'email', token, tenantSlug);
          showSuccess('Success', 'Referral created and sent successfully');
        } else {
          showSuccess('Success', 'Referral saved as draft');
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save referral:', error);
      showError('Error', error.response?.data?.message || 'Failed to save referral');
    } finally {
      setSubmitting(false);
    }
  };

  const referralTypes = [
    { value: 'specialist', label: 'Specialist' },
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'imaging', label: 'Imaging' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'hospitalization', label: 'Hospitalization' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'mental_health', label: 'Mental Health' },
    { value: 'dental', label: 'Dental' },
    { value: 'ophthalmology', label: 'Ophthalmology' },
    { value: 'cardiology', label: 'Cardiology' },
    { value: 'oncology', label: 'Oncology' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="w-6 h-6" />
                {referral ? 'Edit Referral' : 'New Referral'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Template Selection */}
          {!referral && templates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Use a Template (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Referral Type & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Referral Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.referralType}
                onChange={(e) => setFormData({ ...formData, referralType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {referralTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Urgency</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergent">Emergent</option>
              </select>
            </div>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Specialty</label>
            <input
              type="text"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              placeholder="e.g., Cardiology, Orthopedics"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Facility Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800">Referred To</h3>
            </div>

            {facilities.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select from Directory
                </label>
                <select
                  onChange={(e) => handleFacilitySelect(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a facility...</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.facility_name} - {facility.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.referredToFacilityName}
                  onChange={(e) => setFormData({ ...formData, referredToFacilityName: e.target.value })}
                  placeholder="Enter facility name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.referredToFacilityPhone}
                    onChange={(e) => setFormData({ ...formData, referredToFacilityPhone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.referredToFacilityEmail}
                    onChange={(e) => setFormData({ ...formData, referredToFacilityEmail: e.target.value })}
                    placeholder="Email address"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.referredToFacilityAddress}
                  onChange={(e) => setFormData({ ...formData, referredToFacilityAddress: e.target.value })}
                  placeholder="Facility address"
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Reason for Referral */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Describe the reason for this referral..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Clinical Summary */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical Summary</label>
            <textarea
              value={formData.clinicalSummary}
              onChange={(e) => setFormData({ ...formData, clinicalSummary: e.target.value })}
              placeholder="Provide clinical summary and findings..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Relevant History</label>
              <textarea
                value={formData.relevantHistory}
                onChange={(e) => setFormData({ ...formData, relevantHistory: e.target.value })}
                placeholder="Medical history relevant to referral..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
              <textarea
                value={formData.currentMedications}
                onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                placeholder="List current medications..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="Known allergies..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Diagnostic Tests Ordered</label>
              <textarea
                value={formData.diagnosticTestsOrdered}
                onChange={(e) => setFormData({ ...formData, diagnosticTestsOrdered: e.target.value })}
                placeholder="Tests ordered or completed..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Requested Services */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Requested Services</label>
            <textarea
              value={formData.requestedServices}
              onChange={(e) => setFormData({ ...formData, requestedServices: e.target.value })}
              placeholder="What services are you requesting from the referred facility..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Referral Date</label>
              <input
                type="date"
                value={formData.referralDate}
                onChange={(e) => setFormData({ ...formData, referralDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Requested Appointment Date</label>
              <input
                type="date"
                value={formData.requestedAppointmentDate}
                onChange={(e) => setFormData({ ...formData, requestedAppointmentDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save as Draft
                </>
              )}
            </button>
            {!referral && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Save & Send
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralForm;

