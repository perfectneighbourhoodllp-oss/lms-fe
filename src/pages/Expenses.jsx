import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { expenseService, projectService, userService } from '../services/leadService';
import StatCard from '../components/StatCard';
import ConfirmModal from '../components/ConfirmModal';

const isPdfMime = (m) => m === 'application/pdf';
const isImageMime = (m) => m?.startsWith('image/');

/* ─── Receipt Uploader ───────────────────────────────────── */
function ReceiptUploader({ value, mimeType, onUploaded, onClear }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File too large — max 8 MB');
      return;
    }
    setUploading(true);
    try {
      const res = await expenseService.uploadReceipt(file);
      onUploaded({ url: res.url, publicId: res.publicId, mimeType: res.mimeType });
      toast.success('Receipt uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <div className="flex items-start gap-3">
          {isImageMime(mimeType) ? (
            <img
              src={value}
              alt="Receipt"
              className="w-20 h-20 object-cover rounded border border-gray-200 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded bg-red-50 border border-red-100 flex items-center justify-center text-red-600 text-2xl flex-shrink-0">
              📄
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700">
              {isPdfMime(mimeType) ? 'PDF receipt' : 'Image receipt'}
            </p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline truncate block mt-1"
            >
              View uploaded file
            </a>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-500 hover:underline mt-2"
            >
              Remove / Replace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <label className="block border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        disabled={uploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {uploading ? (
        <div className="text-sm text-blue-600">Uploading...</div>
      ) : (
        <>
          <div className="text-3xl mb-1">📸</div>
          <p className="text-sm font-medium text-gray-700">Click to upload receipt</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP or PDF · max 8 MB</p>
        </>
      )}
    </label>
  );
}

const CATEGORIES = ['Marketing', 'Travel', 'Office', 'Hospitality', 'Software', 'Utilities', 'Food', 'Salary', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Other'];
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];

const STATUS_STYLE = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

const CATEGORY_STYLE = {
  Marketing: 'bg-pink-100 text-pink-700',
  Travel: 'bg-blue-100 text-blue-700',
  Office: 'bg-gray-100 text-gray-700',
  Hospitality: 'bg-purple-100 text-purple-700',
  Software: 'bg-indigo-100 text-indigo-700',
  Utilities: 'bg-cyan-100 text-cyan-700',
  Food: 'bg-orange-100 text-orange-700',
  Salary: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-gray-100 text-gray-600',
};

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
};

