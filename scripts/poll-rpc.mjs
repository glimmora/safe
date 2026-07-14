// ============================================================================
// scripts/poll-rpc.mjs — Poll devnet RPC until it's back up
// ============================================================================
const RPC = process.argv[2] || 'https://devnet.octrascan.io/rpc'
const MAX_ATTEMPTS = parseInt(process.argv[3] || '30', 10)
const DELAY_MS = 10000

console.log(`Polling ${RPC} every ${DELAY_MS/1000}s for up to ${MAX_ATTEMPTS} attempts...`)
console.log('Press Ctrl+C to stop.\n')

for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'node_status', params: [] }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (res.ok) {
      const json = await res.json()
      if (json.result) {
        console.log(`[${i}/${MAX_ATTEMPTS}] ✓ RPC IS UP!`)
        console.log('Network version:', json.result.network_version)
        console.log('Current epoch:', json.result.current_epoch)
        console.log('Validator:', json.result.validator)
        process.exit(0)
      } else if (json.error) {
        console.log(`[${i}/${MAX_ATTEMPTS}] RPC error:`, json.error.message)
      }
    } else {
      console.log(`[${i}/${MAX_ATTEMPTS}] HTTP ${res.status}`)
    }
  } catch (e) {
    console.log(`[${i}/${MAX_ATTEMPTS}] ${e.message}`)
  }
  if (i < MAX_ATTEMPTS) {
    await new Promise(r => setTimeout(r, DELAY_MS))
  }
}

console.log('\n❌ RPC did not come back up after', MAX_ATTEMPTS, 'attempts.')
console.log('Try again later or use a different RPC URL.')
process.exit(1)
