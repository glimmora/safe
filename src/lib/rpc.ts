// ============================================================================
// lib/rpc.ts — Octra JSON-RPC 2.0 client
// ----------------------------------------------------------------------------
// Implements the canonical Octra RPC client pattern studied from
// github.com/octra-labs/webcli (C++) and github.com/octra-labs/ocs01-test (Rust).
//
// All methods are POST to /rpc with Content-Type: application/json.
// `params` is a positional JSON array (order matters per method signature).
// There is NO `eth_*` namespace — Octra uses custom `octra_*`, `contract_*`,
// `node_*`, `epoch_*`, `staging_*` methods.
// ============================================================================

import { RPC_TIMEOUT } from '@/config/client'

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params: unknown[]
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

export class RpcError extends Error {
  code: number
  data?: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

let _id = 1

function nextId(): number {
  return _id++
}

// In-memory cache for read-only calls
interface CacheEntry {
  value: unknown
  expires: number
}
const _cache = new Map<string, CacheEntry>()

function cacheGet(key: string): unknown | undefined {
  const e = _cache.get(key)
  if (!e) return undefined
  if (Date.now() > e.expires) {
    _cache.delete(key)
    return undefined
  }
  return e.value
}

function cacheSet(key: string, value: unknown, ttlMs: number) {
  _cache.set(key, { value, expires: Date.now() + ttlMs })
}

export function clearCache() {
  _cache.clear()
}

// Core RPC call function. Uses fetch with AbortController for timeout.
export async function rpcCall<T = unknown>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  opts: { timeoutMs?: number; cacheTtlMs?: number; cacheKey?: string } = {}
): Promise<T> {
  const cacheKey = opts.cacheKey ?? `${rpcUrl}:${method}:${JSON.stringify(params)}`
  if (opts.cacheTtlMs && opts.cacheKey !== undefined) {
    const cached = cacheGet(cacheKey)
    if (cached !== undefined) return cached as T
  }

  const req: RpcRequest = {
    jsonrpc: '2.0',
    id: nextId(),
    method,
    params,
  }

  const controller = new AbortController()
  const timeout = opts.timeoutMs ?? RPC_TIMEOUT
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new RpcError(-32603, `HTTP ${res.status}: ${text || res.statusText}`)
    }

    const json: RpcResponse<T> = await res.json()

    if (json.error) {
      throw new RpcError(json.error.code, json.error.message, json.error.data)
    }

    if (json.result === undefined) {
      throw new RpcError(-32603, 'RPC returned no result')
    }

    if (opts.cacheTtlMs) {
      cacheSet(cacheKey, json.result, opts.cacheTtlMs)
    }

    return json.result
  } finally {
    clearTimeout(timer)
  }
}

// ===========================================================================
// Node info
// ===========================================================================
export interface NodeStatus {
  epoch: number
  current_epoch: number
  validator: string
  roots: number
  timestamp: number
  network_version: string
  head_epoch: number
  state_root: string
  txid_hi: string
}

export interface NodeVersion {
  node: string
  version: string
  protocol: string
}

export interface NodeStats {
  current_epoch: number
  total_accounts: number
  active_accounts: number
  total_supply: string
  total_supply_raw: string
  max_supply: string
  max_supply_raw: string
  burned: string
  total_transactions: number
  staging_size: number
  latest_epochs: number[]
}

export async function getNodeStatus(rpcUrl: string): Promise<NodeStatus> {
  return rpcCall<NodeStatus>(rpcUrl, 'node_status', [], {
    cacheTtlMs: 5000,
    cacheKey: `node_status:${rpcUrl}`,
  })
}

export async function getNodeVersion(rpcUrl: string): Promise<NodeVersion> {
  return rpcCall<NodeVersion>(rpcUrl, 'node_version', [], {
    cacheTtlMs: 60000,
    cacheKey: `node_version:${rpcUrl}`,
  })
}

export async function getNodeStats(rpcUrl: string): Promise<NodeStats> {
  return rpcCall<NodeStats>(rpcUrl, 'node_stats', [], {
    cacheTtlMs: 5000,
    cacheKey: `node_stats:${rpcUrl}`,
  })
}

// ===========================================================================
// Account / balance / nonce
// ===========================================================================
export interface BalanceResult {
  address: string
  balance: string         // formatted OCT (e.g. "98038.229700")
  balance_raw: string     // raw OU integer (e.g. "98038229700")
  nonce: number
  pending_nonce: number
  has_public_key: boolean
}

