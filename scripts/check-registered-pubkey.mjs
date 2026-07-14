// ============================================================================
// scripts/check-registered-pubkey.mjs — Check registered pubkey on-chain
// ============================================================================
const RPC = 'https://devnet.octrascan.io/rpc'
const ADDR = 'octGXi34vZfYwi3idjSa6m34vLJCoJHNMNAGeHyqh7JVEvy'

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`)
  return json.result
}

// Try various methods to learn the pubkey
console.log('Address:', ADDR)
console.log('Address length:', ADDR.length)
console.log('First 3 chars:', ADDR.substring(0, 3))
console.log('Body (after oct):', ADDR.substring(3))
console.log('Body length:', ADDR.substring(3).length)

// Check balance (also gives pubkey status)
console.log('\n--- octra_balance ---')
const bal = await rpcCall('octra_balance', [ADDR])
console.log(JSON.stringify(bal, null, 2))

// Try to get the registered public key
console.log('\n--- octra_publicKey ---')
try {
  const pk = await rpcCall('octra_publicKey', [ADDR])
  console.log('Public key (b64):', pk.public_key || pk)
  console.log('Full result:', JSON.stringify(pk, null, 2))
} catch (e) {
  console.log('Failed:', e.message)
}

// Validate address format
console.log('\n--- octra_validateAddress ---')
try {
  const v = await rpcCall('octra_validateAddress', [ADDR])
  console.log('Valid:', JSON.stringify(v))
} catch (e) {
  console.log('Failed:', e.message)
}

// Account info
console.log('\n--- octra_account ---')
try {
  const acc = await rpcCall('octra_account', [ADDR, 10])
  console.log(JSON.stringify(acc, null, 2))
} catch (e) {
  console.log('Failed:', e.message)
}

// Node version
console.log('\n--- node_version ---')
const nv = await rpcCall('node_version', [])
console.log(JSON.stringify(nv, null, 2))
