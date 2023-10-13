# my notes

## CorpoFactions to get hacking exp

- Bachman & Associates (Aevum), up to 375k for SmartJaw
- Clarke Incorporated (Aevum), up to 437.5k for nextSENS Gene Modification
- OmniTek Incorporated (Volhaven), up to 625k OmniTek InfoLoad
- NWO (Volhaven), up to 875k Xanipher

- Four Sigma (Sector-12): do not need, has dupes of Clarke and OmniTek (which have other augs we do want)


# TODO

- batch hack
    - tries to prep new target when old is still prepping
    - when hack skill increasing, we change targets rapidly
        - need to cancel preps
    - on target switch, can we run batches on old target until we prep the new target?
        - prep can use a lot of ram
    - log output sucks - no idea what's going on. can we use the log window as a status thing for targets?
    - unify Config ?  how about Sitrep too?  One big master script/static/global that collates all config/status info?
        - try object literal pattern (export const SessionState = {...}). modules are singletons
- ctree: summary of servers with cycles

# TODO DONE

- singularity rewrites
    - programs.js
    - backdoor.js
- rewrite xp hack using share/share-forever pattern
- batch hack
    - need low-ram mode, main script should not stay running
    - pre-calc ram usage of a cycle and only start if it's ok
        - have to reserve it somehow
    - focus on high-priority targets instead of max spread (deep vs wide)
    - also, re-calc with smaller hackPct when ram is too little
- contracts
- infiltrations
