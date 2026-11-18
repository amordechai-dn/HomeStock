'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{for(const phone of [true,false]){
const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.scrollTo=()=>{};w.matchMedia=q=>({matches:phone&&q.includes('max-width'),addEventListener(){}});let animations=0,cancelled=0;
// A throttled/background animation may never finish; navigation must still work.
w.HTMLElement.prototype.animate=function(){animations++;return {finished:new Promise(()=>{}),cancel(){cancelled++;}}};
w.document.startViewTransition=()=>{throw Error('navigation must not wait for a browser snapshot')};
for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await new Promise(r=>setTimeout(r,40));const nav=w.document.querySelector('.kitchen-nav');
for(let i=0;i<5;i++)for(const [label,route] of [['מלאי','stock'],['הוצאות','expenses'],['הגדרות','settings'],['רשימת קניות','shopping'],['בית','inventory']]){
[...nav.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label).click();assert.equal(w.location.hash,'#/'+route,'route committed synchronously');assert.equal(w.document.querySelector('#main-content').dataset.view,route);assert.equal(w.document.querySelectorAll('#main-content').length,1);assert.equal(w.document.querySelector('.kitchen-nav'),nav);
}
assert.equal(animations,25);assert.equal(cancelled,24);assert.equal((await w.PantryDB.getAll()).length,0);w.close();console.log('PASS immediate rapid navigation with unfinished animations: '+(phone?'phone':'desktop'));
}})().catch(e=>{console.error(e);process.exit(1)});
