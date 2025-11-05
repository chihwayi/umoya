import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Plus, RefreshCw } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface HIVStockManagementProps {
  tenantSlug: string;
}

const HIVStockManagement: React.FC<HIVStockManagementProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    loadStock();
  }, [filterType, showLowStock]);

  const loadStock = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const query: any = {};
      if (filterType !== 'all') query.medicationType = filterType;
      if (showLowStock) query.lowStock = true;

      const response = await ehrApi.getMedicationStock(query, token, tenantSlug);
      setStock(response.data.stock || []);
    } catch (error) {
      console.error('Failed to load stock:', error);
      showError('Error', 'Failed to load medication stock');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item: any) => {
    if (item.current_stock <= 0) return { color: 'bg-red-100 text-red-800', label: 'Out of Stock', icon: AlertTriangle };
    if (item.current_stock <= item.reorder_level) return { color: 'bg-orange-100 text-orange-800', label: 'Low Stock', icon: AlertTriangle };
    if (item.current_stock <= item.minimum_stock_level) return { color: 'bg-yellow-100 text-yellow-800', label: 'Below Minimum', icon: TrendingDown };
    return { color: 'bg-green-100 text-green-800', label: 'In Stock', icon: CheckCircle };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-emerald-600" />
            Medication Stock Management
          </h2>
          <button
            onClick={loadStock}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Medications</option>
            <option value="arv">ARV</option>
            <option value="prophylaxis">Prophylaxis</option>
            <option value="tpt">TPT</option>
            <option value="other">Other</option>
          </select>
          <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* Stock List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading stock levels...</p>
        </div>
      ) : stock.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Stock Items Found</h3>
          <p className="text-slate-500">Add medication stock items to begin tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stock.map((item) => {
            const status = getStockStatus(item);
            const StatusIcon = status.icon;
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{item.medication_name}</h3>
                    <p className="text-sm text-slate-600">{item.medication_code || 'N/A'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">Current Stock</span>
                      <span className="text-2xl font-bold text-slate-900">{item.current_stock}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.unit_of_measure || 'units'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-600">Reorder Level</p>
                      <p className="font-semibold text-slate-900">{item.reorder_level}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Minimum Level</p>
                      <p className="font-semibold text-slate-900">{item.minimum_stock_level}</p>
                    </div>
                  </div>

                  {item.expiry_date && (
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-600">Expiry Date</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(item.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HIVStockManagement;

