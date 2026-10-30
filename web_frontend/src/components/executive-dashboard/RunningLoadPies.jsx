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

/**
 * Reusable Donut SVG
 * - Slices go clockwise starting from 12 o'clock in order: Wapda, Genset, Solar
 * - Displays center total kW in bold font-mono
 * - Displays dashed ring if total <= 0
 */
function DonutSvg({ items, totalKw, diameter = 92, strokeWidth = 18 }) {
  const cx = diameter / 2
  const cy = diameter / 2
  const rMid = cx - strokeWidth / 2 - 2
  const circumference = 2 * Math.PI * rMid

  if (totalKw <= 0) {
    return (
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        className="shrink-0 select-none"
      >
        <circle
          cx={cx}
          cy={cy}
          r={rMid}
          fill="none"
          stroke={COLOR_EMPTY}
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono font-black fill-slate-400 text-xs tracking-tight"
        >
          0.0
        </text>
      </svg>
    )
  }

  // Calculate slice stroke dash offsets
  let accumulatedOffset = 0
  const activeSlices = items
    .filter((it) => it.pct > 0)
    .map((it) => {
      const arcLen = (it.pct / 100) * circumference
      const slice = {
        key: it.key,
        color: it.color,
        dashArray: `${arcLen} ${circumference - arcLen}`,
        dashOffset: -accumulatedOffset,
      }
      accumulatedOffset += arcLen
      return slice
    })

  const fontSizeClass = diameter >= 110 ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      className="shrink-0 select-none"
    >
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={rMid}
        fill="none"
        stroke="#1e293b"
        strokeWidth={strokeWidth}
      />

      {/* Slices rotated -90 deg so they start at 12 o'clock */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {activeSlices.map((s) => (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={rMid}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
          />
        ))}
      </g>

      {/* Center kW Text */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className={`font-mono font-black fill-slate-900 dark:fill-slate-100 ${fontSizeClass} tracking-tight`}
      >
        {totalKw.toFixed(1)}
      </text>
    </svg>
  )
}

/**
 * 3-Row Legend for Wapda, Genset, Solar
 */
function DonutLegend({ items, totalKw }) {
  return (
    <div className="flex flex-col justify-center space-y-1">
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-[50px]">
            <span
              className="w-2 h-2 rounded-xs shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
              {item.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 text-right min-w-[48px]">
              {item.kw.toFixed(1)}{' '}
              <span className="text-[7.5px] font-sans font-semibold text-slate-400">kW</span>
            </span>
            <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 text-right min-w-[34px]">
              {totalKw > 0 ? `${item.pct.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Top-Center: Total Running Load (B1 + B2)
 * Rendered between the 4 Top KPI cards and the horizontal bus connector line.
 */
export function TotalPlantRunningLoadDonut({ data }) {
  if (!data) return null

  const building1 = data.building1 || {}
  const building2 = data.building2 || {}
  const metrics = data.metrics || {}

  const b1Sources = Array.isArray(building1.sources) ? building1.sources : []
  const b2Sources = Array.isArray(building2.sources) ? building2.sources : []

  const b1Wapda = clamp(b1Sources.find((s) => s.id === 'b1-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b1Genset = clamp(
    b1Sources
      .filter((s) => s.type === 'genset' || /genset|gen/i.test(s.name))
      .reduce((sum, s) => sum + (Number(s?.loadKw) || 0), 0)
  )
  const b1Solar = clamp(b1Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)

  const b2Wapda = clamp(b2Sources.find((s) => s.id === 'b2-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b2Genset = clamp(b2Sources.find((s) => s.type === 'genset' || /genset|gen/i.test(s.name))?.loadKw)
  const b2Solar = clamp(b2Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)

  const b1Total = clamp(building1.runningLoad)
  const b2Total = clamp(building2.runningLoad)

  const midWapda = b1Wapda + b2Wapda
  const midGenset = b1Genset + b2Genset
  const midSolar = b1Solar + b2Solar
  const midTotal = clamp(
    metrics.totalRunningLoad != null ? metrics.totalRunningLoad : b1Total + b2Total
  )

  const midSum = midWapda + midGenset + midSolar
  const midPcts = calculatePercentages(
    [midWapda, midGenset, midSolar],
    midSum > 0 ? midSum : midTotal
  )

  const items = [
    { key: 'wapda', label: 'Wapda', kw: midWapda, pct: midPcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: midGenset, pct: midPcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: midSolar, pct: midPcts[2], color: COLOR_SOLAR },
  ]

  return (
    <div className="flex items-center gap-3.5 px-3.5 py-1.5 rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-white dark:bg-slate-900/90 shadow-md">
      <DonutSvg items={items} totalKw={midTotal} diameter={114} strokeWidth={22} />
      <DonutLegend items={items} totalKw={midTotal} />
    </div>
  )
}

/**
 * Building 1 (Ambition) Header Donut Card
 * Embedded inside the B1 header flex row, directly next to the "Total Running Load B1" badge.
 */
export function Building1RunningLoadDonut({ data }) {
  if (!data) return null

  const building1 = data.building1 || {}
  const b1Sources = Array.isArray(building1.sources) ? building1.sources : []

  const b1Wapda = clamp(b1Sources.find((s) => s.id === 'b1-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b1Genset = clamp(
    b1Sources
      .filter((s) => s.type === 'genset' || /genset|gen/i.test(s.name))
      .reduce((sum, s) => sum + (Number(s?.loadKw) || 0), 0)
  )
  const b1Solar = clamp(b1Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)
  const b1Total = clamp(building1.runningLoad)

  const b1Sum = b1Wapda + b1Genset + b1Solar
  const b1Pcts = calculatePercentages(
    [b1Wapda, b1Genset, b1Solar],
    b1Sum > 0 ? b1Sum : b1Total
  )

  const items = [
    { key: 'wapda', label: 'Wapda', kw: b1Wapda, pct: b1Pcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: b1Genset, pct: b1Pcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: b1Solar, pct: b1Pcts[2], color: COLOR_SOLAR },
  ]

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl border border-blue-500/40 bg-white dark:bg-slate-900/80 shadow-2xs">
      <DonutSvg items={items} totalKw={b1Total} diameter={92} strokeWidth={18} />
      <DonutLegend items={items} totalKw={b1Total} />
    </div>
  )
}

/**
 * Building 2 (AFL) Header Donut Card
 * Embedded inside the B2 header flex row, directly next to the "Total Running Load B2" badge.
 */
export function Building2RunningLoadDonut({ data }) {
  if (!data) return null

  const building2 = data.building2 || {}
  const b2Sources = Array.isArray(building2.sources) ? building2.sources : []

  const b2Wapda = clamp(b2Sources.find((s) => s.id === 'b2-wapda' || /wapda/i.test(s.name))?.loadKw)
  const b2Genset = clamp(b2Sources.find((s) => s.type === 'genset' || /genset|gen/i.test(s.name))?.loadKw)
  const b2Solar = clamp(b2Sources.find((s) => s.type === 'solar' || /solar/i.test(s.name))?.loadKw)
  const b2Total = clamp(building2.runningLoad)

  const b2Sum = b2Wapda + b2Genset + b2Solar
  const b2Pcts = calculatePercentages(
    [b2Wapda, b2Genset, b2Solar],
    b2Sum > 0 ? b2Sum : b2Total
  )

  const items = [
    { key: 'wapda', label: 'Wapda', kw: b2Wapda, pct: b2Pcts[0], color: COLOR_WAPDA },
    { key: 'genset', label: 'Genset', kw: b2Genset, pct: b2Pcts[1], color: COLOR_GENSET },
    { key: 'solar', label: 'Solar', kw: b2Solar, pct: b2Pcts[2], color: COLOR_SOLAR },
  ]

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-900/80 shadow-2xs">
      <DonutSvg items={items} totalKw={b2Total} diameter={92} strokeWidth={18} />
      <DonutLegend items={items} totalKw={b2Total} />
    </div>
  )
}

export default function RunningLoadPies({ data }) {
  return null
}
