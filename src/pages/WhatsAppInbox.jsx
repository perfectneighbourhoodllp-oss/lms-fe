import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { whatsappService } from '../services/leadService';

const fmtIST = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }) : '—';

// The captured qualifying answers, shown as compact chips.
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

// Conversation transcript + a reply box (24h window).
function Conversation({ lead }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const msgs = lead.wa?.messages || [];

  const replyM = useMutation({
    mutationFn: ({ id, text }) => whatsappService.reply(id, text),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['wa-handoffs'] }); toast.success('Sent'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Send failed'),
  });

  return (
    <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${m.role === 'user' ? 'bg-white border border-gray-200 text-gray-800' : 'bg-green-600 text-white'}`}>
              {m.text}
              <div className={`text-[10px] mt-0.5 ${m.role === 'user' ? 'text-gray-400' : 'text-green-100'}`}>{fmtIST(m.at)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3 border-t border-gray-100">
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
  const [openId, setOpenId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['wa-handoffs'],
    queryFn: whatsappService.getHandoffs,
    refetchInterval: 20_000,
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Inbox</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Leads the WhatsApp assistant has qualified and handed off — review the answers, then set the lead's qualification in the CRM.
        </p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="card p-14 text-center text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm">No leads awaiting handoff.</p>
            <p className="text-xs mt-1">Qualified WhatsApp conversations appear here for a human to take over.</p>
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead._id} className="card">
              <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{lead.name}</span>
                    <span className="text-xs font-mono text-gray-400">{lead.phone}</span>
                    {lead.qualification && (
                      <span className="badge bg-blue-50 text-blue-700">{lead.qualification}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lead.project?.name ? `${lead.project.name} · ` : ''}
                    handed off {fmtIST(lead.wa?.handoff?.notifiedAt)}
                    {lead.assignedTo?.name ? ` · ${lead.assignedTo.name}` : ''}
                  </p>
                  {lead.wa?.handoff?.summary && (
                    <p className="text-xs text-gray-600 mt-1 italic">“{lead.wa.handoff.summary}”</p>
                  )}
                  <div className="mt-2"><Slots wa={lead.wa} /></div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Link to={`/leads?focus=${lead._id}`} className="btn-secondary text-xs py-1.5 px-3">
                    Open lead
                  </Link>
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
          ))
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">
        To set the outcome, open the lead and choose its <strong>Qualification</strong> (Qualified / Not Qualified / Converted) — that reports the result to Meta via CAPI.
      </p>
    </div>
  );
}
