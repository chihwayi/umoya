import React, { useState, useEffect } from 'react';
import {
  FileText, Save, X, Plus, Search, Filter, Clock, User,
  AlertTriangle, CheckCircle, Activity, Heart, Stethoscope
} from 'lucide-react';
import { ehrApi } from '../services/api.ts';
import { useNotification } from '../components/GlobalNotification.tsx';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface NursingNote {
  id: string;
  patientId: string;
  noteType: string;
  content: string;
  vitalSigns?: string;
  medications?: string;
  observations: string;
  interventions: string;
  outcomes: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
}

interface NursingNotesProps {
  patient?: Patient;
  appointments?: any[];
  onClose?: () => void;
  onSave?: () => void;
  preset?: 'care_plans' | 'medications';
}

const NursingNotes: React.FC<NursingNotesProps> = ({ patient, appointments = [], onClose, onSave, preset }) => {
  const { showSuccess, showError } = useNotification();
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showNewNote, setShowNewNote] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patient || null);
  const [allNotes, setAllNotes] = useState<NursingNote[]>([]);

  const [newNote, setNewNote] = useState({
    noteType: 'general',
    content: '',
    vitalSigns: '',
    medications: '',
    observations: '',
    interventions: '',
    outcomes: '',
    patientId: ''
  });

  // Apply preset behaviors
  useEffect(() => {
    if (!preset) return;
    if (preset === 'medications') {
      setShowNewNote(true);
      setNewNote(prev => ({ ...prev, noteType: 'intervention' }));
    }
    if (preset === 'care_plans') {
      setShowNewNote(true);
      setNewNote(prev => ({ ...prev, noteType: 'evaluation' }));
    }
  }, [preset]);

  useEffect(() => {
    if (selectedPatient) {
      fetchNursingNotes();
    } else {
      // If no specific patient, fetch all recent notes
      fetchAllNotes();
    }
  }, [selectedPatient]);

  const fetchAllNotes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) return;

      // Fetch notes for all patients with appointments today
      const allNotesPromises = appointments.map(async (apt) => {
        try {
          const response = await ehrApi.getNursingNotes(apt.patient.id, token, tenantSlug);
          return response.data.nursingNotes || [];
        } catch (error) {
          console.log(`No notes found for patient ${apt.patient.id}:`, error);
          return [];
        }
      });

      const allNotesResults = await Promise.all(allNotesPromises);
      const flattenedNotes = allNotesResults.flat();
      
      // Sort by most recent first
      const sortedNotes = flattenedNotes.sort((a, b) => 
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      
      setAllNotes(sortedNotes);
    } catch (error) {
      console.error('Error fetching all notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNursingNotes = async () => {
    if (!selectedPatient) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getNursingNotes(selectedPatient.id, token, tenantSlug);
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Error fetching nursing notes:', error);
      showError('Error', 'Failed to fetch nursing notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    const patientId = selectedPatient?.id || newNote.patientId;
    
    if (!patientId) {
      showError('Error', 'No patient selected');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const noteData = {
        patientId: patientId,
        noteType: newNote.noteType,
        content: newNote.content,
        vitalSigns: newNote.vitalSigns,
        medications: newNote.medications,
        observations: newNote.observations,
        interventions: newNote.interventions,
        outcomes: newNote.outcomes,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id
      };

      await ehrApi.recordNursingNote(noteData, token, tenantSlug);
      showSuccess('Success', 'Nursing note saved successfully');
      setShowNewNote(false);
      setNewNote({
        noteType: 'general',
        content: '',
        vitalSigns: '',
        medications: '',
        observations: '',
        interventions: '',
        outcomes: '',
        patientId: ''
      });
      
      // Refresh notes based on current view
      if (selectedPatient) {
        fetchNursingNotes();
      } else {
        fetchAllNotes();
      }
      onSave?.();
    } catch (error) {
      console.error('Error saving nursing note:', error);
      showError('Error', 'Failed to save nursing note');
    } finally {
      setLoading(false);
    }
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'assessment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'intervention': return 'bg-green-100 text-green-800 border-green-200';
      case 'evaluation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'general': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'assessment': return <Stethoscope className="w-4 h-4" />;
      case 'intervention': return <Activity className="w-4 h-4" />;
      case 'evaluation': return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.observations.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.interventions.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || note.noteType === filterType;
    return matchesSearch && matchesType;
  });

  const renderContent = () => {
    if (selectedPatient) {
      // Single patient nursing notes
      return (
        <div className="space-y-6">
          {/* Patient Header */}
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  {selectedPatient.firstName.charAt(0)}{selectedPatient.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <p className="text-slate-600">ID: {selectedPatient.patientNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
              >
                <X className="w-4 h-4" />
                Back to All Patients
              </button>
            </div>
          </div>

          {/* New Note Form */}
          {showNewNote && (
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">New Nursing Note</h4>
              </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Note Type</label>
                    <select
                      value={newNote.noteType}
                      onChange={(e) => setNewNote(prev => ({ ...prev, noteType: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="general">General Note</option>
                      <option value="assessment">Assessment</option>
                      <option value="intervention">Intervention</option>
                      <option value="evaluation">Evaluation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Note Content</label>
                  <textarea
                    value={newNote.content}
                    onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="Enter nursing note content..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Vital Signs</label>
                    <textarea
                      value={newNote.vitalSigns}
                      onChange={(e) => setNewNote(prev => ({ ...prev, vitalSigns: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      rows={2}
                      placeholder="Record vital signs..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Medications</label>
                    <textarea
                      value={newNote.medications}
                      onChange={(e) => setNewNote(prev => ({ ...prev, medications: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      rows={2}
                      placeholder={preset === 'medications' ? 'e.g., Paracetamol 1g PO q8h x5 days' : 'Record medications...'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Observations</label>
                  <textarea
                    value={newNote.observations}
                    onChange={(e) => setNewNote(prev => ({ ...prev, observations: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Record patient observations..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Interventions</label>
                  <textarea
                    value={newNote.interventions}
                    onChange={(e) => setNewNote(prev => ({ ...prev, interventions: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Record nursing interventions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Outcomes</label>
                  <textarea
                    value={newNote.outcomes}
                    onChange={(e) => setNewNote(prev => ({ ...prev, outcomes: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Record patient outcomes..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 mt-6">
                <button
                  onClick={() => setShowNewNote(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Note
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div key={note.id} className="bg-gradient-to-r from-white to-slate-50 rounded-xl p-6 border border-slate-200/50 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${getNoteTypeColor(note.noteType)}`}>
                      {getNoteTypeIcon(note.noteType)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 capitalize">{note.noteType} Note</h4>
                      <p className="text-sm text-slate-600">
                        {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)} • {note.recordedByName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {note.content && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Content</h5>
                      <p className="text-slate-600">{note.content}</p>
                    </div>
                  )}

                  {note.vitalSigns && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Vital Signs</h5>
                      <p className="text-slate-600">{note.vitalSigns}</p>
                    </div>
                  )}

                  {note.medications && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Medications</h5>
                      <p className="text-slate-600">{note.medications}</p>
                    </div>
                  )}

                  {note.observations && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Observations</h5>
                      <p className="text-slate-600">{note.observations}</p>
                    </div>
                  )}

                  {note.interventions && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Interventions</h5>
                      <p className="text-slate-600">{note.interventions}</p>
                    </div>
                  )}

                  {note.outcomes && (
                    <div>
                      <h5 className="text-sm font-semibold text-slate-700 mb-2">Outcomes</h5>
                      <p className="text-slate-600">{note.outcomes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!showNewNote && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowNewNote(true)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Note
              </button>
            </div>
          )}
        </div>
      );
    } else {
      // Nursing notes overview for all patients
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nursing Notes</h3>
            </div>
            
            <div className="space-y-6">
              {/* Today's Patients */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Today's Patients</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {appointments.map((apt) => (
                    <div 
                      key={apt.id}
                      onClick={() => setSelectedPatient(apt.patient)}
                      className="bg-white rounded-xl p-4 border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm group-hover:scale-105 transition-transform">
                          {apt.patient.firstName.charAt(0)}{apt.patient.lastName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-900 group-hover:text-pink-600 transition-colors">
                            {apt.patient.firstName} {apt.patient.lastName}
                          </h5>
                          <p className="text-sm text-slate-600">
                            {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Notes */}
              {allNotes.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-4">Recent Nursing Notes</h4>
                  <div className="space-y-3">
                    {allNotes.slice(0, 5).map((note) => (
                      <div key={note.id} className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            {getNoteTypeIcon(note.noteType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">
                                {note.patient?.firstName} {note.patient?.lastName}
                              </span>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                {note.noteType}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{note.content}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {formatDateTimeToDDMMYYYYHHMM(note.recordedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowNewNote(true)}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Plus className="w-5 h-5 text-pink-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">New Note</h5>
                      <p className="text-sm text-slate-600">Create a general note</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => { setShowNewNote(true); setNewNote(prev => ({ ...prev, noteType: 'assessment' })); }}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Stethoscope className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">Assessment</h5>
                      <p className="text-sm text-slate-600">Record patient assessment</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => { setShowNewNote(true); setNewNote(prev => ({ ...prev, noteType: 'intervention' })); }}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Activity className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-slate-900">Intervention</h5>
                      <p className="text-sm text-slate-600">Record care provided</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* New Note Form for General Notes */}
              {showNewNote && !selectedPatient && (
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">New Nursing Note</h4>
                    </div>
                    <button
                      onClick={() => setShowNewNote(false)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Note Type</label>
                        <select
                          value={newNote.noteType}
                          onChange={(e) => setNewNote(prev => ({ ...prev, noteType: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
                        >
                          <option value="general">General</option>
                          <option value="assessment">Assessment</option>
                          <option value="intervention">Intervention</option>
                          <option value="evaluation">Evaluation</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Patient</label>
                        <select
                          value={newNote.patientId || ''}
                          onChange={(e) => setNewNote(prev => ({ ...prev, patientId: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
                        >
                          <option value="">Select a patient</option>
                          {appointments.map((apt) => (
                            <option key={apt.id} value={apt.patient.id}>
                              {apt.patient.firstName} {apt.patient.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Note Content</label>
                      <textarea
                        value={newNote.content}
                        onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Enter your nursing note here..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors resize-none h-32"
                      />
                    </div>

                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => setShowNewNote(false)}
                        className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNote}
                        disabled={!newNote.patientId || !newNote.content}
                        className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
      
      {patient && onClose && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default NursingNotes;
