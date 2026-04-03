import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi'
import { keccak256, encodePacked, stringToBytes, bytesToHex } from 'viem'
import { useWriteCrochethRegistrarRegister } from './generated'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'

const CONTRACT_ADDRESS = import.meta.env.VITE_REGISTRAR_ADDRESS as `0x${string}`

function App() {
  const { address, isConnected } = useAccount()
  const connectors = useConnectors()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [label, setLabel] = useState('')
  const [markerId, setMarkerId] = useState('')

  const { writeContract, isPending, isSuccess, error } = useWriteCrochethRegistrarRegister()

  const handleMint = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return

    // In the real app, this is done securely inside the TEE.
    // For this frontend draft, we just compute it locally.
    const salt = bytesToHex(stringToBytes('my-secret-salt', { size: 32 }))
    const commitment = keccak256(encodePacked(['address', 'bytes32'], [address, salt]))

    writeContract({
      address: CONTRACT_ADDRESS,
      args: [label, commitment, BigInt(markerId || 0)],
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-primary/30 font-sans">
      <div className="w-full max-w-md space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Crocheth</h1>
          <p className="text-muted-foreground">Anonymous Wearable On-Chain Identity</p>
        </div>

        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle>Register Item</CardTitle>
            <CardDescription>
              Claim a subdomain and link your ArUco marker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <div className="flex flex-col gap-2">
                {connectors.map((connector) => (
                  <Button 
                    key={connector.uid} 
                    onClick={() => connect({ connector })}
                    variant="secondary"
                    className="w-full"
                  >
                    Connect Wallet ({connector.name})
                  </Button>
                ))}
              </div>
            ) : (
              <form id="mint-form" onSubmit={handleMint} className="space-y-4">
                <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30 mb-4">
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {address}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => disconnect()}>
                    Disconnect
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
                      className="bg-background border-border"
                      required
                    />
                    <span className="text-muted-foreground font-mono text-sm leading-tight mt-1">.croch.eth</span>
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
                    className="bg-background border-border"
                    required
                  />
                </div>
              </form>
            )}

            {error && (
              <div className="text-sm text-destructive mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                {error.message.split('\n')[0]}
              </div>
            )}
            {isSuccess && (
              <div className="text-sm text-green-500 mt-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                Successfully registered {label}.croch.eth!
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              form="mint-form"
              className="w-full" 
              disabled={!isConnected || isPending || !label || !markerId}
            >
              {isPending ? "Confirming..." : "Mint Identity"}
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}

export default App