/* ─── Add/Edit Modal ──────────────────────────────────────── */
function ExpenseFormModal({ expense, projects, onClose, onSubmit, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: expense
      ? {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          date: toDateInput(expense.date),
          paymentMode: expense.paymentMode,
          vendor: expense.vendor || '',
          project: expense.project?._id || '',
        }
      : {
          category: 'Other',
          paymentMode: 'Cash',
          date: toDateInput(new Date()),
        },
  });

  const [receipt, setReceipt] = useState(
    expense?.receiptUrl
      ? { url: expense.receiptUrl, publicId: expense.receiptPublicId, mimeType: expense.receiptMimeType }
      : null
  );

  const submitWithReceipt = (data) => {
    if (!receipt?.url) {
      toast.error('Please upload a payment receipt before submitting');
      return;
    }
    onSubmit({
      ...data,
      receiptUrl: receipt.url,
      receiptPublicId: receipt.publicId,
      receiptMimeType: receipt.mimeType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-base text-gray-800">
            {expense ? 'Edit Expense' : 'New Expense'}
          </h2>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <form onSubmit={handleSubmit(submitWithReceipt)} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="0.00"
                {...register('amount', {
                  required: 'Amount required',
                  min: { value: 0, message: 'Must be positive' },
                  valueAsNumber: true,
                })}
              />
              {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input"
                {...register('date', { required: 'Date required' })}
              />
              {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              rows={2}
              className="input resize-none"
              placeholder="e.g. Meta ads for Prestige Sunrise — Nov week 2"
              {...register('description', { required: 'Description required' })}
            />
            {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" {...register('category')}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select className="input" {...register('paymentMode')}>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Vendor / Paid To</label>
            <input className="input" placeholder="e.g. Meta, Uber, BESCOM" {...register('vendor')} />
          </div>

          <div>
            <label className="label">Project (optional)</label>
            <select className="input" {...register('project')}>
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Link to a project for per-project ROI tracking
            </p>
          </div>

          <div>
            <label className="label">Payment Receipt *</label>
            <ReceiptUploader
              value={receipt?.url}
              mimeType={receipt?.mimeType}
              onUploaded={setReceipt}
              onClear={() => setReceipt(null)}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Upload a screenshot, photo or PDF of the payment proof
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isLoading || !receipt?.url} className="btn-primary flex-1">
              {isLoading ? 'Saving...' : expense ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Mark as Paid Modal ─────────────────────────────────── */
function MarkPaidModal({ expense, onConfirm, onCancel, isLoading }) {
  const [paymentReference, setPaymentReference] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">Mark as Paid</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            ₹{Number(expense.amount).toLocaleString('en-IN')} to {expense.addedBy?.name}
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Payment Reference (optional)</label>
            <input
              className="input"
              placeholder="e.g. UPI txn ID, UTR, cheque #"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Recorded for audit — leave blank if not applicable
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => onConfirm(paymentReference)}
              disabled={isLoading}
              className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? 'Saving...' : '💵 Confirm Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reject Modal ───────────────────────────────────────── */
function RejectModal({ expense, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">Reject Expense</h2>
          <p className="text-xs text-gray-400 mt-0.5">{fmtINR(expense.amount)} — {expense.description}</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Reason (optional)</label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="e.g. Missing receipt, exceeds policy"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => onConfirm(reason)} className="btn-danger flex-1">Reject</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Drawer ──────────────────────────────────────── */
function ExpenseDetail({
  expense,
  canApprove,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onMarkPaid,
}) {
  if (!expense) return null;

  const isOwner = expense.addedBy?._id === currentUserId;
  const isAdminUser = canApprove; // canApprove resolves to admin-only in our model
  const canEdit = (isOwner && expense.status === 'Pending') || canApprove;
  const canDelete = (isOwner && expense.status === 'Pending') || canApprove;
  // Admin can approve/pay any expense including their own.
  // Self-approvals are logged distinctly in the activity log for audit.
  const canActOnApproval = canApprove && expense.status === 'Pending';
  const canMarkPaid = isAdminUser && expense.status === 'Approved';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-semibold text-gray-800">{fmtINR(expense.amount)}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(expense.date)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`badge ${STATUS_STYLE[expense.status]}`}>{expense.status}</span>
            <span className={`badge ${CATEGORY_STYLE[expense.category]}`}>{expense.category}</span>
            <span className="badge bg-gray-100 text-gray-600">{expense.paymentMode}</span>
          </div>

          <div>
            <p className="label">Description</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{expense.description}</p>
          </div>

          {expense.vendor && (
            <div>
              <p className="label">Vendor</p>
              <p className="text-sm text-gray-700">{expense.vendor}</p>
            </div>
          )}

          {expense.project && (
            <div>
              <p className="label">Project</p>
              <p className="text-sm text-gray-700">🏗 {expense.project.name}</p>
            </div>
          )}

          {expense.receiptUrl && (
            <div>
              <p className="label">Payment Receipt</p>
              {isImageMime(expense.receiptMimeType) ? (
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
                >
                  <img src={expense.receiptUrl} alt="Receipt" className="w-full max-h-80 object-contain bg-gray-50" />
                </a>
              ) : (
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-sm text-blue-600">View PDF receipt</span>
                </a>
              )}
            </div>
          )}

          <div>
            <p className="label">Submitted by</p>
            <p className="text-sm text-gray-700">
              {expense.addedBy?.name} <span className="text-xs text-gray-400">· {expense.addedBy?.role}</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(expense.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>

          {(expense.status === 'Approved' || expense.status === 'Rejected' || expense.status === 'Paid') && expense.approvedBy && (
            <div>
              <p className="label">
                {expense.status === 'Rejected' ? 'Rejected by' : 'Approved by'}
              </p>
              <p className="text-sm text-gray-700">{expense.approvedBy?.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(expense.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
              {expense.rejectionReason && (
                <p className="text-sm text-red-600 mt-1.5 p-2 bg-red-50 rounded">
                  {expense.rejectionReason}
                </p>
              )}
            </div>
          )}

          {expense.status === 'Paid' && expense.paidBy && (
            <div>
              <p className="label">Paid by</p>
              <p className="text-sm text-gray-700">{expense.paidBy?.name}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(expense.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
              {expense.paymentReference && (
                <p className="text-xs text-gray-700 mt-1.5 p-2 bg-emerald-50 rounded">
                  <span className="font-medium">Ref:</span> {expense.paymentReference}
                </p>
              )}
            </div>
          )}

          {canActOnApproval && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={onApprove} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
                ✓ Approve
              </button>
              <button onClick={onReject} className="btn-danger flex-1">
                ✕ Reject
              </button>
            </div>
          )}

          {canMarkPaid && (
            <div className="pt-3 border-t border-gray-100">
              <button onClick={onMarkPaid} className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700">
                💵 Mark as Paid
              </button>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                Confirms the reimbursement has been disbursed
              </p>
            </div>
          )}

          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {canEdit && (
                <button onClick={onEdit} className="btn-secondary flex-1">Edit</button>
              )}
              {canDelete && (
                <button onClick={onDelete} className="btn-danger flex-1">Delete</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function Expenses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Only admin can approve/reject and see other users' expenses.
  // Managers behave like sales for expenses — they see and manage only their own.
  const isAdmin = user?.role === 'admin';
  const canApprove = isAdmin;

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    project: '',
    addedBy: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [rejectExpense, setRejectExpense] = useState(null);
  const [payExpense, setPayExpense] = useState(null);

  const queryParams = useMemo(() => {
    const p = { limit: 100 };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [filters]);

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => expenseService.list(queryParams),
  });
  const { data: stats } = useQuery({
    queryKey: ['expense-stats'],
    queryFn: expenseService.getStats,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    enabled: isAdmin,
  });

  const expenses = expensesData?.items || [];
  const detailExpense = expenses.find((e) => e._id === detailId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expense-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: expenseService.create,
    onSuccess: () => { invalidate(); setShowForm(false); toast.success('Expense submitted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => expenseService.update(id, data),
    onSuccess: () => { invalidate(); setEditExpense(null); toast.success('Expense updated'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: expenseService.remove,
    onSuccess: () => { invalidate(); setDetailId(null); toast.success('Expense deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const approveMutation = useMutation({
    mutationFn: expenseService.approve,
    onSuccess: () => { invalidate(); toast.success('Expense approved'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => expenseService.reject(id, reason),
    onSuccess: () => { invalidate(); setRejectExpense(null); toast.success('Expense rejected'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Reject failed'),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, paymentReference }) => expenseService.markPaid(id, paymentReference),
    onSuccess: () => { invalidate(); setPayExpense(null); toast.success('Marked as paid'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to mark paid'),
  });

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({
    status: '', category: '', project: '', addedBy: '', dateFrom: '', dateTo: '', search: '',
  });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAdmin ? 'Track and approve company expenses' : 'Submit your business expenses'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary w-full sm:w-auto">
          + Add Expense
        </button>
      </div>

      {/* Stats — financial totals are personal unless admin (who sees company-wide) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
        <StatCard
          label={isAdmin ? 'Company — This Month' : 'My Spend — This Month'}
          sub={`${stats?.thisMonthCount || 0} expenses`}
          value={fmtINR(stats?.thisMonth)}
          icon="💰"
        />
        <StatCard
          label={isAdmin ? 'Awaiting Payment' : 'My Awaiting Payment'}
          value={fmtINR(stats?.awaitingPaymentTotal)}
          sub={`${stats?.awaitingPaymentCount || 0} expense${(stats?.awaitingPaymentCount || 0) === 1 ? '' : 's'}`}
          color={stats?.awaitingPaymentCount > 0 ? 'text-emerald-600' : 'text-gray-900'}
          icon="💵"
          onClick={() => updateFilter('status', 'Approved')}
        />
        <StatCard
          label={isAdmin ? 'Pending Approvals' : 'My Pending'}
          value={stats?.pendingCount ?? 0}
          color={stats?.pendingCount > 0 ? 'text-yellow-600' : 'text-gray-900'}
          icon="⏳"
          onClick={() => updateFilter('status', 'Pending')}
        />
        <StatCard
          label={isAdmin ? 'Company — All Time' : 'My All-Time Total'}
          value={fmtINR(stats?.allTimeTotal)}
          color="text-blue-600"
          icon="📊"
        />
      </div>

      {/* Category breakdown */}
      {stats?.byCategory?.length > 0 && (
        <div className="card mb-5">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">
              {isAdmin ? 'Company — ' : 'My '}This Month by Category
            </h2>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {stats.byCategory.map((c) => (
              <div key={c.category} className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs">
                <span className={`badge ${CATEGORY_STYLE[c.category]} mr-2`}>{c.category}</span>
                <span className="font-semibold text-gray-800">{fmtINR(c.total)}</span>
                <span className="text-gray-400 ml-1">· {c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-5 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <select className="input text-sm" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input text-sm" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input text-sm" value={filters.project} onChange={(e) => updateFilter('project', e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          {isAdmin && (
            <select className="input text-sm" value={filters.addedBy} onChange={(e) => updateFilter('addedBy', e.target.value)}>
              <option value="">All users</option>
              {allUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          )}
          <input
            type="date"
            className="input text-sm"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="input text-sm"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            placeholder="To"
          />
          <input
            type="text"
            className="input text-sm col-span-2 md:col-span-1"
            placeholder="Search description / vendor"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm">Clear</button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-sm">No expenses found.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {expenses.map((e) => (
                <div
                  key={e._id}
                  onClick={() => setDetailId(e._id)}
                  className="p-4 cursor-pointer active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-base">{fmtINR(e.amount)}</p>
                      <p className="text-xs text-gray-500 truncate">{e.description}</p>
                    </div>
                    <span className={`badge ${STATUS_STYLE[e.status]} flex-shrink-0`}>{e.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`badge ${CATEGORY_STYLE[e.category]}`}>{e.category}</span>
                      {e.project && <span className="text-gray-400">🏗 {e.project.name}</span>}
                      {e.receiptUrl && <span className="text-gray-400" title="Receipt attached">📎</span>}
                    </div>
                    <span className="text-gray-400">{fmtDate(e.date)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">by {e.addedBy?.name}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Amount</th>
                    <th className="th">Description</th>
                    <th className="th">Category</th>
                    <th className="th">Project</th>
                    <th className="th">Submitted by</th>
                    <th className="th">Status</th>
                    <th className="th w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map((e) => (
                    <tr
                      key={e._id}
                      onClick={() => setDetailId(e._id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="td text-gray-500 text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="td font-semibold text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          {fmtINR(e.amount)}
                          {e.receiptUrl && <span className="text-gray-300 text-xs" title="Receipt attached">📎</span>}
                        </span>
                      </td>
                      <td className="td max-w-xs">
                        <div className="text-sm truncate">{e.description}</div>
                        {e.vendor && <div className="text-xs text-gray-400 truncate">{e.vendor}</div>}
                      </td>
                      <td className="td">
                        <span className={`badge ${CATEGORY_STYLE[e.category]}`}>{e.category}</span>
                      </td>
                      <td className="td text-xs text-gray-500">{e.project?.name || '—'}</td>
                      <td className="td text-xs text-gray-500">{e.addedBy?.name}</td>
                      <td className="td">
                        <span className={`badge ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                      </td>
                      <td className="td text-gray-300 text-lg text-right pr-4">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ExpenseFormModal
          projects={projects}
          onClose={() => setShowForm(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {editExpense && (
        <ExpenseFormModal
          expense={editExpense}
          projects={projects}
          onClose={() => setEditExpense(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editExpense._id, ...data })}
          isLoading={updateMutation.isPending}
        />
      )}

      {detailExpense && (
        <ExpenseDetail
          expense={detailExpense}
          canApprove={canApprove}
          currentUserId={user?.id}
          onClose={() => setDetailId(null)}
          onEdit={() => { setEditExpense(detailExpense); setDetailId(null); }}
          onDelete={() => setDeleteId(detailExpense._id)}
          onApprove={() => approveMutation.mutate(detailExpense._id)}
          onReject={() => setRejectExpense(detailExpense)}
          onMarkPaid={() => setPayExpense(detailExpense)}
        />
      )}

      {deleteId && (
        <ConfirmModal
          title="Delete Expense"
          message="This expense will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { deleteMutation.mutate(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {rejectExpense && (
        <RejectModal
          expense={rejectExpense}
          onCancel={() => setRejectExpense(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectExpense._id, reason })}
        />
      )}

      {payExpense && (
        <MarkPaidModal
          expense={payExpense}
          isLoading={markPaidMutation.isPending}
          onCancel={() => setPayExpense(null)}
          onConfirm={(paymentReference) =>
            markPaidMutation.mutate({ id: payExpense._id, paymentReference })
          }
        />
      )}
    </div>
  );
}
