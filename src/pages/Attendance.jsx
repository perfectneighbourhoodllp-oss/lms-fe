import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { attendanceService, userService } from '../services/leadService';

/* ─── helpers ────────────────────────────────────────────── */
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

// Late if checked in after 10:30 AM IST (the office timezone), regardless of viewer TZ.
const LATE_CUTOFF_MIN = 10 * 60 + 30; // 10:30 AM in minutes-since-midnight
const isLate = (at) => {
  if (!at) return false;
  const ist = new Date(new Date(at).getTime() + 5.5 * 3_600_000); // shift to IST
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() > LATE_CUTOFF_MIN;
};

// Render an in-time, coloured red with a "Late" tag when after the 10:30 cutoff.
function InTime({ at }) {
  if (!at) return <>—</>;
  const late = isLate(at);
  return (
    <span className={late ? 'text-red-600 font-medium' : ''}>
      {fmtTime(at)}
      {late && (
        <span className="ml-1 align-middle text-[10px] bg-red-50 text-red-600 border border-red-200 rounded px-1 py-0.5">
          Late
        </span>
      )}
    </span>
  );
}

const fmtDate = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return new Date(`${y}-${m}-${d}T00:00:00`).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const duration = (inAt, outAt) => {
  if (!inAt || !outAt) return '—';
  const ms = new Date(outAt) - new Date(inAt);
  if (ms <= 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
};

const mapsLink = (p) =>
  p?.lat != null && p?.lng != null ? `https://maps.google.com/?q=${p.lat},${p.lng}` : null;

const WORK_MODES = [
  { value: 'office', label: 'Office', icon: '🏢' },
  { value: 'wfh', label: 'Work From Home', icon: '🏠' },
  { value: 'onsite', label: 'On Site Visit', icon: '🚗' },
];

const workModeLabel = (m) => WORK_MODES.find((w) => w.value === m)?.label || m || '—';

// Promisified geolocation with friendly errors.
const getLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — please allow location access'
            : 'Could not fetch your location. Try again.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  });

function MapPin({ punch, label }) {
  const link = mapsLink(punch);
  if (!link) return <span className="text-gray-400">—</span>;
  const d = punch?.distanceFromOffice;
  const distTitle = d != null ? ` · ${d}m from office` : '';
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline inline-flex items-center gap-1"
      title={`${label} location${distTitle}`}
    >
      📍 View
      {punch?.withinGeofence === false && (
        <span className="text-amber-500" title="Outside office radius">⚠</span>
      )}
    </a>
  );
}

