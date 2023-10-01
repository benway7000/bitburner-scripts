import { pctColor, PrintTable, DefaultStyle, ColorPrint } from "scripts/lib/tables"
import { GetSymbolFromServer, HasFormulas, FormatTime, Weight, PadCenter } from "scripts/lib/utils"

const FORCED_HACK_LEVEL = undefined

const desiredWidth = 120


/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")

  const [mode = "full"] = ns.args


  let hack_report = { currentTargets: [] }
  if (ns.fileExists("/data/hack.txt")) {
    hack_report = JSON.parse(ns.read("/data/hack.txt"))
  }

  let cycle_reports = 0
  for (const [server, server_state] of Object.entries(hack_report.serverStates)) {
    // ns.tprint(`server_state: ${server_state}`)
    if (server_state.cycles != undefined) {
      for (let cycle of server_state.cycles.sort((a, b) => a.cycle_number - b.cycle_number)) {
        cycle_reports++
        CycleReport(ns, cycle)
      }
    }
  }
  ns.tprint(cycle_reports > 0 ? `${cycle_reports} cycles listed.` : "No cycles found.")
}

function CycleReport(ns, cycle) {

  ns.tprint(`Cycle Report for ${JSON.stringify(cycle)}`)
  CycleGraph(ns, cycle)
}

function CycleGraph(ns, cycle) {
  const {
    target, cycle_number, isPrep,
    weaken1Threads, weaken1StartTime, weaken1Duration, weaken1EndTime, weaken1SecToRemove,
    weaken2Threads, weaken2StartTime, weaken2Duration, weaken2EndTime, weaken2SecToRemove,
    growThreads, growStartTime, growDuration, growEndTime, growSecurityIncrease,
    hackThreads, hackStartTime, hackDuration, hackEndTime, hackSecurityIncrease, hackMoneyRemoved,
    money, maxMoney, sec, minSec, startingExtraSecurity,
  } = cycle.calc

  const batchPhaseDelay = cycle.batch.batchPhaseDelay
  const overallDuration = weaken1Duration + 2 * batchPhaseDelay

  let spacer = " │ "
  let startLine = "INFO:"
  let startWall = "|"
  let endWall = "|"
  const desiredContentWidth = desiredWidth - startLine.length - startWall.length - endWall.length
  const maxPhaseLength = desiredContentWidth


  function DurToLen(ns, duration) {
    // ns.tprint(`DurToLen: ${duration} ${overallDuration} ${desiredContentWidth} result = ${Math.round((desiredContentWidth * duration) / overallDuration)}`)
    return Math.round((maxPhaseLength * duration) / overallDuration)
  }

  function CalcGraphLine(ns, label, startTime, duration) {
    let endSpacer = ""
    if (label == "H") endSpacer = "   "
    if (label == "W1") endSpacer = "  "
    if (label == "G") endSpacer = " "
    if (label == "W2") endSpacer = ""

    let startSpacer = DurToLen(ns, startTime)
    let barLength = maxPhaseLength - startSpacer - "[= ".length - label.length - " ".length - "]".length - endSpacer.length

    let line = `${" ".repeat(startSpacer)}[= ${label} ${"=".repeat(barLength)}]`
    return line
  }

  // Report
  ns.tprint("")
  ns.tprint(`${startLine}┌${"─".repeat(desiredWidth - startLine.length - 2)}┐`)

  let line = `${target}${spacer}S: ${(sec - minSec).toFixed(2)} [${Math.round(minSec).toFixed(2)}]`
  ns.tprint(`${startLine}${startWall}${PadCenter(line, desiredContentWidth)}${endWall}`)

  line = `\$${ns.formatNumber(money, 0, 1000, true)}/${ns.formatNumber(maxMoney, 0, 1000, true)} (${(
    (money / maxMoney) *
    100
  ).toFixed(0)})% W:${FormatTime(ns.getWeakenTime(target))} G:${FormatTime(
    ns.getGrowTime(target)
  )} H:${FormatTime(ns.getHackTime(target))}`
  ns.tprint(`${startLine}${startWall}${PadCenter(line, desiredContentWidth)}${endWall}`)

  // draw batch diagram
  // line = `${"─".repeat((desiredContentWidth - 6) / 2)} ${isPrep ? "Prep" : "Hack"} ${"─".repeat(
  //   (desiredContentWidth - 6) / 2
  // )}`
  line = `${PadCenter(` ${isPrep ? 'Prep' : 'Hack'} `, desiredContentWidth, "─")}`
  ns.tprint(`${startLine}${startWall}${line}${endWall}`)

  // hack line
  if (hackThreads > 0) {
    line = CalcGraphLine(ns, "H", hackStartTime, hackDuration)
    // line = `${" ".repeat(DurToLen(ns, hackStartTime))}[= H ${"=".repeat(DurToLen(ns, hackDuration) - 6 - 2)}]` // 6 for [= H ]
  } else {
    line = `${PadCenter("[No Hack]",maxPhaseLength)}`
  }
  ns.tprint(`${startLine}${startWall}${line}   ${endWall}`)

  // weaken1 line
  if (weaken1Threads > 0) {
    line = CalcGraphLine(ns, "W1", weaken1StartTime, weaken1Duration)
    // line = `${" ".repeat(DurToLen(ns, weaken1StartTime))}[= W1 ${"=".repeat(
    //   DurToLen(ns, weaken1Duration) - 7 - 2
    // )}]` // 7 for [= W1 ]
  } else {
    line = `${" ".repeat((maxPhaseLength - 9) / 2)}[No W1]${" ".repeat((maxPhaseLength - 9) / 2)}`
  }
  ns.tprint(`${startLine}${startWall}${line}  ${endWall}`)

  // grow line
  if (growThreads > 0) {
    line = CalcGraphLine(ns, "G", growStartTime, growDuration)
    // line = `${" ".repeat(DurToLen(ns, growStartTime))}[= G ${"=".repeat(DurToLen(ns, growDuration) - 6 - 1)}]` // 6 for [= G ]
  } else {
    line = `${" ".repeat((maxPhaseLength - 9) / 2)}[No Grow]${" ".repeat((maxPhaseLength - 9) / 2)}`
  }
  ns.tprint(`${startLine}${startWall}${line} ${endWall}`)

  //weaken2 line
  if (weaken2Threads > 0) {
    line = CalcGraphLine(ns, "W2", weaken2StartTime, weaken2Duration)
    // line = `${" ".repeat(DurToLen(ns, weaken2StartTime) + 1)}[= W2 ${"=".repeat(
    //   DurToLen(ns, weaken2Duration) - 7 - 1
    // )}]` // 7 for [= W2 ]
  } else {
    line = `${PadCenter("[No W2]", maxPhaseLength)}`
  }

  ns.tprint(`${startLine}${startWall}${line}${endWall}`)
  ns.tprint(`${startLine}└${"─".repeat(desiredWidth - startLine.length - 2)}┘`)
  ns.tprint("")
}


