/*global require, module*/

const Flattener = require('./lib/Flattener');

module.exports = (embark) => {
  const flattener = new Flattener(embark);

  embark.registerConsoleCommand({
    description: "Flattens all or some of your contracts so that they can be verified on etherscan\n\t\tYou can specify which contract to flatten by using their filename (relative to the contract directory specified in embark.json). For multiple contracts, separate them using a comma",
    matches: (cmd) => {
      const [commandName] = cmd.split(' '); // You can use `split` for commands that receive parameters
      return commandName === 'flatten';
    },
    usage: "flatten or flatten <contracts>",
    process: (cmd, callback) => {
      const [, contractNames] = cmd.split(' ');

      if (contractNames) {
        embark.logger.info('Going to flatten', contractNames);
      } else {
        embark.logger.info('Going to flatten all contracts');
      }


      flattener.flatten(contractNames, callback);
    }
  });
};
