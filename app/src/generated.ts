import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CrochethRegistrar
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const crochethRegistrarAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_ens', internalType: 'address', type: 'address' },
      { name: '_resolver', internalType: 'address', type: 'address' },
      { name: '_parentNode', internalType: 'bytes32', type: 'bytes32' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'label', internalType: 'string', type: 'string' }],
    name: 'available',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'ens',
    outputs: [{ name: '', internalType: 'contract IENS', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'markerID', internalType: 'uint256', type: 'uint256' }],
    name: 'markerAvailable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'markerToSubnode',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'parentNode',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'label', internalType: 'string', type: 'string' },
      { name: 'commitment', internalType: 'bytes32', type: 'bytes32' },
      { name: 'markerID', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'registered',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'resolver',
    outputs: [
      { name: '', internalType: 'contract IResolver', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'markerID', internalType: 'uint256', type: 'uint256' }],
    name: 'subnodeForMarker',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'label', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'subnode',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'wallet',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'commitment',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'markerID',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ItemRegistered',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IENS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iensAbi = [
  {
    type: 'function',
    inputs: [{ name: 'node', internalType: 'bytes32', type: 'bytes32' }],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'node', internalType: 'bytes32', type: 'bytes32' },
      { name: 'resolver', internalType: 'address', type: 'address' },
    ],
    name: 'setResolver',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'node', internalType: 'bytes32', type: 'bytes32' },
      { name: 'label', internalType: 'bytes32', type: 'bytes32' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'setSubnodeOwner',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IResolver
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iResolverAbi = [
  {
    type: 'function',
    inputs: [{ name: 'node', internalType: 'bytes32', type: 'bytes32' }],
    name: 'addr',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'node', internalType: 'bytes32', type: 'bytes32' },
      { name: 'addr', internalType: 'address', type: 'address' },
    ],
    name: 'setAddr',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'node', internalType: 'bytes32', type: 'bytes32' },
      { name: 'key', internalType: 'string', type: 'string' },
      { name: 'value', internalType: 'string', type: 'string' },
    ],
    name: 'setText',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'node', internalType: 'bytes32', type: 'bytes32' },
      { name: 'key', internalType: 'string', type: 'string' },
    ],
    name: 'text',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__
 */
export const useReadCrochethRegistrar = /*#__PURE__*/ createUseReadContract({
  abi: crochethRegistrarAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"available"`
 */
export const useReadCrochethRegistrarAvailable =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'available',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"ens"`
 */
export const useReadCrochethRegistrarEns = /*#__PURE__*/ createUseReadContract({
  abi: crochethRegistrarAbi,
  functionName: 'ens',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"markerAvailable"`
 */
export const useReadCrochethRegistrarMarkerAvailable =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'markerAvailable',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"markerToSubnode"`
 */
export const useReadCrochethRegistrarMarkerToSubnode =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'markerToSubnode',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"parentNode"`
 */
export const useReadCrochethRegistrarParentNode =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'parentNode',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"registered"`
 */
export const useReadCrochethRegistrarRegistered =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'registered',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"resolver"`
 */
export const useReadCrochethRegistrarResolver =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'resolver',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"subnodeForMarker"`
 */
export const useReadCrochethRegistrarSubnodeForMarker =
  /*#__PURE__*/ createUseReadContract({
    abi: crochethRegistrarAbi,
    functionName: 'subnodeForMarker',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link crochethRegistrarAbi}__
 */
export const useWriteCrochethRegistrar = /*#__PURE__*/ createUseWriteContract({
  abi: crochethRegistrarAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"register"`
 */
export const useWriteCrochethRegistrarRegister =
  /*#__PURE__*/ createUseWriteContract({
    abi: crochethRegistrarAbi,
    functionName: 'register',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link crochethRegistrarAbi}__
 */
export const useSimulateCrochethRegistrar =
  /*#__PURE__*/ createUseSimulateContract({ abi: crochethRegistrarAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `functionName` set to `"register"`
 */
export const useSimulateCrochethRegistrarRegister =
  /*#__PURE__*/ createUseSimulateContract({
    abi: crochethRegistrarAbi,
    functionName: 'register',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link crochethRegistrarAbi}__
 */
export const useWatchCrochethRegistrarEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: crochethRegistrarAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link crochethRegistrarAbi}__ and `eventName` set to `"ItemRegistered"`
 */
export const useWatchCrochethRegistrarItemRegisteredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: crochethRegistrarAbi,
    eventName: 'ItemRegistered',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iensAbi}__
 */
export const useReadIens = /*#__PURE__*/ createUseReadContract({ abi: iensAbi })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iensAbi}__ and `functionName` set to `"owner"`
 */
export const useReadIensOwner = /*#__PURE__*/ createUseReadContract({
  abi: iensAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iensAbi}__
 */
export const useWriteIens = /*#__PURE__*/ createUseWriteContract({
  abi: iensAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iensAbi}__ and `functionName` set to `"setResolver"`
 */
export const useWriteIensSetResolver = /*#__PURE__*/ createUseWriteContract({
  abi: iensAbi,
  functionName: 'setResolver',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iensAbi}__ and `functionName` set to `"setSubnodeOwner"`
 */
export const useWriteIensSetSubnodeOwner = /*#__PURE__*/ createUseWriteContract(
  { abi: iensAbi, functionName: 'setSubnodeOwner' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iensAbi}__
 */
export const useSimulateIens = /*#__PURE__*/ createUseSimulateContract({
  abi: iensAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iensAbi}__ and `functionName` set to `"setResolver"`
 */
export const useSimulateIensSetResolver =
  /*#__PURE__*/ createUseSimulateContract({
    abi: iensAbi,
    functionName: 'setResolver',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iensAbi}__ and `functionName` set to `"setSubnodeOwner"`
 */
export const useSimulateIensSetSubnodeOwner =
  /*#__PURE__*/ createUseSimulateContract({
    abi: iensAbi,
    functionName: 'setSubnodeOwner',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iResolverAbi}__
 */
export const useReadIResolver = /*#__PURE__*/ createUseReadContract({
  abi: iResolverAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"addr"`
 */
export const useReadIResolverAddr = /*#__PURE__*/ createUseReadContract({
  abi: iResolverAbi,
  functionName: 'addr',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"text"`
 */
export const useReadIResolverText = /*#__PURE__*/ createUseReadContract({
  abi: iResolverAbi,
  functionName: 'text',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iResolverAbi}__
 */
export const useWriteIResolver = /*#__PURE__*/ createUseWriteContract({
  abi: iResolverAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"setAddr"`
 */
export const useWriteIResolverSetAddr = /*#__PURE__*/ createUseWriteContract({
  abi: iResolverAbi,
  functionName: 'setAddr',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"setText"`
 */
export const useWriteIResolverSetText = /*#__PURE__*/ createUseWriteContract({
  abi: iResolverAbi,
  functionName: 'setText',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iResolverAbi}__
 */
export const useSimulateIResolver = /*#__PURE__*/ createUseSimulateContract({
  abi: iResolverAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"setAddr"`
 */
export const useSimulateIResolverSetAddr =
  /*#__PURE__*/ createUseSimulateContract({
    abi: iResolverAbi,
    functionName: 'setAddr',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link iResolverAbi}__ and `functionName` set to `"setText"`
 */
export const useSimulateIResolverSetText =
  /*#__PURE__*/ createUseSimulateContract({
    abi: iResolverAbi,
    functionName: 'setText',
  })
