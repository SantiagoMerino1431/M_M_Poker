import { migrate } from "../src/lib/db/schema"
import { initBankroll } from "../src/lib/kelly/bankroll"

async function run() {
  await migrate()
  await initBankroll()
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
