(function(){
  function run(){
    if(document.getElementById('doorDigiyGoDriver')) return;
    var grid=document.querySelector('.pathGrid');
    if(!grid) return;
    var a=document.createElement('a');
    a.id='doorDigiyGoDriver';
    a.className='door pave gold driverMainClair';
    a.href='./action.html';
    a.innerHTML='<div class="paveTop"><div class="doorIcon">🎙️</div><div class="doorTag">GO</div></div><div class="doorInfo"><b>DIGIY GO DRIVER</b><span>Le client ou le chauffeur parle. DRIVER prépare. Le chauffeur valide.</span></div>';
    var before=document.getElementById('doorTrajets')||grid.firstElementChild;
    if(before) grid.insertBefore(a,before); else grid.appendChild(a);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  setTimeout(run,500);
})();
