/*global require, module*/

const FlattenerVerifier = require('./lib/FlattenerVerifier');

module.exports = (embark) => {
  function createVerifier() {
    return new FlattenerVerifier({
      optimize: embark.config.embarkConfig.options.solc.optimize,
      optimizeRuns: embark.config.embarkConfig.options.solc['optimize-runs'],
      contractsFiles: embark.config.contractsFiles,
      solcVersion: embark.config.embarkConfig.versions.solc,
      getWeb3DeployObject: (contract, cb) => {
        embark.events.request('deploy:contract:object', contract, cb);
      },
      getAllContracts: (cb) => {
        embark.events.request('contracts:all', cb);
      },
      getContractByName: (contractName, cb) => {
        embark.events.request("contracts:contract", contractName, (contract) => {
          cb(null, contract);
        });
      },
      getNetworkId: (cb) => {
        embark.events.request("blockchain:networkId", (networkId) => {
          cb(null, networkId);
        });
      }
    });
  }

    embark.registerConsoleCommand({
    description: "Flattens all or some of your contracts so that they can be verified on Etherscan\n\t\tYou can specify which contract to flatten by using their contract name. For multiple contracts, separate them using a comma",
    matches: (cmd) => {
      const [commandName] = cmd.split(' ');
      return commandName === 'flatten';
    },
    usage: "flatten or flatten [contracts]",
    process: (cmd, callback) => {
      const [, contractNames] = cmd.split(' ');

      if (contractNames) {
        embark.logger.info('Flattening ' + contractNames);
      } else {
        embark.logger.info('Flattening all contracts');
      }

      createVerifier().flatten(contractNames, callback);
    }
  });

  const etherscanKeyDocsLink = 'https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key';
  embark.registerConsoleCommand({
    description: `Verifies a contract on Etherscan using you contract configuration\n\t\tRequires an Etherscan API key.\n\t\tSee: ${etherscanKeyDocsLink}`,
    matches: (cmd) => {
      const [commandName] = cmd.split(' ');
      return commandName === 'verify';
    },
    usage: "verify [apiKey] [contractName]",
    process: (cmd, callback) => {
      const [, apiKey, contractName] = cmd.split(' ');

      if (!apiKey || !contractName) {
        embark.logger.error('Missing argument. Please provide your Etherscan API key and the contract name'.red);
        embark.logger.error(`You can get an API key using this tutorial: ${etherscanKeyDocsLink}`.cyan);
        return callback();
      }

      if (!embark.config.embarkConfig.versions.solc) {
        return callback(null, 'solc version not present in embarkjs.json. Please add it to versions.solc'.red);
      }

      createVerifier().verify(apiKey, contractName, callback);
    }
  });
};
