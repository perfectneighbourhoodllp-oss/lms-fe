import { leadService } from '../services/leadService';

// Fire-and-forget: record a contact attempt (call/whatsapp) on the lead.
const logContact = (id, channel) => leadService.logContact(id, channel).catch(() => {});

export const STATUSES = ['New', 'Called', 'RNR', 'Interested', 'Webinar', 'Site Visit', 'Closed', 'Not Interested', 'Dead'];
export const SOURCES = ['Instagram', 'Ads', 'Referral', 'Walk-in', 'Website', 'Database', 'Other'];

export const STATUS_STYLE = {
  New: 'bg-blue-100 text-blue-700',
  Called: 'bg-yellow-100 text-yellow-700',
  RNR: 'bg-amber-100 text-amber-700',
  Interested: 'bg-purple-100 text-purple-700',
  Webinar: 'bg-cyan-100 text-cyan-700',
  'Site Visit': 'bg-orange-100 text-orange-700',
  Closed: 'bg-green-100 text-green-700',
  'Not Interested': 'bg-gray-200 text-gray-600',
  Dead: 'bg-red-100 text-red-700',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  // Show time only if it's not midnight (meaning user set a specific time)
  const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
  if (!hasTime) return dateStr;
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
};

// Always-with-time formatter for system timestamps like createdAt (always shows IST)
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ', ' +
    dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '')}`;

// Small badge showing the lead's acceptance state (pending / escalated).
export function AcceptanceBadge({ lead, className = '' }) {
  if (lead.acceptanceStatus === 'pending') {
    return (
      <span className={`badge bg-yellow-100 text-yellow-700 ${className}`}>
        Pending accept{lead.reassignmentCount > 0 ? ` (#${lead.reassignmentCount})` : ''}
      </span>
    );
  }
  if (lead.acceptanceStatus === 'escalated') {
    return <span className={`badge bg-red-100 text-red-700 ${className}`}>Unaccepted</span>;
  }
  return null;
}

// Inline Accept/Reject buttons (for the assigned agent) or the status badge (for everyone else).
export function AcceptControl({ lead, currentUserId, onAccept, onReject, accepting, rejecting, className = '' }) {
  const isMine = String(lead.assignedTo?._id || lead.assignedTo || '') === String(currentUserId || '');
  if (lead.acceptanceStatus === 'pending' && isMine && onAccept) {
    const busy = accepting || rejecting;
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onAccept(lead._id); }}
          disabled={busy}
          className="badge bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
        >
          {accepting ? '…' : 'Accept'}
        </button>
        {onReject && (
          <button
            onClick={(e) => { e.stopPropagation(); onReject(lead._id); }}
            disabled={busy}
            className="badge bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-60"
          >
            {rejecting ? '…' : 'Reject'}
          </button>
        )}
      </span>
    );
  }
  return <AcceptanceBadge lead={lead} className={className} />;
}

// "Unattended" = lead created over 20 min ago, no remarks added, not in terminal status.
// Frontend-only check using already-loaded lead fields.
const UNATTENDED_THRESHOLD_MS = 20 * 60 * 1000;
const isUnattended = (lead) => {
  if (!lead.createdAt) return false;
  if ((lead.remarks || []).length > 0) return false;
  if (['Closed', 'Not Interested', 'Dead'].includes(lead.status)) return false;
  return Date.now() - new Date(lead.createdAt).getTime() > UNATTENDED_THRESHOLD_MS;
};

