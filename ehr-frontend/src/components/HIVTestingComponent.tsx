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
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVTestingComponentProps {
  tenantSlug: string;
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

const HIVTestingComponent: React.FC<HIVTestingComponentProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
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

  useEffect(() => {
    if (selectedPatient) {
      loadTestHistory();
    }
  }, [selectedPatient]);

  const resetFormState = (historyCount = 0) => {
    setTestForm({
      ...defaultTestForm,
      testKitName: historyCount === 0 ? testKits[0] : testKits[1] || testKits[0],
    });
    setTestingContext(defaultTestingContext);
    setFollowUpActions([]);
    setStiPanels([defaultStiPanel]);
  };

  const loadTestHistory = async () => {
    if (!selectedPatient) return;
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const response = await ehrApi.getPatientHivTests(selectedPatient.id, token, tenantSlug);
      setTestHistory(response.data.tests || []);

      if (response.data.tests && response.data.tests.length > 0) {
        const latestTest = response.data.tests[0];
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

  const addStiPanel = () => {
    setStiPanels((prev) => [...prev, { ...defaultStiPanel }]);
  };

  const removeStiPanel = (index: number) => {
    setStiPanels((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitTest = async () => {
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
        testKitExpiry: testForm.testKitExpiry || null,
        dualKitUsed: testForm.dualKitUsed,
        testResult: testForm.testResult,
        resultValue: testForm.resultValue || null,
        resultUnit: testForm.resultUnit || null,
        selfTestReported: testForm.selfTestReported,
        selfTestConfirmed: testForm.selfTestConfirmed,
        recencyTestPerformed: testForm.recencyTestPerformed,
        recencyResult: testForm.recencyResult || null,
        recencyKitLot: testForm.recencyKitLot || null,
        recencyKitExpiry: testForm.recencyKitExpiry || null,
        partnerNotificationStatus: testForm.partnerNotificationStatus || null,
        linkageAction: testForm.linkageAction || null,
        linkageCompleted: testForm.linkageCompleted,
        nextTestDueDate: testForm.nextTestDueDate || null,
        notes: testForm.notes || null,
        followUpActions,
        testingContext,
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
          })),
      };

      const response = await ehrApi.createHivTest(payload, token, tenantSlug);

      showSuccess('Success', 'HIV/STI testing encounter recorded');
      resetFormState(testHistory.length);
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
  const activeStepIndex = formSteps.findIndex((step) => step.id === activeStep);
  const goToPreviousStep = () => {
    if (activeStepIndex > 0) {
      setActiveStep(formSteps[activeStepIndex - 1].id);
    }
  };
  const goToNextStep = () => {
    if (activeStepIndex < formSteps.length - 1) {
      setActiveStep(formSteps[activeStepIndex + 1].id);
    }
  };

  const formSections: Record<FormStepId, React.ReactNode> = {
    context: (
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
                value={(testForm as Record<string, string>)[field]}
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
            <input
              type="text"
              value={testingContext.servicePoint}
              onChange={(e) => setTestingContext({ ...testingContext, servicePoint: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., OPD room"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Outreach / campaign</label>
            <input
              type="text"
              value={testingContext.outreachEvent}
              onChange={(e) => setTestingContext({ ...testingContext, outreachEvent: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional"
            />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Test kit</label>
            <select
              value={testForm.testKitName}
              onChange={(e) => setTestForm({ ...testForm, testKitName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {testKits.map((kit) => (
                <option key={kit} value={kit}>
                  {kit}
                </option>
              ))}
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
              type="date"
              value={testForm.testKitExpiry}
              onChange={(e) => setTestForm({ ...testForm, testKitExpiry: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
            <input
              type="text"
              value={testForm.partnerNotificationStatus}
              onChange={(e) =>
                setTestForm({ ...testForm, partnerNotificationStatus: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Offered / accepted / declined"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Linkage action</label>
            <input
              type="text"
              value={testForm.linkageAction}
              onChange={(e) => setTestForm({ ...testForm, linkageAction: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="ART, PrEP, PEP..."
            />
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
                  type="date"
                  value={testForm.recencyKitExpiry}
                  onChange={(e) =>
                    setTestForm({ ...testForm, recencyKitExpiry: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Next recommended test date
            </label>
            <input
              type="date"
              value={testForm.nextTestDueDate}
              onChange={(e) => setTestForm({ ...testForm, nextTestDueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Test method</label>
                  <input
                    type="text"
                    value={panel.testMethod}
                    onChange={(e) => handleStiChange(index, 'testMethod', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., NAAT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Specimen/site</label>
                  <input
                    type="text"
                    value={panel.specimenType}
                    onChange={(e) => handleStiChange(index, 'specimenType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., cervical swab"
                  />
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
        title="Patient search & intake"
        icon={<User className="w-5 h-5" />}
        description="Find the client, review demographics, then proceed through the WHO-aligned workflow."
      >
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

      {selectedPatient && (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {formSteps.map((step) => (
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
                disabled={activeStepIndex === formSteps.length - 1}
                className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              >
                Next section
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSubmitTest}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold"
              >
                <Save className="w-5 h-5" />
                {submitting ? 'Recording…' : 'Record Encounter'}
              </button>
            </div>

            {(algorithmResult || historyWithParsed.length > 0) && (
              <div className="grid gap-6 lg:grid-cols-2">
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
                        {(algorithmResult.next_step || algorithmResult.recommendation) && (
                          <p className="text-sm text-slate-600 mt-2">
                            {algorithmResult.next_step || algorithmResult.recommendation}
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
                      {historyWithParsed.map((test: any) => (
                        <div key={test.id} className="border border-slate-200 rounded-2xl px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{test.test_kit_name}</p>
                              <p className="text-sm text-slate-500">
                                {formatDateToDDMMYYYY(test.test_date)} ·{' '}
                                <span className="font-medium text-slate-700">{test.test_result}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {testingReasonLookup[test.testing_reason] || test.testing_reason || '—'} · Step:{' '}
                                {testStageLookup[test.test_stage] || test.test_stage}
                              </p>
                            </div>
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
                          </div>
                          {test.follow_up_actions && test.follow_up_actions.length > 0 && (
                            <p className="text-xs text-slate-600 mt-2">
                              Follow-up: {test.follow_up_actions.join(', ')}
                            </p>
                          )}
                          {test.sti_tests && test.sti_tests.length > 0 && (
                            <p className="text-xs text-rose-600 mt-1">
                              STI screens: {test.sti_tests.map((sti: any) => `${sti.infection_type} (${sti.result})`).join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
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
