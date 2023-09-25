/** @param {NS} ns */
export async function main(ns) {

  let max_depth = 5

  let already_crawled = []

  function crawl_server_tree(ns, server_name, depth) {
      if (server_name.startsWith("pserv")) {
        // ignore player-servers
        return
      }
      if (server_name === "home" && depth > 0) {
        // "home" is reported in scans for all(?) servers; ignore it
        return
      }
      if (already_crawled.includes(server_name)) {
        // already crawled this
        return
      }
      // action
      // ns.tprint("crawl_server_tree: " + server_name)
      let results = ns.ls(server_name,"cct")
      if (results.length > 0) {
        ns.tprint("Server " + server_name + " has files " + results)
      }
      already_crawled.push(server_name)

      // recurse server tree
      if (depth < max_depth) {
        let children = ns.scan(server_name);
        for (let child_name of children) {
          crawl_server_tree(ns, child_name, depth+1)
        }
      }
  }

  crawl_server_tree(ns, "home", 0)

}