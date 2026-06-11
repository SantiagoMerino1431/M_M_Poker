import { createClient, type Client } from "@libsql/client"

// globalThis survives Next.js hot reloads; prevents duplicate client instances
const g = globalThis as typeof globalThis & { __mmdb?: Client }

function getInstance(): Client {
  if (!g.__mmdb) {
    g.__mmdb = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return g.__mmdb
}

export const db: Client = new Proxy({} as Client, {
  get(_, prop: string | symbol) {
    const instance = getInstance()
    const value = (instance as any)[prop as string]
    // Bind methods so `this` inside execute() etc. is the real Client instance
    return typeof value === "function" ? value.bind(instance) : value
  },
})
