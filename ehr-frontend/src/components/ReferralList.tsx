import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, Send, CheckCircle, XCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ReferralForm from './ReferralForm';
import ReferralViewer from './ReferralViewer';

interface ReferralListProps {
  patientId?: string;
  tenantSlug: string;
  token: string;
}

const ReferralList: React.FC<ReferralListProps> = ({ patientId, tenantSlug, token }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [filteredReferrals, setFilteredReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadReferrals();
  }, [patientId, statusFilter, typeFilter]);

  useEffect(() => {
    filterReferrals();
  }, [referrals, searchTerm]);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (patientId) filters.patientId = patientId;
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.referralType = typeFilter;

      const response = await ehrApi.getReferrals(filters, token, tenantSlug);
      const data = Array.isArray(response.data) ? response.data : [];
      setReferrals(data);
    } catch (error: any) {
      console.error('Failed to load referrals:', error);
      showError('Error', 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const filterReferrals = () => {
    if (!Array.isArray(referrals)) {
      setFilteredReferrals([]);
      return;
    }

    if (!searchTerm) {
      setFilteredReferrals(referrals);
      return;
    }

    const filtered = referrals.filter((ref) =>
      ref.patient_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.patient_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.referred_to_facility_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredReferrals(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 border-gray-300',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      sent: 'bg-blue-100 text-blue-800 border-blue-300',
      acknowledged: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      scheduled: 'bg-purple-100 text-purple-800 border-purple-300',
      in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      rejected: 'bg-orange-100 text-orange-800 border-orange-300',
      expired: 'bg-slate-100 text-slate-800 border-slate-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-slate-600',
      normal: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600',
    };
    return colors[priority] || 'text-slate-600';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handleNewReferral = async () => {
    if (!patientId) {
      showError('Error', 'Please select a patient first');
      return;
    }
    try {
      const res = await ehrApi.getPatientById(patientId, token, tenantSlug);
      const p = res.data;
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient';
      setSelectedPatient({ id: patientId, name });
    } catch {
      setSelectedPatient({ id: patientId, name: 'Patient' });
    }
    setSelectedReferral(null);
    setShowForm(true);
  };

  const handleEdit = (referral: any) => {
    setSelectedReferral(referral);
    setSelectedPatient({
      id: referral.patient_id,
      name: `${referral.patient_first_name} ${referral.patient_last_name}`,
    });
    setShowForm(true);
  };

  const handleView = (referral: any) => {
    setSelectedReferral(referral);
    setShowViewer(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Referrals</h2>
            <p className="text-blue-100 text-sm mt-1">Manage patient referrals</p>
          </div>
          {patientId && (
            <button
              onClick={handleNewReferral}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              New Referral
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search referrals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="specialist">Specialist</option>
            <option value="laboratory">Laboratory</option>
            <option value="imaging">Imaging</option>
            <option value="surgery">Surgery</option>
            <option value="therapy">Therapy</option>
            <option value="mental_health">Mental Health</option>
            <option value="cardiology">Cardiology</option>
            <option value="oncology">Oncology</option>
          </select>
        </div>
      </div>

      {/* Referrals List */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium mb-2">No referrals found</p>
            <p className="text-sm text-slate-400">
              {patientId ? 'Create a new referral to get started' : 'Select a patient to view their referrals'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReferrals.map((referral) => (
              <div
                key={referral.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {!patientId && (
                        <h3 className="text-lg font-semibold text-slate-800">
                          {referral.patient_first_name} {referral.patient_last_name}
                        </h3>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(referral.status)}`}>
                        {referral.status}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(referral.priority)}`}>
                        {referral.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>
                        <span className="font-medium">To:</span> {referral.referred_to_facility_name}
                      </p>
                      <p>
                        <span className="font-medium">Type:</span> {referral.referral_type.replace('_', ' ')}
                        {referral.specialty && ` - ${referral.specialty}`}
                      </p>
                      <p>
                        <span className="font-medium">Date:</span> {formatDate(referral.referral_date)}
                      </p>
                      <p className="text-slate-700 mt-2">{referral.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleView(referral)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(referral.status === 'draft' || referral.status === 'pending') && (
                      <button
                        onClick={() => handleEdit(referral)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && selectedPatient && (
        <ReferralForm
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          referral={selectedReferral}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowForm(false);
            setSelectedReferral(null);
            setSelectedPatient(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setSelectedReferral(null);
            setSelectedPatient(null);
            loadReferrals();
          }}
        />
      )}

      {showViewer && selectedReferral && (
        <ReferralViewer
          referralId={selectedReferral.id}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowViewer(false);
            setSelectedReferral(null);
          }}
          onUpdate={() => {
            loadReferrals();
          }}
        />
      )}
    </div>
  );
};

export default ReferralList;

