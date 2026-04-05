import { useState, useEffect, useCallback, useRef } from 'react'
import { Web3Wallet, type Web3WalletTypes } from '@walletconnect/web3wallet'
import { Core } from '@walletconnect/core'
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'
import { createWalletClient, http, hexToBytes } from 'viem'
import { baseSepolia } from 'viem/chains'
import { Button } from './ui/button'
import type { LocalAccount } from 'viem'
import jsQR from 'jsqr'

const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID as string

// Module-level singleton — prevents React StrictMode double-init
let _walletPromise: Promise<InstanceType<typeof Web3Wallet>> | null = null
function getWallet(origin: string) {
  if (!_walletPromise) {
    _walletPromise = (async () => {
      const core = new Core({ projectId: PROJECT_ID }) as any
      return Web3Wallet.init({
        core,
        metadata: {
          name: 'croch.eth',
          description: 'Anonymous wearable identity',
          url: origin,
          icons: [`${origin}/favicon.ico`],
        },
      })
    })()
  }
  return _walletPromise
}

interface WCWalletProps {
  burnerAccount: LocalAccount
}

type SessionStatus =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'pairing' }
  | { type: 'proposal'; proposal: Web3WalletTypes.SessionProposal }
  | { type: 'active'; topic: string; dapp: string; icon?: string }
  | { type: 'error'; message: string }

