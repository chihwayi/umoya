import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  Receipt,
  Pill,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  Search,
  Filter,
  RefreshCw,
  LogOut,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  FileText,
  Settings,
  BarChart3,
  FolderOpen,
  X,
} from 'lucide-react';
import { pharmacyApi, ehrApi, tenantApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import PharmacyDispensing from '../components/PharmacyDispensing';
import PharmacyInventory from '../components/PharmacyInventory';
import PharmacyPurchaseOrders from '../components/PharmacyPurchaseOrders';
import PharmacyReceipts from '../components/PharmacyReceipts';
import PharmacySuppliers from '../components/PharmacySuppliers';
import SharedDocumentsList from '../components/SharedDocumentsList';

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
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'orders' | 'receipts' | 'suppliers' | 'alerts' | 'dispensing' | 'shared-documents'>('overview');
  const [showSharedDocumentsModal, setShowSharedDocumentsModal] = useState(false);
  const [sharedDocumentsCount, setSharedDocumentsCount] = useState(0);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

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

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantApi.getTenantBySlug(tenantSlug!);
        if (response.data) {
          setTenantInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error);
      }
    };

    if (tenantSlug) {
      fetchTenantInfo();
    }
  }, [tenantSlug]);

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

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/ehr/${tenantSlug}`);
  };

  const totalInventoryValue = inventory.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity_on_hand || 0) * parseFloat(item.cost_per_unit || 0));
  }, 0);

  const totalItems = inventory.length;
  const lowStockCount = lowStockItems.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const pendingOrders = purchaseOrders.filter(po => po.status === 'draft' || po.status === 'pending').length;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              {tenantInfo?.logoUrl && (
                <div className="h-12 w-12 bg-white p-1 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                  <img 
                    src={tenantInfo.logoUrl} 
                    alt={`${tenantInfo.clinicName} Logo`} 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Pharmacy Management
                </h1>
                <p className="text-sm text-slate-500">Inventory, orders, and dispensing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          ].map((tab: any) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition relative ${
                  activeTab === tab.id
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
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
        {/* Old Inventory Tab - keeping for reference but replaced above */}
        {false && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventory
                      .filter((item) =>
                        searchTerm
                          ? item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                          : true
                      )
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-slate-900">{item.name}</p>
                              {item.generic_name && (
                                <p className="text-sm text-slate-500">{item.generic_name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {item.sku || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {item.quantity_on_hand} {item.unit_of_measure || 'units'}
                              </p>
                              {item.quantity_on_hand <= item.reorder_level && (
                                <p className="text-xs text-amber-600">Low stock</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            ${parseFloat(item.cost_per_unit || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : item.status === 'expired'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button className="text-indigo-600 hover:text-indigo-700 font-medium">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {inventory.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No inventory items found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
      </div>
    </div>
  );
};

export default PharmacyDashboard;

