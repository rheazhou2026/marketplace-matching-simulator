/** Deterministic, educational ride-hailing marketplace simulator.
 * Not Uber production code or a calibrated estimate of real marketplace impacts.
 */
export const ZONES = [
  {name:'Downtown',x:0.27,y:0.32,weight:1.65},
  {name:'University',x:0.55,y:0.22,weight:1.28},
  {name:'Riverside',x:0.80,y:0.42,weight:0.80},
  {name:'Midtown',x:0.48,y:0.54,weight:1.32},
  {name:'Southside',x:0.28,y:0.79,weight:0.75},
  {name:'Airport',x:0.79,y:0.80,weight:0.52}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rng(seed){let s=(seed>>>0)||1;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function weightedZone(rand, tick){const weights=ZONES.map((z,i)=>z.weight*(1+0.4*Math.sin(tick/7+i*1.7)));let total=weights.reduce((a,b)=>a+b,0),x=rand()*total;for(let i=0;i<weights.length;i++){x-=weights[i];if(x<=0)return i;}return weights.length-1;}
function posNear(i,rand){const z=ZONES[i];return {x:clamp(z.x+(rand()-.5)*.20,.03,.97),y:clamp(z.y+(rand()-.5)*.20,.03,.97)};}
export function makeScenario(seed=42,steps=45,drivers=9){const rand=rng(seed),initial=[];for(let j=0;j<drivers;j++){let zone=j%ZONES.length;initial.push({id:j,...posNear(zone,rand),busyUntil:0,available:true,zone});}
const events=[];let nextId=0;for(let t=0;t<steps;t++){const count=3+Math.floor(rand()*5);const requests=[];for(let k=0;k<count;k++){const from=weightedZone(rand,t),to=weightedZone(rand,t+5+Math.floor(rand()*3));requests.push({id:nextId++,from,to,pickup:posNear(from,rand),dropoff:posNear(to,rand),created:t,patience:2+Math.floor(rand()*4)});}events.push(requests);}return {seed,steps,initial,events};}
export function demandWeights(tick){return ZONES.map((z,i)=>z.weight*(1+0.4*Math.sin(tick/7+i*1.7)));}
export function zoneAt(point){let best=0,b=Infinity;ZONES.forEach((z,i)=>{let d=distance(point,z);if(d<b){best=i;b=d;}});return best;}
export function assignmentDP(costs){ // Each driver and rider can be used at most once; skip is valid.
 const m=costs.length,n=m?costs[0].length:0;if(n>18)throw Error('Too many drivers for demo DP');
 const memo=new Map();function rec(i,mask){if(i===m)return {score:0,pairs:[]};const key=i+':'+mask;if(memo.has(key))return memo.get(key);let best=rec(i+1,mask);for(let j=0;j<n;j++){if((mask&(1<<j))||!Number.isFinite(costs[i][j]))continue;const sub=rec(i+1,mask|(1<<j));const score=sub.score-costs[i][j];if(score>best.score+1e-9)best={score,pairs:[[i,j],...sub.pairs]};}memo.set(key,best);return best;}
 return rec(0,0).pairs;
}
const round=x=>Math.round(x*100)/100;
export class Marketplace {
 constructor(scenario,mode='LCAM',lambda=1.5){this.scenario=scenario;this.mode=mode;this.lambda=lambda;this.tick=0;this.drivers=scenario.initial.map(d=>({...d}));this.pending=[];this.trips=[];this.lastMatches=[];this.value=ZONES.map(()=>0);this.visits=ZONES.map(()=>0);this.metrics={completed:0,matched:0,cancelled:0,pickupTotal:0,deadheadTotal:0,earnings:0,requests:0,waitTotal:0};this.history=[];}
 step(){if(this.tick>=this.scenario.steps)return false;const t=this.tick;this.lastMatches=[];
  // Trips finish and drivers re-enter the market at their destination.
  for(const d of this.drivers){if(!d.available&&d.busyUntil<=t){d.available=true;this.metrics.completed++;}}
  const arrivals=this.scenario.events[t];this.metrics.requests+=arrivals.length;this.pending.push(...arrivals.map(r=>({...r})));
  const alive=[];for(const r of this.pending){if(t-r.created>=r.patience){this.metrics.cancelled++;this.metrics.waitTotal+=t-r.created;}else alive.push(r);}this.pending=alive;
  const free=this.drivers.filter(d=>d.available);const demand=demandWeights(t);const supply=ZONES.map((_,i)=>free.filter(d=>zoneAt(d)===i).length);
  // A transparent, synthetic value signal learns expected value of a driver's next location.
  // The immediate proxy values anticipated demand relative to local supply.
  const proxies=demand.map((v,i)=>2.7*v/(1+0.42*supply[i]));
  if(this.mode==='DVAM'){for(let i=0;i<ZONES.length;i++){const next=(i+1)%ZONES.length;const target=proxies[i]+0.82*this.value[next];this.value[i]+=0.13*(target-this.value[i]);this.visits[i]++;}}
  const costs=this.pending.map(r=>free.map(d=>{const pickup=distance(d,r.pickup);if(pickup>.73)return Infinity;const tripDist=distance(r.pickup,r.dropoff);const cancelRisk=clamp(pickup*0.53+(t-r.created)*0.1,0,.9);const immediate=pickup*6.2+cancelRisk*2.8+(t-r.created)*0.55-3.6-tripDist*1.2;
   // Bellman-inspired continuation value, evaluated at predicted destination.
   const future=this.mode==='DVAM'?this.lambda*(this.value[r.to] - 0.25*this.value[zoneAt(d)]):0;
   return immediate-future;}));
  const matched=assignmentDP(costs);const used=new Set();for(const [ri,dj] of matched){const r=this.pending[ri],d=free[dj],pickup=distance(d,r.pickup),tripDist=distance(r.pickup,r.dropoff);used.add(r.id);this.metrics.matched++;this.metrics.pickupTotal+=pickup*10;this.metrics.deadheadTotal+=pickup*10;this.metrics.waitTotal+=t-r.created+pickup*2.5;this.metrics.earnings+=4+tripDist*20;this.lastMatches.push({rider:r,driverId:d.id,from:{x:d.x,y:d.y},pickup:r.pickup,to:r.dropoff,pickupMinutes:round(pickup*10)});d.x=r.dropoff.x;d.y=r.dropoff.y;d.zone=r.to;d.available=false;d.busyUntil=t+Math.max(1,Math.ceil((pickup+tripDist)*4));this.trips.push({tick:t,driver:d.id,from:r.from,to:r.to,pickup:round(pickup*10)});}
  this.pending=this.pending.filter(r=>!used.has(r.id));this.tick++;
  this.history.push({tick:this.tick,matched:this.metrics.matched,completed:this.metrics.completed,cancelled:this.metrics.cancelled,wait:this.averageWait(),idle:this.drivers.filter(d=>d.available).length,backlog:this.pending.length});return true;
 }
 averageWait(){return this.metrics.matched?round(this.metrics.waitTotal/Math.max(1,this.metrics.matched+this.metrics.cancelled)):0;}
 snapshot(){return {tick:this.tick,metrics:{...this.metrics,avgPickup:this.metrics.matched?round(this.metrics.pickupTotal/this.metrics.matched):0,avgWait:this.averageWait(),fulfillment:this.metrics.requests?round(100*this.metrics.matched/this.metrics.requests):0},free:this.drivers.filter(d=>d.available).length,backlog:this.pending.length};}
}
export function runComparison(seed=42,steps=45,lambda=1.5){const scenario=makeScenario(seed,steps);const lcam=new Marketplace(scenario,'LCAM'),dvam=new Marketplace(scenario,'DVAM',lambda);while(lcam.step())dvam.step();return {lcam,dvam};}
