import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { STATUSES, STATUS_STYLE, TAGS } from './LeadTable';
import { leadService, whatsappService, projectService } from '../services/leadService';

const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '')}`;

const fmtDateTime = (d) => {
  const date = new Date(d);
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

// Date → YYYY-MM-DD (for <input type="date">).
const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

// WhatsApp qualification status → how it reads to the agent working the lead.
// `live` = the bot is still actively talking to the lead.
const WA_STATUS = {
  new:        { short: 'Engaging',      label: 'Bot engaging — awaiting the lead’s opt-in', live: true,  chip: 'bg-amber-100 text-amber-700', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  engaging:   { short: 'Engaging',      label: 'Bot engaging — awaiting the lead’s opt-in', live: true,  chip: 'bg-amber-100 text-amber-700', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  qualifying: { short: 'Qualifying',    label: 'Qualification in progress', live: true,  chip: 'bg-blue-100 text-blue-700',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  handoff:    { short: 'Handed to you', label: 'Qualified & handed to you', live: false, chip: 'bg-green-100 text-green-700', cls: 'bg-green-50 text-green-700 border-green-200' },
  dormant:    { short: 'Opted out',     label: 'Lead opted out of WhatsApp', live: false, chip: 'bg-gray-200 text-gray-500',  cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};
const WA_SLOT_LABEL = { configuration: 'Configuration', budgetLakh: 'Budget', timeline: 'Timeline', intent: 'Intent', locationPref: 'Location' };

/* ─── WhatsApp conversation (visible in the lead drawer for agents) ─── */
function WhatsAppThread({ lead }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const wa = lead.wa || {};
  const msgs = wa.messages || [];
  const withinWindow = wa.lastInboundAt && (Date.now() - new Date(wa.lastInboundAt).getTime() < 24 * 60 * 60 * 1000);

  const replyM = useMutation({
    mutationFn: (t) => whatsappService.reply(lead._id, t),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-focus'] });
      toast.success('Sent on WhatsApp');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Send failed'),
  });

  const takeOverM = useMutation({
    mutationFn: () => whatsappService.takeOver(lead._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-focus'] });
      toast.success('You’ve taken over — the bot has stopped.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not take over'),
  });

  // Only show for leads the WhatsApp bot has touched.
  if (!wa.enabled && msgs.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">WhatsApp</p>
      {(() => {
        const st = WA_STATUS[wa.stage] || WA_STATUS.new;
        const pending = wa.pendingQuestion ? (WA_SLOT_LABEL[wa.pendingQuestion] || wa.pendingQuestion) : null;
        return (
          <div className={`rounded-lg border px-3 py-2 mb-2 text-xs ${st.cls}`}>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2 h-2 rounded-full bg-current ${st.live ? 'animate-pulse' : 'opacity-40'}`} />
              {st.label}
            </div>
            {st.live && (
              <div className="mt-1.5 flex items-start justify-between gap-2">
                <p className="opacity-90">
                  ⚠️ The bot is still chatting with this lead{pending ? ` — waiting on: ${pending}` : ''}. Your replies go out alongside it.
                </p>
                <button
                  onClick={() => takeOverM.mutate()}
                  disabled={takeOverM.isPending}
                  title="Stop the bot and take over this conversation"
                  className="flex-shrink-0 text-[11px] font-semibold bg-white rounded-md px-2 py-1 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {takeOverM.isPending ? '…' : 'Take over'}
                </button>
              </div>
            )}
          </div>
        );
      })()}
      <div className="bg-gray-50 border border-gray-100 rounded-lg max-h-60 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Conversation starting…</p>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] rounded-lg px-2.5 py-1.5 text-sm ${m.role === 'user' ? 'bg-white border border-gray-200 text-gray-800' : 'bg-green-600 text-white'}`}>
                {m.mediaUrl && m.mediaType === 'image' ? (
                  <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                    <img src={m.mediaUrl} alt="" className="rounded max-w-[160px] max-h-[160px] object-cover" />
                  </a>
                ) : m.mediaUrl && m.mediaType === 'document' ? (
                  <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline break-all">📄 {m.fileName || 'Document'}</a>
                ) : null}
                {(!m.mediaUrl || m.text) && <div className={m.mediaUrl ? 'mt-1' : ''}>{m.text}</div>}
                <div className={`text-[10px] mt-0.5 ${m.role === 'user' ? 'text-gray-400' : 'text-green-100'}`}>{fmtDateTime(m.at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() && withinWindow) replyM.mutate(text.trim()); }}
          placeholder={withinWindow ? 'Reply on WhatsApp…' : 'Outside 24h window — lead must message first'}
          disabled={!withinWindow || replyM.isPending}
          className="input py-2 text-sm flex-1"
        />
        <button
          onClick={() => text.trim() && replyM.mutate(text.trim())}
          disabled={!withinWindow || replyM.isPending || !text.trim()}
          className="btn-primary text-sm py-2 px-3"
        >
          {replyM.isPending ? '…' : 'Send'}
        </button>
      </div>
      {!withinWindow && (
        <p className="text-[11px] text-gray-400 mt-1">
          Free-form replies allowed only within 24h of the lead's last WhatsApp message.
        </p>
      )}
    </div>
  );
}

