export const STATUSES = ['New', 'Called', 'Interested', 'Site Visit', 'Closed', 'Not Interested', 'Dead'];
export const SOURCES = ['Instagram', 'Ads', 'Referral', 'Walk-in', 'Website', 'Other'];

export const STATUS_STYLE = {
  New: 'bg-blue-100 text-blue-700',
  Called: 'bg-yellow-100 text-yellow-700',
  Interested: 'bg-purple-100 text-purple-700',
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
function LeadCard({ lead, onSelect }) {
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
          <p className="font-semibold text-gray-900 text-sm truncate">{lead.name}</p>
          {lead.project?.name && (
            <p className="text-xs text-gray-400 truncate">{lead.project.name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'}`}>
            {lead.status}
          </span>
          {overdue && <span className="badge bg-red-100 text-red-700">Late</span>}
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
        <a href={`tel:${lead.phone}`} className="btn-call text-xs py-1.5 px-3 flex-1 text-center">
          Call
        </a>
        <a
          href={waLink(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
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
export default function LeadTable({ leads = [], onSelect, compact }) {
  if (!leads.length) {
    return <div className="text-center py-10 text-gray-400 text-sm">No leads found.</div>;
  }

  const handleSelect = onSelect || (() => {});

  return (
    <>
      {/* ── Mobile: card list ── */}
      <div className="md:hidden divide-y divide-gray-100">
        {leads.map((lead) => (
          <LeadCard key={lead._id} lead={lead} onSelect={handleSelect} />
        ))}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="th">Name</th>
              <th className="th">Phone</th>
              {!compact && <th className="th">Project</th>}
              {!compact && <th className="th">Source</th>}
              <th className="th">Status</th>
              <th className="th">Follow-up</th>
              {!compact && <th className="th">Assigned</th>}
              {!compact && <th className="th">Created</th>}
              <th className="th w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map((lead) => {
              const overdue = isOverdue(lead);
              const today = isToday(lead);
              const remarksCount = (lead.remarks || []).length;
              return (
                <tr
                  key={lead._id}
                  onClick={() => handleSelect(lead)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    overdue ? 'bg-red-50' : today ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="td">
                    <div className="font-medium text-gray-900">{lead.name}</div>
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
                  </td>
                  <td className="td text-gray-500">{fmtDate(lead.followUpDate)}</td>
                  {!compact && (
                    <td className="td text-gray-500 text-sm">{lead.assignedTo?.name || '—'}</td>
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
