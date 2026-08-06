import {
  Check, CreditCard, Smartphone, Radio, Bell, Globe, Lock, Users, HelpCircle, LogOut, Car, Gem,
} from 'lucide-react'
import { C, Pill, EvCard, SL, badges } from './evShared'

export default function EvProfile() {
  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">Profile</h2>
        <p className="text-xs text-surface-500 mt-0.5">Driver profile, vehicle, payments, achievements, and settings.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-3.5">
          <EvCard className="text-center !p-7 bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/40 dark:to-surface-900">
            <div className="relative inline-block mb-3.5">
              <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-[30px] text-white font-extrabold mx-auto">
                AJ
              </div>
              <div className="absolute bottom-0 -right-0.5 bg-success-500 rounded-full w-[18px] h-[18px] border-[3px] border-white dark:border-surface-900 flex items-center justify-center">
                <Check size={9} className="text-white" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-surface-900 dark:text-surface-100">Alex Johnson</div>
            <div className="text-xs text-surface-500 mt-0.5">alex.johnson@email.com</div>
            <div className="mt-2.5 flex gap-1.5 justify-center flex-wrap">
              <Pill label="💎 PLATINUM" color={C.purple} />
              <Pill label="134 sessions" color={C.textMuted} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { val: '134', label: 'Sessions' },
                { val: '1.1t', label: 'CO₂ Saved' },
                { val: '2,841', label: 'kWh Total' },
              ].map((m) => (
                <div key={m.label} className="rounded-[10px] py-2.5 border bg-white/80 dark:bg-surface-950 border-surface-100 dark:border-surface-800">
                  <div className="text-lg font-extrabold text-primary-600">{m.val}</div>
                  <div className="text-[10px] text-surface-500">{m.label}</div>
                </div>
              ))}
            </div>
          </EvCard>

          <EvCard>
            <SL>My Vehicle</SL>
            <div className="flex justify-between items-center mb-2.5 gap-2">
              <div className="flex gap-2.5 items-center">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                  <Car size={20} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-surface-900 dark:text-surface-100">Tesla Model 3 LR</div>
                  <div className="text-[11px] text-surface-500">2023 · 75 kWh · NACS + CCS</div>
                </div>
              </div>
              <Pill label="ACTIVE" color={C.green} small />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Range (Full)', val: '340 mi' },
                { label: 'Max DC', val: '250 kW' },
                { label: 'Battery Health', val: '97%' },
                { label: 'Max AC', val: '11 kW' },
              ].map((v) => (
                <div key={v.label} className="rounded-[9px] px-2.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800">
                  <div className="text-[13px] font-bold text-surface-900 dark:text-surface-100">{v.val}</div>
                  <div className="text-[10px] text-surface-500">{v.label}</div>
                </div>
              ))}
            </div>
          </EvCard>

          <EvCard>
            <SL>Payment Methods</SL>
            {[
              { name: 'Visa •••• 4921', Icon: CreditCard, isDefault: true },
              { name: 'Apple Pay', Icon: Smartphone, isDefault: false },
              { name: 'RFID Card #A4', Icon: Radio, isDefault: false },
            ].map((p, i) => (
              <div
                key={p.name}
                className={`flex justify-between items-center py-2.5 ${i < 2 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}
              >
                <div className="flex gap-2.5 items-center">
                  <p.Icon size={16} className="text-surface-500" />
                  <span className="text-[13px] font-medium text-surface-800 dark:text-surface-200">{p.name}</span>
                </div>
                {p.isDefault ? (
                  <Pill label="DEFAULT" color={C.green} small />
                ) : (
                  <button type="button" className="text-[11px] text-primary-600 font-semibold hover:underline">Set default</button>
                )}
              </div>
            ))}
          </EvCard>
        </div>

        <div className="space-y-3.5">
          <EvCard>
            <SL right={`${earnedCount}/${badges.length} earned`}>Achievements</SL>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {badges.map((b) => (
                <div
                  key={b.label}
                  className={`rounded-xl p-3.5 text-center border ${b.earned ? '' : 'opacity-50'}`}
                  style={{
                    background: b.earned ? `${b.color}08` : undefined,
                    borderColor: b.earned ? `${b.color}30` : undefined,
                  }}
                >
                  <div className={`text-[28px] ${b.earned ? '' : 'grayscale'}`}>{b.icon}</div>
                  <div className={`text-xs font-bold mt-1.5 ${b.earned ? 'text-surface-900 dark:text-surface-100' : 'text-surface-500'}`}>{b.label}</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">{b.sub}</div>
                  {b.earned && (
                    <div className="text-[9px] font-bold mt-1.5" style={{ color: b.color }}>EARNED ✓</div>
                  )}
                </div>
              ))}
            </div>
          </EvCard>

          <EvCard className="bg-gradient-to-br from-violet-50 to-sky-50 dark:from-violet-950/30 dark:to-sky-950/20 border-violet-200/60 dark:border-violet-800/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <Pill label="💎 PLATINUM MEMBER" color={C.purple} />
                <div className="text-[15px] font-bold text-surface-900 dark:text-surface-100 mt-2 inline-flex items-center gap-1.5">
                  <Gem size={15} className="text-violet-600" /> All Benefits Active
                </div>
                <div className="text-xs text-surface-500 mt-0.5">Roaming on 350,000+ stations · 18% avg discount</div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {['Plug & Charge', 'Priority Support', 'Roaming', 'V2G Access', 'AI Smart Schedule'].map((b) => (
                    <Pill key={b} label={b} color={C.purple} small />
                  ))}
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-[28px] font-extrabold text-violet-600">
                  $7<span className="text-sm">/mo</span>
                </div>
                <div className="text-[10px] text-surface-500">renews Jun 30</div>
              </div>
            </div>
          </EvCard>

          <EvCard className="!p-0 overflow-hidden">
            <div className="px-[18px] pt-[18px]"><SL>Settings</SL></div>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {[
                { label: 'Notifications & Alerts', Icon: Bell },
                { label: 'Roaming Networks', Icon: Globe },
                { label: 'Privacy & Security', Icon: Lock },
                { label: 'Refer a Friend', Icon: Users },
                { label: 'Help & Support', Icon: HelpCircle },
                { label: 'Sign Out', Icon: LogOut, danger: true },
              ].map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  className={`flex justify-between items-center px-4 py-3 text-left border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                    i % 2 === 0 ? 'sm:border-r' : ''
                  } border-b`}
                >
                  <span className={`text-[13px] inline-flex items-center gap-2 ${s.danger ? 'text-danger-600' : 'text-surface-800 dark:text-surface-200'}`}>
                    <s.Icon size={14} /> {s.label}
                  </span>
                  {!s.danger && <span className="text-surface-400 text-sm">›</span>}
                </button>
              ))}
            </div>
          </EvCard>
        </div>
      </div>
    </div>
  )
}
