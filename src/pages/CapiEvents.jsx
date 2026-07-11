import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { capiService } from '../services/leadService';

const STATUS_STYLE = {
  success: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
};
const STATUS_LABEL = {
  success: '✓ Sent',
  skipped: '○ Skipped',
  failed: '✕ Failed',
};
const EVENT_STYLE = {
  Lead: 'bg-blue-50 text-blue-700',
  Qualified: 'bg-green-50 text-green-700',
  'Not Qualified': 'bg-orange-50 text-orange-700',
  Converted: 'bg-purple-50 text-purple-700',
};

const fmtIST = (d) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Kolkata',
  }) : '—';

function StatCard({ label, value, color = 'text-gray-900', onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`card card-body text-center p-3 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200' : ''}`}
    >
      <div className={`text-lg font-bold ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </Wrapper>
  );
}

// The match keys included on an event → small pills so you can see match quality.
function MatchKeys({ ev }) {
  const keys = [
    ev.sentLeadId && 'lead_id',
    ev.sentEmail && 'email',
    ev.sentPhone && 'phone',
  ].filter(Boolean);
  if (!keys.length) return <span className="text-gray-400 text-xs">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span key={k} className="text-[10px] font-mono bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{k}</span>
      ))}
    </div>
  );
}

/* ─── Send Test Event panel ───────────────────────────────── */
function TestPanel({ configured }) {
  const [open, setOpen] = useState(false);
  const [eventName, setEventName] = useState('Lead');
  const [testEventCode, setTestEventCode] = useState('');

  const testMutation = useMutation({
    mutationFn: capiService.sendTest,
    onSuccess: (r) => toast.success(r.message || 'Test event sent — check Events Manager → Test events'),
    onError: (err) => toast.error(err.response?.data?.message || 'Test failed'),
  });

  return (
    <div className="card mb-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="font-semibold text-sm text-gray-800">Send a test event</p>
          <p className="text-xs text-gray-400 mt-0.5">Routes to Events Manager → Test events using a test code — never touches production data.</p>
        </div>
        <span className="text-gray-400 text-sm">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          {!configured && (
            <p className="text-xs text-amber-600 mb-3">CAPI isn't configured yet — set META_PIXEL_ID and META_CAPI_TOKEN on the server first.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={eventName} onChange={(e) => setEventName(e.target.value)} className="input py-2 text-sm">
              <option value="Lead">Lead</option>
              <option value="Qualified">Qualified</option>
              <option value="Not Qualified">Not Qualified</option>
              <option value="Converted">Converted</option>
            </select>
            <input
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              placeholder="Test event code (from Test events tab)"
              className="input py-2 text-sm sm:col-span-2"
            />
          </div>
          <button
            onClick={() => testMutation.mutate({ eventName, testEventCode: testEventCode.trim() })}
            disabled={testMutation.isPending || !configured || !testEventCode.trim()}
            className="btn-primary text-sm py-2 px-4 mt-3"
          >
            {testMutation.isPending ? 'Sending…' : 'Send test event'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */
export default function CapiEvents() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: statusData } = useQuery({
    queryKey: ['capi-status'],
    queryFn: capiService.getStatus,
    refetchInterval: 30_000,
  });

  const queryParams = useMemo(() => {
    const p = { page, limit: 50 };
    if (status) p.status = status;
    return p;
  }, [status, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['capi-events', queryParams],
    queryFn: () => capiService.getEvents(queryParams),
    keepPreviousData: true,
    refetchInterval: 30_000,
  });

  const events = data?.events || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const stats = statusData?.stats || { success: 0, skipped: 0, failed: 0 };
  const configured = statusData?.configured;

  const setFilter = (s) => { setStatus(s); setPage(1); };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">CAPI Events</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Lead outcomes sent to Meta's Conversions API — the signal that improves your ad targeting.
        </p>
      </div>

      {/* Connection banner */}
      <div className={`card p-4 mb-5 flex items-center justify-between gap-3 flex-wrap ${configured ? '' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${configured ? 'bg-green-500' : 'bg-amber-500'}`}></span>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {configured ? 'Conversions API connected' : 'Conversions API not configured'}
            </p>
            <p className="text-xs text-gray-500">
              {configured
                ? <>Dataset <span className="font-mono">{statusData?.datasetId}</span></>
                : 'Set META_PIXEL_ID and META_CAPI_TOKEN on the server to start sending.'}
            </p>
          </div>
        </div>
      </div>

      <TestPanel configured={configured} />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <StatCard label="Total" value={statusData?.total ?? total} onClick={() => setFilter('')} />
        <StatCard label="Sent" value={stats.success} color="text-green-600" onClick={() => setFilter('success')} />
        <StatCard label="Skipped" value={stats.skipped} color="text-gray-600" onClick={() => setFilter('skipped')} />
        <StatCard label="Failed" value={stats.failed} color="text-red-600" onClick={() => setFilter('failed')} />
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-4xl mb-3">📡</p>
            <p className="text-sm">No CAPI events {status ? `with status "${status}"` : 'yet'}.</p>
            <p className="text-xs mt-1">Events appear when a Meta lead is created or a lead's qualification changes.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {events.map((ev) => (
                <div key={ev._id} className={`p-3 ${ev.status === 'failed' ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <span className={`badge ${EVENT_STYLE[ev.eventName] || 'bg-gray-100 text-gray-600'}`}>{ev.eventName}</span>
                      <p className="font-semibold text-sm truncate mt-1">{ev.lead?.name || <span className="text-gray-400 italic">(lead removed)</span>}</p>
                      <p className="text-xs font-mono text-gray-500 truncate">{ev.lead?.phone || '—'}</p>
                    </div>
                    <span className={`badge ${STATUS_STYLE[ev.status]} flex-shrink-0`}>{STATUS_LABEL[ev.status]}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 flex flex-wrap items-center gap-1.5 mb-1">
                    <span>{fmtIST(ev.createdAt)}</span>
                    {ev.test && <span className="text-blue-600">· test</span>}
                    {ev.triggeredBy?.name && <span>· by {ev.triggeredBy.name}</span>}
                  </div>
                  <MatchKeys ev={ev} />
                  {ev.error && <p className="text-xs text-red-700 mt-1">{ev.error}</p>}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">Event</th>
                    <th className="th">Lead</th>
                    <th className="th">Match keys</th>
                    <th className="th">Status</th>
                    <th className="th">Result</th>
                    <th className="th">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {events.map((ev) => (
                    <tr key={ev._id} className={ev.status === 'failed' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="td text-xs text-gray-500 whitespace-nowrap">{fmtIST(ev.createdAt)}</td>
                      <td className="td">
                        <span className={`badge ${EVENT_STYLE[ev.eventName] || 'bg-gray-100 text-gray-600'}`}>{ev.eventName}</span>
                        {ev.test && <span className="text-[10px] text-blue-600 ml-1">test</span>}
                      </td>
                      <td className="td">
                        {ev.lead ? (
                          <Link to={`/leads?focus=${ev.lead._id}`} className="text-blue-600 hover:underline">
                            {ev.lead.name}
                          </Link>
                        ) : <span className="text-gray-400 italic text-xs">(removed)</span>}
                        {ev.lead?.phone && <div className="text-[10px] font-mono text-gray-400">{ev.lead.phone}</div>}
                      </td>
                      <td className="td"><MatchKeys ev={ev} /></td>
                      <td className="td"><span className={`badge ${STATUS_STYLE[ev.status]}`}>{STATUS_LABEL[ev.status]}</span></td>
                      <td className="td text-xs">
                        {ev.status === 'success' && <span className="text-green-700">received {ev.eventsReceived ?? 1}</span>}
                        {ev.error && <span className={ev.status === 'failed' ? 'text-red-700' : 'text-gray-500'}>{ev.error}</span>}
                      </td>
                      <td className="td text-xs text-gray-500">{ev.triggeredBy?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500">Page {page} of {pages} · {total} event{total !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-3">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="btn-secondary text-xs py-1 px-3">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
