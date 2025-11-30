import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Video, Phone, Mic, MicOff, VideoOff, X, AlertCircle, CheckCircle, User, Clock } from 'lucide-react';

const TelemedicinePage: React.FC = () => {
  const { consultationId } = useParams<{ consultationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';

  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meetingUrl, setMeetingUrl] = useState(searchParams.get('url') || '');
  const [meetingPassword, setMeetingPassword] = useState(searchParams.get('password') || '');
  
  // Video controls
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (consultationId) {
      loadConsultation();
    }
  }, [consultationId]);

  const loadConsultation = async () => {
    try {
      setLoading(true);
      // Get consultation details directly by consultation ID
      const consultationData = await patientPortalApi.getConsultation(consultationId!, token!, tenantSlug);
      setConsultation(consultationData);

      // Get meeting URL if not provided
      if (!meetingUrl && consultationData.id) {
        const meetingInfo = await patientPortalApi.getMeetingUrl(consultationData.id, token!, tenantSlug);
        setMeetingUrl(meetingInfo.meetingUrl);
        setMeetingPassword(meetingInfo.meetingPassword || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load consultation');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    try {
      if (!consultationId) return;

      // Join consultation
      await patientPortalApi.joinConsultation(consultationId, token!, tenantSlug);
      setIsJoined(true);

      // In a real implementation, this would initialize the video SDK (Daily.co, Twilio, etc.)
      // For now, we'll show a placeholder with the meeting URL
    } catch (err: any) {
      setError(err.message || 'Failed to join consultation');
    }
  };

  const handleEndCall = async () => {
    if (window.confirm('Are you sure you want to end this consultation?')) {
      navigate('/appointments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <div className="text-center">
          <Video className="w-16 h-16 text-purple-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/appointments')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Back to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Video Consultation</h1>
                {consultation?.doctor_name && (
                  <p className="text-sm text-purple-200">Dr. {consultation.doctor_name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleEndCall}
              className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isJoined ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Video className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Ready to Start?</h2>
                <p className="text-purple-200">Your video consultation is ready to begin</p>
              </div>

              {consultation && (
                <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-white">
                      <User className="w-5 h-5 text-purple-300" />
                      <div>
                        <p className="text-sm text-purple-200">Doctor</p>
                        <p className="font-semibold">{consultation.doctor_name || 'Dr. Provider'}</p>
                      </div>
                    </div>
                    {consultation.scheduled_start_time && (
                      <div className="flex items-center gap-3 text-white">
                        <Clock className="w-5 h-5 text-purple-300" />
                        <div>
                          <p className="text-sm text-purple-200">Scheduled Time</p>
                          <p className="font-semibold">
                            {new Date(consultation.scheduled_start_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Before joining:</p>
                    <ul className="list-disc list-inside space-y-1 text-yellow-700">
                      <li>Ensure you have a stable internet connection</li>
                      <li>Find a quiet, private location</li>
                      <li>Test your camera and microphone</li>
                      <li>Have your ID ready if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleJoinMeeting}
                className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold text-lg shadow-xl hover:shadow-2xl flex items-center justify-center gap-3"
              >
                <Video className="w-6 h-6" />
                Join Video Consultation
              </button>

              {meetingUrl && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-purple-200 mb-2">Or use this link:</p>
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-300 hover:text-white underline text-sm break-all"
                  >
                    {meetingUrl}
                  </a>
                  {meetingPassword && (
                    <p className="text-xs text-purple-300 mt-2">Password: {meetingPassword}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Video Call Interface */}
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/10">
              {/* Video Area */}
              <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-black">
                {/* Remote Video (Doctor) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-white text-lg font-semibold">
                      {consultation?.doctor_name || 'Dr. Provider'}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">Waiting for doctor to join...</p>
                  </div>
                </div>

                {/* Local Video (Patient) - Picture in Picture */}
                <div className="absolute bottom-4 right-4 w-48 h-36 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-white/20 overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white text-xs">You</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-black/70 backdrop-blur-sm border-t border-white/10 p-6">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isAudioEnabled
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isVideoEnabled
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all shadow-lg"
                  >
                    <Phone className="w-7 h-7 text-white rotate-[135deg]" />
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-white/70 text-sm">
                    {isJoined ? 'Connected' : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Meeting Info */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-white font-semibold mb-4">Consultation Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-purple-200">Doctor</p>
                  <p className="text-white font-semibold">{consultation?.doctor_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-purple-200">Status</p>
                  <p className="text-white font-semibold capitalize">
                    {consultation?.status || 'in_progress'}
                  </p>
                </div>
                {meetingUrl && (
                  <div className="sm:col-span-2">
                    <p className="text-purple-200">Meeting URL</p>
                    <p className="text-white break-all">{meetingUrl}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Note about video provider integration */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Video Provider Integration</p>
                  <p>
                    This is a placeholder interface. In production, this would integrate with Daily.co, Twilio Video, or another HIPAA-compliant video provider for actual video streaming.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TelemedicinePage;

