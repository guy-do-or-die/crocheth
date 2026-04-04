import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { baseSepolia } from '@reown/appkit/networks'
import { http } from 'wagmi'

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is not set in .env')
}

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

export const config = wagmiAdapter.wagmiConfig
export { projectId }
