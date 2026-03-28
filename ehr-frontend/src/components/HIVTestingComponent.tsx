import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Plus,
  Shield,
  TestTube,
  Trash2,
  User,
  X,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  Zap,
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

type WizardStep = 'context' | 'run_test' | 'post_record' | 'linkage_sti';

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
  { value: 'reactive', label: 'Reactive', color: '#FF4D6A', bg: '#FF4D6A15', border: '#FF4D6A40' },
  { value: 'non_reactive', label: 'Non-reactive', color: '#00C896', bg: '#00C89615', border: '#00C89640' },
  { value: 'positive', label: 'Positive', color: '#FF4D6A', bg: '#FF4D6A15', border: '#FF4D6A40' },
  { value: 'negative', label: 'Negative', color: '#00C896', bg: '#00C89615', border: '#00C89640' },
  { value: 'invalid', label: 'Invalid', color: '#FF7A40', bg: '#FF7A4015', border: '#FF7A4040' },
  { value: 'indeterminate', label: 'Indeterminate', color: '#FF7A40', bg: '#FF7A4015', border: '#FF7A4040' },
  { value: 'pending', label: 'Pending', color: '#5A78A0', bg: '#5A78A015', border: '#5A78A040' },
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

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-[#7A9AB8] mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const selectCls = 'w-full px-3 py-2 bg-[#060C16] border border-white/[0.1] rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00C896]/50 focus:border-[#00C896]/50 transition';
const inputCls = 'w-full px-3 py-2 bg-[#060C16] border border-white/[0.1] rounded-xl text-white text-sm placeholder-[#3A5A7A] focus:outline-none focus:ring-1 focus:ring-[#00C896]/50 focus:border-[#00C896]/50 transition';

const HIVTestingComponent: React.FC<HIVTestingComponentProps> = ({ tenantSlug, patientId, initialData, onDataChange }) => {
  const { showSuccess, showError } = useNotification();
  const cdssConfig = getHivCdssConfig(tenantSlug);
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searching, setSearching] = useState(false);
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
  const [wizardStep, setWizardStep] = useState<WizardStep>('context');
  const [showSnomedExpanded, setShowSnomedExpanded] = useState(false);

  const [servicePoints, setServicePoints] = useState<{ code: string; name: string }[]>(defaultTestingServicePoints);
  const [outreachEvents, setOutreachEvents] = useState<{ code: string; name: string }[]>(defaultTestingOutreachEvents);
  const [partnerServices, setPartnerServices] = useState<{ code: string; name: string }[]>(defaultPartnerServices);
  const [linkageActions, setLinkageActions] = useState<{ code: string; name: string }[]>(defaultLinkageActions);
  const [stiMethods, setStiMethods] = useState<{ code: string; name: string }[]>(defaultStiMethods);
  const [stiSpecimens, setStiSpecimens] = useState<{ code: string; name: string }[]>(defaultStiSpecimens);

  const snomedToken = useMemo(() => localStorage.getItem('ehr_token') || '', []);
  const snomedReady = Boolean(snomedToken && tenantSlug);

  // Load patient if ID is provided
  useEffect(() => {
    const loadPatient = async () => {
      if (patientId && snomedReady) {
        try {
          const token = localStorage.getItem('ehr_token');
          if (!token) return;
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

  useEffect(() => {
    if (initialData) {
      setTestForm(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  useEffect(() => {
    if (onDataChange) onDataChange(testForm);
  }, [testForm, onDataChange]);

  useEffect(() => {
    if (selectedPatient) loadTestHistory();
  }, [selectedPatient]);

  useEffect(() => {
    const loadTestingLookups = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        if (!token || !tenantSlug) return;
        const [spRes, oeRes, psRes, laRes, smRes, ssRes] = await Promise.all([
          ehrApi.getHivLookupData('testing_service_points', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_outreach_events', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_partner_services', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_linkage_actions', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_sti_methods', {}, token, tenantSlug),
          ehrApi.getHivLookupData('testing_sti_specimens', {}, token, tenantSlug),
        ]);
        const sp = spRes.data.data || []; const oe = oeRes.data.data || [];
        const ps = psRes.data.data || []; const la = laRes.data.data || [];
        const sm = smRes.data.data || []; const ss = ssRes.data.data || [];
        setServicePoints(sp.length > 0 ? sp : defaultTestingServicePoints);
        setOutreachEvents(oe.length > 0 ? oe : defaultTestingOutreachEvents);
        setPartnerServices(ps.length > 0 ? ps : defaultPartnerServices);
        setLinkageActions(la.length > 0 ? la : defaultLinkageActions);
        setStiMethods(sm.length > 0 ? sm : defaultStiMethods);
        setStiSpecimens(ss.length > 0 ? ss : defaultStiSpecimens);
      } catch {
        // fallback to defaults (already set)
      }
    };
    loadTestingLookups();
  }, []);

  const computeNextTestDefaults = (tests: any[]): Partial<typeof defaultTestForm> => {
    if (!tests || tests.length === 0) {
      return { testStage: defaultTestForm.testStage, testKitName: testKits[0], testingReason: defaultTestForm.testingReason, testType: defaultTestForm.testType };
    }
    const last = tests[tests.length - 1];
    const lastStage = last.testStage || last.test_stage || defaultTestForm.testStage;
    const lastResult = last.testResult || last.test_result || '';
    let nextStage = lastStage;
    let nextKit = last.testKitName || last.test_kit_name || testKits[0];
    if (lastStage === 'screening') {
      if (lastResult === 'positive' || lastResult === 'reactive') { nextStage = 'confirmatory'; nextKit = testKits[1] || testKits[0]; }
      else if (lastResult === 'invalid' || lastResult === 'indeterminate') { nextStage = 'screening'; }
    } else if (lastStage === 'confirmatory') {
      const screening = tests.find((t: any) => (t.testStage || t.test_stage) === 'screening');
      const screeningResult = screening?.testResult || screening?.test_result || '';
      if (screeningResult && lastResult && screeningResult !== 'pending' && lastResult !== 'pending' && screeningResult !== lastResult) {
        nextStage = 'tie_breaker';
        nextKit = testKits[2] || testKits[1] || testKits[0];
      }
    }
    return { testStage: nextStage, testKitName: nextKit, testingReason: last.testingReason || last.testing_reason || defaultTestForm.testingReason, testType: last.testType || last.test_type || defaultTestForm.testType };
  };

  const resetFormState = (historyCount = 0, nextDefaults?: Partial<typeof defaultTestForm>) => {
    const baseKitName = historyCount === 0 ? testKits[0] : testKits[1] || testKits[0];
    setTestForm({ ...defaultTestForm, testKitName: baseKitName, ...nextDefaults });
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
          if (algoResponse.data) setAlgorithmResult(algoResponse.data);
        } catch {
          if (latestTest.algorithm_result) {
            setAlgorithmResult({
              result: latestTest.algorithm_result,
              confidence: 'high',
              next_step: latestTest.algorithm_result === 'positive'
                ? 'Offer enrollment in HIV care and confirm STI treatment links'
                : latestTest.algorithm_result === 'negative'
                ? 'Provide post-test counselling and prevention package'
                : 'Continue national testing algorithm',
            });
          }
        }
        if (latestTest.algorithm_result === 'positive' || latestTest.algorithm_result === 'negative') {
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
    if (!searchTerm.trim()) { setPatients([]); return; }
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      setSearching(true);
      const response = await ehrApi.searchPatients(searchTerm, token, tenantSlug);
      setPatients(response.data || []);
    } catch {
      showError('Error', 'Failed to search patients');
    } finally {
      setSearching(false);
    }
  };

  const toggleFollowUpAction = (action: string) => {
    setFollowUpActions(prev => prev.includes(action) ? prev.filter(i => i !== action) : [...prev, action]);
  };

  const handleStiChange = (index: number, field: keyof StiPanel, value: any) => {
    setStiPanels(prev => prev.map((panel, idx) => idx === index ? { ...panel, [field]: value } : panel));
  };

  const handleStiConceptChange = (index: number, field: 'infectionConcept' | 'testConcept', concept: SnomedConcept | null) => {
    setStiPanels(prev => prev.map((panel, idx) => idx === index ? { ...panel, [field]: concept } : panel));
  };

  const addStiPanel = () => setStiPanels(prev => [...prev, { ...defaultStiPanel }]);
  const removeStiPanel = (index: number) => setStiPanels(prev => prev.filter((_, idx) => idx !== index));

  const handleSubmit = async () => {
    if (!selectedPatient) { showError('Error', 'Please select a patient'); return; }
    if (!testForm.testResult) { showError('Error', 'Please select a test result'); return; }
    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      if (!token) { showError('Error', 'Not authenticated'); return; }
      setSubmitting(true);
      const mapDateForApi = (value: string) => {
        if (!value) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
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
        stis: stiPanels.filter(p => p.infectionType).map(p => ({
          infectionType: p.infectionType,
          testType: p.testType,
          testMethod: p.testMethod,
          specimenType: p.specimenType,
          anatomicSite: p.anatomicSite || null,
          result: p.result || 'pending',
          resultValue: p.resultValue || null,
          resultUnit: p.resultUnit || null,
          treatmentProvided: p.treatmentProvided,
          treatmentRegimen: p.treatmentRegimen || null,
          treatmentDate: p.treatmentDate || null,
          notes: p.notes || null,
          infectionConcept: p.infectionConcept || null,
          testConcept: p.testConcept || null,
        })),
      };
      const nextDefaults = computeNextTestDefaults([...testHistory, payload]);
      const response = await ehrApi.createHivTest(payload, token, tenantSlug);
      showSuccess('Recorded', 'Test result saved — review algorithm outcome below');
      setWizardStep('post_record');
      resetFormState(testHistory.length + 1, nextDefaults);
      await loadTestHistory();
      if (response.data?.algorithm) setAlgorithmResult(response.data.algorithm);
    } catch (error: any) {
      console.error('Test submission failed:', error);
      showError('Error', error.response?.data?.message || 'Failed to record test');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollInCare = () => {
    if (selectedPatient) setShowEnrollmentModal(true);
  };

  const historyWithParsed = useMemo(() =>
    testHistory.map((test: any) => ({
      ...test,
      stis_results: parseJsonArray(test.stis_results),
      stis_screened: parseJsonArray(test.stis_screened),
      follow_up_actions: parseJsonArray(test.follow_up_actions),
      sti_tests: test.sti_tests || [],
    })),
    [testHistory],
  );

  const screeningTest = useMemo(
    () => historyWithParsed.find((t: any) => (t.testStage || t.test_stage) === 'screening'),
    [historyWithParsed],
  );

  const previousKitNames = useMemo(
    () => historyWithParsed.map((t: any) => t.testKitName || t.test_kit_name).filter(Boolean),
    [historyWithParsed],
  );

  const isKitDisabledForStage = (kit: string) => {
    if (testForm.testStage === 'confirmatory' && screeningTest) {
      const sk = screeningTest.testKitName || screeningTest.test_kit_name || '';
      return Boolean(sk && kit === sk);
    }
    if (testForm.testStage === 'tie_breaker' && previousKitNames.length > 0) {
      return previousKitNames.includes(kit);
    }
    return false;
  };

  // STI is enabled when dual kit is selected or kit name indicates dual purpose
  const isStiBundleEnabled = Boolean(
    testForm.dualKitUsed ||
    testForm.testKitName?.toLowerCase().includes('syphilis') ||
    testForm.testKitName?.toLowerCase().includes('duo'),
  );

  // Algorithm decision after recording a test
  const algorithmDecision = useMemo(() => {
    if (!historyWithParsed.length) return null;
    const algoResult = algorithmResult?.result || algorithmResult?.algorithm_result;
    if (algoResult === 'positive') {
      return {
        type: 'final_positive',
        title: 'HIV POSITIVE',
        message: 'Two or more tests in this episode returned reactive/positive. Initiate linkage to HIV care immediately.',
        action: 'Enroll in HIV Care',
        color: '#FF4D6A',
        nextStep: 'linkage_sti' as WizardStep,
      };
    }
    if (algoResult === 'negative') {
      return {
        type: 'final_negative',
        title: 'HIV NEGATIVE',
        message: 'Algorithm is complete. Provide post-test counselling, prevention package, and schedule retesting.',
        action: 'Record Follow-up & Close',
        color: '#00C896',
        nextStep: 'linkage_sti' as WizardStep,
      };
    }
    const lastTest = historyWithParsed[0];
    const stage = lastTest?.test_stage || lastTest?.testStage || 'screening';
    const testResult = lastTest?.test_result || lastTest?.testResult || '';

    if (testResult === 'invalid' || testResult === 'indeterminate') {
      return {
        type: 'repeat',
        title: stage === 'screening' ? 'Repeat Screening Test' : stage === 'confirmatory' ? 'Repeat Confirmatory Test' : 'Repeat Tie-breaker',
        message: `Result is ${testResult}. The WHO algorithm requires repeating this test with a fresh sample or different kit.`,
        action: 'Repeat This Test',
        color: '#FF7A40',
        nextStep: 'run_test' as WizardStep,
      };
    }
    if (stage === 'screening' && (testResult === 'reactive' || testResult === 'positive')) {
      return {
        type: 'proceed_confirmatory',
        title: 'Screening Reactive — Proceed to Test 2',
        message: `Test 1 (${lastTest?.test_kit_name || 'screening kit'}) returned ${testResult}. WHO algorithm requires a second test using a DIFFERENT kit to confirm.`,
        action: 'Perform Confirmatory Test 2',
        color: '#FF7A40',
        nextStep: 'run_test' as WizardStep,
      };
    }
    if (stage === 'confirmatory') {
      const sTest = historyWithParsed.find((t: any) => (t.test_stage || t.testStage) === 'screening');
      const sResult = sTest?.test_result || sTest?.testResult || '';
      if (sResult && testResult && sResult !== testResult && testResult !== 'pending' && sResult !== 'pending') {
        return {
          type: 'proceed_tiebreaker',
          title: 'Discordant Results — Tie-breaker Required',
          message: `Test 1: ${sResult} / Test 2: ${testResult} — these disagree. WHO algorithm requires a third test with a different kit to resolve.`,
          action: 'Perform Tie-breaker Test 3',
          color: '#FF7A40',
          nextStep: 'run_test' as WizardStep,
        };
      }
    }
    if (stage === 'tie_breaker') {
      return {
        type: 'final',
        title: 'Algorithm Complete',
        message: 'Tie-breaker test performed. Review the final algorithm result above and record linkage actions.',
        action: 'Record Linkage & Close',
        color: '#00C896',
        nextStep: 'linkage_sti' as WizardStep,
      };
    }
    // Screening non-reactive
    if (stage === 'screening' && (testResult === 'non_reactive' || testResult === 'negative')) {
      return {
        type: 'final_negative',
        title: 'HIV NEGATIVE',
        message: 'Non-reactive on screening. Provide post-test counselling, risk reduction, and schedule retesting.',
        action: 'Record Follow-up & Close',
        color: '#00C896',
        nextStep: 'linkage_sti' as WizardStep,
      };
    }
    return null;
  }, [historyWithParsed, algorithmResult]);

  // Algorithm stage progress for display
  const algoStages = useMemo(() => {
    const stages = [
      { key: 'screening', label: 'Test 1', sublabel: 'Screening' },
      { key: 'confirmatory', label: 'Test 2', sublabel: 'Confirmatory' },
      { key: 'tie_breaker', label: 'Test 3', sublabel: 'Tie-breaker' },
    ];
    return stages.map(stage => {
      const done = historyWithParsed.some((t: any) => (t.test_stage || t.testStage) === stage.key);
      const active = testForm.testStage === stage.key;
      return { ...stage, done, active };
    });
  }, [historyWithParsed, testForm.testStage]);

  const enrollmentSeedTest = useMemo(() => {
    if (!historyWithParsed.length) return null;
    const positiveTests = historyWithParsed.filter((t: any) =>
      t.test_result === 'positive' || t.test_result === 'reactive' || t.algorithm_result === 'positive'
    );
    return positiveTests.length > 0 ? positiveTests[positiveTests.length - 1] : historyWithParsed[0];
  }, [historyWithParsed]);

  const currentStageLabel = testStageOptions.find(s => s.value === testForm.testStage)?.label || 'Testing';
  const isFinalAlgorithmResult = Boolean(
    algorithmResult?.result === 'positive' ||
    algorithmResult?.result === 'negative' ||
    algorithmResult?.algorithm_result === 'positive' ||
    algorithmResult?.algorithm_result === 'negative'
  );

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-16 max-w-5xl mx-auto px-4">
      <style>{`
        .hiv-result-card { transition: all 0.15s ease; }
        .hiv-result-card:hover { transform: translateY(-1px); }
        .hiv-result-card.selected { transform: scale(1.02); }
      `}</style>

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0A1A1A] via-[#0D1F2D] to-[#080E1A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C896]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00C896]">WHO 2024 · Zimbabwe National Algorithm</p>
            </div>
            <h1 className="text-xl font-bold text-white">HIV Testing Workspace</h1>
            <p className="text-sm text-[#5A78A0] mt-0.5">Algorithm-driven · Test 1 → 2 → 3 · Integrated STI screening</p>
          </div>
          <TestTube className="w-10 h-10 text-[#00C896]/40" />
        </div>

        {/* Algorithm progress */}
        <div className="mt-4 flex items-center gap-2">
          {algoStages.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                stage.done
                  ? 'border-[#00C896]/40 bg-[#00C896]/10 text-[#00C896]'
                  : stage.active && wizardStep === 'run_test'
                  ? 'border-[#FF7A40]/40 bg-[#FF7A40]/10 text-[#FF7A40]'
                  : 'border-white/[0.07] bg-white/[0.03] text-[#3A5A7A]'
              }`}>
                {stage.done ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">{i+1}</span>}
                <span className="hidden sm:inline">{stage.sublabel}</span>
                <span className="sm:hidden">{stage.label}</span>
              </div>
              {i < algoStages.length - 1 && <ChevronRight className="w-3 h-3 text-[#3A5A7A] shrink-0" />}
            </React.Fragment>
          ))}
          {isFinalAlgorithmResult && (
            <>
              <ChevronRight className="w-3 h-3 text-[#3A5A7A] shrink-0" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                (algorithmResult?.result || algorithmResult?.algorithm_result) === 'positive'
                  ? 'border-[#FF4D6A]/40 bg-[#FF4D6A]/10 text-[#FF4D6A]'
                  : 'border-[#00C896]/40 bg-[#00C896]/10 text-[#00C896]'
              }`}>
                <CheckCircle className="w-3 h-3" />
                Final Result
              </div>
            </>
          )}
        </div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-[#00C896]/[0.06] blur-3xl pointer-events-none" />
      </div>

      {/* ── Patient Search ── */}
      {!patientId && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2B7FFF]/15 border border-[#2B7FFF]/25">
              <User className="w-4 h-4 text-[#2B7FFF]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Patient Search</h3>
              <p className="text-[11px] text-[#5A78A0]">Search by name or patient number</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or patient number..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPatients()}
              className={inputCls + ' flex-1'}
            />
            <button
              onClick={searchPatients}
              disabled={searching || !searchTerm.trim()}
              className="px-4 py-2 bg-[#2B7FFF] text-white rounded-xl text-sm font-semibold hover:bg-[#3A8FFF] disabled:opacity-40 transition shrink-0"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {patients.length > 0 && (
            <div className="mt-3 rounded-xl border border-white/[0.07] overflow-hidden">
              {patients.map(patient => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setPatients([]);
                    setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                    setTestHistory([]);
                    setAlgorithmResult(null);
                    resetFormState();
                    setWizardStep('context');
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                >
                  <div className="font-semibold text-white text-sm">{patient.firstName} {patient.lastName}</div>
                  <div className="text-xs text-[#5A78A0]">ID: {patient.patientNumber}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Selected Patient Card ── */}
      {selectedPatient && (
        <div className="flex items-center justify-between rounded-2xl border border-[#00C896]/25 bg-[#00C896]/[0.05] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#00C896]/15 border border-[#00C896]/30 flex items-center justify-center">
              <User className="w-4 h-4 text-[#00C896]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {selectedPatient.first_name || selectedPatient.firstName} {selectedPatient.last_name || selectedPatient.lastName}
              </p>
              <p className="text-xs text-[#5A78A0]">
                {selectedPatient.patientNumber || selectedPatient.patient_number} · {selectedPatient.gender}
                {selectedPatient.date_of_birth || selectedPatient.dateOfBirth
                  ? ` · ${Math.floor((new Date().getTime() - new Date(selectedPatient.date_of_birth || selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs`
                  : ''}
              </p>
            </div>
          </div>
          {!patientId && (
            <button
              onClick={() => { setSelectedPatient(null); setSearchTerm(''); setTestHistory([]); setAlgorithmResult(null); setWizardStep('context'); }}
              className="p-1.5 text-[#3A5A7A] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {selectedPatient && (
        <>
          {/* ── Wizard Step: CONTEXT ── */}
          {wizardStep === 'context' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2B7FFF]/15 border border-[#2B7FFF]/25">
                    <ClipboardList className="w-4 h-4 text-[#2B7FFF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Testing Context</h3>
                    <p className="text-[11px] text-[#5A78A0]">Reason · approach · location · cadre</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#2B7FFF] bg-[#2B7FFF]/10 border border-[#2B7FFF]/20 px-2 py-1 rounded-full">Step 1 of flow</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Reason for testing">
                    <select value={testForm.testingReason} onChange={e => setTestForm({ ...testForm, testingReason: e.target.value })} className={selectCls}>
                      {testingReasonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Testing approach">
                    <select value={testForm.testingApproach} onChange={e => setTestForm({ ...testForm, testingApproach: e.target.value })} className={selectCls}>
                      {testingApproachOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Testing location">
                    <select value={testForm.testingLocation} onChange={e => setTestForm({ ...testForm, testingLocation: e.target.value })} className={selectCls}>
                      {testingLocationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Provider cadre">
                    <select value={testForm.testingCadre} onChange={e => setTestForm({ ...testForm, testingCadre: e.target.value })} className={selectCls}>
                      {testingCadreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Specimen type">
                    <select value={testForm.specimenType} onChange={e => setTestForm({ ...testForm, specimenType: e.target.value })} className={selectCls}>
                      {specimenOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Service point">
                    <select value={testingContext.servicePoint} onChange={e => setTestingContext({ ...testingContext, servicePoint: e.target.value })} className={selectCls}>
                      <option value="">Select...</option>
                      {servicePoints.map(sp => <option key={sp.code} value={sp.code}>{sp.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Outreach / campaign">
                    <select value={testingContext.outreachEvent} onChange={e => setTestingContext({ ...testingContext, outreachEvent: e.target.value })} className={selectCls}>
                      {outreachEvents.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Referred by" className="sm:col-span-2">
                    <input type="text" value={testingContext.referredBy} onChange={e => setTestingContext({ ...testingContext, referredBy: e.target.value })} className={inputCls} placeholder="Optional" />
                  </Field>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setWizardStep('run_test')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00C896] to-[#00A87A] text-[#051119] text-sm font-bold rounded-xl hover:from-[#00D9A3] transition"
                  >
                    Begin Testing <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Wizard Step: RUN TEST ── */}
          {wizardStep === 'run_test' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 overflow-hidden">
              {/* Algorithm step banner */}
              <div className="px-5 py-3 border-b border-white/[0.05] bg-[#FF7A40]/[0.05]">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#FF7A40]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FF7A40]">Algorithm in progress</p>
                    <p className="text-sm font-bold text-white">{currentStageLabel}</p>
                  </div>
                  {testForm.testStage === 'confirmatory' && (
                    <span className="ml-auto text-[10px] text-[#FF7A40] bg-[#FF7A40]/10 border border-[#FF7A40]/20 px-2 py-1 rounded-full font-semibold">
                      Must use different kit from Test 1
                    </span>
                  )}
                  {testForm.testStage === 'tie_breaker' && (
                    <span className="ml-auto text-[10px] text-[#FF7A40] bg-[#FF7A40]/10 border border-[#FF7A40]/20 px-2 py-1 rounded-full font-semibold">
                      Must use kit not used in Tests 1 or 2
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Kit Selection */}
                <div>
                  <p className="text-xs font-bold text-[#7A9AB8] uppercase tracking-wide mb-3">Test Kit</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {testKits.map(kit => {
                      const disabled = isKitDisabledForStage(kit);
                      const selected = testForm.testKitName === kit;
                      const isDual = kit.toLowerCase().includes('syphilis') || kit.toLowerCase().includes('duo');
                      return (
                        <button
                          key={kit}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setTestForm({ ...testForm, testKitName: kit })}
                          className={`relative text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            disabled ? 'opacity-30 cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-[#3A5A7A]'
                            : selected ? 'border-[#00C896]/60 bg-[#00C896]/10 text-white'
                            : 'border-white/[0.07] bg-white/[0.02] text-[#8FA8CC] hover:border-white/[0.14] hover:text-white'
                          }`}
                        >
                          {selected && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#00C896]" />}
                          <span className="block truncate">{kit}</span>
                          {isDual && !disabled && (
                            <span className="mt-1 block text-[9px] text-[#FF7A40] font-bold">HIV + Syphilis</span>
                          )}
                          {disabled && <span className="mt-1 block text-[9px] text-[#3A5A7A]">Used in previous test</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kit metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Kit category">
                    <select value={testForm.kitType} onChange={e => setTestForm({ ...testForm, kitType: e.target.value })} className={selectCls}>
                      {kitTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Test type">
                    <select value={testForm.testType} onChange={e => setTestForm({ ...testForm, testType: e.target.value })} className={selectCls}>
                      {testTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Kit lot number">
                    <input type="text" value={testForm.testKitLot} onChange={e => setTestForm({ ...testForm, testKitLot: e.target.value })} className={inputCls} placeholder="Lot #" />
                  </Field>
                  <Field label="Kit expiry date">
                    <input type="text" value={testForm.testKitExpiry} onChange={e => setTestForm({ ...testForm, testKitExpiry: e.target.value })} className={inputCls} placeholder="dd/mm/yyyy" />
                  </Field>
                  <Field label="Result value" className="sm:col-span-1">
                    <input type="text" value={testForm.resultValue} onChange={e => setTestForm({ ...testForm, resultValue: e.target.value })} className={inputCls} placeholder="Optional" />
                  </Field>
                  <Field label="Result unit">
                    <input type="text" value={testForm.resultUnit} onChange={e => setTestForm({ ...testForm, resultUnit: e.target.value })} className={inputCls} placeholder="e.g., copies/mL" />
                  </Field>
                </div>

                {/* Result — large prominent buttons */}
                <div>
                  <p className="text-xs font-bold text-[#7A9AB8] uppercase tracking-wide mb-3">
                    Test Result <span className="text-[#FF4D6A]">*</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {resultOptions.map(option => {
                      const selected = testForm.testResult === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTestForm({ ...testForm, testResult: option.value })}
                          className={`hiv-result-card relative px-4 py-3.5 rounded-xl border-2 text-sm font-bold text-center transition-all ${
                            selected ? 'selected' : ''
                          }`}
                          style={{
                            borderColor: selected ? option.color : 'rgba(255,255,255,0.07)',
                            background: selected ? option.bg : 'rgba(255,255,255,0.02)',
                            color: selected ? option.color : '#5A78A0',
                          }}
                        >
                          {selected && (
                            <span className="absolute top-1.5 right-1.5">
                              <CheckCircle className="w-3.5 h-3.5" style={{ color: option.color }} />
                            </span>
                          )}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap gap-4">
                  {[
                    { field: 'dualKitUsed', label: 'Dual HIV/Syphilis kit used' },
                    { field: 'selfTestReported', label: 'Client self-tested before visit' },
                    { field: 'selfTestConfirmed', label: 'Self-test confirmed by provider' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center gap-2 text-xs text-[#8FA8CC] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testForm[field as keyof typeof testForm] as boolean}
                        onChange={e => setTestForm({ ...testForm, [field]: e.target.checked })}
                        className="rounded border-white/20 bg-[#060C16] text-[#00C896] focus:ring-[#00C896]/30"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {/* Notes */}
                <Field label="Notes">
                  <textarea
                    value={testForm.notes}
                    onChange={e => setTestForm({ ...testForm, notes: e.target.value })}
                    className={inputCls}
                    rows={2}
                    placeholder="Optional clinical notes..."
                  />
                </Field>

                {/* SNOMED (collapsed) */}
                {snomedReady && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSnomedExpanded(p => !p)}
                      className="text-xs text-[#5A78A0] hover:text-[#00C896] transition-colors font-semibold"
                    >
                      {showSnomedExpanded ? '▲ Hide' : '▼ Add'} SNOMED CT concepts (optional)
                    </button>
                    {showSnomedExpanded && (
                      <div className="mt-3 space-y-3">
                        <SnomedConceptPicker value={testConceptSelection} onChange={setTestConceptSelection} token={snomedToken} tenantSlug={tenantSlug} label="HIV test SNOMED concept" helperText="Select the analyte/procedure for interoperability." context="procedure" />
                        <SnomedConceptPicker value={specimenConceptSelection} onChange={setSpecimenConceptSelection} token={snomedToken} tenantSlug={tenantSlug} label="Specimen SNOMED concept" helperText="Structured specimen description." context="specimen" />
                      </div>
                    )}
                  </div>
                )}

                {/* STI panel — only when dual kit active */}
                {isStiBundleEnabled && (
                  <div className="rounded-xl border border-[#FF7A40]/20 bg-[#FF7A40]/[0.04] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#FF7A40]" />
                        <p className="text-sm font-bold text-white">Integrated STI Testing</p>
                        <span className="text-[10px] text-[#FF7A40] bg-[#FF7A40]/10 border border-[#FF7A40]/20 px-2 py-0.5 rounded-full">Dual kit detected</span>
                      </div>
                      <button type="button" onClick={addStiPanel} className="text-xs text-[#FF7A40] hover:text-[#FFB380] font-semibold flex items-center gap-1 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add STI
                      </button>
                    </div>
                    <div className="space-y-3">
                      {stiPanels.map((panel, index) => (
                        <div key={`${panel.infectionType}-${index}`} className="rounded-xl border border-white/[0.07] bg-[#080E1A]/60 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-[#8FA8CC]">STI Panel {index + 1}</p>
                            {stiPanels.length > 1 && (
                              <button type="button" onClick={() => removeStiPanel(index)} className="text-[#FF4D6A] hover:text-[#FF7A9A] transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Infection">
                              <select value={panel.infectionType} onChange={e => handleStiChange(index, 'infectionType', e.target.value)} className={selectCls}>
                                {infectionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Test method">
                              <select value={panel.testMethod} onChange={e => handleStiChange(index, 'testMethod', e.target.value)} className={selectCls}>
                                {stiMethods.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                              </select>
                            </Field>
                            <Field label="Specimen/site">
                              <select value={panel.specimenType} onChange={e => handleStiChange(index, 'specimenType', e.target.value)} className={selectCls}>
                                {stiSpecimens.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                              </select>
                            </Field>
                            <Field label="Result">
                              <select value={panel.result} onChange={e => handleStiChange(index, 'result', e.target.value)} className={selectCls}>
                                {stiResultOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Treatment regimen">
                              <input type="text" value={panel.treatmentRegimen} onChange={e => handleStiChange(index, 'treatmentRegimen', e.target.value)} className={inputCls} />
                            </Field>
                            <Field label="Treatment date">
                              <input type="date" value={panel.treatmentDate} onChange={e => handleStiChange(index, 'treatmentDate', e.target.value)} className={inputCls} />
                            </Field>
                          </div>
                          <label className="mt-2 flex items-center gap-2 text-xs text-[#8FA8CC] cursor-pointer">
                            <input type="checkbox" checked={panel.treatmentProvided} onChange={e => handleStiChange(index, 'treatmentProvided', e.target.checked)} className="rounded border-white/20 bg-[#060C16] text-[#00C896]" />
                            Treatment provided during this visit
                          </label>
                          {snomedReady && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <SnomedConceptPicker value={panel.infectionConcept ?? null} onChange={c => handleStiConceptChange(index, 'infectionConcept', c)} token={snomedToken} tenantSlug={tenantSlug} label="Infection SNOMED concept" helperText="Optional coded pathogen." context="condition" />
                              <SnomedConceptPicker value={panel.testConcept ?? null} onChange={c => handleStiConceptChange(index, 'testConcept', c)} token={snomedToken} tenantSlug={tenantSlug} label="Test SNOMED concept" helperText="Optional coded procedure." context="procedure" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Record button — only shown when result is selected */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => setWizardStep('context')}
                    className="text-sm text-[#5A78A0] hover:text-white transition-colors font-medium"
                  >
                    ← Back to Context
                  </button>
                  {testForm.testResult ? (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#00C896] to-[#00A87A] text-[#051119] text-sm font-bold rounded-xl hover:from-[#00D9A3] disabled:opacity-50 transition shadow-lg"
                    >
                      {submitting ? (
                        <span className="h-4 w-4 border-2 border-[#051119]/30 border-t-[#051119] rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {submitting ? 'Recording...' : `Record ${currentStageLabel}`}
                    </button>
                  ) : (
                    <div className="text-xs text-[#3A5A7A] italic">Select a result to enable recording</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Wizard Step: POST RECORD (Algorithm Outcome) ── */}
          {wizardStep === 'post_record' && algorithmDecision && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: algorithmDecision.color + '40' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: algorithmDecision.color + '20', background: algorithmDecision.color + '08' }}>
                <div className="flex items-center gap-3">
                  {algorithmDecision.type === 'final_positive' ? (
                    <AlertTriangle className="w-6 h-6" style={{ color: algorithmDecision.color }} />
                  ) : algorithmDecision.type === 'final_negative' ? (
                    <CheckCircle className="w-6 h-6" style={{ color: algorithmDecision.color }} />
                  ) : algorithmDecision.type === 'repeat' ? (
                    <RotateCcw className="w-6 h-6" style={{ color: algorithmDecision.color }} />
                  ) : (
                    <ArrowRight className="w-6 h-6" style={{ color: algorithmDecision.color }} />
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: algorithmDecision.color }}>
                      WHO Algorithm Decision
                    </p>
                    <h3 className="text-lg font-black text-white">{algorithmDecision.title}</h3>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-[#0A1525]/90">
                <p className="text-sm text-[#8FA8CC] leading-relaxed mb-4">{algorithmDecision.message}</p>

                {/* CDSS explanation toggle */}
                <button
                  onClick={() => setShowAlgorithmExplanation(p => !p)}
                  className="text-xs font-semibold text-[#5A78A0] hover:text-[#00C896] transition-colors mb-4 flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  {showAlgorithmExplanation ? 'Hide' : 'Show'} CDSS explanation
                </button>
                {showAlgorithmExplanation && (
                  <div className="mb-4 rounded-xl border border-[#2B7FFF]/20 bg-[#2B7FFF]/[0.05] p-4 space-y-2">
                    <p className="text-xs font-bold text-[#2B7FFF]">Why this decision?</p>
                    {algorithmResult?.interpretation ? (
                      <p className="text-xs text-[#8FA8CC]">{algorithmResult.interpretation}</p>
                    ) : (
                      <p className="text-xs text-[#8FA8CC]">
                        {(algorithmResult?.result || algorithmResult?.algorithm_result) === 'positive'
                          ? 'The national HIV testing algorithm classified this case as HIV Positive because at least two rapid tests in this episode were reactive/positive — consistent with the Zimbabwe/WHO 3-test algorithm.'
                          : (algorithmResult?.result || algorithmResult?.algorithm_result) === 'negative'
                          ? 'The national HIV testing algorithm classified this case as HIV Negative based on a non-reactive screening test or a consistent series of non-reactive results.'
                          : 'The algorithm evaluated the test results against the WHO/Zimbabwe national HIV testing algorithm and determined the next appropriate step as shown above.'}
                      </p>
                    )}
                    {Array.isArray(algorithmResult?.algorithm_steps) && algorithmResult.algorithm_steps.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A78A0] mb-1">Steps considered</p>
                        <ul className="text-xs text-[#7A9AB8] space-y-0.5 list-disc list-inside">
                          {algorithmResult.algorithm_steps.slice(0, 3).map((step: any, idx: number) => (
                            <li key={idx}>{step.test_kit && <span className="font-semibold">{step.test_kit}: </span>}{step.step_result || step.test_result}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (algorithmDecision.nextStep === 'run_test') {
                        setWizardStep('run_test');
                      } else {
                        setWizardStep('linkage_sti');
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition"
                    style={{
                      background: algorithmDecision.color + '20',
                      color: algorithmDecision.color,
                      border: `1px solid ${algorithmDecision.color}40`,
                    }}
                  >
                    {algorithmDecision.nextStep === 'run_test' ? <ArrowRight className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {algorithmDecision.action}
                  </button>
                  {algorithmDecision.type === 'final_positive' && (
                    <button
                      onClick={handleEnrollInCare}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-[#FF4D6A]/20 text-[#FF4D6A] border border-[#FF4D6A]/40 hover:bg-[#FF4D6A]/30 transition"
                    >
                      <Shield className="w-4 h-4" />
                      Enroll in HIV Care
                    </button>
                  )}
                  <button
                    onClick={() => setWizardStep('run_test')}
                    className="px-4 py-2.5 text-xs text-[#5A78A0] border border-white/[0.07] rounded-xl hover:text-white hover:border-white/[0.14] transition"
                  >
                    View Test Form
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Wizard Step: POST RECORD (no algorithm yet) ── */}
          {wizardStep === 'post_record' && !algorithmDecision && (
            <div className="rounded-2xl border border-[#00C896]/20 bg-[#00C896]/[0.05] p-5">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-[#00C896]" />
                <p className="text-sm font-bold text-white">Test result recorded</p>
              </div>
              <p className="text-xs text-[#5A78A0] mb-4">The result has been saved. Review the testing timeline below and proceed as guided by the algorithm.</p>
              <button onClick={() => setWizardStep('linkage_sti')} className="px-4 py-2 text-sm font-semibold text-[#00C896] border border-[#00C896]/30 rounded-xl hover:bg-[#00C896]/10 transition">
                Record Follow-up &amp; Close →
              </button>
            </div>
          )}

          {/* ── Wizard Step: LINKAGE & STI ── */}
          {wizardStep === 'linkage_sti' && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#A66CFF]/15 border border-[#A66CFF]/25">
                  <Shield className="w-4 h-4 text-[#A66CFF]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Linkage, Follow-up & Partner Services</h3>
                  <p className="text-[11px] text-[#5A78A0]">Post-test actions, partner notification, recency assay</p>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Follow-up actions */}
                <div>
                  <p className="text-xs font-bold text-[#7A9AB8] uppercase tracking-wide mb-2">Follow-up actions</p>
                  <div className="flex flex-wrap gap-2">
                    {followUpOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleFollowUpAction(option.value)}
                        className={`px-3 py-1.5 text-xs rounded-full border font-semibold transition ${
                          followUpActions.includes(option.value)
                            ? 'border-[#00C896]/40 bg-[#00C896]/10 text-[#00C896]'
                            : 'border-white/[0.07] bg-white/[0.02] text-[#5A78A0] hover:border-white/[0.14] hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Partner services and linkage */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Partner services">
                    <select value={testForm.partnerNotificationStatus} onChange={e => setTestForm({ ...testForm, partnerNotificationStatus: e.target.value })} className={selectCls}>
                      <option value="">Not recorded</option>
                      {partnerServices.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Linkage action">
                    <select value={testForm.linkageAction} onChange={e => setTestForm({ ...testForm, linkageAction: e.target.value })} className={selectCls}>
                      <option value="">Not recorded</option>
                      {linkageActions.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-[#8FA8CC] font-medium cursor-pointer">
                      <input type="checkbox" checked={testForm.linkageCompleted} onChange={e => setTestForm({ ...testForm, linkageCompleted: e.target.checked })} className="rounded border-white/20 bg-[#060C16] text-[#00C896]" />
                      Linkage completed
                    </label>
                  </div>
                </div>

                {/* Recency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Recency testing performed">
                    <select value={testForm.recencyTestPerformed ? 'yes' : 'no'} onChange={e => setTestForm({ ...testForm, recencyTestPerformed: e.target.value === 'yes' })} className={selectCls}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                  {testForm.recencyTestPerformed && (
                    <>
                      <Field label="Recency result">
                        <select value={testForm.recencyResult} onChange={e => setTestForm({ ...testForm, recencyResult: e.target.value })} className={selectCls}>
                          <option value="">Select...</option>
                          {recencyResultOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Recency kit lot">
                        <input type="text" value={testForm.recencyKitLot} onChange={e => setTestForm({ ...testForm, recencyKitLot: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Recency kit expiry">
                        <input type="text" value={testForm.recencyKitExpiry} onChange={e => setTestForm({ ...testForm, recencyKitExpiry: e.target.value })} className={inputCls} placeholder="dd/mm/yyyy" />
                      </Field>
                    </>
                  )}
                  <Field label="Next recommended test date">
                    <input type="text" value={testForm.nextTestDueDate} onChange={e => setTestForm({ ...testForm, nextTestDueDate: e.target.value })} className={inputCls} placeholder="dd/mm/yyyy" />
                  </Field>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <button onClick={() => setWizardStep('post_record')} className="text-sm text-[#5A78A0] hover:text-white transition-colors font-medium">
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      showSuccess('Complete', 'HIV testing encounter fully documented');
                      setWizardStep('context');
                      setAlgorithmResult(null);
                      setTestHistory([]);
                      resetFormState();
                      loadTestHistory();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00C896] to-[#00A87A] text-[#051119] text-sm font-bold rounded-xl hover:from-[#00D9A3] transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Encounter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Testing History ── */}
          {historyWithParsed.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/90 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF7A40]/15 border border-[#FF7A40]/25">
                  <Calendar className="w-4 h-4 text-[#FF7A40]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Testing Timeline</h3>
                  <p className="text-[11px] text-[#5A78A0]">HIV &amp; STI history for this patient</p>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                {(() => {
                  const now = new Date();
                  const overdueCutoff = new Date(now);
                  overdueCutoff.setDate(overdueCutoff.getDate() - cdssConfig.thresholds.testingOverdueDaysGrace);
                  return historyWithParsed.map((test: any) => {
                    const isPositive = test.test_result === 'positive' || test.test_result === 'reactive' || test.algorithm_result === 'positive';
                    const nextDueDate = test.next_test_due_date ? new Date(test.next_test_due_date) : null;
                    const isOverdue = nextDueDate !== null && nextDueDate < overdueCutoff && !isPositive;
                    const stageLabel = testStageLookup[test.test_stage] || test.test_stage || '—';
                    return (
                      <div key={test.id} className={`rounded-xl border px-4 py-3 ${
                        isPositive ? 'border-[#FF4D6A]/25 bg-[#FF4D6A]/[0.05]'
                        : isOverdue ? 'border-[#FF7A40]/25 bg-[#FF7A40]/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white truncate">{test.test_kit_name || '—'}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isPositive ? 'bg-[#FF4D6A]/15 text-[#FF4D6A] border border-[#FF4D6A]/25'
                                : test.test_result === 'non_reactive' || test.test_result === 'negative'
                                ? 'bg-[#00C896]/10 text-[#00C896] border border-[#00C896]/20'
                                : 'bg-[#FF7A40]/10 text-[#FF7A40] border border-[#FF7A40]/20'
                              }`}>
                                {test.test_result}
                              </span>
                            </div>
                            <p className="text-xs text-[#5A78A0] mt-0.5">
                              {formatDateToDDMMYYYY(test.test_date)} · {stageLabel} · {testingReasonLookup[test.testing_reason] || test.testing_reason || '—'}
                            </p>
                            {isPositive && <p className="text-xs font-semibold text-[#FF4D6A] mt-1">{cdssConfig.messages.testingTimelinePositive}</p>}
                            {isOverdue && <p className="text-xs font-semibold text-[#FF7A40] mt-1">{cdssConfig.messages.testingTimelineOverduePrefix} {formatDateToDDMMYYYY(test.next_test_due_date)}</p>}
                            {test.follow_up_actions?.length > 0 && (
                              <p className="text-[11px] text-[#5A78A0] mt-1">Follow-up: {test.follow_up_actions.join(', ')}</p>
                            )}
                            {test.sti_tests?.length > 0 && (
                              <p className="text-[11px] text-[#FF7A40] mt-0.5">
                                STI: {test.sti_tests.map((s: any) => `${s.infection_type} (${s.result})`).join(', ')}
                              </p>
                            )}
                          </div>
                          {test.algorithm_result && (
                            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              test.algorithm_result === 'positive' ? 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/25'
                              : test.algorithm_result === 'negative' ? 'bg-[#00C896]/10 text-[#00C896] border-[#00C896]/25'
                              : 'bg-[#FF7A40]/10 text-[#FF7A40] border-[#FF7A40]/25'
                            }`}>
                              {test.algorithm_result}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {showEnrollmentModal && selectedPatient && (
        <HIVEnrollmentModal
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.first_name || selectedPatient.firstName} ${selectedPatient.last_name || selectedPatient.lastName}`}
          patientAge={selectedPatient.date_of_birth || selectedPatient.dateOfBirth
            ? Math.floor((new Date().getTime() - new Date(selectedPatient.date_of_birth || selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : undefined}
          patientSex={selectedPatient.gender}
          initialHivTest={enrollmentSeedTest || undefined}
          onClose={() => setShowEnrollmentModal(false)}
          onSuccess={() => { setShowEnrollmentModal(false); loadTestHistory(); }}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
};

export default HIVTestingComponent;
