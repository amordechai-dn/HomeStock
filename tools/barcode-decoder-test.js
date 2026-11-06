'use strict';
const assert=require('node:assert/strict'),Z=require('../vendor/zxing.min.js'),fixtures=require('./barcode-fixtures.js');
const hints=new Map([[Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E]],[Z.DecodeHintType.TRY_HARDER,true]]);
for(const code of ['7290000688077','7290116537351','3017620422003','036000291452','96385074'])for(const scale of [2,4])for(const reverse of [false,true]){
 const p=fixtures.luminance(code,scale,55,220,reverse),bitmap=new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(p.data,p.width,p.height)));
 const decoded=new Z.MultiFormatReader().decode(bitmap,hints).getText();assert.equal(decoded,code);
}
console.log('PASS: 20 real-decoder cases across EAN-13, EAN-8 and UPC-A, two image scales, reduced contrast and reversed barcodes');
