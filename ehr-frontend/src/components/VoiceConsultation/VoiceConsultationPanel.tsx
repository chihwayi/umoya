import React, { useState } from 'react';
import { FileText, Mic, Save, Copy, Check, RefreshCw, X } from 'lucide-react';
import VoiceConsultationButton from './VoiceConsultationButton';
import { ExtractedEntities } from '../../services/medical-entity-extractor.service';

interface VoiceConsultationPanelProps {
  patientName: string;
  patientId: string;
  token: string;
  tenantSlug: string;
  onSave?: (note: any) => void;
  onClose?: () => void;
}

const VoiceConsultationPanel: React.FC<VoiceConsultationPanelProps> = ({
  patientName,
  patientId,
  token,
  tenantSlug,
  onSave,
  onClose,
}) => {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [soapNote, setSoapNote] = useState<any | null>(null);
  const [entities, setEntities] = useState<ExtractedEntities | null>(null);
  const [activeTab, setActiveTab] = useState<'soap' | 'transcription'>('soap');
  const [copied, setCopied] = useState(false);

  const handleTranscriptionComplete = (text: string, extractedEntities: ExtractedEntities, generatedSoapNote: any) => {
    setTranscription(text);
    setEntities(extractedEntities);
    setSoapNote(generatedSoapNote);
    if (generatedSoapNote) {
      setActiveTab('soap');
    } else {
      setActiveTab('transcription');
    }
  };

  const handleCopy = () => {
    const textToCopy = activeTab === 'soap' 
      ? JSON.stringify(soapNote, null, 2) // In a real app, format this better
      : transcription;
    
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        transcription,
        soapNote,
        entities
      });
    }
  };

  const renderSoapSection = (title: string, content: string) => (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">{title}</h4>
      <div className="bg-slate-50 p-3 rounded-lg text-slate-800 text-sm whitespace-pre-wrap border border-slate-200">
        {content || 'Not available'}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full max-h-[800px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Mic className="w-5 h-5" />
          <h3 className="font-semibold text-lg">Voice Consultation</h3>
        </div>
        <div className="flex items-center gap-2">
           <VoiceConsultationButton
            patientName={patientName}
            patientId={patientId}
            token={token}
            tenantSlug={tenantSlug}
            onTranscriptionComplete={handleTranscriptionComplete}
            onError={(err) => console.error(err)}
          />
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!transcription ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Mic className="w-8 h-8 text-indigo-400" />
            </div>
            <h4 className="text-lg font-semibold text-slate-900 mb-2">Ready to Record</h4>
            <p className="text-slate-500 max-w-sm">
              Start recording a consultation to automatically generate clinical notes and SOAP documentation.
              Supports English, Shona, and Ndebele.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('soap')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'soap'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                SOAP Note
              </button>
              <button
                onClick={() => setActiveTab('transcription')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'transcription'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Original Transcript
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'soap' && soapNote ? (
                <div className="space-y-2">
                  {renderSoapSection('Subjective', soapNote.subjective)}
                  {renderSoapSection('Objective', soapNote.objective)}
                  {renderSoapSection('Assessment', soapNote.assessment)}
                  {renderSoapSection('Plan', soapNote.plan)}
                </div>
              ) : activeTab === 'soap' && !soapNote ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <p>SOAP note generation failed or was not requested.</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {transcription}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500">
                {entities && Object.keys(entities).length > 0 && (
                  <span>
                    Detected: {Object.keys(entities).filter(k => (entities as any)[k]).length} entity types
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {onSave && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save Note
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceConsultationPanel;
