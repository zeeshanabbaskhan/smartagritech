import { DollarSign, Zap, Info, Calculator } from 'lucide-react'
import { TextInput, SelectInput } from '../ui/FormFields'

export default function TariffsSavingsConfig({
  savings = {},
  onChange,
  readOnly = false,
}) {
  const currentRate = savings?.tariffRate ?? 28
  const currentUnit = savings?.unit || 'PKR'
  const currentDailyBaseline = savings?.dailyBaseline ?? ''
  const currentMonthlyBaseline = savings?.monthlyBaseline ?? ''

  const updateField = (field, value) => {
    if (readOnly) return
    onChange?.({
      ...savings,
      [field]: value,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <DollarSign size={18} className="text-primary-600" />
            Electricity Tariff & Savings Baseline
          </h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Configure the energy tariff rate used to compute solar cost-avoidance savings and real-time grid electricity expenditures.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tariff Rate Settings */}
        <div className="p-4 rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-100 dark:border-surface-800">
            <Calculator size={16} className="text-primary-600" />
            <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">
              Utility Tariff Rate
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold mb-1">Currency Unit</label>
              <SelectInput
                value={currentUnit}
                disabled={readOnly}
                onChange={(e) => updateField('unit', e.target.value)}
                options={[
                  { value: 'PKR', label: 'PKR (Pakistani Rupee)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'AED', label: 'AED (Dirham)' },
                  { value: 'SAR', label: 'SAR (Riyal)' },
                ]}
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">Rate per kWh ({currentUnit})</label>
              <TextInput
                type="number"
                step="0.5"
                min="0"
                placeholder="28"
                disabled={readOnly}
                value={currentRate}
                onChange={(e) => updateField('tariffRate', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40 text-xs text-surface-500 space-y-1">
            <p className="font-semibold text-surface-700 dark:text-surface-300">Formulas Applied:</p>
            <p>• <strong>Solar Cost Avoidance</strong> = Solar Generated kWh × {currentRate} {currentUnit}/kWh</p>
            <p>• <strong>Grid Import Cost</strong> = WAPDA / Grid kWh × {currentRate} {currentUnit}/kWh</p>
          </div>
        </div>

        {/* Energy Baselines */}
        <div className="p-4 rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-100 dark:border-surface-800">
            <Zap size={16} className="text-amber-500" />
            <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">
              Target Consumption Baselines (Optional)
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs font-bold mb-1">Daily Target (kWh)</label>
              <TextInput
                type="number"
                step="10"
                min="0"
                placeholder="e.g. 2500"
                disabled={readOnly}
                value={currentDailyBaseline}
                onChange={(e) => updateField('dailyBaseline', e.target.value ? Number(e.target.value) : '')}
              />
            </div>

            <div>
              <label className="label text-xs font-bold mb-1">Monthly Target (kWh)</label>
              <TextInput
                type="number"
                step="100"
                min="0"
                placeholder="e.g. 75000"
                disabled={readOnly}
                value={currentMonthlyBaseline}
                onChange={(e) => updateField('monthlyBaseline', e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40 text-xs text-surface-500 flex items-start gap-2">
            <Info size={14} className="text-primary-600 flex-shrink-0 mt-0.5" />
            <p>
              Baselines allow comparison between projected factory targets and live telemetry to track energy efficiency savings over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
