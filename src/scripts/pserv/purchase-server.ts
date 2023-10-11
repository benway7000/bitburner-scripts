import { NS } from '@ns';
import { HasSingularity } from 'scripts/lib/utils';


/** @param {NS} ns */
export async function main(ns:NS) {


  /**
   * scripts/util/sandbox.js: 2**0 (1.00GB) == $55.000k
scripts/util/sandbox.js: 2**1 (2.00GB) == $110.000k
scripts/util/sandbox.js: 2**2 (4.00GB) == $220.000k
scripts/util/sandbox.js: 2**3 (8.00GB) == $440.000k
scripts/util/sandbox.js: 2**4 (16.00GB) == $880.000k
scripts/util/sandbox.js: 2**5 (32.00GB) == $1.760m
scripts/util/sandbox.js: 2**6 (64.00GB) == $3.520m
scripts/util/sandbox.js: 2**7 (128.00GB) == $8.448m
scripts/util/sandbox.js: 2**8 (256.00GB) == $20.275m
scripts/util/sandbox.js: 2**9 (512.00GB) == $48.660m
scripts/util/sandbox.js: 2**10 (1.02TB) == $116.785m
scripts/util/sandbox.js: 2**11 (2.05TB) == $280.284m
scripts/util/sandbox.js: 2**12 (4.10TB) == $672.682m
scripts/util/sandbox.js: 2**13 (8.19TB) == $1.614b
scripts/util/sandbox.js: 2**14 (16.38TB) == $3.875b
scripts/util/sandbox.js: 2**15 (32.77TB) == $9.299b
scripts/util/sandbox.js: 2**16 (65.54TB) == $22.318b
   */
  // How much RAM each purchased server will have.
  // const ram = 2**11; // 2**11 = 2 TB
  // const ram = 2**9; // 2**9 = 512 GB
  const ram = getRamToBuy(ns)

  // Iterator we'll use for our loop
  let i = ns.getPurchasedServers().length;

  ns.print("Purchased " + i + " servers already.")
  
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  if (i < ns.getPurchasedServerLimit()) {
    // Check if we have enough money to purchase a server

    let cost = ns.getPurchasedServerCost(ram);

    if (ns.getServerMoneyAvailable("home") > cost) {
      // If we have enough money, then:
      //  1. Purchase the server
      let hostname = ns.purchaseServer("pserv-" + i, ram);
      ++i;
      ns.print("Purchased server " + hostname + " with " + ram + "GB for $" + cost)
    }
  }
}

function getRamToBuy(ns:NS) {
  if (HasSingularity(ns)) {
    if (ns.singularity.getOwnedAugmentations().length > 0) {
      // we have some augs so we can make some $$$
      return 2**11 // 2**11 = 2 TB
    }
  }
  return 2**9 // 2**9 = 512 GB
}