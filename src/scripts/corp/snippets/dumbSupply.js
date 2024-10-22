function dumbSupply() {
  const corp = this.corp;
  const divs = corp.getCorporation().divisions;
  for (const divName of divs) {
      const div = corp.getDivision(divName);
      const industry = corp.getIndustryData(div.type);
      for (const city of div.cities) {
          const office = corp.getOffice(divName, city);
          const opProd = office.employeeProductionByJob.Operations || 0;
          const engrProd = office.employeeProductionByJob.Engineer || 0;
          const mgmtProd = office.employeeProductionByJob.Management || 0;
          const totalProd = opProd + engrProd + mgmtProd;
          if (totalProd === 0) continue;
          const mgmtFactor = 1 + mgmtProd / (1.2 * totalProd);
          const prod = (Math.pow(opProd, 0.4) + Math.pow(engrProd, 0.3)) * mgmtFactor * 0.05;
          const tProd =
              prod *
              div.productionMult *
              (1 + corp.getUpgradeLevel("Smart Factories") * 3 / 100)
              // * research multipliers, once I figure out how to access them.
              ;
          const required = industry.requiredMaterials;
          for (const [mat, amount] of Object.entries(required)) {
              const stored = corp.getMaterial(divName, city, mat).stored / 10;
              const needed = Math.max(amount * tProd - stored, 0);
              corp.buyMaterial(divName, city, mat, needed);
          }
      }
  }
}