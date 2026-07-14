// ============================================================================
// components/wallet/AccountModal.tsx — Wallet create / import / unlock modal
// ============================================================================

import { useState } from 'react'
import { Wallet, Plus, Download, Key, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useWallet } from '@/hooks/useWallet'
import { loadEncryptedWallet } from '@/lib/signer'
import { classNames } from '@/utils/helpers'

type Tab = 'unlock' | 'create' | 'import-mnemonic' | 'import-key'

export function AccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createWallet, importFromMnemonic, importFromPrivateKey, unlock, isLoading } = useWallet()
  const [hasWallet] = useState(() => !!loadEncryptedWallet())
  const [tab, setTab] = useState<Tab>(hasWallet ? 'unlock' : 'create')

  // Form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdMnemonic, setCreatedMnemonic] = useState<string | null>(null)

  const reset = () => {
    setPassword('')
    setConfirmPassword('')
    setMnemonic('')
    setPrivateKey('')
    setError(null)
    setCreatedMnemonic(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleCreate = async () => {
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    try {
      const { mnemonic: newMnemonic } = await createWallet(password)
      setCreatedMnemonic(newMnemonic)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create wallet')
    }
  }

  const handleImportMnemonic = async () => {
    setError(null)
    const trimmed = mnemonic.trim()
    const words = trimmed.split(/\s+/)
    if (words.length !== 12 && words.length !== 24) {
      setError(`Mnemonic must be 12 or 24 words (got ${words.length})`)
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    try {
      await importFromMnemonic(trimmed, password)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import')
    }
  }

  const handleImportKey = async () => {
    setError(null)
    if (!privateKey.trim()) {
      setError('Private key is required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    try {
      await importFromPrivateKey(privateKey, password)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import')
    }
  }

  const handleUnlock = async () => {
    setError(null)
    if (!password) {
      setError('Password is required')
      return
    }
    try {
      await unlock(password)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock')
    }
  }

  // Show mnemonic after creation
  if (createdMnemonic) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Wallet Created" size="md">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-status-pending/10 border border-status-pending/30 flex gap-2">
            <AlertCircle className="h-5 w-5 text-status-pending shrink-0" />
            <div className="text-xs text-status-pending">
              <p className="font-semibold">Save your recovery phrase</p>
              <p className="mt-1">This is the ONLY time you will see this mnemonic. Write it down and store it safely. Without it, you cannot recover your wallet.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-bg-subtle border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">Recovery Phrase (12 words)</span>
              <button
                onClick={() => setShowMnemonic(!showMnemonic)}
                className="p-1 rounded hover:bg-bg-hover text-text-muted"
              >
                {showMnemonic ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
            <p className="font-mono text-sm text-text-primary leading-relaxed break-all">
              {showMnemonic ? createdMnemonic : '•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••'}
            </p>
          </div>

          <Button onClick={handleClose} className="w-full">
            I've saved my recovery phrase
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect Wallet" size="md">
      <div className="space-y-4">
        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-lg">
          {hasWallet && (
            <button
              onClick={() => { setTab('unlock'); setError(null) }}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors',
                tab === 'unlock' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Wallet className="h-3 w-3" /> Unlock
            </button>
          )}
          <button
            onClick={() => { setTab('create'); setError(null) }}
            className={classNames(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors',
              tab === 'create' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Plus className="h-3 w-3" /> New
          </button>
          <button
            onClick={() => { setTab('import-mnemonic'); setError(null) }}
            className={classNames(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors',
              tab === 'import-mnemonic' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Download className="h-3 w-3" /> Mnemonic
          </button>
          <button
            onClick={() => { setTab('import-key'); setError(null) }}
            className={classNames(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors',
              tab === 'import-key' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Key className="h-3 w-3" /> Key
          </button>
        </div>

        {/* Unlock existing */}
        {tab === 'unlock' && (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Enter your password to unlock your wallet.
            </p>
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightAdornment={
                <button onClick={() => setShowPassword(!showPassword)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            {error && <p className="text-xs text-status-failed">{error}</p>}
            <Button onClick={handleUnlock} isLoading={isLoading} className="w-full">
              Unlock Wallet
            </Button>
          </div>
        )}

        {/* Create new */}
        {tab === 'create' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20">
              <p className="text-xs text-text-secondary">
                A new ed25519 keypair will be generated. Your private key will be encrypted with your password and stored locally in this browser only — it never leaves your device.
              </p>
            </div>
            <Input
              label="Password (min 8 chars)"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightAdornment={
                <button onClick={() => setShowPassword(!showPassword)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            {error && <p className="text-xs text-status-failed">{error}</p>}
            <Button onClick={handleCreate} isLoading={isLoading} className="w-full">
              Create Wallet
            </Button>
          </div>
        )}

        {/* Import from mnemonic */}
        {tab === 'import-mnemonic' && (
          <div className="space-y-3">
            <Textarea
              label="Recovery Phrase (12 or 24 words)"
              placeholder="word1 word2 word3..."
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="min-h-[80px]"
            />
            <Input
              label="New password (min 8 chars)"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightAdornment={
                <button onClick={() => setShowPassword(!showPassword)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            {error && <p className="text-xs text-status-failed">{error}</p>}
            <Button onClick={handleImportMnemonic} isLoading={isLoading} className="w-full">
              Import Wallet
            </Button>
          </div>
        )}

        {/* Import from private key */}
        {tab === 'import-key' && (
          <div className="space-y-3">
            <Input
              label="Private Key (base64)"
              placeholder="base64-encoded ed25519 secret key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="font-mono text-xs"
            />
            <Input
              label="New password (min 8 chars)"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightAdornment={
                <button onClick={() => setShowPassword(!showPassword)} className="text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            {error && <p className="text-xs text-status-failed">{error}</p>}
            <Button onClick={handleImportKey} isLoading={isLoading} className="w-full">
              Import Wallet
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
