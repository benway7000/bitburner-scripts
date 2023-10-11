import { WaitPids, LogMessage, RunHomeSingletonScript } from "scripts/lib/utils"
import { GetSitRep } from "scripts/util/sitrep"
import { GetTopHackServers } from "scripts/lib/metrics-simple"
import { FracturedJson } from "scripts/lib/FracturedJson"

/*
Brainstorm of what's needed for a "main brain" script

- Get all the cracker programs ASAP and nuke everything we can as they become available
- Increase hacking level ASAP (using personal and sleeve study free or paid, xp script and/or batching)
- Increase home ram to a minimal level (for faster install recovery)
- Buy a few personal servers
- Run the casino script if we aren't banned
- Decide what's the best use for sleeves at any given time
	- Focus gang acquisition if gang isn't created yet
	- Reduce shock if shock > 95
	- Trail stats? Not sure? If money allows it might increase gang speed with easier homicides?
	- In some cases setting them on money making tasks might be best?
- Factions
	- Chose what factions to try getting into
	- Chose which one to focus (personal vs sleeves if they are free/makes sense)
	- Mesh with augs script to see what's best
	- Decide if/when we need to install/reset for favor depending on current faction focus
- Decide when to install/soft reset and do it
- Decide when to close the node and do it
- Check for coding contracts + solve
- Decide what servers to hack (using starter or manager as needed/allowed)
- Hacknet servers
	- Decide if/how much we want to invest (if at all)
	- Spend hashes on whatever makes the most sense given current situation
	- Install related augs if we are going to focus/invest in hacknet as a significant node strategy
- Stocks
	- Start stock market script if/when it makes sense
	- Stop it or ask it to release shares if we need the money it's holding (some priorities might call for that)
- Install backdoors when applicable/necessary
- Save money for corporation
	- We don't have a corp script yet so for now we're just focusing on amassing the 150b investment (if node strategy calls for it)
- Go to Chongqing and receive the gift ASAP if it makes sense (based on node multipliers)
*/

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL")
  ns.enableLog("exec")

  FracturedJson.InitializeFracturedJson()

  // Situation report script
  await TryRunScript(ns, "/scripts/util/sitrep.js")
  let sitrep = GetSitRep(ns)
  let karma = sitrep.karma
  let homeRamTotal = sitrep.ram.home

  // Check if we need to buy more port crackers
  // JEFF FIX TODO
  if (sitrep.portCrackers < 5) {
    // Buy programs, run programs, nuke
    await TryRunScript(ns, "/scripts/autostart/programs.js", [true])
  }

  if (
    sitrep.servers.some((s) => s.ports.open < s.ports.open.required) || // Check if we have servers who need cracking
    sitrep.servers.some((s) => s.ports.nuked == false)
  ) {
    // Check if we have servers that need nuking
    // Buy programs, run programs, nuke
    await TryRunScript(ns, "/scripts/autostart/breach.js", [true])
  }

  // contracts
  await TryRunScript(ns, "/scripts/contracts/SolveContract.js", [])

  // if (sitrep.servers.some(s => s.contracts.length > 0)) {
  // 	// Solve contracts
  // 	await TryRunScript(ns, 'contractPrep.js', [true]);
  // 	await TryRunScript(ns, 'solver.js', [true]);
  // }

  // Donate money
  // await TryRunScript(ns, 'donate.js');

  // Buy personal server(s)
  // await TryRunScript(ns, 'budget.js', ['silent']);
  // let budget = sitrep.ramBudget ?? 0;
  // //ns.tprint('INFO: Ram budget is ' + ns.nFormat(budget, '0.000a'));
  // ns.print('INFO: Ram budget is ' + ns.formatRam(budget, 3));
  // await TryRunScript(ns, 'buyserver.js', ['upgrade', 'silent']);

  // Save work reputation to it's faction
  //await TryRunScript(ns, 'SaveRep.js');

  const BACKDOOR_TARGETS = [
    "CSEC",
    "I.I.I.I",
    "avmnite-02h",
    "run4theh111z",
    "nwo",
    "omnitek",
    "clarkinc",
    "4sigma",
    "b-and-a",
    //'w0r1d_d43m0n',
    // 'millenium-fitness',
    // 'powerhouse-fitness',
    // 'crush-fitness',
    // 'snap-fitness'
  ]

  if (
    sitrep.servers.some(
      (s) =>
        BACKDOOR_TARGETS.includes(s.name) &&
        s.ports.backdoored == false &&
        s.difficulty.current >= s.difficulty.required
    )
  ) {
    // Install backdoors
    await TryRunScript(ns, "/scripts/autostart/backdoor.js", BACKDOOR_TARGETS)
    // RunHomeSingletonScript(ns, "/scripts/autostart/backdoor.js", 1, BACKDOOR_TARGETS)
  }

  // purchase servers, after programs are bought
  if (sitrep.portCrackers >= 5 && ns.getPurchasedServers().length < ns.getPurchasedServerLimit()) {
    await TryRunScript(ns, "/scripts/pserv/purchase-server.js")
  }

  // Farm XP for a bit
  // TODO need singularity to make this not keep re-clicking it
  if (ns.getPlayer().skills.hacking < 100) {
    // RunHomeSingletonScript(ns, "/scripts/autostart/study.js", 1, ["silent"])
    await TryRunScript(ns, "/scripts/autostart/study.js", ["silent"])
  }


  RunHomeSingletonScript(ns, "/scripts/hack/batch/batcher.js", 1, ["auto"])

  // xp is after hack for low-ram situations - TODO something better
  // run xp on joesguns

  RunHomeSingletonScript(ns, "/scripts/hack/xp/xp.js", 1, ["auto"])


  ns.print("")

  // run again in 10s
  ns.spawn("/scripts/autostart/autostart_lowram.js")
}


export async function TryRunScript(ns, script, params = []) {
  const pids = ns.run(script, 1, ...params)
  await WaitPids(ns, pids)
  if (pids.length == 0) {
    ns.tprint("WARN: Not enough ram to run " + script)
  } else ns.print("INFO: Started " + script + " with params [" + params + "]")
}