export function WCWallet({ burnerAccount }: WCWalletProps) {
  const [wallet, setWallet] = useState<InstanceType<typeof Web3Wallet> | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>({ type: 'idle' })
  const [isProcessing, setIsProcessing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  // Init WalletConnect Web3Wallet (singleton)
  useEffect(() => {
    let mounted = true
    getWallet(window.location.origin)
      .then(w => { if (mounted) setWallet(w) })
      .catch((e: any) => { if (mounted) setInitError(e?.message ?? 'WC init failed') })
    return () => { mounted = false }
  }, [])

  // WC event handlers
  useEffect(() => {
    if (!wallet) return

    const onProposal = (proposal: Web3WalletTypes.SessionProposal) => {
      setStatus({ type: 'proposal', proposal })
    }

    const onRequest = async (event: Web3WalletTypes.SessionRequest) => {
      const { topic, params, id } = event
      const { request } = params
      setIsProcessing(true)
      try {
        const wc = createWalletClient({
          account: burnerAccount,
          chain: baseSepolia,
          transport: http('https://base-sepolia-rpc.publicnode.com'),
        })
        let result: string
        switch (request.method) {
          case 'personal_sign':
          case 'eth_sign': {
            const msgHex = request.params[0] as `0x${string}`
            const raw = new TextDecoder().decode(hexToBytes(msgHex))
            result = await wc.signMessage({ message: raw })
            break
          }
          case 'eth_signTypedData':
          case 'eth_signTypedData_v4': {
            const typedData = JSON.parse(request.params[1] as string)
            result = await wc.signTypedData(typedData)
            break
          }
          case 'eth_sendTransaction': {
            const tx = request.params[0]
            result = await wc.sendTransaction({
              to: tx.to,
              value: tx.value ? BigInt(tx.value) : 0n,
              data: tx.data,
              gas: tx.gas ? BigInt(tx.gas) : undefined,
            })
            break
          }
          default:
            throw new Error(`Unsupported: ${request.method}`)
        }
        await wallet.respondSessionRequest({ topic, response: { id, jsonrpc: '2.0', result } })
        setIsProcessing(false)
      } catch (err: any) {
        await wallet.respondSessionRequest({
          topic,
          response: { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') }
        })
        setIsProcessing(false)
        setStatus({ type: 'error', message: err?.message ?? 'Failed' })
      }
    }

    wallet.on('session_proposal', onProposal)
    wallet.on('session_request', onRequest)
    return () => {
      wallet.off('session_proposal', onProposal)
      wallet.off('session_request', onRequest)
    }
  }, [wallet, burnerAccount])

  // QR scanner
  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startScanner = useCallback(async () => {
    if (!wallet) return
    setStatus({ type: 'scanning' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()

      // Prefer native BarcodeDetector (Android Chrome / Samsung Internet)
      const hasBarcodeDetector = 'BarcodeDetector' in window
      console.log('[WC] Using', hasBarcodeDetector ? 'BarcodeDetector' : 'jsQR')

      if (hasBarcodeDetector) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        const tick = async () => {
          if (video.videoWidth > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            try {
              const bitmap = await createImageBitmap(canvas)
              const results = await detector.detect(bitmap)
              bitmap.close()
              if (results.length > 0) {
                console.log('[WC] BarcodeDetector results:', results.map((r: any) => r.rawValue?.slice(0, 60)))
              }
              const wc = results.find((r: any) => r.rawValue?.startsWith('wc:'))
              if (wc) {
                console.log('[WC] QR detected via BarcodeDetector')
                stopScanner()
                setStatus({ type: 'pairing' })
                wallet.core.pairing.pair({ uri: wc.rawValue })
                  .catch(e => setStatus({ type: 'error', message: (e as any)?.message ?? 'Pairing failed' }))
                return
              }
            } catch { /* frame not ready */ }
          }
          rafRef.current = requestAnimationFrame(() => { tick() })
        }
        rafRef.current = requestAnimationFrame(() => { tick() })

      } else {
        // jsQR fallback
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        const tick = () => {
          if (video.videoWidth > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const qr = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })
            if (qr?.data) {
              console.log('[WC] QR detected via jsQR:', qr.data.slice(0, 60))
              if (qr.data.startsWith('wc:')) {
                stopScanner()
                setStatus({ type: 'pairing' })
                wallet.core.pairing.pair({ uri: qr.data })
                  .catch(e => setStatus({ type: 'error', message: (e as any)?.message ?? 'Pairing failed' }))
                return
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message ?? 'Camera error' })
    }
  }, [wallet, stopScanner])

  useEffect(() => () => stopScanner(), [stopScanner])

  // Session actions
  const handleApprove = useCallback(async () => {
    if (!wallet || status.type !== 'proposal') return
    const { proposal } = status
    try {
      const ns = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            chains: [`eip155:${baseSepolia.id}`],
            methods: [
              'eth_sendTransaction', 'personal_sign', 'eth_sign',
              'eth_signTransaction', 'eth_signTypedData', 'eth_signTypedData_v4',
            ],
            events: ['accountsChanged', 'chainChanged'],
            accounts: [`eip155:${baseSepolia.id}:${burnerAccount.address}`],
          },
        },
      })
      const session = await wallet.approveSession({ id: proposal.id, namespaces: ns })
      setStatus({
        type: 'active',
        topic: session.topic,
        dapp: session.peer.metadata.name,
        icon: session.peer.metadata.icons?.[0],
      })
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message ?? 'Approve failed' })
    }
  }, [wallet, status, burnerAccount])

  const handleReject = useCallback(async () => {
    if (!wallet || status.type !== 'proposal') return
    await wallet.rejectSession({ id: status.proposal.id, reason: getSdkError('USER_REJECTED') })
    setStatus({ type: 'idle' })
  }, [wallet, status])

  const handleDisconnect = useCallback(async () => {
    if (!wallet || status.type !== 'active') return
    await wallet.disconnectSession({ topic: status.topic, reason: getSdkError('USER_DISCONNECTED') })
    setStatus({ type: 'idle' })
  }, [wallet, status])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (status.type === 'active') {
    return (
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.icon && <img src={status.icon} className="w-5 h-5 rounded" alt="" />}
            <span className="text-sm font-medium text-green-400">Connected to {status.dapp}</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-red-400 h-6 px-2" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
        <p className="text-xs font-mono text-muted-foreground truncate">
          Burner: {burnerAccount.address}
        </p>
        {isProcessing && <p className="text-xs text-yellow-400 animate-pulse">⏳ Signing…</p>}
      </div>
    )
  }

  if (status.type === 'proposal') {
    const peer = status.proposal.params.proposer.metadata
    return (
      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          {peer.icons?.[0] && <img src={peer.icons[0]} className="w-5 h-5 rounded" alt="" />}
          <span className="text-sm font-medium">{peer.name} wants to connect</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Burner <span className="font-mono">{burnerAccount.address.slice(0, 10)}…</span> on Base Sepolia
        </p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleApprove}>
            ✓ Approve
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" onClick={handleReject}>
            ✕ Reject
          </Button>
        </div>
      </div>
    )
  }

  if (status.type === 'scanning') {
    return (
      <div className="space-y-2">
        <div className="relative rounded-md overflow-hidden bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 border-2 border-purple-400 rounded-lg opacity-70" />
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-purple-300">
            Center QR then tap Capture
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={async () => {
              const track = streamRef.current?.getVideoTracks()[0]
              if (!track || !wallet) return
              try {
                const ic = new (window as any).ImageCapture(track)
                // takePhoto() fires the full-res camera sensor (vs grabFrame = video frame)
                const blob: Blob = await ic.takePhoto()
                const bitmap = await createImageBitmap(blob)
                const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
                const results = await detector.detect(bitmap)
                bitmap.close()
                console.log('[WC] Photo results:', results.length, results.map((r: any) => r.rawValue?.slice(0, 80)))
                const wc = results.find((r: any) => r.rawValue?.startsWith('wc:'))
                if (wc) {
                  stopScanner()
                  setStatus({ type: 'pairing' })
                  wallet.core.pairing.pair({ uri: wc.rawValue })
                    .catch(e => setStatus({ type: 'error', message: (e as any)?.message ?? 'Pairing failed' }))
                } else {
                  alert(`Found ${results.length} QR(s), none matched wc:`)
                }
              } catch (e: any) {
                console.error('[WC] Photo failed:', e)
                alert('Photo error: ' + e?.message)
              }
            }}
          >
            📸 Capture
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => { stopScanner(); setStatus({ type: 'idle' }) }}>
            ✕ Cancel
          </Button>
        </div>
        {/* Fallback: paste URI manually */}
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer">Paste URI manually</summary>
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 bg-background border border-border rounded px-2 py-1 font-mono text-xs"
              placeholder="wc:..."
              onKeyDown={async e => {
                if (e.key === 'Enter' && wallet) {
                  const uri = (e.target as HTMLInputElement).value.trim()
                  if (uri.startsWith('wc:')) {
                    stopScanner()
                    setStatus({ type: 'pairing' })
                    wallet.core.pairing.pair({ uri })
                      .catch(err => setStatus({ type: 'error', message: err?.message }))
                  }
                }
              }}
            />
          </div>
        </details>

      </div>
    )
  }


  return (
    <div className="space-y-2">
      {status.type === 'pairing' && (
        <p className="text-xs text-purple-400 animate-pulse">⏳ Pairing with dApp…</p>
      )}
      {status.type === 'error' && (
        <p className="text-xs text-red-400">{status.message}</p>
      )}
      {initError && (
        <p className="text-xs text-red-400">WC init: {initError}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
        onClick={startScanner}
        disabled={!wallet || status.type === 'pairing'}
      >
        {!wallet && !initError ? '⏳ Initializing…' : '📷 Scan WalletConnect QR'}
      </Button>
    </div>
  )
}
