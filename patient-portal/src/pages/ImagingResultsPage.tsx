import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { ScanLine, Calendar, ArrowLeft, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const ImagingResultsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, { report?: any; images?: any[]; loading: boolean }>>({});

  useEffect(() => {
    loadStudies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStudies = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getImagingStudies(token!, tenantSlug);
      setStudies(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load imaging results');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudy = async (studyId: string) => {
    if (expanded[studyId]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[studyId];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [studyId]: { loading: true } }));
    try {
      const [report, imagesRes] = await Promise.all([
        patientPortalApi.getImagingReport(studyId, token!, tenantSlug),
        patientPortalApi.getImagingImages(studyId, token!, tenantSlug),
      ]);
      setExpanded((prev) => ({ ...prev, [studyId]: { report, images: imagesRes.images ?? [], loading: false } }));
    } catch {
      setExpanded((prev) => ({ ...prev, [studyId]: { loading: false } }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your imaging results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            to={`/${tenantSlug}/dashboard`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Imaging Results</h1>
          <p className="text-gray-600">View your X-ray, CT, MRI, and ultrasound reports</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {studies.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-6 shadow-lg">
              <ScanLine className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Imaging Results</h3>
            <p className="text-gray-600">You don't have any finalized imaging reports yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {studies.map((study) => {
              const detail = expanded[study.id];
              return (
                <div
                  key={study.id}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <ScanLine className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {study.study_name} ({study.modality_code})
                        </h3>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            {format(new Date(study.study_date), 'MMMM d, yyyy')}
                            {study.body_part ? ` · ${study.body_part}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleStudy(study.id)}
                      className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 text-sm font-medium"
                    >
                      {detail ? 'Hide' : 'View Report'}
                    </button>
                  </div>

                  {study.impression && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-2">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Impression:</p>
                      <p className="text-sm text-blue-800">{study.impression}</p>
                    </div>
                  )}

                  {detail?.loading && (
                    <div className="text-center py-6 text-gray-500 text-sm">Loading report…</div>
                  )}

                  {detail && !detail.loading && detail.report && (
                    <div className="mt-4 space-y-3">
                      {detail.report.findings && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h5 className="font-semibold text-gray-900 mb-1 text-sm">Findings</h5>
                          <p className="text-sm text-gray-700 leading-relaxed">{detail.report.findings}</p>
                        </div>
                      )}
                      {detail.report.recommendations && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h5 className="font-semibold text-gray-900 mb-1 text-sm">Recommendations</h5>
                          <p className="text-sm text-gray-700 leading-relaxed">{detail.report.recommendations}</p>
                        </div>
                      )}
                      {detail.images && detail.images.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Images
                          </h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {detail.images.map((img: any) => (
                              <a
                                key={img.id}
                                href={img.download_url || img.file_path}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                              >
                                <img
                                  src={img.download_url || img.file_path}
                                  alt={study.study_name}
                                  className="w-full h-24 object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagingResultsPage;
