# my notes

# TODO

- batch hack
    - don't split grow/hack across servers because part will land, changing security for the rest
    - don't use sleep in worker script, pass in the 'additionalMsec' param instead to ns.grow/weaken/hack
    - tries to prep new target when old is still prepping
    - when hack skill increasing, we change targets rapidly
        - need to cancel preps
    - on target switch, can we run batches on old target until we prep the new target?
        - prep can use a lot of ram
    - log output sucks - no idea what's going on. can we use the log window as a status thing for targets?
    - unify Config ?  how about Sitrep too?  One big master script/static/global that collates all config/status info?
        - try object literal pattern (export const SessionState = {...}). modules are singletons

# TODO DONE

- batch hack
    - need low-ram mode, main script should not stay running
    - pre-calc ram usage of a cycle and only start if it's ok
        - have to reserve it somehow
    - focus on high-priority targets instead of max spread (deep vs wide)
    - also, re-calc with smaller hackPct when ram is too little
