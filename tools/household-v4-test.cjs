'use strict';const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};w.matchMedia=()=>({matches:false,addEventListener(){}});
for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','voice.js','app.js']){let s=fs.readFileSync(f,'utf8');if(f==='app.js')s=s.replace('window.App = {','window.App = {qaEditor:openForm,');w.eval(s);}
const wait=()=>new Promise(r=>setTimeout(r,20));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();const db=w.PantryDB;
const total=()=>Object.values(db.getMonthlyLog()).reduce((n,m)=>n+(m.expenses||[]).reduce((n,e)=>n+e.amountAgorot,0),0);
function set(label,value){const f=w.document.querySelector('input[aria-label="'+label+'"]');assert(f,label);f.value=value;f.dispatchEvent(new w.Event('input',{bubbles:true}));}
w.App.qaEditor(null);set('שם המוצר','חלב בדיקה');set('כמות במלאי','2');set('מחיר ליחידה בשקלים','5');set('תאריך תפוגה','2026-11-10');w.document.querySelector('.editor-save').click();await wait();assert.equal(total(),0,'existing stock with price is not an expense');
assert.equal(w.document.querySelector('.item-finished').disabled,false,'available finished action stays enabled');
let item=(await db.getAll())[0];assert.equal(item.batches[0].quantity,2);
w.App.qaEditor(item,{addQuantity:1,purchase:true});set('תאריך תפוגה','2026-11-20');w.document.querySelector('.editor-save').click();await wait();assert.equal(total(),500);item=(await db.getAll())[0];assert.equal(item.quantity,3);assert.equal(item.batches.length,2);
await w.App._internals.changeQty(item,-2);item=(await db.getAll())[0];assert.equal(item.quantity,1);assert.equal(item.expiryDate,'2026-11-20');assert.equal(total(),500);
await w.App._internals.addToShoppingList({name:'כשל בדיקה',quantity:1,unit:'pack',unitPriceAgorot:200});const shop=(await db.getAllShopping()).find(s=>s.name==='כשל בדיקה');const original=db.putShopping;db.putShopping=()=>Promise.reject(new Error('test failure'));
await assert.rejects(w.App._internals.purchaseShoppingItem(shop));db.putShopping=original;assert(!(await db.getAll()).some(i=>i.name==='כשל בדיקה'));assert.equal(total(),500,'failed purchase rolls inventory and spending back');
console.log('PASS v4 UI: explicit purchase expenses, package expiry separation, earliest-first consumption and failed purchase rollback');w.close();})().catch(e=>{console.error(e);process.exit(1)});
