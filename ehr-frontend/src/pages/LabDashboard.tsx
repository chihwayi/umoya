import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TestTube,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Upload,
  Search,
  RefreshCw,
  User,
  LogOut,
  Calendar,
  Activity,
  Filter,
  Eye,
  Play,
  FileCheck,
  Send,
  Download,
  X,
  Plus,
  Cpu,
  Layers,
  Zap,
  Microscope,
  FlaskConical,
  Droplet,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface LabOrder {
  id: string;
  orderNumber: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth: string;
  };
  orderingProvider: {
    id: string;
    firstName: string;
    lastName: string;
  };
  tests: Array<{
    testCode: string;
    testName: string;
    category: string;
    specimenType: string;
    instructions?: string;
  }>;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'collected' | 'in_progress' | 'completed' | 'cancelled';
  clinicalInfo?: string;
  specialInstructions?: string;
  scheduledDateTime?: string;
  collectedAt?: string;
  collectedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  results?: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    resultDate: string;
    performedBy: string;
  }>;
  interpretation?: string;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  processingContext?: LabProcessingContext | null;
  workflowEvents?: LabWorkflowEvent[] | null;
  handoffNotes?: LabHandoffNote[] | null;
  notificationLog?: LabNotificationEntry[] | null;
}

interface LabResult {
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'normal' | 'high' | 'low' | 'critical';
}

interface LabProcessingContext {
  analyzer?: {
    id: string;
    name: string;
    status?: 'online' | 'maintenance' | 'offline';
    location?: string;
    throughputPerHour?: number;
    reagentLevel?: number;
    specialties?: string[];
  } | null;
  batchId?: string;
  batchName?: string;
  queue?: string;
  stage?: string;
  instrumentStatus?: string;
  priorityScore?: number;
  expectedCompletion?: string;
  assignedAt?: string;
  processingStartedAt?: string;
  completedAt?: string;
  notes?: string;
  flags?: string[];
}

interface LabWorkflowEvent {
  timestamp: string;
  type: string;
  description: string;
  actorId?: string;
  statusAfter?: string;
  metadata?: Record<string, any>;
}

interface LabHandoffNote {
  timestamp: string;
  authorId?: string;
  authorName?: string;
  shift?: string;
  note: string;
}

interface LabNotificationEntry {
  timestamp: string;
  channel: 'system' | 'sms' | 'email' | 'push';
  recipients: string[];
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}

interface AnalyzerDefinition {
  id: string;
  name: string;
  status: 'online' | 'maintenance' | 'offline';
  specialties: string[];
  throughputPerHour: number;
  reagentLevel: number;
  location: string;
  defaultBatchPrefix: string;
}

const ANALYZER_OPTIONS: AnalyzerDefinition[] = [
  {
    id: 'hematology-core',
    name: 'Sysmex XN-1000',
    status: 'online',
    specialties: ['hematology', 'cbc'],
    throughputPerHour: 120,
    reagentLevel: 78,
    location: 'Core Lab - Bench A',
    defaultBatchPrefix: 'CBC',
  },
  {
    id: 'chemistry-1',
    name: 'Roche Cobas 6000',
    status: 'online',
    specialties: ['chemistry', 'metabolic'],
    throughputPerHour: 160,
    reagentLevel: 64,
    location: 'Core Lab - Bench C',
    defaultBatchPrefix: 'CHEM',
  },
  {
    id: 'immuno-spot',
    name: 'Siemens Atellica IM',
    status: 'maintenance',
    specialties: ['immunology', 'serology'],
    throughputPerHour: 90,
    reagentLevel: 42,
    location: 'Core Lab - Bench D',
    defaultBatchPrefix: 'IMM',
  },
  {
    id: 'micro-auto',
    name: 'BD Phoenix M50',
    status: 'online',
    specialties: ['microbiology'],
    throughputPerHour: 48,
    reagentLevel: 55,
    location: 'Micro Lab',
    defaultBatchPrefix: 'MICRO',
  },
];

const WORKFLOW_STAGES: { value: string; label: string }[] = [
  { value: 'awaiting_processing', label: 'Awaiting Processing' },
  { value: 'queued', label: 'Queued for Analyzer' },
  { value: 'processing', label: 'Analyzer Running' },
  { value: 'analysis', label: 'Analysis & Verification' },
  { value: 'results_ready', label: 'Results Ready' },
];

const getStageLabel = (stage?: string | null) => {
  if (!stage) return 'Not set';
  const match = WORKFLOW_STAGES.find((item) => item.value === stage);
  return match ? match.label : stage.replace(/_/g, ' ');
};

const SHIFT_OPTIONS = [
  { value: 'day', label: 'Day Shift' },
  { value: 'evening', label: 'Evening Shift' },
  { value: 'night', label: 'Night Shift' },
  { value: 'weekend', label: 'Weekend Team' },
] as const;

const NOTIFICATION_CHANNELS: Array<LabNotificationEntry['channel']> = [
  'system',
  'email',
  'sms',
  'push',
];

const LabDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [pendingOrders, setPendingOrders] = useState<LabOrder[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<LabOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [workspaceOrderId, setWorkspaceOrderId] = useState<string | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'stat' | 'urgent' | 'routine'>('all');
  const [analyzerFilter, setAnalyzerFilter] = useState<'all' | 'unassigned' | string>('all');
  const [specimenFilter, setSpecimenFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'collected' | 'in_progress'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [qualityControls, setQualityControls] = useState<any[]>([]);
  const [reagentInventory, setReagentInventory] = useState<any[]>([]);
  const [qcLoading, setQcLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Results form state
  const [results, setResults] = useState<LabResult[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  useEffect(() => {
    const userStr = localStorage.getItem('ehr_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'in-progress' && statusFilter !== 'all') {
      setStatusFilter('all');
    }
  }, [activeTab, statusFilter]);

  const fetchPendingOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getPendingLabOrders(token, tenantSlug);
      setPendingOrders(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch pending orders:', error);
    }
  }, [tenantSlug]);

  const fetchInProgressOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getInProgressLabOrders(token, tenantSlug);
      setInProgressOrders(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch in-progress orders:', error);
    }
  }, [tenantSlug]);

  const fetchCompletedOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getLabOrders({ status: 'completed' }, token, tenantSlug);
      setCompletedOrders(response.data?.labOrders || []);
    } catch (error: any) {
      console.error('Failed to fetch completed orders:', error);
    }
  }, [tenantSlug]);

  const fetchQualityControls = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      setQcLoading(true);
      const response = await ehrApi.getLabQualityControls(token, tenantSlug, { limit: 12 });
      setQualityControls(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch quality controls:', error);
      showError('Failed to load quality control history');
    } finally {
      setQcLoading(false);
    }
  }, [tenantSlug, showError]);

  const fetchReagentInventory = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      setInventoryLoading(true);
      const response = await ehrApi.getLabReagentInventory(token, tenantSlug);
      setReagentInventory(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch reagent inventory:', error);
      showError('Failed to load reagent inventory');
    } finally {
      setInventoryLoading(false);
    }
  }, [tenantSlug, showError]);

  const renderQcStatusBadge = (status?: string) => {
    const normalized = (status || 'pending').toLowerCase();
    const classMap: Record<string, string> = {
      pass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      fail: 'bg-red-100 text-red-700 border-red-200',
      review: 'bg-amber-100 text-amber-700 border-amber-200',
      pending: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    const labelMap: Record<string, string> = {
      pass: 'Pass',
      fail: 'Fail',
      review: 'Review',
      pending: 'Pending',
    };
    const className = classMap[normalized] || classMap.pending;
    const label = labelMap[normalized] || labelMap.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${className}`}>
        <ClipboardCheck className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const renderInventoryStatusBadge = (status?: string) => {
    const normalized = (status || 'ok').toLowerCase();
    const classMap: Record<string, string> = {
      ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-100 text-amber-700 border-amber-200',
      critical: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
      expired: 'bg-slate-200 text-slate-600 border-slate-300',
    };
    const labelMap: Record<string, string> = {
      ok: 'OK',
      warning: 'Warning',
      critical: 'Critical',
      expired: 'Expired',
    };
    const className = classMap[normalized] || classMap.ok;
    const label = labelMap[normalized] || labelMap.ok;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${className}`}>
        <Droplet className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const refreshActiveTab = useCallback(async () => {
    if (activeTab === 'pending') {
      await fetchPendingOrders();
    } else if (activeTab === 'in-progress') {
      await fetchInProgressOrders();
    } else {
      await fetchCompletedOrders();
    }
  }, [activeTab, fetchPendingOrders, fetchInProgressOrders, fetchCompletedOrders]);

  const allActiveOrders = useMemo(
    () => [...pendingOrders, ...inProgressOrders],
    [pendingOrders, inProgressOrders],
  );

  const allOrders = useMemo(
    () => [...pendingOrders, ...inProgressOrders, ...completedOrders],
    [pendingOrders, inProgressOrders, completedOrders],
  );

  const workspaceOrder = useMemo(
    () => (workspaceOrderId ? allOrders.find((order) => order.id === workspaceOrderId) || null : null),
    [workspaceOrderId, allOrders],
  );

  const workspaceAnalyzerName =
    (workspaceOrder as any)?.processingContext?.analyzer?.name || undefined;

  const recentAnalyzerQC = useMemo(() => {
    if (!workspaceAnalyzerName) return null;
    const normalized = workspaceAnalyzerName.toLowerCase();
    return qualityControls.find(
      (qc) => qc.analyzer_name && qc.analyzer_name.toLowerCase() === normalized,
    );
  }, [qualityControls, workspaceAnalyzerName]);

  const analyzerInventory = useMemo(() => {
    if (!workspaceAnalyzerName) return [];
    const normalized = workspaceAnalyzerName.toLowerCase();
    return reagentInventory.filter(
      (item) => item.analyzer_name && item.analyzer_name.toLowerCase() === normalized,
    );
  }, [reagentInventory, workspaceAnalyzerName]);

  useEffect(() => {
    if (workspaceOrderId && !workspaceOrder) {
      setWorkspaceOrderId(null);
    }
  }, [workspaceOrderId, workspaceOrder]);

  const analyzerLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    ANALYZER_OPTIONS.forEach((analyzer) => map.set(analyzer.id, analyzer.name));
    allActiveOrders.forEach((order) => {
      const analyzer = order.processingContext?.analyzer;
      if (analyzer?.id) {
        map.set(analyzer.id, analyzer.name || analyzer.id);
      }
    });
    return map;
  }, [allActiveOrders]);

  const analyzerFilterOptions = useMemo(() => {
    const set = new Set<string>();
    allActiveOrders.forEach((order) => {
      const analyzerId = order.processingContext?.analyzer?.id;
      if (analyzerId) {
        set.add(analyzerId);
      }
    });
    return Array.from(set);
  }, [allActiveOrders]);

  const specimenOptions = useMemo(() => {
    const set = new Set<string>();
    allActiveOrders.forEach((order) => {
      order.tests.forEach((test) => {
        if (test.specimenType) {
          set.add(test.specimenType);
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allActiveOrders]);

  const queueMetrics = useMemo(() => {
    const snapshot = [...pendingOrders, ...inProgressOrders];
    const statCount = snapshot.filter((order) => order.priority === 'stat').length;
    const urgentCount = snapshot.filter((order) => order.priority === 'urgent').length;
    const unassignedAnalyzer = snapshot.filter((order) => !order.processingContext?.analyzer?.id).length;
    const avgAgeHours =
      snapshot.length === 0
        ? 0
        : snapshot.reduce((sum, order) => {
            const createdAt = new Date(order.createdAt).getTime();
            return sum + (Date.now() - createdAt) / (1000 * 60 * 60);
          }, 0) / snapshot.length;
    return {
      statCount,
      urgentCount,
      unassignedAnalyzer,
      avgAgeHours,
    };
  }, [pendingOrders, inProgressOrders]);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingOrders();
    } else if (activeTab === 'in-progress') {
      fetchInProgressOrders();
    } else {
      fetchCompletedOrders();
    }
  }, [activeTab, fetchPendingOrders, fetchInProgressOrders, fetchCompletedOrders]);

  useEffect(() => {
    if (!tenantSlug) return;
    fetchQualityControls();
    fetchReagentInventory();
  }, [tenantSlug, fetchQualityControls, fetchReagentInventory]);

  const handleCollectSample = async (orderId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      await ehrApi.collectLabSample(orderId, token, tenantSlug);
      showSuccess('Success', 'Sample collected');
      
      // Refresh both tabs and switch to in-progress since order moved there
      await Promise.all([
        fetchPendingOrders(),
        fetchInProgressOrders()
      ]);
      
      // Switch to in-progress tab so user sees the collected order
      setActiveTab('in-progress');
    } catch (error: any) {
      showError('Error', 'Failed to collect sample');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcessing = async (orderId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      await ehrApi.startProcessingLabOrder(orderId, token, tenantSlug);
      showSuccess('Success', 'Processing started');
      
      // Refresh both pending and in-progress orders
      await Promise.all([
        fetchPendingOrders(),
        fetchInProgressOrders()
      ]);
    } catch (error: any) {
      showError('Error', 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAnalyzer = async (order: LabOrder, analyzerId: string | null) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      const analyzer = analyzerId ? ANALYZER_OPTIONS.find((item) => item.id === analyzerId) : undefined;
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          processingContext: {
            ...(order.processingContext || {}),
            analyzer: analyzer
              ? {
                  id: analyzer.id,
                  name: analyzer.name,
                  status: analyzer.status,
                  location: analyzer.location,
                  throughputPerHour: analyzer.throughputPerHour,
                  reagentLevel: analyzer.reagentLevel,
                  specialties: analyzer.specialties,
                }
              : null,
            queue: analyzer ? analyzer.defaultBatchPrefix : (order.processingContext?.queue ?? undefined),
            assignedAt: analyzer ? new Date().toISOString() : order.processingContext?.assignedAt,
            instrumentStatus: analyzer ? 'queued' : 'unassigned',
          },
          appendEvent: {
            type: analyzer ? 'analyzer_assigned' : 'analyzer_cleared',
            description: analyzer
              ? `Assigned to ${analyzer.name}`
              : 'Analyzer assignment cleared',
            metadata: analyzer ? { analyzerId: analyzer.id } : undefined,
          },
        },
        token,
        tenantSlug,
      );
      await Promise.all([fetchPendingOrders(), fetchInProgressOrders()]);
      showSuccess('Updated', analyzer ? `Order routed to ${analyzer.name}` : 'Analyzer cleared');
    } catch (error) {
      console.error('Failed to update analyzer assignment', error);
      showError('Error', 'Failed to update analyzer assignment');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSetBatch = async (order: LabOrder) => {
    const currentBatch = order.processingContext?.batchId || order.processingContext?.queue || '';
    const batchId = window.prompt('Enter batch identifier', currentBatch);
    if (batchId === null) return;
    const trimmed = batchId.trim();
    if (!tenantSlug || !trimmed) {
      if (!trimmed) {
        showError('Invalid batch', 'Please provide a batch identifier');
      }
      return;
    }
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          processingContext: {
            ...(order.processingContext || {}),
            batchId: trimmed,
            batchName: trimmed,
            queue: order.processingContext?.queue || trimmed,
          },
          appendEvent: {
            type: 'batch_updated',
            description: `Assigned to batch ${trimmed}`,
            metadata: { batchId: trimmed },
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Batch updated', `Order assigned to batch ${trimmed}`);
    } catch (error) {
      console.error('Failed to update batch', error);
      showError('Error', 'Failed to update batch information');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStageChange = async (order: LabOrder, stage: string) => {
    if (!stage || !tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          processingContext: {
            ...(order.processingContext || {}),
            stage,
          },
          appendEvent: {
            type: 'stage_updated',
            description: `Workflow advanced to ${getStageLabel(stage)}`,
            metadata: { stage },
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Stage updated', `Workflow advanced to ${getStageLabel(stage)}`);
    } catch (error) {
      console.error('Failed to update stage', error);
      showError('Error', 'Failed to update workflow stage');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAddWorkflowNote = async (order: LabOrder) => {
    if (!tenantSlug) return;
    const note = window.prompt('Add workflow note');
    if (!note || !note.trim()) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          appendEvent: {
            type: 'note',
            description: note.trim(),
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Note added', 'Workflow note recorded');
    } catch (error) {
      console.error('Failed to add workflow note', error);
      showError('Error', 'Failed to record workflow note');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleResetFilters = () => {
    setPriorityFilter('all');
    setAnalyzerFilter('all');
    setSpecimenFilter('all');
    setStatusFilter('all');
  };

  const handleOpenWorkspace = (orderId: string) => {
    setWorkspaceOrderId(orderId);
  };

  const handleCloseWorkspace = () => {
    setWorkspaceOrderId(null);
  };

  const handleTriggerCriticalFollowUp = async (order: LabOrder) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          processingContext: {
            ...(order.processingContext || {}),
            flags: Array.from(
              new Set([...(order.processingContext?.flags || []), 'critical_followup']),
            ),
            expectedCompletion:
              order.processingContext?.expectedCompletion || new Date().toISOString(),
          },
          appendEvent: {
            type: 'critical_followup',
            description: 'Critical result follow-up initiated',
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Follow-up triggered', 'Ordering provider will be notified');
    } catch (error) {
      console.error('Failed to trigger follow-up', error);
      showError('Error', 'Failed to trigger follow-up');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleMarkReadyForSignoff = async (order: LabOrder) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          processingContext: {
            ...(order.processingContext || {}),
            stage: 'results_ready',
            instrumentStatus: 'complete',
            completedAt: new Date().toISOString(),
          },
          appendEvent: {
            type: 'verification_ready',
            description: 'Results verified, awaiting sign-off',
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Marked ready', 'Results ready for provider sign-off');
    } catch (error) {
      console.error('Failed to mark ready for sign-off', error);
      showError('Error', 'Failed to update verification status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleLogQualityControl = async (defaults?: { analyzer?: string }) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    const analyzer =
      window.prompt('Analyzer / instrument name', defaults?.analyzer || '')?.trim() || '';
    if (!analyzer) return;

    const testCode = window.prompt('Test code (optional)')?.trim() || undefined;
    const level = window.prompt('Control level (e.g. L1, Normal)', 'L1')?.trim() || undefined;
    const resultValue = window.prompt('Result value / reading (optional)')?.trim() || undefined;
    const statusInput = window.prompt('Outcome (pass / fail / review)', 'pass') || 'pass';
    const statusNormalized = statusInput.toLowerCase();
    const statusOptions = ['pass', 'fail', 'review', 'pending'];
    const status = statusOptions.includes(statusNormalized) ? statusNormalized : 'pass';
    const comments = window.prompt('Comments / notes (optional)')?.trim() || undefined;

    try {
      setQcLoading(true);
      await ehrApi.createLabQualityControl(
        {
          analyzer_name: analyzer,
          test_code: testCode,
          level,
          result_value: resultValue,
          status: status as 'pass' | 'fail' | 'review' | 'pending',
          comments,
        },
        token,
        tenantSlug,
      );
      showSuccess('Logged', 'Quality control recorded');
      await fetchQualityControls();
    } catch (error) {
      console.error('Failed to log quality control', error);
      showError('Error', 'Failed to record quality control run');
    } finally {
      setQcLoading(false);
    }
  };

  const handleAddOrEditInventoryItem = async (existing?: any) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    const reagentName =
      window.prompt('Reagent / supply name', existing?.reagent_name || '')?.trim() || '';
    if (!reagentName) return;

    const analyzerName = window.prompt('Analyzer (optional)', existing?.analyzer_name || '')?.trim() || undefined;
    const lotNumber = window.prompt('Lot number (optional)', existing?.lot_number || '')?.trim() || undefined;

    const quantityInput = window.prompt(
      'Quantity on hand',
      existing ? String(existing.quantity_available ?? 0) : '0',
    );
    if (quantityInput === null) return;
    const quantity = Number(quantityInput);
    if (Number.isNaN(quantity)) {
      showError('Invalid quantity', 'Please provide a numeric quantity');
      return;
    }

    const thresholdInput = window.prompt(
      'Minimum threshold',
      existing ? String(existing.minimum_threshold ?? 0) : '0',
    );
    if (thresholdInput === null) return;
    const threshold = Number(thresholdInput);
    if (Number.isNaN(threshold)) {
      showError('Invalid threshold', 'Please provide a numeric threshold');
      return;
    }

    const expiresOn = window.prompt('Expiry date (YYYY-MM-DD, optional)', existing?.expires_on || '')?.trim() || undefined;
    const statusInput = window.prompt(
      'Status (ok / warning / critical / expired)',
      existing?.status || 'ok',
    );
    const statusNormalized = statusInput ? statusInput.toLowerCase() : 'ok';
    const statusOptions = ['ok', 'warning', 'critical', 'expired'];
    const status = statusOptions.includes(statusNormalized) ? statusNormalized : 'ok';
    const notes = window.prompt('Notes (optional)', existing?.notes || '')?.trim() || undefined;

    try {
      setInventoryLoading(true);
      await ehrApi.upsertLabReagentInventory(
        {
          id: existing?.id,
          reagent_name: reagentName,
          analyzer_name: analyzerName,
          lot_number: lotNumber,
          quantity_available: quantity,
          unit: existing?.unit || 'units',
          minimum_threshold: threshold,
          expires_on: expiresOn,
          status,
          notes,
        },
        token,
        tenantSlug,
      );
      showSuccess(existing ? 'Updated' : 'Added', 'Reagent inventory saved');
      await fetchReagentInventory();
    } catch (error) {
      console.error('Failed to upsert reagent inventory', error);
      showError('Error', 'Failed to save reagent inventory');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleAdjustInventoryQuantity = async (item: any) => {
    if (!tenantSlug) return;
    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    const quantityInput = window.prompt(
      `Adjust quantity for ${item.reagent_name}`,
      String(item.quantity_available ?? 0),
    );
    if (quantityInput === null) return;
    const quantity = Number(quantityInput);
    if (Number.isNaN(quantity)) {
      showError('Invalid quantity', 'Please provide a numeric quantity');
      return;
    }

    const statusInput = window.prompt(
      'Status (ok / warning / critical / expired)',
      item.status || 'ok',
    );
    const statusOptions = ['ok', 'warning', 'critical', 'expired'];
    const statusNormalized = statusInput ? statusInput.toLowerCase() : item.status || 'ok';
    const status = statusOptions.includes(statusNormalized) ? statusNormalized : item.status || 'ok';

    try {
      setInventoryLoading(true);
      await ehrApi.updateLabReagentQuantity(
        item.id,
        { quantity_available: quantity, status },
        token,
        tenantSlug,
      );
      showSuccess('Updated', 'Inventory quantity updated');
      await fetchReagentInventory();
    } catch (error) {
      console.error('Failed to update reagent quantity', error);
      showError('Error', 'Failed to update quantity');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleAddHandoffNote = async (order: LabOrder) => {
    if (!tenantSlug) return;
    const note = window.prompt('Add hand-off note');
    if (!note || !note.trim()) return;

    const shift = window.prompt(
      'Shift or team (optional). Examples: day, evening, night, weekend',
      'day',
    );

    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          handoffNote: {
            note: note.trim(),
            shift: shift?.trim() || undefined,
          },
          appendEvent: {
            type: 'handoff_note',
            description: `Hand-off note recorded${shift ? ` (${shift})` : ''}`,
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Note added', 'Hand-off note recorded successfully');
    } catch (error) {
      console.error('Failed to add handoff note', error);
      showError('Error', 'Failed to add hand-off note');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleLogNotification = async (order: LabOrder) => {
    if (!tenantSlug) return;
    const message = window.prompt('Notification message');
    if (!message || !message.trim()) return;

    const channel = window.prompt(
      'Channel (system/email/sms/push)',
      'system',
    ) as LabNotificationEntry['channel'] | null;

    const recipientsInput = window.prompt(
      'Recipients (comma-separated user IDs or emails)',
      order.orderingProvider?.id || '',
    );
    const recipients = recipientsInput
      ? recipientsInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!channel || !NOTIFICATION_CHANNELS.includes(channel)) {
      showError('Error', 'Invalid channel');
      return;
    }

    const token = localStorage.getItem('ehr_token');
    if (!token) {
      showError('Error', 'Authentication token missing');
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await ehrApi.updateLabProcessingContext(
        order.id,
        {
          notify: {
            channel,
            recipients,
            message: message.trim(),
          },
          appendEvent: {
            type: 'notification',
            description: `Notification sent via ${channel}`,
            metadata: { channel, recipients },
          },
        },
        token,
        tenantSlug,
      );
      await refreshActiveTab();
      showSuccess('Notification logged', 'Provider notification recorded');
    } catch (error) {
      console.error('Failed to log notification', error);
      showError('Error', 'Failed to log provider notification');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openResultsModal = (order: LabOrder) => {
    setSelectedOrder(order);
    // Initialize results form with test names from order
    const initialResults: LabResult[] = order.tests.map(test => ({
      testCode: test.testCode,
      testName: test.testName,
      value: '',
      unit: '',
      referenceRange: '',
      flag: 'normal'
    }));
    setResults(initialResults);
    setInterpretation(order.interpretation || '');
    setUploadedFiles([]);
    setShowResultsModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const handleSubmitResults = async () => {
    if (!selectedOrder) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      // Convert uploaded files to attachments format
      const attachments = uploadedFiles.map(file => ({
        filename: file.name,
        url: URL.createObjectURL(file), // In production, upload to server first
        type: file.type,
        uploadedAt: new Date().toISOString()
      }));

      // Convert results to the format expected by backend
      const resultsData = results.map(result => ({
        ...result,
        resultDate: new Date().toISOString(),
        performedBy: currentUser?.id || ''
      }));

      await ehrApi.submitLabResults(selectedOrder.id, {
        results: resultsData,
        interpretation,
        attachments
      }, token, tenantSlug);

      showSuccess('Success', 'Results submitted successfully');
      setShowResultsModal(false);
      setSelectedOrder(null);
      fetchInProgressOrders();
      fetchCompletedOrders();
    } catch (error: any) {
      showError('Error', 'Failed to submit results');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant_slug');
    navigate(`/ehr/${tenantSlug}`);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ordered: 'bg-blue-100 text-blue-800',
      collected: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      routine: 'bg-gray-100 text-gray-800',
      urgent: 'bg-orange-100 text-orange-800',
      stat: 'bg-red-100 text-red-800'
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getFlagBadge = (flag: string) => {
    const badges = {
      normal: 'bg-green-100 text-green-800',
      high: 'bg-orange-100 text-orange-800',
      low: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800'
    };
    return badges[flag as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const currentOrders = activeTab === 'pending' ? pendingOrders : 
                        activeTab === 'in-progress' ? inProgressOrders : 
                        completedOrders;

  const searchLower = searchTerm.toLowerCase();

  const filteredOrders = currentOrders.filter((order) => {
    const matchesSearch =
      searchLower.length === 0 ||
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.patient.firstName.toLowerCase().includes(searchLower) ||
      order.patient.lastName.toLowerCase().includes(searchLower) ||
      order.patient.patientNumber.toLowerCase().includes(searchLower) ||
      order.tests.some((test) => test.testName.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    if (priorityFilter !== 'all' && order.priority !== priorityFilter) {
      return false;
    }

    const analyzerId = order.processingContext?.analyzer?.id;
    if (analyzerFilter === 'unassigned') {
      if (analyzerId) return false;
    } else if (analyzerFilter !== 'all' && analyzerId !== analyzerFilter) {
      return false;
    }

    if (specimenFilter !== 'all') {
      const specimenMatches = order.tests.some(
        (test) => test.specimenType?.toLowerCase() === specimenFilter.toLowerCase(),
      );
      if (!specimenMatches) return false;
    }

    if (activeTab === 'in-progress' && statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const groupedSections = useMemo(() => {
    if (filteredOrders.length === 0) {
      return [];
    }

    if (activeTab === 'completed') {
      return [
        {
          key: 'completed',
          title: 'Completed Orders',
          highlight: 'Verified results ready for clinicians',
          accent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          orders: filteredOrders,
        },
      ];
    }

    const definitions = [
      {
        key: 'stat',
        title: 'STAT Queue',
        highlight: 'Immediate analyzer routing required',
        accent: 'bg-red-100 text-red-700 border-red-200',
      },
      {
        key: 'urgent',
        title: 'Urgent Queue',
        highlight: 'Prioritized before routine workload',
        accent: 'bg-amber-100 text-amber-700 border-amber-200',
      },
      {
        key: 'routine',
        title: 'Routine Queue',
        highlight: 'Queued per scheduled workflow',
        accent: 'bg-slate-100 text-slate-600 border-slate-200',
      },
    ] as const;

    return definitions
      .map((definition) => ({
        ...definition,
        orders: filteredOrders.filter((order) => order.priority === definition.key),
      }))
      .filter((definition) => definition.orders.length > 0);
  }, [filteredOrders, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl">
                <TestTube className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Laboratory Dashboard</h1>
                <p className="text-sm text-slate-500">Manage lab orders and results</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (activeTab === 'pending') fetchPendingOrders();
                  else if (activeTab === 'in-progress') fetchInProgressOrders();
                  else fetchCompletedOrders();
                  fetchQualityControls();
                  fetchReagentInventory();
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <User className="w-5 h-5" />
                  <span>{currentUser?.firstName} {currentUser?.lastName}</span>
                </button>
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'pending'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Pending Orders ({pendingOrders.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('in-progress')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'in-progress'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Activity className="w-5 h-5" />
                <span>In Progress ({inProgressOrders.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'completed'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Completed ({completedOrders.length})</span>
              </div>
            </button>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                  STAT Queue
                </p>
                <p className="text-2xl font-bold text-red-700">{queueMetrics.statCount}</p>
              </div>
              <Zap className="w-8 h-8 text-red-500" />
            </div>
            <p className="mt-2 text-xs text-red-500">
              Orders requiring immediate analyzer assignment
            </p>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  Urgent Backlog
                </p>
                <p className="text-2xl font-bold text-amber-700">{queueMetrics.urgentCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <p className="mt-2 text-xs text-amber-600">Prioritize before routine workload</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Awaiting Analyzer
                </p>
                <p className="text-2xl font-bold text-slate-700">
                  {queueMetrics.unassignedAnalyzer}
                </p>
              </div>
              <Cpu className="w-8 h-8 text-slate-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Orders still waiting for instrument routing
            </p>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Avg Queue Age
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {queueMetrics.avgAgeHours.toFixed(1)}h
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
            <p className="mt-2 text-xs text-blue-500">
              Average time orders have waited since creation
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order number, patient name, or test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Filter className="w-4 h-4 text-slate-500" />
              <span>Priority</span>
            </div>
            {(['all', 'stat', 'urgent', 'routine'] as const).map((priority) => (
              <button
                key={priority}
                onClick={() => setPriorityFilter(priority)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  priorityFilter === priority
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {priority === 'all' ? 'All' : priority.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {showFilters ? 'Hide advanced filters' : 'Show advanced filters'}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Analyzer
                </span>
                <select
                  value={analyzerFilter}
                  onChange={(e) => setAnalyzerFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  <option value="all">All analyzers</option>
                  <option value="unassigned">Unassigned</option>
                  {analyzerFilterOptions.map((id) => (
                    <option key={id} value={id}>
                      {analyzerLabelLookup.get(id) || id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Specimen
                </span>
                <select
                  value={specimenFilter}
                  onChange={(e) => setSpecimenFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  <option value="all">All specimen types</option>
                  {specimenOptions.map((specimen) => (
                    <option key={specimen} value={specimen}>
                      {specimen}
                    </option>
                  ))}
                </select>
              </div>
              {activeTab === 'in-progress' && (
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Processing Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  >
                    <option value="all">All</option>
                    <option value="collected">Collected</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
              )}
              <button
                onClick={handleResetFilters}
                className="ml-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Orders List */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <FlaskConical className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Quality Control Overview</h2>
                  <p className="text-xs text-slate-500">
                    Recent control runs across analyzers
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleLogQualityControl()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700"
              >
                <Plus className="w-3 h-3" />
                Log QC Run
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {qcLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading quality controls…
                </div>
              ) : qualityControls.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  No quality control runs logged yet.
                </div>
              ) : (
                qualityControls.slice(0, 8).map((qc) => (
                  <div
                    key={`${qc.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {qc.analyzer_name || 'Unknown Analyzer'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {qc.level ? `${qc.level} • ` : ''}
                          {formatDateTimeToDDMMYYYYHHMM(qc.run_datetime)}
                        </p>
                      </div>
                      {renderQcStatusBadge(qc.status)}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {qc.test_code && <span>Test: {qc.test_code}. </span>}
                      {qc.result_value && <span>Result: {qc.result_value}. </span>}
                      {qc.comments && <span>Notes: {qc.comments}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <Droplet className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Reagent & Supply Levels</h2>
                  <p className="text-xs text-slate-500">
                    Monitor buffers, controls, and consumables
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAddOrEditInventoryItem()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {inventoryLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading inventory…
                </div>
              ) : reagentInventory.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  No reagent inventory recorded.
                </div>
              ) : (
                reagentInventory.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.reagent_name}</p>
                        <p className="text-xs text-slate-500">
                          {item.analyzer_name || 'General stock'}
                          {item.lot_number ? ` • Lot ${item.lot_number}` : ''}
                        </p>
                        {item.expires_on && (
                          <p className="text-xs text-slate-500">Expires {item.expires_on}</p>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-semibold text-slate-800">
                          {item.quantity_available ?? 0} {item.unit || 'units'}
                        </div>
                        <div className="text-xs text-slate-500">
                          Min: {item.minimum_threshold ?? 0}
                        </div>
                        {renderInventoryStatusBadge(item.status)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        onClick={() => handleAdjustInventoryQuantity(item)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={() => handleAddOrEditInventoryItem(item)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      {item.notes && <span className="text-slate-500">Notes: {item.notes}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          {groupedSections.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <TestTube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No {activeTab} orders found</p>
            </div>
          ) : (
            groupedSections.map((section) => (
              <section key={section.key} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                    <p className="text-sm text-slate-500">{section.highlight}</p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full border ${section.accent}`}
                  >
                    {section.orders.length} in queue
                  </span>
                </div>
                <div className="space-y-4">
                  {section.orders.map((order) => {
                    const context: LabProcessingContext = order.processingContext || {};
                    const analyzer = context.analyzer;
                    const instrumentStatus =
                      context.instrumentStatus || (order.status === 'completed' ? 'complete' : 'pending');
                    const expectedCompletion = context.expectedCompletion
                      ? formatDateTimeToDDMMYYYYHHMM(context.expectedCompletion)
                      : null;
                    const isUpdating = updatingOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                      >
                        <div className="p-6 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="text-lg font-bold text-slate-900">{order.orderNumber}</h3>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(order.status)}`}
                                >
                                  {order.status.replace('_', ' ').toUpperCase()}
                                </span>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(order.priority)}`}
                                >
                                  {order.priority.toUpperCase()}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                  {getStageLabel(context.stage)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                <span className="font-semibold text-slate-800">
                                  {order.patient.firstName} {order.patient.lastName}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="font-mono text-xs text-slate-500">
                                  {order.patient.patientNumber}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span>
                                  Ordered by Dr. {order.orderingProvider.firstName}{' '}
                                  {order.orderingProvider.lastName}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400">
                                Created {formatDateTimeToDDMMYYYYHHMM(order.createdAt)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 min-w-[220px]">
                              {activeTab === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleCollectSample(order.id)}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    <Upload className="w-4 h-4" />
                                    Collect Sample
                                  </button>
                                  <button
                                    onClick={() => handleStartProcessing(order.id)}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    <Play className="w-4 h-4" />
                                    Start Processing
                                  </button>
                                </>
                              )}
                              {activeTab === 'in-progress' && (
                                <button
                                  onClick={() => {
                                    openResultsModal(order);
                                    setShowResultsModal(true);
                                  }}
                                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2"
                                >
                                  <FileCheck className="w-4 h-4" />
                                  Enter Results
                                </button>
                              )}
                              {activeTab === 'completed' && order.results && (
                                <button
                                  onClick={() => {
                                    openResultsModal(order);
                                    setShowResultsModal(true);
                                  }}
                                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Results
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenWorkspace(order.id)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                              >
                                <Cpu className="w-4 h-4" />
                                Open Workspace
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Microscope className="w-4 h-4 text-indigo-500" />
                                <span className="font-semibold text-slate-900">Analyzer Routing</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Assigned:</span>
                                <span className="font-semibold text-slate-800">
                                  {analyzer?.name ?? 'Unassigned'}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>Status:</span>
                                <span className="capitalize">{instrumentStatus.replace('_', ' ')}</span>
                              </div>
                              {expectedCompletion && (
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>ETA:</span>
                                  <span>{expectedCompletion}</span>
                                </div>
                              )}
                              <div className="space-y-2 pt-3">
                                <select
                                  value={analyzer?.id || ''}
                                  onChange={(e) =>
                                    handleAssignAnalyzer(order, e.target.value || null)
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                  disabled={isUpdating}
                                >
                                  <option value="">
                                    {analyzer ? 'Change analyzer…' : 'Assign analyzer…'}
                                  </option>
                                  {analyzer && <option value="">Clear assignment</option>}
                                  {ANALYZER_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name} ({option.status})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleSetBatch(order)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                                  disabled={isUpdating}
                                >
                                  <Layers className="w-4 h-4" />
                                  {context.batchId ? `Batch ${context.batchId}` : 'Set batch'}
                                </button>
                                <select
                                  value={context.stage || ''}
                                  onChange={(e) => handleStageChange(order, e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                  disabled={isUpdating}
                                >
                                  <option value="">Update stage…</option>
                                  {WORKFLOW_STAGES.map((stage) => (
                                    <option key={stage.value} value={stage.value}>
                                      {stage.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-slate-900">Tests Ordered</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {order.tests.map((test) => (
                                  <span
                                    key={test.testCode}
                                    className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
                                  >
                                    {test.testName}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-500" />
                                <span className="font-semibold text-slate-900">Timeline</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span>Ordered:</span>
                                <span>{formatDateTimeToDDMMYYYYHHMM(order.createdAt)}</span>
                              </div>
                              {order.collectedAt && (
                                <div className="flex justify-between text-xs">
                                  <span>Collected:</span>
                                  <span>{formatDateTimeToDDMMYYYYHHMM(order.collectedAt)}</span>
                                </div>
                              )}
                              {order.results && (
                                <div className="flex justify-between text-xs">
                                  <span>Results:</span>
                                  <span>{order.results.length} test(s)</span>
                                </div>
                              )}
                              <button
                                onClick={() => handleAddWorkflowNote(order)}
                                className="w-full mt-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                                disabled={isUpdating}
                              >
                                <FileText className="w-4 h-4" />
                                Add workflow note
                              </button>
                            </div>
                          </div>

                          {order.workflowEvents && order.workflowEvents.length > 0 && (
                            <div className="pt-3 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Recent activity
                              </p>
                              <div className="space-y-2">
                                {order.workflowEvents.slice(0, 3).map((event) => (
                                  <div
                                    key={`${event.timestamp}-${event.type}`}
                                    className="flex items-start gap-3 text-xs text-slate-600"
                                  >
                                    <div className="w-28 text-slate-400">
                                      {formatDateTimeToDDMMYYYYHHMM(event.timestamp)}
                                    </div>
                                    <div className="flex-1">
                                      <span className="font-semibold text-slate-700 capitalize">
                                        {event.type.replace(/_/g, ' ')}
                                      </span>
                                      <div>{event.description}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {workspaceOrder && (
          <section className="mt-8">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
                <div>
                  <h2 className="text-xl font-bold">
                    Processing Workspace · {workspaceOrder.orderNumber}
                  </h2>
                  <p className="text-sm text-slate-200">
                    Real-time view of analyzer routing, workflow stages, and follow-ups
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => refreshActiveTab()}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                  <button
                    onClick={handleCloseWorkspace}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                      Workflow Stage Tracker
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      {WORKFLOW_STAGES.map((stage, index) => {
                        const currentStage = workspaceOrder.processingContext?.stage;
                        const reached =
                          currentStage &&
                          WORKFLOW_STAGES.findIndex((item) => item.value === currentStage) >= index;
                        return (
                          <React.Fragment key={stage.value}>
                            <div
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                                reached
                                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                  : 'border-slate-200 text-slate-500 bg-white'
                              }`}
                            >
                              <span className="font-semibold">{index + 1}</span>
                              <span>{stage.label}</span>
                            </div>
                            {index < WORKFLOW_STAGES.length - 1 && (
                              <div className="h-px w-8 bg-slate-200 hidden md:block" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Analyzer Assignment
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            {workspaceOrder.processingContext?.analyzer?.name || 'Unassigned'}
                          </p>
                        </div>
                        <Cpu className="w-6 h-6 text-slate-400" />
                      </div>
                      <select
                        value={workspaceOrder.processingContext?.analyzer?.id || ''}
                        onChange={(e) =>
                          handleAssignAnalyzer(workspaceOrder, e.target.value || null)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        disabled={updatingOrderId === workspaceOrder.id}
                      >
                        <option value="">
                          {workspaceOrder.processingContext?.analyzer
                            ? 'Change analyzer…'
                            : 'Assign analyzer…'}
                        </option>
                        {workspaceOrder.processingContext?.analyzer && (
                          <option value="">Clear assignment</option>
                        )}
                        {ANALYZER_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} ({option.status})
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                        <div>
                          <span className="block font-semibold text-slate-600">Location</span>
                          <span>
                            {workspaceOrder.processingContext?.analyzer?.location || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-600">Throughput</span>
                          <span>
                            {workspaceOrder.processingContext?.analyzer?.throughputPerHour
                              ? `${workspaceOrder.processingContext?.analyzer?.throughputPerHour} / hr`
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSetBatch(workspaceOrder)}
                        className="w-full mt-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                        disabled={updatingOrderId === workspaceOrder.id}
                      >
                        <Layers className="w-4 h-4" />
                        {workspaceOrder.processingContext?.batchId
                          ? `Batch ${workspaceOrder.processingContext?.batchId}`
                          : 'Assign batch'}
                      </button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Sample & Timeline
                          </p>
                          <p className="text-lg font-semibold text-slate-900">
                            Stage: {getStageLabel(workspaceOrder.processingContext?.stage)}
                          </p>
                        </div>
                        <Calendar className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Ordered</span>
                          <span>{formatDateTimeToDDMMYYYYHHMM(workspaceOrder.createdAt)}</span>
                        </div>
                        {workspaceOrder.collectedAt && (
                          <div className="flex justify-between">
                            <span>Collected</span>
                            <span>{formatDateTimeToDDMMYYYYHHMM(workspaceOrder.collectedAt)}</span>
                          </div>
                        )}
                        {workspaceOrder.processingContext?.processingStartedAt && (
                          <div className="flex justify-between">
                            <span>Processing started</span>
                            <span>
                              {formatDateTimeToDDMMYYYYHHMM(
                                workspaceOrder.processingContext.processingStartedAt,
                              )}
                            </span>
                          </div>
                        )}
                        {workspaceOrder.processingContext?.completedAt && (
                          <div className="flex justify-between">
                            <span>Completed</span>
                            <span>
                              {formatDateTimeToDDMMYYYYHHMM(
                                workspaceOrder.processingContext.completedAt,
                              )}
                            </span>
                          </div>
                        )}
                        {workspaceOrder.processingContext?.expectedCompletion && (
                          <div className="flex justify-between font-semibold text-indigo-600">
                            <span>Expected completion</span>
                            <span>{expectedCompletion}</span>
                          </div>
                        )}
                      </div>
                      <select
                        value={workspaceOrder.processingContext?.stage || ''}
                        onChange={(e) => handleStageChange(workspaceOrder, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        disabled={updatingOrderId === workspaceOrder.id}
                      >
                        <option value="">Update stage…</option>
                        {WORKFLOW_STAGES.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          Critical follow-up
                        </h3>
                        <p className="text-xs text-slate-500">
                          Rapid escalation when analyzers detect panic values
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleTriggerCriticalFollowUp(workspaceOrder)}
                          className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2"
                          disabled={updatingOrderId === workspaceOrder.id}
                        >
                          <AlertCircle className="w-4 h-4" />
                          Trigger critical follow-up
                        </button>
                        <button
                          onClick={() => handleMarkReadyForSignoff(workspaceOrder)}
                          className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2"
                          disabled={updatingOrderId === workspaceOrder.id}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark ready for sign-off
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(workspaceOrder.processingContext?.flags || []).length === 0 ? (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500">
                          No flags recorded
                        </span>
                      ) : (
                        workspaceOrder.processingContext?.flags?.map((flag) => (
                          <span key={flag} className="px-3 py-1 rounded-full bg-red-100 text-red-700">
                            {flag.replace(/_/g, ' ')}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <aside className="space-y-6">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Recent workflow activity
                    </h3>
                    <div className="space-y-3">
                      {(workspaceOrder.workflowEvents || []).slice(0, 10).map((event) => (
                        <div
                          key={`${event.timestamp}-${event.type}`}
                          className="border border-slate-200 rounded-lg bg-white p-3 text-xs text-slate-600"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-700 capitalize">
                              {event.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-400">
                              {formatDateTimeToDDMMYYYYHHMM(event.timestamp)}
                            </span>
                          </div>
                          <p>{event.description}</p>
                        </div>
                      ))}
                      {(workspaceOrder.workflowEvents || []).length === 0 && (
                        <p className="text-xs text-slate-400">
                          No workflow events recorded for this order yet.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddWorkflowNote(workspaceOrder)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                      disabled={updatingOrderId === workspaceOrder.id}
                    >
                      <FileText className="w-4 h-4" />
                      Add workflow note
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Ordered tests
                    </h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      {workspaceOrder.tests.map((test) => (
                        <div
                          key={test.testCode}
                          className="flex items-start justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div>
                            <p className="font-semibold text-slate-700">{test.testName}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                              {test.category}
                            </p>
                          </div>
                          <div className="text-xs text-right text-slate-500">
                            <div>{test.testCode}</div>
                            <div>{test.specimenType}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {workspaceOrder.specialInstructions && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                        <span className="font-semibold">Special instructions:</span>{' '}
                        {workspaceOrder.specialInstructions}
                      </div>
                    )}
                  </div>

                  {workspaceAnalyzerName && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                            Analyzer QC snapshot
                          </h3>
                          <p className="text-xs text-slate-500">
                            {workspaceAnalyzerName}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLogQualityControl({ analyzer: workspaceAnalyzerName })}
                          className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                          disabled={qcLoading}
                        >
                          <Plus className="w-4 h-4" />
                          Log run
                        </button>
                      </div>
                      {recentAnalyzerQC ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">
                              {recentAnalyzerQC.level || 'Control'}
                            </span>
                            {renderQcStatusBadge(recentAnalyzerQC.status)}
                          </div>
                          <p className="text-xs text-slate-500">
                            {formatDateTimeToDDMMYYYYHHMM(recentAnalyzerQC.run_datetime)}
                          </p>
                          {recentAnalyzerQC.result_value && (
                            <p className="text-xs">Result: {recentAnalyzerQC.result_value}</p>
                          )}
                          {recentAnalyzerQC.comments && (
                            <p className="text-xs text-slate-500">Notes: {recentAnalyzerQC.comments}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          No quality control runs logged for this analyzer yet.
                        </p>
                      )}
                    </div>
                  )}

                  {workspaceAnalyzerName && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                            Reagents tied to analyzer
                          </h3>
                          <p className="text-xs text-slate-500">
                            {workspaceAnalyzerName}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleAddOrEditInventoryItem({
                              analyzer_name: workspaceAnalyzerName,
                              reagent_name: '',
                              lot_number: '',
                              unit: 'units',
                            })
                          }
                          className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                          disabled={inventoryLoading}
                        >
                          <Plus className="w-4 h-4" />
                          Add item
                        </button>
                      </div>
                      {analyzerInventory.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No analyzer-specific inventory recorded.
                        </p>
                      ) : (
                        <div className="space-y-2 text-xs text-slate-600">
                          {analyzerInventory.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">{item.reagent_name}</span>
                                {renderInventoryStatusBadge(item.status)}
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                  Qty: {item.quantity_available ?? 0} {item.unit || 'units'}
                                  {item.lot_number ? ` • Lot ${item.lot_number}` : ''}
                                </span>
                                <span>Min: {item.minimum_threshold ?? 0}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAdjustInventoryQuantity(item)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                                  disabled={inventoryLoading}
                                >
                                  Adjust
                                </button>
                                <button
                                  onClick={() => handleAddOrEditInventoryItem(item)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                                  disabled={inventoryLoading}
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          Hand-off notes
                        </h3>
                        <p className="text-xs text-slate-500">
                          Keep the next shift in sync with current status
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddHandoffNote(workspaceOrder)}
                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                        disabled={updatingOrderId === workspaceOrder.id}
                      >
                        <FileText className="w-4 h-4" />
                        Add hand-off note
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(workspaceOrder.handoffNotes || []).slice(0, 6).map((note, idx) => (
                        <div key={`${note.timestamp}-${idx}`} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs text-slate-600">
                          <div className="flex items-center justify-between mb-1 text-slate-500">
                            <span>
                              {note.shift ? note.shift.charAt(0).toUpperCase() + note.shift.slice(1) : 'Shift note'}
                            </span>
                            <span>{formatDateTimeToDDMMYYYYHHMM(note.timestamp)}</span>
                          </div>
                          <p className="text-slate-700">{note.note}</p>
                        </div>
                      ))}
                      {(workspaceOrder.handoffNotes || []).length === 0 && (
                        <p className="text-xs text-slate-400">
                          No documented hand-off notes yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          Notification log
                        </h3>
                        <p className="text-xs text-slate-500">Record communications to providers</p>
                      </div>
                      <button
                        onClick={() => handleLogNotification(workspaceOrder)}
                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                        disabled={updatingOrderId === workspaceOrder.id}
                      >
                        <Send className="w-4 h-4" />
                        Log notification
                      </button>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      {(workspaceOrder.notificationLog || []).slice(0, 6).map((entry, idx) => (
                        <div key={`${entry.timestamp}-${idx}`} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="font-semibold capitalize">{entry.channel}</span>
                            <span>{formatDateTimeToDDMMYYYYHHMM(entry.timestamp)}</span>
                          </div>
                          <p className="text-slate-700">{entry.message}</p>
                          <div className="mt-1 text-[10px] text-slate-400">
                            Recipients: {entry.recipients.join(', ') || '—'}
                          </div>
                        </div>
                      ))}
                      {(workspaceOrder.notificationLog || []).length === 0 && (
                        <p className="text-xs text-slate-400">
                          No notifications logged yet.
                        </p>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Results Modal */}
      {showResultsModal && selectedOrder && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Submit Lab Results - {selectedOrder.orderNumber}</h2>
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-700 mb-3">Test Results</h3>
                  <div className="space-y-4">
                    {results.map((result, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-3">{result.testName}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Value</label>
                            <input
                              type="text"
                              value={result.value}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].value = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter value"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                            <input
                              type="text"
                              value={result.unit}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].unit = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., mg/dL"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Reference Range</label>
                            <input
                              type="text"
                              value={result.referenceRange}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].referenceRange = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 70-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Flag</label>
                            <select
                              value={result.flag}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].flag = e.target.value as any;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="low">Low</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Clinical Interpretation</label>
                  <textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter clinical interpretation..."
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Upload Documents (PDF, Images, etc.)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
                    >
                      Choose Files
                    </label>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <span className="text-sm text-slate-600">{file.name}</span>
                            <button
                              onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResults}
                  disabled={loading || results.some(r => !r.value)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit Results
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default LabDashboard;

