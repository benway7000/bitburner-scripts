const doc = eval("document")

/** @param {NS} ns **/
export async function main(ns) {
  ns.tprint(GetServerPath(ns, "run4theh111z"))

  //ns.tprint(HasFormulas(ns));

  // const servers = GetAllServers(ns);
  // ns.tprint(servers.length + ' ' + servers);

  // ns.tprint('path of ecorp is ' + GetServerPath(ns, 'ecorp'));

  // ns.tprint(FormatMoney(ns, 0));
  // ns.tprint(FormatMoney(ns, 1e3));
  // ns.tprint(FormatMoney(ns, 1e6));
  // ns.tprint(FormatMoney(ns, 1e9));
  // ns.tprint(FormatMoney(ns, 1e12));
  // ns.tprint(FormatMoney(ns, 1e15));
  // ns.tprint(FormatMoney(ns, 1e18));
  // ns.tprint(FormatMoney(ns, 1e21));
  // ns.tprint(FormatMoney(ns, 1e24));
  // ns.tprint(FormatMoney(ns, 1e27));
  // ns.tprint(FormatMoney(ns, 1e30));
  // ns.tprint(FormatMoney(ns, 1e33));
  // ns.tprint(FormatMoney(ns, 1e36));
  // ns.tprint(FormatMoney(ns, 1e39));
  // ns.tprint(FormatMoney(ns, 1e42));
  // ns.tprint(FormatMoney(ns, 1e45));
  // ns.tprint(FormatMoney(ns, 1e48));
  // ns.tprint(FormatMoney(ns, 1e51));
  // ns.tprint(FormatMoney(ns, 1e54));
  // ns.tprint(FormatMoney(ns, 1e57));
  // ns.tprint(FormatMoney(ns, 1e60));
  // ns.tprint(FormatMoney(ns, 1e63));
  // ns.tprint(FormatMoney(ns, 1e66));
}

// Iterative network scan
export function GetAllServers(ns) {
  let servers = ["home"]
  for (const server of servers) {
    const found = ns.scan(server)
    if (server != "home") found.splice(0, 1)
    servers.push(...found)
  }
  return servers
}

// Find the path to a server
export function GetServerPath(ns, server) {
  const path = [server]
  while (server != "home") {
    server = ns.scan(server)[0]
    path.unshift(server)
  }
  return path
}

export function ServerReport(ns, server, metrics = undefined) {
  // Get server object for this server
  var so = ns.getServer(server)

  // weaken threads
  const tweaken = Math.ceil(
    (so.hackDifficulty - so.minDifficulty) / 0.05 /*ns.weakenAnalyze(1, 1)*/
  )
  // grow threads
  const tgrow = Math.ceil(
    ns.growthAnalyze(server, so.moneyMax / Math.max(so.moneyAvailable, 1), 1)
  )
  // hack threads
  const thack = Math.ceil(ns.hackAnalyzeThreads(server, so.moneyAvailable))

  ns.print("┌─────────────────────────────────────────────────────┐")
  ns.print("│ " + server.padStart(52 / 2 + server.length / 2).padEnd(52) + "│")
  ns.print("├─────────────────────────────────────────────────────┤")
  ns.print(
    "│ " +
    (
      "Money        : $" +
      ns.formatNumber(so.moneyAvailable, 3) +
      " / $" +
      ns.formatNumber(so.moneyMax, 3) +
      " (" +
      ((so.moneyAvailable / so.moneyMax) * 100).toFixed(2) +
      "%)"
    ).padEnd(52) +
    "│"
  )
  ns.print(
    "│ " +
    (
      "Security     : " +
      (so.hackDifficulty - so.minDifficulty).toFixed(2) +
      " min= " +
      so.minDifficulty.toFixed(2) +
      " current= " +
      so.hackDifficulty.toFixed(2)
    ).padEnd(52) +
    "│"
  )
  ns.print("├─────────────────────────────────────────────────────┤")
  if (HasFormulas(ns)) {
    ns.print(
      "│ " +
      (
        "Weaken time  : " +
        ns.tFormat(ns.formulas.hacking.hackTime(so, ns.getPlayer()) * 4) +
        " (t=" +
        tweaken +
        ")"
      ).padEnd(52) +
      "│"
    )
    ns.print(
      "│ " +
      (
        "Grow         : " +
        ns.tFormat(ns.formulas.hacking.hackTime(so, ns.getPlayer()) * 3.2) +
        " (t=" +
        tgrow +
        ")"
      ).padEnd(52) +
      "│"
    )
    ns.print(
      "│ " +
      (
        "Hack         : " +
        ns.tFormat(ns.formulas.hacking.hackTime(so, ns.getPlayer())) +
        " (t=" +
        thack +
        ")"
      ).padEnd(52) +
      "│"
    )
  } else {
    ns.print("│           No Formulas API: Times unknown            │")
  }
  ns.print("└─────────────────────────────────────────────────────┘")

  if (metrics != undefined) {
    metrics.Report(ns)
  }
}

// Returns a weight that can be used to sort servers by hack desirability
export function Weight(ns, server, FORCED_HACK_LEVEL = undefined) {
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
      (so.moneyMax / ns.formulas.hacking.weakenTime(so, player)) * ns.formulas.hacking.hackChance(so, player)
  }
  // If we do not have formulas, we can't properly factor in hackchance, so we lower the hacking level tolerance by half
  else if (so.requiredHackingSkill > player.skills.hacking / 2 && server != "n00dles") return 0

  return weight
}

