/* Canonical HomeStock mark. Shared by the interface and icon generator. */
(function(root){
  'use strict';
  var paths=[
    [[12,27],[32,11],[52,27],[52,53],[12,53],[12,27]],
    [[22,33],[42,33]],
    [[22,43],[42,43]]
  ];
  var strokeWidth=5;
  var pathData=paths.map(function(points){return points.map(function(p,i){return(i?'L':'M')+p[0]+' '+p[1];}).join(' ');}).join(' ');
  var pathMarkup='<path d="'+pathData+'" fill="none" stroke="currentColor" stroke-width="'+strokeWidth+'" stroke-linecap="round" stroke-linejoin="round"/>';
  var brand={paths:paths,strokeWidth:strokeWidth,pathMarkup:pathMarkup,
    svg:function(){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">'+pathMarkup+'</svg>';}};
  if(typeof module==='object'&&module.exports)module.exports=brand;
  else root.HomeStockBrand=brand;
})(typeof window!=='undefined'?window:globalThis);
