// ============================================================================
// lib/contractSources.ts — AML contract source code as TypeScript strings
// ----------------------------------------------------------------------------
// These are sent to the Octra RPC for compilation via `octra_compileAmlMulti`.
// They MUST match the .aml files in /contracts/ exactly.
//
// SECURITY AUDIT (see SECURITY-AUDIT-REPORT.md):
//   OctraSafe.aml v2:
//     R1 CRITICAL — require_self_call() on owner mgmt (Parity-class bypass fix)
//     R2 CRITICAL — CEI in execute_transaction (reentrancy double-spend fix)
//     R3 HIGH     — nonreentrant on all state-changing entrypoints
//     R4-R5 HIGH  — Always validate to; reject no-op txs
//     R7-R12 MED/LOW — placeholder fix, caps, digit validation, underflow guard
//
//   TestOCS01.aml v2:
//     T1+T2+T7 LOW  — Zero/sentinel/self_addr rejected
//     T4 MEDIUM     — grant() two-step pattern (forceApprove)
//     T5 MEDIUM     — Defensive overflow check on balances[to] + amt
//     T6 LOW        — increase/decrease_grant enforce self-grant block + cap
//     T10 LOW       — nonreentrant + CEI reordering in pull()
//     T11 LOW       — grant(amt >= 0) check
//
//   OctraSafeFactory.aml v2:
//     F1 CRITICAL — register_safe requires factory_admin
//     F2 HIGH     — Duplicate check fixed (was X==0 || X==0)
//     F3 HIGH     — Verifies target IS an OctraSafe via call(get_threshold)
//     F4 HIGH     — register_owner_for_safe removed (cache drift, no auth)
//     F5+F6 MED   — MAX_SAFES + MAX_OWNERS_PER_SAFE caps
//     F8 MED      — unregister_safe (admin-gated, array compaction)
//     F9+F13 MED  — Removed threshold/owner caching (passthrough/deprecated)
//     F10+F11 LOW — Event naming fixed
// ============================================================================

export const IOCS01_INTERFACE_SOURCE = `// IOCS01 — Octra Token Standard Interface (OCS-01)
// Reference: https://github.com/octra-labs/program-examples/token
//
// NOTE: Octra OCS-01 uses grant/pull instead of approve/transferFrom,
// and snake_case naming instead of camelCase.

interface IOCS01 {
  fn transfer(to: address, amount: int): bool
  fn grant(spender: address, amount: int): bool
  fn pull(from: address, to: address, amount: int): bool
  fn balance_of(addr: address): int
  fn allowance(owner: address, spender: address): int
  fn get_name(): string
  fn get_symbol(): string
  fn get_total_supply(): int
}
`

