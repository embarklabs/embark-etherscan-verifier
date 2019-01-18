const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const axios = require('axios');
const querystring = require('querystring');

const OUTPUT_DIR = 'flattenedContracts';
const solcVersionsListLink = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.txt';
const MAIN_API_URL = 'https://api.etherscan.io/api';
const TESTNET_API_URL_MAP = {
  ropsten: 'https://api-ropsten.etherscan.io/api',
  kovan: 'https://api-kovan.etherscan.io/api',
  rinkeby: 'https://api-rinkeby.etherscan.io/api'
};

class Flattener {
  constructor(embark) {
    this.embark = embark;
    this.events = embark.events;
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

  _isContractValid(contract, contractName) {
    if (!contract) {
      this.embark.logger.error(null, `Contract "${contractName}" was not found in contract list`.red);
      return false;
    }
    if (!contract.deployedAddress) {
      this.embark.logger.error(null, `Contract "${contractName}" does not have a deployed address. Was the contract deployed?`.red);
      return false;
    }
    return true;
  }

  _addLibraries(data, contract, callback) {
    if (!contract.linkReferences || !Object.values(contract.linkReferences).length) {
      return callback();
    }

    let libNames = [];
    Object.values(contract.linkReferences).forEach(fileObject => {
      libNames = libNames.concat(Object.keys(fileObject));
    });
    libNames = Array.from(new Set(libNames));

    async.eachOf(libNames, (libName, index, eachCb) => {
      this.events.request("contracts:contract", libName, (lib) => {
        if (!this._isContractValid(lib, libName)) {
          return eachCb('Make sure the library is not set as `deploy: false`');
        }

        data[`libraryname${index + 1}`] = libName;
        data[`libraryaddress${index + 1}`] = lib.deployedAddress;
        eachCb();
      });
    }, callback);
  }

  _getUrl(network) {
    if (!network) {
      return MAIN_API_URL;
    }
    if (!TESTNET_API_URL_MAP[network]) {
      return null;
    }
    return TESTNET_API_URL_MAP[network];
  }

  _doVerify(contract, flattenedCode, apiKey, solcVersion, network, callback) {
    const data = {
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: contract.deployedAddress,
      sourceCode: flattenedCode,
      contractname: contract.className,
      compilerversion: solcVersion,
      optimizationUsed: this.embark.config.embarkConfig.options.solc.optimize ? 1 : 0,
      runs: this.embark.config.embarkConfig.options.solc['optimize-runs']
    };

    // let contractCode   = contract.code;
    // this.embark.events.request("blockchain:contract:create", {abi: contract.abiDefinition}, (contractObject) => {
    //   cb(self.ContractObject(params));
    // });
    //
    // let contractObject = self.blockchain.ContractObject({abi: contract.abiDefinition});
    // let contractParams = (contract.realArgs || contract.args).slice();
    //
    // const dataCode = contractCode.startsWith('0x') ? contractCode : "0x" + contractCode;
    // const deployObject = self.blockchain.deployContractObject(contractObject, {arguments: contractParams, data: dataCode});

    this.events.request('deploy:contract:object', contract, (err, deployObject) => {
      if (err) {
        return callback(err);
      }

      const encodedABI = deployObject.encodeABI();

      let deployArguments = encodedABI.substring(encodedABI.length - 68);

      if (deployArguments.substring(0, 3) !== '0029' && deployArguments.substring(deployArguments.length - 4) === '0029') {
        // Most likely NOT arguments
        deployArguments = '';
      } else {
        deployArguments = deployArguments.substring(4);
        data.constructorArguements = deployArguments;
      }

      this._addLibraries(data, contract, async (err) => {
        if (err) {
          return callback(err);
        }

        const url = this._getUrl(network);

        if (!url) {
          return callback(null, `Unknown network "${network}". Available are: ${Object.keys(TESTNET_API_URL_MAP).join(', ')}`.red);
        }

        this.embark.logger.info('Sending the request...');

        try {
          const response = await axios.request({
            method: 'POST',
            url: url,
            data: querystring.stringify(data),
            headers: {
              'Content-type': 'application/x-www-form-urlencoded'
            }
          });

          console.log(JSON.stringify(response.data, null, 2));
          callback();

        } catch(error) {
          this.embark.logger.error('Error while trying to verify contract');
          callback(null, error.message);
        }
      });
    });
  }

  verify(apiKey, contractName, network, callback) {
    apiKey = 'CUJMXWDRM6DJRP896B98XJ8AKVZPKJIPKD';

    this.events.request("contracts:contract", contractName, (contract) => {
      if (!this._isContractValid(contract, contractName)) {
        return callback(null, 'Please make sure you specify the contract name as the class name. E.g. SimpleStorage instead of simple_storage.sol');
      }

      const flattenedContractFile = path.join(OUTPUT_DIR, contract.filename);
      let flattenedFileExists = false;
      if (fs.existsSync(flattenedContractFile)) {
        this.embark.logger.info(`Using the already flattened contract (${flattenedContractFile})`);
        flattenedFileExists = true;
      }

      async.waterfall([
        (next) => { // Flatten if needed
          if (flattenedFileExists) {
            return next();
          }
          const file = this.embark.config.contractsFiles.find(file => path.normalize(file.path) === path.normalize(contract.originalFilename));
          this._doFlatten([file], next);
        },
        (next) => { // Read the flattened contract
          fs.readFile(flattenedContractFile, (err, content) => {
            if (err) {
              return next(err);
            }
            next(null, content.toString());
          });
        },
        (content, next) => { // Get supported versions list
          axios.get(solcVersionsListLink)
            .then((response) => {
              const solcVersion = response.data.split('\n').find(version => version.indexOf(this.embark.config.embarkConfig.versions.solc) > -1 && version.indexOf('nightly') === -1);
              next(null, content, solcVersion.replace('soljson-', '').replace('.js', ''));
            })
            .catch(next);
        }
      ], (err, content, solcVersion) => {
        if (err) {
          return callback(err);
        }
        this._doVerify(contract, content, apiKey, solcVersion, network, callback);
      });
    });
  }

  flatten(contractNames, callback) {
    if (!contractNames) {
      return this._doFlatten(this.embark.config.contractsFiles, callback);
    }

    this.events.request('contracts:all', (err, contracts) => {
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
