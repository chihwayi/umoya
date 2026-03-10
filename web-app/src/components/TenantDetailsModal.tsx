import React, { useState, useEffect, useCallback } from 'react';
import {
  Tenant,
  TenantUser,
  CreateTenantUserRequest,
  TenantDhis2ConfigPayload,
  TenantDhis2ConfigView,
} from '../types';
import { tenantAPI } from '../services/api';
import { Modal } from './Modal';

interface TenantDetailsModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// Helper to cast event value to role type
const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>, current: CreateTenantUserRequest, setter: React.Dispatch<React.SetStateAction<CreateTenantUserRequest>>) => {
  setter({...current, role: e.target.value as CreateTenantUserRequest['role']});
};

interface Dhis2FormState {
  baseUrl: string;
  apiVersion: string;
  authType: 'pat' | 'basic';
  pat: string;
  username: string;
  password: string;
  orgUnitId: string;
  trackedEntityTypeId: string;
  datasetId: string;
  enabled: boolean;
  scheduledSyncEnabled: boolean;
  scheduledRetryLimit: number;
  alertLookbackHours: number;
  alertErrorThreshold: number;
  alertWebhookUrl: string;
}

const createDefaultDhis2Form = (): Dhis2FormState => ({
  baseUrl: '',
  apiVersion: '40',
  authType: 'pat',
  pat: '',
  username: '',
  password: '',
  orgUnitId: '',
  trackedEntityTypeId: '',
  datasetId: '',
  enabled: true,
  scheduledSyncEnabled: false,
  scheduledRetryLimit: 20,
  alertLookbackHours: 24,
  alertErrorThreshold: 10,
  alertWebhookUrl: '',
});

