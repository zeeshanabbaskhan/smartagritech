const RANGES = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
]

export default function TimeRangeChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
            value === r.id
              ? 'bg-primary-500 border-primary-500 text-surface-950'
              : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-primary-500/50'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
