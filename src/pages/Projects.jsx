import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import api from '../utils/api';

const PROJECT_TYPES = ['Residential', 'Commercial', 'Plots', 'Villa'];

const projectService = {
  getAll: () => api.get('/projects').then((r) => r.data),
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),
  assignAgents: (id, agentIds) =>
    api.put(`/projects/${id}/assign-agents`, { agentIds }).then((r) => r.data),
};

const userService = {
  getAll: () => api.get('/users').then((r) => r.data),
};

/* ─── Agent Assignment Panel ──────────────────────────────── */
function AssignAgentsPanel({ project, allUsers, onSave, onClose }) {
  const salesUsers = allUsers.filter((u) => u.role === 'sales' || u.role === 'manager');
  const currentIds = new Set((project.assignedAgents || []).map((a) => a._id || a));
  const [selected, setSelected] = useState(new Set(currentIds));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-base text-gray-800">Assign Agents</h2>
            <p className="text-xs text-gray-400 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {salesUsers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No sales agents found.</p>
          )}
          {salesUsers.map((u) => (
            <label
              key={u._id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                selected.has(u._id) ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(u._id)}
                onChange={() => toggle(u._id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{u.name}</p>
                <p className="text-xs text-gray-400">{u.email} · {u.role}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="px-4 pb-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onSave([...selected])}
            className="btn-primary flex-1"
          >
            Save ({selected.size} agent{selected.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create / Edit Modal ─────────────────────────────────── */
function ProjectFormModal({ project, onClose, onSubmit, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: project
      ? { name: project.name, developer: project.developer, location: project.location, type: project.type, notes: project.notes }
      : { type: 'Residential' },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
          <div>
            <label className="label">Project Name *</label>
            <input
              className="input"
              placeholder="e.g. Prestige Sunrise"
              {...register('name', { required: 'Project name is required' })}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Developer</label>
              <input className="input" placeholder="e.g. Prestige Group" {...register('developer')} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" {...register('type')}>
                {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <input className="input" placeholder="e.g. Whitefield, Bangalore" {...register('location')} />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? 'Saving...' : project ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function Projects() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [assignPanel, setAssignPanel] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    enabled: canEdit,
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); toast.success('Project created'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => projectService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setEditProject(null); toast.success('Project updated'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project deleted'); },
    onError: () => toast.error('Delete failed'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, agentIds }) => projectService.assignAgents(id, agentIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setAssignPanel(null); toast.success('Agents updated'); },
    onError: () => toast.error('Failed to assign agents'),
  });

  const TYPE_COLOR = {
    Residential: 'bg-blue-100 text-blue-700',
    Commercial: 'bg-purple-100 text-purple-700',
    Plots: 'bg-yellow-100 text-yellow-700',
    Villa: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage projects and agent assignments</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="btn-primary w-full sm:w-auto">
            + New Project
          </button>
        )}
      </div>

      {/* Project cards */}
      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-10">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p._id} className={`card card-body ${!p.isActive ? 'opacity-60' : ''}`}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    <span className={`badge text-[10px] ${TYPE_COLOR[p.type] || 'bg-gray-100 text-gray-600'}`}>
                      {p.type}
                    </span>
                    {!p.isActive && (
                      <span className="badge bg-red-100 text-red-600 text-[10px]">Inactive</span>
                    )}
                  </div>
                  {p.developer && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.developer}</p>
                  )}
                  {p.location && (
                    <p className="text-xs text-gray-400">📍 {p.location}</p>
                  )}
                </div>
              </div>

              {/* Assigned agents */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  Assigned Agents ({p.assignedAgents?.length || 0})
                </p>
                {p.assignedAgents?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.assignedAgents.map((agent) => (
                      <span
                        key={agent._id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                      >
                        <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {agent.name?.[0]?.toUpperCase()}
                        </span>
                        {agent.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-orange-500 italic">
                    ⚠ No agents assigned — leads will fall back to creator
                  </p>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => setAssignPanel(p)}
                    className="btn-secondary w-full sm:flex-1 text-xs py-1.5"
                  >
                    👥 Assign Agents
                  </button>
                  <button
                    onClick={() => setEditProject(p)}
                    className="btn-secondary w-full sm:flex-1 text-xs py-1.5"
                  >
                    Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteProject(p)}
                      className="btn-danger text-xs py-1.5 px-3 w-full sm:w-auto"
                    >
                      Del
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !projects.length && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏗</p>
          <p className="text-sm">No projects yet. Create one to start auto-assigning leads.</p>
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <ProjectFormModal
          onClose={() => setShowForm(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit modal */}
      {editProject && (
        <ProjectFormModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editProject._id, ...data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Agent assignment panel */}
      {assignPanel && (
        <AssignAgentsPanel
          project={assignPanel}
          allUsers={allUsers}
          onClose={() => setAssignPanel(null)}
          onSave={(agentIds) => assignMutation.mutate({ id: assignPanel._id, agentIds })}
        />
      )}

      {deleteProject && (
        <ConfirmModal
          title="Delete Project"
          message={`Delete "${deleteProject.name}"? This won't delete its leads, but they will no longer be linked to this project.`}
          confirmLabel="Delete"
          onConfirm={() => { deleteMutation.mutate(deleteProject._id); setDeleteProject(null); }}
          onCancel={() => setDeleteProject(null)}
        />
      )}
    </div>
  );
}
