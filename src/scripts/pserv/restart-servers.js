/** @param {NS} ns */
export async function main(ns) {
  
  let hack_script = "/scripts/hack/early-hack-template.js"
  let target = "neo-net"

  // accept a target as first arg
  if (ns.args.length > 0) {
    target = ns.args[0];
  }
  
  let servers = ns.getPurchasedServers();

  for (let server_name of servers) {
    ns.scp(hack_script, server_name);
    ns.killall(server_name)
    ns.exec(hack_script, server_name, 3, target);
    await ns.sleep(100);
  }

  ns.tprint(servers.length + " servers restarted with target " + target + ".")
}