import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/leadService';

/**
 * Self-service toggle: lets the current user pause/resume new lead assignments.
 * When OFF, they're skipped in project round-robin but can still log in.
 */
export default function AvailabilityToggle() {
  const { user, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  // Only manager + admin role users get a self-toggle.
  // Admins can't actually pause (blocked at the backend) but the button is hidden anyway.
  // Sales agents must be paused by their admin/manager via the Team page.
  if (user.role !== 'manager') return null;
  // Default to true if the field hasn't propagated yet (existing accounts pre-feature)
  const isAvailable = user.isAvailable !== false;

  const toggle = async () => {
    setSubmitting(true);
    try {
      const next = !isAvailable;
      const updated = await userService.setMyAvailability(next);
      updateUser({ isAvailable: updated.isAvailable });
      toast.success(next ? 'Receiving new leads' : 'Paused — no new leads');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={submitting}
      className={`flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 ${
        isAvailable
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
      title={isAvailable ? 'Click to pause new leads' : 'Click to resume receiving new leads'}
    >
      <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
      {isAvailable ? 'Available' : 'Paused'}
    </button>
  );
}