const isOverdue = (lead) => {
  if (!lead.followUpDate) return false;
  if (['Closed', 'Not Interested', 'Dead'].includes(lead.status)) return false;
  return new Date(lead.followUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
};

const isToday = (lead) => {
  if (!lead.followUpDate) return false;
  const d = new Date(lead.followUpDate);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

/* ─── Mobile Lead Card ────────────────────────────────────── */
function LeadCard({ lead, onSelect, currentUserId, onAccept, onReject, accepting, rejecting }) {
  const overdue = isOverdue(lead);
  const today = isToday(lead);
  const remarksCount = (lead.remarks || []).length;

  return (
    <div
      onClick={() => onSelect(lead)}
      className={`p-4 border-b border-gray-100 last:border-b-0 cursor-pointer active:bg-gray-50 transition-colors ${
        overdue ? 'bg-red-50' : today ? 'bg-blue-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1.5">
            <span className="truncate">{lead.name}</span>
            {isUnattended(lead) && (
              <span
                title="Unattended — no remarks for over 20 minutes"
                aria-label="Unattended"
                className="text-amber-500 flex-shrink-0"
              >
                ⏰
              </span>
            )}
          </p>
          {lead.project?.name && (
            <p className="text-xs text-gray-400 truncate">{lead.project.name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'}`}>
            {lead.status}
          </span>
          {overdue && <span className="badge bg-red-100 text-red-700">Late</span>}
          {lead.leadType === 'database' && <span className="badge bg-gray-100 text-gray-500" title="Bulk-uploaded database lead">DB</span>}
          <AcceptControl lead={lead} currentUserId={currentUserId} onAccept={onAccept} onReject={onReject} accepting={accepting} rejecting={rejecting} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-xs text-gray-600">{lead.phone}</span>
        <span className="text-xs text-gray-400">
          {lead.followUpDate ? fmtDate(lead.followUpDate) : ''}
          {remarksCount > 0 && <span className="ml-2">· {remarksCount} remark{remarksCount !== 1 ? 's' : ''}</span>}
        </span>
      </div>

      <div className="text-[10px] text-gray-400 mb-3">
        Created {fmtDateTime(lead.createdAt)}
      </div>

      {/* Quick contact actions — stop propagation so row click doesn't fire */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={`tel:${lead.phone}`} onClick={() => logContact(lead._id, 'call')} className="btn-call text-xs py-1.5 px-3 flex-1 text-center">
          Call
        </a>
        <a
          href={waLink(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logContact(lead._id, 'whatsapp')}
          className="btn-whatsapp text-xs py-1.5 px-3 flex-1 text-center"
        >
          WhatsApp
        </a>
        <button
          onClick={() => onSelect(lead)}
          className="btn-secondary text-xs py-1.5 px-3"
        >
          Details
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function LeadTable({
  leads = [],
  onSelect,
  compact,
  selectedIds, // optional Set<string> — when provided, checkboxes are rendered
  onToggleSelect, // (id) => void
  onToggleSelectAll, // (checked: boolean) => void
  currentUserId,
  onAccept,
  accepting,
  onReject,
  rejecting,
}) {
  if (!leads.length) {
    return <div className="text-center py-10 text-gray-400 text-sm">No leads found.</div>;
  }

  const handleSelect = onSelect || (() => {});
  const showCheckboxes = Boolean(selectedIds && onToggleSelect);
  const allOnPageSelected = showCheckboxes && leads.every((l) => selectedIds.has(l._id));

  return (
    <>
      {/* ── Mobile: card list ── */}
      <div className="md:hidden divide-y divide-gray-100">
        {leads.map((lead) => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onSelect={handleSelect}
            currentUserId={currentUserId}
            onAccept={onAccept}
            accepting={accepting}
            onReject={onReject}
            rejecting={rejecting}
          />
        ))}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {showCheckboxes && (
                <th className="th w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => onToggleSelectAll && onToggleSelectAll(e.target.checked)}
                    aria-label="Select all leads on this page"
                  />
                </th>
              )}
              <th className="th">Name</th>
              <th className="th">Phone</th>
              {!compact && <th className="th">Project</th>}
              {!compact && <th className="th">Source</th>}
              <th className="th">Status</th>
              <th className="th">Follow-up</th>
              {!compact && <th className="th">Latest Remark</th>}
              {!compact && <th className="th">Assigned</th>}
              {!compact && <th className="th">Created</th>}
              <th className="th w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map((lead) => {
              const overdue = isOverdue(lead);
              const today = isToday(lead);
              const remarks = lead.remarks || [];
              const remarksCount = remarks.length;
              // Latest by createdAt (don't assume array order).
              const latestRemark = remarksCount
                ? remarks.reduce((a, b) => (new Date(b.createdAt) >= new Date(a.createdAt) ? b : a))
                : null;
              return (
                <tr
                  key={lead._id}
                  onClick={() => handleSelect(lead)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    overdue ? 'bg-red-50' : today ? 'bg-blue-50' : ''
                  }`}
                >
                  {showCheckboxes && (
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead._id)}
                        onChange={() => onToggleSelect(lead._id)}
                        aria-label={`Select ${lead.name}`}
                      />
                    </td>
                  )}
                  <td className="td">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      <span>{lead.name}</span>
                      {isUnattended(lead) && (
                        <span
                          title="Unattended — no remarks for over 20 minutes"
                          aria-label="Unattended"
                          className="text-amber-500"
                        >
                          ⏰
                        </span>
                      )}
                    </div>
                    {remarksCount > 0 && !compact && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {remarksCount} remark{remarksCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="td font-mono text-xs">{lead.phone}</td>
                  {!compact && (
                    <td className="td">
                      {lead.project ? (
                        <div>
                          <div className="text-xs font-medium text-gray-700">{lead.project.name}</div>
                          {lead.project.developer && (
                            <div className="text-xs text-gray-400">{lead.project.developer}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                  {!compact && <td className="td text-gray-500">{lead.source}</td>}
                  <td className="td">
                    <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status}
                    </span>
                    {overdue && <span className="badge bg-red-100 text-red-700 ml-1">Overdue</span>}
                    {lead.leadType === 'database' && <span className="badge bg-gray-100 text-gray-500 ml-1" title="Bulk-uploaded database lead">DB</span>}
                    <AcceptControl lead={lead} currentUserId={currentUserId} onAccept={onAccept} onReject={onReject} accepting={accepting} rejecting={rejecting} className="ml-1" />
                  </td>
                  <td className="td text-gray-500">{fmtDate(lead.followUpDate)}</td>
                  {!compact && (
                    <td className="td">
                      {latestRemark ? (
                        <div className="max-w-[240px]">
                          <div className="text-xs text-gray-600 truncate" title={latestRemark.text}>
                            {latestRemark.text}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {latestRemark.addedBy?.name ? `${latestRemark.addedBy.name} · ` : ''}
                            {fmtDateTime(latestRemark.createdAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                  {!compact && (
                    <td className="td text-sm">
                      {lead.assignedTo?.name ? (
                        <span className="text-gray-500">{lead.assignedTo.name}</span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-700">Unassigned</span>
                      )}
                    </td>
                  )}
                  {!compact && (
                    <td className="td text-gray-400 text-xs whitespace-nowrap">{fmtDateTime(lead.createdAt)}</td>
                  )}
                  <td className="td text-gray-300 text-lg text-right pr-4">›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
