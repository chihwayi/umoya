import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CreditCard, Users, Loader2, LogOut, Plus, Trash2 } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { patientPortalApi } from '../services/api';

type TabKey = 'bills' | 'education' | 'family';

const PatientPortalDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const token = localStorage.getItem('patient_portal_token') || '';

  const headersReady = useMemo(() => Boolean(tenantSlug && token), [tenantSlug, token]);

  const [activeTab, setActiveTab] = useState<TabKey>('bills');
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [family, setFamily] = useState<any[]>([]);

  const [payment, setPayment] = useState({ billId: '', amount: '', paymentMethod: 'ecocash' as any, paymentReference: '' });
  const [familyForm, setFamilyForm] = useState({ proxyName: '', proxyEmail: '', proxyPhone: '', relationship: '', accessLevel: 'view_only' as any });

  const load = async () => {
    if (!headersReady) return;
    try {
      setLoading(true);
      const [b, e, f] = await Promise.all([
        patientPortalApi.getBills(token, tenantSlug!),
        patientPortalApi.listEducation(token, tenantSlug!),
        patientPortalApi.listFamilyAccess(token, tenantSlug!),
      ]);
      setBills(b.data || []);
      setEducation(e.data || []);
      setFamily(f.data || []);
    } catch (err: any) {
      showError('Error', err?.response?.data?.message || 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!headersReady) {
      navigate(`/portal/${tenantSlug}/login`);
      return;
    }
    load();
  }, [tenantSlug, token]);

  const logout = () => {
    localStorage.removeItem('patient_portal_token');
    localStorage.removeItem('patient_portal_user');
    showSuccess('Signed out', 'You have been logged out.');
    navigate(`/portal/${tenantSlug}/login`);
  };

  const createPayment = async () => {
    try {
      const amount = Number(payment.amount);
      await patientPortalApi.createPortalPayment(
        {
          billId: payment.billId || undefined,
          amount,
          paymentMethod: payment.paymentMethod,
          paymentReference: payment.paymentReference || undefined,
        },
        token,
        tenantSlug!,
      );
      showSuccess('Payment submitted', 'Payment recorded (status: pending).');
      setPayment({ billId: '', amount: '', paymentMethod: 'ecocash', paymentReference: '' });
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create payment');
    }
  };

  const addFamilyAccess = async () => {
    try {
      await patientPortalApi.createFamilyAccess(
        {
          proxyName: familyForm.proxyName,
          proxyEmail: familyForm.proxyEmail,
          proxyPhone: familyForm.proxyPhone || undefined,
          relationship: familyForm.relationship || undefined,
          accessLevel: familyForm.accessLevel,
        },
        token,
        tenantSlug!,
      );
      showSuccess('Added', 'Family access created.');
      setFamilyForm({ proxyName: '', proxyEmail: '', proxyPhone: '', relationship: '', accessLevel: 'view_only' });
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create family access');
    }
  };

  const revokeFamilyAccess = async (id: string) => {
    try {
      await patientPortalApi.revokeFamilyAccess(id, token, tenantSlug!);
      showSuccess('Revoked', 'Access revoked.');
      load();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to revoke');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading patient portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold">Patient Portal</h1>
                <p className="text-indigo-100 mt-1">Bills, education, family access</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-6 bg-white/80 backdrop-blur-sm rounded-xl p-2 border border-slate-200">
          <button
            onClick={() => setActiveTab('bills')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'bills' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" /> Bills
            </div>
          </button>
          <button
            onClick={() => setActiveTab('education')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'education' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4" /> Education
            </div>
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'family' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" /> Family
            </div>
          </button>
        </div>

        {activeTab === 'bills' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Your bills</h2>
              {bills.length === 0 ? (
                <p className="text-sm text-slate-500">No bills yet.</p>
              ) : (
                <ul className="space-y-3">
                  {bills.map((b) => (
                    <li key={b.id} className="border border-slate-200 rounded-xl p-4 flex justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800">Invoice #{b.billNumber || b.invoice_number || b.id}</p>
                        <p className="text-sm text-slate-500">
                          Status: {b.status} · Total: {b.totalAmount ?? b.total_amount}
                        </p>
                      </div>
                      <button
                        onClick={() => setPayment((p) => ({ ...p, billId: b.id, amount: String(b.totalAmount ?? b.total_amount ?? '') }))}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold"
                      >
                        Pay
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Pay a bill</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Bill ID</label>
                  <input value={payment.billId} onChange={(e) => setPayment((p) => ({ ...p, billId: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Amount</label>
                  <input value={payment.amount} onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Method</label>
                  <select value={payment.paymentMethod} onChange={(e) => setPayment((p) => ({ ...p, paymentMethod: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="ecocash">ecocash</option>
                    <option value="onemoney">onemoney</option>
                    <option value="card">card</option>
                    <option value="bank_transfer">bank_transfer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Reference (optional)</label>
                  <input value={payment.paymentReference} onChange={(e) => setPayment((p) => ({ ...p, paymentReference: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={createPayment} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold">
                  <Plus className="w-4 h-4" /> Submit payment
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'education' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Health education</h2>
            {education.length === 0 ? (
              <p className="text-sm text-slate-500">No published content yet.</p>
            ) : (
              <ul className="space-y-3">
                {education.map((c) => (
                  <li key={c.id} className="border border-slate-200 rounded-xl p-4">
                    <p className="font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {c.category ? `${c.category} · ` : ''}{c.contentType || c.content_type} · {c.language}
                    </p>
                    <p className="text-sm text-slate-700 mt-3 line-clamp-3">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'family' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Family access</h2>
              {family.length === 0 ? (
                <p className="text-sm text-slate-500">No family/caregiver access grants yet.</p>
              ) : (
                <ul className="space-y-3">
                  {family.map((f) => (
                    <li key={f.id} className="border border-slate-200 rounded-xl p-4 flex justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{f.proxyName || f.proxy_name}</p>
                        <p className="text-sm text-slate-600">
                          {f.proxyEmail || f.proxy_email} · {f.accessLevel || f.access_level} · Active: {String(f.isActive ?? f.is_active)}
                        </p>
                      </div>
                      <button onClick={() => revokeFamilyAccess(f.id)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-semibold flex items-center gap-1">
                        <Trash2 className="w-4 h-4" /> Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Add access</h2>
              <div className="space-y-3">
                <input value={familyForm.proxyName} onChange={(e) => setFamilyForm((p) => ({ ...p, proxyName: e.target.value }))} placeholder="Proxy name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={familyForm.proxyEmail} onChange={(e) => setFamilyForm((p) => ({ ...p, proxyEmail: e.target.value }))} placeholder="Proxy email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={familyForm.proxyPhone} onChange={(e) => setFamilyForm((p) => ({ ...p, proxyPhone: e.target.value }))} placeholder="Proxy phone (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={familyForm.relationship} onChange={(e) => setFamilyForm((p) => ({ ...p, relationship: e.target.value }))} placeholder="Relationship (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <select value={familyForm.accessLevel} onChange={(e) => setFamilyForm((p) => ({ ...p, accessLevel: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="view_only">view_only</option>
                  <option value="full">full</option>
                  <option value="emergency_only">emergency_only</option>
                </select>
                <button onClick={addFamilyAccess} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientPortalDashboard;

