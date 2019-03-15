/*global require, module*/

const FlattenerVerifier = require('./lib/FlattenerVerifier');

module.exports = (embark) => {
  const flattenerVerifier = new FlattenerVerifier(embark);

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


      flattenerVerifier.flatten(contractNames, callback);
    }
  });

  const etherscanKeyDocsLink = 'https://etherscancom.freshdesk.com/support/solutions/articles/35000022163-i-need-an-api-key';
  embark.registerConsoleCommand({
    description: `Verifies a contract on Etherscan using you contract configuration\n\t\tRequires an Etherscan API key.
    See: ${etherscanKeyDocsLink}`,
    matches: (cmd) => {
      const [commandName] = cmd.split(' ');
      return commandName === 'verify';
    },
    usage: "verify <apiKey> <contractName>]",
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

      flattenerVerifier.verify(apiKey, contractName, callback);
    }
  });
};
