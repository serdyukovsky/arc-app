import cron from 'node-cron'
import { authenticate } from './pb-client.js'
import { tick } from './scheduler.js'

async function main() {
  console.log('[arc-notifications] Starting...')

  const authenticated = await authenticate()
  if (!authenticated) {
    console.error('[arc-notifications] Failed to authenticate with PocketBase. Exiting.')
    process.exit(1)
  }

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await tick()
    } catch (err) {
      console.error('[arc-notifications] Tick error:', err)
    }
  })

  console.log('[arc-notifications] Scheduler running (every minute)')

  // Also run once immediately
  tick().catch((err) => console.error('[arc-notifications] Initial tick error:', err))
}

main()
