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

In the console, type `flatten` or `flatten ContractName(s)`

- `flatten`: Flattens all contracts
- `flatten ContractName(s)`: Flattens the specified contract(s). For multiple contracts, separate them using a comma.

## Requirements

- Embark 4.0.0 or higher

