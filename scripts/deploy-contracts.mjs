// ============================================================================
// scripts/deploy-contracts.mjs
// ----------------------------------------------------------------------------
// Deploys OctraSafe contracts to Octra devnet using a mnemonic wallet.
//
// Usage:
//   node scripts/deploy-contracts.mjs
//
// Prerequisites:
//   - Wallet must have devnet OCT for gas (~50 OCT per deploy)
//   - RPC must be reachable (https://devnet.octrascan.io/rpc)
//
// Outputs:
//   - Writes deployed addresses to scripts/deploy-result.json
//   - Prints summary with explorer links
//   - After successful run, update src/config/contracts.ts manually
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { mnemonicToSeed } from 'bip39'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { createHmac } from 'crypto'

// ============= CONFIG =============
const MNEMONIC = 'pumpkin divert spend later token student spot faint collect visual carbon matter'
const EXPECTED_ADDR = 'octGXi34vZfYwi3idjSa6m34vLJCoJHNMNAGeHyqh7JVEvy'
const RPC = 'https://devnet.octrascan.io/rpc'
const EXPLORER = 'https://devnet.octrascan.io'

// TestOCS01 token constructor params:
//   ["TestOCS01", "TEST", 1000000000, 6]
//   name="TestOCS01", symbol="TEST", supply=1,000,000,000 (smallest unit), decimals=6
//   → 1,000 TEST tokens
const TEST_TOKEN_PARAMS = ['TestOCS01', 'TEST', 1000000000, 6]

// OctraSafe constructor params:
//   [threshold_val]  (the originator becomes the first owner)
//   Set threshold=1 for the deployer (can be changed later via Safe tx)
const SAFE_PARAMS = [1]

// OctraSafeFactory constructor params: none
const FACTORY_PARAMS = []

// Deploy fee strategy:
// `ou` field is a BID/CAP, not the actual fee. The network charges based on
// actual computation effort (see `contract_receipt.effort`). So we bid a
// conservative cap that's high enough to cover the actual effort, but not
// absurdly high (the webcli default of 50M = 50 OCT is over-conservative).
//
// Strategy:
//   1. Query `octra_recommendedFee("deploy")` for the actual recommended bid
//   2. Use 10x the recommended value as a safe cap (so we don't underpay)
//   3. Fallback to 1M OU (~1 OCT) if RPC doesn't return a useful value
const FALLBACK_DEPLOY_OU = '1000000'  // ~1 OCT cap
let resolvedDeployOu = FALLBACK_DEPLOY_OU

async function resolveDeployFee() {
  try {
    console.log('  Querying recommended fee for deploy op_type...')
    const fee = await rpc('octra_recommendedFee', ['deploy'], 8000)
    if (fee && fee.recommended) {
      const recommended = parseInt(fee.recommended, 10)
      if (recommended > 0 && Number.isFinite(recommended)) {
        // Bid 10x recommended as a safe cap (network only charges actual effort)
        const bid = String(recommended * 10)
        console.log(`  Recommended: ${fee.recommended} OU, bidding ${bid} OU (${(parseInt(bid, 10) / 1_000_000).toFixed(4)} OCT cap)`)
        resolvedDeployOu = bid
        return
      }
    }
    console.log(`  Recommended fee query returned no usable value, using fallback: ${FALLBACK_DEPLOY_OU} OU`)
  } catch (e) {
    console.log(`  Fee query failed (${e.message}), using fallback: ${FALLBACK_DEPLOY_OU} OU`)
  }
}
// ==================================

let _id = 1
function nextId() { return _id++ }

// ===========================================================================
// RPC client
// ===========================================================================
async function rpc(method, params, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`)
    }
    const json = await res.json()
    if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`)
    return json.result
  } finally {
    clearTimeout(t)
  }
}

// ===========================================================================
// Wallet derivation (Octra scheme)
// ===========================================================================
async function sha256(data) {
  const h = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  return new Uint8Array(h)
}

async function deriveWallet(mnemonic) {
  const seed = await mnemonicToSeed(mnemonic)  // 64-byte Buffer (PBKDF2)
  const hmac = createHmac('sha512', 'Octra seed')
  hmac.update(seed)
  const derived = hmac.digest()  // 64 bytes
  const ed25519Seed = derived.subarray(0, 32)
  const kp = nacl.sign.keyPair.fromSeed(ed25519Seed)
  const h = await sha256(kp.publicKey)
  let b58 = bs58.encode(Buffer.from(h))
  while (b58.length < 44) b58 = '1' + b58
  return {
    address: 'oct' + b58,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
  }
}

