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
  // already have it. so buy programs
  const PROGRAMS = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "SQLInject.exe",
    "AutoLink.exe",
    "ServerProfiler.exe",
    "DeepscanV1.exe",
    "DeepscanV2.exe",
    "HTTPWorm.exe" // gets us to ports 5 and this will not be called anymore
  ]
       
  for (const program of PROGRAMS) {
    // Buy BruteSSH.exe
    if (!ns.fileExists(program)) {
      ns.print("INFO: Checking if we can buy " + program + ".")
      if (TypeInTerminal("buy " + program)) {
        ns.tprint("SUCCESS: Purchased " + program)
        LogMessage(ns, "SUCCESS: Purchased " + program)
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
