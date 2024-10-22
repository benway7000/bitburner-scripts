const corp = ns.corporation;
for (const division of corp.getCorporation().divisions) {
    for (const city of corp.getDivision(division).cities) {
        const office = corp.getOffice(division, city);
        if (office.avgEnergy < 98) { corp.buyTea(division, city); }
        if (office.avgMorale < 98) { corp.throwParty(division, city, 5e5); }
    }
}