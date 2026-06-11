import { db } from "../src/lib/db/client"

async function main() {
  const r = await db.execute("DELETE FROM bets WHERE mode = 'paper'")
  console.log(`Deleted ${r.rowsAffected} paper bets`)
}

main().catch(err => { console.error(err); process.exit(1) })
