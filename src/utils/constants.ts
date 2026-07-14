// ============================================================================
// utils/constants.ts — App-wide constants
// ============================================================================

import { NETWORKS, DEFAULT_NETWORK } from '@/config/networks'

export const APP_NAME = 'Octra Safe'
export const APP_VERSION = '1.0.0'

export { NETWORKS, DEFAULT_NETWORK }

// UI constants
export const COPY_FEEDBACK_MS = 1500

// Octra-specific constants (kept here for convenience)
export const OCTRA_ADDRESS_LENGTH = 47
export const OCTRA_ADDRESS_PREFIX = 'oct'

// Default gas/fees (OU). `ou` is a bid/cap — actual fee depends on effort.
// 1 OCT = 1,000,000 OU. These are MAX caps; actual cost is typically much less.
// Recommended: query `octra_recommendedFee(op_type)` before submit.
export const DEFAULT_CALL_OU = '1000'        // ~0.001 OCT cap
export const DEFAULT_TRANSFER_OU = '10000'   // ~0.01 OCT cap
export const DEFAULT_DEPLOY_OU = '1000000'   // ~1 OCT cap (was 50M, lowered)

// Poll intervals
export const TX_POLL_INTERVAL_MS = 3000
export const TX_POLL_MAX_ATTEMPTS = 60

// Safe defaults
export const MAX_OWNERS = 50
export const MIN_THRESHOLD = 1
