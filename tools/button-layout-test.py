from playwright.sync_api import sync_playwright
import json
import os
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width,height in [(320,740),(390,844),(768,1000),(1440,1000)]:
  context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('HOMESTOCK_QA_URL','http://127.0.0.1:8769'));page.wait_for_load_state('networkidle')
  page.evaluate("""async()=>{localStorage.setItem('homestock.profileChosen','1');App.start();await new Promise(r=>setTimeout(r,100));const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d').fillRect(0,0,100,100);const img=c.toDataURL();const hash='a'.repeat(64);await PantryDB.putImage({hash,full:img,thumb:img});await PantryDB.create({name:'מוצר בדיקה עם שם ארוך במיוחד',quantity:2,desiredAmount:3,unit:'pack',location:'Fridge',categoryId:'dairy',imageHash:hash});await PantryDB.putShopping({id:'qa-shop',name:'מוצר לקנייה עם תמונה',quantity:2,unit:'pack',categoryId:'dairy',imageHash:hash});const d=new Date(),key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');PantryDB.setMonthlyLog({[key]:{expenses:[{id:'qa-expense',name:'מוצר עם שם ארוך לדוגמה',at:d.toISOString(),quantity:2,unit:'pack',unitPriceAgorot:1000,amountAgorot:2000,location:'Pantry'}]}});App.start();}""")
  def audit(label):
   page.wait_for_timeout(200)
   result=page.locator('button').evaluate_all("""els=>els.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').flatMap(e=>{const b=e.getBoundingClientRect(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),bad=[];let n;while(n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)bad.push(n.textContent.trim())}return bad.length?[{text:e.textContent.trim(),cls:e.className,width:Math.round(b.width),height:Math.round(b.height),overflow:bad}]:[]})""")
   if result:print(json.dumps({'width':width,'view':label,'bad':result},ensure_ascii=False),flush=True)
   if label in ['product-photo','shopping-photo']:
    assert page.locator('.photo-actions .btn').evaluate_all('els=>els.every(e=>{const b=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);return b.height>=43.9&&b.width<=r.getBoundingClientRect().width+40})'),(width,label,'oversized photo control')
    print(json.dumps({'width':width,'view':label,'photoButtons':page.locator('.photo-actions .btn').evaluate_all('els=>els.map(e=>({text:e.textContent,width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))')},ensure_ascii=False),flush=True)
   page.screenshot(path=f'/tmp/homestock-buttons-{label}-{width}.png',full_page=True)
   return result
  allbad=[]
  for label in ['בית','מלאי','רשימת קניות','הוצאות','הגדרות']:
   page.get_by_role('button',name=label,exact=True).click();allbad+=audit(label)
  page.get_by_role('button',name='ניהול',exact=True).click();allbad+=audit('sync');page.locator('.shared-dialog .sheet-close').click()
  page.get_by_role('button',name='מלאי',exact=True).click();page.locator('.stock-product').click();allbad+=audit('product-photo');page.locator('.editor-delete').click();allbad+=audit('delete-confirm');page.locator('.delete-confirm-overlay .cancel').click();page.locator('.product-editor .sheet-close').click()
  page.get_by_role('button',name='הוספת מוצר',exact=True).click();page.get_by_role('button',name='הוספה ידנית',exact=True).click();allbad+=audit('product-add');page.locator('.product-editor .sheet-close').click()
  page.get_by_role('button',name='רשימת קניות',exact=True).click();page.locator('.shopping-item-open').click();allbad+=audit('shopping-photo');page.locator('.shopping-editor .sheet-close').click();page.locator('.shopping-buy').click();allbad+=audit('purchase-review')
  assert not errors,errors
  assert not allbad,(width,allbad)
  print('PASS',width,'all pages and editing/delete/photo/purchase/sync dialogs: text contained, photo buttons compact and at least 44px high',flush=True);context.close()
 browser.close()