export default function LeadDrawer({ lead, onClose, onSave, onDelete, onAddRemark, onAccept, accepting, onReject, rejecting, currentUserId, users, canAssign, canDelete }) {
  const [status, setStatus] = useState(lead.status);
  const [name, setName] = useState(lead.name || ''); // admin-only rename
  const [qualification, setQualification] = useState(lead.qualification || '');
  const [svDate, setSvDate] = useState(toDateInput(new Date())); // new-visit form
  const [svFeedback, setSvFeedback] = useState('');
  // Format for datetime-local input: YYYY-MM-DDTHH:mm in LOCAL time
  const toDateTimeLocal = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const [followUpDate, setFollowUpDate] = useState(toDateTimeLocal(lead.followUpDate));
  const [customFields, setCustomFields] = useState(
    Object.entries(lead.customFields || {}).map(([key, value]) => ({ key, value: String(value) }))
  );
  const [notes, setNotes] = useState(lead.notes || '');
  const [tags, setTags] = useState(lead.tags || []);
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo?._id || '');
  const [project, setProject] = useState(lead.project?._id || '');
  const [remarkText, setRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const remarks = lead.remarks || [];
  const contactLog = lead.contactLog || [];
  const statusLog = lead.statusLog || [];

  const qc = useQueryClient();
  // Log a Call/WhatsApp tap, then refresh so the contact history updates.
  const logContact = (channel) => {
    leadService
      .logContact(lead._id, channel)
      .then(() => qc.invalidateQueries({ queryKey: ['lead-focus'] }))
      .catch(() => {});
  };

  // Live countdown for the 15-min acceptance window.
  const isMine = String(lead.assignedTo?._id || lead.assignedTo) === String(currentUserId);
  const isPendingForMe = lead.acceptanceStatus === 'pending' && isMine;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isPendingForMe) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isPendingForMe, lead._id]);

  const msLeft = lead.acceptDeadline ? new Date(lead.acceptDeadline).getTime() - now : 0;
  const mmss = (() => {
    if (msLeft <= 0) return '0:00';
    const s = Math.floor(msLeft / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  })();

  // Fetch other leads with same phone but different projects
  const { data: relatedLeads = [] } = useQuery({
    queryKey: ['lead-related', lead._id],
    queryFn: () => leadService.getRelated(lead._id),
  });

  // Projects list for the admin/manager project selector (reuses the cached ['projects']).
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
    enabled: canAssign,
  });

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Sync state when a different lead is opened
  useEffect(() => {
    setStatus(lead.status);
    setName(lead.name || '');
    setQualification(lead.qualification || '');
    setSvDate(toDateInput(new Date()));
    setSvFeedback('');
    setFollowUpDate(toDateTimeLocal(lead.followUpDate));
    setNotes(lead.notes || '');
    setTags(lead.tags || []);
    setAssignedTo(lead.assignedTo?._id || '');
    setProject(lead.project?._id || '');
    setRemarkText('');
    setCustomFields(Object.entries(lead.customFields || {}).map(([key, value]) => ({ key, value: String(value) })));
  }, [lead._id]);

  const handleSave = () => {
    const cf = {};
    for (const { key, value } of customFields) {
      if (key.trim()) cf[key.trim()] = value;
    }
    // Convert the datetime-local string (user's local time, no TZ) to a
    // proper UTC ISO string so the server stores the absolute instant,
    // not whatever the server's local timezone guesses.
    const followUpIso = followUpDate ? new Date(followUpDate).toISOString() : null;

    onSave(lead._id, {
      ...(canDelete ? { name: name.trim() || lead.name } : {}),
      status,
      qualification: qualification || null,
      followUpDate: followUpIso,
      notes,
      tags,
      assignedTo: assignedTo || null,
      project: project || null,
      customFields: cf,
    });
  };

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // Append-only site-visit history. A lead can visit multiple times; each entry
  // records the date, feedback, and who logged it — persists regardless of status.
  const siteVisits = lead.siteVisits || [];
  const addVisitM = useMutation({
    mutationFn: () => leadService.addSiteVisit(lead._id, {
      at: svDate ? new Date(svDate).toISOString() : undefined,
      feedback: svFeedback,
    }),
    onSuccess: () => {
      setSvFeedback('');
      qc.invalidateQueries({ queryKey: ['lead-focus'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Site visit added');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add visit'),
  });

  const addCustomField = () => setCustomFields([...customFields, { key: '', value: '' }]);
  const updateCustom = (i, patch) => setCustomFields(customFields.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCustom = (i) => setCustomFields(customFields.filter((_, idx) => idx !== i));

  const handleAddRemark = async () => {
    if (!remarkText.trim()) return;
    setSubmittingRemark(true);
    try {
      await onAddRemark(lead._id, remarkText.trim());
      setRemarkText('');
    } finally {
      setSubmittingRemark(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" />

      {/* Drawer */}
      <div
        className="relative ml-auto w-full sm:w-[420px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {canDelete ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Lead name"
                title="Edit name — remember to Save"
                className="text-lg font-semibold text-gray-900 w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none -ml-0.5 px-0.5"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900 truncate">{lead.name}</h2>
            )}
            <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.phone}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                {lead.status}
              </span>
              {lead.siteVisits?.length > 0 && <span className="badge bg-emerald-100 text-emerald-700" title={`${lead.siteVisits.length} site visit(s)`}>📍 Visited</span>}
              {lead.wa?.enabled && (() => {
                const st = WA_STATUS[lead.wa.stage] || WA_STATUS.new;
                return <span className={`badge ${st.chip}`} title={st.label}>💬 {st.short}</span>;
              })()}
              {lead.project?.name && (
                <span className="text-xs text-gray-500 truncate">{lead.project.name}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Acceptance banner — only for the assigned agent while pending */}
        {isPendingForMe && (
          <div className="px-5 py-4 border-b border-yellow-200 bg-yellow-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-yellow-800">Accept this lead</p>
              <span className={`text-xs font-mono ${msLeft <= 60_000 ? 'text-red-600' : 'text-yellow-700'}`}>
                {msLeft > 0 ? `${mmss} left` : 'expiring…'}
              </span>
            </div>
            <p className="text-xs text-yellow-700 mb-3">
              Accept within the time shown or it will be reassigned to the next agent.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(lead._id)}
                disabled={accepting || rejecting}
                className="btn-primary text-sm py-2 px-4 flex-1"
              >
                {accepting ? 'Accepting…' : 'Accept Lead'}
              </button>
              {onReject && (
                <button
                  onClick={() => onReject(lead._id)}
                  disabled={accepting || rejecting}
                  className="btn-danger text-sm py-2 px-4"
                >
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Acceptance status note — for managers/admins or once resolved */}
        {lead.acceptanceStatus === 'pending' && !isPendingForMe && (
          <div className="px-5 py-2 border-b border-gray-100 bg-yellow-50 text-xs text-yellow-700">
            Awaiting acceptance from {lead.assignedTo?.name || 'the assigned agent'}
            {lead.reassignmentCount > 0 ? ` · reassigned ${lead.reassignmentCount}×` : ''}
          </div>
        )}
        {lead.acceptanceStatus === 'escalated' && (
          <div className="px-5 py-2 border-b border-gray-100 bg-red-50 text-xs text-red-700">
            ⚠ Not accepted by any agent — needs manual assignment
          </div>
        )}

        {/* Quick actions */}
        <div className="px-5 py-4 border-b border-gray-100 flex gap-2">
          <a
            href={`tel:${lead.phone}`}
            onClick={() => logContact('call')}
            className="btn-call text-sm py-2 px-4 flex-1 text-center"
          >
            Call
          </a>
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logContact('whatsapp')}
            className="btn-whatsapp text-sm py-2 px-4 flex-1 text-center"
          >
            WhatsApp
          </a>
        </div>

        {/* Contact history — every Call / WhatsApp tap on this lead */}
        {contactLog.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Contact history ({contactLog.length})
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {[...contactLog].reverse().map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{c.type === 'whatsapp' ? '🟢' : '📞'}</span>
                    <span className="font-medium text-gray-700 capitalize">{c.type}</span>
                    {c.by?.name && <span className="text-gray-400">by {c.by.name}</span>}
                  </span>
                  <span className="text-gray-400">{fmtDateTime(c.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status history — every status change on this lead, newest first */}
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            Status history{statusLog.length > 0 ? ` (${statusLog.length})` : ''}
          </p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {[...statusLog].reverse().map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {s.from && (
                    <>
                      <span className={`badge ${STATUS_STYLE[s.from] || 'bg-gray-100 text-gray-600'}`}>{s.from}</span>
                      <span className="text-gray-400">→</span>
                    </>
                  )}
                  <span className={`badge ${STATUS_STYLE[s.to] || 'bg-gray-100 text-gray-600'}`}>{s.to}</span>
                  {s.by?.name && <span className="text-gray-400">by {s.by.name}</span>}
                </span>
                <span className="text-gray-400 flex-shrink-0">{fmtDateTime(s.at)}</span>
              </div>
            ))}
            {/* Creation anchors the bottom of the timeline */}
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500">🟢 Created</span>
                {lead.createdBy?.name && <span className="text-gray-400">by {lead.createdBy.name}</span>}
              </span>
              <span className="text-gray-400 flex-shrink-0">{fmtDateTime(lead.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Related leads (same phone, other projects) */}
        {relatedLeads.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 bg-amber-50">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              ⚠️ Same phone in {relatedLeads.length} other project{relatedLeads.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5">
              {relatedLeads.map((r) => (
                <div key={r._id} className="text-xs bg-white rounded p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {r.project?.name || 'No project'}
                    </p>
                    <p className="text-gray-400">
                      Agent: {r.assignedTo?.name || '—'}
                    </p>
                  </div>
                  <span className={`badge flex-shrink-0 ${STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom fields — editable for admin/manager, read-only for sales */}
        {canAssign ? (
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Additional Info</p>
              <button
                type="button"
                onClick={addCustomField}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Add field
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="text-xs text-gray-400">No custom fields yet. Click "Add field" to add one.</p>
            ) : (
              <div className="space-y-2">
                {customFields.map((cf, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={cf.key}
                      onChange={(e) => updateCustom(i, { key: e.target.value })}
                      placeholder="Field name"
                      className="input py-1.5 text-xs flex-1"
                    />
                    <input
                      type="text"
                      value={cf.value}
                      onChange={(e) => updateCustom(i, { value: e.target.value })}
                      placeholder="Value"
                      className="input py-1.5 text-xs flex-1"
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
            <p className="text-xs text-gray-400 mt-2">Changes save when you click "Save Changes" below.</p>
          </div>
        ) : (
          lead.customFields && Object.keys(lead.customFields).length > 0 && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Additional Info</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(lead.customFields).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-800 break-words">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Edit form */}
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Details</p>

          <div>
            <label className="label">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input py-2 text-sm">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Site visit history — append-only; persists regardless of status */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-800 mb-2">
              📍 Site Visits {siteVisits.length > 0 && <span className="text-gray-400 font-normal">({siteVisits.length})</span>}
            </p>
            {siteVisits.length > 0 ? (
              <div className="space-y-2 mb-3">
                {siteVisits.slice().reverse().map((v, i) => (
                  <div key={v._id || i} className="bg-white border border-gray-100 rounded-md p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-700">
                        {new Date(v.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {v.by?.name && <span className="text-[11px] text-gray-400">{v.by.name}</span>}
                    </div>
                    {v.feedback && <p className="text-gray-600 mt-0.5">{v.feedback}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">No site visits logged yet.</p>
            )}
            <div className="space-y-2 border-t border-gray-100 pt-2">
              <input
                type="date"
                value={svDate}
                onChange={(e) => setSvDate(e.target.value)}
                className="input py-1.5 text-sm"
              />
              <textarea
                value={svFeedback}
                onChange={(e) => setSvFeedback(e.target.value)}
                rows={2}
                placeholder="Visit feedback (optional) — e.g. liked the 3 BHK, wants a corner unit"
                className="input resize-none py-2 text-sm"
              />
              <button
                onClick={() => addVisitM.mutate()}
                disabled={addVisitM.isPending}
                className="btn-secondary text-sm py-1.5 w-full"
              >
                {addVisitM.isPending ? 'Adding…' : '+ Add site visit'}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Qualification <span className="text-gray-400 font-normal">· sent to Meta</span></label>
            <select
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              className="input py-2 text-sm"
            >
              <option value="">— Not set —</option>
              <option value="Qualified">Qualified</option>
              <option value="Not Qualified">Not Qualified</option>
              <option value="Converted">Converted</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Setting this reports the lead outcome to Meta (Conversions API) to improve ad targeting.
            </p>
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Tap to tag this lead (e.g. Low Budget). Saves with the button below.</p>
          </div>

          <div>
            <label className="label">Follow-up Date & Time</label>
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="input py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">You'll get an email reminder at this time.</p>
          </div>

          {canAssign && (
            <div>
              <label className="label">
                Project
                {!lead.project && <span className="text-orange-500 ml-1 text-[11px]">· not set</span>}
              </label>
              <select value={project} onChange={(e) => setProject(e.target.value)} className="input py-2 text-sm">
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              {!lead.project && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Assigning a project auto-routes an unassigned lead to that project's agent.
                </p>
              )}
            </div>
          )}

          {canAssign && users && (
            <div>
              <label className="label">Assigned To</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input py-2 text-sm">
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* WhatsApp conversation — only renders when the bot has engaged this lead */}
          <WhatsAppThread lead={lead} />

          {/* Remarks — kept directly above Notes for quick logging */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Remarks ({remarks.length})
            </p>

            {remarks.length > 0 && (
              <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
                {remarks.slice().reverse().map((r, i) => (
                  <div key={r._id || i} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="text-gray-800">{r.text}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {r.addedBy?.name || 'Unknown'} · {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
                placeholder="Add a remark..."
                className="input py-2 text-sm flex-1"
                disabled={submittingRemark}
              />
              <button
                onClick={handleAddRemark}
                disabled={submittingRemark || !remarkText.trim()}
                className="btn-primary text-sm py-2 px-3"
              >
                {submittingRemark ? '...' : 'Add'}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this lead..."
              rows={3}
              className="input py-2 text-sm resize-none"
            />
          </div>

          <button onClick={handleSave} className="btn-primary text-sm py-2 px-4 w-full">
            Save Changes
          </button>

          <div className="text-xs text-gray-400 pt-1">
            Source: {lead.source} · Created by {lead.createdBy?.name || 'System'}
          </div>
        </div>

        {/* Danger zone */}
        {canDelete && (
          <div className="px-5 py-4 mt-auto">
            <button
              onClick={() => onDelete(lead._id)}
              className="text-xs text-red-600 hover:text-red-700 hover:underline"
            >
              Delete this lead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
