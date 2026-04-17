import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../services/leadService';

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
};

export default function AgentPerformance() {
  const navigate = useNavigate();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: userService.getAgentPerformance,
  });

  const openLeads = (agentId) => {
    navigate(`/leads?assignedTo=${agentId}`);
  };

  // Totals across all agents
  const totals = agents.reduce(
    (acc, a) => ({
      total: acc.total + a.total,
      overdue: acc.overdue + a.overdue,
      closedThisMonth: acc.closedThisMonth + a.closedThisMonth,
    }),
    { total: 0, overdue: 0, closedThisMonth: 0 }
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Agent Performance</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Per-agent stats across all active users · click a row to see their leads
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card card-body text-center p-3">
          <div className="text-lg font-bold text-gray-900">{totals.total}</div>
          <div className="text-xs text-gray-500">Total Leads</div>
        </div>
        <div className="card card-body text-center p-3">
          <div className="text-lg font-bold text-red-600">{totals.overdue}</div>
          <div className="text-xs text-gray-500">Overdue</div>
        </div>
        <div className="card card-body text-center p-3">
          <div className="text-lg font-bold text-green-600">{totals.closedThisMonth}</div>
          <div className="text-xs text-gray-500">Closed This Month</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">No agents found</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {agents.map((a) => (
                <div
                  key={a._id}
                  onClick={() => openLeads(a._id)}
                  className="p-4 cursor-pointer active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                    <span className={`badge ${ROLE_STYLE[a.role] || 'bg-gray-100 text-gray-600'}`}>
                      {a.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-400">Total</p>
                      <p className="font-bold text-gray-900">{a.total}</p>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-red-500">Overdue</p>
                      <p className="font-bold text-red-700">{a.overdue}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-green-500">Closed</p>
                      <p className="font-bold text-green-700">{a.closedThisMonth}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 text-xs">
                    <span className="badge bg-blue-100 text-blue-700">New {a.new}</span>
                    <span className="badge bg-yellow-100 text-yellow-700">Called {a.called}</span>
                    <span className="badge bg-purple-100 text-purple-700">Int. {a.interested}</span>
                    <span className="badge bg-orange-100 text-orange-700">SV {a.siteVisit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th">Total</th>
                    <th className="th">New</th>
                    <th className="th">Called</th>
                    <th className="th">Interested</th>
                    <th className="th">Site Visit</th>
                    <th className="th">Closed</th>
                    <th className="th text-red-600">Overdue</th>
                    <th className="th text-green-600">Closed (Month)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {agents.map((a) => (
                    <tr
                      key={a._id}
                      onClick={() => openLeads(a._id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-gray-900">{a.name}</div>
                            <div className="text-xs text-gray-400">{a.email}</div>
                          </div>
                          <span className={`badge ${ROLE_STYLE[a.role] || 'bg-gray-100 text-gray-600'}`}>
                            {a.role}
                          </span>
                        </div>
                      </td>
                      <td className="td font-semibold">{a.total}</td>
                      <td className="td text-gray-600">{a.new}</td>
                      <td className="td text-gray-600">{a.called}</td>
                      <td className="td text-gray-600">{a.interested}</td>
                      <td className="td text-gray-600">{a.siteVisit}</td>
                      <td className="td text-gray-600">{a.closed}</td>
                      <td className={`td font-semibold ${a.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {a.overdue}
                      </td>
                      <td className="td font-semibold text-green-600">{a.closedThisMonth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
