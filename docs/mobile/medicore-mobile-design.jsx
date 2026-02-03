import React, { useState } from 'react';
import { Heart, Activity, Calendar, FileText, DollarSign, Image as ImageIcon, 
         Pill, Users, BedDouble, TrendingUp, AlertCircle, CheckCircle, 
         Clock, ChevronRight, Plus, Mic, Camera, Search, Bell, Menu,
         MoreVertical, ArrowLeft, Home, User, Settings, MessageSquare,
         Stethoscope, TestTube, XCircle, Download, Upload, Zap } from 'lucide-react';

const MediCoreMobileDesign = () => {
  const [activeRole, setActiveRole] = useState('doctor');
  const [activeScreen, setActiveScreen] = useState('home');
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Role configurations
  const roles = {
    doctor: {
      name: 'Doctor',
      color: '#00A896',
      gradient: 'from-teal-500 to-cyan-600',
      icon: Stethoscope,
      screens: ['home', 'patients', 'voice', 'vitals', 'orders']
    },
    nurse: {
      name: 'Nurse',
      color: '#6B46C1',
      gradient: 'from-purple-500 to-indigo-600',
      icon: Heart,
      screens: ['home', 'rounds', 'medications', 'vitals', 'notes']
    },
    finance: {
      name: 'Finance',
      color: '#D97706',
      gradient: 'from-amber-500 to-orange-600',
      icon: DollarSign,
      screens: ['home', 'billing', 'insurance', 'reports']
    },
    radiology: {
      name: 'Radiology',
      color: '#0891B2',
      gradient: 'from-cyan-600 to-blue-600',
      icon: ImageIcon,
      screens: ['home', 'queue', 'viewer', 'reports']
    }
  };

  // Sample data
  const wardPatients = [
    { id: 1, name: 'Sarah Moyo', age: 34, room: 'A-201', condition: 'Post-Op Day 2', status: 'stable', vitals: { bp: '120/80', hr: 72, temp: 37.1, spo2: 98 }, alerts: 0 },
    { id: 2, name: 'John Ncube', age: 58, room: 'A-203', condition: 'Pneumonia', status: 'critical', vitals: { bp: '145/95', hr: 92, temp: 38.5, spo2: 94 }, alerts: 2 },
    { id: 3, name: 'Grace Chikwanha', age: 42, room: 'B-105', condition: 'Diabetes Management', status: 'stable', vitals: { bp: '118/76', hr: 68, temp: 36.8, spo2: 99 }, alerts: 0 },
    { id: 4, name: 'David Mutasa', age: 67, room: 'B-108', condition: 'CHF Exacerbation', status: 'monitoring', vitals: { bp: '135/88', hr: 85, temp: 37.3, spo2: 96 }, alerts: 1 },
  ];

  const notifications = [
    { id: 1, type: 'critical', title: 'Critical Lab Result', message: 'John Ncube: K+ 2.5 mmol/L', time: '2m ago', icon: AlertCircle },
    { id: 2, type: 'info', title: 'New Order', message: 'Dr. Banda ordered CT Scan for Sarah Moyo', time: '15m ago', icon: CheckCircle },
    { id: 3, type: 'warning', title: 'Medication Due', message: 'Grace Chikwanha: Insulin 10u', time: '30m ago', icon: Clock },
  ];

  // Glassmorphism card component
  const GlassCard = ({ children, className = '', onClick = null }) => (
    <div 
      onClick={onClick}
      className={`backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 rounded-2xl border border-white/20 shadow-xl ${className} ${onClick ? 'cursor-pointer active:scale-98 transition-all' : ''}`}
    >
      {children}
    </div>
  );

  // Status badge
  const StatusBadge = ({ status }) => {
    const colors = {
      stable: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      critical: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
      monitoring: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[status] || colors.stable}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Doctor Home Screen
  const DoctorHome = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Ward Rounds</h1>
          <p className="text-gray-600 dark:text-gray-400">ICU & General Ward · 8 patients</p>
        </div>
        <button className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
          <Mic size={20} />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertCircle size={16} className="text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">2</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Critical</div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Clock size={16} className="text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">5</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">12</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Reviewed</div>
        </GlassCard>
      </div>

      {/* Patient List */}
      <div className="space-y-3">
        {wardPatients.map((patient) => (
          <GlassCard 
            key={patient.id} 
            className="p-4 hover:shadow-2xl transition-all"
            onClick={() => setSelectedPatient(patient)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{patient.name}</h3>
                  {patient.alerts > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                      {patient.alerts}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{patient.age}y · Room {patient.room}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{patient.condition}</p>
              </div>
              <StatusBadge status={patient.status} />
            </div>

            {/* Vitals Row */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">BP</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{patient.vitals.bp}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">HR</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{patient.vitals.hr}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Temp</div>
                <div className={`text-sm font-semibold ${patient.vitals.temp > 38 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {patient.vitals.temp}°C
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">SpO₂</div>
                <div className={`text-sm font-semibold ${patient.vitals.spo2 < 95 ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                  {patient.vitals.spo2}%
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  // Nurse Home Screen
  const NurseHome = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">My Shift</h1>
          <p className="text-gray-600 dark:text-gray-400">Night Shift · Ward A & B</p>
        </div>
        <div className="flex gap-2">
          <button className="p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur">
            <Bell size={20} />
          </button>
          <button className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Medication Schedule */}
      <GlassCard className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Pill size={18} />
          Medication Schedule
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Grace Chikwanha</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Insulin 10 units SC</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">Due Now</p>
              <button className="mt-1 px-3 py-1 rounded-lg bg-purple-600 text-white text-xs">
                Administer
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100/50 dark:bg-gray-700/50">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Sarah Moyo</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Morphine 5mg IV</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">22:00</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Tasks */}
      <GlassCard className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <CheckCircle size={18} />
          Tasks (6)
        </h3>
        <div className="space-y-2">
          {['Vitals Round - Ward A', 'IV Site Check - All Patients', 'Update Care Plans'].map((task, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <input type="checkbox" className="w-5 h-5 rounded accent-purple-600" />
              <span className="text-gray-700 dark:text-gray-300">{task}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  // Finance Home Screen
  const FinanceHome = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Finance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Today's Overview</p>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Today's Revenue</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">$12,450</p>
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <TrendingUp size={12} /> +15% vs yesterday
          </p>
        </GlassCard>
        
        <GlassCard className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending Bills</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">23</p>
          <p className="text-xs text-amber-600">$8,920 outstanding</p>
        </GlassCard>
      </div>

      {/* Recent Transactions */}
      <GlassCard className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Transactions</h3>
        <div className="space-y-3">
          {[
            { patient: 'Sarah Moyo', amount: 450, type: 'Consultation', status: 'paid' },
            { patient: 'John Ncube', amount: 2340, type: 'Lab Tests', status: 'pending' },
            { patient: 'Grace Chikwanha', amount: 180, type: 'Medication', status: 'paid' }
          ].map((txn, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-100/50 dark:bg-gray-700/50">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{txn.patient}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{txn.type}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">${txn.amount}</p>
                <span className={`text-xs px-2 py-1 rounded ${txn.status === 'paid' ? 'bg-emerald-500/20 text-emerald-700' : 'bg-amber-500/20 text-amber-700'}`}>
                  {txn.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  // Radiology Home Screen
  const RadiologyHome = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Imaging Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">7 studies pending</p>
        </div>
        <button className="p-3 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg">
          <Camera size={20} />
        </button>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">X-Ray</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">2</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">CT Scan</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">2</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Ultrasound</p>
        </GlassCard>
      </div>

      {/* Study Queue */}
      <div className="space-y-3">
        {[
          { patient: 'Sarah Moyo', type: 'Chest X-Ray', priority: 'routine', time: '09:30 AM' },
          { patient: 'John Ncube', type: 'CT Chest', priority: 'urgent', time: '10:00 AM' },
          { patient: 'David Mutasa', type: 'Cardiac Echo', priority: 'stat', time: 'ASAP' }
        ].map((study, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{study.patient}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{study.type}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                study.priority === 'stat' ? 'bg-red-500/20 text-red-700 border border-red-500/30' :
                study.priority === 'urgent' ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-700 border border-blue-500/30'
              }`}>
                {study.priority.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
              <p className="text-sm text-gray-600 dark:text-gray-400">{study.time}</p>
              <button className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium">
                Start Study
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  // Voice Scribe Interface
  const VoiceScribeScreen = () => {
    const [isRecording, setIsRecording] = useState(false);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setActiveScreen('home')} className="p-2">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Voice Scribe</h2>
          <div className="w-8" />
        </div>

        <GlassCard className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-2">Patient: Sarah Moyo</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">34F · Room A-201</p>
          </div>

          {/* Recording Button */}
          <div className="flex justify-center mb-8">
            <button 
              onClick={() => setIsRecording(!isRecording)}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 shadow-2xl shadow-red-500/50 animate-pulse' 
                  : 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-xl'
              }`}
            >
              {isRecording ? (
                <div className="w-8 h-8 bg-white rounded" />
              ) : (
                <Mic size={48} className="text-white" />
              )}
            </button>
          </div>

          {isRecording && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{ 
                      height: `${Math.random() * 40 + 20}px`,
                      animationDelay: `${i * 50}ms`
                    }}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-red-600 font-medium">Recording... 00:23</p>
            </div>
          )}

          {/* Transcription Preview */}
          <div className="p-4 rounded-xl bg-gray-100/50 dark:bg-gray-700/50 min-h-32">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {isRecording 
                ? "Patient presents with post-operative recovery on day 2. Incision site appears clean and dry, no signs of infection..."
                : "Tap the microphone to start dictating your clinical note. AI will automatically structure it into SOAP format."}
            </p>
          </div>
        </GlassCard>

        {/* Quick Templates */}
        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur text-left">
            <p className="font-medium text-gray-900 dark:text-white text-sm">Post-Op Note</p>
            <p className="text-xs text-gray-500 mt-1">Standard template</p>
          </button>
          <button className="p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur text-left">
            <p className="font-medium text-gray-900 dark:text-white text-sm">Ward Round</p>
            <p className="text-xs text-gray-500 mt-1">Daily assessment</p>
          </button>
        </div>
      </div>
    );
  };

  // Render current screen
  const renderScreen = () => {
    if (activeScreen === 'voice') return <VoiceScribeScreen />;
    
    switch(activeRole) {
      case 'doctor': return <DoctorHome />;
      case 'nurse': return <NurseHome />;
      case 'finance': return <FinanceHome />;
      case 'radiology': return <RadiologyHome />;
      default: return <DoctorHome />;
    }
  };

  const currentRole = roles[activeRole];
  const RoleIcon = currentRole.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      {/* Phone Frame */}
      <div className="max-w-md mx-auto">
        {/* Role Switcher */}
        <div className="mb-6">
          <div className="flex gap-2 p-2 rounded-2xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 shadow-xl">
            {Object.entries(roles).map(([key, role]) => {
              const Icon = role.icon;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveRole(key);
                    setActiveScreen('home');
                  }}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                    activeRole === key
                      ? `bg-gradient-to-br ${role.gradient} text-white shadow-lg`
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium">{role.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phone Screen */}
        <div className="relative">
          {/* Status Bar */}
          <div className="bg-gray-900 rounded-t-[2.5rem] px-6 pt-3 pb-2">
            <div className="flex items-center justify-between text-white text-xs">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-3 border border-white rounded-sm" />
                <div className="w-2 h-3 bg-white rounded-sm" />
              </div>
            </div>
          </div>

          {/* App Content */}
          <div className="bg-gradient-to-br from-blue-100/30 via-cyan-100/30 to-teal-100/30 dark:from-gray-800/30 dark:via-gray-700/30 dark:to-gray-800/30 px-4 pt-4 pb-24 min-h-[600px]">
            {renderScreen()}
          </div>

          {/* Bottom Navigation */}
          <div className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-b-[2.5rem] border-t border-white/20 shadow-2xl">
            <div className="flex items-center justify-around px-6 py-4">
              <button 
                onClick={() => setActiveScreen('home')}
                className={`flex flex-col items-center gap-1 ${activeScreen === 'home' ? `text-[${currentRole.color}]` : 'text-gray-400'}`}
              >
                <Home size={24} />
                <span className="text-xs">Home</span>
              </button>
              
              <button className="flex flex-col items-center gap-1 text-gray-400">
                <Users size={24} />
                <span className="text-xs">Patients</span>
              </button>
              
              <button 
                onClick={() => setActiveScreen('voice')}
                className={`-mt-8 p-4 rounded-full bg-gradient-to-br ${currentRole.gradient} text-white shadow-2xl`}
              >
                {activeRole === 'doctor' ? <Mic size={28} /> : <Plus size={28} />}
              </button>
              
              <button className="flex flex-col items-center gap-1 text-gray-400">
                <MessageSquare size={24} />
                <span className="text-xs">Messages</span>
              </button>
              
              <button className="flex flex-col items-center gap-1 text-gray-400">
                <User size={24} />
                <span className="text-xs">Profile</span>
              </button>
            </div>
            
            {/* Home Indicator */}
            <div className="flex justify-center pb-2">
              <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Design System Legend */}
      <div className="max-w-md mx-auto mt-8 p-6 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 border border-white/20 shadow-xl">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">MediCore Design System</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Visual Language</p>
            <p className="text-gray-600 dark:text-gray-400">Medical Glassmorphism · Translucent layers · Soft depth · Clinical precision</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Role Colors</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs">Doctor</span>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs">Nurse</span>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs">Finance</span>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs">Radiology</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Key Features</p>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li>• One-handed thumb zone navigation</li>
              <li>• Dark mode for night shifts</li>
              <li>• AI voice scribe integration</li>
              <li>• Real-time critical alerts</li>
              <li>• Offline-first sync capability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediCoreMobileDesign;
