"""Build a small attributed barcode fallback catalog from PriceIL's public API.
No credentials, prices, personal data or product images are stored.
Requests are paced below the documented 20/min anonymous limit.
"""
import json,time,urllib.parse,subprocess
from datetime import datetime,timezone
from pathlib import Path
queries=['פרמזן','גבינה','גבינת','חלב','יוגורט','חמאה','שמנת','ביצים','קוטג','לחם','אורז','פסטה','קרקרים','קפוא','טונה','שוקולד','שמפו','נייר טואלט']
output=Path('data/israeli-products.json')
products=json.loads(output.read_text()).get('products',{}) if output.exists() else {}
fetched=0
sources=[(query,'https://api.priceil.dev/products?'+urllib.parse.urlencode({'q':query,'limit':100})) for query in queries]+[(code,'https://api.priceil.dev/products/'+code) for code in ['7290004122119','7290004584351']]
for index,(query,url) in enumerate(sources):
 if index:time.sleep(5)
 try:
  payload=json.loads(subprocess.run(['curl','-fsSL','--max-time','20',url],capture_output=True,text=True,check=True).stdout)
  data=payload.get('data') or {}
  rows=[data] if data.get('itemCode') else [data.get('bestMatch')]+(data.get('allOthers') or [])
  for row in rows:
   if not row:continue
   code=str(row.get('itemCode') or '');name=str(row.get('itemName') or '').strip()
   if not code.isdigit() or len(code) not in [8,12,13,14] or not name:continue
   fetched+=1
   products[code]={'barcode':code,'name':name,'brand':row.get('manufacturerName') or '', 'quantity':row.get('quantity'),'unit':row.get('unitQty'),'weighted':row.get('isWeighted') is True}
  print(query,len(products),flush=True)
 except Exception as error:print(query,type(error).__name__,flush=True)
if not fetched:raise SystemExit('No catalog data fetched; previous snapshot unchanged')
result={'source':'PriceIL','sourceUrl':'https://priceil.dev/developers','fetchedAt':datetime.now(timezone.utc).isoformat(),'products':products}
output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print('Saved',len(products),'barcode records',flush=True)
