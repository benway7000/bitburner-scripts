import { GetTopHackServers, SortServerListByTopHacking } from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

const SCRIPT_NAME_PREFIX = "batch_v3"
const SCRIPT_PATH = "/scripts/hack/batch/" + SCRIPT_NAME_PREFIX

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.5 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.2 // extra grow threads to be sure
const MAX_ACTIVE_CYCLES = 500
const MAX_TRIES_PER_LOOP = 10
// const MAX_PIDS = 50 // max number of pids total

const JOESGUNS = "joesguns"
export const CYCLE_STATES = {
  PREP: "prep",
  BATCH: "batch",
  CALLBACK: "callback",
  COMPLETE: "complete",
}
// const CYCLE_STATE_PREP = "prep"
// const CYCLE_STATE_BATCH = "batch"
// const CYCLE_STATE_CALLBACK = "callback"
// const CYCLE_STATE_STOPPED = "stopped"
// const CYCLE_STATE_COMPLETE = "complete"

// https://github.com/xxxsinx/bitburner/blob/main/v1.js

/**
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
 * TODO: refactor config into a class that can be used by ctree as well
 * xp mode
 * 
 */

const config = {
  loopDelay: 10 * 1000,
  batchPhaseDelay: 500, // time (in ms) between batch phases finishing
  multiCycleDelay: 20 * 1000,
  serverStates: {},
  current_pids: 0,
  targetAdjust: 0,
  getCurrentTargetsStates: function (ns) {
    let current_targets_states = []
    for (let server in this.serverStates) {
      let state = this.serverStates[server]
      // ns.print("getCurrentTargetsStates: server: " + server + " checking promise " + state.promise)
      if (
        state.cycles.some((c) =>
          [CYCLE_STATES.PREP, CYCLE_STATES.BATCH].includes(c.cycle_state)
        )
      ) {
        // ns.print("getCurrentTargetsStates: state.prpmise is true")
        state.currentActiveCycles = getActiveCyclesCount(server)
        current_targets_states.push(state)
      }
    }
    // sort by 'best'
    current_targets_states = SortServerListByTopHacking(ns, current_targets_states)
    // ns.print("getCurrentTargetsStates: current_targets_states is " + current_targets_states)
    return current_targets_states
  },
  getCurrentTargets: function (ns) {
    let current_targets_states = this.getCurrentTargetsStates(ns)
    let current_targets = current_targets_states.map((state) => state.name)
    // ns.print("current_targets is " + current_targets)
    return current_targets
  },
  getConfigJSON: function (ns) {
    return {
      hack_type: "batch",
      loopDelay: this.loopDelay,
      currentTargets: this.getCurrentTargets(ns),
      currentActiveCycles: getActiveCyclesCount(),
      targetAdjust: this.targetAdjust,
      serverStates: this.serverStates,
    }
  },
  resetConfig: function () {
    this.serverStates = {}
    this.current_pids = 0
    this.targetAdjust = 0
  },
}

function setServerState(server, key, value) {
  let serverState = config.serverStates[server]
  if (serverState === undefined) {
    config.serverStates[server] = serverState = { name: server, cycles: [] }
    // ns.print("initializing serverState for " + server + " with " + serverState)
  }
  serverState[key] = value
}

function getServerState(server, key) {
  return config.serverStates?.[server]?.[key] ?? undefined
}

/**
 *
 * @param {*} server
 * @returns list of cycles, sorted by cycle_number, highest first
 */
function getServerCycles(server) {
  if (getServerState(server, "cycles") == undefined) {
    setServerState(server, "cycles", [])
  }
  return getServerState(server, "cycles").sort((a, b) => b.cycle_number - a.cycle_number)
}

function getServerCycleByNumber(server, cycle_number) {
  let cycles = getServerCycles(server)
  for (let cycle of cycles) {
    if (cycle.cycle_number === cycle_number) {
      return cycle
    }
  }
  // not found, init a new one
  let new_cycle = { target: server, cycle_number }
  cycles.push(new_cycle)
  return new_cycle
}

