import React, { useState, useEffect, useCallback } from 'react';
import { ehrApi as api } from '../services/api';

interface Props {
  token: string;
  tenantSlug: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#ef4444',
  notified: '#22c55e',
  overdue_notification: '#dc2626',
  remediated: '#3b82f6',
  closed: '#6b7280',
};

type Tab = 'anomalies' | 'incidents' | 'audit-chain' | 'backups' | 'dr-test';

export const SecurityDashboardPage: React.FC<Props> = ({ token, tenantSlug }) => {
  const [tab, setTab] = useState<Tab>('anomalies');
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [chainResult, setChainResult] = useState<any>(null);
  const [backupJobs, setBackupJobs] = useState<any[]>([]);
  const [drTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Incident form
  const [newIncident, setNewIncident] = useState({ breachType: '', severity: 'medium', description: '', affectedRecordsCount: '' });
  const [drTestForm, setDrTestForm] = useState({ rtoMinutes: '', rpoHours: '', result: 'pass', notes: '' });

  const loadAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        api.getOpenAnomalies(1, token, tenantSlug),
        api.getAnomalyStats(token, tenantSlug),
      ]);
      setAnomalies(data);
      setStats(s);
    } catch { setError('Failed to load anomalies'); }
    finally { setLoading(false); }
  }, [token, tenantSlug]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try { setIncidents(await api.listBreachIncidents(token, tenantSlug)); }
    catch { setError('Failed to load incidents'); }
    finally { setLoading(false); }
  }, [token, tenantSlug]);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try { setBackupJobs(await api.listBackupJobs(token, tenantSlug)); }
    catch { setError('Failed to load backups'); }
    finally { setLoading(false); }
  }, [token, tenantSlug]);

  useEffect(() => {
    setError('');
    if (tab === 'anomalies') loadAnomalies();
    else if (tab === 'incidents') loadIncidents();
    else if (tab === 'backups') loadBackups();
  }, [tab, loadAnomalies, loadIncidents, loadBackups]);

  const handleAcknowledge = async (id: string, isFalsePositive: boolean) => {
    await api.acknowledgeAnomaly(id, isFalsePositive, token, tenantSlug);
    loadAnomalies();
  };

  const handleVerifyChain = async () => {
    setLoading(true);
    try { setChainResult(await api.verifyAuditChain(token, tenantSlug)); }
    catch { setError('Verification failed'); }
    finally { setLoading(false); }
  };

  const handleRunBackup = async () => {
    setLoading(true);
    try { await api.runBackup(token, tenantSlug); loadBackups(); }
    catch (e: any) { setError(e.message || 'Backup failed'); }
    finally { setLoading(false); }
  };

  const handleVerifyBackup = async (id: string) => {
    const result = await api.verifyBackupIntegrity(id, token, tenantSlug);
    alert(result.valid ? `Valid: ${result.details}` : `INVALID: ${result.details}`);
  };

  const handleCreateIncident = async () => {
    if (!newIncident.breachType || !newIncident.description) return;
    await api.createBreachIncident({
      breachType: newIncident.breachType,
      severity: newIncident.severity,
      description: newIncident.description,
      affectedRecordsCount: newIncident.affectedRecordsCount ? Number(newIncident.affectedRecordsCount) : undefined,
    }, token, tenantSlug);
    setNewIncident({ breachType: '', severity: 'medium', description: '', affectedRecordsCount: '' });
    loadIncidents();
  };

  const handleNotifyPotraz = async (id: string) => {
    const result = await api.notifyPotraz(id, token, tenantSlug);
    alert(`POTRAZ notified. Reference: ${result.reference}`);
    loadIncidents();
  };

  const handleRecordDrTest = async () => {
    await api.recordDrTest({
      rtoMinutes: Number(drTestForm.rtoMinutes),
      rpoHours: Number(drTestForm.rpoHours),
      result: drTestForm.result,
      notes: drTestForm.notes,
    }, token, tenantSlug);
    setDrTestForm({ rtoMinutes: '', rpoHours: '', result: 'pass', notes: '' });
    alert('DR test recorded');
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'anomalies', label: 'Anomalies' },
    { id: 'incidents', label: 'Breach Incidents' },
    { id: 'audit-chain', label: 'Audit Chain' },
    { id: 'backups', label: 'Backups' },
    { id: 'dr-test', label: 'DR Test Log' },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1200 }}>
      <h2 style={{ margin: '0 0 20px' }}>Security Dashboard</h2>

      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 16px', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Anomalies', value: stats.total, color: '#6b7280' },
            { label: 'Critical', value: stats.critical, color: '#ef4444' },
            { label: 'High', value: stats.high, color: '#f97316' },
            { label: 'Unacknowledged', value: stats.unacknowledged, color: '#3b82f6' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 20px', minWidth: 130, textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 16px', border: 'none', background: tab === id ? '#2563eb' : 'transparent', color: tab === id ? '#fff' : '#374151', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: tab === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}

      {tab === 'anomalies' && !loading && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Rule', 'Severity', 'User', 'IP', 'Detected', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anomalies.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No unacknowledged anomalies</td></tr>
              )}
              {anomalies.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.rule_name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: SEVERITY_COLORS[a.severity] ?? '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{a.severity}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{a.user_email ?? a.user_id ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{a.ip_address ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{new Date(a.detected_at).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => handleAcknowledge(a.id, false)} style={{ marginRight: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid #d1d5db' }}>Acknowledge</button>
                    <button onClick={() => handleAcknowledge(a.id, true)} style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid #d1d5db', color: '#6b7280' }}>False Positive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'incidents' && !loading && (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px' }}>Create Breach Incident</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input placeholder="Breach type (e.g. BULK_DOWNLOAD)" value={newIncident.breachType}
                onChange={e => setNewIncident(p => ({ ...p, breachType: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: 220 }} />
              <select value={newIncident.severity} onChange={e => setNewIncident(p => ({ ...p, severity: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4 }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <input placeholder="Description" value={newIncident.description}
                onChange={e => setNewIncident(p => ({ ...p, description: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, flex: 1, minWidth: 200 }} />
              <input placeholder="Affected records (opt)" type="number" value={newIncident.affectedRecordsCount}
                onChange={e => setNewIncident(p => ({ ...p, affectedRecordsCount: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: 160 }} />
              <button onClick={handleCreateIncident}
                style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Type', 'Severity', 'Status', 'POTRAZ', 'Detected', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No incidents</td></tr>
              )}
              {incidents.map((inc: any) => (
                <tr key={inc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{inc.breach_type}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: SEVERITY_COLORS[inc.severity] ?? '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{inc.severity}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: STATUS_COLORS[inc.status] ?? '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{inc.status}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>
                    {inc.potraz_notified_at
                      ? <span style={{ color: '#22c55e' }}>✓ {new Date(inc.potraz_notified_at).toLocaleDateString()} {inc.potraz_notified_within_72h ? '(within 72h)' : '(LATE)'}</span>
                      : <span style={{ color: '#ef4444' }}>Not notified</span>}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{new Date(inc.detected_at).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {!inc.potraz_notified_at && (
                      <button onClick={() => handleNotifyPotraz(inc.id)}
                        style={{ marginRight: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>
                        Notify POTRAZ
                      </button>
                    )}
                    {inc.status === 'notified' && (
                      <button onClick={() => api.remediateIncident(inc.id, token, tenantSlug).then(loadIncidents)}
                        style={{ marginRight: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid #d1d5db' }}>
                        Remediate
                      </button>
                    )}
                    {inc.status === 'remediated' && (
                      <button onClick={() => api.closeIncident(inc.id, token, tenantSlug).then(loadIncidents)}
                        style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid #d1d5db' }}>
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit-chain' && (
        <div>
          <p style={{ color: '#374151', marginBottom: 16 }}>
            Verify the SHA-256 hash chain on audit log entries to detect any record tampering or deletion.
          </p>
          <button onClick={handleVerifyChain} disabled={loading}
            style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: 20 }}>
            Verify Chain Integrity
          </button>
          {chainResult && (
            <div style={{ padding: 20, background: chainResult.valid ? '#f0fdf4' : '#fef2f2', border: `1px solid ${chainResult.valid ? '#86efac' : '#fca5a5'}`, borderRadius: 8 }}>
              {chainResult.valid
                ? <span style={{ color: '#15803d', fontWeight: 600 }}>✓ Audit chain is intact — no tampering detected</span>
                : <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Chain broken at sequence number {chainResult.firstBrokenAt} — potential tampering detected!</span>}
            </div>
          )}
        </div>
      )}

      {tab === 'backups' && !loading && (
        <div>
          <button onClick={handleRunBackup}
            style={{ marginBottom: 16, padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Run Backup Now
          </button>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Started', 'Status', 'Size', 'Checksum', 'Verified', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backupJobs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No backup jobs</td></tr>
              )}
              {backupJobs.map((job: any) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{new Date(job.started_at).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: job.status === 'completed' ? '#22c55e' : job.status === 'failed' ? '#ef4444' : '#f97316', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{job.file_size_bytes ? `${(job.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace' }}>{job.checksum_sha256?.slice(0, 16) ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>
                    {job.verification_status
                      ? <span style={{ color: job.verification_status === 'ok' ? '#22c55e' : '#ef4444' }}>{job.verification_status}</span>
                      : '—'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => handleVerifyBackup(job.id)}
                      style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 4, border: '1px solid #d1d5db' }}>
                      Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'dr-test' && (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px' }}>Record DR Test</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input placeholder="RTO (minutes)" type="number" value={drTestForm.rtoMinutes}
                onChange={e => setDrTestForm(p => ({ ...p, rtoMinutes: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: 140 }} />
              <input placeholder="RPO (hours)" type="number" value={drTestForm.rpoHours}
                onChange={e => setDrTestForm(p => ({ ...p, rpoHours: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, width: 140 }} />
              <select value={drTestForm.result} onChange={e => setDrTestForm(p => ({ ...p, result: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4 }}>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="partial">Partial</option>
              </select>
              <input placeholder="Notes" value={drTestForm.notes}
                onChange={e => setDrTestForm(p => ({ ...p, notes: e.target.value }))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, flex: 1, minWidth: 200 }} />
              <button onClick={handleRecordDrTest}
                style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Record
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <h4 style={{ margin: '0 0 8px' }}>RTO/RPO Targets</h4>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><span style={{ fontWeight: 600, color: '#2563eb' }}>RTO Target:</span> 4 hours</div>
              <div><span style={{ fontWeight: 600, color: '#2563eb' }}>RPO Target:</span> 24 hours (daily backup)</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Date', 'RTO (min)', 'RPO (h)', 'Result', 'Notes'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drTests.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No DR tests recorded</td></tr>
                )}
                {drTests.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>{new Date(t.tested_at).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>{t.rto_minutes ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{t.rpo_hours ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: t.result === 'pass' ? '#22c55e' : t.result === 'fail' ? '#ef4444' : '#f97316', fontWeight: 600 }}>{t.result}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>{t.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
