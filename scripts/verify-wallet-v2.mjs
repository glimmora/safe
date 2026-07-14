// ============================================================================
// scripts/verify-wallet-v2.mjs — Verify with Octra's actual derivation scheme
// ============================================================================
import { mnemonicToSeed, entropyToMnemonic, validateMnemonic } from 'bip39'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { createHmac } from 'crypto'

const MNEMONIC = 'pumpkin divert spend later token student spot faint collect visual carbon matter'
const EXPECTED_ADDR = 'octGXi34vZfYwi3idjSa6m34vLJCoJHNMNAGeHyqh7JVEvy'

async function sha256(data) {
  const hashBuf = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  return new Uint8Array(hashBuf)
}

// Octra derivation (from wallet.octra.org source code):
//   1. seed = BIP-39 mnemonicToSeed(mnemonic)  // 64 bytes
//   2. derived = HMAC-SHA512(key="Octra seed", data=seed)  // 64 bytes
//   3. ed25519_seed = derived.slice(0, 32)
//   4. kp = nacl.sign.keyPair.fromSeed(ed25519_seed)
//   5. address = "oct" + base58(sha256(kp.publicKey))
async function deriveAddrOctra(mnemonic) {
  const seed = await mnemonicToSeed(mnemonic)  // 64 bytes Buffer
  const hmac = createHmac('sha512', 'Octra seed')
  hmac.update(seed)
  const derived = hmac.digest()  // 64 bytes Buffer
  const ed25519Seed = derived.subarray(0, 32)
  const kp = nacl.sign.keyPair.fromSeed(ed25519Seed)
  const h = await sha256(kp.publicKey)
  let b58 = bs58.encode(Buffer.from(h))
  while (b58.length < 44) b58 = '1' + b58
  return {
    addr: 'oct' + b58,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    ed25519Seed,
    seed,
  }
}

// Validate mnemonic first
console.log('Mnemonic:', MNEMONIC)
console.log('Valid:', validateMnemonic(MNEMONIC))

const result = await deriveAddrOctra(MNEMONIC)
console.log('\n--- Derived (Octra scheme) ---')
console.log('Address:    ', result.addr)
console.log('Expected:   ', EXPECTED_ADDR)
console.log('Match:', result.addr === EXPECTED_ADDR ? '✓ YES' : '✗ NO')

if (result.addr === EXPECTED_ADDR) {
  console.log('\n--- Keypair (do NOT share) ---')
  console.log('Public key (hex):', Buffer.from(result.publicKey).toString('hex'))
  console.log('Public key (b64):', Buffer.from(result.publicKey).toString('base64'))
  console.log('Secret key (hex):', Buffer.from(result.secretKey).toString('hex'))
  console.log('Secret key (b64):', Buffer.from(result.secretKey).toString('base64'))
  console.log('ed25519 seed (b64):', Buffer.from(result.ed25519Seed).toString('base64'))
} else {
  process.exit(1)
}
