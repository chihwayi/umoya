import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Calendar,
  Activity,
  ArrowLeft,
  Loader2,
  ListPlus,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { populationHealthApi } from '../services/api';

const PopulationHealthDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [dashboard, setDashboard] = useState<{
    totalByCondition?: Record<string, number>;
    totalByRisk?: Record<string, number>;
    overdueReviews?: number;
    uncontrolledCount?: number;
    total?: number;
  } | null>(null);
  const [recallLists, setRecallLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, listsRes] = await Promise.all([
        populationHealthApi.getRegistryDashboard(token, tenantSlug || ''),
        populationHealthApi.getRecallLists(token, tenantSlug || ''),
      ]).catch((e) => {
        showError('Error', e?.response?.data?.message || 'Failed to load population health data');
        return [{ data: null }, { data: [] }];
      });
      setDashboard(dashRes.data || null);
      setRecallLists(listsRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantSlug]);

  const handleGeneratePreventive = async () => {
    try {
      setGenerating(true);
      const res = await populationHealthApi.generatePreventiveCare(token, tenantSlug || '');
      showSuccess('Done', `Generated ${res.data?.generated ?? 0} preventive care reminders.`);
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to generate reminders');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateRecallList = async () => {
    if (!newListName.trim()) return;
    try {
      await populationHealthApi.createRecallList(
        { name: newListName.trim(), criteria: { overdueScreenings: true } },
        token,
        tenantSlug || '',
      );
      showSuccess('Created', `Recall list "${newListName}" created.`);
      setNewListName('');
      setShowNewList(false);
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to create list');
    }
  };

  const handleGenerateList = async (listId: string) => {
    try {
      const res = await populationHealthApi.generateRecallList(listId, token, tenantSlug || '');
      showSuccess('Updated', `List now has ${res.data?.patientIds?.length ?? 0} patients.`);
      loadData();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to generate list');
    }
  };

  const handleNotifyList = async (listId: string) => {
    try {
      const res = await populationHealthApi.notifyRecallList(listId, token, tenantSlug || '', {
        channel: 'sms',
      });
      showSuccess('Notified', `Recall list: ${res.data?.patientIds?.length ?? 0} patients (placeholder; no SMS sent).`);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to notify');
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading population health...</p>
        </div>
      </div>
    );
  }

  const totalByCondition = dashboard?.totalByCondition || {};
  const totalByRisk = dashboard?.totalByRisk || {};
  const overdueReviews = dashboard?.overdueReviews ?? 0;
  const uncontrolledCount = dashboard?.uncontrolledCount ?? 0;
  const total = dashboard?.total ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg">
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
                  <Users className="w-8 h-8" />
                  Population Health
                </h1>
                <p className="text-teal-100 mt-1">Registry, preventive care & recall lists</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Registry total</p>
                <p className="text-4xl font-bold text-teal-600">{total}</p>
              </div>
              <Users className="w-8 h-8 text-teal-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Overdue reviews</p>
                <p className="text-4xl font-bold text-amber-600">{overdueReviews}</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Uncontrolled</p>
                <p className="text-4xl font-bold text-red-600">{uncontrolledCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <button
              onClick={handleGeneratePreventive}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              <span>Generate preventive care</span>
            </button>
          </div>
        </div>

        {/* By condition / By risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">By condition type</h2>
            </div>
            <div className="p-5">
              {Object.keys(totalByCondition).length === 0 ? (
                <p className="text-slate-500 text-sm">No registry entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(totalByCondition).map(([k, v]) => (
                    <li key={k} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-700">{k.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">By risk level</h2>
            </div>
            <div className="p-5">
              {Object.keys(totalByRisk).length === 0 ? (
                <p className="text-slate-500 text-sm">No registry entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(totalByRisk).map(([k, v]) => (
                    <li key={k} className="flex justify-between text-sm">
                      <span className="capitalize text-slate-700">{k}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Recall lists */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recall lists</h2>
            {!showNewList ? (
              <button
                onClick={() => setShowNewList(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
              >
                <ListPlus className="w-4 h-4" />
                New list
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48"
                />
                <button
                  onClick={handleCreateRecallList}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewList(false);
                    setNewListName('');
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="p-5">
            {recallLists.length === 0 ? (
              <p className="text-slate-500 text-sm">No recall lists. Create one to generate patient lists and send reminders.</p>
            ) : (
              <ul className="space-y-3">
                {recallLists.map((list: any) => (
                  <li
                    key={list.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{list.name}</p>
                      <p className="text-sm text-slate-500">
                        {list.patientCount ?? 0} patients
                        {list.lastGeneratedAt
                          ? ` · Generated ${new Date(list.lastGeneratedAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateList(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate
                      </button>
                      <button
                        onClick={() => handleNotifyList(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-100 text-cyan-800 hover:bg-cyan-200 text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Notify (SMS)
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopulationHealthDashboard;
