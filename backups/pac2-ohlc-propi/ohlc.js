(() => {
  'use strict';
  const host = document.getElementById('ohlc-chart');
  if (!host) return;
  const data = window.PAC2_OHLC_DATA?.rows;
  if (!Array.isArray(data) || !data.length) {
    host.textContent = 'No s’han pogut carregar les dades. Pots consultar el CSV des de l’apartat de fonts.';
    return;
  }
  const period = document.getElementById('ohlc-period');
  const highlight = document.getElementById('ohlc-highlight');
  const session = document.getElementById('ohlc-session');
  const previous = document.getElementById('ohlc-prev');
  const next = document.getElementById('ohlc-next');
  const detail = document.getElementById('ohlc-detail');
  const ns = 'http://www.w3.org/2000/svg';
  const number = new Intl.NumberFormat('ca-ES', {minimumFractionDigits:2, maximumFractionDigits:2});
  const dateFormat = new Intl.DateTimeFormat('ca-ES', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const shortDate = new Intl.DateTimeFormat('ca-ES', {day:'2-digit',month:'2-digit',timeZone:'UTC'});
  const asDate = s => new Date(`${s}T12:00:00Z`);
  const range = r => Math.round((r.high-r.low)*100)/100;
  const fmt = n => number.format(n);
  let rows = data.slice();
  let selected = rows.length - 1;
  let svg, marker, x, plot, width, height;
  let currentWidth = 0;
  function element(tag, attrs = {}, text = '') {
    const el = document.createElementNS(ns,tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
    if (text !== '') el.textContent = text;
    return el;
  }
  function html(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function select(index) {
    selected = Math.max(0,Math.min(rows.length-1,index));
    const r=rows[selected];
    session.value=String(selected);
    previous.disabled=selected===0;
    next.disabled=selected===rows.length-1;
    if(marker) {
      marker.setAttribute('x1',x(selected)); marker.setAttribute('x2',x(selected));
      marker.setAttribute('visibility','visible');
    }
    const heading=html('div',undefined,'ohlc-detail-title');
    heading.append(html('strong',dateFormat.format(asDate(r.date))));
    const change=Math.round((r.close-r.open)*100)/100;
    heading.append(html('span',`Tancament − obertura: ${change>0?'+':''}${fmt(change)} USD`));
    const values=html('dl',undefined,'ohlc-values');
    for(const [label,value] of [['Obertura',r.open],['Màxim',r.high],['Mínim',r.low],['Tancament',r.close],['Rang',range(r)]]) {
      const block=html('div');block.append(html('dt',label+' · USD'),html('dd',fmt(value)));values.append(block);
    }
    detail.replaceChildren(heading,values);
  }
  function render() {
    width=Math.max(280,Math.round(host.getBoundingClientRect().width));
    currentWidth=width;
    height=width<600?340:430;
    plot={left:52,right:width-16,top:38,bottom:height-48};
    const span=plot.right-plot.left;
    const min=Math.min(...rows.map(r=>r.low));
    const max=Math.max(...rows.map(r=>r.high));
    const pad=Math.max(1,(max-min)*0.08);
    const lower=Math.floor((min-pad)/5)*5;
    const upper=Math.ceil((max+pad)/5)*5;
    const y=value=>plot.bottom-(value-lower)/(upper-lower)*(plot.bottom-plot.top);
    x=i=>plot.left+span*(i+0.5)/rows.length;
    const barHalf=Math.min(7,span/rows.length*0.33);
    svg=element('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-labelledby':'ohlc-svg-title ohlc-svg-desc'});
    svg.append(element('title',{id:'ohlc-svg-title'},`Cotitzacions OHLC d’Apple: ${rows.length} sessions`));
    svg.append(element('desc',{id:'ohlc-svg-desc'},'Preus en USD. Cada barra va del mínim al màxim; la marca esquerra és l’obertura i la dreta el tancament. Selecciona una data sota el gràfic o consulta la taula per llegir els valors exactes.'));
    svg.append(element('text',{x:plot.left,y:16,fill:'#515872','font-size':11},'Preu · USD'));
    const topDates=new Set(rows.slice().sort((a,b)=>range(b)-range(a)).slice(0,2).map(r=>r.date));
    if(highlight.checked) {
      for(let i=0;i<rows.length;i++) if(topDates.has(rows[i].date)) {
        const band=Math.max(8,span/rows.length*0.9);
        svg.append(element('rect',{x:x(i)-band/2,y:plot.top,width:band,height:plot.bottom-plot.top,fill:'#e5e9ff'}));
        svg.append(element('circle',{cx:x(i),cy:plot.top-9,r:3,fill:'#000078'}));
      }
    }
    const tickStep=(upper-lower)>45?10:5;
    for(let value=lower;value<=upper;value+=tickStep) {
      svg.append(element('line',{x1:plot.left,x2:plot.right,y1:y(value),y2:y(value),stroke:'#e3e7ef','stroke-width':1}));
      svg.append(element('text',{x:plot.left-9,y:y(value)+4,'text-anchor':'end',fill:'#515872','font-size':11},String(value)));
    }
    marker=element('line',{x1:x(selected),x2:x(selected),y1:plot.top,y2:plot.bottom,stroke:'#737e99','stroke-width':1,'stroke-dasharray':'3 4','pointer-events':'none'});
    svg.append(marker);
    rows.forEach((r,i)=>{
      const color=r.close>r.open?'#087f78':r.close<r.open?'#b63c3f':'#596276';
      const group=element('g',{'data-date':r.date,'aria-hidden':'true'});
      const path=element('path',{d:`M${x(i)},${y(r.low)}V${y(r.high)} M${x(i)-barHalf},${y(r.open)}H${x(i)} M${x(i)},${y(r.close)}H${x(i)+barHalf}`,fill:'none',stroke:color,'stroke-width':width<500?1.6:2,'stroke-linecap':'square'});
      group.append(path);svg.append(group);
    });
    const ticks=width<500?4:7;
    const indices=[...new Set(Array.from({length:ticks},(_,i)=>Math.round(i*(rows.length-1)/(ticks-1))))];
    indices.forEach(i=>svg.append(element('text',{x:x(i),y:plot.bottom+23,'text-anchor':'middle',fill:'#515872','font-size':11},shortDate.format(asDate(rows[i].date)))));
    svg.append(element('text',{x:plot.right,y:height-3,'text-anchor':'end',fill:'#515872','font-size':10},`${rows.length} sessions · 2025`));
    function pointer(e) {
      const bounds=svg.getBoundingClientRect();
      const px=(e.clientX-bounds.left)*width/bounds.width;
      const py=(e.clientY-bounds.top)*height/bounds.height;
      if(px<plot.left||px>plot.right||py<plot.top||py>plot.bottom) return;
      const index=Math.min(rows.length-1,Math.floor((px-plot.left)/span*rows.length));
      if(index!==selected) select(index);
    }
    svg.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')pointer(e);});
    svg.addEventListener('pointerdown',pointer);
    host.replaceChildren(svg);
    select(selected);
  }
  function refresh() {
    const date=rows[selected]?.date;
    rows=period.value==='all'?data.slice():data.filter(r=>r.date.startsWith(period.value));
    const existing=rows.findIndex(r=>r.date===date);
    selected=existing>=0?existing:rows.length-1;
    session.replaceChildren(...rows.map((r,i)=>{
      const option=html('option',dateFormat.format(asDate(r.date)));option.value=String(i);return option;
    }));
    render();
  }
  period.addEventListener('change',refresh);
  highlight.addEventListener('change',render);
  session.addEventListener('change',()=>select(Number(session.value)));
  previous.addEventListener('click',()=>select(selected-1));
  next.addEventListener('click',()=>select(selected+1));
  const body=document.getElementById('ohlc-table-body');
  const tableRows=data.map(r=>{
    const tr=html('tr');
    for(const value of [dateFormat.format(asDate(r.date)),fmt(r.open),fmt(r.high),fmt(r.low),fmt(r.close),fmt(range(r))]) tr.append(html('td',value));
    return tr;
  });
  body.replaceChildren(...tableRows);
  refresh();
  if(typeof ResizeObserver==='function') new ResizeObserver(()=>{
    if(Math.abs(host.getBoundingClientRect().width-currentWidth)>1) render();
  }).observe(host);
  else window.addEventListener('resize',render);
})();
