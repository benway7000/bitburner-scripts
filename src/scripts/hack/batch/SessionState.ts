import type { Batch } from "/scripts/hack/batch/Batch";
import type { Target } from "scripts/hack/batch/Target";

export class SessionState {
  static targets: Target[] = []

  static addTarget(target: Target) {
    if (this.targets.indexOf(target) == -1) {
      this.targets.push(target)
    }
  }

  static rmTarget(target: Target) {
    let index = this.targets.indexOf(target)
    if (index > -1) {
      this.targets.splice(index, 1)
    }
  }

  static getCurrentTargets() {
    // return list of active targets
    return this.targets
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
    return this.targets.reduce((accum, cur) => {
      accum.push(...cur.runningHackBatches)
      cur.runningPrepBatch ? accum.push(cur.runningPrepBatch) : {}
      return accum
    }, new Array<Batch>())
  }

  static notifyTargetBatchesChange(target: Target) {
    if (target.runningHackBatches.length == 0 && !target.runningPrepBatch) {
      // target has no more batches, so remove it from our list of targets
      this.rmTarget(target)
    }
  }

  static getJSON() {
    return {
      hack_type: "batcher",
      currentTargets: this.getCurrentTargets().map(t => t.hostname),
      currentActiveCycles: this.getAllBatches().length,
      targetStates: this.targets,
      // batches: this.getAllBatches(),
    }
  }

  static clearSessionState() {
    this.targets = []
  }


}

