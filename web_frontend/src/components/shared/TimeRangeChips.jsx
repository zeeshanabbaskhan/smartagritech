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
          className={`${value === r.id ? 'filter-chip-active' : 'filter-chip'} !py-1 !text-[10px] uppercase tracking-wider`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