export async function getBalance(rpcUrl: string, address: string): Promise<BalanceResult> {
  return rpcCall<BalanceResult>(rpcUrl, 'octra_balance', [address], {
    cacheTtlMs: 10000,
    cacheKey: `balance:${rpcUrl}:${address}`,
  })
}

export async function getNonce(rpcUrl: string, address: string): Promise<number> {
  const r = await rpcCall<{ nonce: number; pending_nonce: number }>(
    rpcUrl, 'octra_nonce', [address],
    { cacheTtlMs: 3000, cacheKey: `nonce:${rpcUrl}:${address}` }
  )
  return r.pending_nonce ?? r.nonce
}

export async function validateAddress(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const r = await rpcCall<{ valid: boolean; error: string | null }>(
      rpcUrl, 'octra_validateAddress', [address]
    )
    return r.valid === true
  } catch {
    return false
  }
}

// ===========================================================================
// Transaction submission & lookup
// ===========================================================================
export interface SubmitResult {
  tx_hash: string
  status?: string
}

export async function submitTransaction(rpcUrl: string, tx: Record<string, unknown>): Promise<string> {
  const r = await rpcCall<SubmitResult>(rpcUrl, 'octra_submit', [tx])
  if (!r.tx_hash) throw new RpcError(-32603, 'Submit did not return tx_hash')
  return r.tx_hash
}

export interface OctraTransaction {
  status: 'pending' | 'confirmed' | 'rejected' | 'dropped'
  tx_hash: string
  epoch: number
  from: string
  to: string
  amount: string
  amount_raw: string
  nonce: number
  ou: string
  timestamp: number
  op_type: string
  message?: string
  encrypted_data?: string
}

export async function getTransaction(rpcUrl: string, hash: string): Promise<OctraTransaction | null> {
  try {
    return await rpcCall<OctraTransaction>(rpcUrl, 'octra_transaction', [hash], {
      cacheTtlMs: 3000,
      cacheKey: `tx:${rpcUrl}:${hash}`,
    })
  } catch (e) {
    if (e instanceof RpcError && e.code === -32602) return null
    throw e
  }
}

export interface TransactionsByAddressResult {
  transactions: OctraTransaction[]
  total: number
}

export async function getTransactionsByAddress(
  rpcUrl: string,
  address: string,
  limit = 50,
  offset = 0
): Promise<OctraTransaction[]> {
  try {
    const r = await rpcCall<OctraTransaction[] | TransactionsByAddressResult>(
      rpcUrl, 'octra_transactionsByAddress', [address, limit, offset]
    )
    if (Array.isArray(r)) return r
    return r.transactions ?? []
  } catch {
    return []
  }
}

// ===========================================================================
// Fees
// ===========================================================================
export interface RecommendedFee {
  minimum: string
  base_fee: string
  recommended: string
  fast: string
  staging_size: number
  staging_ou: string
  epoch_capacity: string
  usage_pct: number
}

export async function getRecommendedFee(rpcUrl: string, opType?: string): Promise<RecommendedFee> {
  return rpcCall<RecommendedFee>(rpcUrl, 'octra_recommendedFee', opType ? [opType] : [], {
    cacheTtlMs: 10000,
    cacheKey: `fee:${rpcUrl}:${opType ?? 'default'}`,
  })
}

// ===========================================================================
// Contract: view calls (no signature, no nonce, no fee)
// ===========================================================================
export interface ContractCallResult {
  result?: string | number | boolean | null
  error?: { code: number; message: string } | null
  storage?: Record<string, unknown>
  events?: Array<{ name: string; args: unknown[] }>
}

// contract_call(addr, method, params_array, caller) — READ-ONLY
// params is a JSON array of native values (NOT Solidity ABI encoded).
// e.g. for balance_of(addr): params = ["octAddr..."]
// e.g. for transfer(to, amt): params = ["octAddr...", "1000"]
export async function contractCall<T = string | number | boolean | null>(
  rpcUrl: string,
  contractAddress: string,
  method: string,
  params: unknown[] = [],
  caller = 'oct0000000000000000000000000000000000000000000000',  // dummy caller for views
): Promise<T> {
  const r = await rpcCall<ContractCallResult>(
    rpcUrl,
    'contract_call',
    [contractAddress, method, params, caller],
    {
      cacheTtlMs: 5000,
      cacheKey: `cc:${rpcUrl}:${contractAddress}:${method}:${JSON.stringify(params)}`,
    }
  )
  if (r.error) throw new RpcError(r.error.code, r.error.message)
  return r.result as T
}

