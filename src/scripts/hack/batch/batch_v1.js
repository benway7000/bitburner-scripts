import { GetTopHackServers, SortServerListByTopHacking } from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

const SCRIPT_NAME_PREFIX = "batch_v1"
const SCRIPT_PATH = "/scripts/hack/batch/" + SCRIPT_NAME_PREFIX

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.5 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.2 // extra grow threads to be sure
const MAX_PIDS = 50 // max number of pids total

const JOESGUNS = "joesguns"
const CYCLE_STATE_PREP = "prep"
const CYCLE_STATE_BATCH = "batch"
const CYCLE_STATE_CALLBACK = "callback"
const CYCLE_STATE_STOPPED = "stopped"
const CYCLE_STATE_COMPLETE = "complete"

// https://github.com/xxxsinx/bitburner/blob/main/v1.js

const config = {
  loopDelay: 20 * 1000,
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
          [CYCLE_STATE_PREP, CYCLE_STATE_BATCH, CYCLE_STATE_CALLBACK].includes(c.cycle_state)
        )
      ) {
        // ns.print("getCurrentTargetsStates: state.prpmise is true")
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
      loopDelay: this.loopDelay,
      currentTargets: this.getCurrentTargets(ns),
      targetAdjust: this.targetAdjust,
      serverStates: this.serverStates,
    }
  },
  resetConfig: function () {
    this.loopDelay = 5000
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
 * @returns list of cycles, sorted by cycle_number
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

function getServerCyclesNextNumber(server) {
  let cycles = getServerCycles(server)
  if (cycles.length > 0) {
    return cycles.slice(-1)[0].cycle_number + 1
  } else {
    return 1
  }
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

  // Parameters
  const [mode, pct = DEFAULT_PCT] = ns.args

  // Show usage if no parameters were passed
  if (mode == undefined) {
    ns.tprint("ERROR: No mode specified!")
    ns.tprint("INFO : Usage: run " + SCRIPT_NAME_PREFIX + ".js <mode> <pct>")
    ns.tprint("INFO :")
    ns.tprint("INFO : HACK MODE: run " + SCRIPT_NAME_PREFIX + ".js hack <pct>")
    ns.tprint(
      "INFO :    <pct> is the 1-based maximum percentage to hack from the target (Optional, default is 25%)"
    )
    ns.tprint("INFO :")
    ns.tprint("INFO : XP MODE: run " + SCRIPT_NAME_PREFIX + ".js xp")
    ns.tprint("INFO :    This mode will simply prepare and then throw all the ram on grow at joesguns for XP")
    return
  }

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript(ns, "hack")
  await CreateScript(ns, "grow")
  await CreateScript(ns, "weaken")

  // Open the tail window when the script starts
  // ns.tail();
  let num_start_targets = 1
  // if (mode === "hack") {
  //   const ram = new MemoryMap(ns, true)
  //   num_start_targets = Math.min(Math.max(ram.total / 2000, 2), 5) // assume 2 TB per target.  keep between 2 and 5.
  //   ns.print("Starting with " + num_start_targets + " targets.")
  // }
  await MainLoop(ns, num_start_targets, pct, mode)
}

async function MainLoop(ns, num_start_targets, pct, mode) {
  while (true) {
    if (config.getCurrentTargets(ns).length == 0) {
      // just starting
      // start joes in xp mode
      // TODO do joes
      // StartXpCycleOnTarget(ns, JOESGUNS, pct)
      // add more targets
      if (num_start_targets > 0) AddTarget(ns, num_start_targets, pct)
    } else {
      // TODO do adjust
      // // adjust
      // let adjustment = config.targetAdjust
      // if (adjustment > 0) {
      //   AddTarget(ns, 1, pct)
      // } else if (adjustment < 0) {
      //   RemoveTarget(ns)
      // }
      // config.targetAdjust = 0
    }

    ns.write("/data/hack.txt", JSON.stringify(config.getConfigJSON(ns), null, 2), "w")
    await ns.asleep(config.loopDelay)
  }
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
  ns.print(`RunBatch:${target} cycle:${cycle_number} prep:${isPrep}`)

  const calc = CalcBatchTimesThreads(ns, target, cycle_number, pct, isPrep)
  calc.target = target
  calc.cycle_number = cycle_number
  calc.isPrep = isPrep

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
    weaken1Threads, weaken1StartTime, weaken1Duration, weaken1EndTime,
    weaken2Threads, weaken2StartTime, weaken2Duration, weaken2EndTime,
    growThreads, growStartTime, growDuration, growEndTime,
    hackThreads, hackStartTime, hackDuration, hackEndTime,
    expectedDuration, expectedTime, batchPhaseDelay: config.batchPhaseDelay, all_pids: {}
  }
  getServerCycleByNumber(target, cycle_number).batch = batch

  // start weaken1
  let phase = "weaken1"
  let script_name = "weaken"
  threads = weaken1Threads
  ;({ pids, fired, threads } = RunScript(
    ns,
    SCRIPT_NAME_PREFIX + script_name + ".js",
    threads,
    [target, phase],
    -1
  ))
  batch.all_pids.weaken1 = [...pids]

  // start weaken2
  await ns.asleep(weaken2StartTime)
  phase = "weaken2"
  script_name = "weaken"
  threads = weaken2Threads
  ;({ pids, fired, threads } = RunScript(
    ns,
    SCRIPT_NAME_PREFIX + script_name + ".js",
    threads,
    [target, phase],
    -1
  ))
  batch.all_pids.weaken2 = [...pids]

  // start grow
  if (growThreads > 0) {
    await ns.asleep(growStartTime - weaken2StartTime)
    phase = script_name = "grow"
    threads = growThreads
    ;({ pids, fired, threads } = RunScript(
      ns,
      SCRIPT_NAME_PREFIX + script_name + ".js",
      threads,
      [target, phase],
      -1
    ))
    batch.all_pids.grow = [...pids]
  }

  // start hack
  if (hackThreads > 0) {
    await ns.asleep(hackStartTime - growStartTime - weaken2StartTime)
    phase = script_name = "hack"
    threads = hackThreads
    ;({ pids, fired, threads } = RunScript(
      ns,
      SCRIPT_NAME_PREFIX + script_name + ".js",
      threads,
      [target, phase],
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
  // let promise = PrepServer(ns, target, pct)
  //   .then(RunBatch(ns, target, pct))
  //   .then((result) => FullCycleCallback(ns, target, pct, result))
  // setServerState(target, "promise", promise)
  // return promise
  if (cycle_number === -1) cycle_number = getServerCyclesNextNumber(target)
  getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATE_PREP
  await PrepServer(ns, target, cycle_number, pct)
  getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATE_BATCH
  let batch_result = await RunBatch(ns, target, cycle_number, pct)
  getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATE_CALLBACK
  return FullCycleCallback(ns, target, cycle_number, pct, batch_result)
}

async function FullCycleCallback(ns, target, cycle_number, pct, result) {
  if (getServerState(target, "stop")) {
    ns.print("target " + target + " received flag to stop")
    getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATE_STOPPED
    return "stopped"
  }

  // adjust
  if (result.batch.ram.available > 3000) {
    setTimeout(() => {
      StartFullCycleOnTarget(ns, target, pct)
    }, config.multiCycleDelay)
  }
  // or maybe adjust how many batches or something?
  getServerCycleByNumber(target, cycle_number).cycle_state = CYCLE_STATE_COMPLETE
  return StartFullCycleOnTarget(ns, target, pct, cycle_number)
}

async function StartXpCycleOnTarget(ns, target, pct) {
  let promise = PrepServer(ns, target, pct).then((result) => XpCycleCallback(ns, target, pct, result))
  setServerState(target, "promise", promise)
  return promise
}

async function XpCycleCallback(ns, target, pct, result) {
  if (getServerState(target, "stop")) {
    ns.print("target " + target + " received flag to stop")
    setServerState(target, "promise", null)
    return "stopped"
  }
  // TODO: use result to figure out if we should adjust targets
  // or maybe adjust how many batches or something?
  return StartXpCycleOnTarget(ns, target, pct)
}

function SetAdjustAddTarget(ns) {
  if (
    !config.getCurrentTargetsStates(ns).some((state) => setServerState(state.server, "fullGrowth") === null)
  ) {
    config.targetAdjust++
  }
}

function SetAdjustRemoveTarget(ns) {
  if (
    !config.getCurrentTargetsStates(ns).some((state) => setServerState(state.server, "fullGrowth") === null)
  ) {
    config.targetAdjust--
  }
}

function AddTarget(ns, num_new_targets = 1, pct) {
  let current_targets = config.getCurrentTargets(ns)
  // ns.print("AddTarget: current_targets is " + current_targets)
  let new_targets = GetNextExploitTargets(ns, num_new_targets, current_targets)
  new_targets.forEach((new_target) => {
    if (!current_targets.includes(new_target)) {
      ns.print("AddTarget: starting new promise for server " + new_target.name)
      setServerState(new_target.name, "fullGrowth", null)
      setServerState(new_target.name, "weight", new_target.weight)
      StartFullCycleOnTarget(ns, new_target.name, pct)
    }
  })
}

function RemoveTarget(ns) {
  let current_targets = config.getCurrentTargets(ns)
  // don't stop joes
  current_targets = current_targets.filter((t) => t != JOESGUNS)
  // don't remove last target
  // TODO: logic to switch to better target (ie hack skill improved a lot)
  if (current_targets.length > 1) {
    // TODO: keep the best fullGrowth == false
    let target_to_stop = current_targets.slice(-1)[0]
    if (getServerState(target_to_stop, "stop") != true) {
      ns.print("RemoveTarget: removing target (set flag to stop it): " + target_to_stop)
      setServerState(target_to_stop, "stop", true)
    }
  }
}

/** returns the next-best target, excluding the passed-in targets */
function GetNextExploitTargets(ns, num_new_targets, exclude_targets = []) {
  let top_targets = GetTopHackServers(ns, num_new_targets + exclude_targets.length)
  let possible_targets = top_targets.filter((t) => !exclude_targets.includes(t.name))
  // ns.print("possible_targets[0]: " + possible_targets[0].name)
  if (possible_targets.length > num_new_targets) {
    return possible_targets.slice(0, num_new_targets)
  } else {
    return possible_targets
  }
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
  // draw batch diagram
  line = `${"─".repeat((desiredContentWidth - 6) / 2)} ${isPrep ? "Prep" : "Hack"} ${"─".repeat(
    (desiredContentWidth - 6) / 2
  )}`
  ns.print(`${startLine}${startWall}${line}${endWall}`)
  if (hackThreads > 0) {
    line = `${" ".repeat(DurToLen(hackStartTime))}[= H ${"=".repeat(DurToLen(hackDuration) - 3 - 6)}]   ` // 3 for finishing, 6 for [= H ]
  } else {
    line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No Hack]${" ".repeat((desiredContentWidth - 9) / 2)}`
  }
  ns.print(`${startLine}${startWall}${line}${endWall}`)
  if (weaken1Threads > 0) {
    line = `${" ".repeat(DurToLen(weaken1StartTime))}[= W1 ${"=".repeat(
      DurToLen(weaken1Duration) - 3 - 7
    )}]  ` // 3 for finishing, 7 for [= W1 ]
  } else {
    line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No W1]${" ".repeat((desiredContentWidth - 9) / 2)}`
  }
  ns.print(`${startLine}${startWall}${line}${endWall}`)
  if (growThreads > 0) {
    line = `${" ".repeat(DurToLen(growStartTime))}[= G ${"=".repeat(DurToLen(growDuration) - 3 - 6)}] ` // 3 for finishing, 6 for [= G ]
  } else {
    line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No Grow]${" ".repeat((desiredContentWidth - 9) / 2)}`
  }
  ns.print(`${startLine}${startWall}${line}${endWall}`)
  if (weaken2Threads > 0) {
    line = `${" ".repeat(DurToLen(weaken2StartTime) + 1)}[= W2 ${"=".repeat(
      DurToLen(weaken2Duration) - 3 - 7
    )}]` // 3 for finishing, 7 for [= W2 ]
  } else {
    line = `${" ".repeat((desiredContentWidth - 9) / 2)}[No W2]${" ".repeat((desiredContentWidth - 9) / 2)}`
  }

  ns.print(`${startLine}${startWall}${line}${endWall}`)
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
    throw new Error(msg)
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
    target,
    cycle_number,
    isPrep,
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
