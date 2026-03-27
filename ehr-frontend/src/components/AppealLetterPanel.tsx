import React from 'react';
import { FileText, ExternalLink, CheckCircle } from 'lucide-react';

interface RagSource {
  documentId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
}

interface AppealLetterPanelProps {
  claimId: string;
  denialReasonCode: string;
  draftLetter: string;
  ragSources: RagSource[];
  onSubmit: () => void;
}

export const AppealLetterPanel: React.FC<AppealLetterPanelProps> = ({
  claimId,
  denialReasonCode,
  draftLetter,
  ragSources,
  onSubmit,
}) => {
  const [letter, setLetter] = React.useState(draftLetter);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit();
  };

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">AI-Generated Appeal Letter</h3>
        <span className="ml-auto text-xs text-gray-400">Claim: {claimId}</span>
      </div>

      {ragSources.length > 0 && (
        <div className="bg-blue-50 rounded p-3">
          <p className="text-xs font-medium text-blue-700 mb-2">Evidence used from knowledge base:</p>
          <ul className="space-y-1">
            {ragSources.map((s, i) => (
              <li key={i} className="text-xs text-blue-600 flex items-start gap-1">
                <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>{s.title}</strong> — {s.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Review and edit the appeal letter:
        </label>
        <textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          className="w-full h-64 text-sm font-mono border border-gray-200 rounded p-3"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          AI drafted. Clinician must review before submission.
        </span>
        {submitted ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Appeal submitted</span>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Submit Appeal
          </button>
        )}
      </div>
    </div>
  );
};