/* ─── Check In / Check Out card ──────────────────────────── */
function PunchCard() {
  const qc = useQueryClient();
  const [selfie, setSelfie] = useState(null); // { url, publicId }
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workMode, setWorkMode] = useState('office');

  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: attendanceService.getToday,
  });

  const { data: office } = useQuery({
    queryKey: ['attendance', 'office'],
    queryFn: attendanceService.getOffice,
    staleTime: Infinity,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['attendance', 'today'] });
    qc.invalidateQueries({ queryKey: ['attendance', 'mine'] });
    qc.invalidateQueries({ queryKey: ['attendance', 'all'] });
  };

  const checkInMut = useMutation({
    mutationFn: attendanceService.checkIn,
    onSuccess: () => {
      toast.success('Checked in');
      setSelfie(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
  });

  const checkOutMut = useMutation({
    mutationFn: attendanceService.checkOut,
    onSuccess: () => {
      toast.success('Checked out');
      setSelfie(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Check-out failed'),
  });

  const handleSelfie = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large — max 8 MB');
      return;
    }
    setUploading(true);
    try {
      const res = await attendanceService.uploadSelfie(file);
      setSelfie({ url: res.url, publicId: res.publicId });
      toast.success('Selfie attached');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // isCheckIn → include the chosen workMode (check-out reuses the day's stored mode).
  const punch = async (mutation, isCheckIn) => {
    setBusy(true);
    try {
      const loc = await getLocation();
      await mutation.mutateAsync({
        ...loc,
        ...(isCheckIn ? { workMode } : {}),
        selfieUrl: selfie?.url,
        selfiePublicId: selfie?.publicId,
      });
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const checkedIn = !!today?.checkIn?.at;
  const checkedOut = !!today?.checkOut?.at;
  const working = busy || uploading || checkInMut.isPending || checkOutMut.isPending;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Today's Attendance</h2>
        <p className="text-xs text-gray-400 mb-4">
          {fmtDate(today?.date)} · your location is captured when you punch
        </p>

        {isLoading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : checkedOut ? (
          <div className="rounded-lg bg-green-50 border border-green-100 p-4">
            <p className="text-sm font-medium text-green-700">✓ Done for today</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>Mode: <b>{workModeLabel(today.workMode)}</b></span>
              <span>In: <b><InTime at={today.checkIn?.at} /></b></span>
              <span>Out: <b>{fmtTime(today.checkOut?.at)}</b></span>
              <span>Duration: <b>{duration(today.checkIn?.at, today.checkOut?.at)}</b></span>
            </div>
          </div>
        ) : (
          <>
            {checkedIn && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                Checked in at <b><InTime at={today.checkIn?.at} /></b> ·{' '}
                <b>{workModeLabel(today.workMode)}</b>. Don't forget to check out.
              </div>
            )}

            {/* Work mode — chosen before check-in, then fixed for the day */}
            {!checkedIn && (
              <div className="mb-4">
                <label className="label">Work mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setWorkMode(m.value)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        workMode === m.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="block text-lg leading-none mb-1">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
                {workMode === 'office' && office && (
                  <p className="mt-2 text-xs text-gray-400">
                    Office attendance must be within {office.radiusMeters}m of the office.
                  </p>
                )}
                {workMode !== 'office' && (
                  <p className="mt-2 text-xs text-gray-400">
                    Your location is still recorded, but the office radius isn't enforced.
                  </p>
                )}
              </div>
            )}

            {/* Optional selfie */}
            <div className="mb-4">
              <label className="label">Selfie (optional)</label>
              {selfie ? (
                <div className="flex items-center gap-3">
                  <img
                    src={selfie.url}
                    alt="Selfie"
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => setSelfie(null)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleSelfie(e.target.files?.[0])}
                  />
                  {uploading ? (
                    <span className="text-sm text-blue-600">Uploading…</span>
                  ) : (
                    <span className="text-sm text-gray-500">📸 Tap to add a selfie</span>
                  )}
                </label>
              )}
            </div>

            {!checkedIn ? (
              <button
                className="btn-primary w-full"
                disabled={working}
                onClick={() => punch(checkInMut, true)}
              >
                {working ? 'Fetching location…' : 'Check In'}
              </button>
            ) : (
              <button
                className="btn-primary w-full"
                disabled={working}
                onClick={() => punch(checkOutMut, false)}
              >
                {working ? 'Fetching location…' : 'Check Out'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── My history ─────────────────────────────────────────── */
function MyHistory() {
  const { data } = useQuery({
    queryKey: ['attendance', 'mine'],
    queryFn: () => attendanceService.getMine({ limit: 60 }),
  });
  const items = data?.items || [];

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="text-base font-semibold text-gray-800 mb-3">My History</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No attendance records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">In</th>
                  <th className="py-2 pr-4">Out</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">In loc.</th>
                  <th className="py-2">Out loc.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 table-row-hover">
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{workModeLabel(r.workMode)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap"><InTime at={r.checkIn?.at} /></td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtTime(r.checkOut?.at)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {duration(r.checkIn?.at, r.checkOut?.at)}
                    </td>
                    <td className="py-2 pr-4"><MapPin punch={r.checkIn} label="Check-in" /></td>
                    <td className="py-2"><MapPin punch={r.checkOut} label="Check-out" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin / manager: per-agent attendance ──────────────── */
const PAGE_SIZE = 30;

function TeamView() {
  const [userId, setUserId] = useState(''); // '' = all agents
  const [month, setMonth] = useState(''); // 'YYYY-MM'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Picking a month sets the date range to that whole month.
  const handleMonth = (value) => {
    setMonth(value);
    setPage(1);
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
    setFrom(`${value}-01`);
    setTo(`${value}-${String(lastDay).padStart(2, '0')}`);
  };

  // Manually editing a from/to date breaks it out of "whole month" mode.
  const setFromManual = (v) => { setMonth(''); setFrom(v); setPage(1); };
  const setToManual = (v) => { setMonth(''); setTo(v); setPage(1); };
  const setAgent = (v) => { setUserId(v); setPage(1); };

  const { data: users } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: userService.getAll,
    staleTime: 5 * 60_000,
  });

  const { data, isFetching } = useQuery({
    queryKey: ['attendance', 'all', userId, from, to, page],
    queryFn: () =>
      attendanceService.listAll({
        page,
        limit: PAGE_SIZE,
        ...(userId ? { userId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    keepPreviousData: true,
  });
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Page-scoped summary (the totals below reflect the rows currently shown).
  const completedDays = items.filter((r) => r.checkIn?.at && r.checkOut?.at).length;
  const totalMs = items.reduce((acc, r) => {
    if (r.checkIn?.at && r.checkOut?.at) {
      const ms = new Date(r.checkOut.at) - new Date(r.checkIn.at);
      return acc + (ms > 0 ? ms : 0);
    }
    return acc;
  }, 0);
  const totalHrs = (totalMs / 3_600_000).toFixed(1);

  const clearFilters = () => {
    setUserId('');
    setMonth('');
    setFrom('');
    setTo('');
    setPage(1);
  };
  const hasFilter = userId || month || from || to;

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-800">Team Attendance</h2>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="label">Agent</label>
              <select
                className="input"
                value={userId}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="">All agents</option>
                {(users || []).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <input type="month" className="input" value={month} onChange={(e) => handleMonth(e.target.value)} />
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={from} onChange={(e) => setFromManual(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={to} onChange={(e) => setToManual(e.target.value)} />
            </div>
            {hasFilter && (
              <button className="btn-ghost text-xs mb-1" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary strip — record count is the full filtered total; hours/completed are this page. */}
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span>Total records: <b className="text-gray-700">{total}</b></span>
          <span>Completed (page): <b className="text-gray-700">{completedDays}</b></span>
          <span>Hours (page): <b className="text-gray-700">{totalHrs}h</b></span>
          {isFetching && <span className="text-blue-500">Refreshing…</span>}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No records found for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">In</th>
                  <th className="py-2 pr-4">Out</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Locations</th>
                  <th className="py-2">Selfie</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 table-row-hover">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <div className="font-medium text-gray-700">{r.user?.name || '—'}</div>
                      <div className="text-xs text-gray-400">{r.user?.role}</div>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{workModeLabel(r.workMode)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap"><InTime at={r.checkIn?.at} /></td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtTime(r.checkOut?.at)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {duration(r.checkIn?.at, r.checkOut?.at)}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="inline-flex gap-3">
                        <MapPin punch={r.checkIn} label="Check-in" />
                        <MapPin punch={r.checkOut} label="Check-out" />
                      </span>
                    </td>
                    <td className="py-2">
                      {r.checkIn?.selfieUrl ? (
                        <a href={r.checkIn.selfieUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={r.checkIn.selfieUrl}
                            alt="Selfie"
                            className="w-9 h-9 object-cover rounded border border-gray-200"
                          />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <button
                className="btn-secondary text-xs"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const canSeeAll = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Attendance</h1>
        <p className="text-sm text-gray-400">Check in and out with your live location.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PunchCard />
        <MyHistory />
      </div>

      {canSeeAll && <TeamView />}
    </div>
  );
}
