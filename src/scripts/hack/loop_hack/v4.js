import { GetTopHackServers } from "scripts/lib/metrics-simple"
import {
  pctColor,
  PrintTable,
  DefaultStyle,
  ColorPrint,
} from "scripts/lib/tables"
import { RunScript } from "scripts/lib/ram"
import { WaitPids, FormatTime } from "scripts/lib/utils"

const SCRIPT_NAME = "v4"
const SCRIPT_PATH = "/scripts/hack/loop_hack/" + SCRIPT_NAME

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.50 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const MIN_HOME_RAM = 64 // Number of GBs we want to keep free on home
const GROW_THREAD_MULT = 1.5 // extra grow threads to be sure
const MAX_PIDS = 2 // max number of pids per target

// https://github.com/xxxsinx/bitburner/blob/main/v1.js

const config = {
  loopDelay: 5000,
  state: {
    stop: false,
  },
  serverStates: {},
  addTargets: [],
  getCurrentTargets: function(ns) {
    let current_targets = []
    for (let server in this.serverStates) {
      let state = this.serverStates[server]
      if (state.promise) {
        current_targets.push(server)
      }
    }
    // ns.print("current_targets is " + current_targets)
    return current_targets
  },
  getConfigJSON: function(ns) {
    return {
      loopDelay: this.loopDelay,
      currentTargets: this.getCurrentTargets(ns),
      addTargets: this.addTargets,
      serverStates: this.serverStates,
    }
  }
}

function setServerState(server, key, value) {
  let serverState = config.serverStates[server]
  if (serverState == undefined) {
    config.serverStates[server] = serverState = {}
  }
  serverState[key] = value
}

function getServerState(server, key) {
  return config.serverStates?.[server]?.[key] ?? null
}


/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL")

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
  let start_targets = ["joesguns"]
  if (mode === "hack") {
    let homeRam = ns.getServerMaxRam("home")
    let num_start_targets = Math.max(homeRam / 1000 - 1, 1) // assume 1 TB per target, and leave 1 TB free.  minimum 1 target
    start_targets = GetNextExploitTargets(ns, num_start_targets)
  }
  config.addTargets.push(...start_targets)
  await MainLoop(ns, pct, mode)
}

async function MainLoop(ns, pct, mode) {
  while (true) {
    while (config.addTargets.length > 0) {
      let new_target = config.addTargets.pop()
      ns.print("MainLoop: starting new promise for server " + new_target)
      StartNewExploit(ns, new_target, pct, mode == "xp")
    }
    ns.write('/data/hack.txt', JSON.stringify(config.getConfigJSON(ns), null, 2), 'w');
    await ns.asleep(config.loopDelay)
  }
}

// async function MainLoop_old(ns, start_target, pct, mode) {
//   let targets = [start_target]
//   while (true) {
//     let promises = []
//     config.state.stop = false
//     // ns.tprint("starting " + targets.length + " foo's")
//     ns.print("MainLoop: starting new promise for servers " + targets)
//     for (let target of targets) {
//       promises.push(StartNewExploit(ns, target, pct, mode == "xp"))
//     }
//     // wait for first target to stop (because it detects a change to make)
//     let result = await Promise.any(promises)
//     // ns.print("Promise.any result == " + result)
//     // make the change suggested
//     if (result == "add_target") {
//       let new_target = GetNextExploitTarget(ns, targets)
//       ns.print("adding target: " + new_target)
//       targets.push(new_target)
//       config.state.stop = true
//     } else if (result == "rm_target") {
//       if (targets.length > 1) {
//         let removed = targets.pop()
//         ns.tprint("removed target: " + removed)
//         config.state.stop = true
//       } else {
//         // only 1 target, can't do anything about it so keep going
//       }
//     }
//     // wait for all servers to finish, so we can enact the targets change
//     await Promise.all(promises)
//     // await ns.sleep(config.loopDelay) // for safety against runaway script
//   }
// }

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

function AddTarget(ns) {
  let targets = config.getCurrentTargets(ns)
  let new_targets = GetNextExploitTargets(ns, 1, targets)
  ns.print("adding target: " + new_targets)
  new_targets.forEach((target) => {
    if (!config.addTargets.includes(target)) config.addTargets.push(target)
  })
}

function RemoveTarget(ns) {
  let target_to_stop = config.getCurrentTargets(ns).slice(-1)
  ns.print("removing target (set flag to stop it): " + target_to_stop)
  setServerState(target_to_stop, "stop", true)
}

