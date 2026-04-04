import { useState } from 'react'
import { execHaloCmdWeb } from '@arx-research/libhalo/api/web'
import { useSignMessage, useAccount } from 'wagmi'
import { Button } from './ui/button'

interface HaloAuthProps {
  onAuthenticated: (address: string, signature: string, message: string) => void
}

export function HaloAuth({ onAuthenticated }: HaloAuthProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [haloAddress, setHaloAddress] = useState<string | null>(null)

  const { signMessageAsync } = useSignMessage()
  const { address: connectedAddress } = useAccount()

  const handleTap = async () => {
    setStatus('scanning')
    setError(null)

    try {
      // Create SIWE-like message for the chip to sign
      const message = `crocheth:auth:${Date.now()}`
      const messageHex = Buffer.from(message).toString('hex')

      // A single sign command will return the signature, the public key, and the ether address.
      // This prevents NFCAbortedError caused by back-to-back NFC writes.
      const signResult = await execHaloCmdWeb({
        name: 'sign',
        message: messageHex,
        keyNo: 1,
      }) as { signature: { ether: string }, etherAddress: string }

      const address = signResult.etherAddress
      if (!address) throw new Error('No address returned from HaLo chip')

      setHaloAddress(address)
      setStatus('idle')
      onAuthenticated(address, signResult.signature.ether, message)
    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'NFC scan failed'
      // Ignore AbortError when user intentionally disconnects / unmounts
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle')
        return
      }
      setError(msg)
      console.error('HaLo error:', err)
    }
  }
  const handleEOASimulate = async () => {
    // Mimic the exact offchain signature output natively using the Browser Wallet
    if (!connectedAddress) {
      setError('Please connect your browser wallet first to authorize the test signature.')
      return
    }

    setStatus('scanning')
    try {
      const message = `crocheth:auth:${Date.now()}`
      const signature = await signMessageAsync({ message })
      
      setHaloAddress(connectedAddress)
      setStatus('idle')
      onAuthenticated(connectedAddress, signature, message)
    } catch (err: unknown) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Signature rejected')
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleTap}
        variant="secondary"
        className="w-full"
        disabled={status === 'scanning'}
      >
        {status === 'scanning'
          ? '📡 Tap your HaLo...'
          : '🏷️ Authenticate with HaLo NFC'}
      </Button>
      {import.meta.env.DEV && (
        <Button
          onClick={handleEOASimulate}
          variant="outline"
          className="w-full text-xs text-muted-foreground border-dashed"
          disabled={status === 'scanning'}
        >
          [DEV] Derive Burner via Wallet Signature
        </Button>
      )}

      {haloAddress && (
        <div 
          className="flex items-center gap-2 max-w-full"
          onClick={() => {
            navigator.clipboard.writeText(haloAddress)
            alert('Address copied: ' + haloAddress)
          }}
        >
          <span className="text-xs text-purple-400 font-mono truncate cursor-pointer bg-purple-400/10 p-1.5 rounded flex-1">
            ✓ HaLo: {haloAddress}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 cursor-pointer">
            📋 Copy
          </span>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive wrap-break-word max-h-32 overflow-y-auto w-full p-2 bg-destructive/10 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
