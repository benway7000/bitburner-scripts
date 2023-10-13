import { NS } from '@ns';
import { Batch, HackBatch, PrepBatch } from "/scripts/hack/batch/Batch"
import { Config } from "scripts/hack/batch/Config"
import { SessionState } from "scripts/hack/batch/SessionState"
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
  hackPct: number = Config.defaultHackPct

  constructor(hostname: string) {
    this.hostname = hostname
  }

  IsPrepped(ns:NS) {
    let money = ns.getServerMoneyAvailable(this.hostname)
    if (money <= 0) money = 1 // division by zero safety
    const maxMoney = ns.getServerMaxMoney(this.hostname)
    if ((maxMoney * (1 - Config.maxMoneyDriftPct)) > money) return false

    // Security
    const minSec = ns.getServerMinSecurityLevel(this.hostname)
    const sec = ns.getServerSecurityLevel(this.hostname)
    if ((sec - minSec) > Config.maxSecurityDrift) return false
    return true
  }

  addBatch(batch: Batch) {
    if (batch instanceof PrepBatch) {
      this.runningPrepBatch = batch
    } else {
      this.runningHackBatches.push(batch)
    }
  }

  rmBatch(batch: Batch) {
    if (batch instanceof PrepBatch) {
      this.runningPrepBatch = undefined
    } else {
      // remove batch from batches
      let index = this.runningHackBatches.indexOf(batch)
      this.runningHackBatches.splice(index, 1)
    }
    // notify SessionState so target can be removed if no more batches
    SessionState.notifyTargetBatchesChange(this)
  }

  getRunningBatchCount(): number {
    return this.runningHackBatches.length
  }

  getMaxRunningBatchCount(): number {
    // TODO
    return Config.maxBatchPerTarget
  }

  getBatchByBatchNumber(batchNumber: number) {
    // return a Batch object with the given batchNumber
    return this.runningHackBatches.find(b => b.batchNumber === batchNumber) ?? undefined
  }

  getNextStep(ns:NS): TargetNextStep {
    if (!this.IsPrepped(ns)) { // not prepped
      if (!this.runningPrepBatch && !this.onDeckBatch) {  // no prepBatch created
        this.onDeckBatch = new PrepBatch(ns, this.hostname, this.batchNumber++)  // create a prepBatch, put it on deck
        return { state: "prep_ready", batch: this.onDeckBatch }
      } else if (this.onDeckBatch) {                          // batch on deck, still waiting to start
        return { state: "prep_ready", batch: this.onDeckBatch }
      } else { //if (this.runningPrepBatch) {
        return { state: "prep_running", batch: this.runningPrepBatch }
      }
    } else { // target is prepped
      if (this.runningHackBatches.length == 0 && !this.onDeckBatch) {    // no hackBatch created
        this.onDeckBatch = new HackBatch(ns, this.hostname, this.batchNumber++)  // create a hackBatch, put it on deck
        return { state: "hack_ready", batch: this.onDeckBatch }
      } else if (this.onDeckBatch) {                          // batch on deck, still waiting to start
        return { state: "hack_ready", batch: this.onDeckBatch }
      } else { // nothing on deck, check to see if we want to create another batch
        if (this.getMaxRunningBatchCount() > this.getRunningBatchCount()) {
          let testBatch = new HackBatch(ns, this.hostname, this.batchNumber++)          
          if (testBatch.hackPct == Config.defaultHackPct) {
            // can run a full batch, so do it
            this.onDeckBatch = testBatch  // create a hackBatch, put it on deck
            return { state: "hack_ready", batch: this.onDeckBatch }
          } else {
            // batch can't be a full batch
            let reducedBatches = this.runningHackBatches.filter(b => b.hackPct < Config.defaultHackPct).length
            if (this.getRunningBatchCount() == 1 && reducedBatches == 1) {
              // there's one batch running and it's reduced, this means we probably shouldn't run any more
              return { state: "hack_running" }
            }
            // allow up to 3 batches of any size, or allow up to 2 less-than-max batches if > 3 batches
            if (this.getRunningBatchCount() < 3 || reducedBatches < 2) {
              this.onDeckBatch = testBatch  // create a hackBatch, put it on deck
              return { state: "hack_ready", batch: this.onDeckBatch }
            }
          }
        }
        return { state: "hack_running" }
      }
    }
  }

  runOnDeckBatch(ns:NS): boolean {
    if (this.onDeckBatch) {
      // check for ram availability
      let ram = new MemoryMap(ns)
      if (ram.available >= this.onDeckBatch.ramStats.totalRamUsage || SessionState.getAllBatches().length == 0) {
        ns.print(`${this.hostname}: runOnDeckBatch, go! ram: ${ns.formatRam(ram.available)} avail / ${ns.formatRam(this.onDeckBatch.ramStats.totalRamUsage)} batch`)
        this.onDeckBatch.RunBatch(ns)
        SessionState.addTarget(this)
        this.addBatch(this.onDeckBatch)
        this.onDeckBatch = undefined
        return true
      } else {
        ns.print(`runOnDeckBatch: not enough ram! ${ns.formatRam(ram.available)} avail / ${ns.formatRam(this.onDeckBatch.ramStats.totalRamUsage)} batch`)
        // clear batch so a new one can be re-calc'ed later
        this.onDeckBatch = undefined
      }
    }
    return false
  }


  NotifyBatchFinished(batch: Batch) {
    // batch has completed, remove it from the list
    this.rmBatch(batch)
  }
}