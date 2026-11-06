/* DOM-light behavior checks; real menu geometry and selection also verified
   in the IDE browser on desktop and a 390px phone preview. */
'use strict';
var assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element {
  constructor(){this.children=[];this.attrs={};this.events={};this.style={};this.classes=new Set();this.offsetHeight=180;this.classList={add:(v)=>this.classes.add(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
  appendChild(el){this.children.push(el);el.parent=this;return el;}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){this.events[k]=fn;}
  contains(el){return el===this||this.children.some(c=>c.contains(el));}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
  get isConnected(){return !!this.parent;}
  getBoundingClientRect(){return this.attrs.role==='combobox'?{left:24,right:366,top:560,bottom:610,width:342}:{width:parseFloat(this.style.width)||342};}
  scrollIntoView(){}
  focus(){focused=this;}
  fire(type,key){var prevented=false;this.events[type]({key:key,preventDefault:()=>{prevented=true;},stopPropagation:()=>{}});return prevented;}
}
var focused=null;
var documentEvents={},windowEvents={};
var body=new Element();
var document={body:body,documentElement:{clientWidth:390},createElement:()=>new Element(),addEventListener:(k,fn)=>documentEvents[k]=fn,removeEventListener:k=>delete documentEvents[k]};
var window={innerHeight:740,addEventListener:(k,fn)=>windowEvents[k]=fn,removeEventListener:k=>delete windowEvents[k]};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dropdown.js'),'utf8'),{window,document,Date});
var changes=[];
var control=window.HomeDropdown.create({label:'חודש',value:'nov',options:[{value:'nov',label:'נובמבר'},{value:'oct',label:'אוקטובר'},{value:'aug',label:'אוגוסט'}],onChange:v=>changes.push(v)});
body.appendChild(control.element);
var trigger=control.element.children[0];
trigger.fire('click');
assert.equal(trigger.attrs['aria-expanded'],'true');
assert.equal(body.children.length,2);
var popup=body.children[1];
assert(parseFloat(popup.style.top)>=0 && parseFloat(popup.style.top)+180<=740);
trigger.fire('keydown','ArrowDown');trigger.fire('keydown','Enter');
assert.equal(control.value,'oct');assert.equal(changes.join(','),'oct');assert.equal(focused,trigger);
assert.equal(Object.keys(documentEvents).length,0);
trigger.fire('click');trigger.fire('keydown','End');trigger.fire('keydown','Escape');
assert.equal(control.value,'oct');assert.equal(trigger.attrs['aria-expanded'],'false');
trigger.fire('keydown','נ');trigger.fire('keydown','Enter');
assert.equal(control.value,'nov');assert.equal(changes.join(','),'oct,nov');
trigger.fire('keydown','End');trigger.fire('keydown','Enter');assert.equal(control.value,'aug');
trigger.fire('click');documentEvents.pointerdown({target:new Element()});assert.equal(trigger.attrs['aria-expanded'],'false');
trigger.fire('click');trigger.fire('keydown','Tab');assert.equal(trigger.attrs['aria-expanded'],'false');
control.value='oct';assert.equal(control.value,'oct');
trigger.fire('click');control.destroy();
assert.equal(body.children.length,1);assert.equal(Object.keys(documentEvents).length,0);assert.equal(Object.keys(windowEvents).length,0);
// A dialog-owned top-layer popup stays in the modal accessibility tree.
var dialogHost=new Element();body.appendChild(dialogHost);
Element.prototype.closest=function(){return dialogHost;};
Element.prototype.showPopover=function(){this.wasShown=true;};
var dialogControl=window.HomeDropdown.create({label:'קטגוריה',options:[{value:'a',label:'אחר'}]});
dialogHost.appendChild(dialogControl.element);
dialogControl.element.children[0].fire('click');
var topLayer=dialogHost.children[1];
assert.equal(topLayer.attrs.popover,'manual');assert.equal(topLayer.wasShown,true);
assert.equal(topLayer.parent,dialogHost);
dialogControl.destroy();assert.equal(dialogHost.children.length,1);
assert.equal(Object.keys(documentEvents).length,0);
console.log('PASS: keyboard selection, Hebrew type-ahead, cancellation, outside click, focus, phone bounds and listener cleanup');
