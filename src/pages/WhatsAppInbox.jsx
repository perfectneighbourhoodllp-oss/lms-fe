import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { whatsappService } from '../services/leadService';
import { useAuth } from '../context/AuthContext';

const fmtIST = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }) : '—';

// WhatsApp engagement stages → label + badge style.
const STAGE_META = {
  handoff:    { label: 'Awaiting you', badge: 'bg-amber-100 text-amber-800' },
  qualifying: { label: 'Qualifying',   badge: 'bg-blue-100 text-blue-700' },
  engaging:   { label: 'Engaging',     badge: 'bg-gray-100 text-gray-600' },
  new:        { label: 'New',          badge: 'bg-gray-100 text-gray-500' },
  dormant:    { label: 'Opted out',    badge: 'bg-red-100 text-red-600' },
};

const lastActivity = (wa) => {
  const t = Math.max(
    wa?.lastInboundAt ? new Date(wa.lastInboundAt).getTime() : 0,
    wa?.lastOutboundAt ? new Date(wa.lastOutboundAt).getTime() : 0
  );
  return t ? new Date(t) : null;
};

function StatTile({ label, value, hint, hero, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-colors ${
        active ? 'border-green-400 ring-1 ring-green-300' : 'border-gray-100'
      } ${hero ? 'bg-amber-50' : 'bg-white'} hover:border-green-300`}
    >
      <p className={`text-2xl font-bold tabular-nums ${hero ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[11px] font-medium text-gray-600 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </button>
  );
}

// Captured qualifying answers as compact chips.
function Slots({ wa }) {
  const s = wa?.slots || {};
  const chips = [
    s.configuration && `🏠 ${s.configuration}`,
    s.budgetLakh && `₹ ${s.budgetLakh}L`,
    s.timeline && `⏱ ${s.timeline}`,
    s.intent && `🎯 ${s.intent}`,
    s.locationPref && `📍 ${s.locationPref}`,
  ].filter(Boolean);
  if (!chips.length) return <span className="text-xs text-gray-400">No answers captured yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="text-[11px] bg-green-50 text-green-700 border border-green-100 rounded-full px-2 py-0.5">{c}</span>
      ))}
    </div>
  );
}

// Renders a message bubble's content — image, document, or plain text (+ caption).
export function MsgContent({ m }) {
  if (m.mediaUrl && m.mediaType === 'image') {
    return (
      <>
        <a href={m.mediaUrl} target="_blank" rel="noreferrer">
          <img src={m.mediaUrl} alt="" className="rounded-md max-w-[200px] max-h-[200px] object-cover" />
        </a>
        {m.text && <div className="mt-1">{m.text}</div>}
      </>
    );
  }
  if (m.mediaUrl && m.mediaType === 'document') {
    return (
      <>
        <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline break-all">
          📄 {m.fileName || 'Document'}
        </a>
        {m.text && <div className="mt-1">{m.text}</div>}
      </>
    );
  }
  return <>{m.text}</>;
}

