/** @param {NS} ns */
export async function main(ns) {

  var depth = 1;
  var start = "home";

  if (ns.args.length > 0) {
    depth = ns.args[0];
  }
  if (ns.args.length > 1) {
    start = ns.args[1];
  }

  ns.tprint("Scanning at depth " + depth + " starting with server " + start + ".");

  let server_names = ns.scan(start); // returns: ["foodnstuff", "sigma-cosmetics", "joesguns", "hong-fang-tea", "harakiri-sushi", "iron-gym"]

  // remove pserv's
  server_names = server_names.filter( (el) => !el.startsWith("pserv"));

  ns.tprint(server_names)

  let servers = {}
  for (let server_name of server_names) {
    servers[server_name] = {
      "root": ns.hasRootAccess(server_name),
      "required_hack": ns.getServerRequiredHackingLevel(server_name),
      "min_security": ns.getServerMinSecurityLevel(server_name),
      "ports_required": ns.getServerNumPortsRequired(server_name),
      "max_money": money_format(ns.getServerMaxMoney(server_name))
    }
  }

  ns.tprint(servers)

}

function money_format(money) {
  if (money > 10**9) {
    return money/10**9 + "b"
  } else if (money > 10**6) {
    return money/10**6 + "m"
  } else if (money > 10**3) {
    return money/10**3 + "k"
  }
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