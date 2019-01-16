const path = require('path');
const async = require('async');

class Flattener {
  constructor(embark) {
    this.embark = embark;
  }

  _doFlatten(contracts, callback) {
    async.each(contracts, contract => {
      const files = [contract.path];
      contract.importRemappings.forEach(remapping => {
        files.push(remapping.target);
      });
    });

    callback();
  }

  flatten(contractFileNames, callback) {
    if (!contractFileNames) {
      return this._doFlatten(this.embark.config.contractsFiles, callback);
    }

    contractFileNames = contractFileNames.split(',');

    let contracts;
    try {
      contracts = contractFileNames.map(contractFileName => {
        const file = this.embark.config.contractsFiles.filter(file =>  path.normalize(file.filename).indexOf(path.normalize(contractFileName)) > -1);
        if (file.length === 0) {
          throw new Error('No contract file named ' + contractFileName);
        }
        if (file.length > 1) {
          throw new Error(`More then one contract file matched ${contractFileName}. Try to be more specific by adding the directory the contract is in. E.g: "flatten myDir/myContract.sol"`);
        }
        return file[0];
      });
    } catch (e) {
      return callback(null, e.message.red);
    }

    this._doFlatten(contracts, callback);
  }
}

module.exports = Flattener;
