import React, { useState, useEffect } from 'react';
import { Mail, Search, Inbox as InboxIcon, Send, Archive, Trash2, Reply, Forward, MessageSquare, AlertCircle, Clock, User, Users, Filter, X, Paperclip, CheckCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { MessageComposer } from './MessageComposer';

interface InboxProps {
  onClose: () => void;
  onCompose: () => void;
  token: string;
  tenantSlug: string;
}

export const Inbox: React.FC<InboxProps> = ({ onClose, onCompose, token, tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'archived'>('inbox');
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    priority: '',
    message_type: '',
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [composerMode, setComposerMode] = useState<{ mode: 'reply' | 'forward'; message: any } | null>(null);

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
  }, [activeTab, filters]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      let response;
      
      if (activeTab === 'inbox') {
        response = await ehrApi.getInbox({ ...filters, limit: 50 }, token, tenantSlug);
      } else if (activeTab === 'sent') {
        response = await ehrApi.getSentMessages({ limit: 50 }, token, tenantSlug);
      } else {
        response = await ehrApi.getInbox({ status: 'archived', limit: 50 }, token, tenantSlug);
      }
      
      setMessages(response.data.messages || []);
    } catch (error: any) {
      if (error?.response?.status === 504) {
        setMessages([]);
        return;
      }
      console.error('Failed to load messages:', error);
      showError('Failed to load messages', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await ehrApi.getUnreadCount(token, tenantSlug);
      setUnreadCount(response.data.count || 0);
    } catch (error: any) {
      if (error?.response?.status === 504) {
        setUnreadCount(0);
        return;
      }
      console.error('Failed to load unread count:', error);
    }
  };

  const handleSelectMessage = async (message: any) => {
    try {
      const response = await ehrApi.getMessageById(message.id, token, tenantSlug);
      setSelectedMessage(response.data);
      
      // Mark as read if unread
      if (message.status === 'sent' || message.status === 'delivered') {
        await ehrApi.markMessageAsRead(message.id, token, tenantSlug);
        loadMessages();
        loadUnreadCount();
      }
    } catch (error: any) {
      showError('Failed to load message', error.message);
    }
  };

  const handleReply = () => {
    if (selectedMessage) {
      setComposerMode({ mode: 'reply', message: selectedMessage });
    }
  };

  const handleForward = () => {
    if (selectedMessage) {
      setComposerMode({ mode: 'forward', message: selectedMessage });
    }
  };

  const handleArchive = async () => {
    if (!selectedMessage) return;
    
    try {
      await ehrApi.archiveMessage(selectedMessage.id, token, tenantSlug);
      showSuccess('Message Archived', 'Message has been archived successfully');
      setSelectedMessage(null);
      loadMessages();
    } catch (error: any) {
      showError('Failed to archive message', error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    
    try {
      await ehrApi.deleteMessage(selectedMessage.id, token, tenantSlug);
      showSuccess('Message Deleted', 'Message has been deleted successfully');
      setSelectedMessage(null);
      loadMessages();
    } catch (error: any) {
      showError('Failed to delete message', error.message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMessages();
      return;
    }

    try {
      setLoading(true);
      const response = await ehrApi.searchMessages(searchQuery, token, tenantSlug);
      setMessages(response.data || []);
    } catch (error: any) {
      showError('Search failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100 border border-red-200';
      case 'high': return 'text-amber-700 bg-amber-100 border border-amber-200';
      case 'normal': return 'text-blue-700 bg-blue-100 border border-blue-200';
      case 'low': return 'text-slate-700 bg-slate-100 border border-slate-200';
      default: return 'text-slate-700 bg-slate-100 border border-slate-200';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckCircle className="w-4 h-4" />;
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      case 'critical_alert': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
      <div className="w-full max-w-7xl h-[90vh] flex flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-200/60 bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
          <div className="flex items-center gap-4">
            <Mail className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold">Messages</h2>
            {unreadCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-semibold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCompose}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <MessageSquare className="w-4 h-4" />
              Compose
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition hover:bg-white/20"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 px-6 pt-4 bg-white/65">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'inbox'
                ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <InboxIcon className="w-4 h-4" />
              Inbox
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'sent'
                ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Sent
            </div>
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === 'archived'
                ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Archived
            </div>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-200 bg-white/70 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 pl-10 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3">
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <select
                value={filters.message_type}
                onChange={(e) => setFilters({ ...filters, message_type: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">All Types</option>
                <option value="message">Message</option>
                <option value="task">Task</option>
                <option value="alert">Alert</option>
                <option value="critical_alert">Critical Alert</option>
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Message List */}
          <div className="w-2/5 border-r border-slate-200 overflow-y-auto bg-white/75">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-500">Loading messages...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Mail className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">No messages</p>
                <p className="text-sm">Your {activeTab} is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedMessage?.id === message.id
                        ? 'bg-blue-100/70 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50'
                    } ${
                      message.status === 'sent' || message.status === 'delivered'
                        ? 'bg-blue-50/40'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getMessageTypeIcon(message.message_type)}
                        <span className={`font-semibold text-sm truncate ${
                          message.status === 'sent' || message.status === 'delivered'
                            ? 'text-slate-900'
                            : 'text-slate-600'
                        }`}>
                          {activeTab === 'sent' ? message.recipient_name : message.sender_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                        {formatDate(message.sent_at)}
                      </span>
                    </div>
                    <div className="mb-2">
                      <p className={`text-sm truncate ${
                        message.status === 'sent' || message.status === 'delivered'
                          ? 'font-semibold text-slate-900'
                          : 'text-slate-700'
                      }`}>
                        {message.subject}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-1">
                        {message.message_text}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(message.priority)}`}>
                        {message.priority}
                      </span>
                      {message.patient_name && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {message.patient_name}
                        </span>
                      )}
                      {message.attachment_count > 0 && (
                        <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {message.attachment_count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Detail */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-white via-slate-50/80 to-blue-50/60">
            {selectedMessage ? (
              <div className="p-6">
                {/* Message Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        {selectedMessage.subject}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>From: {selectedMessage.sender_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(selectedMessage.sent_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleReply}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Reply"
                      >
                          <Reply className="w-5 h-5 text-slate-600" />
                      </button>
                      <button
                        onClick={handleForward}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Forward"
                      >
                          <Forward className="w-5 h-5 text-slate-600" />
                      </button>
                      <button
                        onClick={handleArchive}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Archive"
                      >
                          <Archive className="w-5 h-5 text-slate-600" />
                      </button>
                      <button
                        onClick={handleDelete}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 text-sm font-medium rounded ${getPriorityColor(selectedMessage.priority)}`}>
                      {selectedMessage.priority}
                    </span>
                    <span className="px-3 py-1 text-sm bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      {selectedMessage.message_type}
                    </span>
                    {selectedMessage.patient_name && (
                      <span className="px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Patient: {selectedMessage.patient_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Body */}
                  <div className="bg-white/80 border border-slate-200 rounded-lg p-4 mb-6">
                  <p className="text-slate-800 whitespace-pre-wrap">{selectedMessage.message_text}</p>
                </div>

                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments ({selectedMessage.attachments.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((attachment: any) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 bg-white/80 border border-slate-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{attachment.file_name}</span>
                            <span className="text-xs text-slate-500">
                              ({Math.round(attachment.file_size / 1024)} KB)
                            </span>
                          </div>
                          <button className="text-sm text-blue-700 hover:text-blue-800 font-medium">
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Read Receipts */}
                {selectedMessage.read_receipts && selectedMessage.read_receipts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Read Receipts</h4>
                    <div className="space-y-2">
                      {selectedMessage.read_receipts.map((receipt: any) => (
                        <div key={receipt.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>{receipt.reader_name}</span>
                          <span className="text-slate-400">•</span>
                          <span>{new Date(receipt.read_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Select a message</p>
                  <p className="text-sm">Choose a message to view its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {composerMode && (
        <MessageComposer
          token={token}
          tenantSlug={tenantSlug}
          replyTo={composerMode.mode === 'reply' ? composerMode.message : undefined}
          forwardOf={composerMode.mode === 'forward' ? composerMode.message : undefined}
          onClose={() => setComposerMode(null)}
          onSent={() => { setComposerMode(null); loadMessages(); loadUnreadCount(); }}
        />
      )}
    </div>
  );
};
