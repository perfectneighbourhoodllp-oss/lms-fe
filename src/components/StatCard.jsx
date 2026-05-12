export default function StatCard({ label, value, sub, color = 'text-gray-900', bg = 'bg-white', icon, onClick }) {
  const clickable = typeof onClick === 'function';
  const Wrapper = clickable ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`card card-body flex items-start gap-3 w-full text-left ${bg} ${
        clickable ? 'cursor-pointer hover:shadow-md hover:border-blue-200 transition-all' : ''
      }`}
    >
      {icon && (
        <div className="text-2xl mt-0.5 flex-shrink-0">{icon}</div>
      )}
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Wrapper>
  );
}
