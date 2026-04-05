// Stub for Node.js 'module' package — not available in browser
import * as eddsaBlake from '@zk-kit/eddsa-poseidon/blake-2b'

export default {}
export const createRequire = () => (path) => {
  if (path === '@zk-kit/eddsa-poseidon/blake-2b') return eddsaBlake;
  return {};
}
