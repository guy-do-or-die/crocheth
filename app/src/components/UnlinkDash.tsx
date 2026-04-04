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
const UNLINK_API_KEY = import.meta.env.VITE_UNLINK_API_KEY ?? 'dev_key'
const ENGINE_URL = 'https://staging-api.unlink.xyz'
const FAUCET_TOKEN = '0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7'

export function UnlinkDash({ burner }: UnlinkDashProps) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('0.001')
  const [status, setStatus] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  // Initialize Unlink infrastructure strictly on the client side
  const getUnlinkInfra = useCallback(async () => {

    setStatus('Initializing Client-Side Unlink ZK Engine...')
    const unlinkClient = createUnlinkClient(ENGINE_URL, UNLINK_API_KEY)

    // Retrieve the user's secure Darkpool account
    const account = unlinkAccount.fromMnemonic({ mnemonic: UNLINK_MNEMONIC })
    const accountKeys = await account.getAccountKeys()
    
    // Auto-register the derived identity on the Darkpool API
    try {
      await createUser(unlinkClient, accountKeys)
    } catch (e: any) {
      // 400 = already registered, which is fine
      if (!e?.message?.includes('400')) {
        console.warn('Registration soft-fail', e)
      }
    }

    return { unlinkClient, accountKeys, account }
  }, [])

  const requestFaucet = async () => {
    const { accountKeys } = await getUnlinkInfra()
    const unlinkAddress = accountKeys.address
    setStatus(`Requesting faucet for ${unlinkAddress.slice(0, 20)}...`)
    const FAUCET_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://hackathon-apikey.vercel.app/api/faucet')
    const res = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: unlinkAddress, mode: 'unlink', apiKey: UNLINK_API_KEY })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Faucet HTTP ${res.status}`)
    return data
  }

  const handleRequestFaucet = async () => {
    setIsLoading(true)
    try {
      const data = await requestFaucet()
      setStatus(`Faucet sent! (${JSON.stringify(data)}). Wait ~30s then Fund.`)
    } catch (err: any) {
      console.error('Faucet error:', err)
      setStatus(`Faucet error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFundBurner = async () => {
    if (!burner) return
    setIsLoading(true)
    try {
      const { unlinkClient, accountKeys } = await getUnlinkInfra()

      setStatus('Checking pool balance...')
      
      try {
        // Attempt to fund directly
        setStatus('Client-Side ZK: Routing funds to Burner...')
        const result = await burner.fundFromPool(unlinkClient, {
          senderKeys: accountKeys, 
          token: FAUCET_TOKEN, 
          amount: parseEther(amount).toString(),
          environment: 'base-sepolia'
        })
        setStatus(`Funded Burner! Tx: ${result.txId}`)
      } catch (fundErr: any) {
        if (fundErr.message?.includes('insufficient balance')) {
          setStatus('Pool empty — auto-requesting faucet...')
          try {
            await requestFaucet()
            setStatus('Faucet requested! Wait ~30s and press Fund again.')
          } catch (faucetErr: any) {
            setStatus(`Auto-faucet failed: ${faucetErr.message}. Use 🚰 button.`)
          }
        } else {
          throw fundErr
        }
      }
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
      const accountKeys = await account.getAccountKeys()
      const unlinkAddress = accountKeys.address
      const info = await BurnerWallet.getInfo(unlinkClient)

      const result = await burner.depositToPool(unlinkClient, {
        unlinkAddress,
        token: FAUCET_TOKEN,
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

        <div className="grid grid-cols-3 gap-2">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-xs" 
            onClick={handleRequestFaucet}
            disabled={isLoading}
          >
            🚰 Faucet
          </Button>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-xs" 
            onClick={handleFundBurner}
            disabled={isLoading}
          >
            Fund 👀
          </Button>
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700 text-xs" 
            onClick={handleSweepBurner}
            disabled={isLoading}
          >
            Sweep 🧹
          </Button>
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <p className="text-xs text-muted-foreground">{status}</p>
      </CardFooter>
    </Card>
  )
}
