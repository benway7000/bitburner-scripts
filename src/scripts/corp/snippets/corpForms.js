export function optimizeProductivity(ns, numEmployees, division = "ADA", city = Cities.SECTOR_12) {
	const data = new JobData(ns, division, city);
	for (const [job, values] of Object.entries(data)) {
		switch (job) {
			case Jobs.ENGINEER:
				values.number = 1;
				break;
			// case Jobs.BUSINESS:
			// case Jobs.OPERATIONS:
			// 	break;
			default:
				values.number = 0;
		}
		numEmployees -= values.number;
	}
	for (let i = 0; i < numEmployees; ++i) {
		let bestAssignment = null;
		let bestWeight = -Infinity;

		for (const [job, values] of Object.entries(data)) {
			if (job === Jobs.INTERN) continue;
			values.number++;
			const result = predictProduct(ns, division, 1e9, 1e9, data);

			if (result.weight > bestWeight) {
				bestWeight = result.weight;
				bestAssignment = job;
			}
			values.number--;
		}
		data[bestAssignment].number++;
	}
	ns.print(predictProduct(ns, division, 1e9, 1e9, data));

	ns.print(data);
	return data;
}

/** @param {NS} ns */
export function estimateProductivity(ns, division, city, jobs) {
	const office = corp.getOffice(division, city);
	const results = {};
	for (const job of jobs) {
		results[job] = office.employeeProductionByJob[job] / office.employeeJobs[job];
	}
	return results;
}

/** @param {NS} ns */
export function predictProduct(ns, div, adInvest, designInvest, jobData) {
	debugger;
	const corp = ns.corporation;
	// TODO: Factor in RP/time from other cities. Combine other city R&D production with jobData
	const result = {};
	const stats = {}
	const division = corp.getDivision(div);
	const industry = corp.getIndustryData(division.type);
	const opProd = jobData.getProd(Jobs.OPERATIONS);
	const engrProd = jobData.getProd(Jobs.ENGINEER);
	const mgmtProd = jobData.getProd(Jobs.MANAGEMENT);
	const total = opProd + engrProd + mgmtProd;

	let baseCost = 0;
	for (const [material, amount] of Object.entries(industry.requiredMaterials)) {
		baseCost += corp.getMaterialData(material).baseCost * amount;
	}

	const mgmtFactor = 1 + mgmtProd / (1.2 * total);
	const balancer = 0.025;
	const prod = (Math.pow(opProd, 0.4) + Math.pow(engrProd, 0.3)) * mgmtFactor * balancer;

	let sciBonus = 1;
	if (corp.hasResearched(div, Research.DRONES_ASSEMBLY)) sciBonus += 0.2;
	if (corp.hasResearched(div, Research.SELF_CORRECTING_ASSEMBLERS)) sciBonus += 0.1;

	// Product production bonus is its own bucket and stacks multiplicatively with the rest.
	if (corp.hasResearched(div, Research.UPGRADE_FULCRUM) && forProducts) sciBonus *= 1.05;

	let sciProd = jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT);
	for (const city of division.cities) {
		if (city === Cities.SECTOR_12) continue;
		sciProd += corp.getOffice(div, city).employeeProductionByJob[Jobs.RESEARCH_AND_DEVELOPMENT];
	}

	const prodMult = (Math.pow(engrProd, 0.34) + Math.pow(opProd, 0.2)) * mgmtFactor;
	result.cycles = 10000 / prodMult;

	// Calculate properties
	const totalProd = jobData.total;
	const engrRatio = jobData.getProd(Jobs.ENGINEER) / totalProd;
	const mgmtRatio = jobData.getProd(Jobs.MANAGEMENT) / totalProd;
	const rndRatio = jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) / totalProd;
	const opsRatio = jobData.getProd(Jobs.OPERATIONS) / totalProd;
	const busRatio = jobData.getProd(Jobs.BUSINESS) / totalProd;

	const designMult = 1 + Math.pow(designInvest, 0.1) / 100;
	const balanceMult = 1.2 * engrRatio + 0.9 * mgmtRatio + 1.3 * rndRatio + 1.5 * opsRatio + busRatio;

	const futureResearch = division.researchPoints + 0.004 * Math.pow(sciProd, 0.5) * result.cycles * 5;
	const sciMult = 1 + Math.pow(futureResearch, industry.scienceFactor) / 800;
	const totalMult = balanceMult * designMult * sciMult;


	stats.quality =
		totalMult *
		(0.1 * jobData.getProd(Jobs.ENGINEER) +
			0.05 * jobData.getProd(Jobs.MANAGEMENT) +
			0.05 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.02 * jobData.getProd(Jobs.OPERATIONS) +
			0.02 * jobData.getProd(Jobs.BUSINESS));
	stats.performance =
		totalMult *
		(0.15 * jobData.getProd(Jobs.ENGINEER) +
			0.02 * jobData.getProd(Jobs.MANAGEMENT) +
			0.02 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.02 * jobData.getProd(Jobs.OPERATIONS) +
			0.02 * jobData.getProd(Jobs.BUSINESS));
	stats.durability =
		totalMult *
		(0.05 * jobData.getProd(Jobs.ENGINEER) +
			0.02 * jobData.getProd(Jobs.MANAGEMENT) +
			0.08 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.05 * jobData.getProd(Jobs.OPERATIONS) +
			0.05 * jobData.getProd(Jobs.BUSINESS));
	stats.reliability =
		totalMult *
		(0.02 * jobData.getProd(Jobs.ENGINEER) +
			0.08 * jobData.getProd(Jobs.MANAGEMENT) +
			0.02 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.05 * jobData.getProd(Jobs.OPERATIONS) +
			0.08 * jobData.getProd(Jobs.BUSINESS));
	stats.aesthetics =
		totalMult *
		(0.0 * jobData.getProd(Jobs.ENGINEER) +
			0.08 * jobData.getProd(Jobs.MANAGEMENT) +
			0.05 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.02 * jobData.getProd(Jobs.OPERATIONS) +
			0.1 * jobData.getProd(Jobs.BUSINESS));
	stats.features =
		totalMult *
		(0.08 * jobData.getProd(Jobs.ENGINEER) +
			0.05 * jobData.getProd(Jobs.MANAGEMENT) +
			0.02 * jobData.getProd(Jobs.RESEARCH_AND_DEVELOPMENT) +
			0.05 * jobData.getProd(Jobs.OPERATIONS) +
			0.05 * jobData.getProd(Jobs.BUSINESS));

	const weights = industry.product?.ratingWeights;
	result.rating = 0;
	for (const stat in weights) {
		result.rating += stats[stat] * weights[stat];
	}
	const advMult = 1 + Math.pow(adInvest, 0.1) / 100;
	const busmgtgRatio = Math.max(busRatio + mgmtRatio, 1 / totalProd);
	result.markup = 100 / (advMult * Math.pow(stats.quality + 0.001, 0.65) * busmgtgRatio);

	const markupLimit = Math.max(result.rating, 0.001) / result.markup;

	const demand =
		division.awareness === 0 ? 20 : Math.min(100, advMult * (100 * (division.popularity / division.awareness)));
	const competition = 35;
	const mFactor = Math.max(0.1, (demand * (100 - competition)) / 100);
	const advFac = industry.advertisingFactor;
	const aweFac = Math.pow(division.awareness + 1, advFac);
	const popFac = Math.pow(division.popularity + 1, advFac);
	const ratio = division.awareness === 0 ? 0.01 : Math.max((division.popularity + 0.001) / division.awareness, 0.01);
	const aFactor = Math.pow(aweFac * popFac * ratio, 0.85);
	const bProd = jobData.getProd(Jobs.BUSINESS);
	const bFactor = Math.pow(bProd, 0.26) + bProd / 10e3;
	const abcFactor = 1 + corp.getUpgradeLevel(Upgrades.ABC_SALESBOTS) / 100;

	const maxProd =
		0.5 *
		prod *
		division.productionMult *
		(1 + corp.getUpgradeLevel(Upgrades.SMART_FACTORIES) * 3 / 100) *
		sciBonus;

	const maxSell =
		0.5 *
		Math.pow(result.rating, 0.65) *
		aFactor *
		bFactor *
		mFactor *
		abcFactor;

	const divisor = Math.sqrt(maxProd / 10 / maxSell);
	const sSprice = (markupLimit / divisor + baseCost) * 0.95;

	result.weight = sSprice * maxProd;


	return result;
}

export class JobData {

	/** @param {NS} ns */
	constructor(ns, division, city) {
		const corp = ns.corporation;
		const office = corp.getOffice(division, city);
		for (const job of Object.values(Jobs)) {
			this[job] = { number: 0, productivity: 0 };
			this[job].number = office.employeeJobs[job];
			this[job].productivity = this[job].number ? office.employeeProductionByJob[job] / this[job].number : 0;
		}
	}

	get total() {
		let total = 0;
		for (const job of Object.values(this)) {
			total += job.productivity * job.number;
		}
		return total;
	}

	getProd(job) {
		return this[job].productivity * this[job].number;
	}
}