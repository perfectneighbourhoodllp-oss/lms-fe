import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityLogService, userService } from '../services/leadService';

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
};

const ACTION_STYLE = (action) => {
  if (action.includes('delete')) return 'bg-red-100 text-red-700';
  if (action.includes('create') || action.includes('register')) return 'bg-green-100 text-green-700';
  if (action.includes('login')) return 'bg-blue-100 text-blue-700';
  if (action.includes('update') || action.includes('remark')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

const fmtDateTime = (d) => {
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

export default function ActivityLogs() {
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['activity-logs', userFilter, actionFilter, statusFilter, search, page],
    queryFn: () => activityLogService.getAll({
      user: userFilter || undefined,
      action: actionFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
      page,
      limit: 50,
    }),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['activity-log-actions'],
    queryFn: activityLogService.getActions,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
  });

  const logs = logsData?.logs ?? [];
  const total = logsData?.total ?? 0;
  const totalPages = logsData?.pages ?? 1;

  const clearFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {total} log{total !== 1 ? 's' : ''} · every login, change, and deletion is tracked here
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="input w-full sm:max-w-xs"
          placeholder="Search user, email, details..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input w-full sm:w-48"
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
          ))}
        </select>
        <select
          className="input w-full sm:w-44"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          className="input w-full sm:w-32"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        {(userFilter || actionFilter || statusFilter || search) && (
          <button onClick={clearFilters} className="btn-ghost text-xs">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-sm font-medium">No activity logs found</p>
            <p className="text-xs mt-1">Try changing the filters above</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log._id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${ACTION_STYLE(log.action)}`}>{log.action}</span>
                    {log.status === 'failed' && <span className="badge bg-red-100 text-red-700">Failed</span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.userName || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{log.userEmail || '—'}</p>
                    {log.user?.role && (
                      <span className={`badge text-[10px] mt-1 ${ROLE_STYLE[log.user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {log.user.role}
                      </span>
                    )}
                  </div>
                  {log.details && <p className="text-sm text-gray-700">{log.details}</p>}
                  <p className="text-xs text-gray-400">{fmtDateTime(log.createdAt)}{log.ip && ` · ${log.ip}`}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">User</th>
                    <th className="th">Action</th>
                    <th className="th">Details</th>
                    <th className="th">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log._id} className={log.status === 'failed' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="td text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                      <td className="td">
                        <div className="font-medium text-gray-800 text-sm">{log.userName || 'Unknown'}</div>
                        {log.userEmail && <div className="text-xs text-gray-400">{log.userEmail}</div>}
                        {log.user?.role && (
                          <span className={`badge text-[10px] mt-0.5 ${ROLE_STYLE[log.user.role] || 'bg-gray-100 text-gray-600'}`}>
                            {log.user.role}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <span className={`badge ${ACTION_STYLE(log.action)}`}>{log.action}</span>
                        {log.status === 'failed' && <span className="badge bg-red-100 text-red-700 ml-1">Failed</span>}
                      </td>
                      <td className="td text-xs text-gray-600 max-w-md">{log.details || '—'}</td>
                      <td className="td text-xs text-gray-400 font-mono">{log.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
