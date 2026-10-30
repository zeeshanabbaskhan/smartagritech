/**

 * ALL-IN-ONE STANDALONE EXECUTIVE DASHBOARD

 * Contains all components, electrical topology, 24 variables, and CSV exporter in a single file.

 * Drop this single file into any React project.

 */

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Zap, Sun, Fuel, Activity, Radio, ArrowRight, Loader2,
  X, Gauge, AlertTriangle, ShieldCheck, Flame, Power,
  Maximize2, Minimize2, Download, Calendar, Layers,
  CheckSquare, Square, Check, BarChart2, TrendingUp,
  Cpu, Clock, RefreshCw, FileText, Play, Pause,
  Moon, Minus, Plus, ChevronLeft, ChevronRight
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'
import emsApi, { list } from '../../api/emsApi'
import { latestToReadings } from '../../utils/sensorReadings'
import { formatMetricValue } from '../shared/dashboardFormatters'
import { labelFor, sortLegacy } from '../shared/DeviceSlaveMetricsPanel'
import {
  TotalPlantRunningLoadDonut,
  Building1RunningLoadDonut,
  Building2RunningLoadDonut,
} from './RunningLoadPies'


/**
 * Standalone Client-side CSV export helper.
 * Generates and triggers instant browser download of standard CSV files.
 */
