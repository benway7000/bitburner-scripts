import { NS } from '@ns';
import { Config } from "scripts/hack/batch/Config";
import { Target } from "scripts/hack/batch/Target";
import { SessionState } from "scripts/hack/batch/SessionState"
import { WaitPids, FormatTime } from "scripts/lib/utils"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { TokenGenerator } from '/scripts/fracturedjson/TokenGenerator';

export const BATCH_STATES = {
  PREP: "prep",
  BATCH: "batch",
  CALLBACK: "callback",
  COMPLETE: "complete",
}

const scriptRamUsage = {
  weaken: 1.75,
  grow: 1.75,
  hack: 1.7
}

type BatchType = "hack" | "prep" | "unknown"

type ServerState = {
  money: number
  maxMoney: number
  minSec: number
  sec: number
}

const SERVER_STATE_UNKNOWN = {
  money: 0,
  maxMoney: 0,
  minSec: 0,
  sec: 0
}

type RamStats = {
  totalRamUsage: number
  hackRamUsage: number
  weaken1RamUsage: number
  growRamUsage: number
  weaken2RamUsage: number
}

export class Batch {
  targetHostname: string
  batchNumber: number
  hackPct: number = Config.defaultHackPct
  batchType: BatchType
  weaken1Action: WeakenAction
  weaken2Action: WeakenAction
  growAction: GrowAction
  hackAction: HackAction
  initialState: ServerState = SERVER_STATE_UNKNOWN
  finalState: ServerState = SERVER_STATE_UNKNOWN
  ramStats: RamStats = { totalRamUsage: 0, hackRamUsage: 0, weaken1RamUsage: 0, growRamUsage: 0, weaken2RamUsage: 0 }
  expectedDuration: number = 0
  expectedEndTime: number = 0
  result: any

  constructor(ns:NS, targetHostname: string, batchNumber: number, batchType: BatchType) {
    this.targetHostname = targetHostname
    this.batchNumber = batchNumber
    this.batchType = batchType

    this.weaken1Action = new WeakenAction("weaken", "", -1)
    this.weaken2Action = new WeakenAction("weaken", "", -1)
    this.growAction = new GrowAction("grow", "", -1)
    this.hackAction = new HackAction("hack", "", -1)

    let ram = new MemoryMap(ns)
    do {
      this.CalcBatch(ns, ram)
      if (this.batchType === "prep") break // don't scale prep batches
      if (ram.available >= this.ramStats.totalRamUsage) break // we can run it, break
      if (this.hackPct <= 0.0001) break // at least do .01% even if not enough ram

      // reduce hack pct, then redo calc
      this.hackPct = Math.max(this.hackPct / 2, 0.0001)
    } while (ram.available < this.ramStats.totalRamUsage)
    if (this.hackPct != Config.defaultHackPct) ns.print(`Batch re-calculated with hackPct ${this.hackPct}`)
  }

  IsPrep() {
    return this.batchType === "prep"
  }

  getServerState(ns:NS):ServerState {
    // Money
    let money = Math.max(ns.getServerMoneyAvailable(this.targetHostname), 1)
    let maxMoney = ns.getServerMaxMoney(this.targetHostname)

    // Security
    const minSec = ns.getServerMinSecurityLevel(this.targetHostname)
    const sec = ns.getServerSecurityLevel(this.targetHostname)
    return {
      money, maxMoney, minSec, sec
    }
  }

