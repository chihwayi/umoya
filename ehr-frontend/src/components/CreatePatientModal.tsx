import React, { useState } from 'react';
import { X, User, Calendar, Phone, Mail, MapPin, Heart, Shield, AlertTriangle, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateForAPI, isValidDate } from '../utils/dateUtils';
import DatePicker from './DatePicker';

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: () => void;
  tenantSlug: string;
}

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

const CreatePatientModal: React.FC<CreatePatientModalProps> = ({ isOpen, onClose, onPatientCreated, tenantSlug }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    nationalId: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    medicalAidProvider: '',
    medicalAidNumber: '',
    bloodType: '',
    allergies: '',
    medicalHistory: '',
    // ── Extended demographics (Sprint 60) ───────────────────────────────
    preferredLanguage: 'en',
    ethnicity: '',
    race: '',
    nationality: '',
    countryOfBirth: '',
    religion: '',
    interpreterRequired: false,
    maritalStatus: '',
    occupation: '',
    employmentStatus: '',
    educationLevel: '',
    disabilityStatus: false,
    disabilityType: '',
    smokingStatus: '',
    packYears: '',
    alcoholUse: '',
    substanceUse: false,
    substanceUseDetails: '',
    pregnancyStatus: '',
    advanceDirectiveOnFile: false,
  });
  const [showExtended, setShowExtended] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const medicalAids = ['CIMAS', 'Premier Service Medical Aid', 'Econet Health', 'First Mutual Health', 'Other'];

  const set = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      if (!isValidDate(formData.dateOfBirth)) {
        showError('Invalid Date', 'Please enter date in dd/mm/yyyy format');
        setLoading(false);
        return;
      }

      const patientData: Record<string, any> = {
        ...formData,
        dateOfBirth: formatDateForAPI(formData.dateOfBirth),
        email: formData.email.trim() === '' ? undefined : formData.email,
        packYears: formData.packYears !== '' ? parseFloat(formData.packYears) : undefined,
        // Strip empty optional strings so API doesn't receive empty values
        ethnicity: formData.ethnicity || undefined,
        race: formData.race || undefined,
        nationality: formData.nationality || undefined,
        countryOfBirth: formData.countryOfBirth || undefined,
        religion: formData.religion || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        occupation: formData.occupation || undefined,
        employmentStatus: formData.employmentStatus || undefined,
        educationLevel: formData.educationLevel || undefined,
        disabilityType: formData.disabilityType || undefined,
        smokingStatus: formData.smokingStatus || undefined,
        alcoholUse: formData.alcoholUse || undefined,
        substanceUseDetails: formData.substanceUseDetails || undefined,
        pregnancyStatus: formData.pregnancyStatus || undefined,
      };

      await ehrApi.createPatient(patientData, token, tenantSlug);
      showSuccess('Patient Created', 'Patient registered successfully');
      onPatientCreated();
      onClose();
      setFormData({
        firstName: '', lastName: '', dateOfBirth: '', gender: 'male',
        nationalId: '', phone: '', email: '', address: '', city: '',
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
        medicalAidProvider: '', medicalAidNumber: '', bloodType: '',
        allergies: '', medicalHistory: '',
        preferredLanguage: 'en', ethnicity: '', race: '', nationality: '',
        countryOfBirth: '', religion: '', interpreterRequired: false,
        maritalStatus: '', occupation: '', employmentStatus: '', educationLevel: '',
        disabilityStatus: false, disabilityType: '', smokingStatus: '', packYears: '',
        alcoholUse: '', substanceUse: false, substanceUseDetails: '',
        pregnancyStatus: '', advanceDirectiveOnFile: false,
      });
      setShowExtended(false);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Register New Patient</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                  <input type="text" required value={formData.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                  <input type="text" required value={formData.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <DatePicker
                    label="Date of Birth (dd/mm/yyyy) *"
                    value={formData.dateOfBirth}
                    onChange={(val) => set('dateOfBirth', val)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender *</label>
                  <select value={formData.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">National ID *</label>
                  <input type="text" required placeholder="63-123456-A-12" value={formData.nationalId} onChange={(e) => set('nationalId', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Blood Type</label>
                  <select value={formData.bloodType} onChange={(e) => set('bloodType', e.target.value)} className={inputCls}>
                    <option value="">Select Blood Type</option>
                    {bloodTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                  <input type="tel" required placeholder="+263771234567" value={formData.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                  <input type="text" required value={formData.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                  <input type="text" required value={formData.city} onChange={(e) => set('city', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-amber-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Emergency Contact
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name *</label>
                  <input type="text" required value={formData.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone *</label>
                  <input type="tel" required value={formData.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Relationship *</label>
                  <input type="text" required placeholder="Spouse, Parent, Sibling..." value={formData.emergencyContactRelationship} onChange={(e) => set('emergencyContactRelationship', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Medical Aid */}
            <div className="bg-green-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Medical Aid Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Medical Aid Provider</label>
                  <select value={formData.medicalAidProvider} onChange={(e) => set('medicalAidProvider', e.target.value)} className={inputCls}>
                    <option value="">Select Medical Aid</option>
                    {medicalAids.map(aid => (
                      <option key={aid} value={aid}>{aid}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Member Number</label>
                  <input type="text" value={formData.medicalAidNumber} onChange={(e) => set('medicalAidNumber', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="bg-purple-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Medical Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Known Allergies</label>
                  <textarea rows={2} placeholder="List any known allergies..." value={formData.allergies} onChange={(e) => set('allergies', e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Medical History</label>
                  <textarea rows={3} placeholder="Previous medical conditions, surgeries, etc..." value={formData.medicalHistory} onChange={(e) => set('medicalHistory', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Extended Demographics & Clinical Context (Sprint 60) */}
            <div className="border border-indigo-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExtended(!showExtended)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <span className="font-semibold text-indigo-800 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Extended Demographics &amp; Clinical Context
                  <span className="text-xs font-normal text-indigo-500 ml-1">(AI Risk Stratification)</span>
                </span>
                {showExtended ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
              </button>

              {showExtended && (
                <div className="p-4 space-y-5">
                  {/* Language & Culture */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Language &amp; Culture</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Language</label>
                        <select value={formData.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)} className={inputCls}>
                          <option value="en">English</option>
                          <option value="sn">Shona</option>
                          <option value="nd">Ndebele</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                        <input type="text" value={formData.nationality} onChange={(e) => set('nationality', e.target.value)} className={inputCls} placeholder="e.g. Zimbabwean" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Country of Birth</label>
                        <input type="text" value={formData.countryOfBirth} onChange={(e) => set('countryOfBirth', e.target.value)} className={inputCls} placeholder="e.g. Zimbabwe" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ethnicity</label>
                        <input type="text" value={formData.ethnicity} onChange={(e) => set('ethnicity', e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Religion</label>
                        <input type="text" value={formData.religion} onChange={(e) => set('religion', e.target.value)} className={inputCls} />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <input type="checkbox" id="interpreterRequired" checked={formData.interpreterRequired} onChange={(e) => set('interpreterRequired', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                        <label htmlFor="interpreterRequired" className="text-sm font-medium text-slate-700">Interpreter Required</label>
                      </div>
                    </div>
                  </div>

                  {/* Socioeconomic */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Socioeconomic Context</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Marital Status</label>
                        <select value={formData.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)} className={inputCls}>
                          <option value="">Select</option>
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                          <option value="separated">Separated</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                        <input type="text" value={formData.occupation} onChange={(e) => set('occupation', e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
                        <select value={formData.employmentStatus} onChange={(e) => set('employmentStatus', e.target.value)} className={inputCls}>
                          <option value="">Select</option>
                          <option value="employed">Employed</option>
                          <option value="self_employed">Self-employed</option>
                          <option value="unemployed">Unemployed</option>
                          <option value="student">Student</option>
                          <option value="retired">Retired</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Education Level</label>
                        <select value={formData.educationLevel} onChange={(e) => set('educationLevel', e.target.value)} className={inputCls}>
                          <option value="">Select</option>
                          <option value="none">None</option>
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                          <option value="tertiary">Tertiary</option>
                          <option value="postgraduate">Postgraduate</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Disability */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Disability</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="disabilityStatus" checked={formData.disabilityStatus} onChange={(e) => set('disabilityStatus', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                        <label htmlFor="disabilityStatus" className="text-sm font-medium text-slate-700">Has Disability</label>
                      </div>
                      {formData.disabilityStatus && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Disability Type</label>
                          <input type="text" value={formData.disabilityType} onChange={(e) => set('disabilityType', e.target.value)} className={inputCls} placeholder="Describe disability" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Substance Use */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Substance Use (AI Risk Model)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Smoking Status</label>
                        <select value={formData.smokingStatus} onChange={(e) => set('smokingStatus', e.target.value)} className={inputCls}>
                          <option value="">Select</option>
                          <option value="never">Never</option>
                          <option value="former">Former</option>
                          <option value="current">Current</option>
                        </select>
                      </div>
                      {formData.smokingStatus === 'current' || formData.smokingStatus === 'former' ? (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Pack Years</label>
                          <input type="number" min="0" step="0.5" value={formData.packYears} onChange={(e) => set('packYears', e.target.value)} className={inputCls} placeholder="0.0" />
                        </div>
                      ) : null}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alcohol Use</label>
                        <select value={formData.alcoholUse} onChange={(e) => set('alcoholUse', e.target.value)} className={inputCls}>
                          <option value="">Select</option>
                          <option value="none">None</option>
                          <option value="occasional">Occasional</option>
                          <option value="moderate">Moderate</option>
                          <option value="heavy">Heavy</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="substanceUse" checked={formData.substanceUse} onChange={(e) => set('substanceUse', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                        <label htmlFor="substanceUse" className="text-sm font-medium text-slate-700">Other Substance Use</label>
                      </div>
                      {formData.substanceUse && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Substance Details</label>
                          <input type="text" value={formData.substanceUseDetails} onChange={(e) => set('substanceUseDetails', e.target.value)} className={inputCls} placeholder="Describe substances used" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reproductive Health */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Reproductive Health</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pregnancy Status</label>
                        <select value={formData.pregnancyStatus} onChange={(e) => set('pregnancyStatus', e.target.value)} className={inputCls}>
                          <option value="">Not applicable / Unknown</option>
                          <option value="not_pregnant">Not Pregnant</option>
                          <option value="pregnant">Pregnant</option>
                          <option value="postpartum">Postpartum</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Advance Care Planning */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Advance Care Planning</h4>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="advanceDirective" checked={formData.advanceDirectiveOnFile} onChange={(e) => set('advanceDirectiveOnFile', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                      <label htmlFor="advanceDirective" className="text-sm font-medium text-slate-700">Advance Directive On File</label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePatientModal;
