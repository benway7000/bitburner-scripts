import { NS } from '@ns';

/**
 * Singleton supplies accessors using Revealing Module 
 * pattern and we use generics, since we could reuse 
 * this across multiple singletons
 *
 * Note: Object.freeze() not required due to type narrowing!
 */
export const makeConfig = <T extends Object>(ns: NS, configFile: string, initial: T) => {
  let _ns = ns
  let _configFile = configFile

  /** Closure of the singleton's value to keep it private */
  let _config: T = initial;
  /** Only the accessors are returned */
  return {
    getCurrentConfig() {
      return JSON.stringify(Object.assign({}, _config), null, 2)
    },

    getConfigFile() {
      return _configFile
    },

    setConfigFile(configFile: string) {
      _configFile = configFile
    },

    loadConfig(config:Partial<T>) {
      Object.assign(_config, config)
    },
  
    loadConfigFromFile():boolean {
      _ns.tprint(`loadConfigFromFile`)
      return true
      // try {
      //   _ns.tprint(`loadConfigFromFile: file ${_configFile} exists`)
      //   let fileConfig:Partial<T> = JSON.parse(_ns.read(_configFile))
      //   _ns.tprint(`loadConfigFromFile: file ${_configFile} loaded`)
      //   this.loadConfig(fileConfig)
      //   _ns.tprint(`loadConfigFromFile: config loaded`)
      //   return true
      // } catch (e) {
      //   _ns.tprint(`loadConfigFromFile: return false`)
      //   return false  
      // }
    },
  
    writeConfigToFile() {
      _ns.write(_configFile, JSON.stringify(Object.assign({}, _config), null, 2), "w")
    },
  
    // static {
    //   this.loadConfig(defaultConfig)
    // }

    getConfig: (): T | undefined => _config,
    setConfig: (value: Partial<T>) => Object.assign(_config, value)
  }
}


