import { HasFormulas, Weight } from "scripts/lib/utils"

const FORCED_HACK_LEVEL = undefined

/** @param {NS} ns */
export async function main(ns) {
  let top_hack_target = GetTopHackServers(ns)[0].name
  ns.tprint("top_hack_target is " + top_hack_target)
  ns.tprint("top ten: \n" + GetTopHackServers(ns))
}

export function GetTopHackServers(ns, count = 10) {
  let servers = GetAllServers(ns)
  servers.map((server) => (server.weight = Weight(ns, server.name)))

  servers = SortServerListByTopHacking(
    ns,
    servers.filter(
      (s) =>
        ns.hasRootAccess(s.name) &&
        ns.getServerMaxMoney(s.name) > 0 &&
        s.weight > 0
    )
  )

  if (servers.length > count) {
    return servers.slice(0, count)
  } else {
    return servers
  }
}

export function SortServerListByTopHacking(ns, servers) {
  return servers
    .sort((a, b) => b.weight - a.weight)
    .sort((a, b) => ns.getServerMaxMoney(b.name) - ns.getServerMaxMoney(a.name))
}

export function GetAllServers(
  ns,
  root = "home",
  found = new Array(),
  route = new Array()
) {
  if (!found.find((p) => p.name == root)) {
    let entry = { name: root, route: route }
    entry.route.push(root)
    found.push(entry)
  }

  for (const server of ns.scan(root)) {
    if (!found.find((p) => p.name == server)) {
      let newRoute = route.map((p) => p)
      GetAllServers(ns, server, found, newRoute)
    }
  }

  return [...found]
}
