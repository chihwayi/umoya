import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { Pill, Calendar, User, ArrowLeft, AlertCircle, Filter, CheckCircle, Clock, RefreshCw, AlertTriangle, Download, X, Send, Share2, Mail, MessageCircle, Camera, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const PrescriptionsPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showSuccess } = useNotification();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [refillRequests, setRefillRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [refillForm, setRefillForm] = useState({ requestedQuantity: '', reason: '', urgency: 'normal' });
  const [submittingRefill, setSubmittingRefill] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPrescriptionForShare, setSelectedPrescriptionForShare] = useState<any>(null);
  const [shareMethod, setShareMethod] = useState<'email' | 'whatsapp' | 'link'>('email');
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [selectedPrescriptionForPhoto, setSelectedPrescriptionForPhoto] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadPrescriptions();
    loadRefillRequests();
  }, [activeOnly]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading prescriptions...', { tenantSlug, activeOnly });
      const data = await patientPortalApi.getPrescriptions(token!, tenantSlug, activeOnly);
      console.log('Prescriptions response:', data, 'Type:', Array.isArray(data) ? 'array' : typeof data, 'Length:', Array.isArray(data) ? data.length : 'N/A');
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading prescriptions:', err);
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const loadRefillRequests = async () => {
    try {
      const data = await patientPortalApi.getRefillRequests(token!, tenantSlug);
      setRefillRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading refill requests:', err);
    }
  };

  const handleDownloadPrescription = async (prescriptionId: string) => {
    try {
      setDownloadingId(prescriptionId);
      await patientPortalApi.downloadPrescription(prescriptionId, token!, tenantSlug);
      showSuccess('Success', 'Prescription downloaded successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to download prescription');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSharePrescription = (prescription: any) => {
    setSelectedPrescriptionForShare(prescription);
    setShowShareModal(true);
  };

  const handleShare = async () => {
    if (!selectedPrescriptionForShare) return;

    try {
      setSharing(true);
      
      if (shareMethod === 'email' && shareEmail) {
        // In a real implementation, this would call an API to email the prescription
        // For now, we'll simulate it
        await new Promise(resolve => setTimeout(resolve, 1000));
        showSuccess('Success', `Prescription shared to ${shareEmail}`);
      } else if (shareMethod === 'whatsapp') {
        // Generate WhatsApp share link
        const message = encodeURIComponent(`Prescription: ${selectedPrescriptionForShare.medicationName}\nDosage: ${selectedPrescriptionForShare.dosage}\nFrequency: ${selectedPrescriptionForShare.frequency}`);
        window.open(`https://wa.me/?text=${message}`, '_blank');
        showSuccess('Success', 'Opening WhatsApp...');
      } else if (shareMethod === 'link') {
        // Generate shareable link
        const shareLink = `${window.location.origin}/${tenantSlug}/prescriptions/${selectedPrescriptionForShare.id}`;
        await navigator.clipboard.writeText(shareLink);
        showSuccess('Success', 'Link copied to clipboard!');
      }
      
      setShowShareModal(false);
      setSelectedPrescriptionForShare(null);
      setShareEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to share prescription');
    } finally {
      setSharing(false);
    }
  };

  const handlePhotoUpload = (prescription: any) => {
    setSelectedPrescriptionForPhoto(prescription);
    setShowPhotoUpload(true);
  };

  const handlePhotoSubmit = async () => {
    if (!photoFile || !selectedPrescriptionForPhoto) return;

    try {
      setUploadingPhoto(true);
      // In a real implementation, this would upload to a file storage service
      // and link it to the prescription for verification
      const formData = new FormData();
      formData.append('photo', photoFile);
      formData.append('prescriptionId', selectedPrescriptionForPhoto.id);
      
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showSuccess('Success', 'Medication photo uploaded successfully for verification');
      setShowPhotoUpload(false);
      setSelectedPrescriptionForPhoto(null);
      setPhotoFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRequestRefill = (prescription: any) => {
    setSelectedPrescription(prescription);
    setRefillForm({ requestedQuantity: prescription.quantity?.toString() || '', reason: '', urgency: 'normal' });
    setShowRefillModal(true);
  };

  const handleSubmitRefillRequest = async () => {
    if (!selectedPrescription) return;

    try {
      setSubmittingRefill(true);
      setError('');
      await patientPortalApi.createRefillRequest(
        selectedPrescription.id,
        {
          requestedQuantity: refillForm.requestedQuantity ? parseInt(refillForm.requestedQuantity) : undefined,
          reason: refillForm.reason || undefined,
          urgency: refillForm.urgency,
        },
        token!,
        tenantSlug,
      );
      setShowRefillModal(false);
      setSelectedPrescription(null);
      setRefillForm({ requestedQuantity: '', reason: '', urgency: 'normal' });
      await loadRefillRequests();
      showSuccess('Success', 'Refill request submitted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to submit refill request');
    } finally {
      setSubmittingRefill(false);
    }
  };

  const getRefillRequestStatus = (prescriptionId: string) => {
    const request = refillRequests.find((r) => r.prescriptionId === prescriptionId && r.status === 'pending');
    return request;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your prescriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
              <p className="text-sm text-gray-600">View your current and past medications</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-6 border border-white/20">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Show only active prescriptions</span>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {prescriptions.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-6 shadow-lg">
              <Pill className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Prescriptions</h3>
            <p className="text-gray-600">
              {activeOnly ? 'You don\'t have any active prescriptions.' : 'You don\'t have any prescriptions yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {prescriptions.map((prescription) => (
              <div
                key={prescription.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01]"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Pill className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">{prescription.medicationName}</h3>
                            {prescription.isDiabetesMedication && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400 shadow-sm">
                                Diabetes
                              </span>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(prescription.status)}`}>
                            {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleDownloadPrescription(prescription.id)}
                          disabled={downloadingId === prescription.id}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          <span>{downloadingId === prescription.id ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                        {prescription.status === 'active' && (
                          <>
                            {getRefillRequestStatus(prescription.id) ? (
                              <div className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl flex items-center gap-2 border border-yellow-200">
                                <Clock className="w-4 h-4" />
                                <span>Refill Pending</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRequestRefill(prescription)}
                                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors flex items-center gap-2 border border-purple-200 hover:border-purple-300"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>Request Refill</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-blue-600 mb-1 font-semibold">Dosage</p>
                        <p className="font-bold text-blue-900">
                          {prescription.dosage}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-green-600 mb-1 font-semibold">Frequency</p>
                        <p className="font-bold text-green-900">
                          {prescription.frequency}
                        </p>
                      </div>
                      {prescription.duration && (
                        <div className="bg-purple-50 rounded-xl p-4">
                          <p className="text-xs text-purple-600 mb-1 font-semibold">Duration</p>
                          <p className="font-bold text-purple-900">
                            {prescription.duration}
                          </p>
                        </div>
                      )}
                      {prescription.quantity && (
                        <div className="bg-orange-50 rounded-xl p-4">
                          <p className="text-xs text-orange-600 mb-1 font-semibold">Quantity</p>
                          <p className="font-bold text-orange-900">
                            {prescription.quantity}
                          </p>
                        </div>
                      )}
                    </div>

                    {prescription.instructions && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Instructions:
                        </p>
                        <p className="text-sm text-indigo-800">{prescription.instructions}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        {prescription.prescriber && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>
                              Dr. {prescription.prescriber.firstName} {prescription.prescriber.lastName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(prescription.prescribedDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Refill Request Modal */}
      {showRefillModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Request Refill</h2>
              <button
                onClick={() => {
                  setShowRefillModal(false);
                  setSelectedPrescription(null);
                  setRefillForm({ requestedQuantity: '', reason: '', urgency: 'normal' });
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <p className="text-sm font-semibold text-purple-900 mb-1">Medication</p>
              <p className="text-lg font-bold text-purple-900">{selectedPrescription.medicationName}</p>
              <p className="text-sm text-purple-700 mt-1">
                {selectedPrescription.dosage} • {selectedPrescription.frequency}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Requested Quantity (optional)
                </label>
                <input
                  type="number"
                  value={refillForm.requestedQuantity}
                  onChange={(e) => setRefillForm({ ...refillForm, requestedQuantity: e.target.value })}
                  placeholder={selectedPrescription.quantity?.toString() || 'Enter quantity'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={refillForm.reason}
                  onChange={(e) => setRefillForm({ ...refillForm, reason: e.target.value })}
                  placeholder="Why do you need a refill?"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Urgency
                </label>
                <select
                  value={refillForm.urgency}
                  onChange={(e) => setRefillForm({ ...refillForm, urgency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRefillModal(false);
                  setSelectedPrescription(null);
                  setRefillForm({ requestedQuantity: '', reason: '', urgency: 'normal' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRefillRequest}
                disabled={submittingRefill}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>{submittingRefill ? 'Submitting...' : 'Submit Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Prescription Modal */}
      {showShareModal && selectedPrescriptionForShare && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Share Prescription</h2>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedPrescriptionForShare(null);
                  setShareEmail('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-1">Medication</p>
              <p className="text-lg font-bold text-blue-900">{selectedPrescriptionForShare.medicationName}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Share Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShareMethod('email')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      shareMethod === 'email'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Mail className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">Email</span>
                  </button>
                  <button
                    onClick={() => setShareMethod('whatsapp')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      shareMethod === 'whatsapp'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">WhatsApp</span>
                  </button>
                  <button
                    onClick={() => setShareMethod('link')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      shareMethod === 'link'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Share2 className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">Link</span>
                  </button>
                </div>
              </div>

              {shareMethod === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleShare}
                  disabled={sharing || (shareMethod === 'email' && !shareEmail)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sharing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Share
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedPrescriptionForShare(null);
                    setShareEmail('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medication Photo Upload Modal */}
      {showPhotoUpload && selectedPrescriptionForPhoto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Upload Medication Photo</h2>
              <button
                onClick={() => {
                  setShowPhotoUpload(false);
                  setSelectedPrescriptionForPhoto(null);
                  setPhotoFile(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <p className="text-sm font-semibold text-purple-900 mb-1">Medication</p>
              <p className="text-lg font-bold text-purple-900">{selectedPrescriptionForPhoto.medicationName}</p>
              <p className="text-xs text-purple-700 mt-1">Upload a photo of your medication for verification</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Photo</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    {photoFile ? (
                      <div className="space-y-2">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                        <p className="text-sm font-medium text-gray-700">{photoFile.name}</p>
                        <p className="text-xs text-gray-500">Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-sm font-medium text-gray-700">Click to upload</p>
                        <p className="text-xs text-gray-500">JPG, PNG up to 5MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {photoFile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> This photo will be reviewed by your healthcare provider to verify medication compliance.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePhotoSubmit}
                  disabled={uploadingPhoto || !photoFile}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadingPhoto ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowPhotoUpload(false);
                    setSelectedPrescriptionForPhoto(null);
                    setPhotoFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionsPage;
