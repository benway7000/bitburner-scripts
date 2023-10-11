import { NS } from '@ns'
import { GetAllServers } from "scripts/lib/utils"

import { codingContractTypesMetadata } from "bitburner/data/codingcontracttypes"

/** @param {NS} ns **/
export async function main(ns: NS) {
  // ns.disableLog("ALL")

  let servers = GetAllServers(ns)

  for (let server of servers) {
    let contract_files = ns.ls(server, "cct")
    for (let cct_file of contract_files) {
      SolveContract(ns, cct_file, server)
      return
    }
  }
}

function SolveContract(ns:NS, cct_file:string, server:string) {
  let contract_data = ns.codingcontract.getData(cct_file, server)
  let contract_type = ns.codingcontract.getContractType(cct_file, server)
  ns.print(`SolveContract: Server: ${server}. Type: "${contract_type}"`)
  let cctTypeMetadata = codingContractTypesMetadata.find(t => t.name == contract_type)
  if (cctTypeMetadata) {
    let dummy = ""
    let answer = cctTypeMetadata.solver(contract_data, dummy)
    let result = ns.codingcontract.attempt(answer, cct_file, server)
    ns.print(`SolveContract: result ${result}`)
  }
}