  CalcBatch(ns:NS, ram: MemoryMap) {
    // HWGW. assume server is prepped (max money, sec-minSec = 0)
    //                    |= hack ====================|
    // |=weaken 1======================================|
    //                |= grow ==========================|
    //   |=weaken 2======================================|

    // calc initial server state

    // calc actions

    // calc predictions (ram usage, ?)


    
    this.initialState = this.getServerState(ns)
    const {
      money, maxMoney, minSec, sec
    } = this.initialState
    let startingExtraSecurity = sec - minSec


    // if (startingExtraSecurity > Config.maxSecurityDrift || (maxMoney * Config.maxMoneyDriftPct) > money) {
    //   this.batchType = "prep"
    // } else {
    //   this.batchType = "hack"
    // }

    let overallDuration = this.expectedDuration = ns.getWeakenTime(this.targetHostname) + 2 * Config.batchPhaseDelay
    this.expectedEndTime = Date.now() + overallDuration

    // Hack lands first
    // Hacking (limited by pct)
    if (this.batchType === "hack") {
      this.hackAction = new HackAction("hack", this.targetHostname, this.batchNumber)
      this.hackAction.duration = ns.getHackTime(this.targetHostname)
      this.hackAction.hackMoneyRemoved = money * this.hackPct
      this.hackAction.threads = Math.floor(ns.hackAnalyzeThreads(this.targetHostname, this.hackAction.hackMoneyRemoved))
      this.hackAction.securityChange = ns.hackAnalyzeSecurity(this.hackAction.threads)
      this.hackAction.endTime = overallDuration - 3 * Config.batchPhaseDelay
      this.hackAction.startTime = this.hackAction.endTime - this.hackAction.duration
    }

    // Weaken1
    this.weaken1Action = new WeakenAction("weaken", this.targetHostname, this.batchNumber)
    this.weaken1Action.duration = ns.getWeakenTime(this.targetHostname)
    this.weaken1Action.securityToRemove = startingExtraSecurity + this.hackAction.securityChange
    this.weaken1Action.threads = Math.ceil(Config.weakenThreadMult * this.weaken1Action.securityToRemove / ns.weakenAnalyze(1))
    this.weaken1Action.endTime = overallDuration - 2 * Config.batchPhaseDelay
    this.weaken1Action.startTime = this.weaken1Action.endTime - this.weaken1Action.duration

    // grow
    // grow if server is not at max money or we are hacking (ie do not grow if server is at max and we are not hacking, ie prep)
    if (maxMoney - money > 0 || (this.hackAction.threads)) {
      this.growAction = new GrowAction("grow", this.targetHostname, this.batchNumber)
      this.growAction.duration = ns.getGrowTime(this.targetHostname)

      this.growAction.threads = Math.ceil(
        ns.growthAnalyze(this.targetHostname, (Config.growThreadMult * maxMoney) / (money - this.hackAction.hackMoneyRemoved))
      )
      this.growAction.securityChange = ns.growthAnalyzeSecurity(this.growAction.threads)
      this.growAction.endTime = overallDuration - 1 * Config.batchPhaseDelay
      this.growAction.startTime = this.growAction.endTime - this.growAction.duration
    }

    // Weaken2
    let weaken2SecurityToRemove = this.growAction.securityChange
    if (weaken2SecurityToRemove > 0) {
      this.weaken2Action = new WeakenAction("weaken", this.targetHostname, this.batchNumber)
      this.weaken2Action.duration = ns.getWeakenTime(this.targetHostname)
      this.weaken2Action.securityToRemove = weaken2SecurityToRemove
      this.weaken2Action.threads = Math.ceil(Config.weakenThreadMult * this.weaken2Action.securityToRemove / ns.weakenAnalyze(1))
      this.weaken2Action.endTime = overallDuration
      this.weaken2Action.startTime = this.weaken2Action.endTime - this.weaken2Action.duration
    }


    // ram usage
    let hackRamUsage = scriptRamUsage.hack * this.hackAction.threads
    let weaken1RamUsage = scriptRamUsage.weaken * this.weaken1Action.threads
    let growRamUsage = scriptRamUsage.grow * this.growAction.threads
    let weaken2RamUsage = scriptRamUsage.weaken * this.weaken2Action.threads
    let totalRamUsage = hackRamUsage + weaken1RamUsage + growRamUsage + weaken2RamUsage

    // scale prep batches - there's only W2 and Grow
    // TODO: FALSE, there could be W1 if server has security > minSec
    // with low-ram, it's possible that only W2 runs and we never grow
    if (this.batchType === "prep" && totalRamUsage > ram.available) {
      let scale_factor = Math.max(ram.available - ram.HomeBlock().reserved, 32) / totalRamUsage
      this.weaken2Action.threads = Math.max(Math.floor(this.weaken2Action.threads*scale_factor), 1)
      this.growAction.threads = Math.max(Math.floor(this.growAction.threads*scale_factor), 1)
      ns.print(`Scaled prep batch by factor of ${scale_factor}`)
      weaken2RamUsage = scriptRamUsage.weaken * this.weaken2Action.threads
      growRamUsage = scriptRamUsage.grow * this.growAction.threads
      totalRamUsage = hackRamUsage + weaken1RamUsage + growRamUsage + weaken2RamUsage
    }

    this.ramStats = {
      totalRamUsage, hackRamUsage, weaken1RamUsage, growRamUsage, weaken2RamUsage
    }
  }

