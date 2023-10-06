import { GetTopHackServers, SortServerListByTopHacking } from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"
import { Batch, Config, SessionState, Target } from "scripts/hack/batch/lib/index"


const SCRIPT_NAME_PREFIX = "batch_v4"
const SCRIPT_PATH = "/scripts/hack/batch/" + SCRIPT_NAME_PREFIX


/**
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
export async function main(ns) {
  ns.disableLog("ALL")

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript(ns, "hack")
  await CreateScript(ns, "grow")
  await CreateScript(ns, "weaken")

  // Open the tail window when the script starts
  // ns.tail();
  await MainLoop(ns)
}

async function MainLoop(ns, pct) {
  while (true) {
    // try to add a batch to the best server
    // if that server is 'full', then try on next server
    let ramMap = new MemoryMap(ns)
    let tries = 0
    while (ramMap.available > 2048 || getActiveCyclesCount() == 0) { // more than 2 TB, launch a new batch
      let topTarget = GetNextBatchTarget(ns)
      if (topTarget) {
        ns.print(`MainLoop: launching new batch on ${topTarget}. Active Cycles: ${getActiveCyclesCount("all")}`)
        StartFullCycleOnTarget(ns, topTarget, pct)
      } else {
        ns.print(`MainLoop: could not find a new target`)
        break
      }
      if (tries++ > MAX_TRIES_PER_LOOP) break
      await ns.asleep(20) // give time for things to start up and consume ram
      ramMap = new MemoryMap(ns)
    }

    WriteHackStatus(ns)
    await ns.asleep(config.loopDelay)
  }
}

function WriteHackStatus(ns) {
  ns.write("/data/hack.txt", JSON.stringify(config.getConfigJSON(ns), null, 2), "w")
}

async function PrepServer(ns, target, cycle_number, pct) {
  ns.print(`PrepServer:${target} cycle:${cycle_number}`)
  return await RunBatch(ns, target, cycle_number, pct, true)
}

async function RunBatch(ns, target, cycle_number, pct, isPrep = false) {
  //                    |= hack ====================|
  // |=weaken 1======================================|
  //                |= grow ==========================|
  //   |=weaken 2======================================|

  // need W1, W2, G, H start-times & # threads

  // start order:
  // W1 W2 G H
  // finish order:
  // H  W1 G W2

  let pids = [],
    fired = 0,
    threads = 0
  let phase = ""
  let script_name = ""

  ns.print(`RunBatch:${target} cycle:${cycle_number} prep:${isPrep}`)

  const calc = CalcBatchTimesThreads(ns, target, cycle_number, pct, isPrep)
  getServerCycleByNumber(target, cycle_number).isPrep = isPrep

  // prettier-ignore
  const {
    weaken1Threads, weaken1StartTime, weaken1Duration, weaken1EndTime, weaken1SecToRemove,
    weaken2Threads, weaken2StartTime, weaken2Duration, weaken2EndTime, weaken2SecToRemove,
    growThreads, growStartTime, growDuration, growEndTime, growSecurityIncrease,
    hackThreads, hackStartTime, hackDuration, hackEndTime, hackSecurityIncrease, hackMoneyRemoved,
    money, maxMoney, sec, minSec, startingExtraSecurity,
  } = calc
  getServerCycleByNumber(target, cycle_number).calc = calc


  // prettier-ignore
  BatchReport(
    ns, target, cycle_number, isPrep,
    weaken1Threads, weaken1StartTime, weaken1Duration, weaken1EndTime,
    weaken2Threads, weaken2StartTime, weaken2Duration, weaken2EndTime,
    growThreads, growStartTime, growDuration, growEndTime,
    hackThreads, hackStartTime, hackDuration, hackEndTime,
    money, maxMoney, sec, minSec
  )

  // do the actions
  let expectedDuration = weaken2StartTime + weaken2Duration
  let expectedTime = Date.now() + expectedDuration
  // prettier-ignore
  let batch = {
    expectedDuration, expectedTime, batchPhaseDelay: config.batchPhaseDelay, all_pids: {}
  }
  getServerCycleByNumber(target, cycle_number).batch = batch

  // start weaken1
  if (weaken1Threads > 0) {
    phase = "weaken1"
    script_name = "weaken"
    threads = weaken1Threads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [0, target, phase, cycle_number],
        -1
      ))
    batch.all_pids.weaken1 = [...pids]
  }

  // start weaken2
  if (weaken2Threads > 0) {
    phase = "weaken2"
    script_name = "weaken"
    threads = weaken2Threads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [weaken2StartTime, target, phase, cycle_number],
        -1
      ))
    batch.all_pids.weaken2 = [...pids]
  }

  // start grow
  if (growThreads > 0) {
    phase = script_name = "grow"
    threads = growThreads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [growStartTime, target, phase, cycle_number],
        -1
      ))
    batch.all_pids.grow = [...pids]
  }

  // start hack
  if (hackThreads > 0) {
    phase = script_name = "hack"
    threads = hackThreads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [hackStartTime, target, phase, cycle_number],
        -1
      ))
    batch.all_pids.hack = [...pids]
  }

  // await ns.asleep(100) // wait for things to start up for a good ram measurement? do we need to wait?
  let ram = new MemoryMap(ns)
  batch.ram = {
    total: ram.total,
    used: ram.used,
    available: ram.available,
  }
  let all_pids = []
  for (let pids_list of Object.values(batch.all_pids)) {
    all_pids.push(...pids_list)
  }
  batch.all_pids.all = all_pids
  if (batch.all_pids.all.length > 0) {
    await WaitPids(ns, batch.all_pids.all, expectedDuration - config.batchPhaseDelay)
    batch.result = {
      endingMoneyShort: ns.getServerMaxMoney(target) - ns.getServerMoneyAvailable(target),
      endingSecurityExtra: ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target)
    }
    if (batch.result.endingMoneyShort != 0 || batch.result.endingSecurityExtra != 0) {
      batch.result.misCalc = true
      // debugger
    }
  }
  let result = { target, isPrep, batch }
  // for (let key in result) {
  //   if (key != "target") {
  //     setServerState(target, key, result[key])
  //   }
  // }
  // ns.print("Exploit resolving with " + JSON.stringify(result))
  return result
}

async function StartFullCycleOnTarget(ns, target, pct, cycle_number = -1) {
  if (cycle_number === -1) cycle_number = getServerCyclesNextNumber(target)
  getServerCycleByNumber(target, cycle_number).cycle_start_time = Date.now()
  if (!IsPrepped(ns, target)) {
    getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATES.PREP
    WriteHackStatus(ns)
    await PrepServer(ns, target, cycle_number, pct)
  }
  getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATES.BATCH
  WriteHackStatus(ns)
  await RunBatch(ns, target, cycle_number, pct)
  ns.print(`Target ${target}, cycle ${cycle_number} has completed.`)
  rmServerCycleByNumber(ns, target, cycle_number)
  WriteHackStatus(ns)
}


/** returns the next-best target, excluding the passed-in targets */
function GetNextBatchTarget(ns) {
  let top_targets = GetTopHackServers(ns, 50)

  // find top target
  // if already at max cycles, then go to next target
  // if prepped, then batch
  // if not prepped and not prepping, then batch
  // if not prepped but prepping, go to next target
  for (let target of top_targets) {

    // check for max cycles
    let cycle_count = getActiveCyclesCount(target.name)
    let expectedDuration = getServerCycles(target.name)[0]?.batch?.expectedDuration ?? Infinity
    let max_cycles_for_server = Math.max((expectedDuration / config.loopDelay) - 1, 1)
    if (cycle_count >= max_cycles_for_server) {
      continue
    }

    // check for not already prepping
    if (!IsPrepped(ns, target.name)) {
      let cycles = getServerCycles(target.name)
      if (cycles.some(c => c.cycle_state === CYCLE_STATES.PREP)) {
        continue
      }
    }

    // check for not running a cycle in last 10 seconds
    let cycles = getServerCycles(target.name)
    if (cycles.some(c => (Date.now () - c.cycle_start_time) < 10 * 1000)) {
      continue
    }
    return target.name
  }
}

