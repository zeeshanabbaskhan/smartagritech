const { load } = require('./dataLoader')
load()

const billingTools = require('./billingTools')

console.log('--- DIRECT TOOL TESTING ---')

console.log('\n1. getMonthlyBill (Riverdale last month):')
console.log(JSON.stringify(billingTools.getMonthlyBill({ orgName: 'Riverdale Manufacturing', monthOffset: 1 }), null, 2))

console.log('\n2. compareMonthlyBills (Riverdale):')
console.log(JSON.stringify(billingTools.compareMonthlyBills({ orgName: 'Riverdale Manufacturing' }), null, 2))

console.log('\n3. getTopConsumingDevices (Riverdale 30d):')
console.log(JSON.stringify(billingTools.getTopConsumingDevices({ orgName: 'Riverdale Manufacturing', periodDays: 30 }), null, 2))

console.log('\n4. getDailyConsumptionBreakdown (Riverdale 30d):')
const daily = billingTools.getDailyConsumptionBreakdown({ orgName: 'Riverdale Manufacturing', periodDays: 30 })
console.log('Top Days:', JSON.stringify(daily.topDays, null, 2))

console.log('\n5. forecastMonthlyBill (Greenfield):')
console.log(JSON.stringify(billingTools.forecastMonthlyBill({ orgName: 'Greenfield Energy Co' }), null, 2))

console.log('\n6. getPowerFactorImpact (Greenfield):')
console.log(JSON.stringify(billingTools.getPowerFactorImpact({ orgName: 'Greenfield Energy Co' }), null, 2))

console.log('\n7. simulateConsumptionReduction (Cold Storage Meter 20%):')
console.log(JSON.stringify(billingTools.simulateConsumptionReduction({ orgName: 'Riverdale Manufacturing', deviceName: 'Cold Storage Meter', percentReduction: 20 }), null, 2))

console.log('\n8. getBudgetPlan (Greenfield target Rs 30000):')
console.log(JSON.stringify(billingTools.getBudgetPlan({ orgName: 'Greenfield Energy Co', targetAmountPKR: 30000 }), null, 2))
