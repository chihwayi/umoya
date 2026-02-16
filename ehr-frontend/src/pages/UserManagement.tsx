import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Plus, Edit, Trash2, Key, UserCheck, UserX, Search, Filter, ArrowLeft } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi } from '../services/api';
import CreateUserModal from '../components/CreateUserModal';
import EditUserModal from '../components/EditUserModal';
import PasswordDisplayModal from '../components/PasswordDisplayModal';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  licenseNumber?: string;
  specialization?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { showSuccess, showError, showInfo } = useNotification();

  const roles = ['admin', 'doctor', 'nurse', 'nurse_accounts', 'radiologist', 'lab_tech', 'pharmacist', 'receptionist', 'accounts'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      
      if (!token || !tenantSlug) return;
      
      const response = await ehrApi.getUsers(token, tenantSlug, roleFilter);
      setUsers(response.data);
    } catch (error) {
      showError('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditUser = (user: User) => {
    setEditingUser(user);
  };

  const handleUpdateUser = async (updated: Partial<User>) => {
    if (!editingUser || !tenantSlug) return;
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      const payload = {
        firstName: updated.firstName ?? editingUser.firstName,
        lastName: updated.lastName ?? editingUser.lastName,
        email: updated.email ?? editingUser.email,
        phone: updated.phone ?? editingUser.phone,
        role: updated.role ?? editingUser.role,
        licenseNumber: updated.licenseNumber ?? editingUser.licenseNumber,
        specialization: updated.specialization ?? editingUser.specialization,
      };

      await ehrApi.updateUser(editingUser.id, payload, token, tenantSlug);
      showSuccess('User Updated', 'User details have been updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      showError('Error', 'Failed to update user');
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    try {
      const token = localStorage.getItem('ehr_token');
      
      if (!token || !tenantSlug) return;
      
      const response = await ehrApi.resetUserPassword(userId, token, tenantSlug);
      const user = users.find(u => u.id === userId);
      setResetUser({
        name: userName,
        email: user?.email || '',
        tempPassword: response.data.tempPassword
      });
      setShowPasswordModal(true);
      fetchUsers();
    } catch (error) {
      showError('Error', 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('ehr_token');
      
      if (!token || !tenantSlug) return;
      
      if (currentStatus) {
        await ehrApi.deactivateUser(userId, token, tenantSlug);
        showInfo('User Deactivated', 'User has been deactivated');
      } else {
        await ehrApi.activateUser(userId, token, tenantSlug);
        showSuccess('User Activated', 'User has been activated');
      }
      
      fetchUsers();
    } catch (error) {
      showError('Error', 'Failed to update user status');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'doctor': return 'bg-blue-100 text-blue-800';
      case 'nurse': return 'bg-green-100 text-green-800';
      case 'nurse_accounts': return 'bg-emerald-100 text-emerald-800';
      case 'receptionist': return 'bg-orange-100 text-orange-800';
      case 'pharmacist': return 'bg-teal-100 text-teal-800';
      case 'lab_tech':
      case 'lab_technician':
        return 'bg-cyan-100 text-cyan-800';
      case 'radiologist': return 'bg-rose-100 text-rose-700';
      case 'accounts': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Dashboard</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-600">Manage clinic staff and permissions</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').replace(/\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
            {/* User Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user.firstName[0]}{user.lastName[0]}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{user.firstName} {user.lastName}</h3>
                  <p className="text-sm text-slate-600">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                  {user.role}
                </span>
                {user.isActive ? (
                  <UserCheck className="w-4 h-4 text-green-500" />
                ) : (
                  <UserX className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-2 mb-4">
              <p className="text-sm text-slate-600">📞 {user.phone}</p>
              {user.licenseNumber && (
                <p className="text-sm text-slate-600">🏥 License: {user.licenseNumber}</p>
              )}
              {user.specialization && (
                <p className="text-sm text-slate-600">⚕️ {user.specialization}</p>
              )}
              {user.mustChangePassword && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Must change password
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResetPassword(user.id, `${user.firstName} ${user.lastName}`)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                <Key className="w-3 h-3" />
                Reset
              </button>
              
              <button
                onClick={() => handleToggleStatus(user.id, user.isActive)}
                className={`flex items-center gap-1 px-3 py-1 text-xs rounded-lg transition-colors ${
                  user.isActive 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {user.isActive ? (
                  <>
                    <UserX className="w-3 h-3" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3 h-3" />
                    Activate
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleEditUser(user)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">No users found</h3>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={fetchUsers}
        tenantSlug={tenantSlug!}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

      {/* Password Display Modal */}
      <PasswordDisplayModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userName={resetUser?.name || ''}
        email={resetUser?.email || ''}
        tempPassword={resetUser?.tempPassword || ''}
      />
    </div>
  );
};

export default UserManagement;
