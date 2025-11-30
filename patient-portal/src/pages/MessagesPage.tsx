import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { MessageSquare, ArrowLeft, Send, Paperclip, AlertCircle, CheckCircle, Clock, User, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const MessagesPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  // Mock messages for now - will be replaced with actual API call
  useEffect(() => {
    setLoading(true);
    // Simulate loading
    setTimeout(() => {
      setMessages([
        {
          id: '1',
          subject: 'Appointment Reminder',
          message: 'This is a reminder that you have an appointment scheduled for tomorrow at 10:00 AM.',
          from: 'Dr. Sarah Johnson',
          fromRole: 'Doctor',
          date: new Date(),
          read: false,
          type: 'appointment',
        },
        {
          id: '2',
          subject: 'Lab Results Available',
          message: 'Your recent lab test results are now available. Please log in to view them.',
          from: 'Lab Department',
          fromRole: 'Staff',
          date: new Date(Date.now() - 86400000),
          read: true,
          type: 'lab_results',
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    // TODO: Implement actual API call
    alert('Message sending functionality will be implemented soon.');
    setNewMessage('');
  };

  const unreadCount = messages.filter(m => !m.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                <p className="text-sm text-gray-600">Communicate with your healthcare team</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {unreadCount} New
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
              <div className="p-4 border-b border-gray-200">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
                  <Plus className="w-5 h-5" />
                  New Message
                </button>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No messages yet</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => setSelectedMessage(message)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedMessage?.id === message.id ? 'bg-indigo-50' : ''
                      } ${!message.read ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          !message.read ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-semibold truncate ${!message.read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {message.from}
                            </p>
                            {!message.read && (
                              <div className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{message.subject}</p>
                          <p className="text-xs text-gray-600 truncate">{message.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(message.date), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            {selectedMessage ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedMessage.subject}</h2>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{selectedMessage.from}</span>
                        <span className="text-gray-400">•</span>
                        <span>{selectedMessage.fromRole}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedMessage.read ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedMessage.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(new Date(selectedMessage.date), 'EEEE, MMMM d, yyyy at h:mm a')}
                  </p>
                </div>
                <div className="p-6">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>
                <div className="p-6 border-t border-gray-200">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Message</h3>
                <p className="text-gray-600">Choose a message from the list to view its details</p>
              </div>
            )}

            {/* New Message Composer */}
            <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Send a Message</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To:</label>
                  <select className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm">
                    <option>Select recipient...</option>
                    <option>Dr. Sarah Johnson</option>
                    <option>Nurse Department</option>
                    <option>Lab Department</option>
                    <option>Billing Department</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject:</label>
                  <input
                    type="text"
                    placeholder="Message subject..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Message:</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm resize-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2 border border-gray-200">
                    <Paperclip className="w-4 h-4" />
                    <span>Attach</span>
                  </button>
                  <button
                    onClick={handleSendMessage}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;

