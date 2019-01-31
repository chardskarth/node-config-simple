const path = require('path');
const fs = require('fs');
const jsYaml = require('js-yaml');
const merge = require('deepmerge');

const getCmdLineArg = (searchFor) => {
  const cmdLineArgs = process.argv.slice(2, process.argv.length);
  const argName = `--${searchFor}=`;

  const searchedArg = cmdLineArgs.find(x => x.indexOf(argName) === 0);
  if (!searchedArg) {
    return false;
  }
  return searchedArg.substr(argName.length);
};

const initParam = (paramName, defaultValue) => {
  // Record and return the value
  const value = getCmdLineArg(paramName) || process.env[paramName] || defaultValue;
  return value;
};

const parseString = (content) => {
  // Initialize
  let configObject = null;

  configObject = jsYaml.load(content);
  return configObject;
};


const parseFile = (fullFilename) => {
  // Initialize
  const extension = fullFilename.substr(fullFilename.lastIndexOf('.') + 1);
  let fileContent = null;
  let stat = null;

  // Return null if the file doesn't exist.
  // Note that all methods here are the Sync versions.  This is appropriate during
  // module loading (which is a synchronous operation), but not thereafter.
  try {
    stat = fs.statSync(fullFilename);
    if (!stat || stat.size < 1) {
      return null;
    }
  } catch (e1) {
    return null;
  }

  // Try loading the file.
  try {
    fileContent = fs.readFileSync(fullFilename, 'UTF-8');
    fileContent = fileContent.replace(/^\uFEFF/, '');
  } catch (e2) {
    throw new Error(`Config file ${fullFilename} cannot be read`);
  }

  return parseString(fileContent, extension);
};

const getImpl = (object, property, dontThrow) => {
  const elems = Array.isArray(property) ? property : property.split('.');
  const name = elems[0];
  const value = object[name];
  if (elems.length <= 1) {
    return value;
  }
  // Note that typeof null === 'object'
  if (value === null || typeof value !== 'object') {
    if (dontThrow) {
      return undefined;
    }
    throw new Error(`Configuration property "${property}" is not defined`);
  }
  return getImpl(value, elems.slice(1));
};

const loadConfig = () => {
  let configObj = {};
  const configEnvName = initParam('NODE_CONFIG_ENV_NAME', 'NODE_ENV');
  const configEnv = initParam('NODE_CONFIG_ENV', initParam(configEnvName, 'development'));
  const configDir = initParam('NODE_CONFIG_DIR', path.join(process.cwd(), 'config'));
  //
  // Read each file in turn
  const baseNames = ['default'].concat([configEnv]);
  baseNames.push('local', `local-${configEnv}`);
  baseNames.push('application', `application-${configEnv}`);

  const extNames = ['yaml', 'yml'];
  baseNames.forEach((baseName) => {
    extNames.forEach((extName) => {
      // Try merging the config object into this object
      const fullFilename = path.join(configDir, `${baseName}.${extName}`);
      const configObjFromFile = parseFile(fullFilename);
      if (configObjFromFile) {
        configObj = merge(configObj, configObjFromFile);
      }
    });
  });

  return {
    get(property) { return getImpl(configObj, property) },
    has(property) { return getImpl(configObj, property, true) },
  };
};

module.exports = loadConfig();
