import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  Receipt,
  Pill,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  RefreshCw,
  Users,
  Settings,
  BarChart3,
  FolderOpen,
  Brain,
  BookOpen,
  Sparkles,
  Shield,
  Download,
} from 'lucide-react';
import { pharmacyApi, ehrApi, cdssApi, mcazApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import PharmacyDispensing from '../components/PharmacyDispensing';
import PharmacyInventory from '../components/PharmacyInventory';
import PharmacyPurchaseOrders from '../components/PharmacyPurchaseOrders';
import PharmacyReceipts from '../components/PharmacyReceipts';
import PharmacySuppliers from '../components/PharmacySuppliers';
import SharedDocumentsList from '../components/SharedDocumentsList';
import AdminNavigationShell from '../components/AdminNavigationShell';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  subtitle?: string;
  accent: string;
  trend?: { value: number; label: string };
}> = ({ title, value, icon: Icon, subtitle, accent, trend }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
    <div className="relative flex items-center gap-4 p-6">
      <div className="p-3 rounded-2xl bg-black/10 text-white">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value > 0 ? (
              <TrendingUp className="w-3 h-3 text-white/80" />
            ) : (
              <TrendingDown className="w-3 h-3 text-white/80" />
            )}
            <span className="text-xs text-white/80">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const PharmacyDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([]);
  const [inventoryForecasts, setInventoryForecasts] = useState<any[]>([]);
  const [dispensingAnomalies, setDispensingAnomalies] = useState<any[]>([]);
  const [stewardshipReviews, setStewardshipReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'orders' | 'receipts' | 'suppliers' | 'alerts' | 'dispensing' | 'shared-documents' | 'mcaz-register'>('overview');
  const [sharedDocumentsCount, setSharedDocumentsCount] = useState(0);
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResults, setCopilotResults] = useState<any[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [stewardshipLoadingId, setStewardshipLoadingId] = useState<string | null>(null);

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  // Load shared documents count
  useEffect(() => {
    const loadSharedCount = async () => {
      try {
        const response = await ehrApi.getSharedDocuments(token, tenantSlug || '');
        setSharedDocumentsCount(response.data?.length || 0);
      } catch (error) {
        console.error('Error loading shared documents count:', error);
      }
    };

    if (token && tenantSlug) {
      loadSharedCount();
      // Refresh count every 2 minutes
      const interval = setInterval(loadSharedCount, 120000);
      return () => clearInterval(interval);
    }
  }, [token, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !token) {
      return;
    }
    loadDashboardData();
  }, [tenantSlug, token]);

  const loadDashboardData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      setLoading(true);
      await Promise.all([
        loadInventory(),
        loadLowStockItems(),
        loadSuppliers(),
        loadPurchaseOrders(),
        loadAlerts(),
        loadPendingPrescriptions(),
        loadInventoryForecasts(),
        loadDispensingAnomalies(),
        loadStewardshipReviews(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      showError('Unable to load pharmacy data', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token]);

  const loadInventory = async () => {
    try {
      const response = await pharmacyApi.listInventory(token, tenantSlug!, { limit: 50 });
      setInventory(response.data?.inventory || []);
    } catch (error) {
      console.error('Failed to load inventory', error);
    }
  };

  const loadLowStockItems = async () => {
    try {
      const response = await pharmacyApi.getLowStockItems(token, tenantSlug!);
      setLowStockItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load low stock items', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await pharmacyApi.listSuppliers(token, tenantSlug!, { limit: 10 });
      setSuppliers(response.data?.suppliers || []);
    } catch (error) {
      console.error('Failed to load suppliers', error);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const response = await pharmacyApi.listPurchaseOrders(token, tenantSlug!, { limit: 10 });
      setPurchaseOrders(response.data?.orders || []);
    } catch (error) {
      console.error('Failed to load purchase orders', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await pharmacyApi.listAlerts(token, tenantSlug!, { resolved: false, limit: 10 });
      setAlerts(response.data?.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts', error);
    }
  };

  const loadPendingPrescriptions = async () => {
    try {
      const response = await pharmacyApi.getPendingPrescriptions(token, tenantSlug!, { limit: 25 });
      setPendingPrescriptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load pending prescriptions', error);
    }
  };

  const loadInventoryForecasts = async () => {
    try {
      const response = await pharmacyApi.listInventoryForecasts(token, tenantSlug!, { limit: 5 });
      setInventoryForecasts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load inventory forecasts', error);
    }
  };

  const loadDispensingAnomalies = async () => {
    try {
      const response = await pharmacyApi.listDispensingAnomalies(token, tenantSlug!, { limit: 5, status: 'open' });
      setDispensingAnomalies(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load dispensing anomalies', error);
    }
  };

  const loadStewardshipReviews = async () => {
    try {
      const response = await pharmacyApi.listStewardshipReviews(token, tenantSlug!, { limit: 5, reviewRequired: true });
      setStewardshipReviews(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load stewardship reviews', error);
    }
  };

  const runInventoryForecasts = async () => {
    if (!tenantSlug || !token) return;
    try {
      setForecastLoading(true);
      await pharmacyApi.generateInventoryForecasts({ horizonDays: 30, lookbackDays: 45 }, token, tenantSlug);
      await loadInventoryForecasts();
      showSuccess('Forecasts updated', 'Inventory shortage forecasts were regenerated.');
    } catch (error) {
      console.error('Failed to generate inventory forecasts', error);
      showError('Forecasts', 'Unable to refresh pharmacy inventory forecasts right now.');
    } finally {
      setForecastLoading(false);
    }
  };

  const runDispensingAnomalyScan = async () => {
    if (!tenantSlug || !token) return;
    try {
      setAnomalyLoading(true);
      await pharmacyApi.detectDispensingAnomalies({ lookbackDays: 90, limit: 250 }, token, tenantSlug);
      await loadDispensingAnomalies();
      showSuccess('Anomaly scan complete', 'Dispensing anomalies were refreshed for pharmacist review.');
    } catch (error) {
      console.error('Failed to scan dispensing anomalies', error);
      showError('Anomalies', 'Unable to refresh dispensing anomaly review right now.');
    } finally {
      setAnomalyLoading(false);
    }
  };

  const runHighRiskReview = async (prescriptionId: string) => {
    if (!tenantSlug || !token || !prescriptionId) return;
    try {
      setStewardshipLoadingId(prescriptionId);
      await pharmacyApi.generateHighRiskMedicationReview({ prescriptionId }, token, tenantSlug);
      await loadStewardshipReviews();
      showSuccess('Stewardship review generated', 'High-risk medication review was added to the stewardship queue.');
    } catch (error) {
      console.error('Failed to generate stewardship review', error);
      showError('Stewardship', 'Unable to generate the stewardship review right now.');
    } finally {
      setStewardshipLoadingId(null);
    }
  };

  const runCopilot = async () => {
    if (!copilotQuery.trim()) return;
    if (!tenantSlug || !token) return;
    setCopilotLoading(true);
    try {
      const context = 'Pharmacy operations, antimicrobial stewardship, medication safety, stock management, formulary governance';
      const response = await cdssApi.searchGuidelines(`${context}: ${copilotQuery}`, token, tenantSlug, 5);
      setCopilotResults(response?.data?.citations || []);
    } catch (error) {
      console.error('Failed to run pharmacy copilot search', error);
      showError('Copilot', 'Unable to retrieve pharmacy guidance right now.');
    } finally {
      setCopilotLoading(false);
    }
  };

  const totalItems = inventory.length;
  const lowStockCount = lowStockItems.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const pendingOrders = purchaseOrders.filter(po => po.status === 'draft' || po.status === 'pending').length;
  const pendingPrescriptionCount = pendingPrescriptions.length;
  const pendingRxWithStock = pendingPrescriptions.filter((rx) => !!rx.stockAvailability?.available).length;
  const linkedPatientsCount = new Set(
    pendingPrescriptions
      .map((rx) => rx.patient_id || rx.patient_number)
      .filter(Boolean),
  ).size;
  const criticalForecasts = inventoryForecasts.filter((item) => item.shortageRisk === 'critical' || item.shortageRisk === 'high').length;
  const openAnomalies = dispensingAnomalies.filter((item) => item.status === 'open').length;
  const pendingStewardship = stewardshipReviews.filter((item) => item.reviewRequired && !item.reviewDate).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading pharmacy dashboard...</p>
        </div>
      </div>
    );
  }

  const tenantBasePath = `/ehr/${tenantSlug || ''}`;

  return (
    <AdminNavigationShell
      title="Pharmacy Management"
      subtitle="Inventory, dispensing, formulary, and clinical safety controls"
      portalLabel="Pharmacy workspace"
      headerTone="pharmacy"
      navigationItems={[
        { key: 'dashboard', label: 'Dashboard', path: `${tenantBasePath}/dashboard`, icon: BarChart3, exact: true },
        { key: 'pharmacy', label: 'Pharmacy', path: `${tenantBasePath}/pharmacy`, icon: Pill, exact: true },
        { key: 'settings', label: 'Profile Settings', path: `${tenantBasePath}/settings`, icon: Settings, exact: true },
      ]}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pharmacy Command</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Clinical Dispensing + Supply Intelligence</h2>
              <p className="text-sm text-slate-600 mt-1">
                Connected to shared patient records and prescription pipelines to keep medication flow accurate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCopilot((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  showCopilot ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <Brain className="w-4 h-4" />
                Copilot
              </button>
              <button
                onClick={loadDashboardData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pending Prescriptions</p>
              <p className="text-xl font-semibold text-slate-900">{pendingPrescriptionCount}</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ready To Dispense</p>
              <p className="text-xl font-semibold text-emerald-700">{pendingRxWithStock}</p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Patient Links (No Dupes)</p>
              <p className="text-xl font-semibold text-slate-900">{linkedPatientsCount}</p>
            </div>
          </div>
        </section>

        {showCopilot && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={copilotQuery}
                  onChange={(e) => setCopilotQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runCopilot()}
                  placeholder="Ask for dispensing safety, stewardship, stock policy, or formulary guidance..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <button
                onClick={runCopilot}
                disabled={copilotLoading || !copilotQuery.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
              >
                {copilotLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                Run
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {copilotResults.length === 0 ? (
                <p className="text-sm text-slate-500">Copilot results will appear here with references.</p>
              ) : (
                copilotResults.slice(0, 4).map((result: any, index: number) => (
                  <div key={`ph-copilot-${index}`} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {result.source || 'Guidance'}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">{result.text || result.content || 'No content.'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'dispensing', label: 'Dispensing', icon: Pill },
            { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart },
            { id: 'receipts', label: 'Receipts', icon: Receipt },
            { id: 'suppliers', label: 'Suppliers', icon: Users },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
            { id: 'shared-documents', label: 'Shared Documents', icon: FolderOpen, badge: sharedDocumentsCount },
            { id: 'mcaz-register', label: 'MCAZ Register', icon: Shield },
          ].map((tab: any) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition relative ${
                  activeTab === tab.id
                    ? 'text-emerald-700 border-b-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-violet-600 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Items"
                value={totalItems}
                icon={Package}
                accent="from-indigo-500 to-indigo-600"
                subtitle="Inventory items"
              />
              <StatCard
                title="Low Stock"
                value={lowStockCount}
                icon={AlertTriangle}
                accent="from-amber-500 to-amber-600"
                subtitle="Items below reorder level"
              />
              <StatCard
                title="Active Suppliers"
                value={activeSuppliers}
                icon={Users}
                accent="from-blue-500 to-blue-600"
                subtitle="Active suppliers"
              />
              <StatCard
                title="Pending Orders"
                value={pendingOrders}
                icon={ShoppingCart}
                accent="from-purple-500 to-purple-600"
                subtitle="Purchase orders"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Shortage Forecasts</h2>
                    <p className="text-sm text-slate-500">{criticalForecasts} high-risk stock signals</p>
                  </div>
                  <button
                    onClick={runInventoryForecasts}
                    disabled={forecastLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${forecastLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                <div className="space-y-3">
                  {inventoryForecasts.length === 0 ? (
                    <p className="text-sm text-slate-500">No persisted forecasts yet.</p>
                  ) : (
                    inventoryForecasts.slice(0, 4).map((forecast) => (
                      <div key={forecast.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{forecast.inventorySnapshot?.inventoryName || 'Inventory item'}</p>
                            <p className="text-xs text-slate-500">
                              Demand {forecast.projectedDemand} / {forecast.forecastHorizonDays}d
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            forecast.shortageRisk === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : forecast.shortageRisk === 'high'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {forecast.shortageRisk}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">
                          Recommended reorder: {forecast.recommendedOrderQuantity}
                          {forecast.daysUntilStockout ? ` • stockout in ~${forecast.daysUntilStockout} days` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Dispensing Anomalies</h2>
                    <p className="text-sm text-slate-500">{openAnomalies} open review items</p>
                  </div>
                  <button
                    onClick={runDispensingAnomalyScan}
                    disabled={anomalyLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${anomalyLoading ? 'animate-spin' : ''}`} />
                    Scan
                  </button>
                </div>
                <div className="space-y-3">
                  {dispensingAnomalies.length === 0 ? (
                    <p className="text-sm text-slate-500">No open dispensing anomalies yet.</p>
                  ) : (
                    dispensingAnomalies.slice(0, 4).map((anomaly) => (
                      <div key={anomaly.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{anomaly.medicationName}</p>
                            <p className="text-xs text-slate-500">{anomaly.anomalyType.replace(/_/g, ' ')}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            anomaly.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {anomaly.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{anomaly.rationale}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Stewardship Queue</h2>
                    <p className="text-sm text-slate-500">{pendingStewardship} review-required entries</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {pendingPrescriptions.slice(0, 4).map((prescription) => (
                    <div key={prescription.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{prescription.medication_name || prescription.medicationName || 'Prescription'}</p>
                          <p className="text-xs text-slate-500">
                            Patient {prescription.patient_number || prescription.patient_id || 'unknown'}
                          </p>
                        </div>
                        <button
                          onClick={() => runHighRiskReview(prescription.id)}
                          disabled={stewardshipLoadingId === prescription.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {stewardshipLoadingId === prescription.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                          Review
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPrescriptions.length === 0 && stewardshipReviews.length === 0 && (
                    <p className="text-sm text-slate-500">No pending stewardship work yet.</p>
                  )}
                  {stewardshipReviews.slice(0, 2).map((review) => (
                    <div key={review.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="font-medium text-slate-900">{review.antibioticName}</p>
                      <p className="text-xs text-slate-600 mt-1">{review.stewardshipRecommendation || 'Stewardship recommendation generated.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-2">Low Stock Alert</h3>
                    <p className="text-sm text-amber-700 mb-4">
                      {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} {lowStockCount !== 1 ? 'are' : 'is'} below reorder level
                    </p>
                    <div className="space-y-2">
                      {lowStockItems.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                          <div>
                            <p className="font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {item.quantity_on_hand} / {item.reorder_level} {item.unit_of_measure}
                            </p>
                          </div>
                          <button className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition">
                            Reorder
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Purchase Orders */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Recent Purchase Orders</h2>
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {purchaseOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-slate-500">
                        {order.supplier_name || 'Unknown Supplier'} • {new Date(order.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                ))}
                {purchaseOrders.length === 0 && (
                  <p className="text-center text-slate-500 py-8">No purchase orders yet</p>
                )}
              </div>
            </div>

            {/* Active Alerts */}
            {alerts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">Active Alerts</h2>
                  <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-4 rounded-lg ${
                        alert.severity === 'critical'
                          ? 'bg-red-50 border border-red-200'
                          : alert.severity === 'high'
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 mt-0.5 ${
                          alert.severity === 'critical'
                            ? 'text-red-600'
                            : alert.severity === 'high'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{alert.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <PharmacyInventory />
        )}

        {/* Dispensing Tab */}
        {activeTab === 'dispensing' && (
          <PharmacyDispensing />
        )}

        {/* Purchase Orders Tab */}
        {activeTab === 'orders' && (
          <PharmacyPurchaseOrders />
        )}

        {/* Receipts Tab */}
        {activeTab === 'receipts' && (
          <PharmacyReceipts />
        )}

        {activeTab === 'suppliers' && (
          <PharmacySuppliers />
        )}

        {activeTab === 'alerts' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">Alerts management coming soon</p>
          </div>
        )}

        {/* Shared Documents Tab */}
        {activeTab === 'shared-documents' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <SharedDocumentsList
              token={token}
              tenantSlug={tenantSlug || ''}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* MCAZ Controlled-Substance Register Tab — S219 */}
        {activeTab === 'mcaz-register' && (
          <McazRegisterTab tenantSlug={tenantSlug || ''} token={token} />
        )}
      </div>
    </AdminNavigationShell>
  );
};

// MCAZ controlled-substance (dangerous drugs) dispensing register with CSV export.
const McazRegisterTab: React.FC<{ tenantSlug: string; token: string }> = ({ tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [entries, setEntries] = useState<any[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', schedule: 'all' });

  const loadRegister = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const response = await mcazApi.getControlledRegister(tenantSlug, token, {
        from: filters.from || undefined,
        to: filters.to || undefined,
        schedule: filters.schedule,
      });
      setEntries(response.data?.entries || []);
      setTotalQuantity(response.data?.totalQuantity || 0);
    } catch (error: any) {
      showError('Failed to load register', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, filters, showError]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await mcazApi.exportControlledRegisterCsv(tenantSlug, token, {
        from: filters.from || undefined,
        to: filters.to || undefined,
        schedule: filters.schedule,
      });
      const { csv, filename } = response.data || {};
      const blob = new Blob([csv || ''], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'mcaz-controlled-register.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('Register exported', 'CSV downloaded');
    } catch (error: any) {
      showError('Failed to export register', error.response?.data?.message || 'Please try again');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" /> MCAZ Controlled-Substance Register
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Dangerous-drugs dispensing record for MCAZ inspection — controlled prescriptions only.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-slate-500 text-xs mb-1">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 py-10 text-center">Loading register…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-400 py-10 text-center">
          No controlled-substance dispensings in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-left border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Dispensing No</th>
                <th className="py-2 pr-3">Patient</th>
                <th className="py-2 pr-3">Medication</th>
                <th className="py-2 pr-3">Schedule</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3">Prescriber (Reg No)</th>
                <th className="py-2">Dispensed By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {entry.dispensingDate ? new Date(entry.dispensingDate).toLocaleDateString() : ''}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{entry.dispensingNumber}</td>
                  <td className="py-2 pr-3">
                    {entry.patientName}
                    {entry.patientNumber ? <span className="text-slate-400"> · {entry.patientNumber}</span> : null}
                  </td>
                  <td className="py-2 pr-3">{entry.medicationName}</td>
                  <td className="py-2 pr-3">
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                      {entry.schedule || 'Controlled'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{entry.quantityDispensed}</td>
                  <td className="py-2 pr-3">
                    {entry.prescriberName}
                    {entry.prescriberLicense ? <span className="text-slate-400"> ({entry.prescriberLicense})</span> : null}
                  </td>
                  <td className="py-2">{entry.dispenserName}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-slate-900">
                <td colSpan={5} className="py-2 pr-3 text-right">Total quantity</td>
                <td className="py-2 pr-3 text-right">{totalQuantity}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default PharmacyDashboard;
