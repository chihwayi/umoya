import React from 'react';
import { useNavigate } from 'react-router-dom';

const TenantDirectory: React.FC = () => {
  const navigate = useNavigate();

  const handleTenantSelect = () => {
    navigate('/ehr/bulawayo-general');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">MediCore EHR</h1>
        <div className="space-y-4">
          <button
            onClick={handleTenantSelect}
            className="w-full p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            Bulawayo General Clinic
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantDirectory;