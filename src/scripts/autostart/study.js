import { LogMessage, GetCity, GetRothmanUniversity, TypeInTerminal } from 'scripts/lib/utils'

const doc = eval('document')

/** @param {NS} ns */
export async function main(ns) {
	Study(ns);
}

export function Study(ns) {
  GetCity().click()
  GetRothmanUniversity().click()

  // find Algorithms course button and click it
  let algButton = GetAlgButton()
  if (algButton != null) {
    algButton.click()
  }
}

export function GetAlgButton() {
  for (const elem of doc.querySelectorAll("button")) {
    if (elem.textContent.indexOf("Algorithms") > 0) {
      return elem;
    }
  }
}