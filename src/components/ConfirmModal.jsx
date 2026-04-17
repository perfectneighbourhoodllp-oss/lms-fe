import { useEffect, useRef } from 'react';

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-2">{message}</p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 text-sm py-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 text-sm py-2 rounded-lg font-medium ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
