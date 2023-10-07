import { Config } from "scripts/hack/batch/lib/Config";
import { Target } from "scripts/hack/batch/lib/Target";
import { SessionState } from "scripts/hack/batch/lib/SessionState"
import { WaitPids, FormatTime } from "scripts/lib/utils"
import { RunScript, MemoryMap } from "scripts/lib/ram"

import { ns } from "scripts/lib/NS"

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

  constructor(targetHostname: string, batchNumber: number, batchType: BatchType) {
    this.targetHostname = targetHostname
    this.batchNumber = batchNumber
    this.batchType = batchType

    this.weaken1Action = new WeakenAction("weaken", "", -1)
    this.weaken2Action = new WeakenAction("weaken", "", -1)
    this.growAction = new GrowAction("grow", "", -1)
    this.hackAction = new HackAction("hack", "", -1)

    this.CalcBatch()
  }

  IsPrep() {
    return this.batchType === "prep"
  }

  getRamUsage(): number {
    return this.ramStats.growRamUsage  +
      this.ramStats.hackRamUsage +
      this.ramStats.weaken1RamUsage +
      this.ramStats.weaken2RamUsage
  }

  getServerState():ServerState {
    // Money
    let money = Math.max(ns.ns.getServerMoneyAvailable(this.targetHostname), 1)
    let maxMoney = ns.ns.getServerMaxMoney(this.targetHostname)

    // Security
    const minSec = ns.ns.getServerMinSecurityLevel(this.targetHostname)
    const sec = ns.ns.getServerSecurityLevel(this.targetHostname)
    return {
      money, maxMoney, minSec, sec
    }
  }

  CalcBatch() {
    // HWGW. assume server is prepped (max money, sec-minSec = 0)
    //                    |= hack ====================|
    // |=weaken 1======================================|
    //                |= grow ==========================|
    //   |=weaken 2======================================|

    // calc initial server state

    // calc actions

    // calc predictions (ram usage, ?)


    
    this.initialState = this.getServerState()
    const {
      money, maxMoney, minSec, sec
    } = this.initialState
    let startingExtraSecurity = sec - minSec


    // if (startingExtraSecurity > Config.maxSecurityDrift || (maxMoney * Config.maxMoneyDriftPct) > money) {
    //   this.batchType = "prep"
    // } else {
    //   this.batchType = "hack"
    // }

    let overallDuration = this.expectedDuration = ns.ns.getWeakenTime(this.targetHostname) + 2 * Config.batchPhaseDelay
    this.expectedEndTime = Date.now() + overallDuration

    // Hack lands first
    // Hacking (limited by pct)
    if (this.batchType === "hack") {
      this.hackAction = new HackAction("hack", this.targetHostname, this.batchNumber)
      this.hackAction.duration = ns.ns.getHackTime(this.targetHostname)
      this.hackAction.hackMoneyRemoved = money * this.hackPct
      this.hackAction.threads = Math.floor(ns.ns.hackAnalyzeThreads(this.targetHostname, this.hackAction.hackMoneyRemoved))
      this.hackAction.securityChange = ns.ns.hackAnalyzeSecurity(this.hackAction.threads)
      this.hackAction.endTime = overallDuration - 3 * Config.batchPhaseDelay
      this.hackAction.startTime = this.hackAction.endTime - this.hackAction.duration
    }

    // Weaken1
    this.weaken1Action = new WeakenAction("weaken", this.targetHostname, this.batchNumber)
    this.weaken1Action.duration = ns.ns.getWeakenTime(this.targetHostname)
    this.weaken1Action.securityToRemove = startingExtraSecurity + this.hackAction.securityChange
    this.weaken1Action.threads = Math.ceil(Config.weakenThreadMult * this.weaken1Action.securityToRemove / ns.ns.weakenAnalyze(1))
    this.weaken1Action.endTime = overallDuration - 2 * Config.batchPhaseDelay
    this.weaken1Action.startTime = this.weaken1Action.endTime - this.weaken1Action.duration

    // grow
    // grow if server is not at max money or we are hacking (ie do not grow if server is at max and we are not hacking, ie prep)
    if (maxMoney - money > 0 || (this.hackAction.threads)) {
      this.growAction = new GrowAction("grow", this.targetHostname, this.batchNumber)
      this.growAction.duration = ns.ns.getGrowTime(this.targetHostname)

      this.growAction.threads = Math.ceil(
        ns.ns.growthAnalyze(this.targetHostname, (Config.growThreadMult * maxMoney) / (money - this.hackAction.hackMoneyRemoved))
      )
      this.growAction.securityChange = ns.ns.growthAnalyzeSecurity(this.growAction.threads)
      this.growAction.endTime = overallDuration - 1 * Config.batchPhaseDelay
      this.growAction.startTime = this.growAction.endTime - this.growAction.duration
    }

    // Weaken2
    let weaken2SecurityToRemove = this.growAction.securityChange
    if (weaken2SecurityToRemove > 0) {
      this.weaken2Action = new WeakenAction("weaken", this.targetHostname, this.batchNumber)
      this.weaken2Action.duration = ns.ns.getWeakenTime(this.targetHostname)
      this.weaken2Action.securityToRemove = weaken2SecurityToRemove
      this.weaken2Action.threads = Math.ceil(Config.weakenThreadMult * this.weaken2Action.securityToRemove / ns.ns.weakenAnalyze(1))
      this.weaken2Action.endTime = overallDuration
      this.weaken2Action.startTime = this.weaken2Action.endTime - this.weaken2Action.duration
    }


    // ram usage
    let hackRamUsage = scriptRamUsage.hack * this.hackAction.threads
    let weaken1RamUsage = scriptRamUsage.weaken * this.weaken1Action.threads
    let growRamUsage = scriptRamUsage.grow * this.growAction.threads
    let weaken2RamUsage = scriptRamUsage.weaken * this.weaken2Action.threads
    let totalRamUsage = hackRamUsage + weaken1RamUsage + growRamUsage + weaken2RamUsage

    this.ramStats = {
      totalRamUsage, hackRamUsage, weaken1RamUsage, growRamUsage, weaken2RamUsage
    }
  }

  async RunBatch() {
    if (this.weaken1Action.threads) {
      this.weaken1Action.RunAction()
    }
    if (this.weaken2Action.threads) {
      this.weaken2Action.RunAction()
    }
    if (this.growAction.threads) {
      this.growAction.RunAction()
    }
    if (this.hackAction.threads) {
      this.hackAction.RunAction()
    }
    await WaitPids(ns.ns, this.getAllPids(), this.weaken1Action.endTime - 2 * Config.batchPhaseDelay)

    // report results
    this.finalState = this.getServerState()
    this.result = {
      endingMoneyShort: ns.ns.getServerMaxMoney(this.targetHostname) - ns.ns.getServerMoneyAvailable(this.targetHostname),
      endingSecurityExtra: ns.ns.getServerSecurityLevel(this.targetHostname) - ns.ns.getServerMinSecurityLevel(this.targetHostname)
    }
    if (this.result.endingMoneyShort != 0 || this.result.endingSecurityExtra != 0) {
      this.result.misCalc = true
      // write to a file
      ns.ns.write("/data/hack_miscalcs.txt", JSON.stringify(this, null, 2), "a")
    }
    if (Math.random() < Config.finishedBatchLoggingSampleRate) {
      ns.ns.write("/data/hack_finished_batches.txt", JSON.stringify(this, null, 2) + "\n", "a")
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
  constructor(targetHostname: string, batchNumber: number) {
    super(targetHostname, batchNumber, "prep")
  }  
}


export class HackBatch extends Batch {
  constructor(targetHostname: string, batchNumber: number) {
    super(targetHostname, batchNumber, "hack")
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

  RunAction() {
    let { pids, fired } = RunScript(
      ns.ns,
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