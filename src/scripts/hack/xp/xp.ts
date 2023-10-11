import { NS } from '@ns'
import { GetAllServers, WaitPids } from "scripts/lib/utils"
import { RunScript, MemoryMap } from "scripts/lib/ram"
import { Config } from "scripts/hack/xp/Config"

const XP_GROW_SCRIPT = "scripts/hack/xp/xp-grow.js"
const XP_WEAKEN_SCRIPT = "scripts/hack/xp/xp-weaken.js"
const XP_SCRIPT = "scripts/hack/xp/xp.js"


/** @param {NS} ns **/
export async function main(ns:NS) {
	ns.disableLog('ALL')

	ns.print("XP starting")
	let pct:number = AdjustPct(ns)
	ns.print(`XP first adjust ${pct}`)

	if (ns.args.includes('stop')) {
		ClearOut(ns)
		return
	}

	// weaken once first
	WeakenTarget(ns, Config.target)
	let weakenTime = Date.now()
	
	await AdjustUsage(ns, pct)
    // ns.print('Current share power: ' + ns.getSharePower())

	// clear out and re-create every so often to reduce script count
	let clearTime = Date.now()

	while (true) {
		ns.print('')
		ns.print('')
		pct = AdjustPct(ns)
		await AdjustUsage(ns, pct)
		// ns.print('Current share power: ' + ns.getSharePower())
		if (Date.now() - weakenTime > 5 * 60 * 1000) {
			// weaken double-check once after 5 minutes
			WeakenTarget(ns, Config.target)
			weakenTime = -1
		}
		if (Date.now() - clearTime > 10 * 60 * 1000) {
			// clear out every 10 minutes
			ClearOut(ns, true)
			clearTime = Date.now()
		}
		await ns.asleep(10 * 1000)
	}
}

function FindInstances(ns:NS) {
	let allProcs = []
	let dupes = []
	let totalRam = 0
	for (const server of GetAllServers(ns)) {
		let procs = ns.ps(server)
		allProcs.push(...procs.filter(s => s.filename == XP_GROW_SCRIPT || s.filename == XP_WEAKEN_SCRIPT))
		dupes.push(...procs.filter(s => s.filename == XP_SCRIPT && s.args[0] != 'stop'))
		if (ns.hasRootAccess(server))
			totalRam += ns.getServerMaxRam(server)
	}
	return {
		xpProcs: allProcs.sort((a, b) => a.threads - b.threads),
		dupes: dupes,
		totalRam: totalRam
	}
}

function AdjustPct(ns:NS):number {
	if (Config.xpRamPct != "auto") {
		// ns.print(`XP: AdjustPct is now ${Config.xpRamPct}`)
		return Config.xpRamPct as number
	}
	else { // auto mode
		let pct = 0
		const ram = new MemoryMap(ns, true)
		// if (ram.total < 5000){
		// 	ns.print("Not enough RAM to xp: " + ram.total + " / 5000")
		// 	return
		// }
		// else if (ram.total < 5000)
		// if (ram.total < 5000)
		// 	pct = 0.15
		// else if (ram.total < 10000)
		// 	pct = 0.2
		// else if (ram.total < 15000)
		// 	pct = 0.25
		// else if (ram.total < 25000)
		// 	pct = 0.30
		// else
		// 	pct = 0.35
		if (ram.total < 5000)
			pct = 0.1
		else if (ram.total < 10000)
			pct = 0.12
		else if (ram.total < 15000)
			pct = 0.14
		else if (ram.total < 25000)
			pct = 0.16
		else
			pct = 0.18
		return pct
	}
}

async function AdjustUsage(ns:NS, pct: number) {
	let data = FindInstances(ns)
	let xpThreads = data.xpProcs.reduce((a, s) => a += s.threads, 0)
	let scriptRam = ns.getScriptRam(XP_GROW_SCRIPT)
	let xpRamPct = (xpThreads * scriptRam) / data.totalRam
	let targetThreads = Math.ceil(data.totalRam * pct / scriptRam)

	if (xpThreads > targetThreads) {
		let needToKill = xpThreads - targetThreads
		while (needToKill > 0 && data.xpProcs.length > 0) {
			ns.print('Killing ' + data.xpProcs[0].threads + ' xp threads')
			xpThreads -= data.xpProcs[0].threads
			needToKill -= data.xpProcs[0].threads
			ns.kill(data.xpProcs[0].pid)
			data.xpProcs.shift()
		}
		xpRamPct = (xpThreads * scriptRam) / data.totalRam
	}

	if (xpRamPct < pct) {
		let missingThreads = targetThreads - xpThreads
		ns.print('Attempting to start ' + missingThreads + ' xp threads. xpRamPct: ' + xpRamPct + '%  pct:' + pct + '%')
		RunScript(ns, XP_GROW_SCRIPT, missingThreads, [Config.target, performance.now(), true], Config.maxSpread, true)
	}
}

async function WeakenTarget(ns:NS, target:string) {
	const minSec = ns.getServerMinSecurityLevel(target)
	const sec = ns.getServerSecurityLevel(target)
	let weakenThreads = Math.ceil((sec - minSec) / ns.weakenAnalyze(1))
	if (weakenThreads > 0) {
		const { pids } = RunScript(ns, XP_WEAKEN_SCRIPT, weakenThreads, [target, performance.now(), true], Config.maxSpread, true)
		await WaitPids(ns, pids, ns.getWeakenTime(target)-100)
	}
}

function ClearOut(ns:NS, scheduled: boolean = false) {
	let print = ns.tprint
	if (scheduled) {
		print = ns.print
	}
	const data = FindInstances(ns)
	// Kill all existing instances of xp-forever.js
	for (const proc of data.xpProcs) {
		print('Killing xp-forever.js PID ' + proc.pid)
		ns.kill(proc.pid)
	}
	for (const proc of data.dupes) {
		print('Killing xp.js PID ' + proc.pid)
		ns.kill(proc.pid)
	}
}