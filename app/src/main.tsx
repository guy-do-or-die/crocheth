import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { baseSepolia } from '@reown/appkit/networks'
import './index.css'
import App from './App.tsx'
import { wagmiAdapter, projectId } from './wagmi.ts'
import VConsole from 'vconsole'

// Force dark mode globally
document.documentElement.classList.add('dark')

// Initialize mobile devtools
if (typeof window !== 'undefined') {
  new VConsole()
}

// Create AppKit instance (must be outside React lifecycle)
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [baseSepolia],
  defaultNetwork: baseSepolia,
  themeMode: 'dark',
  allowUnsupportedChain: false,
  metadata: {
    name: 'Crocheth',
    description: 'Anonymous Wearable On-Chain Identity',
    url: window.location.origin,
    icons: [],
  },
  features: {
    analytics: false,
    swaps: false,
    onramp: false,
    email: false,
    socials: false,
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
