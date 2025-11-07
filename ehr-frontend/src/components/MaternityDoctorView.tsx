import React, { useState, useEffect } from 'react';
import { Baby, Heart, AlertTriangle, Calendar, Stethoscope, FileText, TrendingUp, Filter, CheckCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface MaternityDoctorViewProps {
  tenantSlug: string;
  token: string;
}

export default function MaternityDoctorView({ tenantSlug, token }: MaternityDoctorViewProps) {
  const [highRiskPregnancies, setHighRiskPregnancies] = useState<any[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<any[]>([]);
  const [overdueANC, setOverdueANC] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'high-risk' | 'deliveries' | 'overdue'>('high-risk');
  const { showError } = useNotification();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'high-risk') {
        const res = await ehrApi.getHighRiskPregnancies(tenantSlug, token);
        setHighRiskPregnancies(res.data.pregnancies || []);
      } else if (activeTab === 'deliveries') {
        const res = await ehrApi.getUpcomingDeliveries(tenantSlug, token);
        setUpcomingDeliveries(res.data.deliveries || []);
      } else if (activeTab === 'overdue') {
        const res = await ehrApi.getOverdueANC(tenantSlug, token);
        setOverdueANC(res.data.pregnancies || []);
      }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maternity Referrals & High-Risk Cases</h2>
          <p className="text-sm text-gray-600 mt-1">Cases requiring physician attention</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('high-risk')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'high-risk'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              High-Risk Pregnancies ({highRiskPregnancies.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'deliveries'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Deliveries ({upcomingDeliveries.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
              activeTab === 'overdue'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue ANC Visits ({overdueANC.length})
            </div>
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {/* High-Risk Pregnancies */}
          {activeTab === 'high-risk' && (
            <div className="space-y-4">
              {highRiskPregnancies.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No high-risk pregnancies requiring attention</p>
                </div>
              ) : (
                highRiskPregnancies.map((pregnancy) => (
                  <div
                    key={pregnancy.id}
                    className="bg-white border-2 border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {pregnancy.patient_name}
                          </h3>
                          {getRiskBadge(pregnancy.risk_category)}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {pregnancy.patient_number} • Enrollment: {pregnancy.enrollment_number}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Gravida/Para:</span>
                            <p className="font-semibold">G{pregnancy.gravida} P{pregnancy.para}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">EDD:</span>
                            <p className="font-semibold">
                              {pregnancy.expected_delivery_date
                                ? formatDateToDDMMYYYY(pregnancy.expected_delivery_date)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Days to EDD:</span>
                            <p className="font-semibold">{pregnancy.days_to_edd || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">ANC Visits:</span>
                            <p className="font-semibold">{pregnancy.anc_visit_count || 0}/8</p>
                          </div>
                        </div>
                        {pregnancy.risk_factors && pregnancy.risk_factors.length > 0 && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm font-semibold text-red-900 mb-2">Risk Factors:</p>
                            <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                              {pregnancy.risk_factors.map((factor: any, idx: number) => (
                                <li key={idx}>{factor.factor_name || factor}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                          <FileText className="w-4 h-4 inline mr-1" />
                          View Chart
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                          <Stethoscope className="w-4 h-4 inline mr-1" />
                          Manage Case
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Upcoming Deliveries */}
          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              {upcomingDeliveries.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming deliveries in next 30 days</p>
                </div>
              ) : (
                upcomingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="bg-white border border-blue-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {delivery.patient_name}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            Due in {delivery.days_to_edd} days
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {delivery.patient_number} • EDD: {formatDateToDDMMYYYY(delivery.expected_delivery_date)}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Gravida/Para:</span>
                            <p className="font-semibold">G{delivery.gravida} P{delivery.para}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Risk Category:</span>
                            <p className="font-semibold">{getRiskBadge(delivery.risk_category)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last ANC:</span>
                            <p className="font-semibold">
                              {delivery.last_anc_visit_date
                                ? formatDateToDDMMYYYY(delivery.last_anc_visit_date)
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                          <Stethoscope className="w-4 h-4 inline mr-1" />
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Overdue ANC Visits */}
          {activeTab === 'overdue' && (
            <div className="space-y-4">
              {overdueANC.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">All patients are up-to-date with ANC visits</p>
                </div>
              ) : (
                overdueANC.map((pregnancy) => (
                  <div
                    key={pregnancy.id}
                    className="bg-white border-2 border-orange-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {pregnancy.patient_name}
                          </h3>
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                            {pregnancy.days_overdue} days overdue
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {pregnancy.patient_number} • Last visit: {formatDateToDDMMYYYY(pregnancy.last_visit_date)}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Next Visit Due:</span>
                            <p className="font-semibold">
                              {pregnancy.next_visit_date
                                ? formatDateToDDMMYYYY(pregnancy.next_visit_date)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">EDD:</span>
                            <p className="font-semibold">
                              {pregnancy.expected_delivery_date
                                ? formatDateToDDMMYYYY(pregnancy.expected_delivery_date)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">ANC Visits:</span>
                            <p className="font-semibold">{pregnancy.anc_visit_count || 0}/8</p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
                          <Stethoscope className="w-4 h-4 inline mr-1" />
                          Follow Up
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

