import { defineConfig } from 'prisma/config'
import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
  migrate: {
    async adapter(env: Record<string, string | undefined>) {
      const pool = new Pool({ connectionString: env.DIRECT_DATABASE_URL ?? env.DATABASE_URL })
      return new PrismaNeon(pool)
    },
  },
})
