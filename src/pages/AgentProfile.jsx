import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { userService } from '../services/leadService';
import { STATUS_STYLE } from '../components/LeadTable';

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
};

const fmtIST = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }) : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }) : '—';

const fmtRelative = (d) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return fmtDate(d);
};

/* ─── Reusable stat card ─────────────────────────────────── */
function StatCard({ label, value, sub, color = 'text-gray-900', icon, onClick }) {
  const clickable = typeof onClick === 'function';
  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`card card-body flex items-start gap-2.5 w-full text-left ${
        clickable ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''
      }`}
    >
      {icon && <div className="text-xl mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-lg sm:text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>
        {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Wrapper>
  );
}

/* ─── Collapsible section ─────────────────────────────────── */
function Section({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800 text-sm sm:text-base">{title}</h2>
          {typeof count === 'number' && (
            <span className="badge bg-gray-100 text-gray-600">{count}</span>
          )}
        </div>
        <span className={`text-gray-400 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="p-3 sm:p-4">{children}</div>}
    </div>
  );
}

/* ─── Lead row (compact) ──────────────────────────────────── */
function LeadRow({ lead, onClick, subtitle }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
          <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'} text-[10px]`}>
            {lead.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">
          {subtitle || (lead.project?.name ? `${lead.project.name} · ${lead.phone}` : lead.phone)}
        </p>
      </div>
      <span className="text-gray-300">›</span>
    </button>
  );
}

/* ─── Pipeline bar visual ─────────────────────────────────── */
function PipelineBar({ pipeline }) {
  const stages = ['New', 'Called', 'Interested', 'Webinar', 'Site Visit', 'Closed'];
  const colors = {
    New: 'bg-blue-500',
    Called: 'bg-yellow-500',
    Interested: 'bg-purple-500',
    Webinar: 'bg-cyan-500',
    'Site Visit': 'bg-orange-500',
    Closed: 'bg-green-500',
  };
  const maxCount = Math.max(...stages.map((s) => pipeline[s] || 0), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const count = pipeline[stage] || 0;
        const widthPct = (count / maxCount) * 100;
        return (
          <div key={stage} className="flex items-center gap-2">
            <div className="w-20 sm:w-24 text-xs text-gray-600 flex-shrink-0">{stage}</div>
            <div className="flex-1 bg-gray-100 rounded h-5 sm:h-6 overflow-hidden">
              {count > 0 && (
                <div
                  className={`h-full ${colors[stage]} flex items-center px-2 text-white text-xs font-semibold transition-all`}
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                >
                  {count}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Recent activity item ────────────────────────────────── */
function ActivityItem({ entry }) {
  const ACTION_ICONS = {
    'lead.create': '➕',
    'lead.update': '✏️',
    'lead.delete': '🗑',
    'lead.bulkDelete': '🗑',
    'lead.bulkUpload': '📤',
    'lead.remark': '💬',
    'user.create': '👤',
    'user.update': '👤',
    'user.availability': '🔘',
    'project.create': '🏗',
    'project.update': '🏗',
    'project.assignAgents': '👥',
    'project.assignManagers': '🧑‍💼',
    'login': '🔑',
    'expense.create': '💸',
    'expense.approve': '✅',
    'expense.reject': '❌',
    'expense.selfApprove': '✅',
    'expense.markPaid': '💵',
  };
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
      <span className="text-base mt-0.5 flex-shrink-0">{ACTION_ICONS[entry.action] || '•'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-700 break-words">{entry.details || entry.action}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{fmtRelative(entry.createdAt)}</p>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function AgentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-profile', id],
    queryFn: () => userService.getProfileStats(id),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400 text-sm">Loading agent profile...</div>;
  }
  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="card card-body text-center">
          <p className="text-red-600 font-medium mb-2">Cannot load profile</p>
          <p className="text-sm text-gray-500">{error.response?.data?.message || 'Something went wrong'}</p>
          <Link to="/team" className="btn-secondary mt-4 inline-block">← Back to Team</Link>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { user, today, followUpsList, newLeadsList, overdueList, pipeline, performance, quality, operational, recentActivity } = data;

  const openLead = (leadId) => navigate(`/leads?focus=${leadId}`);
  const openAllOverdue = () => navigate(`/leads?assignedTo=${user._id}&overdue=true`);
  const openAllForAgent = () => navigate(`/leads?assignedTo=${user._id}`);

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/team" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        ← Back to Team
      </Link>

      {/* Header card */}
      <div className="card card-body mb-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl sm:text-2xl flex-shrink-0">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{user.name}</h1>
              <span className={`badge ${ROLE_STYLE[user.role] || 'bg-gray-100 text-gray-600'}`}>
                {user.role}
              </span>
              {user.isActive && user.isAvailable !== false && (
                <span className="badge bg-green-100 text-green-700">🟢 Available</span>
              )}
              {user.isAvailable === false && (
                <span className="badge bg-yellow-100 text-yellow-700">⏸ Paused</span>
              )}
              {!user.isActive && (
                <span className="badge bg-red-100 text-red-700">Inactive</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-gray-500 mt-0.5">
                📞 <a href={`tel:${user.phone}`} className="hover:text-blue-600">{user.phone}</a>
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              Last active: {fmtRelative(operational.lastActivityAt)}
            </p>
          </div>
        </div>
      </div>

      {/* At-a-glance stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <StatCard
          label="Today's Follow-ups"
          value={today.followUpsCount}
          color={today.followUpsCount > 0 ? 'text-blue-600' : 'text-gray-900'}
          icon="📅"
        />
        <StatCard
          label="New Leads Today"
          value={today.newLeadsCount}
          sub={today.newLeadsCount > 0 ? 'unworked' : ''}
          color={today.newLeadsCount > 0 ? 'text-purple-600' : 'text-gray-900'}
          icon="🆕"
        />
        <StatCard
          label="Overdue"
          value={today.overdueCount}
          color={today.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}
          icon="⚠️"
          onClick={today.overdueCount > 0 ? openAllOverdue : undefined}
        />
        <StatCard
          label="Closed This Month"
          value={performance.closedThisMonth}
          color="text-green-600"
          icon="✅"
        />
      </div>

      {/* Today's focus — follow-ups */}
      {today.followUpsCount > 0 && (
        <Section title="📅 Today's Follow-ups" count={today.followUpsCount} defaultOpen={true}>
          <div className="space-y-1">
            {followUpsList.map((lead) => (
              <LeadRow
                key={lead._id}
                lead={lead}
                subtitle={`${lead.project?.name || 'No project'} · ${fmtIST(lead.followUpDate)}`}
                onClick={() => openLead(lead._id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* New leads today */}
      {today.newLeadsCount > 0 && (
        <Section title="🆕 New Leads Today (Unworked)" count={today.newLeadsCount}>
          <div className="space-y-1">
            {newLeadsList.map((lead) => (
              <LeadRow
                key={lead._id}
                lead={lead}
                subtitle={`${lead.project?.name || 'No project'} · received ${fmtRelative(lead.createdAt)}`}
                onClick={() => openLead(lead._id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Overdue */}
      {today.overdueCount > 0 && (
        <Section title="⚠️ Overdue Follow-ups" count={today.overdueCount}>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {overdueList.map((lead) => (
              <LeadRow
                key={lead._id}
                lead={lead}
                subtitle={`${lead.project?.name || 'No project'} · was due ${fmtDate(lead.followUpDate)}`}
                onClick={() => openLead(lead._id)}
              />
            ))}
          </div>
          {overdueList.length >= 50 && (
            <button onClick={openAllOverdue} className="text-xs text-blue-600 hover:underline mt-3">
              View all overdue leads →
            </button>
          )}
        </Section>
      )}

      {/* Pipeline */}
      <Section
        title="📊 Pipeline"
        count={pipeline.grandTotal}
        defaultOpen={true}
      >
        <div className="mb-4">
          <PipelineBar pipeline={pipeline} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Active</p>
            <p className="font-bold text-gray-900">{pipeline.activeTotal}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Closed</p>
            <p className="font-bold text-green-600">{pipeline.Closed}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Conv. Rate</p>
            <p className="font-bold text-blue-600">{(pipeline.conversionRate * 100).toFixed(1)}%</p>
          </div>
        </div>
      </Section>

      {/* Performance */}
      <Section title="📈 Performance">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <StatCard
            label="Closed Quarter"
            value={performance.closedThisQuarter}
            color="text-green-600"
            icon="📊"
          />
          <StatCard
            label="Closed All-Time"
            value={performance.closedAllTime}
            color="text-emerald-700"
            icon="🏆"
          />
          <StatCard
            label="Remarks Today"
            value={performance.remarksToday}
            icon="💬"
          />
          <StatCard
            label="Remarks This Week"
            value={performance.remarksThisWeek}
            icon="🗨️"
          />
          <StatCard
            label="Avg First Response"
            value={performance.avgTimeToFirstContactHours !== null
              ? `${performance.avgTimeToFirstContactHours}h`
              : '—'}
            sub="lead → first remark"
            icon="⏱"
          />
          <StatCard
            label="Avg Time to Close"
            value={performance.avgLeadToCloseDays !== null
              ? `${performance.avgLeadToCloseDays}d`
              : '—'}
            sub="lead → Closed"
            icon="🎯"
          />
        </div>
      </Section>

      {/* Quality flags */}
      <Section title="⚠️ Needs Attention">
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-700">Leads with no follow-up scheduled</span>
            <span className={`badge ${quality.noFollowUpScheduled > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {quality.noFollowUpScheduled}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-700">Stale Interested (no activity 7+ days)</span>
            <span className={`badge ${quality.staleInterested > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {quality.staleInterested}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-700">Stale Site Visit (no activity 7+ days)</span>
            <span className={`badge ${quality.staleSiteVisit > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {quality.staleSiteVisit}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
            <span className="text-sm text-gray-700">Unattended leads (no remarks &gt; 20 min)</span>
            <span className={`badge ${today.unattendedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {today.unattendedCount}
            </span>
          </div>
          {today.overdueCount > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Overdue breakdown by age:</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-yellow-50 rounded p-2">
                  <p className="text-yellow-700 font-semibold">{quality.overdueByAge['0d']}</p>
                  <p className="text-yellow-600 text-[10px]">Today</p>
                </div>
                <div className="bg-orange-50 rounded p-2">
                  <p className="text-orange-700 font-semibold">{quality.overdueByAge['1d']}</p>
                  <p className="text-orange-600 text-[10px]">1-3 days</p>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <p className="text-red-700 font-semibold">{quality.overdueByAge['3d']}</p>
                  <p className="text-red-600 text-[10px]">3-7 days</p>
                </div>
                <div className="bg-red-100 rounded p-2">
                  <p className="text-red-800 font-semibold">{quality.overdueByAge['7d+']}</p>
                  <p className="text-red-700 text-[10px]">7+ days</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Projects */}
      {operational.assignedProjects.length > 0 && (
        <Section title="🏗 Projects" count={operational.assignedProjects.length}>
          <div className="flex flex-wrap gap-2">
            {operational.assignedProjects.map((p) => (
              <div
                key={p._id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                title={p.developer || ''}
              >
                <span>{p.name}</span>
                {p.weight !== 1 && (
                  <span className="px-1 bg-blue-200 rounded-full text-[10px] font-bold">×{p.weight}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent activity */}
      <Section title="📜 Recent Activity" count={recentActivity.length}>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-0">
            {recentActivity.map((entry, i) => (
              <ActivityItem key={i} entry={entry} />
            ))}
          </div>
        )}
      </Section>

      {/* Quick links */}
      <div className="card card-body flex flex-col sm:flex-row gap-2">
        <button onClick={openAllForAgent} className="btn-secondary flex-1 text-sm">
          View all leads assigned to {user.name?.split(' ')[0]} →
        </button>
      </div>
    </div>
  );
}
