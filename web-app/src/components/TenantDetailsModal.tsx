import React, { useState, useEffect } from 'react';
import { Tenant, TenantUser, CreateTenantUserRequest } from '../types';
import { tenantAPI } from '../services/api';
import { Modal, ConfirmModal } from './Modal';

interface TenantDetailsModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

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
  const [newUser, setNewUser] = useState<CreateTenantUserRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'admin',
    temporaryPassword: ''
  });

  useEffect(() => {
    if (tenant && isOpen) {
      loadUsers();
    }
  }, [tenant, isOpen]);

  const loadUsers = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await tenantAPI.getTenantUsers(tenant.id);
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    
    setLoading(true);
    try {
      await tenantAPI.createTenantUser(tenant.id, newUser);
      setShowCreateUser(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'admin',
        temporaryPassword: ''
      });
      loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
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
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
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
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !!tenant} onClose={onClose} title={`${tenant?.clinicName || ''} - User Management`} size="xl">
        {tenant && (
          <div className="space-y-6">
            {/* Tenant Info */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">S</span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Status:</span>
                    <span className="ml-2 font-semibold text-slate-800">{tenant.status}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">T</span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Tier:</span>
                    <span className="ml-2 font-semibold text-slate-800">{tenant.subscriptionTier}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Users Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <h4 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <span>Users ({users.length})</span>
              </h4>
              <button
                onClick={() => setShowCreateUser(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add User</span>
              </button>
            </div>

            {/* Create User Form */}
            {showCreateUser && (
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                <h5 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>Create New User</span>
                </h5>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                    required
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="admin">👨💼 Admin</option>
                    <option value="doctor">👨⚕️ Doctor</option>
                    <option value="nurse">👩⚕️ Nurse</option>
                    <option value="receptionist">👩💻 Receptionist</option>
                    <option value="pharmacist">💊 Pharmacist</option>
                  </select>
                  <input
                    type="password"
                    placeholder="Temporary Password (min 8 chars)"
                    value={newUser.temporaryPassword}
                    onChange={(e) => setNewUser({...newUser, temporaryPassword: e.target.value})}
                    className="border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                    minLength={8}
                    required
                  />
                  <div className="md:col-span-2 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span>Create User</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      className="flex-1 bg-slate-500 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="bg-white/80 backdrop-blur-sm p-6 border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{user.fullName.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{user.fullName}</div>
                          <div className="text-sm text-slate-600">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                          {user.role}
                        </span>
                        <span className={`px-3 py-1 rounded-full font-medium ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                        {user.lastLogin && (
                          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                            Last: {new Date(user.lastLogin).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <select
                        value={user.status}
                        onChange={(e) => handleStatusChange(user.id, e.target.value)}
                        className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="active">✅ Active</option>
                        <option value="inactive">⏸️ Inactive</option>
                        <option value="suspended">🚫 Suspended</option>
                      </select>
                      <button
                        onClick={() => {
                          setUserToReset(user.id);
                          setShowPasswordModal(true);
                        }}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>Reset</span>
                      </button>
                      <button
                        onClick={() => {
                          setUserToDelete(user.id);
                          setShowDeleteModal(true);
                        }}
                        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-lg flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Password reset successfully! User must change password on next login.</span>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="inline-flex items-center space-x-2 text-slate-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="font-medium">Loading users...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete User Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone and will permanently remove all user data."
        confirmText="Delete User"
        type="danger"
      />

      {/* Reset Password Modal */}
      <Modal 
        isOpen={showPasswordModal} 
        onClose={() => {
          setShowPasswordModal(false);
          setUserToReset(null);
          setNewPassword('');
        }} 
        title="Reset User Password" 
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600">Enter a new temporary password for this user. They will be required to change it on their next login.</p>
          <input
            type="password"
            placeholder="New temporary password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            minLength={8}
            autoFocus
          />
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setUserToReset(null);
                setNewPassword('');
              }}
              className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={newPassword.length < 8}
              className="flex-1 px-4 py-2 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Password
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};