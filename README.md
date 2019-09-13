Embark-etherscan-verifier
======

Plugin for [Embark](https://github.com/embark-framework/embark) and library  to flatten and verify contracts on Etherscan.

## Plugin installation

In your Embark dapp directory:

```npm install embark-etherscan-verifier --save```
or
```yarn add embark-etherscan-verifier```

then add embark-etherscan-verifier to the plugins section in `embark.json`:

```Json
  "plugins": {
    "embark-etherscan-verifier": {}
  }
```

### Usage

#### Flatten
In the console, type `flatten` or `flatten ContractName(s)`

- `flatten`: Flattens all contracts
- `flatten ContractName(s)`: Flattens the specified contract(s). For multiple contracts, separate them using a comma.
 - Example: `flatten SimpleStorage,Token`

#### Verify
You can also automatically verify on a valid network (mainnet, ropsten, rinkeby, kovan)

In the console:

- `verify <API_KEY> <contractName>`: Verifies the specified contract (flattens if it was not done before)
  - You need an Etherscan API key. You can find a simple tutorial [here](https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key)
  - Example: `verify YOUR_KEY SimpleStorage`

### Requirements

- Embark 4.0.0 or higher

## Library usage

You can use the flattener and verifier standalone.

```
import FlattenerVerifier from 'embark-etherscan-verifier/lib/FlattenerVerifier`;

const flattenerVerifier = new FlattenerVerifier({
  optimize: true,
  optimizeRuns: 200,
  contractsFiles: [...],
  solcVersion: '0.5.2',
  getWeb3DeployObject: (contract, cb) => {},
  getAllContracts: (cb) => {},
  getContractByName: (contractName, cb) => {},
  getNetworkId: (cb) => {}
});
```

### Parameters
- `optimize`: bool:  if the contract is optimized 
- `optimizeRuns`: int: Number of optimize passes
- `contractsFiles`: Array of contract files objects. Must contain:
  - `originalPath`: Original path to the contract (relative path)
  - `path`: Absolute path to the contract object
  - `importRemappings`: Array of remapping objects (for imports). Must contain:
    - `target`: Absolute path to the imported contract
- `solcVersion`: string: solc version used to compile
- `getWeb3DeployObject`: Function to get a [web3 deploy object](https://web3js.readthedocs.io/en/v1.2.0/web3-eth-contract.html#deploy)
- `getAllContracts`: Function that returns all contract objects. Contract object must contain: linkReferences(from solc output contract.evm.bytecode.linkReferences)}
  - `className`: string: Class name of the contract
  - `originalFilename`: string: Original file name of the file (relative path)
  - `filename`: string: Complete absolute file path
  - `deployedAddress`: string: Address where the contract is deployed
  - `linkReferences`: object: Library link references. You can get it from the solc output as `contract.evm.bytecode.linkReferences`
- `getContractByName`: Function to get a contract object by name. Contains the same as all contracts above
- `getNetworkId`: Function that returns the current networkId
