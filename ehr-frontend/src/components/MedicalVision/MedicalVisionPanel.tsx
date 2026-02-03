import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Activity, FileText, Loader2 } from 'lucide-react';
import { cdssApi } from '../../services/api';
import { useNotification } from '../GlobalNotification';

interface MedicalVisionPanelProps {
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

interface AnalysisResult {
  top_finding: string;
  confidence: number;
  all_findings: Array<{ label: string; score: number }>;
}

const MedicalVisionPanel: React.FC<MedicalVisionPanelProps> = ({ tenantSlug, token, onClose }) => {
  const { showError, showSuccess } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null); // Reset previous results
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await cdssApi.analyzeMedicalImage(formData, token, tenantSlug);
      setResult(response.data);
      showSuccess('Analysis Complete', 'Image analysis finished successfully.');
    } catch (error) {
      console.error('Analysis failed:', error);
      showError('Analysis Failed', 'Could not analyze the image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Medical Vision AI</h2>
              <p className="text-blue-100 text-sm">Automated Imaging Analysis & Screening</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            
            {/* Left Column: Upload & Preview */}
            <div className="flex flex-col gap-6">
              {!file ? (
                <div 
                  className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all min-h-[300px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">Upload Medical Image</h3>
                  <p className="text-slate-500 mt-2 max-w-xs">
                    Drag & drop a chest X-ray, CT scan slice, or other medical image here, or click to browse.
                  </p>
                  <p className="text-xs text-slate-400 mt-4">Supported formats: JPG, PNG, DICOM</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,.dcm"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex flex-col h-full bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                    <button 
                      onClick={clearFile}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 bg-black flex items-center justify-center p-4 relative min-h-[300px]">
                    {previewUrl && (
                      <img 
                        src={previewUrl} 
                        alt="Medical Preview" 
                        className="max-w-full max-h-[400px] object-contain" 
                      />
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-100">
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing Image...
                        </>
                      ) : (
                        <>
                          <Activity className="w-5 h-5" />
                          Run AI Analysis
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Results */}
            <div className="flex flex-col h-full">
              {result ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-4 bg-green-50 border-b border-green-100 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="font-bold text-green-800">Analysis Complete</h3>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto">
                    {/* Top Finding Card */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200 mb-6 text-center">
                      <p className="text-slate-500 uppercase tracking-wide text-xs font-bold mb-2">Primary Detection</p>
                      <h4 className="text-3xl font-extrabold text-slate-800 mb-2">{result.top_finding}</h4>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        <Activity className="w-4 h-4" />
                        {(result.confidence * 100).toFixed(1)}% Confidence
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-400" />
                      Detailed Findings
                    </h4>
                    <div className="space-y-3">
                      {result.all_findings.map((finding, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                          <span className="text-slate-700 font-medium capitalize">{finding.label}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  finding.score > 0.7 ? 'bg-red-500' : 
                                  finding.score > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${finding.score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono text-slate-500 w-12 text-right">
                              {(finding.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">
                        <strong>Disclaimer:</strong> AI analysis is a supportive tool and does not replace professional radiologist review. Please verify all findings.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full bg-slate-100 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 p-8">
                  <Activity className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-center font-medium">
                    Analysis results will appear here after processing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalVisionPanel;
