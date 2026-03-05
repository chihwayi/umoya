import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import NurseCrossModuleEscalations, {
  NurseCrossModuleFeedItem,
} from '../components/NurseCrossModuleEscalations';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const SUPPORTED_MODULES = new Set([
  'hiv',
  'oncology',
  'cardiology',
  'ophthalmology',
  'telemedicine',
  'ed',
  'sepsis',
  'blood_bank',
  'lab',
  'pharmacy',
]);

const normalizeModuleKey = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const DoctorSyncExecutionHub: React.FC = () => {
  const { tenantSlug, moduleKey } = useParams<{ tenantSlug: string; moduleKey: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const token = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NurseCrossModuleFeedItem[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [workflowActionItemId, setWorkflowActionItemId] = useState<string | null>(null);
  const [recommendationActionKey, setRecommendationActionKey] = useState<string | null>(null);
  const normalizedModule = normalizeModuleKey(moduleKey);

  const loadModuleFeed = useCallback(async () => {
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again.');
      return;
    }
    setLoading(true);
    try {
      const response = await ehrApi.getNurseCrossModuleFeed(token, tenantSlug);
      const payloadItems = Array.isArray(response.data?.items) ? response.data.items : [];
      const moduleItems = payloadItems.filter((item: NurseCrossModuleFeedItem) => {
        const itemModule = normalizeModuleKey(item.module);
        if (!SUPPORTED_MODULES.has(itemModule)) {
          return false;
        }
        if (!normalizedModule) {
          return true;
        }
        return itemModule === normalizedModule;
      });
      setItems(moduleItems);
      setSummary(response.data?.summary || null);
    } catch (error: any) {
      showError(
        'Unable to load doctor sync execution hub',
        error?.response?.data?.message || 'Please retry shortly.',
      );
    } finally {
      setLoading(false);
    }
  }, [normalizedModule, showError, tenantSlug, token]);

  useEffect(() => {
    void loadModuleFeed();
  }, [loadModuleFeed]);

  const handleUpdateWorkflowStatus = async (
    item: NurseCrossModuleFeedItem,
    status: 'acknowledged' | 'completed',
  ) => {
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again.');
      return;
    }
    try {
      setWorkflowActionItemId(item.id);
      await ehrApi.updateNurseCrossModuleWorkflow(
        {
          itemId: item.id,
          module: item.module,
          itemType: item.item_type,
          sourceRecordId: item.source_record_id || null,
          patientId: item.patient_id || null,
          enrollmentId: item.enrollment_id || null,
          status,
          note:
            status === 'completed'
              ? 'Completed from doctor specialty execution hub.'
              : 'Acknowledged from doctor specialty execution hub.',
          context: {
            source: 'doctor_specialty_execution_hub',
            moduleStatus: item.module_status || null,
            doctorSyncStatus: item.doctor_sync_status || null,
          },
          destinationRole: item.destination_role || null,
          destinationService: item.destination_service || null,
          destinationSpecialty: item.destination_specialty || null,
          destinationUserId: item.destination_user_id || null,
          destinationFacilityId: item.destination_facility_id || null,
          destinationFacilityName: item.destination_facility_name || null,
        },
        token,
        tenantSlug,
      );
      await loadModuleFeed();
    } catch (error: any) {
      showError(
        'Unable to update workflow',
        error?.response?.data?.message || 'Please retry the workflow status update.',
      );
    } finally {
      setWorkflowActionItemId(null);
    }
  };

  const executeRecommendationByModule = async (
    item: NurseCrossModuleFeedItem,
    recommendationItem: Record<string, any>,
  ) => {
    const payloadBase = {
      itemId: item.id,
      itemType: item.item_type,
      sourceRecordId: item.source_record_id || null,
      patientId: item.patient_id || null,
      actionId: String(recommendationItem?.id || ''),
      actionType: recommendationItem?.type || null,
      actionTitle: recommendationItem?.title || null,
      actionPayload: recommendationItem?.action_payload || null,
      destinationRole: item.destination_role || null,
      destinationService: item.destination_service || null,
      destinationSpecialty: item.destination_specialty || null,
      destinationUserId: item.destination_user_id || null,
      destinationUserName: item.destination_user_name || null,
      destinationFacilityId: item.destination_facility_id || null,
      destinationFacilityName: item.destination_facility_name || null,
    };

    if (item.module === 'hiv') {
      return ehrApi.executeHivNurseRecommendationAction(
        {
          ...payloadBase,
          enrollmentId: item.enrollment_id || null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'oncology') {
      return ehrApi.executeOncologyNurseRecommendationAction(
        {
          ...payloadBase,
          caseId: item.metadata?.oncology_case_id || recommendationItem?.action_payload?.case_id || null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'cardiology') {
      return ehrApi.executeCardiologyNurseRecommendationAction(
        {
          ...payloadBase,
          encounterId:
            item.metadata?.encounter_id ||
            recommendationItem?.action_payload?.encounter_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'ophthalmology') {
      return ehrApi.executeOphthalmologyNurseRecommendationAction(
        {
          ...payloadBase,
          encounterId:
            item.metadata?.encounter_id ||
            recommendationItem?.action_payload?.encounter_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'telemedicine') {
      return ehrApi.executeTelemedicineNurseRecommendationAction(
        {
          ...payloadBase,
          consultationId:
            item.metadata?.consultation_id ||
            recommendationItem?.action_payload?.consultation_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'ed') {
      return ehrApi.executeEdNurseRecommendationAction(
        {
          ...payloadBase,
          visitId:
            item.metadata?.ed_visit_id ||
            recommendationItem?.action_payload?.visit_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'sepsis') {
      return ehrApi.executeSepsisNurseRecommendationAction(
        {
          ...payloadBase,
          bundleId:
            item.metadata?.sepsis_bundle_id ||
            recommendationItem?.action_payload?.bundle_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'blood_bank') {
      return ehrApi.executeBloodBankNurseRecommendationAction(
        {
          ...payloadBase,
          transfusionId:
            item.metadata?.transfusion_id ||
            recommendationItem?.action_payload?.transfusion_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'lab') {
      return ehrApi.executeLabNurseRecommendationAction(
        {
          ...payloadBase,
          alertId:
            item.metadata?.alert_id ||
            recommendationItem?.action_payload?.alert_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    if (item.module === 'pharmacy') {
      return ehrApi.executePharmacyNurseRecommendationAction(
        {
          ...payloadBase,
          prescriptionId:
            item.metadata?.prescription_id ||
            recommendationItem?.action_payload?.prescription_id ||
            item.source_record_id ||
            null,
        },
        token,
        tenantSlug!,
      );
    }
    throw new Error(`Unsupported module for execution: ${item.module}`);
  };

  const handleExecuteRecommendationAction = async (
    item: NurseCrossModuleFeedItem,
    recommendationItem: Record<string, any>,
  ) => {
    if (!tenantSlug || !token) {
      showError('Session expired', 'Please sign in again.');
      return;
    }
    const actionKey = `${item.id}:${String(recommendationItem?.id || recommendationItem?.title || 'action')}`;
    try {
      setRecommendationActionKey(actionKey);
      await executeRecommendationByModule(item, recommendationItem);
      showSuccess(
        'Recommendation executed',
        recommendationItem?.title
          ? `${recommendationItem.title} executed from specialty sync hub.`
          : 'Recommendation executed.',
      );
      await loadModuleFeed();
    } catch (error: any) {
      showError(
        'Unable to execute recommendation',
        error?.response?.data?.message || error?.message || 'Please retry the recommendation action.',
      );
    } finally {
      setRecommendationActionKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Doctor Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Doctor Specialty Execution Hub
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            One-click AI/CDSS recommendation execution for module workflows
            {normalizedModule ? ` (${normalizedModule.replace(/_/g, ' ')})` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadModuleFeed()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <NurseCrossModuleEscalations
        items={items}
        summary={summary}
        loading={loading}
        workflowActionItemId={workflowActionItemId}
        recommendationActionKey={recommendationActionKey}
        onRefresh={() => void loadModuleFeed()}
        onOpenWorkflow={() => navigate(`/ehr/${tenantSlug}/doctor`)}
        onUpdateWorkflowStatus={(item, status) => void handleUpdateWorkflowStatus(item, status)}
        onExecuteRecommendationAction={(item, recommendationItem) =>
          void handleExecuteRecommendationAction(item, recommendationItem)
        }
      />
    </div>
  );
};

export default DoctorSyncExecutionHub;
