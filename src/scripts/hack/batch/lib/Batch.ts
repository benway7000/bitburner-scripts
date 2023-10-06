import { BatchAction, GrowAction, HackAction, WeakenAction, Config, Target } from 'scripts/hack/batch/lib';
import { WaitPids, FormatTime } from "scripts/lib/utils"

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
  hackRamUsage: number
  weaken1RamUsage: number
  growRamUsage: number
  weaken2RamUsage: number
}

export class Batch {
  target: Target
  batchNumber: number
  hackPct: number = Config.defaultHackPct
  batchType: BatchType
  weaken1Action: WeakenAction
  weaken2Action: WeakenAction
  growAction: GrowAction
  hackAction: HackAction
  initialState: ServerState = SERVER_STATE_UNKNOWN
  finalState: ServerState = SERVER_STATE_UNKNOWN
  ramStats: RamStats = { hackRamUsage: 0, weaken1RamUsage: 0, growRamUsage: 0, weaken2RamUsage: 0 }
  result: any

  constructor(target: Target, batchNumber: number, batchType: BatchType) {
    this.target = target
    this.batchNumber = batchNumber
    this.batchType = batchType

    this.weaken1Action = new WeakenAction(this, "weaken")
    this.weaken2Action = new WeakenAction(this, "weaken")
    this.growAction = new GrowAction(this, "grow")
    this.hackAction = new HackAction(this, "hack")

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

  CalcBatch() {
    // HWGW. assume server is prepped (max money, sec-minSec = 0)
    //                    |= hack ====================|
    // |=weaken 1======================================|
    //                |= grow ==========================|
    //   |=weaken 2======================================|

    // calc initial server state

    // calc actions

    // calc predictions (ram usage, ?)

    // Money
    let money = Math.min(ns.ns.getServerMoneyAvailable(this.target.hostname), 1)
    let maxMoney = ns.ns.getServerMaxMoney(this.target.hostname)

    // Security
    const minSec = ns.ns.getServerMinSecurityLevel(this.target.hostname)
    const sec = ns.ns.getServerSecurityLevel(this.target.hostname)
    let startingExtraSecurity = sec - minSec

    this.initialState = {
      money, maxMoney, minSec, sec
    }


    // if (startingExtraSecurity > Config.maxSecurityDrift || (maxMoney * Config.maxMoneyDriftPct) > money) {
    //   this.batchType = "prep"
    // } else {
    //   this.batchType = "hack"
    // }

    let overallDuration = ns.ns.getWeakenTime(this.target.hostname) + 2 * Config.batchPhaseDelay

    // Hack lands first
    // Hacking (limited by pct)
    if (this.batchType === "hack") {
      this.hackAction = new HackAction(this, "hack")
      this.hackAction.duration = ns.ns.getHackTime(this.target.hostname)
      this.hackAction.hackMoneyRemoved = money * this.hackPct
      this.hackAction.threads = Math.floor(ns.ns.hackAnalyzeThreads(this.target.hostname, this.hackAction.hackMoneyRemoved))
      this.hackAction.securityChange = ns.ns.hackAnalyzeSecurity(this.hackAction.threads)
      this.hackAction.endTime = overallDuration - 3 * Config.batchPhaseDelay
      this.hackAction.startTime = this.hackAction.endTime - this.hackAction.duration
    }

    // Weaken1
    this.weaken1Action = new WeakenAction(this, "weaken")
    this.weaken1Action.duration = ns.ns.getWeakenTime(this.target.hostname)
    this.weaken1Action.securityToRemove = startingExtraSecurity + this.hackAction.securityChange
    this.weaken1Action.threads = Math.ceil(this.weaken1Action.securityToRemove / ns.ns.weakenAnalyze(1))
    this.weaken1Action.endTime = overallDuration - 2 * Config.batchPhaseDelay
    this.weaken1Action.startTime = this.weaken1Action.endTime - this.weaken1Action.duration

    // grow
    // grow if server is not at max money or we are hacking (ie do not grow if server is at max and we are not hacking, ie prep)
    if (maxMoney - money > 0 || (this.hackAction.threads)) {
      this.growAction = new GrowAction(this, "grow")
      this.growAction.duration = ns.ns.getGrowTime(this.target.hostname)

      this.growAction.threads = Math.ceil(
        ns.ns.growthAnalyze(this.target.hostname, (Config.growThreadMult * maxMoney) / (money - this.hackAction.hackMoneyRemoved))
      )
      this.growAction.securityChange = ns.ns.growthAnalyzeSecurity(this.growAction.threads)
      this.growAction.endTime = overallDuration - 1 * Config.batchPhaseDelay
      this.growAction.startTime = this.growAction.endTime - this.growAction.duration
    }

    // Weaken2
    let weaken2SecurityToRemove = this.growAction.securityChange
    if (weaken2SecurityToRemove > 0) {
      this.weaken2Action = new WeakenAction(this, "weaken")
      this.weaken2Action.duration = ns.ns.getWeakenTime(this.target.hostname)
      this.weaken2Action.securityToRemove = weaken2SecurityToRemove
      this.weaken2Action.threads = Math.ceil(this.weaken2Action.securityToRemove / ns.ns.weakenAnalyze(1))
      this.weaken2Action.endTime = overallDuration
      this.weaken2Action.startTime = this.weaken2Action.endTime - this.weaken2Action.duration
    }


    // ram usage
    let hackRamUsage = scriptRamUsage.hack * this.hackAction.threads
    let weaken1RamUsage = scriptRamUsage.weaken * this.weaken1Action.threads
    let growRamUsage = scriptRamUsage.grow * this.growAction.threads
    let weaken2RamUsage = scriptRamUsage.weaken * this.weaken2Action.threads

    this.ramStats = {
      hackRamUsage, weaken1RamUsage, growRamUsage, weaken2RamUsage
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
    this.result = {
      endingMoneyShort: ns.ns.getServerMaxMoney(this.target.hostname) - ns.ns.getServerMoneyAvailable(this.target.hostname),
      endingSecurityExtra: ns.ns.getServerSecurityLevel(this.target.hostname) - ns.ns.getServerMinSecurityLevel(this.target.hostname)
    }
    if (this.result.endingMoneyShort != 0 || this.result.endingSecurityExtra != 0) {
      this.result.misCalc = true
      // write to a file
      ns.ns.write("/data/hack_miscalcs.txt", JSON.stringify(this, null, 2), "a")
    }

    // notify someone that the batch finished (need to remove from the target's batches list, what else?)
    this.target.NotifyBatchFinished(this)
  }

  getAllPids() {
    let allPids = []
    return allPids.push(...this.weaken1Action.pids, ...this.weaken2Action.pids, ...this.growAction.pids, ...this.hackAction.pids)
  }
}

export class PrepBatch extends Batch {
  constructor(target: Target, batchNumber: number) {
    super(target, batchNumber, "prep")
  }  
}


export class HackBatch extends Batch {
  constructor(target: Target, batchNumber: number) {
    super(target, batchNumber, "hack")
  }  
}