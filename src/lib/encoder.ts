// ============================================================================
// lib/encoder.ts — Encode/decode AML function calls
// ----------------------------------------------------------------------------
// CRITICAL DIFFERENCE from Solidity/EVM:
//   Octra does NOT use Solidity ABI encoding (no keccak256 selector, no packed
//   args). Instead, function arguments are passed as a plain JSON array of
//   stringified values. The Octra VM coerces strings to the declared AML type
//   (int, address, string, bool) based on the function signature.
//
//   Example call to `transfer(to: address, amount: int)`:
//     method = "transfer"
//     params = ["octABC...", "1000"]
//
//   The `encrypted_data` field of an Octra tx holds the method name, and the
//   `message` field holds the JSON-stringified params array.
//
// This abstraction layer lets us swap encoding strategy if Octra changes.
// ============================================================================

import type { OctraTx } from '@/types'
import { OP_TYPES } from '@/config/networks'

// Encode a contract view call. Returns the JSON array of params.
// All values are stringified because the Octra VM expects string-coercible args.
export function encodeViewParams(args: unknown[]): string[] {
  return args.map(stringifyArg)
}

// Stringify a single argument per Octra conventions:
//   - address → as-is (already oct... string)
//   - number  → toString()
//   - bigint  → toString()
//   - boolean → "true" | "false"
//   - string  → as-is
//   - null    → ""
export function stringifyArg(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return JSON.stringify(v)
}

// Build the params JSON string for the `message` field of a contract-call tx.
// Format: '["arg1","arg2",...]' — stringified array of strings.
export function encodeCallMessage(args: unknown[]): string {
  return JSON.stringify(encodeViewParams(args))
}

// Build the canonical JSON for signing an Octra transaction.
// CRITICAL: Field order matters and must match the Octra node's verifier
// byte-for-byte. Order observed from webcli tx_builder.hpp:
//   from, to_, amount, nonce, ou, timestamp, op_type, [encrypted_data,] [message,]
export function buildCanonicalTxJson(tx: OctraTx): string {
  let s = '{'
  s += `"from":${JSON.stringify(tx.from)}`
  s += `,"to_":${JSON.stringify(tx.to_)}`
  s += `,"amount":${JSON.stringify(tx.amount)}`
  s += `,"nonce":${tx.nonce}`
  s += `,"ou":${JSON.stringify(tx.ou)}`
  s += `,"timestamp":${tx.timestamp}`
  s += `,"op_type":${JSON.stringify(tx.op_type || 'standard')}`
  if (tx.encrypted_data && tx.encrypted_data.length > 0) {
    s += `,"encrypted_data":${JSON.stringify(tx.encrypted_data)}`
  }
  if (tx.message && tx.message.length > 0) {
    s += `,"message":${JSON.stringify(tx.message)}`
  }
  s += '}'
  return s
}

// Build a contract-call transaction (state-changing).
//   contractAddress → tx.to_
//   methodName → tx.encrypted_data
//   args[] → tx.message (JSON array of stringified values)
//   amount → tx.amount (in raw OU string, "0" for pure calls)
export function buildContractCallTx(params: {
  from: string
  contractAddress: string
  methodName: string
  args: unknown[]
  amount?: string    // raw OU string, default "0"
  nonce: number
  ou?: string        // fee in OU
  timestamp?: number
}): OctraTx {
  const ts = params.timestamp ?? Date.now() / 1000
  return {
    from: params.from,
    to_: params.contractAddress,
    amount: params.amount ?? '0',
    nonce: params.nonce,
    ou: params.ou ?? '1000',
    timestamp: ts,
    op_type: OP_TYPES.CALL,
    encrypted_data: params.methodName,
    message: encodeCallMessage(params.args),
  }
}

// Build a standard OCT transfer transaction.
export function buildNativeTransferTx(params: {
  from: string
  to: string
  amount: string    // raw OU string
  nonce: number
  ou?: string
  timestamp?: number
}): OctraTx {
  const ts = params.timestamp ?? Date.now() / 1000
  return {
    from: params.from,
    to_: params.to,
    amount: params.amount,
    nonce: params.nonce,
    ou: params.ou ?? '10000',
    timestamp: ts,
    op_type: OP_TYPES.STANDARD,
  }
}

// Build a deploy transaction.
//   bytecodeB64 → tx.encrypted_data
//   constructorArgs[] → tx.message (JSON array of constructor params)
export function buildDeployTx(params: {
  from: string
  contractAddress: string  // precomputed deterministic address
  bytecodeB64: string
  constructorArgs: unknown[]
  nonce: number
  ou?: string
  timestamp?: number
}): OctraTx {
  const ts = params.timestamp ?? Date.now() / 1000
  return {
    from: params.from,
    to_: params.contractAddress,
    amount: '0',
    nonce: params.nonce,
    ou: params.ou ?? '1000000',  // ~1 OCT cap (was 50M, lowered — `ou` is bid cap, not actual fee)
    timestamp: ts,
    op_type: OP_TYPES.DEPLOY,
    encrypted_data: params.bytecodeB64,
    message: encodeCallMessage(params.constructorArgs),
  }
}

// ===========================================================================
// Decoders for return values
// ===========================================================================

export function decodeInt(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

export function decodeBool(v: string | boolean | null | undefined): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  return false
}

export function decodeString(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

// Split a CSV return value (e.g. "addr1,addr2,addr3")
export function decodeAddressList(v: string | null | undefined): string[] {
  const s = decodeString(v)
  if (!s) return []
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

// Split a pipe-delimited transaction record from OctraSafe.get_transaction()
// Format: "<to>|<value>|<executed_int>|<data>"
export function decodeTransactionRecord(v: string | null | undefined): {
  to: string
  value: string
  executed: boolean
  data: string
} {
  const s = decodeString(v)
  if (!s) return { to: '', value: '0', executed: false, data: '' }
  const parts = s.split('|')
  return {
    to: parts[0] ?? '',
    value: parts[1] ?? '0',
    executed: parts[2] === '1',
    data: parts.slice(3).join('|'), // data may itself contain |
  }
}
