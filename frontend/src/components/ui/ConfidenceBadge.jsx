export function ConfidenceBadge({ confidence }) {
  if (confidence === null || confidence === undefined) {
    return (
      <span className="status-badge bg-industrial-800 border border-industrial-600 text-industrial-400">
        N/A
      </span>
    )
  }

  const pct = Math.round(confidence * 100)

  let colorClass = ''
  if (pct >= 90) colorClass = 'bg-signal-green/10 border border-signal-green/30 text-signal-green'
  else if (pct >= 70) colorClass = 'bg-molten-amber/10 border border-molten-amber/30 text-molten-amber'
  else colorClass = 'bg-alert-red/10 border border-alert-red/30 text-alert-red'

  return (
    <span className={`status-badge ${colorClass}`}>
      {pct}%
    </span>
  )
}
