import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STATUSES, STATUS_STYLE } from './LeadTable';
import { leadService } from '../services/leadService';

const waLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '')}`;

const fmtDateTime = (d) => {
  const date = new Date(d);
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

export default function LeadDrawer({ lead, onClose, onSave, onDelete, onAddRemark, users, canAssign, canDelete }) {
  const [status, setStatus] = useState(lead.status);
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
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo?._id || '');
  const [remarkText, setRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const remarks = lead.remarks || [];

  // Fetch other leads with same phone but different projects
  const { data: relatedLeads = [] } = useQuery({
    queryKey: ['lead-related', lead._id],
    queryFn: () => leadService.getRelated(lead._id),
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
    setFollowUpDate(toDateTimeLocal(lead.followUpDate));
    setNotes(lead.notes || '');
    setAssignedTo(lead.assignedTo?._id || '');
    setRemarkText('');
    setCustomFields(Object.entries(lead.customFields || {}).map(([key, value]) => ({ key, value: String(value) })));
  }, [lead._id]);

  const handleSave = () => {
    const cf = {};
    for (const { key, value } of customFields) {
      if (key.trim()) cf[key.trim()] = value;
    }
    onSave(lead._id, {
      status,
      followUpDate: followUpDate || null,
      notes,
      assignedTo: assignedTo || null,
      customFields: cf,
    });
  };

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
            <h2 className="text-lg font-semibold text-gray-900 truncate">{lead.name}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.phone}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                {lead.status}
              </span>
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

        {/* Quick actions */}
        <div className="px-5 py-4 border-b border-gray-100 flex gap-2">
          <a
            href={`tel:${lead.phone}`}
            className="btn-call text-sm py-2 px-4 flex-1 text-center"
          >
            Call
          </a>
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp text-sm py-2 px-4 flex-1 text-center"
          >
            WhatsApp
          </a>
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

        {/* Remarks */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
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
