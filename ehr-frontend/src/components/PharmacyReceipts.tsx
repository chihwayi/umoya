import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import {
  Receipt,
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface ReceiptRecord {
  id: string;
  receipt_number?: string;
  purchase_order_id: string;
  order_number?: string;
  receipt_date: string;
  received_by?: string;
  verified_by?: string;
  status: string;
  notes?: string;
  created_at: string;
  items?: ReceiptItem[];
}

interface ReceiptItem {
  id: string;
  receipt_id: string;
  inventory_id: string;
  purchase_order_item_id?: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  unit_cost: number;
  condition: string;
  notes?: string;
  inventory_name?: string;
  sku?: string;
}

interface PurchaseOrder {
  id: string;
  order_number?: string;
  supplier_name?: string;
  items?: Array<{
    id: string;
    inventory_id?: string;
    quantity_ordered: number;
    quantity_received?: number;
    unit_cost: number;
    inventory_name?: string;
  }>;
}

const PharmacyReceipts: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptRecord | null>(null);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [formData, setFormData] = useState({
    purchaseOrderId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    status: 'pending' as 'pending' | 'verified' | 'rejected',
    notes: '',
    items: [] as Array<{
      inventoryId: string;
      purchaseOrderItemId?: string;
      quantityReceived: number;
      quantityAccepted: number;
      quantityRejected: number;
      unitCost: number;
      condition: 'good' | 'damaged' | 'expired' | 'short_supply';
      batchNumber?: string;
      expiryDate?: string;
      notes?: string;
    }>,
  });

  useEffect(() => {
    loadReceipts();
    loadPurchaseOrders();
  }, [filterStatus]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.listReceipts(token, tenantSlug!, {
        limit: 100,
        status: filterStatus || undefined,
      });
      setReceipts(response.data?.receipts || []);
    } catch (error: any) {
      console.error('Failed to load receipts:', error);
      // If listReceipts doesn't exist yet, just show empty list
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const response = await pharmacyApi.listPurchaseOrders(token, tenantSlug!, {
        status: 'ordered',
        limit: 100,
      });
      setPurchaseOrders(response.data?.orders || []);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    }
  };

  const handleOpenModal = (purchaseOrder?: PurchaseOrder) => {
    if (purchaseOrder) {
      setSelectedPurchaseOrder(purchaseOrder);
      setFormData({
        purchaseOrderId: purchaseOrder.id,
        receiptDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: '',
        items: purchaseOrder.items?.map(item => ({
          inventoryId: item.inventory_id || '',
          purchaseOrderItemId: item.id,
          quantityReceived: item.quantity_ordered - (item.quantity_received || 0),
          quantityAccepted: item.quantity_ordered - (item.quantity_received || 0),
          quantityRejected: 0,
          unitCost: item.unit_cost,
          condition: 'good' as const,
        })) || [],
      });
    } else {
      setSelectedPurchaseOrder(null);
      setFormData({
        purchaseOrderId: '',
        receiptDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: '',
        items: [],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setViewingReceipt(null);
    setSelectedPurchaseOrder(null);
  };

  const handleViewReceipt = async (receiptId: string) => {
    try {
      const response = await pharmacyApi.getReceipt(receiptId, token, tenantSlug!);
      setViewingReceipt(response.data);
      setShowModal(true);
    } catch (error: any) {
      showError('Failed to load receipt', error.response?.data?.message || 'Please try again');
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          // Auto-calculate accepted based on received and rejected
          if (field === 'quantityReceived' || field === 'quantityRejected') {
            updated.quantityAccepted = updated.quantityReceived - updated.quantityRejected;
          }
          return updated;
        }
        return item;
      }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.purchaseOrderId) {
      showError('Validation Error', 'Please select a purchase order');
      return;
    }
    if (formData.items.length === 0) {
      showError('Validation Error', 'Please add at least one item');
      return;
    }

    try {
      await pharmacyApi.createReceipt(formData, token, tenantSlug!);
      showSuccess('Receipt created successfully. Inventory updated.', 'success');
      handleCloseModal();
      loadReceipts();
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Failed to create receipt:', error);
      showError('Failed to create receipt', error.response?.data?.message || 'Please check your input');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return CheckCircle;
      case 'rejected': return XCircle;
      default: return Clock;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'short_supply': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && receipts.length === 0) {
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
          <h2 className="text-2xl font-bold text-gray-800">Goods Received Notes (GRN)</h2>
          <p className="text-gray-600 mt-1">Receive goods from purchase orders and update inventory</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Receipt
        </button>
      </div>

      {/* Purchase Orders Ready for Receipt */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Purchase Orders Ready for Receipt</h3>
        {purchaseOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p>No purchase orders ready for receipt</p>
            <p className="text-sm mt-2">Orders with status "ordered" will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {order.order_number || `Order #${order.id.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {order.supplier_name} • {order.items?.length || 0} items
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenModal(order)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipts History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Receipt History</h3>
        {receipts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p>No receipts found</p>
            <p className="text-sm mt-2">Receipts will appear here after you create them</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => {
              const StatusIcon = getStatusIcon(receipt.status);
              return (
                <div
                  key={receipt.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {receipt.receipt_number || `Receipt #${receipt.id.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        PO: {receipt.order_number} • {new Date(receipt.receipt_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getStatusColor(receipt.status)}`}>
                        <StatusIcon className="w-3 h-3" />
                        {receipt.status}
                      </span>
                      <button
                        onClick={() => handleViewReceipt(receipt.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/View Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {viewingReceipt ? 'View Receipt' : 'Create Goods Received Note'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {viewingReceipt ? (
              // View Mode
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                    <p className="text-gray-900">{viewingReceipt.receipt_number || `#${viewingReceipt.id.slice(0, 8)}`}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(viewingReceipt.status)}`}>
                      {viewingReceipt.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order</label>
                    <p className="text-gray-900">{viewingReceipt.order_number || viewingReceipt.purchase_order_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Date</label>
                    <p className="text-gray-900">{new Date(viewingReceipt.receipt_date).toLocaleDateString()}</p>
                  </div>
                </div>
                {viewingReceipt.items && viewingReceipt.items.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Received Items</h4>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Received</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Accepted</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rejected</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Condition</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {viewingReceipt.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{item.inventory_name || 'Unknown'}</td>
                            <td className="px-4 py-2">{item.quantity_received}</td>
                            <td className="px-4 py-2 text-green-600">{item.quantity_accepted}</td>
                            <td className="px-4 py-2 text-red-600">{item.quantity_rejected}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 text-xs rounded ${getConditionColor(item.condition)}`}>
                                {item.condition}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              // Create Mode
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Order *</label>
                    <select
                      value={formData.purchaseOrderId}
                      onChange={(e) => {
                        const selectedOrder = purchaseOrders.find(po => po.id === e.target.value);
                        setSelectedPurchaseOrder(selectedOrder || null);
                        setFormData(prev => ({
                          ...prev,
                          purchaseOrderId: e.target.value,
                          items: selectedOrder?.items?.map(item => ({
                            inventoryId: item.inventory_id || '',
                            purchaseOrderItemId: item.id,
                            quantityReceived: item.quantity_ordered - (item.quantity_received || 0),
                            quantityAccepted: item.quantity_ordered - (item.quantity_received || 0),
                            quantityRejected: 0,
                            unitCost: item.unit_cost,
                            condition: 'good' as const,
                          })) || [],
                        }));
                      }}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select purchase order...</option>
                      {purchaseOrders.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.order_number || `Order #${order.id.slice(0, 8)}`} - {order.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Date *</label>
                    <input
                      type="date"
                      value={formData.receiptDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, receiptDate: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Items Section */}
                {formData.items.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Received Items</h4>
                    <div className="space-y-4">
                      {formData.items.map((item, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Received *</label>
                              <input
                                type="number"
                                min="0"
                                value={item.quantityReceived}
                                onChange={(e) => handleItemChange(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Accepted</label>
                              <input
                                type="number"
                                min="0"
                                value={item.quantityAccepted}
                                onChange={(e) => handleItemChange(index, 'quantityAccepted', parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Rejected</label>
                              <input
                                type="number"
                                min="0"
                                value={item.quantityRejected}
                                onChange={(e) => handleItemChange(index, 'quantityRejected', parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Condition *</label>
                              <select
                                value={item.condition}
                                onChange={(e) => handleItemChange(index, 'condition', e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="good">Good</option>
                                <option value="damaged">Damaged</option>
                                <option value="expired">Expired</option>
                                <option value="short_supply">Short Supply</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) => handleItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                              <input
                                type="text"
                                value={item.batchNumber || ''}
                                onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                              <input
                                type="date"
                                value={item.expiryDate || ''}
                                onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                            <textarea
                              value={item.notes || ''}
                              onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                              rows={2}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    Create Receipt
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

export default PharmacyReceipts;

