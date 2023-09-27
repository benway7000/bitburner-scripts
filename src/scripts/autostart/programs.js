import {
  LogMessage,
  GetCity,
  GetAlphaEnterprises,
  TypeInTerminal,
} from "scripts/lib/utils"

const doc = eval("document")

/** @param {NS} ns */
export async function main(ns) {
  BuyPrograms(ns)
}

export function BuyPrograms(ns) {
  if (ns.getPlayer().money < 200000) {
    ns.print("WARN: Not enough money to do anything.")
    return
  }
  if (!ns.hasTorRouter()) {
    GetCity().click()
    GetAlphaEnterprises().click()

    // find "Purchase Tor" button and click it
    let torButton = GetTorButton()
    if (torButton != null) {
      // Purchase button found which means we don't have it
      ns.print("WARN: TOR router not found.")
      if (ns.getPlayer().money < 200000) {
        ns.print(
          "WARN: Not enough money to purchase TOR router, postponing purchase."
        )
        return
      }
      torButton.click()
      const backdrop = doc.getElementsByClassName("MuiBackdrop-root")[0]
      if (backdrop != null) {
        backdrop.click()
      }
    } else {
      ns.tprint("could not find TOR button")
      return
    }
  }
  /*
    BruteSSHProgram: new DarkWebItem(CompletedProgramName.bruteSsh, 500e3, "Opens up SSH Ports."),
    FTPCrackProgram: new DarkWebItem(CompletedProgramName.ftpCrack, 1500e3, "Opens up FTP Ports."),
    RelaySMTPProgram: new DarkWebItem(CompletedProgramName.relaySmtp, 5e6, "Opens up SMTP Ports."),
    HTTPWormProgram: new DarkWebItem(CompletedProgramName.httpWorm, 30e6, "Opens up HTTP Ports."),
    SQLInjectProgram: new DarkWebItem(CompletedProgramName.sqlInject, 250e6, "Opens up SQL Ports."),
    ServerProfiler: new DarkWebItem(CompletedProgramName.serverProfiler, 500e3, "Displays detailed server information."),
    DeepscanV1: new DarkWebItem(CompletedProgramName.deepScan1, 500000, "Enables 'scan-analyze' with a depth up to 5."),
    DeepscanV2: new DarkWebItem(CompletedProgramName.deepScan2, 25e6, "Enables 'scan-analyze' with a depth up to 10."),
    AutolinkProgram: new DarkWebItem(CompletedProgramName.autoLink, 1e6, "Enables direct connect via 'scan-analyze'."),
    FormulasProgram: new DarkWebItem(CompletedProgramName.formulas, 5e9, "Unlock access to the formulas API."),
  */
  // already have it. so buy programs
  const PROGRAMS = [
    {name: "BruteSSH.exe", cost: 500e3},
    {name: "FTPCrack.exe", cost: 1500e3},
    {name: "relaySMTP.exe", cost: 5e6},
    {name: "HTTPWorm.exe", cost: 30e6},
    {name: "AutoLink.exe", cost: 1e6},
    {name: "ServerProfiler.exe", cost: 500e3},
    {name: "DeepscanV1.exe", cost: 500000},
    {name: "DeepscanV2.exe", cost: 25e6},
    {name: "SQLInject.exe", cost: 250e6}, // gets us to ports 5 and this will not be called anymore
  ]
       
  for (const program of PROGRAMS) {
    // Buy BruteSSH.exe
    if (!ns.fileExists(program.name)) {
      if (ns.getPlayer().money < program.cost) {
        ns.print("Not enough money to buy " + program.name)
        continue
      }
      ns.print("INFO: Checking if we can buy " + program.name + ".")
      if (TypeInTerminal("buy " + program.name)) {
        ns.tprint("SUCCESS: Purchased " + program.name)
        LogMessage(ns, "SUCCESS: Purchased " + program.name)
      } else {
        // if (ns.singularity.getCurrentWork() == null) {
        //   ns.singularity.createProgram(program, false)
        //   return
        // }
      }
    }
  }
}

export function GetTorButton() {
  for (const elem of doc.querySelectorAll("button")) {
    if (elem.textContent.indexOf("TOR") > 0) {
      return elem
    }
  }
}
