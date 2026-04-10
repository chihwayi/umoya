import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Home,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

const authHeaders = (token: string, tenantSlug: string) => ({
  'X-Tenant-ID': tenantSlug,
  Authorization: `Bearer ${token}`,
});

const getToken = () => localStorage.getItem('token') || '';
const todayIso = () => new Date().toISOString().slice(0, 10);

const SERVICE_OPTIONS = [
  'anc_counselling',
  'postnatal_followup',
  'muac_screening',
  'tb_dot',
  'health_education',
  'referral',
];

type TabKey = 'overview' | 'households' | 'visits' | 'tasks' | 'tally' | 'supervision';

interface HouseholdRow {
  id: string;
  householdCode: string;
  headOfHousehold: string | null;
  address: string | null;
  village: string | null;
  ward: string | null;
  district: string | null;
  assignedChwId: string | null;
  memberCount?: number;
}

interface HouseholdDetail {
  household: HouseholdRow;
  members: Array<{
    id: string;
    memberName: string;
    dateOfBirth: string | null;
    sex: string | null;
    relationship: string | null;
  }>;
  recentVisits: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    muacMm: number | null;
    muacClassification: string | null;
  }>;
  openTasks: Array<{
    id: string;
    taskType: string;
    dueDate: string;
    priority: string;
  }>;
}

interface VisitRow {
  id: string;
  householdId: string | null;
  householdCode?: string | null;
  patientId: string | null;
  visitDate: string;
  visitType: string;
  muacMm: number | null;
  muacClassification: string | null;
  referredToFacility: boolean;
  synced: boolean;
}

interface TaskRow {
  id: string;
  taskType: string;
  patientId: string | null;
  patientName?: string | null;
  householdId: string | null;
  householdCode?: string | null;
  dueDate: string;
  priority: string;
  status: string;
  instructions: string | null;
  overdue?: boolean;
}

interface TallyRow {
  id?: string;
  chwId: string;
  tallyDate: string;
  householdsVisited: number;
  ancVisits: number;
  postnatalVisits: number;
  sickChildrenSeen: number;
  tbDotObservations: number;
  muacScreenings: number;
  samCasesIdentified: number;
  referralsMade: number;
  immunizationsGiven: number;
  dhis2Synced: boolean;
}

interface SupervisionRow {
  chwId: string;
  visits: number | string;
  samCases: number | string;
  referrals: number | string;
  tasksCompleted: number | string;
}

