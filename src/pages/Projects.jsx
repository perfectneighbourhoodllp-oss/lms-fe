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
  assignAgents: (id, agentIds, agentWeights) =>
    api
      .put(`/projects/${id}/assign-agents`, { agentIds, agentWeights })
      .then((r) => r.data),
  assignManagers: (id, managerIds) =>
    api.put(`/projects/${id}/assign-managers`, { managerIds }).then((r) => r.data),
};

const userService = {
  getAll: () => api.get('/users').then((r) => r.data),
};

/* ─── Agent Assignment Panel ──────────────────────────────── */
function AssignAgentsPanel({ project, allUsers, onSave, onClose }) {
  const salesUsers = allUsers.filter((u) => u.role === 'sales' || u.role === 'manager');
  const currentIds = new Set((project.assignedAgents || []).map((a) => a._id || a));
  const [selected, setSelected] = useState(new Set(currentIds));
  // Hydrate weights from the project; default to 1 for any selected agent missing an entry
  const [weights, setWeights] = useState(() => {
    const w = {};
    for (const id of currentIds) {
      w[id] = project.agentWeights?.[id] ?? 1;
    }
    return w;
  });

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-init weight to 1 the first time an agent is selected
        if (weights[id] === undefined) {
          setWeights((w) => ({ ...w, [id]: 1 }));
        }
      }
      return next;
    });
  };

  const setWeight = (id, value) => {
    // Clamp to 1–10 on the way in; allow empty string transiently for editing
    if (value === '') {
      setWeights((w) => ({ ...w, [id]: '' }));
      return;
    }
    const n = Math.max(1, Math.min(10, Math.floor(Number(value) || 1)));
    setWeights((w) => ({ ...w, [id]: n }));
  };

  const resetToEqual = () => {
    const reset = {};
    for (const id of selected) reset[id] = 1;
    setWeights(reset);
  };

  // Compute share % for each selected agent
  const selectedIds = [...selected];
  const totalWeight = selectedIds.reduce((sum, id) => sum + (Number(weights[id]) || 1), 0);
  const hasCustomWeights = selectedIds.some((id) => (Number(weights[id]) || 1) !== 1);

  const handleSave = () => {
    // Build a clean weights map keyed only by selected IDs, with numeric values
    const clean = {};
    for (const id of selectedIds) {
      clean[id] = Math.max(1, Math.min(10, Math.floor(Number(weights[id]) || 1)));
    }
    onSave(selectedIds, clean);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-base text-gray-800">Assign Agents</h2>
            <p className="text-xs text-gray-400 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <div className="px-4 pt-3 pb-1 text-[11px] text-gray-500 flex items-center justify-between">
          <span>Set proportion via per-agent weight (1–10)</span>
          {hasCustomWeights && (
            <button
              onClick={resetToEqual}
              className="text-blue-600 hover:underline"
              type="button"
            >
              Reset to equal
            </button>
          )}
        </div>

        <div className="p-4 pt-2 space-y-2 overflow-y-auto flex-1">
          {salesUsers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No sales agents found.</p>
          )}
          {salesUsers.map((u) => {
            const isSelected = selected.has(u._id);
            const w = Number(weights[u._id]) || 1;
            const share = isSelected && totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0;
            return (
              <div
                key={u._id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(u._id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                  aria-label={`Select ${u.name}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email} · {u.role}</p>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={weights[u._id] ?? 1}
                      onChange={(e) => setWeight(u._id, e.target.value)}
                      onBlur={(e) => setWeight(u._id, e.target.value || 1)}
                      className="w-14 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:border-blue-400 focus:outline-none"
                      aria-label={`Weight for ${u.name}`}
                    />
                    <span className="badge bg-blue-100 text-blue-700 min-w-[3rem] text-center">
                      {share}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selected.size > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-600 flex items-center justify-between">
            <span>
              Total weight: <span className="font-semibold text-gray-800">{totalWeight}</span>
            </span>
            <span className="text-gray-500">
              1 cycle = {totalWeight} lead{totalWeight !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="p-4 flex gap-3 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={selected.size === 0}
          >
            Save ({selected.size} agent{selected.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Manager Assignment Panel (admin only) ───────────────── */
function AssignManagersPanel({ project, allUsers, onSave, onClose }) {
  const managerUsers = allUsers.filter((u) => u.role === 'manager');
  const currentIds = new Set((project.assignedManagers || []).map((m) => m._id || m));
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
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-base text-gray-800">Assign Managers</h2>
            <p className="text-xs text-gray-400 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <div className="px-4 pt-3 pb-1 text-[11px] text-gray-500">
          Managers selected here will be scoped to this project (and any others they're
          assigned to). Managers with zero project assignments see everything by default.
        </div>

        <div className="p-4 pt-2 space-y-2 overflow-y-auto flex-1">
          {managerUsers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No manager users found. Create one in Team page.
            </p>
          )}
          {managerUsers.map((u) => {
            const isSelected = selected.has(u._id);
            return (
              <label
                key={u._id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                  isSelected ? 'border-purple-300 bg-purple-50' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(u._id)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span className="badge bg-blue-100 text-blue-700">{u.role}</span>
              </label>
            );
          })}
        </div>

        <div className="p-4 flex gap-3 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave([...selected])} className="btn-primary flex-1">
            Save ({selected.size} manager{selected.size !== 1 ? 's' : ''})
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

  // Per-project WhatsApp qualification options (configuration + budget bands).
  // Configs are edited as a comma-separated string; bands as label + ₹L rows.
  const [configs, setConfigs] = useState((project?.waConfig?.configurations || []).join(', '));
  const [bands, setBands] = useState(
    (project?.waConfig?.budgetBands || []).map((b) => ({ label: b.label, valueLakh: String(b.valueLakh) }))
  );

  const addBand = () => setBands((b) => [...b, { label: '', valueLakh: '' }]);
  const updateBand = (i, key, val) =>
    setBands((b) => b.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  const removeBand = (i) => setBands((b) => b.filter((_, idx) => idx !== i));

  const submit = (data) => {
    const configurations = configs.split(',').map((s) => s.trim()).filter(Boolean);
    const budgetBands = bands
      .map((b) => ({ label: b.label.trim(), valueLakh: Number(b.valueLakh) }))
      .filter((b) => b.label && Number.isFinite(b.valueLakh));
    onSubmit({ ...data, waConfig: { configurations, budgetBands } });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="p-5 space-y-3 overflow-y-auto">
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

          {/* WhatsApp qualification options */}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">💬 WhatsApp qualification</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Options the WhatsApp bot offers leads for this project. Leave blank to use defaults.
              </p>
            </div>

            <div>
              <label className="label">Configurations</label>
              <input
                className="input"
                placeholder="e.g. 2 BHK, 3 BHK, Plot"
                value={configs}
                onChange={(e) => setConfigs(e.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Comma-separated. More than 3 shows as a list on WhatsApp.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Budget bands</label>
                <button type="button" onClick={addBand} className="text-xs text-blue-600 hover:underline">
                  + Add band
                </button>
              </div>
              {bands.length === 0 && (
                <p className="text-[11px] text-gray-400">No bands — the default ₹ ranges will be used.</p>
              )}
              <div className="space-y-2">
                {bands.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Label, e.g. ₹1 – 2 Cr"
                      value={b.label}
                      onChange={(e) => updateBand(i, 'label', e.target.value)}
                    />
                    <input
                      type="number"
                      className="input w-24"
                      placeholder="₹L"
                      value={b.valueLakh}
                      onChange={(e) => updateBand(i, 'valueLakh', e.target.value)}
                      aria-label="Value in lakh"
                    />
                    <button
                      type="button"
                      onClick={() => removeBand(i)}
                      className="btn-ghost text-lg px-2 text-gray-400 hover:text-red-500"
                      aria-label="Remove band"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
  const isAdmin = user?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [assignPanel, setAssignPanel] = useState(null);
  const [managersPanel, setManagersPanel] = useState(null);
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
    mutationFn: ({ id, agentIds, agentWeights }) =>
      projectService.assignAgents(id, agentIds, agentWeights),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setAssignPanel(null); toast.success('Agents updated'); },
    onError: () => toast.error('Failed to assign agents'),
  });

  const assignManagersMutation = useMutation({
    mutationFn: ({ id, managerIds }) => projectService.assignManagers(id, managerIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setManagersPanel(null);
      toast.success('Managers updated');
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to assign managers'),
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
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-500">
                    Assigned Agents ({p.assignedAgents?.length || 0})
                  </p>
                  {p.agentWeights && Object.keys(p.agentWeights).length > 0 && (
                    <span className="text-[10px] text-purple-600 font-medium">⚖ Proportional</span>
                  )}
                </div>
                {p.assignedAgents?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const totalW = p.assignedAgents.reduce(
                        (sum, a) => sum + (Number(p.agentWeights?.[a._id]) || 1),
                        0
                      );
                      return p.assignedAgents.map((agent) => {
                        const w = Number(p.agentWeights?.[agent._id]) || 1;
                        const share = totalW > 0 ? Math.round((w / totalW) * 100) : 0;
                        const isCustom = w !== 1;
                        return (
                          <span
                            key={agent._id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                            title={`Weight ${w} · ${share}% share`}
                          >
                            <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                              {agent.name?.[0]?.toUpperCase()}
                            </span>
                            {agent.name}
                            {isCustom && (
                              <span className="ml-0.5 px-1 bg-blue-200 rounded-full text-[9px] font-bold">
                                ×{w}
                              </span>
                            )}
                          </span>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-orange-500 italic">
                    ⚠ No agents assigned — leads will fall back to creator
                  </p>
                )}
              </div>

              {/* Assigned managers */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  Project Managers ({p.assignedManagers?.length || 0})
                </p>
                {p.assignedManagers?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.assignedManagers.map((m) => (
                      <span
                        key={m._id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs"
                        title={`${m.email} · scoped to this project`}
                      >
                        <span className="w-4 h-4 bg-purple-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {m.name?.[0]?.toUpperCase()}
                        </span>
                        {m.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No specific manager — all unscoped managers can see this project
                  </p>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => setAssignPanel(p)}
                    className="btn-secondary w-full sm:flex-1 text-xs py-1.5"
                  >
                    👥 Assign Agents
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setManagersPanel(p)}
                      className="btn-secondary w-full sm:flex-1 text-xs py-1.5"
                    >
                      🧑‍💼 Managers
                    </button>
                  )}
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
          onSave={(agentIds, agentWeights) =>
            assignMutation.mutate({ id: assignPanel._id, agentIds, agentWeights })
          }
        />
      )}

      {/* Manager assignment panel (admin only) */}
      {managersPanel && (
        <AssignManagersPanel
          project={managersPanel}
          allUsers={allUsers}
          onClose={() => setManagersPanel(null)}
          onSave={(managerIds) =>
            assignManagersMutation.mutate({ id: managersPanel._id, managerIds })
          }
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
