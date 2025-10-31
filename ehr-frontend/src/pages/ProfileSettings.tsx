import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Key, ArrowLeft, Save } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';

const ProfileSettings: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handlePasswordChange = () => {
    navigate(`/ehr/${tenantSlug}/change-password`);
  };

  if (!user) return null;

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Dashboard</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Profile Settings</h1>
          <p className="text-slate-600">Manage your account information</p>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Profile Information */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800">{user.firstName}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800">{user.lastName}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800">{user.email}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                  user.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                  user.role === 'nurse' ? 'bg-green-100 text-green-800' :
                  user.role === 'receptionist' ? 'bg-orange-100 text-orange-800' :
                  user.role === 'pharmacist' ? 'bg-teal-100 text-teal-800' :
                  user.role === 'lab_tech' || user.role === 'lab_technician' ? 'bg-cyan-100 text-cyan-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {user.specialization && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Specialization</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <span className="text-slate-800">{user.specialization}</span>
              </div>
            </div>
          )}
        </div>

        {/* Security Settings */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Security Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-slate-600" />
                <div>
                  <h3 className="font-medium text-slate-800">Password</h3>
                  <p className="text-sm text-slate-600">Change your account password</p>
                </div>
              </div>
              <button
                onClick={handlePasswordChange}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> To update your personal information (name, email, phone), please contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;