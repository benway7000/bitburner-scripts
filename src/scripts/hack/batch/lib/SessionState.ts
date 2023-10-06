import { ns } from "scripts/lib/NS"
import type { Batch } from "scripts/hack/batch/lib/Batch";
import type { Target } from "scripts/hack/batch/lib/Target";

export class SessionState {
  static targets: Target[] = []

  static addTarget(target: Target) {
    this.targets.push(target)
  }

  static rmTarget(target: Target) {
    let index = this.targets.indexOf(target)
    this.targets.splice(index, 1)
  }

  static getCurrentTargets() {
    // return list of active targets
    return SessionState.targets
  }

  static getTarget(target: Target) {
    // return target
    return this.targets.find(t => t.hostname === target.hostname)
  }

  static getTargetByHostname(hostname: string) {
    // return target
    return this.targets.find(t => t.hostname === hostname)
  }

  static getAllBatches() {
    // return all batches across all targets
    return SessionState.targets.reduce((accum, cur) => { accum.push(...cur.runningHackBatches); return accum }, new Array<Batch>())
  }

  static notifyTargetBatchesChange(target: Target) {
    if (target.runningHackBatches.length == 0) {
      // target has no more batches, so remove it from our list of targets
      this.rmTarget(target)
    }
  }

  static getJSON() {
    return {
      hack_type: "batch",
      currentTargets: this.getCurrentTargets(),
      currentActiveCycles: this.getAllBatches().length,
      serverStates: JSON.stringify(this.targets, null, 2),
    }
  }



}

