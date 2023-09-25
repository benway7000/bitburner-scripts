import { GetTopHackServers } from "scripts/lib/metrics-simple"
import {
  pctColor,
  PrintTable,
  DefaultStyle,
  ColorPrint,
} from "scripts/lib/tables"

const SCRIPT_NAME = "batch_v1"
const SCRIPT_PATH = "/scripts/hack/batch/" + SCRIPT_NAME

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_PCT = 0.5 // This is the default 1-based percentage of money we want to hack from the server in a single pass
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
  getCurrentTargets: function (ns) {
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
  getConfigJSON: function (ns) {
    return {
      loopDelay: this.loopDelay,
      currentTargets: this.getCurrentTargets(ns),
      addTargets: this.addTargets,
      serverStates: this.serverStates,
    }
  },
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
      StartFullCycle(ns, new_target, pct, mode == "xp")
    }
    ns.write(
      "/data/hack.txt",
      JSON.stringify(config.getConfigJSON(ns), null, 2),
      "w"
    )
    await ns.asleep(config.loopDelay)
  }
}

async function StartFullCycle(ns, server, pct, xpMode) {
  return PrepServer(ns, server, pct, xpMode).then((prepResult) => {
    return (
      RunBatch(ns, server, pct, xpMode, prepResult),
      (err) => {
        ns.print("StartFullCycle err:" + err)
      }
    )
  })

  let promise = new Promise((resolve, reject) => {
    PrepServer(ns, server, pct, xpMode, resolve)
  })
    .then((val) => {
      return new Promise((resolve, reject) => {
        RunBatch(ns, server, pct, xpMode, val, resolve)
      })
    })
    .then(
      (val) => {
        return CycleCallback(ns, server, pct, xpMode, val)
      },
      (err) => {
        ns.print("StartFullCycle err:" + err)
      }
    )
  setServerState(server, "promise", promise)
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

async function CycleCallback(ns, server, pct, xpMode, result) {
  if (getServerState(server, "stop") === true) {
    ns.print("server " + server + " received flag to stop")
    setServerState(server, "promise", null)
    return "stopped"
  }
  // TODO: calc adjustments
  // if (result.phase == "grow" && getServerState(server, "hasHacked")) {
  //   if (result.grow_mem_report.used / result.grow_mem_report.total < 0.85) {
  //     // grow is using less than 85% so add more
  //     ns.print(result.server + ": add_target")
  //     AddTarget(ns)
  //   } else if (result.threads != Infinity && result.fired != result.threads) {
  //     // Infinity is used in xpMode; do not reduce
  //     // could not fire all the desired threads, should reduce
  //     ns.print(result.server + ": rm_target")
  //     RemoveTarget(ns)
  //   }
  // }
  return StartFullCycle(ns, server, pct, xpMode)
}

async function PrepServer(ns, server, pct, xpMode) {
  return new Promise(function (resolve, reject) {})
}

async function RunBatch(ns, server, pct, xpMode, prepResult) {
  return new Promise(function (resolve, reject) {})
}

async function Exploit(ns, server, pct, xpMode, resolve) {
  if (xpMode) server = "joesguns"

  let phase = "unknown"
  let pids = [],
    fired = 0,
    threads = 0,
    grow_mem_report = {}

  const {
    weakenTime,
    growTime,
    hackTime,
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec,
  } = CalcExploitTimesThreadsMoneySec(ns, server, pct, xpMode)

  ExploitReportTable(
    ns,
    server,
    weakenThreads,
    growThreads,
    hackThreads,
    money,
    maxMoney,
    sec,
    minSec
  )

  if (weakenThreads || growThreads || xpMode) {
    // needs prep
  } else {
    // do a batch of HGW
  }

  // Check if security is above minimum
  if ((xpMode || sec > minSec + MAX_SECURITY_DRIFT) && weakenThreads > 0) {
    // We need to lower security
    ns.print(
      "WARN:" +
        server +
        ": ***WEAKENING*** Security is over threshold, we need " +
        weakenThreads +
        " threads to floor it"
    )
    phase = "weaken"
    threads = weakenThreads
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "weaken.js",
      server,
      weakenThreads
    ))
    let expectedTime = ns.getWeakenTime(server)
    ns.print(
      "INFO:" +
        server +
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
        server +
        ": ***GROWING*** Money is getting low, we need " +
        growThreads +
        " threads to max it"
    )
    phase = "grow"
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "grow.js",
      server,
      growThreads
    ))

    grow_mem_report = MemoryReport(ns, server)

    let expectedTime = ns.getGrowTime(server)
    ns.print(
      "INFO:" +
        server +
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
        server +
        ": ***HACKING*** Server is ripe for hacking, hitting our target would require " +
        hackThreads +
        " threads"
    )
    phase = "hack"
    threads = hackThreads
    ;({ pids, fired, threads } = await RunScript(
      ns,
      SCRIPT_NAME + "hack.js",
      server,
      hackThreads
    ))

    let expectedTime = ns.getHackTime(server)
    ns.print(
      "INFO:" +
        server +
        ": Waiting for hack script completion (approx " +
        ns.tFormat(expectedTime) +
        "). pids == " +
        pids
    )
    await WaitPids(ns, pids, expectedTime)
    setServerState(server, "hasHacked", true)
  }

  let result = { server, phase, fired, threads, grow_mem_report }
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
      text: " " + formatTime(ns.getWeakenTime(server)),
    },
    {
      color: "white",
      text: " " + formatTime(ns.getGrowTime(server)),
    },
    {
      color: "white",
      text: " " + formatTime(ns.getHackTime(server)),
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

/**
 *
 * @param {*} time in msec
 * @returns mm:ss
 */
function formatTime(time) {
  let seconds = (time / 1000) % 60
  let minutes = Math.floor(time / 1000 / 60)
  return (
    (minutes > 0 ? minutes.toFixed(0).padStart(2, "0") + ":" : "00:") +
    (seconds > 0 ? seconds.toFixed(0).padStart(2, "0") : "00")
  )
}

function CalcExploitTimesThreadsMoneySec(ns, server, pct, xpMode) {
  // Security
  const minSec = ns.getServerMinSecurityLevel(server)
  const sec = ns.getServerSecurityLevel(server)
  let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))
  let weakenTime = ns.getWeakenTime(server)

  // Money
  let money = ns.getServerMoneyAvailable(server)
  if (money <= 0) money = 1 // division by zero safety
  const maxMoney = ns.getServerMaxMoney(server)
  let growThreads = Math.ceil(
    ns.growthAnalyze(server, (GROW_THREAD_MULT * maxMoney) / money)
  )
  let growTime = ns.getGrowTime(server)

  // Hacking (limited by pct)
  let hackThreads = Math.floor(ns.hackAnalyzeThreads(server, money * pct))
  let hackTime = ns.getHackTime(server)

  if (xpMode) {
    if (weakenThreads > 0) weakenThreads = Infinity
    growThreads = Infinity
    hackThreads = 0
  }

  let result = {
    weakenTime,
    growTime,
    hackTime,
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
