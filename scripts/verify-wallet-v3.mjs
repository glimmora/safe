// ============================================================================
// scripts/verify-wallet-v3.mjs — Verify wallet with js-sha256 (matching signer.ts)
// ============================================================================
import { mnemonicToSeed } from 'bip39'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { createHmac } from 'crypto'
import { sha256 } from 'js-sha256'

const MNEMONIC = 'pumpkin divert spend later token student spot faint collect visual carbon matter'
const EXPECTED_ADDR = 'octGXi34vZfYwi3idjSa6m34vLJCoJHNMNAGeHyqh7JVEvy'

// Octra derivation:
//   1. seed = BIP-39 mnemonicToSeed(mnemonic)         // 64 bytes
//   2. derived = HMAC-SHA512(key="Octra seed", seed)  // 64 bytes
//   3. ed25519_seed = derived.slice(0, 32)
//   4. kp = nacl.sign.keyPair.fromSeed(ed25519_seed)
//   5. address = "oct" + base58(sha256(public_key))   // SHA-256, not SHA-512
function deriveAddrOctra(mnemonic) {
  const seed = mnemonicToSeed(mnemonic)  // Returns Buffer (sync in v3.x? actually returns Promise in v3+)
  return seed
}

const seedBuffer = await mnemonicToSeed(MNEMONIC)
const hmac = createHmac('sha512', 'Octra seed')
hmac.update(seedBuffer)
const derived = hmac.digest()
const ed25519Seed = derived.subarray(0, 32)
const kp = nacl.sign.keyPair.fromSeed(ed25519Seed)

// SHA-256 of pubkey
const h = new Uint8Array(sha256.arrayBuffer(kp.publicKey))
let b58 = bs58.encode(Buffer.from(h))
while (b58.length < 44) b58 = '1' + b58
const addr = 'oct' + b58

console.log('Derived address:', addr)
console.log('Expected addr: ', EXPECTED_ADDR)
console.log('Match:', addr === EXPECTED_ADDR ? '✓ YES' : '✗ NO')

if (addr === EXPECTED_ADDR) {
  console.log('\n✓ signer.ts addressFromPublicKeySync now uses SHA-256 (correct)')
} else {
  console.log('\n✗ Mismatch — investigate further')
  process.exit(1)
}