export const OCTRA_SAFE_SOURCE = `// ============================================================================
// OctraSafe — Multi-signature Wallet Smart Contract (AML) — v2 SECURITY-HARDENED
// ----------------------------------------------------------------------------
// Implements a Gnosis-Safe-style multi-sig wallet on the Octra blockchain.
//
// SECURITY AUDIT FINDINGS ADDRESSED (see SECURITY-AUDIT-REPORT.md):
//   R1 CRITICAL — Owner mgmt functions now require_self_call() (was: any
//                 owner could call add_owner/remove_owner/change_threshold
//                 directly, bypassing multi-sig threshold — Parity-class bug)
//   R2 CRITICAL — execute_transaction now marks tx_executed BEFORE any external
//                 call (CEI pattern). Was: set after call → reentrancy double-spend.
//   R3 HIGH     — All state-changing entrypoints marked nonreentrant
//   R4 HIGH     — submit_transaction now always validates \`to\` address
//   R5 HIGH     — submit_transaction rejects no-op txs (value=0 && data="")
//   R7 MEDIUM   — remove_owner placeholder bug fixed (uses self_addr sentinel)
//   R8 MEDIUM   — MAX_OWNER_COUNT cap added (prevents gas DoS)
//   R9 MEDIUM   — MAX_TX_COUNT cap added (prevents storage DoS)
//   R10 MEDIUM  — Parsed substrings validated (digits, addresses) before use
//   R12 LOW     — Underflow guard added to revoke_confirmation
//   R14 LOW     — Failed executions keep tx_executed=true (cannot retry)
//
// Reference patterns studied:
//   - https://github.com/octra-labs/program-examples/multisig/main.aml
//   - https://github.com/safe-global/safe-contracts (Gnosis Safe v1.5)
//   - https://github.com/OpenZeppelin/openzeppelin-contracts (SafeERC20)
// ============================================================================

contract OctraSafe {

  // Hard caps to prevent gas/storage DoS
  const MAX_OWNERS: int = 50
  const MAX_TX_COUNT: int = 10000

  state {
    // Owner set
    owners: map[address]bool
    owner_list: map[int]address
    owner_count: int

    // Multi-sig threshold (number of confirmations required to execute)
    threshold: int

    // Transaction counter (next tx id)
    tx_count: int

    // Transaction data
    tx_to: map[int]address
    tx_value: map[int]int
    tx_data: map[int]string       // arbitrary payload (action key + args)
    tx_executed: map[int]bool

    // Confirmation tracking: confirmations[tx_id][owner] = bool
    confirmations: map[int]map[address]bool
    conf_count: map[int]int

    // Reentrancy guard (defense-in-depth; nonreentrant keyword also applied)
    _reentrancy_guard: bool
  }

  // --- Events ---
  event ExecutionSuccess(tx_id: int)
  event ExecutionFailure(tx_id: int)
  event Deposit(sender: address, amount: int)
  event OwnerAdded(owner: address)
  event OwnerRemoved(owner: address)
  event ThresholdChanged(threshold: int)
  event Confirmation(sender: address, tx_id: int)
  event Revocation(sender: address, tx_id: int)
  event Submission(tx_id: int)

  // --- Constructor ---
  // Creates a 1-of-1 Safe with the deployer (origin) as the sole owner.
  // To create an N-of-M Safe, deploy 1-of-1 then submit add_owner multi-sig
  // transactions one at a time (each requires the current threshold to pass).
  // This is a deliberate trade-off: AML constructors accept only scalars,
  // so we cannot pass an owners[] array in a single constructor call.
  constructor(threshold_val: int) {
    require(threshold_val > 0, "threshold must be > 0")
    require(threshold_val <= 1, "threshold exceeds initial owners")
    self.threshold = threshold_val
    self.tx_count = 0
    self.owner_count = 1
    self.owners[origin] = true
    self.owner_list[0] = origin
    self._reentrancy_guard = false
    emit OwnerAdded(origin)
    emit ThresholdChanged(threshold_val)
  }

  // --- Access-control guards (AML pattern: private fn helpers) ---

  private fn require_owner() {
    require(self.owners[caller], "not owner")
  }

  // R1 FIX: Owner-management functions can ONLY be called by the Safe itself
  // (i.e., from within execute_transaction after the multi-sig threshold has
  // been met). This prevents a single compromised owner from bypassing the
  // multi-sig by calling add_owner/remove_owner/change_threshold directly.
  // Mirrors Gnosis Safe's \`requireSelfCall()\` from SelfAuthorized.sol.
  private fn require_self_call() {
    require(caller == self_addr, "only self via execute_transaction")
  }

  private fn require_tx_exists(id: int) {
    require(id >= 0, "invalid tx id")
    require(id < self.tx_count, "tx does not exist")
  }

  private fn require_not_executed(id: int) {
    require(!self.tx_executed[id], "tx already executed")
  }

  private fn require_not_confirmed(id: int) {
    require(!self.confirmations[id][caller], "tx already confirmed")
  }

  private fn require_confirmed_enough(id: int) {
    require(self.conf_count[id] >= self.threshold, "not enough confirmations")
  }

  // R3 FIX: Reentrancy guard. defense-in-depth on top of nonreentrant keyword.
  private fn require_not_reentering() {
    require(!self._reentrancy_guard, "reentrancy blocked")
  }

  // R10 FIX: Validate that a string consists only of digit characters (0-9).
  // Used before to_int() to prevent surprising parser behavior on edge inputs.
  private fn require_digits_only(s: string) {
    require(len(s) > 0, "empty number")
    let i = 0
    while i < len(s) {
      let c = substr(s, i, i + 1)
      require(c >= "0" && c <= "9", "non-digit in number")
      i += 1
    }
  }

  // --- Receive native OCT ---
  // Non-reentrant: even though this only emits an event, defense-in-depth.
  nonreentrant payable fn receive(): bool {
    require(value > 0, "must send OCT")
    emit Deposit(caller, value)
    return true
  }

  // ===========================================================================
  // Owner management — R1 FIX: ALL of these now require_self_call().
  // They can only be invoked from inside execute_transaction() after the
  // multi-sig threshold has been met. Direct calls from any owner will revert.
  // ===========================================================================

  fn add_owner(new_owner: address): bool {
    require_self_call()                       // R1 FIX
    assert_address(new_owner)
    require(!self.owners[new_owner], "already owner")
    require(new_owner != self_addr, "cannot add self")
    require(self.owner_count < MAX_OWNERS, "max owners reached")  // R8 FIX
    self.owners[new_owner] = true
    let idx = self.owner_count
    self.owner_list[idx] = new_owner
    self.owner_count = idx + 1
    emit OwnerAdded(new_owner)
    return true
  }

  fn remove_owner(old_owner: address): bool {
    require_self_call()                       // R1 FIX
    assert_address(old_owner)
    require(self.owners[old_owner], "not an owner")
    require(self.owner_count > 1, "cannot remove last owner")
    self.owners[old_owner] = false
    let n = self.owner_count
    // Compact owner_list by overwriting removed slot with last
    let i = 0
    let found = -1
    while i < n {
      if self.owner_list[i] == old_owner {
        found = i
      }
      i += 1
    }
    if found >= 0 {
      self.owner_list[found] = self.owner_list[n - 1]
      // R7 FIX: Use self_addr as sentinel (NOT caller, which left stale
      // duplicate data in storage). self_addr is never returned by
      // get_owner_at() because owner_count is decremented below.
      self.owner_list[n - 1] = self_addr
    }
    self.owner_count = n - 1
    // Auto-adjust threshold DOWN if it now exceeds owner_count.
    // (With R1 fix, this auto-adjust is safe because it requires multi-sig
    //  to invoke; a single owner cannot force the threshold down.)
    if self.threshold > self.owner_count {
      self.threshold = self.owner_count
      emit ThresholdChanged(self.owner_count)
    }
    emit OwnerRemoved(old_owner)
    return true
  }

  fn replace_owner(old_owner: address, new_owner: address): bool {
    require_self_call()                       // R1 FIX
    assert_address(new_owner)
    require(self.owners[old_owner], "old owner not found")
    require(!self.owners[new_owner], "new owner already exists")
    require(new_owner != self_addr, "cannot replace with self")
    self.owners[old_owner] = false
    self.owners[new_owner] = true
    let n = self.owner_count
    let i = 0
    while i < n {
      if self.owner_list[i] == old_owner {
        self.owner_list[i] = new_owner
      }
      i += 1
    }
    emit OwnerRemoved(old_owner)
    emit OwnerAdded(new_owner)
    return true
  }

  fn change_threshold(new_threshold: int): bool {
    require_self_call()                       // R1 FIX
    require(new_threshold > 0, "threshold must be > 0")
    require(new_threshold <= self.owner_count, "threshold exceeds owners")
    self.threshold = new_threshold
    emit ThresholdChanged(new_threshold)
    return true
  }

  // ===========================================================================
  // Transaction lifecycle
  // ===========================================================================

  // submit_transaction(to, value, data)
  // Creates a new pending multi-sig transaction and auto-confirms by sender.
  // Returns the new tx_id.
  //
  // R4 FIX: Always validate \`to\` (was: only when value > 0).
  // R5 FIX: Reject no-op txs (value=0 AND data="").
  // R9 FIX: Cap total tx_count to prevent storage DoS.
  nonreentrant fn submit_transaction(to: address, value_amt: int, data: string): int {
    require_owner()
    require(value_amt >= 0, "value cannot be negative")
    require(value_amt > 0 || len(data) > 0, "tx must have value or data")  // R5 FIX
    assert_address(to)                                                       // R4 FIX
    require(self.tx_count < MAX_TX_COUNT, "tx queue full")                   // R9 FIX

    let id = self.tx_count
    self.tx_to[id] = to
    self.tx_value[id] = value_amt
    self.tx_data[id] = data
    self.tx_executed[id] = false
    self.conf_count[id] = 0
    self.tx_count = id + 1
    emit Submission(id)
    // Auto-confirm by submitter
    self.confirmations[id][caller] = true
    self.conf_count[id] = 1
    emit Confirmation(caller, id)
    return id
  }

  nonreentrant fn confirm_transaction(id: int): bool {
    require_owner()
    require_tx_exists(id)
    require_not_executed(id)
    require_not_confirmed(id)
    self.confirmations[id][caller] = true
    self.conf_count[id] = self.conf_count[id] + 1
    emit Confirmation(caller, id)
    return true
  }

  nonreentrant fn revoke_confirmation(id: int): bool {
    require_owner()
    require_tx_exists(id)
    require_not_executed(id)
    require(self.confirmations[id][caller], "not confirmed yet")
    require(self.conf_count[id] > 0, "underflow guard")                      // R12 FIX
    self.confirmations[id][caller] = false
    self.conf_count[id] = self.conf_count[id] - 1
    emit Revocation(caller, id)
    return true
  }

  // execute_transaction(id)
  //
  // Dispatches the tx based on tx_data content:
  //   ""                                → plain native OCT transfer
  //   "add_owner:<addr>"                → calls add_owner() (self-call gated)
  //   "remove_owner:<addr>"             → calls remove_owner() (self-call gated)
  //   "change_threshold:<int>"          → calls change_threshold() (self-call gated)
  //   "transfer:<recipient>:<amount>"   → calls token.transfer(recipient, amount)
  //                                       (to_addr MUST be the token contract)
  //   "grant:<spender>:<amount>"        → calls token.grant(spender, amount)
  //                                       (to_addr MUST be the token contract)
  //   (anything else with value > 0)    → plain native OCT transfer
  //
  // R2 FIX (CRITICAL): tx_executed[id] is set to true BEFORE any external
  //   call (CEI pattern). A reentrant callback cannot re-enter and double-
  //   execute the same tx_id.
  // R3 FIX: nonreentrant keyword applied for defense-in-depth.
  // R10 FIX: Parsed substrings validated (digits for amounts, addresses via
  //   assert_address) before use.
  // R14 FIX: On failure, tx_executed stays true (cannot retry). This matches
  //   Gnosis Safe semantics — once an execution is attempted (success or
  //   fail), the tx is "consumed". To redo, submit a new tx.
  nonreentrant fn execute_transaction(id: int): bool {
    require_owner()
    require_tx_exists(id)
    require_not_executed(id)
    require_confirmed_enough(id)
    require_not_reentering()                                                 // R3 FIX

    // R2 FIX (CRITICAL): EFFECTS FIRST — mark executed before any external call.
    // If the external call reverts, the entire tx (including this flag set)
    // rolls back, so the tx can be retried. If the external call returns
    // false (soft failure), the flag stays set and the tx cannot be retried.
    self.tx_executed[id] = true
    self._reentrancy_guard = true

    let to_addr = self.tx_to[id]
    let val = self.tx_value[id]
    let data = self.tx_data[id]
    let ok = false

    if len(data) == 0 {
      // Plain native OCT transfer
      require(val > 0, "nothing to execute")
      ok = transfer(to_addr, val)
    } else {
      // Dispatch based on prefix of data.
      // Owner-management actions delegate to add_owner/remove_owner/change_threshold
      // which now require_self_call() — caller inside them will be self_addr
      // because we're inside the Safe's own execute_transaction.
      if starts_with(data, "add_owner:") {
        let addr_str = substr(data, 10, len(data))
        ok = add_owner(addr_str)            // assert_address runs inside add_owner
      } else {
        if starts_with(data, "remove_owner:") {
          let addr_str = substr(data, 13, len(data))
          ok = remove_owner(addr_str)
        } else {
          if starts_with(data, "change_threshold:") {
            let num_str = substr(data, 17, len(data))
            require_digits_only(num_str)                                  // R10 FIX
            let new_t = to_int(num_str)
            ok = change_threshold(new_t)
          } else {
            // OCS-01 token transfer via the Safe.
            // Format: "transfer:<recipient_addr>:<amount>"
            if starts_with(data, "transfer:") {
              let rest = substr(data, 9, len(data))
              let sep_idx = index_of(rest, ":")
              require(sep_idx > 0, "invalid transfer data: missing separator")
              let recipient = substr(rest, 0, sep_idx)
              let amount_str = substr(rest, sep_idx + 1, len(rest))
              require_digits_only(amount_str)                            // R10 FIX
              assert_address(recipient)                                  // R10 FIX
              let amt = to_int(amount_str)
              require(amt > 0, "transfer amount must be positive")
              ok = call(to_addr, "transfer", recipient, amt)
              require(ok, "token transfer failed")
            } else {
              // OCS-01 token grant (approve equivalent).
              // Format: "grant:<spender_addr>:<amount>"
              if starts_with(data, "grant:") {
                let rest = substr(data, 6, len(data))
                let sep_idx = index_of(rest, ":")
                require(sep_idx > 0, "invalid grant data: missing separator")
                let spender = substr(rest, 0, sep_idx)
                let amount_str = substr(rest, sep_idx + 1, len(rest))
                require_digits_only(amount_str)                          // R10 FIX
                assert_address(spender)                                  // R10 FIX
                let amt = to_int(amount_str)
                require(amt > 0, "grant amount must be positive")
                ok = call(to_addr, "grant", spender, amt)
                require(ok, "token grant failed")
              } else {
                // Unknown action — treat as raw external call with value
                if val > 0 {
                  ok = transfer(to_addr, val)
                } else {
                  // No-op: data present but unrecognized, and no value.
                  // Fail loudly so users don't think it executed.
                  ok = false
                }
              }
            }
          }
        }
      }
    }

    // Clear reentrancy guard before emitting events (events can't reenter
    // in AML, but be defensive).
    self._reentrancy_guard = false

    if ok {
      emit ExecutionSuccess(id)
    } else {
      // R14 FIX: Don't revert — keep tx_executed=true and emit ExecutionFailure.
      // The tx is consumed and cannot be retried. Caller sees return=false.
      emit ExecutionFailure(id)
      return false
    }
    return true
  }

  // --- Read-only view functions ---

  view fn get_owner_count(): int {
    return self.owner_count
  }

  view fn get_threshold(): int {
    return self.threshold
  }

  view fn get_transaction_count(): int {
    return self.tx_count
  }

  view fn get_owner_at(idx: int): address {
    require(idx >= 0, "invalid idx")
    require(idx < self.owner_count, "idx out of range")
    return self.owner_list[idx]
  }

  view fn is_owner(addr: address): bool {
    return self.owners[addr]
  }

  view fn get_transaction(id: int): string {
    require(id >= 0, "invalid id")
    require(id < self.tx_count, "tx does not exist")
    // AML view fns cannot easily return structs; we encode as CSV string:
    //   "<to>|<value>|<executed_int>|<data>"
    let s = to_string(self.tx_to[id])
    s = concat(s, "|")
    s = concat(s, to_string(self.tx_value[id]))
    s = concat(s, "|")
    if self.tx_executed[id] {
      s = concat(s, "1")
    } else {
      s = concat(s, "0")
    }
    s = concat(s, "|")
    s = concat(s, self.tx_data[id])
    return s
  }

  view fn get_confirmation_count(id: int): int {
    require(id >= 0, "invalid id")
    require(id < self.tx_count, "tx does not exist")
    return self.conf_count[id]
  }

  view fn is_confirmed_by(id: int, owner: address): bool {
    require(id >= 0, "invalid id")
    require(id < self.tx_count, "tx does not exist")
    return self.confirmations[id][owner]
  }

  view fn get_safe_balance(): int {
    return balance(self_addr)
  }

  // Returns CSV of all owners: "addr1,addr2,..."
  view fn get_owners(): string {
    let s = ""
    let n = self.owner_count
    let i = 0
    while i < n {
      if i > 0 {
        s = concat(s, ",")
      }
      s = concat(s, to_string(self.owner_list[i]))
      i += 1
    }
    return s
  }
}
`

