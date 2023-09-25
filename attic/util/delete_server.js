/** @param {NS} ns */
export async function main(ns) {

  var server_to_delete = "pserv-1-0";

  ns.killall(server_to_delete);
  return ns.deleteServer(server_to_delete);
}