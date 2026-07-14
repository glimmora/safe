// ============================================================================
// lib/ocs01.ts — OCS-01 token standard helpers
// ----------------------------------------------------------------------------
// OCS-01 is Octra's fungible token standard (ERC-20 equivalent).
// Key differences from ERC-20:
//   - approve() → grant()
//   - transferFrom() → pull()
//   - balanceOf() → balance_of()
//   - name()/symbol() → get_name()/get_symbol()
//   - Args are JSON arrays of strings, NOT Solidity ABI encoded
// ============================================================================

import { contractCall, getBalance } from './rpc'
import { encodeCallMessage, decodeInt, decodeString, stringifyArg } from './encoder'
import { OCS01_FUNCTIONS } from '@/types'
import type { TokenInfo } from '@/types'

// ===========================================================================
// View function wrappers (read-only)
// ===========================================================================

export async function getTokenName(rpcUrl: string, tokenAddress: string): Promise<string> {
  return contractCall<string>(rpcUrl, tokenAddress, OCS01_FUNCTIONS.getName, [])
    .then(decodeString)
}

export async function getTokenSymbol(rpcUrl: string, tokenAddress: string): Promise<string> {
  return contractCall<string>(rpcUrl, tokenAddress, OCS01_FUNCTIONS.getSymbol, [])
    .then(decodeString)
}

export async function getTokenDecimals(rpcUrl: string, tokenAddress: string): Promise<number> {
  return contractCall<string | number>(rpcUrl, tokenAddress, OCS01_FUNCTIONS.decimals, [])
    .then(decodeInt)
}

export async function getTokenTotalSupply(rpcUrl: string, tokenAddress: string): Promise<number> {
  return contractCall<string | number>(rpcUrl, tokenAddress, OCS01_FUNCTIONS.getTotalSupply, [])
    .then(decodeInt)
}

export async function getTokenBalance(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string
): Promise<number> {
  // balance_of(addr: address): int — args = ["octAddr..."]
  return contractCall<string | number>(
    rpcUrl,
    tokenAddress,
    OCS01_FUNCTIONS.balanceOf,
    [walletAddress],
    walletAddress
  ).then(decodeInt)
}

export async function getTokenAllowance(
  rpcUrl: string,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<number> {
  // allowance(owner: address, spender: address): int
  return contractCall<string | number>(
    rpcUrl,
    tokenAddress,
    OCS01_FUNCTIONS.allowance,
    [ownerAddress, spenderAddress],
    ownerAddress
  ).then(decodeInt)
}

export async function getTokenOwner(rpcUrl: string, tokenAddress: string): Promise<string> {
  return contractCall<string>(rpcUrl, tokenAddress, OCS01_FUNCTIONS.getOwner, [])
    .then(decodeString)
}

// ===========================================================================
// Fetch full token metadata (used when adding a custom token)
// ===========================================================================

export async function fetchTokenMetadata(
  rpcUrl: string,
  tokenAddress: string
): Promise<TokenInfo> {
  const [name, symbol, decimals] = await Promise.all([
    getTokenName(rpcUrl, tokenAddress),
    getTokenSymbol(rpcUrl, tokenAddress),
    getTokenDecimals(rpcUrl, tokenAddress),
  ])

  if (!name || !symbol) {
    throw new Error('Not a valid OCS-01 token (missing name or symbol)')
  }

  return {
    address: tokenAddress,
    name,
    symbol,
    decimals,
    isCustom: true,
  }
}

// ===========================================================================
// State-changing call builders (return { method, args } for signer to wrap)
// ===========================================================================

// transfer(to: address, amount: int)
// Returns the method name + encoded args for the signer.
export function encodeTransfer(to: string, amount: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.transfer,
    args: [to, stringifyArg(amount)],
  }
}

// grant(spender: address, amount: int)  -- equivalent to ERC-20 approve
export function encodeGrant(spender: string, amount: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.grant,
    args: [spender, stringifyArg(amount)],
  }
}

// pull(from: address, to: address, amount: int) -- equivalent to ERC-20 transferFrom
export function encodePull(from: string, to: string, amount: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.pull,
    args: [from, to, stringifyArg(amount)],
  }
}

// mint(to: address, amount: int) -- TestOCS01 only, owner-only
export function encodeMint(to: string, amount: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.mint,
    args: [to, stringifyArg(amount)],
  }
}

// increase_grant(spender: address, added: int)
export function encodeIncreaseGrant(spender: string, added: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.increaseGrant,
    args: [spender, stringifyArg(added)],
  }
}

// decrease_grant(spender: address, subtracted: int)
export function encodeDecreaseGrant(spender: string, subtracted: number): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.decreaseGrant,
    args: [spender, stringifyArg(subtracted)],
  }
}

// revoke_grant(spender: address)
export function encodeRevokeGrant(spender: string): { method: string; args: string[] } {
  return {
    method: OCS01_FUNCTIONS.revokeGrant,
    args: [spender],
  }
}

// ===========================================================================
// Multi-sig Safe integration: encode OCS01 transfer as a Safe tx payload
// ----------------------------------------------------------------------------
// When a multi-sig wallet wants to send OCS01 tokens, the Safe itself calls
// the token contract. The Safe's submit_transaction() takes (to, value, data):
//   to   = token contract address
//   value = 0 (no native OCT sent)
//   data  = "<method>:<arg1>:<arg2>:..." (OctraSafe parses this in execute)
//
// For OCS01 transfer, we encode:
//   to   = tokenAddress
//   value = 0
//   data  = "transfer:<recipient_addr>:<amount>"
// ============================================================================

