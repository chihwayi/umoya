import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import {
  Syringe, Download, Calendar, Shield,
  ArrowLeft, Clock,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { format } from 'date-fns';

interface Immunization {
  id: string;
  immunization_number: string;
  vaccine_code: string;
  vaccine_name: string;
  cvx_code?: string;
  manufacturer?: string;
  lot_number?: string;
  administration_date: string;
  dose_number?: number;
  route?: string;
  site?: string;
  administered_by_name?: string;
  notes?: string;
}

interface ForecastVaccine {
  vaccine_name: string;
  vaccine_code: string;
  due_date: string;
  status: 'overdue' | 'due_soon' | 'upcoming';
  notes?: string;
}

const ImmunizationsPage: React.FC = () => {
  const { patient, token } = usePatientAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [forecast, setForecast] = useState<ForecastVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [_loadingForecast, setLoadingForecast] = useState(false);

  useEffect(() => {
    loadImmunizations();
    loadForecast();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadImmunizations = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getPatientImmunizations(token!, tenantSlug!);
      setImmunizations(data);
    } catch (error) {
      console.error('Failed to load immunizations:', error);
      showError('Error', 'Failed to load immunization history');
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      setLoadingForecast(true);
      const data = await patientPortalApi.getImmunizationForecast(token!, tenantSlug!);
      setForecast(data.forecast || []);
    } catch (error) {
      console.error('Failed to load forecast:', error);
    } finally {
      setLoadingForecast(false);
    }
  };

  const handleDownloadRecord = async () => {
    try {
      const blob = await patientPortalApi.downloadImmunizationRecord('pdf', token!, tenantSlug!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immunization-record-${patient?.patientNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Success', 'Immunization record downloaded');
    } catch (error) {
      showError('Error', 'Failed to download record');
    }
  };

  const getForecastBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold animate-pulse">
          OVERDUE
        </span>;
      case 'due_soon':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
          DUE SOON
        </span>;
      case 'upcoming':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
          UPCOMING
        </span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/${tenantSlug}/dashboard`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Syringe className="w-6 h-6 text-emerald-600" />
                  My Immunizations
                </h1>
                <p className="text-sm text-gray-600">Your complete vaccination history and schedule</p>
              </div>
            </div>
            <button
              onClick={handleDownloadRecord}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Record
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upcoming Vaccines */}
        {forecast.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Upcoming Vaccines
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forecast.map((vaccine, index) => (
                <div key={index} className="bg-white rounded-2xl border-2 border-amber-200 shadow-md p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900">{vaccine.vaccine_name}</h3>
                    {getForecastBadge(vaccine.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {format(new Date(vaccine.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                    {vaccine.notes && <p className="text-xs text-gray-500 mt-2">{vaccine.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Immunization History */}
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          Vaccination History
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your immunization history...</p>
            </div>
          </div>
        ) : immunizations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Syringe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Immunizations Recorded</h3>
            <p className="text-gray-600">You don't have any immunization records on file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {immunizations.map((imm) => (
              <div key={imm.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                        <Syringe className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{imm.vaccine_name}</h3>
                        <p className="text-xs text-gray-600">Code: {imm.vaccine_code}{imm.cvx_code ? ` (CVX: ${imm.cvx_code})` : ''}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-4">
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Date Given</p>
                        <p className="font-semibold text-gray-900">{format(new Date(imm.administration_date), 'MMM dd, yyyy')}</p>
                      </div>
                      {imm.dose_number && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Dose #</p>
                          <p className="font-semibold text-gray-900">Dose {imm.dose_number}</p>
                        </div>
                      )}
                      {imm.route && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Route</p>
                          <p className="font-semibold text-gray-900">{imm.route}</p>
                        </div>
                      )}
                      {imm.site && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Site</p>
                          <p className="font-semibold text-gray-900">{imm.site}</p>
                        </div>
                      )}
                    </div>

                    {(imm.manufacturer || imm.lot_number || imm.administered_by_name) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {imm.manufacturer && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Manufacturer</p>
                            <p className="text-gray-700">{imm.manufacturer}</p>
                          </div>
                        )}
                        {imm.lot_number && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Lot Number</p>
                            <p className="text-gray-700">{imm.lot_number}</p>
                          </div>
                        )}
                        {imm.administered_by_name && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Administered By</p>
                            <p className="text-gray-700">{imm.administered_by_name}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {imm.notes && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-900">{imm.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    <span className="inline-flex px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                      #{imm.immunization_number}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ImmunizationsPage;

