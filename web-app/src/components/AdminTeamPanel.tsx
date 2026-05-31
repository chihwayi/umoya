import React, { useState, useEffect, useCallback } from 'react';
import { adminTeamAPI, AdminUserView, authAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
};

const ROLE_DESC: Record<string, string> = {
  super_admin: 'Full control — manages tenants, billing, and other admins',
  admin: 'Tenant operations; can view the team but not manage it',
  support: 'Read-only access to health, audit and diagnostics',
};

const roleChip = (role: string) => {
  switch (role) {
    case 'super_admin': return 'bg-[#0AA98A]/15 text-[#5DDBB8] border-[#0AA98A]/30';
    case 'admin': return 'bg-[#3B9EFF]/15 text-[#9CC9FF] border-[#3B9EFF]/30';
    default: return 'bg-white/[0.06] text-[#9FB3D4] border-white/[0.12]';
  }
};

export const AdminTeamPanel: React.FC = () => {
  const { success, error: notifyError } = useNotification();
  const [admins, setAdmins] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempCredential, setTempCredential] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'admin' });
  const [creating, setCreating] = useState(false);

  const currentUser = authAPI.getCurrentUser();
  const myRole = String(currentUser?.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const canManage = myRole === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await adminTeamAPI.list());
    } catch (e: any) {
      notifyError('Load failed', e?.response?.data?.message || 'Could not load admin team');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
    if (!emailOk) { notifyError('Invalid email', 'Enter a valid email address'); return; }
    setCreating(true);
    try {
      const res = await adminTeamAPI.create(form);
      setTempCredential({ email: res.admin.email, password: res.tempPassword });
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', role: 'admin' });
      success('Admin created', `${res.admin.email} added as ${ROLE_LABEL[res.admin.role]}`);
      load();
    } catch (e: any) {
      notifyError('Create failed', e?.response?.data?.message || 'Could not create admin');
    } finally {
      setCreating(false);
    }
  };

  const handleRole = async (a: AdminUserView, role: string) => {
    if (role === a.role) return;
    setBusyId(a.id);
    try {
      await adminTeamAPI.setRole(a.id, role);
      success('Role updated', `${a.email} is now ${ROLE_LABEL[role]}`);
      load();
    } catch (e: any) {
      notifyError('Update failed', e?.response?.data?.message || 'Could not change role');
    } finally { setBusyId(null); }
  };

  const handleStatus = async (a: AdminUserView) => {
    setBusyId(a.id);
    try {
      await adminTeamAPI.setStatus(a.id, !a.isActive);
      success('Status updated', `${a.email} ${a.isActive ? 'disabled' : 'enabled'}`);
      load();
    } catch (e: any) {
      notifyError('Update failed', e?.response?.data?.message || 'Could not change status');
    } finally { setBusyId(null); }
  };

  const handleReset = async (a: AdminUserView) => {
    setBusyId(a.id);
    try {
      const res = await adminTeamAPI.resetPassword(a.id);
      setTempCredential({ email: a.email, password: res.tempPassword });
      success('Password reset', `New temporary password generated for ${a.email}`);
    } catch (e: any) {
      notifyError('Reset failed', e?.response?.data?.message || 'Could not reset password');
    } finally { setBusyId(null); }
  };

  const handleDelete = async (a: AdminUserView) => {
    if (!window.confirm(`Delete admin ${a.email}? This cannot be undone.`)) return;
    setBusyId(a.id);
    try {
      await adminTeamAPI.remove(a.id);
      success('Admin removed', `${a.email} deleted`);
      load();
    } catch (e: any) {
      notifyError('Delete failed', e?.response?.data?.message || 'Could not delete admin');
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">👥 Administrators</h2>
          <div className="text-sm text-[#7A9AB8]">Manage platform admin accounts and their access level</div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0AA98A] to-[#00A87A] px-4 py-2 text-sm font-bold text-[#040A10] transition hover:from-[#00D9A3]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Admin
          </button>
        )}
      </div>

      {!canManage && (
        <div className="rounded-2xl border border-[#3B9EFF]/20 bg-[#3B9EFF]/[0.06] px-4 py-3 text-sm text-[#9CC9FF]">
          You have <strong>{ROLE_LABEL[myRole] || myRole}</strong> access — you can view the team but only a Super Admin can make changes.
        </div>
      )}

      <div className="bg-[#0A1525] border border-white/[0.10] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#080E1A] border-b border-white/[0.07] text-left text-[#8FA8CC] uppercase text-xs">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-[#7A9AB8]">Loading…</td></tr>
              )}
              {!loading && admins.length === 0 && (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-[#7A9AB8]">No admins found.</td></tr>
              )}
              {admins.map((a) => {
                const isSelf = a.id === currentUser?.id;
                return (
                  <tr key={a.id} className="border-t border-white/[0.05] hover:bg-[#080E1A]/60">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{a.firstName} {a.lastName}{isSelf && <span className="ml-2 text-[10px] text-[#5DDBB8]">(you)</span>}</div>
                      <div className="text-xs text-[#7A9AB8]">{a.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {canManage && !isSelf ? (
                        <select
                          value={a.role}
                          disabled={busyId === a.id}
                          onChange={(e) => handleRole(a, e.target.value)}
                          title={ROLE_DESC[a.role]}
                          className="bg-[#0D1829] border border-white/[0.12] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#0AA98A]/30"
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="support">Support</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleChip(a.role)}`} title={ROLE_DESC[a.role]}>
                          {ROLE_LABEL[a.role] || a.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${a.isActive ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {a.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#8FA8CC]">
                      {a.lastLogin ? new Date(a.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!isSelf && (
                            <button onClick={() => handleStatus(a)} disabled={busyId === a.id}
                              className="px-2 py-1 text-xs rounded-lg bg-white/[0.06] text-[#C5D5EE] hover:bg-white/[0.12] transition disabled:opacity-50">
                              {a.isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          <button onClick={() => handleReset(a)} disabled={busyId === a.id}
                            className="px-2 py-1 text-xs rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition disabled:opacity-50">
                            Reset PW
                          </button>
                          {!isSelf && (
                            <button onClick={() => handleDelete(a)} disabled={busyId === a.id}
                              className="px-2 py-1 text-xs rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition disabled:opacity-50">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A1525] border border-white/[0.12] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-1">New Administrator</h3>
            <p className="text-xs text-[#7A9AB8] mb-4">A one-time temporary password is generated; they must change it on first login.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="rounded-xl border border-white/[0.12] bg-[#0D1829] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0AA98A]/30" />
                <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="rounded-xl border border-white/[0.12] bg-[#0D1829] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0AA98A]/30" />
              </div>
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-white/[0.12] bg-[#0D1829] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0AA98A]/30" />
              <div>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0D1829] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0AA98A]/30">
                  <option value="admin">Admin — tenant operations</option>
                  <option value="support">Support — read-only</option>
                  <option value="super_admin">Super Admin — full control</option>
                </select>
                <p className="text-[11px] text-[#5A78A0] mt-1">{ROLE_DESC[form.role]}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-xl bg-white/[0.06] text-[#C5D5EE] hover:bg-white/[0.12] transition">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#0AA98A] text-[#040A10] hover:bg-[#12BFAB] transition disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temp credential modal (shown once) */}
      {tempCredential && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A1525] border border-white/[0.12] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-5 text-center">
              <h3 className="text-lg font-bold text-white">Temporary Password</h3>
              <p className="text-emerald-100 text-xs mt-1">Save this now — it will not be shown again.</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-[#080E1A] rounded-xl border border-white/[0.08] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#5A78A0]">Email</div>
                <div className="font-mono text-sm text-white">{tempCredential.email}</div>
                <div className="text-[10px] uppercase tracking-wider text-[#5A78A0] mt-3">Temporary Password</div>
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg font-bold text-[#5DDBB8]">{tempCredential.password}</code>
                  <button onClick={() => navigator.clipboard?.writeText(tempCredential.password).catch(() => {})}
                    className="text-xs px-2 py-1 rounded-lg bg-white/[0.06] text-[#C5D5EE] hover:bg-white/[0.12]">Copy</button>
                </div>
              </div>
              <button onClick={() => setTempCredential(null)} className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition">
                I have saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
