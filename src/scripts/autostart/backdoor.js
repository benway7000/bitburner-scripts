import { TypeInTerminal, HasSingularity } from "scripts/lib/utils"

const doc = eval("document")

/** @param {NS} ns */
export async function main(ns) {
  await InstallBackdoors(ns)
}

async function InstallBackdoors(ns) {
  ns.disableLog("scan")
  let targets = []
  for (let arg of ns.args) {
    let so = ns.getServer(arg)
    if (
      !so.backdoorInstalled ||
      (so.hasAdminRights &&
        ns.getHackingLevel() >= so.requiredHackingSkill)
    ) {
      targets.push(arg)
    }
  }
  ns.print("backdoor script will target servers " + targets)
  let allServerEntries = GetAllServers(ns, targets)

  for (let serverEntry of allServerEntries) {
    if (targets.includes(serverEntry.name)) {
      let so = ns.getServer(serverEntry.name)
      if (
        so.backdoorInstalled ||
        !so.hasAdminRights ||
        ns.getHackingLevel() < so.requiredHackingSkill
      ) {
        // if already backdoor'ed or it's not rooted or it's too hard to backdoor
        ns.print(serverEntry.name + ": skipping")
        await ns.asleep(100)
        continue
      }
      ns.print("found a backdoor target: " + serverEntry.name)

      if (HasSingularity(ns)) {
        await DoInstallBackdoorsPostSingularity(ns, serverEntry)
      } else {
        await DoInstallBackdoorsPreSingularity(ns, serverEntry)
      }
      break
    }
  }
}

async function DoInstallBackdoorsPreSingularity(ns, serverEntry) {
  let routeCommands = serverEntry.route.join(";connect ")
  // ns.tprint("route command: " + routeCommands)
  let result = TypeInTerminal(routeCommands)
  await ns.asleep(500)
  result = TypeInTerminal("backdoor")
  await WaitForBackdoor(ns)
  let result2 = TypeInTerminal("home")
  if (!result || !result2) {
    ns.print(
      "ERROR: Something went wrong backdooring server " + serverEntry.name
    )
  }
}

async function DoInstallBackdoorsPostSingularity(ns, serverEntry) {
  for (let route_dest of serverEntry.route) {
    ns.singularity.connect(route_dest)
  }
  await ns.singularity.installBackdoor()
  ns.singularity.connect("home")
}

async function WaitForBackdoor(ns) {
  await ns.asleep(5 * 1000)
  try {
    let lastLineText = doc.getElementById("terminal").children[doc.getElementById("terminal").children.length - 1].getElementsByTagName("span")[0].innerHTML
    while (lastLineText.includes("||")) {
      lastLineText = doc.getElementById("terminal").children[doc.getElementById("terminal").children.length - 1].getElementsByTagName("span")[0].innerHTML
      await ns.asleep(5 * 1000)
    }
  } catch (e) {

  }
}

export function GetAllServers(
  ns,
  targets,
  root = "home",
  found_targets = new Array(),
  found = new Array(),
  route = new Array()
) {
  if (!found.find((p) => p.name == root)) {
    let entry = { name: root, route: route }
    entry.route.push(root)
    found.push(entry)
    if (targets.includes(entry.name)) {
      found_targets.push(entry)
    }
  }

  for (const server of ns.scan(root)) {
    if (!found.find((p) => p.name == server)) {
      let newRoute = route.map((p) => p)
      GetAllServers(ns, targets, server, found_targets, found, newRoute)
    }
  }

  return [...found_targets]
}
