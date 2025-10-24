import React, { useState, useEffect } from 'react';
import { Tenant, TenantUser, CreateTenantUserRequest } from '../types';
import { tenantAPI } from '../services/api';

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
  const [newUser, setNewUser] = useState<CreateTenantUserRequest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'tenant_admin',
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
        role: 'tenant_admin',
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

  const handleResetPassword = async (userId: string) => {
    if (!tenant) return;
    
    const newPassword = prompt('Enter new temporary password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) return;
    
    try {
      await tenantAPI.resetUserPassword(tenant.id, userId, newPassword);
      alert('Password reset successfully. User must change password on next login.');
    } catch (error) {
      console.error('Failed to reset password:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!tenant) return;
    
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await tenantAPI.deleteUser(tenant.id, userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  if (!isOpen || !tenant) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-medium text-gray-900">
            {tenant.clinicName} - User Management
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Status:</strong> {tenant.status}</div>
            <div><strong>Tier:</strong> {tenant.subscriptionTier}</div>
            <div><strong>Subdomain:</strong> {tenant.subdomain}.medicore.co.zw</div>
            <div><strong>Database:</strong> {tenant.databaseName}</div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium">Users ({users.length})</h4>
          <button
            onClick={() => setShowCreateUser(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + Add User
          </button>
        </div>

        {showCreateUser && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h5 className="font-medium mb-3">Create New User</h5>
            <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="First Name"
                value={newUser.firstName}
                onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newUser.lastName}
                onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                className="border rounded px-3 py-2"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                className="border rounded px-3 py-2"
              >
                <option value="tenant_admin">Tenant Admin</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="receptionist">Receptionist</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="lab_technician">Lab Technician</option>
                <option value="accountant">Accountant</option>
              </select>
              <input
                type="password"
                placeholder="Temporary Password (min 8 chars)"
                value={newUser.temporaryPassword}
                onChange={(e) => setNewUser({...newUser, temporaryPassword: e.target.value})}
                className="border rounded px-3 py-2"
                minLength={8}
                required
              />
              <div className="col-span-2 flex space-x-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{user.fullName}</div>
                <div className="text-sm text-gray-600">
                  {user.email} • {user.role} • {user.status}
                </div>
                {user.lastLogin && (
                  <div className="text-xs text-gray-500">
                    Last login: {new Date(user.lastLogin).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <select
                  value={user.status}
                  onChange={(e) => handleStatusChange(user.id, e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
                <button
                  onClick={() => handleResetPassword(user.id)}
                  className="text-sm px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Reset Password
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
};