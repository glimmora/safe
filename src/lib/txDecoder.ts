// ============================================================================
// lib/txDecoder.ts — Decode Safe transactions into human-readable descriptions
// ----------------------------------------------------------------------------
// Given a Safe transaction (to, value, data), produce a human-readable string
// like:
//   "Send 100.000000 OCT to octABC..."
//   "Send 50.000000 TEST to octDEF..."
//   "Add owner octXYZ..."
//   "Remove owner octUVW..."
//   "Change threshold to 3"
//   "Custom call to octGHI"
// ============================================================================

import type { SafeTransaction, TokenInfo, TxKind } from '@/types'
import { decodeSafeTxAction, formatTokenAmount, formatOctAmount } from './ocs01'

// Build a human-readable description for a Safe tx.
// If tokenList is provided, we can resolve token symbols for transfers.
export function describeTransaction(
  tx: Pick<SafeTransaction, 'to' | 'value' | 'valueRaw' | 'data'>,
  tokenList: TokenInfo[] = []
): { description: string; kind: TxKind } {
  const action = decodeSafeTxAction(tx.to, tx.value, tx.data)

  switch (action.kind) {
    case 'native_transfer': {
      const amountStr = formatOctAmount(tx.valueRaw ?? String(tx.value))
      return {
        description: `Send ${amountStr} OCT to ${shortAddr(action.recipient ?? tx.to)}`,
        kind: 'native_transfer',
      }
    }
    case 'token_transfer': {
      const token = tokenList.find((t) => t.address === action.tokenAddress)
      const symbol = token?.symbol ?? 'TOKEN'
      const decimals = token?.decimals ?? 6
      const amountStr = formatTokenAmount(action.amount ?? 0, decimals)
      return {
        description: `Send ${amountStr} ${symbol} to ${shortAddr(action.recipient ?? '')}`,
        kind: 'token_transfer',
      }
    }
    case 'token_grant': {
      const token = tokenList.find((t) => t.address === action.tokenAddress)
      const symbol = token?.symbol ?? 'TOKEN'
      const decimals = token?.decimals ?? 6
      const amountStr = formatTokenAmount(action.amount ?? 0, decimals)
      return {
        description: `Approve ${shortAddr(action.spender ?? '')} to spend ${amountStr} ${symbol}`,
        kind: 'token_grant',
      }
    }
    case 'add_owner': {
      return {
        description: `Add owner ${shortAddr(action.newOwner ?? '')}`,
        kind: 'add_owner',
      }
    }
    case 'remove_owner': {
      return {
        description: `Remove owner ${shortAddr(action.oldOwner ?? '')}`,
        kind: 'remove_owner',
      }
    }
    case 'change_threshold': {
      return {
        description: `Change threshold to ${action.newThreshold}`,
        kind: 'change_threshold',
      }
    }
    case 'custom_call': {
      return {
        description: `Custom call to ${shortAddr(tx.to)}`,
        kind: 'custom_call',
      }
    }
    default:
      return {
        description: tx.data ? `Custom action: ${tx.data.slice(0, 40)}` : 'Unknown transaction',
        kind: 'unknown',
      }
  }
}

// Shorten an Octra address for display: "octABCD...wxyz"
export function shortAddr(addr: string, head = 8, tail = 6): string {
  if (!addr) return ''
  if (addr.length <= head + tail + 3) return addr
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`
}
