(function(){
  var dlg=document.createElement('dialog');dlg.className='csv-dialog';dlg.setAttribute('aria-labelledby','csv-title');
  dlg.innerHTML='<div class="csv-head"><h3 id="csv-title"></h3><div><a id="csv-download" download>Descarrega el CSV</a><button type="button" class="csv-close">Tanca</button></div></div><div class="csv-body" id="csv-body"></div>';
  document.body.appendChild(dlg);
  var title=dlg.querySelector('#csv-title'),body=dlg.querySelector('#csv-body'),dl=dlg.querySelector('#csv-download');
  dlg.querySelector('.csv-close').addEventListener('click',function(){dlg.close()});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
  function parse(t){var rows=[],r=[],f='',q=false,i,c;t=t.replace(/^﻿/,'');
    for(i=0;i<t.length;i++){c=t[i];
      if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
      else if(c=='"')q=true;else if(c==',' ){r.push(f);f=''}
      else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;r.push(f);rows.push(r);r=[];f=''}
      else f+=c}
    if(f!==''||r.length){r.push(f);rows.push(r)}return rows}
  function esc(s){return s.replace(/[&<>]/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[m]})}
  function render(rows,name){var h=rows.shift(),n=rows.length,num=h.map(function(_,j){return rows.every(function(r){return r[j]===''||!isNaN(Number(r[j]))})});
    var out='<table><caption>'+esc(name)+' · '+n+' files</caption><thead><tr>'+h.map(function(x){return'<th scope="col">'+esc(x)+'</th>'}).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){out+='<tr>'+r.map(function(x,j){return'<td'+(num[j]?' class="num"':'')+'>'+esc(x)+'</td>'}).join('')+'</tr>'});
    body.innerHTML=out+'</tbody></table>'}
  document.addEventListener('click',function(e){var b=e.target.closest('.csv-open');if(!b)return;
    e.preventDefault();var url=b.getAttribute('href'),name=b.getAttribute('data-title');
    title.textContent='Dades: '+name;dl.href=url;body.innerHTML='<p>Carregant…</p>';dlg.showModal();
    fetch(url).then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){render(parse(t),name)})
      .catch(function(){body.innerHTML='<p>No s’han pogut carregar les dades. <a href="'+url+'" download>Descarrega el CSV</a>.</p>'})});
})();
