var servers_scanned = []
var servers_scripting = []
var already_crawled = []
var max_depth = 5;
  
/** @param {NS} ns */
export async function main(ns) {
  reset()
  let hack_script = "/scripts/hack/early-hack-template.js"
  let start = "home"
  let target = "neo-net"
  // accept a max_depth as first arg
  if (ns.args.length > 0) {
    max_depth = ns.args[0];
  }
  // accept a target as second arg
  if (ns.args.length > 1) {
    target = ns.args[1];
  }

  ns.disableLog("getServerNumPortsRequired")
  ns.disableLog("getServerMaxRam")
  ns.disableLog("scan")
  

  let num_ports_can_hack = get_num_ports_can_hack(ns)
  let num_ports_hacked = -1

  // first start hacking on home
  ns.print("Startup begins at home. target == " + target)
  let result = try_run_scripts_on_home(ns, hack_script, target)
  ns.print("home hack result: " + result)

  ns.print("Startup begins: max_depth == " + max_depth + ". target == " + target)
  ns.tprint("Startup begins: max_depth == " + max_depth + ". target == " + target)

  while (num_ports_can_hack < 6) {
    if (num_ports_can_hack > num_ports_hacked) {
      ns.print("New number of ports that can be hacked: " + num_ports_can_hack)
      reset(max_depth)
      num_ports_hacked = num_ports_can_hack
      // server_name must be passed to this bound func
      let action = try_run_scripts_on_server.bind(null, ns, hack_script, target, num_ports_can_hack)
      crawl_server_tree(ns, start, action)
      ns.print("Complete hack scan for ports up to " + num_ports_hacked + ". Servers scripting: " + servers_scripting)
    }
    await ns.sleep(60000)
    num_ports_can_hack = get_num_ports_can_hack(ns)
  }

  ns.print("Startup complete.")
  ns.tprint("Startup complete.")
}


function reset(max_depth) {
  servers_scanned = []
  servers_scripting = []
  max_depth = max_depth;
}

export function crawl_server_tree(ns, server_name, action_func, cur_depth = 0) {
    if (server_name.startsWith("pserv")) {
      // ignore player-servers
      return
    }
    if (server_name === "home" && cur_depth > 0) {
      // "home" is reported in scans for all(?) servers; ignore it
      return
    }
    if (servers_scanned.includes(server_name)) {
      // already crawled this
      return
    }      
    // action
    // ns.tprint("crawl_server: " + server_name)
    servers_scanned.push(server_name)
    let result = action_func(server_name)
    if (result == "success") {
      servers_scripting.push(server_name)
    } else if (result.length > 0) {
      ns.print("Server " + server_name + " failed to start: " + result)
    }

    // recurse server tree
    if (cur_depth < max_depth) {
      let children = ns.scan(server_name);
      // ns.tprint("crawl_server: children of " + server_name + ": " + children)
      for (let child_name of children) {
        crawl_server_tree(ns, child_name, action_func, cur_depth+1)
      }
    }
}
  
export function try_run_scripts_on_server(ns, script, target, num_ports_can_hack, server_name) {
  if (server_name === "home") return ""
  let ports_required = ns.getServerNumPortsRequired(server_name)

  // check if we can open enough ports
  if (ports_required > num_ports_can_hack) return "cannot hack enough ports " + num_ports_can_hack + "/" + ports_required
  
  // check if hack already running
  let threads = get_threads_for_server(ns, server_name, script)
  if (threads == 0) {
    ns.print("try_run_scripts_on_server: threads == 0 for " + server_name)
    return "threads == 0 for " + server_name
  }
  if (ns.isRunning(script, server_name, target)) return "already running"

  // not running, we can open ports, so hack it
  ns.scp(script, server_name)
  // open ports
  open_ports(ns, server_name)
  ns.nuke(server_name)
  ns.killall(server_name) // kill any unexpected scripts
  let result = ns.exec(script, server_name, threads, target)
  ns.print("Running script " + script + " on server " + server_name + " with " + threads + " threads, target " + target + ". Result == " + (result>0))
  return "success"
}

export function try_run_scripts_on_home(ns, script, target) {
  let server_name = "home"
  // check if hack already running
  let threads = get_threads_for_server(ns, server_name, script)
  if (threads == 0) {
    ns.print("try_run_scripts_on_server: threads == 0 for " + server_name)
    return "threads == 0 for " + server_name
  }
  if (ns.isRunning(script, server_name, target)) return "already running"
  // not running, we can open ports, so hack it
  let result = ns.exec(script, server_name, threads, target)
  ns.print("Running script " + script + " on server " + server_name + " with " + threads + " threads, target " + target + ". Result == " + (result>0))
  return "success"
}

 
const CRACKS = [ 
  { file_name: "BruteSSH.exe", open: (ns, server_name) => ns.brutessh(server_name) }, 
  { file_name: "FTPCrack.exe", open: (ns, server_name) => ns.ftpcrack(server_name) }, 
  { file_name: "relaySMTP.exe", open: (ns, server_name) => ns.relaysmtp(server_name) }, 
  { file_name: "HTTPWorm.exe", open: (ns, server_name) => ns.httpworm(server_name) }, 
  { file_name: "SQLInject.exe", open: (ns, server_name) => ns.sqlinject(server_name) }, 
]

export function get_num_ports_can_hack(ns) {
  let num_ports_hackable = 0
  for (let crack of CRACKS) {
    if (ns.fileExists(crack.file_name)) {
      num_ports_hackable++
    }
  }
  return num_ports_hackable
}

/**
 * Assumes we can open enough ports
 */
export function open_ports(ns, server_name) {
  let ports_required = ns.getServerNumPortsRequired(server_name)
  for (let i = 0;i < ports_required; i++) {
    let crack = CRACKS[i]
    crack.open(ns, server_name)
  }
}

// export function get_num_ports_can_hack(ns) {
//   let port_openers = ["BruteSSH.exe", "FTPCrack.exe","relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"]

//   let num_ports_hackable = 0
//   for (let file of port_openers) {
//     if (ns.fileExists(file)) {
//       num_ports_hackable++
//     }
//   }
//   return num_ports_hackable
// }

export function get_threads_for_server(ns, server_name, script) {
  let max_ram = ns.getServerMaxRam(server_name)
  if (server_name == "home") max_ram = max_ram * 0.75
  let script_ram = ns.getScriptRam(script)

  return Math.floor(max_ram / script_ram)
}

// export function open_ports(ns, server_name) {
//   let ports_required = ns.getServerNumPortsRequired(server_name)
//   switch (ports_required) {
//     case 5:
//       ns.sqlinject(server_name)
//     case 4:
//       ns.httpworm(server_name)
//     case 3:
//       ns.relaysmtp(server_name)
//     case 2:
//       ns.ftpcrack(server_name)
//     case 1:
//       ns.brutessh(server_name)
//     default:
//   }
// }