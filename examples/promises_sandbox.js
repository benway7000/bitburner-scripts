const state = {
  stop: false
}

/** @param {NS} ns */
export async function main(ns) {

/**
 * This script is a prototype for v2.js.
 * It's about getting the Promise chaining to work
 */

  let targets = ["promise1"]
  let i = 1
  while (true) {
    let promises = []
    state.stop = false
    ns.tprint("starting " + targets.length + " foo's")
    for (let target of targets) {
      // promises.push(foo(ns, target).then((val) => {ns.tprint(target + ": " + val);return val}))
      promises.push(foo(ns, target))
    }
    let result = await Promise.any(promises)
    // ns.tprint(result)
    if (result == "more") {
      ns.tprint("adding target: promise" + ++i)
      targets.push("promise" + i)
      state.stop = true
      await Promise.all(promises)
    } else if (result == "less") {
      if (targets.length > 1) {
        let removed = targets.pop()
        --i
        ns.tprint("removed target: " + removed)
        state.stop = true
        await Promise.all(promises)
      } else {
        // only 1 target, can't do anything about it so keep going
      }
    }
  }
}

async function foo(ns, name) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // We fulfill the promise
      let rand = Math.random()
      if (rand < 0.9) {
        resolve("same")
      } else if (rand < 0.94) {
        resolve("less")
      } else {
        resolve("more")
      }
    }, 2000)
  }).then((val) => {
    if (val == "same") {
      if (state.stop) {
        ns.tprint(name + ": same, but state says to stop. returning " + val)
        return val
      }
      ns.tprint(name + ": same, keep going. return promise")
      return foo(ns, name)
    } else {
      ns.tprint(name + ": foo done with val " + val)
      return val
    }
  })
}
