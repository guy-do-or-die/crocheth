import { BurnerWallet, type BurnerStorage } from '@unlink-xyz/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { keccak256, encodePacked } from 'viem'

/**
 * Custom strictly-in-memory storage engine for Unlink's BurnerWallet that natively injects
 * our deterministic private key based on the hardware NFC chip identity.
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
 * Deterministically derives a burner wallet from the NFC chip's identity + marker context.
 * 
 * Security model: physical possession (NFC tap + ArUco visibility) = wallet access.
 * Same chip + same marker = same burner (recoverable across sessions).
 * Same chip + different marker = different burner (one chip, multiple balaclavas).
 *
 * @param chipAddress The Ethereum address derived from the chip's static public key (pk1)
 * @param markerID The ArUco marker ID crocheted into this specific balaclava
 */
export async function deriveDeterministicBurner(
  chipAddress: string,
  markerID: string = '0',
  pin: string = ''
): Promise<{ burner: BurnerWallet, account: import('viem').LocalAccount }> {
  // Derive private key from chip identity + marker context + owner PIN
  const privateKey = keccak256(
    encodePacked(
      ['address', 'uint256', 'string'],
      [chipAddress as `0x${string}`, BigInt(markerID), pin]
    )
  ) as `0x${string}`
  
  const account = privateKeyToAccount(privateKey)
  const burnerAddress = account.address

  const storage = new DeterministicBurnerStorage()
  await storage.save(burnerAddress, privateKey)

  const burner = await BurnerWallet.restore(burnerAddress, storage)
  
  if (!burner) {
    throw new Error('Fatal: Failed to restore deterministic burner wallet.')
  }

  return { burner, account }
}
