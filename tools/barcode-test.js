'use strict';
const assert=require('node:assert/strict');
require('../barcode.js');const B=global.HomeBarcode;
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(extra={}){
 const rows=[],cache=new Map(),calls=[];let online=true,clock=Date.now();
 const options={db:{getBarcode:async key=>cache.get(key)||null,putBarcode:async rec=>{cache.set(rec.barcode,copy(rec));return rec;}},items:()=>rows,online:()=>online,now:()=>clock,
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({status:'success',product:{product_name_he:'מוצר בדיקה',product_type:'beauty'}})};},
  map:async(p,code)=>({barcode:code,name:p.product_name||p.product_name_he,he:p.product_name_he||'',productType:p.product_type,categoryId:p.product_type==='beauty'?'care':'other',unit:'pcs'}),...extra};
 return {lookup:B.createLookup(options),options,rows,cache,calls,set online(v){online=v;},advance(ms){clock+=ms;}};
}
(async()=>{
 assert.equal(B.normalize(' ٧٢٩٠٠٠٠٦٨٨٠٧٧\u200f '),'7290000688077');
 assert.equal(B.key('036000291452'),'0036000291452');assert(B.variants('0036000291452').includes('036000291452'));
 assert(B.checksum('7290000688077'));assert(B.checksum('036000291452'));assert(B.checksum('96385074'));assert(!B.checksum('7290000688070'));
 let f=fixture();f.rows.push({id:'stock',barcode:'036000291452'});assert.equal((await f.lookup('0036000291452')).source,'inventory');assert.equal(f.calls.length,0);
 f=fixture();f.cache.set('0036000291452',{barcode:'0036000291452',name:'מוצר שמור'});assert.equal((await f.lookup('036000291452')).source,'cache');
 f=fixture();let result=await f.lookup('7290000688077');assert.equal(result.source,'off');assert.equal(result.product.productType,'beauty');assert(f.calls[0].url.includes('product_type=all'));assert.equal(f.calls[0].options.credentials,'omit');
 assert.equal((await f.lookup('7290000688077')).source,'cache');assert.equal(f.calls.length,1);
 f=fixture();await Promise.all([f.lookup('036000291452'),f.lookup('0036000291452')]);assert.equal(f.calls.length,1,'concurrent equivalent barcodes share a request');
 f=fixture();f.online=false;assert.equal((await f.lookup('7290000688077')).source,'offline');assert.equal(f.calls.length,0);
 f=fixture({fetch:async()=>({ok:false,status:404})});assert.equal((await f.lookup('7290000688077')).reason,'notfound');assert.equal((await f.lookup('7290000688077')).reason,'notfound');
 f=fixture({fetch:async()=>({ok:false,status:429,headers:{get:()=>120}})});assert.equal((await f.lookup('7290000688077')).reason,'rate-limit');assert.equal((await f.lookup('3017620422003')).reason,'rate-limit');
 f=fixture({fetch:()=>new Promise(()=>{}),timeout:15});const began=Date.now();assert.equal((await f.lookup('7290000688077')).reason,'unreachable');assert(Date.now()-began<500,'even a stalled fetch has a bounded deadline');
 f=fixture({db:{getBarcode:async()=>{throw Error('storage');},putBarcode:async()=>{throw Error('full');}}});assert.equal((await f.lookup('7290000688077')).source,'off','cache failures must not block review');
 f=fixture({fetch:async()=>({ok:true,status:200,json:async()=>{throw Error('bad-json');}})});assert.equal((await f.lookup('7290000688077')).reason,'unreachable');
 f=fixture({fetch:async()=>({ok:false,status:503})});assert.equal((await f.lookup('7290000688077')).reason,'unreachable');
 f=fixture();assert.equal((await f.lookup('CUSTOM-123')).source,'new');assert.equal(f.calls.length,0,'internal non-retail codes are not sent to public API');
 for(let i=0;i<13;i++)result=await f.lookup(String(1000000000000+i));assert.equal(result.reason,'rate-limit','client budget stays below provider limit');
 const metadata=B.portable({barcode:'123',name:'בדיקה',image:'data:image/webp;base64,xxx'});assert(!('image' in metadata));
 console.log('PASS: barcode normalization/equivalence, checksums, local/cache priority, universal product API, shared in-flight lookups, offline mode, deadlines, rate limits, unavailable storage, malformed responses and metadata-only catalog export');
})().catch(error=>{console.error(error);process.exitCode=1;});
