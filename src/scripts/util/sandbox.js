import { GetTopHackServers } from "scripts/lib/metrics-simple"
import { formatTime } from "scripts/lib/utils"

const state = {
  stop: false,
}

const config = {
  loopDelay: 1000,
  state: {
    stop: false,
  },
  serverStates: {},
}

/** @param {NS} ns */
export async function main(ns) {
  // ns.tprint(ns.scan("n00dles"))
  // =========================================

  // for (let i = 0; i < 17; i++) {
  //   ns.tprint(
  //     "2**" + i + " (" +
  //       ns.formatRam(2 ** i) +
  //       ") == $" +
  //       ns.formatNumber(ns.getPurchasedServerCost(2 ** i) + 
  //       ".  $ / GB == " + ns.getPurchasedServerCost(2 ** i)/(2**i)) 
  //   )
  // }
  // =========================================

  // ns.tprint(ns.getPlayer())
  // =========================================

  // let targets = ns.args[0]
  // ns.tprint("targets is " + targets)

  // for (let target of targets) {
  //   ns.tprint("target is " + target)
  // }
  // =========================================

  // const createWardrobe = () => {
  //   let hat = 1
  //   let shorts = 5
  //   let jumper = 8
  //   let socks = 2
  //   let myWardrobe = {
  //     hat,
  //     shorts,
  //     jumper,
  //     socks,
  //   }

  //   return myWardrobe
  // }

  // ns.tprint(createWardrobe())

  // =========================================
  // let config = {
  //   addTargets: new Set()
  // }
  // // /** returns the next-best target, excluding the passed-in targets */
  // function GetNextExploitTargets(ns, num_new_targets, targets = []) {
  //   let top_targets = GetTopHackServers(ns, num_new_targets + targets.length)
  //   let possible_targets = top_targets.filter((t) => !targets.includes(t.name))
  //   // ns.print("possible_targets[0]: " + possible_targets[0].name)
  //   if (possible_targets.length > num_new_targets) {
  //     return possible_targets.slice(0, num_new_targets).map(t => t.name)
  //   } else {
  //     return possible_targets.map(t => t.name)
  //   }
  // }

  // let targets = ["omega-net"]
  // let num_new_targets = 10
  // let start_targets = GetNextExploitTargets(ns, num_new_targets, targets)
  // ns.tprint(start_targets)
  // start_targets.forEach(target => config.addTargets.add(target))
  // config.addTargets.forEach(target => ns.tprint(target))
  // ns.tprint(config.addTargets)
  // =========================================

  // function setServerState(server, key, value) {
  //   let serverState = config.serverStates[server]
  //   if (serverState == undefined) {
  //     config.serverStates[server] = serverState = {}
  //   }
  //   serverState[key] = value
  // }

  // function getServerState(server, key) {
  //   return config.serverStates?.[server]?.[key] ?? null
  // }

  // setServerState("foo", "key1", "value1")
  // ns.tprint(getServerState("foo","key1"))
  // ns.tprint(getServerState("foo","key2"))
  // =========================================
  // ns.tprint(ns.hasTorRouter())
  // =========================================
  // function formatTime(time) {
  //   let seconds = time / 1000 % 60;
  //   let minutes = Math.floor(time / 1000 / 60);
  //   return (minutes > 0 ? minutes.toFixed(0).padStart(2,"0") + ':' : '00:') + (seconds > 0 ? seconds.toFixed(0).padStart(2,"0") : "00");
  // }
  // ns.tprint(formatTime(ns.getWeakenTime("iron-gym")))
  // =========================================
  // ns.tprint(ns.getServerMaxRam("home"))
  // =========================================
  // let server = "joesguns"
  // const minSec = ns.getServerMinSecurityLevel(server)
  // const sec = ns.getServerSecurityLevel(server)
  // let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))
  // ns.tprint(weakenThreads)
  // =========================================
  // let script = "/scripts/hack/loop_hack/v4.js"
  // ns.tprint(script.replace(/^\//, ""))
  // =========================================
  // let time = 123456
  // ns.tprint("ns.tFormat: " + ns.tFormat(time))
  // ns.tprint("formatTime: " + formatTime(time))
  // =========================================
  // ns.tprint(ns.ps("home"))
  // =========================================
  // ns.tprint(ns.singularity.getUpgradeHomeRamCost())
  // =========================================
  // ns.tprint(ns.getPlayer().skills.hacking)
  // =========================================
  // let list = ["foo", "bar", "baz"]
  // ns.tprint(list.slice(-1)) // [baz]
  // ns.tprint(list.slice(-2)) // [bar, baz]
  // ns.tprint(list.slice(-2, -1)) // [bar]
  // =========================================
  let current_targets = [
    "silver-helix",
    "phantasy",
    "joesguns"
  ]
  current_targets = current_targets.filter(t => t != "joesguns")
  ns.tprint(current_targets)
  // =========================================
  // =========================================
  // =========================================
  // =========================================
}
