import { PrismaClient } from '@prisma/client'

// On Vercel’s serverless you don’t want to create a new PrismaClient on every invocation.
// Use a global to reuse the client in development.

type GlobalWithPrisma = typeof global & { prisma?: PrismaClient }
const globalWithPrisma = global as GlobalWithPrisma

const prisma =
  globalWithPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error'],  // optional: helps you see what’s going on
  })

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma.prisma = prisma
}

export default prisma
