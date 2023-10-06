import { NS } from '@ns';
import { Config, SessionState, Target, TargetNextStep } from "scripts/hack/batch/lib";
import { InitializeNS, ns } from "scripts/lib/NS";
import { GetTopHackServers } from "scripts/lib/metrics-simple";

const SCRIPT_NAME_PREFIX = "batcher"
const SCRIPT_PATH = "/scripts/hack/batch/" + SCRIPT_NAME_PREFIX


/**
 * 
 * Batcher
 * Typescript
 * use classes
 * 
 * Batch_v4
 * rewrite with classes, batches 'reserve' their threads/ram from the start in 
 * order to avoid running batches that can't be fully run
 * 
 * Batch_v3
 * 
 * v3 adds multiple targets per MainLoop
 * 
 * Batch_v2
 * 
 * Instead of promise chaining, lets try running batches from the main loop.
 * Maybe this lets us adjust # batches on the fly?
 * 
 * TODO: 
 * refactor config into a class that can be used by ctree as well
 * xp mode
 * 
 */



/** @param {NS} ns **/
export async function main(ns: NS) {
  ns.disableLog("ALL")

  InitializeNS(ns)

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript("hack")
  await CreateScript("grow")
  await CreateScript("weaken")

  // Open the tail window when the script starts
  // ns.tail();
  await MainLoop()
}

async function MainLoop() {
  while (true) {
    let topTargetHostname = GetTopTargetHostname()
    let target = SessionState.getTargetByHostname(topTargetHostname) ?? new Target(topTargetHostname)

    let targetNextStep:TargetNextStep = target.getNextStep()
    switch (targetNextStep.state) {
      case 'prep_ready':
        // fall through
      case 'hack_ready':
        // batch is ready to run
        target.runOnDeckBatch()
        break
      case 'prep_running':
      case 'hack_running':  // TODO target is full of hacking - can we run another target?
      case 'unknown':
        // fall through, do nothing for these cases        
    }
    WriteHackStatus()
    await ns.ns.asleep(Config.loopDelay)
  }
}

function WriteHackStatus() {
  ns.ns.write("/data/hack.txt", JSON.stringify(SessionState.getJSON(), null, 2), "w")
}

function GetTopTargetHostname():string {
  return GetTopHackServers(ns.ns, 1)[0].name
}

async function CreateScript(command:string) {
  ns.ns.write(
    SCRIPT_NAME_PREFIX + command + ".js",
    "export async function main(ns) { await ns.asleep(ns.args[0]); await ns." + command + "(ns.args[1]) }",
    "w"
  )
}
