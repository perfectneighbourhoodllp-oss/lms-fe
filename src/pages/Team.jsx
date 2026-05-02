import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import api from '../utils/api';

const teamService = {
  getAll: () => api.get('/users').then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  resetPassword: (id, password) =>
    api.put(`/users/${id}/reset-password`, { password }).then((r) => r.data),
};

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
};

const ROLE_LABEL = {
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
};

function AgentFormModal({ agent, onClose, onSubmit, isLoading, currentUserRole }) {
  const isEdit = !!agent;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: agent
      ? { name: agent.name, email: agent.email, phone: agent.phone || '', role: agent.role }
      : { role: 'sales' },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">
            {isEdit ? 'Edit Agent' : 'Add New Agent'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-sm px-2 py-1" aria-label="Close">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          <div>
            <label className="label">Full Name *</label>
            <input
              className="input"
              placeholder="e.g. Ravi Kumar"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              className="input"
              placeholder="ravi@yourfirm.com"
              disabled={isEdit}
              {...register('email', { required: 'Email is required' })}
            />
            {isEdit && <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed</p>}
            {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="+91 98765 43210" {...register('phone')} />
          </div>

          {currentUserRole === 'admin' && (
            <div>
              <label className="label">Role</label>
              <select className="input" {...register('role')}>
                <option value="sales">Sales</option>
                <option value="manager">Manager</option>
                {!isEdit && <option value="admin">Admin</option>}
              </select>
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="label">Password *</label>
              <PasswordInput
                className="input"
                placeholder="Min 6 characters"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' },
                })}
              />
              {errors.password && <p className="text-xs text-red-500 mt-0.5">{errors.password.message}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ agent, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();
  const pwd = watch('password', '');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-base text-gray-800">Reset Password</h2>
            <p className="text-xs text-gray-400 mt-0.5">{agent.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm px-2 py-1" aria-label="Close">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          <div>
            <label className="label">New Password *</label>
            <PasswordInput
              className="input"
              placeholder="Min 6 characters"
              {...register('password', { required: true, minLength: { value: 6, message: 'Min 6 chars' } })}
            />
            {errors.password && <p className="text-xs text-red-500 mt-0.5">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Confirm Password *</label>
            <PasswordInput
              className="input"
              placeholder="Repeat password"
              {...register('confirm', {
                required: true,
                validate: (v) => v === pwd || 'Passwords do not match',
              })}
            />
            {errors.confirm && <p className="text-xs text-red-500 mt-0.5">{errors.confirm.message}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Team() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [showAdd, setShowAdd] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [resetAgent, setResetAgent] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-team'],
    queryFn: teamService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: teamService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-team'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowAdd(false);
      toast.success('Agent created');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => teamService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-team'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditAgent(null);
      toast.success('Agent updated');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => teamService.update(id, { isActive }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users-team'] });
      toast.success(vars.isActive ? 'Agent reactivated' : 'Agent deactivated');
    },
    onError: () => toast.error('Action failed'),
  });

  const toggleAvailableMutation = useMutation({
    mutationFn: ({ id, isAvailable }) => teamService.update(id, { isAvailable }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users-team'] });
      toast.success(vars.isAvailable ? 'Agent resumed — receiving leads' : 'Agent paused — no new leads');
    },
    onError: () => toast.error('Action failed'),
  });

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }) => teamService.resetPassword(id, password),
    onSuccess: () => {
      setResetAgent(null);
      toast.success('Password reset');
    },
    onError: () => toast.error('Reset failed'),
  });

  const filtered = roleFilter ? users.filter((u) => u.role === roleFilter) : users;

  const summary = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    sales: users.filter((u) => u.role === 'sales').length,
    manager: users.filter((u) => u.role === 'manager').length,
  };

  const renderActions = (u) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setEditAgent(u)} className="btn-secondary text-xs py-1 px-2">
        Edit
      </button>

      {isAdmin && (
        <button onClick={() => setResetAgent(u)} className="btn-secondary text-xs py-1 px-2">
          Reset Pwd
        </button>
      )}

      {u._id !== user?.id && u.isActive && (
        <button
          onClick={() => toggleAvailableMutation.mutate({ id: u._id, isAvailable: u.isAvailable === false })}
          disabled={toggleAvailableMutation.isPending}
          className={`text-xs py-1 px-2 btn ${
            u.isAvailable !== false
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
              : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
          }`}
          title={u.isAvailable !== false
            ? 'Pause new lead assignments — agent stays logged in'
            : 'Resume — agent will receive new leads again'}
        >
          {u.isAvailable !== false ? 'Pause' : 'Resume'}
        </button>
      )}

      {u._id !== user?.id && (
        <button
          onClick={() => toggleActiveMutation.mutate({ id: u._id, isActive: !u.isActive })}
          className={`text-xs py-1 px-2 btn ${
            u.isActive
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
          }`}
        >
          {u.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary.active} active · {summary.sales} sales · {summary.manager} managers
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary w-full sm:w-auto">
          + Add Agent
        </button>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {['', 'sales', 'manager', 'admin'].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              roleFilter === r
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {r === ''
              ? `All (${users.length})`
              : `${ROLE_LABEL[r]} (${users.filter((u) => u.role === r).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-10">Loading team...</p>
      ) : (
        <div className="card overflow-hidden">
          {!filtered.length ? (
            <div className="text-center py-10 text-gray-400 text-sm">No agents found.</div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map((u) => (
                  <div key={u._id} className={`p-4 ${!u.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {u.isActive && u.isAvailable === false && (
                          <span className="badge bg-yellow-100 text-yellow-700">Paused</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-gray-400">Role</p>
                        <p className="text-gray-700 font-medium mt-0.5">{ROLE_LABEL[u.role] || u.role}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-gray-400">Leads</p>
                        <p className="text-gray-700 font-semibold mt-0.5">{u.leadCount}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2 col-span-2">
                        <p className="text-gray-400">Phone</p>
                        <p className="text-gray-700 mt-0.5">
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="hover:text-blue-600">{u.phone}</a>
                          ) : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">{renderActions(u)}</div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="th">Agent</th>
                      <th className="th">Role</th>
                      <th className="th">Phone</th>
                      <th className="th">Leads</th>
                      <th className="th">Status</th>
                      <th className="th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((u) => (
                      <tr key={u._id} className={`table-row-hover ${!u.isActive ? 'opacity-50' : ''}`}>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{u.name}</div>
                              <div className="text-xs text-gray-400">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="td">
                          <span className={`badge ${ROLE_STYLE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </td>

                        <td className="td text-gray-500 text-xs">
                          {u.phone ? (
                            <a href={`tel:${u.phone}`} className="hover:text-blue-600">{u.phone}</a>
                          ) : '—'}
                        </td>

                        <td className="td">
                          <span className="font-semibold text-gray-800">{u.leadCount}</span>
                          <span className="text-xs text-gray-400 ml-1">leads</span>
                        </td>

                        <td className="td">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {u.isActive && u.isAvailable === false && (
                              <span className="badge bg-yellow-100 text-yellow-700">Paused</span>
                            )}
                          </div>
                        </td>

                        <td className="td">{renderActions(u)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {showAdd && (
        <AgentFormModal
          onClose={() => setShowAdd(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          currentUserRole={user?.role}
        />
      )}

      {editAgent && (
        <AgentFormModal
          agent={editAgent}
          onClose={() => setEditAgent(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editAgent._id, ...data })}
          isLoading={updateMutation.isPending}
          currentUserRole={user?.role}
        />
      )}

      {resetAgent && (
        <ResetPasswordModal
          agent={resetAgent}
          onClose={() => setResetAgent(null)}
          onSubmit={({ password }) => resetPwdMutation.mutate({ id: resetAgent._id, password })}
          isLoading={resetPwdMutation.isPending}
        />
      )}
    </div>
  );
}

