import { useState, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useReadContract } from 'wagmi'
import { keccak256, encodePacked, stringToBytes, bytesToHex } from 'viem'
import {
  useWriteCrochethRegistrarRegister,
  crochethRegistrarAbi,
} from './generated'
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

const CONTRACT_ADDRESS = import.meta.env.VITE_REGISTRAR_ADDRESS as `0x${string}`

function App() {
  const { address, isConnected } = useAccount()
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

  const { writeContract, isPending, isSuccess, error } =
    useWriteCrochethRegistrarRegister()

  // Check if the detected marker is already registered
  const { data: markerSubnode } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: crochethRegistrarAbi,
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

  const handleMint = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return

    const salt = bytesToHex(stringToBytes('my-secret-salt', { size: 32 }))
    const commitment = keccak256(
      encodePacked(['address', 'bytes32'], [address, salt]),
    )

    writeContract({
      address: CONTRACT_ADDRESS,
      args: [label, commitment, BigInt(markerId || 0)],
    })
  }

  const handleRegisterFromScan = () => {
    if (detectedId !== null) {
      setMarkerId(String(detectedId))
      setActiveTab('register')
    }
  }

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

            {/* Show profile when a registered marker is detected */}
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
                  Claim a subdomain and link your ArUco marker.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected && !haloAuth ? (
                  <div className="flex flex-col gap-3">
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

                    <HaloAuth
                      onAuthenticated={(address, signature, message) =>
                        setHaloAuth({ address, signature, message })
                      }
                    />
                  </div>
                ) : (
                  <form
                    id="mint-form"
                    onSubmit={handleMint}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                        {address || haloAuth?.address}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isConnected) disconnect()
                          if (haloAuth) setHaloAuth(null)
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
                          onChange={(e) => setLabel(e.target.value)}
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

                {error && (
                  <div className="text-sm text-destructive p-2 bg-destructive/10 rounded border border-destructive/20">
                    {error.message.split('\n')[0]}
                  </div>
                )}
                {isSuccess && (
                  <div className="text-sm text-green-500 p-2 bg-green-500/10 rounded border border-green-500/20">
                    ✓ Registered {label}.croch.eth!
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                <Button
                  type="submit"
                  form="mint-form"
                  className="w-full"
                  disabled={
                    (!isConnected && !haloAuth) || isPending || !label || !markerId || (!!haloAuth && !isConnected)
                  }
                >
                  {isPending ? 'Confirming...' : 'Mint Identity'}
                </Button>
                {!!haloAuth && !isConnected && (
                  <p className="text-xs text-center text-orange-400">
                    TEE Relayer is required to mint gaslessly via HaLo. Please connect a Wallet instead to mint directly.
                  </p>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
