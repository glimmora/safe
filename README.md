# Octra Safe

A multi-signature wallet application for the **Octra blockchain**, similar to [safe.global](https://safe.global) but with the core feature set required for secure multi-sig management of OCT and OCS-01 tokens.

## ⚠️ Important: Octra is NOT EVM-compatible

Octra uses:
- **AML (AppliedML)** smart contract language (NOT Solidity)
- **ed25519 signatures** (NOT secp256k1 used by MetaMask)
- **base58 `oct...` addresses** (NOT `0x...` hex)
- **JSON-RPC 2.0** with custom `octra_*`, `contract_*` methods (NOT `eth_*`)
- **Plain JSON arrays** for contract args (NOT Solidity ABI encoding)

Because of these differences, **MetaMask cannot be used to sign Octra transactions**. Octra Safe ships with a built-in browser-based ed25519 wallet (keys generated/imported in-browser, encrypted with AES-GCM in localStorage — exactly the same security model as the official [octra-labs/webcli](https://github.com/octra-labs/webcli)).

## Tech Stack

- **Vite + React 18** (TypeScript)
- **Tailwind CSS** for styling (dark theme)
- **zustand** for state management
- **react-router-dom** for routing
- **tweetnacl** for ed25519 signing
- **bip39 + ed25519-hd-key** for HD wallet derivation
- **sonner** for toast notifications
- **lucide-react** for icons

## Project Structure

```
octra-safe/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── postcss.config.js
├── public/
│   └── favicon.svg
├── contracts/                         # AML smart contracts (deploy separately)
│   ├── interfaces/IOCS01.aml
│   ├── OctraSafe.aml
│   ├── OctraSafeFactory.aml
│   └── TestOCS01.aml
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── config/
    │   ├── networks.ts                # RPC URLs, explorer URLs per network
    │   ├── contracts.ts               # Deployed contract addresses (UPDATE AFTER DEPLOY)
    │   └── client.ts                  # RPC config & caching
    ├── hooks/
    │   ├── useWallet.ts               # Wallet create/import/unlock/sign/submit
    │   ├── useSafe.ts                 # Read Safe state (owners, threshold, txs)
    │   ├── useSafeTransactions.ts     # Pending & executed tx lists
    │   ├── useTokenBalance.ts         # OCS-01 balance reading
    │   ├── useNetworkSwitcher.ts      # Mainnet / devnet toggle
    │   └── useOctraScan.ts            # Explorer API helpers
    ├── lib/
    │   ├── rpc.ts                     # JSON-RPC 2.0 client (octra_* methods)
    │   ├── encoder.ts                 # Encode/decode AML function calls (JSON arrays)
    │   ├── signer.ts                  # ed25519 sign + AES-GCM wallet storage
    │   ├── ocs01.ts                   # OCS-01 helpers (transfer, grant, balance_of)
    │   ├── txDecoder.ts               # Human-readable tx descriptions
    │   └── contractSources.ts         # AML contract source as TS strings (for compile)
    ├── utils/
    │   ├── helpers.ts                 # truncate, format, copy, retry
    │   └── constants.ts
    ├── components/
    │   ├── layout/                    # Sidebar, Header, MobileNav, Layout
    │   ├── wallet/                    # ConnectButton, NetworkSwitcher, AccountModal
    │   ├── safe/                      # SafeCard, SafeList, OwnersList, SafeInfo, TokenBalances, CreateSafeForm
    │   ├── transaction/               # TransactionList, TransactionCard, TransactionDetail, NewTransactionForm, SendNativeForm, SendTokenForm, ConfirmButton
    │   ├── token/                     # TokenSelector, AddTokenModal
    │   ├── settings/                  # AddOwner, RemoveOwner, ChangeThreshold
    │   └── ui/                        # Button, Input, Modal, Badge, Card, Skeleton, EmptyState, AddressDisplay, Tabs, AmountInput
    ├── pages/
    │   ├── DashboardPage.tsx
    │   ├── CreateSafePage.tsx
    │   ├── SafeDetailPage.tsx
    │   └── NotFoundPage.tsx
    ├── stores/
    │   └── useAppStore.ts             # zustand global state
    └── types/
        └── index.ts                   # TypeScript types & constants
```

## Setup

### 1. Install dependencies

```bash
cd octra-safe
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Build for production

```bash
npm run build
npm run preview
```

The `dist/` folder can be deployed to Vercel, Netlify, or any static host.

## Deploying Smart Contracts to Octra Devnet

The OctraSafe app deploys Safe contracts **on-the-fly** from the frontend — the `CreateSafeForm` component compiles `OctraSafe.aml` via `octra_compileAmlMulti` RPC, computes the deterministic contract address, and submits a `op_type="deploy"` transaction. You do **not** need to run a separate deploy script for Safes.

However, the **TestOCS01 token** should be deployed once and its address hardcoded in `src/config/contracts.ts`.

### Deploy TestOCS01 token

1. **Open the official Octra web client** (recommended for first-time deploy):  
   Clone and run [octra-labs/webcli](https://github.com/octra-labs/webcli), or use the hosted version at https://wallet.octra.org if available.

2. **Connect to Devnet** in the web client settings:  
   RPC URL: `https://devnet.octrascan.io/rpc`

3. **Get devnet OCT** for gas — request from the Octra community (Telegram: `t.me/octra_chat_en`, Discord: `discord.gg/octra`) or use the wallet-generator at https://wallet.octra.org to create a fresh devnet-funded wallet.

4. **Open the AML IDE tab**, paste the contents of `contracts/interfaces/IOCS01.aml` and `contracts/TestOCS01.aml` (as a multi-file project), then click **Compile**.

5. **Deploy** with constructor params:  
   ```json
   ["TestOCS01", "TEST", 1000000000000, 6]
   ```
   - name: `"TestOCS01"`
   - symbol: `"TEST"`
   - supply: `1000000000000` (1,000,000 TEST with 6 decimals)
   - decimals: `6`

6. **Copy the deployed contract address** (looks like `oct...`, 47 chars).

7. **Update `src/config/contracts.ts`**:
   ```ts
   export const CONTRACT_ADDRESSES = {
     devnet: {
       factory: '',  // (OctraSafeFactory is optional — not strictly required)
       testToken: 'octYOUR_DEPLOYED_TEST_TOKEN_ADDRESS_HERE',
     },
     // ...
   }
   ```

8. **Add the token to the known list** in the same file:
   ```ts
   export const KNOWN_TOKENS = {
     devnet: [
       {
         address: 'octYOUR_DEPLOYED_TEST_TOKEN_ADDRESS_HERE',
         name: 'TestOCS01',
         symbol: 'TEST',
         decimals: 6,
       },
     ],
   }
   ```

9. **Mint tokens to your Safe** (after deploying a Safe):
   - As the token owner (deployer), call `mint(to, amount)` on the token contract, passing the Safe's address as `to`.

### Deploy Order Summary

1. Deploy **TestOCS01** token → update `contracts.ts`
2. Run the app → click **Create Safe** to deploy an OctraSafe
3. (Optional) Mint TEST tokens to your Safe via the web client
4. Add TEST to the Safe's token list via the "Add Token" UI (or it's auto-loaded from `contracts.ts`)

## Octra Network Configuration

| Property | Mainnet | Devnet |
|----------|---------|--------|
| RPC URL | `https://octra.network/rpc` | `https://devnet.octrascan.io/rpc` |
| Explorer | `https://octrascan.io` | `https://devnet.octrascan.io` |
| Native token | OCT (6 decimals) | OCT (6 decimals) |
| Atomic unit | OU (1 OCT = 1,000,000 OU) | OU |
| Default network | — | ✅ |

The app defaults to **Devnet**. Use the network switcher in the header to toggle.

## Features

### Wallet
- ✅ Generate ed25519 keypair with 12-word mnemonic (BIP-39 + SLIP-0010)
- ✅ Import wallet from mnemonic or base64 private key
- ✅ AES-GCM encrypted storage in localStorage (PBKDF2 150k iterations)
- ✅ Lock/unlock with password
- ✅ Auto-refresh balance & nonce every 30s

### Safe Management
- ✅ Deploy new multi-sig Safe (compiles AML on-the-fly)
- ✅ View Safe overview (balance, owners, threshold, pending tx count)
- ✅ Add/remove owners via multi-sig flow
- ✅ Change threshold via multi-sig flow
- ✅ Read-only mode for non-owners

### Transactions
- ✅ Submit native OCT transfer (via Safe)
- ✅ Submit OCS-01 token transfer (via Safe)
- ✅ Confirm transactions (other owners)
- ✅ Execute transactions (when threshold reached)
- ✅ Revoke own confirmation (before execution)
- ✅ Transaction queue (pending) & history (executed)
- ✅ Human-readable descriptions ("Send 100 TEST to octABCD...")
- ✅ Confirmation progress bar

### OCS-01 Token Support
- ✅ Token balance panel (auto-refreshes)
- ✅ Add custom token by address (fetches metadata via `get_name`/`get_symbol`/`decimals`)
- ✅ Token selector dropdown with balance display
- ✅ Send tokens via Safe multi-sig flow

### UI/UX
- ✅ Responsive: sidebar on PC, bottom nav on mobile, hamburger on tablet
- ✅ Dark theme (#0a0a0f bg, #3b82f6 / #06b6d4 accent)
- ✅ Inter font, rounded-xl cards, subtle shadows
- ✅ Toast notifications (sonner)
- ✅ Loading skeletons, spinners, empty states
- ✅ Copy-to-clipboard with feedback
- ✅ Address display with truncated view + explorer link
- ✅ Status badges (success/pending/failed)
- ✅ Confirmation modals with progress indicators

## Key Implementation Notes

### Why no MetaMask?
Octra uses ed25519 signatures, not secp256k1. MetaMask and other EVM wallets cannot sign Octra transactions. We use `tweetnacl-js` for ed25519 signing in the browser.

### Octra Transaction Format
Transactions are signed over a canonical JSON string with strict field order:
```
from, to_, amount, nonce, ou, timestamp, op_type, [encrypted_data,] [message,]
```
The signed payload is submitted via `octra_submit` JSON-RPC method.

### Contract Calls (vs Solidity ABI)
Octra does NOT use Solidity ABI encoding. Function arguments are passed as a plain JSON array of strings:
- `transfer(to, amount)` → `params = ["octAddr...", "1000"]`
- View calls use `contract_call(addr, method, [params], caller)` — no signature, no fee

### OCS-01 Naming
OCS-01 uses different names than ERC-20:
- `approve` → `grant`
- `transferFrom` → `pull`
- `balanceOf` → `balance_of`
- `name()` → `get_name()`
- `symbol()` → `get_symbol()`

## Known Limitations & TODOs

1. **OctraSafe `execute_transaction`** dispatches based on a string-prefix convention in `tx_data` (e.g. `"add_owner:oct..."`, `"transfer:oct...:1000"`). This is a simplification — production deployments may want a more robust encoding (e.g. JSON array parsed by AML).

2. **OctraSafeFactory** is mostly a registry; the actual Safe deployment is done by the frontend via `op_type="deploy"` because AML's `deploy()` builtin is flagged as "verify current surface" in the docs.

3. **`parse_address` and `parse_ints` builtins** in AML are referenced in `OctraSafe.aml` `execute_transaction` for parsing action strings — verify these exist in your target compiler version. If not, you'll need to refactor `execute_transaction` to use individual `call()` invocations per action type.

4. **No faucet integration** — users must obtain devnet OCT through Octra community channels or pre-funded wallets.

5. **No transaction history pagination** — currently fetches the first 50 transactions per Safe. For Safes with more activity, implement offset-based pagination.

6. **AML compiler version drift** — the AML syntax in `contracts/*.aml` is based on the current Octra docs (compiler `1.0 Rehovot`). Future compiler versions may require syntax updates.

7. **Owner count is capped at MAX_OWNERS** implicitly via the `owner_list` map; the contract doesn't enforce an explicit max.

8. **Network ID** — Octra does not have an EVM-style numeric chain ID. Network identification is via the `network_version` field returned by `node_status` RPC.

## Contributing

This is a reference implementation for the Octra ecosystem. Issues and PRs welcome at the project repository.

## License

MIT
