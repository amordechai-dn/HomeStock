/* Synthetic retail barcodes for deterministic decoder/camera tests only. */
(function(root){
 const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
 const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
 const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
 const PAR=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
 function bits(code){
  if(code.length===12)code='0'+code;
  let value='101';
  if(code.length===8){for(let i=0;i<4;i++)value+=L[Number(code[i])];value+='01010';for(let i=4;i<8;i++)value+=R[Number(code[i])];}
  else{const parity=PAR[Number(code[0])];for(let i=0;i<6;i++)value+=(parity[i]==='L'?L:G)[Number(code[i+1])];value+='01010';for(let i=7;i<13;i++)value+=R[Number(code[i])];}
  return value+'101';
 }
 function luminance(code,scale=4,dark=0,light=255,reverse=false){
  const encoded=bits(code),quiet=12,width=(encoded.length+quiet*2)*scale,height=120,data=new Uint8ClampedArray(width*height);
  for(let x=0;x<width;x++){const m=Math.floor(x/scale)-quiet,value=m>=0&&m<encoded.length&&encoded[m]==='1'?dark:light;for(let y=0;y<height;y++)data[y*width+(reverse?width-x-1:x)]=value;}
  return {data,width,height};
 }
 function draw(canvas,code){const ctx=canvas.getContext('2d'),encoded=bits(code),scale=5,quiet=12,x=(canvas.width-(encoded.length+quiet*2)*scale)/2;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
  for(let i=0;i<encoded.length;i++)if(encoded[i]==='1')ctx.fillRect(x+(i+quiet)*scale,120,scale,canvas.height-240);
 }
 const result={bits,luminance,draw};if(typeof module==='object'&&module.exports)module.exports=result;else root.BarcodeFixtures=result;
})(typeof window!=='undefined'?window:globalThis);
