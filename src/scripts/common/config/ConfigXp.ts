import { NS } from '@ns';
import { makeConfig } from "scripts/common/config/ConfigBase";

/**
 * Type of whatever we want to store in the singleton
 * In this case, it is an object with a name attribute
 */
// export type SingletonValue = {name: string};

export type XpRamPctType = "auto" | number

export interface XpConfig {
  target: string
  maxSpread: number
  xpRamPct: XpRamPctType
}


const DEFAULT_TARGET = "joesguns"
const MAX_SPREAD = 30
const XP_RAM_PCT = "auto"
const CONFIG_FILE ="/data/xp_config_new.txt"
/** initial config */
export let defaultConfig:XpConfig = {
  target: DEFAULT_TARGET,
  maxSpread: MAX_SPREAD,
  xpRamPct: XP_RAM_PCT,
}

/**
 * The only instance of our Singleton
 */
let instance: ReturnType<typeof makeConfig<XpConfig>>;

/**
 * Retrieves the only instance of the Singleton
 * and allows a once-only initialisation
 * (additional changes require the setValue accessor)
 */
const getInstance = (ns:NS, initial: XpConfig = defaultConfig) => {
  if (!instance) {
    instance = makeConfig<XpConfig>(ns, CONFIG_FILE, initial);
    return instance;
  }
  return instance;
};

export default getInstance;

/** @param {NS} ns **/
export async function main(ns: NS) {
  // ns.disableLog("ALL")

  instance = getInstance(ns)

  let [cmd = "list"] = ns.args;

  if (cmd === "list") {
    ns.tprint(instance.getCurrentConfig())
  } else if (cmd === "write") {
    ns.tprint(`Writing config to ${instance.getConfigFile()}`)
    instance.writeConfigToFile()
  } else if (cmd === "reload") {
    ns.tprint(`Reloading config from ${instance.getConfigFile()}`)
    instance.loadConfigFromFile()
    ns.tprint(`New configuration is ${instance.getCurrentConfig()}`)
  }
}