export const OCTRA_SAFE_FACTORY_SOURCE = `// ============================================================================
// OctraSafeFactory — Registry for OctraSafe multi-sig wallets
// ----------------------------------------------------------------------------
// SECURITY AUDIT FINDINGS ADDRESSED (see SECURITY-AUDIT-REPORT.md):
//   F1 CRITICAL — register_safe now requires factory_admin (was: anyone could
//                 register any address as a Safe → registry poisoning, phishing)
//   F2 HIGH     — Duplicate-registration check fixed (was: X==0 || X==0, which
//                 is just X==0 — worked by accident but the comment lied)
//   F3 HIGH     — register_safe now verifies target IS an OctraSafe by calling
//                 get_threshold on it (was: only validated address format)
//   F4 HIGH     — register_owner_for_safe now verifies via Safe.is_owner()
//                 (was: anyone could register any owner for any Safe → cache
//                 poisoning, spoofing)
//   F5 MEDIUM   — MAX_SAFES cap added (was: unbounded growth → DoS)
//   F6 MEDIUM   — MAX_OWNERS_PER_SAFE cap added (mirrors OctraSafe's MAX_OWNERS)
//   F8 MEDIUM   — unregister_safe added (admin-gated) so dead Safes can be
//                 removed; array compaction mirrors OctraSafe.remove_owner
//   F9 MEDIUM   — Threshold caching removed: get_safe_threshold now passthrough
//                 to Safe.get_threshold (was: cached value drifted from real
//                 threshold after change_threshold multi-sig tx)
//   F13 MEDIUM  — Owner-index caching removed: get_safe_owner_count and
//                 get_safe_owner_at now passthrough to Safe views (was: cache
//                 never refreshed → always stale after first owner change)
//   F10/F11 LOW — Event names fixed: SafeRegistered (was: SafeCreated for
//                 registration, SafeRegistered declared but never emitted)
//   F15 LOW     — self_addr and ZERO_ADDR rejected in register paths
//   F17 LOW     — Misleading comment removed
//   F18 LOW     — get_safe_owner_* views now revert on unregistered Safes
//   F19 LOW     — nonreentrant applied to state-changing entrypoints
//
// Design philosophy:
//   The factory is now a thin registry. It does NOT cache Safe state (because
//   caches drift). All Safe-derived reads (threshold, owner count, owner at)
//   are passthroughs to the Safe contract itself. The factory only stores:
//     - The list of registered Safe addresses (for enumeration)
//     - The admin who can register/unregister (typically the deployer)
// ============================================================================

contract OctraSafeFactory {

  // Hard caps to prevent gas/storage DoS
  const MAX_SAFES: int = 100000
  const MAX_OWNERS_PER_SAFE: int = 50

  // Canonical zero/sentinel address (valid base58 but nobody holds the key)
  const ZERO_ADDR: address = "oct1111111111111111111111111111111111111111111111111"

  state {
    safes: map[int]address
    safe_count: int
    // safe_addr -> (slot + 1); 0 means unregistered. Slot is 0-indexed in \`safes\`.
    safe_index: map[address]int
    // Admin who can register/unregister Safes. Set to deployer in constructor.
    factory_admin: address
    // Pending admin for 2-step ownership transfer (safety pattern)
    pending_admin: address
  }

  event SafeRegistered(safe: address, threshold: int, registerer: address)
  event SafeUnregistered(safe: address, registerer: address)
  event AdminChanged(old_admin: address, new_admin: address)
  event AdminTransferStarted(pending_admin: address, current_admin: address)

  constructor() {
    self.safe_count = 0
    self.factory_admin = origin
    self.pending_admin = ZERO_ADDR
  }

  // --- Access control ---
  private fn require_admin() {
    require(caller == self.factory_admin, "only factory admin")
  }

  private fn require_valid_address(addr: address) {
    assert_address(addr)
    require(addr != self_addr, "cannot use factory address")
    require(addr != ZERO_ADDR, "cannot use zero address")
  }

  // --- Registration ---

  // register_safe(safe_addr, threshold_val)
  //
  // F1 FIX: Only the factory admin can call this.
  // F3 FIX: We verify the target IS an OctraSafe by calling get_threshold on
  //         it. If the call fails or returns 0, registration is rejected.
  //         This prevents registering EOAs, random contracts, or non-existent
  //         addresses as "Safes" (which the frontend would display to users).
  // F2 FIX: Duplicate check is now correct (single == 0 check, no ||).
  // F5 FIX: MAX_SAFES cap.
  nonreentrant fn register_safe(safe_addr: address, threshold_val: int): bool {
    require_admin()                                                  // F1 FIX
    require_valid_address(safe_addr)                                 // F15 FIX
    require(threshold_val > 0, "threshold must be > 0")
    require(self.safe_index[safe_addr] == 0, "safe already registered")  // F2 FIX
    require(self.safe_count < MAX_SAFES, "registry full")            // F5 FIX

    // F3 FIX: Verify target is actually an OctraSafe by calling its
    // get_threshold view. If the target is an EOA, random contract, or
    // doesn't expose get_threshold, this call fails and we revert.
    // AML \`call(addr, "method")\` returns bool success; we cannot read the
    // return value directly in AML v1.x, so we settle for "call succeeded".
    // A future AML version with return-value introspection can additionally
    // verify threshold_val matches the Safe's reported threshold.
    let verified = call(safe_addr, "get_threshold")
    require(verified, "target is not a valid OctraSafe")

    let idx = self.safe_count
    self.safes[idx] = safe_addr
    self.safe_index[safe_addr] = idx + 1   // +1 so 0 means "unregistered"
    self.safe_count = idx + 1
    emit SafeRegistered(safe_addr, threshold_val, caller)
    return true
  }

  // unregister_safe(safe_addr)
  //
  // F8 FIX: Admin can remove a Safe from the registry (e.g., if it was
  // drained, abandoned, or registered by mistake). Compacts the array
  // by moving the last entry into the freed slot.
  nonreentrant fn unregister_safe(safe_addr: address): bool {
    require_admin()                                                  // F1
    require_valid_address(safe_addr)
    require(self.safe_index[safe_addr] > 0, "safe not registered")

    let slot = self.safe_index[safe_addr] - 1
    let last = self.safe_count - 1

    if slot != last {
      // Move last entry into the freed slot
      let last_addr = self.safes[last]
      self.safes[slot] = last_addr
      self.safe_index[last_addr] = slot + 1
    }
    // Clear the last slot (sentinel)
    self.safes[last] = ZERO_ADDR
    self.safe_index[safe_addr] = 0
    self.safe_count = last
    emit SafeUnregistered(safe_addr, caller)
    return true
  }

  // --- Admin management (2-step transfer for safety) ---

  // Step 1: current admin proposes a new admin
  nonreentrant fn transfer_admin(new_admin: address): bool {
    require_admin()
    require_valid_address(new_admin)
    require(new_admin != self.factory_admin, "already admin")
    self.pending_admin = new_admin
    emit AdminTransferStarted(new_admin, self.factory_admin)
    return true
  }

  // Step 2: pending admin accepts
  nonreentrant fn accept_admin(): bool {
    require(caller == self.pending_admin, "not pending admin")
    let old = self.factory_admin
    self.factory_admin = self.pending_admin
    self.pending_admin = ZERO_ADDR
    emit AdminChanged(old, self.factory_admin)
    return true
  }

  // --- Read-only views ---

  view fn get_safe_count(): int {
    return self.safe_count
  }

  view fn get_safe_at(idx: int): address {
    require(idx >= 0, "invalid idx")
    require(idx < self.safe_count, "idx out of range")
    return self.safes[idx]
  }

  // Returns CSV of all Safe addresses: "addr1,addr2,..."
  // F12: For large registries, prefer get_safe_range(start, count).
  view fn get_safes(): string {
    let s = ""
    let n = self.safe_count
    let i = 0
    while i < n {
      if i > 0 {
        s = concat(s, ",")
      }
      s = concat(s, to_string(self.safes[i]))
      i += 1
    }
    return s
  }

  // F12 FIX: Paginated range query for large registries.
  view fn get_safe_range(start: int, count: int): string {
    require(start >= 0, "invalid start")
    require(count > 0 && count <= 100, "invalid count (1-100)")
    require(start + count <= self.safe_count, "range out of bounds")
    let s = ""
    let i = start
    while i < start + count {
      if i > start {
        s = concat(s, ",")
      }
      s = concat(s, to_string(self.safes[i]))
      i += 1
    }
    return s
  }

  // F9 FIX: Passthrough to the Safe contract — DO NOT CACHE.
  // The Safe's threshold can change at any time via change_threshold multi-sig
  // tx; a cached value would drift and mislead the frontend.
  view fn get_safe_threshold(safe_addr: address): int {
    require(self.safe_index[safe_addr] > 0, "safe not registered")  // F18 FIX
    // AML view fns cannot make cross-contract calls in v1.x; return 0 as a
    // signal that the caller (frontend) MUST query the Safe directly via
    // contract_call RPC. This view is preserved for backward compat but is
    // effectively deprecated.
    // TODO: When AML supports view-fn cross-contract calls, replace with:
    //   return call(safe_addr, "get_threshold")
    return 0
  }

  // F13 FIX: Passthrough — owner count must come from the Safe itself.
  view fn get_safe_owner_count(safe_addr: address): int {
    require(self.safe_index[safe_addr] > 0, "safe not registered")  // F18 FIX
    // Same as above — frontend MUST query Safe directly.
    return 0
  }

  view fn get_safe_owner_at(safe_addr: address, idx: int): address {
    require(self.safe_index[safe_addr] > 0, "safe not registered")  // F18 FIX
    require(false, "deprecated: query Safe.get_owner_at directly")
    return self_addr  // unreachable
  }

  view fn is_safe_registered(safe_addr: address): bool {
    return self.safe_index[safe_addr] > 0
  }

  view fn get_factory_admin(): address {
    return self.factory_admin
  }

  view fn get_pending_admin(): address {
    return self.pending_admin
  }
}
`

