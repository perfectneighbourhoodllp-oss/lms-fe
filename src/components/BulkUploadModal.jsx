import { useRef, useState } from 'react';

const SAMPLE_CSV = `name,phone,source,notes
Amit Sharma,+919876500001,Instagram,Interested in 2BHK
Sunita Patel,+919876500002,Ads,Budget around 60L
Vikram Nair,+919876500003,Referral,Looking in Whitefield
`;

export default function BulkUploadModal({ onClose, onUpload, isLoading }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const res = await onUpload(file);
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