function rmServerCycleByNumber(ns, server, cycle_number) {
  let cycles = getServerCycles(server)
  for (let cycle of cycles) {
    if (cycle.cycle_number === cycle_number) {
      let index = cycles.indexOf(cycle)
      ns.print(`rmServerCycleByNumber: idx ${index} of ${cycles.length - 1}`)
      cycles.splice(index, 1)
      return
    }
  }
}

function getServerCyclesNextNumber(server) {
  let cycles = getServerCycles(server)
  if (cycles.length > 0) {
    return cycles[0].cycle_number + 1
  } else {
    return 1
  }
}

function getActiveCyclesCount(server = "all") {
  let cycle_count = 0
  if (server === "all") {
    for (let server in config.serverStates) {
      let state = config.serverStates[server]
      // ns.print("getCurrentTargetsStates: server: " + server + " checking promise " + state.promise)
      cycle_count += state.cycles.filter(c => [CYCLE_STATES.PREP, CYCLE_STATES.BATCH].includes(c.cycle_state)).length
    }
  } else {
    // single server
    cycle_count += getServerCycles(server).filter(c => [CYCLE_STATES.PREP, CYCLE_STATES.BATCH].includes(c.cycle_state)).length
  }
  return cycle_count
}

function clearServerState(server) {
  if (config.serverStates) {
    if (server in config.serverStates) {
      config.serverStates[server] = { name: server, cycles: [] }
    }
  }
}

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL")

  // TODO: read config from /data/hack.txt?
  config.resetConfig()

  // // Parameters
  // const [mode, pct = DEFAULT_PCT] = ns.args

  // // Show usage if no parameters were passed
  // if (mode == undefined) {
  //   ns.tprint("ERROR: No mode specified!")
  //   ns.tprint("INFO : Usage: run " + SCRIPT_NAME_PREFIX + ".js <mode> <pct>")
  //   ns.tprint("INFO :")
  //   ns.tprint("INFO : HACK MODE: run " + SCRIPT_NAME_PREFIX + ".js hack <pct>")
  //   ns.tprint(
  //     "INFO :    <pct> is the 1-based maximum percentage to hack from the target (Optional, default is 25%)"
  //   )
  //   ns.tprint("INFO :")
  //   ns.tprint("INFO : XP MODE: run " + SCRIPT_NAME_PREFIX + ".js xp")
  //   ns.tprint("INFO :    This mode will simply prepare and then throw all the ram on grow at joesguns for XP")
  //   return
  // }

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript(ns, "hack")
  await CreateScript(ns, "grow")
  await CreateScript(ns, "weaken")

  // Open the tail window when the script starts
  // ns.tail();
  await MainLoop(ns, DEFAULT_PCT)
}

