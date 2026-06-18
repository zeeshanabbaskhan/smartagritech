// Prisma client singleton — pg pool with optional read replica (P-31, P-32, P-30).
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const poolOpts = (url) => ({
  connectionString: url,
  max:                     parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis:       parseInt(process.env.DB_POOL_IDLE_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_TIMEOUT_MS || '10000', 10),
})

const pool = new Pool(poolOpts(process.env.DATABASE_URL))
const adapter = new PrismaPg(pool)

const logLevel = process.env.PRISMA_LOG_QUERIES === 'true'
  ? ['query', 'error', 'warn']
  : ['error', 'warn']

const prisma = new PrismaClient({ adapter, log: logLevel })

let prismaRead = prisma
if (process.env.DATABASE_READ_URL) {
  const readPool = new Pool(poolOpts(process.env.DATABASE_READ_URL))
  prismaRead = new PrismaClient({ adapter: new PrismaPg(readPool), log: logLevel })
  console.log('Read replica client configured (DATABASE_READ_URL)')
}

module.exports = prisma
module.exports.pool = pool
module.exports.read = prismaRead
