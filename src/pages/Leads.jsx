import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { leadService, userService, projectService } from '../services/leadService';
import LeadTable, { STATUSES, SOURCES } from '../components/LeadTable';
import LeadDrawer from '../components/LeadDrawer';
import AddLeadModal from '../components/AddLeadModal';
import BulkUploadModal from '../components/BulkUploadModal';
import ConfirmModal from '../components/ConfirmModal';

export default function Leads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canAssign = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [followUpFrom, setFollowUpFrom] = useState('');
  const [followUpTo, setFollowUpTo] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  // Read ?assignedTo=<userId> from URL so clicking an agent in Agent Performance pre-filters here
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const assignedTo = searchParams.get('assignedTo');
    if (assignedTo) setAgentFilter(assignedTo);
  }, [searchParams]);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter, sourceFilter, projectFilter, agentFilter, createdFrom, createdTo, followUpFrom, followUpTo, page],
    queryFn: () =>
      leadService.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        project: projectFilter || undefined,
        assignedTo: agentFilter || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        followUpFrom: followUpFrom || undefined,
        followUpTo: followUpTo || undefined,
        page,
        limit: 30,
      }),
  });

  const leads = leadsData?.leads ?? [];
  const totalLeads = leadsData?.total ?? 0;
  const totalPages = leadsData?.pages ?? 1;

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    enabled: canAssign,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: leadService.create,
    onSuccess: ({ duplicate }) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setShowAdd(false);
      toast.success(duplicate ? 'Duplicate found — lead updated instead' : 'Lead added!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add lead'),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, ...data }) => leadService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['today-followups'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      toast.success('Lead updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const remarkMutation = useMutation({
    mutationFn: ({ id, text }) => leadService.addRemark(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Remark added');
    },
    onError: () => toast.error('Failed to add remark'),
  });

  const deleteMutation = useMutation({
    mutationFn: leadService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Lead deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  const bulkMutation = useMutation({
    mutationFn: leadService.bulkUpload,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Uploaded: ${result.added} added, ${result.updated} updated`);
      return result;
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Upload failed');
      return null;
    },
  });

  const handleBulkUpload = async (file) => {
    const result = await bulkMutation.mutateAsync(file).catch(() => null);
    return result;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await leadService.exportCsv({
        search: search || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        project: projectFilter || undefined,
        assignedTo: agentFilter || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        followUpFrom: followUpFrom || undefined,
        followUpTo: followUpTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `leads-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalLeads} lead{totalLeads !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary flex-1 sm:flex-none"
          >
            {exporting ? 'Exporting…' : '⬇ Export'}
          </button>
          {canAssign && (
            <button onClick={() => setShowBulk(true)} className="btn-secondary flex-1 sm:flex-none">
              ⬆ Bulk Upload
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary flex-1 sm:flex-none">
            + Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input w-full sm:max-w-xs"
          placeholder="Search name, phone, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-full sm:w-36"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className="input w-full sm:w-36"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className="input w-full sm:w-40"
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        {canAssign && (
          <select
            className="input w-full sm:w-40"
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Agents</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        )}
        {(search || statusFilter || sourceFilter || projectFilter || agentFilter || createdFrom || createdTo || followUpFrom || followUpTo) && (
          <button
            onClick={() => {
              setSearch(''); setStatusFilter(''); setSourceFilter('');
              setProjectFilter(''); setAgentFilter('');
              setCreatedFrom(''); setCreatedTo('');
              setFollowUpFrom(''); setFollowUpTo('');
              setPage(1);
            }}
            className="btn-ghost text-xs w-full sm:w-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Date Filters — collapsible */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setDateFilterOpen((o) => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
        >
          <span>{dateFilterOpen ? '▼' : '▶'}</span>
          Date Filters
          {(createdFrom || createdTo || followUpFrom || followUpTo) && (
            <span className="badge bg-blue-100 text-blue-700 text-[10px]">Active</span>
          )}
        </button>
      </div>

      {dateFilterOpen && (
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        {/* Preset buttons — apply to createdAt */}
        <span className="text-gray-500 font-medium">Quick:</span>
        {(() => {
          const fmt = (d) => d.toISOString().slice(0, 10);
          const today = new Date();
          const todayStr = fmt(today);
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const presets = [
            { label: 'Today', from: todayStr, to: todayStr },
            { label: 'This Week', from: fmt(weekStart), to: todayStr },
            { label: 'This Month', from: fmt(monthStart), to: todayStr },
          ];
          return presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setCreatedFrom(p.from); setCreatedTo(p.to); setPage(1); }}
              className={`px-2 py-1 rounded border transition-colors ${
                createdFrom === p.from && createdTo === p.to
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ));
        })()}

        <span className="text-gray-500 font-medium ml-2">Created:</span>
        <input
          type="date"
          value={createdFrom}
          onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }}
          className="input py-1 text-xs"
          placeholder="From"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={createdTo}
          onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }}
          className="input py-1 text-xs"
          placeholder="To"
        />

        <span className="text-gray-500 font-medium ml-2">Follow-up:</span>
        <input
          type="date"
          value={followUpFrom}
          onChange={(e) => { setFollowUpFrom(e.target.value); setPage(1); }}
          className="input py-1 text-xs"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={followUpTo}
          onChange={(e) => { setFollowUpTo(e.target.value); setPage(1); }}
          className="input py-1 text-xs"
        />
      </div>
      )}

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading leads...</div>
        ) : (
          <LeadTable
            leads={leads}
            onSelect={(lead) => setSelectedLeadId(lead._id)}
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          <p className="text-xs text-gray-400 text-center sm:text-left">
            Page {page} of {totalPages} · {totalLeads} total leads
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          users={users}
          canAssign={canAssign}
          isLoading={createMutation.isPending}
        />
      )}

      {showBulk && (
        <BulkUploadModal
          onClose={() => setShowBulk(false)}
          onUpload={handleBulkUpload}
          isLoading={bulkMutation.isPending}
        />
      )}

      {deleteId && (
        <ConfirmModal
          title="Delete Lead"
          message="This lead and all its remarks will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
            setSelectedLeadId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {selectedLeadId && (() => {
        const selectedLead = leads.find((l) => l._id === selectedLeadId);
        if (!selectedLead) return null;
        return (
          <LeadDrawer
            lead={selectedLead}
            onClose={() => setSelectedLeadId(null)}
            onSave={(id, data) => saveMutation.mutate({ id, ...data })}
            onDelete={(id) => setDeleteId(id)}
            onAddRemark={(id, text) => remarkMutation.mutateAsync({ id, text })}
            users={users}
            canAssign={canAssign}
            canDelete={canDelete}
          />
        );
      })()}
    </div>
  );
}


