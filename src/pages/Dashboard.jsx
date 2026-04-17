import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { leadService, userService } from '../services/leadService';
import StatCard from '../components/StatCard';
import LeadTable from '../components/LeadTable';
import LeadDrawer from '../components/LeadDrawer';
import ConfirmModal from '../components/ConfirmModal';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSales = user?.role === 'sales';
  const canAssign = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: leadService.getStats });
  const { data: todayLeads = [], isLoading: todayLoading } = useQuery({
    queryKey: ['today-followups'],
    queryFn: leadService.getTodayFollowups,
  });
  const { data: overdueLeads = [], isLoading: overdueLoading } = useQuery({
    queryKey: ['overdue'],
    queryFn: leadService.getOverdue,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    enabled: canAssign,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, ...data }) => leadService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-followups'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const remarkMutation = useMutation({
    mutationFn: ({ id, text }) => leadService.addRemark(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-followups'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      toast.success('Remark added');
    },
    onError: () => toast.error('Failed to add remark'),
  });

  const deleteMutation = useMutation({
    mutationFn: leadService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-followups'] });
      qc.invalidateQueries({ queryKey: ['overdue'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Lead deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  // Find the selected lead from whichever list it's in
  const selectedLead = selectedLeadId
    ? [...todayLeads, ...overdueLeads].find((l) => l._id === selectedLeadId)
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
        <StatCard
          label={isSales ? 'Assigned to Me' : 'Total Leads'}
          value={stats?.total}
          icon="👥"
        />
        <StatCard
          label="Follow-ups Today"
          value={stats?.todayFollowups}
          color="text-blue-600"
          icon="📅"
        />
        <StatCard
          label="Overdue"
          value={stats?.overdue}
          color={stats?.overdue > 0 ? 'text-red-600' : 'text-gray-900'}
          icon="⚠️"
        />
        <StatCard
          label="Closed This Month"
          value={stats?.closedMonth}
          color="text-green-600"
          icon="✅"
        />
      </div>

      {/* Today's Follow-ups */}
      <div className="card mb-4">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            📅 Today&apos;s Follow-ups
            {todayLeads.length > 0 && (
              <span className="ml-2 badge bg-blue-100 text-blue-700">{todayLeads.length}</span>
            )}
          </h2>
        </div>
        {todayLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <LeadTable
            leads={todayLeads}
            onSelect={(lead) => setSelectedLeadId(lead._id)}
            compact
          />
        )}
      </div>

      {/* Overdue */}
      <div className="card">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            🔴 Overdue Leads
            {overdueLeads.length > 0 && (
              <span className="ml-2 badge bg-red-100 text-red-700">{overdueLeads.length}</span>
            )}
          </h2>
        </div>
        {overdueLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <LeadTable
            leads={overdueLeads}
            onSelect={(lead) => setSelectedLeadId(lead._id)}
            compact
          />
        )}
      </div>

      {selectedLead && (
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
    </div>
  );
}
