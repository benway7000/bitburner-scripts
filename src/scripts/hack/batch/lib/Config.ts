const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_HACKPCT = 0.25 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.2 // extra grow threads to be sure
const MAX_ACTIVE_CYCLES = 500
const MAX_TRIES_PER_LOOP = 50
const LOOP_DELAY = 3 * 1000
const BATCH_PHASE_DELAY = 300 // delay (in ms) between batch phase finishes (HWGW)


export class Config {
  static maxTriesPerLoop: number = MAX_TRIES_PER_LOOP
  static loopDelay: number = LOOP_DELAY
  static batchPhaseDelay: number = BATCH_PHASE_DELAY
  static defaultHackPct: number = DEFAULT_HACKPCT
  static growThreadMult: number = GROW_THREAD_MULT
  static maxSecurityDrift: number = MAX_SECURITY_DRIFT
  static maxMoneyDriftPct: number = MAX_MONEY_DRIFT_PCT
  static scriptPrefix: string = "batch_"
}
