import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { reportService } from '../services/leadService';
import { useAuth } from '../context/AuthContext';

// Local YYYY-MM-DD (avoids UTC shift from toISOString).
const ymd = (d) => {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// Compute [from, to] for a named period relative to today.
function rangeFor(period) {
  const now = new Date();
  if (period === 'today') return { from: ymd(now), to: ymd(now) };
  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { from: ymd(y), to: ymd(y) };
  }
  if (period === 'last7') {
    // Rolling 7-day window ending today (today and the 6 days before it).
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: ymd(start), to: ymd(now) };
  }
  if (period === 'week') {
    const day = now.getDay(); // 0 = Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7)); // back to Monday
    return { from: ymd(monday), to: ymd(now) };
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: ymd(first), to: ymd(now) };
}

// Format business-minutes into a short human duration.
const fmtMins = (m) => {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

const PERIODS = [
  { key: 'today', label: 'Daily (today)' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'week', label: 'Weekly (this week)' },
  { key: 'month', label: 'Monthly (this month)' },
  { key: 'custom', label: 'Custom range' },
];

// Admin-only: configure the recipients of the daily 10 PM report email.
function DailyEmailSettings() {
  const [recipients, setRecipients] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    reportService
      .getSettings()
      .then((s) => {
        setRecipients((s.recipients || []).join(', '));
        setEnabled(!!s.dailyEmailEnabled);
      })
      .catch(() => {});
  }, []);

  const parseList = (str) =>
    str.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const s = await reportService.updateSettings({
        recipients: parseList(recipients),
        dailyEmailEnabled: enabled,
      });
      setRecipients((s.recipients || []).join(', '));
      toast.success('Report email settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await reportService.sendTest();
      toast.success(`Test report sent to ${r.sentTo.length} recipient(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send test');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">📧 Daily Email Report</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Send daily at 10 PM IST
          </label>
        </div>
        <div>
          <label className="label">Recipient emails (comma-separated)</label>
          <textarea
            className="input w-full"
            rows={2}
            placeholder="owner@pnh.com, manager@pnh.com"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary text-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-secondary text-sm" onClick={sendTest} disabled={testing}>
            {testing ? 'Sending…' : 'Send test now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isSales = user?.role === 'sales';
  const [period, setPeriod] = useState('today');
  const [custom, setCustom] = useState({ from: ymd(new Date()), to: ymd(new Date()) });

  const { from, to } = useMemo(
    () => (period === 'custom' ? custom : rangeFor(period)),
    [period, custom]
  );

  // Sales agents get their own scoped report; admin/manager get the full team report.
  const queryKey = ['report', isSales ? 'me' : 'agents', from, to];
  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => (isSales ? reportService.getMine({ from, to }) : reportService.getAgents({ from, to })),
    keepPreviousData: true,
  });

  // Toggle whether an agent's row is included in the emailed report. Optimistic:
  // flip the flag locally across all cached ranges, then persist.
  const toggleEmail = async (agentId, included) => {
    qc.setQueriesData({ queryKey: ['report', 'agents'] }, (old) =>
      old
        ? { ...old, agents: old.agents.map((a) => (a.agentId === agentId ? { ...a, emailExcluded: !included } : a)) }
        : old
    );
    try {
      await reportService.setAgentEmail(agentId, included);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
      qc.invalidateQueries({ queryKey: ['report', 'agents'] });
    }
  };

  // For sales, the "totals" strip shows their own numbers (data.agent); the
  // per-agent table is hidden entirely.
  const agents = isSales ? [] : (data?.agents || []);
  const totals =
    (isSales ? data?.agent : data?.totals) ||
    { leadsAssigned: 0, leadsCalled: 0, callsMade: 0, leadsWhatsapped: 0, followUpsDone: 0, siteVisitsDone: 0, closed: 0 };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {isSales ? 'My Report' : 'Reports'}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {isSales ? 'Your activity' : 'Agent-wise activity'}{' '}
          {isFetching && <span className="text-blue-500">· refreshing…</span>}
        </p>
      </div>

      {user?.role === 'admin' && <DailyEmailSettings />}

      {/* Period selector */}
      <div className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Period</label>
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="label">From</label>
                <input type="date" className="input" value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input" value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            </>
          )}
          <div className="text-xs text-gray-400 ml-auto">
            {from} → {to}
          </div>
        </div>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Leads Assigned', value: totals.leadsAssigned, icon: '👥' },
          { label: 'Leads Called', value: totals.leadsCalled, icon: '📞', hint: 'Distinct leads called per day, summed over the range' },
          { label: 'Calls Made', value: totals.callsMade, icon: '☎️', hint: 'Every call logged — not deduped by lead' },
          { label: 'Leads WhatsApp’d', value: totals.leadsWhatsapped, icon: '🟢', hint: 'Distinct leads WhatsApp’d per day, summed over the range' },
          { label: 'Total Remarks', value: totals.followUpsDone, icon: '📝', hint: 'Every remark added (not deduped by lead)' },
          { label: 'Site Visits', value: totals.siteVisitsDone, icon: '📍', hint: 'Site visits marked done in this range' },
          { label: 'Avg 1st Contact', value: fmtMins(totals.avgFirstContactMins), icon: '⏱' },
          { label: 'Closed', value: totals.closed, icon: '✅' },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="card-body py-4">
              <div className="text-xs text-gray-400" title={s.hint || ''}>{s.icon} {s.label}</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-agent table — team view only (sales see just their own totals above) */}
      {!isSales && (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">By Agent</h2>
            {isAdmin && (
              <span className="text-xs text-gray-400">Toggle “In Email” to keep an agent out of the mailed report</span>
            )}
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-gray-400">No agents found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4 text-right">Leads Assigned</th>
                    <th className="py-2 pr-4 text-right" title="Distinct leads called per day, summed over the range">Leads Called</th>
                    <th className="py-2 pr-4 text-right" title="Every call logged — not deduped by lead">Calls Made</th>
                    <th className="py-2 pr-4 text-right" title="Distinct leads WhatsApp’d per day, summed over the range">Leads WhatsApp’d</th>
                    <th className="py-2 pr-4 text-right" title="Every remark added (not deduped by lead)">Total Remarks Added</th>
                    <th className="py-2 pr-4 text-right">Site Visits</th>
                    <th className="py-2 pr-4 text-right">Avg 1st Contact</th>
                    <th className="py-2 text-right">Closed</th>
                    {isAdmin && <th className="py-2 pl-4 text-center">In Email</th>}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.agentId} className="border-b border-gray-50 table-row-hover">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-700">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.role}</div>
                      </td>
                      <td className="py-2 pr-4 text-right">{a.leadsAssigned}</td>
                      <td className="py-2 pr-4 text-right">{a.leadsCalled}</td>
                      <td className="py-2 pr-4 text-right">{a.callsMade}</td>
                      <td className="py-2 pr-4 text-right">{a.leadsWhatsapped}</td>
                      <td className="py-2 pr-4 text-right">{a.followUpsDone}</td>
                      <td className="py-2 pr-4 text-right">{a.siteVisitsDone}</td>
                      <td className="py-2 pr-4 text-right" title={a.firstContactSample ? `${a.firstContactSample} lead(s) measured` : 'no contacted leads'}>
                        {fmtMins(a.avgFirstContactMins)}
                      </td>
                      <td className="py-2 text-right">{a.closed}</td>
                      {isAdmin && (
                        <td className="py-2 pl-4 text-center">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={!a.emailExcluded}
                            onChange={(e) => toggleEmail(a.agentId, e.target.checked)}
                            title={a.emailExcluded ? 'Excluded from the mailed report' : 'Included in the mailed report'}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold text-gray-800">
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4 text-right">{totals.leadsAssigned}</td>
                    <td className="py-2 pr-4 text-right">{totals.leadsCalled}</td>
                    <td className="py-2 pr-4 text-right">{totals.callsMade}</td>
                    <td className="py-2 pr-4 text-right">{totals.leadsWhatsapped}</td>
                    <td className="py-2 pr-4 text-right">{totals.followUpsDone}</td>
                    <td className="py-2 pr-4 text-right">{totals.siteVisitsDone}</td>
                    <td className="py-2 pr-4 text-right">{fmtMins(totals.avgFirstContactMins)}</td>
                    <td className="py-2 text-right">{totals.closed}</td>
                    {isAdmin && <td className="py-2 pl-4" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
