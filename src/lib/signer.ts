// ============================================================================
// lib/signer.ts — Octra ed25519 signer & address derivation
// ----------------------------------------------------------------------------
// Octra uses ED25519 (NOT secp256k1 used by Ethereum/MetaMask).
// MetaMask CANNOT sign Octra transactions — we must sign with ed25519 keys
// generated/imported in the browser (using tweetnacl-js).
//
// Address derivation (matches webcli wallet.hpp):
//   addr = "oct" + base58(sha256(ed25519_pubkey)) padded to 44 chars (total 47)
//
// Transaction signing (matches webcli tx_builder.hpp):
//   canonical_json = exact-field-order JSON of the tx (no signature/public_key fields)
//   signature = base64(ed25519_sign_detached(canonical_json_utf8, private_key))
//   public_key = base64(ed25519_pubkey)
// ============================================================================

import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { sha256 as sha256Sync } from 'js-sha256'
import type { OctraTx } from '@/types'
import { buildCanonicalTxJson } from './encoder'

// ===========================================================================
// SHA-256 helper — uses Web Crypto when available, falls back to js-sha256
// ===========================================================================

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  // Use Web Crypto if available (returns ArrayBuffer)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    const hashBuf = await crypto.subtle.digest('SHA-256', buf)
    return new Uint8Array(hashBuf)
  }
  // Fallback: js-sha256 (synchronous, browser-compatible)
  return new Uint8Array(sha256Sync.arrayBuffer(data))
}

// ===========================================================================
// Address & key derivation
// ===========================================================================

// Derive an Octra address from an ed25519 public key (32 bytes).
// Mirrors webcli/wallet.hpp `derive_address`:
//   h = sha256(pubkey)
//   b58 = base58(h) padded to 44 chars with leading "1"
//   addr = "oct" + b58
export async function addressFromPublicKey(publicKey: Uint8Array): Promise<string> {
  const h = await sha256Bytes(publicKey)
  let b58 = bs58.encode(h)
  while (b58.length < 44) b58 = '1' + b58
  return 'oct' + b58
}

// Synchronous version using js-sha256 (matches Web Crypto exactly).
// IMPORTANT: This is the correct algorithm (SHA-256), not SHA-512 truncated.
export function addressFromPublicKeySync(publicKey: Uint8Array): string {
  const h = new Uint8Array(sha256Sync.arrayBuffer(publicKey))
  let b58 = bs58.encode(h)
  while (b58.length < 44) b58 = '1' + b58
  return 'oct' + b58
}

// Generate a new ed25519 keypair.
export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.sign.keyPair()
}

// Sign a message with ed25519 (detached signature, 64 bytes).
export function signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey)
}

// Verify a detached signature.
export function verifyDetached(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  return nacl.sign.detached.verify(message, signature, publicKey)
}

// ===========================================================================
// Base64 helpers
// ===========================================================================

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
}

export function decodeBase64(b64: string): Uint8Array {
  return base64ToBytes(b64)
}

// ===========================================================================
// Transaction signing
// ===========================================================================

export interface SignedTx extends OctraTx {
  signature: string  // base64
  public_key: string // base64
}

// Sign an OctraTx and return a SignedTx ready for `octra_submit`.
// Mirrors webcli `sign_transaction`:
//   1. Build canonical JSON with exact field order
//   2. ed25519 sign the UTF-8 bytes
//   3. base64 encode signature & public key
//   4. Attach to tx
export function signTransaction(tx: OctraTx, secretKey: Uint8Array, publicKey: Uint8Array): SignedTx {
  const canonical = buildCanonicalTxJson(tx)
  const msgBytes = new TextEncoder().encode(canonical)
  const sig = signDetached(msgBytes, secretKey)
  return {
    ...tx,
    signature: bytesToBase64(sig),
    public_key: bytesToBase64(publicKey),
  }
}

// Convert SignedTx to the JSON object expected by `octra_submit` RPC.
// Field order matches webcli `submit_tx`:
//   from, to_, amount, nonce, ou, timestamp, signature, public_key, op_type,
//   encrypted_data, message
export function signedTxToSubmitPayload(tx: SignedTx): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: tx.from,
    to_: tx.to_,
    amount: tx.amount,
    nonce: tx.nonce,
    ou: tx.ou,
    timestamp: tx.timestamp,
    signature: tx.signature,
    public_key: tx.public_key,
  }
  if (tx.op_type) payload.op_type = tx.op_type
  if (tx.encrypted_data) payload.encrypted_data = tx.encrypted_data
  if (tx.message) payload.message = tx.message
  return payload
}

// ===========================================================================
// Wallet key management (browser-side, AES-GCM encrypted in localStorage)
// ===========================================================================

export interface EncryptedWallet {
  version: 1
  address: string
  publicKeyB64: string
  cipher: string       // base64
  iv: string           // base64
  salt: string         // base64
  mnemonicCipher?: string
  mnemonicIv?: string  // separate IV for mnemonic
  verifier: string     // base64
}

// Derive an AES-GCM key from password + salt using PBKDF2 (Web Crypto).
async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 150_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

