import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, LogOut, User } from 'lucide-react';
import RadiologistWorklist from '../components/RadiologistWorklist';

const RadiologistDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = React.useState<any>(null);

  React.useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/${tenantSlug}/login`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Radiology & Imaging</h1>
                <p className="text-purple-100 mt-1">Radiologist Worklist & Reporting</p>
              </div>
            </div>

            {/* User Menu */}
            {currentUser && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold">{currentUser.firstName} {currentUser.lastName}</p>
                  <p className="text-sm text-purple-200">{currentUser.role}</p>
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
        <RadiologistWorklist
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          userId={currentUser?.id}
        />
      </div>
    </div>
  );
};

export default RadiologistDashboard;

