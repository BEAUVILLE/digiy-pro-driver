(function(){
  function run(){
    var grid=document.querySelector('.pathGrid');
    if(!grid) return;

    if(!document.getElementById('doorDigiyGoDriver')){
      var a=document.createElement('a');
      a.id='doorDigiyGoDriver';
      a.className='door pave gold driverMainClair';
      a.href='./action.html';
      a.innerHTML='<div class="paveTop"><div class="doorIcon">🎙️</div><div class="doorTag">GO</div></div><div class="doorInfo"><b>DIGIY GO DRIVER</b><span>Le client ou le chauffeur parle. DRIVER prépare. Le chauffeur valide.</span></div>';
      var before=document.getElementById('doorTrajets')||grid.firstElementChild;
      if(before) grid.insertBefore(a,before); else grid.appendChild(a);
    }

    if(!document.getElementById('doorDriverPayTransition')){
      var p=document.createElement('a');
      p.id='doorDriverPayTransition';
      p.className='door pave payDoor';
      p.href='./pay-transition.html';
      p.innerHTML='<div class="paveTop"><div class="doorIcon">💳</div><div class="doorTag">PAY</div></div><div class="doorInfo"><b>Course vers PAY</b><span>Quand l’argent est final : montant, mode, puis PAY valide.</span></div>';
      var after=document.getElementById('doorDigiyGoDriver');
      if(after&&after.nextSibling) grid.insertBefore(p,after.nextSibling); else grid.appendChild(p);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  setTimeout(run,500);
})();
