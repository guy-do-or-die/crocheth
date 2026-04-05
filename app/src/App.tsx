import { useState, useCallback } from 'react'
import { useAccount, useDisconnect, usePublicClient } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useReadContract } from 'wagmi'
import { keccak256, encodePacked, createWalletClient, http, publicActions } from 'viem'
import { baseSepolia } from 'viem/chains'
import { type LocalAccount } from 'viem'
import { ArucoScanner } from './components/ArucoScanner'
import { ProfileCard } from './components/ProfileCard'
import { Auth } from './components/Auth'
import { UnlinkDash } from './components/UnlinkDash'
import { deriveDeterministicBurner } from './utils/burner'
import { BurnerWallet } from '@unlink-xyz/sdk'
import { useEffect } from 'react'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Badge } from './components/ui/badge'

// ─── Constants ───────────────────────────────────────────────────────────────

const L2_REGISTRAR_ADDRESS = import.meta.env.VITE_L2_REGISTRAR_ADDRESS as `0x${string}`

const L2_REGISTRAR_ABI = [
  {
    name: 'markerToSubnode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'markerID', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'haLoCommitment', type: 'bytes32' },
      { name: 'markerID', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [activeTab, setActiveTab] = useState('scan')
  const [label, setLabel] = useState('')
  const [markerId, setMarkerId] = useState('')
  const [pin, setPin] = useState('')
  const [detectedId, setDetectedId] = useState<number | null>(null)
  const [haloAuth, setHaloAuth] = useState<{
    address: string
    signature: string
    message: string
  } | null>(null)

  const [mintStep, setMintStep] = useState<string | null>(null)
  const [mintSuccess, setMintSuccess] = useState<{
    subdomain: string
    txHash: string
    block: number
  } | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  const [burner, setBurner] = useState<BurnerWallet | null>(null)
  const [burnerAccount, setBurnerAccount] = useState<LocalAccount | null>(null)

  // The active signer address — from either HaLo NFC or connected wallet
  const signerAddress = haloAuth?.address ?? address

  // Derive burner deterministically from chip identity (pk1) + marker context.
  // Same chip + same marker = same burner. Same chip + different marker = different burner.
  useEffect(() => {
    if (signerAddress && markerId) {
      // Use fallback empty string for pin if undefined from HaLo
      deriveDeterministicBurner(signerAddress, markerId, pin ?? '')
        .then(({ burner: b, account: a }) => {
          setBurner(b)
          setBurnerAccount(a)
        })
        .catch((err) => console.error('Failed to derive burner:', err))
    } else {
      setBurner(null)
      setBurnerAccount(null)
    }
  }, [signerAddress, markerId, pin])
  const { data: markerSubnode } = useReadContract({
    address: L2_REGISTRAR_ADDRESS,
    abi: L2_REGISTRAR_ABI,
    functionName: 'markerToSubnode',
    args: detectedId !== null ? [BigInt(detectedId)] : undefined,
    query: { enabled: detectedId !== null },
  })

  const isMarkerRegistered =
    markerSubnode !== undefined &&
    markerSubnode !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  const onMarkerDetected = useCallback(
    (id: number) => {
      if (id !== detectedId) {
        setDetectedId(id)
        setMarkerId(String(id))
      }
    },
    [detectedId],
  )

  const handleRegisterFromScan = () => {
    if (detectedId !== null) {
      setMarkerId(String(detectedId))
      setActiveTab('register')
    }
  }

  // ─── Mint via native local EVM execution ─────────────────────────────────

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signerAddress) return

    setMintStep('Preparing Payload...')
    setMintError(null)
    setMintSuccess(null)

    try {
      const commitment = keccak256(
        encodePacked(['address'], [signerAddress as `0x${string}`])
      )
      console.log(`[mint] label=${label} markerID=${markerId} commitment=${commitment}`)

      let txHash: string;
      
      if (!burnerAccount) {
        throw new Error('Fatal: No Hardware Burner detected. Generate a signature via Halo or Browser Wallet to derive it.')
      }

      setMintStep('Signing securely via isolated Burner...')
      // Generate a standalone WalletClient to execute using Burner gas to protect privacy
      const executor = createWalletClient({
        account: burnerAccount,
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
      }).extend(publicActions)
      
      txHash = await executor.writeContract({
        address: L2_REGISTRAR_ADDRESS,
        abi: L2_REGISTRAR_ABI,
        functionName: 'register',
        args: [label, commitment, BigInt(markerId)]
      })

      setMintStep(`Broadcasting TX: ${txHash.slice(0, 6)}...${txHash.slice(-4)}`)

      if (publicClient) {
        setMintStep('Waiting for Block Confirmation...')
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
        if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain')
      }

      setMintSuccess({
        subdomain: `${label}.croch.eth`,
        txHash: txHash,
        block: 0, // Simplified for direct client mode
      })
    } catch (err: unknown) {
      setMintError(err instanceof Error ? err.message : String(err))
    } finally {
      setMintStep(null)
    }
  }

  const canMint = !!signerAddress && !!label && !!markerId && !mintStep

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-primary/30 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Crocheth
          </h1>
          <p className="text-muted-foreground text-sm">
            Anonymous Wearable On-Chain Identity
          </p>
        </div>

        {/* ─── SHARED IDENTITY CARD ─── */}
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-4">
            {!signerAddress ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground text-center">Authenticate to register or manage items</p>
                <Button
                  onClick={() => open()}
                  variant="secondary"
                  className="w-full"
                >
                  🔗 Connect Wallet
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Auth
                  onAuthenticated={(addr, signature, message) =>
                    setHaloAuth({ address: addr, signature, message })
                  }
                />
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Authenticated as</span>
                  <span className="text-xs font-mono truncate max-w-[220px]">{signerAddress}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (haloAuth) setHaloAuth(null)
                    else disconnect()
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">🔍 Discover</TabsTrigger>
            <TabsTrigger value="register">✍️ Register</TabsTrigger>
          </TabsList>

          {/* ─── DISCOVER TAB ─── */}
          <TabsContent value="scan" className="space-y-4">
            <Card className="border-border bg-card">
              {detectedId === null ? (
                // ── Scanning state ──────────────────────────────
                <>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Discover Item</CardTitle>
                    <CardDescription>
                      Point your camera at a crocheted ArUco marker.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ArucoScanner
                      onMarkerDetected={onMarkerDetected}
                      active={activeTab === 'scan'}
                    />
                  </CardContent>
                </>
              ) : (
                // ── Item detected ───────────────────────────────
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Detected Marker</p>
                      <p className="text-lg font-bold">#{detectedId}</p>
                    </div>
                    <Badge variant={isMarkerRegistered ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                      {isMarkerRegistered ? '✓ Registered' : '○ Available'}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {!isMarkerRegistered && (
                      <Button className="flex-1" onClick={handleRegisterFromScan}>
                        Register This Marker →
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className={!isMarkerRegistered ? '' : 'w-full'}
                      onClick={() => {
                        setDetectedId(null)
                        setMarkerId('')
                      }}
                    >
                      📷 Scan Again
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {detectedId !== null && isMarkerRegistered && (
              <ProfileCard
                markerId={detectedId}
                burnerAccount={burnerAccount}
                signerAddress={signerAddress}
              />
            )}
          </TabsContent>

          {/* ─── REGISTER TAB ─── */}
          <TabsContent value="register" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Register Item</CardTitle>
                <CardDescription>
                  Tap your NFC chip to prove ownership, then claim a subdomain.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {signerAddress ? (
                  <form
                    id="mint-form"
                    onSubmit={handleMint}
                    className="space-y-4"
                  >
                    {/* Authenticated identity pill */}
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-xs font-mono truncate">{signerAddress}</span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="label">Subdomain Label</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="label"
                          placeholder="midnight"
                          value={label}
                          onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          required
                        />
                        <span className="text-muted-foreground font-mono text-sm shrink-0">
                          .croch.eth
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="marker">ArUco Marker ID</Label>
                      <Input
                        id="marker"
                        type="number"
                        placeholder="42"
                        value={markerId}
                        onChange={(e) => setMarkerId(e.target.value)}
                        required
                      />
                      {markerId && detectedId !== null && markerId === String(detectedId) && (
                        <p className="text-xs text-purple-400">
                          ✓ Auto-filled from scanner
                        </p>
                      )}
                    </div>

                    {haloAuth && (
                      <div className="space-y-2">
                        <Label htmlFor="pin">Owner PIN</Label>
                        <Input
                          id="pin"
                          type="password"
                          placeholder="••••"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">
                          Secret PIN mixed into wallet derivation. Same PIN = same wallet.
                        </p>
                      </div>
                    )}
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Authenticate above to register an item.
                  </p>
                )}

                {mintError && (
                  <div className="text-sm text-destructive p-2 bg-destructive/10 rounded border border-destructive/20 break-words">
                    {mintError}
                  </div>
                )}
                {mintSuccess && (
                  <div className="text-sm space-y-2 p-3 bg-green-500/10 rounded border border-green-500/20">
                    <p className="text-green-500">
                      ✓ Registered <strong>{mintSuccess.subdomain}</strong>
                    </p>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <a
                        href={`https://sepolia.basescan.org/tx/${mintSuccess.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-green-400 underline decoration-green-500/30 underline-offset-2 transition-colors truncate"
                      >
                        View Transaction ↗
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                <Button
                  type="submit"
                  form="mint-form"
                  className="w-full"
                  disabled={!canMint}
                >
                  {mintStep ? (
                    <span className="flex items-center gap-2">
                       <span className="animate-spin text-lg leading-none">⟳</span>
                       {mintStep}
                    </span>
                  ) : (
                    '⛓ Mint Identity'
                  )}
                </Button>
              </CardFooter>
            </Card>

          </TabsContent>
        </Tabs>

        {/* ─── SHARED UNLINK DASHBOARD ─── */}
        {signerAddress && (activeTab === 'register' || (activeTab === 'scan' && detectedId !== null && isMarkerRegistered)) && (
          <UnlinkDash burner={burner ?? null} />
        )}
      </div>
    </div>
  )
}

export default App
