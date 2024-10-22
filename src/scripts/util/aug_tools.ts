import { Multipliers, NS } from '@ns'
import { FactionName } from "bitburner/Faction/Enums"

/** @param {NS} ns */
export async function main(ns: NS) {

    const [cmd = "list", type = "all"] = ns.args


    // getAugmentationStats(name: string): Multipliers; 
    // let owned_augs = ns.singularity.getOwnedAugmentations(true)
    // GetAllAugs(ns).filter(aug => aug.type === type)
    //     .filter(aug => !owned_augs.includes(aug.name))
    //     .sort((a, b) => b.basePrice - a.basePrice)
    //     .forEach(aug => ns.tprintf(` $${ns.formatNumber(aug.basePrice)}:${aug.name}:${ns.singularity.getAugmentationFactions(aug.name)}`))
    // for (let aug of all_augs) {
    //     if (type === "all" || aug.type === type)
    //         ns.tprint(`${JSON.stringify(aug, null, 2)}`)
    //     // ns.tprint(`${JSON.stringify(ns.singularity.getAugmentationStats(aug.name), null, 2)}`)
    //     // break
    // }
    // ListFactionsForType(ns, type)
    switch (cmd) {
        case "buynfg":
            BuyNFGs(ns)
            break
        case "list":
            ListAugsToPurchase(ns, String(type))
            break
        default:
            ns.tprint(`Unknown command: ${cmd}`)
    }
}

function BuyNFGs(ns: NS) {
    ns.tprint(`Buying NFGs..`)
    let augName = "NeuroFlux Governor"
    let factions_can_buy_from = ns.singularity.getAugmentationFactions(augName)
        .sort((a,b) => ns.singularity.getFactionRep(b) - ns.singularity.getFactionRep(a))
    if (factions_can_buy_from.length) {
        let faction = factions_can_buy_from[0]
        ns.tprint(`Buying NFG from ${faction}`)
        ns.singularity.purchaseAugmentation(faction, augName)
    }
}

function ListAugsToPurchase(ns: NS, type: string) {
    let owned_augs = ns.singularity.getOwnedAugmentations(true)
    let augs = GetAllAugs(ns).filter(aug => aug.type === type || type === "all")
        .filter(aug => !owned_augs.includes(aug.name))
        .sort((a, b) => b.basePrice - a.basePrice)
    for (let aug of augs) {
        let factions_can_buy_from = ns.singularity.getAugmentationFactions(aug.name).filter(fac => ns.singularity.getFactionRep(fac) >= aug.repreq)
        if (factions_can_buy_from.length) {
            ns.tprintf(`$${ns.formatNumber(aug.basePrice)}\t:\t${aug.name}\t:\t${factions_can_buy_from}`)
        }
    }
}

function ListFactionsForType(ns: NS, type: string) {
    let all_augs = GetAllAugs(ns)
    for (let aug of all_augs) {
        if (type === "all" || aug.type === type) {
            ns.tprint(`${JSON.stringify(ns.singularity.getAugmentationStats(aug.name), null, 2)}`)
            break
            ns.tprint(`${aug.name}: ${ns.singularity.getAugmentationFactions(aug.name)}`)
        }
    }
}

function GetAllAugs(ns: NS) {
    let all_augs = []
    for (let faction of Object.values(FactionName)) {
        // ns.tprint(`Faction ${faction}`)
        for (let augName of ns.singularity.getAugmentationsFromFaction(faction)) {
            // find existing entry
            let existing_aug = all_augs.find(e => e.name === augName)
            // found, add faction to list
            if (existing_aug) {
                existing_aug.factions.push(faction)
            } else {
                // not found, create
                let new_aug = {
                    name: augName,
                    factions: [faction],
                    prereqs: ns.singularity.getAugmentationPrereq(augName),
                    repreq: ns.singularity.getAugmentationRepReq(augName),
                    basePrice: ns.singularity.getAugmentationBasePrice(augName),
                    currentPrice: ns.singularity.getAugmentationPrice(augName),
                    type: AugType(ns, augName)
                }
                all_augs.push(new_aug)
            }
        }
    }
    return all_augs
}

function AugType(ns: NS, augName: string) {
    const stats = ns.singularity.getAugmentationStats(augName);
    let keys = Object.keys(stats) as Array<keyof Multipliers>;
    //ns.tprint(keys, Object.values(stats));
    if (augName.startsWith('NeuroFlux')) return 'NeuroFlux';
    if (keys.find(s => s.startsWith('bladeburner') && stats[s] != 1.0)) return 'BladeBurner';
    if (augName == 'CashRoot Starter Kit') return 'Shit'
    if (keys.length == 0) return 'Special';
    if (keys.find(s => s.startsWith('faction_rep') && stats[s] != 1.0)) return 'Faction';
    if (keys.find(s => s.startsWith('hacknet') && stats[s] != 1.0)) return 'Hacknet';
    if (keys.find(s => s.startsWith('hacking_exp') && stats[s] != 1.0)) return 'HackingExp';
    if (keys.find(s => s.startsWith('hack') && stats[s] != 1.0)) return 'Hacking';
    if (keys.find(s => s.startsWith('charisma') && stats[s] != 1.0)) return 'Charisma';
    if (keys.find(s => s.startsWith('str') && stats[s] != 1.0)) return 'Physical';
    if (keys.find(s => s.startsWith('def') && stats[s] != 1.0)) return 'Physical';
    if (keys.find(s => s.startsWith('dex') && stats[s] != 1.0)) return 'Physical';
    if (keys.find(s => s.startsWith('agi') && stats[s] != 1.0)) return 'Physical';
    if (keys.find(s => s.startsWith('company') && stats[s] != 1.0)) return 'Company';
    return '???';
}