export function encodeSafeTokenTransferTx(
  tokenAddress: string,
  recipient: string,
  amount: number
): { to: string; value: number; data: string } {
  return {
    to: tokenAddress,
    value: 0,
    data: `transfer:${recipient}:${amount}`,
  }
}

export function encodeSafeTokenGrantTx(
  tokenAddress: string,
  spender: string,
  amount: number
): { to: string; value: number; data: string } {
  return {
    to: tokenAddress,
    value: 0,
    data: `grant:${spender}:${amount}`,
  }
}

// Native OCT transfer through the Safe (data is empty, value is the OCT amount)
export function encodeSafeNativeTransferTx(
  recipient: string,
  amount: number  // in raw OU
): { to: string; value: number; data: string } {
  return {
    to: recipient,
    value: amount,
    data: '',
  }
}

// Owner management through the Safe (data carries the action key).
// Use `self_addr`-style placeholder 'oct1111111111111111111111111111111111111111111111' (valid base58)
// for the `to` field — it's ignored by the contract's dispatch logic.
const SAFE_PLACEHOLDER_ADDR = 'oct1'.padEnd(47, '1')

export function encodeSafeAddOwnerTx(newOwner: string): { to: string; value: number; data: string } {
  return {
    to: SAFE_PLACEHOLDER_ADDR,
    value: 0,
    data: `add_owner:${newOwner}`,
  }
}

export function encodeSafeRemoveOwnerTx(oldOwner: string): { to: string; value: number; data: string } {
  return {
    to: SAFE_PLACEHOLDER_ADDR,
    value: 0,
    data: `remove_owner:${oldOwner}`,
  }
}

export function encodeSafeChangeThresholdTx(newThreshold: number): { to: string; value: number; data: string } {
  return {
    to: SAFE_PLACEHOLDER_ADDR,
    value: 0,
    data: `change_threshold:${newThreshold}`,
  }
}

// ===========================================================================
// Format helpers
// ===========================================================================

// Format a raw integer balance using the token's decimals.
// e.g. formatTokenAmount(1000000, 6) → "1.000000"
export function formatTokenAmount(rawAmount: number, decimals: number): string {
  if (!Number.isFinite(rawAmount)) return '0'
  const neg = rawAmount < 0
  const abs = Math.abs(rawAmount)
  const divisor = Math.pow(10, decimals)
  const whole = Math.floor(abs / divisor)
  const fraction = abs - whole * divisor
  const fracStr = fraction.toString().padStart(decimals, '0')
  let result = whole.toString()
  if (decimals > 0) {
    result += '.' + fracStr
  }
  return neg ? '-' + result : result
}

// Parse a human-readable amount into raw integer.
// e.g. parseTokenAmount("1.5", 6) → 1500000
export function parseTokenAmount(human: string, decimals: number): number {
  if (!human || isNaN(Number(human))) return 0
  const n = parseFloat(human)
  const divisor = Math.pow(10, decimals)
  return Math.floor(n * divisor)
}

// Format OCT amount (always 6 decimals) from raw OU string
export function formatOctAmount(rawAmount: string | number): string {
  const raw = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount
  if (!Number.isFinite(raw)) return '0'
  return formatTokenAmount(raw, 6)
}

// Parse OCT amount to raw OU
export function parseOctAmount(human: string): string {
  return String(parseTokenAmount(human, 6))
}

// ===========================================================================
// Detect whether a Safe tx is an OCS01 transfer (for human-readable display)
// ===========================================================================

export interface DecodedSafeTxAction {
  kind: 'token_transfer' | 'token_grant' | 'native_transfer' | 'add_owner' | 'remove_owner' | 'change_threshold' | 'custom_call' | 'unknown'
  tokenAddress?: string
  recipient?: string
  spender?: string
  amount?: number
  newOwner?: string
  oldOwner?: string
  newThreshold?: number
}

// Parse the `data` field of a Safe transaction to determine what action it represents.
export function decodeSafeTxAction(
  to: string,
  value: number,
  data: string
): DecodedSafeTxAction {
  if (!data || data.length === 0) {
    return {
      kind: 'native_transfer',
      recipient: to,
      amount: value,
    }
  }

  if (data.startsWith('transfer:')) {
    const parts = data.substring('transfer:'.length).split(':')
    return {
      kind: 'token_transfer',
      tokenAddress: to,
      recipient: parts[0],
      amount: parts[1] ? parseInt(parts[1], 10) : 0,
    }
  }

  if (data.startsWith('grant:')) {
    const parts = data.substring('grant:'.length).split(':')
    return {
      kind: 'token_grant',
      tokenAddress: to,
      spender: parts[0],
      amount: parts[1] ? parseInt(parts[1], 10) : 0,
    }
  }

  if (data.startsWith('add_owner:')) {
    return {
      kind: 'add_owner',
      newOwner: data.substring('add_owner:'.length),
    }
  }

  if (data.startsWith('remove_owner:')) {
    return {
      kind: 'remove_owner',
      oldOwner: data.substring('remove_owner:'.length),
    }
  }

  if (data.startsWith('change_threshold:')) {
    return {
      kind: 'change_threshold',
      newThreshold: parseInt(data.substring('change_threshold:'.length), 10),
    }
  }

  return { kind: 'unknown' }
}