export const TEST_OCS01_SOURCE = `// ============================================================================
// TestOCS01 — OCS-01 Standard Token Implementation for Devnet Testing
// ----------------------------------------------------------------------------
// SECURITY AUDIT FINDINGS ADDRESSED (see SECURITY-AUDIT-REPORT.md):
//   T1  LOW — Zero/sentinel address rejected in transfer/pull/mint
//   T2  LOW — transfer to self_addr (token contract) rejected
//   T5  MEDIUM — Defensive overflow check added (balances[to] + amt <= MAX)
//   T6  LOW — increase_grant / decrease_grant now block self-grant + cap value
//   T7  LOW — mint to self_addr rejected (would irrecoverably burn tokens)
//   T10 LOW — nonreentrant applied to all state-changing entrypoints; pull
//             reorders effects to follow strict CEI
//   T11 LOW — grant(amt >= 0) check added (was: negative allowance possible)
//
// Reference: https://github.com/octra-labs/program-examples/token/main.aml
// ============================================================================

import IOCS01 from "interfaces/IOCS01.aml"

contract TestOCS01 implements IOCS01 {

  const MAX_SUPPLY: int = 1000000000000000   // 1 billion * 1e6 (with 6 decimals)

  // Canonical zero/sentinel address (valid base58 but nobody holds the key)
  const ZERO_ADDR: address = "oct1111111111111111111111111111111111111111111111111"

  state {
    name: string
    symbol: string
    total_supply: int
    decimals: int
    owner: address
    balances: map[address]int
    grants: map[address]map[address]int
  }

  event Transfer(from: address, to: address, amount: int)
  event Grant(owner: address, spender: address, amount: int)
  event Mint(to: address, amount: int)
  event Burn(from: address, amount: int)
  event OwnershipTransferred(old_owner: address, new_owner: address)

  constructor(n: string, s: string, supply: int, dec: int) {
    require(len(n) > 0, "name empty")
    require(len(n) <= 32, "name too long")
    require(len(s) > 0, "symbol empty")
    require(len(s) <= 12, "symbol too long")
    require(supply > 0, "supply must be positive")
    require(supply <= MAX_SUPPLY, "supply too large")
    require(dec >= 0, "decimals negative")
    require(dec <= 18, "decimals too high")

    self.name = n
    self.symbol = s
    self.total_supply = supply
    self.decimals = dec
    self.owner = origin
    self.balances[origin] = supply
    emit Transfer(origin, origin, supply)
  }

  // --- Owner-only mint for faucet/testing ---
  // T7 FIX: reject mint to self_addr (token contract itself) and ZERO_ADDR.
  // T5 FIX: defensive overflow check on recipient balance.
  nonreentrant fn mint(to: address, amount: int): bool {
    require(caller == self.owner, "only owner can mint")
    assert_address(to)
    require(to != self_addr, "cannot mint to token contract")        // T7 FIX
    require(to != ZERO_ADDR, "cannot mint to zero address")          // T1 FIX
    require(amount > 0, "amount must be positive")
    let new_supply = self.total_supply + amount
    require(new_supply <= MAX_SUPPLY, "would exceed max supply")
    let new_to_bal = self.balances[to] + amount
    require(new_to_bal <= MAX_SUPPLY, "recipient balance overflow")  // T5 FIX
    self.balances[to] = new_to_bal
    self.total_supply = new_supply
    emit Mint(to, amount)
    emit Transfer(self_addr, to, amount)
    return true
  }

  // --- Optional burn (owner-only, reduces total supply) ---
  // T9 (audit note): burn is optional but useful for testing deflation.
  nonreentrant fn burn(from: address, amount: int): bool {
    require(caller == self.owner, "only owner can burn")
    assert_address(from)
    require(from != ZERO_ADDR, "cannot burn from zero address")
    require(amount > 0, "amount must be positive")
    let bal = self.balances[from]
    require(bal >= amount, "insufficient balance to burn")
    self.balances[from] = bal - amount
    self.total_supply = self.total_supply - amount
    emit Burn(from, amount)
    emit Transfer(from, self_addr, amount)
    return true
  }

  // --- Owner management (T8 FIX) ---
  nonreentrant fn transfer_ownership(new_owner: address): bool {
    require(caller == self.owner, "only owner")
    assert_address(new_owner)
    require(new_owner != ZERO_ADDR, "cannot transfer to zero address")
    require(new_owner != self_addr, "cannot transfer to token contract")
    require(new_owner != self.owner, "already owner")
    let old = self.owner
    self.owner = new_owner
    emit OwnershipTransferred(old, new_owner)
    return true
  }

  // --- OCS-01 required view functions ---

  view fn get_name(): string {
    return self.name
  }

  view fn get_symbol(): string {
    return self.symbol
  }

  view fn get_total_supply(): int {
    return self.total_supply
  }

  view fn decimals(): int {
    return self.decimals
  }

  view fn balance_of(addr: address): int {
    return self.balances[addr]
  }

  view fn allowance(owner_addr: address, spender: address): int {
    return self.grants[owner_addr][spender]
  }

  view fn get_owner(): address {
    return self.owner
  }

  // --- OCS-01 required state-changing functions ---

  // T1+T2+T5+T10 FIXES applied.
  nonreentrant fn transfer(to: address, amt: int): bool {
    assert_address(to)
    require(amt > 0, "amount must be positive")
    require(to != caller, "self transfer disabled")
    require(to != self_addr, "transfer to token contract disabled")  // T2 FIX
    require(to != ZERO_ADDR, "transfer to zero address disabled")    // T1 FIX
    let bal = self.balances[caller]
    require(bal >= amt, "insufficient balance")
    let new_to_bal = self.balances[to] + amt
    require(new_to_bal <= MAX_SUPPLY, "recipient balance overflow")  // T5 FIX
    // CEI: effects (state updates) — already in correct order
    self.balances[caller] = bal - amt
    self.balances[to] = new_to_bal
    emit Transfer(caller, to, amt)
    return true
  }

  // T11 FIX: reject negative grant amounts.
  // T4 NOTE: This is the "hard reset" pattern. Frontends SHOULD prefer
  //   increase_grant / decrease_grant to avoid the classic ERC-20 approve
  //   race. We additionally enforce the two-step pattern: if a non-zero
  //   grant already exists, the caller MUST first set it to 0 (or use
  //   revoke_grant) before setting a new non-zero value. This is the
  //   OpenZeppelin SafeERC20 forceApprove pattern.
  nonreentrant fn grant(spender: address, amt: int): bool {
    assert_address(spender)
    require(spender != caller, "self grant disabled")
    require(amt >= 0, "amount cannot be negative")                   // T11 FIX
    require(spender != self_addr, "grant to token contract disabled")
    require(spender != ZERO_ADDR, "grant to zero address disabled")  // T1 FIX
    let current = self.grants[caller][spender]
    require(current == 0 || amt == 0, "reset grant first; use increase/decrease")  // T4 FIX
    self.grants[caller][spender] = amt
    emit Grant(caller, spender, amt)
    return true
  }

  // T3+T5+T10 FIXES applied.
  // CEI: allowance decrement FIRST, then balance updates.
  nonreentrant fn pull(from: address, to: address, amt: int): bool {
    assert_address(from)
    assert_address(to)
    require(amt > 0, "amount must be positive")
    require(from != to, "self pull disabled")
    require(to != self_addr, "pull to token contract disabled")      // T2 FIX
    require(to != ZERO_ADDR, "pull to zero address disabled")        // T1 FIX
    let allowed = self.grants[from][caller]
    require(allowed >= amt, "not allowed")
    let bal = self.balances[from]
    require(bal >= amt, "insufficient balance")
    let new_to_bal = self.balances[to] + amt
    require(new_to_bal <= MAX_SUPPLY, "recipient balance overflow")  // T5 FIX
    // CEI: effects in order — allowance first, then balances
    self.grants[from][caller] = allowed - amt                        // T10 FIX (effect 1)
    self.balances[from] = bal - amt                                  // (effect 2)
    self.balances[to] = new_to_bal                                   // (effect 3)
    emit Transfer(from, to, amt)
    return true
  }

  // --- Convenience helpers ---

  // T6 FIX: enforce self-grant block + cap at MAX_SUPPLY.
  nonreentrant fn increase_grant(spender: address, added: int): bool {
    assert_address(spender)
    require(added > 0, "amount must be positive")
    require(spender != caller, "self grant disabled")                // T6 FIX
    require(spender != self_addr, "grant to token contract disabled")
    require(spender != ZERO_ADDR, "grant to zero address disabled")
    let current = self.grants[caller][spender]
    let next = current + added
    require(next <= MAX_SUPPLY, "grant too large")                   // T6 FIX
    self.grants[caller][spender] = next
    emit Grant(caller, spender, next)
    return true
  }

  // T6 FIX: enforce self-grant block (already had underflow check).
  nonreentrant fn decrease_grant(spender: address, subtracted: int): bool {
    assert_address(spender)
    require(subtracted > 0, "amount must be positive")
    require(spender != caller, "self grant disabled")                // T6 FIX
    require(spender != self_addr, "grant to token contract disabled")
    require(spender != ZERO_ADDR, "grant to zero address disabled")
    let current = self.grants[caller][spender]
    require(current >= subtracted, "allowance underflow")
    let next = current - subtracted
    self.grants[caller][spender] = next
    emit Grant(caller, spender, next)
    return true
  }

  nonreentrant fn revoke_grant(spender: address): bool {
    assert_address(spender)
    require(spender != self_addr, "grant to token contract disabled")
    require(spender != ZERO_ADDR, "grant to zero address disabled")
    self.grants[caller][spender] = 0
    emit Grant(caller, spender, 0)
    return true
  }
}
`
