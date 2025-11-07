import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Baby, LogOut, ArrowLeft } from 'lucide-react';
import MaternityDoctorView from '../components/MaternityDoctorView';

const MaternityDoctorDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const handleBack = () => {
    navigate(`/ehr/${tenantSlug}/doctor`);
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/ehr/${tenantSlug}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-3 bg-white/20 rounded-xl">
                <Baby className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Maternity & Obstetrics</h1>
                <p className="text-pink-100 mt-1">High-Risk Cases & Referrals</p>
              </div>
            </div>

            {/* User Menu */}
            {currentUser && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold">{currentUser.firstName} {currentUser.lastName}</p>
                  <p className="text-sm text-pink-200">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MaternityDoctorView
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      </div>
    </div>
  );
};

export default MaternityDoctorDashboard;

