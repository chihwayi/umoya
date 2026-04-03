import React, { useState, useEffect } from 'react';
import { Camera, Clock, AlertTriangle, User, FileText, CheckCircle, Eye, CreditCard, Lock, Search, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';

interface Study {
  id: string;
  accession_number: string;
  patient_name: string;
  patient_number: string;
  study_name: string;
  modality_name: string;
  modality_code: string;
  study_date: string;
  study_time: string;
  clinical_indication: string;
  priority: string;
  study_status: string;
  hours_pending: number | string | null;
  number_of_images: number;
  radiologist_name?: string;
  report_status?: string;
  order_status?: string;
  payment_status?: string;
  finance_transaction_id?: string | null;
  fee_amount?: number | string | null;
}

interface RadiologistWorklistProps {
  tenantSlug: string;
  token: string;
  userId: string;
  onOpenStudy?: (study: Study) => void;
}

export default function RadiologistWorklist({
  tenantSlug,
  token,
  userId,
  onOpenStudy,
}: RadiologistWorklistProps) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [myStudies, setMyStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'worklist' | 'my-studies'>('worklist');
  const { showSuccess, showError } = useNotification();

  // CDSS / Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  useEffect(() => {
    loadStudies();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadStudies, 60000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadStudies = async () => {
    try {
      setLoading(true);

      if (activeTab === 'worklist') {
        const response = await ehrApi.getRadiologistWorklist(tenantSlug, token);
        setStudies(response.data.studies || []);
      } else {
        const response = await ehrApi.getMyImagingStudies(tenantSlug, token);
        setMyStudies(response.data.studies || []);
      }
    } catch (error) {
      console.error('Failed to load studies:', error);
      showError('Failed to load studies', 'Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async (studyId: string) => {
    try {
      await ehrApi.assignRadiologist(tenantSlug, token, studyId, userId);
      showSuccess('Study assigned', 'This imaging study is now under your queue.');
      loadStudies();
    } catch (error) {
      console.error('Failed to assign study:', error);
      showError('Assignment failed', 'Unable to assign the study to you.');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      routine: 'bg-green-100 text-green-800 border-green-300',
      urgent: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      stat: 'bg-red-100 text-red-800 border-red-300 animate-pulse',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[priority as keyof typeof styles] || styles.routine}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: 'bg-blue-100 text-blue-800',
      awaiting_report: 'bg-yellow-100 text-yellow-800',
      reported: 'bg-purple-100 text-purple-800',
      signed: 'bg-green-100 text-green-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const currentList = activeTab === 'worklist' ? studies : myStudies;
  const urgentCount = studies.filter((s) => s.priority === 'stat' || s.priority === 'urgent').length;
  const myAssignedCount = myStudies.length;
  const awaitingPaymentCount = [...studies, ...myStudies].filter(
    (s) => s.payment_status === 'awaiting_payment' || s.order_status === 'awaiting_payment',
  ).length;

  const formatCurrency = (value?: number | string | null) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return null;
    return `$${numeric.toFixed(2)}`;
  };

  const handleViewStudy = (study: Study) => {
    const awaitingPayment =
      study.payment_status === 'awaiting_payment' || study.order_status === 'awaiting_payment';
    if (awaitingPayment) {
      showError(
        'Payment Pending',
        'Accounts must confirm payment before this study can be opened. Please coordinate with the finance team.',
      );
      return;
    }

    onOpenStudy?.(study);
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Radiologist Worklist</h2>
        <button
          onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            showGuidelineSearch 
              ? 'bg-purple-500/20 text-purple-700 border-purple-500/30' 
              : 'bg-white text-slate-500 border-slate-200 hover:text-purple-600 hover:border-purple-200'
          }`}
        >
          <Search size={16} />
          {showGuidelineSearch ? 'Hide Guidelines' : 'Imaging Guidelines'}
        </button>
      </div>

      {showGuidelineSearch && (
        <GuidelineSearchPanel
          searchFn={(q) => cdssApi.searchGuidelines(`Radiology, ACR Guidelines: ${q}`, token, tenantSlug)}
          contextLabel="Radiology"
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Worklist</p>
              <p className="text-2xl font-bold text-blue-700">{studies.length}</p>
            </div>
            <Camera className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Studies</p>
              <p className="text-2xl font-bold text-purple-700">{myAssignedCount}</p>
            </div>
            <User className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgent/STAT</p>
              <p className="text-2xl font-bold text-red-700">{urgentCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg TAT</p>
              <p className="text-2xl font-bold text-green-700">
                {studies.length > 0 ? (studies.reduce((sum, s) => sum + Number(s.hours_pending || 0), 0) / studies.length).toFixed(1) : '0'}h
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Awaiting Payment</p>
              <p className={`text-2xl font-bold ${awaitingPaymentCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {awaitingPaymentCount}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-xs text-amber-600 mt-2">
            Studies remain locked until Accounts confirms payment.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b px-6 py-3 flex space-x-4">
          <button
            onClick={() => setActiveTab('worklist')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'worklist'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-blue-600'
            }`}
          >
            <Camera className="w-4 h-4 inline mr-2" />
            Worklist ({studies.length})
          </button>
          <button
            onClick={() => setActiveTab('my-studies')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'my-studies'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-purple-600'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            My Studies ({myAssignedCount})
          </button>
        </div>

        {/* Studies List */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading studies...</p>
            </div>
          )}

          {!loading && currentList.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">No studies in {activeTab === 'worklist' ? 'worklist' : 'your queue'}</p>
            </div>
          )}

          <div className="space-y-3">
            {currentList.map((study) => {
              const awaitingPayment =
                study.payment_status === 'awaiting_payment' || study.order_status === 'awaiting_payment';
              const feeAmountFormatted = formatCurrency(study.fee_amount);
              const hoursPendingNumeric = Number(study.hours_pending);

              return (
              <div
                key={study.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  study.priority === 'stat'
                    ? 'border-red-400 bg-red-50'
                    : study.priority === 'urgent'
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 hover:border-blue-400'
                } ${awaitingPayment ? 'opacity-80' : 'hover:shadow-md'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-bold text-lg text-gray-900">
                        {study.patient_name} ({study.patient_number})
                      </h4>
                      {getPriorityBadge(study.priority)}
                      {getStatusBadge(study.study_status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Study:</span>
                        <p className="font-medium">{study.study_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Modality:</span>
                        <p className="font-medium">{study.modality_code}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Date:</span>
                        <p className="font-medium">{formatDateToDDMMYYYY(study.study_date)} {study.study_time?.substring(0, 5)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Accession:</span>
                        <p className="font-medium font-mono">{study.accession_number}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Images:</span>
                        <p className="font-medium">{study.number_of_images}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Time Pending:</span>
                        <p
                          className={`font-medium ${hoursPendingNumeric > 24 ? 'text-red-600' : ''}`}
                        >
                          {Number.isFinite(hoursPendingNumeric) ? hoursPendingNumeric.toFixed(1) : '—'}h
                        </p>
                      </div>
                      {feeAmountFormatted && (
                        <div>
                          <span className="text-gray-600">Estimated Fee:</span>
                          <p className="font-medium text-gray-800">{feeAmountFormatted}</p>
                        </div>
                      )}
                    </div>

                    {study.clinical_indication && (
                      <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm">
                          <span className="font-medium text-blue-900">Clinical Indication:</span>
                          <span className="text-blue-800 ml-2">{study.clinical_indication}</span>
                        </p>
                      </div>
                    )}

                    {study.radiologist_name && (
                      <div className="text-sm text-gray-600">
                        <User className="w-4 h-4 inline mr-1" />
                        Assigned to: {study.radiologist_name}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-2 ml-4">
                    {activeTab === 'worklist' && (
                      <button
                        onClick={() => handleAssignToMe(study.id)}
                        disabled={awaitingPayment}
                        className={`px-4 py-2 rounded-lg flex items-center space-x-2 whitespace-nowrap transition ${
                          awaitingPayment
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span>Assign to Me</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleViewStudy(study)}
                      disabled={awaitingPayment}
                      className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition ${
                        awaitingPayment
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{awaitingPayment ? 'Locked' : 'View Study'}</span>
                    </button>
                  </div>
                </div>

                {awaitingPayment && (
                  <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-700 space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Lock className="w-4 h-4" />
                      Awaiting payment confirmation
                    </div>
                    <p>
                      Finance must release this study before reporting can begin. Notify Accounts if the patient has paid.
                    </p>
                    {study.finance_transaction_id && (
                      <p className="text-xs text-amber-600">
                        Finance reference: <span className="font-mono">{study.finance_transaction_id}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Urgent Indicator */}
                {study.priority === 'stat' && (
                  <div className="mt-3 bg-red-700 text-white p-2 rounded-lg flex items-center space-x-2 animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-bold">STAT - IMMEDIATE READING REQUIRED</span>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-gray-500">
        <Clock className="w-3 h-3 inline mr-1" />
        Auto-refreshing every 60 seconds
      </div>
    </div>
  );
}

