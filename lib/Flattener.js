const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const axios = require('axios');

const OUTPUT_DIR = 'flattenedContracts';
const solcVersionsListLink = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.txt';

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

  _doVerify(contract, flattenedCode, apiKey, solcVersion, callback) {
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

      console.log(JSON.stringify(data, null, 2));
      return callback();

      const libraryLinkings = 'get from contract something';
      // Loop those and add libraries
      // libraryname1: $('#libraryname1').val(),         //if applicable, a matching pair with libraryaddress1 required
      // libraryaddress1: $('#libraryaddress1').val(),   //if applicable, a matching pair with libraryname1 required

      axios.post('//api.etherscan.io/api', data)
        .then(function(result) {
          console.log(result);
          if (result.status === "1") {
            //1 = submission success, use the guid returned (result.result) to check the status of your submission.
            // Average time of processing is 30-60 seconds
            document.getElementById("postresult").innerHTML = result.status + ";" + result.message + ";" + result.result;
            // result.result is the GUID receipt for the submission, you can use this guid for checking the verification status
          } else {
            //0 = error
            document.getElementById("postresult").innerHTML = result.status + ";" + result.message + ";" + result.result;
          }
          console.log("status : " + result.status);
          console.log("result : " + result.result);
        })
        .catch(function(error) {
          console.log("error!", error);
        });
    });
  }

  verify(apiKey, contractName, callback) {
    apiKey = 'CUJMXWDRM6DJRP896B98XJ8AKVZPKJIPKD';

    this.events.request("contracts:contract", contractName, (contract) => {
      if (!contract) {
        return callback(null, `Contract ${contractName} was not found in contract list`.red);
      }
      if (!contract.deployedAddress) {
        return callback(null, `Contract ${contractName} does not have a deployed address. Was the contract deployed?`.red);
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
              next(null, content, solcVersion);
            })
            .catch(next);
        }
      ], (err, content, solcVersion) => {
        if (err) {
          return callback(err);
        }
        this._doVerify(contract, content, apiKey, solcVersion, callback);
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
