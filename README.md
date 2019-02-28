Embark-Flattener
======

Plugin for [Embark](https://github.com/embark-framework/embark) to flatten contracts so that they can be verified on Etherscan

## Installation


In your Embark dapp directory:

```npm install embark-solc --save```

then add embark-flattener to the plugins section in `embark.json`:

```Json
  "plugins": {
    "embark-flattener": {}
  }
```

## Usage

### Flatten
In the console, type `flatten` or `flatten ContractName(s)`

- `flatten`: Flattens all contracts
- `flatten ContractName(s)`: Flattens the specified contract(s). For multiple contracts, separate them using a comma.

### Verify
You can also automatically verify on a valid network (mainnet, ropsten, rinkeby, kovan)

In the console:

- `verify <API_KEY> <contractName>`: Verifies the specified contract (flattens if it was not done before)
  - You need an Etherscan API key. You can find a simple tutorial [here](https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key)

## Requirements

- Embark 4.0.0 or higher

