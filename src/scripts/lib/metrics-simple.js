import { HasFormulas } from 'scripts/lib/utils'

const FORCED_HACK_LEVEL = undefined;

/** @param {NS} ns */
export async function main(ns) {
  let top_hack_target = GetTopHackServers(ns)[0].name
  ns.tprint("top_hack_target is " + top_hack_target)
  ns.tprint("top ten: \n" + GetTopHackServers(ns))
}

export function GetTopHackServers(ns, count = 10) {
  let servers = GetAllServers(ns)

  servers = servers
    .filter((s) => ns.hasRootAccess(s.name) && ns.getServerMaxMoney(s.name) > 0)
    .sort(
      (a, b) =>
        ns.getServerMaxMoney(b.name) -
        ns.getServerMaxMoney(a.name) /*Weight(ns, b.name) - Weight(ns, a.name)*/
    )

  let sorted_by_weight = servers
    .filter((s) => Weight(ns, s.name) > 0)
    .sort((a, b) => Weight(ns, b.name) - Weight(ns, a.name))

  if (sorted_by_weight.length > count) {
    return sorted_by_weight.slice(0, count)
  } else {
    return sorted_by_weight
  }
}

export function GetAllServers(ns, root = 'home', found = new Array(), route = new Array()) {
	if (!found.find(p => p.name == root)) {
		let entry = { name: root, route: route };
		entry.route.push(root);
		found.push(entry);
	}

	for (const server of ns.scan(root)) {
		if (!found.find(p => p.name == server)) {
			let newRoute = route.map(p => p);
			GetAllServers(ns, server, found, newRoute);
		}
	}

	return [...found];
}

// Returns a weight that can be used to sort servers by hack desirability
function Weight(ns, server) {
  if (!server) return 0

  // Don't ask, endgame stuff
  if (server.startsWith("hacknet-node")) return 0

  // Get the player information
  let player = ns.getPlayer()
  if (FORCED_HACK_LEVEL != undefined) player.skills.hacking = FORCED_HACK_LEVEL

  // Get the server information
  let so = ns.getServer(server)

  // Set security to minimum on the server object (for Formula.exe functions)
  so.hackDifficulty = so.minDifficulty

  // We cannot hack a server that has more than our hacking skill so these have no value
  if (so.requiredHackingSkill > player.skills.hacking) return 0

  // Default pre-Formulas.exe weight. minDifficulty directly affects times, so it substitutes for min security times
  let weight = so.moneyMax / so.minDifficulty

  // If we have formulas, we can refine the weight calculation
  if (HasFormulas(ns)) {
    // We use weakenTime instead of minDifficulty since we got access to it,
    // and we add hackChance to the mix (pre-formulas.exe hack chance formula is based on current security, which is useless)
    weight =
      (so.moneyMax / ns.formulas.hacking.weakenTime(so, player)) *
      ns.formulas.hacking.hackChance(so, player)
  }
  // If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
  else if (
    so.requiredHackingSkill > player.skills.hacking / 2 &&
    server != "n00dles"
  )
    return 0

  return weight
}