// export function FormatMoney(ns, value, decimals = 3) {
// 	if (Math.abs(value) >= 1e33) return '$' + value.toExponential(0);
// 	for (const pair of [[1e30, 'n'], [1e27, 'o'], [1e24, 'S'], [1e21, 's'], [1e18, 'Q'], [1e15, 'q'], [1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']])
// 		if (Math.abs(value) >= pair[0]) return (Math.sign(value) < 0 ? "-" : "") + (Math.abs(value) / pair[0]).toFixed(decimals) + pair[1];
// 	return '$' + (Math.sign(value) < 0 ? "-" : "") + Math.abs(value).toFixed(decimals);
// }

// export function FormatRam(ns, value, decimals = 1) {
// 	const zero = 0;
// 	return ns.nFormat(value * 1000000000, (zero.toFixed(decimals) + 'b'));
// }

/**
 *
 * @param {*} time in msec
 * @returns mm:ss
 */
export function FormatTime(time) {
  let seconds = (time / 1000) % 60
  let minutes = Math.floor(time / 1000 / 60)
  return (
    (minutes > 0 ? minutes.toFixed(0).padStart(2, "0") + ":" : "00:") +
    (seconds > 0 ? seconds.toFixed(0).padStart(2, "0") : "00")
  )
}

// Centers text in a padded string of "length" long
export function PadCenter(str, length, padChar = " ") {
  return str.padStart((length + str.length) / 2, padChar).padEnd(length, padChar)
}

export async function WaitPids(ns, pids, expectedTime = 0) {
  // first wait for the bulk of time in a single asleep
  await ns.asleep(expectedTime)
  if (!Array.isArray(pids)) pids = [pids]
  while (pids.some((p) => ns.getRunningScript(p) != undefined)) {
    await ns.asleep(50)
  }
}

/**
 * Runs a script on home if it is not already running.
 * @param {*} ns
 * @param {*} script
 * 
 * returns null if script was already running, returns pid if script was exec'ed
 */
export function RunHomeSingletonScript(
  ns,
  scriptName,
  threads,
  params
) {
  let server = "home"
  let pid = ns.getRunningScript(
    scriptName,
    server,
    ...params
  )
  if (pid === null) {
    pid = ns.exec(
      scriptName,
      server,
      threads,
      ...params
    )
    if (pid > 0) {
      ns.print(
        "Started script " +
        scriptName +
        " on " +
        server +
        " with " +
        threads +
        " threads"
      )
      return pid
    } else {
      ns.print("failed to exec")
    }
  }
  return null
}

export function HasFormulas(ns) {
  return ns.fileExists("Formulas.exe", "home")
  // try {
  //   ns.formulas.hacknetNodes.constants();
  //   return true;
  // } catch {
  //   return false;
  // }
}

export function HasTIX(ns) {
  try {
    ns.stock.getSymbols()
    return true
  } catch {
    return false
  }
}

// Returns the needed XP for the next hacking level
export function GetNextLevelXp(ns, skill = "hacking") {
  let player = ns.getPlayer()
  let prevXp = ns.formulas.skills.calculateExp(
    player.skills[skill],
    player.mults[skill]
  )
  let nextXp = ns.formulas.skills.calculateExp(
    player.skills[skill] + 1,
    player.mults[skill]
  )

  let needed = nextXp - prevXp
  let progress = player.exp[skill] - prevXp
  let remaining = needed - progress
  let pct = (progress / needed) * 100

  // ns.tprint('Progress : ' + ns.nFormat(progress, '0.000a') + ' / ' + ns.nFormat(needed, '0.000a'));
  // ns.tprint('Remaining: ' + ns.nFormat(remaining, '0.000a') + ' (' + pct.toFixed(2) + '%)');

  return {
    needed: needed,
    progress: progress,
    remaining: remaining,
    pct: pct,
  }
}

export function LogMessage(ns, message) {
  let time = new Date().toLocaleTimeString()
  let date = new Date().toLocaleDateString()
  let log =
    "[" + date.padStart(10) + " " + time.padStart(11) + "] " + message + "\n"
  ns.write("nodelog.txt", log, "a")
}

export function GetServerFromSymbol(ns, sym) {
  if (!HasTIX(ns)) return "N/A"
  const org = ns.stock.getOrganization(sym)
  return (
    GetAllServers(ns).find((s) => ns.getServer(s).organizationName == org) ?? ""
  )
}

export function GetSymbolFromServer(ns, server) {
  if (!HasTIX(ns)) return "N/A"
  const org = ns.getServer(server).organizationName
  return (
    ns.stock.getSymbols().find((s) => ns.stock.getOrganization(s) == org) ?? ""
  )
}

export function TypeInTerminal(command) {
  try {
    const terminalInput = eval("document").getElementById("terminal-input")
    if (!terminalInput) {
      ns.toast("!!! You need to be in terminal window !!!", "error")
      return false
    }
    terminalInput.value = command
    const handler = Object.keys(terminalInput)[1]
    terminalInput[handler].onChange({ target: terminalInput })
    terminalInput[handler].onKeyDown({
      key: "Enter",
      preventDefault: () => null,
    })
  } catch {
    return false
  }
  return true
}

export function GetCity() {
  for (const elem of doc.querySelectorAll("p")) {
    if (elem.textContent == "City") {
      return elem
    }
  }
}

export function GetSlums() {
  return doc.querySelector('[aria-label="The Slums"]')
}

export function GetAlphaEnterprises() {
  return doc.querySelector('[aria-label="Alpha Enterprises"]')
}

export function GetRothmanUniversity() {
  return doc.querySelector('[aria-label="Rothman University"]')
}
