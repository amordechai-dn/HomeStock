/* Hebrew select-only combobox. Popup lives outside scrolling dialogs so its
   options are never clipped. No global listeners remain after it closes. */
(function () {
  'use strict';
  var nextId = 0;
  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }
  function icon(mark) {
    var el = node('span', 'dropdown-icon');
    el.setAttribute('aria-hidden', 'true');
    var paths = mark === 'check' ? '<path d="m5 12 4 4L19 6"/>' :
      mark === 'calendar' ? '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>' :
      '<path d="m7 10 5 5 5-5"/>';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
    return el;
  }
  function create(config) {
    var options = config.options || [];
    var value = options.some(function(o){return o.value === config.value;}) ? config.value : options.length ? options[0].value : '';
    var id = 'home-dropdown-' + (++nextId);
    var root = node('div', 'home-dropdown');
    var trigger = node('button', 'dropdown-trigger');
    trigger.type = 'button';
    trigger.id = id;
    trigger.setAttribute('role','combobox');
    trigger.setAttribute('aria-label', config.label);
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls',id+'-list');
    trigger.disabled = !options.length;
    if(config.icon) trigger.appendChild(icon(config.icon));
    var label = node('span','dropdown-value');
    trigger.appendChild(label);
    var chevron = icon('chevron');
    chevron.classList.add('dropdown-chevron');
    trigger.appendChild(chevron);
    root.appendChild(trigger);
    var popup = null, list = null, active = -1, rows = [], typed = '', typedAt = 0;
    function renderValue() {
      var selected=options.filter(function(o){return o.value===value;})[0];
      label.textContent=selected ? selected.label : 'אין אפשרויות';
    }
    function close(restoreFocus) {
      if(!popup)return;
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      document.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      if(window.visualViewport) {window.visualViewport.removeEventListener('resize',position);window.visualViewport.removeEventListener('scroll',position);}
      popup.remove();popup=null;list=null;rows=[];
      trigger.setAttribute('aria-expanded','false');
      trigger.removeAttribute('aria-activedescendant');
      if(restoreFocus && trigger.isConnected) trigger.focus({preventScroll:true});
    }
    function outside(event) {
      if(!root.contains(event.target) && popup && !popup.contains(event.target)) close(false);
    }
    function position() {
      if(!popup)return;
      if(!trigger.isConnected){close(false);return;}
      var rect=trigger.getBoundingClientRect();
      var width=window.visualViewport ? window.visualViewport.width : document.documentElement.clientWidth;
      var leftOffset=window.visualViewport ? window.visualViewport.offsetLeft : 0;
      var height=window.visualViewport ? window.visualViewport.height : window.innerHeight;
      var topOffset=window.visualViewport ? window.visualViewport.offsetTop : 0;
      var below=height+topOffset-rect.bottom-16;
      var above=rect.top-topOffset-16;
      var flip=below<Math.min(270,options.length*49+40) && above>below;
      var available=Math.max(80,flip?above:below);
      popup.style.width=Math.min(Math.max(rect.width,180),width-24)+'px';
      popup.style.maxHeight=Math.min(360,available)+'px';
      var menuWidth=popup.getBoundingClientRect().width;
      popup.style.left=Math.max(leftOffset+12,Math.min(rect.right-menuWidth,leftOffset+width-menuWidth-12))+'px';
      popup.style.top=(flip?Math.max(topOffset+8,rect.top-popup.offsetHeight-7):rect.bottom+7)+'px';
    }
    function setActive(index, scroll) {
      active=Math.max(0,Math.min(options.length-1,index));
      rows.forEach(function(row,i){row.classList.toggle('is-active',i===active);});
      trigger.setAttribute('aria-activedescendant',id+'-option-'+active);
      if(scroll && rows[active]) rows[active].scrollIntoView({block:'nearest',inline:'nearest'});
    }
    function choose(index) {
      var old=value;
      value=options[index].value;
      renderValue();close(true);
      if(old!==value && config.onChange) config.onChange(value);
    }
    function open() {
      if(popup || !options.length)return;
      popup=node('div','dropdown-popup');
      popup.dir='rtl';
      popup.appendChild(node('div','dropdown-menu-heading',config.menuLabel || 'בחירת '+config.label));
      list=node('div','dropdown-list');
      list.id=id+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',config.label);
      options.forEach(function(option,index){
        var row=node('div','dropdown-option');
        row.id=id+'-option-'+index;
        row.setAttribute('role','option');
        row.setAttribute('aria-selected',String(option.value===value));
        var text=node('div','dropdown-option-copy');
        text.appendChild(node('span','dropdown-option-label',option.label));
        if(option.description) text.appendChild(node('span','dropdown-option-description',option.description));
        row.appendChild(text);
        var check=icon('check');check.classList.add('dropdown-check');row.appendChild(check);
        row.addEventListener('pointerdown',function(event){if(event.pointerType!=='touch')event.preventDefault();});
        row.addEventListener('pointermove',function(){setActive(index,false);});
        row.addEventListener('click',function(){choose(index);});
        rows.push(row);list.appendChild(row);
      });
      popup.appendChild(list);
      // Keep options inside the dialog's accessibility scope. A manual native
      // popover provides a top-layer surface, escaping clipping and transforms.
      var dialog=typeof trigger.closest==='function'?trigger.closest('[role="dialog"]'):null;
      if(dialog && typeof popup.showPopover==='function') {
        popup.setAttribute('popover','manual');dialog.appendChild(popup);popup.showPopover();
      } else document.body.appendChild(popup);
      trigger.setAttribute('aria-expanded','true');
      position();
      setActive(Math.max(0,options.findIndex(function(o){return o.value===value;})),true);
      document.addEventListener('pointerdown',outside,true);
      document.addEventListener('focusin',outside,true);
      document.addEventListener('scroll',position,true);
      window.addEventListener('resize',position);
      if(window.visualViewport) {window.visualViewport.addEventListener('resize',position);window.visualViewport.addEventListener('scroll',position);}
    }
    trigger.addEventListener('click',function(){if(popup)close(false);else open();});
    trigger.addEventListener('keydown',function(event){
      var key=event.key;
      if(key==='Escape' && popup){event.preventDefault();event.stopPropagation();close(true);return;}
      if(key==='Tab'){close(false);return;}
      if(key==='ArrowDown'||key==='ArrowUp'){
        event.preventDefault();
        if(!popup){open();return;}
        setActive((active+(key==='ArrowDown'?1:-1)+options.length)%options.length,true);return;
      }
      if(key==='Home'||key==='End'){
        event.preventDefault();if(!popup)open();setActive(key==='Home'?0:options.length-1,true);return;
      }
      if((key==='Enter'||key===' ') && popup){event.preventDefault();choose(active);return;}
      if(key.length===1 && key!==' ' && !event.ctrlKey && !event.metaKey && !event.altKey){
        event.preventDefault();
        if(Date.now()-typedAt>700)typed='';
        typed+=key;typedAt=Date.now();if(!popup)open();
        var index=options.findIndex(function(o){return o.label.indexOf(typed)===0;});
        if(index>=0)setActive(index,true);
      }
    });
    renderValue();
    return {
      element:root,
      get value(){return value;},
      set value(next){if(options.some(function(o){return o.value===next;})){value=next;renderValue();}},
      destroy:function(){close(false);}
    };
  }
  window.HomeDropdown = {create:create};
})();
