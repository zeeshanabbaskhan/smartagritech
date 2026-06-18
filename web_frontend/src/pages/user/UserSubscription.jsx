import { CreditCard, Calendar, Building2, Cpu, CheckCircle } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useAuth } from '../../context/AuthContext'
import emsApi, { list } from '../../api/emsApi'
import { mapSubscriptionUi } from '../../utils/mappers'

export default function UserSubscription() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getSubscriptions({ limit: 50 })
    const rows = list(res).map((s) => mapSubscriptionUi(s, user?.organization?.name))
    const current = rows.find((s) => s.email === user?.email) ?? rows[0] ?? null
    return { current, history: rows }
  }, [user?.email, user?.organization?.name])

  const current = data?.current
  const history = data?.history ?? []

  const columns = [
    { key: 'plan', label: 'Plan' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'description', label: 'Notes' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">My Subscription</h2>
            <p className="breadcrumb">User / Subscription</p>
          </div>
        </div>

        {current ? (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
                  <CreditCard size={22} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-surface-900">{current.plan}</h3>
                  <p className="text-sm text-surface-400">Current Plan</p>
                </div>
              </div>
              <span className="badge badge-success flex items-center gap-1"><CheckCircle size={11} /> {current.status}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-surface-500 mb-1"><Building2 size={13} /><span className="text-xs uppercase tracking-wide">Organization</span></div>
                <p className="text-sm font-medium text-surface-900">{current.org}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-surface-500 mb-1"><Calendar size={13} /><span className="text-xs uppercase tracking-wide">Submitted</span></div>
                <p className="text-sm font-medium text-surface-900">{current.startDate}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-surface-500 mb-1"><Calendar size={13} /><span className="text-xs uppercase tracking-wide">Email</span></div>
                <p className="text-sm font-medium text-surface-900">{current.email}</p>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-surface-500 mb-1"><Cpu size={13} /><span className="text-xs uppercase tracking-wide">Phone</span></div>
                <p className="text-sm font-medium text-surface-900">{current.phone}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-surface-500 text-sm">No subscription records found.</div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-surface-700 mb-3">Subscription History</h3>
          <DataTable columns={columns} data={history} searchable={false} pageSize={10} emptyMessage="No subscription history" />
        </div>
      </div>
    </PageState>
  )
}