async function MainLoop(ns, pct) {
  while (true) {
    let ramMap = new MemoryMap(ns)
    let tries = 0
    while (ramMap.available > 3000) { // more than 3 TB, launch a new batch
      let topTarget = GetNextBatchTarget(ns)
      if (topTarget) {
        ns.print(`MainLoop: launching new batch on ${topTarget}. Active Cycles: ${getActiveCyclesCount("all")}`)
        StartFullCycleOnTarget(ns, topTarget, pct)
      } else {
        ns.print(`MainLoop: could not find a new target`)
      }
      if (tries++ > MAX_TRIES_PER_LOOP) break
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
        [target, phase, cycle_number],
        -1
      ))
    batch.all_pids.weaken1 = [...pids]
  }

  // start weaken2
  if (weaken2Threads > 0) {
    await ns.asleep(weaken2StartTime)
    phase = "weaken2"
    script_name = "weaken"
    threads = weaken2Threads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [target, phase, cycle_number],
        -1
      ))
    batch.all_pids.weaken2 = [...pids]
  }

  // start grow
  if (growThreads > 0) {
    await ns.asleep(growStartTime - weaken2StartTime)
    phase = script_name = "grow"
    threads = growThreads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [target, phase, cycle_number],
        -1
      ))
    batch.all_pids.grow = [...pids]
  }

  // start hack
  if (hackThreads > 0) {
    await ns.asleep(hackStartTime - growStartTime - weaken2StartTime)
    phase = script_name = "hack"
    threads = hackThreads
      ; ({ pids, fired, threads } = RunScript(
        ns,
        SCRIPT_NAME_PREFIX + script_name + ".js",
        threads,
        [target, phase, cycle_number],
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
      debugger
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

function CalcBatchTimesThreads(ns, target, cycle_number, hackPct, isPrep) {
  // HWGW. assume server is prepped (max money, sec-minSec = 0)
  //                    |= hack ====================|
  // |=weaken 1======================================|
  //                |= grow ==========================|
  //   |=weaken 2======================================|

  // Money
  let money = ns.getServerMoneyAvailable(target)
  if (money <= 0) money = 1 // division by zero safety
  const maxMoney = ns.getServerMaxMoney(target)

  // Security
  const minSec = ns.getServerMinSecurityLevel(target)
  const sec = ns.getServerSecurityLevel(target)
  let startingExtraSecurity = sec - minSec

  if (!isPrep && startingExtraSecurity > 0) {
    let msg = `ERROR:CalcBatchTimesThreads: ${target} is NOT PREPPED, sec is ${startingExtraSecurity}`
    ns.print(msg)
    // throw new Error(msg)
  }

  let hackDuration = ns.getHackTime(target)
  let growDuration = ns.getGrowTime(target)
  let weaken1Duration = ns.getWeakenTime(target)
  let weaken2Duration = ns.getWeakenTime(target)

  // Hack lands first
  // Hacking (limited by pct)
  let hackMoneyRemoved = money * hackPct
  let hackThreads = Math.floor(ns.hackAnalyzeThreads(target, hackMoneyRemoved))
  let hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads)
  let hackStartTime = weaken1Duration - hackDuration - config.batchPhaseDelay
  let hackEndTime = hackStartTime + hackDuration
  // cancel hack if isPrep
  if (isPrep) {
    hackMoneyRemoved = 0
    hackThreads = 0
    hackSecurityIncrease = 0
    hackDuration = 0
    hackStartTime = 0
    hackEndTime = 0
  }

  // Weaken1
  let weaken1SecToRemove = isPrep ? startingExtraSecurity : hackSecurityIncrease
  let weaken1Threads = Math.ceil(weaken1SecToRemove / ns.weakenAnalyze(1))
  let weaken1StartTime = 0
  let weaken1EndTime = weaken1StartTime + weaken1Duration

  // grow
  let growThreads = Math.ceil(
    ns.growthAnalyze(target, (GROW_THREAD_MULT * maxMoney) / (money - hackMoneyRemoved))
  )
  let growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads)
  let growStartTime = weaken1Duration - growDuration + config.batchPhaseDelay
  let growEndTime = growStartTime + growDuration
  // cancel grow if server is at max money and we are not hacking
  if (maxMoney - money <= 0 && hackThreads == 0) {
    growThreads = 0
    growSecurityIncrease = 0
    growDuration = 0
    growStartTime = 0
    growEndTime = 0
  }

  // Weaken2
  let weaken2SecToRemove = growSecurityIncrease
  let weaken2Threads = Math.ceil(weaken2SecToRemove / ns.weakenAnalyze(1))
  let weaken2StartTime = weaken1StartTime + 2 * config.batchPhaseDelay
  let weaken2EndTime = weaken2StartTime + weaken2Duration
  if (weaken2Threads <= 0) {
    weaken2Threads = 0
    weaken2SecToRemove = 0
    weaken2Duration = 0
    weaken2StartTime = 0
    weaken2EndTime = 0
  }

  let result = {
    weaken1Threads,
    weaken1StartTime,
    weaken1Duration,
    weaken1EndTime,
    weaken1SecToRemove,
    weaken2Threads,
    weaken2StartTime,
    weaken2Duration,
    weaken2EndTime,
    weaken2SecToRemove,
    growThreads,
    growStartTime,
    growDuration,
    growEndTime,
    growSecurityIncrease,
    hackThreads,
    hackStartTime,
    hackDuration,
    hackEndTime,
    hackSecurityIncrease,
    hackMoneyRemoved,
    money,
    maxMoney,
    sec,
    minSec,
    startingExtraSecurity,
  }
  return result
}

async function CreateScript(ns, command) {
  await ns.write(
    SCRIPT_NAME_PREFIX + command + ".js",
    "export async function main(ns) { await ns." + command + "(ns.args[0]) }",
    "w"
  )
}
