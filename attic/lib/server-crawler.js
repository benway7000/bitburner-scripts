export class ServerCrawler {

  /** @param {NS} ns */
  constructor(ns, max_depth = 5) {
    this.ns = ns;
    this.reset(max_depth)
  }

  reset(max_depth = 5) {
    this.servers_scanned = []
    this.servers_scripting = []
    this.max_depth = max_depth;
  }

  /**
   * server_crawler_action: instance of ServerCrawlerAction whose
   *   action(ns, server_name) func will be called on each server. 
   *   can bind a function to have your own args
   */
  start_crawl(starting_server_name, server_crawler_action) {
    return this.#crawl_server_tree(starting_server_name, server_crawler_action, 0)
  }

  #crawl_server_tree(server_name, server_crawler_action, cur_depth = 0) {
    if (server_name.startsWith("pserv")) {
      // ignore player-servers
      return
    }
    if (server_name === "home" && cur_depth > 0) {
      // "home" is reported in scans for all(?) servers; ignore it
      return
    }
    if (this.servers_scanned.includes(server_name)) {
      // already crawled this
      return
    }      
    // action
    // ns.tprint("crawl_server: " + server_name)
    this.servers_scanned.push(server_name)
    if (server_crawler_action.action(this.ns, server_name)) {
      this.servers_scripting.push(server_name)
    }

    // recurse server tree
    if (cur_depth < this.max_depth) {
      let children = this.ns.scan(server_name);
      // ns.tprint("crawl_server: children of " + server_name + ": " + children)
      for (let child_name of children) {
        this.#crawl_server_tree(child_name, server_crawler_action, cur_depth+1)
      }
    }
  }
}
