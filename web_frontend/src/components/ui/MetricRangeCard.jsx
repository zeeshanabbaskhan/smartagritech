import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

const RANGES = ['1h', '24h', '7d', '30d']

const FLAT_DATA = {
  '1h':  ['00:46 AM', '00:55 AM', '00:08 AM', '00:16 AM', '00:26 AM'].map(t => ({ t, v: 0 })),
  '24h': ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map(t => ({ t, v: 0 })),
  '7d':  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(t => ({ t, v: 0 })),
  '30d': Array.from({ length: 6 }, (_, i) => ({ t: `Wk ${i + 1}`, v: 0 })),
}

export default function MetricRangeCard({
  icon: Icon,
  title,
  value = '0.00',
  unit,
  data,
  defaultRange = '1h',
  emptyLabel,
}) {
  const [range, setRange] = useState(defaultRange)
  const chartData = data?.[range] || FLAT_DATA[range]

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700 dark:text-surface-300">
          {Icon && <Icon size={13} className="text-primary-600 flex-shrink-0" />}
          <span>{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {RANGES.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
              range === r
                ? 'bg-primary-500 text-surface-950'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-800'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {emptyLabel ? (
        <p className="text-xs text-surface-400 py-6">{emptyLabel}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-surface-900 dark:text-surface-100">{value}</span>
            {unit && <span className="text-xs font-semibold text-surface-400">{unit}</span>}
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#9AA09A' }} stroke="#D1D5C8" width={20} />
              <Line type="monotone" dataKey="v" stroke="var(--brand-primary, #F5A623)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