// Encrypt the secret key with the password.
export async function encryptWallet(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  password: string,
  mnemonic?: string
): Promise<EncryptedWallet> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveAesKey(password, salt)

  const enc = new TextEncoder()

  // Encrypt secret key
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    secretKey as BufferSource
  )
  const cipherBytes = new Uint8Array(cipherBuf)

  // Verifier: encrypt a known plaintext so we can verify password later
  const verifierPlain = enc.encode('octra-safe-v1')
  const verifierBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    verifierPlain as BufferSource
  )
  const verifierBytes = new Uint8Array(verifierBuf)

  // Address
  const address = addressFromPublicKeySync(publicKey)

  let mnemonicCipher: string | undefined
  let mnemonicIv: string | undefined
  if (mnemonic) {
    const mnIv = randomBytes(12)
    const mnBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: mnIv as BufferSource },
      key,
      enc.encode(mnemonic) as BufferSource
    )
    mnemonicCipher = bytesToBase64(new Uint8Array(mnBuf))
    mnemonicIv = bytesToBase64(mnIv)
  }

  return {
    version: 1,
    address,
    publicKeyB64: bytesToBase64(publicKey),
    cipher: bytesToBase64(cipherBytes),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    mnemonicCipher,
    mnemonicIv,
    verifier: bytesToBase64(verifierBytes),
  }
}

// Decrypt the secret key. Throws if password is wrong.
export async function decryptWallet(wallet: EncryptedWallet, password: string): Promise<{
  secretKey: Uint8Array
  publicKey: Uint8Array
  address: string
  mnemonic?: string
}> {
  const salt = base64ToBytes(wallet.salt)
  const iv = base64ToBytes(wallet.iv)
  const key = await deriveAesKey(password, salt)

  // Verify password first
  const verifierBytes = base64ToBytes(wallet.verifier)
  try {
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      verifierBytes as BufferSource
    )
  } catch {
    throw new Error('Invalid password')
  }

  const cipherBytes = base64ToBytes(wallet.cipher)
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherBytes as BufferSource
  )
  const secretKey = new Uint8Array(plainBuf)

  let mnemonic: string | undefined
  if (wallet.mnemonicCipher && wallet.mnemonicIv) {
    try {
      const mnIv = base64ToBytes(wallet.mnemonicIv)
      const mnBytes = base64ToBytes(wallet.mnemonicCipher)
      const mnBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: mnIv as BufferSource },
        key,
        mnBytes as BufferSource
      )
      mnemonic = new TextDecoder().decode(mnBuf)
    } catch {
      // ignore mnemonic decrypt errors
    }
  }

  return {
    secretKey,
    publicKey: base64ToBytes(wallet.publicKeyB64),
    address: wallet.address,
    mnemonic,
  }
}

// ===========================================================================
// Mnemonic → keypair (Octra scheme)
// ----------------------------------------------------------------------------
// Octra uses a custom derivation scheme (NOT BIP-32 / SLIP-0010):
//   1. seed = BIP-39 mnemonicToSeed(mnemonic)         // 64 bytes (PBKDF2)
//   2. derived = HMAC-SHA512(key="Octra seed", seed)  // 64 bytes
//   3. ed25519_seed = derived.slice(0, 32)
//   4. kp = nacl.sign.keyPair.fromSeed(ed25519_seed)
//   5. address = "oct" + base58(sha256(public_key))
//
// This matches the official wallet generator at https://wallet.octra.org.
// ===========================================================================

async function hmacSha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // Use Web Crypto HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data as BufferSource)
  return new Uint8Array(sig)
}

export async function mnemonicToKeyPair(mnemonic: string): Promise<{
  secretKey: Uint8Array
  publicKey: Uint8Array
}> {
  const bip39 = await import('bip39')
  const seed = await bip39.mnemonicToSeed(mnemonic) // 64 bytes Buffer

  // Octra-specific derivation: HMAC-SHA512("Octra seed", seed)
  const keyBytes = new TextEncoder().encode('Octra seed')
  const derived = await hmacSha512(keyBytes, seed)
  const ed25519Seed = derived.slice(0, 32)

  const kp = nacl.sign.keyPair.fromSeed(ed25519Seed)
  return {
    secretKey: kp.secretKey,   // 64 bytes (seed || pubkey)
    publicKey: kp.publicKey,   // 32 bytes
  }
}

export async function generateMnemonic(): Promise<string> {
  const bip39 = await import('bip39')
  return bip39.generateMnemonic(128) // 12 words
}

// Import wallet from an existing ed25519 secret key (base64 or hex)
export function keyPairFromSecretKey(secretKey: Uint8Array): {
  secretKey: Uint8Array
  publicKey: Uint8Array
} {
  if (secretKey.length === 64) {
    return {
      secretKey,
      publicKey: secretKey.slice(32, 64),
    }
  }
  if (secretKey.length === 32) {
    const kp = nacl.sign.keyPair.fromSeed(secretKey)
    return { secretKey: kp.secretKey, publicKey: kp.publicKey }
  }
  throw new Error(`Invalid secret key length: ${secretKey.length}`)
}

// ===========================================================================
// Storage helpers
// ===========================================================================

const WALLET_STORAGE_KEY = 'octra-safe:wallet'

export function saveEncryptedWallet(wallet: EncryptedWallet) {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet))
}

export function loadEncryptedWallet(): EncryptedWallet | null {
  const raw = localStorage.getItem(WALLET_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as EncryptedWallet
  } catch {
    return null
  }
}

export function clearEncryptedWallet() {
  localStorage.removeItem(WALLET_STORAGE_KEY)
}

// ===========================================================================
// Validate address format (basic client-side check before RPC call)
// ===========================================================================

const OCTRA_ADDRESS_REGEX = /^oct[1-9A-HJ-NP-Za-km-z]{44}$/

export function isValidOctraAddress(addr: string): boolean {
  return typeof addr === 'string' && OCTRA_ADDRESS_REGEX.test(addr)
}
