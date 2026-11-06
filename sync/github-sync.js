/* GitHub household sync. Credentials stay in this browser's IndexedDB.
 * Private files are fetched directly from GitHub, never via Pages or its cache.
 * Record-level logical clocks, tombstones and conditional SHA writes preserve
 * offline edits and merge concurrent devices. Photos live in separate files. */
(function(root){
  'use strict';
  var TABLES=['items','shopping','expenses','counters'];
  function empty(){return {version:1,records:{}};}
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value && typeof value==='object'){
      var out=Object.create(null);Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k]);});return out;
    }
    return value;
  }
  function equal(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
  function validKey(key){return typeof key==='string' && key.length<300 && /^[\w./-]+$/.test(key) && !key.split('/').some(function(k){return k==='__proto__'||k==='constructor'||k==='prototype';});}
  function validate(doc){
    if(!doc || doc.version!==1 || !doc.records || typeof doc.records!=='object' || Array.isArray(doc.records))throw new Error('invalid-data');
    Object.keys(doc.records).forEach(function(key){
      var e=doc.records[key],table=key.split('/')[0];
      if(!validKey(key)||TABLES.indexOf(table)<0||!e||!Array.isArray(e.rev)||e.rev.length!==2||!Number.isSafeInteger(e.rev[0])||e.rev[0]<0||typeof e.rev[1]!=='string'||e.rev[1].length>100||!Object.prototype.hasOwnProperty.call(e,'value'))throw new Error('invalid-data');
      var v=e.value;
      if(v!==null && (typeof v!=='object'||Array.isArray(v)))throw new Error('invalid-data');
      if(v && (table==='items'||table==='shopping') && (typeof v.id!=='string'||key!==table+'/'+v.id||typeof v.name!=='string'||!Number.isFinite(v.quantity)||v.quantity<0))throw new Error('invalid-data');
      if(v && table==='expenses' && (key!=='expenses/'+v.id||!/^\d{4}-\d{2}$/.test(v.month)||!Number.isSafeInteger(v.amountAgorot)||v.amountAgorot<0))throw new Error('invalid-data');
      if(v && table==='counters' && (!Number.isFinite(v.restocked)||!Number.isFinite(v.consumed)||!/^\d{4}-\d{2}$/.test(v.month)))throw new Error('invalid-data');
    });
    return doc;
  }
  function compare(a,b){return a.rev[0]-b.rev[0] || (a.rev[1]===b.rev[1]?0:a.rev[1]<b.rev[1]?-1:1);}
  function merge(a,b){
    validate(a);validate(b);
    var out=clone(a);
    Object.keys(b.records).forEach(function(key){var r=b.records[key],l=out.records[key];if(!l||compare(r,l)>0)out.records[key]=clone(r);});
    return out;
  }
  function maxClock(doc){return Object.keys(doc.records).reduce(function(n,k){return Math.max(n,doc.records[k].rev[0]);},0);}
  function rows(doc,table){return Object.keys(doc.records).filter(function(k){return k.indexOf(table+'/')===0 && doc.records[k].value;}).map(function(k){return clone(doc.records[k].value);});}
  function materialize(doc,localLog){
    var monthly=clone(localLog||{});
    Object.keys(monthly).forEach(function(m){monthly[m].expenses=[];monthly[m].restocked=0;monthly[m].consumed=0;});
    function month(key){if(!monthly[key])monthly[key]={restocked:0,consumed:0,shortfall:[],expenses:[]};return monthly[key];}
    rows(doc,'expenses').forEach(function(e){var copy=clone(e);delete copy.month;month(e.month).expenses.push(copy);});
    rows(doc,'counters').forEach(function(e){var m=month(e.month);m.restocked+=e.restocked;m.consumed+=e.consumed;});
    return {items:rows(doc,'items'),shopping:rows(doc,'shopping'),monthly:monthly};
  }
  function capture(meta,snapshot,device){
    var doc=meta.doc,previous=meta.observed || {items:[],shopping:[],monthly:{}};
    var clock=maxClock(doc);
    function put(key,value,initial){doc.records[key]={rev:[initial?0:++clock,device],value:clone(value)};}
    ['items','shopping'].forEach(function(table){
      var before={},after={};previous[table].forEach(function(x){before[x.id]=x;});snapshot[table].forEach(function(x){after[x.id]=x;});
      Object.keys(after).forEach(function(id){if(!equal(before[id],after[id]))put(table+'/'+id,after[id],!before[id]&&!doc.records[table+'/'+id]);});
      Object.keys(before).forEach(function(id){if(!after[id])put(table+'/'+id,null,false);});
    });
    var oldExpenses={},newExpenses={};
    function collect(log,out){Object.keys(log).forEach(function(m){(log[m].expenses||[]).forEach(function(e){out[e.id]=Object.assign({},e,{month:m});});});}
    collect(previous.monthly,oldExpenses);collect(snapshot.monthly,newExpenses);
    Object.keys(newExpenses).forEach(function(id){if(!equal(oldExpenses[id],newExpenses[id]))put('expenses/'+id,newExpenses[id],!doc.records['expenses/'+id]);});
    Object.keys(oldExpenses).forEach(function(id){if(!newExpenses[id])put('expenses/'+id,null,false);});
    Object.keys(snapshot.monthly).forEach(function(m){
      if(!/^\d{4}-\d{2}$/.test(m))return;
      var old=previous.monthly[m]||{},now=snapshot.monthly[m];
      var dr=(now.restocked||0)-(old.restocked||0),dc=(now.consumed||0)-(old.consumed||0);
      if(!dr&&!dc)return;
      var key='counters/'+m+'/'+device,entry=doc.records[key],v=entry&&entry.value||{month:m,restocked:0,consumed:0};
      put(key,{month:m,restocked:v.restocked+dr,consumed:v.consumed+dc},false);
    });
    meta.observed=clone(snapshot);
    return meta;
  }
  function storage(){
    var opening;
    function open(){if(!opening)opening=new Promise(function(resolve,reject){
      var r=indexedDB.open('homestock-github-sync',1);
      r.onupgradeneeded=function(){r.result.createObjectStore('kv');};
      r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(new Error('storage'));};
    });return opening;}
    return {get:function(key){return open().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('kv','readonly'),r=tx.objectStore('kv').get(key);r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(new Error('storage'));};});});},
      set:function(key,value){return open().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('kv','readwrite');if(value===undefined)tx.objectStore('kv').delete(key);else tx.objectStore('kv').put(value,key);tx.oncomplete=function(){resolve();};tx.onerror=tx.onabort=function(){reject(new Error('storage'));};});});}};
  }
  function encode(value){var bytes=new TextEncoder().encode(JSON.stringify(value));var s='';for(var i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));return btoa(s);}
  function create(options){
    var db=options.db,store=options.store||storage(),request=options.fetch||fetch;
    var owner=options.owner,repo=options.repo,uid=options.userId,key='state:'+uid;
    if(!/^[\w-]+$/.test(owner)||!/^[\w.-]+$/.test(repo))throw new Error('invalid-repo');
    var base='https://api.github.com/repos/'+owner+'/'+repo;
    var chain=Promise.resolve(),timer,poll,stopped=false,running=false,connected=false,device,meta;
    var status={phase:'local',lastSync:null},listeners=[];
    function emit(phase){status.phase=phase;listeners.forEach(function(fn){fn(Object.assign({},status));});}
    function queue(fn){var p=chain.then(function(){
      if(root.navigator && root.navigator.locks)return root.navigator.locks.request('homestock-github:'+uid,fn);
      return fn();
    });chain=p.catch(function(){});return p;}
    async function readMeta(){meta=await store.get(key)||{doc:empty(),observed:{items:[],shopping:[],monthly:{}}};}
    async function snapshot(){var data=await Promise.all([db.getAll(),db.getAllShopping()]);return {items:data[0],shopping:data[1],monthly:db.getMonthlyLog()};}
    async function captureNow(){capture(meta,await snapshot(),device);await store.set(key,meta);}
    async function api(path,token,method,body,raw){
      var control=new AbortController(),timeout=setTimeout(function(){control.abort();},25000);
      try {
        var response=await request(base+path,{method:method||'GET',headers:{Authorization:'Bearer '+token,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit',redirect:'error',signal:control.signal});
        if(!response.ok){var e=new Error(response.status===401?'auth':response.status===403||response.status===429?'access':response.status===404?'missing':'network');e.status=response.status;var retry=response.headers&&response.headers.get('Retry-After');if(retry)e.retryAfter=Number(retry);throw e;}
        return raw?JSON.parse(await response.text()):await response.json();
      } finally {clearTimeout(timeout);}
    }
    async function getDoc(token){
      // Raw media supports large JSON files; a second metadata request gives
      // the exact blob SHA needed for compare-and-swap. If they differ, retry.
      var file;
      try {file=await api('/contents/household.json',token);}catch(e){if(e.status===404)return {doc:empty(),sha:null};throw e;}
      var doc;
      if(file.encoding==='base64'&&file.content){
        var bytes=Uint8Array.from(atob(file.content.replace(/\s/g,'')),function(c){return c.charCodeAt(0);});
        doc=JSON.parse(new TextDecoder().decode(bytes));
      }else doc=await api('/git/blobs/'+file.sha,token,'GET',null,true);
      return {doc:validate(doc),sha:file.sha};
    }
    async function putDoc(doc,sha,token,path){
      var content=encode(doc);
      if(content.length>12*1024*1024)throw new Error('size');
      var body={message:'Update HomeStock data',content:content};if(sha)body.sha=sha;
      return api('/contents/'+(path||'household.json'),token,'PUT',body);
    }
    async function uploadImages(doc,token){
      var hashes={};rows(doc,'items').forEach(function(item){if(item.imageHash)hashes[item.imageHash]=true;});
      for(var hash of Object.keys(hashes)){
        if(!/^[a-f0-9]{64}$/.test(hash))continue;
        if(await store.get('uploaded:'+hash))continue;
        var image=await db.getImage(hash);
        if(!image)continue;
        try {await api('/contents/images/'+hash+'.json',token);}
        catch(e){if(e.status!==404)throw e;try{await putDoc(image,null,token,'images/'+hash+'.json');}catch(conflict){if(conflict.status!==409&&conflict.status!==422)throw conflict;await api('/contents/images/'+hash+'.json',token);}}
        await store.set('uploaded:'+hash,true);
      }
    }
    async function downloadImages(doc,token){
      var hashes={};rows(doc,'items').forEach(function(item){if(item.imageHash)hashes[item.imageHash]=true;});
      for(var hash of Object.keys(hashes)){
        if(!/^[a-f0-9]{64}$/.test(hash)||await db.getImage(hash))continue;
        var image;
        try{image=await api('/contents/images/'+hash+'.json',token,'GET',null,true);}catch(e){if(e.status===404)continue;throw e;}
        if(image.hash!==hash||!/^data:image\/(webp|jpeg|png);base64,/.test(image.full)||!/^data:image\/(webp|jpeg|png);base64,/.test(image.thumb))throw new Error('invalid-data');
        if(!await db.putImage(image))throw new Error('storage');
      }
    }
    async function sync(){
      if(stopped||running)return;
      running=true;
      try {
        var credential=await store.get('credential');
        connected=!!credential;
        if(!credential){emit('local');return;}
        if(root.navigator&&root.navigator.onLine===false){emit('offline');return;}
        if(status.retryAt && Date.now()<status.retryAt)return;
        emit('syncing');
        // Never send household data to an accidentally public repository.
        var repository=await api('',credential.token);
        if(repository.private!==true)throw new Error('public');
        for(var attempt=0;attempt<4;attempt++){
          await readMeta();await captureNow();
          var remote=await getDoc(credential.token);
          // Include edits made while the network request was in flight.
          await captureNow();
          meta.doc=merge(meta.doc,remote.doc);
          await store.set(key,meta);
          await downloadImages(meta.doc,credential.token);
          var desired=materialize(meta.doc,meta.observed.monthly);
          var result=await db.applySyncSnapshot(meta.observed,desired);
          meta.observed=result.observed;
          await store.set(key,meta);
          await captureNow(); // preserve writes racing with remote application
          await uploadImages(meta.doc,credential.token);
          try{
            if(!equal(meta.doc,remote.doc))await putDoc(meta.doc,remote.sha,credential.token);
          }catch(e){if(e.status===409||e.status===422)continue;throw e;}
          status.lastSync=new Date().toISOString();status.retryAt=0;
          await store.set('lastSync',status.lastSync);
          emit('synced');
          if(result.changed&&options.onRemote)await options.onRemote();
          return;
        }
        throw new Error('conflict');
      }catch(e){
        status.retryAt=e.message==='auth'?Infinity:Date.now()+Math.max(e.message==='access'?300000:30000,(e.retryAfter||0)*1000);
        emit(['auth','access','public','storage','invalid-data','size','conflict','missing'].indexOf(e.message)>=0?e.message:'offline');
      }finally{running=false;}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(function(){queue(sync);},1800);}
    function mutation(){queue(async function(){await readMeta();await captureNow();if(connected)emit('pending');}).then(schedule).catch(function(){emit('storage');});}
    async function start(){
      device=await store.get('device');if(!device){device=crypto.randomUUID();await store.set('device',device);}
      await queue(async function(){await readMeta();await captureNow();connected=!!await store.get('credential');status.lastSync=await store.get('lastSync')||null;});
      db.onMutation(mutation);
      if(options.auto!==false){poll=setInterval(function(){if(!root.document||root.document.visibilityState!=='hidden')queue(sync);},20000);root.addEventListener('online',wake);root.addEventListener('focus',wake);if(root.document)root.document.addEventListener('visibilitychange',wake);wake();}
      return apiObject;
    }
    function wake(){if(!root.document||root.document.visibilityState!=='hidden')queue(sync);}
    var apiObject={start:start,sync:function(){return queue(sync);},
      connect:function(token){return queue(async function(){
        token=String(token||'').trim();if(!/^github_pat_[A-Za-z0-9_]+$/.test(token))throw new Error('token-format');
        var repository=await api('',token);if(repository.private!==true)throw new Error('public');
        // A harmless metadata file verifies write permission before activation.
        var path='/contents/devices/'+device+'.json',existing;
        try{existing=await api(path,token);}catch(e){if(e.status!==404)throw e;}
        await putDoc({version:1,connectedAt:new Date().toISOString()},existing&&existing.sha,token,'devices/'+device+'.json');
        await store.set('credential',{token:token});connected=true;status.retryAt=0;emit('pending');
      }).then(function(){return queue(sync);});},
      disconnect:function(){return queue(async function(){await store.set('credential',undefined);connected=false;emit('local');});},
      status:function(){return Object.assign({connected:connected},status);},
      subscribe:function(fn){listeners.push(fn);return function(){listeners=listeners.filter(function(x){return x!==fn;});};},
      stop:function(){stopped=true;clearTimeout(timer);clearInterval(poll);db.onMutation(null);if(root.removeEventListener){root.removeEventListener('online',wake);root.removeEventListener('focus',wake);if(root.document)root.document.removeEventListener('visibilitychange',wake);}}
    };
    return apiObject;
  }
  root.GitHubSync={create:create,internals:{empty:empty,validate:validate,merge:merge,capture:capture,materialize:materialize,equal:equal}};
})(typeof window!=='undefined'?window:globalThis);
