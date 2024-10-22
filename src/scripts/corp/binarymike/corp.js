export async function main(ns) {
  ns.disableLog('ALL');
  ns.clearLog();
  ns.tail();
  const corpName = 'MikeCorp';
  const agName = 'MikeAg';
  const chemName = 'MikeChem';
  const tobaccoName = 'MikeTobacco';
  const tobaccoRD1Name = tobaccoName + "R&D1";
  const tobaccoRD2Name = tobaccoName + "R&D2";
  const tobaccoRD3Name = tobaccoName + "R&D3";
  const productOffice = 'Sector-12';
  const round1OfferMin = 3e11;
  const round2OfferMin = 1.6e12;
  const round3OfferMin = 1e13;
  const round4OfferMin = 1e14;
  let offersAccepted = 0;
  if (!ns.corporation.hasCorporation()) {
      if (!ns.corporation.createCorporation(corpName, false)) {
          ns.print('This script is made for BN3 only');
          ns.exit();
      }
  }
  if (!ns.scriptRunning('keephappy.js', 'home'))
      ns.run('keephappy.js');
  if (!ns.corporation.hasUnlock('Smart Supply'))
      ns.corporation.purchaseUnlock('Smart Supply');
  while (ns.corporation.getUpgradeLevel('Smart Storage') < 3)
      ns.corporation.levelUpgrade('Smart Storage');
  if (!ns.corporation.getCorporation().divisions.includes(agName)) {
      ns.print('Creating Agriculture division');
      createDivision(ns, 'Agriculture', agName, 5);
      await waitHappy(ns, agName);
      await waitState(ns, 'START');
      for (const city of ns.corporation.getDivision(agName).cities) {
          setJobs(ns, agName, city, 0.3, 0.3, 0.3, 0, 0, 0);
          buyMats(ns, agName, city);
      }
      await waitState(ns, 'SALE');
      for (const city of ns.corporation.getDivision(agName).cities) {
          buyMats(ns, agName, city, true);
          ns.corporation.sellMaterial(agName, city, 'Plants', 'MAX', 'MP');
          ns.corporation.sellMaterial(agName, city, 'Food', 'MAX', 'MP');
      }
      await waitAndAcceptInvestmentOffer(ns, round1OfferMin);
      offersAccepted++;
  }
  if (!ns.corporation.getCorporation().divisions.includes(chemName)) {
      ns.print('Creating Chemical division');
      createDivision(ns, 'Chemical', chemName, 5);
      await waitState(ns, 'START');
      for (const city of ns.corporation.getDivision(chemName).cities) {
          setJobs(ns, chemName, city, 0.3, 0.3, 0.3, 0, 0, 0);
          buyMats(ns, chemName, city);
      }
      await waitState(ns, 'SALE');
      for (const city of ns.corporation.getDivision(chemName).cities) {
          buyMats(ns, chemName, city, true);
          ns.corporation.sellMaterial(chemName, city, 'Chemicals', 'MAX', 'MP');
      }
      if (!ns.corporation.hasUnlock('Export'))
          ns.corporation.purchaseUnlock('Export');
      await waitState(ns, 'START');
      for (const city of ns.corporation.getDivision(agName).cities) {
          if (!ns.corporation.getMaterial(agName, city, 'Plants').exports.some((exp) => exp.division === chemName && exp.city === city && exp.amount === '(IPROD+IINV/10)*(-1)'))
              ns.corporation.exportMaterial(agName, city, chemName, city, 'Plants', '(IPROD+IINV/10)*(-1)');
          if (!ns.corporation.getMaterial(chemName, city, 'Chemicals').exports.some((exp) => exp.division === agName && exp.city === city && exp.amount === '(IPROD+IINV/10)*(-1)'))
              ns.corporation.exportMaterial(chemName, city, agName, city, 'Chemicals', '(IPROD+IINV/10)*(-1)');
      }
      let done = false;
      do {
          upgradeCorp(ns, 0.01, 0.01);
          await upgradeMaterialDivision(ns, agName, 1);
          await upgradeMaterialDivision(ns, chemName, 1);
          const offer = ns.corporation.getInvestmentOffer().funds;
          ns.print(`Want: ${ns.formatNumber(round2OfferMin, 2, 1e9)}, Offer of ${ns.formatNumber(offer, 2, 1e9)}`);
          if (offer >= round2OfferMin)
              done = true;
          await ns.sleep(1000);
      } while (!done);
      ns.print("Accepting investment offer");
      ns.corporation.acceptInvestmentOffer();
      offersAccepted++;
  }
  if (!ns.corporation.getCorporation().divisions.includes('MikeTobacco')) {
      ns.print('Creating Tobacco division');
      createDivision(ns, 'Tobacco', tobaccoName, 1);
      createDivision(ns, 'Tobacco', tobaccoRD1Name, 1);
      createDivision(ns, 'Tobacco', tobaccoRD2Name, 1);
      createDivision(ns, 'Tobacco', tobaccoRD3Name, 1);
      ns.corporation.upgradeOfficeSize(tobaccoName, productOffice, 57);
      while (ns.corporation.hireEmployee(tobaccoName, productOffice, 'Research & Development'))
          ;
      const tobaccoDivisions = [tobaccoName, tobaccoRD1Name, tobaccoRD2Name, tobaccoRD3Name];
      for (const divName of tobaccoDivisions) {
          for (const city of ns.corporation.getDivision(divName).cities) {
              if (!(divName === tobaccoName && city === productOffice)) {
                  ns.corporation.upgradeOfficeSize(divName, city, 6);
                  while (ns.corporation.hireEmployee(divName, city, 'Research & Development'))
                      ;
              }
          }
      }
  }
  if (!ns.corporation.hasResearched(tobaccoName, 'Market-TA.II') && ns.corporation.getDivision(tobaccoName).researchPoints < 75000) {
      ns.print('Waiting for Market-TA.II');
      while (!ns.corporation.hasResearched(tobaccoRD3Name, 'Market-TA.II')) {
          upgradeCorp(ns);
          await upgradeMaterialDivision(ns, agName);
          await upgradeMaterialDivision(ns, chemName);
          if (ns.corporation.getDivision(tobaccoRD1Name).researchPoints >= 5000 && !ns.corporation.hasResearched(tobaccoRD1Name, 'Hi-Tech R&D Laboratory')) {
              ns.corporation.research(tobaccoRD1Name, 'Hi-Tech R&D Laboratory');
          }
          if (ns.corporation.getDivision(tobaccoRD2Name).researchPoints >= 20000 && !ns.corporation.hasResearched(tobaccoRD2Name, 'Market-TA.I')) {
              ns.corporation.research(tobaccoRD2Name, 'Market-TA.I');
          }
          if (ns.corporation.getDivision(tobaccoRD2Name).researchPoints >= 50000 && !ns.corporation.hasResearched(tobaccoRD2Name, 'Market-TA.II')) {
              ns.corporation.research(tobaccoRD2Name, 'Market-TA.II');
          }
          if (ns.corporation.getInvestmentOffer().funds >= round3OfferMin && offersAccepted < 3) {
              ns.print("Accepting investment offer");
              ns.corporation.acceptInvestmentOffer();
              offersAccepted++;
          }
          await ns.sleep(100);
      }
      ns.print('Market-TA.II researched');
  }
  for (const city of ns.corporation.getDivision(agName).cities) {
      if (!ns.corporation.getMaterial(agName, city, 'Plants').exports.some((exp) => exp.division === tobaccoName && exp.city === city && exp.amount === '(IPROD+IINV/10)*(-1)'))
          ns.corporation.exportMaterial(agName, city, tobaccoName, city, 'Plants', '(IPROD+IINV/10)*(-1)');
  }
  for (const city of ns.corporation.getDivision(tobaccoName).cities) {
      if (city !== productOffice) {
          setResearchJobs(ns, tobaccoName, city);
      }
  }
  await upgradeProductDivision(ns, tobaccoName, productOffice, 0.01, 0.01, true);
  while (true) {
      upgradeCorp(ns);
      await upgradeMaterialDivision(ns, agName);
      await upgradeMaterialDivision(ns, chemName);
      await upgradeProductDivision(ns, tobaccoName, productOffice);
      if (ns.corporation.getCorporation().funds >= 1e11) {
          const div = ns.corporation.getDivision(tobaccoName);
          let makeProduct = true;
          const producstToSell = [];
          for (const productName of div.products) {
              const product = ns.corporation.getProduct(tobaccoName, productOffice, productName);
              if (product.developmentProgress < 100) {
                  makeProduct = false;
              }
              if (product.desiredSellPrice === "" && product.developmentProgress >= 100) {
                  producstToSell.push(productName);
              }
          }
          if (makeProduct) {
              if (div.products.length === div.maxProducts) {
                  const worstProductName = div.products.reduce((worstProductName, currentProductName) => {
                      const currentProduct = ns.corporation.getProduct(tobaccoName, productOffice, currentProductName);
                      const worstProduct = ns.corporation.getProduct(tobaccoName, productOffice, worstProductName);
                      if (currentProduct.effectiveRating < worstProduct.effectiveRating && currentProduct.desiredSellPrice !== "")
                          return currentProductName;
                      else
                          return worstProductName;
                  });
                  if (worstProductName !== "0") {
                      ns.print(`Discontinuing product ${worstProductName}`);
                      ns.corporation.discontinueProduct(tobaccoName, worstProductName);
                  }
              }
              const currentDateTime = new Date();
              const productName = currentDateTime.toISOString();
              const marketingAndDesignInvest = ns.corporation.getCorporation().funds * 0.01;
              ns.print(`Creating product ${productName} with ${ns.formatNumber(marketingAndDesignInvest, 2, 1e9)} marketing and design investment`);
              ns.corporation.makeProduct(tobaccoName, productOffice, productName, marketingAndDesignInvest, marketingAndDesignInvest);
          }
          if (producstToSell.length > 0) {
              for (const productName of producstToSell) {
                  ns.print(`Selling product: ${productName}`);
                  ns.corporation.setProductMarketTA2(tobaccoName, productName, true);
                  ns.corporation.sellProduct(tobaccoName, productOffice, productName, 'MAX', 'MP', true);
              }
          }
      }
      if (offersAccepted < 4 && ns.corporation.getInvestmentOffer().funds >= round4OfferMin) {
          ns.print("Accepting investment offer");
          ns.corporation.acceptInvestmentOffer();
          offersAccepted++;
      }
      if (ns.corporation.getCorporation().funds > 1e18 && !ns.corporation.getCorporation().public) {
          ns.corporation.goPublic(1e7);
          ns.corporation.issueDividends(0.5);
      }
  }
  ns.print("Done.");
}
function upgradeCorp(ns, wilsonPurchaseThresholdFactor = 0.01, purchaseThresholdFactor = 0.01) {
  let done = true;
  do {
      done = true;
      for (const unlock of ns.corporation.getConstants().unlockNames) {
          const purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
          if (!ns.corporation.hasUnlock(unlock) && ns.corporation.getUnlockCost(unlock) <= purchaseThreshold)
              ns.corporation.purchaseUnlock(unlock);
      }
      for (const upgrade of ns.corporation.getConstants().upgradeNames) {
          let purchaseThreshold = ns.corporation.getCorporation().funds * (upgrade === 'Wilson Analytics' ? wilsonPurchaseThresholdFactor : purchaseThresholdFactor);
          if (ns.corporation.getUpgradeLevelCost(upgrade) <= purchaseThreshold)
              ns.corporation.levelUpgrade(upgrade);
          purchaseThreshold = ns.corporation.getCorporation().funds * (upgrade === 'Wilson Analytics' ? wilsonPurchaseThresholdFactor : purchaseThresholdFactor);
          if (ns.corporation.getUpgradeLevelCost(upgrade) <= purchaseThreshold)
              done = false;
      }
  } while (!done);
}
async function upgradeMaterialDivision(ns, divName, purchaseThresholdFactor = 0.01) {
  let done = true;
  do {
      done = true;
      let purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
      if (ns.corporation.getHireAdVertCost(divName) <= purchaseThreshold) {
          ns.corporation.hireAdVert(divName);
          purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
          if (ns.corporation.getHireAdVertCost(divName) <= purchaseThreshold)
              done = false;
      }
      for (const city of ns.corporation.getDivision(divName).cities) {
          purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
          if (ns.corporation.getOfficeSizeUpgradeCost(divName, city, 1) <= purchaseThreshold) {
              ns.corporation.upgradeOfficeSize(divName, city, 1);
              purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
              if (ns.corporation.getOfficeSizeUpgradeCost(divName, city, 1) <= purchaseThreshold)
                  done = false;
          }
          if (ns.corporation.getUpgradeWarehouseCost(divName, city) <= purchaseThreshold) {
              ns.corporation.upgradeWarehouse(divName, city);
              purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
              if (ns.corporation.getUpgradeWarehouseCost(divName, city) <= purchaseThreshold)
                  done = false;
          }
      }
  } while (!done);
  await waitState(ns, 'START');
  for (const city of ns.corporation.getDivision(divName).cities) {
      while (ns.corporation.hireEmployee(divName, city, 'Research & Development'))
          ;
      setJobs(ns, divName, city, 0.06, 0.3, 0.08, 0.56, 0, 0);
      buyMats(ns, divName, city);
  }
  await waitState(ns, 'SALE');
  for (const city of ns.corporation.getDivision(divName).cities) {
      buyMats(ns, divName, city, true);
  }
}
async function upgradeProductDivision(ns, divName, productOffice, adVertPurchaseThresholdFactor = 0.1, purchaseThresholdFactor = 0.01, forceJobsAndMats = false) {
  let done = true;
  let upgradedOfficeSize = false;
  let upgradedWarehouse = false;
  do {
      done = true;
      let purchaseThreshold = ns.corporation.getCorporation().funds * adVertPurchaseThresholdFactor;
      if (ns.corporation.getHireAdVertCost(divName) <= purchaseThreshold) {
          ns.corporation.hireAdVert(divName);
          purchaseThreshold = ns.corporation.getCorporation().funds * adVertPurchaseThresholdFactor;
          if (ns.corporation.getHireAdVertCost(divName) <= purchaseThreshold)
              done = false;
      }
      purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
      if (ns.corporation.getOfficeSizeUpgradeCost(divName, productOffice, 1) <= purchaseThreshold) {
          ns.corporation.upgradeOfficeSize(divName, productOffice, 1);
          upgradedOfficeSize = true;
          purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
          if (ns.corporation.getOfficeSizeUpgradeCost(divName, productOffice, 1) <= purchaseThreshold)
              done = false;
      }
      if (ns.corporation.getUpgradeWarehouseCost(divName, productOffice) <= purchaseThreshold) {
          ns.corporation.upgradeWarehouse(divName, productOffice);
          upgradedWarehouse = true;
          purchaseThreshold = ns.corporation.getCorporation().funds * purchaseThresholdFactor;
          if (ns.corporation.getUpgradeWarehouseCost(divName, productOffice) <= purchaseThreshold)
              done = false;
      }
  } while (!done);
  if (upgradedOfficeSize || upgradedWarehouse || forceJobsAndMats)
      await waitState(ns, 'START');
  if (upgradedOfficeSize || forceJobsAndMats) {
      while (ns.corporation.hireEmployee(divName, productOffice, 'Research & Development'))
          ;
      setJobs(ns, divName, productOffice, 0.06, 0.3, 0.08, 0.56, 0, 0);
  }
  if (upgradedWarehouse || forceJobsAndMats) {
      buyMats(ns, divName, productOffice);
      await waitState(ns, 'SALE');
      buyMats(ns, divName, productOffice, true);
  }
}
function createDivision(ns, industryType, divisionName, warehouseLevel) {
  ns.corporation.expandIndustry(industryType, divisionName);
  ns.corporation.hireAdVert(divisionName);
  ns.corporation.hireAdVert(divisionName);
  const cities = Object.values(ns.enums.CityName);
  for (const city of cities) {
      if (!ns.corporation.getDivision(divisionName).cities.includes(city))
          ns.corporation.expandCity(divisionName, city);
      if (!ns.corporation.hasWarehouse(divisionName, city))
          ns.corporation.purchaseWarehouse(divisionName, city);
      while (ns.corporation.hireEmployee(divisionName, city, 'Research & Development'))
          ;
      while (ns.corporation.getWarehouse(divisionName, city).level < warehouseLevel)
          ns.corporation.upgradeWarehouse(divisionName, city);
      ns.corporation.setSmartSupply(divisionName, city, true);
  }
}
async function waitHappy(ns, divName) {
  let done = false;
  do {
      done = true;
      for (const city of ns.corporation.getDivision(divName).cities) {
          const { avgEnergy, avgMorale } = ns.corporation.getOffice(divName, city);
          if (avgMorale < 99 || avgEnergy < 99)
              done = false;
      }
      await waitState(ns, 'START', true);
  } while (!done);
}
function setResearchJobs(ns, divName, city) {
  const officeEmployees = ns.corporation.getOffice(divName, city).numEmployees;
  ns.corporation.setAutoJobAssignment(divName, city, 'Research & Development', officeEmployees - 2);
  ns.corporation.setAutoJobAssignment(divName, city, 'Operations', 1);
  ns.corporation.setAutoJobAssignment(divName, city, 'Business', 1);
}
function setJobs(ns, divName, city, opsFactor, engFactor, busFactor, manFactor, radFactor, intFactor) {
  const officeEmployees = ns.corporation.getOffice(divName, city).numEmployees;
  let numEmployees = officeEmployees;
  ns.corporation.setAutoJobAssignment(divName, city, 'Operations', 0);
  ns.corporation.setAutoJobAssignment(divName, city, 'Engineer', 0);
  ns.corporation.setAutoJobAssignment(divName, city, 'Business', 0);
  ns.corporation.setAutoJobAssignment(divName, city, 'Management', 0);
  ns.corporation.setAutoJobAssignment(divName, city, 'Research & Development', 0);
  ns.corporation.setAutoJobAssignment(divName, city, 'Intern', 0);
  let opsEmployees = Math.round(numEmployees * opsFactor);
  let engEmployees = Math.round(numEmployees * engFactor);
  let busEmployees = Math.round(numEmployees * busFactor);
  let manEmployees = Math.round(numEmployees * manFactor);
  let radEmployees = Math.round(numEmployees * radFactor);
  let intEmployees = Math.round(numEmployees * intFactor);
  const mostEmployees = Math.max(opsEmployees, engEmployees, busEmployees, manEmployees, radEmployees, intEmployees);
  if (opsEmployees < 1)
      opsEmployees = 1;
  numEmployees -= opsEmployees;
  if (engEmployees < 1)
      engEmployees = 1;
  numEmployees -= engEmployees;
  if (busEmployees < 1)
      busEmployees = 1;
  numEmployees -= busEmployees;
  if (manEmployees < 1 && officeEmployees > 3)
      manEmployees = 1;
  numEmployees -= manEmployees;
  numEmployees -= radEmployees;
  numEmployees -= intEmployees;
  if (numEmployees !== 0) {
      if (mostEmployees === opsEmployees)
          opsEmployees += numEmployees;
      else if (mostEmployees === engEmployees)
          engEmployees += numEmployees;
      else if (mostEmployees === busEmployees)
          busEmployees += numEmployees;
      else if (mostEmployees === manEmployees)
          manEmployees += numEmployees;
      else if (mostEmployees === radEmployees)
          radEmployees += numEmployees;
      else if (mostEmployees === intEmployees)
          intEmployees += numEmployees;
  }
  ns.corporation.setAutoJobAssignment(divName, city, 'Operations', opsEmployees);
  ns.corporation.setAutoJobAssignment(divName, city, 'Engineer', engEmployees);
  ns.corporation.setAutoJobAssignment(divName, city, 'Business', busEmployees);
  ns.corporation.setAutoJobAssignment(divName, city, 'Management', manEmployees);
  ns.corporation.setAutoJobAssignment(divName, city, 'Research & Development', radEmployees);
  ns.corporation.setAutoJobAssignment(divName, city, 'Intern', intEmployees);
}
function buyMats(ns, divName, city, setToZero = false, warehouseSpaceFactor = 0.86) {
  let mats = [0, 0, 0, 0];
  if (!setToZero)
      mats = optimizeCorpoMaterials(ns, divName, ns.corporation.getWarehouse(divName, city).size * warehouseSpaceFactor);
  const aiCoresToBuy = Math.max(0, mats[0] - ns.corporation.getMaterial(divName, city, 'AI Cores').stored) / 10;
  const hardwareToBuy = Math.max(0, mats[1] - ns.corporation.getMaterial(divName, city, 'Hardware').stored) / 10;
  const realEstateToBuy = Math.max(0, mats[2] - ns.corporation.getMaterial(divName, city, 'Real Estate').stored) / 10;
  const robotsToBuy = Math.max(0, mats[3] - ns.corporation.getMaterial(divName, city, 'Robots').stored) / 10;
  ns.corporation.buyMaterial(divName, city, 'AI Cores', aiCoresToBuy);
  ns.corporation.buyMaterial(divName, city, 'Hardware', hardwareToBuy);
  ns.corporation.buyMaterial(divName, city, 'Real Estate', realEstateToBuy);
  ns.corporation.buyMaterial(divName, city, 'Robots', robotsToBuy);
}
async function waitAndAcceptInvestmentOffer(ns, minOffer) {
  let currentOffer = 0;
  while (currentOffer < minOffer) {
      await waitState(ns, 'START', true);
      currentOffer = ns.corporation.getInvestmentOffer().funds;
      ns.print(`Offer of ${ns.formatNumber(currentOffer, 2, 1e9)}`);
  }
  ns.print(`Accepting offer of ${ns.formatNumber(currentOffer, 2, 1e9)}`);
  ns.corporation.acceptInvestmentOffer();
}
export async function waitState(ns, state, onpoint = false) {
  while (ns.corporation.getCorporation().state !== state)
      await ns.asleep(100);
  if (onpoint)
      while (ns.corporation.getCorporation().state == state)
          await ns.asleep(100);
}
function optimizeCorpoMaterials(ns, div, spaceConstraint, round = true) {
  const type = ns.corporation.getDivision(div).type;
  const data = ns.corporation.getIndustryData(type);
  const factors = [data.aiCoreFactor ?? 0, data.hardwareFactor ?? 0, data.realEstateFactor ?? 0, data.robotFactor ?? 0];
  const weights = ['AI Cores', 'Hardware', 'Real Estate', 'Robots'].map((mat) => ns.corporation.getMaterialData(mat).size);
  return optimizeCorpoMaterials_raw(weights, factors, spaceConstraint, round);
}
function optimizeCorpoMaterials_raw(weights, factors, spaceConstraint, round = true) {
  const p = factors.reduce((a, b) => a + b, 0);
  const w = weights.reduce((a, b) => a + b, 0);
  const r = [];
  for (let i = 0; i < weights.length; ++i) {
      let m = (spaceConstraint - 500 * ((weights[i] / factors[i]) * (p - factors[i]) - (w - weights[i]))) / (p / factors[i]) / weights[i];
      if (factors[i] <= 0 || m < 0) {
          const rw = weights.slice();
          const rf = factors.slice();
          rw.splice(i, 1);
          rf.splice(i, 1);
          const rr = optimizeCorpoMaterials_raw(rw, rf, spaceConstraint, round);
          rr.splice(i, 0, 0);
          return rr;
      }
      else {
          if (round)
              m = Math.round(m);
          r.push(m);
      }
  }
  return r;
}
