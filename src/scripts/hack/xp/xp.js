import { InitializeNS, ns } from "scripts/lib/NS";
import { GetAllServers, WaitPids } from "scripts/lib/utils.js";
import { RunScript, MemoryMap } from "scripts/lib/ram.js";
import { Config } from "scripts/hack/xp/Config";

const XP_GROW_SCRIPT = "scripts/hack/xp/xp-grow.js"
const XP_WEAKEN_SCRIPT = "scripts/hack/xp/xp-weaken.js"
const XP_SCRIPT = "scripts/hack/xp/xp.js"


/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');

	InitializeNS(ns)
	ns.print("XP starting")
	let pct = AdjustPct(ns)
	ns.print(`XP first adjust ${pct}`)

	if (ns.args.includes('stop')) {
		const data = FindInstances(ns)
		// Kill all existing instances of xp-forever.js
		for (const proc of data.xpProcs) {
			ns.tprint('Killing xp-forever.js PID ' + proc.pid);
			ns.kill(proc.pid);
		}
		for (const proc of data.dupes) {
			ns.tprint('Killing xp.js PID ' + proc.pid);
			ns.kill(proc.pid);
		}
		return;
	}

	// weaken once first
	WeakenTarget(ns, Config.target)
	let weakenTime = Date.now()
	
	await AdjustUsage(ns, pct);
    // ns.print('Current share power: ' + ns.getSharePower());

	for (; ;) {
		ns.print('');
		ns.print('');
		pct = AdjustPct(ns)
		await AdjustUsage(ns, pct);
		// ns.print('Current share power: ' + ns.getSharePower());
		await ns.sleep(5000);
		if (Date.now() - weakenTime > 5 * 60 * 1000) {
			// weaken double-check once after 5 minutes
			WeakenTarget(ns, Config.target)
			weakenTime = -1
		}
	}
}

function FindInstances(ns) {
	let allProcs = [];
	let dupes = [];
	let totalRam = 0;
	for (const server of GetAllServers(ns)) {
		let procs = ns.ps(server);
		allProcs.push(...procs.filter(s => s.filename == XP_GROW_SCRIPT));
		dupes.push(...procs.filter(s => s.filename == XP_SCRIPT && s.args[0] != 'stop'));
		if (ns.hasRootAccess(server))
			totalRam += ns.getServerMaxRam(server);
	}
	return {
		xpProcs: allProcs.sort((a, b) => a.threads - b.threads),
		dupes: dupes,
		totalRam: totalRam
	};
}

function AdjustPct(ns) {
	if (Config.xpRamPct != "auto") {
		// ns.print(`XP: AdjustPct is now ${Config.xpRamPct}`)
		return Config.xpRamPct
	}
	let pct = 0
	const ram = new MemoryMap(ns, true);
	// if (ram.total < 5000){
	// 	ns.print("Not enough RAM to xp: " + ram.total + " / 5000")
	// 	return;
	// }
	// else if (ram.total < 5000)
	if (ram.total < 5000)
		pct = 0.15;
	else if (ram.total < 10000)
		pct = 0.2;
	else if (ram.total < 15000)
		pct = 0.25;
	else if (ram.total < 25000)
		pct = 0.30;
	else
		pct = 0.50
	return pct
}

async function AdjustUsage(ns, pct) {
	let data = FindInstances(ns);
	let xpThreads = data.xpProcs.reduce((a, s) => a += s.threads, 0);
	let scriptRam = ns.getScriptRam(XP_GROW_SCRIPT);
	let xpRamPct = (xpThreads * scriptRam) / data.totalRam;
	let targetThreads = Math.ceil(data.totalRam * pct / scriptRam);

	if (xpThreads > targetThreads) {
		let needToKill = xpThreads - targetThreads;
		while (needToKill > 0 && data.xpProcs.length > 0) {
			ns.print('Killing ' + data.xpProcs[0].threads + ' xp threads');
			xpThreads -= data.xpProcs[0].threads;
			needToKill -= data.xpProcs[0].threads;
			ns.kill(data.xpProcs[0].pid);
			data.xpProcs.shift();
		}
		xpRamPct = (xpThreads * scriptRam) / data.totalRam;
	}

	if (xpRamPct < pct) {
		let missingThreads = targetThreads - xpThreads;
		ns.print('Attempting to start ' + missingThreads + ' xp threads. xpRamPct: ' + xpRamPct + '%  pct:' + pct + '%');
		RunScript(ns, XP_GROW_SCRIPT, missingThreads, [Config.target, performance.now(), true], Config.maxSpread, true);
	}
}

async function WeakenTarget(ns, target) {
	const minSec = ns.getServerMinSecurityLevel(target)
	const sec = ns.getServerSecurityLevel(target)
	let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))
	if (weakenThreads > 0) {
		const { pids } = RunScript(ns, XP_WEAKEN_SCRIPT, weakenThreads, [target, performance.now(), true], MAX_SPREAD, true);
		await WaitPids(ns, pids, ns.getWeakenTime(target)-100)
	}
}