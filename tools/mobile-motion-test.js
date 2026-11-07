'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('  var pageTransition=null'),end=source.indexOf('  function actionButton(',start);
(async()=>{
 const animations=[],actions=[];
 function animate(){let resolve;const finished=new Promise(r=>resolve=r);const a={finished,cancel(){resolve()},finish:resolve};animations.push(a);return a;}
 const page={animate};
 const ctx={window:{matchMedia:q=>({matches:q.includes('max-width')})},document:{getElementById:()=>page}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 ctx.actionA=()=>actions.push('A');ctx.actionB=()=>actions.push('B');
 vm.runInContext('transitionPage(actionA);transitionPage(actionB);',ctx);
 await new Promise(r=>setImmediate(r));assert.deepEqual(actions,[],'superseded transition never navigates');
 animations[1].finish();await new Promise(r=>setImmediate(r));assert.deepEqual(actions,['B']);
 animations[2].finish();await new Promise(r=>setImmediate(r));assert.equal(ctx.mobileTransition,null);
 ctx.window.matchMedia=()=>({matches:true});vm.runInContext('transitionPage(actionA)',ctx);assert.deepEqual(actions,['B','A'],'reduced motion navigates immediately');
 console.log('PASS mobile motion: latest tap wins, canceled navigation cannot return late, animations clean up, reduced motion stays immediate');
})().catch(e=>{console.error(e);process.exitCode=1});
