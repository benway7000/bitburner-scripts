import {
  GetTopHackServers,
  SortServerListByTopHacking,
} from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

const SCRIPT_NAME = "v5"
const SCRIPT_PATH = "/scripts/hack/loop_hack/" + SCRIPT_NAME

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.5 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.2 // extra grow threads to be sure
const MAX_PIDS = 50 // max number of pids total

const JOESGUNS = "joesguns"

// https://github.com/xxxsinx/bitburner/blob/main/v1.js

const config = {
  loopDelay: 20 * 1000,
  serverStates: {},
  current_pids: 0,
  targetAdjust: 0,
  getCurrentTargetsStates: function (ns) {
    let current_targets_states = []
    for (let server in this.serverStates) {
      let state = this.serverStates[server]
      // ns.print("getCurrentTargetsStates: server: " + server + " checking promise " + state.promise)
      if (state.promise) {
        // ns.print("getCurrentTargetsStates: state.prpmise is true")
        current_targets_states.push(state)
      }
    }
    // sort by 'best'
    current_targets_states = SortServerListByTopHacking(
      ns,
      current_targets_states
    )
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
    config.serverStates[server] = serverState = { name: server }
    // ns.print("initializing serverState for " + server + " with " + serverState)
  }
  serverState[key] = value
}

function getServerState(server, key) {
  return config.serverStates?.[server]?.[key] ?? undefined
}

function clearServerState(server) {
  if (config.serverStates) {
    if (server in config.serverStates) {
      config.serverStates[server] = null
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
  if (mode == "undefined") {
    ns.tprint("ERROR: No mode specified!")
    ns.tprint("INFO : Usage: run " + SCRIPT_NAME + ".js <mode> <pct>")
    ns.tprint("INFO :")
    ns.tprint("INFO : HACK MODE: run " + SCRIPT_NAME + ".js hack <pct>")
    ns.tprint(
      "INFO :    <pct> is the 1-based maximum percentage to hack from the target (Optional, default is 25%)"
    )
    ns.tprint("INFO :")
    ns.tprint("INFO : XP MODE: run " + SCRIPT_NAME + ".js xp")
    ns.tprint(
      "INFO :    This mode will simply prepare and then throw all the ram on grow at joesguns for XP"
    )
    return
  }

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript(ns, "hack")
  await CreateScript(ns, "grow")
  await CreateScript(ns, "weaken")

  // Open the tail window when the script starts
  // ns.tail();
  let num_start_targets = 1
  if (mode === "hack") {
    const ram = new MemoryMap(ns, true)
    num_start_targets = Math.min(Math.max(ram.total / 2000, 2), 5) // assume 2 TB per target.  keep between 2 and 5.
    ns.print("Starting with " + num_start_targets + " targets.")
  }
  await MainLoop(ns, num_start_targets, pct, mode)
}

async function MainLoop(ns, num_start_targets, pct, mode) {
  while (true) {
    if (config.getCurrentTargets(ns).length == 0) {
      // just starting
      // start joes in xp mode
      StartNewExploit(ns, JOESGUNS, pct)
      // add more targets
      if (num_start_targets > 0) AddTarget(ns, num_start_targets, pct)
    } else {
      // adjust
      let adjustment = config.targetAdjust
      if (adjustment > 0) {
        AddTarget(ns, adjustment, pct)
      } else if (adjustment < 0) {
        RemoveTarget(ns)
      }
      config.targetAdjust = 0
    }

    ns.write(
      "/data/hack.txt",
      JSON.stringify(config.getConfigJSON(ns), null, 2),
      "w"
    )
    await ns.asleep(config.loopDelay)
  }
}

async function StartNewExploit(ns, target, pct) {
  let promise = new Promise((resolve, reject) => {
    Exploit(ns, target, pct, resolve)
  }).then(
    (val) => {
      return ExploitCallback(ns, target, pct, val)
    },
    (err) => {
      ns.print("StartNewExploit err:" + err)
    }
  )
  // ns.print("StartNewExploit: setting server:" + target + " state. promise == " + promise)
  setServerState(target, "promise", promise)
  return promise
}

function SetAdjustAddTarget(ns) {
  if (
    !config
      .getCurrentTargetsStates(ns)
      .some((state) => setServerState(state.server, "fullGrowth") === null)
  ) {
    config.targetAdjust++
  }
}

function SetAdjustRemoveTarget(ns) {
  if (
    !config
      .getCurrentTargetsStates(ns)
      .some((state) => setServerState(state.server, "fullGrowth") === null)
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
      StartNewExploit(ns, new_target.name, pct)
    }
  })
}

function RemoveTarget(ns) {
  let current_targets = config.getCurrentTargets(ns)
  // don't stop joes
  current_targets = current_targets.filter(t => t != JOESGUNS)
  // don't remove last target
  // TODO: logic to switch to better target (ie hack skill improved a lot)
  if (current_targets.length > 1) {
    // TODO: keep the best fullGrowth == false
    let target_to_stop = current_targets.slice(-1)[0]
    if (getServerState(target_to_stop, "stop") != true) {
      ns.print(
        "RemoveTarget: removing target (set flag to stop it): " + target_to_stop
      )
      setServerState(target_to_stop, "stop", true)
    }
  }
}

