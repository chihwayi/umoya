import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type Status = 'draft' | 'submitted' | 'pending' | 'approved' | 'denied' | 'expired' | 'appeal';

const STATUSES: Status[] = ['draft', 'submitted', 'pending', 'approved', 'denied', 'appeal', 'expired'];

const PriorAuthorizationDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const headers = useMemo(
    () => ({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } as any),
    [tenantSlug, token],
  );

  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<Status>('draft');
  const [items, setItems] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: '',
    payerName: '',
    authorizationType: 'procedure',
    serviceDescription: '',
    cptCode: '',
    icd10Code: '',
    notes: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      const res = await ehrAxios.get('/prior-authorizations', {
        headers,
        params: { status: activeStatus },
      });
      setItems(res.data || []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load prior authorizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeStatus, tenantSlug]);

  const create = async () => {
    if (!createForm.patientId.trim() || !createForm.serviceDescription.trim()) {
      showError('Missing fields', 'patientId and serviceDescription are required.');
      return;
    }
    try {
      await ehrAxios.post('/prior-authorizations', createForm, { headers });
      showSuccess('Created', 'Prior authorization draft created');
      setShowCreate(false);
      setCreateForm({
        patientId: '',
        payerName: '',
        authorizationType: 'procedure',
        serviceDescription: '',
        cptCode: '',
        icd10Code: '',
        notes: '',
      });
      setActiveStatus('draft');
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create prior authorization');
    }
  };

  const setStatus = async (id: string, status: Status) => {
    try {
      await ehrAxios.post(`/prior-authorizations/${id}/status`, { status }, { headers });
      showSuccess('Updated', `Status set to ${status}`);
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to update status');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  navigate(
                    `/ehr/${tenantSlug}/${currentUser?.role === 'doctor' ? 'doctor' : currentUser?.role === 'nurse' ? 'nurse' : 'dashboard'}`,
                  )
                }
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <FileText className="w-8 h-8" />
                  Prior Authorization
                </h1>
                <p className="text-indigo-100 mt-1">Create requests, track status, capture decisions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowCreate((s) => !s)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeStatus === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Create prior auth (draft)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Patient ID *</label>
                <input
                  value={createForm.patientId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, patientId: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Payer name</label>
                <input
                  value={createForm.payerName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, payerName: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Insurer / medical aid"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select
                  value={createForm.authorizationType}
                  onChange={(e) => setCreateForm((p) => ({ ...p, authorizationType: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="medication">medication</option>
                  <option value="procedure">procedure</option>
                  <option value="imaging">imaging</option>
                  <option value="referral">referral</option>
                  <option value="dme">dme</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">CPT</label>
                <input
                  value={createForm.cptCode}
                  onChange={(e) => setCreateForm((p) => ({ ...p, cptCode: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">ICD-10</label>
                <input
                  value={createForm.icd10Code}
                  onChange={(e) => setCreateForm((p) => ({ ...p, icd10Code: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Service description *</label>
                <textarea
                  value={createForm.serviceDescription}
                  onChange={(e) => setCreateForm((p) => ({ ...p, serviceDescription: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={create}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="text-slate-600">Loading…</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-600">
            No prior authorizations in <span className="font-semibold">{activeStatus}</span>.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((pa) => (
              <div key={pa.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {pa.authorizationType || 'prior auth'} · {pa.payerName || 'payer'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{pa.serviceDescription}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Patient: {pa.patientId} · Status: {pa.status}
                      {pa.cptCode ? ` · CPT: ${pa.cptCode}` : ''}
                      {pa.icd10Code ? ` · ICD-10: ${pa.icd10Code}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {pa.status === 'draft' && (
                      <button
                        onClick={() => setStatus(pa.id, 'submitted')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold"
                      >
                        Submit
                      </button>
                    )}
                    {(pa.status === 'submitted' || pa.status === 'draft') && (
                      <button
                        onClick={() => setStatus(pa.id, 'pending')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold"
                      >
                        Mark pending
                      </button>
                    )}
                    {pa.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setStatus(pa.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setStatus(pa.id, 'denied')}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-semibold"
                        >
                          Deny
                        </button>
                      </>
                    )}
                    {pa.status === 'denied' && (
                      <button
                        onClick={() => setStatus(pa.id, 'appeal')}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-semibold"
                      >
                        Appeal
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(pa.id, 'expired')}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 text-sm font-semibold"
                    >
                      Expire
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriorAuthorizationDashboard;

