import { Config } from "scripts/hack/batch/lib/Config";

const MAX_SECURITY_DRIFT = 3 // This is how far from minimum security we allow the server to be before weakening
const MAX_MONEY_DRIFT_PCT = 0.1 // This is how far from 100% money we allow the server to be before growing (1-based percentage)
const DEFAULT_HACKPCT = 0.25 // This is the default 1-based percentage of money we want to hack from the server in a single pass
const GROW_THREAD_MULT = 1.02 // extra grow threads to be sure
const WEAKEN_THREAD_MULT = 1.02 // extra weaken threads to be sure
const MAX_BATCHES_PER_TARGET = 50
const MAX_TRIES_PER_LOOP = 50
const LOOP_DELAY = 5 * 1000
const BATCH_PHASE_DELAY = 300 // delay (in ms) between batch phase finishes (HWGW)
const SCRIPT_PREFIX = "batcher_"
const FINISHED_BATCH_LOGGING_SAMPLE_RATE = 0.2

type BatcherConfig = {
  maxTriesPerLoop: number
  loopDelay: number
  batchPhaseDelay: number
  defaultHackPct: number
  growThreadMult: number
  weakenThreadMult: number
  maxSecurityDrift: number
  maxMoneyDriftPct: number
  scriptPrefix: string
  finishedBatchLoggingSampleRate: number
  maxBatchPerTarget: number
}

export let defaultConfig:BatcherConfig = {
  maxTriesPerLoop: MAX_TRIES_PER_LOOP,
  loopDelay: LOOP_DELAY,
  batchPhaseDelay: BATCH_PHASE_DELAY,
  defaultHackPct: DEFAULT_HACKPCT,
  growThreadMult: GROW_THREAD_MULT,
  weakenThreadMult: WEAKEN_THREAD_MULT,
  maxSecurityDrift: MAX_SECURITY_DRIFT,
  maxMoneyDriftPct: MAX_MONEY_DRIFT_PCT,
  scriptPrefix: SCRIPT_PREFIX,
  finishedBatchLoggingSampleRate: FINISHED_BATCH_LOGGING_SAMPLE_RATE,
  maxBatchPerTarget: MAX_BATCHES_PER_TARGET,
}