if(!self.define){let e,i={};const s=(s,n)=>(s=new URL(s+".js",n).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(n,r)=>{const d=e||("document"in self?document.currentScript.src:"")||location.href;if(i[d])return;let o={};const t=e=>s(e,d),a={module:{uri:d},exports:o,require:t};i[d]=Promise.all(n.map((e=>a[e]||t(e)))).then((e=>(r(...e),o)))}}define(["./workbox-f3e6b16a"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/Graphviz-B4tMCyLg.js",revision:null},{url:"assets/index-BvFI3ALo.css",revision:null},{url:"assets/index-DVEE9EQs.js",revision:null},{url:"index.html",revision:"97dd2d3fc1a80b9b7fd92495fd29be35"},{url:"registerSW.js",revision:"1a4dc8550ec420bf3c0283a2e8d9509d"},{url:"favicon.ico",revision:"4fac1711edbaa63490f2b987dd290eda"},{url:"pwa-64x64.png",revision:"dbd52076e73da2cdccf120c9d81b6dfd"},{url:"pwa-192x192.png",revision:"20e1e73e3a00a5bbfec3ed37d6116a10"},{url:"pwa-512x512.png",revision:"4f30f4c9444278f436fbfb6329e41022"},{url:"maskable-icon-512x512.png",revision:"f0532cd5aeea3ddf30e3e879ae0461bf"},{url:"manifest.webmanifest",revision:"22535e1b1a70e8aa1d74ac8590a626e4"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
