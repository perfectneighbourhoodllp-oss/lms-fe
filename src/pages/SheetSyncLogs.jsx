import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { sheetService } from '../services/leadService';

const STATUS_STYLE = {
  success: 'bg-green-100 text-green-700',
  duplicate: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
};

const STATUS_LABEL = {
  success: '✓ Created',
  duplicate: '↻ Updated',
  skipped: '○ Skipped',
  failed: '✕ Failed',
};

const SOURCE_LABEL = {
  webhook: '⚡ Webhook',
  polling: '⏱ Polling',
  manual: '👆 Manual',
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

/* ─── Raw payload viewer (collapsible) ─────────────────────── */
function RawRowPanel({ row }) {
  const [open, setOpen] = useState(false);
  if (!row || typeof row !== 'object') return null;
  const entries = Object.entries(row);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-blue-600 hover:underline"
      >
        {open ? '▾ Hide raw row' : '▸ Show raw row'}
      </button>
      {open && (
        <div className="mt-1 bg-gray-50 rounded p-2 text-[10px] font-mono space-y-0.5 max-h-48 overflow-y-auto border border-gray-200">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
              <span className="text-gray-500 truncate" title={k}>{k}</span>
              <span className="text-gray-800 break-all">{String(v ?? '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */
export default function SheetSyncLogs() {
  const [filters, setFilters] = useState({
    sheetConfig: '',
    status: '',
    source: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const p = { page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['sheet-sync-logs', queryParams],
    queryFn: () => sheetService.getSyncLogs(queryParams),
    keepPreviousData: true,
  });

  const { data: sheets = [] } = useQuery({
    queryKey: ['sheet-configs'],
    queryFn: sheetService.getAll,
  });

  const logs = data?.logs || [];
  const stats = data?.stats || { success: 0, duplicate: 0, skipped: 0, failed: 0 };
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ sheetConfig: '', status: '', source: '', search: '', dateFrom: '', dateTo: '' });
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Sheet Sync Log</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Every row processed from connected Google Sheets — success, duplicate, skipped, or failed.
          Auto-purged after 30 days.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 mb-5">
        <StatCard label="Total" value={total} />
        <StatCard
          label="Created"
          value={stats.success}
          color="text-green-600"
          onClick={() => setFilter('status', 'success')}
        />
        <StatCard
          label="Updated (dup)"
          value={stats.duplicate}
          color="text-yellow-600"
          onClick={() => setFilter('status', 'duplicate')}
        />
        <StatCard
          label="Skipped"
          value={stats.skipped}
          color="text-gray-600"
          onClick={() => setFilter('status', 'skipped')}
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          color="text-red-600"
          onClick={() => setFilter('status', 'failed')}
        />
      </div>

      {/* Filters */}
      <div className="card mb-5 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <select
            className="input text-sm"
            value={filters.sheetConfig}
            onChange={(e) => setFilter('sheetConfig', e.target.value)}
          >
            <option value="">All sheets</option>
            {sheets.map((s) => (
              <option key={s._id} value={s._id}>
                {s.label || s.sheetId.slice(0, 12)}{s.gid && s.gid !== '0' ? ` · tab ${s.gid}` : ''}
              </option>
            ))}
          </select>
          <select
            className="input text-sm"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="success">Created</option>
            <option value="duplicate">Updated</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="input text-sm"
            value={filters.source}
            onChange={(e) => setFilter('source', e.target.value)}
          >
            <option value="">All sources</option>
            <option value="webhook">Webhook (Apps Script)</option>
            <option value="polling">Polling (cron)</option>
            <option value="manual">Manual (Sync Now)</option>
          </select>
          <input
            type="date"
            className="input text-sm"
            value={filters.dateFrom}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="input text-sm"
            value={filters.dateTo}
            onChange={(e) => setFilter('dateTo', e.target.value)}
            title="To date"
          />
          <input
            type="text"
            className="input text-sm"
            placeholder="Search name / phone / reason"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </div>
        {hasFilters && (
          <div className="mt-2 flex justify-end">
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No sync events match these filters.</p>
            <p className="text-xs mt-1">Logs only exist for rows processed AFTER this feature was deployed.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log._id} className={`p-3 ${log.status === 'failed' ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {log.extractedName || <span className="text-gray-400 italic">(no name extracted)</span>}
                      </p>
                      <p className="text-xs font-mono text-gray-500 truncate">{log.extractedPhone || '—'}</p>
                    </div>
                    <span className={`badge ${STATUS_STYLE[log.status]} flex-shrink-0`}>
                      {STATUS_LABEL[log.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap mb-1">
                    <span>{SOURCE_LABEL[log.source]}</span>
                    <span>·</span>
                    <span>{log.sheetConfig?.label || log.sheetConfig?.sheetId?.slice(0, 10) || 'Unknown sheet'}</span>
                    {log.rowNumber && <><span>·</span><span>Row {log.rowNumber}</span></>}
                    <span>·</span>
                    <span>{fmtIST(log.createdAt)}</span>
                  </div>
                  {log.reason && (
                    <p className={`text-xs ${log.status === 'failed' ? 'text-red-700' : 'text-gray-600'} mb-1`}>
                      {log.reason}
                    </p>
                  )}
                  {log.lead && (
                    <Link to={`/leads?focus=${log.lead._id}`} className="text-xs text-blue-600 hover:underline">
                      → View lead: {log.lead.name}
                    </Link>
                  )}
                  <RawRowPanel row={log.rawRow} />
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">Sheet</th>
                    <th className="th">Source</th>
                    <th className="th">Name</th>
                    <th className="th">Phone</th>
                    <th className="th">Status</th>
                    <th className="th">Reason / Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log._id} className={log.status === 'failed' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="td text-xs text-gray-500 whitespace-nowrap">
                        {fmtIST(log.createdAt)}
                      </td>
                      <td className="td text-xs">
                        <div className="font-medium text-gray-700 truncate max-w-[160px]">
                          {log.sheetConfig?.label || log.sheetConfig?.sheetId?.slice(0, 12) || '—'}
                        </div>
                        {log.rowNumber && (
                          <div className="text-[10px] text-gray-400">Row {log.rowNumber}</div>
                        )}
                      </td>
                      <td className="td text-xs">{SOURCE_LABEL[log.source]}</td>
                      <td className="td">
                        {log.extractedName || <span className="text-gray-400 italic text-xs">(empty)</span>}
                      </td>
                      <td className="td font-mono text-xs">{log.extractedPhone || '—'}</td>
                      <td className="td">
                        <span className={`badge ${STATUS_STYLE[log.status]}`}>
                          {STATUS_LABEL[log.status]}
                        </span>
                      </td>
                      <td className="td text-xs">
                        {log.reason && (
                          <div className={log.status === 'failed' ? 'text-red-700' : 'text-gray-600'}>
                            {log.reason}
                          </div>
                        )}
                        {log.lead && (
                          <Link
                            to={`/leads?focus=${log.lead._id}`}
                            className="text-blue-600 hover:underline"
                          >
                            → {log.lead.name}
                          </Link>
                        )}
                        <RawRowPanel row={log.rawRow} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500">
                  Page {page} of {pages} · {total} log{total !== 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
