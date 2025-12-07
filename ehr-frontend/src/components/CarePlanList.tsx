import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, Trash2, FileText, X, CheckCircle, Clock, Activity, AlertCircle, Target } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import CarePlanBuilder from './CarePlanBuilder';
import CarePlanViewer from './CarePlanViewer';
import CarePlanTemplates from './CarePlanTemplates';
import ConfirmDialog from './ConfirmDialog';

interface CarePlan {
  id: string;
  patient_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  start_date: string;
  end_date?: string;
  target_completion_date?: string;
  primary_provider_id?: string;
  care_team?: string[];
  diagnosis_codes?: string[];
  notes?: string;
  goals: any[];
  interventions: any[];
  created_at: string;
}

interface CarePlanListProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const CarePlanList: React.FC<CarePlanListProps> = ({
  patientId,
  tenantSlug,
  token,
  onClose,
}) => {
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCarePlan, setSelectedCarePlan] = useState<CarePlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; carePlanId: string | null }>({
    open: false,
    carePlanId: null,
  });
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadCarePlans();
  }, [patientId, statusFilter]);

  const loadCarePlans = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;

      const response = await ehrApi.getCarePlans(patientId, filters, token, tenantSlug);
      setCarePlans(response.data || []);
    } catch (error: any) {
      console.error('Failed to load care plans:', error);
      showError('Error', 'Failed to load care plans');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.carePlanId) return;

    try {
      await ehrApi.deleteCarePlan(deleteConfirm.carePlanId, token, tenantSlug);
      showSuccess('Success', 'Care plan deleted successfully');
      setDeleteConfirm({ open: false, carePlanId: null });
      loadCarePlans();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to delete care plan');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'active':
        return <Activity className="w-5 h-5 text-blue-600" />;
      case 'on_hold':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'on_hold':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const filteredCarePlans = carePlans.filter((plan) =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6" />
              Care Plans
            </h2>
            <p className="text-teal-100 text-sm mt-1">Manage structured care plans for this patient</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 bg-white/10 text-white border border-white/30 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2 text-sm font-semibold"
            >
              <FileText className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={() => {
                setSelectedCarePlan(null);
                setShowBuilder(true);
              }}
              className="px-4 py-2 bg-white text-teal-600 rounded-lg hover:bg-teal-50 transition-colors flex items-center gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Care Plan
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search care plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Care Plans List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredCarePlans.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium mb-2">No care plans found</p>
            <p className="text-sm text-slate-400 mb-4">Create a care plan to start managing patient care</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Browse Templates
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCarePlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{plan.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-slate-600 text-sm mb-2">{plan.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Category: {plan.category.replace(/_/g, ' ')}</span>
                      <span>Started: {formatDate(plan.start_date)}</span>
                      {plan.target_completion_date && (
                        <span>Target: {formatDate(plan.target_completion_date)}</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-teal-600">
                        <Target className="w-4 h-4" />
                        {plan.goals?.length || 0} goals
                      </span>
                      <span className="flex items-center gap-1 text-cyan-600">
                        <Activity className="w-4 h-4" />
                        {plan.interventions?.length || 0} interventions
                      </span>
                      {plan.goals && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          {plan.goals.filter((g: any) => g.status === 'achieved').length} achieved
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCarePlan(plan);
                        setShowViewer(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCarePlan(plan);
                        setShowBuilder(true);
                      }}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, carePlanId: plan.id })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showBuilder && (
        <CarePlanBuilder
          patientId={patientId}
          carePlan={selectedCarePlan ? {
            ...selectedCarePlan,
            care_team: selectedCarePlan.care_team || [],
            diagnosis_codes: selectedCarePlan.diagnosis_codes || [],
            notes: selectedCarePlan.notes || '',
          } : null}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowBuilder(false);
            setSelectedCarePlan(null);
          }}
          onSave={() => {
            loadCarePlans();
          }}
        />
      )}

      {showViewer && selectedCarePlan && (
        <CarePlanViewer
          carePlanId={selectedCarePlan.id}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowViewer(false);
            setSelectedCarePlan(null);
          }}
          onEdit={() => {
            setShowViewer(false);
            setShowBuilder(true);
          }}
        />
      )}

      {showTemplates && (
        <CarePlanTemplates
          patientId={patientId}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => setShowTemplates(false)}
          onTemplateApplied={() => {
            loadCarePlans();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Care Plan"
        message="Are you sure you want to delete this care plan? This action cannot be undone and will remove all associated goals, interventions, and progress records."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, carePlanId: null })}
      />
    </div>
  );
};

export default CarePlanList;