export const TenantDetailsModal: React.FC<TenantDetailsModalProps> = ({
  tenant,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [userToReset, setUserToReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newUser, setNewUser] = useState<CreateTenantUserRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'admin',
    temporaryPassword: ''
  });
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{email: string, password: string} | null>(null);
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [dhis2Loading, setDhis2Loading] = useState(false);
  const [dhis2Saving, setDhis2Saving] = useState(false);
  const [dhis2Configured, setDhis2Configured] = useState(false);
  const [dhis2HasPat, setDhis2HasPat] = useState(false);
  const [dhis2PatMasked, setDhis2PatMasked] = useState<string | null>(null);
  const [dhis2Form, setDhis2Form] = useState<Dhis2FormState>(createDefaultDhis2Form());
  const [dhis2RunNowLoading, setDhis2RunNowLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!tenant) return;
    setUsers([]); // Clear users immediately to prevent showing stale data from previous tenant
    setLoading(true);
    try {
      const data = await tenantAPI.getTenantUsers(tenant.id);
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.warn('Expected array of users but received:', data);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  const loadDhis2Config = useCallback(async () => {
    if (!tenant) return;
    setDhis2Loading(true);
    try {
      const data = await tenantAPI.getTenantDhis2Config(tenant.id);
      if ((data as any)?.configured === false) {
        setDhis2Configured(false);
        setDhis2HasPat(false);
        setDhis2PatMasked(null);
        setDhis2Form(createDefaultDhis2Form());
        return;
      }

      const config = data as TenantDhis2ConfigView;
      setDhis2Configured(true);
      setDhis2HasPat(Boolean(config.hasPat));
      setDhis2PatMasked(config.patMasked ?? null);
      setDhis2Form({
        baseUrl: config.baseUrl || '',
        apiVersion: config.apiVersion || '40',
        authType: config.authType === 'basic' ? 'basic' : 'pat',
        pat: '',
        username: config.username || '',
        password: '',
        orgUnitId: config.orgUnitId || '',
        trackedEntityTypeId: config.trackedEntityTypeId || '',
        datasetId: config.datasetId || '',
        enabled: Boolean(config.enabled),
        scheduledSyncEnabled: Boolean(config.scheduledSyncEnabled),
        scheduledRetryLimit: Number(config.scheduledRetryLimit || 20),
        alertLookbackHours: Number(config.alertLookbackHours || 24),
        alertErrorThreshold: Number(config.alertErrorThreshold || 10),
        alertWebhookUrl: config.alertWebhookUrl || '',
      });
    } catch (error) {
      console.error('Failed to load tenant DHIS2 config:', error);
      setErrorMessage('Failed to load DHIS2 configuration');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setDhis2Loading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant && isOpen) {
      loadUsers();
      loadDhis2Config();
    } else {
      setUsers([]); // Clear users when closed or tenant cleared
      setDhis2Configured(false);
      setDhis2HasPat(false);
      setDhis2PatMasked(null);
      setDhis2Form(createDefaultDhis2Form());
    }
  }, [isOpen, loadDhis2Config, loadUsers, tenant]);

  const handleSaveDhis2Config = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    const normalizedBaseUrl = dhis2Form.baseUrl.trim();
    const normalizedOrgUnitId = dhis2Form.orgUnitId.trim();
    if (!normalizedBaseUrl) {
      showError('DHIS2 Base URL is required');
      return;
    }
    if (!normalizedOrgUnitId) {
      showError('DHIS2 Org Unit ID is required');
      return;
    }
    if (dhis2Form.authType === 'pat' && !dhis2Form.pat.trim() && !dhis2HasPat) {
      showError('PAT is required for PAT authentication');
      return;
    }

    const payload: TenantDhis2ConfigPayload = {
      baseUrl: normalizedBaseUrl,
      apiVersion: dhis2Form.apiVersion.trim() || '40',
      authType: dhis2Form.authType,
      orgUnitId: normalizedOrgUnitId,
      trackedEntityTypeId: dhis2Form.trackedEntityTypeId.trim() || null,
      datasetId: dhis2Form.datasetId.trim() || null,
      enabled: dhis2Form.enabled,
      scheduledSyncEnabled: dhis2Form.scheduledSyncEnabled,
      scheduledRetryLimit: Math.min(Math.max(Number(dhis2Form.scheduledRetryLimit || 20), 1), 200),
      alertLookbackHours: Math.min(Math.max(Number(dhis2Form.alertLookbackHours || 24), 1), 720),
      alertErrorThreshold: Math.min(Math.max(Number(dhis2Form.alertErrorThreshold || 10), 1), 10000),
      alertWebhookUrl: dhis2Form.alertWebhookUrl.trim() || null,
    };

    if (dhis2Form.authType === 'pat' && dhis2Form.pat.trim()) {
      payload.pat = dhis2Form.pat.trim();
    }
    if (dhis2Form.authType === 'basic') {
      if (dhis2Form.username.trim()) {
        payload.username = dhis2Form.username.trim();
      }
      if (dhis2Form.password.trim()) {
        payload.password = dhis2Form.password.trim();
      }
      if (!payload.username && !dhis2Configured) {
        showError('Username is required for basic authentication');
        return;
      }
      if (!payload.password && !dhis2Configured) {
        showError('Password is required for basic authentication');
        return;
      }
    }

    setDhis2Saving(true);
    try {
      const saved = await tenantAPI.upsertTenantDhis2Config(tenant.id, payload);
      setDhis2Configured(true);
      setDhis2HasPat(Boolean(saved.hasPat));
      setDhis2PatMasked(saved.patMasked ?? null);
      setDhis2Form((prev) => ({
        ...prev,
        pat: '',
        password: '',
        username: saved.username || prev.username,
      }));
      showSuccess('DHIS2 configuration saved');
    } catch (error: any) {
      console.error('Failed to save tenant DHIS2 config:', error);
      const msg = error?.response?.data?.message;
      showError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save DHIS2 configuration');
    } finally {
      setDhis2Saving(false);
    }
  };

  const handleClearDhis2Config = async () => {
    if (!tenant) return;
    if (!window.confirm('Delete this tenant DHIS2 configuration?')) {
      return;
    }
    setDhis2Saving(true);
    try {
      await tenantAPI.clearTenantDhis2Config(tenant.id);
      setDhis2Configured(false);
      setDhis2HasPat(false);
      setDhis2PatMasked(null);
      setDhis2Form(createDefaultDhis2Form());
      showSuccess('DHIS2 configuration deleted');
    } catch (error: any) {
      console.error('Failed to delete tenant DHIS2 config:', error);
      const msg = error?.response?.data?.message;
      showError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to delete DHIS2 configuration');
    } finally {
      setDhis2Saving(false);
    }
  };

  const handleRunDhis2SyncNow = async () => {
    if (!tenant) return;
    setDhis2RunNowLoading(true);
    try {
      const result = await tenantAPI.runTenantDhis2SyncNow(tenant.id);
      if (result?.status === 'SUCCESS') {
        const cycle = result?.result || {};
        showSuccess(
          `Sync now completed: patients=${cycle.patientStatus || 'UNKNOWN'}, aggregate=${cycle.aggregateStatus || 'UNKNOWN'}, retries=${cycle.retryAttempted || 0}/${cycle.retryFailed || 0}`,
        );
      } else {
        showError(result?.message || 'Unable to run DHIS2 sync now');
      }
    } catch (error: any) {
      console.error('Failed to run tenant DHIS2 sync now:', error);
      const msg = error?.response?.data?.message;
      showError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to run DHIS2 sync now');
    } finally {
      setDhis2RunNowLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    
    // Frontend Validation
    if (newUser.phone && newUser.phone.length < 10) {
      showError('Phone number must be at least 10 characters');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    
    // Generate a secure random password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let generatedPassword = '';
    for (let i = 0; i < 12; i++) {
      generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    try {
      // Clean up the payload: remove empty strings for optional fields
      const payload: any = { ...newUser, temporaryPassword: generatedPassword };
      if (!payload.phone) delete payload.phone;
      
      await tenantAPI.createTenantUser(tenant.id, payload);
      
      // Store credentials to show to user
      setCreatedUserCredentials({
        email: newUser.email,
        password: generatedPassword
      });
      
      setShowCreateUser(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'admin',
        temporaryPassword: ''
      });
      showSuccess('User created successfully');
      loadUsers();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      const msg = error.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create user');
      showError(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, status: string) => {
    if (!tenant) return;
    
    try {
      await tenantAPI.updateUserStatus(tenant.id, userId, status);
      loadUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!tenant || !userToReset || newPassword.length < 8) return;
    
    try {
      await tenantAPI.resetUserPassword(tenant.id, userToReset, newPassword);
      setShowPasswordModal(false);
      setUserToReset(null);
      setNewPassword('');
      showSuccess('Password reset successfully');
    } catch (error) {
      console.error('Failed to reset password:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!tenant || !userToDelete) return;
    
    try {
      await tenantAPI.deleteUser(tenant.id, userToDelete);
      setShowDeleteModal(false);
      setUserToDelete(null);
      loadUsers();
      showSuccess('User deleted successfully');
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && tenant) {
      const file = e.target.files[0];
      try {
        setIsUploadingLogo(true);
        const { url } = await tenantAPI.uploadTenantLogo(file);
        await tenantAPI.updateTenant(tenant.id, { logoUrl: url });
        
        // Update local tenant object if possible or just rely on parent refresh
        // Since we can't update props, we hope onUpdate triggers a reload
        showSuccess('Logo updated successfully');
        onUpdate(); 
      } catch (error) {
        console.error('Failed to update logo', error);
        showError('Failed to update logo');
      } finally {
        setIsUploadingLogo(false);
        // Reset input
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
      }
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'professional': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'suspended': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'inactive': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (!tenant) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Tenant Management" size="2xl">
        <div className="space-y-6">

          {/* Tenant Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div 
                className="w-16 h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer hover:border-indigo-300 transition-colors"
                onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                title="Click to change logo"
              >
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.clinicName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-400">{tenant.clinicName.charAt(0)}</span>
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>

                {/* Loading overlay */}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={logoInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{tenant.clinicName}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getTierStyle(tenant.subscriptionTier)}`}>
                    {tenant.subscriptionTier}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getStatusStyle(tenant.status)}`}>
                    {tenant.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col text-sm text-slate-500 space-y-1">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span>{tenant.contactEmail}</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                <span>{tenant.subdomain}.medicore.app</span>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg border border-emerald-200 flex items-center animate-fade-in-down">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 flex items-center animate-fade-in-down">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {errorMessage}
            </div>
          )}

          {/* DHIS2 Integration Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
              <div>
                <h4 className="font-bold text-slate-800">DHIS2 Integration</h4>
                <p className="text-xs text-slate-500 mt-1">Tenant-scoped DHIS2 auth, org unit mapping, and scheduler controls.</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    dhis2Configured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {dhis2Configured ? 'Configured' : 'Not configured'}
                </span>
                <button
                  type="button"
                  onClick={loadDhis2Config}
                  disabled={dhis2Loading || dhis2Saving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {dhis2Loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDhis2Config} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">DHIS2 Base URL</label>
                  <input
                    type="url"
                    value={dhis2Form.baseUrl}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="http://host.docker.internal:8888"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">API Version</label>
                  <input
                    type="text"
                    value={dhis2Form.apiVersion}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, apiVersion: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Auth Type</label>
                  <select
                    value={dhis2Form.authType}
                    onChange={(e) =>
                      setDhis2Form((prev) => ({ ...prev, authType: e.target.value === 'basic' ? 'basic' : 'pat' }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="pat">Personal Access Token</option>
                    <option value="basic">Username + Password</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Org Unit ID</label>
                  <input
                    type="text"
                    value={dhis2Form.orgUnitId}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, orgUnitId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tracked Entity Type ID</label>
                  <input
                    type="text"
                    value={dhis2Form.trackedEntityTypeId}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, trackedEntityTypeId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Dataset ID</label>
                  <input
                    type="text"
                    value={dhis2Form.datasetId}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, datasetId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {dhis2Form.authType === 'pat' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">PAT</label>
                  <input
                    type="password"
                    value={dhis2Form.pat}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, pat: e.target.value }))}
                    placeholder={dhis2HasPat ? 'PAT already stored. Enter only to rotate.' : 'd2pat_...'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                  {dhis2HasPat && (
                    <p className="text-xs text-slate-500 mt-1">Stored token: {dhis2PatMasked || 'set'}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
                    <input
                      type="text"
                      value={dhis2Form.username}
                      onChange={(e) => setDhis2Form((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                    <input
                      type="password"
                      value={dhis2Form.password}
                      onChange={(e) => setDhis2Form((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter only to set/rotate password"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={dhis2Form.enabled}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enable DHIS2 integration
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={dhis2Form.scheduledSyncEnabled}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, scheduledSyncEnabled: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enable scheduled sync for this tenant
                </label>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Retry Limit (1-200)</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={dhis2Form.scheduledRetryLimit}
                    onChange={(e) =>
                      setDhis2Form((prev) => ({ ...prev, scheduledRetryLimit: Number(e.target.value || 20) }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Alert Lookback Hours (1-720)</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={dhis2Form.alertLookbackHours}
                    onChange={(e) =>
                      setDhis2Form((prev) => ({ ...prev, alertLookbackHours: Number(e.target.value || 24) }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Alert Error Threshold (1-10000)</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={dhis2Form.alertErrorThreshold}
                    onChange={(e) =>
                      setDhis2Form((prev) => ({ ...prev, alertErrorThreshold: Number(e.target.value || 10) }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Alert Webhook URL (optional)</label>
                  <input
                    type="url"
                    value={dhis2Form.alertWebhookUrl}
                    onChange={(e) => setDhis2Form((prev) => ({ ...prev, alertWebhookUrl: e.target.value }))}
                    placeholder="https://hooks.slack.com/..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {dhis2Configured && (
                  <button
                    type="button"
                    onClick={handleRunDhis2SyncNow}
                    disabled={dhis2RunNowLoading || dhis2Saving || dhis2Loading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {dhis2RunNowLoading ? 'Running...' : 'Run Sync Now'}
                  </button>
                )}
                {dhis2Configured && (
                  <button
                    type="button"
                    onClick={handleClearDhis2Config}
                    disabled={dhis2Saving || dhis2RunNowLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete Config
                  </button>
                )}
                <button
                  type="submit"
                  disabled={dhis2Saving || dhis2Loading || dhis2RunNowLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {dhis2Saving ? 'Saving...' : 'Save DHIS2 Config'}
                </button>
              </div>
            </form>
          </div>

          {/* Users Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-800 flex items-center">
                <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">{users.length}</span>
                Tenant Users
              </h4>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  showCreateUser 
                    ? 'bg-slate-200 text-slate-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg'
                }`}
              >
                {showCreateUser ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span>Add New User</span>
                  </>
                )}
              </button>
            </div>

            {/* Create User Form - Collapsible */}
            {showCreateUser && (
              <div className="p-6 bg-indigo-50/50 border-b border-indigo-100 animate-fade-in">
                <h5 className="text-sm font-bold text-indigo-900 mb-4 uppercase tracking-wide">New User Details</h5>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">First Name</label>
                    <input
                      type="text"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => handleRoleChange(e, newUser, setNewUser)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="doctor">Doctor</option>
                      <option value="nurse">Nurse</option>
                      <option value="nurse_accounts">Nurse (Mini Accounts)</option>
                      <option value="receptionist">Receptionist</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium text-sm shadow-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users List Table */}
            <div className="overflow-x-auto">
              {loading && users.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50">
                  <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg font-medium text-slate-600">No users found</p>
                  <p className="text-sm mt-1">Get started by adding a user to this tenant.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm mr-3 border border-indigo-200">
                              {getInitials(user.firstName, user.lastName)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                            {user.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleStatusChange(user.id, user.isActive ? 'false' : 'true')}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                              user.isActive 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setUserToReset(user.id);
                                setShowPasswordModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 16.536L14 19l-4 4-4-4 2.464-2.464L10.257 14.257A6 6 0 0118 10a2 2 0 01-2 2z" /></svg>
                            </button>
                            <button
                              onClick={() => {
                                setUserToDelete(user.id);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Delete" size="sm">
          <div className="space-y-4">
            <p className="text-slate-600">Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                Delete User
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Reset Password" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Enter a new password for the user. They will be required to change it upon first login.</p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={newPassword.length < 8}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
              >
                Reset Password
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* User Credentials Modal - Moved to end for stacking context */}
      {createdUserCredentials && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            <div className="bg-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">User Created Successfully!</h3>
              <p className="text-emerald-100 text-sm mt-1">Please save these credentials immediately.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="mb-3">
                  <label className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Email Address</label>
                  <div className="flex items-center justify-between">
                    <code className="text-slate-900 font-mono text-sm">{createdUserCredentials.email}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(createdUserCredentials.email)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Copy Email"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Temporary Password</label>
                  <div className="flex items-center justify-between">
                    <code className="text-emerald-600 font-mono text-lg font-bold">{createdUserCredentials.password}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(createdUserCredentials.password)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Copy Password"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>This password will <strong>not</strong> be shown again. The user will be required to change it upon first login.</span>
              </div>
              <button
                onClick={() => setCreatedUserCredentials(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-slate-200"
              >
                I have saved these credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
