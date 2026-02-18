import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Plus,
  Save,
  Shield,
  TestTube,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import HIVEnrollmentModal from './HIVEnrollmentModal';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import { formatDateForAPI } from '../utils/dateUtils';
import { getHivCdssConfig } from './HIV/hivCdssConfig';

interface HIVTestingComponentProps {
  tenantSlug: string;
  patientId?: string;
  initialData?: any;
  onDataChange?: (data: any) => void;
}

interface StiPanel {
  infectionType: string;
  testType: string;
  testMethod: string;
  specimenType: string;
  anatomicSite: string;
  result: string;
  resultValue: string;
  resultUnit: string;
  treatmentProvided: boolean;
  treatmentRegimen: string;
  treatmentDate: string;
  notes: string;
  infectionConcept?: SnomedConcept | null;
  testConcept?: SnomedConcept | null;
}

const testKits = [
  'Determine HIV-1/2',
  'Unigold HIV',
  'First Response HIV 1-2',
  'Abbott Determine',
  'SD Bioline HIV',
  'STANDARD Q HIV/Syphilis Duo',
];

const kitTypes = [
  { value: 'rapid_diagnostic_test', label: 'Rapid diagnostic test (RDT)' },
  { value: 'self_test_kit', label: 'Self-test kit (assisted/unassisted)' },
  { value: 'laboratory', label: 'Laboratory-based assay' },
];

const testStageOptions = [
  { value: 'screening', label: 'Screening Test 1' },
  { value: 'confirmatory', label: 'Confirmatory Test 2' },
  { value: 'tie_breaker', label: 'Tie Breaker Test 3' },
  { value: 'retest_before_art', label: 'Retest before ART initiation' },
  { value: 'self_test_verification', label: 'Self-test verification' },
  { value: 'recency', label: 'Recency assay' },
];

const testingReasonOptions = [
  { value: 'diagnostic_symptomatic', label: 'Diagnostic (symptomatic patient)' },
  { value: 'retest_before_art', label: 'Retest prior to ART initiation' },
  { value: 'pregnancy_anc', label: 'Antenatal / PMTCT retest' },
  { value: 'prep_follow_up', label: 'PrEP follow-up retest' },
  { value: 'pep_follow_up', label: 'PEP follow-up' },
  { value: 'tb_clinic', label: 'TB clinic client' },
  { value: 'self_test_verification', label: 'Self-test verification' },
  { value: 'partner_notification', label: 'Partner notification' },
  { value: 'key_population_outreach', label: 'Key population outreach' },
  { value: 'hiv_exposed_infant', label: 'HIV exposed infant/child' },
  { value: 'other', label: 'Other reason' },
];

const testingApproachOptions = [
  { value: 'facility', label: 'Facility based' },
  { value: 'community', label: 'Community outreach' },
  { value: 'self_test', label: 'Self-testing' },
  { value: 'provider_initiated', label: 'Provider initiated (PITC)' },
  { value: 'client_initiated', label: 'Client initiated (CITC)' },
  { value: 'lay_provider', label: 'Lay provider / peer' },
  { value: 'pharmacy', label: 'Private pharmacy' },
];

const testingCadreOptions = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'lay_provider', label: 'Lay provider' },
  { value: 'peer_educator', label: 'Peer educator' },
  { value: 'counsellor', label: 'Counsellor' },
];

const testingLocationOptions = [
  { value: 'outpatient', label: 'Outpatient department' },
  { value: 'maternity', label: 'Maternity/ANC' },
  { value: 'art_clinic', label: 'ART clinic' },
  { value: 'mobile_clinic', label: 'Mobile clinic' },
  { value: 'community_event', label: 'Community outreach event' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'home_visit', label: 'Home visit' },
];

const specimenOptions = [
  { value: 'whole blood', label: 'Whole blood (fingerstick)' },
  { value: 'venous blood', label: 'Venous blood' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'oral fluid', label: 'Oral fluid' },
];

const testTypeOptions = [
  { value: 'rapid_antibody', label: 'Rapid HIV antibody' },
  { value: 'elisa', label: 'ELISA' },
  { value: 'pcr', label: 'PCR' },
];

const resultOptions = [
  { value: 'reactive', label: 'Reactive' },
  { value: 'non_reactive', label: 'Non-reactive' },
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'indeterminate', label: 'Indeterminate' },
  { value: 'pending', label: 'Pending' },
];

const recencyResultOptions = [
  { value: 'recent', label: 'Recent infection' },
  { value: 'long_term', label: 'Long-term infection' },
  { value: 'invalid', label: 'Invalid recency test' },
];

const defaultTestingServicePoints = [
  { code: 'OPD', name: 'Outpatient Department (OPD)' },
  { code: 'IPD', name: 'Inpatient Ward' },
  { code: 'MCH', name: 'MCH / ANC Clinic' },
  { code: 'ART', name: 'ART Clinic' },
  { code: 'VCT', name: 'VCT / HTC Room' },
];

const defaultTestingOutreachEvents = [
  { code: 'NONE', name: 'No outreach (facility-based)' },
  { code: 'COMMUNITY', name: 'Community outreach' },
  { code: 'MOBCLINIC', name: 'Mobile clinic' },
  { code: 'CAMPAIGN', name: 'Campaign / special event' },
];

const defaultPartnerServices = [
  { code: 'OFF', name: 'Offered' },
  { code: 'ACC', name: 'Accepted' },
  { code: 'DEC', name: 'Declined' },
  { code: 'NA', name: 'Not applicable' },
];

const defaultLinkageActions = [
  { code: 'ART_INIT', name: 'ART initiated' },
  { code: 'ART_REF', name: 'Referred to ART clinic' },
  { code: 'PREP', name: 'PrEP initiated' },
  { code: 'PEP', name: 'PEP initiated' },
  { code: 'COUNS', name: 'Counselling only' },
];

const defaultStiMethods = [
  { code: 'DUAL', name: 'Dual HIV/STI rapid kit' },
  { code: 'RDT', name: 'Rapid test' },
  { code: 'NAAT', name: 'NAAT / PCR' },
  { code: 'CULT', name: 'Culture' },
  { code: 'OTHER', name: 'Other method' },
];

