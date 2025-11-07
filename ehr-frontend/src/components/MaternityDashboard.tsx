import React, { useState, useEffect } from 'react';
import { Baby, Heart, AlertTriangle, Calendar, TrendingUp, Plus, Search, Filter } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import MaternityEnrollmentModal from './MaternityEnrollmentModal';

interface MaternityEnrollment {
  id: string;
  enrollment_number: string;
  patient_name: string;
  patient_number: string;
  phone: string;
  enrollment_date: string;
  expected_delivery_date: string;
  gestational_age_at_enrollment: number;
  gravida: number;
  para: number;
  risk_category: string;
  enrollment_status: string;
  days_to_edd: number;
  anc_visit_count: number;
  last_anc_visit_date: string;
}

interface MaternityDashboardProps {
  tenantSlug: string;
  token: string;
}

export default function MaternityDashboard({ tenantSlug, token }: MaternityDashboardProps) {
  const [enrollments, setEnrollments] = useState<MaternityEnrollment[]>([]);
  const [highRiskPregnancies, setHighRiskPregnancies] = useState<any[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'high-risk'>('active');
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load enrollments based on filter
      const enrollmentFilters: any = {};
      if (filter === 'active') {
        enrollmentFilters.status = 'active';
      } else if (filter === 'high-risk') {
        enrollmentFilters.status = 'active';
        enrollmentFilters.risk_category = 'high';
      }

      const enrollmentsRes = await ehrApi.getMaternityEnrollments(tenantSlug, token, enrollmentFilters);
      setEnrollments(enrollmentsRes.data.enrollments || []);

      // Load high-risk pregnancies
      const highRiskRes = await ehrApi.getHighRiskPregnancies(tenantSlug, token);
      setHighRiskPregnancies(highRiskRes.data.pregnancies || []);

      // Load upcoming deliveries
      const upcomingRes = await ehrApi.getUpcomingDeliveries(tenantSlug, token);
      setUpcomingDeliveries(upcomingRes.data.deliveries || []);

      // Load indicators
      const indicatorsRes = await ehrApi.getMaternityIndicators(tenantSlug, token);
      setIndicators(indicatorsRes.data);
    } catch (error) {
      console.error('Failed to load maternity data:', error);
      showError('Failed to load maternity data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (riskCategory: string) => {
    const styles = {
      low: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      high: 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[riskCategory as keyof typeof styles] || styles.low}`}>
        {riskCategory.toUpperCase()} RISK
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      transferred_out: 'bg-gray-100 text-gray-800',
      pregnancy_loss: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-pink-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Pregnancies</p>
              <p className="text-2xl font-bold text-pink-700">{indicators?.active_pregnancies || 0}</p>
            </div>
            <Baby className="w-8 h-8 text-pink-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk</p>
              <p className="text-2xl font-bold text-red-700">{highRiskPregnancies.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Due Soon (30 days)</p>
              <p className="text-2xl font-bold text-orange-700">{upcomingDeliveries.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Deliveries</p>
              <p className="text-2xl font-bold text-green-700">{indicators?.total_deliveries || 0}</p>
            </div>
            <Heart className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'active'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active Pregnancies
            </button>
            <button
              onClick={() => setFilter('high-risk')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'high-risk'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              High Risk ({highRiskPregnancies.length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => setShowEnrollmentModal(true)}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Enrollment</span>
          </button>
        </div>

        {/* Enrollments List */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading pregnancies...</p>
            </div>
          )}

          {!loading && enrollments.length === 0 && (
            <div className="text-center py-12">
              <Baby className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No enrollments found</p>
            </div>
          )}

          <div className="space-y-4">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                  enrollment.risk_category === 'high' ? 'border-red-300 bg-red-50' :
                  enrollment.risk_category === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                  'border-gray-200 hover:border-pink-400'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-bold text-lg text-gray-900">
                        {enrollment.patient_name} ({enrollment.patient_number})
                      </h4>
                      {getRiskBadge(enrollment.risk_category)}
                      {getStatusBadge(enrollment.enrollment_status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Enrollment #:</span>
                        <p className="font-medium font-mono">{enrollment.enrollment_number}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gravida/Para:</span>
                        <p className="font-medium">G{enrollment.gravida} P{enrollment.para}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">EDD:</span>
                        <p className="font-medium">
                          {enrollment.expected_delivery_date 
                            ? formatDateToDDMMYYYY(enrollment.expected_delivery_date)
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Days to EDD:</span>
                        <p className={`font-medium ${
                          enrollment.days_to_edd <= 30 ? 'text-orange-600 font-bold' :
                          enrollment.days_to_edd < 0 ? 'text-red-600 font-bold' : ''
                        }`}>
                          {enrollment.days_to_edd > 0 ? enrollment.days_to_edd : 'Overdue'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">ANC Visits:</span>
                        <p className={`font-medium ${
                          enrollment.anc_visit_count >= 4 ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {enrollment.anc_visit_count}/8
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Last ANC Visit:</span>
                        <p className="font-medium">
                          {enrollment.last_anc_visit_date 
                            ? formatDateToDDMMYYYY(enrollment.last_anc_visit_date)
                            : 'No visits yet'}
                        </p>
                      </div>
                      {enrollment.phone && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Phone:</span>
                          <p className="font-medium">{enrollment.phone}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="ml-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>

                {/* Alerts for upcoming delivery or overdue visits */}
                {enrollment.days_to_edd <= 30 && enrollment.days_to_edd > 0 && (
                  <div className="mt-3 bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">
                      Delivery expected in {enrollment.days_to_edd} days - Ensure delivery plan is in place
                    </span>
                  </div>
                )}

                {enrollment.days_to_edd < 0 && (
                  <div className="mt-3 bg-red-100 border border-red-300 rounded-lg p-3 flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-900">
                      OVERDUE - EDD was {Math.abs(enrollment.days_to_edd)} days ago - Immediate follow-up required
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {showEnrollmentModal && selectedPatient && (
        <MaternityEnrollmentModal
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          patientDateOfBirth={selectedPatient.dateOfBirth}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => {
            setShowEnrollmentModal(false);
            setSelectedPatient(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}

