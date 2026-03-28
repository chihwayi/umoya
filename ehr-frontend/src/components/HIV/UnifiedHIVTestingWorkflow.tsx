import React, { useState } from 'react';
import { Brain, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
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

export const UnifiedHIVTestingWorkflow: React.FC<UnifiedHIVTestingWorkflowProps> = ({
  patientId,
  tenantSlug,
  token,
  onComplete,
}) => {
  const { showSuccess, showError } = useNotification();
  const [cdssRecommendations, setCdssRecommendations] = useState<any[]>([]);
  const [loadingCdss, setLoadingCdss] = useState(false);
  const [showWhoForm, setShowWhoForm] = useState(false);

  const runCdssAnalysis = async (data: any) => {
    setLoadingCdss(true);
    try {
      const response = await ehrAxios.post('/cdss/guidelines/check', {
        patientId,
        condition: 'HIV',
        data,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, 'Authorization': `Bearer ${token}` },
      });
      if (response.data?.recommendations) {
        setCdssRecommendations(response.data.recommendations);
      }
    } catch (error) {
      console.error('CDSS Analysis failed', error);
    } finally {
      setLoadingCdss(false);
    }
  };

  const handleSmartFormSuccess = (formData: any) => {
    const mappedData = {
      testDate: formData['HIV.B.DE110'] || new Date().toISOString().split('T')[0],
      testResult: formData['HIV.B.DE111'] || '',
      testType: formData['HIV.B.DE81'] || 'rapid_antibody',
      testingReason: formData['HIV.B.DE1'] || 'diagnostic_symptomatic',
      testKitName: formData['HIV.B.DE100'] || '',
      whoSmartFormData: formData,
    };
    showSuccess('Data Loaded', 'Data populated from WHO Smart Form');
    runCdssAnalysis(mappedData);
    setShowWhoForm(false);
    if (onComplete) onComplete(mappedData);
  };

  return (
    <div className="space-y-5">
      {/* CDSS Intelligence Panel */}
      {(loadingCdss || cdssRecommendations.length > 0) && (
        <div className="rounded-2xl border border-[#2B7FFF]/20 bg-[#2B7FFF]/[0.05] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-[#2B7FFF]" />
            <p className="text-sm font-bold text-white">CDSS Intelligence</p>
            {loadingCdss && <span className="h-3 w-3 border border-[#2B7FFF]/40 border-t-[#2B7FFF] rounded-full animate-spin ml-auto" />}
          </div>
          {loadingCdss ? (
            <p className="text-xs text-[#5A78A0]">Analyzing clinical data against WHO guidelines...</p>
          ) : (
            <div className="space-y-2">
              {cdssRecommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-[#FF7A40]/20 bg-[#FF7A40]/[0.06] px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FF7A40] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[#FFB380]">{rec.title}</p>
                    <p className="text-[11px] text-[#FF7A40]/80 mt-0.5">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WHO Smart Form optional toggle */}
      {showWhoForm ? (
        <div className="rounded-2xl border border-[#A66CFF]/20 bg-[#A66CFF]/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#A66CFF]/15">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#A66CFF]" />
              <p className="text-sm font-bold text-white">WHO Smart Guidelines Wizard</p>
              <span className="text-[10px] font-bold text-[#A66CFF] bg-[#A66CFF]/10 border border-[#A66CFF]/20 px-2 py-0.5 rounded-full">Guideline Adherence</span>
            </div>
            <button onClick={() => setShowWhoForm(false)} className="text-xs text-[#5A78A0] hover:text-white transition-colors font-medium">
              ← Back to standard
            </button>
          </div>
          <div className="p-5">
            <WHOSmartFormIntegration
              formId="HIV.B7TestForHivUsingTestingAlgorithm"
              patientId={patientId}
              token={token}
              tenantSlug={tenantSlug}
              onClose={() => setShowWhoForm(false)}
              onSuccess={handleSmartFormSuccess}
              title="HIV Testing Algorithm"
            />
          </div>
        </div>
      ) : (
        <HIVTestingComponent
          tenantSlug={tenantSlug}
          patientId={patientId}
          onDataChange={data => {
            if (data.testResult && data.testResult !== '') {
              runCdssAnalysis(data);
            }
          }}
        />
      )}

      {!showWhoForm && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowWhoForm(true)}
            className="text-xs text-[#5A78A0] hover:text-[#A66CFF] transition-colors font-semibold border border-white/[0.06] hover:border-[#A66CFF]/30 px-3 py-1.5 rounded-xl"
          >
            Switch to WHO Smart Form Wizard →
          </button>
        </div>
      )}
    </div>
  );
};
