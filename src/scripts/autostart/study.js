import { LogMessage, GetCity, GetRothmanUniversity, HasSingularity } from 'scripts/lib/utils'

const doc = eval('document')

/** @param {NS} ns */
export async function main(ns) {
	Study(ns);
}

export function Study(ns) {
  if (HasSingularity(ns)) {
    StudyPostSingularity(ns)
  } else {
    StudyPreSingularity(ns)
  }
}

const CITY_SECTOR12 = "Sector-12"
export function StudyPostSingularity(ns) {
  let city = ns.getPlayer().city
  if (city != CITY_SECTOR12) ns.singularity.travelToCity(CITY_SECTOR12)
  ns.singularity.universityCourse("Rothman University", "Algorithms", false)
}

export function StudyPreSingularity(ns) {
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