interface DefaulterRow {
  id: string;
  patientId: string | null;
  patientName?: string | null;
  householdCode?: string | null;
  taskType: string;
  dueDate: string;
  overdueDays: number | string;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
      active
        ? 'border-cyan-600 bg-cyan-500/10 text-cyan-200'
        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
    <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const CHWDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [householdsTotal, setHouseholdsTotal] = useState(0);
  const [householdFilters, setHouseholdFilters] = useState({ village: '', ward: '', district: '', page: 1, limit: 20 });
  const [expandedHouseholdId, setExpandedHouseholdId] = useState<string | null>(null);
  const [householdDetails, setHouseholdDetails] = useState<Record<string, HouseholdDetail>>({});

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitFilters, setVisitFilters] = useState({
    chwId: '',
    householdId: '',
    from: '',
    to: '',
    page: 1,
    limit: 50,
  });

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskStatus, setTaskStatus] = useState('pending');

  const [tallyDate, setTallyDate] = useState(todayIso());
  const [tally, setTally] = useState<TallyRow>({
    chwId: '',
    tallyDate: todayIso(),
    householdsVisited: 0,
    ancVisits: 0,
    postnatalVisits: 0,
    sickChildrenSeen: 0,
    tbDotObservations: 0,
    muacScreenings: 0,
    samCasesIdentified: 0,
    referralsMade: 0,
    immunizationsGiven: 0,
    dhis2Synced: false,
  });

  const [supervision, setSupervision] = useState<SupervisionRow[]>([]);
  const [defaulters, setDefaulters] = useState<DefaulterRow[]>([]);

  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [completingTask, setCompletingTask] = useState<TaskRow | null>(null);
  const [addingMemberFor, setAddingMemberFor] = useState<string | null>(null);

  const [householdForm, setHouseholdForm] = useState({
    householdCode: '',
    headOfHousehold: '',
    address: '',
    village: '',
    ward: '',
    district: '',
    waterSource: '',
    sanitationType: '',
  });

  const [memberForm, setMemberForm] = useState({
    memberName: '',
    dateOfBirth: '',
    sex: '',
    relationship: '',
  });

  const [visitForm, setVisitForm] = useState({
    householdId: '',
    patientId: '',
    visitDate: todayIso(),
    visitType: 'antenatal',
    muacMm: '',
    weightKg: '',
    heightCm: '',
    temperatureCelsius: '',
    servicesProvided: [] as string[],
    referredToFacility: false,
    referralReason: '',
    notes: '',
    gpsLat: '',
    gpsLng: '',
  });

  const [taskForm, setTaskForm] = useState({
    assignedToChwId: '',
    taskType: '',
    dueDate: todayIso(),
    priority: 'normal',
    patientId: '',
    householdId: '',
    instructions: '',
  });

  const [completionNotes, setCompletionNotes] = useState('');

  const currentUser = useMemo(() => {
    const raw = localStorage.getItem('ehr_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id || currentUser?.sub) {
      const id = currentUser.id || currentUser.sub;
      setVisitFilters((prev) => ({ ...prev, chwId: prev.chwId || id }));
      setTally((prev) => ({ ...prev, chwId: prev.chwId || id }));
      setTaskForm((prev) => ({ ...prev, assignedToChwId: prev.assignedToChwId || id }));
    }
  }, [currentUser]);

  const requestConfig = useMemo(() => {
    if (!tenantSlug) return null;
    return { headers: authHeaders(getToken(), tenantSlug) };
  }, [tenantSlug]);

  const apiError = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const fetchHouseholds = useCallback(async () => {
    if (!tenantSlug || !requestConfig) return;
    const params = {
      village: householdFilters.village || undefined,
      ward: householdFilters.ward || undefined,
      page: householdFilters.page,
      limit: householdFilters.limit,
    };
    const res = await ehrAxios.get('/chw/households', { ...requestConfig, params });
    setHouseholds(res.data.data ?? []);
    setHouseholdsTotal(Number(res.data.total ?? 0));
  }, [tenantSlug, requestConfig, householdFilters]);

  const fetchVisits = useCallback(async () => {
    if (!tenantSlug || !requestConfig) return;
    const params = {
      chwId: visitFilters.chwId || undefined,
      householdId: visitFilters.householdId || undefined,
      from: visitFilters.from || undefined,
      to: visitFilters.to || undefined,
      page: visitFilters.page,
      limit: visitFilters.limit,
    };
    const res = await ehrAxios.get('/chw/visits', { ...requestConfig, params });
    setVisits(res.data.data ?? []);
  }, [tenantSlug, requestConfig, visitFilters]);

  const fetchTasks = useCallback(async () => {
    if (!tenantSlug || !requestConfig) return;
    const params = {
      chwId: currentUser?.id || currentUser?.sub || undefined,
      status: taskStatus,
    };
    const res = await ehrAxios.get('/chw/tasks', { ...requestConfig, params });
    setTasks(res.data ?? []);
  }, [tenantSlug, requestConfig, currentUser, taskStatus]);

  const fetchTally = useCallback(async () => {
    if (!tenantSlug || !requestConfig) return;
    const chwId = tally.chwId || currentUser?.id || currentUser?.sub;
    if (!chwId || !tallyDate) return;
    const res = await ehrAxios.get(`/chw/tally/${chwId}/${tallyDate}`, requestConfig);
    if (res.data) {
      setTally({
        ...res.data,
        chwId,
        tallyDate,
      });
      return;
    }
    setTally((prev) => ({
      ...prev,
      chwId,
      tallyDate,
      householdsVisited: 0,
      ancVisits: 0,
      postnatalVisits: 0,
      sickChildrenSeen: 0,
      tbDotObservations: 0,
      muacScreenings: 0,
      samCasesIdentified: 0,
      referralsMade: 0,
      immunizationsGiven: 0,
      dhis2Synced: false,
    }));
  }, [tenantSlug, requestConfig, tally.chwId, tallyDate, currentUser]);

  const fetchSupervision = useCallback(async () => {
    if (!tenantSlug || !requestConfig) return;
    const [dashboardRes, defaultersRes] = await Promise.all([
      ehrAxios.get('/chw/supervision/dashboard', requestConfig),
      ehrAxios.get('/chw/supervision/defaulters', requestConfig),
    ]);
    setSupervision(dashboardRes.data ?? []);
    setDefaulters(defaultersRes.data ?? []);
  }, [tenantSlug, requestConfig]);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchHouseholds(),
        fetchVisits(),
        fetchTasks(),
        fetchTally(),
        fetchSupervision(),
      ]);
    } catch (error: any) {
      showError('CHW overview', apiError(error, 'Failed to load CHW overview'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchHouseholds, fetchVisits, fetchTasks, fetchTally, fetchSupervision, showError]);

  useEffect(() => {
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'households') {
      fetchHouseholds().catch((error: any) => showError('Households', apiError(error, 'Failed to load households')));
    }
  }, [tab, fetchHouseholds, showError]);

  useEffect(() => {
    if (tab === 'visits') {
      fetchVisits().catch((error: any) => showError('Visits', apiError(error, 'Failed to load visits')));
    }
  }, [tab, fetchVisits, showError]);

  useEffect(() => {
    if (tab === 'tasks') {
      fetchTasks().catch((error: any) => showError('Tasks', apiError(error, 'Failed to load tasks')));
    }
  }, [tab, fetchTasks, showError]);

  useEffect(() => {
    if (tab === 'tally') {
      fetchTally().catch((error: any) => showError('Tally', apiError(error, 'Failed to load tally')));
    }
  }, [tab, fetchTally, showError]);

  useEffect(() => {
    if (tab === 'supervision') {
      fetchSupervision().catch((error: any) => showError('Supervision', apiError(error, 'Failed to load supervision data')));
    }
  }, [tab, fetchSupervision, showError]);

  const muacPreview = useMemo(() => {
    if (!visitForm.muacMm) return 'Enter MUAC to preview classification';
    const value = Number(visitForm.muacMm);
    if (Number.isNaN(value)) return 'Enter MUAC to preview classification';
    if (value < 115) return '< 115 → SAM';
    if (value <= 124) return '115–124 → MAM';
    return '≥ 125 → Normal';
  }, [visitForm.muacMm]);

  const chartData = useMemo(() => {
    const lookback = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      lookback.set(key, 0);
    }
    visits.forEach((visit) => {
      if (lookback.has(visit.visitDate)) {
        lookback.set(visit.visitDate, (lookback.get(visit.visitDate) || 0) + 1);
      }
    });
    return Array.from(lookback.entries()).map(([day, count]) => ({
      day: day.slice(5),
      count,
    }));
  }, [visits]);

  const overviewStats = useMemo(() => {
    const today = todayIso();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDayKey = sevenDaysAgo.toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);
    return {
      totalHouseholds: householdsTotal,
      openTasksToday: tasks.filter((task) => task.status !== 'completed' && task.dueDate <= today).length,
      samCasesMonth: visits.filter((visit) => visit.visitDate.startsWith(monthKey) && visit.muacClassification === 'SAM').length,
      referralsWeek: visits.filter((visit) => visit.visitDate >= sevenDayKey && visit.referredToFacility).length,
    };
  }, [householdsTotal, tasks, visits]);

  const displayedHouseholds = useMemo(() => {
    if (!householdFilters.district) return households;
    return households.filter((household) =>
      (household.district || '').toLowerCase().includes(householdFilters.district.toLowerCase()),
    );
  }, [households, householdFilters.district]);

  const handleHouseholdChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setHouseholdForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemberChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVisitChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = event.target;
    const { name, value } = target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox' && name === 'referredToFacility') {
      setVisitForm((prev) => ({ ...prev, referredToFacility: target.checked }));
      return;
    }
    setVisitForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTallyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setTally((prev) => ({ ...prev, [name]: Number(value || 0) }));
  };

  const toggleService = (service: string) => {
    setVisitForm((prev) => ({
      ...prev,
      servicesProvided: prev.servicesProvided.includes(service)
        ? prev.servicesProvided.filter((item) => item !== service)
        : [...prev.servicesProvided, service],
    }));
  };

  const openHouseholdDetail = async (householdId: string) => {
    if (!tenantSlug || !requestConfig) return;
    setExpandedHouseholdId((prev) => (prev === householdId ? null : householdId));
    if (householdDetails[householdId]) return;
    try {
      const res = await ehrAxios.get(`/chw/households/${householdId}`, requestConfig);
      setHouseholdDetails((prev) => ({ ...prev, [householdId]: res.data }));
    } catch (error: any) {
      showError('Household detail', apiError(error, 'Failed to load household detail'));
    }
  };

  const submitHousehold = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig) return;
    try {
      await ehrAxios.post('/chw/households', householdForm, requestConfig);
      setShowHouseholdModal(false);
      setHouseholdForm({
        householdCode: '',
        headOfHousehold: '',
        address: '',
        village: '',
        ward: '',
        district: '',
        waterSource: '',
        sanitationType: '',
      });
      await fetchHouseholds();
      showSuccess('Household registered', 'The household has been saved successfully.');
    } catch (error: any) {
      showError('Household registration', apiError(error, 'Failed to register household'));
    }
  };

  const submitMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig || !addingMemberFor) return;
    try {
      await ehrAxios.post(`/chw/households/${addingMemberFor}/members`, memberForm, requestConfig);
      setMemberForm({ memberName: '', dateOfBirth: '', sex: '', relationship: '' });
      await openHouseholdDetail(addingMemberFor);
      showSuccess('Member added', 'Household member added successfully.');
      setAddingMemberFor(null);
    } catch (error: any) {
      showError('Add member', apiError(error, 'Failed to add household member'));
    }
  };

  const submitVisit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig) return;
    try {
      await ehrAxios.post('/chw/visits', {
        ...visitForm,
        muacMm: visitForm.muacMm ? Number(visitForm.muacMm) : null,
        weightKg: visitForm.weightKg ? Number(visitForm.weightKg) : null,
        heightCm: visitForm.heightCm ? Number(visitForm.heightCm) : null,
        temperatureCelsius: visitForm.temperatureCelsius ? Number(visitForm.temperatureCelsius) : null,
        gpsLat: visitForm.gpsLat ? Number(visitForm.gpsLat) : null,
        gpsLng: visitForm.gpsLng ? Number(visitForm.gpsLng) : null,
      }, requestConfig);
      setShowVisitModal(false);
      setVisitForm({
        householdId: '',
        patientId: '',
        visitDate: todayIso(),
        visitType: 'antenatal',
        muacMm: '',
        weightKg: '',
        heightCm: '',
        temperatureCelsius: '',
        servicesProvided: [],
        referredToFacility: false,
        referralReason: '',
        notes: '',
        gpsLat: '',
        gpsLng: '',
      });
      await fetchVisits();
      showSuccess('Visit recorded', 'The CHW visit has been recorded successfully.');
    } catch (error: any) {
      showError('Record visit', apiError(error, 'Failed to record CHW visit'));
    }
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig) return;
    try {
      await ehrAxios.post('/chw/tasks', taskForm, requestConfig);
      setShowTaskModal(false);
      setTaskForm({
        assignedToChwId: currentUser?.id || currentUser?.sub || '',
        taskType: '',
        dueDate: todayIso(),
        priority: 'normal',
        patientId: '',
        householdId: '',
        instructions: '',
      });
      await fetchTasks();
      showSuccess('Task assigned', 'The CHW task has been assigned successfully.');
    } catch (error: any) {
      showError('Assign task', apiError(error, 'Failed to assign task'));
    }
  };

  const submitCompletion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig || !completingTask) return;
    try {
      await ehrAxios.patch(`/chw/tasks/${completingTask.id}/complete`, { notes: completionNotes }, requestConfig);
      setCompletingTask(null);
      setCompletionNotes('');
      await fetchTasks();
      showSuccess('Task completed', 'The task has been marked as completed.');
    } catch (error: any) {
      showError('Complete task', apiError(error, 'Failed to complete task'));
    }
  };

  const submitTally = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !requestConfig) return;
    try {
      const res = await ehrAxios.post('/chw/tally', tally, requestConfig);
      setTally(res.data);
      showSuccess('Tally submitted', 'The daily CHW tally has been saved successfully.');
    } catch (error: any) {
      showError('Submit tally', apiError(error, 'Failed to submit tally'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Community Health Worker Dashboard</h1>
              <p className="text-sm text-slate-400">Households, visits, tasks, tallies, and supervision in one workspace.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 hover:text-white"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <TabButton active={tab === 'overview'} icon={<BarChart3 className="h-4 w-4" />} label="Overview" onClick={() => setTab('overview')} />
          <TabButton active={tab === 'households'} icon={<Home className="h-4 w-4" />} label="Households" onClick={() => setTab('households')} />
          <TabButton active={tab === 'visits'} icon={<Activity className="h-4 w-4" />} label="Visits" onClick={() => setTab('visits')} />
          <TabButton active={tab === 'tasks'} icon={<ClipboardList className="h-4 w-4" />} label="Tasks" onClick={() => setTab('tasks')} />
          <TabButton active={tab === 'tally'} icon={<ClipboardCheck className="h-4 w-4" />} label="Tally" onClick={() => setTab('tally')} />
          <TabButton active={tab === 'supervision'} icon={<ShieldAlert className="h-4 w-4" />} label="Supervision" onClick={() => setTab('supervision')} />
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total Households" value={overviewStats.totalHouseholds} icon={<Home className="h-5 w-5 text-cyan-200" />} tone="bg-cyan-500/10 text-cyan-200" />
                  <StatCard label="Open Tasks Due Today" value={overviewStats.openTasksToday} icon={<ClipboardList className="h-5 w-5 text-amber-200" />} tone="bg-amber-500/10 text-amber-200" />
                  <StatCard label="SAM Cases This Month" value={overviewStats.samCasesMonth} icon={<AlertTriangle className="h-5 w-5 text-rose-200" />} tone="bg-rose-500/10 text-rose-200" />
                  <StatCard label="Referrals This Week" value={overviewStats.referralsWeek} icon={<Users className="h-5 w-5 text-emerald-200" />} tone="bg-emerald-500/10 text-emerald-200" />
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Visits Last 14 Days</h2>
                        <p className="text-sm text-slate-400">Daily visit count from recorded CHW visits.</p>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="day" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" allowDecimals={false} />
                          <Tooltip contentStyle={{ background: '#020617', borderColor: '#1e293b' }} />
                          <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                    <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
                    <p className="mt-1 text-sm text-slate-400">Jump into the most common CHW workflows.</p>
                    <div className="mt-4 space-y-3">
                      <button type="button" onClick={() => { setTab('visits'); setShowVisitModal(true); }} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-slate-700">
                        <span className="text-sm font-medium text-white">Record Visit</span>
                        <Plus className="h-4 w-4 text-slate-400" />
                      </button>
                      <button type="button" onClick={() => { setTab('households'); setShowHouseholdModal(true); }} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-slate-700">
                        <span className="text-sm font-medium text-white">Register Household</span>
                        <Plus className="h-4 w-4 text-slate-400" />
                      </button>
                      <button type="button" onClick={() => setTab('tally')} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-slate-700">
                        <span className="text-sm font-medium text-white">Submit Tally</span>
                        <Plus className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'households' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <input value={householdFilters.village} onChange={(e) => setHouseholdFilters((prev) => ({ ...prev, village: e.target.value }))} placeholder="Search village" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none" />
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <input value={householdFilters.ward} onChange={(e) => setHouseholdFilters((prev) => ({ ...prev, ward: e.target.value }))} placeholder="Search ward" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none" />
                    </div>
                    <input value={householdFilters.district} onChange={(e) => setHouseholdFilters((prev) => ({ ...prev, district: e.target.value }))} placeholder="Filter district" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <button type="button" onClick={() => setShowHouseholdModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                      <Plus className="h-4 w-4" />
                      Register Household
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-950/70 text-left text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Household Code</th>
                          <th className="px-4 py-3">Head</th>
                          <th className="px-4 py-3">Village</th>
                          <th className="px-4 py-3">Ward</th>
                          <th className="px-4 py-3"># Members</th>
                          <th className="px-4 py-3">Assigned CHW</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedHouseholds.map((household) => {
                          const detail = householdDetails[household.id];
                          const expanded = expandedHouseholdId === household.id;
                          return (
                            <React.Fragment key={household.id}>
                              <tr className="border-t border-slate-800 text-slate-200 hover:bg-slate-950/40">
                                <td className="px-4 py-3 font-medium text-white">{household.householdCode}</td>
                                <td className="px-4 py-3">{household.headOfHousehold || '—'}</td>
                                <td className="px-4 py-3">{household.village || '—'}</td>
                                <td className="px-4 py-3">{household.ward || '—'}</td>
                                <td className="px-4 py-3">{household.memberCount ?? detail?.members.length ?? 0}</td>
                                <td className="px-4 py-3">{household.assignedChwId || '—'}</td>
                                <td className="px-4 py-3">
                                  <button type="button" onClick={() => openHouseholdDetail(household.id)} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200">
                                    {expanded ? 'Hide' : 'View'}
                                  </button>
                                </td>
                              </tr>
                              {expanded && detail && (
                                <tr className="border-t border-slate-800 bg-slate-950/40">
                                  <td colSpan={7} className="px-4 py-4">
                                    <div className="grid gap-4 lg:grid-cols-3">
                                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                          <h3 className="font-medium text-white">Members</h3>
                                          <button type="button" onClick={() => setAddingMemberFor(household.id)} className="text-xs text-cyan-300">
                                            Add Member
                                          </button>
                                        </div>
                                        <div className="space-y-2 text-sm text-slate-300">
                                          {detail.members.length === 0 ? <p className="text-slate-500">No members added yet.</p> : detail.members.map((member) => (
                                            <div key={member.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                                              <p className="font-medium text-white">{member.memberName}</p>
                                              <p className="text-xs text-slate-400">{member.relationship || 'Relationship not set'} • {member.sex || 'Sex not set'}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                                        <h3 className="mb-3 font-medium text-white">Recent Visits</h3>
                                        <div className="space-y-2 text-sm text-slate-300">
                                          {detail.recentVisits.length === 0 ? <p className="text-slate-500">No visits recorded.</p> : detail.recentVisits.map((visit) => (
                                            <div key={visit.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                                              <p className="font-medium text-white">{visit.visitType.replace(/_/g, ' ')}</p>
                                              <p className="text-xs text-slate-400">{visit.visitDate} • MUAC {visit.muacMm ?? '—'} • {visit.muacClassification || 'No classification'}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                                        <h3 className="mb-3 font-medium text-white">Open Tasks</h3>
                                        <div className="space-y-2 text-sm text-slate-300">
                                          {detail.openTasks.length === 0 ? <p className="text-slate-500">No open tasks.</p> : detail.openTasks.map((task) => (
                                            <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                                              <p className="font-medium text-white">{task.taskType.replace(/_/g, ' ')}</p>
                                              <p className="text-xs text-slate-400">Due {task.dueDate} • {task.priority}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'visits' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    <input value={visitFilters.chwId} onChange={(e) => setVisitFilters((prev) => ({ ...prev, chwId: e.target.value }))} placeholder="CHW ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <input value={visitFilters.householdId} onChange={(e) => setVisitFilters((prev) => ({ ...prev, householdId: e.target.value }))} placeholder="Household ID" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <input type="date" value={visitFilters.from} onChange={(e) => setVisitFilters((prev) => ({ ...prev, from: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <input type="date" value={visitFilters.to} onChange={(e) => setVisitFilters((prev) => ({ ...prev, to: e.target.value }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <button type="button" onClick={() => setShowVisitModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                      <Plus className="h-4 w-4" />
                      Record Visit
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">MUAC preview: {muacPreview}</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-950/70 text-left text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Visit Type</th>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Household</th>
                          <th className="px-4 py-3">MUAC</th>
                          <th className="px-4 py-3">Classification</th>
                          <th className="px-4 py-3">Referred</th>
                          <th className="px-4 py-3">Synced</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visits.map((visit) => (
                          <tr key={visit.id} className="border-t border-slate-800 text-slate-200">
                            <td className="px-4 py-3">{visit.visitDate}</td>
                            <td className="px-4 py-3">{visit.visitType.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3">{visit.patientId || '—'}</td>
                            <td className="px-4 py-3">{visit.householdCode || visit.householdId || '—'}</td>
                            <td className="px-4 py-3">{visit.muacMm ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                                visit.muacClassification === 'SAM'
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : visit.muacClassification === 'MAM'
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-emerald-500/15 text-emerald-300'
                              }`}>
                                {visit.muacClassification || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs ${visit.referredToFacility ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                                {visit.referredToFacility ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs ${visit.synced ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                                {visit.synced ? 'Synced' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'tasks' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="all">All</option>
                    </select>
                    <button type="button" onClick={() => setShowTaskModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                      <Plus className="h-4 w-4" />
                      Assign Task
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-950/70 text-left text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Task Type</th>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Household</th>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3">Priority</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Instructions</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.id} className={`border-t border-slate-800 text-slate-200 ${task.overdue ? 'bg-rose-950/20' : ''}`}>
                            <td className="px-4 py-3">{task.taskType.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3">{task.patientName || task.patientId || '—'}</td>
                            <td className="px-4 py-3">{task.householdCode || task.householdId || '—'}</td>
                            <td className="px-4 py-3">{task.dueDate}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs ${
                                task.priority === 'high' ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs ${
                                task.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                              }`}>
                                {task.status}
                              </span>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-slate-400">{task.instructions || '—'}</td>
                            <td className="px-4 py-3">
                              {task.status !== 'completed' && (
                                <button type="button" onClick={() => setCompletingTask(task)} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200">
                                  Complete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'tally' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Daily Tally</h2>
                    <p className="text-sm text-slate-400">Capture and resubmit CHW field tallies by date.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="date" value={tallyDate} onChange={(e) => setTallyDate(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tally.dhis2Synced ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                      {tally.dhis2Synced ? 'Synced' : 'Pending'}
                    </span>
                  </div>
                </div>
                <form onSubmit={submitTally} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['householdsVisited', 'Households Visited'],
                    ['ancVisits', 'ANC Visits'],
                    ['postnatalVisits', 'Postnatal Visits'],
                    ['sickChildrenSeen', 'Sick Children Seen'],
                    ['tbDotObservations', 'TB DOT Observations'],
                    ['muacScreenings', 'MUAC Screenings'],
                    ['samCasesIdentified', 'SAM Cases Identified'],
                    ['referralsMade', 'Referrals Made'],
                    ['immunizationsGiven', 'Immunizations Given'],
                  ].map(([name, label]) => (
                    <label key={name} className="block">
                      <span className="mb-1 block text-sm text-slate-300">{label}</span>
                      <input type="number" min={0} name={name} value={String((tally as any)[name] ?? 0)} onChange={handleTallyChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                    </label>
                  ))}
                  <div className="md:col-span-2 xl:col-span-3">
                    <button type="submit" className="rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                      Submit Tally
                    </button>
                  </div>
                </form>
              </div>
            )}

            {tab === 'supervision' && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <h2 className="text-lg font-semibold text-white">CHW Supervision Dashboard</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-950/70 text-left text-slate-400">
                        <tr>
                          <th className="px-4 py-3">CHW ID</th>
                          <th className="px-4 py-3">Visits (30d)</th>
                          <th className="px-4 py-3">SAM Cases</th>
                          <th className="px-4 py-3">Referrals</th>
                          <th className="px-4 py-3">Tasks Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supervision.map((row) => (
                          <tr key={row.chwId} className="border-t border-slate-800 text-slate-200">
                            <td className="px-4 py-3">{row.chwId}</td>
                            <td className="px-4 py-3">{row.visits}</td>
                            <td className="px-4 py-3">{row.samCases}</td>
                            <td className="px-4 py-3">{row.referrals}</td>
                            <td className="px-4 py-3">{row.tasksCompleted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <h2 className="text-lg font-semibold text-white">Defaulters</h2>
                  <div className="mt-4 space-y-3">
                    {defaulters.length === 0 ? (
                      <p className="text-sm text-slate-500">No overdue CHW tasks found.</p>
                    ) : (
                      defaulters.map((defaulter) => (
                        <div key={defaulter.id} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{defaulter.patientName || defaulter.patientId || 'Unknown patient'}</p>
                              <p className="text-sm text-slate-400">
                                {defaulter.taskType.replace(/_/g, ' ')} • Due {defaulter.dueDate} • Household {defaulter.householdCode || '—'}
                              </p>
                            </div>
                            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-300">
                              Overdue by {defaulter.overdueDays} day(s)
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showHouseholdModal && (
        <ModalShell title="Register Household" onClose={() => setShowHouseholdModal(false)}>
          <form onSubmit={submitHousehold} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Household Code</span>
              <input required name="householdCode" value={householdForm.householdCode} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Head of Household</span>
              <input name="headOfHousehold" value={householdForm.headOfHousehold} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-300">Address</span>
              <textarea name="address" value={householdForm.address} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Village</span>
              <input name="village" value={householdForm.village} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Ward</span>
              <input name="ward" value={householdForm.ward} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">District</span>
              <input name="district" value={householdForm.district} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Water Source</span>
              <input name="waterSource" value={householdForm.waterSource} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Sanitation Type</span>
              <input name="sanitationType" value={householdForm.sanitationType} onChange={handleHouseholdChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                Save Household
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {addingMemberFor && (
        <ModalShell title="Add Household Member" onClose={() => setAddingMemberFor(null)}>
          <form onSubmit={submitMember} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Member Name</span>
              <input required name="memberName" value={memberForm.memberName} onChange={handleMemberChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Date of Birth</span>
              <input type="date" name="dateOfBirth" value={memberForm.dateOfBirth} onChange={handleMemberChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Sex</span>
              <select name="sex" value={memberForm.sex} onChange={handleMemberChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Relationship</span>
              <input name="relationship" value={memberForm.relationship} onChange={handleMemberChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                Save Member
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showVisitModal && (
        <ModalShell title="Record Visit" onClose={() => setShowVisitModal(false)}>
          <form onSubmit={submitVisit} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Household ID</span>
              <input name="householdId" value={visitForm.householdId} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Patient ID</span>
              <input name="patientId" value={visitForm.patientId} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Visit Date</span>
              <input type="date" name="visitDate" value={visitForm.visitDate} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Visit Type</span>
              <select name="visitType" value={visitForm.visitType} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                <option value="antenatal">antenatal</option>
                <option value="postnatal">postnatal</option>
                <option value="sick_child">sick_child</option>
                <option value="tb_dot">tb_dot</option>
                <option value="growth_monitoring">growth_monitoring</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">MUAC (mm)</span>
              <input name="muacMm" value={visitForm.muacMm} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
              <span className="mt-1 block text-xs text-slate-500">{muacPreview}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Weight (kg)</span>
              <input name="weightKg" value={visitForm.weightKg} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Height (cm)</span>
              <input name="heightCm" value={visitForm.heightCm} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Temperature (°C)</span>
              <input name="temperatureCelsius" value={visitForm.temperatureCelsius} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <div className="md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Services Provided</span>
              <div className="grid gap-2 md:grid-cols-3">
                {SERVICE_OPTIONS.map((service) => (
                  <label key={service} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                    <input type="checkbox" checked={visitForm.servicesProvided.includes(service)} onChange={() => toggleService(service)} />
                    {service.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              <input type="checkbox" name="referredToFacility" checked={visitForm.referredToFacility} onChange={handleVisitChange} />
              Referred to facility
            </label>
            {visitForm.referredToFacility && (
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm text-slate-300">Referral Reason</span>
                <textarea name="referralReason" value={visitForm.referralReason} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
              </label>
            )}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-300">Notes</span>
              <textarea name="notes" value={visitForm.notes} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">GPS Lat</span>
              <input name="gpsLat" value={visitForm.gpsLat} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">GPS Lng</span>
              <input name="gpsLng" value={visitForm.gpsLng} onChange={handleVisitChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                Save Visit
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showTaskModal && (
        <ModalShell title="Assign Task" onClose={() => setShowTaskModal(false)}>
          <form onSubmit={submitTask} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Assigned To CHW ID</span>
              <input required name="assignedToChwId" value={taskForm.assignedToChwId} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Task Type</span>
              <input required name="taskType" value={taskForm.taskType} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Due Date</span>
              <input type="date" required name="dueDate" value={taskForm.dueDate} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Priority</span>
              <select name="priority" value={taskForm.priority} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Patient ID</span>
              <input name="patientId" value={taskForm.patientId} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Household ID</span>
              <input name="householdId" value={taskForm.householdId} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-300">Instructions</span>
              <textarea name="instructions" value={taskForm.instructions} onChange={handleTaskChange} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                Save Task
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {completingTask && (
        <ModalShell title="Complete Task" onClose={() => setCompletingTask(null)}>
          <form onSubmit={submitCompletion} className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-300">
                Completing <span className="font-medium text-white">{completingTask.taskType.replace(/_/g, ' ')}</span>
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Completion Notes</span>
              <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none" rows={4} />
            </label>
            <button type="submit" className="rounded-xl border border-emerald-700 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
              Mark Completed
            </button>
          </form>
        </ModalShell>
      )}
    </div>
  );
};

export default CHWDashboard;
