import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyApi, ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  DollarSign,
  Package,
  RefreshCw,
  FileText,
  Mail,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  order_number?: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date?: string;
  status: string;
  total_amount?: number;
  currency?: string;
  notes?: string;
  created_at: string;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_id?: string;
  drug_id?: string;
  quantity_ordered: number;
  unit_cost: number;
  expected_total_cost?: number;
  quantity_received?: number;
  notes?: string;
  inventory_name?: string;
  drug_name?: string;
}

interface Drug {
  id: string;
  genericName: string;
  brandNames: string[];
}

const PharmacyPurchaseOrders: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState({
    supplierId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    status: 'draft' as 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled',
    currency: 'USD',
    notes: '',
    items: [] as Array<{
      inventoryId?: string;
      drugId?: string;
      quantityOrdered: number;
      unitCost: number;
      notes?: string;
    }>,
  });

  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);
  const [filteredDrugs, setFilteredDrugs] = useState<Drug[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
    loadSuppliers();
    loadInventory();
  }, []);

  useEffect(() => {
    if (drugSearchTerm.length >= 2 && currentItemIndex !== null) {
      searchDrugs(drugSearchTerm);
    } else {
      setFilteredDrugs([]);
    }
  }, [drugSearchTerm, currentItemIndex]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.listPurchaseOrders(token, tenantSlug!, {
        limit: 100,
        status: filterStatus || undefined,
        supplierId: filterSupplier || undefined,
      });
      setOrders(response.data?.orders || []);
    } catch (error: any) {
      console.error('Failed to load purchase orders:', error);
      showError('Failed to load purchase orders', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await pharmacyApi.listSuppliers(token, tenantSlug!, { limit: 100 });
      setSuppliers(response.data?.suppliers || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const loadInventory = async () => {
    try {
      const response = await pharmacyApi.listInventory(token, tenantSlug!, { limit: 100 });
      setInventory(response.data?.inventory || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
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

  const handleOpenModal = (order?: PurchaseOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        supplierId: order.supplier_id,
        orderDate: order.order_date.split('T')[0],
        expectedDeliveryDate: order.expected_delivery_date ? order.expected_delivery_date.split('T')[0] : '',
        status: order.status as any,
        currency: order.currency || 'USD',
        notes: order.notes || '',
        items: order.items?.map(item => ({
          inventoryId: item.inventory_id,
          drugId: item.drug_id,
          quantityOrdered: item.quantity_ordered,
          unitCost: item.unit_cost,
          notes: item.notes,
        })) || [],
      });
    } else {
      setEditingOrder(null);
      setFormData({
        supplierId: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: '',
        status: 'draft',
        currency: 'USD',
        notes: '',
        items: [] as Array<{
        inventoryId?: string;
        drugId?: string;
        quantityOrdered: number;
        unitCost: number;
        notes?: string;
      }>,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setViewingOrder(null);
    setDrugSearchTerm('');
    setShowDrugDropdown(false);
    setCurrentItemIndex(null);
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const response = await pharmacyApi.getPurchaseOrder(orderId, token, tenantSlug!);
      setViewingOrder(response.data);
      setShowModal(true);
    } catch (error: any) {
      showError('Failed to load order', error.response?.data?.message || 'Please try again');
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { quantityOrdered: 1, unitCost: 0 }],
    }));
    setCurrentItemIndex(formData.items.length);
    setDrugSearchTerm('');
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSelectDrug = (drug: Drug, index: number) => {
    handleItemChange(index, 'drugId', drug.id);
    handleItemChange(index, 'inventoryId', undefined); // Clear inventory selection when drug selected
    setDrugSearchTerm(drug.brandNames?.[0] || drug.genericName);
    setShowDrugDropdown(false);
    setCurrentItemIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId) {
      showError('Validation Error', 'Please select a supplier');
      return;
    }
    if (formData.items.length === 0) {
      showError('Validation Error', 'Please add at least one item');
      return;
    }

    try {
      if (editingOrder) {
        await pharmacyApi.updatePurchaseOrder(editingOrder.id, formData, token, tenantSlug!);
        showSuccess('Purchase order updated successfully', 'success');
      } else {
        await pharmacyApi.createPurchaseOrder(formData, token, tenantSlug!);
        showSuccess('Purchase order created successfully', 'success');
      }
      handleCloseModal();
      loadOrders();
    } catch (error: any) {
      console.error('Failed to save purchase order:', error);
      showError('Failed to save purchase order', error.response?.data?.message || 'Please check your input');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'ordered': return 'bg-indigo-100 text-indigo-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return CheckCircle;
      case 'received': return CheckCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalAmount = formData.items.reduce((sum, item) => 
    sum + (item.quantityOrdered * item.unitCost), 0
  );

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Purchase Orders</h2>
          <p className="text-gray-600 mt-1">Manage supplier purchase orders</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              loadOrders();
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterSupplier}
            onChange={(e) => {
              setFilterSupplier(e.target.value);
              loadOrders();
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <button
            onClick={loadOrders}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No purchase orders found</p>
                    <button
                      onClick={() => handleOpenModal()}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Create your first order
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {order.order_number || `#${order.id.slice(0, 8)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.supplier_name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(order.order_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.expected_delivery_date 
                            ? new Date(order.expected_delivery_date).toLocaleDateString()
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.currency || 'USD'} {order.total_amount?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getStatusColor(order.status)}`}>
                          <StatusIcon className="w-3 h-3" />
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewOrder(order.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {order.status === 'draft' && (
                            <button
                              onClick={() => handleOpenModal(order)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Add/Edit/View Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {viewingOrder ? 'View Purchase Order' : editingOrder ? 'Edit Purchase Order' : 'New Purchase Order'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {viewingOrder ? (
              // View Mode
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
                    <p className="text-gray-900">{viewingOrder.order_number || `#${viewingOrder.id.slice(0, 8)}`}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(viewingOrder.status)}`}>
                      {viewingOrder.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <p className="text-gray-900">{viewingOrder.supplier_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                    <p className="text-gray-900">{new Date(viewingOrder.order_date).toLocaleDateString()}</p>
                  </div>
                </div>
                {viewingOrder.items && viewingOrder.items.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Items</h4>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unit Cost</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {viewingOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{item.inventory_name || item.drug_name || 'Unknown'}</td>
                            <td className="px-4 py-2">{item.quantity_ordered}</td>
                            <td className="px-4 py-2">${item.unit_cost.toFixed(2)}</td>
                            <td className="px-4 py-2">${(item.quantity_ordered * item.unit_cost).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              // Edit/Create Mode
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
                    <select
                      value={formData.supplierId}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                      required
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
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="ordered">Ordered</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Date *</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
                    <input
                      type="date"
                      value={formData.expectedDeliveryDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="USD">USD</option>
                      <option value="ZWL">ZWL</option>
                      <option value="ZAR">ZAR</option>
                    </select>
                  </div>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">Items *</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>
                  {formData.items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      No items added. Click "Add Item" to start.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.items.map((item, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Item {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Inventory Item / Drug</label>
                              <div className="space-y-2">
                                <select
                                  value={item.inventoryId || ''}
                                  onChange={(e) => {
                                    const selectedInventory = inventory.find(inv => inv.id === e.target.value);
                                    handleItemChange(index, 'inventoryId', e.target.value || undefined);
                                    if (selectedInventory) {
                                      handleItemChange(index, 'unitCost', parseFloat(selectedInventory.cost_per_unit || '0'));
                                    }
                                  }}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="">Select inventory item...</option>
                                  {inventory.map(inv => (
                                    <option key={inv.id} value={inv.id}>
                                      {inv.name || inv.drug_name} - Stock: {inv.quantity_on_hand}
                                    </option>
                                  ))}
                                </select>
                                <div className="text-xs text-gray-500">Or search for a drug to add new item:</div>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={drugSearchTerm}
                                    onChange={(e) => {
                                      setDrugSearchTerm(e.target.value);
                                      setCurrentItemIndex(index);
                                      setShowDrugDropdown(true);
                                    }}
                                    onFocus={() => {
                                      setCurrentItemIndex(index);
                                      if (item.drugId) {
                                        const selectedDrug = filteredDrugs.find(d => d.id === item.drugId);
                                        setDrugSearchTerm(selectedDrug?.brandNames?.[0] || selectedDrug?.genericName || '');
                                      }
                                    }}
                                    placeholder="Search for drug to add new item..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                  {showDrugDropdown && filteredDrugs.length > 0 && currentItemIndex === index && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {filteredDrugs.map(drug => (
                                        <button
                                          key={drug.id}
                                          type="button"
                                          onClick={() => handleSelectDrug(drug, index)}
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
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantityOrdered}
                                onChange={(e) => handleItemChange(index, 'quantityOrdered', parseInt(e.target.value) || 1)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost *</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) => handleItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
                              <input
                                type="text"
                                value={`${formData.currency} ${(item.quantityOrdered * item.unitCost).toFixed(2)}`}
                                disabled
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900">Total Amount:</span>
                          <span className="text-xl font-bold text-indigo-600">
                            {formData.currency} {totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {editingOrder ? 'Update' : 'Create'} Order
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyPurchaseOrders;

