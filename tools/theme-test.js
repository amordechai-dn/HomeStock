'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert(index.indexOf('./theme.js')<index.indexOf('rel="stylesheet"'),'appearance must be applied before styles/first paint');
const source=fs.readFileSync(path.join(__dirname,'../theme.js'),'utf8');
function browser(saved,blocked){
 const attrs={},meta={},data=new Map(saved?[['homestock.appearance',saved]]:[]),events={};
 const context={document:{documentElement:{setAttribute:(k,v)=>attrs[k]=v,style:{}},querySelector:()=>({setAttribute:(k,v)=>meta[k]=v})},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return data.get(k);},setItem:(k,v)=>{if(blocked)throw Error('blocked');data.set(k,v);}},window:{addEventListener:(k,fn)=>events[k]=fn}};
 vm.runInNewContext(source,context);return {theme:context.window.HomeTheme,attrs,meta,data,events,style:context.document.documentElement.style};
}
let b=browser();assert.equal(b.theme.get(),'sage');assert.equal(b.attrs['data-theme'],'sage');assert.equal(b.meta.content,'#c3cec0');assert.equal(b.style.colorScheme,'light');
assert.equal(b.theme.set('forest'),true);assert.equal(b.data.get('homestock.appearance'),'forest');assert.equal(b.style.colorScheme,'dark');assert.equal(b.meta.content,'#16231b');
assert.equal(browser('forest').theme.get(),'forest','saved theme applies on initial load');
assert.equal(b.theme.set('unknown'),false);assert.equal(b.theme.get(),'forest');
b.events.storage({key:'homestock.appearance',newValue:'sage'});assert.equal(b.theme.get(),'sage');
b.events.storage({key:'unrelated',newValue:'forest'});assert.equal(b.theme.get(),'sage');
let locked=browser(null,true);assert.equal(locked.theme.set('forest'),true);assert.equal(locked.theme.get(),'forest');assert.equal(browser('invalid').theme.get(),'sage');
const css=fs.readFileSync(path.join(__dirname,'../theme.css'),'utf8');
function luminance(hex){const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const theme of ['sage','forest']){
 const block=css.match(new RegExp(':root\\[data-theme="'+theme+'"\\] \\{([^}]+)'))[1],vars={};
 for(const m of block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/g))vars[m[1]]=m[2];
 for(const [foreground,background] of [['--text','--bg'],['--text','--surface'],['--muted','--surface'],['--muted','--surface-raised'],['--on-primary','--primary'],['--feature-text','--feature-bg'],['--feature-muted','--feature-bg'],['--warning','--surface'],['--danger','--surface']]){
  const ratio=contrast(vars[foreground],vars[background]);assert(ratio>=4.5,theme+' '+foreground+' on '+background+' contrast '+ratio.toFixed(2));
 }
}
console.log('PASS: dim default, prepaint restoration, durable switching, tab synchronization, invalid values, blocked storage, browser chrome and text contrast in both themes');
