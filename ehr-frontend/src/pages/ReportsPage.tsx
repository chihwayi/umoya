import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Download,
  RefreshCw,
  BarChart3,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { exportReportToCSV, exportReportToPDF, ReportColumn } from '../utils/reportExport';

type ReportKind = 'lab' | 'referral' | 'immunization' | 'mortality' | 'tax';

const REPORT_LABELS: Record<ReportKind, string> = {
  lab: 'Lab results',
  referral: 'Referrals',
  immunization: 'Immunization coverage',
  mortality: 'Mortality / quality',
  tax: 'Tax report',
};

/** Role-based report access: doctor sees all clinical (doctor + nurse); nurse sees nurse-only; accounts sees finance; admin sees all. */
const ALLOWED_REPORT_KINDS_BY_ROLE: Record<string, ReportKind[]> = {
  admin: ['lab', 'referral', 'immunization', 'mortality', 'tax'],
  doctor: ['lab', 'referral', 'immunization', 'mortality'],
  nurse: ['lab', 'immunization'],
  nurse_accounts: ['lab', 'immunization'],
  accounts: ['tax'],
  receptionist: [],
};

function getAllowedReportKinds(role: string | undefined): ReportKind[] {
  if (!role) return [];
  return ALLOWED_REPORT_KINDS_BY_ROLE[role] ?? [];
}

const ReportsPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('ehr_token') || '' : ''), []);

  const userRole = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem('ehr_user');
      return raw ? (JSON.parse(raw) as { role?: string })?.role ?? '' : '';
    } catch {
      return '';
    }
  }, []);

  const allowedKinds = useMemo(() => getAllowedReportKinds(userRole), [userRole]);
  const defaultKind = allowedKinds[0];

  const [reportKind, setReportKind] = useState<ReportKind>(defaultKind || 'lab');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payeTaxPeriod, setPayeTaxPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Keep reportKind in sync with allowed kinds (e.g. after role change or if invalid)
  React.useEffect(() => {
    if (allowedKinds.length === 0) return;
    if (!allowedKinds.includes(reportKind)) {
      setReportKind(allowedKinds[0]);
      setData(null);
    }
  }, [allowedKinds, reportKind]);

  const loadReport = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    setData(null);
    try {
      switch (reportKind) {
        case 'lab': {
          const res = await ehrApi.getLabResultsReport(tenantSlug, token, {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          setData(res.data);
          break;
        }
        case 'referral': {
          const res = await ehrApi.getReferralReport(tenantSlug, token, {
            dateFrom: startDate || undefined,
            dateTo: endDate || undefined,
          });
          setData(res.data);
          break;
        }
        case 'immunization': {
          const res = await ehrApi.getImmunizationCoverageReport(tenantSlug, token, {
            periodStart: startDate || undefined,
            periodEnd: endDate || undefined,
          });
          setData(res.data);
          break;
        }
        case 'mortality': {
          const res = await ehrApi.getMortalityReport(tenantSlug, token, {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          setData(res.data);
          break;
        }
        case 'tax': {
          if (!startDate || !endDate) {
            showError('Dates required', 'Start and end date are required for tax report.');
            return;
          }
          const res = await ehrApi.getTaxReport(tenantSlug, token, {
            startDate,
            endDate,
            payeTaxPeriod: payeTaxPeriod || undefined,
          });
          setData(res.data);
          break;
        }
      }
    } catch (err: any) {
      showError('Report failed', err.response?.data?.message || err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const { rows, columns, title, subtitle } = getExportData();
    if (rows.length === 0) {
      showError('No data', 'No rows to export. Generate the report first.');
      return;
    }
    exportReportToCSV(title, rows, columns);
    showSuccess('Exported', 'CSV download started.');
  };

  const handleExportPDF = () => {
    if (!data) return;
    const { rows, columns, title, subtitle } = getExportData();
    exportReportToPDF(title, subtitle, rows, columns);
    showSuccess('Exported', 'PDF download started.');
  };

  function getExportData(): {
    rows: Record<string, unknown>[];
    columns: ReportColumn[];
    title: string;
    subtitle?: string;
  } {
    const title = REPORT_LABELS[reportKind];
    const periodSub = [startDate, endDate].filter(Boolean).length
      ? `Period: ${startDate || '…'} – ${endDate || '…'}`
      : undefined;

    switch (reportKind) {
      case 'lab': {
        const rows = (data?.labOrders || []).slice(0, 200).map((o: any) => ({
          id: o.id,
          patient: o.patient?.patient_number || o.patientId || '',
          status: o.status,
          createdAt: o.createdAt,
          reviewedAt: o.reviewedAt || '',
        }));
        return {
          rows,
          columns: [
            { key: 'id', label: 'Order ID' },
            { key: 'patient', label: 'Patient' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Created' },
            { key: 'reviewedAt', label: 'Reviewed' },
          ],
          title: 'Lab Results Report',
          subtitle: periodSub || `Total: ${data?.total ?? 0}; Turnaround: ${data?.turnaroundTime?.average ?? 'N/A'}`,
        };
      }
      case 'referral': {
        const byType = (data?.byType || []).map((r: any) => ({
          category: 'Type',
          name: r.referral_type || '',
          count: r.count,
        }));
        const bySpec = (data?.bySpecialty || []).map((r: any) => ({
          category: 'Specialty',
          name: r.specialty || '',
          count: r.count,
        }));
        const rows = [...byType, ...bySpec];
        return {
          rows,
          columns: [
            { key: 'category', label: 'Category' },
            { key: 'name', label: 'Name' },
            { key: 'count', label: 'Count' },
          ],
          title: 'Referral Report',
          subtitle: periodSub,
        };
      }
      case 'immunization': {
        const rows = (data?.byAntigen || []).map((r: any) => ({
          vaccineCode: r.vaccineCode,
          vaccineName: r.vaccineName,
          doses: r.doses,
          uniquePatients: r.uniquePatients,
        }));
        return {
          rows,
          columns: [
            { key: 'vaccineCode', label: 'Vaccine code' },
            { key: 'vaccineName', label: 'Vaccine name' },
            { key: 'doses', label: 'Doses' },
            { key: 'uniquePatients', label: 'Unique patients' },
          ],
          title: 'Immunization Coverage Report',
          subtitle: periodSub || `Total doses: ${data?.totalDoses ?? 0}`,
        };
      }
      case 'mortality': {
        const rows = (data?.events || []).map((e: any) => ({
          id: e.id,
          patientId: e.patientId,
          outcomeDate: e.outcomeDate,
          condition: e.condition ?? '',
        }));
        return {
          rows,
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'patientId', label: 'Patient ID' },
            { key: 'outcomeDate', label: 'Date' },
            { key: 'condition', label: 'Condition' },
          ],
          title: 'Mortality / Quality Report',
          subtitle: periodSub || `Total: ${data?.total ?? 0}`,
        };
      }
      case 'tax': {
        const rows = [
          {
            metric: 'Taxable revenue',
            value: data?.taxableRevenue ?? 0,
          },
          { metric: 'VAT amount', value: data?.vatAmount ?? 0 },
          ...(data?.payeAmount != null ? [{ metric: 'PAYE amount', value: data.payeAmount }] : []),
        ];
        return {
          rows,
          columns: [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ],
          title: 'Tax Report',
          subtitle: periodSub,
        };
      }
      default:
        return { rows: [], columns: [], title };
    }
  }

  const exportData = data ? getExportData() : null;
  const hasExportRows = exportData && exportData.rows.length > 0;
  const taxNeedsDates = reportKind === 'tax';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            to={`/ehr/${tenantSlug}/dashboard`}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">Reports</h1>
              <p className="text-white/60 text-sm">View, download CSV, or export PDF for all reports</p>
            </div>
          </div>
        </div>

        {/* Quick links: only show links the role may access */}
        {(userRole === 'admin' || userRole === 'accounts') && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-wrap gap-3">
            <span className="text-white/60 text-sm mr-2">Also available:</span>
            {userRole === 'admin' && (
              <Link
                to={`/ehr/${tenantSlug}/hipaa-compliance`}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
              >
                HIPAA disclosure report
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            <Link
              to={`/ehr/${tenantSlug}/billing`}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
            >
              Billing & financial reports
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              to={`/ehr/${tenantSlug}/analytics`}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
            >
              Analytics templates
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
        {['doctor', 'nurse', 'nurse_accounts'].includes(userRole) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-wrap gap-3">
            <span className="text-white/60 text-sm mr-2">Also available:</span>
            <Link
              to={`/ehr/${tenantSlug}/analytics`}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
            >
              Analytics templates
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        {allowedKinds.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 text-center text-white/80">
            <p>No reports are available for your role. Contact your administrator if you need access.</p>
          </div>
        ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1">Report type</label>
              <select
                value={reportKind}
                onChange={(e) => {
                  setReportKind(e.target.value as ReportKind);
                  setData(null);
                }}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white min-w-[200px]"
              >
                {allowedKinds.map((k) => (
                  <option key={k} value={k}>{REPORT_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              />
            </div>
            {reportKind === 'tax' && (
              <div>
                <label className="block text-white/60 text-sm mb-1">PAYE period (YYYY-MM)</label>
                <input
                  type="month"
                  value={payeTaxPeriod}
                  onChange={(e) => setPayeTaxPeriod(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
            )}
            <button
              onClick={loadReport}
              disabled={loading || (taxNeedsDates && (!startDate || !endDate))}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Generate
            </button>
          </div>

          {data && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportCSV}
                  disabled={!hasExportRows}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4 overflow-x-auto">
                {reportKind === 'lab' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Total orders</p>
                        <p className="text-xl font-bold">{data.total ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Completed</p>
                        <p className="text-xl font-bold">{data.byStatus?.completed ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Avg turnaround</p>
                        <p className="text-xl font-bold">{data.turnaroundTime?.average ?? 'N/A'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Sample size</p>
                        <p className="text-xl font-bold">{data.turnaroundTime?.sampleSize ?? 0}</p>
                      </div>
                    </div>
                    {(data.labOrders?.length ?? 0) > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/60 border-b border-white/10">
                            <th className="pb-2 pr-4">Order ID</th>
                            <th className="pb-2 pr-4">Patient</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.labOrders || []).slice(0, 50).map((o: any) => (
                            <tr key={o.id} className="border-b border-white/5">
                              <td className="py-2 pr-4">{o.id?.slice(0, 8)}</td>
                              <td className="py-2 pr-4">{o.patient?.patient_number || o.patientId || '—'}</td>
                              <td className="py-2 pr-4">{o.status}</td>
                              <td className="py-2 pr-4">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {reportKind === 'referral' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Total</p>
                        <p className="text-xl font-bold">{data.summary?.total_referrals ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Pending</p>
                        <p className="text-xl font-bold">{data.summary?.pending ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Completed</p>
                        <p className="text-xl font-bold">{data.summary?.completed ?? 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Urgent</p>
                        <p className="text-xl font-bold">{data.summary?.urgent_referrals ?? 0}</p>
                      </div>
                    </div>
                    {(data.byType?.length > 0 || data.bySpecialty?.length > 0) && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">By type</h4>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-white/60 border-b border-white/10">
                                <th className="pb-2">Type</th>
                                <th className="pb-2 text-right">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(data.byType || []).map((r: any, i: number) => (
                                <tr key={i} className="border-b border-white/5">
                                  <td className="py-1">{r.referral_type || '—'}</td>
                                  <td className="py-1 text-right">{r.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">By specialty</h4>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-white/60 border-b border-white/10">
                                <th className="pb-2">Specialty</th>
                                <th className="pb-2 text-right">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(data.bySpecialty || []).map((r: any, i: number) => (
                                <tr key={i} className="border-b border-white/5">
                                  <td className="py-1">{r.specialty || '—'}</td>
                                  <td className="py-1 text-right">{r.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {reportKind === 'immunization' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-white/5 inline-block">
                      <p className="text-white/60 text-sm">Total doses</p>
                      <p className="text-2xl font-bold">{data.totalDoses ?? 0}</p>
                    </div>
                    {(data.byAntigen?.length ?? 0) > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/60 border-b border-white/10">
                            <th className="pb-2 pr-4">Vaccine code</th>
                            <th className="pb-2 pr-4">Vaccine name</th>
                            <th className="pb-2 pr-4 text-right">Doses</th>
                            <th className="pb-2 pr-4 text-right">Unique patients</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.byAntigen || []).map((r: any, i: number) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="py-2 pr-4">{r.vaccineCode}</td>
                              <td className="py-2 pr-4">{r.vaccineName}</td>
                              <td className="py-2 pr-4 text-right">{r.doses}</td>
                              <td className="py-2 pr-4 text-right">{r.uniquePatients}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {reportKind === 'mortality' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-white/5 inline-block">
                      <p className="text-white/60 text-sm">Total events</p>
                      <p className="text-2xl font-bold">{data.total ?? 0}</p>
                    </div>
                    {(data.events?.length ?? 0) > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/60 border-b border-white/10">
                            <th className="pb-2 pr-4">Patient ID</th>
                            <th className="pb-2 pr-4">Date</th>
                            <th className="pb-2 pr-4">Condition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.events || []).slice(0, 100).map((e: any) => (
                            <tr key={e.id} className="border-b border-white/5">
                              <td className="py-2 pr-4">{e.patientId}</td>
                              <td className="py-2 pr-4">{e.outcomeDate ? new Date(e.outcomeDate).toLocaleDateString() : '—'}</td>
                              <td className="py-2 pr-4">{e.condition ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-white/60">No mortality/quality events in this period.</p>
                    )}
                  </div>
                )}

                {reportKind === 'tax' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">Taxable revenue</p>
                        <p className="text-xl font-bold">{Number(data.taxableRevenue ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-white/5">
                        <p className="text-white/60 text-sm">VAT amount</p>
                        <p className="text-xl font-bold">{Number(data.vatAmount ?? 0).toLocaleString()}</p>
                      </div>
                      {data.payeAmount != null && (
                        <div className="p-4 rounded-lg bg-white/5">
                          <p className="text-white/60 text-sm">PAYE amount</p>
                          <p className="text-xl font-bold">{Number(data.payeAmount).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
