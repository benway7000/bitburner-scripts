import { GetAllServers } from "scripts/lib/utils.js";
import { RunScript, MemoryMap } from "scripts/lib/ram.js";

const SHARE_FOREVER_SCRIPT = "scripts/autostart/share-forever.js"
const SHARE_SCRIPT = "scripts/autostart/share.js"

const MAX_SPREAD = 30

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');

	let [pct = 0.95] = ns.args;

	if (ns.args.includes('auto')) {
		const ram = new MemoryMap(ns, true);
		if (ram.total < 5000) {
			ns.print("Not enough RAM to share: " + ram.total + " / 5000")
			return;
		}
		else pct = 0.05
		// else if (ram.total < 5000)
		// 	pct = 0.15;
		// else if (ram.total < 10000)
		// 	pct = 0.2;
		// else if (ram.total < 15000)
		// 	pct = 0.25;
		// else if (ram.total < 25000)
		// 	pct = 0.30;
		// else
		// // 	pct = 0.35
		// else if (ram.total < 5000)
		// 	pct = 0.1
		// else if (ram.total < 10000)
		// 	pct = 0.12
		// else if (ram.total < 15000)
		// 	pct = 0.14
		// else if (ram.total < 25000)
		// 	pct = 0.16
		// else
		// 	pct = 0.18
	}

	if (ns.args.includes('stop')) {
		const data = FindInstances(ns)
		// Kill all existing instances of share-forever.js
		for (const proc of data.shares) {
			ns.tprint('Killing share-forever.js PID ' + proc.pid);
			ns.kill(proc.pid);
		}
		for (const proc of data.dupes) {
			ns.tprint('Killing share.js PID ' + proc.pid);
			ns.kill(proc.pid);
		}
		return;
	}

	await AdjustUsage(ns, pct);
	ns.print('Current share power: ' + ns.getSharePower());

	for (; ;) {
		ns.print('');
		ns.print('');
		await AdjustUsage(ns, pct);
		ns.print('Current share power: ' + ns.getSharePower());
		await ns.sleep(5000);
	}
}

function FindInstances(ns) {
	let allProcs = [];
	let dupes = [];
	let totalRam = 0;
	for (const server of GetAllServers(ns)) {
		let procs = ns.ps(server);
		allProcs.push(...procs.filter(s => s.filename == SHARE_FOREVER_SCRIPT));
		dupes.push(...procs.filter(s => s.filename == SHARE_SCRIPT && s.args[0] != 'stop'));
		if (ns.hasRootAccess(server))
			totalRam += ns.getServerMaxRam(server);
	}
	return {
		shares: allProcs.sort((a, b) => a.threads - b.threads),
		dupes: dupes,
		totalRam: totalRam
	};
}

async function AdjustUsage(ns, pct) {
	let data = FindInstances(ns);
	let shareThreads = data.shares.reduce((a, s) => a += s.threads, 0);
	let scriptRam = ns.getScriptRam(SHARE_FOREVER_SCRIPT);
	let sharePct = (shareThreads * scriptRam) / data.totalRam;
	let targetThreads = Math.ceil(data.totalRam * pct / scriptRam);

	if (shareThreads > targetThreads) {
		let needToKill = shareThreads - targetThreads;
		while (needToKill > 0 && data.shares.length > 0) {
			ns.print('Killing ' + data.shares[0].threads + ' share threads');
			shareThreads -= data.shares[0].threads;
			needToKill -= data.shares[0].threads;
			ns.kill(data.shares[0].pid);
			data.shares.shift();
		}
		sharePct = (shareThreads * scriptRam) / data.totalRam;
	}

	if (sharePct < pct) {
		let missingThreads = targetThreads - shareThreads;
		ns.print('Attempting to start ' + missingThreads + ' share threads. sharePct: ' + sharePct + '%  pct:' + pct + '%');
		await RunScript(ns, SHARE_FOREVER_SCRIPT, missingThreads, ['', performance.now(), true], MAX_SPREAD, true);
	}
}