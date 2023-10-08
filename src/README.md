# my notes

## CorpoFactions to get hacking exp

- Bachman & Associates (Aevum), up to 375k for SmartJaw
- Clarke Incorporated (Aevum), up to 437.5k for nextSENS Gene Modification
- OmniTek Incorporated (Volhaven), up to 625k OmniTek InfoLoad
- NWO (Volhaven), up to 875k Xanipher

- Four Sigma (Sector-12): do not need, has dupes of Clarke and OmniTek (which have other augs we do want)


# TODO

- batch hack
    - when hack skill increasing, we change targets rapidly
    - on target switch, can we run batches on old target until we prep the new target?
    - log output sucks - no idea what's going on. can we use the log window as a status thing for targets?
    - unify Config ?  how about Sitrep too?  One big master script/static/global that collates all config/status info?
        - try object literal pattern (export const SessionState = {...}). modules are singletons
- ctree: summary of servers with cycles
- contracts
- infiltrations

# TODO DONE

- singularity rewrites
    - programs.js
    - backdoor.js
- rewrite xp hack using share/share-forever pattern
- batch hack
    - pre-calc ram usage of a cycle and only start if it's ok
        - have to reserve it somehow
    - focus on high-priority targets instead of max spread (deep vs wide)
