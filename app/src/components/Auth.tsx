import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { keccak256 } from 'viem'

interface AuthProps {
  onAuthenticated: (address: string, signature: string, message: string) => void
}


/**
 * Derive an Ethereum address from an uncompressed secp256k1 public key.
 * pk must be hex string starting with "04" (65 bytes = 130 hex chars).
 */
function ethAddressFromPubKey(pkHex: string): string {
  // Remove the "04" prefix (uncompressed key marker)
  const rawKey = pkHex.startsWith('04') ? pkHex.slice(2) : pkHex
  const hash = keccak256(`0x${rawKey}` as `0x${string}`)
  return '0x' + hash.slice(-40) // last 20 bytes
}

export function Auth({ onAuthenticated }: AuthProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [haloAddress, setHaloAddress] = useState<string | null>(null)

  const handleTap = useCallback(async () => {
    setStatus('scanning')
    setError(null)

    try {
      // @ts-ignore - NDEFReader exists on Android Chrome
      if (typeof window.NDEFReader === 'undefined') {
        throw new Error('WebNFC is not supported on this device/browser. Use Chrome on Android.')
      }

      // @ts-ignore
      const reader = new window.NDEFReader()
      const ctrl = new AbortController()

      // Start scanning BEFORE the user taps — this CLAIMS the NFC reader
      // and prevents Android from intercepting the chip's NDEF URL record
      await reader.scan({ signal: ctrl.signal })
      console.log('[NFC] Reader claimed — waiting for chip tap...')

      const result = await new Promise<{ address: string; signature: string; message: string }>((resolve, reject) => {
        // Timeout after 60s
        const timeout = setTimeout(() => {
          ctrl.abort()
          reject(new Error('NFC scan timed out after 60s — try again'))
        }, 60000)

        // Abort if page goes hidden
        const handleVisibility = () => {
          if (document.hidden) {
            console.log('[NFC] Page hidden — aborting')
            clearTimeout(timeout)
            ctrl.abort()
            reject(new Error('Page went to background'))
          }
        }
        document.addEventListener('visibilitychange', handleVisibility)

        ctrl.signal.addEventListener('abort', () => {
          document.removeEventListener('visibilitychange', handleVisibility)
          clearTimeout(timeout)
        })

        reader.onreadingerror = () => {
          console.log('[NFC] Read error — tap the chip again')
          setError('Read error — tap the chip again firmly')
        }

        reader.onreading = (event: any) => {
          clearTimeout(timeout)
          document.removeEventListener('visibilitychange', handleVisibility)
          ctrl.abort()

          console.log('[NFC] NDEF record received!')

          try {
            // Parse the NDEF record — it's a URL like:
            // https://nfc.ethglobal.com/?...&pk1=04XXXX...&res=3046XXXX...
            const record = event.message.records[0]
            let url: string

            if (record.recordType === 'url') {
              const decoder = new TextDecoder()
              url = decoder.decode(record.data)
            } else if (record.recordType === 'unknown' || record.recordType === 'text') {
              const decoder = new TextDecoder()
              url = decoder.decode(record.data)
            } else {
              // Try to decode as text anyway
              const decoder = new TextDecoder()
              url = decoder.decode(record.data)
            }

            console.log('[NFC] Raw NDEF data:', url.slice(0, 100) + '...')

            // Parse URL params
            const parsed = new URL(url)
            const pk1 = parsed.searchParams.get('pk1')
            const res = parsed.searchParams.get('res')

            if (!pk1) {
              throw new Error('No public key (pk1) found in NDEF record')
            }

            const address = ethAddressFromPubKey(pk1)
            const signature = res || 'ndef-tap'
            const message = `ndef:${Date.now()}`

            console.log('[NFC] Derived address:', address)
            console.log('[NFC] Public key:', pk1.slice(0, 20) + '...')

            resolve({ address, signature, message })
          } catch (parseErr) {
            console.error('[NFC] Parse error:', parseErr)
            reject(parseErr)
          }
        }
      })

      setHaloAddress(result.address)
      setError(null)
      setStatus('idle')
      onAuthenticated(result.address, result.signature, result.message)

    } catch (err: unknown) {
      const errMsg = (err as any)?.message || String(err)
      console.error('[NFC] Error:', errMsg)

      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('idle')
        return
      }

      setError(errMsg)
      setStatus('error')
    }
  }, [onAuthenticated])

  return (
    <div className="space-y-2">
      <Button
        onClick={handleTap}
        variant={status === 'scanning' ? 'outline' : 'secondary'}
        className={`w-full ${status === 'scanning' ? 'border-blue-400 text-blue-400 animate-pulse' : ''}`}
        disabled={status === 'scanning'}
      >
        {status === 'scanning'
          ? '📡 Hold chip against phone now...'
          : '🏷️ Authenticate with NFC'}
      </Button>

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
