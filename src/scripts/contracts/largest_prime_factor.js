/** @param {NS} ns */
export async function main(ns) {


// https://www.geeksforgeeks.org/find-largest-prime-factor-number/
  function maxPrimeFactor(n) {
      let maxPrime = -1;
      while(n % 2 == 0) {
          n = n / 2;
          maxPrime = 2;
      }
  
      while(n % 3 == 0) {
          n = n / 3;
          maxPrime = 3;
      }
  
      for (let i = 5; i <= Math.sqrt(n); i += 6) {
          while (n % i == 0) {
              maxPrime = i;
              n = n / i;
          }
          while (n % (i + 2) == 0) {
              maxPrime = i + 2;
              n = n / (i + 2);
          }
      }
      
      return n > 4 ? n : maxPrime;
  }

  let prime = 15
  ns.tprint("Largest prime factor of " + prime + " is " + maxPrimeFactor(prime))
  prime = 428416540
  ns.tprint("Largest prime factor of " + prime + " is " + maxPrimeFactor(prime))
}