import { useState, useRef, useEffect } from 'react';

/**
 * A compact multi-select dropdown (checkbox list) styled like the app's inputs.
 *
 * Props:
 *   options   — array of strings, or { value, label } objects
 *   value     — array of selected values (strings)
 *   onChange  — (nextArray) => void
 *   allLabel  — text shown when nothing is selected (e.g. "All Statuses")
 *   className — extra classes on the wrapper (sizing)
 */
export default function MultiSelect({ options = [], value = [], onChange, allLabel = 'All', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? norm.find((o) => o.value === value[0])?.label || value[0]
        : `${value.length} selected`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input w-full text-left flex items-center justify-between gap-2"
      >
        <span className={`truncate ${value.length ? 'text-gray-900' : 'text-gray-500'}`}>{summary}</span>
        <span className="text-gray-400 text-[10px] flex-shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[12rem] max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-gray-50"
            >
              Clear selection
            </button>
          )}
          {norm.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No options</p>
          ) : (
            norm.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
