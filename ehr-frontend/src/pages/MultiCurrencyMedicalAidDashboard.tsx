import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currencyApi, medicalAidApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const MultiCurrencyMedicalAidDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<'exchange' | 'providers' | 'eligibility' | 'claims' | 'remittances'>('exchange');
  const [loading, setLoading] = useState(false);

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [remittances, setRemittances] = useState<any[]>([]);

  const [newRate, setNewRate] = useState({ baseCurrency: 'USD', quoteCurrency: 'ZAR', rate: 1 });
  const [eligibilityForm, setEligibilityForm] = useState({ patientId: '', providerId: '', memberNumber: '', policyNumber: '' });
  const [claimForm, setClaimForm] = useState({ providerId: '', transactionId: '', claimNumber: '' });
  const [remitForm, setRemitForm] = useState({ providerId: '', remittanceReference: '' });

  const providerOptions = useMemo(() => providers || [], [providers]);

  const ensure = () => {
    if (!tenantSlug) throw new Error('Missing tenant');
    if (!token) throw new Error('Missing token');
  };

  const loadAll = async () => {
    try {
      ensure();
      setLoading(true);
      const [c, r, p, e, cl, rem] = await Promise.all([
        currencyApi.listCurrencies(token, tenantSlug!),
        currencyApi.listExchangeRates({ limit: 100 }, token, tenantSlug!),
        medicalAidApi.listProviders(token, tenantSlug!),
        medicalAidApi.listEligibility(undefined, token, tenantSlug!),
        medicalAidApi.listClaims(undefined, token, tenantSlug!),
        medicalAidApi.listRemittances(undefined, token, tenantSlug!),
      ]);
      setCurrencies(c.data || []);
      setRates(r.data || []);
      setProviders(p.data || []);
      setEligibilityChecks(e.data || []);
      setClaims(cl.data || []);
      setRemittances(rem.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const createRate = async () => {
    try {
      ensure();
      await currencyApi.createExchangeRate(newRate, token, tenantSlug!);
      showSuccess('Saved', 'Exchange rate added');
      const r = await currencyApi.listExchangeRates({ limit: 100 }, token, tenantSlug!);
      setRates(r.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to save exchange rate');
    }
  };

  const createEligibility = async () => {
    try {
      ensure();
      await medicalAidApi.createEligibility(
        {
          patientId: eligibilityForm.patientId,
          providerId: eligibilityForm.providerId || null,
          memberNumber: eligibilityForm.memberNumber || null,
          policyNumber: eligibilityForm.policyNumber || null,
        },
        token,
        tenantSlug!,
      );
      showSuccess('Created', 'Eligibility check saved');
      const e = await medicalAidApi.listEligibility(undefined, token, tenantSlug!);
      setEligibilityChecks(e.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to create eligibility check');
    }
  };

  const createClaim = async () => {
    try {
      ensure();
      await medicalAidApi.createClaim(
        {
          providerId: claimForm.providerId,
          transactionId: claimForm.transactionId || null,
          claimNumber: claimForm.claimNumber || null,
        },
        token,
        tenantSlug!,
      );
      showSuccess('Created', 'Claim submission created');
      const cl = await medicalAidApi.listClaims(undefined, token, tenantSlug!);
      setClaims(cl.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to create claim');
    }
  };

  const submitClaim = async (id: string) => {
    try {
      ensure();
      await medicalAidApi.submitClaim(id, token, tenantSlug!);
      showSuccess('Submitted', 'Claim submitted (stub)');
      const cl = await medicalAidApi.listClaims(undefined, token, tenantSlug!);
      setClaims(cl.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to submit claim');
    }
  };

  const createRemittance = async () => {
    try {
      ensure();
      await medicalAidApi.createRemittance(
        {
          providerId: remitForm.providerId || null,
          remittanceReference: remitForm.remittanceReference || null,
        },
        token,
        tenantSlug!,
      );
      showSuccess('Created', 'Remittance saved');
      const rem = await medicalAidApi.listRemittances(undefined, token, tenantSlug!);
      setRemittances(rem.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to create remittance');
    }
  };

  const processRemittance = async (id: string) => {
    try {
      ensure();
      await medicalAidApi.processRemittance(id, token, tenantSlug!);
      showSuccess('Processed', 'Remittance processed (stub)');
      const rem = await medicalAidApi.listRemittances(undefined, token, tenantSlug!);
      setRemittances(rem.data || []);
    } catch (e: any) {
      console.error(e);
      showError('Error', e?.message || 'Failed to process remittance');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Multi-currency & Medical Aid</h1>
          <p className="text-sm text-slate-600">Exchange rates and integration stubs (CIMAS, First Mutual, PSMAS).</p>
        </div>
        <button
          onClick={loadAll}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'exchange', label: 'Exchange rates' },
          { id: 'providers', label: 'Providers' },
          { id: 'eligibility', label: 'Eligibility checks' },
          { id: 'claims', label: 'Claim submissions' },
          { id: 'remittances', label: 'Remittances' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              tab === (t.id as any)
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'exchange' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Add exchange rate</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Base</label>
                <select
                  value={newRate.baseCurrency}
                  onChange={(e) => setNewRate({ ...newRate, baseCurrency: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {(currencies || []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Quote</label>
                <select
                  value={newRate.quoteCurrency}
                  onChange={(e) => setNewRate({ ...newRate, quoteCurrency: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {(currencies || []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Rate</label>
                <input
                  type="number"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({ ...newRate, rate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={createRate}
              className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
            >
              Save rate
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Recent rates</h2>
            <div className="max-h-80 overflow-auto space-y-2">
              {(rates || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {r.baseCurrency} → {r.quoteCurrency}
                  </div>
                  <div className="text-sm text-slate-700">{r.rate}</div>
                </div>
              ))}
              {(rates || []).length === 0 && <div className="text-sm text-slate-600">No rates yet.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'providers' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-bold text-slate-900 mb-3">Providers</h2>
          <div className="space-y-2">
            {(providers || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-600">{p.code || '—'}</div>
                </div>
                <div className={`text-xs font-bold ${p.isActive ? 'text-green-700' : 'text-slate-500'}`}>
                  {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'eligibility' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Create eligibility check</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Patient ID</label>
                <input
                  value={eligibilityForm.patientId}
                  onChange={(e) => setEligibilityForm({ ...eligibilityForm, patientId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Provider</label>
                <select
                  value={eligibilityForm.providerId}
                  onChange={(e) => setEligibilityForm({ ...eligibilityForm, providerId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">(optional)</option>
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Member #</label>
                <input
                  value={eligibilityForm.memberNumber}
                  onChange={(e) => setEligibilityForm({ ...eligibilityForm, memberNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Policy #</label>
                <input
                  value={eligibilityForm.policyNumber}
                  onChange={(e) => setEligibilityForm({ ...eligibilityForm, policyNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={createEligibility}
              className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
            >
              Create check
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Recent eligibility checks</h2>
            <div className="max-h-80 overflow-auto space-y-2">
              {(eligibilityChecks || []).map((c) => (
                <div key={c.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-900">{c.patientId}</div>
                  <div className="text-xs text-slate-600">
                    Status: <span className="font-bold">{c.status}</span> • Provider: {c.providerId || '—'}
                  </div>
                </div>
              ))}
              {(eligibilityChecks || []).length === 0 && (
                <div className="text-sm text-slate-600">No eligibility checks yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Create claim submission</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Provider</label>
                <select
                  value={claimForm.providerId}
                  onChange={(e) => setClaimForm({ ...claimForm, providerId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select provider</option>
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Financial Transaction ID (optional)</label>
                <input
                  value={claimForm.transactionId}
                  onChange={(e) => setClaimForm({ ...claimForm, transactionId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="UUID"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Claim # (optional)</label>
                <input
                  value={claimForm.claimNumber}
                  onChange={(e) => setClaimForm({ ...claimForm, claimNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={createClaim}
              className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
              disabled={!claimForm.providerId}
            >
              Create claim
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Recent claim submissions</h2>
            <div className="max-h-80 overflow-auto space-y-2">
              {(claims || []).map((c) => (
                <div key={c.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{c.claimNumber || c.id}</div>
                    <div className="text-xs text-slate-600">
                      Status: <span className="font-bold">{c.status}</span> • Provider: {c.providerId}
                    </div>
                  </div>
                  <button
                    onClick={() => submitClaim(c.id)}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    disabled={c.status !== 'draft'}
                  >
                    Submit
                  </button>
                </div>
              ))}
              {(claims || []).length === 0 && <div className="text-sm text-slate-600">No claims yet.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'remittances' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Create remittance</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Provider (optional)</label>
                <select
                  value={remitForm.providerId}
                  onChange={(e) => setRemitForm({ ...remitForm, providerId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">(none)</option>
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Reference</label>
                <input
                  value={remitForm.remittanceReference}
                  onChange={(e) => setRemitForm({ ...remitForm, remittanceReference: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={createRemittance}
              className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
            >
              Create remittance
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-bold text-slate-900 mb-3">Recent remittances</h2>
            <div className="max-h-80 overflow-auto space-y-2">
              {(remittances || []).map((r) => (
                <div key={r.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{r.remittanceReference || r.id}</div>
                    <div className="text-xs text-slate-600">
                      Status: <span className="font-bold">{r.status}</span> • Provider: {r.providerId || '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => processRemittance(r.id)}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    disabled={r.status !== 'received'}
                  >
                    Process
                  </button>
                </div>
              ))}
              {(remittances || []).length === 0 && (
                <div className="text-sm text-slate-600">No remittances yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCurrencyMedicalAidDashboard;

