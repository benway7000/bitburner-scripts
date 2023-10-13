import { NS } from '@ns'
import { FactionName } from "bitburner/Faction/Enums"

/**
 * 
 * Joins factions as available
 */

const cityFactions = [
  FactionName.Aevum, FactionName.Chongqing, FactionName.Ishima,
  FactionName.NewTokyo, FactionName.Sector12, FactionName.Volhaven]


/** @param {NS} ns **/
export async function main(ns: NS) {
  ns.disableLog("ALL")

  JoinFactions(ns)
}

function IsCity(factionName: string):boolean {
  return Object.values(cityFactions).includes(factionName as FactionName)
}

function JoinFactions(ns: NS) {
  let invitations = ns.singularity.checkFactionInvitations()
  for (let invite of invitations) {
    if (!IsCity(invite)) {
      ns.print(`Joining faction ${invite}`)
      ns.singularity.joinFaction(invite)
    }
  }
}