async function ExploitCallback(ns, target, pct, xpMode, result) {
  if (getServerState(target, "stop") === true) {
    ns.print("server " + target + " received flag to stop")
    setServerState(target, "promise", null)
    return "stopped"
  }
  if (result.phase == "grow" && getServerState(target, "hasHacked")) {
    if (result.grow_mem_report.used / result.grow_mem_report.total < 0.85) {
      // grow is using less than 85% so add more
      ns.print(result.target + ": add_target")
      AddTarget(ns)
    } else if (result.threads != Infinity && result.fired != result.threads) {
      // Infinity is used in xpMode; do not reduce
      // could not fire all the desired threads, should reduce
      ns.print(result.target + ": rm_target")
      RemoveTarget(ns)
    }
  }
  return StartNewExploit(ns, target, pct, xpMode)

  // if (val == "same") {
  //   if (config.state.stop) {
  //     ns.tprint(name + ": same, but state says to stop. returning " + val)
  //     return val
  //   }
  //   ns.tprint(name + ": same, keep going. return promise")
  //   return foo(ns, name)
  // } else {
  //   ns.tprint(name + ": foo done with val " + val)
  //   return val
  // }
}

async function Exploit(ns, target, pct, xpMode, resolve) {
  if (xpMode) target = "joesguns"

  let phase = "unknown"
  let pids = [],
    fired = 0,
    threads = 0,
    grow_mem_report = {}

  const {
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec,
  } = CalcExploitThreadsMoneySec(ns, target, pct, xpMode)

  ExploitReportTable(
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

  // Check if security is above minimum
  if ((xpMode || sec > minSec + MAX_SECURITY_DRIFT) && weakenThreads > 0) {
    // We need to lower security
    ns.print(
      "WARN:" +
        target +
        ": ***WEAKENING*** Security is over threshold, we need " +
        weakenThreads +
        " threads to floor it"
    )
    phase = "weaken"
    setServerState(target, "phase", phase)
    let expectedTime = ns.getWeakenTime(target)
    setServerState(target, "expectedTime", expectedTime)
    threads = weakenThreads
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "weaken.js",
      weakenThreads,
      [target],
    ))
    ns.print(
      "INFO:" +
        target +
        ": Waiting for weaken script completion (approx " +
        ns.tFormat(expectedTime) +
        "). pids == " +
        pids
    )
    await WaitPids(ns, pids, expectedTime)
  } else if (
    (money < maxMoney - maxMoney * MAX_MONEY_DRIFT_PCT && growThreads > 0) ||
    xpMode
  ) {
    // We need to grow the server
    ns.print(
      "WARN:" +
        target +
        ": ***GROWING*** Money is getting low, we need " +
        growThreads +
        " threads to max it"
    )
    phase = "grow"
    setServerState(target, "phase", phase)
    let expectedTime = ns.getGrowTime(target)
    setServerState(target, "expectedTime", expectedTime)
    threads = growThreads
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "grow.js",
      growThreads,
      [target],
    ))

    grow_mem_report = MemoryReport(ns, target)

    ns.print(
      "INFO:" +
        target +
        ": Waiting for grow script completion (approx " +
        ns.tFormat(expectedTime) +
        "). pids == " +
        pids
    )
    await WaitPids(ns, pids, expectedTime)
  } else if (hackThreads > 0) {
    // Server is ripe for hacking
    ns.print(
      "WARN:" +
        target +
        ": ***HACKING*** Server is ripe for hacking, hitting our target would require " +
        hackThreads +
        " threads"
    )
    phase = "hack"
    setServerState(target, "phase", phase)
    let expectedTime = ns.getHackTime(target)
    setServerState(target, "expectedTime", expectedTime)
    threads = hackThreads
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "hack.js",
      hackThreads,
      [target],
    ))

    ns.print(
      "INFO:" +
        target +
        ": Waiting for hack script completion (approx " +
        ns.tFormat(expectedTime) +
        "). pids == " +
        pids
    )
    await WaitPids(ns, pids, expectedTime)
    setServerState(target, "hasHacked", true)
  }

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
    return possible_targets.slice(0, num_new_targets).map((t) => t.name)
  } else {
    return possible_targets.map((t) => t.name)
  }
}

/**
 *
 * @param {*} ns
 * @returns true if more targets/higher hack% is recommended
 */
function MemoryReport(ns, target) {
  let servers = RecursiveScan(ns)
  let free = 0
  let used = 0
  let total = 0
  for (const server of servers) {
    total += ns.getServerMaxRam(server)
    used += ns.getServerUsedRam(server)
    free = total - used
  }
  let pct = ((free / total) * 100).toFixed(2)
  // if (used / total < 0.85) {
  //   ns.print(
  //     "WARN:" +
  //       target +
  //       ": The full grow cycle for this hacking job is running with " +
  //       pct +
  //       "% ram left. You could hack other servers, and/or increase the % hack of this server."
  //   )
  // }
  return { free, used, total }
}

