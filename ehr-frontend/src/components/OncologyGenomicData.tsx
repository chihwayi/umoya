import React from 'react';
import { Dna, FlaskRound, Loader2, Plus, Sparkles, Target, X } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const OncologyGenomicData: React.FC<Props> = ({ tenantSlug, token, caseId }) => {
  const { showError, showSuccess } = useNotification();
  const [records, setRecords] = React.useState<any[]>([]);
  const [recommendations, setRecommendations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    pathologyId: '',
    genomicDataText: '',
  });

  const loadData = React.useCallback(async () => {
    if (!tenantSlug || !token || !caseId) return;
    setLoading(true);
    try {
      const [genomicResp, therapyResp] = await Promise.all([
        ehrApi.getOncologyGenomicSummary(tenantSlug, token, caseId),
        ehrApi.getOncologyTargetedTherapies(tenantSlug, token, caseId),
      ]);
      setRecords(Array.isArray(genomicResp.data) ? genomicResp.data : []);
      setRecommendations(Array.isArray(therapyResp.data) ? therapyResp.data : []);
    } catch (error) {
      console.error('Failed to load genomic data', error);
      showError('Unable to load genomic summary', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !token) return;
    let genomicData: Record<string, any>;
    try {
      genomicData = form.genomicDataText ? JSON.parse(form.genomicDataText) : {};
    } catch (error) {
      showError('Invalid genomic JSON', 'Please provide valid JSON payload.');
      return;
    }
    if (!form.pathologyId) {
      showError('Pathology selection required', 'Provide a pathology ID linked to this case.');
      return;
    }

    setSaving(true);
    try {
      await ehrApi.recordOncologyGenomicData(tenantSlug, token, caseId, {
        pathologyId: form.pathologyId,
        genomicData,
      });
      showSuccess('Genomic data stored', 'Precision medicine record updated.');
      setForm({ pathologyId: '', genomicDataText: '' });
      setFormOpen(false);
      await loadData();
    } catch (error) {
      console.error('Failed to save genomic data', error);
      showError('Unable to save genomic data', 'Verify the inputs and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Genomics & Precision Therapy</h3>
          <p className="text-xs text-slate-500">Biomarkers, genomic annotations, and targeted therapy suggestions.</p>
        </div>
        <button
          onClick={() => setFormOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {formOpen ? 'Close' : 'Add Genomic Data'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <label className="text-xs text-slate-600 block">
            Pathology record ID
            <input
              type="text"
              name="pathologyId"
              value={form.pathologyId}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="UUID of pathology entry"
              required
            />
          </label>
          <label className="text-xs text-slate-600 block">
            Genomic data JSON
            <textarea
              name="genomicDataText"
              value={form.genomicDataText}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              rows={5}
              placeholder='{"HER2": "positive", "PD-L1": "60%"}'
              required
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Genomics'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading genomic data...
        </div>
      ) : records.length ? (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="border border-slate-200 rounded-xl bg-white p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">Specimen {record.histology_type ?? 'n/a'}</span>
                <span className="text-xs text-slate-500">
                  {record.specimen_date ? format(new Date(record.specimen_date), 'dd MMM yyyy') : 'Date n/a'}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <FlaskRound className="w-3.5 h-3.5 text-sky-500" />
                Biomarkers: {record.biomarkers ? Object.keys(record.biomarkers).length : 0} captured
              </p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2 whitespace-pre-wrap">
                {JSON.stringify(record.genomic_data ?? {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4 text-center">
          No genomic data recorded. Upload molecular/NGS data to enable targeted therapy suggestions.
        </div>
      )}

      {recommendations.length ? (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-500" />
            <p className="text-sm font-semibold text-slate-800">Suggested targeted therapies</p>
          </div>
          <div className="grid gap-2">
            {recommendations.map((rec, idx) => (
              <div key={`${rec.biomarker}-${idx}`} className="border border-rose-100 bg-rose-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-rose-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {rec.therapy}
                </p>
                <p className="text-xs text-rose-700">Biomarker: {rec.biomarker}</p>
                <p className="text-xs text-rose-600 mt-1">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OncologyGenomicData;



