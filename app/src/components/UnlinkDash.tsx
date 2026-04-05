import { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { createUnlinkClient, unlinkAccount, BurnerWallet, createUser, createUnlink, unlinkEvm } from '@unlink-xyz/sdk'
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { useWalletClient, useAccount } from 'wagmi'

interface UnlinkDashProps {
  burner: BurnerWallet | null
}

const UNLINK_MNEMONIC = import.meta.env.VITE_UNLINK_MNEMONIC ?? ''
const UNLINK_API_KEY  = import.meta.env.VITE_UNLINK_API_KEY ?? 'dev_key'
const ENGINE_URL      = 'https://staging-api.unlink.xyz'
const FAUCET_TOKEN    = '0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7'
const RPC             = 'https://base-sepolia-rpc.publicnode.com'
const FAUCET_API      = 'https://corsproxy.io/?' + encodeURIComponent('https://hackathon-apikey.vercel.app/api/faucet')

export function UnlinkDash({ burner }: UnlinkDashProps) {
  const [amount, setAmount]           = useState('0.001')
  const [recipient, setRecipient]     = useState('')
  const [status, setStatus]           = useState<string>()
  const [isLoading, setIsLoading]     = useState(false)
  const [burnerBal, setBurnerBal]     = useState<string>()
  const [poolBal, setPoolBal]         = useState<string>()

  const { data: walletClient } = useWalletClient({ chainId: baseSepolia.id })
  const { address: ownerAddress, chainId } = useAccount()

  // ── helpers ────────────────────────────────────────────────────────────────

  const getInfra = useCallback(async () => {
    if (!UNLINK_MNEMONIC) throw new Error('VITE_UNLINK_MNEMONIC not configured')
    const unlinkClient = createUnlinkClient(ENGINE_URL, UNLINK_API_KEY)
    const account = unlinkAccount.fromMnemonic({ mnemonic: UNLINK_MNEMONIC })
    const accountKeys = await account.getAccountKeys()
    try { await createUser(unlinkClient, accountKeys) } catch { /* already registered */ }
    return { unlinkClient, accountKeys, account }
  }, [])

  const refreshBalances = useCallback(async () => {
    if (!burner) return
    try {
      // EVM ETH balance
      const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) })
      const ethBal = await pub.getBalance({ address: burner.address as `0x${string}` })
      setBurnerBal(parseFloat(formatEther(ethBal)).toFixed(6))
    } catch (e) { console.warn('ETH balance:', e) }
    try {
      // Unlink pool balance — use the stateful client which has getBalances
      const account = unlinkAccount.fromMnemonic({ mnemonic: UNLINK_MNEMONIC })
      const unlink = createUnlink({ engineUrl: ENGINE_URL, apiKey: UNLINK_API_KEY, account })
      const bals = await unlink.getBalances({ token: FAUCET_TOKEN })
      const poolAmount = bals?.balances?.[0]?.amount ?? '0'
      setPoolBal(parseFloat(formatEther(BigInt(poolAmount))).toFixed(4))
    } catch (e) { console.warn('Pool balance:', e); setPoolBal('?') }
  }, [burner, getInfra])

  useEffect(() => { refreshBalances() }, [refreshBalances])

  // ── actions ────────────────────────────────────────────────────────────────

  // Faucet: fund Unlink private pool
  const handlePoolFaucet = async () => {
    setIsLoading(true)
    try {
      const { accountKeys } = await getInfra()
      setStatus('Requesting pool faucet…')
      const res = await fetch(FAUCET_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: accountKeys.address, mode: 'unlink', apiKey: UNLINK_API_KEY })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setStatus('Pool faucet sent! Wait ~30s then Fund.')
    } catch (e: any) { setStatus(`Faucet error: ${e.message}`) }
    finally { setIsLoading(false) }
  }

  // Faucet: mint test tokens directly to burner EVM address
  const handleEvmFaucet = async () => {
    if (!burner) return
    setIsLoading(true)
    try {
      setStatus('Minting test tokens to burner address…')
      const res = await fetch(FAUCET_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: burner.address, mode: 'evm', apiKey: UNLINK_API_KEY })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setStatus(`EVM faucet sent! Tx: ${(data.tx_hash || data.txId || data.hash || 'Success').slice(0, 16)}…`)
      setTimeout(refreshBalances, 8000)
    } catch (e: any) { setStatus(`EVM faucet error: ${e.message}`) }
    finally { setIsLoading(false) }
  }

  // Fund burner from private pool
  const handleFundBurner = async () => {
    if (!burner || !amount) return
    setIsLoading(true)
    try {
      const { unlinkClient, accountKeys } = await getInfra()
      setStatus('ZK proof → routing from pool to burner…')
      const result = await burner.fundFromPool(unlinkClient, {
        senderKeys: accountKeys,
        token: FAUCET_TOKEN,
        amount: parseEther(amount).toString(),
        environment: 'base-sepolia'
      })
      setStatus(`Funded! txId: ${result.txId.slice(0, 20)}…`)
      setTimeout(refreshBalances, 8000)
    } catch (e: any) {
      if (e.message?.includes('insufficient')) {
        setStatus('Pool empty — use Pool Faucet first')
      } else { setStatus(`Error: ${e.message}`) }
    } finally { setIsLoading(false) }
  }

  // Send tokens from burner to any address (IRL payment)
  const handleSend = async () => {
    if (!burner || !amount) return
    const to = recipient.trim()
    if (!to.startsWith('0x')) { setStatus('Enter a valid 0x address'); return }
    setIsLoading(true)
    try {
      setStatus(`Sending ${amount} ETH to ${to.slice(0, 10)}…`)
      const wc = createWalletClient({
        account: burner.toViemAccount(),
        chain: baseSepolia,
        transport: http(RPC)
      })
      const hash = await wc.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
        gas: 21000n,
      })
      setStatus(`Sent! Tx: ${hash.slice(0, 16)}… → ${import.meta.env.VITE_EXPLORER_URL ?? 'https://sepolia.basescan.org'}/tx/${hash}`)
      setTimeout(refreshBalances, 6000)
    } catch (e: any) { setStatus(`Send error: ${e.message}`) }
    finally { setIsLoading(false) }
  }


  // Sweep burner tokens back to pool
  const handleSweep = async () => {
    if (!burner || !amount) return
    setIsLoading(true)
    try {
      const { unlinkClient, accountKeys } = await getInfra()
      setStatus('Sweeping burner → private pool…')
      const info = await BurnerWallet.getInfo(unlinkClient)
      const result = await burner.depositToPool(unlinkClient, {
        unlinkAddress: accountKeys.address,
        token: FAUCET_TOKEN,
        amount: parseEther(amount).toString(),
        environment: 'base-sepolia',
        chainId: info.chain_id,
        permit2Address: info.permit2_address,
        poolAddress: info.pool_address,
        deadline: Math.floor(Date.now() / 1000) + 3600
      })
      setStatus(`Swept! txId: ${result.txId.slice(0, 20)}…`)
      setTimeout(refreshBalances, 8000)
    } catch (e: any) { setStatus(`Sweep error: ${e.message}`) }
    finally { setIsLoading(false) }
  }

  // ── Owner actions ──────────────────────────────────────────────────────────

  const getStatefulUnlink = useCallback(async () => {
    if (!UNLINK_MNEMONIC) throw new Error('VITE_UNLINK_MNEMONIC not configured')
    const account = unlinkAccount.fromMnemonic({ mnemonic: UNLINK_MNEMONIC })
    let evm: any = undefined
    if (walletClient) {
      const pubClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })
      evm = unlinkEvm.fromViem({ walletClient: walletClient as any, publicClient: pubClient as any })
    }
    return createUnlink({ engineUrl: ENGINE_URL, apiKey: UNLINK_API_KEY, account, evm })
  }, [walletClient])

  // Deposit from owner's EOA into privacy pool
  const handleOwnerDeposit = async () => {
    if (!amount) return
    if (!ownerAddress) {
      setStatus('Please connect your owner wallet at the top first!')
      return
    }
    if (!walletClient) {
      setStatus(`Switch your wallet chain to Base Sepolia! (Current: ${chainId})`)
      return
    }
    setIsLoading(true)
    try {
      setStatus('Requesting deposit from owner wallet… (check wallet popup)')
      const unlink = await getStatefulUnlink()
      const amountWei = parseEther(amount).toString()

      // ensure ERC20 allowance exists
      setStatus('1/2 Ensuring Token Allowance…')
      await unlink.ensureErc20Approval({ token: FAUCET_TOKEN, amount: amountWei })

      setStatus('2/2 Processing Deposit to Privacy Pool…')
      const result = await unlink.deposit({ token: FAUCET_TOKEN, amount: amountWei })
      setStatus(`Deposit Success! txId: ${result.txId?.slice(0, 20)}…`)
      setTimeout(refreshBalances, 8000)
    } catch (e: any) {
      console.error(e)
      setStatus(`Deposit error: ${e.message || String(e)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Withdraw from privacy pool directly back to owner's EOA
  const handleOwnerWithdraw = async () => {
    if (!amount) return
    if (!ownerAddress) {
      setStatus('Please connect your owner wallet at the top first!')
      return
    }
    if (!walletClient) {
      setStatus(`Switch your wallet chain to Base Sepolia! (Current: ${chainId})`)
      return
    }
    setIsLoading(true)
    try {
      setStatus('Withdrawing from pool to owner address…')
      const unlink = await getStatefulUnlink()
      const result = await unlink.withdraw({
        token: FAUCET_TOKEN,
        amount: parseEther(amount).toString(),
        recipientEvmAddress: ownerAddress
      })
      setStatus(`Withdraw Success! txId: ${result.txId?.slice(0, 20)}…`)
      setTimeout(refreshBalances, 8000)
    } catch (e: any) {
      console.error(e)
      setStatus(`Withdraw error: ${e.message || String(e)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // -- Wait, removed early return so it shows on Register tab unconditionally:
  // if (!burner) return null

  return (
    <div className="space-y-3">
      {/* Burner wallet info */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Burner Wallet</span>
        <p className="text-sm font-mono text-foreground break-all">{burner ? burner.address : <span className="text-muted-foreground italic">Waiting for Marker ID...</span>}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>ETH: <span className="text-foreground font-mono">{burnerBal ?? '…'}</span></span>
          <span>Pool: <span className="text-foreground font-mono">{poolBal ?? '…'} TKN</span></span>
          <button className="text-purple-400 hover:text-purple-300" onClick={refreshBalances}>↻</button>
        </div>
      </div>

      {/* Amount + recipient */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number" step="0.001" value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount (TKN / ETH)"
          className="text-xs"
        />
        <Input
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          placeholder="0x… recipient (IRL payment)"
          className="text-xs font-mono"
        />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" className="text-xs bg-slate-600 hover:bg-slate-700" onClick={handleOwnerDeposit} disabled={isLoading}>
          ↙️ Deposit into Pool
        </Button>
        <Button size="sm" className="text-xs bg-slate-600 hover:bg-slate-700" onClick={handleOwnerWithdraw} disabled={isLoading}>
          ↗️ Withdraw from Pool
        </Button>

        <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700" onClick={handlePoolFaucet} disabled={isLoading}>
          🔒 Pool Faucet
        </Button>
        <Button size="sm" className="text-xs bg-sky-600 hover:bg-sky-700" onClick={handleEvmFaucet} disabled={isLoading || !burner}>
          🚰 EVM Faucet
        </Button>
        <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700" onClick={handleFundBurner} disabled={isLoading || !burner}>
          Fund 👀
        </Button>
        <Button size="sm" className="text-xs bg-orange-500 hover:bg-orange-600" onClick={handleSend} disabled={isLoading || !recipient || !burner}>
          Send 💸
        </Button>
      </div>
      <Button size="sm" variant="outline" className="w-full text-xs text-purple-300 border-purple-500/30" onClick={handleSweep} disabled={isLoading || !burner}>
        Sweep back 🧹
      </Button>

      {status && (
        <p className="text-xs text-muted-foreground break-all">{status}</p>
      )}
    </div>
  )
}
