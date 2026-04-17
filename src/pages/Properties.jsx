import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../utils/api';

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-800',
  'under-offer': 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-800',
  rented: 'bg-blue-100 text-blue-800',
  'off-market': 'bg-red-100 text-red-800',
};

export default function Properties() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['properties', search, statusFilter],
    queryFn: () =>
      api.get('/properties', { params: { search, status: statusFilter } }).then((r) => r.data),
  });

  const { register, handleSubmit, reset, setValue } = useForm();

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/properties', body),
    onSuccess: () => { qc.invalidateQueries(['properties']); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/properties/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['properties']); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries(['properties']),
  });

  const openEdit = (p) => {
    setEditing(p);
    setValue('title', p.title);
    setValue('type', p.type);
    setValue('status', p.status);
    setValue('price', p.price);
    setValue('bedrooms', p.bedrooms);
    setValue('bathrooms', p.bathrooms);
    setValue('area', p.area);
    setValue('description', p.description);
    setValue('address.street', p.address?.street);
    setValue('address.city', p.address?.city);
    setValue('address.state', p.address?.state);
    setValue('address.zip', p.address?.zip);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); reset(); };

  const onSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing._id, ...data });
    else createMutation.mutate(data);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Properties</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary w-full sm:w-auto">+ New Property</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <input className="input w-full sm:max-w-xs" placeholder="Search title, city..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-full sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-gray-500">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.properties?.map((p) => (
            <div key={p._id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-base leading-tight">{p.title}</h3>
                <span className={`badge ${STATUS_COLORS[p.status]} ml-2 flex-shrink-0`}>{p.status}</span>
              </div>
              <p className="text-primary-600 font-bold text-lg mb-1">${p.price?.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mb-2 capitalize">{p.type}</p>
              {p.address?.city && <p className="text-xs text-gray-400">{p.address.city}{p.address.state ? `, ${p.address.state}` : ''}</p>}
              <div className="flex gap-3 text-xs text-gray-500 mt-2">
                {p.bedrooms && <span>{p.bedrooms} bed</span>}
                {p.bathrooms && <span>{p.bathrooms} bath</span>}
                {p.area && <span>{p.area} sqft</span>}
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => openEdit(p)} className="btn-secondary flex-1 text-xs">Edit</button>
                <button onClick={() => deleteMutation.mutate(p._id)} className="btn-danger flex-1 text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && !data?.properties?.length && (
        <p className="text-center text-gray-400 py-16">No properties found.</p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-base text-gray-800">{editing ? 'Edit Property' : 'New Property'}</h3>
              <button onClick={closeForm} className="btn-ghost text-sm px-2 py-1" aria-label="Close">Close</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input" {...register('title', { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type *</label>
                  <select className="input" {...register('type', { required: true })}>
                    {['residential', 'commercial', 'land', 'rental'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" {...register('status')}>
                    {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Price ($) *</label>
                  <input type="number" className="input" {...register('price', { required: true })} />
                </div>
                <div>
                  <label className="label">Area (sqft)</label>
                  <input type="number" className="input" {...register('area')} />
                </div>
                <div>
                  <label className="label">Bedrooms</label>
                  <input type="number" className="input" {...register('bedrooms')} />
                </div>
                <div>
                  <label className="label">Bathrooms</label>
                  <input type="number" className="input" {...register('bathrooms')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Street</label>
                  <input className="input" {...register('address.street')} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" {...register('address.city')} />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" {...register('address.state')} />
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input className="input" {...register('address.zip')} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} {...register('description')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