async function ExploitCallback(ns, target, pct, result) {
  if (getServerState(target, "stop")) {
    ns.print("server " + target + " received flag to stop")
    setServerState(target, "promise", null)
    return "stopped"
  }
  if (result.phase == "grow" && getServerState(target, "hasHacked")) {
    // if (result.grow_mem_report.used / result.grow_mem_report.total < 0.85) {
    //   // grow is using less than 85% so add more
    if (result.fired == result.threads) {
      setServerState(target, "fullGrowth", true)
      ns.print(result.target + ": add_target")
      SetAdjustAddTarget(ns)
    }
  } else if (
    result.phase == "grow" &&
    result.xpPct == 0 &&
    result.fired != result.threads
  ) {
    // could not fire all the desired threads, should reduce
    setServerState(target, "fullGrowth", false)
    ns.print(result.target + ": rm_target. fired == " + result.fired + ". threads == " + result.threads)
    SetAdjustRemoveTarget(ns)
  }
  return StartNewExploit(ns, target, pct)
}

async function Exploit(ns, target, pct, resolve) {
  // if (xpMode) target = "joesguns"
  let xpPct = 0
  let phase = "unknown"
  let pids = [],
    fired = 0,
    threads = 0,
    expectedDuration = 0

  if (target === JOESGUNS) {
    let current_hack_skill = ns.getPlayer().skills.hacking
    let last_hack_skill = getServerState(JOESGUNS, "last_hack_skill")
    if (
      last_hack_skill == undefined ||
      last_hack_skill + 1 < current_hack_skill
    ) {
      xpPct = 0.5
    } else {
      // only gained 0 or 1 skill - not worth doing a lot of xp mode?
      // ns.print(
      //   "last_hack_skill and current_hack_skill are within 1, slowing xp to 0.1"
      // )
      xpPct = 0.1
    }
    setServerState(JOESGUNS, "last_hack_skill", current_hack_skill)
  }

  const {
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec,
  } = CalcExploitThreadsMoneySec(ns, target, pct, xpPct)

  if (!xpPct) {
    ExploitReport(
      ns,
      target,
      weakenThreads,
      growThreads,
      hackThreads,
      money,
      maxMoney,
      sec,
      minSec
    )
  }

  let startMessage = "",
    endMessage = ""
  // Check if security is above minimum
  if ((xpPct || sec > minSec + MAX_SECURITY_DRIFT) && weakenThreads > 0) {
    // We need to lower security
    startMessage =
      "WARN:" +
      target +
      ": ***WEAKENING*** Security is over threshold, we need " +
      weakenThreads +
      " threads to floor it"

    phase = "weaken"
    expectedDuration = ns.getWeakenTime(target)
    threads = weakenThreads
    endMessage =
      "INFO:" +
      target +
      ": Waiting for weaken script completion (approx " +
      ns.tFormat(expectedDuration) +
      "). pids == " +
      pids
  } else if (
    (money < maxMoney - maxMoney * MAX_MONEY_DRIFT_PCT && growThreads > 0) ||
    xpPct
  ) {
    // We need to grow the server
    startMessage =
      "WARN:" +
      target +
      ": ***GROWING*** Money is getting low, we need " +
      growThreads +
      " threads to max it"

    phase = "grow"
    expectedDuration = ns.getGrowTime(target)
    threads = growThreads
    endMessage =
      "INFO:" +
      target +
      ": Waiting for grow script completion (approx " +
      ns.tFormat(expectedDuration) +
      "). pids == " +
      pids
  } else if (hackThreads > 0) {
    // Server is ripe for hacking
    startMessage =
      "WARN:" +
      target +
      ": ***HACKING*** Server is ripe for hacking, hitting our target would require " +
      hackThreads +
      " threads"

    phase = "hack"
    expectedDuration = ns.getHackTime(target)
    threads = hackThreads
    endMessage =
      "INFO:" +
      target +
      ": Waiting for hack script completion (approx " +
      ns.tFormat(expectedDuration) +
      "). pids == " +
      pids
  }

  // do the actions
  if (!xpPct) ns.print(startMessage)
  setServerState(target, "phase", phase)
  setServerState(target, "expectedDuration", expectedDuration)
  setServerState(target, "expectedTime", Date.now() + expectedDuration)
  ;({ pids, fired, threads } = await RunScript(
    ns,
    SCRIPT_NAME + phase + ".js",
    threads,
    [target],
    MAX_PIDS - config.current_pids
  ))
  if (pids.length > 0) {
    config.current_pids += pids.length
    await WaitPids(ns, pids, expectedDuration)
    config.current_pids -= pids.length
    if (!xpPct) {
      ns.print(endMessage)
    } else {
      ns.print("INFO:" + target + ":" + phase + ":xpPct == " + xpPct)
    }
    if (phase === "hack") setServerState(target, "hasHacked", true)
  } else {
    await WaitPids(ns, pids, expectedDuration)
  }

  let result = { target, phase, fired, threads, xpPct }
  for (let key in result) {
    if (key != "target") {
      setServerState(target, key, result[key])
    }
  }
  // ns.print("Exploit resolving with " + JSON.stringify(result))
  resolve(result)
}

