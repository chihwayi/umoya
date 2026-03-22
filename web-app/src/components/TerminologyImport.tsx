import React, { useState, useEffect } from 'react';
import { terminologyAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

interface ImportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  progress: number;
  fileName: string;
  type: 'snomed' | 'icd10';
  startTime: string;
  endTime?: string;
  error?: string;
  processedRows?: number;
}

export const TerminologyImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<'snomed' | 'icd10'>('snomed');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [stats, setStats] = useState<{ snomedConcepts: number; icd10Codes: number }>({ snomedConcepts: 0, icd10Codes: 0 });
  const { success, error: notifyError } = useNotification();

  useEffect(() => {
    loadJobs();
    loadStats();
    const interval = setInterval(() => {
      loadJobs();
      loadStats();
    }, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const data = await terminologyAPI.getAllJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await terminologyAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      notifyError('Error', 'Please select a file');
      return;
    }

    setLoading(true);
    try {
      await terminologyAPI.importFile(file, type);
      success('Success', 'Import job started');
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      loadJobs();
    } catch (err: any) {
      notifyError('Error', err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#8FA8CC] uppercase tracking-wider">SNOMED CT Concepts</h3>
            <p className="text-3xl font-bold text-white mt-2">{stats.snomedConcepts.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <svg className="w-8 h-8 text-[#2B7FFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#8FA8CC] uppercase tracking-wider">ICD-10 Codes</h3>
            <p className="text-3xl font-bold text-white mt-2">{stats.icd10Codes.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
        <h2 className="text-xl font-bold text-white mb-4">Import Terminology</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#C5D5EE] mb-2">Terminology Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'snomed' | 'icd10')}
              className="w-full px-3 py-2 border border-white/[0.10] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="snomed">SNOMED CT (RF2 Zip)</option>
              <option value="icd10">ICD-10 (Zip/Text)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#C5D5EE] mb-2">File (Zip)</label>
            <input
              id="file-upload"
              type="file"
              accept=".zip,.txt"
              onChange={handleFileChange}
              className="w-full text-sm text-[#C5D5EE] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-white/[0.10] file:text-sm file:font-semibold file:bg-white/[0.04] file:text-white hover:file:bg-white/[0.06]"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`px-4 py-2 rounded-xl font-medium text-white ${
              !file || loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Uploading...' : 'Start Import'}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
        <h2 className="text-xl font-bold text-white mb-4">Import Jobs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#080E1A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">Job ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">File</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7A9AB8] uppercase tracking-wider">Start Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.jobId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#C5D5EE]">{job.jobId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white uppercase">{job.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#C5D5EE]">{job.fileName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#C5D5EE]">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
                    </div>
                    <span className="text-xs text-[#8FA8CC] mt-1 block">{job.message}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#C5D5EE]">
                    {new Date(job.startTime).toLocaleString()}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-[#7A9AB8]">
                    No import jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
