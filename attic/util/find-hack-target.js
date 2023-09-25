/** @param {NS} ns */
export async function main(ns) {

  var max_depth = 5;
  var start = "home";

  if (ns.args.length > 0) {
    max_depth = ns.args[0];
  }
  if (ns.args.length > 1) {
    start = ns.args[1];
  }

  ns.tprint("Finding hack target up to depth " + max_depth + " starting with server " + start + ".");

  // from docs
  // As a rule of thumb, your hacking target should be the Server with highest max money that's required hacking level is under 1/2 of your hacking level.

  var highest_money_found = -1;
  var highest_server_found = "";
  var player_hack = ns.getHackingLevel();

  async function crawl_server(ns, server_name, depth) {
    if (server_name.startsWith("pserv")) {
      // ignore player-servers
      return
    }
    if (server_name === "home" && depth > 0) {
      // "home" is reported in scans for all(?) servers; ignore it
      return
    }
    ns.tprint("crawl_server: " + server_name)
    let server_max_money = ns.getServerMaxMoney(server_name)
    let server_req_hack = ns.getServerRequiredHackingLevel(server_name)
    if (server_req_hack < (player_hack/2)) {
      if (server_max_money > highest_money_found) {
        // we have a new best
        highest_money_found = server_max_money
        highest_server_found = server_name
        ns.tprint("New best: " + highest_server_found + " : " + money_format(highest_money_found))
      }
    }
    if (depth < max_depth) {
      let children = ns.scan(server_name);
      for (let child_name of children) {
        // ns.tprint("Would recurse into " + child_name)
        // await ns.sleep(500);
        crawl_server(ns, child_name, depth+1)
      }
    }
  }

  crawl_server(ns, start, 0)

  ns.tprint("Best Hacking Target: " + highest_server_found)
  ns.tprint("\tMax Money: " + money_format(highest_money_found))
  ns.tprint("\tMin Sec: " + ns.getServerMinSecurityLevel(highest_server_found))
  ns.tprint("\tReq Hack: " + ns.getServerRequiredHackingLevel(highest_server_found))
  ns.tprint("\tPorts Req: " + ns.getServerNumPortsRequired(highest_server_found))


  // let server_names = ns.scan(start); // returns: ["foodnstuff", "sigma-cosmetics", "joesguns", "hong-fang-tea", "harakiri-sushi", "iron-gym"]

  // // remove pserv's
  // server_names = server_names.filter( (el) => !el.startsWith("pserv"));

  // ns.tprint(server_names)

  // let servers = {}
  // for (let server_name of server_names) {
  //   let server_max_money = ns.getServerMaxMoney(server_name)
  //   let server_req_hack = ns.getServerRequiredHackingLevel(server_name)
  //   if (server_req_hack < (player_hack/2)) {
  //     if (server_max_money > highest_money_found) {
  //       // we have a new best
  //       highest_money_found = server_max_money
  //       highest_server_found = server_name
  //     }
  //   }

  // }

  //   servers[server_name] = {
  //     "root": ns.hasRootAccess(server_name),
  //     "required_hack": ns.getServerRequiredHackingLevel(server_name),
  //     "min_security": ns.getServerMinSecurityLevel(server_name),
  //     "ports_required": ns.getServerNumPortsRequired(server_name),
  //     "max_money": money_format(ns.getServerMaxMoney(server_name))
  //   }

  // ns.tprint(servers)

}



function money_format(money) {
  if (money > 10**9) {
    return money/10**9 + "b"
  } else if (money > 10**6) {
    return money/10**6 + "m"
  } else if (money > 10**3) {
    return money/10**3 + "k"
  }
  return money + ""
}

// junk

  // ns.tprint("┗ " + start)

  // let indent = "  "  // 2 spaces
  // let indent_stat = "   " // 3 spaces - for server details
  // let end_of_depth = "┗"
  // let more_of_depth = "┃"
  // let middle_node = "┣"


// spacing
// start
//┗ name
// depth 1 with no children
//  ┃   name
// character for more
//┣
// depth 1 with child
//  ┃ ┃   name
// last depth 1
//  ┗ name