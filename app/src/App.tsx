import { useState, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useReadContract } from 'wagmi'
import { keccak256, encodePacked } from 'viem'
import { ArucoScanner } from './components/ArucoScanner'
import { ProfileCard } from './components/ProfileCard'
import { HaloAuth } from './components/HaloAuth'
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

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL ?? 'http://localhost:3001'
const L2_REGISTRAR_ADDRESS = import.meta.env.VITE_L2_REGISTRAR_ADDRESS as `0x${string}`

const L2_REGISTRAR_ABI = [
  {
    name: 'markerToSubnode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'markerID', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const { address } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [activeTab, setActiveTab] = useState('scan')
  const [label, setLabel] = useState('')
  const [markerId, setMarkerId] = useState('')
  const [detectedId, setDetectedId] = useState<number | null>(null)
  const [haloAuth, setHaloAuth] = useState<{
    address: string
    signature: string
    message: string
  } | null>(null)

  const [minting, setMinting] = useState(false)
  const [mintSuccess, setMintSuccess] = useState<{
    subdomain: string
    txHash: string
    block: number
  } | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  // The active signer address — from either HaLo NFC or connected wallet
  const signerAddress = haloAuth?.address ?? address
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

  // ─── Mint via backend relayer ─────────────────────────────────────────────

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signerAddress) return

    setMinting(true)
    setMintError(null)
    setMintSuccess(null)

    try {
      const commitment = keccak256(
        encodePacked(['address'], [signerAddress as `0x${string}`])
      )
      console.log(`[mint] label=${label} markerID=${markerId} commitment=${commitment}`)

      const res = await fetch(`${RELAYER_URL}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          signerAddress,
          markerID: Number(markerId),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unknown relayer error')

      setMintSuccess({
        subdomain: data.subdomain,
        txHash: data.txHash,
        block: data.block,
      })
    } catch (err: unknown) {
      setMintError(err instanceof Error ? err.message : String(err))
    } finally {
      setMinting(false)
    }
  }

  const canMint = !!signerAddress && !!label && !!markerId && !minting

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">📷 Scan</TabsTrigger>
            <TabsTrigger value="register">✍️ Register</TabsTrigger>
          </TabsList>

          {/* ─── SCAN TAB ─── */}
          <TabsContent value="scan" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Scan ArUco Marker</CardTitle>
                <CardDescription>
                  Point your camera at a crocheted ArUco marker to identify it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ArucoScanner
                  onMarkerDetected={onMarkerDetected}
                  active={activeTab === 'scan'}
                />
              </CardContent>
              {detectedId !== null && (
                <CardFooter className="flex flex-col gap-3">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Marker ID
                    </span>
                    <Badge
                      variant={isMarkerRegistered ? 'default' : 'secondary'}
                    >
                      #{detectedId}{' '}
                      {isMarkerRegistered ? '• Registered' : '• Available'}
                    </Badge>
                  </div>
                  {!isMarkerRegistered && (
                    <Button
                      className="w-full"
                      onClick={handleRegisterFromScan}
                    >
                      Register This Marker →
                    </Button>
                  )}
                </CardFooter>
              )}
            </Card>

            {detectedId !== null && isMarkerRegistered && (
              <ProfileCard markerId={detectedId} />
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
                {!signerAddress ? (
                  <div className="flex flex-col gap-3">
                    {/* Wallet option */}
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

                    {/* HaLo NFC option */}
                    <HaloAuth
                      onAuthenticated={(addr, signature, message) =>
                        setHaloAuth({ address: addr, signature, message })
                      }
                    />
                  </div>
                ) : (
                  <form
                    id="mint-form"
                    onSubmit={handleMint}
                    className="space-y-4"
                  >
                    {/* Authenticated identity pill */}
                    <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {haloAuth ? '🔮 HaLo identity' : '🔗 Wallet'}
                        </span>
                        <span className="text-xs font-mono truncate max-w-[220px]">
                          {signerAddress}
                        </span>
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
                  </form>
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
                      <span className="font-mono opacity-60">Block: {mintSuccess.block}</span>
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
                  {minting ? 'Minting via Unlink…' : '⛓ Mint Identity (Gasless)'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  No gas required — minted anonymously via Unlink on Base Sepolia
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