const defaultStiSpecimens = [
  { code: 'URETHRAL', name: 'Urethral swab' },
  { code: 'CERVICAL', name: 'Cervical swab' },
  { code: 'VAGINAL', name: 'Vaginal swab' },
  { code: 'URINE', name: 'Urine' },
  { code: 'BLOOD', name: 'Blood' },
  { code: 'OTHER', name: 'Other site' },
];

const followUpOptions = [
  { value: 'post_test_counselling', label: 'Post-test counselling' },
  { value: 'linkage_to_art', label: 'Linked/initiated ART' },
  { value: 'prep_referral', label: 'PrEP referral' },
  { value: 'pep_initiated', label: 'PEP initiated' },
  { value: 'stis_treated', label: 'STIs treated' },
  { value: 'partner_notification', label: 'Partner notification services' },
  { value: 'risk_reduction_counselling', label: 'Risk reduction counselling' },
];

const infectionOptions = [
  { value: 'syphilis', label: 'Syphilis' },
  { value: 'gonorrhea', label: 'Gonorrhoea' },
  { value: 'chlamydia', label: 'Chlamydia' },
  { value: 'trichomoniasis', label: 'Trichomoniasis' },
  { value: 'hpv', label: 'HPV' },
  { value: 'hepatitis_b', label: 'Hepatitis B' },
  { value: 'hepatitis_c', label: 'Hepatitis C' },
];

const stiResultOptions = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'reactive', label: 'Reactive' },
  { value: 'non_reactive', label: 'Non-reactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'invalid', label: 'Invalid' },
];

const testingReasonLookup = testingReasonOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const testStageLookup = testStageOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const infectionLookup = infectionOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const defaultTestForm = {
  testStage: 'screening',
  testType: 'rapid_antibody',
  testingReason: 'diagnostic_symptomatic',
  testingApproach: 'facility',
  testingLocation: 'outpatient',
  testingCadre: 'nurse',
  specimenType: 'whole blood',
  kitType: 'rapid_diagnostic_test',
  testKitName: testKits[0],
  testKitLot: '',
  testKitExpiry: '',
  dualKitUsed: false,
  testResult: '',
  resultValue: '',
  resultUnit: '',
  selfTestReported: false,
  selfTestConfirmed: false,
  recencyTestPerformed: false,
  recencyResult: '',
  recencyKitLot: '',
  recencyKitExpiry: '',
  partnerNotificationStatus: '',
  linkageAction: '',
  linkageCompleted: false,
  nextTestDueDate: '',
  notes: '',
};

const defaultTestingContext = {
  servicePoint: '',
  outreachEvent: '',
  referredBy: '',
};

const defaultStiPanel: StiPanel = {
  infectionType: 'syphilis',
  testType: 'rapid',
  testMethod: 'dual_kit',
  specimenType: 'whole blood',
  anatomicSite: '',
  result: 'pending',
  resultValue: '',
  resultUnit: '',
  treatmentProvided: false,
  treatmentRegimen: '',
  treatmentDate: '',
  notes: '',
  infectionConcept: null,
  testConcept: null,
};

