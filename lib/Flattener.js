const fs = require('fs-extra');
const path = require('path');
const async = require('async');

class Flattener {
  constructor(embark) {
    this.embark = embark;
  }

  _doFlatten(contracts, callback) {
    async.each(contracts, (contract, eachCb) => {
      const files = [contract.path];
      contract.importRemappings.forEach(remapping => {
        files.push(remapping.target);
      });

      async.concat(files, (file, concatCb) => {
        fs.readFile(file, (err, data) => {
          if (err) {
            return concatCb(err);
          }
          // Remove import statements
          data = data.toString().replace(/import ["'][-a-zA-Z0-9@:%_+.~#?&\/=]+["'];/g, '');
          concatCb(null, data);
        });
      }, (err, contractContents) => {
        if (err) {
          return eachCb(err);
        }

        fs.mkdirp('flattenedContracts', (err) => {
          if (err) {
            return eachCb(err);
          }

          // Remove pragma statements after the first one
          contractContents = contractContents.map((content, i) => {
            if (i === 0) {
              return content;
            }
            return content.replace(/pragma solidity .?\d+\.\d+\.\d+;/, '');
          });

          const outputName = path.join('flattenedContracts', path.basename(contract.path));
          fs.writeFile(outputName, contractContents.join('\n'), (err) => {
            if (err) {
              eachCb(err);
            }
            this.embark.logger.info(`Flattened ${path.basename(contract.path)} to ${outputName}`);
            eachCb();
          });
        });
      });
    }, callback);
  }

  flatten(contractFileNames, callback) {
    if (!contractFileNames) {
      return this._doFlatten(this.embark.config.contractsFiles, callback);
    }

    contractFileNames = contractFileNames.split(',');

    let contracts;
    try {
      contracts = contractFileNames.map(contractFileName => {
        const file = this.embark.config.contractsFiles.filter(file => path.normalize(file.filename).indexOf(path.normalize(contractFileName)) > -1);
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
