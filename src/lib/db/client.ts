import { createClient, type Client } from "@libsql/client"

let _instance: Client | undefined

function getInstance(): Client {
  if (!_instance) {
    _instance = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _instance
}

export const db: Client = new Proxy({} as Client, {
  get(_, prop: string | symbol) {
    return (getInstance() as any)[prop as string]
  },
})
