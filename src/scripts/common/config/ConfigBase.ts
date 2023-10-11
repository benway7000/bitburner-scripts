import { NS } from '@ns';

/**
 * Singleton supplies accessors using Revealing Module 
 * pattern and we use generics, since we could reuse 
 * this across multiple singletons
 *
 * Note: Object.freeze() not required due to type narrowing!
 */
export const makeConfig = <T extends Object>(configFile: string, initial: T) => {
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
  
    loadConfigFromFile(ns:NS):boolean {
      try {
        ns.tprint(`loadConfigFromFile: file ${_configFile} exists`)
        let fileConfig:Partial<T> = JSON.parse(ns.read(_configFile))
        ns.tprint(`loadConfigFromFile: file ${_configFile} loaded`)
        this.loadConfig(fileConfig)
        ns.tprint(`loadConfigFromFile: config loaded`)
        return true
      } catch (e) {
        ns.tprint(`loadConfigFromFile: return false`)
        return false  
      }
    },
  
    writeConfigToFile(ns:NS) {
      ns.write(_configFile, JSON.stringify(Object.assign({}, _config), null, 2), "w")
    },
  
    // static {
    //   this.loadConfig(defaultConfig)
    // }

    getConfig: (): T | undefined => _config,
    setConfig: (value: Partial<T>) => Object.assign(_config, value)
  }
}


