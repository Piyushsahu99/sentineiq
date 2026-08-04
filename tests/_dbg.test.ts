import { it } from "vitest";
import { trainCandidate } from "../src/lib/ml/rf-retrain.server";
import { FEATURE_NAMES } from "../src/lib/ml/rf-infer.server";
function m32(s:number){let a=s>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
it("dbg",()=>{const rnd=m32(11);const rows:any[]=[];for(let i=0;i<300;i++){const f=new Array(FEATURE_NAMES.length).fill(0);const s=rnd()<0.45?1:0;const t=rnd()<0.3?1:0;f[13]=s;f[11]=t;f[0]=6+rnd()*4;const truth=1/(1+Math.exp(-(-1.2+3.4*s+1.6*t)));const label=rnd()<truth?1:0;const p=Math.min(0.95,Math.max(0.01,truth*0.35+rnd()*0.05));rows.push({features:f,p,label,weight:1,created_at:new Date(Date.now()-(300-i)*60000).toISOString()});}
const r=trainCandidate(rows,["sim_swap","tor_flag"]);console.log(JSON.stringify({acc:r.accepted,base:r.baseline_metrics,cand:r.candidate_metrics,imp:r.improvement,ov:{a:r.overlay.a,b:r.overlay.b,w:r.overlay.weights}},null,1));});
