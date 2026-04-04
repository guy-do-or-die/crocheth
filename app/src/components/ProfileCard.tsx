import { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseAbiItem, toHex, createWalletClient, http, parseAbi } from 'viem'
import { baseSepolia } from 'viem/chains'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { deriveDeterministicBurner } from '../utils/burner'
import { UnlinkDash } from './UnlinkDash'
import type { LocalAccount } from 'viem'
import type { BurnerWallet } from '@unlink-xyz/sdk'

const CONTRACT_ADDRESS = import.meta.env.VITE_L2_REGISTRAR_ADDRESS as `0x${string}`

const L2_REGISTRAR_ABI = [
  {
    name: 'markerToSubnode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'markerID', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'markerID', type: 'uint256' },
      { name: 'newCommitment', type: 'bytes32' },
      { name: 'newOwner', type: 'address' }
    ],
    outputs: [],
  },
  {
    name: 'unlinkIdentity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'markerID', type: 'uint256' }],
    outputs: [],
  }
] as const

interface ProfileCardProps {
  markerId: number
  signerAddress?: string | null
  burnerAccount?: LocalAccount | null
  burner?: BurnerWallet | null
}

export function ProfileCard({ markerId, signerAddress, burnerAccount, burner }: ProfileCardProps) {
  const publicClient = usePublicClient()
  const [label, setLabel] = useState<string | null>(null)
  const [commitment, setCommitment] = useState<string | null>(null)
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null)

  const [showManage, setShowManage] = useState(false)
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [txStatus, setTxStatus] = useState<string | null>(null)

  const { data: subnode } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: L2_REGISTRAR_ABI,
    functionName: 'markerToSubnode',
    args: [BigInt(markerId)],
  })

  const isRegistered =
    subnode !== undefined &&
    subnode !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  useEffect(() => {
    if (!isRegistered || !publicClient || !subnode) return

    const L2_REGISTRY = '0x228eeCbA8D5336Fe3A904627F9985f6A6ffd0bdf' as const
    const registryAbi = parseAbi([
      'function ownerOf(uint256) view returns (address)',
      'function text(bytes32, string) view returns (string)',
    ])

    // Always fetch owner + commitment directly from registry (fast, no log range issues)
    const fetchChainData = async () => {
      try {
        const [owner, commitmentText] = await Promise.all([
          publicClient.readContract({ address: L2_REGISTRY, abi: registryAbi, functionName: 'ownerOf', args: [BigInt(subnode)] }).catch(() => null),
          publicClient.readContract({ address: L2_REGISTRY, abi: registryAbi, functionName: 'text', args: [subnode, 'commitment'] }).catch(() => null),
        ])
        if (owner) setOwnerAddress(owner as string)
        if (commitmentText) setCommitment(commitmentText as string)
      } catch (err) {
        console.error('Chain data fetch failed:', err)
      }
    }

    // Try to get the human-readable label from event logs (best-effort, may fail on some RPCs)
    const fetchLabel = async () => {
      try {
        // Use a narrow block window — only look back 50k blocks (~2 days on Base Sepolia)
        const latestBlock = await publicClient.getBlockNumber()
        const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : 0n

        const regLogs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: parseAbiItem('event ItemRegistered(string label, bytes32 indexed subnode, address wallet, bytes32 commitment, uint256 markerID)'),
          args: { subnode },
          fromBlock,
        })
        if (regLogs.length > 0 && regLogs[0].args.label) {
          setLabel(regLogs[0].args.label)
        }
      } catch {
        // Label stays null; ENS name falls back to "Marker #N" — non-critical
      }
    }

    fetchChainData()
    fetchLabel()
  }, [isRegistered, subnode, publicClient])

  if (!isRegistered) return null

  const ensName = label ? `${label}.croch.eth` : `Marker #${markerId}`

  // Ground-truth ownership check: is the derived burner wallet the current NFT owner?
  // This is more reliable than comparing keccak(signerAddress) against stored commitment,
  // because the burner is derived deterministically and ownerAddress is fetched live from chain.
  const isOwner =
    !!burnerAccount &&
    !!ownerAddress &&
    burnerAccount.address.toLowerCase() === ownerAddress.toLowerCase()

  const makeWalletClient = () => {
    if (!burnerAccount) throw new Error('No burner account')
    return createWalletClient({ account: burnerAccount, chain: baseSepolia, transport: http('https://base-sepolia-rpc.publicnode.com') })
  }

  const handleTransfer = async () => {
    if (!burnerAccount || !newOwnerAddress) return
    setTxStatus('Computing...')
    try {
      const newCommitment = keccak256(encodePacked(['address'], [newOwnerAddress as `0x${string}`]))
      const { account: newBurner } = await deriveDeterministicBurner(newOwnerAddress, String(markerId))
      setTxStatus('Broadcasting...')
      const tx = await makeWalletClient().writeContract({ address: CONTRACT_ADDRESS, abi: L2_REGISTRAR_ABI, functionName: 'transfer', args: [BigInt(markerId), newCommitment, newBurner.address] })
      setTxStatus('Transferred ↗')
      console.log('Transfer TX:', tx)
    } catch (err) { console.error(err); setTxStatus('Failed') }
  }

  const handleUnlink = async () => {
    if (!burnerAccount) return
    setTxStatus('Unlinking...')
    try {
      const tx = await makeWalletClient().writeContract({ address: CONTRACT_ADDRESS, abi: L2_REGISTRAR_ABI, functionName: 'unlinkIdentity', args: [BigInt(markerId)] })
      setTxStatus('Unlinked ↗')
      console.log('Unlink TX:', tx)
    } catch (err) { console.error(err); setTxStatus('Failed') }
  }

  return (
    <Card className="border-purple-500/20 bg-purple-500/5 mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            🎭{' '}
            <a
              href={subnode ? `https://sepolia.basescan.org/token/0x228eeCbA8D5336Fe3A904627F9985f6A6ffd0bdf?a=${BigInt(subnode).toString()}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-purple-400 hover:underline decoration-purple-500/30 underline-offset-4"
            >
              {ensName}
            </a>
          </CardTitle>
          <Badge variant="default" className="bg-purple-600">#{markerId}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Public info */}
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Current Owner</span>
            <p className="text-xs font-mono break-all">
              {ownerAddress ? (
                <a
                  href={`https://sepolia.basescan.org/address/${ownerAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline decoration-purple-500/30 underline-offset-2"
                >
                  {ownerAddress}
                </a>
              ) : '...'}
            </p>
          </div>
          {commitment && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Commitment</span>
              <p className="text-xs font-mono text-muted-foreground break-all">{commitment}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <a
            href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            L2 Registrar ↗
          </a>
          {signerAddress && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
              onClick={() => { setShowManage(v => !v); setTxStatus(null) }}
            >
              {showManage ? '✕ Close' : '🔑 Manage'}
            </Button>
          )}
        </div>

        {/* Owner controls — only visible when authenticated + owner */}
        {showManage && signerAddress && (
          <div className="pt-3 border-t border-border space-y-3">
            {isOwner ? (
              <>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Owner Controls
                </p>

                {/* Burner wallet management — fund & inspect */}
                <UnlinkDash burner={burner ?? null} />

                <div className="pt-2 border-t border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground">Transfer or unlink this identity</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New owner address (0x...)"
                      value={newOwnerAddress}
                      onChange={(e) => setNewOwnerAddress(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button onClick={handleTransfer} disabled={!!txStatus || !newOwnerAddress}>
                      Transfer
                    </Button>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={!!txStatus}
                  className="w-full text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900/50"
                >
                  🔥 Unlink Identity
                </Button>

                {txStatus && (
                  <p className="text-xs text-center text-muted-foreground">{txStatus}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-400 bg-amber-400/10 rounded p-2">
                ⚠ Your authenticated identity is not the owner of this balaclava.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
