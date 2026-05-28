import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyApi, ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useConfirmation } from '../hooks/useConfirmation';

interface InventoryItem {
  id: string;
  name?: string;
  generic_name?: string;
  drug_name?: string;
  drug_generic_name?: string;
  sku?: string;
  barcode?: string;
  drug_id?: string;
  snomed_code?: string;
  snomed_term?: string;
  category?: string;
  unit_of_measure?: string;
  quantity_on_hand: number;
  reorder_level: number;
  max_stock_level?: number;
  cost_per_unit: number;
  selling_price: number;
  expiry_date?: string;
  batch_number?: string;
  location?: string;
  supplier_id?: string;
  supplier_name?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Drug {
  id: string;
  genericName: string;
  brandNames: string[];
}

const PharmacyInventory: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const [filteredDrugs, setFilteredDrugs] = useState<Drug[]>([]);

  const [formData, setFormData] = useState({
    drugId: '',
    name: '',
    genericName: '',
    sku: '',
    barcode: '',
    category: '',
    unitOfMeasure: 'unit',
    quantityOnHand: 0,
    reorderLevel: 10,
    maxStockLevel: undefined as number | undefined,
    costPerUnit: 0,
    sellingPrice: 0,
    expiryDate: '',
    batchNumber: '',
    location: '',
    supplierId: '',
    status: 'active' as 'active' | 'discontinued' | 'expired' | 'recalled',
    notes: '',
  });

  useEffect(() => {
    loadInventory();
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (drugSearchTerm.length >= 2) {
      searchDrugs(drugSearchTerm);
    } else {
      setFilteredDrugs([]);
    }
  }, [drugSearchTerm]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.listInventory(token!, tenantSlug!, {
        limit: 100,
        search: searchTerm || undefined,
        category: filterCategory || undefined,
        supplierId: filterSupplier || undefined,
        status: filterStatus || undefined,
      } as any);
      setInventory(response.data?.inventory || []);
    } catch (error: any) {
      console.error('Failed to load inventory:', error);
      showError('Failed to load inventory', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await pharmacyApi.listSuppliers(token!, tenantSlug!, { limit: 100 });
      setSuppliers(response.data?.suppliers || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const searchDrugs = async (term: string) => {
    try {
      const response = await ehrApi.searchDrugs(token, tenantSlug!, term);
      if (response.data) {
        setFilteredDrugs(response.data || []);
        setShowDrugDropdown(true);
      }
    } catch (error) {
      console.error('Failed to search drugs:', error);
      setFilteredDrugs([]);
    }
  };

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        drugId: item.drug_id || '',
        name: item.name || '',
        genericName: item.generic_name || '',
        sku: item.sku || '',
        barcode: item.barcode || '',
        category: item.category || '',
        unitOfMeasure: item.unit_of_measure || 'unit',
        quantityOnHand: item.quantity_on_hand || 0,
        reorderLevel: item.reorder_level || 10,
        maxStockLevel: item.max_stock_level,
        costPerUnit: parseFloat(item.cost_per_unit?.toString() || '0'),
        sellingPrice: parseFloat(item.selling_price?.toString() || '0'),
        expiryDate: item.expiry_date ? item.expiry_date.split('T')[0] : '',
        batchNumber: item.batch_number || '',
        location: item.location || '',
        supplierId: item.supplier_id || '',
        status: (item.status as any) || 'active',
        notes: item.notes || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        drugId: '',
        name: '',
        genericName: '',
        sku: '',
        barcode: '',
        category: '',
        unitOfMeasure: 'unit',
        quantityOnHand: 0,
        reorderLevel: 10,
        maxStockLevel: undefined,
        costPerUnit: 0,
        sellingPrice: 0,
        expiryDate: '',
        batchNumber: '',
        location: '',
        supplierId: '',
        status: 'active',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setDrugSearchTerm('');
    setShowDrugDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await pharmacyApi.updateInventory(editingItem.id, formData, token!, tenantSlug!);
        showSuccess('Success', 'Inventory item updated successfully');
      } else {
        await pharmacyApi.createInventory(formData, token!, tenantSlug!);
        showSuccess('Success', 'Inventory item created successfully');
      }
      handleCloseModal();
      loadInventory();
    } catch (error: any) {
      console.error('Failed to save inventory:', error);
      showError('Failed to save inventory', error.response?.data?.message || 'Please check your input');
    }
  };

