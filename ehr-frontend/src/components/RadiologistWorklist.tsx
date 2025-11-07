import React, { useState, useEffect } from 'react';
import { Camera, Clock, AlertTriangle, User, FileText, CheckCircle, Eye } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

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
  hours_pending: number;
  number_of_images: number;
  radiologist_name?: string;
  report_status?: string;
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
      showError('Failed to load studies');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async (studyId: string) => {
    try {
      await ehrApi.assignRadiologist(tenantSlug, token, studyId, userId);
      showSuccess('Study assigned to you');
      loadStudies();
    } catch (error) {
      console.error('Failed to assign study:', error);
      showError('Failed to assign study');
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

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                {studies.length > 0 ? (studies.reduce((sum, s) => sum + (s.hours_pending || 0), 0) / studies.length).toFixed(1) : '0'}h
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
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
            {currentList.map((study) => (
              <div
                key={study.id}
                className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                  study.priority === 'stat' ? 'border-red-400 bg-red-50' :
                  study.priority === 'urgent' ? 'border-yellow-400 bg-yellow-50' :
                  'border-gray-200 hover:border-blue-400'
                }`}
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
                        <p className={`font-medium ${study.hours_pending > 24 ? 'text-red-600' : ''}`}>
                          {Number.isFinite(study.hours_pending) ? Number(study.hours_pending).toFixed(1) : '—'}h
                        </p>
                      </div>
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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 whitespace-nowrap"
                      >
                        <User className="w-4 h-4" />
                        <span>Assign to Me</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenStudy?.(study)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Study</span>
                    </button>
                  </div>
                </div>

                {/* Urgent Indicator */}
                {study.priority === 'stat' && (
                  <div className="mt-3 bg-red-700 text-white p-2 rounded-lg flex items-center space-x-2 animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-bold">STAT - IMMEDIATE READING REQUIRED</span>
                  </div>
                )}
              </div>
            ))}
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

