import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  FileText,
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

type TabKey = 'feeSchedules' | 'superbills' | 'verifications';

const PracticeManagementDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [activeTab, setActiveTab] = useState<TabKey>('feeSchedules');
  const [loading, setLoading] = useState(true);

  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [superbills, setSuperbills] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);

  const [newFeeScheduleName, setNewFeeScheduleName] = useState('');
  const [newSuperbillName, setNewSuperbillName] = useState('');

  const headers = { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } as any;

  const loadAll = async () => {
    try {
      setLoading(true);
      const [fsRes, sbRes, ivRes] = await Promise.all([
        ehrAxios.get('/practice-management/fee-schedules', { headers }),
        ehrAxios.get('/practice-management/superbill-templates', { headers }),
        ehrAxios.get('/practice-management/insurance-verifications', { headers }),
      ]);
      setFeeSchedules(fsRes.data || []);
      setSuperbills(sbRes.data || []);
      setVerifications(ivRes.data || []);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load practice management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [tenantSlug]);

  const createFeeSchedule = async () => {
    if (!newFeeScheduleName.trim()) return;
    try {
      await ehrAxios.post(
        '/practice-management/fee-schedules',
        {
          name: newFeeScheduleName.trim(),
          payerType: 'self_pay',
          effectiveDate: new Date().toISOString().slice(0, 10),
        },
        { headers },
      );
      showSuccess('Created', 'Fee schedule created');
      setNewFeeScheduleName('');
      loadAll();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create fee schedule');
    }
  };

  const deleteFeeSchedule = async (id: string) => {
    try {
      await ehrAxios.delete(`/practice-management/fee-schedules/${id}`, { headers });
      showSuccess('Deleted', 'Fee schedule deleted');
      loadAll();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to delete fee schedule');
    }
  };

  const createSuperbill = async () => {
    if (!newSuperbillName.trim()) return;
    try {
      await ehrAxios.post(
        '/practice-management/superbill-templates',
        { name: newSuperbillName.trim(), sections: [] },
        { headers },
      );
      showSuccess('Created', 'Superbill template created');
      setNewSuperbillName('');
      loadAll();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create superbill template');
    }
  };

  const deleteSuperbill = async (id: string) => {
    try {
      await ehrAxios.delete(`/practice-management/superbill-templates/${id}`, { headers });
      showSuccess('Deleted', 'Superbill template deleted');
      loadAll();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to delete superbill template');
    }
  };

  const markVerification = async (id: string, status: 'verified' | 'denied' | 'expired' | 'not_found') => {
    try {
      await ehrAxios.post(`/practice-management/insurance-verifications/${id}/mark`, { status }, { headers });
      showSuccess('Updated', `Marked as ${status}`);
      loadAll();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to update verification');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading practice management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg">
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
                  <Building2 className="w-8 h-8" />
                  Practice Management
                </h1>
                <p className="text-emerald-100 mt-1">Fee schedules, superbills, insurance verification</p>
              </div>
            </div>
            <button
              onClick={loadAll}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="flex items-center gap-2 mb-6 bg-white/80 backdrop-blur-sm rounded-xl p-2 border border-slate-200">
          <button
            onClick={() => setActiveTab('feeSchedules')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'feeSchedules'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Fee schedules
          </button>
          <button
            onClick={() => setActiveTab('superbills')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'superbills'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Superbills
          </button>
          <button
            onClick={() => setActiveTab('verifications')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'verifications'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Insurance verification
          </button>
        </div>

        {activeTab === 'feeSchedules' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Fee schedules</h2>
              <div className="flex items-center gap-2">
                <input
                  value={newFeeScheduleName}
                  onChange={(e) => setNewFeeScheduleName(e.target.value)}
                  placeholder="New fee schedule name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64"
                />
                <button
                  onClick={createFeeSchedule}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>
            <div className="p-5">
              {feeSchedules.length === 0 ? (
                <p className="text-slate-500 text-sm">No fee schedules yet.</p>
              ) : (
                <ul className="space-y-3">
                  {feeSchedules.map((fs) => (
                    <li
                      key={fs.id}
                      className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{fs.name}</p>
                        <p className="text-sm text-slate-500">
                          {fs.payerType || 'payer'} {fs.payerName ? `· ${fs.payerName}` : ''} · Effective{' '}
                          {fs.effectiveDate ? new Date(fs.effectiveDate).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteFeeSchedule(fs.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'superbills' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Superbill templates</h2>
              <div className="flex items-center gap-2">
                <input
                  value={newSuperbillName}
                  onChange={(e) => setNewSuperbillName(e.target.value)}
                  placeholder="New superbill name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64"
                />
                <button
                  onClick={createSuperbill}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>
            <div className="p-5">
              {superbills.length === 0 ? (
                <p className="text-slate-500 text-sm">No superbill templates yet.</p>
              ) : (
                <ul className="space-y-3">
                  {superbills.map((sb) => (
                    <li
                      key={sb.id}
                      className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">{sb.name}</p>
                          <p className="text-sm text-slate-500">
                            {sb.specialty ? `${sb.specialty} · ` : ''}Active: {String(sb.isActive)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSuperbill(sb.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Insurance verifications</h2>
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Track verification workflow per patient/appointment
              </div>
            </div>
            <div className="p-5">
              {verifications.length === 0 ? (
                <p className="text-slate-500 text-sm">No insurance verifications yet.</p>
              ) : (
                <ul className="space-y-3">
                  {verifications.map((iv) => (
                    <li
                      key={iv.id}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{iv.payerName || 'Payer'}</p>
                        <p className="text-sm text-slate-500">
                          Status: <span className="font-medium">{iv.verificationStatus}</span> · Patient: {iv.patientId}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Policy: {iv.policyNumber || '—'} · Group: {iv.groupNumber || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => markVerification(iv.id, 'verified')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => markVerification(iv.id, 'denied')}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm"
                        >
                          Deny
                        </button>
                        <button
                          onClick={() => markVerification(iv.id, 'not_found')}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm"
                        >
                          Not found
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeManagementDashboard;

