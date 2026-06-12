import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Activity, AlertCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import axios from 'axios';
import { runtimeUrls } from '../config/runtime';

const auth = () => ({
  token: localStorage.getItem('ehr_token') || '',
  tenantSlug: localStorage.getItem('ehr_tenant_slug') || '',
});

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

interface Referral {
  id: string;
  patientName: string;
  discipline: string;
  referralDate: string;
  status: string;
}

interface Session {
  id: string;
  date: string;
  type: string;
  duration: number;
}

const PhysiotherapyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'referrals' | 'sessions' | 'cdss'>('referrals');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Referral form
  const [referralForm, setReferralForm] = useState({
    patientId: '',
    discipline: 'physio',
    reason: '',
    urgency: 'routine',
  });

  // Stroke Rehab form
  const [strokeForm, setStrokeForm] = useState({
    barthelScore: '',
    strokeType: 'ischaemic',
    daysPostStroke: '',
  });
  const [strokeResult, setStrokeResult] = useState<any>(null);

  // Cardiac Rehab form
  const [cardiacForm, setCardiacForm] = useState({
    lvef: '',
    recentMI: false,
    bypassSurgery: false,
    heartFailure: false,
  });
  const [cardiacResult, setCardiacResult] = useState<any>(null);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/physiotherapy/referrals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setReferrals(response.data || []);
    } catch (error) {
      console.error('Failed to load referrals:', error);
      showError('Error', 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadSessions = useCallback(async (referralId: string) => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/physiotherapy/referrals/${referralId}/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setSessions(response.data || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      showError('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'referrals') {
      loadReferrals();
    } else if (activeTab === 'sessions' && selectedReferral) {
      loadSessions(selectedReferral.id);
    }
  }, [activeTab, selectedReferral, loadReferrals, loadSessions]);

  const saveReferral = async () => {
    setSaving(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const payload = {
        patientId: referralForm.patientId,
        discipline: referralForm.discipline,
        reason: referralForm.reason,
        urgency: referralForm.urgency,
      };
      await axios.post(`${runtimeUrls.ehrApi}/physiotherapy/referrals`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      showSuccess('Success', 'Referral created');
      setReferralForm({ patientId: '', discipline: 'physio', reason: '', urgency: 'routine' });
      await loadReferrals();
    } catch (error) {
      console.error('Failed to save referral:', error);
      showError('Error', 'Failed to save referral');
    } finally {
      setSaving(false);
    }
  };

  const generateStrokeRehab = () => {
    const barthel = parseInt(strokeForm.barthelScore) || 0;
    const daysPost = parseInt(strokeForm.daysPostStroke) || 0;

    let phase = '';
    let goals = [] as string[];
    let interventions = [] as string[];

    if (daysPost <= 7) {
      phase = 'Acute Phase (0-7 days)';
      goals = ['Prevent secondary complications', 'Maintain joint ROM', 'Patient/family education'];
      interventions = [
        'Passive ROM exercises, q4h',
        'Positioning every 2 hours',
        'DVT prophylaxis (mechanical)',
        'Bed mobility training',
        'Family education on stroke care'
      ];
    } else if (daysPost <= 30) {
      phase = 'Early Subacute Phase (1-4 weeks)';
      if (barthel < 20) {
        goals = ['Improve transfer ability', 'Reduce spasticity', 'Independence in ADLs'];
        interventions = [
          'Active-assisted ROM exercises',
          'Transfer training (bed → chair)',
          'Standing tolerance training',
          'Spasticity management (stretching, modalities)',
          'Occupational therapy for ADL retraining'
        ];
      } else {
        goals = ['Gait training', 'Fine motor coordination', 'Community reintegration prep'];
        interventions = [
          'Gait training with assistive device',
          'Balance and coordination exercises',
          'Functional strength training',
          'Constraint-induced movement therapy (affected side)',
          'Cognitive-linguistic therapy if aphasia'
        ];
      }
    } else {
      phase = 'Late Subacute/Chronic Phase (>4 weeks)';
      goals = ['Maximize independence', 'Return to community', 'Prevent recurrence'];
      interventions = [
        'Advanced gait and balance training',
        'Community ambulation training',
        'Driving assessment (if applicable)',
        'Social reintegration support',
        'Home safety assessment',
        'Cardiovascular conditioning',
        'Secondary prevention counseling (risk factor modification)'
      ];
    }

    setStrokeResult({ phase, goals, interventions });
  };

  const generateCardiacRehab = () => {
    const lvef = parseFloat(cardiacForm.lvef) || 0;
    let phase = '';
    let intensity = '';
    let note = '';

    if (cardiacForm.recentMI || cardiacForm.bypassSurgery) {
      phase = 'Phase 1 (Inpatient acute)';
      intensity = 'Low: ROM, bed mobility, sitting exercises, ambulation as tolerated';
      note = 'Continuous cardiac monitoring. Target HR <100 bpm, BP stable.';
    } else {
      if (lvef >= 40) {
        phase = 'Phase 2 (Early outpatient)';
        intensity = 'Moderate: 20-30 min aerobic (treadmill/cycling), target 50-70% max HR, resistance training';
      } else {
        phase = 'Phase 2 (Early outpatient, HFrEF)';
        intensity = 'Light-moderate: 15-20 min aerobic at <50% max HR, seated resistance, frequent rest';
      }
    }

    if (cardiacForm.heartFailure && lvef < 40) {
      note = 'HFrEF note: Strict fluid/sodium restriction. Avoid isometric exercises. Monitor for decompensation.';
    } else if (lvef >= 40 && cardiacForm.heartFailure) {
      note = 'HFpEF: Standard cardiac rehab with close BP monitoring.';
    }

    setCardiacResult({ phase, intensity, note });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-sm border border-green-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Physiotherapy Dashboard</h1>
              <p className="text-sm text-slate-600">Referrals, sessions, and rehabilitation planning tools</p>
            </div>
          </div>
          <button
            onClick={loadReferrals}
            disabled={loading}
            className="p-2 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Total Referrals</div>
          <div className="text-2xl font-bold text-green-600">{referrals.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Active</div>
          <div className="text-2xl font-bold text-emerald-600">{referrals.filter(r => r.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Total Sessions</div>
          <div className="text-2xl font-bold text-teal-600">{sessions.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">CDSS Tools</div>
          <div className="text-2xl font-bold text-cyan-600">2</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {(['referrals', 'sessions', 'cdss'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Referrals Tab */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Referral
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Patient ID"
                value={referralForm.patientId}
                onChange={(e) => setReferralForm({ ...referralForm, patientId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                value={referralForm.discipline}
                onChange={(e) => setReferralForm({ ...referralForm, discipline: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="physio">Physiotherapy</option>
                <option value="ot">Occupational Therapy</option>
                <option value="speech">Speech Therapy</option>
                <option value="cardiac">Cardiac Rehab</option>
                <option value="pulmonary">Pulmonary Rehab</option>
              </select>
              <textarea
                placeholder="Reason for referral"
                value={referralForm.reason}
                onChange={(e) => setReferralForm({ ...referralForm, reason: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent col-span-1 md:col-span-2"
                rows={2}
              />
              <select
                value={referralForm.urgency}
                onChange={(e) => setReferralForm({ ...referralForm, urgency: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent md:col-span-2"
              >
                <option value="routine">Routine</option>
                <option value="semi-urgent">Semi-urgent</option>
                <option value="urgent">Urgent</option>
              </select>
              <button
                onClick={saveReferral}
                disabled={saving}
                className="md:col-span-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Create Referral
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Discipline</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Referral Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{ref.patientName}</td>
                    <td className="px-4 py-3 capitalize">{ref.discipline}</td>
                    <td className="px-4 py-3">{fmt(ref.referralDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        ref.status === 'active' ? 'bg-green-100 text-green-800' :
                        ref.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedReferral(ref);
                          setActiveTab('sessions');
                        }}
                        className="text-green-600 hover:text-green-700 font-semibold text-sm"
                      >
                        View Sessions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {referrals.length === 0 && (
              <div className="text-center py-8 text-slate-500">No referrals created</div>
            )}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {selectedReferral ? (
            <>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{selectedReferral.patientName}</span> ({selectedReferral.discipline})
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Duration (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">{fmt(session.date)}</td>
                        <td className="px-4 py-3">{session.type}</td>
                        <td className="px-4 py-3">{session.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessions.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No sessions recorded. {selectedReferral.status === 'pending' && 'Referral pending acceptance.'}</div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a referral from the Referrals tab to view sessions</p>
            </div>
          )}
        </div>
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stroke Rehab Plan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Stroke Rehab Plan (Barthel-stratified)</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Barthel Score (0-100)"
                value={strokeForm.barthelScore}
                onChange={(e) => setStrokeForm({ ...strokeForm, barthelScore: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                value={strokeForm.strokeType}
                onChange={(e) => setStrokeForm({ ...strokeForm, strokeType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="ischaemic">Ischaemic</option>
                <option value="haemorrhagic">Haemorrhagic</option>
              </select>
              <input
                type="number"
                placeholder="Days Post-Stroke"
                value={strokeForm.daysPostStroke}
                onChange={(e) => setStrokeForm({ ...strokeForm, daysPostStroke: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={generateStrokeRehab}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Generate Rehab Plan
              </button>
              {strokeResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <p className="text-sm font-semibold text-slate-900">{strokeResult.phase}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Goals:</p>
                    <ul className="text-xs text-slate-700 space-y-0.5">
                      {strokeResult.goals.map((g: string, idx: number) => (
                        <li key={idx}>• {g}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Interventions:</p>
                    <ul className="text-xs text-slate-700 space-y-0.5">
                      {strokeResult.interventions.map((int: string, idx: number) => (
                        <li key={idx}>• {int}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cardiac Rehab Plan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cardiac Rehab Plan</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="LVEF (%)"
                step="0.1"
                value={cardiacForm.lvef}
                onChange={(e) => setCardiacForm({ ...cardiacForm, lvef: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cardiacForm.recentMI}
                  onChange={(e) => setCardiacForm({ ...cardiacForm, recentMI: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Recent MI</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cardiacForm.bypassSurgery}
                  onChange={(e) => setCardiacForm({ ...cardiacForm, bypassSurgery: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Bypass surgery</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cardiacForm.heartFailure}
                  onChange={(e) => setCardiacForm({ ...cardiacForm, heartFailure: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Heart failure</span>
              </label>
              <button
                onClick={generateCardiacRehab}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Generate Cardiac Rehab
              </button>
              {cardiacResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{cardiacResult.phase}</p>
                  <p className="text-sm text-slate-700"><span className="font-semibold">Intensity:</span> {cardiacResult.intensity}</p>
                  <p className="text-sm text-slate-700">{cardiacResult.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhysiotherapyDashboard;
