import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Heart, Pill, Stethoscope,
  FileText, Activity, Users, Calendar, Plus, Filter, Search,
  ChevronDown, ChevronRight, Star, Flag, Bell, Eye, TestTube, Sparkles, Zap, RefreshCw
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { cdssApi } from '../services/api';

interface Task {
  id: string;
  patientId: string;
  patientName: string;
  patientRoom?: string;
  taskType: 'medication' | 'vitals' | 'assessment' | 'procedure' | 'documentation' | 'follow_up' | 'lab' | 'imaging';
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
}

interface TaskManagementProps {
  currentUser: any;
  appointments: any[];
  onTaskComplete?: (taskId: string) => void;
  onTaskUpdate?: (task: Task) => void;
  onTaskCountsChange?: (counts: { pending: number; inProgress: number; overdue: number }) => void;
}

const TaskManagement: React.FC<TaskManagementProps> = ({ 
  currentUser, 
  appointments, 
  onTaskComplete, 
  onTaskUpdate,
  onTaskCountsChange
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'normal' | 'high' | 'urgent'>('all');
  const [filterType, setFilterType] = useState<'all' | 'medication' | 'vitals' | 'assessment' | 'procedure' | 'documentation' | 'follow_up' | 'lab' | 'imaging'>('all');
  const [sortBy, setSortBy] = useState<'dueTime' | 'priority' | 'patient' | 'type'>('dueTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Load tasks from real data - create tasks based on actual appointments
  useEffect(() => {
    const generateTasksFromAppointments = () => {
      const realTasks: Task[] = [];
      const now = new Date();
      
      // Only create tasks from real appointments with actual data
      appointments.forEach((apt, index) => {
        const patientName = `${apt.patient.firstName} ${apt.patient.lastName}`;
        const appointmentTime = new Date(apt.appointmentDate);
        const isCreatedByCurrentUser = apt.createdBy === currentUser?.id;
        
        // Only create tasks for appointments that need nursing care
        if (apt.status === 'scheduled' || apt.status === 'confirmed') {
          // Only create vital signs task if vitals haven't been recorded yet
          if (!apt.vitals) {
            // Only show pending tasks to the nurse who registered the patient (created the appointment)
            // or if the nurse has taken ownership of the patient care.
            // Ensure strictly pending status.
            if (isCreatedByCurrentUser) {
              realTasks.push({
                id: `vitals-${apt.id}`,
                patientId: apt.patient.id,
                patientName,
                taskType: 'vitals',
                title: 'Record Vital Signs',
                description: `Record vital signs for ${patientName}`,
                priority: 'normal',
                status: 'pending',
                dueTime: new Date(appointmentTime.getTime() - 15 * 60000).toISOString(),
                estimatedDuration: 10,
                assignedTo: apt.createdBy || '',
                createdBy: apt.createdBy || '',
                createdAt: now.toISOString(),
                relatedAppointmentId: apt.id,
                isRecurring: false
              });
            }
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
            realTasks.push({
              id: `doc-${apt.id}`,
              patientId: apt.patient.id,
              patientName,
              taskType: 'documentation',
              title: 'Update Progress Notes',
              description: `Document progress for ${patientName}`,
              priority: 'normal',
              status: 'pending',
              dueTime: new Date(appointmentTime.getTime() + 30 * 60000).toISOString(),
              estimatedDuration: 10,
              assignedTo: apt.createdBy || '',
              createdBy: apt.createdBy || '',
              createdAt: now.toISOString(),
              relatedAppointmentId: apt.id,
              isRecurring: false
            });
          }
        }
      });

      setTasks(realTasks);
    };

    if (appointments.length > 0) {
      generateTasksFromAppointments();
    } else {
      setTasks([]);
    }
  }, [appointments, currentUser]);

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
      default: return <Clock className="w-4 h-4" />;
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

  const handleTaskComplete = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'completed' as const, completedAt: new Date().toISOString() }
        : task
    ));
    onTaskComplete?.(taskId);
  };

  const handleTaskStart = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'in_progress' as const }
        : task
    ));
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const stats = getTaskStats();

  const handleSmartPrioritize = async () => {
    setIsAiAnalyzing(true);
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const updatedTasks = tasks.map(task => {
      let newPriority = task.priority;
      let reason = "";
      
      const apt = appointments.find(a => a.id === task.relatedAppointmentId);

      // Logic for Vitals tasks
      if (task.taskType === 'vitals' && apt) {
        // If patient is elderly, increase priority
        if (apt.patient.age && apt.patient.age > 70) {
          newPriority = 'high';
          reason = "Patient age > 70";
        }
        
        // Check for chronic conditions (diabetes, hypertension, heart disease)
        if (apt.patient.chronicConditions) {
          const conditions = apt.patient.chronicConditions.toLowerCase();
          if (conditions.includes('diabetes') || conditions.includes('heart') || conditions.includes('hypertension') || conditions.includes('copd')) {
             if (newPriority !== 'urgent') { // Don't downgrade if already urgent
               newPriority = 'high';
               reason = reason ? `${reason}, Chronic Condition Risk` : "Chronic Condition Risk";
             }
          }
        }

        // Check for allergies that might react with common meds (simplified check)
        if (apt.patient.allergies && (apt.patient.allergies.toLowerCase().includes('severe') || apt.patient.allergies.toLowerCase().includes('anaphylaxis'))) {
             if (newPriority !== 'urgent') {
               newPriority = 'high';
               reason = reason ? `${reason}, High Risk Allergy` : "High Risk Allergy";
             }
        }
        
        // If appointment was marked urgent
        if (apt.priorityLevel === 'urgent' || apt.priorityLevel === 'emergency') {
          newPriority = 'urgent';
          reason = "Appointment marked urgent";
        }
      }
      
      // Logic for Documentation tasks
      if (task.taskType === 'documentation' && apt) {
         if (apt.status === 'in-progress' || apt.status === 'in_progress') {
             // If it's been in progress for a long time, bump priority (simulated)
             const startTime = new Date(apt.appointmentDate);
             const now = new Date();
             const diffMins = (now.getTime() - startTime.getTime()) / 60000;
             if (diffMins > 60) {
                 newPriority = 'high';
                 reason = "Appointment duration > 60m";
             }
         }
      }

      // Logic based on existing vitals (if re-assessing)
      if (apt && apt.vitals) {
        const { bloodPressure, heartRate, temperature, oxygenSaturation } = apt.vitals;
        // Check for critical values
        const sys = parseInt(bloodPressure?.split('/')[0] || "0");
        const dia = parseInt(bloodPressure?.split('/')[1] || "0");
        
        if (sys > 180 || sys < 90 || dia > 120 || heartRate > 120 || heartRate < 50 || temperature > 39 || oxygenSaturation < 90) {
            newPriority = 'urgent';
            reason = "Critical vitals detected";
        }
      }

      if (newPriority !== task.priority) {
          // In a real app, we would update this on the server
          return { ...task, priority: newPriority, notes: task.notes ? `${task.notes} [AI Priority: ${reason}]` : `[AI Priority: ${reason}]` };
      }
      return task;
    });

    setTasks(updatedTasks);
    setIsAiAnalyzing(false);
    setSortBy('priority');
    setSortOrder('desc');
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
            className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm ${isAiAnalyzing ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isAiAnalyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{isAiAnalyzing ? 'AI Analyzing...' : 'Smart Prioritize'}</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200/50">
            <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Tasks Found</h3>
            <p className="text-slate-500">No tasks match your current filters.</p>
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
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleTaskExpansion(task.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      {expandedTasks.has(task.id) ? 
                        <ChevronDown className="w-4 h-4" /> : 
                        <ChevronRight className="w-4 h-4" />
                      }
                    </button>
                    
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
