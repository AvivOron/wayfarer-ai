import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

export const prisma: PrismaClient = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