// ===========================================================================
// Transaction builder + signer
// ===========================================================================
function buildCanonicalJson(tx) {
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

function signTx(tx, secretKey, publicKey) {
  const canonical = buildCanonicalJson(tx)
  const msg = new TextEncoder().encode(canonical)
  const sig = nacl.sign.detached(msg, secretKey)
  return {
    ...tx,
    signature: Buffer.from(sig).toString('base64'),
    public_key: Buffer.from(publicKey).toString('base64'),
  }
}

function toSubmitPayload(signed) {
  const p = {
    from: signed.from,
    to_: signed.to_,
    amount: signed.amount,
    nonce: signed.nonce,
    ou: signed.ou,
    timestamp: signed.timestamp,
    signature: signed.signature,
    public_key: signed.public_key,
  }
  if (signed.op_type) p.op_type = signed.op_type
  if (signed.encrypted_data) p.encrypted_data = signed.encrypted_data
  if (signed.message) p.message = signed.message
  return p
}

function encodeCallArgs(args) {
  return JSON.stringify(args.map(a => {
    if (a === null || a === undefined) return ''
    if (typeof a === 'string') return a
    if (typeof a === 'number') return String(a)
    if (typeof a === 'boolean') return a ? 'true' : 'false'
    if (typeof a === 'bigint') return a.toString()
    return JSON.stringify(a)
  }))
}

// ===========================================================================
// Deploy helpers
// ===========================================================================
async function checkDevnetUp() {
  console.log('--- Checking devnet RPC connectivity ---')
  try {
    const ns = await rpc('node_status', [], 10000)
    console.log('✓ RPC reachable')
    console.log('  Network version:', ns.network_version)
    console.log('  Current epoch:', ns.current_epoch)
    console.log('  Validator:', ns.validator)
    return true
  } catch (e) {
    console.log('✗ RPC unreachable:', e.message)
    console.log('  → If this is a 502 error, the devnet is temporarily down.')
    console.log('  → Wait a few minutes and try again.')
    return false
  }
}

async function checkBalanceAndNonce(addr) {
  console.log('\n--- Checking wallet balance ---')
  const bal = await rpc('octra_balance', [addr])
  const oct = parseFloat(bal.balance)
  console.log('  Address:', addr)
  console.log('  Balance:', oct, 'OCT (raw:', bal.balance_raw, 'OU)')
  console.log('  Nonce:', bal.nonce, '(pending:', bal.pending_nonce + ')')
  // Don't hard-fail on low balance — actual deploy fee is typically much less
  // than the conservative ou cap. Let the deploy attempt fail naturally if
  // the wallet really can't cover the actual effort.
  if (oct < 0.01) {
    console.log('  ⚠️  Balance is very low (< 0.01 OCT).')
    console.log('     Even though `ou` is just a cap, you may need at least ~0.01 OCT for actual effort.')
    console.log('     → Get devnet OCT from https://t.me/octra_chat_en')
  } else if (oct < 1) {
    console.log(`  ℹ️  Balance ${oct} OCT — should be enough for typical deploys (actual fee usually < 0.1 OCT).`)
  } else {
    console.log(`  ✓ Balance ${oct} OCT — sufficient for deploys.`)
  }
  return { balance: oct, nonce: bal.pending_nonce ?? bal.nonce }
}

async function compileContract(name, files, mainFile) {
  console.log(`\n--- Compiling ${name} ---`)
  console.log(`  Files: ${files.map(f => f.path).join(', ')}`)
  console.log(`  Main:  ${mainFile}`)
  const result = await rpc('octra_compileAmlMulti', [{ files, main: mainFile }], 60000)
  if (!result.bytecode) {
    console.log('✗ Compile failed: no bytecode returned')
    console.log('  Full result:', JSON.stringify(result, null, 2))
    throw new Error(`Compile ${name} failed`)
  }
  console.log(`✓ Compiled. Bytecode size: ${result.size} bytes, ${result.instructions} instructions`)
  if (result.verification) {
    console.log('  Verification:', JSON.stringify(result.verification).slice(0, 200))
  }
  if (result.errors && result.errors.length > 0) {
    console.log('  ⚠️  Compiler errors:', result.errors)
  }
  if (result.warnings && result.warnings.length > 0) {
    console.log('  ⚠️  Compiler warnings:', result.warnings)
  }
  return result
}

async function deployContract(name, wallet, bytecode, constructorArgs, currentNonce) {
  console.log(`\n--- Deploying ${name} ---`)
  const nextNonce = currentNonce + 1

  // Compute deterministic address
  console.log('  Computing contract address...')
  const addrResult = await rpc('octra_computeContractAddress', [bytecode, wallet.address, nextNonce])
  const contractAddr = addrResult.address
  console.log('  Contract address:', contractAddr)
  console.log('  Explorer:', `${EXPLORER}/address.html?addr=${contractAddr}`)

  // Build deploy tx
  const argsJson = encodeCallArgs(constructorArgs)
  const tx = {
    from: wallet.address,
    to_: contractAddr,
    amount: '0',
    nonce: nextNonce,
    ou: resolvedDeployOu,  // bid cap (was hardcoded 50M = 50 OCT, now dynamic)
    timestamp: Date.now() / 1000,
    op_type: 'deploy',
    encrypted_data: bytecode,
    message: argsJson,
  }

  // Sign + submit
  console.log('  Signing & submitting deploy tx...')
  const signed = signTx(tx, wallet.secretKey, wallet.publicKey)
  const payload = toSubmitPayload(signed)
  const submitResult = await rpc('octra_submit', [payload])
  const txHash = submitResult.tx_hash
  console.log('  Tx hash:', txHash)
  console.log('  Explorer tx:', `${EXPLORER}/tx.html?hash=${txHash}`)

  // Wait for confirmation
  console.log('  Waiting for confirmation...')
  let attempts = 0
  let confirmed = null
  while (attempts < 60) {
    attempts++
    await new Promise(r => setTimeout(r, 3000))
    try {
      const t = await rpc('octra_transaction', [txHash])
      if (t.status === 'confirmed') {
        confirmed = t
        break
      }
      if (t.status === 'rejected' || t.status === 'dropped') {
        throw new Error(`Transaction ${t.status}`)
      }
      console.log(`  [${attempts}/60] status: ${t.status}...`)
    } catch (e) {
      console.log(`  [${attempts}/60] poll error: ${e.message}`)
    }
  }
  if (!confirmed) {
    throw new Error(`Deploy ${name} not confirmed after ${attempts * 3}s`)
  }
  console.log('✓ Deploy confirmed at epoch', confirmed.epoch)

  // Verify the contract exists
  console.log('  Verifying contract on-chain...')
  try {
    const meta = await rpc('vm_contract', [contractAddr])
    console.log('  Contract metadata:', JSON.stringify(meta, null, 2))
  } catch (e) {
    console.log('  ⚠️  vm_contract call failed:', e.message)
    console.log('  (This is normal if indexing is lagging — wait a few minutes and retry.)')
  }

  return { contractAddr, txHash, epoch: confirmed.epoch }
}

// ===========================================================================
// Read AML contract source files
// ===========================================================================
function readAmlSource() {
  const baseDir = new URL('../contracts/', import.meta.url)
  const readFile = (path) => readFileSync(new URL(path, baseDir), 'utf-8')

  const iocs01 = readFile('interfaces/IOCS01.aml')
  const safe = readFile('OctraSafe.aml')
  const factory = readFile('OctraSafeFactory.aml')
  const testToken = readFile('TestOCS01.aml')

  return { iocs01, safe, factory, testToken }
}

// ===========================================================================
// Main
// ===========================================================================
async function main() {
  console.log('=========================================')
  console.log(' Octra Safe — Contract Deployment')
  console.log('=========================================')
  console.log('RPC:', RPC)
  console.log('Mnemonic:', MNEMONIC.split(' ').map((_, i, a) => i === 0 || i === a.length - 1 ? _ : '•').join(' '))
  console.log('')

  // 1. Derive wallet
  console.log('--- Deriving wallet from mnemonic ---')
  const wallet = await deriveWallet(MNEMONIC)
  console.log('  Address:', wallet.address)
  console.log('  Expected:', EXPECTED_ADDR)
  if (wallet.address !== EXPECTED_ADDR) {
    console.log('✗ Address mismatch — aborting')
    process.exit(1)
  }
  console.log('✓ Address matches expected')

  // 2. Check RPC connectivity
  const up = await checkDevnetUp()
  if (!up) {
    console.log('\n❌ Cannot deploy: devnet RPC is down.')
    console.log('   Wait a few minutes, then re-run this script.')
    process.exit(2)
  }

  // 3. Check balance
  const balInfo = await checkBalanceAndNonce(wallet.address)
  let currentNonce = balInfo.nonce

  // 3.5. Resolve deploy fee (query recommendedFee first, fallback to 1M OU)
  console.log('\n--- Resolving deploy fee ---')
  await resolveDeployFee()
  console.log(`  Final deploy ou bid: ${resolvedDeployOu} OU (${(parseInt(resolvedDeployOu, 10) / 1_000_000).toFixed(4)} OCT cap)`)
  if (balInfo.balance < parseInt(resolvedDeployOu, 10) / 1_000_000) {
    console.log(`  ⚠️  Balance ${balInfo.balance} OCT is below deploy cap ${(parseInt(resolvedDeployOu, 10) / 1_000_000).toFixed(4)} OCT`)
    console.log('     Note: this is a MAX cap; actual fee is typically much less.')
    console.log('     If deploy fails with insufficient_balance, request more devnet OCT.')
  }

  // 4. Read contract sources
  console.log('\n--- Reading AML contract sources ---')
  const sources = readAmlSource()
  console.log('  IOCS01.aml:           ', sources.iocs01.length, 'bytes')
  console.log('  OctraSafe.aml:        ', sources.safe.length, 'bytes')
  console.log('  OctraSafeFactory.aml: ', sources.factory.length, 'bytes')
  console.log('  TestOCS01.aml:        ', sources.testToken.length, 'bytes')

  const results = { deployed: {}, errors: [] }

  // 5. Compile & deploy TestOCS01
  try {
    const compiled = await compileContract('TestOCS01', [
      { path: 'interfaces/IOCS01.aml', source: sources.iocs01 },
      { path: 'main.aml', source: sources.testToken },
    ], 'main.aml')

    const deployed = await deployContract('TestOCS01', wallet, compiled.bytecode, TEST_TOKEN_PARAMS, currentNonce)
    results.deployed.testToken = deployed
    currentNonce = deployed.epoch ? currentNonce + 1 : currentNonce
  } catch (e) {
    console.log('✗ TestOCS01 deploy failed:', e.message)
    results.errors.push({ contract: 'TestOCS01', error: e.message })
  }

  // 6. Compile & deploy OctraSafe
  try {
    const compiled = await compileContract('OctraSafe', [
      { path: 'main.aml', source: sources.safe },
    ], 'main.aml')

    const deployed = await deployContract('OctraSafe', wallet, compiled.bytecode, SAFE_PARAMS, currentNonce)
    results.deployed.safe = deployed
  } catch (e) {
    console.log('✗ OctraSafe deploy failed:', e.message)
    results.errors.push({ contract: 'OctraSafe', error: e.message })
  }

  // 7. Compile & deploy OctraSafeFactory
  try {
    const compiled = await compileContract('OctraSafeFactory', [
      { path: 'main.aml', source: sources.factory },
    ], 'main.aml')

    const deployed = await deployContract('OctraSafeFactory', wallet, compiled.bytecode, FACTORY_PARAMS, currentNonce)
    results.deployed.factory = deployed
  } catch (e) {
    console.log('✗ OctraSafeFactory deploy failed:', e.message)
    results.errors.push({ contract: 'OctraSafeFactory', error: e.message })
  }

  // 8. Write results
  const outFile = new URL('./deploy-result.json', import.meta.url)
  writeFileSync(outFile, JSON.stringify(results, null, 2))
  console.log('\n=========================================')
  console.log(' Deployment Summary')
  console.log('=========================================')
  console.log('Results written to:', outFile.pathname)

  if (results.deployed.testToken) {
    console.log('\n✓ TestOCS01 token:')
    console.log('  Address:', results.deployed.testToken.contractAddr)
    console.log('  Tx hash:', results.deployed.testToken.txHash)
  }
  if (results.deployed.safe) {
    console.log('\n✓ OctraSafe:')
    console.log('  Address:', results.deployed.safe.contractAddr)
    console.log('  Tx hash:', results.deployed.safe.txHash)
  }
  if (results.deployed.factory) {
    console.log('\n✓ OctraSafeFactory:')
    console.log('  Address:', results.deployed.factory.contractAddr)
    console.log('  Tx hash:', results.deployed.factory.txHash)
  }
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:')
    for (const e of results.errors) {
      console.log(`  - ${e.contract}: ${e.error}`)
    }
  }

  if (Object.keys(results.deployed).length > 0) {
    console.log('\n📝 NEXT STEPS:')
    console.log('  1. Update src/config/contracts.ts with the deployed addresses above')
    console.log('  2. For TestOCS01, also add to KNOWN_TOKENS in the same file')
    console.log('  3. Run the app: npm run dev')
    console.log('  4. Connect wallet with the same mnemonic')
    console.log('  5. Create a Safe via the UI (it deploys a new OctraSafe per Safe)')
  }
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
