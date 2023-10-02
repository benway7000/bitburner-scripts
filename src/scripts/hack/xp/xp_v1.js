import {
  GetTopHackServers,
  SortServerListByTopHacking,
} from "scripts/lib/metrics-simple"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

/**
 * xp script, based on v5 loop hack
 */
const SCRIPT_NAME = "xp_v1"
const SCRIPT_PATH = "/scripts/hack/xp/" + SCRIPT_NAME

const MAX_PIDS = 50 // max number of pids total

const JOESGUNS = "joesguns"
const DEFAULT_PCT = 0.2

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
  const [ramPct = DEFAULT_PCT] = ns.args

  // Show usage if no parameters were passed
  if (ramPct == "undefined") {
    ns.tprint("ERROR: No mode specified!")
    ns.tprint("INFO : Usage: run " + SCRIPT_NAME + ".js <ramPct>")
    ns.tprint("INFO :")
    return
  }

  // This script calls 1-liner worker scripts, the following commands create those scripts on the current host
  await CreateScript(ns, "hack")
  await CreateScript(ns, "grow")
  await CreateScript(ns, "weaken")

  // Open the tail window when the script starts
  // ns.tail();
  await MainLoop(ns, ramPct)
}

async function MainLoop(ns, ramPct) {
  while (true) {
    if (config.getCurrentTargets(ns).length == 0) {
      StartNewExploit(ns, JOESGUNS, ramPct)
    }
    ns.write(
      "/data/xp.txt",
      JSON.stringify(config.getConfigJSON(ns), null, 2),
      "w"
    )
    await ns.asleep(config.loopDelay)
  }
}

async function StartNewExploit(ns, target, ramPct) {
  let promise = new Promise((resolve, reject) => {
    Exploit(ns, target, ramPct, resolve)
  }).then(
    (val) => {
      return ExploitCallback(ns, target, ramPct, val)
    },
    (err) => {
      ns.print("StartNewExploit err:" + err)
    }
  )
  // ns.print("StartNewExploit: setting server:" + target + " state. promise == " + promise)
  setServerState(target, "promise", promise)
  return promise
}

async function ExploitCallback(ns, target, ramPct, result) {
  if (getServerState(target, "stop")) {
    ns.print("server " + target + " received flag to stop")
    setServerState(target, "promise", null)
    return "stopped"
  }
  return StartNewExploit(ns, target, ramPct)
}

async function Exploit(ns, target, ramPct, resolve) {
  // if (xpMode) target = "joesguns"
  let phase = "unknown"
  let pids = [],
    fired = 0,
    threads = 0,
    expectedDuration = 0

  // if (target === JOESGUNS) {
  //   let current_hack_skill = ns.getPlayer().skills.hacking
  //   let last_hack_skill = getServerState(JOESGUNS, "last_hack_skill")
  //   if (
  //     last_hack_skill == undefined ||
  //     last_hack_skill + 1 < current_hack_skill
  //   ) {
  //     xpPct = 0.5
  //   } else {
  //     // only gained 0 or 1 skill - not worth doing a lot of xp mode?
  //     // ns.print(
  //     //   "last_hack_skill and current_hack_skill are within 1, slowing xp to 0.1"
  //     // )
  //     xpPct = 0.1
  //   }
  //   setServerState(JOESGUNS, "last_hack_skill", current_hack_skill)
  // }

  const {
    weakenThreads,
    growThreads,
    sec,
    minSec,
  } = CalcExploitThreadsMoneySec(ns, target, ramPct)

  let startMessage = "",
    endMessage = ""
  // Check if security is above minimum
  if (weakenThreads > 0) {
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
  } else {
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
  }

  // do the actions
  // if (!ramPct) ns.print(startMessage)
  setServerState(target, "phase", phase)
  setServerState(target, "expectedDuration", expectedDuration)
  setServerState(target, "expectedTime", Date.now() + expectedDuration)
    ; ({ pids, fired, threads } = await RunScript(
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
    if (!ramPct) {
      ns.print(endMessage)
    } else {
      ns.print("INFO:" + target + ":" + phase + ":ramPct == " + ramPct)
    }
  } else {
    await WaitPids(ns, pids, expectedDuration)
  }

  let result = { target, phase, fired, threads, ramPct }
  for (let key in result) {
    if (key != "target") {
      setServerState(target, key, result[key])
    }
  }
  // ns.print("Exploit resolving with " + JSON.stringify(result))
  resolve(result)
}


function CalcExploitThreadsMoneySec(ns, server, ramPct = 0.2) {
  // Security
  const minSec = ns.getServerMinSecurityLevel(server)
  const sec = ns.getServerSecurityLevel(server)
  let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))

  const ram = new MemoryMap(ns, false)
  let scriptRam = 0
  if (weakenThreads > 0) {
    scriptRam = ns.getScriptRam(SCRIPT_NAME + "weaken" + ".js")
    weakenThreads = Math.ceil((ram.total * ramPct) / scriptRam)
    // weakenThreads = Infinity
  }
  scriptRam = ns.getScriptRam(SCRIPT_NAME + "grow" + ".js")
  let growThreads = Math.ceil((ram.total * ramPct) / scriptRam)
  // growThreads = Infinity


  let result = {
    weakenThreads,
    growThreads,
    sec,
    minSec,
  }
  // ns.print(`XP calc result ${JSON.stringify(result, 2)}`)
  return result
}

async function CreateScript(ns, command) {
  await ns.write(
    SCRIPT_NAME + command + ".js",
    "export async function main(ns) { await ns." + command + "(ns.args[0]) }",
    "w"
  )
}

