import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { fuzzyFilter } from '../utils/fuzzySearch';
import { buildCommandRegistry, requiresConfirmation, CommandAction } from '../utils/commandPaletteActions';
import { cdssApi } from '../services/api';

interface CommandPaletteProps {
  tenantSlug?: string;
}

interface ClinicalResult {
  type: 'clinical';
  title: string;
  summary: string;
  citations?: Array<{
    source: string;
    page?: number;
    relevance?: number;
  }>;
}

type SearchResult = CommandAction | ClinicalResult;

export const CommandPalette: React.FC<CommandPaletteProps> = ({ tenantSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isClinicalMode, setIsClinicalMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<CommandAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get user data for role-specific actions
  const storedUser = React.useMemo(() => {
    const raw = localStorage.getItem('ehr_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const userRole = storedUser?.role || '';
  const token = localStorage.getItem('ehr_token') || localStorage.getItem('token') || '';

  // Build action registry
  const actionRegistry = React.useMemo(() => {
    if (!tenantSlug) return [];
    return buildCommandRegistry(tenantSlug, userRole);
  }, [tenantSlug, userRole]);

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search clinical guidelines
  const searchClinicalGuidelines = useCallback(
    async (query: string) => {
      if (!query.trim() || !tenantSlug) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await cdssApi.searchGuidelines(query, token, tenantSlug, 3);
        // Real shape (services/cdss-service/main.py search_guidelines): a single
        // { query, citations: [...], analysis, count, governed_corpus_used } object —
        // NOT a `results` array and NOT a `recommendation` field. Each citation has
        // `source`/`confidence`/`metadata.page`, not `relevance`/`page` directly.
        const data = response.data as {
          citations?: Array<{
            source?: string;
            confidence?: number | null;
            metadata?: { source?: string; page?: number };
          }>;
          analysis?: string | null;
          count?: number;
        };

        const citations = (data.citations || []).map((c) => ({
          // c.source is often already "<file>.pdf (p.N)" — prefer the clean
          // filename from metadata.source and let the page render separately,
          // to avoid "<file>.pdf (p.30), p.30" duplication in the UI.
          source: c.metadata?.source || c.source || 'Unknown source',
          page: c.metadata?.page,
          relevance: typeof c.confidence === 'number' ? c.confidence : undefined,
        }));

        const clinicalResults: ClinicalResult[] =
          citations.length > 0 || data.analysis
            ? [
                {
                  type: 'clinical',
                  title: `Clinical guideline search: "${query}"`,
                  summary: data.analysis || 'No analysis available — see citations below.',
                  citations,
                },
              ]
            : [];

        setResults(clinicalResults);
        setSelectedIndex(0);
        if (clinicalResults.length === 0) {
          setError('No matching guidance found for this query.');
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to search guidelines';
        setError(msg);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [tenantSlug, token]
  );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedIndex(0);
    setIsClinicalMode(false);
    setError(null);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    // Check if this is a clinical question (longer, descriptive queries)
    const isClinicalQuery = value.length > 10 && value.includes(' ');

    if (isClinicalQuery) {
      // Debounce clinical search slightly (250ms) to avoid overwhelming the server
      const timer = setTimeout(() => {
        setIsClinicalMode(true);
        searchClinicalGuidelines(value);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      // Regular command filtering
      const matches = fuzzyFilter(actionRegistry, value, ['label', 'description', 'keywords']);
      setResults(matches.map((m) => m.item));
    }
  };

  // Execute action
  const executeAction = (action: CommandAction) => {
    if (requiresConfirmation(action.id)) {
      setConfirmingAction(action);
      return;
    }

    try {
      action.handler({
        navigate,
        tenantSlug,
        token,
      });
      setIsOpen(false);
      setSearchQuery('');
    } catch (err) {
      console.error('Command execution failed:', err);
      setError('Command failed to execute');
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected && 'handler' in selected) {
        executeAction(selected as CommandAction);
      }
    }
  };

  if (!isOpen) return null;
  if (!tenantSlug) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none">
        <div className="w-full max-w-2xl mx-4 pointer-events-auto">
          {/* Search Input Section */}
          <div className="bg-slate-900 rounded-lg shadow-2xl border border-slate-700">
            <div className="flex items-center px-4 py-3 border-b border-slate-700">
              <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder={isClinicalMode ? 'Ask a clinical question...' : 'Search commands...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-lg"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="px-4 py-6 text-center">
                <div className="inline-block">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <p className="text-slate-400 text-sm mt-2">Searching guidelines...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="px-4 py-3 bg-red-900/20 border-t border-slate-700 text-red-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Results List */}
            {!isLoading && results.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                {results.map((result, idx) => {
                  const isSelected = idx === selectedIndex;

                  if ('handler' in result) {
                    // Command Action
                    const action = result as CommandAction;
                    return (
                      <button
                        key={action.id}
                        onClick={() => executeAction(action)}
                        className={`w-full px-4 py-3 text-left border-t border-slate-700 first:border-t-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600/20 text-blue-100'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{action.label}</div>
                            {action.description && (
                              <div className="text-xs text-slate-400 mt-1">{action.description}</div>
                            )}
                          </div>
                          {isSelected && (
                            <ChevronRight className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    );
                  } else {
                    // Clinical Result
                    const clinical = result as ClinicalResult;
                    return (
                      <div
                        key={`clinical-${idx}`}
                        className={`px-4 py-3 border-t border-slate-700 first:border-t-0 transition-colors ${
                          isSelected ? 'bg-blue-600/20' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-100 mb-1">
                          {clinical.title}
                        </div>
                        <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                          {clinical.summary}
                        </p>

                        {/* Citations */}
                        {clinical.citations && clinical.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-700/50">
                            <div className="text-xs font-semibold text-slate-300 mb-1">
                              Sources:
                            </div>
                            <ul className="space-y-1">
                              {clinical.citations.map((citation, cidx) => (
                                <li key={cidx} className="text-xs text-blue-300">
                                  {citation.source}
                                  {citation.page ? `, p.${citation.page}` : ''}
                                  {citation.relevance ? ` (${Math.round(citation.relevance * 100)}%)` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && searchQuery && results.length === 0 && !error && (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                {isClinicalMode
                  ? 'No guidelines found. Try rephrasing your question.'
                  : 'No commands found. Try a different search.'}
              </div>
            )}

            {/* Initial State */}
            {!searchQuery && results.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                <p className="mb-2">Start typing to search for commands or ask a clinical question.</p>
                <p className="text-xs text-slate-600">Press ESC to close</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Confirm Action
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Are you sure you want to execute "{confirmingAction.label}"?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmingAction(null)}
                className="px-4 py-2 rounded text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    confirmingAction.handler({
                      navigate,
                      tenantSlug,
                      token,
                    });
                    setIsOpen(false);
                    setSearchQuery('');
                    setConfirmingAction(null);
                  } catch (err) {
                    console.error('Action execution failed:', err);
                    setError('Action failed to execute');
                    setConfirmingAction(null);
                  }
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
