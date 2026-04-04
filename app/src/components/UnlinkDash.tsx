import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { createUnlinkClient, unlinkAccount, BurnerWallet, createUser } from '@unlink-xyz/sdk'
import { useAccount } from 'wagmi'
import { parseEther } from 'viem'

interface UnlinkDashProps {
  burner: BurnerWallet | null
}

// Loaded dynamically from Vite Env
const UNLINK_MNEMONIC = import.meta.env.VITE_UNLINK_MNEMONIC ?? ''

interface UnlinkDashProps {
  burner: BurnerWallet | null
}

export function UnlinkDash({ burner }: UnlinkDashProps) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('0.001')
  const [status, setStatus] = useState<string>('Idle')
  const [isLoading, setIsLoading] = useState(false)

  // Initialize Unlink infrastructure strictly on the client side
  const getUnlinkInfra = useCallback(async () => {
    if (!address) throw new Error('Connect your main wallet first')

    const engineUrl = 'https://staging-api.unlink.xyz'
    const apiKey = import.meta.env.VITE_UNLINK_API_KEY ?? 'dev_key'
    
    setStatus('Initializing Client-Side Unlink ZK Engine...')
    const unlinkClient = createUnlinkClient(engineUrl, apiKey)

    // Retrieve the user's secure Darkpool account
    const account = unlinkAccount.fromMnemonic({ mnemonic: UNLINK_MNEMONIC })
    const accountKeys = await account.getAccountKeys()
    
    // Auto-register the derived identity on the Darkpool API
    // Normally handled implicitly by the parent client, which we bypassed
    try {
      await createUser(unlinkClient, accountKeys)
    } catch (e: any) {
      if (!e?.message?.includes('400')) {
        console.warn('Registration soft-fail', e)
      }
    }

    return { unlinkClient, accountKeys, account }
  }, [address])

  const handleFundBurner = async () => {
    if (!burner) return
    setIsLoading(true)
    try {
      const { unlinkClient, accountKeys } = await getUnlinkInfra()

      setStatus('Client-Side ZK calculating: Routing funds to Burner...')
      // Generate Zero-Knowledge Mathematical Signature natively in Vite!
      // Must use the explicitly identical token address provided by the Unlink Testnet Faucet
      const result = await burner.fundFromPool(unlinkClient, {
        senderKeys: accountKeys, 
        token: '0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7', 
        amount: parseEther(amount).toString(),
        environment: 'base-sepolia'
      })

      setStatus(`Funded Burner successfully! Tx: ${result.txId}`)
    } catch (err: any) {
      console.error(err)
      setStatus(`Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSweepBurner = async () => {
    if (!burner) return
    setIsLoading(true)
    try {
      const { unlinkClient, account } = await getUnlinkInfra()

      setStatus('Sweeping Burner funds back to Darkpool...')
      // Generate the user's Unlink string address
      const accountKeys = await account.getAccountKeys()
      const unlinkAddress = accountKeys.address
      const info = await BurnerWallet.getInfo(unlinkClient)

      // Deposit from burner directly back into the user's darkpool natively in Vite!
      const result = await burner.depositToPool(unlinkClient, {
        unlinkAddress,
        token: '0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7',
        amount: parseEther(amount).toString(),
        environment: 'base-sepolia',
        chainId: info.chain_id,
        permit2Address: info.permit2_address,
        poolAddress: info.pool_address,
        deadline: Math.floor(Date.now() / 1000) + 3600
      })

      setStatus(`Sweep successful! Tx: ${result.txId}`)
    } catch (err: any) {
      console.error(err)
      setStatus(`Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!burner) return null

  return (
    <Card className="border-green-500/20 bg-green-500/5 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">💰 Darkpool Balaclava Operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
           <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Active Burner Wallet
          </span>
          <p className="text-sm font-mono text-foreground break-all">
            {burner.address}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <Input 
            className="w-full"
            type="number" 
            step="0.001" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="Amount in ETH" 
          />
          <span className="text-xs text-muted-foreground flex items-center">
            ETH to Move
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            onClick={handleFundBurner}
            disabled={isLoading || !address}
          >
            Fund from Pool 👀
          </Button>
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700" 
            onClick={handleSweepBurner}
            disabled={isLoading || !address}
          >
            Sweep to Pool 🧹
          </Button>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground">{status}</p>
      </CardFooter>
    </Card>
  )
}
