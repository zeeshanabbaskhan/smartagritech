import { useState } from 'react'
import { CheckCircle2, Zap } from 'lucide-react'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapProduct, mapSubscriptionUi } from '../../utils/mappers'

const planDetails = {
  'Basic EMS': { price: 'PKR 5,000/mo', description: 'Perfect for small operations needing essential monitoring.', features: ['Up to 5 devices', 'Real-time monitoring', 'Email alerts', 'Basic analytics', '7-day data retention'], color: 'info' },
  Professional: { price: 'PKR 15,000/mo', description: 'Ideal for medium-scale industrial energy monitoring.', features: ['Up to 20 devices', 'Advanced analytics', 'AI insights', 'SMS & WhatsApp alerts', 'Power quality analysis', '90-day data retention'], color: 'primary' },
  Enterprise: { price: 'PKR 40,000/mo', description: 'Full-scale solution for large industrial facilities.', features: ['Unlimited devices', 'Multi-site support', 'Custom reports', 'API access', 'Priority support', '1-year data retention'], color: 'warning' },
  Trial: { price: 'Free', description: 'Explore all features for 14 days, no commitment needed.', features: ['Up to 2 devices', 'All features included', '14-day access', 'Email support', 'Sample data included'], color: 'success' },
}

const colorMap = {
  primary: { border: 'border-primary-500/40', badge: 'bg-primary-600/20 text-primary-600', btn: 'btn-primary', header: 'text-primary-600' },
  info: { border: 'border-info-500/30', badge: 'bg-info-600/20 text-info-600', btn: 'btn-secondary', header: 'text-info-600' },
  warning: { border: 'border-warning-500/30', badge: 'bg-warning-600/20 text-primary-600', btn: 'btn-secondary', header: 'text-primary-600' },
  success: { border: 'border-success-500/30', badge: 'bg-success-600/20 text-success-600', btn: 'btn-secondary', header: 'text-success-600' },
}

function matchCurrentPlan(product, subscription) {
  if (!subscription || !product) return false
  const plan = String(subscription.plan ?? subscription.name ?? '').toLowerCase()
  const name = String(product.name ?? '').toLowerCase()
  if (!plan || !name) return false
  return plan === name || plan.includes(name) || name.includes(plan)
}

export default function UserProducts() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [subscribingId, setSubscribingId] = useState(null)

  const { data, loading, error, reload } = useFetch(async () => {
    const [productsRes, subsRes] = await Promise.all([
      emsApi.getProducts({ limit: 100 }),
      emsApi.getSubscriptions({ limit: 50 }).catch(() => ({ data: [] })),
    ])
    const products = list(productsRes).map(mapProduct).filter((p) => p.status === 'Active')
    const subscriptions = list(subsRes).map((s) => mapSubscriptionUi(s, user?.organization?.name))
    const current = subscriptions.find((s) => s.status === 'Active' || s.status === 'Pending')
      ?? subscriptions[0]
      ?? null
    return { products, current }
  }, [user?.organization?.name, user?.email])

  const handleSubscribe = async (product) => {
    if (!user?.email) {
      showToast('Sign in required to subscribe', 'error')
      return
    }
    setSubscribingId(product.id)
    try {
      await emsApi.submitSubscription({
        name: product.name,
        email: user.email,
        phone: user.phone ?? undefined,
        description: product.description || `Subscription request for ${product.name}`,
        organizationId: user.organizationId || undefined,
      })
      showToast(`Subscription request for ${product.name} submitted`, 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Subscribe failed', 'error')
    } finally {
      setSubscribingId(null)
    }
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Subscription Plans</h2>
            <p className="breadcrumb">User / Products</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(data?.products ?? []).map((product) => {
            const detail = planDetails[product.name] || {}
            const colors = colorMap[detail.color || 'info']
            const isCurrent = matchCurrentPlan(product, data?.current)
            const busy = subscribingId === product.id
            return (
              <div key={product.id} className={`card flex flex-col relative border-2 ${isCurrent ? colors.border : 'border-surface-200'} transition-all`}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge badge-success text-xs px-3 py-1 shadow-lg flex items-center gap-1"><Zap size={10} /> Current Plan</span>
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-4">
                    <h3 className={`text-base font-bold ${colors.header} mb-1`}>{product.name}</h3>
                    <p className="text-2xl font-bold text-surface-900">{detail.price || product.price}</p>
                    <p className="text-xs text-surface-400 mt-2 leading-relaxed">{detail.description || product.description}</p>
                  </div>
                  <ul className="space-y-2 mb-5 flex-1">
                    {(detail.features || [product.description]).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-surface-700">
                        <CheckCircle2 size={13} className={`${colors.header} flex-shrink-0 mt-0.5`} />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`w-full ${colors.btn} justify-center ${isCurrent ? 'opacity-60 cursor-not-allowed' : ''}`}
                    disabled={isCurrent || busy}
                    onClick={() => !isCurrent && handleSubscribe(product)}
                  >
                    {isCurrent ? 'Current Plan' : busy ? 'Submitting…' : 'Subscribe'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageState>
  )
}
