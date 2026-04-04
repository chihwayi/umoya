import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  User,
  Clock,
  AlertCircle,
  X,
  Monitor,
  Settings,
  Brain,
  BookOpen,
  RefreshCw,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import GuidelineCitationCard from '../components/GuidelineCitationCard';
import { useConfirmation } from '../hooks/useConfirmation';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';

const TelemedicineConsultationPage: React.FC = () => {
  const { tenantSlug, consultationId } = useParams<{ tenantSlug: string; consultationId: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { confirm, Dialog } = useConfirmation();

  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [endingConsultation, setEndingConsultation] = useState(false);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);
  const currentUser = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('ehr_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (consultationId && tenantSlug && token) {
      loadConsultation();
    }
  }, [consultationId, tenantSlug, token]);

  const loadConsultation = async () => {
    try {
      setLoading(true);
      const consultationData = await ehrApi.getTelemedicineConsultation(consultationId!, token, tenantSlug!);
      setConsultation(consultationData.data);

      // Get meeting URL
      const meetingInfo = await ehrApi.getTelemedicineMeetingUrl(consultationId!, token, tenantSlug!);
      setMeetingUrl(meetingInfo.data.meeting_url || meetingInfo.data.meetingUrl || '');
    } catch (error: any) {
      showError('Failed to load consultation', error.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinConsultation = async () => {
    const userId = currentUser?.id || currentUser?.userId || currentUser?.sub;
    if (!userId) {
      showError('Failed to join consultation', 'Missing current user ID. Please sign in again.');
      return;
    }
    try {
      await ehrApi.joinTelemedicineConsultation(consultationId!, { role: 'doctor', userId }, token, tenantSlug!);
      setIsJoined(true);
      showSuccess('Joined consultation', 'You are now in the video call');
      
      // Update consultation status to in_progress
      await ehrApi.updateTelemedicineConsultation(consultationId!, { status: 'in_progress' }, token, tenantSlug!);
    } catch (error: any) {
      showError('Failed to join consultation', error.response?.data?.message || 'Please try again');
    }
  };

  const buildPostVisitUrl = () => {
    const params = new URLSearchParams();
    if (consultation?.patient_id) params.set('patientId', consultation.patient_id);
    if (consultation?.appointment_id) params.set('appointmentId', consultation.appointment_id);
    if (consultation?.id) params.set('consultationId', consultation.id);
    params.set('sourceType', 'telemedicine');
    return `/ehr/${tenantSlug}/post-visit/doctor?${params.toString()}`;
  };

  const handleEndConsultation = async (openPostVisit = false) => {
    const shouldProceed = await confirm({
      title: 'End Consultation',
      message: 'Are you sure you want to end this consultation?',
      confirmText: openPostVisit ? 'End & Open PostVisitAI' : 'End Consultation',
      cancelText: 'Continue Call',
      type: 'warning',
    });
    if (!shouldProceed) return;
    setEndingConsultation(true);
    try {
      if (consultation?.status !== 'completed') {
        await ehrApi.endTelemedicineConsultation(consultationId!, token, tenantSlug!);
      }
      showSuccess(
        'Consultation ended',
        openPostVisit ? 'Opening PostVisitAI workspace...' : 'Returning to dashboard...',
      );
      navigate(openPostVisit ? buildPostVisitUrl() : `/ehr/${tenantSlug}/telemedicine`);
    } catch (error: any) {
      showError('Failed to end consultation', error.response?.data?.message || 'Please try again');
    } finally {
      setEndingConsultation(false);
    }
  };

  const handleEndAndOpenPostVisit = async () => {
    await handleEndConsultation(true);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Video className="w-16 h-16 text-purple-400 animate-pulse mx-auto mb-4" />
          <p className="text-white/60">Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-white/10">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Consultation Not Found</h2>
          <p className="text-white/60 mb-6">The consultation you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/telemedicine`)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Back to Telemedicine Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {Dialog}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/telemedicine`)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Video className="w-6 h-6 text-purple-400" />
                  Video Consultation
                </h1>
                <p className="text-sm text-white/60">
                  {consultation.patient_name || 'Patient'} • {consultation.doctor_name || 'Doctor'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  showGuidelineSearch ? 'bg-purple-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle AI Assistant"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">AI Assistant</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10">
                <Monitor className="w-4 h-4" />
                <span className="text-sm capitalize">{connectionQuality}</span>
              </div>
              <button
                onClick={() => handleEndConsultation(false)}
                disabled={endingConsultation}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                {endingConsultation ? 'Ending...' : 'End Call'}
              </button>
              <button
                onClick={handleEndAndOpenPostVisit}
                disabled={endingConsultation}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                End + PostVisitAI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        <div className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${showGuidelineSearch ? 'pr-96' : ''}`}>
        {!isJoined ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-white/10">
              <Video className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Start?</h2>
              <p className="text-white/60 mb-6">
                Join the video consultation with {consultation.patient_name || 'the patient'}
              </p>
              {meetingUrl && (
                <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-white/60 mb-2">Meeting URL:</p>
                  <p className="text-xs text-white/40 font-mono break-all">{meetingUrl}</p>
                </div>
              )}
              <button
                onClick={handleJoinConsultation}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                Join Video Call
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Video Container */}
            <div className="relative bg-black rounded-2xl overflow-hidden border border-white/10" style={{ aspectRatio: '16/9' }}>
              {/* Placeholder for video - In production, this would integrate with Daily.co, Twilio, or similar */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-slate-900">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                    <User className="w-16 h-16 text-white/60" />
                  </div>
                  <p className="text-white/60 text-lg">{consultation.patient_name || 'Patient'}</p>
                  <p className="text-white/40 text-sm mt-2">Video feed will appear here</p>
                </div>
              </div>

              {/* Local Video (Doctor) - Top Right */}
              <div className="absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-900 border-2 border-white/20">
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-white/60" />
                </div>
              </div>

              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`p-3 rounded-full transition-colors ${
                      isAudioEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleEndConsultation(false)}
                    disabled={endingConsultation}
                    className="p-3 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Consultation Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white/60">Patient</span>
                </div>
                <p className="text-lg font-bold">{consultation.patient_name || 'Unknown'}</p>
                <p className="text-sm text-white/60">{consultation.patient_number || ''}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white/60">Status</span>
                </div>
                <p className="text-lg font-bold capitalize">{consultation.status || 'scheduled'}</p>
                <p className="text-sm text-white/60">
                  {consultation.scheduled_start_time
                    ? new Date(consultation.scheduled_start_time).toLocaleString()
                    : 'Not scheduled'}
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white/60">Connection</span>
                </div>
                <p className="text-lg font-bold capitalize">{connectionQuality}</p>
                <p className="text-sm text-white/60">
                  {isVideoEnabled && isAudioEnabled ? 'Video & Audio' : isAudioEnabled ? 'Audio Only' : 'Muted'}
                </p>
              </div>
            </div>

            {/* Note: In production, integrate with Daily.co, Twilio Video, or similar service */}
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Video Integration Required</p>
                  <p className="text-xs text-white/60 mt-1">
                    This is a placeholder interface. To enable video calls, integrate with Daily.co, Twilio Video, or
                    another HIPAA-compliant video provider. The backend APIs are ready and the meeting URL is available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* AI Assistant Sidebar */}
        <div className={`fixed right-0 top-[73px] bottom-0 w-96 bg-slate-900 border-l border-white/10 transform transition-transform duration-300 ease-in-out z-50 ${showGuidelineSearch ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Brain className="w-5 h-5 text-purple-400" />
                AI Assistant
              </h3>
              <button
                onClick={() => setShowGuidelineSearch(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-white/10 bg-slate-800/50 flex-1 overflow-y-auto">
              <GuidelineSearchPanel
                searchFn={(q) => cdssApi.searchGuidelines(`Telemedicine: ${q}`, token, tenantSlug!)}
                contextLabel="Telemedicine"
                className="bg-slate-900 border-white/10"
              />
            </div>
          </div>
        </div>
      </div>

      </div>
    </>
  );
};

export default TelemedicineConsultationPage;
