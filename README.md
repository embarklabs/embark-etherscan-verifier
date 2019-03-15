Embark-etherscan-verifier
======

Plugin for [Embark](https://github.com/embark-framework/embark) to flatten and verify contracts on Etherscan

## Installation

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

## Usage

### Flatten
In the console, type `flatten` or `flatten ContractName(s)`

- `flatten`: Flattens all contracts
- `flatten ContractName(s)`: Flattens the specified contract(s). For multiple contracts, separate them using a comma.
 - Example: `flatten SimpleStorage,Token`

### Verify
You can also automatically verify on a valid network (mainnet, ropsten, rinkeby, kovan)

In the console:

- `verify <API_KEY> <contractName>`: Verifies the specified contract (flattens if it was not done before)
  - You need an Etherscan API key. You can find a simple tutorial [here](https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key)
  - Example: `verify YOUR_KEY SimpleStorage`

## Requirements

- Embark 4.0.0 or higher

