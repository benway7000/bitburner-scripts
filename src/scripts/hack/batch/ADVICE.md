============================================================
============================================================
============================================================
this is exactly why lower hack percents actually make you more money btw. because grow threads increase exponentially instead of linearly like hack and weaken threads
============================================================
There are ways to make it accurate, but the real issue is that there's some wobble with the JS engine itself that is uncontrollable.
So the tighter the timings are, no matter how precisely you can measure the delays, the more unstable it will become.
Since the best you can do is know ahead of time that the delay was too much.
The secret sauce here, is that if you know when and how to measure it, you can always be 100% certain of when an active HGW script is going to finish.
ghkbrew
 — 
09/28/2023 12:26 PM
what like performance.now() right before calling hack()?
DarkTechnomancer
 — 
09/28/2023 12:26 PM
It's actually after
You call the hack function without awaiting it, then do performance.now(), then await the promise.
ghkbrew
 — 
09/28/2023 12:28 PM

const p = ns.hack();
const start_time = performance.now();
const end_time = start_time + hack_length;
port.write(end_time);
await p;

 
essentially?
DarkTechnomancer
 — 
09/28/2023 12:30 PM
Yeah
At that point, end_time should be sub-ms accurate.
ghkbrew
 — 
09/28/2023 12:31 PM
then add targeted end times?

const delay = end_time_target - hack_length - performance.now();
const p = ns.hack(target, {additionalMsec: delay});
const start_time = performance.now();
const end_time = start_time + hack_length;
port.write(end_time);
await p;

DarkTechnomancer
 — 
09/28/2023 12:33 PM
That's up to implementation. I like to target end times, but that's entirely user preference.
Just be careful with that particular code, since additionalMsec will crash quite noisily if you give it a negative number.
Not fun when 40k scripts all throw errors at you.
ghkbrew
 — 
09/28/2023 12:34 PM
abort the hack if delay is negative then?
DarkTechnomancer
 — 
09/28/2023 12:35 PM
What I do is start the script anyway with 0 delay, then report the difference to the controller and have it decide how to handle things from there.
If it's within that 5ms safety window, no problem.
Otherwise, death.
ghkbrew
 — 
09/28/2023 12:37 PM
hmm ok
so with this method you can keep 10s of thousands of concurrent batches up?
DarkTechnomancer
 — 
09/28/2023 12:40 PM
Yeah
Although after a point, the 5ms spacing ends up reducing time efficiency enough that you lose the advantage of the RAM efficiency and shotgun becomes the better option.
It depends on how long the hack time is.
ghkbrew
 — 
09/28/2023 12:41 PM
10k batches, 30k processes, so 150s min cycle length with 5ms launch windows
DarkTechnomancer
 — 
09/28/2023 12:45 PM
The simple rule is this: if hack time / number of batches is less than your batcher's minimum stable spacer (say 5ms) then shotgun is better.
Or for HGW, since the numbers don't like up quite so conveniently weaken time / 3 * number of batches

============================================================
for ports:
use await nextWrite()

the worker can just use ns.pid and the batcher can just use the return value of ns.exec()
============================================================
but with shotgun batchers you don't need that spacer at all, because setTimeouts will end in the order they were created in
so you can just spam all of the jobs with no delay between them at all
and they will still end in the right order

with a shotgun batcher you can just do 

for(let i = 0; i < batchCount; i++) {
  ns.exec(Hack, ...);
  ns.exec(Weaken, ...);
  ns.exec(Grow, ...);
  ns.exec(Weaken, ...);
}

spawn everything at once
as long as you even out the job durations with additionalMsec
============================================================
const hackThreads = Math.ceil(ns.hackAnalyzeThreads(target, ns.getServerMaxMoney(target) * hackperc));
const hackAmount = ns.getServerMaxMoney(target) * ns.hackAnalyze(target) * hackThreads;
const w1Threads = Math.ceil((hackThreads * 0.002) / ns.weakenAnalyze(1));
const growThreads = Math.ceil(ns.growthAnalyze(target, 1 / (1 - ns.hackAnalyze(target) * hackThreads)) * 1.01, );
const w2Threads = Math.ceil((growThreads * 0.002 * 2) / ns.weakenAnalyze(1));

 
thats my thread calc without formulas when the server is prepped
============================================================
============================================================
============================================================
============================================================
============================================================
============================================================
============================================================
============================================================
