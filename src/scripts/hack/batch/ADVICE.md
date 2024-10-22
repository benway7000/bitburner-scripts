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
ElJay
 — 
10/02/2023 1:32 AM
I mean ultimately the goal is the highest money/second. everything else is just a means to that end.
usually that means maximizing ram utilization while also preferring lower thread counts due to the exponential increase grow threads experience.
plus or minus some fractional thread stuff
============================================================
Quick question, what would the ideal thread count per batch contain? Highest efficency in relation to earnings and ram utilization?

xsinx
 — 
10/02/2023 2:35 AM
The answer is very dependent on how much ram you have. Your main currency when batching is RAM and while weaken is directly porportional to grow or hack threads, the grow threads grow logarithmically vs hack, so the bigger the hack, the bigger the impact on ram. For instance, the difference between hacking 99 and 100% of the money in one swipe can easily be 2-3x more ram usage. You want to aim to fill your ram 100%, it might mean batching against multiple targets.. That quick and abrupt raise in grow ram requirement at higher percents means it quickly becomes more lucrative to hack 2 servers for 90% than a single one for 100%, and you might even have enough ram left over to hack 2-3 more servers, etc...
The way I approached it in my codebase is I've designed a Metrics class that pretty much calculate all possibilities for a server. I haven't pushed it to the multiple server level yet... So basically, I can ask the Metrics class to provide me with all the details about hacking n00dles with 10 hack threads and it will return a blueprint of the batch needed to do this, how many threads of each job I need to lauch, how many I can fit in ram, how much profit this batch will do, how long it takes to execute, etc..
I can then brute force the results for all hacking thread counts and find out how many threads will give me the best income over the time the batch takes to execute, all while taking into account how many batches I can fit in my current ram
By running this against all hackable servers, I can find out which of all the servers, if I threw all my ram at it, would provide me with the best possible income rate
Here's the example output (sitting at 1000 hacking rn with no augs)
============================================================
============================================================
============================================================
============================================================
============================================================
============================================================
============================================================