  const handleDelete = async (id: string) => {
    const shouldProceed = await confirm({
      title: 'Delete Inventory Item',
      message: 'Are you sure you want to delete this inventory item?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'danger',
    });
    if (!shouldProceed) return;
    try {
      await pharmacyApi.deleteInventory(id, token!, tenantSlug!);
      showSuccess('Deleted', 'Inventory item has been deleted');
      loadInventory();
    } catch (error: any) {
      showError('Failed to delete', error.response?.data?.message || 'Please try again');
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity_on_hand === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50', icon: XCircle };
    if (item.quantity_on_hand <= item.reorder_level) return { label: 'Low Stock', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle };
    return { label: 'In Stock', color: 'text-green-600 bg-green-50', icon: CheckCircle };
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return { label: 'Expired', color: 'text-red-600 bg-red-50' };
    if (daysUntilExpiry <= 30) return { label: 'Expiring Soon', color: 'text-amber-600 bg-amber-50' };
    return null;
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const categories = Array.from(new Set(inventory.map(item => item.category).filter(Boolean)));

  if (loading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      {Dialog}
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
          <p className="text-gray-600 mt-1">Manage pharmacy inventory items</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="expired">Expired</option>
            <option value="recalled">Recalled</option>
          </select>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={loadInventory}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              const headers = ['Name', 'Generic Name', 'SKU', 'Batch', 'Expiry Date', 'Qty On Hand', 'Reorder Level', 'Unit Cost', 'Unit Price', 'Status'];
              const rows = inventory.map((item) => [
                item.name || item.drug_name || '',
                item.generic_name || item.drug_generic_name || '',
                item.sku || '',
                item.batch_number || '',
                item.expiry_date || '',
                item.quantity_on_hand ?? '',
                item.reorder_level ?? '',
                item.cost_per_unit ?? '',
                item.selling_price ?? '',
                item.status || '',
              ]);
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `pharmacy-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU/Barcode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inventory items found</p>
                    <button
                      onClick={() => handleOpenModal()}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Add your first item
                    </button>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const expiryStatus = getExpiryStatus(item.expiry_date);
                  const StockIcon = stockStatus.icon;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{item.name || item.drug_name || 'Unnamed Item'}</div>
                          <div className="text-sm text-gray-500">{item.generic_name || item.drug_generic_name}</div>
                          {item.category && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {item.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.sku || '-'}</div>
                        {item.barcode && (
                          <div className="text-xs text-gray-500">{item.barcode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.quantity_on_hand}</span>
                          <span className="text-sm text-gray-500">{item.unit_of_measure || 'units'}</span>
                        </div>
                        <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${stockStatus.color}`}>
                          <StockIcon className="w-3 h-3" />
                          {stockStatus.label}
                        </div>
                        {item.reorder_level > 0 && (
                          <div className="text-xs text-gray-500 mt-1">Reorder: {item.reorder_level}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900">${parseFloat(item.selling_price?.toString() || '0').toFixed(2)}</div>
                          <div className="text-gray-500">Cost: ${parseFloat(item.cost_per_unit?.toString() || '0').toFixed(2)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.expiry_date ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {new Date(item.expiry_date).toLocaleDateString()}
                            </div>
                            {item.batch_number && (
                              <div className="text-xs text-gray-500">Batch: {item.batch_number}</div>
                            )}
                            {expiryStatus && (
                              <div className={`mt-1 inline-block px-2 py-0.5 rounded text-xs ${expiryStatus.color}`}>
                                {expiryStatus.label}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${
                          item.status === 'active' ? 'bg-green-100 text-green-800' :
                          item.status === 'discontinued' ? 'bg-gray-100 text-gray-800' :
                          item.status === 'expired' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Drug Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Drug (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={drugSearchTerm}
                    onChange={(e) => {
                      setDrugSearchTerm(e.target.value);
                      setShowDrugDropdown(true);
                    }}
                    onFocus={() => setShowDrugDropdown(true)}
                    placeholder="Search for a drug..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {showDrugDropdown && filteredDrugs.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredDrugs.map(drug => (
                        <button
                          key={drug.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              drugId: drug.id,
                              name: drug.brandNames?.[0] || drug.genericName,
                              genericName: drug.genericName,
                            }));
                            setDrugSearchTerm(drug.brandNames?.[0] || drug.genericName);
                            setShowDrugDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100"
                        >
                          <div className="font-medium">{drug.brandNames?.[0] || drug.genericName}</div>
                          <div className="text-sm text-gray-500">{drug.genericName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    value={formData.genericName}
                    onChange={(e) => setFormData(prev => ({ ...prev, genericName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantityOnHand}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantityOnHand: parseInt(e.target.value) || 0 }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <select
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitOfMeasure: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="unit">Unit</option>
                    <option value="box">Box</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                    <option value="vial">Vial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, reorderLevel: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxStockLevel || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxStockLevel: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost per Unit *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="expired">Expired</option>
                    <option value="recalled">Recalled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingItem ? 'Update' : 'Create'} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default PharmacyInventory;
