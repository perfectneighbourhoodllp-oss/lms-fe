import { useRef, useState } from 'react';

const SAMPLE_CSV = `name,phone,source,notes
Amit Sharma,+919876500001,Instagram,Interested in 2BHK
Sunita Patel,+919876500002,Ads,Budget around 60L
Vikram Nair,+919876500003,Referral,Looking in Whitefield
`;

export default function BulkUploadModal({ onClose, onUpload, isLoading, agents = [], projects = [] }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [assignTo, setAssignTo] = useState('');
  const [project, setProject] = useState('');
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const res = await onUpload(file, { assignTo: assignTo || undefined, project: project || undefined });
    if (res) setResult(res);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-gray-800">Bulk Upload Leads</h2>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* CSV columns guide */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">Required CSV columns:</p>
            <code className="block">name, phone</code>
            <p className="font-semibold mt-2 mb-1">Optional columns:</p>
            <code className="block">source, notes, email</code>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
            Bulk-uploaded leads are tagged as <b>Database</b> (cold) leads — they're assigned but
            skip the 15-min Accept timer and aren't counted in speed-to-contact.
          </div>

          {/* File input */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm text-gray-600">
              {file ? (
                <span className="font-medium text-blue-600">{file.name}</span>
              ) : (
                'Click to select CSV file'
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">Max 5 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { setFile(e.target.files[0]); setResult(null); }}
            />
          </div>

          {/* Project for the uploaded leads (optional) */}
          <div>
            <label className="label">Project</label>
            <select
              className="input w-full"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Links every uploaded lead to this project (a <code>project_id</code> column in the
              CSV overrides this per row).
            </p>
          </div>

          {/* Assign all to a specific agent (optional) */}
          <div>
            <label className="label">Assign all leads to</label>
            <select
              className="input w-full"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="">Auto (round-robin by project)</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Pick an agent to assign every uploaded lead to them. They'll get one summary
              notification, not one per lead.
            </p>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-green-50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold text-green-800">Upload complete</p>
              <p className="text-green-700">✅ Added: <strong>{result.added}</strong></p>
              <p className="text-blue-700">🔄 Updated: <strong>{result.updated}</strong></p>
              {result.skipped > 0 && (
                <p className="text-red-700">⚠️ Skipped: <strong>{result.skipped}</strong></p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={downloadSample} className="btn-secondary flex-1 text-xs">
              ⬇ Sample CSV
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
