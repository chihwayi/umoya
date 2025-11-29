import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { Link, Shield, Calendar, Hash, Phone, User } from 'lucide-react';

const LinkAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { linkAccount, patient } = usePatientAuth();
  const [formData, setFormData] = useState({
    patientNumber: '',
    dateOfBirth: '',
    nationalId: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantSlug] = useState(localStorage.getItem('patient_tenant') || 'bulawayo-general');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.patientNumber || !formData.dateOfBirth) {
      setError('Patient number and date of birth are required');
      return;
    }

    setLoading(true);

    try {
      await linkAccount(
        {
          patientNumber: formData.patientNumber,
          dateOfBirth: formData.dateOfBirth,
          nationalId: formData.nationalId || undefined,
          phone: formData.phone || undefined,
        },
        tenantSlug,
      );

      // Redirect to dashboard after successful linking
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Account linking failed. Please verify your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Link Your Account</h1>
            <p className="text-gray-600">
              Verify your identity to link your portal account to your patient record
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">Security Notice</p>
                <p className="text-xs text-blue-700">
                  We need to verify your identity before granting access to your medical records.
                  This information must match what we have on file.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Number (MRN) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  required
                  value={formData.patientNumber}
                  onChange={(e) => setFormData({ ...formData, patientNumber: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your patient number"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Found on your appointment card or medical records
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                National ID (Optional)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="For additional verification"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Providing this will make verification faster
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="+263 77 123 4567"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Link Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Having trouble?{' '}
              <a href="mailto:support@medicore.com" className="text-indigo-600 font-semibold hover:underline">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkAccountPage;