function ExploitReportTable(
  ns,
  server,
  weakenThreads,
  growThreads,
  hackThreads,
  money,
  moneyMax,
  sec,
  secMin
) {
  const table1_columns = [
    { header: " Server", width: 24 },
    { header: " Money", width: 23 },
  ]

  let moneyPct = moneyMax > 0 ? ((money / moneyMax) * 100).toFixed(0) + "%" : ""
  let moneyString =
    moneyMax > 0 ? ns.formatNumber(money, 2).padStart(8) : "".padStart(8)
  let moneyColor = pctColor(money / moneyMax)
  let maxMoneyString =
    moneyMax > 0 ? ns.formatNumber(moneyMax, 2).padStart(8) : "".padStart(8)

  let secPct = (sec - secMin) / (99 - secMin)
  let secColor = pctColor(1 - secPct)

  let line1 = [
    { color: "white", text: " " + server },
    {
      color: moneyMax > 0 ? moneyColor : "Grey",
      text:
        moneyString +
        (moneyMax > 0 ? "/" : " ") +
        maxMoneyString +
        moneyPct.padStart(5),
    },
    {
      color: secColor,
      text: moneyMax > 0 ? (sec - secMin).toFixed(2).padStart(6) : "".padEnd(6),
    },
  ]

  let data = []
  data.push(line1)
  PrintTable(ns, data, table1_columns, DefaultStyle(), ns.print)

  const table2_columns = [
    { header: " Sec", width: 7 },
    { header: " MinSec", width: 8 },
    { header: " Weaken", width: 10 },
    { header: " Grow", width: 10 },
    { header: " Hack", width: 10 },
  ]

  data = []
  line1 = [
    {
      color: secColor,
      text: moneyMax > 0 ? (sec - secMin).toFixed(2).padStart(6) : "".padEnd(6),
    },
    {
      color: "white",
      text: " " + Math.round(secMin).toString().padStart(4),
    },
    {
      color: "white",
      text: " " + FormatTime(ns.getWeakenTime(server)),
    },
    {
      color: "white",
      text: " " + FormatTime(ns.getGrowTime(server)),
    },
    {
      color: "white",
      text: " " + FormatTime(ns.getHackTime(server)),
    },
  ]
  let line2 = [
    "",
    "",
    { color: "white", text: " (t=" + weakenThreads + ")" },
    { color: "white", text: " (t=" + growThreads + ")" },
    { color: "white", text: " (t=" + hackThreads + ")" },
  ]
  data.push(line1)
  data.push(line2)
  PrintTable(ns, data, table2_columns, DefaultStyle(), ns.print)
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

// This function waits for one (or an array of) PID to stop running
export async function _WaitPids(ns, pids, expectedTime = 0) {
  // first wait for the bulk of time in a single asleep
  // await ns.asleep(expectedTime * 1000)
  if (!Array.isArray(pids)) pids = [pids]
  for (;;) {
    let stillRunning = false
    for (const pid of pids) {
      const process = ns.getRunningScript(pid)
      if (process != undefined) {
        stillRunning = true
        await ns.asleep(50)
        break
      }
      await ns.asleep(50)
    }
    if (!stillRunning) return
    await ns.asleep(50)
  }
}


async function _RunScript(ns, scriptName, threads, params = []) {
  // target
  let target = params[0]

  // Find all servers
  const allServers = RecursiveScan(ns)

  // Sort by maximum memory
  allServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a))

  // Find script RAM usage
  const ramPerThread = ns.getScriptRam(scriptName)

  // Find usable servers
  const usableServers = allServers.filter(
    (p) => ns.hasRootAccess(p) && ns.getServerMaxRam(p) > 0
  )

  // Fired threads counter
  let fired = 0
  const pids = []

  for (const server of usableServers) {
    // Determin how many threads we can run on target server for the given script
    let availableRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    if (server == "home") {
      availableRam -= MIN_HOME_RAM
      if (availableRam < 0) availableRam = 0
    }
    let possibleThreads = Math.floor(availableRam / ramPerThread)

    // Check if server is already at max capacity
    if (possibleThreads <= 0) continue

    // Lower thread count if we are over target
    if (possibleThreads > threads - fired) possibleThreads = threads - fired

    // Copy script to the server if it's not the current
    if (server != ns.getHostname()) await ns.scp(scriptName, server)

    // Fire the script with as many threads as possible
    ns.print(
      "INFO:" +
        target +
        ": Starting script " +
        scriptName +
        " on " +
        server +
        " with " +
        possibleThreads +
        " threads"
    )
    let pid = ns.exec(scriptName, server, possibleThreads, target)
    if (pid == 0)
      ns.print(
        "WARN:" +
          target +
          ": Could not start script " +
          scriptName +
          " on " +
          server +
          " with " +
          possibleThreads +
          " threads"
      )
    else {
      fired += possibleThreads
      pids.push(pid)
      if (pids.length >= MAX_PIDS) {
        break // TRY FIX FREEZING - only run on a single server for now.
      }
    }

    if (fired >= threads) break
  }

  if (fired == 0) {
    ns.print(
      "FAIL: Not enough memory to launch a single thread of " +
        scriptName +
        " (out of memory on all servers!)"
    )
  }
  if (threads != Infinity && fired != threads) {
    ns.print(
      "FAIL: There wasn't enough ram to run " +
        threads +
        " threads of " +
        scriptName +
        " (fired: " +
        fired +
        "). It is recommended to either reduce the hack percentage or reduce memory usage from other scripts."
    )
  }

  return { pids, fired, threads }
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

