const fs = require('fs-extra');
const path = require('path');
const async = require('async');

const OUTPUT_DIR = 'flattenedContracts';

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

        fs.mkdirp(OUTPUT_DIR, (err) => {
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

          const outputName = path.join(OUTPUT_DIR, path.basename(contract.path));
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

  flatten(contractNames, callback) {
    if (!contractNames) {
      return this._doFlatten(this.embark.config.contractsFiles, callback);
    }

    this.embark.events.request('contracts:all', (err, contracts) => {
      if (err) {
        return callback(err);
      }
      contractNames = contractNames.split(',');

      let contractsToFlatten;
      try {
        contractsToFlatten = contractNames.map(contractName => {
          const contract = Object.values(contracts).find(contract => contract.className === contractName);
          if (!contract) {
            throw new Error('No contract named ' + contractName);
          }
          return this.embark.config.contractsFiles.find(file => path.normalize(file.path) === path.normalize(contract.originalFilename));
        });
      } catch (e) {
        return callback(null, e.message.red);
      }

      this._doFlatten(contractsToFlatten, callback);
    });
  }
}

module.exports = Flattener;
