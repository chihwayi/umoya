import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Droplet, Activity, AlertTriangle, TrendingUp, Loader2, ArrowLeft, FlaskConical, Crosshair, AlertCircle, Zap } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi, ehrAxios } from '../services/api';

const BloodBankDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [activeTransfusions, setActiveTransfusions] = useState<any[]>([]);
  const [patientContextMap, setPatientContextMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState('all');
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [typeScreenPatientId, setTypeScreenPatientId] = useState('');
  const [typeScreenBloodGroup, setTypeScreenBloodGroup] = useState('O');
  const [typeScreenRh, setTypeScreenRh] = useState('positive');
  const [crossmatchPatientId, setCrossmatchPatientId] = useState('');
  const [crossmatchInventoryId, setCrossmatchInventoryId] = useState('');
  const [reactionTransfusionId, setReactionTransfusionId] = useState<string | null>(null);
  const [reactionForm, setReactionForm] = useState({ reactionType: 'febrile', severity: 'moderate', symptoms: '' });
  const [mtpPatientId, setMtpPatientId] = useState('');
  const [utilization, setUtilization] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [selectedComponent]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load inventory
      const inventoryParams: any = { status: 'available' };
      if (selectedComponent !== 'all') {
        inventoryParams.componentType = selectedComponent;
      }
      const inventoryResponse = await ehrAxios.get('/blood-bank/inventory', {
        params: inventoryParams,
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setInventory(inventoryResponse.data || []);

      // Load stats
      const statsResponse = await ehrAxios.get('/blood-bank/inventory/stats', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setStats(statsResponse.data || []);

      // Load active transfusions
      const transfusionsResponse = await ehrAxios.get('/blood-bank/transfusions/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      const transfusions = transfusionsResponse.data || [];
      setActiveTransfusions(transfusions);

      const patientIds: string[] = Array.from(
        new Set<string>(
          (transfusions || [])
            .map((transfusion: any) => transfusion?.patient?.id || transfusion?.patientId || null)
            .filter((value: string | null): value is string => Boolean(value)),
        ),
      );
      if (patientIds.length > 0 && tenantSlug && token) {
        const contextEntries = await Promise.all(
          patientIds.map(async (patientId: string) => {
            try {
              const response = await ehrApi.getPatientContext(patientId, token, tenantSlug);
              return [patientId, response.data || null] as const;
            } catch {
              return [patientId, null] as const;
            }
          }),
        );
        setPatientContextMap((prev) => ({
          ...prev,
          ...Object.fromEntries(contextEntries),
        }));
      }
      const utilRes = await ehrAxios.get('/blood-bank/utilization-report', { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }).catch(() => ({ data: null }));
      setUtilization(utilRes.data);
    } catch (error) {
      showError('Error', 'Failed to load blood bank data');
    } finally {
      setLoading(false);
    }
  };

  const headers = () => ({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` });

  const handleTypeAndScreen = async () => {
    if (!typeScreenPatientId.trim()) { showError('Error', 'Patient ID required'); return; }
    try {
      await ehrAxios.post('/blood-bank/type-and-screen', {
        patientId: typeScreenPatientId,
        bloodGroup: typeScreenBloodGroup,
        rhFactor: typeScreenRh,
      }, { headers: headers() });
      showSuccess('Success', 'Type and screen ordered');
      setTypeScreenPatientId('');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleCrossmatch = async () => {
    if (!crossmatchPatientId.trim() || !crossmatchInventoryId) { showError('Error', 'Patient ID and unit required'); return; }
    try {
      await ehrAxios.post('/blood-bank/crossmatch', {
        patientId: crossmatchPatientId,
        inventoryId: crossmatchInventoryId,
      }, { headers: headers() });
      showSuccess('Success', 'Crossmatch performed');
      setCrossmatchPatientId('');
      setCrossmatchInventoryId('');
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleReportReaction = async () => {
    if (!reactionTransfusionId) return;
    try {
      await ehrAxios.post(`/blood-bank/transfusions/${reactionTransfusionId}/reaction`, reactionForm, { headers: headers() });
      showSuccess('Success', 'Reaction reported');
      setReactionTransfusionId(null);
      loadData();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleActivateMTP = async () => {
    if (!mtpPatientId.trim()) { showError('Error', 'Patient ID required'); return; }
    try {
      await ehrAxios.post('/blood-bank/massive-transfusion-protocol', { patientId: mtpPatientId }, { headers: headers() });
      showSuccess('Success', 'MTP activated');
      setMtpPatientId('');
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed');
    }
  };

  const getBloodGroupColor = (group: string) => {
    switch (group) {
      case 'O': return 'from-red-500 to-rose-600';
      case 'A': return 'from-blue-500 to-cyan-600';
      case 'B': return 'from-purple-500 to-violet-600';
      case 'AB': return 'from-pink-500 to-rose-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const components = [
    { value: 'all', label: 'All Components' },
    { value: 'packed_rbc', label: 'Packed RBC' },
    { value: 'ffp', label: 'FFP (Plasma)' },
    { value: 'platelets', label: 'Platelets' },
    { value: 'whole_blood', label: 'Whole Blood' },
    { value: 'cryoprecipitate', label: 'Cryoprecipitate' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading blood bank...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Droplet className="w-8 h-8" />
                  Blood Bank Dashboard
                </h1>
                <p className="text-red-100 mt-1">Inventory & transfusion management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Utilization summary */}
        {utilization && (
          <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200 flex gap-4 text-sm">
            <span><strong>Transfusions (30d):</strong> {utilization.total_transfusions ?? 0}</span>
            <span><strong>Completed:</strong> {utilization.completed ?? 0}</span>
            <span><strong>In progress:</strong> {utilization.in_progress ?? 0}</span>
          </div>
        )}

        {/* Type & Screen / Crossmatch / Reaction / MTP */}
        <div className="mb-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setShowWorkflowPanel(!showWorkflowPanel)} className="w-full flex items-center justify-between p-4 text-left font-bold text-slate-900">
            <span className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-red-600" /> Type & Screen, Crossmatch, Reactions, MTP</span>
            <span className="text-slate-500">{showWorkflowPanel ? '▼' : '▶'}</span>
          </button>
          {showWorkflowPanel && (
            <div className="p-4 pt-0 border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><Crosshair className="w-4 h-4" /> Type & Screen</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input placeholder="Patient ID" value={typeScreenPatientId} onChange={(e) => setTypeScreenPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                    <select value={typeScreenBloodGroup} onChange={(e) => setTypeScreenBloodGroup(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
                      {['O', 'A', 'B', 'AB'].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={typeScreenRh} onChange={(e) => setTypeScreenRh(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
                      <option value="positive">Rh+</option>
                      <option value="negative">Rh-</option>
                    </select>
                    <button type="button" onClick={handleTypeAndScreen} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Order</button>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2">Crossmatch</h4>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input placeholder="Patient ID" value={crossmatchPatientId} onChange={(e) => setCrossmatchPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                    <select value={crossmatchInventoryId} onChange={(e) => setCrossmatchInventoryId(e.target.value)} className="px-2 py-1.5 border rounded text-sm flex-1 min-w-[120px]">
                      <option value="">Select unit...</option>
                      {inventory.slice(0, 50).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.unitNumber} {u.bloodGroup}{u.rhFactor === 'positive' ? '+' : '-'}</option>
                      ))}
                    </select>
                    <button type="button" onClick={handleCrossmatch} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Perform</button>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><Zap className="w-4 h-4" /> Massive Transfusion Protocol</h4>
                <div className="flex flex-wrap gap-2 items-end">
                  <input placeholder="Patient ID" value={mtpPatientId} onChange={(e) => setMtpPatientId(e.target.value)} className="px-2 py-1.5 border rounded text-sm w-36" />
                  <button type="button" onClick={handleActivateMTP} className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium">Activate MTP</button>
                </div>
              </div>
              {activeTransfusions.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Report Transfusion Reaction</h4>
                  {reactionTransfusionId ? (
                    <div className="space-y-2">
                      <select value={reactionForm.reactionType} onChange={(e) => setReactionForm((f) => ({ ...f, reactionType: e.target.value }))} className="px-2 py-1.5 border rounded text-sm">
                        <option value="febrile">Febrile</option>
                        <option value="allergic">Allergic</option>
                        <option value="hemolytic">Hemolytic</option>
                        <option value="other">Other</option>
                      </select>
                      <select value={reactionForm.severity} onChange={(e) => setReactionForm((f) => ({ ...f, severity: e.target.value }))} className="px-2 py-1.5 border rounded text-sm ml-2">
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="life_threatening">Life-threatening</option>
                      </select>
                      <input placeholder="Symptoms" value={reactionForm.symptoms} onChange={(e) => setReactionForm((f) => ({ ...f, symptoms: e.target.value }))} className="px-2 py-1.5 border rounded text-sm ml-2 w-48" />
                      <button type="button" onClick={handleReportReaction} className="ml-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium">Submit</button>
                      <button type="button" onClick={() => setReactionTransfusionId(null)} className="ml-2 px-3 py-1.5 bg-slate-200 rounded text-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {activeTransfusions.map((tx: any) => (
                        <button key={tx.id} type="button" onClick={() => setReactionTransfusionId(tx.id)} className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm font-medium">
                          Report reaction — {tx.patient?.firstName} {tx.patient?.lastName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Component Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {components.map((comp) => (
            <button
              key={comp.value}
              onClick={() => setSelectedComponent(comp.value)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                selectedComponent === comp.value
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
              }`}
            >
              {comp.label}
            </button>
          ))}
        </div>

        {/* Active Transfusions */}
      {activeTransfusions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600 animate-pulse" />
            Active Transfusions ({activeTransfusions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTransfusions.map((transfusion) => (
              <div key={transfusion.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-red-300 shadow-lg p-4">
                {(() => {
                  const patientId = transfusion?.patient?.id || transfusion?.patientId || null;
                  const context = patientId ? patientContextMap[patientId] : null;
                  const latestVitals = context?.latestVitals || null;
                  const bloodType = context?.patient?.bloodType || transfusion?.patient?.bloodType || 'N/A';
                  const latestEncounterHint =
                    context?.modules?.ed?.latestVisit?.ed_visit_number ||
                    context?.modules?.sepsis?.latestBundle?.id ||
                    context?.modules?.cardiology?.latestEncounter?.id ||
                    null;
                  return (
                    <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">
                    {transfusion.patient?.firstName} {transfusion.patient?.lastName}
                  </h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    IN PROGRESS
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  <strong>Unit:</strong> {transfusion.inventory?.unitNumber} ({transfusion.inventory?.componentType})
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Started:</strong> {new Date(transfusion.startTime).toLocaleTimeString()}
                </p>
                <p className="text-sm text-slate-600">
                  By: {transfusion.administeredBy?.firstName} {transfusion.administeredBy?.lastName}
                </p>
                <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Shared patient context</p>
                  <p className="text-xs text-red-900 mt-1">
                    Blood type: {bloodType}
                    {latestVitals?.bloodPressure ? ` • Latest BP ${latestVitals.bloodPressure}` : ''}
                    {latestVitals?.heartRate ? ` • HR ${latestVitals.heartRate}` : ''}
                  </p>
                  {latestEncounterHint && (
                    <p className="text-xs text-red-900 mt-1">
                      Linked cross-module episode: {latestEncounterHint}
                    </p>
                  )}
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Available Blood Products</h2>
        {inventory.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Units Available</h3>
            <p className="text-slate-600">No blood products match the selected criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((unit) => (
              <div
                key={unit.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`bg-gradient-to-r ${getBloodGroupColor(unit.bloodGroup)} text-white p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{unit.bloodGroup}{unit.rhFactor === 'positive' ? '+' : '-'}</h3>
                      <p className="text-sm opacity-90">{unit.componentType.replace('_', ' ').toUpperCase()}</p>
                    </div>
                    <Droplet className="w-8 h-8 opacity-80" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Unit:</strong> {unit.unitNumber}
                  </p>
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Volume:</strong> {unit.volumeMl} mL
                  </p>
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Expires:</strong> {new Date(unit.expiryDate).toLocaleDateString()}
                  </p>
                  {unit.storageLocation && (
                    <p className="text-xs text-slate-600 mt-2">
                      📍 {unit.storageLocation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default BloodBankDashboard;
