import { NS } from '@ns';
import { InitializeNS, ns } from "scripts/lib/NS";

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_HACKPCT = 0.25 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.02 // extra grow threads to be sure
const WEAKEN_THREAD_MULT = 1.02 // extra weaken threads to be sure
const MAX_BATCHES_PER_TARGET = 50
const MAX_TRIES_PER_LOOP = 50
const LOOP_DELAY = 5 * 1000
const BATCH_PHASE_DELAY = 300 // delay (in ms) between batch phase finishes (HWGW)
const SCRIPT_PREFIX = "batcher_"
const FINISHED_BATCH_LOGGING_SAMPLE_RATE = 0.2

const CONFIG_FILE ="/data/batcher_config.txt" 
export const BATCHER_PORT = 1

type BatcherConfig = {
  maxTriesPerLoop: number
  loopDelay: number
  batchPhaseDelay: number
  defaultHackPct: number
  growThreadMult: number
  weakenThreadMult: number
  maxSecurityDrift: number
  maxMoneyDriftPct: number
  scriptPrefix: string
  finishedBatchLoggingSampleRate: number
  maxBatchPerTarget: number
}

export let defaultConfig:BatcherConfig = {
  maxTriesPerLoop: MAX_TRIES_PER_LOOP,
  loopDelay: LOOP_DELAY,
  batchPhaseDelay: BATCH_PHASE_DELAY,
  defaultHackPct: DEFAULT_HACKPCT,
  growThreadMult: GROW_THREAD_MULT,
  weakenThreadMult: WEAKEN_THREAD_MULT,
  maxSecurityDrift: MAX_SECURITY_DRIFT,
  maxMoneyDriftPct: MAX_MONEY_DRIFT_PCT,
  scriptPrefix: SCRIPT_PREFIX,
  finishedBatchLoggingSampleRate: FINISHED_BATCH_LOGGING_SAMPLE_RATE,
  maxBatchPerTarget: MAX_BATCHES_PER_TARGET,
}

export class Config {
  static maxTriesPerLoop: number
  static loopDelay: number
  static batchPhaseDelay: number
  static defaultHackPct: number
  static growThreadMult: number
  static weakenThreadMult: number
  static maxSecurityDrift: number
  static maxMoneyDriftPct: number
  static scriptPrefix: string
  static finishedBatchLoggingSampleRate: number
  static maxBatchPerTarget: number


  static getCurrentConfig() {
    return JSON.stringify(Object.assign({}, this), null, 2)
  }

  static loadConfig(config:Partial<BatcherConfig>) {
    Object.assign(this, config)
  }

  static loadConfigFromFile():boolean {
    if (ns.ns.fileExists(CONFIG_FILE)) {
      let fileConfig:Partial<BatcherConfig> = JSON.parse(ns.ns.read(CONFIG_FILE))
      this.loadConfig(fileConfig)
      return true
    }
    return false
  }

  static writeConfigToFile() {
    ns.ns.write(CONFIG_FILE, JSON.stringify(Object.assign({}, this), null, 2), "w")
  }

  static {
    if (!this.loadConfigFromFile()) {
      this.loadConfig(defaultConfig)
    }
  }
}


/** @param {NS} ns **/
export async function main(ns: NS) {
  ns.disableLog("ALL")

  InitializeNS(ns)

  let [cmd = "list"] = ns.args;

  if (cmd === "list") {
    ns.tprint(Config.getCurrentConfig())
  } else if (cmd === "write") {
    ns.tprint(`Writing config to ${CONFIG_FILE}`)
    Config.writeConfigToFile()
  } else if (cmd === "reload") {
    // talk to batcher.ts
    ns.tprint(`Reloading config from ${CONFIG_FILE}`)
    // let reloadCmd = {command: "reload"}
    // while (!ns.tryWritePort(BATCHER_PORT, JSON.stringify(reloadCmd))) await ns.asleep(1000)
    Config.loadConfigFromFile()
    ns.tprint(`New configuration is ${Config.getCurrentConfig()}`)
  }
}