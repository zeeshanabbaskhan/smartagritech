import React from 'react'

export const COLOR_WAPDA = '#3B82F6'
export const COLOR_GENSET = '#A855F7'
export const COLOR_SOLAR = '#F59E0B'
export const COLOR_EMPTY = '#64748B'

function clamp(val) {
  return Math.max(0, Number(val) || 0)
}

function calculatePercentages(values, total) {
  if (total <= 0) {
    return values.map(() => 0)
  }
  const rawTenths = values.map((val) => (val / total) * 1000)
  const floorTenths = rawTenths.map((t) => Math.floor(t))
  let remainder = 1000 - floorTenths.reduce((a, b) => a + b, 0)

  const order = rawTenths
    .map((t, i) => ({ frac: t - floorTenths[i], i }))
    .sort((a, b) => b.frac - a.frac)

  for (let k = 0; k < remainder; k++) {
    floorTenths[order[k].i]++
  }
  return floorTenths.map((t) => t / 10)
}

function PieSvg({ items, totalKw }) {
  const cx = 64
  const cy = 64
  const r = 54

  if (totalKw <= 0) {
    return (
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 select-none">
        <circle
          cx={cx}
          cy={cy}
          r={50}
          fill="none"
          stroke={COLOR_EMPTY}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94A3B8"
          fontSize="10.5"
          fontWeight="500"
        >
          No running load
        </text>
      </svg>
    )
  }

  // Active slices
  const activeItems = items.filter((item) => item.pct > 0)
  if (activeItems.length === 1) {
    const single = activeItems[0]
    return (
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 select-none">
        <circle cx={cx} cy={cy} r={r} fill={single.color} />
        {single.pct >= 10 && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontSize="12"
            fontWeight="bold"
          >
            {Math.round(single.pct)}%
          </text>
        )}
      </svg>
    )
  }

  let currentAngle = -Math.PI / 2
  const slices = items
    .filter((item) => item.pct > 0)
    .map((item) => {
      const sweepAngle = (item.pct / 100) * 2 * Math.PI
      const startAngle = currentAngle
      const endAngle = startAngle + sweepAngle
      currentAngle = endAngle

      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      const largeArc = sweepAngle > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

      const midAngle = startAngle + sweepAngle / 2
      const textRadius = r * 0.62
      const tx = cx + textRadius * Math.cos(midAngle)
      const ty = cy + textRadius * Math.sin(midAngle)

      return {
        ...item,
        d,
        tx,
        ty,
        showText: item.pct >= 10,
      }
    })

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 select-none">
      {slices.map((slice) => (
        <path key={slice.key} d={slice.d} fill={slice.color} />
      ))}
      {slices.map((slice) =>
        slice.showText ? (
          <text
            key={`txt-${slice.key}`}
            x={slice.tx}
            y={slice.ty}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="bold"
          >
            {Math.round(slice.pct)}%
          </text>
        ) : null
      )}
    </svg>
  )
}

