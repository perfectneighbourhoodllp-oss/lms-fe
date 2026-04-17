import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../utils/api';

const TYPE_COLORS = {
  call: 'bg-blue-100 text-blue-800',
  email: 'bg-purple-100 text-purple-800',
  meeting: 'bg-orange-100 text-orange-800',
  note: 'bg-gray-100 text-gray-700',
  task: 'bg-yellow-100 text-yellow-800',
};

export default function Activities() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => api.get('/activities').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/activities', body),
    onSuccess: () => { qc.invalidateQueries(['activities']); setShowForm(false); reset(); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }) => api.put(`/activities/${id}`, { completed }),
    onSuccess: () => qc.invalidateQueries(['activities']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/activities/${id}`),
    onSuccess: () => qc.invalidateQueries(['activities']),
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-900">Activities</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary w-full sm:w-auto">+ New Activity</button>
      </div>

      {isLoading ? <p className="text-gray-500">Loading...</p> : (
        <div className="space-y-3">
          {activities?.map((a) => (
            <div key={a._id} className={`card p-4 flex items-start gap-3 ${a.completed ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={a.completed}
                onChange={() => toggleMutation.mutate({ id: a._id, completed: !a.completed })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`badge ${TYPE_COLORS[a.type]}`}>{a.type}</span>
                  <span className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : ''}`}>{a.title}</span>
                </div>
                {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {a.lead && <span>Lead: {a.lead.name}</span>}
                  {a.dueDate && <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>}
                  {a.createdBy && <span>By: {a.createdBy.name}</span>}
                </div>
              </div>
              <button onClick={() => deleteMutation.mutate(a._id)} className="btn-danger text-xs py-1 px-2 flex-shrink-0">Delete</button>
            </div>
          ))}
          {!activities?.length && <p className="text-center text-gray-400 py-16">No activities yet.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-base text-gray-800">New Activity</h3>
              <button onClick={() => { setShowForm(false); reset(); }} className="btn-ghost text-sm px-2 py-1" aria-label="Close">Close</button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="p-5 space-y-3">
              <div>
                <label className="label">Type *</label>
                <select className="input" {...register('type', { required: true })}>
                  {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Title *</label>
                <input className="input" {...register('title', { required: true })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} {...register('description')} />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" {...register('dueDate')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
