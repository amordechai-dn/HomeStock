/* Apply appearance before styles/first paint. Device-local; never household data. */
(function(){
  'use strict';
  var KEY='homestock.appearance',current='sage';
  var colors={sage:'#c3cec0',forest:'#16231b'};
  function valid(value){return value==='forest'||value==='sage';}
  function apply(value){
    current=valid(value)?value:'sage';
    document.documentElement.setAttribute('data-theme',current);
    document.documentElement.style.colorScheme=current==='forest'?'dark':'light';
    var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',colors[current]);
  }
  try{apply(localStorage.getItem(KEY));}catch(e){apply('sage');}
  window.HomeTheme={get:function(){return current;},set:function(value){
    if(!valid(value))return false;apply(value);
    try{localStorage.setItem(KEY,current);}catch(e){/* Keep the choice for this session. */}
    return true;
  }};
  window.addEventListener('storage',function(event){if(event.key===KEY||event.key===null)apply(event.newValue);});
})();