/** returns the next-best target, excluding the passed-in targets */
function GetNextExploitTargets(ns, num_new_targets, exclude_targets = []) {
  let top_targets = GetTopHackServers(
    ns,
    num_new_targets + exclude_targets.length
  )
  let possible_targets = top_targets.filter(
    (t) => !exclude_targets.includes(t.name)
  )
  // ns.print("possible_targets[0]: " + possible_targets[0].name)
  if (possible_targets.length > num_new_targets) {
    return possible_targets.slice(0, num_new_targets)
  } else {
    return possible_targets
  }
}

function ExploitReport(
  ns,
  server,
  weakenThreads,
  growThreads,
  hackThreads,
  money,
  maxMoney,
  sec,
  minSec
) {
  let spacer = " │ "
  let startLine = "INFO:"
  let startWall = "| "
  let endWall = "|"
  // Report
  ns.print("")
  ns.print(startLine + "┌────────────────────────────────────────────┐")
  let serverString = server
  let secString =
    "Sec: " +
    (sec - minSec).toFixed(2) +
    " Min: " +
    Math.round(minSec).toFixed(2)
  ns.print(
    startLine +
      startWall +
      serverString.padEnd(20) +
      spacer +
      secString.padEnd(20) +
      endWall
  )

  let moneyString =
    "$" +
    ns.formatNumber(money, 3) +
    " / $" +
    ns.formatNumber(maxMoney, 3) +
    " (" +
    ((money / maxMoney) * 100).toFixed(2) +
    "%)"
  ns.print(startLine + startWall + centerString(moneyString, 43) + endWall)
  let weakenTimeString =
    "W: " + FormatTime(ns.getWeakenTime(server)).padStart(7)
  let weakenThreadString =
    " (t=" + (weakenThreads === Infinity ? "Inf" : weakenThreads) + ")"
  let growTimeString = "G: " + FormatTime(ns.getGrowTime(server)).padStart(7)
  let growThreadString =
    " (t=" + (growThreads === Infinity ? "Inf" : growThreads) + ")"
  let hackTimeString = "H: " + FormatTime(ns.getHackTime(server)).padStart(7)
  let hackThreadString =
    " (t=" + (hackThreads === Infinity ? "Inf" : hackThreads) + ")"
  ns.print(
    startLine +
      startWall +
      weakenTimeString +
      spacer +
      growTimeString +
      spacer +
      hackTimeString +
      endWall.padStart(8)
  )
  ns.print(
    startLine +
      startWall +
      weakenThreadString.padStart(10) +
      spacer +
      growThreadString.padStart(10) +
      spacer +
      hackThreadString.padStart(10) +
      endWall.padStart(8)
  )
  ns.print(startLine + "└────────────────────────────────────────────┘")
  ns.print("")
}

function centerString(string, desiredWidth) {
  return string
    .padStart(string.length + Math.floor((desiredWidth - string.length) / 2))
    .padEnd(desiredWidth)
}

function CalcExploitThreadsMoneySec(ns, server, pct, xpPct = 0.5) {
  // Security
  const minSec = ns.getServerMinSecurityLevel(server)
  const sec = ns.getServerSecurityLevel(server)
  let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))

  // Money
  let money = ns.getServerMoneyAvailable(server)
  if (money <= 0) money = 1 // division by zero safety
  const maxMoney = ns.getServerMaxMoney(server)
  let growThreads = Math.ceil(
    ns.growthAnalyze(server, (GROW_THREAD_MULT * maxMoney) / money)
  )

  // Hacking (limited by pct)
  let hackThreads = Math.floor(ns.hackAnalyzeThreads(server, money * pct))

  if (xpPct > 0) {
    const ram = new MemoryMap(ns, true)
    let scriptRam
    if (weakenThreads > 0) {
      scriptRam = ns.getScriptRam(SCRIPT_NAME + "weaken" + ".js")
      weakenThreads = Math.ceil((ram.total * xpPct) / scriptRam)
      // weakenThreads = Infinity
    }
    scriptRam = ns.getScriptRam(SCRIPT_NAME + "grow" + ".js")
    growThreads = Math.ceil((ram.total * xpPct) / scriptRam)
    // growThreads = Infinity
    hackThreads = 0
  }

  let result = {
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec,
  }
  return result
}

async function CreateScript(ns, command) {
  await ns.write(
    SCRIPT_NAME + command + ".js",
    "export async function main(ns) { await ns." + command + "(ns.args[0]) }",
    "w"
  )
}

function RecursiveScan(ns, root = "home", found = []) {
  if (!found.includes(root)) {
    found.push(root)
    for (const server of ns.scan(root))
      if (!found.includes(server)) RecursiveScan(ns, server, found)
  }
  return found
}
