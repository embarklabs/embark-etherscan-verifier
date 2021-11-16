const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const axios = require('axios');
const querystring = require('querystring');

const OUTPUT_DIR = 'flattenedContracts';
const solcVersionsListLink = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.txt';
const API_URL_MAP = {
  1: 'https://api.etherscan.io/api',
  3: 'https://api-ropsten.etherscan.io/api',
  4: 'https://api-rinkeby.etherscan.io/api',
  42: 'https://api-kovan.etherscan.io/api'
};
const CONTRACT_URL_MAP = {
  1: 'https://etherscan.io/address',
  3: 'https://ropsten.etherscan.io/address',
  4: 'https://rinkeby.etherscan.io/address',
  42: 'https://kovan.etherscan.io/address'
};
const RETRY_COUNT = 5;
const RETRY_SLEEP_TIME  = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FlattenerVerifier {
  constructor(options) {
    this.options = options;
    this.logger = options.logger || console;
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
            this.logger.info(`Flattened ${path.basename(contract.path)} to ${outputName}`);
            eachCb();
          });
        });
      });
    }, callback);
  }

  _isContractValid(contract, contractName) {
    if (!contract) {
      this.logger.error(null, `Contract "${contractName}" was not found in contract list`.red);
      return false;
    }
    if (!contract.deployedAddress) {
      this.logger.error(null, `Contract "${contractName}" does not have a deployed address. Was the contract deployed?`.red);
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
      this.options.getContractByName(libName, (err, lib) => {
        if (err) {
          return eachCb(err);
        }
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
    if (!API_URL_MAP[network]) {
      return null;
    }
    return API_URL_MAP[network];
  }

  _doVerify(contract, flattenedCode, apiKey, solcVersion, networkId, callback) {
    const data = {
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: contract.deployedAddress,
      sourceCode: flattenedCode,
      contractname: contract.className,
      compilerversion: solcVersion,
      optimizationUsed: this.options.optimize ? 1 : 0,
      runs: this.options.optimizeRuns
    };

    this.options.getWeb3DeployObject(contract, (err, deployObject) => {
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

        const url = this._getUrl(networkId);
        const etherscanContractUrl = CONTRACT_URL_MAP[networkId];

        if (!url) {
          return callback(null, `The current network (id "${networkId}") not supported by Etherscan. Available are: ${Object.keys(API_URL_MAP).join(', ')}`.red);
        }

        this.logger.info('Sending the request...');

        try {
          const response = await axios.request({
            method: 'POST',
            url,
            data: querystring.stringify(data),
            headers: {
              'Content-type': 'application/x-www-form-urlencoded'
            }
          });

          if (response.status !== 200 || response.data.status !== '1') {
            return callback(null, `Error while trying to verify contract: ${JSON.stringify(response.data.result, null, 2)}`.red);
          }

          this.logger.info('Contract verification in process (this usually takes under 30 seconds)...');
          await this.checkEtherscanVerificationStatus(response.data.result, url, RETRY_COUNT);
          callback(null, `Contract verified successfully. You can check it here: ${etherscanContractUrl}/${contract.deployedAddress}#code`);
        } catch(error) {
          this.logger.error('Error while trying to verify contract');
          callback(null, error.message);
        }
      });
    });
  }

  async checkEtherscanVerificationStatus(guid, etherscanApiUrl, retries = RETRY_COUNT) {
    const queryParams = querystring.stringify({
      guid,
      action: 'checkverifystatus',
      module: 'contract'
    });

    try {
      this.logger.info('Checking the verification status...');
      const response = await axios.request({
        method: 'GET',
        url: `${etherscanApiUrl}?${queryParams}`
      });

      if (response.data.status !== '1') {
        throw new Error(`Error while trying to verify contract: ${JSON.stringify(response.data.result, null, 2)}`);
      }
    } catch(error) {
      if (retries === 0) {
        throw new Error(error.message || 'Error while trying to check verification status');
      }
      this.logger.warn(`Verification not finished. Checking again in ${RETRY_SLEEP_TIME / 1000} seconds...`);
      await sleep(RETRY_SLEEP_TIME);
      await this.checkEtherscanVerificationStatus(guid, etherscanApiUrl, retries - 1);
    }
  }

  verify(apiKey, contractName, callback) {
    this.options.getContractByName(contractName, (err, contract) => {
      if (err) {
        return callback(err);
      }
      if (!this._isContractValid(contract, contractName)) {
        return callback(null, 'Please make sure you specify the contract name as the class name. E.g. SimpleStorage instead of simple_storage.sol');
      }

      const flattenedContractFile = path.join(OUTPUT_DIR, path.basename(contract.filename));
      let flattenedFileExists = false;
      if (fs.existsSync(flattenedContractFile)) {
        this.logger.info(`Using the already flattened contract (${flattenedContractFile})`);
        flattenedFileExists = true;
      }

      async.waterfall([
        (next) => { // Flatten if needed
          if (flattenedFileExists) {
            return next();
          }
          const file = this.options.contractsFiles.find(file => path.normalize(file.path) === path.normalize(contract.filename));
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
              const solcVersion = response.data.split('\n')
                .find(version => {
                  return version.indexOf(this.options.solcVersion) > -1 && version.indexOf('nightly') === -1;
                });
              next(null, content, solcVersion.replace('soljson-', '').replace('.js', ''));
            })
            .catch(next);
        },
        (content, solcVersion, next) => {
        this.options.getNetworkId((err, networkId) => {
            next(err, content, solcVersion, networkId);
          });
        }
      ], (err, content, solcVersion, networkId) => {
        if (err) {
          return callback(err);
        }
        this._doVerify(contract, content, apiKey, solcVersion, networkId, callback);
      });
    });
  }

  flatten(contractNames, callback) {
    if (!contractNames) {
      return this._doFlatten(this.options.contractsFiles, callback);
    }

    this.options.getAllContracts((err, contracts) => {
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
          return this.options.contractsFiles.find(file => path.normalize(file.originalPath) === path.normalize(contract.originalFilename));
        });
      } catch (e) {
        return callback(null, e.message.red);
      }

      this._doFlatten(contractsToFlatten, callback);
    });
  }
}

module.exports = FlattenerVerifier;
