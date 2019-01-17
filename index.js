/*global require, module*/

const Flattener = require('./lib/Flattener');

module.exports = (embark) => {
  const flattener = new Flattener(embark);

  embark.registerConsoleCommand({
    description: "Flattens all or some of your contracts so that they can be verified on etherscan\n\t\tYou can specify which contract to flatten by using their filename (relative to the contract directory specified in embark.json). For multiple contracts, separate them using a comma",
    matches: (cmd) => {
      const [commandName] = cmd.split(' ');
      return commandName === 'flatten';
    },
    usage: "flatten or flatten <contracts>",
    process: (cmd, callback) => {
      const [, contractNames] = cmd.split(' ');

      if (contractNames) {
        embark.logger.info('Flattening ' + contractNames);
      } else {
        embark.logger.info('Flattening all contracts');
      }


      flattener.flatten(contractNames, callback);
    }
  });

  embark.registerConsoleCommand({
    description: "Verifies a contract on Etherscan using you contract configuration. Requires an Etherscan API key. See: https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key",
    matches: (cmd) => {
      const [commandName] = cmd.split(' ');
      return commandName === 'verify';
    },
    usage: "verify <apiKey> <contractName>",
    process: (cmd, callback) => {
      const [, apiKey, contractName] = cmd.split(' ');

      flattener.verify(apiKey, contractName, callback);
    }
  });
};
