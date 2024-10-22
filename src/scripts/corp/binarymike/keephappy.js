import { waitState } from 'corp.js';
export async function main(ns) {
    ns.disableLog('ALL');
    ns.clearLog();
    do {
        for (const divName of ns.corporation.getCorporation().divisions) {
            for (const city of ns.corporation.getDivision(divName).cities) {
                const { avgEnergy, avgMorale } = ns.corporation.getOffice(divName, city);
                if (avgEnergy < 99)
                    ns.corporation.buyTea(divName, city);
                if (avgMorale < 99.5)
                    ns.corporation.throwParty(divName, city, avgMorale > 99 ? 1e5 : 1e6);
            }
        }
        await waitState(ns, 'START', true);
    } while (true);
}