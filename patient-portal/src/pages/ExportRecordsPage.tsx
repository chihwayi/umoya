import React, { useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { ArrowLeft, Download, FileText, FileJson, FileSpreadsheet, Calendar, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const ExportRecordsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [exportFormat, setExportFormat] = useState<'pdf' | 'fhir' | 'json' | 'csv'>('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dataType, setDataType] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!token) {
      setError('Please log in to export your records');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const options: { startDate?: string; endDate?: string; dataType?: string } = {};
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;
      if (dataType && exportFormat === 'csv') options.dataType = dataType;

      switch (exportFormat) {
        case 'pdf':
          await patientPortalApi.exportMedicalRecordPdf(token, tenantSlug, options);
          break;
        case 'fhir':
          await patientPortalApi.exportFhirBundle(token, tenantSlug, options);
          break;
        case 'json':
          await patientPortalApi.exportJson(token, tenantSlug, options);
          break;
        case 'csv':
          await patientPortalApi.exportCsv(token, tenantSlug, options);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export records. Please try again.');
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    {
      value: 'pdf' as const,
      label: 'PDF Document',
      description: 'Complete medical record in PDF format',
      icon: FileText,
      color: 'from-red-500 to-red-600',
    },
    {
      value: 'fhir' as const,
      label: 'FHIR R4 Bundle',
      description: 'Standardized healthcare data format (FHIR R4)',
      icon: FileJson,
      color: 'from-blue-500 to-blue-600',
    },
    {
      value: 'json' as const,
      label: 'JSON Data',
      description: 'Raw data in JSON format for analysis',
      icon: FileJson,
      color: 'from-green-500 to-green-600',
    },
    {
      value: 'csv' as const,
      label: 'CSV Spreadsheet',
      description: 'Tabular data for spreadsheet applications',
      icon: FileSpreadsheet,
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={`/${tenantSlug}/dashboard`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Export Medical Records</h1>
          <p className="text-gray-600">Download your complete medical history in various formats</p>
        </div>

        {/* Export Options Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Export Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {formatOptions.map((format) => {
              const Icon = format.icon;
              return (
                <button
                  key={format.value}
                  onClick={() => setExportFormat(format.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    exportFormat === format.value
                      ? `border-indigo-500 bg-gradient-to-br ${format.color} text-white shadow-lg`
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`w-6 h-6 ${exportFormat === format.value ? 'text-white' : 'text-gray-600'}`} />
                    <span className="font-semibold">{format.label}</span>
                  </div>
                  <p className={`text-sm ${exportFormat === format.value ? 'text-white/90' : 'text-gray-600'}`}>
                    {format.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Date Range */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Date Range (Optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Leave empty to export all records</p>
          </div>

          {/* CSV Data Type Selection */}
          {exportFormat === 'csv' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Type (Optional)</label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Data</option>
                <option value="appointments">Appointments Only</option>
                <option value="prescriptions">Prescriptions Only</option>
                <option value="lab_results">Lab Results Only</option>
                <option value="vitals">Vital Signs Only</option>
              </select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export Records
              </>
            )}
          </button>
        </div>

        {/* Information Card */}
        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-indigo-900 mb-2">About Export Formats</h3>
          <ul className="space-y-2 text-sm text-indigo-800">
            <li>
              <strong>PDF:</strong> Best for viewing and printing. Includes all medical records, appointments, prescriptions, lab results, and vital signs in a formatted document.
            </li>
            <li>
              <strong>FHIR R4:</strong> Industry-standard format for healthcare data interoperability. Use this if you need to share records with other healthcare systems.
            </li>
            <li>
              <strong>JSON:</strong> Raw data format perfect for developers or data analysis tools. Contains all structured data in machine-readable format.
            </li>
            <li>
              <strong>CSV:</strong> Spreadsheet-friendly format. Great for analyzing data in Excel, Google Sheets, or other spreadsheet applications.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportRecordsPage;

