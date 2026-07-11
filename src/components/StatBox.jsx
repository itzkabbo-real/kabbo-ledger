export default function StatBox({ label, value, hint, accent, warn }) {
  const className = ['stat-box', accent && 'stat-box--accent', warn && 'stat-box--warn'].filter(Boolean).join(' ');
  return (
    <div className={className}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
