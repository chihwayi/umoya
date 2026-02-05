import React, { useState } from 'react';
import { 
  FileText, 
  TestTube, 
  Settings, 
  Brain, 
  CheckCircle, 
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';
import HIVTestingComponent from '../HIVTestingComponent';
import { WHOSmartFormIntegration } from './WHOSmartFormIntegration';
import { useNotification } from '../GlobalNotification';
import { ehrApi, ehrAxios } from '../../services/api';

interface UnifiedHIVTestingWorkflowProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onComplete?: (data: any) => void;
}

type EntryMode = 'standard' | 'who_guided';

export const UnifiedHIVTestingWorkflow: React.FC<UnifiedHIVTestingWorkflowProps> = ({
  patientId,
  tenantSlug,
  token,
  onComplete
}) => {
  const { showSuccess, showError } = useNotification();
  const [mode, setMode] = useState<EntryMode>('standard');
  const [cdssRecommendations, setCdssRecommendations] = useState<any[]>([]);
  const [loadingCdss, setLoadingCdss] = useState(false);

  // Shared state for the test data
  // This is the "Unified Data Model" that both views populate
  const [testData, setTestData] = useState<any>({
    testStage: 'screening',
    testType: 'rapid_antibody',
    testingReason: 'diagnostic_symptomatic',
    testKitName: '',
    testResult: '',
    lotNumber: '',
    expiryDate: '',
  });

  // Handler for Standard View updates
  const handleStandardUpdate = (data: any) => {
    setTestData({ ...testData, ...data });
    // Trigger CDSS analysis when key fields change
    if (data.testResult && data.testResult !== testData.testResult) {
      runCdssAnalysis({ ...testData, ...data });
    }
  };

  // Handler for WHO Smart Form success
  // Maps the complex FHIR QuestionnaireResponse to our simple model
  const handleSmartFormSuccess = (formData: any) => {
    const mappedData = {
      testDate: formData['HIV.B.DE110'] || new Date().toISOString().split('T')[0],
      testResult: formData['HIV.B.DE111'] || '', // Map FHIR code to local value
      testType: formData['HIV.B.DE81'] || 'rapid_antibody',
      testingReason: formData['HIV.B.DE1'] || 'diagnostic_symptomatic',
      testKitName: formData['HIV.B.DE100'] || '',
      whoSmartFormData: formData, // Persist raw WHO data for compliance/audit
      // ... map other fields as needed
    };
    
    setTestData({ ...testData, ...mappedData });
    showSuccess('Data Loaded', 'Data populated from WHO Smart Form');
    
    // Automatically trigger CDSS analysis on form completion
    runCdssAnalysis(mappedData);
    
    // Switch to standard mode to review and submit
    setMode('standard');
  };

  // The "Intelligence Layer" - Runs regardless of entry mode
  const runCdssAnalysis = async (data: any) => {
    setLoadingCdss(true);
    try {
      // 1. Send data to CDSS service
      // In a real app, this would be a specific endpoint like /api/cdss/hiv/analyze
      const response = await ehrAxios.post('/cdss/guidelines/check', {
        patientId,
        condition: 'HIV',
        data
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` }
      });

      if (response.data && response.data.recommendations) {
        setCdssRecommendations(response.data.recommendations);
      }
    } catch (error) {
      console.error('CDSS Analysis failed', error);
      // Don't block the user, just show a warning
    } finally {
      setLoadingCdss(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      // 1. Save the data (Unified Persistence)
      await ehrApi.createHivTest(testData, token, tenantSlug);
      
      // 2. Run CDSS if not already run
      if (cdssRecommendations.length === 0) {
        await runCdssAnalysis(testData);
      }

      showSuccess('Success', 'HIV Test saved successfully');
      if (onComplete) onComplete(testData);

    } catch (error: any) {
      showError('Error', 'Failed to save test data');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Mode Switcher - The "Unified" Toggle */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">HIV Testing & Counseling</h2>
          <p className="text-sm text-slate-500">
            {mode === 'standard' ? 'Standard Rapid Entry' : 'WHO Smart Guideline Wizard'}
          </p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setMode('standard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'standard' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={16} />
              Standard Form
            </div>
          </button>
          <button
            onClick={() => setMode('who_guided')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'who_guided' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain size={16} />
              WHO Guided
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Main Input Area (Standard or Guided) */}
        <div className="lg:col-span-2 space-y-6">
          {mode === 'standard' ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="font-medium text-slate-700">Clinical Data Entry</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Fast Track</span>
              </div>
              <div className="p-6">
                <HIVTestingComponent 
                  tenantSlug={tenantSlug} 
                  patientId={patientId}
                  initialData={testData}
                  onDataChange={handleStandardUpdate}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                <span className="font-medium text-indigo-900">WHO Smart Guidelines Wizard</span>
                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full">Guideline Adherence</span>
              </div>
              <div className="p-6">
                <WHOSmartFormIntegration
                  formId="HIV.B7TestForHivUsingTestingAlgorithm"
                  patientId={patientId}
                  token={token}
                  tenantSlug={tenantSlug}
                  onClose={() => setMode('standard')}
                  onSuccess={handleSmartFormSuccess}
                  title="HIV Testing Algorithm"
                />
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <button
              onClick={handleFinalSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <CheckCircle size={18} />
              Save & Analyze
            </button>
          </div>
        </div>

        {/* 3. CDSS / AI Intelligence Panel - Always Visible */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Brain size={16} />
              CDSS Intelligence
            </h3>
            
            {loadingCdss ? (
              <div className="text-center py-8 text-slate-500">
                Analyzing clinical data...
              </div>
            ) : cdssRecommendations.length > 0 ? (
              <div className="space-y-4">
                {cdssRecommendations.map((rec, idx) => (
                  <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-sm font-medium text-amber-900">{rec.title}</p>
                        <p className="text-xs text-amber-700 mt-1">{rec.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <p className="text-sm text-slate-500">
                  Enter test data to receive<br/>WHO Smart Recommendations
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
