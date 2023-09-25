/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([["help", false]]);
    if (args.help) {
        ns.tprint("This script will enhance your HUD (Heads up Display) with custom statistics.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    
    // const doc = top.document; // This is expensive! (25GB RAM) Perhaps there's a way around it? ;)
    // let doc = undefined
    // for (let field in top) {
    //   if (field === "document") {
    //     doc = field
    //   }
    // }
    let doc = top["document"]
    // ns.tprint(doc)
    ns.tprint(ns.getTotalScriptIncome())
    // const doc 
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');
    while (true) {
        try {
            const headers = []
            const values = [];
            // Add script income per second
            headers.push("ScrInc");
            values.push(ns.formatNumber(ns.getTotalScriptIncome()[0], 2) + '/sec');
            // Add script exp gain rate per second
            headers.push("ScrExp");
            values.push(ns.formatNumber(ns.getTotalScriptExpGain(), 2) + '/sec');
            // TODO: Add more neat stuff

            // Now drop it into the placeholder elements
            hook0.innerText = headers.join(" \n");
            hook1.innerText = values.join("\n");
        } catch (err) { // This might come in handy later
            ns.print("ERROR: Update Skipped: " + String(err));
        }
        await ns.sleep(1000);
    }
}