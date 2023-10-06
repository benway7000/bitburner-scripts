import { ns } from "scripts/lib/NS"
import type { Batch } from "scripts/hack/batch/lib/Batch";
import type { Target } from "scripts/hack/batch/lib/Target";
import { Config } from "scripts/hack/batch/lib/index";
import { RunScript, MemoryMap } from "scripts/lib/ram"


type Action = "weaken1" | "weaken2" | "grow" | "hack" | ""
type Command = "weaken" | "grow" | "hack" | ""

export class BatchAction {
  target: Target
  batch: Batch
  action: Action = ""
  duration: number = -1
  startTime: number = -1
  endTime: number = -1
  threads: number = 0
  securityChange: number = 0
  fired: number = 0
  pids: number[] = []
  command: string = ""


  constructor(batch: Batch, command: Command) {
    this.target = batch.target
    this.batch = batch
    this.command = command
  }

  RunAction() {
    let { pids, fired } = RunScript(
      ns.ns,
      Config.scriptPrefix + this.command + ".js",
      this.threads,
      [this.startTime, this.target, this.batch.batchNumber],
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