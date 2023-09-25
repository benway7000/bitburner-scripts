/** @param {NS} ns */
export async function main(ns) {
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  const ram = 8;

  let hack_script = "/scripts/hack/early-hack-template.js"
  let target = "neo-net"
  // accept a target as first arg
  if (ns.args.length > 0) {
    target = ns.args[0];
  }

  // Iterator we'll use for our loop
  let i = ns.getPurchasedServers().length;

  ns.print("Purchased " + i + " servers already.")
  
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  while (i < ns.getPurchasedServerLimit()) {
    // Check if we have enough money to purchase a server

    let cost = ns.getPurchasedServerCost(ram);

    if (ns.getServerMoneyAvailable("home") > cost) {
      // If we have enough money, then:
      //  1. Purchase the server
      //  2. Copy our hacking script onto the newly-purchased server
      //  3. Run our hacking script on the newly-purchased server with 3 threads
      //  4. Increment our iterator to indicate that we've bought a new server
      let hostname = ns.purchaseServer("pserv-" + i, ram);
      ns.scp(hack_script, hostname);
      ns.exec(hack_script, hostname, 3, target);
      ++i;
      ns.print("Purchased server " + hostname + " with " + ram + "GB for $" + cost)
    }
    //Make the script wait for a second before looping again.
    //Removing this line will cause an infinite loop and crash the game.
    await ns.sleep(1000);
  }
}