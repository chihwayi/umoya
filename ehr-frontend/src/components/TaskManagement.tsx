import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Heart, Pill, Stethoscope,
  FileText, Activity, Users, Calendar, Search,
  ChevronDown, ChevronRight, Flag, Eye, TestTube, Sparkles, RefreshCw
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { ehrApi, cdssApi } from '../services/api';

interface Task {
  id: string;
  patientId: string;
  patientName: string;
  patientRoom?: string;
  taskType: 'medication' | 'vitals' | 'assessment' | 'procedure' | 'documentation' | 'follow_up' | 'lab' | 'imaging' | 'escalation';
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueTime: string;
  estimatedDuration: number; // in minutes
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  relatedAppointmentId?: string;
  relatedOrderId?: string;
  source?: 'manual' | 'copilot' | 'clinical_escalation';
  relatedEscalationTaskId?: string;
  trustSummary?: {
    sourceLabel?: string;
    backingType?: string;
    reviewState?: string;
    classifierStage?: string;
    workflowSource?: string;
    recommendationCount?: number | null;
    evidenceCount?: number | null;
    riskBand?: string | null;
  };
}

interface TaskManagementProps {
  currentUser: any;
  appointments: any[];
  onTaskComplete?: (taskId: string) => void;
  onTaskUpdate?: (task: Task) => void;
  onTaskCountsChange?: (counts: { pending: number; inProgress: number; overdue: number }) => void;
  /** Open the real workflow for a task (record vitals, triage, MAR, etc.). */
  onTaskAction?: (task: Task) => void;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

/**
 * Derive a task's clinical priority from REAL signals (persisted NEWS2 / CDSS
 * acute-deterioration on the patient's latest vitals, appointment urgency,
 * medication overdue, overdue due-time, age/comorbidity). Deterministic — used
 * both at task generation and by the "Prioritize by Risk" action.
 */
function deriveClinicalPriority(
  task: Task,
  apt: any,
): { priority: Task['priority']; reason: string } {
  // Clinical escalations already carry a severity-derived priority.
  if (task.source === 'clinical_escalation') {
    return { priority: task.priority, reason: '' };
  }
  let priority: Task['priority'] = task.priority;
  const reasons: string[] = [];
  const bump = (p: Task['priority'], why: string) => {
    if (PRIORITY_RANK[p] > PRIORITY_RANK[priority]) priority = p;
    if (why && !reasons.includes(why)) reasons.push(why);
  };

  const v = apt?.vitals;
  if (v) {
    const news = Number(v.newsScore ?? v.news_score);
    if (!Number.isNaN(news)) {
      if (news >= 7) bump('urgent', `NEWS2 ${news}`);
      else if (news >= 5) bump('high', `NEWS2 ${news}`);
    }
    if (v.cdssInsights?.risk?.acute_safety?.acute_deterioration) {
      bump('urgent', 'Acute deterioration');
    }
  }
  if (apt?.priorityLevel === 'urgent' || apt?.priorityLevel === 'emergency') {
    bump('urgent', 'Appointment marked urgent');
  }
  if (task.taskType === 'medication' && (task.notes || '').toLowerCase().includes('overdue')) {
    bump('urgent', 'Medication overdue');
  }
  // Overdue (past due time and not done) bumps one level toward high.
  if (task.status !== 'completed' && task.dueTime && new Date(task.dueTime) < new Date()) {
    bump(PRIORITY_RANK[priority] >= PRIORITY_RANK.high ? 'urgent' : 'high', 'Overdue');
  }
  if (apt?.patient?.age && apt.patient.age > 70) bump('high', 'Age > 70');
  if (apt?.patient?.chronicConditions && /diabetes|heart|hypertension|copd/i.test(apt.patient.chronicConditions)) {
    bump('high', 'Chronic condition risk');
  }
  return { priority, reason: reasons.join(', ') };
}

const TaskManagement: React.FC<TaskManagementProps> = ({
  currentUser,
  appointments,
  onTaskComplete,
  onTaskUpdate,
  onTaskCountsChange,
  onTaskAction
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'normal' | 'high' | 'urgent'>('all');
  const [filterType, setFilterType] = useState<'all' | 'medication' | 'vitals' | 'assessment' | 'procedure' | 'documentation' | 'follow_up' | 'lab' | 'imaging' | 'escalation'>('all');
  const [sortBy, setSortBy] = useState<'dueTime' | 'priority' | 'patient' | 'type'>('dueTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [serverCompletedTaskIds, setServerCompletedTaskIds] = useState<Set<string>>(new Set());
  const [serverInProgressTaskIds, setServerInProgressTaskIds] = useState<Set<string>>(new Set());
  const [serverEscalationTasks, setServerEscalationTasks] = useState<Task[]>([]);
  // Real, non-appointment task sources (broadens beyond triage/vitals/docs).
  const [serverOrderTasks, setServerOrderTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadState = async () => {
      try {
        const token = localStorage.getItem('ehr_token');
        const tenantSlug = localStorage.getItem('ehr_tenant_slug');
        if (!token || !tenantSlug) return;
        const [stateResponse, escalationResponse, marResponse, labResponse] = await Promise.all([
          ehrApi.getNurseWorklistState(token, tenantSlug),
          ehrApi.getClinicalEscalationFeed(token, tenantSlug, { includeCompleted: true, limit: 50 }),
          ehrApi.getMedicationSafetyWorklist(token, tenantSlug, { includeCompleted: false, limit: 100 }).catch(() => ({ data: null })),
          ehrApi.getPendingLabOrders(token, tenantSlug).catch(() => ({ data: null })),
        ]);
        const completed = new Set<string>(stateResponse.data?.completedTaskIds || []);
        setServerCompletedTaskIds(completed);
        setServerInProgressTaskIds(new Set<string>(stateResponse.data?.inProgressTaskIds || []));
        const escalationTasks = Array.isArray(escalationResponse.data?.items)
          ? escalationResponse.data.items.map((item: any) => ({
              id: `clinical-escalation-${item.id}`,
              patientId: item.patientId,
              patientName: item.patientName || item.patientNumber || 'Unknown patient',
              taskType: 'escalation' as const,
              title: item.title || 'Clinical escalation',
              description: item.summary || 'Clinical escalation requires follow-up.',
              priority:
                item.severity === 'critical' ? 'urgent' :
                item.severity === 'high' ? 'high' :
                item.severity === 'medium' ? 'normal' :
                'low',
              status:
                item.status === 'completed' ? 'completed' :
                item.status === 'acknowledged' ? 'in_progress' :
                'pending',
              dueTime: item.dueAt || new Date().toISOString(),
              estimatedDuration: 15,
              assignedTo: currentUser?.id || '',
              createdBy: 'clinical_escalation',
              createdAt: item.dueAt || new Date().toISOString(),
              completedAt: item.completedAt || undefined,
              notes: item.recommendedAction || undefined,
              isRecurring: false,
              source: 'clinical_escalation' as const,
              relatedEscalationTaskId: item.id,
              trustSummary: item.trustSummary || undefined,
            }))
          : [];
        setServerEscalationTasks(escalationTasks);

        // ── Medication administration tasks (real MAR worklist) ──────────────
        const marItems: any[] = Array.isArray(marResponse.data)
          ? marResponse.data
          : Array.isArray(marResponse.data?.items)
            ? marResponse.data.items
            : [];
        const medicationTasks: Task[] = marItems
          .filter((m) => {
            const s = String(m.administrationStatus || m.status || 'pending').toLowerCase();
            return s !== 'administered' && s !== 'completed';
          })
          .map((m) => {
            const overdue = Number(m.overdueMinutes || 0) > 0;
            const taskId = `mar-${m.id}`;
            return {
              id: taskId,
              patientId: m.patientId,
              patientName: m.patientName || m.patientNumber || 'Unknown patient',
              taskType: 'medication' as const,
              title: `Administer ${m.medicationName || 'medication'}`,
              description: `${m.medicationName || 'Medication'}${m.dose ? ` ${m.dose}` : ''}${m.route ? ` (${m.route})` : ''} for ${m.patientName || 'patient'}`,
              priority: overdue ? 'urgent' : m.dueSoon ? 'high' : (m.priority as any) || 'normal',
              status: completed.has(taskId) ? 'completed' : 'pending',
              dueTime: m.scheduledTime || new Date().toISOString(),
              estimatedDuration: 10,
              assignedTo: currentUser?.id || '',
              createdBy: 'mar_worklist',
              createdAt: m.scheduledTime || new Date().toISOString(),
              completedAt: completed.has(taskId) ? new Date().toISOString() : undefined,
              notes: overdue ? `Overdue by ${m.overdueMinutes} min` : undefined,
              isRecurring: false,
              source: 'manual' as const,
              relatedOrderId: m.id,
            } as Task;
          });

        // ── Lab sample collection tasks (real pending lab orders) ────────────
        const labItems: any[] = Array.isArray(labResponse.data)
          ? labResponse.data
          : Array.isArray(labResponse.data?.orders)
            ? labResponse.data.orders
            : Array.isArray(labResponse.data?.items)
              ? labResponse.data.items
              : [];
        const labTasks: Task[] = labItems.map((o) => {
          const taskId = `lab-collect-${o.id}`;
          const testName = o.testName || o.test_name || o.panelName || o.snomedTerm || o.snomed_term || 'lab sample';
          const patientName = o.patientName || o.patient_name ||
            `${o.firstName || o.first_name || ''} ${o.lastName || o.last_name || ''}`.trim() || 'Unknown patient';
          const isStat = String(o.priority || o.urgency || '').toLowerCase().includes('stat') ||
            String(o.priority || o.urgency || '').toLowerCase().includes('urgent');
          return {
            id: taskId,
            patientId: o.patientId || o.patient_id,
            patientName,
            taskType: 'lab' as const,
            title: `Collect sample: ${testName}`,
            description: `Collect ${testName} for ${patientName}`,
            priority: isStat ? 'high' : 'normal',
            status: completed.has(taskId) ? 'completed' : 'pending',
            dueTime: o.createdAt || o.created_at || new Date().toISOString(),
            estimatedDuration: 10,
            assignedTo: currentUser?.id || '',
            createdBy: 'lab_orders',
            createdAt: o.createdAt || o.created_at || new Date().toISOString(),
            completedAt: completed.has(taskId) ? new Date().toISOString() : undefined,
            isRecurring: false,
            source: 'manual' as const,
            relatedOrderId: o.id,
          } as Task;
        });

        setServerOrderTasks([...medicationTasks, ...labTasks]);
      } catch {
      }
    };
    loadState();
  }, [currentUser?.id]);

  // Load tasks from real data - create tasks based on actual appointments
  useEffect(() => {
    const generateTasksFromAppointments = () => {
      const realTasks: Task[] = [];
      const now = new Date();
      const completedTaskIds = serverCompletedTaskIds;
      
      // Only create tasks from real appointments with actual data
      appointments.forEach((apt, index) => {
        const patientName = `${apt.patient.firstName} ${apt.patient.lastName}`;
        const appointmentTime = new Date(apt.appointmentDate);
        const isCreatedByCurrentUser = apt.createdBy === currentUser?.id;
        
        // Only create tasks for appointments that need nursing care
        if (apt.status === 'scheduled' || apt.status === 'confirmed') {
          // 1. Triage Task
          if (!apt.triage) {
            const taskId = `triage-${apt.id}`;
            const isLocalCompleted = completedTaskIds.has(taskId);
            
            // Pending Triage - Visible to ALL nurses
            realTasks.push({
              id: taskId,
              patientId: apt.patient.id,
              patientName,
              taskType: 'assessment',
              title: 'Perform Triage Assessment',
              description: `Complete triage assessment for ${patientName}`,
              priority: 'high',
              status: isLocalCompleted ? 'completed' : 'pending',
              dueTime: new Date(appointmentTime.getTime() - 20 * 60000).toISOString(), // 20 mins before
              estimatedDuration: 15,
              assignedTo: apt.createdBy || '',
              createdBy: apt.createdBy || '',
              createdAt: now.toISOString(),
              completedAt: isLocalCompleted ? now.toISOString() : undefined,
              relatedAppointmentId: apt.id,
              isRecurring: false
            });
          } else {
            // Completed Triage
            const isPerformedByCurrentUser = apt.triage.recordedBy === currentUser?.id;
            if (isCreatedByCurrentUser || isPerformedByCurrentUser) {
              realTasks.push({
                id: `triage-${apt.id}`,
                patientId: apt.patient.id,
                patientName,
                taskType: 'assessment',
                title: 'Perform Triage Assessment',
                description: `Complete triage assessment for ${patientName}`,
                priority: 'high',
                status: 'completed',
                dueTime: new Date(appointmentTime.getTime() - 20 * 60000).toISOString(),
                estimatedDuration: 15,
                assignedTo: apt.createdBy || '',
                createdBy: apt.createdBy || '',
                createdAt: now.toISOString(),
                completedAt: apt.triage.recordedAt || now.toISOString(),
                relatedAppointmentId: apt.id,
                isRecurring: false
              });
            }
          }

          // 2. Vital Signs Task
          if (!apt.vitals) {
            const taskId = `vitals-${apt.id}`;
            const isLocalCompleted = completedTaskIds.has(taskId);

            // Show pending tasks to ALL nurses so any available nurse can pick it up.
            // This ensures tasks are visible even if the nurse didn't create the appointment.
            realTasks.push({
              id: taskId,
              patientId: apt.patient.id,
              patientName,
              taskType: 'vitals',
              title: 'Record Vital Signs',
              description: `Record vital signs for ${patientName}`,
              priority: 'normal',
              status: isLocalCompleted ? 'completed' : 'pending',
              dueTime: new Date(appointmentTime.getTime() - 15 * 60000).toISOString(),
              estimatedDuration: 10,
              assignedTo: apt.createdBy || '', // Remains assigned to creator initially, but visible to all
              createdBy: apt.createdBy || '',
              createdAt: now.toISOString(),
              completedAt: isLocalCompleted ? now.toISOString() : undefined,
              relatedAppointmentId: apt.id,
              isRecurring: false
            });
          } else {
            // Vitals already recorded - mark as completed
            // Show completed task if the current user performed it OR created the appointment
            const isPerformedByCurrentUser = apt.vitals.recordedBy === currentUser?.id;
            
            if (isCreatedByCurrentUser || isPerformedByCurrentUser) {
              realTasks.push({
                id: `vitals-${apt.id}`,
                patientId: apt.patient.id,
                patientName,
                taskType: 'vitals',
                title: 'Record Vital Signs',
                description: `Record vital signs for ${patientName}`,
                priority: 'normal',
                status: 'completed',
                dueTime: new Date(appointmentTime.getTime() - 15 * 60000).toISOString(),
                estimatedDuration: 10,
                assignedTo: apt.createdBy || '',
                createdBy: apt.createdBy || '',
                createdAt: now.toISOString(),
                completedAt: apt.vitals.recordedAt || now.toISOString(),
                relatedAppointmentId: apt.id,
                isRecurring: false
              });
            }
          }
        }

        if (apt.status === 'in-progress' || apt.status === 'in_progress') {
          // Documentation task for in-progress appointments
          // Show if created by user OR if user is serving (we don't strictly know if serving without notes, so we default to creator)
          if (isCreatedByCurrentUser) {
            const taskId = `doc-${apt.id}`;
            const isLocalCompleted = completedTaskIds.has(taskId);

            realTasks.push({
              id: taskId,
              patientId: apt.patient.id,
              patientName,
              taskType: 'documentation',
              title: 'Update Progress Notes',
              description: `Document progress for ${patientName}`,
              priority: 'normal',
              status: isLocalCompleted ? 'completed' : 'pending',
              dueTime: new Date(appointmentTime.getTime() + 30 * 60000).toISOString(),
              estimatedDuration: 10,
              assignedTo: apt.createdBy || '',
              createdBy: apt.createdBy || '',
              createdAt: now.toISOString(),
              completedAt: isLocalCompleted ? now.toISOString() : undefined,
              relatedAppointmentId: apt.id,
              isRecurring: false
            });
          }
        }
      });

      // Decorate appointment + order tasks: apply persisted in-progress state and
      // a real, data-driven priority. (Escalations keep their server status/priority.)
      const decorate = (t: Task): Task => {
        const apt = appointments.find((a) => a.id === t.relatedAppointmentId);
        const { priority } = deriveClinicalPriority(t, apt);
        let status = t.status;
        if (completedTaskIds.has(t.id)) status = 'completed';
        else if (serverInProgressTaskIds.has(t.id) && status !== 'completed') status = 'in_progress';
        return { ...t, priority, status };
      };
      const decorated = [...realTasks, ...serverOrderTasks].map(decorate);
      setTasks([...decorated, ...serverEscalationTasks]);
    };

    if (appointments.length > 0 || serverEscalationTasks.length > 0 || serverOrderTasks.length > 0) {
      generateTasksFromAppointments();
    } else {
      setTasks([]);
    }
  }, [appointments, currentUser, serverCompletedTaskIds, serverInProgressTaskIds, serverEscalationTasks, serverOrderTasks]);

  // Notify parent of task count changes
  // Use useRef to store the callback to avoid recreating it on every render
  const onTaskCountsChangeRef = React.useRef(onTaskCountsChange);
  
  useEffect(() => {
    onTaskCountsChangeRef.current = onTaskCountsChange;
  }, [onTaskCountsChange]);

  useEffect(() => {
    if (onTaskCountsChangeRef.current) {
      const counts = {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        overdue: tasks.filter(t => {
          const now = new Date();
          const dueTime = new Date(t.dueTime);
          return t.status !== 'completed' && dueTime < now;
        }).length
      };
      onTaskCountsChangeRef.current(counts);
    }
  }, [tasks]);

  // Filter and sort tasks
  useEffect(() => {
    let filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesType = filterType === 'all' || task.taskType === filterType;
      const matchesCompleted = showCompleted || task.status !== 'completed';

      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesCompleted;
    });

    // Sort tasks
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'dueTime':
          comparison = new Date(a.dueTime).getTime() - new Date(b.dueTime).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'patient':
          comparison = a.patientName.localeCompare(b.patientName);
          break;
        case 'type':
          comparison = a.taskType.localeCompare(b.taskType);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, filterStatus, filterPriority, filterType, showCompleted, sortBy, sortOrder]);

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'medication': return <Pill className="w-4 h-4" />;
      case 'vitals': return <Heart className="w-4 h-4" />;
      case 'assessment': return <Stethoscope className="w-4 h-4" />;
      case 'procedure': return <Activity className="w-4 h-4" />;
      case 'documentation': return <FileText className="w-4 h-4" />;
      case 'follow_up': return <Users className="w-4 h-4" />;
      case 'lab': return <TestTube className="w-4 h-4" />;
      case 'imaging': return <Eye className="w-4 h-4" />;
      case 'escalation': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Label for the deep-link "Do it" button — opens the real workflow for the task.
  const getActionLabel = (taskType: string) => {
    switch (taskType) {
      case 'vitals': return 'Record Vitals';
      case 'assessment': return 'Open Triage';
      case 'documentation': return 'Open Notes';
      case 'medication': return 'Open MAR';
      case 'lab': return 'Open Labs';
      case 'escalation': return 'Open Patient';
      default: return 'Open';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    const urgent = tasks.filter(t => t.priority === 'urgent').length;

    return { total, pending, inProgress, completed, overdue, urgent };
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) return;
      const task = tasks.find((t) => t.id === taskId);
      if (task?.source === 'clinical_escalation' && task.relatedEscalationTaskId) {
        await ehrApi.completeClinicalEscalation(
          task.relatedEscalationTaskId,
          { note: task.notes },
          token,
          tenantSlug,
        );
      } else {
        await ehrApi.completeNurseTask(
          taskId,
          {
            patientId: task?.patientId,
            context: { taskType: task?.taskType, priority: task?.priority },
          },
          token,
          tenantSlug,
        );
      }

      setServerCompletedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
      setTasks(prev => prev.map(taskItem =>
        taskItem.id === taskId
          ? { ...taskItem, status: 'completed' as const, completedAt: new Date().toISOString() }
          : taskItem
      ));
      onTaskComplete?.(taskId);
    } catch {
    }
  };

  const handleTaskStart = async (taskId: string) => {
    const token = localStorage.getItem('ehr_token');
    const tenantSlug = localStorage.getItem('ehr_tenant_slug');
    const task = tasks.find((item) => item.id === taskId);
    // Optimistic update so the card reacts immediately.
    setServerInProgressTaskIds((prev) => new Set(prev).add(taskId));
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'in_progress' as const } : t
    ));
    try {
      if (!token || !tenantSlug) return;
      if (task?.source === 'clinical_escalation' && task.relatedEscalationTaskId) {
        await ehrApi.acknowledgeClinicalEscalation(task.relatedEscalationTaskId, token, tenantSlug);
      } else {
        // Persist in-progress so it survives reload (previously local-only).
        await ehrApi.startNurseTask(
          taskId,
          { patientId: task?.patientId, context: { taskType: task?.taskType, priority: task?.priority } },
          token,
          tenantSlug,
        );
      }
    } catch {
      // Roll back optimistic state on failure.
      setServerInProgressTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
        // Fire-and-forget: mark this nurse task as viewed so it won't reappear as unread
        const token = localStorage.getItem('ehr_token');
        const tenantSlug = localStorage.getItem('ehr_tenant_slug');
        if (token && tenantSlug) {
          const markViewedRequest = cdssApi?.markNurseTaskViewed?.(taskId, token, tenantSlug);
          if (markViewedRequest && typeof (markViewedRequest as Promise<unknown>).catch === 'function') {
            (markViewedRequest as Promise<unknown>).catch(() => {/* non-critical */});
          }
        }
      }
      return newSet;
    });
  };

  const stats = getTaskStats();

  const handleSmartPrioritize = () => {
    setIsAiAnalyzing(true);
    // Recompute priorities from real clinical data (persisted NEWS2 / CDSS
    // acute-deterioration, medication overdue, appointment urgency, overdue
    // due-time, comorbidity) — deterministic, no fake delay, no fabricated data.
    const updatedTasks = tasks.map((task) => {
      const apt = appointments.find((a) => a.id === task.relatedAppointmentId);
      const { priority, reason } = deriveClinicalPriority(task, apt);
      if (priority !== task.priority || reason) {
        const tag = reason ? `[Risk priority: ${reason}]` : '[Risk priority]';
        // Replace any prior risk-priority annotation rather than stacking them.
        const baseNotes = (task.notes || '').replace(/\s*\[Risk priority[^\]]*\]/g, '').trim();
        return { ...task, priority, notes: baseNotes ? `${baseNotes} ${tag}` : tag };
      }
      return task;
    });
    setTasks(updatedTasks);
    setSortBy('priority');
    setSortOrder('desc');
    setIsAiAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
              <p className="text-slate-600">Epic-style task management for your shift</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Current Shift</p>
            <p className="text-lg font-semibold text-slate-900">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Total</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-slate-700">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-700">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-slate-700">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Flag className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-slate-700">Urgent</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks, patients, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="medication">Medication</option>
              <option value="vitals">Vitals</option>
              <option value="assessment">Assessment</option>
              <option value="procedure">Procedure</option>
              <option value="documentation">Documentation</option>
              <option value="follow_up">Follow-up</option>
              <option value="lab">Lab</option>
              <option value="imaging">Imaging</option>
              <option value="escalation">Clinical Escalations</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="dueTime">Sort by Due Time</option>
              <option value="priority">Sort by Priority</option>
              <option value="patient">Sort by Patient</option>
              <option value="type">Sort by Type</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700">Show completed tasks</span>
          </label>

          <button
              onClick={handleSmartPrioritize}
              disabled={isAiAnalyzing}
              title="Re-rank tasks using real clinical signals: NEWS2 / CDSS acute-deterioration, medication overdue, appointment urgency, overdue due-time, and comorbidity."
              className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm ${isAiAnalyzing ? 'opacity-70 cursor-wait' : ''}`}
            >
            {isAiAnalyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">Prioritize by Risk</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {appointments.length === 0 && serverEscalationTasks.length === 0 && serverOrderTasks.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200/50">
             <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-semibold text-slate-600 mb-2">No Appointments Today</h3>
             <p className="text-slate-500">There are no appointments scheduled for today, so no tasks are generated.</p>
           </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200/50">
            <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Tasks Found</h3>
            <p className="text-slate-500 mb-4">No tasks match your current filters. Try changing filters or checking "Show completed tasks".</p>
            <div className="bg-blue-50 p-4 rounded-lg inline-block text-left max-w-md">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    About Prioritize by Risk
                </h4>
                <p className="text-sm text-blue-700">
                    "Prioritize by Risk" re-ranks tasks from real clinical signals — the patient's latest NEWS2 / CDSS acute-deterioration, medication overdue, appointment urgency, overdue due-time, and comorbidity.
                </p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                task.status === 'overdue' ? 'border-red-200 bg-red-50/30' :
                task.priority === 'urgent' ? 'border-red-200 bg-red-50/30' :
                task.status === 'in_progress' ? 'border-blue-200 bg-blue-50/30' :
                'border-slate-200 hover:border-indigo-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      task.status === 'completed' ? 'bg-green-100 text-green-600' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      task.status === 'overdue' ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {getTaskIcon(task.taskType)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
                          {task.priority.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {task.notes && task.notes.includes('[Risk priority') && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            RISK PRIORITY
                          </span>
                        )}
                        {task.source === 'clinical_escalation' && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            CLINICAL ESCALATION
                          </span>
                        )}
                        {task.isRecurring && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                            RECURRING
                          </span>
                        )}
                      </div>
                      
                      <p className="text-slate-600 mb-3">{task.description}</p>
                      
                      <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{task.patientName}</span>
                          {task.patientRoom && <span>• {task.patientRoom}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Due: {formatDateTimeToDDMMYYYYHHMM(task.dueTime)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          <span>{task.estimatedDuration} min</span>
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {expandedTasks.has(task.id) && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Created:</span>
                              <p className="text-slate-600">{formatDateTimeToDDMMYYYYHHMM(task.createdAt)}</p>
                            </div>
                            {task.completedAt && (
                              <div>
                                <span className="font-semibold text-slate-700">Completed:</span>
                                <p className="text-slate-600">{formatDateTimeToDDMMYYYYHHMM(task.completedAt)}</p>
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-700">Task Type:</span>
                              <p className="text-slate-600 capitalize">{task.taskType.replace('_', ' ')}</p>
                            </div>
                            {task.notes && (
                              <div className="md:col-span-2">
                                <span className="font-semibold text-slate-700">Notes:</span>
                                <p className="text-slate-600">{task.notes}</p>
                              </div>
                            )}
                            {task.source === 'clinical_escalation' &&
                              (task.trustSummary?.sourceLabel ||
                                task.trustSummary?.backingType ||
                                task.trustSummary?.reviewState ||
                                task.trustSummary?.classifierStage) && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-700">Trust & Review:</span>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                                    {task.trustSummary?.sourceLabel && <span>Source: {task.trustSummary.sourceLabel}</span>}
                                    {task.trustSummary?.backingType && <span>{task.trustSummary.backingType}</span>}
                                    {task.trustSummary?.reviewState && <span>{task.trustSummary.reviewState}</span>}
                                    {task.trustSummary?.classifierStage && <span>Stage: {task.trustSummary.classifierStage}</span>}
                                    {task.trustSummary?.riskBand && <span>Risk: {task.trustSummary.riskBand}</span>}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleTaskExpansion(task.id)}
                      aria-label={`Toggle task details for ${task.title}`}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      {expandedTasks.has(task.id) ? 
                        <ChevronDown className="w-4 h-4" /> : 
                        <ChevronRight className="w-4 h-4" />
                      }
                    </button>
                    
                    {/* Deep-link to actually perform the task (record vitals, triage, MAR…) */}
                    {task.status !== 'completed' && onTaskAction && (
                      <button
                        onClick={() => onTaskAction(task)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                      >
                        {getTaskIcon(task.taskType)}
                        {getActionLabel(task.taskType)}
                      </button>
                    )}

                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleTaskStart(task.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 font-semibold text-sm"
                      >
                        Start
                      </button>
                    )}
                    
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleTaskComplete(task.id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 font-semibold text-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete
                      </button>
                    )}
                    
                    {task.status === 'completed' && (
                      <div className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskManagement;
