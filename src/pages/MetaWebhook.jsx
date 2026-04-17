import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { projectService, sheetService } from '../services/leadService';
import ConfirmModal from '../components/ConfirmModal';
import api from '../utils/api';

const webhookService = {
  getStats: () => api.get('/webhook/logs/stats').then((r) => r.data),
  getLogs: (params) => api.get('/webhook/logs', { params }).then((r) => r.data),
  getMappings: () => api.get('/webhook/mappings').then((r) => r.data),
  createMapping: (data) => api.post('/webhook/mappings', data).then((r) => r.data),
  deleteMapping: (id) => api.delete(`/webhook/mappings/${id}`).then((r) => r.data),
};

const STATUS_STYLE = {
  success: 'bg-green-100 text-green-700',
  duplicate: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
};

const STATUS_ICON = {
  success: 'OK',
  duplicate: 'DUP',
  failed: 'ERR',
  skipped: 'SKIP',
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function SetupGuide({ webhookUrl }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card mb-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm">Meta Lead Ads Setup Guide</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Step-by-step instructions to connect Facebook/Instagram lead forms
          </p>
        </div>
        <span className="text-gray-400 text-sm sm:text-lg flex-shrink-0">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 space-y-5 pt-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Your Webhook Callback URL</p>
            <code className="text-xs sm:text-sm text-blue-900 break-all font-mono">{webhookUrl}</code>
            <p className="text-xs text-blue-500 mt-1">Use this exact URL in Meta Developer Console</p>
          </div>

          <ol className="space-y-4 text-sm">
            {[
              {
                title: '1. Create a Meta App',
                body: 'Go to developers.facebook.com -> My Apps -> Create App -> select Business type.',
              },
              {
                title: '2. Add Webhooks Product',
                body: 'In your app dashboard -> Add Product -> Webhooks. Choose Page as the object.',
              },
              {
                title: '3. Configure Callback URL',
                body: 'Paste your callback URL above. Set Verify Token to META_VERIFY_TOKEN in your server .env. Click Verify & Save.',
              },
              {
                title: '4. Subscribe to leadgen field',
                body: 'After verification, find your Page under Webhooks -> Subscribe -> check the leadgen field.',
              },
              {
                title: '5. Get App Secret',
                body: 'App -> Settings -> Basic -> App Secret. Copy this into META_APP_SECRET in your .env.',
              },
              {
                title: '6. Get Page Access Token',
                body: 'Use Graph API Explorer and generate a long-lived Page access token, then save as META_ACCESS_TOKEN.',
              },
              {
                title: '7. Map forms to projects (optional)',
                body: 'Use the "Ad → Project Mapping" section below to link your Meta form/page IDs to CRM projects. Leads will auto-route to the correct project and round-robin agents.',
              },
              {
                title: '8. Test it',
                body: 'Submit a test lead from Meta lead form preview and confirm a success log appears below.',
              },
            ].map((step) => (
              <li key={step.title}>
                <p className="font-semibold text-gray-700">{step.title}</p>
                <p className="text-gray-500 mt-0.5">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-800">
            <p className="font-semibold mb-1">Local Development</p>
            <p>Meta requires a public HTTPS URL. Use ngrok:</p>
            <code className="block mt-1 bg-yellow-100 px-2 py-1 rounded font-mono">ngrok http 5000</code>
            <p className="mt-1">Then use `https://xxxx.ngrok-free.app/api/webhook/meta` as callback URL.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Required .env variables</p>
            <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400 space-y-0.5 overflow-x-auto">
              <p>META_VERIFY_TOKEN=<span className="text-gray-400">any_string_you_choose</span></p>
              <p>META_APP_SECRET=<span className="text-gray-400">from_meta_app_settings</span></p>
              <p>META_ACCESS_TOKEN=<span className="text-gray-400">page_access_token</span></p>
              <p className="text-gray-500"># Optional</p>
              <p>META_DEFAULT_ASSIGNEE_EMAIL=<span className="text-gray-400">raj@yourfirm.com</span></p>
              <p>META_INSTAGRAM_PAGE_ID=<span className="text-gray-400">your_page_id</span></p>
              <p>META_PROJECT_MAP=<span className="text-gray-400">{'{"FORM_ID":"PROJECT_MONGO_ID"}'}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Project Mapping Manager ────────────────────────────── */
function ProjectMappings({ isAdmin }) {
  const qc = useQueryClient();
  const [metaId, setMetaId] = useState('');
  const [type, setType] = useState('form');
  const [project, setProject] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [label, setLabel] = useState('');

  const { data: mappings = [] } = useQuery({
    queryKey: ['meta-mappings'],
    queryFn: webhookService.getMappings,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: webhookService.createMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-mappings'] });
      setMetaId('');
      setType('form');
      setProject('');
      setLabel('');
      toast.success('Mapping added');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add mapping'),
  });

  const deleteMutation = useMutation({
    mutationFn: webhookService.deleteMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-mappings'] });
      toast.success('Mapping removed');
    },
    onError: () => toast.error('Failed to remove mapping'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!metaId.trim() || !project) return;
    createMutation.mutate({ metaId: metaId.trim(), type, project, label: label.trim() || undefined });
  };

  return (
    <div className="card mb-5">
      <div className="p-4 sm:p-5 border-b border-gray-100">
        <p className="font-semibold text-sm text-gray-800">Ad → Project Mapping</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Map Meta form or page IDs to CRM projects for automatic lead routing
        </p>
      </div>

      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="divide-y divide-gray-50">
          {mappings.map((m) => (
            <div key={m._id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${m.type === 'form' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {m.type}
                  </span>
                  <span className="text-xs font-mono text-gray-600 truncate">{m.metaId}</span>
                  {m.label && <span className="text-xs text-gray-400">({m.label})</span>}
                </div>
                <p className="text-sm text-gray-800 mt-1 font-medium">
                  → {m.project?.name || 'Unknown project'}
                  {m.project?.developer && <span className="text-gray-400 font-normal"> by {m.project.developer}</span>}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setConfirmDeleteId(m._id)}
                  className="btn-danger text-xs py-1 px-2 flex-shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {mappings.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-xs">
          No mappings yet. Add one below to auto-route Meta leads to a project.
        </div>
      )}

      {/* Add new mapping form — admin only */}
      {isAdmin && (
        <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-xs font-semibold text-gray-600 mb-3">Add New Mapping</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input py-2 text-xs">
              <option value="form">Form ID</option>
              <option value="page">Page ID</option>
            </select>
            <input
              type="text"
              value={metaId}
              onChange={(e) => setMetaId(e.target.value)}
              placeholder={type === 'form' ? 'Meta Form ID' : 'Meta Page ID'}
              className="input py-2 text-xs font-mono"
              required
            />
            <select value={project} onChange={(e) => setProject(e.target.value)} className="input py-2 text-xs" required>
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}{p.developer ? ` (${p.developer})` : ''}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional, e.g. Sunrise FB Ad)"
              className="input py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !metaId.trim() || !project}
            className="btn-primary text-xs py-2 px-4 mt-3"
          >
            {createMutation.isPending ? 'Adding...' : '+ Add Mapping'}
          </button>
        </form>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Remove Mapping"
          message="This mapping will be removed. New leads from this Meta form will no longer route to the project."
          confirmLabel="Remove"
          onConfirm={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ─── Sheet Form (add or edit) ────────────────────────────── */
function SheetFormPanel({ existing, projects, onSubmit, onCancel, isPending }) {
  const isEdit = Boolean(existing);

  const [sheetUrl, setSheetUrl] = useState('');
  const [project, setProject] = useState(existing?.project?._id || '');
  const [label, setLabel] = useState(existing?.label || '');
  const [colName, setColName] = useState(existing?.columnMap?.name || '');
  const [colPhone, setColPhone] = useState(existing?.columnMap?.phone || '');
  const [colEmail, setColEmail] = useState(existing?.columnMap?.email || '');

  // Custom fields as array of { key, column } for stable editing
  const initialCustom = existing?.customFieldMap
    ? Object.entries(existing.customFieldMap).map(([key, column]) => ({ key, column }))
    : [];
  const [customFields, setCustomFields] = useState(initialCustom);

  const addCustomField = () => setCustomFields([...customFields, { key: '', column: '' }]);
  const updateCustom = (i, patch) => setCustomFields(customFields.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCustom = (i) => setCustomFields(customFields.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!project) return;
    if (!isEdit && !sheetUrl.trim()) return;

    const columnMap = {};
    if (colName.trim()) columnMap.name = colName.trim();
    if (colPhone.trim()) columnMap.phone = colPhone.trim();
    if (colEmail.trim()) columnMap.email = colEmail.trim();

    const customFieldMap = {};
    for (const { key, column } of customFields) {
      if (key.trim() && column.trim()) {
        customFieldMap[key.trim()] = column.trim();
      }
    }

    const payload = {
      project,
      label: label.trim() || undefined,
      columnMap: Object.keys(columnMap).length ? columnMap : undefined,
      customFieldMap,
    };
    if (!isEdit) payload.sheetUrl = sheetUrl.trim();

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600">{isEdit ? 'Edit Sheet Mapping' : 'Connect a Google Sheet'}</p>
        {isEdit && (
          <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {!isEdit && (
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Google Sheet URL"
            className="input py-2 text-xs sm:col-span-2"
            required
          />
        )}
        <select value={project} onChange={(e) => setProject(e.target.value)} className="input py-2 text-xs" required>
          <option value="">Select Project</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}{p.developer ? ` (${p.developer})` : ''}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Godrej FB Leads)"
          className="input py-2 text-xs"
        />
      </div>

      <p className="text-xs font-semibold text-gray-500 mt-3 mb-2">Standard Column Mapping</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          value={colName}
          onChange={(e) => setColName(e.target.value)}
          placeholder="Name column (default: name)"
          className="input py-2 text-xs"
        />
        <input
          type="text"
          value={colPhone}
          onChange={(e) => setColPhone(e.target.value)}
          placeholder="Phone column (default: phone)"
          className="input py-2 text-xs"
        />
        <input
          type="text"
          value={colEmail}
          onChange={(e) => setColEmail(e.target.value)}
          placeholder="Email column (default: email)"
          className="input py-2 text-xs"
        />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500">Custom Fields (e.g. occupation, city, budget)</p>
          <button type="button" onClick={addCustomField} className="text-xs text-blue-600 hover:underline font-medium">
            + Add field
          </button>
        </div>
        {customFields.length === 0 ? (
          <p className="text-xs text-gray-400">No custom fields. Click "Add field" to map additional columns from the sheet.</p>
        ) : (
          <div className="space-y-2">
            {customFields.map((cf, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={cf.key}
                  onChange={(e) => updateCustom(i, { key: e.target.value })}
                  placeholder="Field name (e.g. occupation)"
                  className="input py-2 text-xs flex-1"
                />
                <span className="text-gray-400 text-xs">→</span>
                <input
                  type="text"
                  value={cf.column}
                  onChange={(e) => updateCustom(i, { column: e.target.value })}
                  placeholder="Sheet column header"
                  className="input py-2 text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeCustom(i)}
                  className="text-red-500 hover:text-red-700 text-xs px-2"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isEdit && (
        <p className="text-xs text-gray-400 mt-3">
          Sheet must be shared as "Anyone with the link". To sync a specific tab, paste the URL while that tab is active (URL will contain <span className="font-mono">#gid=...</span>).
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !project || (!isEdit && !sheetUrl.trim())}
        className="btn-primary text-xs py-2 px-4 mt-3"
      >
        {isPending ? 'Saving...' : isEdit ? 'Save Changes' : '+ Connect Sheet'}
      </button>
    </form>
  );
}

/* ─── Google Sheets Config Manager ───────────────────────── */
function SheetConfigs({ isAdmin }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data: sheets = [] } = useQuery({
    queryKey: ['sheet-configs'],
    queryFn: sheetService.getAll,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: sheetService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheet-configs'] });
      toast.success('Sheet connected');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to connect sheet'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => sheetService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheet-configs'] });
      setEditingId(null);
      toast.success('Mapping updated');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: sheetService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sheet-configs'] });
      toast.success('Sheet disconnected');
    },
    onError: () => toast.error('Failed to disconnect sheet'),
  });

  const syncMutation = useMutation({
    mutationFn: sheetService.sync,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['sheet-configs'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Sync done: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Sync failed'),
  });

  return (
    <div className="card mb-5">
      <div className="p-4 sm:p-5 border-b border-gray-100">
        <p className="font-semibold text-sm text-gray-800">Google Sheets → CRM</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Connect Google Sheets to auto-import leads into projects. Syncs every 5 minutes.
        </p>
      </div>

      {/* Existing sheets */}
      {sheets.length > 0 && (
        <div className="divide-y divide-gray-50">
          {sheets.map((s) => (
            <div key={s._id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.isActive ? 'Active' : 'Paused'}
                  </span>
                  {s.label && <span className="text-xs font-medium text-gray-700">{s.label}</span>}
                </div>
                <p className="text-xs font-mono text-gray-400 mt-1 truncate">
                  {s.sheetId}
                  {s.gid && s.gid !== '0' && <span className="ml-1">(tab {s.gid})</span>}
                </p>
                <p className="text-sm text-gray-800 mt-0.5 font-medium">
                  → {s.project?.name || 'Unknown project'}
                  {s.project?.developer && <span className="text-gray-400 font-normal"> by {s.project.developer}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.lastSyncedRow} rows synced
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => syncMutation.mutate(s._id)}
                  disabled={syncMutation.isPending}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {syncMutation.isPending ? '...' : 'Sync Now'}
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setEditingId(editingId === s._id ? null : s._id)}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      {editingId === s._id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(s._id)}
                      className="btn-danger text-xs py-1 px-2"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sheets.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-xs">
          No sheets connected yet. Add one below to auto-import leads.
        </div>
      )}

      {/* Edit panel for selected sheet */}
      {isAdmin && editingId && (() => {
        const existing = sheets.find((s) => s._id === editingId);
        if (!existing) return null;
        return (
          <SheetFormPanel
            existing={existing}
            projects={projects}
            isPending={updateMutation.isPending}
            onCancel={() => setEditingId(null)}
            onSubmit={(data) => updateMutation.mutate({ id: existing._id, ...data })}
          />
        );
      })()}

      {/* Add new sheet form — hidden while editing */}
      {isAdmin && !editingId && (
        <SheetFormPanel
          existing={null}
          projects={projects}
          isPending={createMutation.isPending}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Disconnect Sheet"
          message="This sheet will stop syncing leads to the CRM. Existing leads won't be affected."
          confirmLabel="Disconnect"
          onConfirm={() => { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

export default function MetaWebhook() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: webhookService.getStats,
    refetchInterval: 30_000,
  });

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['webhook-logs', statusFilter, page],
    queryFn: () => webhookService.getLogs({ status: statusFilter || undefined, page, limit: 50 }),
    refetchInterval: 30_000,
  });

  const logs = logsData?.logs ?? [];
  const totalPages = logsData?.pages ?? 1;

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const webhookUrl = `${backendUrl.replace('/api', '')}/api/webhook/meta`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Meta Lead Ads</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Leads from Facebook and Instagram ads are automatically imported here
        </p>
      </div>

      <SetupGuide webhookUrl={webhookUrl} />

      <SheetConfigs isAdmin={isAdmin} />

      <ProjectMappings isAdmin={isAdmin} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Received', value: stats?.total, color: 'text-gray-900' },
          { label: 'Leads Created', value: stats?.success, color: 'text-green-600', icon: 'OK' },
          { label: 'Duplicates', value: stats?.duplicate, color: 'text-yellow-600', icon: 'DUP' },
          { label: 'Failed', value: stats?.failed, color: 'text-red-600', icon: 'ERR' },
        ].map((s) => (
          <div key={s.label} className="card card-body text-center p-4 sm:p-5">
            {s.icon && <div className="text-xl sm:text-2xl mb-1">{s.icon}</div>}
            <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {stats?.last24h !== undefined && (
        <div className="mb-4 inline-flex max-w-full items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full">
          <span className="truncate">
            <strong>{stats.last24h}</strong> webhook event{stats.last24h !== 1 ? 's' : ''} in the last 24 hours
          </span>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 px-4 sm:px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-800">Webhook Log</h2>
          <div className="w-full sm:w-auto sm:ml-auto overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {['', 'success', 'duplicate', 'failed', 'skipped'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === '' ? 'All' : `${STATUS_ICON[s]} ${s}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-14 text-gray-400 px-4">
            <p className="text-sm font-medium">No webhook events yet</p>
            <p className="text-xs mt-1">Once you connect Meta Lead Ads, incoming leads will appear here</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`badge ${STATUS_STYLE[log.status]}`}>
                      {STATUS_ICON[log.status]} {log.status}
                    </span>
                    <span className="text-xs text-gray-400 text-right">{fmtDate(log.createdAt)}</span>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Lead</p>
                    <p className="text-sm font-medium text-gray-800">{log.extractedName || '—'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 px-2.5 py-2 col-span-2">
                      <p className="text-gray-400">Phone</p>
                      <p className="text-gray-700 mt-0.5 font-mono">
                        {log.extractedPhone ? (
                          <a href={`tel:${log.extractedPhone}`} className="hover:text-blue-600">
                            {log.extractedPhone}
                          </a>
                        ) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2.5 py-2 col-span-2">
                      <p className="text-gray-400">Ad Name</p>
                      <p className="text-gray-600 mt-0.5 break-words">{log.metaAdName || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2.5 py-2 col-span-2">
                      <p className="text-gray-400">Linked Lead</p>
                      <p className="text-gray-700 mt-0.5">{log.lead?.name || '—'}</p>
                    </div>
                  </div>

                  {log.error && (
                    <div className="rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600 break-words">
                      {log.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">Status</th>
                    <th className="th">Name</th>
                    <th className="th">Phone</th>
                    <th className="th">Ad Name</th>
                    <th className="th">Lead</th>
                    <th className="th">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="td text-xs text-gray-400 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                      <td className="td">
                        <span className={`badge ${STATUS_STYLE[log.status]}`}>
                          {STATUS_ICON[log.status]} {log.status}
                        </span>
                      </td>
                      <td className="td font-medium text-gray-800">{log.extractedName || '—'}</td>
                      <td className="td font-mono text-xs text-gray-600">
                        {log.extractedPhone ? (
                          <a href={`tel:${log.extractedPhone}`} className="hover:text-blue-600">
                            {log.extractedPhone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="td text-xs text-gray-500 max-w-[180px] truncate">{log.metaAdName || '—'}</td>
                      <td className="td text-xs">{log.lead?.name || '—'}</td>
                      <td className="td text-xs text-red-500 max-w-[220px] truncate" title={log.error}>
                        {log.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center sm:text-left">
              Page {page} of {totalPages} · {logsData?.total} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40 flex-1 sm:flex-none"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs py-1 px-2 disabled:opacity-40 flex-1 sm:flex-none"
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

