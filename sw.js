if(!self.define){let e,i={};const s=(s,n)=>(s=new URL(s+".js",n).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(n,r)=>{const o=e||("document"in self?document.currentScript.src:"")||location.href;if(i[o])return;let d={};const t=e=>s(e,o),a={module:{uri:o},exports:d,require:t};i[o]=Promise.all(n.map((e=>a[e]||t(e)))).then((e=>(r(...e),d)))}}define(["./workbox-f3e6b16a"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/Graphviz-CtLjRmU9.js",revision:null},{url:"assets/index-BvFI3ALo.css",revision:null},{url:"assets/index-CyqW0uc7.js",revision:null},{url:"index.html",revision:"f4428140ab92e0404ea781d0465ee5b2"},{url:"registerSW.js",revision:"1a4dc8550ec420bf3c0283a2e8d9509d"},{url:"favicon.ico",revision:"4fac1711edbaa63490f2b987dd290eda"},{url:"maskable-icon-512x512.png",revision:"f0532cd5aeea3ddf30e3e879ae0461bf"},{url:"pwa-192x192.png",revision:"20e1e73e3a00a5bbfec3ed37d6116a10"},{url:"pwa-512x512.png",revision:"4f30f4c9444278f436fbfb6329e41022"},{url:"pwa-64x64.png",revision:"dbd52076e73da2cdccf120c9d81b6dfd"},{url:"manifest.webmanifest",revision:"22535e1b1a70e8aa1d74ac8590a626e4"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
