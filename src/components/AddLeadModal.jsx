import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { STATUSES, SOURCES } from './LeadTable';
import api from '../utils/api';

const fetchProjects = () => api.get('/projects').then((r) => r.data);

export default function AddLeadModal({ onClose, onSubmit, users, canAssign, isLoading }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { source: 'Other', status: 'New' },
  });

  // Dynamic custom fields — array of { key, value } rows
  const [customFields, setCustomFields] = useState([]);
  const addCustomField = () => setCustomFields([...customFields, { key: '', value: '' }]);
  const updateCustom = (i, patch) => setCustomFields(customFields.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCustom = (i) => setCustomFields(customFields.filter((_, idx) => idx !== i));

  const handleFormSubmit = (data) => {
    const cf = {};
    for (const { key, value } of customFields) {
      if (key.trim() && value.trim()) cf[key.trim()] = value.trim();
    }
    // Convert datetime-local string to UTC ISO so server stores absolute time
    // regardless of server timezone (local dev vs UTC production).
    const payload = {
      ...data,
      followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : null,
      customFields: Object.keys(cf).length ? cf : undefined,
    };
    onSubmit(payload);
  };

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const selectedProjectId = watch('project');
  const activeProjects = projects.filter((p) => p.isActive);

  // When a project is selected, show a hint about which agents handle it
  const selectedProject = activeProjects.find((p) => p._id === selectedProjectId);
  const projectAgents = selectedProject?.assignedAgents || [];

  // Clear manual assignedTo override if project changes (auto-assign will kick in)
  useEffect(() => {
    if (selectedProjectId) {
      setValue('assignedTo', '');
    }
  }, [selectedProjectId, setValue]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">Add New Lead</h2>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-5 space-y-3">
          {/* Name */}
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              placeholder="Full name"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="label">Phone *</label>
            <input
              className="input"
              placeholder="+91 98765 43210"
              {...register('phone', { required: 'Phone is required' })}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone.message}</p>}
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Source</label>
              <select className="input" {...register('source')}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" {...register('status')}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="label">Project</label>
            <select className="input" {...register('project')}>
              <option value="">— No Project —</option>
              {activeProjects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}{p.developer ? ` · ${p.developer}` : ''}
                </option>
              ))}
            </select>

            {/* Auto-assign preview */}
            {selectedProject && (
              <div className="mt-1.5 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                {projectAgents.length > 0 ? (
                  <>
                    <span className="font-semibold">Auto-assigned</span> to:{' '}
                    {projectAgents.map((a) => a.name).join(', ')} (round-robin)
                  </>
                ) : (
                  <span className="text-orange-600">
                    ⚠ No agents on this project yet — lead will be assigned to you
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Follow-up date & time */}
          <div>
            <label className="label">Follow-up Date & Time</label>
            <input type="datetime-local" className="input" {...register('followUpDate')} />
            <p className="text-xs text-gray-400 mt-1">Email reminder will be sent at this time.</p>
          </div>

          {/* Manual override for assign (admin/manager only) */}
          {canAssign && users && (
            <div>
              <label className="label">
                Assign To
                {selectedProject && projectAgents.length > 0 && (
                  <span className="text-gray-400 font-normal ml-1">(overrides project auto-assign)</span>
                )}
              </label>
              <select className="input" {...register('assignedTo')}>
                <option value="">
                  {selectedProject && projectAgents.length > 0
                    ? '— Use project auto-assign —'
                    : '— Unassigned (assign to me) —'}
                </option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Quick notes..."
              {...register('notes')}
            />
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Custom Fields (optional)</label>
              <button
                type="button"
                onClick={addCustomField}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Add field
              </button>
            </div>
            {customFields.length > 0 && (
              <div className="space-y-2">
                {customFields.map((cf, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={cf.key}
                      onChange={(e) => updateCustom(i, { key: e.target.value })}
                      placeholder="Field name (e.g. budget)"
                      className="input py-2 text-xs flex-1"
                    />
                    <input
                      type="text"
                      value={cf.value}
                      onChange={(e) => updateCustom(i, { value: e.target.value })}
                      placeholder="Value"
                      className="input py-2 text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustom(i)}
                      className="text-red-500 hover:text-red-700 text-sm px-1"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