  async RunBatch(ns:NS) {
    if (this.weaken1Action.threads) {
      this.weaken1Action.RunAction(ns)
    }
    if (this.weaken2Action.threads) {
      this.weaken2Action.RunAction(ns)
    }
    if (this.growAction.threads) {
      this.growAction.RunAction(ns)
    }
    if (this.hackAction.threads) {
      this.hackAction.RunAction(ns)
    }
    await WaitPids(ns, this.getAllPids(), this.weaken1Action.endTime - 2 * Config.batchPhaseDelay)

    // report results
    this.finalState = this.getServerState(ns)
    this.result = {
      endingMoneyShort: ns.getServerMaxMoney(this.targetHostname) - ns.getServerMoneyAvailable(this.targetHostname),
      endingSecurityExtra: ns.getServerSecurityLevel(this.targetHostname) - ns.getServerMinSecurityLevel(this.targetHostname)
    }
    if (this.result.endingMoneyShort != 0 || this.result.endingSecurityExtra != 0) {
      this.result.misCalc = true
      // write to a file
      ns.write("/data/hack_miscalcs.txt", JSON.stringify(this, null, 2), "a")
    }
    if (Math.random() < Config.finishedBatchLoggingSampleRate) {
      ns.write("/data/hack_finished_batches.txt", JSON.stringify(this, null, 2) + "\n", "a")
    }

    // notify someone that the batch finished (need to remove from the target's batches list, what else?)
    SessionState.getTargetByHostname(this.targetHostname)?.NotifyBatchFinished(this)
  }

  getAllPids() {
    let allPids = []
    allPids.push(...this.weaken1Action.pids, ...this.weaken2Action.pids, ...this.growAction.pids, ...this.hackAction.pids)
    return allPids
  }
}

export class PrepBatch extends Batch {
  constructor(ns:NS, targetHostname: string, batchNumber: number) {
    super(ns, targetHostname, batchNumber, "prep")
  }  
}


export class HackBatch extends Batch {
  constructor(ns:NS, targetHostname: string, batchNumber: number) {
    super(ns, targetHostname, batchNumber, "hack")
  }  
}



type Action = "weaken1" | "weaken2" | "grow" | "hack" | ""
type Command = "weaken" | "grow" | "hack" | ""

export class BatchAction {
  action: Action = ""
  targetHostname: string
  batchNumber: number
  duration: number = -1
  startTime: number = -1
  endTime: number = -1
  threads: number = 0
  securityChange: number = 0
  fired: number = 0
  pids: number[] = []
  command: string = ""


  constructor(command: Command, targetHostname: string, batchNumber: number) {
    this.command = command
    this.targetHostname = targetHostname
    this.batchNumber = batchNumber
  }

  RunAction(ns:NS) {
    let { pids, fired } = RunScript(
      ns,
      Config.scriptPrefix + this.command + ".js",
      this.threads,
      [this.startTime, this.targetHostname, this.batchNumber],
      -1
    )
    this.pids = pids
    this.fired = fired
  }
}

export class GrowAction extends BatchAction {
}

export class HackAction extends BatchAction {
  hackMoneyRemoved: number = 0
}

export class WeakenAction extends BatchAction {
  securityToRemove: number = 0
}