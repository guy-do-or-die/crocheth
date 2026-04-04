import { defineConfig } from '@wagmi/cli'
import { foundry, react } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'src/generated.ts',
  contracts: [
    {
      name: 'ENSPublicResolver',
      abi: [
        {
          type: 'function',
          name: 'addr',
          inputs: [{ name: 'node', type: 'bytes32' }],
          outputs: [{ name: '', type: 'address' }],
          stateMutability: 'view',
        },
        {
          type: 'function',
          name: 'text',
          inputs: [
            { name: 'node', type: 'bytes32' },
            { name: 'key', type: 'string' },
          ],
          outputs: [{ name: '', type: 'string' }],
          stateMutability: 'view',
        },
      ],
    },
  ],
  plugins: [
    foundry({
      project: '../contracts',
      include: ['CrochethRegistrar.sol/**'],
    }),
    react(),
  ],
})
