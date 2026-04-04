import {
  useReadCrochethRegistrarMarkerToSubnode,
  useReadEnsPublicResolverAddr,
  useReadEnsPublicResolverText,
  crochethRegistrarAbi,
} from '../generated'
import { usePublicClient } from 'wagmi'
import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const CONTRACT_ADDRESS = import.meta.env.VITE_REGISTRAR_ADDRESS as `0x${string}`
const RESOLVER_ADDRESS = import.meta.env.VITE_RESOLVER_ADDRESS as `0x${string}`

interface ProfileCardProps {
  markerId: number
}

export function ProfileCard({ markerId }: ProfileCardProps) {
  const publicClient = usePublicClient()
  const [label, setLabel] = useState<string | null>(null)

  // Get subnode for the marker
  const { data: subnode } = useReadCrochethRegistrarMarkerToSubnode({
    address: CONTRACT_ADDRESS,
    args: [BigInt(markerId)],
  })

  const isRegistered =
    subnode !== undefined &&
    subnode !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  // Resolve label from ItemRegistered event logs
  useEffect(() => {
    if (!isRegistered || !publicClient) return

    publicClient
      .getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: crochethRegistrarAbi,
        eventName: 'ItemRegistered',
        fromBlock: 10585000n, // just before contract deployment
        args: { subnode: subnode! },
      })
      .then((logs) => {
        if (logs.length > 0 && logs[0].args.label) {
          setLabel(logs[0].args.label)
        }
      })
      .catch((err) => console.error('Event query failed:', err))
  }, [isRegistered, subnode, publicClient])

  // Resolve ENS address
  const { data: resolvedAddr } = useReadEnsPublicResolverAddr({
    address: RESOLVER_ADDRESS,
    args: subnode ? [subnode] : undefined,
    query: { enabled: isRegistered },
  })

  // Resolve commitment text record
  const { data: commitment } = useReadEnsPublicResolverText({
    address: RESOLVER_ADDRESS,
    args: subnode ? [subnode, 'commitment'] : undefined,
    query: { enabled: isRegistered },
  })

  if (!isRegistered) return null

  const ensName = label ? `${label}.croch.eth` : `Marker #${markerId}`

  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🎭 {ensName}</CardTitle>
          <Badge variant="default" className="bg-purple-600">
            #{markerId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolvedAddr && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Wallet
            </span>
            <p className="text-sm font-mono text-foreground break-all">
              {resolvedAddr as string}
            </p>
          </div>
        )}

        {commitment && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Commitment
            </span>
            <p className="text-xs font-mono text-muted-foreground break-all">
              {commitment}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <a
            href={`https://sepolia.etherscan.io/address/${resolvedAddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            View on Etherscan ↗
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
