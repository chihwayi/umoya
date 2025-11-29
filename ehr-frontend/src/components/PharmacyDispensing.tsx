import React, { useState, useEffect } from 'react';
import { pharmacyApi } from '../services/api';
import { useParams } from 'react-router-dom';

interface PendingPrescription {
  id: string;
  prescription_number: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  prescriber_name: string;
  medication_name: string;
  generic_name: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  route: string;
  quantity: number;
  instructions: string;
  indication: string;
  created_at: string;
  stockAvailability?: {
    available: boolean;
    quantityNeeded: number;
    quantityAvailable: number;
    matchingItems: Array<{
      id: string;
      name: string;
      genericName: string;
      quantityOnHand: number;
      unitPrice: number;
      expiryDate: string;
      batchNumber: string;
      hasSufficientStock: boolean;
    }>;
    message: string;
  };
}

const PharmacyDispensing: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);
  const [prescriptions, setPrescriptions] = useState<PendingPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<PendingPrescription | null>(null);
  const [dispensingItems, setDispensingItems] = useState<Array<{ inventoryId: string; quantityDispensed: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [dispensing, setDispensing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPendingPrescriptions();
  }, []);

  const loadPendingPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.getPendingPrescriptions(token!, tenantSlug!, { limit: 50 });
      setPrescriptions(response.data || []);
    } catch (err: any) {
      console.error('Failed to load pending prescriptions:', err);
      setError(err.response?.data?.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrescription = async (prescription: PendingPrescription) => {
    setSelectedPrescription(prescription);
    setError(null);
    
    // Load stock availability
    try {
      const response = await pharmacyApi.checkPrescriptionStock(prescription.id, token!, tenantSlug!);
      const stockInfo = response.data;
      
      // Auto-select matching items with sufficient stock
      const availableItems = stockInfo.matchingItems.filter((item: any) => item.hasSufficientStock);
      if (availableItems.length > 0) {
        const selectedItem = availableItems[0]; // Use first available item
        const quantityToDispense = Math.min(selectedItem.quantityOnHand, prescription.quantity);
        setDispensingItems([{
          inventoryId: selectedItem.id,
          quantityDispensed: quantityToDispense,
        }]);
      } else {
        setDispensingItems([]);
        setError('No sufficient stock available for this prescription');
      }
    } catch (err: any) {
      console.error('Failed to check stock:', err);
      setError(err.response?.data?.message || 'Failed to check stock availability');
    }
  };

  const handleDispense = async () => {
    if (!selectedPrescription || dispensingItems.length === 0) {
      setError('Please select inventory items to dispense');
      return;
    }

    try {
      setDispensing(true);
      setError(null);
      await pharmacyApi.dispensePrescription(
        selectedPrescription.id,
        {
          items: dispensingItems,
          paymentMethod,
          notes: notes || undefined,
        },
        token!,
        tenantSlug!,
      );
      
      // Success - reload prescriptions and reset form
      await loadPendingPrescriptions();
      setSelectedPrescription(null);
      setDispensingItems([]);
      setPaymentMethod('cash');
      setNotes('');
      alert('Prescription dispensed successfully!');
    } catch (err: any) {
      console.error('Failed to dispense prescription:', err);
      setError(err.response?.data?.message || 'Failed to dispense prescription');
    } finally {
      setDispensing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading pending prescriptions...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dispense Prescriptions</h2>
        <p className="text-gray-600">Select a pending prescription to dispense medications</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Prescriptions List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Prescriptions</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {prescriptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending prescriptions
              </div>
            ) : (
              prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  onClick={() => handleSelectPrescription(prescription)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPrescription?.id === prescription.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-800">{prescription.medication_name}</div>
                      <div className="text-sm text-gray-600">{prescription.patient_name} ({prescription.patient_number})</div>
                    </div>
                    <div className="text-xs text-gray-500">#{prescription.prescription_number || prescription.id?.slice(0, 8)}</div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Quantity:</span> {prescription.quantity} {prescription.form || 'units'}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Instructions:</span> {prescription.instructions || 'N/A'}
                  </div>
                  {prescription.stockAvailability && (
                    <div className={`mt-2 text-xs px-2 py-1 rounded ${
                      prescription.stockAvailability.available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {prescription.stockAvailability.message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dispensing Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Dispensing Details</h3>
          
          {selectedPrescription ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Patient:</span> {selectedPrescription.patient_name}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Medication:</span> {selectedPrescription.medication_name}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Prescribed Quantity:</span> {selectedPrescription.quantity} {selectedPrescription.form}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Instructions:</span> {selectedPrescription.instructions || 'N/A'}
                </div>
              </div>

              {selectedPrescription.stockAvailability && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Stock Availability</h4>
                  <div className="space-y-2">
                    {selectedPrescription.stockAvailability.matchingItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded ${
                          item.hasSufficientStock ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">{item.genericName}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Batch: {item.batchNumber} | Expiry: {new Date(item.expiryDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-800">
                              {item.quantityOnHand} units
                            </div>
                            <div className="text-xs text-gray-600">
                              ${item.unitPrice.toFixed(2)}/unit
                            </div>
                          </div>
                        </div>
                        {item.hasSufficientStock && (
                          <div className="mt-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={dispensingItems.some(di => di.inventoryId === item.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const quantity = Math.min(item.quantityOnHand, selectedPrescription.quantity);
                                    setDispensingItems([{
                                      inventoryId: item.id,
                                      quantityDispensed: quantity,
                                    }]);
                                  } else {
                                    setDispensingItems([]);
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">
                                Dispense {Math.min(item.quantityOnHand, selectedPrescription.quantity)} units
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="medical_aid">Medical Aid</option>
                  <option value="insurance">Insurance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any additional notes..."
                />
              </div>

              <button
                onClick={handleDispense}
                disabled={dispensing || dispensingItems.length === 0}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {dispensing ? 'Dispensing...' : 'Dispense Prescription'}
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select a prescription from the list to begin dispensing
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PharmacyDispensing;