// ===========================================================================
// Contract metadata
// ===========================================================================
export interface VmContract {
  address: string
  version: string
  code_hash: string
  balance: string
  owner: string
}

export async function getVmContract(rpcUrl: string, address: string): Promise<VmContract | null> {
  try {
    return await rpcCall<VmContract>(rpcUrl, 'vm_contract', [address], {
      cacheTtlMs: 120000,
      cacheKey: `vm_contract:${rpcUrl}:${address}`,
    })
  } catch {
    return null
  }
}

export async function getContractAbi(rpcUrl: string, address: string): Promise<unknown | null> {
  try {
    return await rpcCall(rpcUrl, 'octra_contractAbi', [address], {
      cacheTtlMs: 300000,
      cacheKey: `abi:${rpcUrl}:${address}`,
    })
  } catch {
    return null
  }
}

export interface ContractStorageResult {
  key: string
  value: string
  truncated?: boolean
}

export async function getContractStorage(rpcUrl: string, address: string, key: string): Promise<string | null> {
  try {
    const r = await rpcCall<ContractStorageResult | string>(
      rpcUrl, 'octra_contractStorage', [address, key]
    )
    if (typeof r === 'string') return r
    return r.value
  } catch {
    return null
  }
}

// ===========================================================================
// Compile & deploy helpers (used by the deploy flow)
// ===========================================================================
export interface CompileResult {
  bytecode: string          // base64
  size: number
  instructions: number
  abi: unknown
  version: string
  disasm?: string
}

export async function compileAml(rpcUrl: string, source: string): Promise<CompileResult> {
  return rpcCall<CompileResult>(rpcUrl, 'octra_compileAml', [source], { timeoutMs: 60_000 })
}

export interface CompileMultiFile {
  files: Array<{ path: string; source: string }>
  main: string
}

export async function compileAmlMulti(rpcUrl: string, files: Array<{ path: string; source: string }>, main: string): Promise<CompileResult> {
  const arg: CompileMultiFile = { files, main }
  return rpcCall<CompileResult>(rpcUrl, 'octra_compileAmlMulti', [arg], { timeoutMs: 60_000 })
}

export interface ComputeAddressResult {
  address: string
  deployer: string
  nonce: number
}

export async function computeContractAddress(
  rpcUrl: string,
  bytecodeB64: string,
  deployer: string,
  nonce?: number
): Promise<ComputeAddressResult> {
  const params = nonce !== undefined ? [bytecodeB64, deployer, nonce] : [bytecodeB64, deployer]
  return rpcCall<ComputeAddressResult>(rpcUrl, 'octra_computeContractAddress', params)
}

export interface ContractReceipt {
  contract: string
  method: string
  success: boolean
  effort: number
  events: Array<{ name: string; args: unknown[] }>
  error?: string
  epoch: number
  ts: number
}

export async function getContractReceipt(rpcUrl: string, txHash: string): Promise<ContractReceipt | null> {
  try {
    return await rpcCall<ContractReceipt>(rpcUrl, 'contract_receipt', [txHash], {
      cacheTtlMs: 5000,
      cacheKey: `receipt:${rpcUrl}:${txHash}`,
    })
  } catch {
    return null
  }
}

// ===========================================================================
// Polling helpers
// ===========================================================================
export async function waitForTransaction(
  rpcUrl: string,
  txHash: string,
  opts: { intervalMs?: number; maxAttempts?: number; onPoll?: (attempt: number) => void } = {}
): Promise<OctraTransaction> {
  const interval = opts.intervalMs ?? 3000
  const maxAttempts = opts.maxAttempts ?? 60
  for (let i = 0; i < maxAttempts; i++) {
    opts.onPoll?.(i)
    const tx = await getTransaction(rpcUrl, txHash)
    if (tx && (tx.status === 'confirmed' || tx.status === 'rejected' || tx.status === 'dropped')) {
      return tx
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts * interval / 1000}s`)
}
