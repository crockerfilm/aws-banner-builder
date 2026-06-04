/* Shared banner core — runs in Node (CLI) and the browser (builder).
   One source of truth for layouts, animation presets, and rendering. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BannerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZES = [
    { w:300, h:250, archetype:'box',         label:'Medium Rectangle' },
    { w:970, h:250, archetype:'billboard',   label:'Billboard' },
    { w:728, h:90,  archetype:'leaderboard', label:'Leaderboard' },
    { w:160, h:600, archetype:'skyscraper',  label:'Wide Skyscraper' },
    { w:300, h:600, archetype:'halfpage',    label:'Half Page' },
    { w:320, h:50,  archetype:'mobile',      label:'Mobile Leaderboard' }
  ];

  const LAYOUTS = {
    box:         { mode:'stack', pad:16, hl:20, sub:12.5, proof:10, cta:12.5, showSub:true,  showProof:true,  viz:'corner', useShort:false },
    billboard:   { mode:'split', pad:24, hl:30, sub:15,   proof:11, cta:14,   showSub:true,  showProof:true,  viz:'block',  useShort:false },
    leaderboard: { mode:'bar',   pad:10, hl:15, sub:11,   proof:0,  cta:11,   showSub:true,  showProof:false, viz:'none',   useShort:true  },
    skyscraper:  { mode:'stack', pad:14, hl:18, sub:12,   proof:10, cta:12,   showSub:true,  showProof:true,  viz:'corner', useShort:false },
    halfpage:    { mode:'stack', pad:20, hl:26, sub:14,   proof:11, cta:14,   showSub:true,  showProof:true,  viz:'corner', useShort:false },
    mobile:      { mode:'bar',   pad:8,  hl:12.5, sub:0,  proof:0,  cta:9.5,  showSub:false, showProof:false, viz:'none',   useShort:true  }
  };

  const ANIMATIONS = {
    'fade-up':    { label:'Fade up',       init:'opacity:0;transform:translateY(10px)', played:'opacity:1;transform:none' },
    'fade':       { label:'Fade',          init:'opacity:0',                            played:'opacity:1' },
    'slide-left': { label:'Slide in',      init:'opacity:0;transform:translateX(18px)', played:'opacity:1;transform:none' },
    'scale':      { label:'Scale in',      init:'opacity:0;transform:scale(.92)',       played:'opacity:1;transform:none' },
    'wipe':       { label:'Wipe',          init:'opacity:1;clip-path:inset(0 100% 0 0)',played:'clip-path:inset(0 0 0 0)' },
    'none':       { label:'None (static)', init:'',                                     played:'' }
  };

  const DEFAULT_ANIM = { preset:'fade-up', duration:450, stagger:300, loops:1 };

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function visualSVG(c){
    return '<svg class="viz" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
      + '<line x1="60" y1="60" x2="22" y2="28" stroke="'+c.hairline+'" stroke-width="2"/>'
      + '<line x1="60" y1="60" x2="98" y2="30" stroke="'+c.hairline+'" stroke-width="2"/>'
      + '<line x1="60" y1="60" x2="20" y2="92" stroke="'+c.hairline+'" stroke-width="2"/>'
      + '<line x1="60" y1="60" x2="100" y2="94" stroke="'+c.hairline+'" stroke-width="2"/>'
      + '<circle cx="22" cy="28" r="6.5" fill="'+c.white+'"/>'
      + '<circle cx="98" cy="30" r="6.5" fill="'+c.white+'"/>'
      + '<circle cx="20" cy="92" r="6.5" fill="'+c.white+'"/>'
      + '<circle cx="100" cy="94" r="6.5" fill="'+c.white+'"/>'
      + '<circle cx="60" cy="60" r="12" fill="'+c.orange+'"/></svg>';
  }

  function renderBanner(ctx){
    const c = ctx.brand.colors;
    const L = LAYOUTS[ctx.size.archetype];
    const size = ctx.size;
    const ct = ctx.content || {};
    const fit = ctx.imageFit || 'contain';
    const click = ctx.click || '#';
    const locale = ctx.locale || 'en';

    const a = Object.assign({}, DEFAULT_ANIM, ctx.anim || {});
    const A = ANIMATIONS[a.preset] || ANIMATIONS['fade-up'];
    const dur = Math.max(0, +a.duration || 0);
    const stag = Math.max(0, +a.stagger || 0);
    const loops = Math.min(3, Math.max(1, +a.loops || 1));

    const headline = L.useShort ? (ct.short || ct.headline || '') : (ct.headline || '');

    const vizInner = ctx.heroDataURI
      ? '<img class="vizimg" src="'+ctx.heroDataURI+'" alt="" style="object-fit:'+fit+'">'
      : visualSVG(c);
    const logoMarkup = ctx.logoDataURI
      ? '<img class="logo-img" src="'+ctx.logoDataURI+'" alt="'+esc(ctx.logoText)+'">'
      : '<span class="logo">'+esc(ctx.logoText)+'</span>';

    const brandbar = '<div class="brandbar region" data-r="0">'+logoMarkup+'<span class="rule"></span></div>';
    const headlineEl = '<h1 class="headline region" data-r="1">'+esc(headline)+'</h1>';
    const subEl  = (L.showSub && ct.subhead) ? '<p class="subhead region" data-r="2">'+esc(ct.subhead)+'</p>' : '';
    const proofEl = (L.showProof && ct.proof) ? '<div class="proof region" data-r="3">'+esc(ct.proof)+'</div>' : '';
    const ctaEl  = '<a class="cta region" data-r="4">'+esc(ct.cta)+' <span class="arw">&rsaquo;</span></a>';
    const corner = (L.viz==='corner') ? '<div class="vizcorner" aria-hidden="true">'+vizInner+'</div>' : '';

    let stage;
    if (L.mode === 'bar') {
      stage = '<div class="stage bar">'+brandbar+'<div class="midcol">'+headlineEl+subEl+'</div>'+ctaEl+'</div>';
    } else if (L.mode === 'split') {
      stage = '<div class="stage split"><div class="textcol">'+brandbar+headlineEl+subEl+proofEl+ctaEl+'</div><div class="vizblock region" data-r="2">'+vizInner+'</div></div>';
    } else {
      stage = '<div class="stage stack">'+corner+'<div class="top">'+brandbar+'</div><div class="mid">'+headlineEl+subEl+proofEl+'</div><div class="bot">'+ctaEl+'</div></div>';
    }

    const transition = dur>0 ? ('opacity '+dur+'ms ease, transform '+dur+'ms ease, clip-path '+dur+'ms ease') : 'none';
    const css = [
      '*{margin:0;padding:0;box-sizing:border-box}',
      'html,body{width:'+size.w+'px;height:'+size.h+'px;overflow:hidden}',
      '#ad{position:relative;width:'+size.w+'px;height:'+size.h+'px;background:'+c.ink+';font-family:'+ctx.brand.fontStack+';color:'+c.white+';cursor:pointer;overflow:hidden;border:1px solid '+c.hairline+'}',
      '.stage{position:absolute;inset:0;padding:'+L.pad+'px;display:flex}',
      '.stage.stack{flex-direction:column;justify-content:space-between}',
      '.stage.split{flex-direction:row;align-items:center;gap:'+L.pad+'px}',
      '.stage.bar{flex-direction:row;align-items:center;gap:'+Math.round(L.pad*0.9)+'px}',
      '.textcol{display:flex;flex-direction:column;gap:'+Math.round(L.pad*0.4)+'px;flex:1}',
      '.mid{display:flex;flex-direction:column;gap:'+Math.round(L.pad*0.45)+'px}',
      '.midcol{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}',
      '.brandbar{display:flex;align-items:center;gap:8px}',
      '.logo{font-weight:800;letter-spacing:-0.5px;font-size:'+Math.max(13,L.hl*0.78)+'px;line-height:1}',
      '.logo-img{height:'+Math.max(14,Math.round(L.hl*0.85))+'px;width:auto;display:block}',
      '.rule{display:inline-block;width:22px;height:3px;background:'+c.orange+';border-radius:2px}',
      '.bar .rule{width:0}',
      '.headline{font-weight:800;letter-spacing:-0.3px;font-size:'+L.hl+'px;line-height:1.1}',
      '.bar .headline{line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.subhead{font-weight:500;font-size:'+L.sub+'px;line-height:1.2;color:#D9DEE5}',
      '.bar .subhead{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.proof{align-self:flex-start;font-weight:700;font-size:'+L.proof+'px;letter-spacing:0.6px;color:'+c.orange+';border:1px solid '+c.orange+';border-radius:2px;padding:3px 7px}',
      '.cta{display:inline-flex;align-items:center;gap:4px;align-self:flex-start;background:'+c.orange+';color:'+c.ink+';font-weight:800;font-size:'+L.cta+'px;padding:'+Math.round(L.cta*0.5)+'px '+Math.round(L.cta*0.9)+'px;border-radius:3px;white-space:nowrap}',
      '.bar .cta{margin-left:auto;align-self:center;flex:none}',
      '.vizblock{width:'+Math.round(size.h*0.62)+'px;height:'+Math.round(size.h*0.62)+'px;flex:none}',
      '.vizcorner{position:absolute;top:'+L.pad+'px;right:'+L.pad+'px;width:'+Math.round(Math.min(size.w,size.h)*0.26)+'px;height:'+Math.round(Math.min(size.w,size.h)*0.26)+'px;opacity:.9}',
      '.viz,.vizimg{width:100%;height:100%;display:block}',
      '.region{'+A.init+';transition:'+transition+'}',
      '#ad.play .region{'+A.played+'}',
      '#ad.play .region[data-r="0"]{transition-delay:'+(0*stag)+'ms}',
      '#ad.play .region[data-r="1"]{transition-delay:'+(1*stag)+'ms}',
      '#ad.play .region[data-r="2"]{transition-delay:'+(2*stag)+'ms}',
      '#ad.play .region[data-r="3"]{transition-delay:'+(3*stag)+'ms}',
      '#ad.play .region[data-r="4"]{transition-delay:'+(4*stag)+'ms}',
      '@media (prefers-reduced-motion: reduce){.region{transition:none}}'
    ].join('\n');

    const js = '(function(){window.clickTag=window.clickTag||"'+click+'";'
      + 'var ad=document.getElementById("ad");'
      + 'ad.addEventListener("click",function(){window.open(window.clickTag,"_blank");});'
      + 'var loops='+loops+',cycle='+((4*stag)+dur+200)+',count=0;'
      + 'function run(){ad.classList.add("play");count++;if(count<loops){setTimeout(function(){ad.classList.remove("play");requestAnimationFrame(function(){requestAnimationFrame(run);});},cycle+600);}}'
      + 'requestAnimationFrame(function(){requestAnimationFrame(run);});})();';

    return '<!doctype html>\n<html lang="'+locale+'">\n<head>\n<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width='+size.w+',height='+size.h+'">\n'
      + '<meta name="ad.size" content="width='+size.w+',height='+size.h+'">\n'
      + '<title>'+esc(ctx.title||'')+'</title>\n<style>'+css+'</style>\n</head>\n<body>\n'
      + '<div id="ad" role="link" aria-label="'+esc(headline)+'">'+stage+'</div>\n'
      + '<script>'+js+'<\/script>\n</body>\n</html>';
  }

  return { SIZES, LAYOUTS, ANIMATIONS, DEFAULT_ANIM, esc, visualSVG, renderBanner };
});
