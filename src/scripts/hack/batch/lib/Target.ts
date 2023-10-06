import { ns } from "scripts/lib/NS"
import { Batch, HackBatch, PrepBatch, Config, SessionState } from "scripts/hack/batch/lib/index"
import { MemoryMap } from "/scripts/lib/ram"

type TARGET_STATES = "prep_ready" | "prep_running" | "hack_ready" | "hack_running" | "unknown"

export type TargetNextStep = {
  state: TARGET_STATES
  batch?: Batch
}

export class Target {
  hostname: string
  onDeckBatch?: Batch         // batch that has been created and will be run next
  runningPrepBatch?: PrepBatch
  runningHackBatches: HackBatch[] = []
  batchNumber: number = 0
  hackPct:number = Config.defaultHackPct

  constructor(hostname: string) {
    this.hostname = hostname
  }

  IsPrepped() {
    let money = ns.ns.getServerMoneyAvailable(this.hostname)
    if (money <= 0) money = 1 // division by zero safety
    const maxMoney = ns.ns.getServerMaxMoney(this.hostname)
    if ((maxMoney * Config.maxMoneyDriftPct) > money) return false
  
    // Security
    const minSec = ns.ns.getServerMinSecurityLevel(this.hostname)
    const sec = ns.ns.getServerSecurityLevel(this.hostname)
    if ((sec - minSec) > Config.maxSecurityDrift) return false
    return true
  }
  
  addBatch(batch: Batch) {
    this.runningHackBatches.push(batch)
  }

  rmBatch(batch: Batch) {
    // remove batch from batches
    let index = this.runningHackBatches.indexOf(batch)
    this.runningHackBatches.splice(index, 1)
    // notify SessionState so target can be removed if no more batches
    SessionState.notifyTargetBatchesChange(this)
  }

  getRunningBatchCount():number {
    return this.runningHackBatches.length
  }

  getMaxRunningBatchCount():number {
    // TODO
    return 3
  }

  getBatchByBatchNumber(batchNumber: number) {
    // return a Batch object with the given batchNumber
    return this.runningHackBatches.find(b => b.batchNumber === batchNumber) ?? undefined
  }

  getNextStep():TargetNextStep {
    if (!this.IsPrepped()) { // not prepped
      if (!this.runningPrepBatch && !this.onDeckBatch) {  // no prepBatch created
        this.onDeckBatch = new PrepBatch(this, this.batchNumber++)  // create a prepBatch, put it on deck
        return {state: "prep_ready", batch:this.onDeckBatch}
      } else if (this.onDeckBatch) {                          // batch on deck, still waiting to start
        return {state: "prep_ready", batch:this.onDeckBatch}
      } else { //if (this.runningPrepBatch) {
        return {state: "prep_running", batch:this.runningPrepBatch}
      }
    } else { // target is prepped
      if (this.runningHackBatches.length == 0 && !this.onDeckBatch) {    // no hackBatch created
        this.onDeckBatch = new HackBatch(this, this.batchNumber++)  // create a hackBatch, put it on deck
        return {state: "hack_ready", batch:this.onDeckBatch}
      } else if (this.onDeckBatch) {                          // batch on deck, still waiting to start
        return {state: "hack_ready", batch:this.onDeckBatch}
      } else { // nothing on deck, check to see if we want to create another batch
        if (this.getMaxRunningBatchCount() < this.getRunningBatchCount()) {     // can add another batch
          this.onDeckBatch = new HackBatch(this, this.batchNumber++)  // create a hackBatch, put it on deck
          return {state: "hack_ready", batch:this.onDeckBatch}
        } else {
          return {state: "hack_running"}
        }
      }
    }
  }

  runOnDeckBatch():boolean {
    if (this.onDeckBatch) {
      // check for ram availability
      let ram = new MemoryMap(ns.ns)
      if (ram.available >= this.onDeckBatch.getRamUsage()) {
        this.onDeckBatch.RunBatch()
        if (this.onDeckBatch instanceof PrepBatch) {
          this.runningPrepBatch = this.onDeckBatch
        } else if (this.onDeckBatch instanceof HackBatch) {
          this.runningHackBatches.push(this.onDeckBatch)
        }
        this.onDeckBatch = undefined
        return true
      }
    }
    return false
  }


  NotifyBatchFinished(batch: Batch) {
    // batch has completed, remove it from the list
    this.rmBatch(batch)
  }
}