import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const EHRDashboard: React.FC = () => {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [clinicName, setClinicName] = useState('');

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('ehrToken');
    const tenantId = localStorage.getItem('tenantId');
    const storedClinicName = localStorage.getItem('clinicName');
    
    if (!token || !tenantId) {
      navigate(`/ehr/${subdomain}`);
      return;
    }

    setClinicName(storedClinicName || 'Clinic');
    
    // Get user info from token (simplified - in production, decode JWT or call API)
    const userEmail = localStorage.getItem('userEmail') || 'user@clinic.com';
    const userRole = localStorage.getItem('userRole') || 'admin';
    const userName = localStorage.getItem('userName') || 'User';
    
    setUser({
      id: '1',
      email: userEmail,
      firstName: userName.split(' ')[0] || 'User',
      lastName: userName.split(' ')[1] || '',
      role: userRole
    });
  }, [subdomain, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('ehrToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('clinicName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    navigate(`/ehr/${subdomain}`);
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      doctor: 'bg-blue-100 text-blue-800',
      nurse: 'bg-green-100 text-green-800',
      receptionist: 'bg-yellow-100 text-yellow-800',
      pharmacist: 'bg-pink-100 text-pink-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role: string) => {
    const icons = {
      admin: '👨‍💼',
      doctor: '👨‍⚕️',
      nurse: '👩‍⚕️',
      receptionist: '👩‍💻',
      pharmacist: '💊'
    };
    return icons[role as keyof typeof icons] || '👤';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {clinicName.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{clinicName}</h1>
                <p className="text-sm text-gray-500">Electronic Health Records</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getRoleIcon(user.role)}</span>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {user.firstName} {user.lastName}
                  </p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to MediCore EHR</h2>
          <p className="text-gray-600">
            Hello {user.firstName}! You're logged in as {user.role} at {clinicName}.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-800">1,234</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <p className="text-2xl font-bold text-gray-800">23</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🧪</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Lab Results</p>
                <p className="text-2xl font-bold text-gray-800">8</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💊</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Prescriptions</p>
                <p className="text-2xl font-bold text-gray-800">156</p>
              </div>
            </div>
          </div>
        </div>

        {/* Role-based Menu */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Common actions for all roles */}
            <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-center">
              <div className="text-2xl mb-2">👥</div>
              <p className="text-sm font-medium text-gray-700">View Patients</p>
            </button>

            <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-center">
              <div className="text-2xl mb-2">📅</div>
              <p className="text-sm font-medium text-gray-700">Appointments</p>
            </button>

            {/* Doctor/Nurse specific */}
            {(user.role === 'doctor' || user.role === 'nurse') && (
              <>
                <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-center">
                  <div className="text-2xl mb-2">📋</div>
                  <p className="text-sm font-medium text-gray-700">Medical Records</p>
                </button>

                <button className="p-4 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors text-center">
                  <div className="text-2xl mb-2">💊</div>
                  <p className="text-sm font-medium text-gray-700">Prescriptions</p>
                </button>
              </>
            )}

            {/* Doctor specific */}
            {user.role === 'doctor' && (
              <button className="p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors text-center">
                <div className="text-2xl mb-2">🧪</div>
                <p className="text-sm font-medium text-gray-700">Lab Orders</p>
              </button>
            )}

            {/* Admin/Receptionist specific */}
            {(user.role === 'admin' || user.role === 'receptionist') && (
              <button className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-center">
                <div className="text-2xl mb-2">💰</div>
                <p className="text-sm font-medium text-gray-700">Billing</p>
              </button>
            )}

            {/* Pharmacist specific */}
            {user.role === 'pharmacist' && (
              <button className="p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-center">
                <div className="text-2xl mb-2">🏪</div>
                <p className="text-sm font-medium text-gray-700">Pharmacy</p>
              </button>
            )}

            {/* Admin specific */}
            {user.role === 'admin' && (
              <>
                <button className="p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <p className="text-sm font-medium text-gray-700">Reports</p>
                </button>

                <button className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-center">
                  <div className="text-2xl mb-2">⚙️</div>
                  <p className="text-sm font-medium text-gray-700">Settings</p>
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};