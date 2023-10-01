import { GetAllServers } from "scripts/lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
  
    const [script, cmd] = ns.args
    
    if (cmd == undefined) cmd = "list"

    // Show usage if no parameters were passed
    if (script == undefined) {
      ns.tprint("ERROR: No mode specified!")
      ns.tprint("INFO : Usage: run ps_util.js <script_regex> <cmd>")
      ns.tprint("INFO :")
      ns.tprint(
        "INFO :    <cmd> is list (default) or kill"
      )
      ns.tprint("INFO :")
      return
    }
  
    let instances = FindInstances(ns, script).procs
    
    if (cmd === "list") {
        ListInstances(ns, instances)
    } else if (cmd === "kill") {
        KillInstances(ns, instances)
    }
}

function FindInstances(ns, script_name) {
	let allProcs = [];
	for (const server of GetAllServers(ns)) {
		let procs = ns.ps(server);
		allProcs.push(...procs.filter(s => s.filename.match(script_name)));
	}
	return {
		procs: allProcs.sort((a, b) => a.threads - b.threads),
	};
}

function ListInstances(ns, instances) {
    for (let instance of instances) {
        ns.tprint(instance)
    }
}

function KillInstances(ns, instances) {
    ns.tprint(`Killing ${instances.length} processes.`)
    for (let instance of instances) {
        ns.kill(instance.pid)
    }
}