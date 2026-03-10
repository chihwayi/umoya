import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Clock,
} from 'lucide-react';
import { useConfirmation } from '../hooks/useConfirmation';

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  payment_terms?: string;
  tax_id?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface SupplierStatistics {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_date?: string;
  recentOrders?: Array<{
    id: string;
    order_number?: string;
    order_date: string;
    status: string;
    total_amount: number;
  }>;
}

const PharmacySuppliers: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const { confirm, Dialog } = useConfirmation();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierStats, setSupplierStats] = useState<SupplierStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    paymentTerms: '',
    taxId: '',
    status: 'active' as 'active' | 'inactive',
    notes: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, [searchTerm, filterStatus]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.listSuppliers(token, tenantSlug!, {
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        limit: 100,
      });
      setSuppliers(response.data?.suppliers || []);
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
      showError('Failed to load suppliers', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierStats = async (supplierId: string) => {
    try {
      setLoadingStats(true);
      const response = await pharmacyApi.getSupplierStatistics(supplierId, token, tenantSlug!);
      setSupplierStats(response.data);
    } catch (error: any) {
      console.error('Failed to load supplier statistics:', error);
      // Don't show error, just log it
    } finally {
      setLoadingStats(false);
    }
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactPerson: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || '',
        paymentTerms: supplier.payment_terms || '',
        taxId: supplier.tax_id || '',
        status: supplier.status,
        notes: supplier.notes || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        paymentTerms: '',
        taxId: '',
        status: 'active',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setViewingSupplier(null);
    setSupplierStats(null);
  };

  const handleViewSupplier = async (supplier: Supplier) => {
    setViewingSupplier(supplier);
    setShowModal(true);
    await loadSupplierStats(supplier.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showError('Validation Error', 'Supplier name is required');
      return;
    }

    try {
      if (editingSupplier) {
        await pharmacyApi.updateSupplier(editingSupplier.id, formData, token, tenantSlug!);
        showSuccess('Supplier updated successfully', 'success');
      } else {
        await pharmacyApi.createSupplier(formData, token, tenantSlug!);
        showSuccess('Supplier created successfully', 'success');
      }
      handleCloseModal();
      loadSuppliers();
    } catch (error: any) {
      console.error('Failed to save supplier:', error);
      showError('Failed to save supplier', error.response?.data?.message || 'Please check your input');
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    const shouldProceed = await confirm({
      title: 'Delete Supplier',
      message: `Are you sure you want to delete ${supplier.name}?`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      type: 'danger',
    });
    if (!shouldProceed) {
      return;
    }

    try {
      await pharmacyApi.deleteSupplier(supplier.id, token, tenantSlug!);
      showSuccess('Supplier deleted successfully', 'success');
      loadSuppliers();
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      showError('Failed to delete supplier', error.response?.data?.message || 'Please try again');
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    return status === 'active' ? CheckCircle : XCircle;
  };

  if (loading && suppliers.length === 0) {
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
          <h2 className="text-2xl font-bold text-gray-800">Supplier Management</h2>
          <p className="text-gray-600 mt-1">Manage your pharmacy suppliers and vendors</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No suppliers found</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-indigo-600 hover:text-indigo-900"
            >
              Create your first supplier
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {suppliers.map((supplier) => {
              const StatusIcon = getStatusIcon(supplier.status);
              return (
                <div key={supplier.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getStatusColor(supplier.status)}`}>
                          <StatusIcon className="w-3 h-3" />
                          {supplier.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-gray-600">
                        {supplier.contact_person && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{supplier.contact_person}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{supplier.email}</span>
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        {(supplier.city || supplier.country) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{[supplier.city, supplier.country].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                        {supplier.payment_terms && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>Terms: {supplier.payment_terms}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleViewSupplier(supplier)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(supplier)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit/View Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {viewingSupplier ? 'Supplier Details' : editingSupplier ? 'Edit Supplier' : 'New Supplier'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {viewingSupplier ? (
              // View Mode
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <p className="text-gray-900">{viewingSupplier.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(viewingSupplier.status)}`}>
                        {viewingSupplier.status}
                      </span>
                    </div>
                    {viewingSupplier.contact_person && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                        <p className="text-gray-900">{viewingSupplier.contact_person}</p>
                      </div>
                    )}
                    {viewingSupplier.email && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{viewingSupplier.email}</p>
                      </div>
                    )}
                    {viewingSupplier.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">{viewingSupplier.phone}</p>
                      </div>
                    )}
                    {viewingSupplier.tax_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                        <p className="text-gray-900">{viewingSupplier.tax_id}</p>
                      </div>
                    )}
                  </div>
                  {(viewingSupplier.address || viewingSupplier.city || viewingSupplier.country) && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <p className="text-gray-900">
                        {[viewingSupplier.address, viewingSupplier.city, viewingSupplier.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {viewingSupplier.payment_terms && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                      <p className="text-gray-900">{viewingSupplier.payment_terms}</p>
                    </div>
                  )}
                  {viewingSupplier.notes && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{viewingSupplier.notes}</p>
                    </div>
                  )}
                </div>

                {/* Statistics */}
                {supplierStats && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Performance Statistics</h4>
                    {loadingStats ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <ShoppingCart className="w-5 h-5" />
                            <span className="text-sm font-medium">Total Orders</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{supplierStats.total_orders || 0}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2 text-green-600 mb-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{supplierStats.completed_orders || 0}</p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-600 mb-2">
                            <Clock className="w-5 h-5" />
                            <span className="text-sm font-medium">Pending</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{supplierStats.pending_orders || 0}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2 text-purple-600 mb-2">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-sm font-medium">Total Spent</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            ${parseFloat(supplierStats.total_spent?.toString() || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-4 bg-indigo-50 rounded-lg">
                          <div className="flex items-center gap-2 text-indigo-600 mb-2">
                            <TrendingUp className="w-5 h-5" />
                            <span className="text-sm font-medium">Avg Order</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            ${parseFloat(supplierStats.avg_order_value?.toString() || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        {supplierStats.last_order_date && (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                              <Calendar className="w-5 h-5" />
                              <span className="text-sm font-medium">Last Order</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(supplierStats.last_order_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {supplierStats.recentOrders && supplierStats.recentOrders.length > 0 && (
                      <div className="mt-6">
                        <h5 className="font-medium text-gray-900 mb-3">Recent Orders</h5>
                        <div className="space-y-2">
                          {supplierStats.recentOrders.map((order) => (
                            <div key={order.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-900">{order.order_number || `Order #${order.id.slice(0, 8)}`}</span>
                                <span className="text-sm text-gray-600 ml-2">
                                  {new Date(order.order_date).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">${parseFloat(order.total_amount?.toString() || '0').toFixed(2)}</span>
                                <span className={`px-2 py-1 text-xs rounded ${
                                  order.status === 'received' ? 'bg-green-100 text-green-800' :
                                  order.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Create/Edit Mode
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                    <input
                      type="text"
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      placeholder="e.g., Net 30, COD"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
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
                    {editingSupplier ? 'Update Supplier' : 'Create Supplier'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default PharmacySuppliers;