// Transcript + reply box with image/file attach (24h window enforced by the backend).
function Conversation({ lead }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const fileRef = useRef(null);
  const msgs = lead.wa?.messages || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['wa-inbox'] });
  const replyM = useMutation({
    mutationFn: ({ id, text }) => whatsappService.reply(id, text),
    onSuccess: () => { setText(''); invalidate(); toast.success('Sent'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Send failed'),
  });
  const mediaM = useMutation({
    mutationFn: ({ id, file }) => whatsappService.sendMedia(id, file),
    onSuccess: () => { invalidate(); toast.success('File sent'); },
    onError: (err) => toast.error(err.response?.data?.message || 'File send failed'),
  });

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) mediaM.mutate({ id: lead._id, file });
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${m.role === 'user' ? 'bg-white border border-gray-200 text-gray-800' : 'bg-green-600 text-white'}`}>
              <MsgContent m={m} />
              <div className={`text-[10px] mt-0.5 ${m.role === 'user' ? 'text-gray-400' : 'text-green-100'}`}>{fmtIST(m.at)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-gray-100">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onPickFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={mediaM.isPending}
          title="Send an image or PDF"
          className="btn-secondary text-base py-2 px-3"
        >
          {mediaM.isPending ? '…' : '📎'}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) replyM.mutate({ id: lead._id, text: text.trim() }); }}
          placeholder="Reply on WhatsApp…"
          className="input py-2 text-sm flex-1"
        />
        <button
          onClick={() => text.trim() && replyM.mutate({ id: lead._id, text: text.trim() })}
          disabled={replyM.isPending || !text.trim()}
          className="btn-primary text-sm py-2 px-4"
        >
          {replyM.isPending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const isSales = user?.role === 'sales';
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['wa-inbox'],
    queryFn: whatsappService.getInbox,
    refetchInterval: 20_000,
  });
  const stats = data?.stats || {};
  const allLeads = data?.leads || [];
  const leads = filter === 'all' ? allLeads : allLeads.filter((l) => l.wa?.stage === filter);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{isSales ? 'My WhatsApp' : 'WhatsApp Inbox'}</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Your WhatsApp lead engagement — <strong>Awaiting you</strong> needs a human. Open a lead to reply and set its qualification.
        </p>
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
        <StatTile label="Awaiting you" value={stats.awaitingYou ?? 0} hero
          active={filter === 'handoff'} onClick={() => setFilter(filter === 'handoff' ? 'all' : 'handoff')} />
        <StatTile label="Qualifying" value={stats.qualifying ?? 0}
          active={filter === 'qualifying'} onClick={() => setFilter(filter === 'qualifying' ? 'all' : 'qualifying')} />
        <StatTile label="Engaging" value={stats.engaging ?? 0} hint="sent, no reply"
          active={filter === 'engaging'} onClick={() => setFilter(filter === 'engaging' ? 'all' : 'engaging')} />
        <StatTile label="Opted out" value={stats.dormant ?? 0}
          active={filter === 'dormant'} onClick={() => setFilter(filter === 'dormant' ? 'all' : 'dormant')} />
        <StatTile label="Opt-in rate" value={`${stats.optInRate ?? 0}%`} hint={`${stats.replied ?? 0}/${stats.contacted ?? 0} replied`}
          active={false} onClick={() => setFilter('all')} />
      </div>

      {filter !== 'all' && (
        <button onClick={() => setFilter('all')} className="text-xs text-blue-600 hover:underline mb-3">
          ← Show all ({allLeads.length})
        </button>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="card p-14 text-center text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm">{filter === 'all' ? 'No WhatsApp conversations yet.' : 'Nothing in this stage.'}</p>
            <p className="text-xs mt-1">Leads engaged by the WhatsApp assistant appear here.</p>
          </div>
        ) : (
          leads.map((lead) => {
            const meta = STAGE_META[lead.wa?.stage] || STAGE_META.new;
            const act = lastActivity(lead.wa);
            return (
              <div key={lead._id} className="card">
                <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      <span className="font-semibold text-sm text-gray-900">{lead.name}</span>
                      <span className="text-xs font-mono text-gray-400">{lead.phone}</span>
                      {lead.qualification && (
                        <span className="badge bg-blue-50 text-blue-700">{lead.qualification}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lead.project?.name ? `${lead.project.name} · ` : ''}
                      {lead.wa?.stage === 'handoff' ? `handed off ${fmtIST(lead.wa?.handoff?.notifiedAt)}` : `last activity ${fmtIST(act)}`}
                      {!isSales && lead.assignedTo?.name ? ` · ${lead.assignedTo.name}` : ''}
                    </p>
                    {lead.wa?.stage === 'handoff' && lead.wa?.handoff?.summary && (
                      <p className="text-xs text-gray-600 mt-1 italic">“{lead.wa.handoff.summary}”</p>
                    )}
                    <div className="mt-2"><Slots wa={lead.wa} /></div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Link to={`/leads?focus=${lead._id}`} className="btn-secondary text-xs py-1.5 px-3">Open lead</Link>
                    <button
                      onClick={() => setOpenId(openId === lead._id ? null : lead._id)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      {openId === lead._id ? 'Hide chat' : 'View chat'}
                    </button>
                  </div>
                </div>
                {openId === lead._id && <Conversation lead={lead} />}
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">
        To set the outcome, open the lead and choose its <strong>Qualification</strong> (Qualified / Not Qualified / Converted) — that reports the result to Meta via CAPI.
      </p>
    </div>
  );
}
