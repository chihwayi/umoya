import React, { useState, useEffect } from 'react';
import { backupAPI, type BackupSchedule } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { ConfirmModal, Modal, PromptModal } from './Modal';

interface Backup {
  id: string;
  name: string;
  date: string;
  size: string;
  sizeBytes?: number;
  type: 'auto' | 'manual';
  status: 'success' | 'failed' | 'in_progress';
  key?: string;
}

export const BackupManager: React.FC = () => {
  const { success, error: notifyError, info } = useNotification();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningAutoNow, setRunningAutoNow] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    enabled: false,
    runTime: '02:00',
    timezone: 'UTC',
    retentionDays: 30,
  });
  const [restoreTargetKey, setRestoreTargetKey] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorePhrase, setRestorePhrase] = useState('');

  useEffect(() => {
    void loadBackups();
    void loadSchedule();
  }, []);

  const loadBackups = async () => {
    try {
      const data = await backupAPI.listBackups();
      if (Array.isArray(data)) {
        setBackups(data);
      } else {
        console.error('Expected array of backups but received:', data);
        setBackups([]);
      }
    } catch (error) {
      console.error('Failed to load backups', error);
      notifyError('Error', 'Failed to load backups list');
      setBackups([]);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const data = await backupAPI.getSchedule();
      setSchedule(data);
      setScheduleForm({
        enabled: Boolean(data.enabled),
        runTime: data.runTime || '02:00',
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        retentionDays: Number(data.retentionDays || 30),
      });
    } catch (error) {
      console.error('Failed to load backup schedule', error);
      notifyError('Error', 'Failed to load backup schedule');
      const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setScheduleForm((prev) => ({ ...prev, timezone: fallbackTz }));
      setSchedule(null);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await backupAPI.createBackup('manual');
      success('Success', 'Backup created successfully');
      await loadBackups(); // Refresh list
    } catch (error) {
      console.error('Failed to create backup', error);
      notifyError('Backup Failed', 'Failed to create backup. Ensure you have admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  const openScheduleModal = () => {
    const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (schedule) {
      setScheduleForm({
        enabled: Boolean(schedule.enabled),
        runTime: schedule.runTime || '02:00',
        timezone: schedule.timezone || fallbackTz,
        retentionDays: Number(schedule.retentionDays || 30),
      });
    } else {
      setScheduleForm((prev) => ({
        ...prev,
        timezone: prev.timezone || fallbackTz,
      }));
    }
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const updated = await backupAPI.updateSchedule({
        enabled: scheduleForm.enabled,
        runTime: scheduleForm.runTime,
        timezone: scheduleForm.timezone.trim(),
        retentionDays: Number(scheduleForm.retentionDays),
      });
      setSchedule(updated);
      success('Saved', 'Backup schedule updated successfully');
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Failed to save backup schedule', error);
      notifyError('Schedule Save Failed', 'Could not save backup schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunAutoNow = async () => {
    setRunningAutoNow(true);
    try {
      const result = await backupAPI.runScheduledBackupNow();
      success('Auto Backup Executed', result.message);
      await Promise.all([loadBackups(), loadSchedule()]);
    } catch (error) {
      console.error('Failed to run auto backup now', error);
      notifyError('Run Failed', 'Could not run scheduled backup now');
    } finally {
      setRunningAutoNow(false);
    }
  };

  const handleRestore = async (key: string) => {
    setRestoreTargetKey(key);
    setRestorePhrase('');
    setShowRestoreConfirm(true);
  };

  const executeRestore = async () => {
    if (!restoreTargetKey) return;
    setLoading(true);
    try {
      await backupAPI.restoreBackup(restoreTargetKey);
      success('Restore Initiated', 'System restore started. The system may be unavailable for a few minutes.');
    } catch (error) {
      console.error('Failed to restore backup', error);
      notifyError('Restore Failed', 'Failed to restore backup. Check console for details.');
    } finally {
      setLoading(false);
      setRestoreTargetKey(null);
      setRestorePhrase('');
      setShowRestorePrompt(false);
    }
  };

  const handleDownload = async (key: string) => {
    try {
      const { url } = await backupAPI.getDownloadUrl(key);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get download link', error);
      notifyError('Download Failed', 'Failed to generate download link');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return 'Not available';
    return new Date(value).toLocaleString();
  };

  const lastBackup = backups.length > 0 ? backups[0] : null;
  const totalSizeBytes = backups.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Backups</h2>
          <p className="text-slate-500 text-sm mt-1">Manage database backups and system restoration points</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={openScheduleModal}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center space-x-2"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Configure Schedule</span>
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            <span>{loading ? 'Creating Backup...' : 'Create Backup Now'}</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Last Successful Backup</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">
                {lastBackup ? new Date(lastBackup.date).toLocaleDateString() + ' ' + new Date(lastBackup.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'No backups yet'}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-md">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Backup Size</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{formatSize(totalSizeBytes)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-md">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Next Scheduled</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">
                {scheduleLoading
                  ? 'Loading...'
                  : schedule?.enabled
                    ? (schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : 'Pending')
                    : 'Disabled'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {schedule?.enabled
                  ? `${schedule.frequency} at ${schedule.runTime} (${schedule.timezone})`
                  : 'Automatic backups are disabled'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 rounded-md">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Recent Backups</h3>
          <span className="text-xs text-slate-500">Showing all backups</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date Created</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {initialLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-transparent"></div>
                      <span>Loading backups...</span>
                    </div>
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No backups found. Create one to get started.
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-slate-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        <span className="text-sm font-medium text-slate-900">{backup.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(backup.date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {backup.size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        backup.type === 'auto' ? 'bg-slate-100 text-slate-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {backup.type === 'auto' ? 'Automatic' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        backup.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 
                        backup.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {backup.status === 'success' ? 'Completed' : 
                        backup.status === 'failed' ? 'Failed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {backup.key && (
                        <>
                          <button 
                            onClick={() => handleDownload(backup.key!)}
                            className="text-slate-600 hover:text-slate-900 mr-4"
                            title="Download Backup"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleRestore(backup.key!)}
                            className="text-red-600 hover:text-red-900"
                            title="Restore Database"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false);
          setRestoreTargetKey(null);
        }}
        onConfirm={() => {
          setShowRestoreConfirm(false);
          setShowRestorePrompt(true);
        }}
        title="Restore Backup"
        message="Restoring will overwrite the current database. This action cannot be undone."
        confirmText="Continue"
        cancelText="Cancel"
        type="danger"
      />

      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Configure Backup Schedule"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">
              Configure automatic system backups with retention cleanup.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Schedule runs on the server and persists across restarts.
            </p>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleForm.enabled}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <span className="text-sm font-medium text-slate-800">Enable automatic daily backups</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run Time</span>
              <input
                type="time"
                value={scheduleForm.runTime}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, runTime: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</span>
              <input
                type="text"
                value={scheduleForm.timezone}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, timezone: event.target.value }))}
                placeholder="e.g. Africa/Harare"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retention (days)</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={scheduleForm.retentionDays}
              onChange={(event) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  retentionDays: Math.max(1, Math.min(3650, Number(event.target.value || 30))),
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Last Run</p>
              <p className="text-sm font-medium text-slate-900">
                {schedule?.lastRunAt ? formatDateTime(schedule.lastRunAt) : 'Never'}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Status</p>
              <p className="text-sm font-medium text-slate-900">
                {schedule?.lastRunStatus || 'never'}
              </p>
              {schedule?.lastError && (
                <p className="text-xs text-red-600 mt-1 truncate" title={schedule.lastError}>
                  {schedule.lastError}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleRunAutoNow}
              disabled={runningAutoNow || savingSchedule}
              className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
            >
              {runningAutoNow ? 'Running...' : 'Run Auto Backup Now'}
            </button>
            <button
              onClick={handleSaveSchedule}
              disabled={savingSchedule || runningAutoNow}
              className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
            >
              {savingSchedule ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </Modal>

      <PromptModal
        isOpen={showRestorePrompt}
        onClose={() => {
          setShowRestorePrompt(false);
          setRestoreTargetKey(null);
          setRestorePhrase('');
          info('Cancelled', 'Restore operation cancelled.');
        }}
        onConfirm={(value) => {
          if (value.trim() !== 'RESTORE') {
            notifyError('Confirmation failed', 'Type RESTORE exactly to continue.');
            return;
          }
          void executeRestore();
        }}
        title="Final Restore Confirmation"
        message='Type "RESTORE" to confirm this dangerous operation.'
        value={restorePhrase}
        onValueChange={setRestorePhrase}
        confirmText="Start Restore"
        cancelText="Abort"
        placeholder="RESTORE"
        type="danger"
      />
    </div>
  );
};
