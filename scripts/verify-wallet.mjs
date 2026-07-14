// ============================================================================
// scripts/verify-wallet.mjs — Verify mnemonic → address derivation + balance
// ============================================================================
import { mnemonicToSeed } from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const MNEMONIC = 'pumpkin divert spend later token student spot faint collect visual carbon matter'
const EXPECTED_ADDR = 'octGXi34vZfYwi3idjSa6m34vLJCoJHNMNAGeHyqh7JVEvy'
const RPC = 'https://devnet.octrascan.io/rpc'

async function sha256(data) {
  const hashBuf = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  return new Uint8Array(hashBuf)
}

async function deriveAddr(mnemonic) {
  const seed = await mnemonicToSeed(mnemonic)
  const derived = derivePath("m/44'/858'/0'/0'", seed.toString('hex'))
  const kp = nacl.sign.keyPair.fromSeed(derived.key)
  const h = await sha256(kp.publicKey)
  let b58 = bs58.encode(Buffer.from(h))
  while (b58.length < 44) b58 = '1' + b58
  return { addr: 'oct' + b58, publicKey: kp.publicKey, secretKey: kp.secretKey }
}

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

const { addr, publicKey, secretKey } = await deriveAddr(MNEMONIC)
console.log('Derived address:', addr)
console.log('Expected addr: ', EXPECTED_ADDR)
console.log('Match:', addr === EXPECTED_ADDR ? '✓ YES' : '✗ NO')

if (addr !== EXPECTED_ADDR) {
  // Try alternative derivation paths
  console.log('\nTrying alternative derivation paths...')
  const seed = await mnemonicToSeed(MNEMONIC)
  const paths = [
    "m/44'/858'/0'",
    "m/44'/858'/0'/0'/0'",
    "m/44'/0'/0'/0'",
    "m/44'/0'/0'/0'/0'",
  ]
  for (const p of paths) {
    try {
      const d = derivePath(p, seed.toString('hex'))
      const kp = nacl.sign.keyPair.fromSeed(d.key)
      const h = await sha256(kp.publicKey)
      let b58 = bs58.encode(Buffer.from(h))
      while (b58.length < 44) b58 = '1' + b58
      const a = 'oct' + b58
      console.log(`  ${p}: ${a} ${a === EXPECTED_ADDR ? '✓ MATCH' : ''}`)
    } catch (e) {
      console.log(`  ${p}: ERROR ${e.message}`)
    }
  }

  // Also try without HD (raw seed)
  console.log('\nTrying raw seed (no HD):')
  const rawKp = nacl.sign.keyPair.fromSeed(seed.slice(0, 32))
  const rawH = await sha256(rawKp.publicKey)
  let rawB58 = bs58.encode(Buffer.from(rawH))
  while (rawB58.length < 44) rawB58 = '1' + rawB58
  console.log(`  raw: oct${rawB58} ${'oct' + rawB58 === EXPECTED_ADDR ? '✓ MATCH' : ''}`)

  process.exit(1)
}

// Check balance
console.log('\n--- Devnet balance check ---')
try {
  const bal = await rpcCall('octra_balance', [addr])
  console.log('Balance:', bal.balance, 'OCT (raw:', bal.balance_raw, 'OU)')
  console.log('Nonce:', bal.nonce, '| Pending nonce:', bal.pending_nonce)
  console.log('Has public key:', bal.has_public_key)
} catch (e) {
  console.log('Balance check failed:', e.message)
}

// Check node status
console.log('\n--- Node status ---')
try {
  const ns = await rpcCall('node_status', [])
  console.log('Network version:', ns.network_version)
  console.log('Current epoch:', ns.current_epoch)
  console.log('Validator:', ns.validator)
} catch (e) {
  console.log('Node status failed:', e.message)
}

// Check recommended fee for deploy
console.log('\n--- Recommended fee ---')
try {
  const f = await rpcCall('octra_recommendedFee', ['deploy'])
  console.log('Deploy fee (min/base/rec/fast):', f.minimum, '/', f.base_fee, '/', f.recommended, '/', f.fast)
} catch (e) {
  console.log('Fee check failed:', e.message)
}
