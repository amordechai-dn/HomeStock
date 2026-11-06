/* Two isolated browser stores + the real DB adapter against a GitHub API fake. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function backend(){
  let files=new Map(),serial=0,commits=0,privateRepo=true,online=true,conflict,fetchHook,denyWrite=false;
  let calls=[];
  async function fetch(url,options){
    assert(url.startsWith('https://api.github.com/repos/owner/data'));
    assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
    assert(options.headers.Authorization.startsWith('Bearer github_pat_'));
    calls.push({url,method:options.method});
    if(!online)throw new Error('offline');
    let route=url.slice('https://api.github.com/repos/owner/data'.length),status=200,data;
    if(!route)data={private:privateRepo};
    else if(route.startsWith('/git/blobs/')){
      let f=[...files.values()].find(x=>x.sha===route.split('/').pop());if(!f)status=404;else data=f.doc;
    }else if(route.startsWith('/contents/')){
      let key=route.slice('/contents/'.length),file=files.get(key);
      if(options.method==='PUT'){
        if(denyWrite)status=403;
        else{
          let input=JSON.parse(options.body);
          if(conflict&&key==='household.json'){let cb=conflict;conflict=null;cb();file=files.get(key);}
          if((file&&input.sha!==file.sha)||(!file&&input.sha))status=409;
          else{let doc=JSON.parse(Buffer.from(input.content,'base64').toString('utf8'));file={sha:'s'+(++serial),doc};files.set(key,file);commits++;data={content:{sha:file.sha}};}
        }
      }else if(!file)status=404;
      else if(options.headers.Accept==='application/vnd.github.raw+json')data=file.doc;
      else data={sha:file.sha,encoding:'base64',content:Buffer.from(JSON.stringify(file.doc)).toString('base64')};
      if(fetchHook&&key==='household.json'&&options.method==='GET'){let cb=fetchHook;fetchHook=null;await cb();}
    }else throw Error('Unexpected API route '+route);
    return {ok:status===200,status,headers:{get:()=>null},json:async()=>copy(data),text:async()=>JSON.stringify(data)};
  }
  return {fetch,files,get commits(){return commits;},get calls(){return calls;},set online(v){online=v;},set private(v){privateRepo=v;},set denyWrite(v){denyWrite=v;},set conflict(fn){conflict=fn;},set fetchHook(fn){fetchHook=fn;},replace(doc){files.set('household.json',{sha:'s'+(++serial),doc:copy(doc)});}};
}
async function browser(server,id){
  let values=new Map(),kv=new Map();
  const context={console,Promise,TextEncoder,TextDecoder,AbortController,crypto,Uint8Array,
    navigator:{onLine:true},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    setTimeout:(fn,ms)=>ms===1800?0:setTimeout(fn,ms),clearTimeout, setInterval:()=>0,clearInterval,
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}};
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../db.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../sync/github-sync.js'),'utf8'),context);
  let db=context.PantryDB;db.setUser('user-'+id);
  kv.set('device',id);
  let store={get:async k=>copy(kv.get(k)),set:async(k,v)=>{if(v===undefined)kv.delete(k);else kv.set(k,copy(v));}};
  let engine=context.GitHubSync.create({db,store,fetch:server.fetch,owner:'owner',repo:'data',userId:'user-'+id,auto:false});
  return {db,engine,kv,context,store,async start(){await engine.start();await engine.connect('github_pat_TEST');assert.equal(engine.status().phase,'synced');}};
}
(async()=>{
  const cloud=backend(),a=await browser(cloud,'device-a');
  let milk=await a.db.create({name:'חלב',quantity:2,unitPriceAgorot:650});
  await a.db.putShopping({id:'s1',name:'לחם',quantity:1,purchased:false});
  a.db.setMonthlyLog({'2026-11':{restocked:2,consumed:0,shortfall:[],expenses:[{id:'p1',at:'2026-11-06',name:'חלב',amountAgorot:1300,quantity:2}]}});
  await a.engine.start();
  await assert.rejects(a.engine.connect('bad-token'),/token-format/);
  assert.equal(a.engine.status().phase,'local','validation errors must not appear as storage errors');
  await a.engine.connect('github_pat_TEST');
  assert.equal(a.engine.status().phase,'synced');
  assert.equal(a.kv.get('credential').token,'github_pat_TEST');
  const b=await browser(cloud,'device-b');await b.start();
  assert.equal((await b.db.getAll())[0].name,'חלב');
  assert.equal((await b.db.getAll())[0].unitPriceAgorot,650);
  assert.equal((await b.db.getAllShopping())[0].name,'לחם');
  assert.equal(b.db.getMonthlyLog()['2026-11'].expenses[0].amountAgorot,1300);
  let n=cloud.commits;await a.engine.sync();await b.engine.sync();assert.equal(cloud.commits,n,'unchanged data creates no commits');
  // Independent offline edits survive a reconnect on both devices.
  cloud.online=false;
  milk.quantity=3;await a.db.put(milk);
  let soap=await b.db.create({name:'סבון',quantity:1,location:'Shower'});
  await a.engine.sync();assert.equal(a.engine.status().phase,'offline');
  let ma=a.db.getMonthlyLog(),mb=b.db.getMonthlyLog();
  ma['2026-11'].expenses.push({id:'pa',at:'2026-11-06',name:'חלב',amountAgorot:650});ma['2026-11'].restocked++;
  mb['2026-11'].expenses.push({id:'pb',at:'2026-11-06',name:'סבון',amountAgorot:900});mb['2026-11'].restocked++;
  a.db.setMonthlyLog(ma);b.db.setMonthlyLog(mb);
  cloud.online=true;
  // A reconnect/reconnection approval resets transient backoff immediately.
  await a.engine.connect('github_pat_TEST');await b.engine.sync();await a.engine.sync();
  assert.equal((await a.db.getAll()).length,2);assert.equal((await b.db.getAll()).length,2);
  assert.equal((await b.db.getAll()).find(x=>x.id===milk.id).quantity,3);
  assert.equal(a.db.getMonthlyLog()['2026-11'].expenses.length,3);
  assert.equal(b.db.getMonthlyLog()['2026-11'].restocked,4);
  n=cloud.commits;await a.engine.sync();await b.engine.sync();assert.equal(cloud.commits,n,'merged key ordering must not create repeated commits');
  // Deletions have durable tombstones; stale devices cannot resurrect a row.
  await a.db.remove(milk.id);await a.db.removeShopping('s1');
  ma=a.db.getMonthlyLog();ma['2026-11'].expenses=ma['2026-11'].expenses.filter(x=>x.id!=='p1');a.db.setMonthlyLog(ma);
  await a.engine.sync();soap.quantity=2;await b.db.put(soap);await b.engine.sync();await a.engine.sync();
  assert(!(await b.db.getAll()).some(x=>x.id===milk.id));assert.equal((await b.db.getAllShopping()).length,0);
  assert.equal(b.db.getMonthlyLog()['2026-11'].expenses.length,2);
  // A write from another device between GET and PUT forces a SHA retry/merge.
  cloud.conflict=()=>{let doc=copy(cloud.files.get('household.json').doc);doc.records['shopping/concurrent']={rev:[100,'other'],value:{id:'concurrent',name:'ביצים',quantity:1}};cloud.replace(doc);};
  await a.db.create({name:'אורז',quantity:1});await a.engine.sync();
  assert((await a.db.getAllShopping()).some(x=>x.id==='concurrent'));
  // Local input during a remote fetch is captured before remote application.
  cloud.fetchHook=async()=>{let item=(await a.db.getAll()).find(x=>x.id===soap.id);item.quantity=17;await a.db.put(item);};
  await a.engine.sync();await b.engine.sync();assert.equal((await b.db.getAll()).find(x=>x.id===soap.id).quantity,17);
  // Conditional importer protects concurrent local edits and timestamps.
  let old={items:copy(await a.db.getAll()),shopping:copy(await a.db.getAllShopping()),monthly:copy(a.db.getMonthlyLog())};
  let desired=copy(old),entry=desired.items.find(x=>x.id===soap.id);entry.quantity=99;entry.updatedAt='2020-01-01';
  let local=(await a.db.getAll()).find(x=>x.id===soap.id);local.quantity=18;await a.db.put(local);
  await a.db.applySyncSnapshot(old,desired);assert.equal((await a.db.getAll()).find(x=>x.id===soap.id).quantity,18);
  // Photo content is transferred separately and rendered on a fresh device.
  const hash='a'.repeat(64),photo={hash,full:'data:image/webp;base64,YQ==',thumb:'data:image/webp;base64,YQ=='};
  await a.db.putImage(photo);local.imageHash=hash;await a.db.put(local);await a.engine.sync();await b.engine.sync();
  assert.equal((await b.db.getImage(hash)).full,photo.full);
  // A reload keeps queued edits and does not duplicate existing expenses.
  a.engine.stop();let reloaded=a.context.GitHubSync.create({db:a.db,store:a.store,fetch:cloud.fetch,owner:'owner',repo:'data',userId:'user-device-a',auto:false});
  await reloaded.start();await reloaded.sync();assert.equal(a.db.getMonthlyLog()['2026-11'].expenses.length,2);
  await reloaded.disconnect();assert.equal(reloaded.status().connected,false);assert((await a.db.getAll()).length>0);
  assert.equal(a.kv.get('credential'),undefined);reloaded.stop();
  // No data writes when repository visibility changes to public.
  cloud.private=false;let before=cloud.commits;await b.engine.sync();assert.equal(b.engine.status().phase,'public');assert.equal(cloud.commits,before);
  b.engine.stop();
  // Hostile documents are rejected before touching local data.
  const I=a.context.GitHubSync.internals;
  assert(I.equal({a:1,b:{x:2,y:3}},{b:{y:3,x:2},a:1}),'object key order must not trigger uploads');
  assert.throws(()=>I.validate(JSON.parse('{"version":1,"records":{"items/__proto__":{"rev":[1,"x"],"value":null}}}')),/invalid-data/);
  assert.throws(()=>I.validate({version:2,records:{}}),/invalid-data/);
  assert.throws(()=>I.validate({version:1,records:{'items/bad':{rev:[1,'x'],value:{id:'bad',name:'x',quantity:-1}}}}),/invalid-data/);
  const left={version:1,records:{'items/x':{rev:[7,'a'],value:{id:'x',name:'א',quantity:1}}}},right={version:1,records:{'items/x':{rev:[7,'b'],value:null}}};
  assert.deepEqual(copy(I.merge(left,right)),copy(I.merge(right,left)),'merge is commutative');
  assert.deepEqual(copy(I.merge(right,right)),right,'merge is idempotent');
  console.log('PASS: two-device bootstrap, Hebrew/prices, offline edits, expense union, counters, deletion tombstones, SHA conflicts, in-flight local edits, photos, restart, disconnect, private-only writes and hostile data validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
