import {
  GetTopHackServers,
  SortServerListByTopHacking,
} from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

const SCRIPT_NAME = "v4"
const SCRIPT_PATH = "/scripts/hack/loop_hack/" + SCRIPT_NAME

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.5 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.2 // extra grow threads to be sure
const MAX_PIDS = 50 // max number of pids total

// https://github.com/xxxsinx/bitburner/blob/main/v1.js

const config = {
  loopDelay: 5000,
  serverStates: {},
  addTargets: [],
  current_pids: 0,
  getCurrentTargetsStates: function (ns) {
    let current_targets_states = []
    for (let server in this.serverStates) {
      let state = this.serverStates[server]
      if (state.promise) {
        current_targets_states.push(state)
      }
    }
    // sort by 'best'
    current_targets_states = SortServerListByTopHacking(
      ns,
      current_targets_states
    )
    // ns.print("current_targets is " + current_targets)
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
      addTargets: this.addTargets,
      serverStates: this.serverStates,
    }
  },
  resetConfig: function () {
    this.loopDelay = 5000
    this.serverStates = {}
    this.addTargets = []
    this.current_pids = 0
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
  if (mode === "hack") {
    const ram = new MemoryMap(ns, true);
    let num_start_targets = Math.min(Math.max(ram.total / 2000, 2), 5) // assume 2 TB per target.  keep between 2 and 5.
    ns.print("Starting with " + num_start_targets + " targets.")
    AddTarget(ns, num_start_targets)
  } else if (mode === "xp") {
    config.addTargets.push({"name": "joesguns"})
  }
  await MainLoop(ns, pct, mode)
}

async function MainLoop(ns, pct, mode) {
  while (true) {
    while (config.addTargets.length > 0) {
      let new_target = config.addTargets.shift()
      ns.print("MainLoop: starting new promise for server " + new_target.name)
      setServerState(new_target.name, "fullGrowth", null)
      setServerState(new_target.name, "weight", new_target.weight)
      StartNewExploit(ns, new_target.name, pct, mode == "xp")
    }
    ns.write(
      "/data/hack.txt",
      JSON.stringify(config.getConfigJSON(ns), null, 2),
      "w"
    )
    await ns.asleep(config.loopDelay)
  }
}

async function StartNewExploit(ns, target, pct, xpMode) {
  let promise = new Promise((resolve, reject) => {
    Exploit(ns, target, pct, xpMode, resolve)
  }).then(
    (val) => {
      return ExploitCallback(ns, target, pct, xpMode, val)
    },
    (err) => {
      ns.print("StartNewExploit err:" + err)
    }
  )
  setServerState(target, "promise", promise)
  return promise
}

function AddTarget(ns, num_new_targets = 1) {
  // only add if there are no 'unknown' post-hack growth usages
  if (
    !config
      .getCurrentTargetsStates(ns)
      .some((state) => setServerState(state.server, "fullGrowth") === null)
  ) {
    let targets = config.getCurrentTargets(ns)
    let new_targets = GetNextExploitTargets(ns, num_new_targets, targets)
    new_targets.forEach((target) => {
      if (!config.addTargets.includes(target)) {
        ns.print("adding target: " + target.name)
        config.addTargets.push(target)
      }
    })
  }
}

function RemoveTarget(ns) {
  let current_targets = config.getCurrentTargets(ns)
  // don't remove last target
  if (current_targets.length > 1) {
    // ensure post-hack growth is known
    if (
      !config
        .getCurrentTargetsStates(ns)
        .some((state) => setServerState(state.server, "fullGrowth") === null)
    ) {
      // keep the best fullGrowth == false
      let target_to_stop = current_targets.slice(-1)
      ns.print("removing target (set flag to stop it): " + target_to_stop)
      setServerState(target_to_stop, "stop", true)
    }
  }
}

async function ExploitCallback(ns, target, pct, xpMode, result) {
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
      AddTarget(ns)
    }
  } else if (
    result.phase == "grow" &&
    result.threads != Infinity &&
    result.fired != result.threads
  ) {
    // Infinity is used in xpMode; do not reduce
    // could not fire all the desired threads, should reduce
    setServerState(target, "fullGrowth", false)
    ns.print(result.target + ": rm_target")
    RemoveTarget(ns)
  }
  return StartNewExploit(ns, target, pct, xpMode)
}

async function Exploit(ns, target, pct, xpMode, resolve) {
  if (xpMode) target = "joesguns"

  let phase = "unknown"
  let pids = [],
    fired = 0,
    threads = 0,
    grow_mem_report = {},
    expectedDuration = 0

  const {
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec,
  } = CalcExploitThreadsMoneySec(ns, target, pct, xpMode)

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

  let startMessage = "",
    endMessage = ""
  // Check if security is above minimum
  if ((xpMode || sec > minSec + MAX_SECURITY_DRIFT) && weakenThreads > 0) {
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
    xpMode
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
  ns.print(startMessage)
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
  config.current_pids += pids.length
  await WaitPids(ns, pids, expectedDuration)
  config.current_pids -= pids.length
  ns.print(endMessage)

  if (phase === "hack") setServerState(target, "hasHacked", true)

  let result = { target, phase, fired, threads, grow_mem_report }
  for (let key in result) {
    if (key != "target") {
      setServerState(target, key, result[key])
    }
  }
  // ns.print("Exploit resolving with " + JSON.stringify(result))
  resolve(result)
}

/** returns the next-best target, excluding the passed-in targets */
function GetNextExploitTargets(ns, num_new_targets, targets = []) {
  let top_targets = GetTopHackServers(ns, num_new_targets + targets.length)
  let possible_targets = top_targets.filter((t) => !targets.includes(t.name))
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
  ns.print(
    startLine + "┌────────────────────────────────────────────┐"
  )
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
      secString.padEnd(16) +
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
  let weakenTimeString = "W: " + FormatTime(ns.getWeakenTime(server)).padStart(7)
  let weakenThreadString = " (t=" + (weakenThreads === Infinity ? "Inf" : weakenThreads) + ")"
  let growTimeString = "G: " + FormatTime(ns.getGrowTime(server)).padStart(7)
  let growThreadString = " (t=" + (growThreads === Infinity ? "Inf" : growThreads) + ")"
  let hackTimeString = "H: " + FormatTime(ns.getHackTime(server)).padStart(7)
  let hackThreadString = " (t=" + (hackThreads === Infinity ? "Inf" : hackThreads) + ")"
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
  ns.print(
    startLine + "└────────────────────────────────────────────┘"
  )
  ns.print("")
}

function centerString(string, desiredWidth) {
  return string.padStart(string.length + Math.floor((desiredWidth - string.length)/2)).padEnd(desiredWidth)
}

function CalcExploitThreadsMoneySec(ns, server, pct, xpMode) {
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

  if (xpMode) {
    if (weakenThreads > 0) weakenThreads = Infinity
    growThreads = Infinity
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
