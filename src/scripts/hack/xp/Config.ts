import { NS } from '@ns';


const DEFAULT_TARGET = "joesguns"
const MAX_SPREAD = 30
const XP_RAM_PCT = "auto"

const CONFIG_FILE ="/data/xp_config.txt" 

type XpRamPctType = "auto" | number

type XpConfig = {
  target: string
  maxSpread: number
  xpRamPct: XpRamPctType
}

export let defaultConfig:XpConfig = {
  target: DEFAULT_TARGET,
  maxSpread: MAX_SPREAD,
  xpRamPct: XP_RAM_PCT,
}

export class Config {
  static target: string
  static maxSpread: number
  static xpRamPct: string | number

  static getCurrentConfig() {
    return JSON.stringify(Object.assign({}, this), null, 2)
  }

  static loadConfig(config:Partial<XpConfig>) {
    Object.assign(this, config)
  }

  static loadConfigFromFile(ns:NS):boolean {
    if (ns.fileExists(CONFIG_FILE)) {
      let fileConfig:Partial<XpConfig> = JSON.parse(ns.read(CONFIG_FILE))
      this.loadConfig(fileConfig)
      return true
    }
    return false
  }

  static writeConfigToFile(ns:NS) {
    ns.write(CONFIG_FILE, JSON.stringify(Object.assign({}, this), null, 2), "w")
  }

  static {
    this.loadConfig(defaultConfig)
  }
}


/** @param {NS} ns **/
export async function main(ns: NS) {
  ns.disableLog("ALL")

  let [cmd = "list"] = ns.args;

  if (cmd === "list") {
    ns.tprint(Config.getCurrentConfig())
  } else if (cmd === "write") {
    ns.tprint(`Writing config to ${CONFIG_FILE}`)
    Config.writeConfigToFile(ns)
  } else if (cmd === "reload") {
    ns.tprint(`Reloading config from ${CONFIG_FILE}`)
    Config.loadConfigFromFile(ns)
    ns.tprint(`New configuration is ${Config.getCurrentConfig()}`)
  }
}