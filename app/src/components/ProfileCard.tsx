import { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseAbiItem, toHex } from 'viem'

const CONTRACT_ADDRESS = import.meta.env.VITE_L2_REGISTRAR_ADDRESS as `0x${string}`

const L2_REGISTRAR_ABI = [
  {
    name: 'markerToSubnode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'markerID', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

interface ProfileCardProps {
  markerId: number
}

export function ProfileCard({ markerId }: ProfileCardProps) {
  const publicClient = usePublicClient()
  const [label, setLabel] = useState<string | null>(null)
  const [commitment, setCommitment] = useState<string | null>(null)

  // Get subnode for the marker from the L2 Registrar
  const { data: subnode } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: L2_REGISTRAR_ABI,
    functionName: 'markerToSubnode',
    args: [BigInt(markerId)],
  })

  const isRegistered =
    subnode !== undefined &&
    subnode !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  // Resolve label and commitment directly from the L2 ItemRegistered event log
  useEffect(() => {
    if (!isRegistered || !publicClient || !subnode) return

    publicClient
      .getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event ItemRegistered(string label, bytes32 indexed subnode, address wallet, bytes32 commitment, uint256 markerID)'),
        args: { subnode },
        fromBlock: 39772000n, // Deploy block was 39772169. This skips the Base Sepolia 10k block query limit!
      })
      .then((logs) => {
        if (logs.length > 0) {
          setLabel(logs[0].args.label ?? null)
          if (logs[0].args.commitment) {
            setCommitment(toHex(logs[0].args.commitment, { size: 32 }))
          }
        }
      })
      .catch((err) => console.error('Event query failed:', err))
  }, [isRegistered, subnode, publicClient])

  if (!isRegistered) return null

  const ensName = label ? `${label}.croch.eth` : `Marker #${markerId}`

  return (
    <Card className="border-purple-500/20 bg-purple-500/5 mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🎭 {ensName}</CardTitle>
          <Badge variant="default" className="bg-purple-600">
            #{markerId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {commitment && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              HaLo Commitment
            </span>
            <p className="text-xs font-mono text-muted-foreground break-all">
              {commitment}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border flex items-center gap-4">
          <a
            href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            L2 Registrar ↗
          </a>
          <a
            href={`https://sepolia.etherscan.io/enslookup-search?searchWord=${ensName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            ENS Status ↗
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
