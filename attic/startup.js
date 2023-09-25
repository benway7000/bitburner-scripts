/** @param {NS} ns */
export async function main(ns) {

    let hack_script = "/scripts/hack/early-hack-template.js"
    let target = "joesguns"
    // accept a target as first arg
    if (ns.args.length > 0) {
      target = ns.args[0];
    }


    // todo
    // how to have consts across scripts (ie hack_script variable)
    // get target in each script from the find-hack-target script
    // calc server list dynamically, hack all servers that we can
    // wait for brute and ftp? then re-scan?

    // Array of all servers that don't need any ports opened
    // to gain root access. These have 16 GB of RAM
    const servers0Port = ["foodnstuff",
                        "nectar-net",
                        "sigma-cosmetics",
                        "joesguns",
                        "hong-fang-tea",
                        "harakiri-sushi"];

    // Array of all servers that only need 1 port opened
    // to gain root access. These have 32 GB of RAM
    const servers1Port = ["max-hardware",
                        "neo-net",
                        "zer0",
                        "iron-gym"];

    // Array of all servers that only need 2 port opened
    // to gain root access. These have 32 GB of RAM
    const servers2Port = ["silver-helix",
                        "phantasy"];

    // Copy our scripts onto each server that requires 0 ports
    // to gain root access. Then use nuke() to gain admin access and
    // run the scripts.
    for (let i = 0; i < servers0Port.length; ++i) {
        const serv = servers0Port[i];

        ns.scp(hack_script, serv);
        ns.nuke(serv);
        ns.exec(hack_script, serv, 6, target);
    }

    // Wait until we acquire the "BruteSSH.exe" program
    while (!ns.fileExists("BruteSSH.exe")) {
        await ns.sleep(60000);
    }

    // Copy our scripts onto each server that requires 1 port
    // to gain root access. Then use brutessh() and nuke()
    // to gain admin access and run the scripts.
    for (let i = 0; i < servers1Port.length; ++i) {
        const serv = servers1Port[i];

        ns.scp(hack_script, serv);
        ns.brutessh(serv);
        ns.nuke(serv);
        ns.exec(hack_script, serv, 12, target);
    }

    // // Wait until we acquire the "FTPCrack.exe" program
    // while (!ns.fileExists("FTPCrack.exe")) {
    //     await ns.sleep(60000);
    // }

    // for (let i = 0; i < servers2Port.length; ++i) {
    //     const serv = servers2Port[i];

    //     ns.scp(hack_script, serv);
    //     ns.brutessh(serv);
    //     ns.ftpcrack(serv);
    //     ns.nuke(serv);
    //     ns.exec(hack_script, serv, 12);
    // }
}