export function toCsv(header, rows) {
  return [header, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadCsv(filename, header, rows) {
  // UTF-8 BOM helps Excel and SCADA open the file with the correct encoding.
  const csv = `\uFEFF${toCsv(header, rows)}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}


/**
 * Energy Flow Overview Data Model & Live Simulation Engine
 * Models Building 1 (Ambition) and Building 2 (AFL) electrical architecture
 * strictly matching the single-line diagram sketch.
 */

export const INITIAL_FLOW_DATA = {
  timestamp: new Date().toISOString(),
  metrics: {
    totalWapda: 545.3,
    totalRunningLoad: 740.5,
    solarTotal: 195.2,
    totalGenset: 0.0,
    powerFactor: 0.98,
    gridFrequency: 50.02,
    co2AvoidedKg: 87.8,
    tariffRatePkr: 38.5,
    contributingSlaves: {
      wapda: [
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '70fbfe31-667a-45cc-86e4-1c25bf4607dd', name: 'WAPDA-AMB' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '27b7fd32-1ac6-480c-82eb-280abf6d0636', name: 'WAPDA-AFL' },
      ],
      solar: [
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '8910d746-2eb2-4293-9feb-53f51b8d932b', name: 'Solar AMB-1,2,3' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: 'a05f0098-9046-4a20-8d78-9ce46d4f3535', name: 'Solar-INVT-4' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '7683034e-bfc6-429a-b1c3-7aa559ad9442', name: 'Solar-INVT-5' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '97b044fb-2619-4aa2-acba-b2bd6240e471', name: 'Solar AFL' },
      ],
      genset: [
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', name: 'G1' },
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', name: 'G2' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: 'aa419c5c-27e5-460c-b9a4-ad4be67184f9', name: 'G3 AFL' },
      ],
      runningLoad: [
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '70fbfe31-667a-45cc-86e4-1c25bf4607dd', name: 'WAPDA-AMB' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '27b7fd32-1ac6-480c-82eb-280abf6d0636', name: 'WAPDA-AFL' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '8910d746-2eb2-4293-9feb-53f51b8d932b', name: 'Solar AMB-1,2,3' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: 'a05f0098-9046-4a20-8d78-9ce46d4f3535', name: 'Solar-INVT-4' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '7683034e-bfc6-429a-b1c3-7aa559ad9442', name: 'Solar-INVT-5' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '97b044fb-2619-4aa2-acba-b2bd6240e471', name: 'Solar AFL' },
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', name: 'G1' },
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', name: 'G2' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: 'aa419c5c-27e5-460c-b9a4-ad4be67184f9', name: 'G3 AFL' },
      ],
      runningLoadB1: [
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '70fbfe31-667a-45cc-86e4-1c25bf4607dd', name: 'WAPDA-AMB' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '8910d746-2eb2-4293-9feb-53f51b8d932b', name: 'Solar AMB-1,2,3' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: 'a05f0098-9046-4a20-8d78-9ce46d4f3535', name: 'Solar-INVT-4' },
        { deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12', slaveId: '7683034e-bfc6-429a-b1c3-7aa559ad9442', name: 'Solar-INVT-5' },
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', name: 'G1' },
        { deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', name: 'G2' },
      ],
      runningLoadB2: [
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '27b7fd32-1ac6-480c-82eb-280abf6d0636', name: 'WAPDA-AFL' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: '97b044fb-2619-4aa2-acba-b2bd6240e471', name: 'Solar AFL' },
        { deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d', slaveId: 'aa419c5c-27e5-460c-b9a4-ad4be67184f9', name: 'G3 AFL' },
      ],
    },
  },
  building1: {
    id: 'b1',
    name: 'B1 (Ambition Plant)',
    code: 'B1',
    runningLoad: 568.8,
    units: 428798.0,
    maxCapacityKw: 2000,
    sources: [
      { id: 'b1-wapda', name: 'WAPDA-AMB', type: 'grid', loadKw: 432.6, voltage: 402, current: 620, pf: 0.98, status: 'active', units: 369630.0, slaveId: '70fbfe31-667a-45cc-86e4-1c25bf4607dd', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-genset1', name: 'Genset 01 (G1)', type: 'genset', loadKw: 0.0, voltage: 400, current: 0, pf: 0.96, status: 'standby', units: 16092.5, slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-genset2', name: 'Genset 02 (G2)', type: 'genset', loadKw: 0.0, voltage: 400, current: 0, pf: 0.95, status: 'standby', units: 19652.8, slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-solar', name: 'Solar AMB (5 Inv)', type: 'solar', loadKw: 136.2, voltage: 405, current: 195, pf: 0.99, status: 'generating', units: 59168.0, slaveId: '8910d746-2eb2-4293-9feb-53f51b8d932b', deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12' },
    ],
    // 4 exact rows of real registered Ambition slaves:
    row1: [
      { id: 'b1-r1-1', name: 'Office-Amb', ratedA: 100, loadKw: 54.8, status: 'normal' },
      { id: 'b1-r1-2', name: 'Sampling Stitching', ratedA: 250, loadKw: 61.9, status: 'normal' },
      { id: 'b1-r1-3', name: 'Washing Hall', ratedA: 400, loadKw: 192.8, status: 'heavy' },
      { id: 'b1-r1-4', name: 'Finshing AMB', ratedA: 250, loadKw: 45.2, status: 'normal' },
      { id: 'b1-r1-5', name: 'Boiler', ratedA: 350, loadKw: 54.5, status: 'normal' },
      { id: 'b1-r1-6', name: 'SEWING-3F-AMB', ratedA: 200, loadKw: 8.5, status: 'normal' },
      { id: 'b1-r1-7', name: 'Sewing-1F-AMB', ratedA: 160, loadKw: 65.7, status: 'normal' },
    ],
    row2: [
      { id: 'b1-r2-1', name: 'Cutting Hall', ratedA: 300, loadKw: 2.8, status: 'normal' },
      { id: 'b1-r2-2', name: 'Laser Hall', ratedA: 100, loadKw: 8.0, status: 'normal' },
      { id: 'b1-r2-3', name: 'ETP-AMB', ratedA: 200, loadKw: 21.8, status: 'normal' },
      { id: 'b1-r2-4', name: 'LT Room', ratedA: 125, loadKw: 4.6, status: 'normal' },
      { id: 'b1-r2-5', name: 'Comp-AMB', ratedA: 200, loadKw: 71.5, status: 'normal' },
      { id: 'b1-r2-6', name: '3F-AIR-Cooler', ratedA: 150, loadKw: 0.4, status: 'normal' },
      { id: 'b1-r2-7', name: 'Wash-Random-UPS', ratedA: 200, loadKw: 2.6, status: 'normal' },
    ],
    row3: [
      { id: 'b1-r3-1', name: 'Solar-INVT-4', ratedA: 160, loadKw: 35.0, status: 'generating', units: 11684.5, slaveId: 'a05f0098-9046-4a20-8d78-9ce46d4f3535', deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12' },
      { id: 'b1-r3-2', name: 'Solar-INVT-5', ratedA: 160, loadKw: 32.2, status: 'generating', units: 14561.8, slaveId: '7683034e-bfc6-429a-b1c3-7aa559ad9442', deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12' },
      { id: 'b1-r3-3', name: 'Solar AMB-1,2,3', ratedA: 160, loadKw: 59.2, status: 'generating', units: 32921.7, slaveId: '8910d746-2eb2-4293-9feb-53f51b8d932b', deviceId: 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12' },
      { id: 'b1-r3-4', name: 'Dryer Hall', ratedA: 350, loadKw: 89.4, status: 'normal' },
      { id: 'b1-r3-5', name: 'WashingLTPanel', ratedA: 400, loadKw: 241.9, status: 'heavy' },
      { id: 'b1-r3-6', name: 'Spare-1', ratedA: 100, loadKw: 0.0, status: 'spare' },
      { id: 'b1-r3-7', name: 'Spare-2', ratedA: 100, loadKw: 0.0, status: 'spare' },
    ],
    row4: [
      { id: 'b1-r4-1', name: 'G1', ratedA: 100, loadKw: 0.0, status: 'standby', units: 16092.5, slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-r4-2', name: 'G2', ratedA: 100, loadKw: 0.0, status: 'standby', units: 19652.8, slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-r4-3', name: 'WAPDA-AMB', ratedA: 400, loadKw: 432.6, status: 'heavy', units: 369630.0, slaveId: '70fbfe31-667a-45cc-86e4-1c25bf4607dd', deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f' },
      { id: 'b1-r4-4', name: 'Tie-Feeder to AFL', ratedA: 350, loadKw: 0.0, status: 'tie-line' },
    ],
  },
  building2: {
    id: 'b2',
    name: 'Building 2 (AFL Plant)',
    code: 'B2',
    runningLoad: 298.4,
    units: 201421.0,
    maxCapacityKw: 1800,
    sources: [
      { id: 'b2-solar', name: 'Solar AFL', type: 'solar', loadKw: 36.1, voltage: 405, current: 85, pf: 0.98, status: 'generating', units: 21692.5, slaveId: '97b044fb-2619-4aa2-acba-b2bd6240e471', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
      { id: 'b2-genset', name: 'Genset (G3 AFL)', type: 'genset', loadKw: 0.0, voltage: 400, current: 0, pf: 0.96, status: 'standby', units: 7038.9, slaveId: 'aa419c5c-27e5-460c-b9a4-ad4be67184f9', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
      { id: 'b2-wapda', name: 'WAPDA-AFL', type: 'grid', loadKw: 262.3, voltage: 401, current: 162, pf: 0.98, status: 'active', units: 179728.5, slaveId: '27b7fd32-1ac6-480c-82eb-280abf6d0636', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
    ],
    // 4 exact rows of real registered AFL slaves:
    row1: [
      { id: 'b2-r1-1', name: '1F-MAIN DB-FINISHING', ratedA: 250, loadKw: 28.8, status: 'normal' },
      { id: 'b2-r1-2', name: '2F-MAIN DB-SEWING', ratedA: 200, loadKw: 31.1, status: 'normal' },
      { id: 'b2-r1-3', name: '3F-MAIN DB-SEWING', ratedA: 160, loadKw: 3.2, status: 'normal' },
      { id: 'b2-r1-4', name: 'GF-Main-DB', ratedA: 160, loadKw: 41.9, status: 'normal' },
      { id: 'b2-r1-5', name: 'Ground Floor B', ratedA: 160, loadKw: 6.3, status: 'normal' },
      { id: 'b2-r1-6', name: '1F Back Side DB', ratedA: 100, loadKw: 0.3, status: 'normal' },
      { id: 'b2-r1-7', name: '2F-DB Back Side', ratedA: 100, loadKw: 0.0, status: 'normal' },
    ],
    row2: [
      { id: 'b2-r2-1', name: 'COMP-132KW', ratedA: 300, loadKw: 271.3, status: 'critical' },
      { id: 'b2-r2-2', name: '55KW Comp', ratedA: 150, loadKw: 0.0, status: 'normal' },
      { id: 'b2-r2-3', name: 'Comp', ratedA: 150, loadKw: 2.4, status: 'normal' },
      { id: 'b2-r2-4', name: 'ETP-AFL', ratedA: 200, loadKw: 10.0, status: 'normal' },
      { id: 'b2-r2-5', name: 'Air Cooler 2nd Floor', ratedA: 100, loadKw: 0.0, status: 'normal' },
      { id: 'b2-r2-6', name: 'Solar AFL', ratedA: 250, loadKw: 36.1, status: 'generating', units: 21692.5, slaveId: '97b044fb-2619-4aa2-acba-b2bd6240e471', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
      { id: 'b2-r2-7', name: 'Drain Pump', ratedA: 125, loadKw: 0.0, status: 'normal' },
    ],
    row3: [
      { id: 'b2-r3-1', name: 'Spray Booth 1', ratedA: 125, loadKw: 9.5, status: 'normal' },
      { id: 'b2-r3-2', name: 'Spray Booth 2', ratedA: 125, loadKw: 11.2, status: 'normal' },
      { id: 'b2-r3-3', name: 'Spray Booth 3', ratedA: 125, loadKw: 10.3, status: 'normal' },
      { id: 'b2-r3-4', name: 'LT Panel Room-AFL', ratedA: 160, loadKw: 4.3, status: 'normal' },
      { id: 'b2-r3-5', name: 'Ozone UPS', ratedA: 100, loadKw: 2.6, status: 'normal' },
      { id: 'b2-r3-6', name: 'Spare', ratedA: 100, loadKw: 0.0, status: 'spare' },
      { id: 'b2-r3-7', name: 'Spare Feeder 2', ratedA: 100, loadKw: 0.0, status: 'spare' },
    ],
    row4: [
      { id: 'b2-r4-1', name: 'G3 AFL', ratedA: 150, loadKw: 0.0, status: 'normal', units: 7038.9, slaveId: 'aa419c5c-27e5-460c-b9a4-ad4be67184f9', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
      { id: 'b2-r4-2', name: 'WAPDA-AFL', ratedA: 200, loadKw: 262.3, status: 'critical', units: 179728.5, slaveId: '27b7fd32-1ac6-480c-82eb-280abf6d0636', deviceId: 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' },
      { id: 'b2-r4-3', name: 'From Ambition (Tie-Line)', ratedA: 300, loadKw: 0.0, status: 'tie-line' },
    ],
  },
}

// Flat list helper
export function getAllBreakers(building) {
  return [...building.row1, ...building.row2, ...building.row3, ...building.row4]
}

/**
 * Generates electrical telemetry for individual breaker nodes
 */
// In-memory caches for instantaneous (0ms) slave telemetry variable rendering
const varDefinitionsCache = new Map()
const slaveRowsCache = new Map()
const historyDataCache = new Map()

export const FIFTEEN_VAR_SLAVE_NAMES = new Set([
  '1f back side db',
  '1f-main db-finishing',
  '1st floor pr',
  '2f-db back side',
  '2f-main db-sewing',
  '2nd floor',
  '3f-air-cooler',
  '3f air cooler',
  '3f-main db-sewing',
  '3rd floor',
  '55kw comp',
  'air cooler 2nd floor',
  'boiler',
  'drain pump',
  'finshing amb',
  'finishing amb',
  'fhall',
  'lt panel room-afl',
  'ozone ups',
  'sampling stitching',
  'spare',
  'spray booth 1',
  'spray booth 2',
  'spray booth 3',
  'suprafurnace',
  'washing hall',
  'w hall',
  'whall',
])

export function isFifteenVarSlave(name) {
  if (!name) return false
  const norm = String(name).toLowerCase().trim().replace(/[\s_\-]+/g, ' ')
  for (const s of FIFTEEN_VAR_SLAVE_NAMES) {
    if (norm === s || norm.includes(s) || s.includes(norm)) return true
  }
  return false
}

export function generateBreakerDetails(breaker, buildingCode) {
  if (Array.isArray(breaker.variables24) && breaker.variables24.length > 0) {
    const isTripped = breaker.status === 'tripped' && Number(breaker.loadKw || 0) === 0
    const loadKw = isTripped ? 0 : (breaker.loadKw || 0)
    const sparkline = Array.from({ length: 12 }, (_, i) => {
      const jitter = loadKw > 0 ? (Math.random() * 2 - 1) : 0
      return {
        time: `-${(11 - i) * 5}m`,
        kw: Math.max(0, Number((loadKw + jitter).toFixed(1))),
      }
    })
    return {
      ...breaker,
      loadKw,
      buildingCode: buildingCode || breaker.buildingCode,
      rawSlaveId: breaker.rawSlaveId || breaker.slaveId,
      rawDeviceId: breaker.rawDeviceId || breaker.deviceId,
      contributingSlaves: breaker.contributingSlaves,
      slaveId: breaker.slaveId ? (String(breaker.slaveId).length > 8 ? String(breaker.slaveId).slice(-6).toUpperCase() : breaker.slaveId) : '0x01',
      slaveName: breaker.name,
      gateway: breaker.deviceName || `EMS-GW-${buildingCode || 'B1'}-01`,
      busChannel: 'Modbus RTU RS485',
      sparkline,
    }
  }

  const isTripped = breaker.status === 'tripped' && Number(breaker.loadKw || 0) === 0
  const isOffline = breaker.status === 'offline' || breaker.status === 'OFFLINE' || (Number(breaker.voltage || 0) === 0 && Number(breaker.loadKw || 0) === 0 && !breaker.name?.toLowerCase().includes('spare'))
  const rawKw = breaker.loadKw != null ? breaker.loadKw : (breaker.runningLoad != null ? breaker.runningLoad : 0)
  const loadKw = (isTripped || isOffline) ? 0 : (Number(rawKw) || 0)
  const vLine = Number.isFinite(Number(breaker.voltage)) ? Number(breaker.voltage) : (isOffline ? 0.0 : 400.0)
  const vPhase = vLine > 0 ? +(vLine / Math.sqrt(3)).toFixed(1) : 0.0
  const pf = (isTripped || isOffline || vLine === 0) ? 0 : (Number(breaker.powerFactor || breaker.pf) || 0.96)
  const freq = (isTripped || isOffline || vLine === 0) ? 0 : (Number(breaker.frequency) || 50.0)
  const current = (loadKw > 0 && vLine > 0)
    ? (loadKw * 1000) / (Math.sqrt(3) * vLine * (pf || 0.96))
    : 0
  const kva = pf > 0 ? loadKw / pf : 0
  const kvar = Math.sqrt(Math.max(0, kva * kva - loadKw * loadKw))
  const ratedA = breaker.ratedA || (loadKw > 0 ? Math.ceil(current * 1.25) : 400)
  const utilization = ratedA > 0 ? Math.min(100, Math.round((current / ratedA) * 100)) : 0
  const units = Number(breaker.units) || 0.0

  const slaveIdHex = breaker.slaveId
    ? (String(breaker.slaveId).length > 8 ? String(breaker.slaveId).slice(-6).toUpperCase() : breaker.slaveId)
    : ('0x' + (Math.abs(String(breaker.id || 'b1').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 30) + 1).toString(16).padStart(2, '0')).toUpperCase()

  // Disambiguate Phase A neutral voltage: AFL uses 'Voltage', Ambition uses 'VoltageA'
  const isAFL = breaker.buildingCode === 'B2' || /afl/i.test(breaker.name || '')
  const vAName = isAFL ? 'Voltage' : 'VoltageA'
  const is15Var = isFifteenVarSlave(breaker.name)

  // Standardized fallback matching hardware meter parameters exactly:
  // 15-variable slaves omit per-phase synthesized powers (matching Device Telemetry 1-to-1)
  const variables24 = is15Var ? [
    { key: 'Total Power', name: 'Total Power', shortName: 'Total Power', value: Number(loadKw.toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'Phase VoltageA', name: 'Phase VoltageA', shortName: 'Phase VoltageA', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageB', name: 'Phase VoltageB', shortName: 'Phase VoltageB', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageC', name: 'Phase VoltageC', shortName: 'Phase VoltageC', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: vAName, name: vAName, shortName: vAName, value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageB', name: 'VoltageB', shortName: 'VoltageB', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageC', name: 'VoltageC', shortName: 'VoltageC', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Current A', name: 'Current A', shortName: 'Current A', value: Number((current * 0.98).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current B', name: 'Current B', shortName: 'Current B', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current C', name: 'Current C', shortName: 'Current C', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Total Reactive Power', name: 'Total Reactive Power', shortName: 'Total Reactive', value: Number(kvar.toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Total Apparent Power', name: 'Total Apparent Power', shortName: 'Total Apparent', value: Number(kva.toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Power Factor', name: 'Power Factor', shortName: 'Power Factor', value: Number(pf.toFixed(3)), unit: 'PF', group: 'quality' },
    { key: 'Frequency', name: 'Frequency', shortName: 'Frequency', value: Number(freq.toFixed(2)), unit: 'Hz', group: 'quality' },
    { key: 'Units', name: 'Units', shortName: 'Units (kWh)', value: Number(units.toFixed(1)), unit: 'kWh', group: 'energy' },
  ] : [
    { key: 'Total Power', name: 'Total Power', shortName: 'Total Power', value: Number(loadKw.toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerA', name: 'PowerA', shortName: 'PowerA', value: Number(((loadKw / 3) * 0.98).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerB', name: 'PowerB', shortName: 'PowerB', value: Number(((loadKw / 3) * 1.01).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerC', name: 'PowerC', shortName: 'PowerC', value: Number(((loadKw / 3) * 1.01).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'Phase VoltageA', name: 'Phase VoltageA', shortName: 'Phase VoltageA', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageB', name: 'Phase VoltageB', shortName: 'Phase VoltageB', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageC', name: 'Phase VoltageC', shortName: 'Phase VoltageC', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: vAName, name: vAName, shortName: vAName, value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageB', name: 'VoltageB', shortName: 'VoltageB', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageC', name: 'VoltageC', shortName: 'VoltageC', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Current A', name: 'Current A', shortName: 'Current A', value: Number((current * 0.98).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current B', name: 'Current B', shortName: 'Current B', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current C', name: 'Current C', shortName: 'Current C', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Total Reactive Power', name: 'Total Reactive Power', shortName: 'Total Reactive', value: Number(kvar.toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power A', name: 'Reactive Power A', shortName: 'Reactive A', value: Number(((kvar / 3) * 0.97).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power B', name: 'Reactive Power B', shortName: 'Reactive B', value: Number(((kvar / 3) * 1.02).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power C', name: 'Reactive Power C', shortName: 'Reactive C', value: Number(((kvar / 3) * 1.01).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Total Apparent Power', name: 'Total Apparent Power', shortName: 'Total Apparent', value: Number(kva.toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power A', name: 'Apparent Power A', shortName: 'Apparent A', value: Number(((kva / 3) * 0.98).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power B', name: 'Apparent Power B', shortName: 'Apparent B', value: Number(((kva / 3) * 1.01).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power C', name: 'Apparent Power C', shortName: 'Apparent C', value: Number(((kva / 3) * 1.01).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Power Factor', name: 'Power Factor', shortName: 'Power Factor', value: Number(pf.toFixed(3)), unit: 'PF', group: 'quality' },
    { key: 'Frequency', name: 'Frequency', shortName: 'Frequency', value: Number(freq.toFixed(2)), unit: 'Hz', group: 'quality' },
    { key: 'Units', name: 'Units', shortName: 'Units (kWh)', value: Number(units.toFixed(1)), unit: 'kWh', group: 'energy' },
  ]

  const sparkline = Array.from({ length: 12 }, (_, i) => {
    const jitter = loadKw > 0 ? (Math.random() * 4 - 2) : 0
    return {
      time: `-${(11 - i) * 5}m`,
      kw: Math.max(0, Number((loadKw + jitter).toFixed(1))),
    }
  })

  return {
    ...breaker,
    loadKw,
    ratedA,
    buildingCode,
    rawSlaveId: breaker.rawSlaveId || breaker.slaveId,
    rawDeviceId: breaker.rawDeviceId || breaker.deviceId,
    contributingSlaves: breaker.contributingSlaves,
    slaveId: slaveIdHex,
    slaveName: breaker.name || `Source (${slaveIdHex})`,
    gateway: breaker.deviceName || `EMS-GW-${buildingCode || 'B1'}-01`,
    busChannel: 'RS485 Ch-1 (9600 8-N-1)',
    voltage: Number(vLine.toFixed(1)),
    current: Number(current.toFixed(1)),
    powerFactor: Number(pf.toFixed(2)),
    frequency: Number(freq.toFixed(2)),
    units: Number(units.toFixed(1)),
    kvar: Number(kvar.toFixed(1)),
    kva: Number(kva.toFixed(1)),
    utilizationPercent: utilization,
    sparkline,
    variables24,
    thdPercent: loadKw > 0 ? Number((2.1 + Math.random() * 1.5).toFixed(1)) : 0.8,
  }
}

/**
 * Real-time simulation tick for coherent mathematical balance
 */
export function simulateFlowTick(prev) {
  const jitterFactor = () => (Math.random() * 0.01 - 0.005) // ±0.5% subtle jitter

  const updateRow = (row) =>
    row.map((b) => {
      if (b.status === 'spare' || b.loadKw === 0) return b
      const newKw = Number((b.loadKw * (1 + jitterFactor())).toFixed(1))
      return { ...b, loadKw: Math.max(0.1, newKw) }
    })

  const b1r1 = updateRow(prev.building1.row1)
  const b1r2 = updateRow(prev.building1.row2)
  const b1r3 = updateRow(prev.building1.row3)
  const b1r4 = updateRow(prev.building1.row4)

  const b2r1 = updateRow(prev.building2.row1)
  const b2r2 = updateRow(prev.building2.row2)
  const b2r3 = updateRow(prev.building2.row3)
  const b2r4 = updateRow(prev.building2.row4)

  const b1All = [...b1r1, ...b1r2, ...b1r3, ...b1r4]
  const b2All = [...b2r1, ...b2r2, ...b2r3, ...b2r4]

  const b1Solar = Number(((prev.building1.sources.find((s) => s.type === 'solar')?.loadKw || 136.2) * (1 + jitterFactor())).toFixed(1))
  const b2Solar = Number(((prev.building2.sources.find((s) => s.type === 'solar')?.loadKw || 59.0) * (1 + jitterFactor())).toFixed(1))
  const solarTotal = Number((b1Solar + b2Solar).toFixed(1))

  const b1Genset1 = Number((prev.building1.sources.find((s) => s.id === 'b1-genset1')?.loadKw || 0.0))
  const b1Genset2 = Number((prev.building1.sources.find((s) => s.id === 'b1-genset2')?.loadKw || 0.0))
  const b2Genset = Number((prev.building2.sources.find((s) => s.type === 'genset')?.loadKw || 0.0))
  const totalGenset = Number((b1Genset1 + b1Genset2 + b2Genset).toFixed(1))

  const b1Wapda = Number(((prev.building1.sources.find((s) => s.id === 'b1-wapda')?.loadKw || 432.6) * (1 + jitterFactor())).toFixed(1))
  const b2Wapda = Number(((prev.building2.sources.find((s) => s.id === 'b2-wapda')?.loadKw || 112.7) * (1 + jitterFactor())).toFixed(1))
  const totalWapda = Number((b1Wapda + b2Wapda).toFixed(1))

  const b1Load = Number((b1Wapda + b1Solar + b1Genset1 + b1Genset2).toFixed(1))
  const b2Load = Number((b2Wapda + b2Solar + b2Genset).toFixed(1))
  const totalRunningLoad = Number((b1Load + b2Load).toFixed(1))

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      totalWapda,
      totalRunningLoad,
      solarTotal,
      totalGenset,
      powerFactor: Number((0.96 + Math.random() * 0.01).toFixed(2)),
      gridFrequency: Number((50.0 + (Math.random() * 0.04 - 0.02)).toFixed(2)),
      co2AvoidedKg: Number(((prev.metrics.co2AvoidedKg || 387.0) + (solarTotal * 0.0001)).toFixed(1)),
      tariffRatePkr: prev.metrics.tariffRatePkr || 28.0,
    },
    building1: {
      ...prev.building1,
      runningLoad: b1Load,
      sources: prev.building1.sources.map((s) => {
        if (s.id === 'b1-wapda') return { ...s, loadKw: b1Wapda }
        if (s.type === 'solar') return { ...s, loadKw: b1Solar }
        return s
      }),
      row1: b1r1,
      row2: b1r2,
      row3: b1r3,
      row4: b1r4,
    },
    building2: {
      ...prev.building2,
      runningLoad: b2Load,
      sources: prev.building2.sources.map((s) => {
        if (s.id === 'b2-wapda') return { ...s, loadKw: b2Wapda }
        if (s.type === 'solar') return { ...s, loadKw: b2Solar }
        return s
      }),
      row1: b2r1,
      row2: b2r2,
      row3: b2r3,
      row4: b2r4,
    },
  }
}






// Exact Organization Dashboard Telemetry Variables Resolver
function getResolvedVariables(node) {
  if (Array.isArray(node?.variables24) && node.variables24.length > 0) {
    return node.variables24
  }
  const isTripped = node?.status === 'tripped' && Number(node?.loadKw || 0) === 0
  const isOffline = node?.status === 'offline' || node?.status === 'OFFLINE' || (Number(node?.voltage || 0) === 0 && Number(node?.loadKw || 0) === 0 && !node?.name?.toLowerCase().includes('spare'))
  const loadKw = (isTripped || isOffline) ? 0 : (Number(node?.loadKw) || 0.0)
  const vLine = Number.isFinite(Number(node?.voltage)) ? Number(node.voltage) : (isOffline ? 0.0 : 400.0)
  const vPhase = vLine > 0 ? +(vLine / Math.sqrt(3)).toFixed(1) : 0.0
  const pf = (isTripped || isOffline || vLine === 0) ? 0 : (Number(node?.powerFactor) || 0.96)
  const current = (loadKw > 0 && vLine > 0) ? (loadKw * 1000) / (Math.sqrt(3) * vLine * (pf || 0.96)) : 0
  const kva = pf > 0 ? loadKw / pf : 0
  const kvar = Math.sqrt(Math.max(0, kva * kva - loadKw * loadKw))
  const freq = (isOffline || vLine === 0) ? 0 : (Number(node?.frequency) || 50.02)
  const units = Number(node?.units) || 0.0

  const isAFL = node?.buildingCode === 'B2' || /afl/i.test(node?.name || '')
  const vAName = isAFL ? 'Voltage' : 'VoltageA'
  const is15Var = isFifteenVarSlave(node?.name)

  if (is15Var) {
    return [
      { key: 'Total Power', name: 'Total Power', shortName: 'Total Power', value: Number(loadKw.toFixed(1)), unit: 'kW', group: 'power' },
      { key: 'Phase VoltageA', name: 'Phase VoltageA', shortName: 'Phase VoltageA', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: 'Phase VoltageB', name: 'Phase VoltageB', shortName: 'Phase VoltageB', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: 'Phase VoltageC', name: 'Phase VoltageC', shortName: 'Phase VoltageC', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: vAName, name: vAName, shortName: vAName, value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: 'VoltageB', name: 'VoltageB', shortName: 'VoltageB', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: 'VoltageC', name: 'VoltageC', shortName: 'VoltageC', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
      { key: 'Current A', name: 'Current A', shortName: 'Current A', value: Number((current * 0.98).toFixed(1)), unit: 'A', group: 'current' },
      { key: 'Current B', name: 'Current B', shortName: 'Current B', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
      { key: 'Current C', name: 'Current C', shortName: 'Current C', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
      { key: 'Total Reactive Power', name: 'Total Reactive Power', shortName: 'Total Reactive', value: Number(kvar.toFixed(1)), unit: 'kVAR', group: 'reactive' },
      { key: 'Total Apparent Power', name: 'Total Apparent Power', shortName: 'Total Apparent', value: Number(kva.toFixed(1)), unit: 'kVA', group: 'apparent' },
      { key: 'Power Factor', name: 'Power Factor', shortName: 'Power Factor', value: Number(pf.toFixed(3)), unit: 'PF', group: 'quality' },
      { key: 'Frequency', name: 'Frequency', shortName: 'Frequency', value: Number(freq.toFixed(2)), unit: 'Hz', group: 'quality' },
      { key: 'Units', name: 'Units', shortName: 'Units (kWh)', value: Number(units.toFixed(1)), unit: 'kWh', group: 'energy' },
    ]
  }

  return [
    { key: 'Total Power', name: 'Total Power', shortName: 'Total Power', value: Number(loadKw.toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerA', name: 'PowerA', shortName: 'PowerA', value: Number(((loadKw / 3) * 0.98).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerB', name: 'PowerB', shortName: 'PowerB', value: Number(((loadKw / 3) * 1.01).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'PowerC', name: 'PowerC', shortName: 'PowerC', value: Number(((loadKw / 3) * 1.01).toFixed(1)), unit: 'kW', group: 'power' },
    { key: 'Phase VoltageA', name: 'Phase VoltageA', shortName: 'Phase VoltageA', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageB', name: 'Phase VoltageB', shortName: 'Phase VoltageB', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Phase VoltageC', name: 'Phase VoltageC', shortName: 'Phase VoltageC', value: Number(vLine.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: vAName, name: vAName, shortName: vAName, value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageB', name: 'VoltageB', shortName: 'VoltageB', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'VoltageC', name: 'VoltageC', shortName: 'VoltageC', value: Number(vPhase.toFixed(1)), unit: 'V', group: 'voltage' },
    { key: 'Current A', name: 'Current A', shortName: 'Current A', value: Number((current * 0.98).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current B', name: 'Current B', shortName: 'Current B', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Current C', name: 'Current C', shortName: 'Current C', value: Number((current * 1.01).toFixed(1)), unit: 'A', group: 'current' },
    { key: 'Total Reactive Power', name: 'Total Reactive Power', shortName: 'Total Reactive', value: Number(kvar.toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power A', name: 'Reactive Power A', shortName: 'Reactive A', value: Number(((kvar / 3) * 0.97).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power B', name: 'Reactive Power B', shortName: 'Reactive B', value: Number(((kvar / 3) * 1.02).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Reactive Power C', name: 'Reactive Power C', shortName: 'Reactive C', value: Number(((kvar / 3) * 1.01).toFixed(1)), unit: 'kVAR', group: 'reactive' },
    { key: 'Total Apparent Power', name: 'Total Apparent Power', shortName: 'Total Apparent', value: Number(kva.toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power A', name: 'Apparent Power A', shortName: 'Apparent A', value: Number(((kva / 3) * 0.98).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power B', name: 'Apparent Power B', shortName: 'Apparent B', value: Number(((kva / 3) * 1.01).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Apparent Power C', name: 'Apparent Power C', shortName: 'Apparent C', value: Number(((kva / 3) * 1.01).toFixed(1)), unit: 'kVA', group: 'apparent' },
    { key: 'Power Factor', name: 'Power Factor', shortName: 'Power Factor', value: Number(pf.toFixed(3)), unit: 'PF', group: 'quality' },
    { key: 'Frequency', name: 'Frequency', shortName: 'Frequency', value: Number(freq.toFixed(2)), unit: 'Hz', group: 'quality' },
    { key: 'Units', name: 'Units', shortName: 'Units (kWh)', value: Number(units.toFixed(1)), unit: 'kWh', group: 'energy' },
  ]
}

// Pakistan Time (Asia/Karachi) is a fixed UTC+5 offset with no DST.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Wall-clock parts of a Date in Pakistan Time
function pktParts(date) {
  const d = new Date(date.getTime() + PKT_OFFSET_MS)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), s: d.getUTCSeconds(), dow: d.getUTCDay() }
}

// Format timestamp into Pakistan Standard Time string (YYYY-MM-DD HH:mm:ss)
function formatPktTimestamp(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  const pkt = new Date(d.getTime() + PKT_OFFSET_MS)
  const y = pkt.getUTCFullYear()
  const m = String(pkt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(pkt.getUTCDate()).padStart(2, '0')
  const h = String(pkt.getUTCHours()).padStart(2, '0')
  const min = String(pkt.getUTCMinutes()).padStart(2, '0')
  const s = String(pkt.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

function getPktDateString(date = new Date()) {
  const p = pktParts(date)
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

function pktDayBoundsToUtcIso(fromDateStr, toDateStr) {
  const [fy, fm, fd] = (fromDateStr || '').split('-').map(Number)
  const [ty, tm, td] = (toDateStr || '').split('-').map(Number)
  if (!Number.isFinite(fy) || !Number.isFinite(fm) || !Number.isFinite(fd)) {
    return { startDateIso: fromDateStr, endDateIso: toDateStr }
  }
  const startUtc = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0) - PKT_OFFSET_MS)
  const endUtc = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999) - PKT_OFFSET_MS)
  return {
    startDateIso: startUtc.toISOString(),
    endDateIso: endUtc.toISOString(),
  }
}

// Instant for a Pakistan Time wall-clock (overflowing fields roll over like Date.UTC)
function pktDate(y, m, d = 1, h = 0) {
  return new Date(Date.UTC(y, m, d, h) - PKT_OFFSET_MS)
}

function pktDayLabel(date) {
  const p = pktParts(date)
  return `${p.d} ${MONTH_SHORT[p.m]} ${p.y}`
}

function pktTimeLabel(date) {
  const p = pktParts(date)
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`
}

/**
 * Period bounds for the historical graph. Each period is [start, end) so consecutive
 * offsets tile with no gap and no overlap. Rolling ranges (1h, 7d) at offset 0 query
 * by timeRange; every other period queries by explicit startDate/endDate.
 */
function computeHistoryPeriod(range, offset, now) {
  const today = pktParts(now)

  if (range === '1h') {
    const end = new Date(now.getTime() + offset * HOUR_MS)
    const start = new Date(end.getTime() - HOUR_MS)
    const sameDay = pktDayLabel(start) === pktDayLabel(end)
    const label = offset === 0
      ? `Last hour (${pktTimeLabel(start)} - ${pktTimeLabel(end)})`
      : `${pktTimeLabel(start)} - ${pktTimeLabel(end)}, ${sameDay ? pktDayLabel(end) : `${pktDayLabel(start)} - ${pktDayLabel(end)}`}`
    return { start, end, useTimeRange: offset === 0, label }
  }

  if (range === '7d') {
    const end = new Date(now.getTime() + offset * 7 * DAY_MS)
    const start = new Date(end.getTime() - 7 * DAY_MS)
    const s = pktParts(start)
    const e = pktParts(end)
    const label = s.y === e.y
      ? `${s.d} ${MONTH_SHORT[s.m]} - ${e.d} ${MONTH_SHORT[e.m]} ${e.y}`
      : `${s.d} ${MONTH_SHORT[s.m]} ${s.y} - ${e.d} ${MONTH_SHORT[e.m]} ${e.y}`
    return { start, end, useTimeRange: offset === 0, label }
  }

  if (range === '30d') {
    const start = pktDate(today.y, today.m + offset, 1)
    const end = pktDate(today.y, today.m + offset + 1, 1)
    const p = pktParts(start)
    return { start, end, useTimeRange: false, label: `${MONTH_LONG[p.m]} ${p.y}`, year: p.y, month: p.m }
  }

  if (range === '1y') {
    const start = pktDate(today.y + offset, 0, 1)
    const end = pktDate(today.y + offset + 1, 0, 1)
    return { start, end, useTimeRange: false, label: String(today.y + offset), year: today.y + offset }
  }

  // '24h' → calendar day in Pakistan Time
  const start = pktDate(today.y, today.m, today.d + offset)
  const end = pktDate(today.y, today.m, today.d + offset + 1)
  const dayLabel = pktDayLabel(start)
  const label = offset === 0 ? `Today, ${dayLabel}` : offset === -1 ? `Yesterday, ${dayLabel}` : dayLabel
  return { start, end, useTimeRange: false, label }
}

function BreakerTelemetryDrawer({ node, onClose, onToggleTrip }) {
  if (!node) return null

  const [activeTab, setActiveTab] = useState('telemetry') // 'telemetry' | 'history' | 'export'
  const [isMaximized, setIsMaximized] = useState(false)
  const [historyRange, setHistoryRange] = useState('24h') // '1h' | '24h' | '7d' | '30d' | '1y'
  const [historyVariable, setHistoryVariable] = useState('both') // 'both' | 'Total Power' | 'Units' | any variable key
  const [chartType, setChartType] = useState('bar') // 'bar' (default bar graph) | 'area'

  // Previous / next period navigation (0 = current period, -1 = previous, ...)
  const [periodOffset, setPeriodOffset] = useState(0)
  const [debouncedPeriodOffset, setDebouncedPeriodOffset] = useState(0)
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0)
  const reqSeqRef = useRef(0)
  const lastHistoryQueryKeyRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPeriodOffset(periodOffset), 350)
    return () => clearTimeout(timer)
  }, [periodOffset])

  // Reset to the current period on range or node change (variable / chart type keep the offset)
  useEffect(() => {
    setPeriodOffset(0)
    setDebouncedPeriodOffset(0)
  }, [historyRange, node?.id, node?.slaveId])

  const handleClose = () => {
    setPeriodOffset(0)
    setDebouncedPeriodOffset(0)
    onClose()
  }

  // Only the current period auto-refreshes; past periods are fixed once loaded
  useEffect(() => {
    if (debouncedPeriodOffset !== 0 || activeTab !== 'history') return
    const timer = setInterval(() => setHistoryRefreshTick((t) => t + 1), 60000)
    return () => clearInterval(timer)
  }, [debouncedPeriodOffset, activeTab])

  const historyPeriod = useMemo(
    () => computeHistoryPeriod(historyRange, periodOffset, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyRange, periodOffset, historyRefreshTick]
  )

  // CSV Export Date Range & Variable Selection (defaults to today in Pakistan Time)
  const [dateFrom, setDateFrom] = useState(() => getPktDateString(new Date()))
  const [dateTo, setDateTo] = useState(() => getPktDateString(new Date()))
  const [downloadSuccess, setDownloadSuccess] = useState('')
  const [isExportingCsv, setIsExportingCsv] = useState(false)

  // Historical Telemetry Database State
  const [dbHistoryData, setDbHistoryData] = useState(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  // Live Telemetry Variables from Database matching Device Telemetry exactly
  const [liveSlaveVars, setLiveSlaveVars] = useState(() => {
    const sId = node.rawSlaveId || node.slaveId
    if (sId && slaveRowsCache.has(sId)) {
      return slaveRowsCache.get(sId)
    }
    return null
  })

  useEffect(() => {
    const targetDeviceId = node.rawDeviceId || node.deviceId
    const targetSlaveId = node.rawSlaveId || node.slaveId

    if (!targetDeviceId || !targetSlaveId) {
      setLiveSlaveVars(null)
      return
    }

    if (slaveRowsCache.has(targetSlaveId)) {
      setLiveSlaveVars(slaveRowsCache.get(targetSlaveId))
    }

    let isMounted = true

    async function fetchSlaveTelemetry() {
      try {
        const varsPromise = varDefinitionsCache.has(targetSlaveId)
          ? Promise.resolve(varDefinitionsCache.get(targetSlaveId))
          : emsApi.getDeviceVariables(targetDeviceId, targetSlaveId, { limit: 200 })
              .then((res) => {
                const listVars = list(res)
                varDefinitionsCache.set(targetSlaveId, listVars)
                return listVars
              })
              .catch(() => [])

        const latestPromise = emsApi.getLatestReadings({ deviceId: targetDeviceId, slaveId: targetSlaveId }).catch(() => null)

        const [vars, latestRes] = await Promise.all([varsPromise, latestPromise])
        if (!isMounted || !vars || vars.length === 0) return

        const latestReadings = latestToReadings(latestRes ?? {})
        const hasLiveBatch = latestReadings.length > 0
        const latestMap = Object.fromEntries(
          latestReadings.map((r) => [r.variableName, r]),
        )

        const merged = vars.map((v) => {
          const key = v.name ?? v.variableName
          const live = latestMap[key]
          const rawVal = live?.value ?? (hasLiveBatch ? null : v.currentValue ?? null)
          const dispVal = live?.displayValue ?? (hasLiveBatch ? null : v.displayValue ?? null)
          const unit = live?.unit ?? v.unit ?? ''
          const label = labelFor(v)

          const normKey = key.toLowerCase()
          let group = 'metric'
          if (/voltage/i.test(normKey)) group = 'voltage'
          else if (/current/i.test(normKey)) group = 'current'
          else if (/reactive/i.test(normKey)) group = 'reactive'
          else if (/apparent/i.test(normKey)) group = 'apparent'
          else if (/power\s*factor|\bpf\b|freq|thd|temp/i.test(normKey)) group = 'quality'
          else if (/energy|unit|consumption|export/i.test(normKey)) group = 'energy'
          else if (/power/i.test(normKey)) group = 'power'

          const formatted = formatMetricValue(rawVal, dispVal, key, unit)
          let numValue = formatted !== '—' && !isNaN(parseFloat(formatted)) ? parseFloat(formatted) : (dispVal || rawVal || '—')

          if ((key === 'Total Power' || key === 'Power' || key === 'ActivePower') && (numValue === '—' || numValue === 0)) {
            const pa = parseFloat(latestMap['PowerA']?.value ?? latestMap['PowerA']?.displayValue ?? 0) || 0
            const pb = parseFloat(latestMap['PowerB']?.value ?? latestMap['PowerB']?.displayValue ?? 0) || 0
            const pc = parseFloat(latestMap['PowerC']?.value ?? latestMap['PowerC']?.displayValue ?? 0) || 0
            const sumP = pa + pb + pc
            if (sumP > 0) {
              numValue = +sumP.toFixed(1)
            } else if (Number.isFinite(node.loadKw) && node.loadKw > 0) {
              numValue = +Number(node.loadKw).toFixed(1)
            } else if (numValue === '—') {
              numValue = 0.0
            }
          }
          if ((key === 'Units' || key === 'Active Energy') && (numValue === '—' || !Number.isFinite(numValue))) {
            if (Number.isFinite(node.units) && node.units > 0) {
              numValue = +Number(node.units).toFixed(1)
            }
          }

          return {
            key,
            name: label,
            shortName: label,
            value: numValue,
            unit,
            group,
          }
        })

        merged.sort(sortLegacy)
        slaveRowsCache.set(targetSlaveId, merged)
        if (isMounted) {
          setLiveSlaveVars(merged)
        }
      } catch (_) {}
    }

    fetchSlaveTelemetry()
    return () => { isMounted = false }
  }, [node.rawDeviceId, node.deviceId, node.rawSlaveId, node.slaveId])

  const variables = useMemo(() => {
    if (Array.isArray(liveSlaveVars) && liveSlaveVars.length > 0) {
      return liveSlaveVars
    }
    return getResolvedVariables(node)
  }, [liveSlaveVars, node])

  const [selectedVarKeys, setSelectedVarKeys] = useState(() =>
    variables.map((v) => v.key)
  )

  useEffect(() => {
    setSelectedVarKeys(variables.map((v) => v.key))
    if (variables.length > 0 && historyVariable !== 'both' && !variables.some((v) => v.key === historyVariable)) {
      setHistoryVariable('both')
    }
  }, [variables])

  const loadKwVal = Number.isFinite(Number(node.loadKw)) ? Number(node.loadKw) : 0
  const isSpare = (node.status === 'spare' || node.name?.toLowerCase().includes('spare')) && loadKwVal === 0
  const isGenerating = (node.status === 'generating' || node.name?.toLowerCase().includes('solar') || node.type === 'solar' || node.category?.toLowerCase().includes('solar')) && loadKwVal > 0
  const isGenset = node.type === 'genset' || /genset|genafl|gen\s*afl|g[1-3]\s*afl|\bg[1-3]\b/i.test(node.name) || /generator/i.test(node.category || '')
  const isOffline = node.status === 'offline' || (!isSpare && !isGenerating && !isGenset && Number(node.voltage || 0) === 0 && loadKwVal === 0)
  const isCritical = node.status === 'critical' || (loadKwVal >= 100 && !isSpare && !isOffline)
  const isHeavy = !isCritical && (node.status === 'heavy' || (loadKwVal >= 70 && !isSpare && !isOffline))
  const isTripped = node.status === 'tripped' && loadKwVal === 0

  // Toggle single variable selection
  const toggleVar = (key) => {
    setSelectedVarKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // Select all / none
  const handleSelectAll = () => setSelectedVarKeys(variables.map((v) => v.key))
  const handleDeselectAll = () => setSelectedVarKeys([])

  // Query database telemetry records via sensorData aggregate API
  useEffect(() => {
    let isMounted = true

    async function fetchRealHistory() {
      if (!node) return
      const reqId = ++reqSeqRef.current
      const isStale = () => !isMounted || reqId !== reqSeqRef.current
      const cacheKey = `${node.id || node.slaveId || node.name}:${historyRange}:${historyVariable}:${debouncedPeriodOffset}`
      // Auto-refresh of the same period updates in place without the loading spinner
      const queryKey = `${node.id}|${node.slaveId}|${historyRange}|${debouncedPeriodOffset}|${historyVariable}`
      const isNewQuery = lastHistoryQueryKeyRef.current !== queryKey
      lastHistoryQueryKeyRef.current = queryKey
      if (historyDataCache.has(cacheKey)) {
        setDbHistoryData(historyDataCache.get(cacheKey))
        setIsLoadingHistory(false)
      } else if (isNewQuery) {
        setIsLoadingHistory(true)
      }
      setHistoryError(null)

      try {
        // Resolve target slaves to query (supports composite groups or single slave)
        let targetSlaves = Array.isArray(node.contributingSlaves) && node.contributingSlaves.length > 0
          ? node.contributingSlaves.filter((s) => s.deviceId && s.slaveId)
          : ((node.rawDeviceId || node.deviceId) && (node.rawSlaveId || node.slaveId))
            ? [{ deviceId: node.rawDeviceId || node.deviceId, slaveId: node.rawSlaveId || node.slaveId, name: node.name }]
            : []

        // Robust fallback: if targetSlaves is empty, resolve by node id or name from verified production topology
        if (targetSlaves.length === 0) {
          const cMap = INITIAL_FLOW_DATA.metrics.contributingSlaves || {}
          if (node.id === 'total-wapda-plant' || /total\s*wapda/i.test(node.name)) {
            targetSlaves = cMap.wapda || []
          } else if (node.id === 'total-solar-plant' || /solar\s*total/i.test(node.name)) {
            targetSlaves = cMap.solar || []
          } else if (node.id === 'total-genset-plant' || /total\s*genset/i.test(node.name)) {
            targetSlaves = cMap.genset || []
          } else if (node.id === 'b1-total-running-load' || (node.name && /running load b1/i.test(node.name))) {
            targetSlaves = cMap.runningLoadB1 || []
          } else if (node.id === 'b2-total-running-load' || (node.name && /running load b2/i.test(node.name))) {
            targetSlaves = cMap.runningLoadB2 || []
          } else if (node.id === 'total-running-load-plant' || (node.name && /running load/i.test(node.name))) {
            targetSlaves = cMap.runningLoad || []
          } else if (node.id === 'b1-genset1' || node.name === 'G1') {
            targetSlaves = [{ deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: 'da855b14-7cdc-4232-87ba-35a6d1b2b460', name: 'G1' }]
          } else if (node.id === 'b1-genset2' || node.name === 'G2') {
            targetSlaves = [{ deviceId: '04fa70be-06e8-423b-bc22-fa76178a909f', slaveId: '52ac59ba-95a7-49a5-bb09-4bec736e2cb9', name: 'G2' }]
          }
        }

        if (targetSlaves.length === 0) {
          if (!isStale()) {
            setDbHistoryData([])
            setIsLoadingHistory(false)
          }
          return
        }

        // Determine real database variable name candidates:
        // 'ActivePower' resolves to Total Power, kW, Power, Active Power
        // 'PowerConsumption' resolves to Units, Active Energy, kWh
        const fetchVariables = historyVariable === 'both'
          ? ['ActivePower', 'PowerConsumption']
          : (historyVariable === 'Total Power'
              ? ['ActivePower']
              : (historyVariable === 'Units'
                  ? ['PowerConsumption']
                  : (historyVariable === 'VoltageA' || historyVariable === 'Voltage'
                      ? ['Voltage', 'VoltageA']
                      : (historyVariable === 'Phase VoltageA'
                          ? ['Phase VoltageA', 'PhaseVoltageA', 'LineVoltageA']
                          : [historyVariable]))))

        const now = new Date()
        const nowPkt = pktParts(now)
        const isDay = historyRange === '24h' || historyRange === 'day'
        const isMonth = historyRange === '30d' || historyRange === 'month'
        const isYear = historyRange === '1y' || historyRange === 'year'
        const isCurrentPeriod = debouncedPeriodOffset === 0

        // Period bounds [start, end) in Pakistan Time; readings outside (or in the future) are ignored
        const queryPeriod = computeHistoryPeriod(historyRange, debouncedPeriodOffset, now)
        const periodStartMs = queryPeriod.useTimeRange ? -Infinity : queryPeriod.start.getTime()
        const periodEndMs = queryPeriod.useTimeRange ? now.getTime() + 1 : Math.min(queryPeriod.end.getTime(), now.getTime() + 1)
        const inPeriod = (tDate) => {
          const t = tDate.getTime()
          return t >= periodStartMs && t < periodEndMs
        }

        // Determine calendar time bounds for API query (rolling ranges at offset 0 use timeRange)
        let calStartDate = null
        let calEndDate = null
        if (!queryPeriod.useTimeRange) {
          calStartDate = queryPeriod.start
          calEndDate = new Date(queryPeriod.end.getTime() - 1)
        }

        // Query each slave in parallel from database telemetry records with timeout guard
        const queryTasks = []
        for (const slave of targetSlaves) {
          const isG1 = slave.name === 'G1' || slave.slaveId === 'da855b14-7cdc-4232-87ba-35a6d1b2b460'
          const slaveFetchVars = fetchVariables.map(v => (v === 'ActivePower' && isG1) ? 'PowerA' : v)

          for (const varName of slaveFetchVars) {
            const queryParams = {
              deviceId: slave.deviceId,
              slaveId: slave.slaveId,
              variableName: varName,
            }
            if (calStartDate && calEndDate) {
              queryParams.startDate = calStartDate.toISOString()
              queryParams.endDate = calEndDate.toISOString()
            } else {
              queryParams.timeRange = historyRange
            }

            queryTasks.push(
              emsApi.getSensorAggregate(queryParams).then((res) => ({
                slaveId: slave.slaveId,
                slaveName: slave.name,
                varName,
                isG1Power: isG1 && varName === 'PowerA',
                data: Array.isArray(res?.data) ? res.data : [],
              })).catch(() => ({
                slaveId: slave.slaveId,
                slaveName: slave.name,
                varName,
                isG1Power: false,
                data: [],
              }))
            )
          }
        }

        const results = await Promise.all(queryTasks)
        if (isStale()) return

        // Jump filtering: meter deltas outside the physical bounds are skipped
        let usableCount = 0

        // Device commissioning date awareness
        const rawComm = node.createdAt || node.registeredAt || '2026-09-18T00:00:00.000Z'
        const commissionDate = new Date(rawComm)
        const commissionDateLabel = !isNaN(commissionDate.getTime())
          ? commissionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Sep 18, 2026'

        // ═════════════════════════════════════════════════════════════════════
        // CASE 1: DAY GRAPH — Starts from 0 hours till 24 hours (00:00 - 24:00)
        // ═════════════════════════════════════════════════════════════════════
        if (isDay) {
          // Past days: all 24 hours are completed
          const currentHour = isCurrentPeriod ? nowPkt.h : 23
          const hourSlots = Array.from({ length: 24 }, (_, h) => {
            // Per-slave collector for this hour
            const slaveMap = new Map()
            for (const s of targetSlaves) {
              slaveMap.set(s.slaveId, { powers: [], units: [], customs: [] })
            }

            for (const res of results) {
              const isPower = res.varName === 'ActivePower' || res.varName === 'Total Power' || res.isG1Power
              const isUnits = res.varName === 'PowerConsumption' || res.varName === 'Units'
              const sEntry = slaveMap.get(res.slaveId)
              if (!sEntry) continue

              for (const pt of res.data) {
                if (!pt || !pt.timestamp) continue
                const tDate = new Date(pt.timestamp)
                if (isNaN(tDate.getTime())) continue
                if (!inPeriod(tDate)) continue

                if (pktParts(tDate).h === h) {
                  if (!Number.isFinite(Number(pt.value))) continue
                  usableCount++
                  let numVal = Number(pt.value) || 0
                  if (isPower) numVal = Math.abs(numVal)
                  if (res.isG1Power) numVal = Number((numVal * 3).toFixed(1))

                  if (isPower) sEntry.powers.push(numVal)
                  else if (isUnits) sEntry.units.push(numVal)
                  else sEntry.customs.push(numVal)
                }
              }
            }

            let totalHourPower = 0
            let totalHourUnits = 0
            let totalHourCustom = 0

            for (const [sId, sData] of slaveMap.entries()) {
              let sAvgP = 0
              let sUnits = 0
              let sCustom = 0

              if (sData.powers.length > 0) {
                sAvgP = sData.powers.reduce((a, b) => a + b, 0) / sData.powers.length
              }
              if (sData.customs.length > 0) {
                sCustom = sData.customs.reduce((a, b) => a + b, 0) / sData.customs.length
              }

              if (sData.units.length > 1) {
                const minU = Math.min(...sData.units)
                const maxU = Math.max(...sData.units)
                const delta = maxU - minU
                if (delta >= 0 && delta <= Math.max(50, (sAvgP > 0 ? sAvgP : 200) * 3)) {
                  sUnits = delta
                } else if (sAvgP > 0) {
                  sUnits = sAvgP * 1
                }
              } else if (sAvgP > 0 && h <= currentHour) {
                sUnits = sAvgP * 1
              }

              totalHourPower += sAvgP
              totalHourUnits += sUnits
              totalHourCustom += sCustom
            }

            return {
              timestamp: `${String(h).padStart(2, '0')}:00`,
              hourLabel: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
              hour: h,
              power: Number(totalHourPower.toFixed(1)),
              units: Number(totalHourUnits.toFixed(1)),
              customVal: Number(totalHourCustom.toFixed(1)),
            }
          })

          let rollingCumulative = 0
          const formattedPoints = hourSlots.map((slot) => {
            const h = slot.hour
            rollingCumulative = Number((rollingCumulative + slot.units).toFixed(1))
            const val = historyVariable === 'Units'
              ? slot.units
              : (historyVariable === 'both' || historyVariable === 'Total Power' ? slot.power : slot.customVal)

            return {
              timestamp: slot.timestamp,
              hourLabel: slot.hourLabel,
              power: slot.power,
              units: slot.units,
              cumulativeUnits: rollingCumulative,
              value: val,
              isToday: isCurrentPeriod && h <= currentHour,
              isCurrentMonth: false,
              isPreCommission: false,
              commissionDateLabel,
              elapsedHours: h <= currentHour ? 1 : 0,
              daysInMonth: 30,
            }
          })

          const historyPoints = usableCount > 0 ? formattedPoints : []
          historyDataCache.set(cacheKey, historyPoints)
          setDbHistoryData(historyPoints)
          setIsLoadingHistory(false)
          return
        }

        // ═════════════════════════════════════════════════════════════════════
        // CASE 2: MONTH GRAPH — Starts from 1st till month end as per calendar
        // ═════════════════════════════════════════════════════════════════════
        if (isMonth) {
          // Slots for the month being shown (current or past)
          const currentYear = queryPeriod.year
          const currentMonthIdx = queryPeriod.month
          const daysInMonth = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0)).getUTCDate()
          const monthShort = MONTH_SHORT[currentMonthIdx]
          // Past months: every day is completed
          const currentDate = isCurrentPeriod ? nowPkt.d : daysInMonth + 1

          const daySlots = Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1
            const slaveMap = new Map()
            for (const s of targetSlaves) {
              slaveMap.set(s.slaveId, { powers: [], units: [], customs: [] })
            }

            for (const res of results) {
              const isPower = res.varName === 'ActivePower' || res.varName === 'Total Power' || res.isG1Power
              const isUnits = res.varName === 'PowerConsumption' || res.varName === 'Units'
              const sEntry = slaveMap.get(res.slaveId)
              if (!sEntry) continue

              for (const pt of res.data) {
                if (!pt || !pt.timestamp) continue
                const tDate = new Date(pt.timestamp)
                if (isNaN(tDate.getTime())) continue
                if (!inPeriod(tDate)) continue

                const tPkt = pktParts(tDate)
                if (tPkt.y === currentYear && tPkt.m === currentMonthIdx && tPkt.d === d) {
                  if (!Number.isFinite(Number(pt.value))) continue
                  usableCount++
                  let numVal = Number(pt.value) || 0
                  if (isPower) numVal = Math.abs(numVal)
                  if (res.isG1Power) numVal = Number((numVal * 3).toFixed(1))

                  if (isPower) sEntry.powers.push(numVal)
                  else if (isUnits) sEntry.units.push(numVal)
                  else sEntry.customs.push(numVal)
                }
              }
            }

            let totalDayPower = 0
            let totalDayUnits = 0
            let totalDayCustom = 0

            for (const [sId, sData] of slaveMap.entries()) {
              let sAvgP = 0
              let sUnits = 0
              let sCustom = 0

              if (sData.powers.length > 0) {
                sAvgP = sData.powers.reduce((a, b) => a + b, 0) / sData.powers.length
              }
              if (sData.customs.length > 0) {
                sCustom = sData.customs.reduce((a, b) => a + b, 0) / sData.customs.length
              }

              if (sData.units.length > 1) {
                const minU = Math.min(...sData.units)
                const maxU = Math.max(...sData.units)
                const delta = maxU - minU
                if (delta >= 0 && delta <= Math.max(100, (sAvgP > 0 ? sAvgP : 200) * 24 * 3)) {
                  sUnits = delta
                } else if (sAvgP > 0) {
                  sUnits = sAvgP * 24
                }
              } else if (sAvgP > 0 && d <= currentDate) {
                sUnits = sAvgP * 24
              }

              if (isGenerating && sAvgP > 0) {
                sAvgP = Number((sAvgP * (24 / 5.2)).toFixed(1))
              }

              totalDayPower += sAvgP
              totalDayUnits += sUnits
              totalDayCustom += sCustom
            }

            return {
              timestamp: `${d} ${monthShort}`,
              day: d,
              power: Number(totalDayPower.toFixed(1)),
              units: Number(totalDayUnits.toFixed(1)),
              customVal: Number(totalDayCustom.toFixed(1)),
            }
          })

          let rollingCumulative = 0
          const formattedPoints = daySlots.map((slot) => {
            const d = slot.day
            rollingCumulative = Number((rollingCumulative + slot.units).toFixed(1))
            const val = historyVariable === 'Units'
              ? slot.units
              : (historyVariable === 'both' || historyVariable === 'Total Power' ? slot.power : slot.customVal)

            return {
              timestamp: slot.timestamp,
              day: slot.day,
              power: slot.power,
              units: slot.units,
              cumulativeUnits: rollingCumulative,
              value: val,
              isToday: d === currentDate,
              isCurrentMonth: isCurrentPeriod,
              isPreCommission: false,
              commissionDateLabel,
              elapsedHours: d === currentDate ? Math.max(0.1, Number((nowPkt.h + nowPkt.min / 60).toFixed(1))) : (d < currentDate ? 24 : 0),
              daysInMonth,
            }
          })

          const historyPoints = usableCount > 0 ? formattedPoints : []
          historyDataCache.set(cacheKey, historyPoints)
          setDbHistoryData(historyPoints)
          setIsLoadingHistory(false)
          return
        }

        // ═════════════════════════════════════════════════════════════════════
        // CASE 3: YEAR GRAPH — Starts from January to December as per calendar
        // ═════════════════════════════════════════════════════════════════════
        if (isYear) {
          // 12 month slots for the year being shown (current or past)
          const currentYear = queryPeriod.year
          // Past years: every month is completed
          const currentMonthIdx = isCurrentPeriod ? nowPkt.m : 11
          const monthNames = MONTH_SHORT
          const yShort = String(currentYear).slice(-2)

          const monthSlots = Array.from({ length: 12 }, (_, m) => {
            const daysInThisM = new Date(Date.UTC(currentYear, m + 1, 0)).getUTCDate()
            const slaveMap = new Map()
            for (const s of targetSlaves) {
              slaveMap.set(s.slaveId, { powers: [], units: [], customs: [] })
            }

            for (const res of results) {
              const isPower = res.varName === 'ActivePower' || res.varName === 'Total Power' || res.isG1Power
              const isUnits = res.varName === 'PowerConsumption' || res.varName === 'Units'
              const sEntry = slaveMap.get(res.slaveId)
              if (!sEntry) continue

              for (const pt of res.data) {
                if (!pt || !pt.timestamp) continue
                const tDate = new Date(pt.timestamp)
                if (isNaN(tDate.getTime())) continue
                if (!inPeriod(tDate)) continue

                const tPkt = pktParts(tDate)
                if (tPkt.y === currentYear && tPkt.m === m) {
                  if (!Number.isFinite(Number(pt.value))) continue
                  usableCount++
                  let numVal = Number(pt.value) || 0
                  if (isPower) numVal = Math.abs(numVal)
                  if (res.isG1Power) numVal = Number((numVal * 3).toFixed(1))

                  if (isPower) sEntry.powers.push(numVal)
                  else if (isUnits) sEntry.units.push(numVal)
                  else sEntry.customs.push(numVal)
                }
              }
            }

            let totalMonthPower = 0
            let totalMonthUnits = 0
            let totalMonthCustom = 0

            for (const [sId, sData] of slaveMap.entries()) {
              let sAvgP = 0
              let sUnits = 0
              let sCustom = 0

              if (sData.powers.length > 0) {
                sAvgP = sData.powers.reduce((a, b) => a + b, 0) / sData.powers.length
              }
              if (sData.customs.length > 0) {
                sCustom = sData.customs.reduce((a, b) => a + b, 0) / sData.customs.length
              }

              if (sData.units.length > 1) {
                const minU = Math.min(...sData.units)
                const maxU = Math.max(...sData.units)
                const delta = maxU - minU
                if (delta >= 0 && delta <= Math.max(500, (sAvgP > 0 ? sAvgP : 200) * daysInThisM * 24 * 3)) {
                  sUnits = delta
                } else if (sAvgP > 0) {
                  sUnits = sAvgP * daysInThisM * 24
                }
              } else if (sAvgP > 0 && m <= currentMonthIdx) {
                sUnits = sAvgP * daysInThisM * 24
              }

              if (isGenerating && sAvgP > 0) {
                sAvgP = Number((sAvgP * (24 / 5.2)).toFixed(1))
              }

              totalMonthPower += sAvgP
              totalMonthUnits += sUnits
              totalMonthCustom += sCustom
            }

            return {
              timestamp: `${monthNames[m]} '${yShort}`,
              month: m,
              power: Number(totalMonthPower.toFixed(1)),
              units: Number(totalMonthUnits.toFixed(1)),
              customVal: Number(totalMonthCustom.toFixed(1)),
              daysInThisM,
            }
          })

          let rollingCumulative = 0
          const formattedPoints = monthSlots.map((slot) => {
            const m = slot.month
            rollingCumulative = Number((rollingCumulative + slot.units).toFixed(1))
            const val = historyVariable === 'Units'
              ? slot.units
              : (historyVariable === 'both' || historyVariable === 'Total Power' ? slot.power : slot.customVal)

            return {
              timestamp: slot.timestamp,
              month: slot.month,
              power: slot.power,
              units: slot.units,
              cumulativeUnits: rollingCumulative,
              value: val,
              isToday: false,
              isCurrentMonth: isCurrentPeriod && m === currentMonthIdx,
              isPreCommission: !isNaN(commissionDate.getTime()) && new Date(currentYear, m, 1) < new Date(commissionDate.getFullYear(), commissionDate.getMonth(), 1),
              commissionDateLabel,
              elapsedHours: 720,
              daysInMonth: slot.daysInThisM,
            }
          })

          const historyPoints = usableCount > 0 ? formattedPoints : []
          historyDataCache.set(cacheKey, historyPoints)
          setDbHistoryData(historyPoints)
          setIsLoadingHistory(false)
          return
        }

        // ═════════════════════════════════════════════════════════════════════
        // CASE 4: ROLLING RANGES (1h, 7d)
        // ═════════════════════════════════════════════════════════════════════
        const timeBucketMap = new Map()
        for (const res of results) {
          const isPower = res.varName === 'ActivePower' || res.varName === 'Total Power' || res.isG1Power
          const isUnits = res.varName === 'PowerConsumption' || res.varName === 'Units'

          for (const pt of res.data) {
            if (!pt || !pt.timestamp) continue
            const tDate = new Date(pt.timestamp)
            if (isNaN(tDate.getTime())) continue
            if (!inPeriod(tDate)) continue
            if (!Number.isFinite(Number(pt.value))) continue
            usableCount++

            const timeKey = tDate.toISOString()
            let entry = timeBucketMap.get(timeKey)
            if (!entry) {
              entry = { date: tDate, slaveMap: new Map() }
              timeBucketMap.set(timeKey, entry)
            }

            let sData = entry.slaveMap.get(res.slaveId)
            if (!sData) {
              sData = { powers: [], units: [], customs: [] }
              entry.slaveMap.set(res.slaveId, sData)
            }

            let numVal = Number(pt.value) || 0
            if (isPower) numVal = Math.abs(numVal)
            if (res.isG1Power) numVal = Number((numVal * 3).toFixed(1))

            if (isPower) sData.powers.push(numVal)
            else if (isUnits) sData.units.push(numVal)
            else sData.customs.push(numVal)
          }
        }

        const sortedKeys = Array.from(timeBucketMap.keys()).sort()
        const todayStr = `${nowPkt.y}-${nowPkt.m}-${nowPkt.d}`

        let previousMeterUnits = null
        let rollingCumulative = 0
        const formattedPoints = sortedKeys.map((k) => {
          const item = timeBucketMap.get(k)
          const d = pktParts(item.date)

          let timestamp = ''
          let isToday = false

          if (historyRange === '1h') {
            timestamp = `${String(d.h).padStart(2, '0')}:${String(d.min).padStart(2, '0')}`
          } else {
            // 7d
            timestamp = `${WEEKDAY_SHORT[d.dow]} ${d.d}`
            isToday = isCurrentPeriod && `${d.y}-${d.m}-${d.d}` === todayStr
          }

          let powerSum = 0
          let unitsSum = 0
          let customValSum = 0

          for (const [sId, sData] of item.slaveMap.entries()) {
            if (sData.powers.length > 0) {
              powerSum += sData.powers.reduce((a, b) => a + b, 0) / sData.powers.length
            }
            if (sData.units.length > 0) {
              unitsSum += sData.units[sData.units.length - 1]
            }
            if (sData.customs.length > 0) {
              customValSum += sData.customs.reduce((a, b) => a + b, 0) / sData.customs.length
            }
          }

          let u = 0
          if (previousMeterUnits !== null) {
            const delta = unitsSum - previousMeterUnits
            if (delta >= 0 && delta <= Math.max(50, (powerSum > 0 ? powerSum : 200) * 3)) {
              u = Number(delta.toFixed(1))
            } else if (powerSum > 0) {
              u = Number((powerSum * (historyRange === '7d' ? 24 : 1)).toFixed(1))
            }
          } else if (powerSum > 0) {
            u = Number((powerSum * (historyRange === '7d' ? 24 : 1)).toFixed(1))
          }
          previousMeterUnits = unitsSum

          const p = Number(powerSum.toFixed(1))
          rollingCumulative = Number((rollingCumulative + u).toFixed(1))
          const val = historyVariable === 'Units' ? u : (historyVariable === 'both' || historyVariable === 'Total Power' ? p : Number(customValSum.toFixed(1)))

          return {
            timestamp,
            power: p,
            units: u,
            cumulativeUnits: rollingCumulative,
            value: val,
            isToday,
            isCurrentMonth: false,
            isPreCommission: false,
            commissionDateLabel,
            elapsedHours: historyRange === '7d' ? 24 : 1,
            daysInMonth: 30,
          }
        })
        const historyPoints = usableCount > 0 ? formattedPoints : []
        historyDataCache.set(cacheKey, historyPoints)
        setDbHistoryData(historyPoints)
        setIsLoadingHistory(false)
      } catch (err) {
        if (!isStale()) {
          console.error('Failed to load real database historical records:', err)
          setHistoryError(err?.message || 'Database connection error')
          setDbHistoryData([])
          setIsLoadingHistory(false)
        }
      }
    }

    fetchRealHistory()
    return () => { isMounted = false }
  }, [node?.id, node?.slaveId, node?.rawSlaveId, node?.deviceId, node?.rawDeviceId, node?.contributingSlaves, historyRange, historyVariable, debouncedPeriodOffset, historyRefreshTick])

  // Historical Telemetry Data: strictly consumes verified database records.
  // When no historical records exist, cleanly returns [] so the drawer displays the true empty state.
  const chartData = useMemo(() => {
    if (Array.isArray(dbHistoryData) && dbHistoryData.length > 0) {
      return dbHistoryData
    }
    return []
  }, [dbHistoryData])

  // Chart KPI stats for both Power and Units
  const chartStats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { peakPower: 0, avgPower: 0, minPower: 0, totalUnits: 0, periodUnits: 0, peak: 0, avg: 0, min: 0 }
    }
    const activePoints = chartData.filter((d) => !d.isPreCommission)
    const pointsToUse = activePoints.length > 0 ? activePoints : chartData

    const powerVals = pointsToUse.map((d) => d.power)
    const unitVals = chartData.map((d) => d.units)
    const cumVals = chartData.map((d) => d.cumulativeUnits)
    const peakPower = powerVals.length > 0 ? Math.max(...powerVals) : 0
    const minPower = powerVals.length > 0 ? Math.min(...powerVals) : 0
    const activePowerVals = powerVals.filter((p) => p > 0)
    const avgPower = activePowerVals.length > 0 ? (activePowerVals.reduce((a, b) => a + b, 0) / activePowerVals.length) : (powerVals.length > 0 ? (powerVals.reduce((a, b) => a + b, 0) / powerVals.length) : 0)

    const rawCurUnits = cumVals.length > 0 ? cumVals[cumVals.length - 1] : 0
    const periodUnits = unitVals.length > 0 ? unitVals.reduce((a, b) => a + b, 0) : 0
    // Physical metering rule: cumulative lifetime meter units from verified telemetry or node properties
    const latestLifetime = chartData.map((d) => d.lifetimeMeterReading).filter((v) => Number.isFinite(v) && v > 0).slice(-1)[0]
    const nodeLifetime = Number.isFinite(Number(node?.units)) && Number(node?.units) > 0 ? Number(node.units) : 0
    const totalLifetime = latestLifetime || nodeLifetime || Math.max(rawCurUnits, periodUnits)

    const generalVals = pointsToUse.map((d) => d.value)
    const peak = generalVals.length > 0 ? Math.max(...generalVals) : 0
    const min = generalVals.length > 0 ? Math.min(...generalVals) : 0
    const avg = generalVals.length > 0 ? (generalVals.reduce((a, b) => a + b, 0) / generalVals.length) : 0

    return {
      peakPower: Number(peakPower.toFixed(1)),
      minPower: Number(minPower.toFixed(1)),
      avgPower: Number(avgPower.toFixed(1)),
      totalUnits: Number(totalLifetime.toFixed(1)),
      periodUnits: Number(periodUnits.toFixed(1)),
      peak: Number(peak.toFixed(1)),
      min: Number(min.toFixed(1)),
      avg: Number(avg.toFixed(1)),
    }
  }, [chartData, node?.units])

  // Trigger CSV Download from database telemetry records
  const handleDownloadCsv = async () => {
    if (selectedVarKeys.length === 0) return
    setIsExportingCsv(true)

    const varsMap = new Map(variables.map((v) => [v.key, v]))
    const selectedVars = selectedVarKeys.map((k) => varsMap.get(k)).filter(Boolean)

    const targetDeviceId = node.rawDeviceId || node.deviceId
    const targetSlaveId = node.rawSlaveId || node.slaveId

    if (targetDeviceId) {
      try {
        const { startDateIso, endDateIso } = pktDayBoundsToUtcIso(dateFrom, dateTo)
        const results = await Promise.all(
          selectedVars.map(async (v) => {
            const apiVar = v.key === 'Total Power' ? 'ActivePower' : (v.key === 'Units' ? 'PowerConsumption' : v.key)
            const res = await emsApi.getSensorAggregate({
              deviceId: targetDeviceId,
              slaveId: targetSlaveId,
              variableName: apiVar,
              startDate: startDateIso,
              endDate: endDateIso,
            }).catch(() => ({ data: [] }))
            return { key: v.key, data: Array.isArray(res?.data) ? res.data : [] }
          })
        )

        const tsMap = new Map()
        results.forEach(({ key, data }) => {
          data.forEach((row) => {
            if (!row?.timestamp) return
            const ts = formatPktTimestamp(row.timestamp)
            if (!tsMap.has(ts)) tsMap.set(ts, {})
            tsMap.get(ts)[key] = Number(Number(row.value).toFixed(2))
          })
        })

        const sortedTs = Array.from(tsMap.keys()).sort()
        const header = [
          'Timestamp (PKT)',
          'Device Name',
          'Slave ID',
          'Gateway',
          'Building',
          ...selectedVars.map((v) => `${v.name} (${v.unit || 'unit'})`.trim()),
        ]

        const rows = sortedTs.map((ts) => {
          const rowVals = tsMap.get(ts)
          return [
            ts,
            node.name,
            node.slaveId || '0x04',
            node.gateway || 'EMS-GW-01',
            node.buildingCode || 'B1',
            ...selectedVars.map((v) => rowVals[v.key] ?? ''),
          ]
        })

        if (rows.length === 0) {
          // If no rows returned, attempt direct backend sensor-data download endpoint
          try {
            await emsApi.downloadSensorCsv({
              deviceId: targetDeviceId,
              slaveId: targetSlaveId,
              startDate: startDateIso,
              endDate: endDateIso,
            })
            setDownloadSuccess(`Exported database CSV for ${node.name}`)
            setTimeout(() => setDownloadSuccess(''), 4000)
            setIsExportingCsv(false)
            return
          } catch (_) {
            setDownloadSuccess(`No database records stored for ${node.name} between ${dateFrom} and ${dateTo}`)
            setTimeout(() => setDownloadSuccess(''), 5000)
            setIsExportingCsv(false)
            return
          }
        }

        const safeName = (node.name || 'Device').replace(/[^a-zA-Z0-9_-]/g, '_')
        const filename = `${safeName}_Slave_${node.slaveId || '0x04'}_${dateFrom}_to_${dateTo}.csv`
        downloadCsv(filename, header, rows)
        setDownloadSuccess(`Downloaded ${filename} (${rows.length} records)`)
        setTimeout(() => setDownloadSuccess(''), 4000)
      } catch (err) {
        console.error('CSV export failed:', err)
        setDownloadSuccess('Failed to query database for CSV export')
        setTimeout(() => setDownloadSuccess(''), 4000)
      } finally {
        setIsExportingCsv(false)
      }
      return
    }

    setDownloadSuccess(`No database records available for ${node.name} (unmetered/offline channel)`)
    setTimeout(() => setDownloadSuccess(''), 4000)
    setIsExportingCsv(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-end bg-black/50 backdrop-blur-xs animate-fadeIn p-0 sm:p-2">
      <div
        className={`bg-white dark:bg-surface-900 shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col transition-all duration-200 overflow-hidden ${
          isMaximized
            ? 'w-full h-full max-w-7xl max-h-[96vh] rounded-2xl mx-auto'
            : 'w-full sm:w-[480px] md:w-[520px] lg:w-[560px] h-full sm:rounded-2xl border-l'
        }`}
      >
        {/* ─── 1. POPUP / DRAWER HEADER ─── */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-50 dark:bg-surface-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-2xs shrink-0 ${
                isCritical
                  ? 'bg-rose-600/20 text-rose-600 border border-rose-600/30'
                  : isGenerating
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : isHeavy
                  ? 'bg-warning-600/20 text-warning-600 border border-warning-600/30'
                  : isTripped
                  ? 'bg-danger-600/20 text-danger-600 border border-danger-600/30'
                  : isSpare
                  ? 'bg-surface-500/20 text-surface-400 border border-surface-500/30'
                  : 'bg-primary-500/20 text-primary-500 border border-primary-500/30'
              }`}
            >
              {(isGenerating || node.type === 'solar' || /solar/i.test(node.name)) ? <Sun size={17} /> : (node.type === 'genset' || /genset|gen/i.test(node.name)) ? <Fuel size={17} /> : <Zap size={17} />}
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-surface-900 dark:text-surface-100 text-sm leading-none">
                  {node.name}
                </h3>
                <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                  {node.buildingCode || 'B1'}
                </span>
                <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                  Slave: {node.slaveId || '0x04'}
                </span>
              </div>
              <p className="text-[10px] text-surface-500 leading-none mt-1">
                {node.category || node.type || 'Distribution Board'} • {node.gateway || 'EMS-GW-01'}
              </p>
            </div>
          </div>

          {/* Action buttons: Maximize toggle & Close Cross */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMaximized((v) => !v)}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-800 transition cursor-pointer"
              title={isMaximized ? 'Restore to Half-Screen Drawer' : 'Maximize Window'}
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-800 transition cursor-pointer"
              title="Close"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ─── 2. SUB-NAVIGATION TABS BAR ─── */}
        <div className="px-3 sm:px-4 py-1.5 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center justify-between gap-2 shrink-0">
          <div className="flex rounded-lg border border-surface-200 dark:border-surface-800 p-0.5 bg-surface-100 dark:bg-surface-950 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition text-[11px] cursor-pointer ${
                activeTab === 'telemetry'
                  ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <Gauge size={13} />
              Live Telemetry (24 Variables)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition text-[11px] cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <TrendingUp size={13} />
              Historical Graph
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition text-[11px] cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <Download size={13} />
              CSV Export
            </button>
          </div>

          {/* Quick status pill in tab header */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isCritical
                  ? 'bg-rose-600 animate-pulse'
                  : isHeavy
                  ? 'bg-warning-500 animate-pulse'
                  : isGenerating
                  ? 'bg-amber-500 animate-pulse'
                  : isTripped
                  ? 'bg-danger-600 animate-ping'
                  : isSpare
                  ? 'bg-surface-400'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-bold text-surface-700 dark:text-surface-300">
              {isCritical ? 'CRITICAL' : isHeavy ? 'WARNING' : isTripped ? 'TRIPPED' : isSpare ? 'SPARE' : isOffline ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>
        </div>

        {/* ─── 3. TAB CONTENT BODY (ZERO SCROLL FIT) ─── */}
        <div className="flex-1 p-2.5 sm:p-3 overflow-hidden flex flex-col justify-between">
          {/* ============================================================== */}
          {/* ─── TAB 1: LIVE TELEMETRY (24 VARIABLES IN COMPACT BLOCKS) ─── */}
          {/* ============================================================== */}
          {activeTab === 'telemetry' && (
            <div className="flex flex-col gap-1.5">
              {/* Status & Capacity Bar */}
              <div className="p-1 sm:p-1.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCritical
                        ? 'bg-rose-600 animate-pulse'
                        : isHeavy
                        ? 'bg-warning-500 animate-pulse'
                        : isGenerating
                        ? 'bg-amber-500 animate-pulse'
                        : isTripped
                        ? 'bg-danger-600 animate-ping'
                        : (isSpare || isOffline)
                        ? 'bg-surface-400'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-surface-800 dark:text-surface-200">
                    {isCritical
                      ? 'CRITICAL LOAD (HIGH USAGE ALERT)'
                      : isHeavy
                      ? 'HEAVY LOAD WARNING'
                      : isTripped
                      ? 'CIRCUIT TRIPPED (ALARM)'
                      : isGenerating
                      ? 'ACTIVE SOLAR GENERATION'
                      : isSpare
                      ? 'SPARE FEEDER'
                      : isOffline
                      ? 'METER OFFLINE (NO TELEMETRY)'
                      : 'NORMAL THREE-PHASE OPERATION'}
                  </span>
                  {node.ratedA && (
                    <span className="text-[9.5px] font-mono text-surface-500 ml-1">
                      (Rated: {node.ratedA} A)
                    </span>
                  )}
                </div>

                {/* Compact utilization progress */}
                {node.ratedA && (
                  <div className="flex items-center gap-2 min-w-[100px] sm:min-w-[140px]">
                    <div className="flex-1 bg-surface-200 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (node.utilizationPercent || 0) > 90
                            ? 'bg-danger-600'
                            : (node.utilizationPercent || 0) > 75
                            ? 'bg-warning-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, node.utilizationPercent || 0)}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono font-bold text-surface-700 dark:text-surface-300">
                      {node.utilizationPercent || 0}%
                    </span>
                  </div>
                )}
              </div>

              {/* 24 Variables Grid (Compact mini blocks - zero vertical stretch) */}
              <div
                className={`grid grid-cols-4 ${
                  isMaximized ? 'lg:grid-cols-6' : ''
                } gap-1`}
              >
                {variables.map((v) => (
                  <div
                    key={v.key}
                    className="py-1 px-1.5 rounded-md border border-surface-200 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-950/50 flex flex-col justify-between h-[34px] sm:h-[35px] transition hover:border-primary-500/50 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1 leading-none">
                      <span
                        className="text-[8.5px] sm:text-[9px] font-semibold text-surface-500 dark:text-surface-400 truncate"
                        title={v.name}
                      >
                        {v.shortName}
                      </span>
                      <span className="text-[7px] font-mono font-bold px-0.5 rounded bg-surface-200/80 dark:bg-surface-800 text-surface-400 shrink-0 uppercase">
                        {v.group}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-0.5 font-mono leading-none">
                      <span className="text-[10.5px] sm:text-[11px] font-black text-surface-900 dark:text-surface-100">
                        {v.value}
                      </span>
                      {v.unit && (
                        <span className="text-[7.5px] font-sans font-medium text-surface-400">
                          {v.unit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ─── TAB 2: HISTORICAL DATA & GRAPH (PER SLAVE & DEVICE) ─────── */}
          {/* ============================================================== */}
          {activeTab === 'history' && (
            <div className="h-full flex flex-col justify-between gap-1.5">
              {/* Device & Slave Metadata Bar */}
              <div className="p-1.5 sm:p-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-[9.5px] text-surface-400 uppercase font-bold block leading-none">
                      Device / Board
                    </span>
                    <span className="font-bold text-surface-900 dark:text-surface-100">
                      {node.name}
                    </span>
                  </div>
                  <div className="w-[1px] h-6 bg-surface-200 dark:bg-surface-800" />
                  <div>
                    <span className="text-[9.5px] text-surface-400 uppercase font-bold block leading-none">
                      Modbus Slave ID
                    </span>
                    <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
                      {node.slaveId || '0x04'}
                    </span>
                  </div>
                  <div className="w-[1px] h-6 bg-surface-200 dark:bg-surface-800 hidden sm:block" />
                  <div className="hidden sm:block">
                    <span className="text-[9.5px] text-surface-400 uppercase font-bold block leading-none">
                      Bus / Channel
                    </span>
                    <span className="font-mono text-surface-600 dark:text-surface-400 text-[11px]">
                      {node.busChannel || 'RS485 Ch-1'}
                    </span>
                  </div>
                  <div className="w-[1px] h-6 bg-surface-200 dark:bg-surface-800 hidden sm:block" />
                  <div className="hidden sm:flex items-center">
                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Historical Telemetry
                    </span>
                  </div>
                </div>

                {/* Variable Selector & Range Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Quick Metric Mode Toggle */}
                  <div className="flex rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden text-xs bg-white dark:bg-surface-900">
                    <button
                      type="button"
                      onClick={() => setHistoryVariable('both')}
                      className={`px-2 py-1 font-bold text-[10px] uppercase transition cursor-pointer ${
                        historyVariable === 'both'
                          ? 'bg-primary-600 text-white'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      title="Show both Power (kW) and Units (kWh) on graph"
                    >
                      Power & Units
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryVariable('Total Power')}
                      className={`px-2 py-1 font-bold text-[10px] uppercase transition cursor-pointer ${
                        historyVariable === 'Total Power'
                          ? 'bg-blue-600 text-white'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      title="Show Power (kW) only"
                    >
                      Power (kW)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryVariable('Units')}
                      className={`px-2 py-1 font-bold text-[10px] uppercase transition cursor-pointer ${
                        historyVariable === 'Units'
                          ? 'bg-emerald-600 text-white'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      title="Show Units (kWh) only"
                    >
                      Units (kWh)
                    </button>
                  </div>

                  {/* Dropdown for other parameters */}
                  <select
                    value={historyVariable}
                    onChange={(e) => setHistoryVariable(e.target.value)}
                    className="input-field py-1 px-2 text-xs font-bold"
                  >
                    <option value="both">⚡ Power & Units (kW + kWh)</option>
                    <option value="Total Power">Total Power (kW)</option>
                    <option value="Units">Units (kWh)</option>
                    <optgroup label="Other Electrical Parameters">
                      {variables
                        .filter((v) => v.key !== 'Total Power' && v.key !== 'Units')
                        .map((v) => (
                          <option key={v.key} value={v.key}>
                            {v.name} ({v.unit})
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  {/* Range Presets */}
                  <div className="flex rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden text-xs bg-white dark:bg-surface-900">
                    {[
                      { key: '1h', label: '1h', hint: 'Rolling 1 Hour' },
                      { key: '24h', label: 'Day', hint: 'Day: 0 hours till 24 hours (00:00 - 24:00)' },
                      { key: '7d', label: '7d', hint: 'Rolling 7 Days' },
                      { key: '30d', label: 'Month', hint: 'Month: 1st till month end as per calendar' },
                      { key: '1y', label: 'Year', hint: 'Year: January to December as per calendar' },
                    ].map(({ key, label, hint }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setHistoryRange(key)
                          setPeriodOffset(0)
                          setDebouncedPeriodOffset(0)
                        }}
                        className={`px-2.5 py-1 font-bold text-[10px] uppercase transition cursor-pointer ${
                          historyRange === key
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                        title={hint}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Previous / Next Period Navigation */}
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden text-xs bg-white dark:bg-surface-900">
                      <button
                        type="button"
                        onClick={() => setPeriodOffset((o) => o - 1)}
                        className="px-1.5 py-1 font-bold text-[10px] uppercase transition cursor-pointer text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                        title="Previous period"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <span
                        className="px-2 py-1 font-bold text-[10px] font-mono text-surface-700 dark:text-surface-200 border-x border-surface-200 dark:border-surface-800 whitespace-nowrap flex items-center"
                        title="Period shown (Pakistan Time)"
                      >
                        {historyPeriod.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPeriodOffset((o) => Math.min(0, o + 1))}
                        disabled={periodOffset >= 0}
                        className="px-1.5 py-1 font-bold text-[10px] uppercase transition cursor-pointer text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        title="Next period"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    {periodOffset < 0 && (
                      <button
                        type="button"
                        onClick={() => setPeriodOffset(0)}
                        className="px-2 py-1 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 font-bold text-[10px] uppercase transition cursor-pointer text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                        title="Jump back to the current period"
                      >
                        Today
                      </button>
                    )}
                  </div>

                  {/* Graph Format Toggle (Bar Graph by default) */}
                  <div className="flex rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden text-xs bg-white dark:bg-surface-900">
                    <button
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`px-2 py-1 font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1 ${
                        chartType === 'bar'
                          ? 'bg-primary-600 text-white'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      title="Bar Graph (Default)"
                    >
                      <BarChart2 className="w-3 h-3" />
                      <span>Bar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('area')}
                      className={`px-2 py-1 font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1 ${
                        chartType === 'area'
                          ? 'bg-primary-600 text-white'
                          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      title="Area Graph"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Area</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-4 gap-1.5 shrink-0">
                <div className="p-1 px-2 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 text-center">
                  <span className="text-[8.5px] text-surface-400 uppercase font-bold block leading-none">
                    {historyVariable === 'Units' ? 'Total Units' : historyVariable === 'both' ? 'Peak Power' : 'Peak'}
                  </span>
                  <span className="text-xs font-mono font-black text-danger-600 dark:text-danger-400">
                    {historyVariable === 'Units' ? `${chartStats.totalUnits.toLocaleString()} kWh` : historyVariable === 'both' ? `${chartStats.peakPower} kW` : `${chartStats.peak} ${variables.find((v) => v.key === historyVariable)?.unit || ''}`}
                  </span>
                </div>
                <div className="p-1 px-2 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 text-center">
                  <span className="text-[8.5px] text-surface-400 uppercase font-bold block leading-none">
                    {historyVariable === 'Units' ? 'Period Units' : historyVariable === 'both' ? 'Average Power' : 'Average'}
                  </span>
                  <span className="text-xs font-mono font-black text-primary-600 dark:text-primary-400">
                    {historyVariable === 'Units' ? `${chartStats.periodUnits.toLocaleString()} kWh` : historyVariable === 'both' ? `${chartStats.avgPower} kW` : `${chartStats.avg} ${variables.find((v) => v.key === historyVariable)?.unit || ''}`}
                  </span>
                </div>
                <div className="p-1 px-2 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 text-center">
                  <span className="text-[8.5px] text-surface-400 uppercase font-bold block leading-none">
                    {historyVariable === 'both' ? 'Total Units (Meter)' : 'Minimum'}
                  </span>
                  <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {historyVariable === 'both' ? `${chartStats.totalUnits.toLocaleString()} kWh` : `${chartStats.min} ${variables.find((v) => v.key === historyVariable)?.unit || ''}`}
                  </span>
                </div>
                <div className="p-1 px-2 rounded-lg border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 text-center">
                  <span className="text-[8.5px] text-surface-400 uppercase font-bold block leading-none">
                    {historyVariable === 'both' ? 'Period Energy' : 'Samples'}
                  </span>
                  <span className="text-xs font-mono font-black text-surface-800 dark:text-surface-200">
                    {historyVariable === 'both' ? `${chartStats.periodUnits.toLocaleString()} kWh` : `${chartData.length} pts`}
                  </span>
                </div>
              </div>

              {/* Interactive Recharts Graph (Bar Graph Format by default) */}
              <div
                className={`w-full p-2 bg-surface-50 dark:bg-surface-950/60 rounded-xl border border-surface-200 dark:border-surface-800 flex-1 min-h-[180px] ${
                  isMaximized ? 'h-[380px]' : 'h-[230px]'
                }`}
              >
                {isLoadingHistory ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-2" />
                    <span className="text-xs font-bold text-surface-700 dark:text-surface-200">
                      Loading Historical Telemetry...
                    </span>
                    <span className="text-[10px] text-surface-400 mt-1 font-mono">
                      Target: {node.name} • Period: {historyPeriod.label} • Variable: {historyVariable}
                    </span>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <AlertTriangle className="w-7 h-7 text-amber-500 mb-2" />
                    <span className="text-xs font-bold text-surface-800 dark:text-surface-100">
                      No data for this period
                    </span>
                    <p className="text-[10.5px] text-surface-500 max-w-sm mt-1">
                      No usable telemetry rows are stored for <strong className="text-surface-700 dark:text-surface-300">{node.name}</strong> for <strong className="font-mono">{historyPeriod.label}</strong>. Unmetered or offline channels produce 0 records.
                    </p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 8.5 }} stroke="#94A3B8" interval={historyRange === '30d' ? 0 : 'preserveStartEnd'} tickFormatter={(val) => (historyRange === '30d' && typeof val === 'string' ? val.split(' ')[0] : val)} />

                      {/* Left YAxis: Power (kW) */}
                      {(historyVariable === 'both' || historyVariable === 'Total Power') && (
                        <YAxis
                          yAxisId="powerAxis"
                          orientation="left"
                          tick={{ fontSize: 9 }}
                          stroke="#2563EB"
                          unit=" kW"
                          width={48}
                          domain={[0, 'auto']}
                          allowDataOverflow={false}
                        />
                      )}

                      {/* Right YAxis: Units (kWh) */}
                      {(historyVariable === 'both' || historyVariable === 'Units') && (
                        <YAxis
                          yAxisId="unitsAxis"
                          orientation="right"
                          tick={{ fontSize: 9 }}
                          stroke="#10B981"
                          unit=" kWh"
                          width={58}
                          domain={[0, 'auto']}
                          allowDataOverflow={false}
                        />
                      )}

                      {/* Single custom variable YAxis */}
                      {historyVariable !== 'both' && historyVariable !== 'Total Power' && historyVariable !== 'Units' && (
                        <YAxis
                          yAxisId="customAxis"
                          orientation="left"
                          tick={{ fontSize: 9 }}
                          stroke="#3B82F6"
                          width={45}
                        />
                      )}

                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null
                          const point = chartData.find((d) => d.timestamp === label)
                          return (
                            <div className="bg-surface-900 border border-surface-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[200px]">
                              <div className="font-bold text-surface-200 border-b border-surface-800 pb-1 flex items-center justify-between gap-3">
                                <span>{point?.hourLabel || label}{point?.isToday ? ' (Today - In Progress)' : point?.isCurrentMonth ? ' (Current Month - In Progress)' : point?.isCommissionMonth ? ` (Commissioned ${point.commissionDateLabel})` : point?.isPreCommission ? ' (Pre-Commissioning)' : ''}</span>
                                <span className="text-[10px] text-surface-400 font-normal">{node.name}</span>
                              </div>
                              {point?.isToday && (historyRange === '7d' || historyRange === '30d') && (
                                <div className="text-[10px] text-amber-400 font-medium">
                                  Today so far ({point.elapsedHours}h of 24h elapsed)
                                </div>
                              )}
                              {point?.isPreCommission && historyRange === '1y' && (
                                <div className="text-[10px] text-slate-400 italic">
                                  Device not yet registered (Commissioned {point.commissionDateLabel})
                                </div>
                              )}
                              {point?.isCommissionMonth && historyRange === '1y' && (
                                <div className="text-[10px] text-emerald-400 font-medium">
                                  Commissioned {point.commissionDateLabel} ({point.activeDays} days metered)
                                </div>
                              )}
                              {point?.isCurrentMonth && historyRange === '1y' && (
                                <div className="text-[10px] text-amber-400 font-medium">
                                  Current month so far ({point.elapsedDays} of {point.daysInMonth} days elapsed)
                                </div>
                              )}
                              {payload.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                  <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                    <span className="w-2 h-2 rounded-xs inline-block" style={{ backgroundColor: entry.color }} />
                                    {entry.name}{(point?.isToday || point?.isCurrentMonth) && (entry.name === 'Units' || entry.name.startsWith('Units')) ? ' (So Far)' : ''}:
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                                  </span>
                                </div>
                              ))}
                              {point?.cumulativeUnits != null && (historyVariable === 'both' || historyVariable === 'Units') && (
                                <div className="pt-1 border-t border-surface-800 flex items-center justify-between text-[10px] text-surface-400">
                                  <span>Total Meter Units:</span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    {point.cumulativeUnits.toLocaleString()} kWh
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        }}
                      />

                      {historyVariable === 'both' && (
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }}
                        />
                      )}

                      {/* Power Bar */}
                      {(historyVariable === 'both' || historyVariable === 'Total Power') && (
                        <Bar
                          yAxisId="powerAxis"
                          dataKey="power"
                          name="Power (kW)"
                          fill="#2563EB"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={historyRange === '1h' ? 24 : historyRange === '24h' ? 14 : historyRange === '1y' ? 22 : 20}
                        />
                      )}

                      {/* Units Bar */}
                      {(historyVariable === 'both' || historyVariable === 'Units') && (
                        <Bar
                          yAxisId="unitsAxis"
                          dataKey="units"
                          name="Units (kWh)"
                          fill="#10B981"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={historyRange === '1h' ? 24 : historyRange === '24h' ? 14 : historyRange === '1y' ? 22 : 20}
                        />
                      )}

                      {/* Single custom variable Bar */}
                      {historyVariable !== 'both' && historyVariable !== 'Total Power' && historyVariable !== 'Units' && (
                        <Bar
                          yAxisId="customAxis"
                          dataKey="value"
                          name={variables.find((v) => v.key === historyVariable)?.shortName || 'Value'}
                          fill="#3B82F6"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={historyRange === '1h' ? 24 : historyRange === '24h' ? 14 : historyRange === '1y' ? 22 : 20}
                        />
                      )}
                    </BarChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="unitsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.30} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 8.5 }} stroke="#94A3B8" interval={historyRange === '30d' ? 0 : 'preserveStartEnd'} tickFormatter={(val) => (historyRange === '30d' && typeof val === 'string' ? val.split(' ')[0] : val)} />

                      {/* Left YAxis: Power (kW) */}
                      {(historyVariable === 'both' || historyVariable === 'Total Power') && (
                        <YAxis
                          yAxisId="powerAxis"
                          orientation="left"
                          tick={{ fontSize: 9 }}
                          stroke="#2563EB"
                          unit=" kW"
                          width={48}
                          domain={[0, 'auto']}
                          allowDataOverflow={false}
                        />
                      )}

                      {/* Right YAxis: Units (kWh) */}
                      {(historyVariable === 'both' || historyVariable === 'Units') && (
                        <YAxis
                          yAxisId="unitsAxis"
                          orientation="right"
                          tick={{ fontSize: 9 }}
                          stroke="#10B981"
                          unit=" kWh"
                          width={58}
                          domain={[0, 'auto']}
                          allowDataOverflow={false}
                        />
                      )}

                      {/* Single custom variable YAxis */}
                      {historyVariable !== 'both' && historyVariable !== 'Total Power' && historyVariable !== 'Units' && (
                        <YAxis
                          yAxisId="customAxis"
                          orientation="left"
                          tick={{ fontSize: 9 }}
                          stroke="#3B82F6"
                          width={45}
                        />
                      )}

                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null
                          const point = chartData.find((d) => d.timestamp === label)
                          return (
                            <div className="bg-surface-900 border border-surface-700 p-2 rounded-lg shadow-xl text-xs space-y-1 min-w-[190px]">
                              <div className="font-bold text-surface-200 border-b border-surface-800 pb-1 flex items-center justify-between gap-3">
                                <span>{point?.hourLabel || label}{point?.isToday ? ' (Today - In Progress)' : point?.isCurrentMonth ? ' (Current Month - In Progress)' : point?.isCommissionMonth ? ` (Commissioned ${point.commissionDateLabel})` : point?.isPreCommission ? ' (Pre-Commissioning)' : ''}</span>
                                <span className="text-[10px] text-surface-400 font-normal">{node.name}</span>
                              </div>
                              {point?.isToday && (historyRange === '7d' || historyRange === '30d') && (
                                <div className="text-[10px] text-amber-400 font-medium">
                                  Today so far ({point.elapsedHours}h of 24h elapsed)
                                </div>
                              )}
                              {point?.isPreCommission && historyRange === '1y' && (
                                <div className="text-[10px] text-slate-400 italic">
                                  Device not yet registered (Commissioned {point.commissionDateLabel})
                                </div>
                              )}
                              {point?.isCommissionMonth && historyRange === '1y' && (
                                <div className="text-[10px] text-emerald-400 font-medium">
                                  Commissioned {point.commissionDateLabel} ({point.activeDays} days metered)
                                </div>
                              )}
                              {point?.isCurrentMonth && historyRange === '1y' && (
                                <div className="text-[10px] text-amber-400 font-medium">
                                  Current month so far ({point.elapsedDays} of {point.daysInMonth} days elapsed)
                                </div>
                              )}
                              {payload.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 text-[11px]">
                                  <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                                    {entry.name}{(point?.isToday || point?.isCurrentMonth) && (entry.name === 'Units' || entry.name.startsWith('Units')) ? ' (So Far)' : ''}:
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        }}
                      />

                      {historyVariable === 'both' && (
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }}
                        />
                      )}

                      {/* Power Area */}
                      {(historyVariable === 'both' || historyVariable === 'Total Power') && (
                        <Area
                          yAxisId="powerAxis"
                          type="monotone"
                          dataKey="power"
                          name="Power (kW)"
                          stroke="#2563EB"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#powerGrad)"
                        />
                      )}

                      {/* Units Area */}
                      {(historyVariable === 'both' || historyVariable === 'Units') && (
                        <Area
                          yAxisId="unitsAxis"
                          type="monotone"
                          dataKey="units"
                          name="Units (kWh)"
                          stroke="#10B981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#unitsGrad)"
                        />
                      )}

                      {/* Single custom variable Area */}
                      {historyVariable !== 'both' && historyVariable !== 'Total Power' && historyVariable !== 'Units' && (
                        <Area
                          yAxisId="customAxis"
                          type="monotone"
                          dataKey="value"
                          name={variables.find((v) => v.key === historyVariable)?.shortName || 'Value'}
                          stroke="#3B82F6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#historyGrad)"
                        />
                      )}
                    </AreaChart>
                  )}
                </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ─── TAB 3: CSV EXPORT (DATE RANGE & VARIABLE SELECTION) ─────── */}
          {/* ============================================================== */}
          {activeTab === 'export' && (
            <div className="h-full flex flex-col justify-between gap-2">
              {/* Target info and date range picker */}
              <div className="p-2 sm:p-2.5 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 space-y-2 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold text-surface-900 dark:text-surface-100">
                      Target Device: {node.name}
                    </span>
                    <span className="text-surface-500 ml-2">
                      (Modbus Slave: <strong className="font-mono text-primary-600">{node.slaveId || '0x04'}</strong>)
                    </span>
                  </div>

                  {/* Date range inputs */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-surface-400">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="input-field py-0.5 px-1.5 text-[11px] font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-surface-400">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="input-field py-0.5 px-1.5 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Date Range Shortcuts */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-200 dark:border-surface-800 text-[10px]">
                  <span className="text-surface-400 font-bold uppercase tracking-wider">Date Presets:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const today = getPktDateString(new Date())
                        setDateFrom(today)
                        setDateTo(today)
                      }}
                      className="px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-800 font-medium cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = getPktDateString(new Date())
                        const sevenAgo = getPktDateString(new Date(Date.now() - 7 * DAY_MS))
                        setDateFrom(sevenAgo)
                        setDateTo(today)
                      }}
                      className="px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-800 font-medium cursor-pointer"
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = getPktDateString(new Date())
                        const thirtyAgo = getPktDateString(new Date(Date.now() - 30 * DAY_MS))
                        setDateFrom(thirtyAgo)
                        setDateTo(today)
                      }}
                      className="px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-800 font-medium cursor-pointer"
                    >
                      Last 30 Days
                    </button>
                  </div>
                </div>
              </div>

              {/* Variable Selection Section */}
              <div className="p-2 sm:p-2.5 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-surface-900 dark:text-surface-100">
                      Select Variables to Export:
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold">
                      {selectedVarKeys.length} of {variables.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-800 font-bold hover:bg-surface-300 dark:hover:bg-surface-700 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-800 font-bold hover:bg-surface-300 dark:hover:bg-surface-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* 24 Clickable Variable Toggle Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 overflow-y-auto max-h-[160px] sm:max-h-[180px] p-1">
                  {variables.map((v) => {
                    const isSelected = selectedVarKeys.includes(v.key)
                    return (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => toggleVar(v.key)}
                        className={`p-1 px-1.5 rounded-md text-[9.5px] font-bold border flex items-center justify-between gap-1 transition text-left cursor-pointer ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600 shadow-2xs'
                            : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:border-surface-400'
                        }`}
                      >
                        <span className="truncate">{v.shortName}</span>
                        {isSelected ? (
                          <Check size={11} className="shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-xs border border-surface-400 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Download CSV Action button */}
                <div className="pt-2 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3 shrink-0">
                  <div className="text-[11px] text-surface-500 truncate">
                    {downloadSuccess ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ✓ {downloadSuccess}
                      </span>
                    ) : (
                      <span>Format: Industrial Wide CSV (Excel / SCADA compatible)</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={selectedVarKeys.length === 0 || isExportingCsv}
                    className="btn-primary py-1.5 px-3 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isExportingCsv ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    {isExportingCsv ? 'Exporting Real DB...' : `Download CSV (${selectedVarKeys.length} Variables)`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 4. POPUP FOOTER ACTIONS ─── */}
        <div className="p-2 sm:p-2.5 px-3 sm:px-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs ${
              node?.status === 'offline'
                ? 'bg-danger-500/10 text-danger-600 border-danger-500/20'
                : node?.status === 'generating'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : node?.status === 'spare'
                ? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${node?.status === 'offline' ? 'bg-danger-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{node?.status === 'offline' ? 'Offline' : node?.status === 'generating' ? 'Solar Generating' : node?.status === 'spare' ? 'Spare Breaker' : 'Live Feeder Active'}</span>
            </div>

            <span className="text-[10px] text-surface-400 hidden sm:inline">
              Modbus RTU • 24 Registers Polled • Rated {node?.ratedA || 100}A
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className="py-1.5 px-2.5 rounded-xl text-xs font-bold text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Download size={12} />
              Export
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




function EnergyFlowOverview({ data, onSelectNode }) {
  if (!data) return null

  const metrics = data.metrics || {}
  const building1 = data.building1 || {}
  const building2 = data.building2 || {}
  const executiveLimits = data.executiveLimits || {}
  const slaveThresholds = executiveLimits.slaveThresholds || {}
  const slaveDefault = executiveLimits.slaveDefault || {}

  // Aggregate cumulative units for top plant overview cards directly from real telemetry
  const b1WapdaUnits = Number(building1.sources?.find((s) => s.id === 'b1-wapda')?.units || 0)
  const b2WapdaUnits = Number(building2.sources?.find((s) => s.id === 'b2-wapda')?.units || 0)
  const totalWapdaUnits = Number((b1WapdaUnits + b2WapdaUnits).toFixed(1))

  const b1RunningUnits = Number(building1.units || (building1.sources || []).reduce((sum, s) => sum + (Number(s.units) || 0), 0) || 0)
  const b2RunningUnits = Number(building2.units || (building2.sources || []).reduce((sum, s) => sum + (Number(s.units) || 0), 0) || 0)
  const totalRunningUnits = Number((b1RunningUnits + b2RunningUnits).toFixed(1))

  const b1SolarUnits = Number(building1.sources?.find((s) => s.type === 'solar')?.units || 0)
  const b2SolarUnits = Number(building2.sources?.find((s) => s.type === 'solar')?.units || 0)
  const totalSolarUnits = Number((b1SolarUnits + b2SolarUnits).toFixed(1))

  const b1Gen1Units = Number(building1.sources?.find((s) => s.id === 'b1-genset1')?.units || 0)
  const b1Gen2Units = Number(building1.sources?.find((s) => s.id === 'b1-genset2')?.units || 0)
  const b2GenUnits = Number(building2.sources?.find((s) => s.type === 'genset')?.units || 0)
  const totalGensetUnits = Number((b1Gen1Units + b1Gen2Units + b2GenUnits).toFixed(1))

  const thresholds = executiveLimits.thresholds || {}
  const sourceThresholds = executiveLimits.sourceThresholds || {}
  const totalThresholds = executiveLimits.totalThresholds || {}

  const evaluateCardAlert = (val, conf, defaultBorder = 'border-blue-500') => {
    if (!conf || !conf.enabled) {
      return {
        cardStyle: `bg-white dark:bg-slate-900 ${defaultBorder}`,
        isCritical: false,
        isWarning: false,
        badgeText: null,
      }
    }
    const num = Number(val || 0)
    const warn = Number(conf.warningValue)
    const crit = Number(conf.criticalValue)

    if (Number.isFinite(crit) && crit > 0 && num >= crit) {
      return {
        cardStyle: 'bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-600 ring-2 ring-rose-400/30 text-rose-700',
        isCritical: true,
        isWarning: false,
        badgeText: 'CRITICAL',
        badgeClass: 'bg-rose-600 text-white animate-pulse',
        valColor: 'text-rose-700 dark:text-rose-400 font-black',
      }
    }
    if (Number.isFinite(warn) && warn > 0 && num >= warn) {
      return {
        cardStyle: 'bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-500 ring-2 ring-amber-400/30 text-amber-800',
        isCritical: false,
        isWarning: true,
        badgeText: 'WARNING',
        badgeClass: 'bg-amber-500 text-white animate-pulse',
        valColor: 'text-amber-800 dark:text-amber-300 font-black',
      }
    }
    return {
      cardStyle: `bg-white dark:bg-slate-900 ${defaultBorder}`,
      isCritical: false,
      isWarning: false,
      badgeText: null,
    }
  }

  // Pre-evaluated alerts for Top Center Summary Cards
  const wapdaAlert = evaluateCardAlert(
    metrics.totalWapda,
    totalThresholds['totalWapda'] || thresholds['gridPower'] || thresholds['totalWapda'],
    'border-blue-500'
  )
  const totalRunningAlert = evaluateCardAlert(
    metrics.totalRunningLoad,
    totalThresholds['totalRunningLoad'] || thresholds['totalLoad'] || thresholds['totalRunningLoad'],
    'border-blue-600'
  )
  const solarAlert = evaluateCardAlert(
    metrics.solarTotal,
    totalThresholds['solarTotal'] || thresholds['solarPower'] || thresholds['solarTotal'],
    'border-amber-500'
  )
  const gensetAlert = evaluateCardAlert(
    metrics.totalGenset,
    totalThresholds['totalGenset'] || thresholds['generatorPower'] || thresholds['totalGenset'],
    'border-purple-500'
  )

  // Pre-evaluated alerts for Building Total Inflow Nodes
  const b1LoadAlert = evaluateCardAlert(
    building1.runningLoad,
    totalThresholds['totalRunningLoadB1'] || thresholds['totalRunningLoadB1'],
    'border-blue-500'
  )
  const b2LoadAlert = evaluateCardAlert(
    building2.runningLoad,
    totalThresholds['totalRunningLoadB2'] || thresholds['totalRunningLoadB2'],
    'border-emerald-500'
  )

  const renderBreakerBox = (b, buildingCode) => {
    if (!b) return null
    const name = b.name || ''
    const loadKwVal = Number.isFinite(Number(b.loadKw)) ? Number(b.loadKw) : 0
    const isSpare = (b.status === 'spare' || name.toLowerCase().includes('spare')) && loadKwVal === 0
    const isGenerating = (b.status === 'generating' || name.toLowerCase().includes('solar')) && loadKwVal > 0
    const isTieLine = b.status === 'tie-line' || name.toLowerCase().includes('ambition') || name.toLowerCase().includes('tie')
    const isGenset = b.type === 'genset' || /^(g1|g2|g3|genset)/i.test(name)
    const isOffline = b.status === 'offline' || (!isSpare && !isGenerating && !isGenset && !isTieLine && Number(b.voltage || 0) === 0 && loadKwVal === 0)

    // Threshold evaluation: checks slave override, then global default
    const slaveThresh = (b.slaveId && slaveThresholds[b.slaveId]) ||
      (b.rawSlaveId && slaveThresholds[b.rawSlaveId]) ||
      (b.fullSlaveId && slaveThresholds[b.fullSlaveId]) ||
      (b.id && slaveThresholds[b.id]) ||
      Object.values(slaveThresholds).find((st) => st.slaveName && st.slaveName.toLowerCase() === (b.name || '').toLowerCase()) ||
      null

    const hasCustomThresh = !!slaveThresh
    const isRuleEnabled = hasCustomThresh
      ? slaveThresh.enabled !== false
      : (slaveDefault?.enabled === true)

    const warnLimit = Number(hasCustomThresh ? slaveThresh.warningValue : (slaveDefault?.warningValue || 70))
    const critLimit = Number(hasCustomThresh ? slaveThresh.criticalValue : (slaveDefault?.criticalValue || 100))

    const isCurrentMetric = slaveThresh?.metricKey === 'current'
    const evalValue = isCurrentMetric ? Number(b.current || 0) : loadKwVal

    // Alert thresholds evaluated strictly against the configured limits
    // Never show Red or Yellow unless the measured value (kW or A) is >= the limit
    const isCritical = isRuleEnabled && !isSpare && !isOffline && Number.isFinite(critLimit) && critLimit > 0 && (evalValue >= critLimit)
    const isHeavy = isRuleEnabled && !isSpare && !isOffline && !isCritical && Number.isFinite(warnLimit) && warnLimit > 0 && (evalValue >= warnLimit)
    const isTripped = b.status === 'tripped' && loadKwVal === 0

    // All normal/remaining breakers: clean white card with white/light neutral border, NO color at all
    let cardStyle = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
    let dotClass = 'bg-slate-300 dark:bg-slate-600'
    let valueClass = 'text-slate-900 dark:text-slate-100'

    if (isCritical) {
      cardStyle = 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700/80 border-t-[3px] border-t-rose-600 ring-1 ring-rose-400/30 hover:border-rose-500'
      dotClass = 'bg-rose-600 ring-2 ring-rose-300 animate-pulse'
      valueClass = 'text-rose-700 dark:text-rose-400 font-black'
    } else if (isHeavy) {
      cardStyle = 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 border-t-[3px] border-t-amber-500 ring-1 ring-amber-400/30 hover:border-amber-500'
      dotClass = 'bg-amber-500 ring-2 ring-amber-300 animate-pulse'
      valueClass = 'text-amber-800 dark:text-amber-300 font-black'
    } else if (isSpare) {
      cardStyle = 'bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
      dotClass = 'bg-slate-200 dark:bg-slate-700'
      valueClass = 'text-slate-400 dark:text-slate-500'
    } else if (isOffline) {
      cardStyle = 'bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400 opacity-75'
      dotClass = 'bg-slate-400 dark:bg-slate-500'
      valueClass = 'text-slate-500 dark:text-slate-400 font-medium'
    }

    return (
      <div
        key={b.id || `${buildingCode}-${name}`}
        onClick={() => onSelectNode?.(b, buildingCode)}
        className={`group relative p-1 sm:p-1.5 rounded-lg border text-center transition-all duration-150 cursor-pointer select-none flex flex-col justify-between min-h-[44px] sm:min-h-[46px] shadow-2xs ${cardStyle}`}
        title={`${name} - ${loadKwVal.toFixed(1)} kW ${isCritical ? `(CRITICAL >= ${critLimit} kW)` : isHeavy ? `(WARNING >= ${warnLimit} kW)` : isTripped ? '(TRIPPED)' : isOffline ? '(OFFLINE - 0V)' : '(NORMAL)'}`}
      >
        <div
          className="w-full text-center text-[7.5px] sm:text-[8px] font-bold tracking-tight leading-[1.15] line-clamp-2 px-0.5 text-slate-800 dark:text-slate-100 flex items-center justify-center gap-0.5"
          title={name}
        >
          {isGenerating && <Sun size={11} className="text-amber-500 shrink-0" />}
          {(b.type === 'genset' || /^(g1|g2|g3|genset)/i.test(name)) && <Fuel size={11} className="text-purple-500 shrink-0" />}
          {/wapda/i.test(name) && <Zap size={11} className="text-blue-500 shrink-0" />}
          <span className="truncate">{name}</span>
        </div>
        <div className="flex items-center justify-between w-full pt-1 px-0.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
          <div className="flex items-baseline font-mono leading-none">
            <span className={`text-[10px] sm:text-[11px] font-black tracking-tight ${valueClass}`}>
              {loadKwVal.toFixed(1)}
            </span>
            <span className="text-[7px] font-sans font-semibold text-slate-400 ml-0.5">
              kW
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col justify-between select-none max-w-[1600px] mx-auto text-slate-800 dark:text-slate-200">
      {/* ─── 1. TOP HEADER & TITLE (Matching Hand-Drawn Double Underline) ─── */}
      <div className="text-center mb-0.5">
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 inline-block relative">
          Energy Flow Overview
          <div className="w-full h-[2px] bg-slate-900 dark:bg-slate-100 mt-0.5" />
          <div className="w-full h-[1px] bg-slate-900 dark:bg-slate-100 mt-[1px]" />
        </h1>
      </div>

      {/* ─── 2. TOP CENTER SUMMARY CARDS (4 Boxes from Sketch) ─── */}
      <div className="flex justify-center mb-0.5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 w-full max-w-2xl">
          {/* Total WAPDA */}
          <div
            onClick={() =>
              onSelectNode?.(
                {
                  id: 'total-wapda-plant',
                  name: 'Total WAPDA',
                  category: 'Grid Inflow (Dual-Building B1 + B2)',
                  loadKw: Number(metrics.totalWapda || 0),
                  units: totalWapdaUnits,
                  type: 'wapda',
                  status: Number(metrics.totalWapda || 0) > 0 ? 'active' : 'idle',
                  ratedA: 2500,
                  voltage: 400.0,
                  powerFactor: 0.94,
                  slaveId: '0x01-0x11',
                  deviceName: 'WAPDA Grid (B1+B2)',
                  busChannel: 'Grid Feeders Dual-Inflow',
                  createdAt: '2026-09-18T00:00:00.000Z',
                  contributingSlaves: metrics.contributingSlaves?.wapda || INITIAL_FLOW_DATA.metrics.contributingSlaves.wapda,
                },
                'B1+B2'
              )
            }
            className={`py-0.5 px-2 rounded-lg border-2 text-center shadow-2xs cursor-pointer hover:scale-[1.02] transition relative ${wapdaAlert.cardStyle}`}
            title="Click to view Total WAPDA live telemetry, historical graph & export"
          >
            {wapdaAlert.badgeText && (
              <span className={`absolute -top-2 right-2 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs ${wapdaAlert.badgeClass}`}>
                {wapdaAlert.badgeText}
              </span>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <Zap size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block truncate">
                Total WAPDA
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 leading-none">
                {Number(metrics.totalWapda || 0).toFixed(1)}
              </span>
              <span className="text-[8px] font-bold text-slate-400">kW</span>
            </div>
          </div>

          {/* Total Running Load B1 + B2 */}
          <div
            onClick={() =>
              onSelectNode?.(
                {
                  id: 'total-running-load-plant',
                  name: 'Total Running Load B1 + B2',
                  category: 'Plant Dual-Facility Total Inflow',
                  loadKw: Number(metrics.totalRunningLoad || 0),
                  units: totalRunningUnits,
                  type: 'load',
                  status: 'active',
                  ratedA: 3200,
                  voltage: 400.0,
                  powerFactor: 0.95,
                  slaveId: '0x1D-ALL',
                  deviceName: 'Facility Load Totalizer',
                  busChannel: 'Main Plant Distribution',
                  createdAt: '2026-09-18T00:00:00.000Z',
                  contributingSlaves: metrics.contributingSlaves?.runningLoad || INITIAL_FLOW_DATA.metrics.contributingSlaves.runningLoad,
                },
                'B1+B2'
              )
            }
            className={`py-0.5 px-2 rounded-lg border-2 text-center shadow-2xs ring-1 ring-blue-500/30 cursor-pointer hover:scale-[1.02] transition relative ${totalRunningAlert.cardStyle}`}
            title="Click to view Total Running Load live telemetry, historical graph & export"
          >
            {totalRunningAlert.badgeText && (
              <span className={`absolute -top-2 right-2 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs ${totalRunningAlert.badgeClass}`}>
                {totalRunningAlert.badgeText}
              </span>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <Activity size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block truncate">
                Total Running Load B1 + B2
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400 leading-none">
                {Number(metrics.totalRunningLoad || 0).toFixed(1)}
              </span>
              <span className="text-[8px] font-bold text-slate-400">kW</span>
            </div>
          </div>

          {/* Solar Total */}
          <div
            onClick={() =>
              onSelectNode?.(
                {
                  id: 'total-solar-plant',
                  name: 'Solar Total (All 7 Inverters B1+B2)',
                  category: 'Solar Generation (B1 5-Inv + B2 2-Inv)',
                  loadKw: Number(metrics.solarTotal || 0),
                  units: totalSolarUnits,
                  type: 'solar',
                  status: Number(metrics.solarTotal || 0) > 0 ? 'generating' : 'standby',
                  ratedA: 1200,
                  voltage: 400.0,
                  powerFactor: 0.98,
                  slaveId: '7-INV',
                  deviceName: 'Solar Farm Inverters (7x)',
                  busChannel: 'PV Inverter Bus RS485',
                  createdAt: '2026-09-18T00:00:00.000Z',
                  contributingSlaves: metrics.contributingSlaves?.solar || INITIAL_FLOW_DATA.metrics.contributingSlaves.solar,
                },
                'B1+B2'
              )
            }
            className={`py-0.5 px-2 rounded-lg border-2 text-center shadow-2xs cursor-pointer hover:scale-[1.02] transition relative ${solarAlert.cardStyle}`}
            title="Click to view Solar Total live telemetry, historical graph & export"
          >
            {solarAlert.badgeText && (
              <span className={`absolute -top-2 right-2 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs ${solarAlert.badgeClass}`}>
                {solarAlert.badgeText}
              </span>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <Sun size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                Solar Total (All 7 Inverters B1+B2)
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 leading-none">
                {Number(metrics.solarTotal || 0).toFixed(1)}
              </span>
              <span className="text-[8px] font-bold text-slate-400">kW</span>
            </div>
          </div>

          {/* Total Genset */}
          <div
            onClick={() =>
              onSelectNode?.(
                {
                  id: 'total-genset-plant',
                  name: 'Total Genset',
                  category: 'Diesel Generation (G1, G2 AMB + Gen AFL)',
                  loadKw: Number(metrics.totalGenset || 0),
                  units: totalGensetUnits,
                  type: 'genset',
                  status: Number(metrics.totalGenset || 0) > 5 ? 'active' : 'idle',
                  ratedA: 2000,
                  voltage: 400.0,
                  powerFactor: 0.92,
                  slaveId: 'GEN-ALL',
                  deviceName: 'Diesel Generators Totalizer',
                  busChannel: 'Synchronizing Panel',
                  createdAt: '2026-09-18T00:00:00.000Z',
                  contributingSlaves: metrics.contributingSlaves?.genset || INITIAL_FLOW_DATA.metrics.contributingSlaves.genset,
                },
                'B1+B2'
              )
            }
            className={`py-0.5 px-2 rounded-lg border-2 text-center shadow-2xs cursor-pointer hover:scale-[1.02] transition relative ${gensetAlert.cardStyle}`}
            title="Click to view Total Genset live telemetry, historical graph & export"
          >
            {gensetAlert.badgeText && (
              <span className={`absolute -top-2 right-2 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-2xs ${gensetAlert.badgeClass}`}>
                {gensetAlert.badgeText}
              </span>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <Fuel size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block truncate">
                Total Genset
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 leading-none">
                {Number(metrics.totalGenset || 0).toFixed(1)}
              </span>
              <span className="text-[8px] font-bold text-slate-400">kW</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2.5 TOTAL RUNNING LOAD DONUT (TOP CENTER) ─── */}
      <div className="flex justify-center my-1.5 sm:my-2">
        <TotalPlantRunningLoadDonut data={data} />
      </div>

      {/* ─── 3. HORIZONTAL SCHEMATIC BUS CONNECTOR LINE ─── */}
      <div className="relative h-2.5 flex items-center justify-center">
        {/* Main horizontal busbar connecting B1 to B2 */}
        <div className="w-[88%] h-0.5 bg-slate-400 dark:bg-slate-600 rounded-full relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500 via-primary-500 to-emerald-500 rounded-full opacity-70 animate-pulse" />
        </div>
        {/* Vertical drops down to B1 and B2 */}
        <div className="absolute left-[8%] top-1.5 w-0.5 h-1.5 bg-slate-400 dark:bg-slate-600" />
        <div className="absolute right-[8%] top-1.5 w-0.5 h-1.5 bg-slate-400 dark:bg-slate-600" />
      </div>

      {/* ─── 4. DUAL BRANCH SPLIT: B1 (LEFT) & B2 (RIGHT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 xl:gap-3 items-start">
        {/* ============================================================== */}
        {/* ─── LEFT: B1 (AMBITION) ────────────────────────────────────── */}
        {/* ============================================================== */}
        <div className="p-1.5 sm:p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          {/* B1 Header Row with Donut */}
          <div className="flex items-center justify-between gap-2 mb-1 px-1">
            <div className="flex flex-col items-start">
              <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                B1 (Ambition)
              </span>
              <div
                onClick={() => onSelectNode?.({ ...building1, id: 'b1-total-running-load', name: 'Total Running Load B1 (AMB)', category: 'Main Substation', loadKw: building1.runningLoad, units: b1RunningUnits, contributingSlaves: metrics.contributingSlaves?.runningLoadB1 || INITIAL_FLOW_DATA.metrics.contributingSlaves.runningLoadB1 }, 'B1')}
                className={`px-3 py-1 rounded-lg border-2 text-center cursor-pointer hover:scale-[1.01] transition shadow-2xs relative ${b1LoadAlert.cardStyle}`}
                title="Click to view total plant B1 inflow telemetry & history"
              >
                {b1LoadAlert.badgeText && (
                  <span className={`absolute -top-2 right-2 text-[7.5px] font-black px-1 py-0.2 rounded-full ${b1LoadAlert.badgeClass}`}>
                    {b1LoadAlert.badgeText}
                  </span>
                )}
                <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block leading-none mb-0.5">
                  Total Running Load B1
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 leading-tight">
                  {Number(building1.runningLoad || 0).toFixed(1)} <span className="text-[8px] font-sans font-bold text-slate-400">kW</span>
                </span>
              </div>
            </div>

            {/* Embedded Ambition Donut Card */}
            <Building1RunningLoadDonut data={data} />
          </div>

          {/* B1 Sources Row (4 Boxes from Sketch) */}
          <div className="grid grid-cols-4 gap-1 mb-0.5">
            {(building1.sources || []).map((src) => {
              const srcKw = Number(src?.loadKw || 0)
              const isWapda = src.id === 'b1-wapda' || src.type === 'grid' || /wapda/i.test(src.name)
              const isSolar = src.type === 'solar' || /solar/i.test(src.name)
              const isGenset = src.type === 'genset' || /genset|gen/i.test(src.name)

              const defaultBorder = isWapda ? 'border-blue-500' : isSolar ? 'border-amber-500' : 'border-purple-500'
              const srcConf = sourceThresholds[src.id] || sourceThresholds[src.slaveId] || (isWapda ? thresholds.gridPower : isSolar ? thresholds.solarPower : thresholds.generatorPower)
              const srcAlert = evaluateCardAlert(srcKw, srcConf, defaultBorder)

              return (
                <div
                  key={src.id}
                  onClick={() => onSelectNode?.(src, 'B1')}
                  className={`group py-0.5 px-1 rounded-md border text-center cursor-pointer hover:shadow-xs transition shadow-2xs relative ${srcAlert.cardStyle}`}
                  title={`${src.name} - ${srcKw.toFixed(1)} kW (Click to view live telemetry & historical graph)`}
                >
                  {srcAlert.badgeText && (
                    <span className={`absolute -top-1.5 right-1 text-[6.5px] font-bold px-1 py-0.1 rounded-full ${srcAlert.badgeClass}`}>
                      {srcAlert.badgeText}
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1 px-0.5 mb-0.5">
                    {isWapda && <Zap size={13} className="text-blue-500 shrink-0" />}
                    {isSolar && <Sun size={13} className="text-amber-500 shrink-0" />}
                    {isGenset && <Fuel size={13} className="text-purple-500 shrink-0" />}
                    <span className="text-[7px] sm:text-[7.5px] font-bold text-slate-800 dark:text-slate-200 block truncate leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition" title={src.name}>
                      {src.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] font-black font-mono text-slate-900 dark:text-slate-100 leading-none">
                    {srcKw.toFixed(1)} <span className="text-[7px] font-sans text-slate-400">kW</span>
                  </span>
                </div>
              )
            })}
          </div>

          {/* Distribution Feeder Busbar */}
          <div className="flex items-center justify-center relative my-0.5">
            <div className="w-full h-0.5 bg-slate-400 dark:bg-slate-600" />
            <div className="absolute px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[8.5px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              &#123; B1 Side Total 24 Breakers &#125;
            </div>
          </div>

          {/* 4 Rows of Breakers */}
          <div className="space-y-1 mt-1">
            {/* Row 1 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building1.row1 || []).map((b) => renderBreakerBox(b, 'B1'))}
            </div>
            {/* Row 2 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building1.row2 || []).map((b) => renderBreakerBox(b, 'B1'))}
            </div>
            {/* Row 3 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building1.row3 || []).map((b) => renderBreakerBox(b, 'B1'))}
            </div>
            {/* Row 4 (4 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building1.row4 || []).map((b) => renderBreakerBox(b, 'B1'))}
              {/* 3 blank fillers to align properly */}
              <div className="col-span-3" />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ─── RIGHT: BUILDING 2 (AFL) ────────────────────────────────── */}
        {/* ============================================================== */}
        <div className="p-1.5 sm:p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          {/* B2 Header Row with Donut */}
          <div className="flex items-center justify-between gap-2 mb-1 px-1">
            <div className="flex flex-col items-start">
              <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                Building 2 (AFL)
              </span>
              <div
                onClick={() => onSelectNode?.({ ...building2, id: 'b2-total-running-load', name: 'Total Running Load B2 (AFL)', category: 'Main Substation', loadKw: building2.runningLoad, units: b2RunningUnits, contributingSlaves: metrics.contributingSlaves?.runningLoadB2 || INITIAL_FLOW_DATA.metrics.contributingSlaves.runningLoadB2 }, 'B2')}
                className={`px-3 py-1 rounded-lg border-2 text-center cursor-pointer hover:scale-[1.01] transition shadow-2xs relative ${b2LoadAlert.cardStyle}`}
                title="Click to view total plant B2 inflow telemetry & history"
              >
                {b2LoadAlert.badgeText && (
                  <span className={`absolute -top-2 right-2 text-[7.5px] font-black px-1 py-0.2 rounded-full ${b2LoadAlert.badgeClass}`}>
                    {b2LoadAlert.badgeText}
                  </span>
                )}
                <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block leading-none mb-0.5">
                  Total Running Load B2
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 leading-tight">
                  {Number(building2.runningLoad || 0).toFixed(1)} <span className="text-[8px] font-sans font-bold text-slate-400">kW</span>
                </span>
              </div>
            </div>

            {/* Embedded AFL Donut Card */}
            <Building2RunningLoadDonut data={data} />
          </div>

          {/* B2 Sources Row (3 Boxes from Sketch: Solar 2 Inv, Genset 1, Wapda - B2) */}
          <div className="grid grid-cols-3 gap-1 mb-0.5">
            {(building2.sources || []).map((src) => {
              const srcKw = Number(src?.loadKw || 0)
              const isWapda = src.id === 'b2-wapda' || src.type === 'grid' || /wapda/i.test(src.name)
              const isSolar = src.type === 'solar' || /solar/i.test(src.name)
              const isGenset = src.type === 'genset' || /genset|gen/i.test(src.name)

              const defaultBorder = isWapda ? 'border-blue-500' : isSolar ? 'border-amber-500' : 'border-purple-500'
              const srcConf = sourceThresholds[src.id] || sourceThresholds[src.slaveId] || (isWapda ? thresholds.gridPower : isSolar ? thresholds.solarPower : thresholds.generatorPower)
              const srcAlert = evaluateCardAlert(srcKw, srcConf, defaultBorder)

              return (
                <div
                  key={src.id}
                  onClick={() => onSelectNode?.(src, 'B2')}
                  className={`group py-0.5 px-1 rounded-md border text-center cursor-pointer hover:shadow-xs transition shadow-2xs relative ${srcAlert.cardStyle}`}
                  title={`${src.name} - ${srcKw.toFixed(1)} kW (Click to view live telemetry & historical graph)`}
                >
                  {srcAlert.badgeText && (
                    <span className={`absolute -top-1.5 right-1 text-[6.5px] font-bold px-1 py-0.1 rounded-full ${srcAlert.badgeClass}`}>
                      {srcAlert.badgeText}
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1 px-0.5 mb-0.5">
                    {isWapda && <Zap size={13} className="text-blue-500 shrink-0" />}
                    {isSolar && <Sun size={13} className="text-amber-500 shrink-0" />}
                    {isGenset && <Fuel size={13} className="text-purple-500 shrink-0" />}
                    <span className="text-[7px] sm:text-[7.5px] font-bold text-slate-800 dark:text-slate-200 block truncate leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition" title={src.name}>
                      {src.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] font-black font-mono text-slate-900 dark:text-slate-100 leading-none">
                    {srcKw.toFixed(1)} <span className="text-[7px] font-sans text-slate-400">kW</span>
                  </span>
                </div>
              )
            })}
          </div>

          {/* Distribution Feeder Busbar */}
          <div className="flex items-center justify-center relative my-0.5">
            <div className="w-full h-0.5 bg-slate-400 dark:bg-slate-600" />
            <div className="absolute px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[8.5px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              &#123; B2 Side Total 22 Breakers &#125;
            </div>
          </div>

          {/* 4 Rows of Breakers */}
          <div className="space-y-1 mt-1">
            {/* Row 1 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building2.row1 || []).map((b) => renderBreakerBox(b, 'B2'))}
            </div>
            {/* Row 2 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building2.row2 || []).map((b) => renderBreakerBox(b, 'B2'))}
            </div>
            {/* Row 3 (7 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building2.row3 || []).map((b) => renderBreakerBox(b, 'B2'))}
            </div>
            {/* Row 4 (3 boxes) */}
            <div className="grid grid-cols-7 gap-1">
              {(building2.row4 || []).map((b) => renderBreakerBox(b, 'B2'))}
              {/* 4 blank fillers to align properly */}
              <div className="col-span-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







/**
 * Self-Contained Executive Energy Flow Dashboard Component
 * 
 * Can be dropped into any React application.
 * 
 * Props:
 * - initialData: Optional initial telemetry object. If omitted, uses default single-line model.
 * - liveSimulation: Whether to tick simulation when not connected to real backend (default: true).
 * - showPreviewHeader: Whether to show top standalone preview title/theme bar (default: false).
 * - onBreakerSelect: Optional callback when a breaker node is clicked.
 */
export default function ExecutiveDashboard({
  initialData,
  liveSimulation = true,
  showPreviewHeader = false,
  onBreakerSelect,
  onRefresh,
}) {
  const [data, setData] = useState(() => initialData || INITIAL_FLOW_DATA)
  const [isLive, setIsLive] = useState(liveSimulation)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(3000)
  const [selectedNode, setSelectedNode] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark')
  })

  // Display Fit Zoom (default 85% for zero-scroll fit on office LCD screens & laptops)
  const [zoomPercent, setZoomPercent] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ems_exec_zoom') : null
    return saved ? Number(saved) : 85
  })

  const updateZoom = (val) => {
    const clamped = Math.max(60, Math.min(130, val))
    setZoomPercent(clamped)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ems_exec_zoom', clamped)
    }
  }

  const toggleTheme = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Sync isLive with liveSimulation prop
  useEffect(() => {
    setIsLive(liveSimulation)
  }, [liveSimulation])

  // Update data if parent passes new realData
  useEffect(() => {
    if (initialData) {
      setData(initialData)
    }
  }, [initialData])

  // Live simulation ticker (runs ONLY when live simulation is enabled and no real backend)
  useEffect(() => {
    if (!isLive) return
    const timer = setInterval(() => {
      setData((prev) => simulateFlowTick(prev))
    }, refreshIntervalMs)
    return () => clearInterval(timer)
  }, [isLive, refreshIntervalMs])

  // Handle node selection for drawer
  const handleSelectNode = (node, buildingCode) => {
    const detailed = generateBreakerDetails(node, buildingCode)
    setSelectedNode(detailed)
    onBreakerSelect?.(detailed)
  }

  // Toggle breaker trip simulation
  const handleToggleTrip = (nodeId) => {
    setData((prev) => {
      const toggleInRow = (row) =>
        row.map((item) =>
          item.id === nodeId
            ? { ...item, status: item.status === 'tripped' ? 'normal' : 'tripped', loadKw: item.status === 'tripped' ? 45.0 : 0.0 }
            : item
        )

      return {
        ...prev,
        building1: {
          ...prev.building1,
          row1: toggleInRow(prev.building1.row1),
          row2: toggleInRow(prev.building1.row2),
          row3: toggleInRow(prev.building1.row3),
          row4: toggleInRow(prev.building1.row4),
        },
        building2: {
          ...prev.building2,
          row1: toggleInRow(prev.building2.row1),
          row2: toggleInRow(prev.building2.row2),
          row3: toggleInRow(prev.building2.row3),
          row4: toggleInRow(prev.building2.row4),
        },
      }
    })

    setSelectedNode((prev) =>
      prev && prev.id === nodeId
        ? {
            ...prev,
            status: prev.status === 'tripped' ? 'normal' : 'tripped',
            loadKw: prev.status === 'tripped' ? 45.0 : 0.0,
            utilizationPercent: prev.status === 'tripped' ? 45 : 0,
          }
        : prev
    )
  }

  return (
    <div className={`flex flex-col justify-between w-full ${showPreviewHeader ? 'min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden bg-slate-50 dark:bg-slate-950 p-1.5 sm:p-2.5 gap-1.5' : 'space-y-2'}`}>
      {/* ─── OPTIONAL TOP PREVIEW HEADER ─── */}
      {showPreviewHeader && (
        <header className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Zap size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
                Energy Management System
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Executive Energy Flow Overview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Toggle Dark / Light Theme"
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>
      )}

      {/* ─── EXECUTIVE DASHBOARD HEADER & CONTROLS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
              Executive Dashboard
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Energy Flow Overview
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
            Real-time dual-building power distribution network for <strong className="text-slate-700 dark:text-slate-300">Building 1 (Ambition)</strong> and <strong className="text-slate-700 dark:text-slate-300">Building 2 (AFL)</strong>.
          </p>
        </div>

        {/* Action & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom / Screen Fit Controller */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs gap-1 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 hidden sm:inline">
              Fit:
            </span>
            <button
              type="button"
              onClick={() => updateZoom(zoomPercent - 5)}
              disabled={zoomPercent <= 60}
              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="Zoom Out (Fit smaller screens)"
            >
              <Minus size={12} />
            </button>
            <button
              type="button"
              onClick={() => updateZoom(zoomPercent === 85 ? 100 : 85)}
              className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition cursor-pointer ${
                zoomPercent === 85
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Click to toggle between 85% (Screen Fit) and 100%"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={() => updateZoom(zoomPercent + 5)}
              disabled={zoomPercent >= 130}
              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="Zoom In"
            >
              <Plus size={12} />
            </button>
            <button
              type="button"
              onClick={() => updateZoom(85)}
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                zoomPercent === 85
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Reset to 85% (Default Zero-Scroll Fit)"
            >
              Fit Screen
            </button>
          </div>

          {/* TV Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shadow-2xs"
            title="Toggle Office TV / LCD Wall Monitor Fullscreen (Zero Scroll)"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Exit TV Mode' : '⛶ Office TV Mode'}
          </button>

          {/* Live Telemetry Status vs Simulation Controls */}
          {!liveSimulation ? (
            <>
              <div
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-2xs"
                title="Real-time telemetry stream active from plant"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Telemetry
              </div>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shadow-2xs"
                  title="Refresh telemetry now"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsLive((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  isLive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isLive ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <Pause size={12} /> Live Running
                  </>
                ) : (
                  <>
                    <Play size={12} /> Paused
                  </>
                )}
              </button>

              <select
                value={refreshIntervalMs}
                onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 py-1 px-1.5 text-xs font-bold"
                disabled={!isLive}
              >
                <option value={1000}>1s Tick</option>
                <option value={3000}>3s Tick</option>
                <option value={5000}>5s Tick</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* ─── FLOW OVERVIEW DISPLAY ─── */}
      <div
        className="w-full flex-1 transition-all duration-150 origin-top flex flex-col justify-start"
        style={{ zoom: `${zoomPercent}%` }}
      >
        <EnergyFlowOverview data={data} onSelectNode={handleSelectNode} />
      </div>

      {/* ─── BREAKER TELEMETRY SLIDE-OVER DRAWER ─── */}
      <BreakerTelemetryDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onToggleTrip={handleToggleTrip}
      />
    </div>
  )
}
