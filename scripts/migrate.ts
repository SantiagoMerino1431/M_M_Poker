import { migrate } from "../src/lib/db/schema"

async function run() {
  console.log("[migrate] Ejecutando migraciones...")
  await migrate()
  console.log("[migrate] Completado")
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
