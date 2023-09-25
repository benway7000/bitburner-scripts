import { ServerCrawler } from 'scripts/lib/index'

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

  let server_crawler_action = get_best_hack_target(ns, start, max_depth)
  report(ns, server_crawler_action) 
}

export function get_best_hack_target(ns, start, max_depth) {
  // from docs
  // As a rule of thumb, your hacking target should be the Server with highest max money that's required hacking level is under 1/2 of your hacking level.

  let crawler = new ServerCrawler(ns, max_depth)
  // create server_crawler_action object
  // add some fields for storing state
  let server_crawler_action = {
    player_hack: Math.max(ns.getHackingLevel(),100),  // min 100 because we can hit that fast (can we?)
    money_format: money_format, // helper func
    highest_money_found: -1,
    highest_server_found: "",
    // bind action function
    // action: action_find_max_money.bind(this, ns)
    action(ns, server_name) {
      let server_max_money = ns.getServerMaxMoney(server_name)
      let server_req_hack = ns.getServerRequiredHackingLevel(server_name)
      if (server_req_hack < (this.player_hack/2)) {
        if (server_max_money > this.highest_money_found) {
          // we have a new best
          this.highest_money_found = server_max_money
          this.highest_server_found = server_name
          ns.tprint("New best: " + this.highest_server_found + " : " + this.money_format(this.highest_money_found))
        }
      }
    }
  }

  crawler.start_crawl(start, server_crawler_action)

  return server_crawler_action
}

function report(ns, server_crawler_action) {
  let server_name = server_crawler_action.highest_server_found
  ns.tprint("Best Hacking Target: " + server_name)
  ns.tprint("\tMax Money: " + money_format(server_crawler_action.highest_money_found))
  ns.tprint("\tMin Sec: " + ns.getServerMinSecurityLevel(server_name))
  ns.tprint("\tReq Hack: " + ns.getServerRequiredHackingLevel(server_name))
  ns.tprint("\tPorts Req: " + ns.getServerNumPortsRequired(server_name))
}

// function action_find_max_money(ns, server_name) {
//     let server_max_money = ns.getServerMaxMoney(server_name)
//     let server_req_hack = ns.getServerRequiredHackingLevel(server_name)
//     if (server_req_hack < (this.player_hack/2)) {
//       if (server_max_money > this.highest_money_found) {
//         // we have a new best
//         this.highest_money_found = server_max_money
//         this.highest_server_found = server_name
//         ns.tprint("New best: " + this.highest_server_found + " : " + this.money_format(this.highest_money_found))
//       }
//     }
//     return {highest_server_found: highest_server_found, highest_money_found: highest_money_found }
// }

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

