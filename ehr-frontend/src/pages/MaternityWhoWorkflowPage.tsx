import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Heart, Baby } from 'lucide-react';
import { ehrApi } from '../services/api';
import { MaternityWithSmartForms } from '../components/Maternity/MaternityWithSmartForms';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

const MaternityWhoWorkflowPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('ehr_token') || '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (!token || !tenantSlug) return;
    ehrApi.getPatients(token, tenantSlug).then((resp) => {
      setPatients(resp.data.patients || []);
    }).catch(() => {});
  }, [token, tenantSlug]);

  const filtered = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(`/ehr/${tenantSlug}/nurse`)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-600" />
          <h1 className="text-lg font-bold text-slate-900">WHO Smart Forms — Maternity / PMTCT</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <p className="text-slate-600 mb-6">
          WHO-aligned maternal history, ANC, and PMTCT smart forms.
        </p>

        {selectedPatient ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-xs text-slate-500">Active patient for these forms</p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-sm font-medium text-pink-600 hover:text-pink-800"
              >
                Change patient
              </button>
            </div>
            <MaternityWithSmartForms
              tenantSlug={tenantSlug || ''}
              token={token}
              patientId={selectedPatient.id}
              patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
            />
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient by name…"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            {query.trim().length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {filtered.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">No matching patients</p>
                ) : (
                  filtered.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3"
                    >
                      <Baby className="w-4 h-4 text-pink-500" />
                      <span className="text-sm font-medium text-slate-900">{p.firstName} {p.lastName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {query.trim().length === 0 && (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-500">Search for a patient above to open WHO Smart Forms.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaternityWhoWorkflowPage;
