import { FactionName } from "bitburner/Faction/Enums"

/** @param {NS} ns */
export async function main(ns) {

    const [type = "all"] = ns.args

    // getAugmentationStats(name: string): Multipliers; 
    let owned_augs = ns.singularity.getOwnedAugmentations(true)
    GetAllAugs(ns).filter(aug=>aug.type === type).filter(aug=>!owned_augs.includes(aug.name)).forEach(aug => ns.tprint(`${aug.name}: ${ns.singularity.getAugmentationFactions(aug.name)}`))
    // for (let aug of all_augs) {
    //     if (type === "all" || aug.type === type)
    //         ns.tprint(`${JSON.stringify(aug, null, 2)}`)
    //     // ns.tprint(`${JSON.stringify(ns.singularity.getAugmentationStats(aug.name), null, 2)}`)
    //     // break
    // }
    // ListFactionsForType(ns, type)
}

function ListFactionsForType(ns, type) {
    let all_augs = GetAllAugs(ns)
    for (let aug of all_augs) {
        if (type === "all" || aug.type === type) {
            ns.tprint(`${JSON.stringify(ns.singularity.getAugmentationStats(aug.name), null, 2)}`)
            break
            ns.tprint(`${aug.name}: ${ns.singularity.getAugmentationFactions(aug.name)}`)
        }
    }   
}

function GetAllAugs(ns) {
    let all_augs = []
    for (let faction of Object.values(FactionName)) {
        // ns.tprint(`Faction ${faction}`)
        for (let aug of ns.singularity.getAugmentationsFromFaction(faction)) {
            // find existing entry
            let existing_aug = all_augs.find(e => e.name === aug)
            // found, add faction to list
            if (existing_aug) {
                existing_aug.factions.push(faction)
            } else {
                // not found, create
                let new_aug = {
                    name: aug,
                    factions: [faction],
                    prereqs: ns.singularity.getAugmentationPrereq(aug),
                    repreq: ns.singularity.getAugmentationRepReq(aug),
                    basePrice: ns.singularity.getAugmentationBasePrice(aug),
                    currentPrice: ns.singularity.getAugmentationPrice(aug),
                    type: AugType(ns, aug)
                }
                all_augs.push(new_aug)
            }
        }
    }
    return all_augs
}

function AugType(ns, aug) {
    const stats = ns.singularity.getAugmentationStats(aug);
    let keys = Object.keys(stats);
    //ns.tprint(keys, Object.values(stats));
    if (aug.startsWith('NeuroFlux')) return 'NeuroFlux';
    if (keys.find(s => s.startsWith('bladeburner') && stats[s] != 1.0)) return 'BladeBurner';
    if (aug == 'CashRoot Starter Kit') return 'Shit'
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
