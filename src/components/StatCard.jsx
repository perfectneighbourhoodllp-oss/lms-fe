export default function StatCard({ label, value, sub, color = 'text-gray-900', bg = 'bg-white', icon }) {
  return (
    <div className={`card card-body flex items-start gap-3 ${bg}`}>
      {icon && (
        <div className="text-2xl mt-0.5 flex-shrink-0">{icon}</div>
      )}
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