function IsPrepped(ns, target) {
  let money = ns.getServerMoneyAvailable(target)
  if (money <= 0) money = 1 // division by zero safety
  const maxMoney = ns.getServerMaxMoney(target)
  if (maxMoney > money) return false

  // Security
  const minSec = ns.getServerMinSecurityLevel(target)
  const sec = ns.getServerSecurityLevel(target)
  if ((sec - minSec) > 0) return false
  return true
}

function BatchReport(
  ns,
  server,
  cycle_number,
  isPrep,
  weaken1Threads,
  weaken1StartTime,
  weaken1Duration,
  weaken1EndTime,
  weaken2Threads,
  weaken2StartTime,
  weaken2Duration,
  weaken2EndTime,
  growThreads,
  growStartTime,
  growDuration,
  growEndTime,
  hackThreads,
  hackStartTime,
  hackDuration,
  hackEndTime,
  money,
  maxMoney,
  sec,
  minSec
) {
  const defaultLogWidth = 51
  let spacer = " │ "
  let startLine = "INFO:"
  let startWall = "|"
  let endWall = "|"
  const desiredContentWidth = defaultLogWidth - startLine.length - startWall.length - endWall.length
  // Report
  ns.print("")
  ns.print(`${startLine}┌${"─".repeat(defaultLogWidth - startLine.length - 2)}┐`)

  let line = `${server}${spacer}S: ${(sec - minSec).toFixed(2)} [${Math.round(minSec).toFixed(2)}]`
  ns.print(`${startLine}${startWall}${centerString(line, desiredContentWidth)}${endWall}`)

  line = `\$${ns.formatNumber(money, 0, 1000, true)}/${ns.formatNumber(maxMoney, 0, 1000, true)} (${(
    (money / maxMoney) *
    100
  ).toFixed(0)})% W:${FormatTime(ns.getWeakenTime(server))} G:${FormatTime(
    ns.getGrowTime(server)
  )} H:${FormatTime(ns.getHackTime(server))}`
  ns.print(`${startLine}${startWall}${centerString(line, desiredContentWidth)}${endWall}`)

  function DurToLen(duration) {
    let overallDuration = weaken1Duration + 2 * config.batchPhaseDelay
    return Math.floor((desiredContentWidth * duration) / overallDuration)
  }
  // // draw batch diagram
  // line = `${"─".repeat((desiredContentWidth - 6) / 2)} ${isPrep ? "Prep" : "Hack"} ${"─".repeat(
  //   (desiredContentWidth - 6) / 2
  // )}`
  // ns.print(`${startLine}${startWall}${line}${endWall}`)
  // if (hackThreads > 0) {
  //   line = `${" ".repeat(DurToLen(hackStartTime))}[= H ${"=".repeat(DurToLen(hackDuration) - 3 - 6)}]   ` // 3 for finishing, 6 for [= H ]
  // } else {
  //   line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No Hack]${" ".repeat((desiredContentWidth - 9) / 2)}`
  // }
  // ns.print(`${startLine}${startWall}${line}${endWall}`)
  // if (weaken1Threads > 0) {
  //   line = `${" ".repeat(DurToLen(weaken1StartTime))}[= W1 ${"=".repeat(
  //     DurToLen(weaken1Duration) - 3 - 7
  //   )}]  ` // 3 for finishing, 7 for [= W1 ]
  // } else {
  //   line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No W1]${" ".repeat((desiredContentWidth - 9) / 2)}`
  // }
  // ns.print(`${startLine}${startWall}${line}${endWall}`)
  // if (growThreads > 0) {
  //   line = `${" ".repeat(DurToLen(growStartTime))}[= G ${"=".repeat(DurToLen(growDuration) - 3 - 6)}] ` // 3 for finishing, 6 for [= G ]
  // } else {
  //   line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No Grow]${" ".repeat((desiredContentWidth - 9) / 2)}`
  // }
  // ns.print(`${startLine}${startWall}${line}${endWall}`)
  // if (weaken2Threads > 0) {
  //   line = `${" ".repeat(DurToLen(weaken2StartTime) + 1)}[= W2 ${"=".repeat(
  //     DurToLen(weaken2Duration) - 3 - 7
  //   )}]` // 3 for finishing, 7 for [= W2 ]
  // } else {
  //   line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No W2]${" ".repeat((desiredContentWidth - 9) / 2)}`
  // }
  // ns.print(`${startLine}${startWall}${line}${endWall}`)

  ns.print(`${startLine}└${"─".repeat(defaultLogWidth - startLine.length - 2)}┘`)
  ns.print("")
}

function centerString(string, desiredWidth) {
  return string.padStart(string.length + Math.floor((desiredWidth - string.length) / 2)).padEnd(desiredWidth)
}

async function CreateScript(ns, command) {
  await ns.write(
    SCRIPT_NAME_PREFIX + command + ".js",
    "export async function main(ns) { await ns.asleep(ns.args[0]); await ns." + command + "(ns.args[1]) }",
    "w"
  )
}
