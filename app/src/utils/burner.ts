import { BurnerWallet, type BurnerStorage } from '@unlink-xyz/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { keccak256, stringToHex } from 'viem'

/**
 * Custom strictly-in-memory storage engine for Unlink's BurnerWallet that natively injects
 * our deterministic private key based on the hardware NFC signature.
 */
class DeterministicBurnerStorage implements BurnerStorage {
  private keyStore = new Map<string, string>()

  async save(address: string, privateKey: string): Promise<void> {
    this.keyStore.set(address.toLowerCase(), privateKey)
  }

  async load(address: string): Promise<string | null> {
    return this.keyStore.get(address.toLowerCase()) ?? null
  }

  async delete(address: string): Promise<void> {
    this.keyStore.delete(address.toLowerCase())
  }
}

/**
 * Takes the raw cryptographic signature emitted by the physical HaLo chip
 * and deterministically derives a Self-Sovereign Burner Wallet.
 * 
 * @param haloSignature The raw ECDSA signature from the HaLo NFC chip tap
 * @returns Both the completely initialized Unlink BurnerWallet and its viem LocalAccount
 */
export async function deriveDeterministicBurner(haloSignature: string): Promise<{ burner: BurnerWallet, account: import('viem').LocalAccount }> {
  // 1. Hash the raw signature to create a secure 32-byte deterministic seed
  const privateKey = keccak256(stringToHex(haloSignature)) as `0x${string}`
  
  // 2. Derive the public EVM address for this burner key
  const account = privateKeyToAccount(privateKey)
  const burnerAddress = account.address

  // 3. Instantiate our custom memory storage and artificially inject the exact key
  const storage = new DeterministicBurnerStorage()
  await storage.save(burnerAddress, privateKey)

  // 4. Force Unlink SDK to restore the wallet using our deterministically injected key
  const burner = await BurnerWallet.restore(burnerAddress, storage)
  
  if (!burner) {
    throw new Error('Crucial Error: Failed to restore deterministic burner wallet.')
  }

  return { burner, account }
}