const parseJsonArray = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, description, badge, actions, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const HIVTestingComponent: React.FC<HIVTestingComponentProps> = ({ tenantSlug, patientId, initialData, onDataChange }) => {
  const { showSuccess, showError } = useNotification();
  const cdssConfig = getHivCdssConfig(tenantSlug);
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testForm, setTestForm] = useState(defaultTestForm);
  const [testingContext, setTestingContext] = useState(defaultTestingContext);
  const [followUpActions, setFollowUpActions] = useState<string[]>([]);
  const [stiPanels, setStiPanels] = useState<StiPanel[]>([defaultStiPanel]);
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [algorithmResult, setAlgorithmResult] = useState<any>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showAlgorithmExplanation, setShowAlgorithmExplanation] = useState(false);
  const [testConceptSelection, setTestConceptSelection] = useState<SnomedConcept | null>(null);
  const [specimenConceptSelection, setSpecimenConceptSelection] = useState<SnomedConcept | null>(null);

  const snomedToken = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const snomedReady = Boolean(snomedToken && tenantSlug);

  // Load patient if ID is provided
  useEffect(() => {
    const loadPatient = async () => {
      if (patientId && snomedReady) {
        try {
          const token = localStorage.getItem('ehr_token');
          if (!token) return;
          // Use searchPatients as a fallback if getPatientById isn't available or behaves differently,
          // but preferably use getPatientById.
          // Since we verified getPatientById exists in ehrApi, we use it.
          const response = await ehrApi.getPatientById(patientId, token, tenantSlug);
          setSelectedPatient(response.data);
        } catch (error) {
          console.error('Failed to load patient', error);
          showError('Error', 'Failed to load patient details');
        }
      }
    };
    loadPatient();
  }, [patientId, snomedReady, tenantSlug]);

  // Handle initial data from parent (e.g. Unified Workflow)
  useEffect(() => {
    if (initialData) {
      setTestForm(prev => ({
        ...prev,
        ...initialData
      }));
    }
  }, [initialData]);

  // Propagate changes to parent
  useEffect(() => {
    if (onDataChange) {
      onDataChange(testForm);
    }
  }, [testForm, onDataChange]);

  useEffect(() => {
    if (selectedPatient) {
      loadTestHistory();
    }
  }, [selectedPatient]);

  const computeNextTestDefaults = (tests: any[]): Partial<typeof defaultTestForm> => {
    if (!tests || tests.length === 0) {
      return {
        testStage: defaultTestForm.testStage,
        testKitName: testKits[0],
        testingReason: defaultTestForm.testingReason,
        testType: defaultTestForm.testType,
      };
    }

    const all = tests;
    const last = all[all.length - 1];
    const lastStage = last.testStage || last.test_stage || defaultTestForm.testStage;
    const lastResult = last.testResult || last.test_result || '';

    let nextStage = lastStage;
    let nextKit = last.testKitName || last.test_kit_name || testKits[0];

    if (lastStage === 'screening') {
      if (lastResult === 'positive' || lastResult === 'reactive') {
        nextStage = 'confirmatory';
        nextKit = testKits[1] || testKits[0];
      } else if (lastResult === 'invalid' || lastResult === 'indeterminate') {
        nextStage = 'screening';
        nextKit = last.testKitName || last.test_kit_name || testKits[0];
      }
    } else if (lastStage === 'confirmatory') {
      const screening = all.find(
        (t: any) => (t.testStage || t.test_stage) === 'screening',
      );
      const screeningResult =
        screening?.testResult || screening?.test_result || '';

      if (
        screeningResult &&
        lastResult &&
        screeningResult !== 'pending' &&
        lastResult !== 'pending' &&
        screeningResult !== lastResult
      ) {
        nextStage = 'tie_breaker';
        nextKit = testKits[2] || testKits[1] || testKits[0];
      }
    }

    return {
      testStage: nextStage,
      testKitName: nextKit,
      testingReason:
        last.testingReason || last.testing_reason || defaultTestForm.testingReason,
      testType: last.testType || last.test_type || defaultTestForm.testType,
    };
  };

  const resetFormState = (
    historyCount = 0,
    nextDefaults?: Partial<typeof defaultTestForm>,
  ) => {
    const baseKitName = historyCount === 0 ? testKits[0] : testKits[1] || testKits[0];
    setTestForm({
      ...defaultTestForm,
      testKitName: baseKitName,
      ...nextDefaults,
    });
    setTestingContext(defaultTestingContext);
    setFollowUpActions([]);
    setStiPanels([defaultStiPanel]);
    setTestConceptSelection(null);
    setSpecimenConceptSelection(null);
  };

  const loadTestHistory = async () => {
    if (!selectedPatient) return;
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getPatientHivTests(selectedPatient.id, token, tenantSlug);
      const tests = response.data.tests || [];
      setTestHistory(tests);

      if (tests.length > 0) {
        const latestTest = tests[0];

        try {
          const algoResponse = await ehrApi.processHivAlgorithm(latestTest.id, token, tenantSlug);
          if (algoResponse.data) {
            setAlgorithmResult(algoResponse.data);
          }
        } catch (error) {
          console.error('Failed to process HIV algorithm with CDSS:', error);
          if (latestTest.algorithm_result) {
            setAlgorithmResult({
              result: latestTest.algorithm_result,
              confidence: 'high',
              next_step:
                latestTest.algorithm_result === 'positive'
                  ? 'Offer enrollment in HIV care and confirm STI treatment links'
                  : latestTest.algorithm_result === 'negative'
                  ? 'Provide post-test counselling and prevention package'
                  : 'Continue national testing algorithm',
            });
          }
        }

        if (
          latestTest.algorithm_result === 'positive' ||
          latestTest.algorithm_result === 'negative'
        ) {
          resetFormState(0);
        } else {
          const nextDefaults = computeNextTestDefaults([...tests].reverse());
          resetFormState(tests.length, nextDefaults);
        }
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const searchPatients = async () => {
    if (!searchTerm.trim()) {
      setPatients([]);
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setSearching(true);
      const response = await ehrApi.searchPatients(searchTerm, token, tenantSlug);
      setPatients(response.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      showError('Error', 'Failed to search patients');
    } finally {
      setSearching(false);
    }
  };

  const toggleFollowUpAction = (action: string) => {
    setFollowUpActions((prev) =>
      prev.includes(action) ? prev.filter((item) => item !== action) : [...prev, action],
    );
  };

  const handleStiChange = (index: number, field: keyof StiPanel, value: any) => {
    setStiPanels((prev) =>
      prev.map((panel, idx) => (idx === index ? { ...panel, [field]: value } : panel)),
    );
  };

  const handleStiConceptChange = (
    index: number,
    field: 'infectionConcept' | 'testConcept',
    concept: SnomedConcept | null,
  ) => {
    setStiPanels((prev) =>
      prev.map((panel, idx) => (idx === index ? { ...panel, [field]: concept } : panel)),
    );
  };

  const addStiPanel = () => {
    setStiPanels((prev) => [...prev, { ...defaultStiPanel }]);
  };

  const removeStiPanel = (index: number) => {
    setStiPanels((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      showError('Error', 'Please select a patient');
      return;
    }

    if (!testForm.testResult) {
      showError('Error', 'Please select a test result');
      return;
    }

    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

      if (!token) {
        showError('Error', 'Not authenticated');
        return;
      }

      setSubmitting(true);

      const mapDateForApi = (value: string) => {
        if (!value) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }
        const iso = formatDateForAPI(value);
        return iso || null;
      };

      const payload = {
        patientId: selectedPatient.id,
        testedBy: currentUser.id,
        testStage: testForm.testStage,
        testType: testForm.testType,
        testingReason: testForm.testingReason,
        testingApproach: testForm.testingApproach,
        testingLocation: testForm.testingLocation,
        testingCadre: testForm.testingCadre,
        specimenType: testForm.specimenType,
        kitType: testForm.kitType,
        testKitName: testForm.testKitName,
        testKitLot: testForm.testKitLot,
        testKitExpiry: mapDateForApi(testForm.testKitExpiry),
        dualKitUsed: testForm.dualKitUsed,
        testResult: testForm.testResult,
        resultValue: testForm.resultValue || null,
        resultUnit: testForm.resultUnit || null,
        selfTestReported: testForm.selfTestReported,
        selfTestConfirmed: testForm.selfTestConfirmed,
        recencyTestPerformed: testForm.recencyTestPerformed,
        recencyResult: testForm.recencyResult || null,
        recencyKitLot: testForm.recencyKitLot || null,
        recencyKitExpiry: mapDateForApi(testForm.recencyKitExpiry),
        partnerNotificationStatus: testForm.partnerNotificationStatus || null,
        linkageAction: testForm.linkageAction || null,
        linkageCompleted: testForm.linkageCompleted,
        nextTestDueDate: mapDateForApi(testForm.nextTestDueDate),
        notes: testForm.notes || null,
        followUpActions,
        testingContext,
        testConcept: testConceptSelection,
        specimenConcept: specimenConceptSelection,
        stis: stiPanels
          .filter((panel) => panel.infectionType)
          .map((panel) => ({
            infectionType: panel.infectionType,
            testType: panel.testType,
            testMethod: panel.testMethod,
            specimenType: panel.specimenType,
            anatomicSite: panel.anatomicSite || null,
            result: panel.result || 'pending',
            resultValue: panel.resultValue || null,
            resultUnit: panel.resultUnit || null,
            treatmentProvided: panel.treatmentProvided,
            treatmentRegimen: panel.treatmentRegimen || null,
            treatmentDate: panel.treatmentDate || null,
            notes: panel.notes || null,
            infectionConcept: panel.infectionConcept || null,
            testConcept: panel.testConcept || null,
          })),
      };

      const nextDefaults = computeNextTestDefaults([...testHistory, payload]);

      const response = await ehrApi.createHivTest(payload, token, tenantSlug);

      showSuccess('Success', 'HIV/STI testing encounter recorded');
      resetFormState(testHistory.length + 1, nextDefaults);
      await loadTestHistory();

      if (response.data?.algorithm) {
        setAlgorithmResult(response.data.algorithm);
      }
    } catch (error: any) {
      console.error('Test submission failed:', error);
      showError('Error', error.response?.data?.message || 'Failed to record test');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollInCare = () => {
    if (selectedPatient) {
      setShowEnrollmentModal(true);
    }
  };

  const historyWithParsed = useMemo(
    () =>
      testHistory.map((test: any) => ({
        ...test,
        stis_results: parseJsonArray(test.stis_results),
        stis_screened: parseJsonArray(test.stis_screened),
        follow_up_actions: parseJsonArray(test.follow_up_actions),
        sti_tests: test.sti_tests || [],
      })),
    [testHistory],
  );

  const nextStepHint = useMemo(() => {
    if (!historyWithParsed.length) {
      return null;
    }

    const defaults = computeNextTestDefaults(historyWithParsed);
    const stage = defaults.testStage || defaultTestForm.testStage;
    const kitName = defaults.testKitName || testKits[0];

    if (stage === 'confirmatory') {
      return {
        title: 'Confirmatory HIV test expected',
        detail: `Use the second HIV rapid test (${kitName}) to confirm the reactive screening result.`,
      };
    }

    if (stage === 'tie_breaker') {
      return {
        title: 'Tie-breaker HIV test expected',
        detail: `Screening and confirmatory results disagreed — perform a third HIV rapid test (${kitName}) as the tie-breaker.`,
      };
    }

    if (stage === 'screening') {
      return {
        title: 'Repeat screening or start new algorithm',
        detail: `Previous result was invalid, indeterminate or negative. Start or repeat screening using ${kitName} as the first test.`,
      };
    }

    return null;
  }, [historyWithParsed]);

  const enrollmentSeedTest = useMemo(() => {
    if (!historyWithParsed.length) {
      return null;
    }
    const positiveTests = historyWithParsed.filter((test: any) => {
      return (
        test.test_result === 'positive' ||
        test.test_result === 'reactive' ||
        test.algorithm_result === 'positive'
      );
    });
    if (positiveTests.length > 0) {
      return positiveTests[positiveTests.length - 1];
    }
    return historyWithParsed[0];
  }, [historyWithParsed]);

  const stageStepMeta = useMemo(() => {
    const stage = testForm.testStage || defaultTestForm.testStage;
    if (stage === 'screening') {
      return { index: 1, total: 3, label: 'Screening test 1' };
    }
    if (stage === 'confirmatory') {
      return { index: 2, total: 3, label: 'Confirmatory test 2' };
    }
    if (stage === 'tie_breaker') {
      return { index: 3, total: 3, label: 'Tie-breaker test 3' };
    }
    return { index: 1, total: 1, label: 'HIV testing step' };
  }, [testForm.testStage]);

  const screeningTest = useMemo(
    () =>
      historyWithParsed.find(
        (t: any) => (t.testStage || t.test_stage) === 'screening',
      ),
    [historyWithParsed],
  );

  const previousKitNames = useMemo(
    () =>
      historyWithParsed
        .map((t: any) => t.testKitName || t.test_kit_name)
        .filter(Boolean),
    [historyWithParsed],
  );

  const recommendedDefaults = useMemo(
    () => computeNextTestDefaults([...historyWithParsed].reverse()),
    [historyWithParsed],
  );

  const recommendedKitName =
    recommendedDefaults.testStage === 'screening'
      ? ''
      : recommendedDefaults.testKitName || testKits[0];

  const workflowSteps = [
    { title: 'Context capture', detail: 'Reason · approach · cadre' },
    { title: 'Kit & result', detail: 'Kit metadata · readings' },
    { title: 'Linkage & recency', detail: 'Partner services · recency assays' },
    { title: 'STI bundle', detail: 'Syphilis · GC/CT · Hepatitis · HPV' },
  ];
  const formSteps = [
    { id: 'context', title: 'Context', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'test', title: 'HIV Test', icon: <TestTube className="w-4 h-4" /> },
    { id: 'linkage', title: 'Linkage & Recency', icon: <Shield className="w-4 h-4" /> },
    { id: 'sti', title: 'STI Bundle', icon: <Activity className="w-4 h-4" /> },
  ] as const;
  type FormStepId = (typeof formSteps)[number]['id'];
  const [activeStep, setActiveStep] = useState<FormStepId>('context');

  const isStiBundleEnabled = Boolean(
    testForm.testKitName && testForm.testKitName.toLowerCase().includes('syphilis'),
  );

  const isFollowOnStage =
    testForm.testStage === 'confirmatory' || testForm.testStage === 'tie_breaker';

  const visibleFormSteps = formSteps.filter(
    (step) =>
      (step.id !== 'sti' || isStiBundleEnabled) &&
      (step.id !== 'context' || !isFollowOnStage),
  );

  const activeStepIndex = visibleFormSteps.findIndex((step) => step.id === activeStep);
  const goToPreviousStep = () => {
    if (activeStepIndex > 0) {
      setActiveStep(visibleFormSteps[activeStepIndex - 1].id);
    }
  };
  const goToNextStep = () => {
    if (activeStepIndex < visibleFormSteps.length - 1) {
      setActiveStep(visibleFormSteps[activeStepIndex + 1].id);
    }
  };

  const [servicePoints, setServicePoints] = useState<{ code: string; name: string }[]>(
    defaultTestingServicePoints,
  );
  const [outreachEvents, setOutreachEvents] = useState<{ code: string; name: string }[]>(
    defaultTestingOutreachEvents,
  );
  const [partnerServices, setPartnerServices] = useState<{ code: string; name: string }[]>(
    defaultPartnerServices,
  );
  const [linkageActions, setLinkageActions] = useState<{ code: string; name: string }[]>(
    defaultLinkageActions,
  );
  const [stiMethods, setStiMethods] = useState<{ code: string; name: string }[]>(
    defaultStiMethods,
  );
  const [stiSpecimens, setStiSpecimens] = useState<{ code: string; name: string }[]>(
    defaultStiSpecimens,
  );

  useEffect(() => {
    if (!isStiBundleEnabled && activeStep === 'sti') {
      setActiveStep('linkage');
    }
  }, [isStiBundleEnabled, activeStep]);

  useEffect(() => {
    if (isFollowOnStage && activeStep === 'context') {
      setActiveStep('test');
    }
  }, [isFollowOnStage, activeStep]);

  const isKitDisabledForStage = (kit: string) => {
    if (testForm.testStage === 'confirmatory' && screeningTest) {
      const screeningKit =
        screeningTest.testKitName || screeningTest.test_kit_name || '';
      return Boolean(screeningKit && kit === screeningKit);
    }

    if (testForm.testStage === 'tie_breaker' && previousKitNames.length > 0) {
      return previousKitNames.includes(kit);
    }

    return false;
  };

  const canShowSaveButton =
    Boolean(selectedPatient) &&
    Boolean(testForm.testResult) &&
    (activeStep === 'test' || activeStep === 'linkage' || activeStep === 'sti');

  const canSubmitEncounter =
    Boolean(selectedPatient) &&
    Boolean(
      testForm.testResult &&
        testForm.testKitName &&
        testForm.testStage &&
        testForm.testType &&
        testForm.testingReason,
    );

  useEffect(() => {
    const loadTestingLookups = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        if (!token || !tenantSlug) return;

        const [
          servicePointsRes,
          outreachEventsRes,
          partnerServicesRes,
          linkageActionsRes,
          stiMethodsRes,
          stiSpecimensRes,
        ] = await Promise.all([
          ehrApi.getHivLookupData('testing_service_points', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_outreach_events', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_partner_services', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_linkage_actions', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_sti_methods', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_sti_specimens', {}, token, tenantSlug),
        ]);

        const sp = servicePointsRes.data.data || [];
        const oe = outreachEventsRes.data.data || [];
        const ps = partnerServicesRes.data.data || [];
        const la = linkageActionsRes.data.data || [];
        const sm = stiMethodsRes.data.data || [];
        const ss = stiSpecimensRes.data.data || [];

        setServicePoints(sp.length > 0 ? sp : defaultTestingServicePoints);
        setOutreachEvents(oe.length > 0 ? oe : defaultTestingOutreachEvents);
        setPartnerServices(ps.length > 0 ? ps : defaultPartnerServices);
        setLinkageActions(la.length > 0 ? la : defaultLinkageActions);
        setStiMethods(sm.length > 0 ? sm : defaultStiMethods);
        setStiSpecimens(ss.length > 0 ? ss : defaultStiSpecimens);
      } catch {
        setServicePoints(defaultTestingServicePoints);
        setOutreachEvents(defaultTestingOutreachEvents);
        setPartnerServices(defaultPartnerServices);
        setLinkageActions(defaultLinkageActions);
        setStiMethods(defaultStiMethods);
        setStiSpecimens(defaultStiSpecimens);
      }
    };

    loadTestingLookups();
  }, []);

  const formSections: Record<FormStepId, React.ReactNode> = {
    context: isFollowOnStage ? (
      <SectionCard
        title="Testing context"
        icon={<ClipboardList className="w-5 h-5" />}
        description="Using the same clinical context as the initial screening test."
      >
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Context locked for follow-up step</p>
          <p className="mt-1">
            This confirmatory or tie-breaker test reuses the reason, location and cadre from the
            screening visit. Return to the clinical encounter if you need to adjust visit context.
          </p>
        </div>
      </SectionCard>
    ) : (
      <SectionCard
        title="Testing context"
        icon={<ClipboardList className="w-5 h-5" />}
        description="Capture reason, approach, location, and cadre before entering results."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Reason for testing', field: 'testingReason', options: testingReasonOptions },
            { label: 'Testing approach', field: 'testingApproach', options: testingApproachOptions },
            { label: 'Testing location', field: 'testingLocation', options: testingLocationOptions },
            { label: 'Algorithm stage', field: 'testStage', options: testStageOptions },
            { label: 'Specimen', field: 'specimenType', options: specimenOptions },
            { label: 'Provider cadre', field: 'testingCadre', options: testingCadreOptions },
          ].map(({ label, field, options }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
              <select
                value={testForm[field as keyof typeof testForm] as string}
                onChange={(e) => setTestForm({ ...testForm, [field]: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Service point</label>
            <select
              value={testingContext.servicePoint}
              onChange={(e) => setTestingContext({ ...testingContext, servicePoint: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select service point...</option>
              {servicePoints.map((sp) => (
                <option key={sp.code} value={sp.code}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Outreach / campaign</label>
            <select
              value={testingContext.outreachEvent}
              onChange={(e) => setTestingContext({ ...testingContext, outreachEvent: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {outreachEvents.map((event) => (
                <option key={event.code} value={event.code}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Referred by</label>
            <input
              type="text"
              value={testingContext.referredBy}
              onChange={(e) => setTestingContext({ ...testingContext, referredBy: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional"
            />
          </div>
        </div>
      </SectionCard>
    ),
    test: (
      <SectionCard
        title="HIV test kit & result"
        icon={<TestTube className="w-5 h-5" />}
        description="Document the kit, lot, expiry, and observed results for this algorithm step."
      >
        {nextStepHint && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-emerald-600" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Step {stageStepMeta.index} of {stageStepMeta.total} · {stageStepMeta.label}
              </p>
              <p className="font-semibold mt-0.5">Next expected step</p>
              <p>{nextStepHint.title}</p>
              <p className="text-xs text-emerald-800 mt-1">{nextStepHint.detail}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Test kit</label>
            <select
              value={testForm.testKitName}
              onChange={(e) => setTestForm({ ...testForm, testKitName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {testKits.map((kit) => {
                const disabled = isKitDisabledForStage(kit);
                const label =
                  recommendedKitName && kit === recommendedKitName
                    ? `${kit} (recommended)`
                    : kit;
                return (
                  <option key={kit} value={kit} disabled={disabled}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kit category</label>
            <select
              value={testForm.kitType}
              onChange={(e) => setTestForm({ ...testForm, kitType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {kitTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Test type</label>
            <select
              value={testForm.testType}
              onChange={(e) => setTestForm({ ...testForm, testType: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {testTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Test result</label>
            <select
              value={testForm.testResult}
              onChange={(e) => setTestForm({ ...testForm, testResult: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select result...</option>
              {resultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kit lot number</label>
            <input
              type="text"
              value={testForm.testKitLot}
              onChange={(e) => setTestForm({ ...testForm, testKitLot: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter lot number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kit expiry date</label>
            <input
              type="text"
              value={testForm.testKitExpiry}
              onChange={(e) => setTestForm({ ...testForm, testKitExpiry: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Result value</label>
            <input
              type="text"
              value={testForm.resultValue}
              onChange={(e) => setTestForm({ ...testForm, resultValue: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional numerical value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Result unit</label>
            <input
              type="text"
              value={testForm.resultUnit}
              onChange={(e) => setTestForm({ ...testForm, resultUnit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., copies/mL"
            />
          </div>
          {snomedReady && (
            <>
              <div className="md:col-span-2">
                <SnomedConceptPicker
                  value={testConceptSelection}
                  onChange={setTestConceptSelection}
                  token={snomedToken}
                  tenantSlug={tenantSlug}
                  label="HIV test SNOMED concept"
                  helperText="Select the exact analyte/procedure performed for interoperability."
                context="procedure"
                />
              </div>
              <div className="md:col-span-2">
                <SnomedConceptPicker
                  value={specimenConceptSelection}
                  onChange={setSpecimenConceptSelection}
                  token={snomedToken}
                  tenantSlug={tenantSlug}
                  label="Specimen SNOMED concept"
                  helperText="Optional structured specimen description (finger prick, plasma, etc.)."
                context="specimen"
                />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={testForm.notes}
              onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={testForm.dualKitUsed}
              onChange={(e) => setTestForm({ ...testForm, dualKitUsed: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Dual HIV/Syphilis kit used
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={testForm.selfTestReported}
              onChange={(e) => setTestForm({ ...testForm, selfTestReported: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Client self-tested before visit
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={testForm.selfTestConfirmed}
              onChange={(e) => setTestForm({ ...testForm, selfTestConfirmed: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Self-test confirmed by provider
          </label>
        </div>
      </SectionCard>
    ),
    linkage: (
      <SectionCard
        title="Linkage, partner services & recency"
        icon={<Shield className="w-5 h-5" />}
        description="Record partner notification, linkage outcomes, recency assays, and plan the next test."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Partner services</label>
            <select
              value={testForm.partnerNotificationStatus}
              onChange={(e) =>
                setTestForm({ ...testForm, partnerNotificationStatus: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Not recorded</option>
              {partnerServices.map((option: { code: string; name: string }) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Linkage action</label>
            <select
              value={testForm.linkageAction}
              onChange={(e) => setTestForm({ ...testForm, linkageAction: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Not recorded</option>
              {linkageActions.map((option: { code: string; name: string }) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={testForm.linkageCompleted}
              onChange={(e) => setTestForm({ ...testForm, linkageCompleted: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Linkage completed
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Recency testing performed
            </label>
            <select
              value={testForm.recencyTestPerformed ? 'yes' : 'no'}
              onChange={(e) =>
                setTestForm({ ...testForm, recencyTestPerformed: e.target.value === 'yes' })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {testForm.recencyTestPerformed && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Recency result</label>
                <select
                  value={testForm.recencyResult}
                  onChange={(e) => setTestForm({ ...testForm, recencyResult: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select...</option>
                  {recencyResultOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Recency kit lot</label>
                <input
                  type="text"
                  value={testForm.recencyKitLot}
                  onChange={(e) => setTestForm({ ...testForm, recencyKitLot: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Recency kit expiry
                </label>
                <input
                  type="text"
                  value={testForm.recencyKitExpiry}
                  onChange={(e) =>
                    setTestForm({ ...testForm, recencyKitExpiry: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Next recommended test date
            </label>
            <input
              type="text"
              value={testForm.nextTestDueDate}
              onChange={(e) => setTestForm({ ...testForm, nextTestDueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="dd/mm/yyyy"
            />
          </div>
        </div>
      </SectionCard>
    ),
    sti: (
      <SectionCard
        title="Follow-up actions & integrated STI testing"
        icon={<Activity className="w-5 h-5" />}
        description="Tag counselling and prevention actions, then capture each STI panel bundled with the visit."
        actions={
          <button
            type="button"
            onClick={addStiPanel}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="w-4 h-4" /> Add STI test
          </button>
        }
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up actions</label>
          <div className="flex flex-wrap gap-2">
            {followUpOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleFollowUpAction(option.value)}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  followUpActions.includes(option.value)
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {stiPanels.map((panel, index) => (
            <div
              key={`${panel.infectionType}-${index}`}
              className="border border-slate-200 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">STI panel {index + 1}</p>
                {stiPanels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStiPanel(index)}
                    className="text-rose-600 hover:text-rose-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Infection</label>
                  <select
                    value={panel.infectionType}
                    onChange={(e) => handleStiChange(index, 'infectionType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {infectionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {snomedReady && (
                    <div className="mt-2">
                      <SnomedConceptPicker
                        value={panel.infectionConcept ?? null}
                        onChange={(concept) => handleStiConceptChange(index, 'infectionConcept', concept)}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Infection SNOMED concept"
                        helperText="Optional — capture the coded pathogen or syndrome."
                    context="condition"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Test method</label>
                  <select
                    value={panel.testMethod}
                    onChange={(e) => handleStiChange(index, 'testMethod', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {stiMethods.map((option: { code: string; name: string }) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {snomedReady && (
                    <div className="mt-2">
                      <SnomedConceptPicker
                        value={panel.testConcept ?? null}
                        onChange={(concept) => handleStiConceptChange(index, 'testConcept', concept)}
                        token={snomedToken}
                        tenantSlug={tenantSlug}
                        label="Test SNOMED concept"
                        helperText="Optional coded lab/imaging procedure."
                    context="procedure"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Specimen/site</label>
                  <select
                    value={panel.specimenType}
                    onChange={(e) => handleStiChange(index, 'specimenType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {stiSpecimens.map((option: { code: string; name: string }) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Result</label>
                  <select
                    value={panel.result}
                    onChange={(e) => handleStiChange(index, 'result', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {stiResultOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Treatment regimen</label>
                  <input
                    type="text"
                    value={panel.treatmentRegimen}
                    onChange={(e) => handleStiChange(index, 'treatmentRegimen', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Treatment date</label>
                  <input
                    type="date"
                    value={panel.treatmentDate}
                    onChange={(e) => handleStiChange(index, 'treatmentDate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={panel.treatmentProvided}
                  onChange={(e) => handleStiChange(index, 'treatmentProvided', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Treatment provided during this visit
              </label>
              <textarea
                value={panel.notes}
                onChange={(e) => handleStiChange(index, 'notes', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                rows={2}
                placeholder="Notes / partner services"
              />
            </div>
          ))}
        </div>
      </SectionCard>
    ),
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto px-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 text-white shadow-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="uppercase tracking-wide text-emerald-100 text-xs font-semibold">WHO 2024 Integrated HIV & STI Testing</p>
            <h1 className="text-3xl font-bold mt-2 mb-2">Differentiated Testing Workspace</h1>
            <p className="text-emerald-50 max-w-2xl">
              Capture the full context, run the Zimbabwe national algorithm, bundle STI screening, and document linkage services without leaving this view.
            </p>
          </div>
          <TestTube className="w-16 h-16 opacity-80" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mt-6">
          {workflowSteps.map((step) => (
            <div key={step.title} className="bg-white/10 backdrop-blur rounded-2xl px-4 py-3 border border-white/20">
              <p className="text-xs uppercase tracking-wide text-emerald-100 mb-1">{step.title}</p>
              <p className="text-sm text-emerald-50">{step.detail}</p>
            </div>
          ))}
        </div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      <SectionCard
        title={patientId ? "Patient Context" : "Patient search & intake"}
        icon={<User className="w-5 h-5" />}
        description={patientId ? "Review demographics and proceed through the WHO-aligned workflow." : "Find the client, review demographics, then proceed through the WHO-aligned workflow."}
      >
        {!patientId && (
        <>
        <div className="flex flex-col lg:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by name or patient number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPatients()}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={searchPatients}
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {patients.length > 0 && (
          <div className="mt-4 border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setPatients([]);
                  setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                  setTestHistory([]);
                  setAlgorithmResult(null);
                  resetFormState();
                }}
                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
              >
                <div className="font-semibold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </div>
                <div className="text-sm text-slate-500">ID: {patient.patientNumber}</div>
              </button>
            ))}
          </div>
        )}
        </>
        )}

      {selectedPatient && (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {visibleFormSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    activeStep === step.id
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  {step.icon}
                  {step.title}
                </button>
              ))}
            </div>

            <div>{formSections[activeStep]}</div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={activeStepIndex === 0}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-40"
              >
                Previous section
              </button>
              <button
                type="button"
                onClick={goToNextStep}
                disabled={activeStepIndex === visibleFormSteps.length - 1}
                className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              >
                Next section
              </button>
            </div>

            {canShowSaveButton && (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmitEncounter}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold"
                >
                  <Save className="w-5 h-5" />
                  {submitting ? 'Recording…' : 'Record Encounter'}
                </button>
              </div>
            )}

            {(algorithmResult || historyWithParsed.length > 0) && (
              <div className="grid gap-6 lg:grid-cols-3">
                {algorithmResult && (
                  <SectionCard
                    title="Algorithm outcome"
                    icon={<AlertTriangle className="w-5 h-5" />}
                    badge="Auto-evaluated"
                    description="Latest consolidated decision from the national testing algorithm."
                  >
                    <div className="flex items-start gap-4">
                      {(algorithmResult.result || algorithmResult.algorithm_result) === 'positive' ? (
                        <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
                      ) : (algorithmResult.result || algorithmResult.algorithm_result) === 'negative' ? (
                        <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Activity className="w-8 h-8 text-amber-500 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500">Result</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {(algorithmResult.result || algorithmResult.algorithm_result || 'pending').toUpperCase()}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {algorithmResult.source === 'ehr_fallback'
                            ? 'Source · Basic EHR fallback (CDSS unavailable)'
                            : 'Source · CDSS HIV algorithm'}
                        </p>
                        {(algorithmResult.next_step || algorithmResult.recommendation) && (
                          <p className="text-sm text-slate-600 mt-2">
                            {(algorithmResult.result || algorithmResult.algorithm_result) ===
                            'positive'
                              ? 'HIV Positive: ensure immediate linkage to HIV care, baseline labs, and partner services.'
                              : (algorithmResult.result || algorithmResult.algorithm_result) ===
                                'negative'
                              ? 'HIV Negative: provide post-test counselling, risk reduction package, and schedule retesting as per guidelines.'
                              : algorithmResult.next_step || algorithmResult.recommendation}
                          </p>
                        )}
                        {(algorithmResult.result || algorithmResult.algorithm_result) === 'positive' && (
                          <button
                            onClick={handleEnrollInCare}
                            className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
                          >
                            Enroll patient in care
                          </button>
                        )}
                        <button
                          onClick={() => setShowAlgorithmExplanation((prev) => !prev)}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"
                        >
                          <Shield className="w-4 h-4" />
                          {showAlgorithmExplanation ? 'Hide CDSS explanation' : 'Ask CDSS why'}
                        </button>
                        {showAlgorithmExplanation && (
                          <div className="mt-3 rounded-xl bg-emerald-50/70 border border-emerald-100 px-4 py-3 text-sm text-emerald-900 space-y-2">
                            <p className="font-semibold">Why this result?</p>
                            {algorithmResult.interpretation ? (
                              <p>{algorithmResult.interpretation}</p>
                            ) : (
                              <p>
                                {(algorithmResult.result || algorithmResult.algorithm_result) === 'positive'
                                  ? 'The national HIV testing algorithm classified this case as HIV Positive because at least two rapid tests in this episode were reactive/positive.'
                                  : (algorithmResult.result || algorithmResult.algorithm_result) === 'negative'
                                  ? 'The national HIV testing algorithm classified this case as HIV Negative based on a non-reactive screening test or a consistent series of non-reactive tests.'
                                  : (algorithmResult.result || algorithmResult.algorithm_result) === 'indeterminate'
                                  ? 'The recorded rapid test results are discordant or incomplete, so the algorithm could not reach a final HIV status. Continue the national testing algorithm or arrange further testing.'
                                  : 'A detailed CDSS explanation is not available for this result, but the decision shown above comes from the national HIV testing algorithm.'}
                              </p>
                            )}
                            {Array.isArray(algorithmResult.algorithm_steps) &&
                              algorithmResult.algorithm_steps.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                                    Key steps considered
                                  </p>
                                  <ul className="text-xs list-disc list-inside space-y-0.5">
                                    {algorithmResult.algorithm_steps.slice(0, 3).map((step: any, idx: number) => (
                                      <li key={idx}>
                                        {step.test_kit && (
                                          <span className="font-semibold">{step.test_kit}: </span>
                                        )}
                                        {step.step_result || step.test_result}
                                      </li>
                                    ))}
                                    {algorithmResult.algorithm_steps.length > 3 && (
                                      <li>…plus additional checks in the national algorithm.</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                )}

                {historyWithParsed.length > 0 && (
                  <SectionCard
                    title="Testing timeline"
                    icon={<Calendar className="w-5 h-5" />}
                    description="Most recent HIV & STI encounters (latest first)."
                  >
                    <div className="space-y-3">
                      {(() => {
                        const now = new Date();
                        const overdueCutoff = new Date(now);
                        overdueCutoff.setDate(
                          overdueCutoff.getDate() - cdssConfig.thresholds.testingOverdueDaysGrace,
                        );

                        return historyWithParsed.map((test: any) => {
                          const isPositive =
                            test.test_result === 'positive' ||
                            test.test_result === 'reactive' ||
                            test.algorithm_result === 'positive';
                          const nextDueDate = test.next_test_due_date ? new Date(test.next_test_due_date) : null;
                          const isOverdue =
                            nextDueDate !== null && nextDueDate < overdueCutoff && !isPositive;

                          return (
                            <div
                              key={test.id}
                              className={`border rounded-2xl px-4 py-3 ${
                                isPositive
                                  ? 'border-red-200 bg-red-50/60'
                                  : isOverdue
                                  ? 'border-amber-200 bg-amber-50/60'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900">{test.test_kit_name}</p>
                                  <p className="text-sm text-slate-500">
                                    {formatDateToDDMMYYYY(test.test_date)} ·{' '}
                                    <span
                                      className={`font-medium ${
                                        isPositive ? 'text-red-700' : 'text-slate-700'
                                      }`}
                                    >
                                      {test.test_result}
                                    </span>
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {testingReasonLookup[test.testing_reason] ||
                                      test.testing_reason ||
                                      '—'}{' '}
                                    · Step: {testStageLookup[test.test_stage] || test.test_stage}
                                  </p>
                                  {isPositive && (
                                    <p className="mt-1 text-xs font-semibold text-red-700">
                                      {cdssConfig.messages.testingTimelinePositive}
                                    </p>
                                  )}
                                  {isOverdue && (
                                    <p className="mt-1 text-xs font-semibold text-amber-700">
                                      {cdssConfig.messages.testingTimelineOverduePrefix}{' '}
                                      {formatDateToDDMMYYYY(test.next_test_due_date)}.
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {test.algorithm_result && (
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                        test.algorithm_result === 'positive'
                                          ? 'bg-red-50 text-red-700 border border-red-100'
                                          : test.algorithm_result === 'negative'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                                      }`}
                                    >
                                      {test.algorithm_result}
                                    </span>
                                  )}
                                  {test.next_test_due_date && !isPositive && (
                                    <span className="text-[11px] text-slate-500">
                                      Next test: {formatDateToDDMMYYYY(test.next_test_due_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {test.follow_up_actions && test.follow_up_actions.length > 0 && (
                                <p className="text-xs text-slate-600 mt-2">
                                  Follow-up: {test.follow_up_actions.join(', ')}
                                </p>
                              )}
                              {test.sti_tests && test.sti_tests.length > 0 && (
                                <p className="text-xs text-rose-600 mt-1">
                                  STI screens:{' '}
                                  {test.sti_tests
                                    .map((sti: any) => `${sti.infection_type} (${sti.result})`)
                                    .join(', ')}
                                </p>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </SectionCard>
                )}
              </div>
            )}
          </div>
        )}

      </SectionCard>

      {showEnrollmentModal && selectedPatient && (
        <HIVEnrollmentModal
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.first_name || selectedPatient.firstName} ${selectedPatient.last_name || selectedPatient.lastName}`}
          patientAge={
            selectedPatient.date_of_birth || selectedPatient.dateOfBirth
              ? Math.floor(
                  (new Date().getTime() -
                    new Date(selectedPatient.date_of_birth || selectedPatient.dateOfBirth).getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000),
                )
              : undefined
          }
          patientSex={selectedPatient.gender}
          initialHivTest={enrollmentSeedTest || undefined}
          onClose={() => setShowEnrollmentModal(false)}
          onSuccess={() => {
            setShowEnrollmentModal(false);
            loadTestHistory();
          }}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
};

export default HIVTestingComponent;
