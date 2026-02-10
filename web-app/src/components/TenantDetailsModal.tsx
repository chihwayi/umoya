import React, { useState, useEffect } from 'react';
import { Tenant, TenantUser, CreateTenantUserRequest } from '../types';
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

  useEffect(() => {
    if (tenant && isOpen) {
      loadUsers();
    } else {
      setUsers([]); // Clear users when closed or tenant cleared
    }
  }, [tenant, isOpen]);

  const loadUsers = async () => {
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
              <div className="w-16 h-16 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.clinicName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-400">{tenant.clinicName.charAt(0)}</span>
                )}
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