function PieCard({ title, totalKw, items, borderColor, titleColor, totalColor }) {
  return (
    <div
      className={`p-2 sm:p-2.5 rounded-xl border-2 ${borderColor} bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
        <span
          className={`text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-wider ${titleColor}`}
        >
          {title}
        </span>
        <span className={`text-sm font-black font-mono leading-none ${totalColor}`}>
          {totalKw.toFixed(1)}{' '}
          <span className="text-[8px] sm:text-[8.5px] font-sans font-bold text-slate-400">kW</span>
        </span>
      </div>

      {/* Body: Pie + Legend */}
      <div className="flex items-center justify-between gap-2">
        <PieSvg items={items} totalKw={totalKw} />

        <div className="flex-1 space-y-1.5 pl-1 min-w-[140px]">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-1.5 min-w-[55px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-900 dark:text-slate-100 text-right min-w-[50px]">
                  {item.kw.toFixed(1)}{' '}
                  <span className="text-[7.5px] font-sans text-slate-400 font-normal">kW</span>
                </span>
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 text-right min-w-[38px]">
                  {totalKw > 0 ? `${item.pct.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RunningLoadPies({ data }) {
  if (!data) return null

  const building1 = data.building1 || {}
  const building2 = data.building2 || {}
  const metrics = data.metrics || {}

  // 1. Ambition (B1)
  const b1Total = clamp(building1.runningLoad)
  const b1Sources = Array.isArray(building1.sources) ? building1.sources : []
  const b1Wapda = clamp(b1Sources.find((s) => s.id === 'b1-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b1Genset = clamp(
    b1Sources
      .filter((s) => s.type === 'genset' || /genset|gen/i.test(s.name))
      .reduce((sum, s) => sum + (Number(s?.loadKw) || 0), 0)
  )
  const b1Solar = clamp(b1Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)

  const b1Sum = b1Wapda + b1Genset + b1Solar
  const b1Pcts = calculatePercentages([b1Wapda, b1Genset, b1Solar], b1Sum > 0 ? b1Sum : b1Total)
  const b1Items = [
    { key: 'wapda', label: 'Wapda', kw: b1Wapda, pct: b1Pcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: b1Genset, pct: b1Pcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: b1Solar, pct: b1Pcts[2], color: COLOR_SOLAR },
  ]

  // 2. AFL (B2)
  const b2Total = clamp(building2.runningLoad)
  const b2Sources = Array.isArray(building2.sources) ? building2.sources : []
  const b2Wapda = clamp(b2Sources.find((s) => s.id === 'b2-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b2Genset = clamp(b2Sources.find((s) => s.type === 'genset' || /genset|gen/i.test(s.name))?.loadKw)
  const b2Solar = clamp(b2Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)

  const b2Sum = b2Wapda + b2Genset + b2Solar
  const b2Pcts = calculatePercentages([b2Wapda, b2Genset, b2Solar], b2Sum > 0 ? b2Sum : b2Total)
  const b2Items = [
    { key: 'wapda', label: 'Wapda', kw: b2Wapda, pct: b2Pcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: b2Genset, pct: b2Pcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: b2Solar, pct: b2Pcts[2], color: COLOR_SOLAR },
  ]

  // 3. Middle Total (B1 + B2)
  const midTotal = clamp(
    metrics.totalRunningLoad != null ? metrics.totalRunningLoad : b1Total + b2Total
  )
  const midWapda = b1Wapda + b2Wapda
  const midGenset = b1Genset + b2Genset
  const midSolar = b1Solar + b2Solar

  const midSum = midWapda + midGenset + midSolar
  const midPcts = calculatePercentages([midWapda, midGenset, midSolar], midSum > 0 ? midSum : midTotal)
  const midItems = [
    { key: 'wapda', label: 'Wapda', kw: midWapda, pct: midPcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: midGenset, pct: midPcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: midSolar, pct: midPcts[2], color: COLOR_SOLAR },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 xl:gap-3 mt-2">
      <PieCard
        title="AMBITION (B1) - RUNNING LOAD"
        totalKw={b1Total}
        items={b1Items}
        borderColor="border-blue-500/80 dark:border-blue-500/60"
        titleColor="text-slate-500 dark:text-slate-400"
        totalColor="text-blue-600 dark:text-blue-400"
      />
      <PieCard
        title="TOTAL RUNNING LOAD (B1 + B2)"
        totalKw={midTotal}
        items={midItems}
        borderColor="border-slate-300 dark:border-slate-700"
        titleColor="text-slate-500 dark:text-slate-400"
        totalColor="text-blue-600 dark:text-blue-400"
      />
      <PieCard
        title="AFL (B2) - RUNNING LOAD"
        totalKw={b2Total}
        items={b2Items}
        borderColor="border-emerald-500/80 dark:border-emerald-500/60"
        titleColor="text-slate-500 dark:text-slate-400"
        totalColor="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  )
}
