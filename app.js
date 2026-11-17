{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
inicio:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
textos:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
resumenes:'<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 3v4M17 5h4"/>',
audios:'<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
cuestionarios:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
juegos:'<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4"/><circle cx="15" cy="11" r=".9"/><circle cx="18" cy="13" r=".9"/>',
explicaciones:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
mapas:'<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M12 7.5V12l-5 4.6M12 12l5 4.6"/>',
up:'<path d="M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.6 9 4.5 4.5 0 0 1 17 18"/><path d="M12 12v9M8.5 15.5 12 12l3.5 3.5"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
const NAV=[['inicio','Inicio'],['textos','Mis textos'],['resumenes','Resúmenes'],['audios','Audios'],['cuestionarios','Cuestionarios'],['juegos','Juegos'],['explicaciones','Explicaciones IA'],['mapas','Mapas conceptuales']];
const ACTS=[['resumenes','Resumir'],['audios','Escuchar'],['cuestionarios','Practicar'],['juegos','Jugar'],['explicaciones','Ver explicación'],['mapas','Visualizar']];
const KEY={resumenes:'resumen',audios:'podcast',cuestionarios:'quiz',juegos:'juego',explicaciones:'expl',mapas:'mapa'};

/* ---------- estado (se guarda en este navegador) ---------- */
let st={mats:[],cur:null,out:{}};
try{const r=localStorage.getItem('reescribo.v1');if(r)st=Object.assign(st,JSON.parse(r))}catch(e){}
const save=()=>{try{localStorage.setItem('reescribo.v1',JSON.stringify(st))}catch(e){toast('No se pudo guardar en este navegador.')}};
const cur=()=>st.mats.find(m=>m.id===st.cur)||null;
const outOf=k=>(st.out[st.cur]||{})[k];
const setOut=(id,k,v)=>{(st.out[id]=st.out[id]||{})[k]=v;save()};
if(!cur()&&st.mats.length)st.cur=st.mats[0].id;

let busy=null,trans=null,openId=null,qs=null,gs=null,es=null,delArm=null,recorder=null,recTimer=null;
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),4200)}
const errText=e=>(e&&e.message)||'Algo salió mal. Probá de nuevo.';
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}

/* ---------- IA (Gemini a través de /api/ai) ---------- */
async function ai(prompt,{json=false,audio=null,mime=null}={}){
 let r;try{r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,json,audio,mime})})}
 catch(e){throw new Error('No hay conexión con el servidor de reescribo.')}
 let d={};try{d=await r.json()}catch(e){}
 if(!r.ok){const er=new Error(d.error||((r.status===404||r.status===405)?'La IA no funciona desde acá: esta web tiene que abrirse desde el link de Vercel (termina en .vercel.app), no desde GitHub Pages.':'Error '+r.status));er.status=r.status;throw er}
 const t=d.text||'';if(!json)return t;
 try{return JSON.parse(t.replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim())}catch(e){throw new Error('La IA devolvió un formato raro. Probá generar de nuevo.')}
}
const base=m=>`Sos reescribo, una plataforma educativa uruguaya que transforma materiales de estudio en nuevas formas de aprender. Escribí en español rioplatense con voseo, claro y cercano, pensado para estudiantes. Usá SOLO la información del material; si algo no está, no lo inventes.\n\nTítulo: ${m.title}\nMATERIAL:\n"""\n${m.text.slice(0,120000)}\n"""\n\nTAREA: `;
const need=(ok,msg)=>{if(!ok)throw new Error(msg||'La IA devolvió algo incompleto. Probá generar de nuevo.')};
const GEN={
 resumen:(m,len)=>ai(base(m)+(len==='breve'?'Hacé un resumen breve (máximo 200 palabras) con "## Idea central" (2 oraciones) y "## Puntos clave" (4 viñetas con "- ").':'Hacé un resumen completo con estas secciones en Markdown: "## Idea central" (2-3 oraciones), "## Puntos clave" (5-8 viñetas con "- "), "## Conceptos importantes" (viñetas "- **concepto**: definición breve") y "## Para repasar" (3 preguntas en viñetas).')+' No escribas nada antes ni después.'),
 podcast:async m=>{const v=await ai(base(m)+'Escribí el guion de un podcast de estudio de unos 3 minutos entre Sofi (voz "A") y Martín (voz "B"), dos estudiantes uruguayos que explican el material con naturalidad, ejemplos concretos y voseo. Entre 12 y 16 intervenciones de máximo 350 caracteres cada una. Arrancan presentando el tema y cierran repasando 3 ideas clave. Devolvé SOLO JSON: {"titulo":string,"lineas":[{"voz":"A"|"B","texto":string}]}',{json:true});need(v&&Array.isArray(v.lineas)&&v.lineas.length);return v},
 quiz:async m=>{const v=await ai(base(m)+'Creá un cuestionario de 8 preguntas de opción múltiple para practicar, de dificultad creciente. Cada una con 4 opciones plausibles, una sola correcta, y una explicación breve de por qué es la correcta. Devolvé SOLO JSON: {"preguntas":[{"pregunta":string,"opciones":[string,string,string,string],"correcta":0-3,"explicacion":string}]}',{json:true});need(v&&Array.isArray(v.preguntas)&&v.preguntas.length);return v},
 juego:async m=>{const v=await ai(base(m)+'Elegí los 6 conceptos más importantes del material para un juego de unir conceptos con definiciones. Términos cortos (máximo 5 palabras) y definiciones claras de máximo 90 caracteres que no repitan el término. Devolvé SOLO JSON: {"pares":[{"termino":string,"definicion":string}]}',{json:true});need(v&&Array.isArray(v.pares)&&v.pares.length>=3);return v},
 expl:async m=>{const v=await ai(base(m)+'Prepará una explicación en video de 5 escenas, como una clase corta. Cada escena tiene un título corto, 3 puntos de máximo 70 caracteres que se ven en pantalla, y una narración hablada de máximo 500 caracteres que explica la escena con ejemplos. Devolvé SOLO JSON: {"titulo":string,"escenas":[{"titulo":string,"puntos":[string,string,string],"narracion":string}]}',{json:true});need(v&&Array.isArray(v.escenas)&&v.escenas.length);return v},
 mapa:async m=>{const v=await ai(base(m)+'Armá un mapa conceptual del material: un concepto central, entre 4 y 6 ramas principales y 2 a 4 ideas hijas por rama. Etiquetas cortas (máximo 45 caracteres). Devolvé SOLO JSON: {"centro":string,"ramas":[{"nombre":string,"hijos":[string]}]}',{json:true});need(v&&Array.isArray(v.ramas)&&v.ramas.length);return v}};
const LBL={resumen:'el resumen',podcast:'el audio',quiz:'el cuestionario',juego:'el juego',expl:'la explicación',mapa:'el mapa conceptual'};

async function gen(view){
 const key=KEY[view],m=cur();if(busy||!m)return;
 if(!m.text.trim())return toast('Este material todavía no tiene texto.');
 stopAll();busy=key;const id=m.id;$('#gen').disabled=true;
 $('#out').innerHTML=`<div class="load"><span class="dots"></span>Generando ${LBL[key]}… puede tardar unos segundos.</div>`;
 try{const v=key==='resumen'?await GEN.resumen(m,$('#len').value):await GEN[key](m);
  need(key!=='resumen'||v.trim());setOut(id,key,v);if(key==='podcast'||key==='resumen')dropAudio(id,key);qs=gs=es=null;busy=null;render();
  if(key==='podcast'&&st.cur===id&&location.hash==='#audios')makeAudio('podcast',linesOf('podcast'));
 }catch(e){busy=null;const o=$('#out');if(o)o.innerHTML=`<p class="err">${esc(errText(e))}</p>`;const g=$('#gen');if(g)g.disabled=false}
}
const inl=s=>s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
function md(t){let h='',ul=false;for(const l of esc(t).split('\n')){
 if(/^\s*[-*•] /.test(l)){if(!ul){h+='<ul>';ul=true}h+='<li>'+inl(l.replace(/^\s*[-*•] /,''))+'</li>';continue}
 if(ul){h+='</ul>';ul=false}
 if(/^#{1,4} /.test(l))h+='<h3>'+inl(l.replace(/^#+ /,''))+'</h3>';else if(l.trim())h+='<p>'+inl(l)+'</p>'}
 return h+(ul?'</ul>':'')}

/* ---------- voz (la del navegador, gratis) ---------- */
const synth=window.speechSynthesis||null;
let voices=[];const PREF=['es-UY','es-AR','es-419','es-MX','es-US','es-ES'];
function loadVoices(){if(!synth)return;voices=synth.getVoices().filter(v=>/^es/i.test(v.lang)).sort((a,b)=>{const i=x=>{const k=PREF.indexOf(x.lang.replace('_','-'));return k<0?99:k};return i(a)-i(b)})}
if(synth){loadVoices();synth.onvoiceschanged=loadVoices}
const tts={state:'idle',q:[],i:0,gen:0,rate:1,onLine:null};
function chunks(t){const out=[];for(const s of String(t).replace(/[#*]/g,'').match(/[^.!?¡¿\n]+[.!?]*|\n/g)||[]){const x=s.trim();if(!x)continue;
 if(out.length&&(out[out.length-1].length+x.length)<200)out[out.length-1]+=' '+x;else{for(let i=0;i<x.length;i+=220)out.push(x.slice(i,i+220))}}return out}
function ttsNext(g){if(g!==tts.gen)return;if(tts.i>=tts.q.length){tts.state='idle';syncTts();return}
 const it=tts.q[tts.i],u=new SpeechSynthesisUtterance(it.text),v=voices[it.v]||voices[0];
 if(v){u.voice=v;u.lang=v.lang}else u.lang='es-ES';u.rate=tts.rate;u.pitch=it.p||1;
 u.onstart=()=>{if(g===tts.gen&&it.id&&tts.onLine)tts.onLine(it.id)};
 u.onend=()=>{if(g!==tts.gen||tts.state==='idle')return;tts.i++;ttsNext(g)};
 u.onerror=e=>{if(g!==tts.gen||e.error==='interrupted'||e.error==='canceled')return;tts.i++;ttsNext(g)};
 synth.speak(u)}
function ttsPlay(items,onLine){if(!synth)return;synth.cancel();tts.gen++;tts.q=items;tts.i=0;tts.onLine=onLine||null;tts.state='speaking';syncTts();ttsNext(tts.gen)}
function ttsStop(){if(!synth)return;tts.gen++;tts.state='idle';synth.cancel();syncTts()}
function playToggle(start){if(!synth)return;if(tts.state==='speaking'){synth.pause();tts.state='paused';syncTts()}else if(tts.state==='paused'){synth.resume();tts.state='speaking';syncTts()}else start()}
function syncTts(){const b=$('#play');if(b)b.textContent=tts.state==='speaking'?'Pausar':tts.state==='paused'?'Seguir':b.dataset.l;const s=$('#stop');if(s)s.disabled=tts.state==='idle'}
function stopAll(){ttsStop();if(recorder&&recorder.state==='recording')recorder.stop()}

/* ---------- audio → texto ---------- */
const TPROMPT='Transcribí este fragmento de audio en español de forma literal y prolija, con puntuación y párrafos. Devolvé solo la transcripción, sin comentarios, títulos ni marcas de tiempo. Si no se escucha habla, devolvé un texto vacío.';
function toWav(f,sr){const b=new ArrayBuffer(44+f.length*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+f.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,f.length*2,true);
 for(let i=0;i<f.length;i++){const s=Math.max(-1,Math.min(1,f[i]));v.setInt16(44+i*2,s<0?s*0x8000:s*0x7fff,true)}return new Blob([b],{type:'audio/wav'})}
const toB64=blob=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=ko;r.readAsDataURL(blob)});
const durOf=url=>new Promise(ok=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>ok(a.duration);a.onerror=()=>ok(0);a.src=url});
async function transcribe(blob,url,prog){
 const d=await durOf(url);if(d&&isFinite(d)&&d>45*60)throw new Error('Por ahora transcribimos audios de hasta 45 minutos. Cortalo en partes y subilas de a una.');
 const SR=16000,AC=window.AudioContext||window.webkitAudioContext;let ctx,buf;
 try{ctx=new AC({sampleRate:SR});buf=await ctx.decodeAudioData(await blob.arrayBuffer())}catch(e){throw new Error('No pudimos leer ese audio. Probá con MP3, M4A o WAV.')}finally{try{ctx&&ctx.close()}catch(e){}}
 const n=buf.length,ch=buf.numberOfChannels,mono=new Float32Array(n);
 for(let c=0;c<ch;c++){const d2=buf.getChannelData(c);for(let i=0;i<n;i++)mono[i]+=d2[i]/ch}
 const sr=buf.sampleRate,CH=60*sr,parts=Math.max(1,Math.ceil(n/CH));let out='';
 for(let k=0;k<parts;k++){prog(`Transcribiendo parte ${k+1} de ${parts}…`);
  const b64=await toB64(toWav(mono.subarray(k*CH,(k+1)*CH),sr));
  for(let a=0;;a++){try{const t=await ai(TPROMPT,{audio:b64,mime:'audio/wav'});out+=(out&&t.trim()?'\n\n':'')+t.trim();break}
   catch(e){if(e.status===429&&a<4){prog('Llegamos al límite gratis por minuto: esperamos 30 segundos y seguimos…');await sleep(30000);continue}throw e}}}
 return out}

/* ---------- crear audio real (voces de Gemini) ---------- */
const idb=(()=>{let p;const open=()=>p||(p=new Promise((ok,ko)=>{const r=indexedDB.open('reescribo',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)}));
 const tx=async(mode,fn)=>{const db=await open();return new Promise((ok,ko)=>{const t=db.transaction('audio',mode),q=fn(t.objectStore('audio'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>ko(t.error)})};
 return{get:k=>tx('readonly',s=>s.get(k)).catch(()=>null),set:(k,v)=>tx('readwrite',s=>s.put(v,k)).catch(()=>{}),del:k=>tx('readwrite',s=>s.delete(k)).catch(()=>{})}})();
const aud={url:{},checked:{},job:null};
function dropAudio(id,kind){const k=id+':'+kind;if(aud.url[k])URL.revokeObjectURL(aud.url[k]);delete aud.url[k];aud.checked[k]=true;idb.del(k)}
function audioOf(kind){const k=st.cur+':'+kind;if(!aud.checked[k]){aud.checked[k]=true;idb.get(k).then(b=>{if(b){aud.url[k]=URL.createObjectURL(b);render()}})}return aud.url[k]}
function pcmWav(bytes,rate){const b=new ArrayBuffer(44),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+bytes.length,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,bytes.length,true);
 return new Blob([b,bytes],{type:'audio/wav'})}
const fromB64=s=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
function groupLines(lines){const g=[];let c=[],n=0;for(const l of lines){for(const t of l.text.length>450?chunks(l.text):[l.text]){if(n+t.length>450&&c.length){g.push(c);c=[];n=0}c.push({speaker:l.speaker,text:t});n+=t.length}}if(c.length)g.push(c);return g}
async function ttsRequest(lines){let r;try{r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tts:{lines}})})}catch(e){throw new Error('No hay conexión con el servidor de reescribo.')}
 let d={};try{d=await r.json()}catch(e){}if(!r.ok){const er=new Error(d.error||((r.status===404||r.status===405)?'El audio no funciona desde acá: abrí la web desde el link de Vercel (.vercel.app).':'Error '+r.status));er.status=r.status;throw er}return d}
async function makeAudio(kind,lines){if(aud.job)return toast('Ya se está creando un audio, esperá que termine.');
 const id=st.cur,k=id+':'+kind,groups=groupLines(lines);aud.job={k,msg:'Preparando el audio…'};render();
 const set=t=>{aud.job.msg=t;const p=$('#amsg');if(p)p.textContent=t};
 try{const parts=[];let rate=24000;
  for(let i=0;i<groups.length;i++){set(`Creando el audio: parte ${i+1} de ${groups.length}…`);
   for(let a=0;;a++){try{const d=await ttsRequest(groups[i]);rate=d.rate||rate;parts.push(fromB64(d.audio));break}
    catch(e){if(e.status===429&&a<5){set('Llegamos al límite gratis por minuto: esperamos 40 segundos y seguimos…');await sleep(40000);continue}throw e}}}
  const len=parts.reduce((n,p)=>n+p.length,0),all=new Uint8Array(len);let o=0;for(const p of parts){all.set(p,o);o+=p.length}
  const blob=pcmWav(all,rate);await idb.set(k,blob);if(aud.url[k])URL.revokeObjectURL(aud.url[k]);aud.url[k]=URL.createObjectURL(blob);aud.checked[k]=true;
  aud.job=null;toast('¡Audio listo!');render()
 }catch(e){aud.job=null;toast(errText(e));render()}}
function audioBox(kind,label){const fname=(kind==='podcast'?'Podcast - ':'Resumen - ')+(cur()?.title||'reescribo');const k=st.cur+':'+kind,url=audioOf(kind),job=aud.job&&aud.job.k===k;
 if(job)return `<div class="abox"><div class="load"><span class="dots"></span><span id="amsg">${esc(aud.job.msg)}</span></div></div>`;
 if(url)return `<div class="abox"><audio controls src="${url}"></audio><div class="row" style="margin:0"><a class="btn pri" href="${url}" download="${esc(fname)}.wav">Descargar audio</a><button id="mk" class="ghost">Volver a crear el audio</button></div></div>`;
 return `<div class="abox"><button class="pri" id="mk">${label}</button><span class="note">Se crea con voces de IA y lo podés descargar.</span></div>`}

/* ---------- material ---------- */
function addMat(title,type,text){const id='m'+Date.now().toString(36);st.mats.unshift({id,title:title||'Material sin título',type,text,created:Date.now()});st.cur=id;save();return id}
const loaded={};
function loadScript(u){return loaded[u]||(loaded[u]=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>ko(new Error('No se pudo cargar el lector de archivos.'));document.head.appendChild(s)}))}
async function readFile(f){
 const ext=(f.name.split('.').pop()||'').toLowerCase(),name=f.name.replace(/\.[^.]+$/,'');
 if(f.type.startsWith('audio/')||['mp3','m4a','wav','ogg','webm','aac','opus'].includes(ext)){if(trans&&trans.url)URL.revokeObjectURL(trans.url);trans={name,blob:f,url:URL.createObjectURL(f),text:''};go('inicio');return}
 toast('Leyendo '+f.name+'…');
 try{let text='';
  if(ext==='pdf'){const v='3.11.174';await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${v}/pdf.min.js`);
   pdfjsLib.GlobalWorkerOptions.workerSrc=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${v}/pdf.worker.min.js`;
   const doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
   for(let i=1;i<=doc.numPages;i++){const c=await(await doc.getPage(i)).getTextContent();text+=c.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n\n'}
   if(text.trim().length<40)throw new Error('Este PDF parece escaneado (es una imagen). Probá con un PDF con texto o pegá el contenido.')}
  else if(ext==='docx'){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');text=(await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value}
  else if(['txt','md'].includes(ext)||f.type.startsWith('text/'))text=await f.text();
  else throw new Error('Ese formato no lo leemos todavía. Usá PDF, DOCX, texto o audio.');
  addMat(name,ext,text.replace(/[ \t]+\n/g,'\n').trim());toast('Listo: «'+name+'» está cargado.');go('inicio');
 }catch(e){toast(errText(e))}
}
$('#file').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)readFile(f)});

/* ---------- vistas ---------- */
function matBar(view,extra){const has=outOf(KEY[view]);
 return `<div class="bar"><label>Material<select id="matSel">${st.mats.map(m=>`<option value="${m.id}"${m.id===st.cur?' selected':''}>${esc(m.title)}</option>`).join('')}</select></label>${extra||''}<button class="pri" id="gen"${busy?' disabled':''}>${has?'Volver a generar':'Generar'}</button></div>`}
const emptyMats=`<div class="empty">${ic('up')}<p>Todavía no subiste ningún material.</p><a class="btn pri" href="#inicio">Subir material</a></div>`;
const wait=t=>`<div class="empty"><p>${t}</p></div>`;
const noVoice='<span class="note">Tu navegador no tiene voz en español: acá tenés el texto.</span>';
const voiceOK=()=>synth&&(voices.length||synth.getVoices().length);

const V={
inicio(){const m=cur();
 return `<h1>¡Hola! ¿Qué vamos a aprender hoy?</h1><p class="sub">Transformá tus materiales en nuevas formas de aprender.</p>
 <label class="drop" id="drop" tabindex="0">${ic('up')}<b>Subí tu material</b><small>PDF, DOCX, texto o audio</small></label>
 <div class="alt"><button id="pasteBtn">${ic('textos')}Pegar texto</button><button id="recBtn">${ic('mic')}Grabar clase</button></div>
 ${trans?transPanel():''}<div id="pasteBox"></div>
 ${m?`<span class="chip">Material activo: <strong>${esc(m.title)}</strong></span>`:''}
 <h2 class="q">¿Qué querés hacer?</h2>
 <div class="acts">${ACTS.map(([h,t])=>`<a class="act" href="#${h}">${ic(h)}${t}</a>`).join('')}</div>`},
textos(){if(!st.mats.length)return`<h1>Mis textos</h1><p class="sub">Acá se guarda todo lo que subís.</p>${emptyMats}`;
 const o=st.mats.find(m=>m.id===openId);
 return `<h1>Mis textos</h1><p class="sub">Tus materiales quedan guardados en este navegador.</p><div class="list">${st.mats.map(m=>`<div class="item${m.id===st.cur?' on':''}"><div><b>${esc(m.title)}</b><small>${esc(m.type.toUpperCase())} · ${m.text.length.toLocaleString('es-UY')} caracteres · ${new Date(m.created).toLocaleDateString('es-UY')}</small></div><div class="row" style="margin:0"><button data-open="${m.id}">Abrir</button><button class="ghost" data-del="${m.id}">${delArm===m.id?'¿Seguro? Tocá de nuevo':'Eliminar'}</button></div></div>`).join('')}</div>
 ${o?`<section class="chat" id="detail"><label class="note">Título</label><input type="text" id="dTitle" value="${esc(o.title)}" style="width:100%"><p class="note">Texto del material (podés corregirlo)</p><textarea id="dText" rows="10">${esc(o.text)}</textarea><div class="row"><button class="pri" id="dSave">Guardar cambios</button><button id="dDl">Descargar texto</button></div>
 <h2 class="q">Preguntale a tu material</h2>${((st.out[o.id]||{}).chat||[]).map(c=>`<div class="msg ${c.role==='user'?'u':'a'}">${c.role==='user'?esc(c.content):md(c.content)}</div>`).join('')}<div id="ans"></div>
 <form class="ask" id="ask"><input type="text" id="askIn" placeholder="Ej: ¿qué diferencia hay entre…?"><button class="pri">Preguntar</button></form></section>`:''}`},
resumenes(){if(!st.mats.length)return`<h1>Resúmenes</h1>${emptyMats}`;const v=outOf('resumen');
 return `<h1>Resúmenes</h1><p class="sub">Lo esencial de tu material, ordenado para estudiar.</p>${matBar('resumenes','<label class="sm">Largo<select id="len"><option value="completo">Completo</option><option value="breve">Breve</option></select></label>')}
 <div id="out">${v?`${audioBox('resumen','Crear audio del resumen')}<div class="row"><button id="copy">Copiar</button><button id="dl">Descargar texto</button>${voiceOK()?'<button id="play" class="ghost" data-l="Escuchar con la voz del navegador">Escuchar con la voz del navegador</button><button id="stop" class="ghost" disabled>Detener</button>':''}</div><article class="md">${md(v)}</article>`:wait('Elegí el material y tocá Generar.')}</div>`},
audios(){if(!st.mats.length)return`<h1>Audios</h1>${emptyMats}`;const p=outOf('podcast');
 return `<h1>Audios</h1><p class="sub">Un podcast de estudio con dos voces que te explica tu material.</p>${matBar('audios')}
 <div id="out">${p?`<div class="pod"><div class="podh"><b>${esc(p.titulo||'Podcast')}</b></div><div style="padding:0 16px">${audioBox('podcast','Crear audio del podcast')}</div>
 ${voiceOK()?`<div class="row" style="padding:0 16px;margin:0"><button class="ghost" id="play" data-l="Vista previa con la voz del navegador">Vista previa con la voz del navegador</button><button id="stop" class="ghost" disabled>Detener</button><select id="rate" aria-label="Velocidad"><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="0.85">0.85x</option></select></div>`:''}
 <div class="lines">${p.lineas.map((l,i)=>`<div class="ln${l.voz==='B'?' b':''}" data-id="l${i}"><span>${l.voz==='B'?'Martín':'Sofi'}</span><div>${esc(l.texto)}</div></div>`).join('')}</div></div>`:wait('Tocá Generar y armamos un audio para escuchar donde quieras.')}</div>`},
cuestionarios(){if(!st.mats.length)return`<h1>Cuestionarios</h1>${emptyMats}`;const q=outOf('quiz');
 return `<h1>Cuestionarios</h1><p class="sub">Practicá con preguntas y mirá por qué cada respuesta es correcta.</p>${matBar('cuestionarios')}<div id="out">${q?quizHTML(q):wait('Generá un cuestionario para ponerte a prueba.')}</div>`},
juegos(){if(!st.mats.length)return`<h1>Juegos</h1>${emptyMats}`;const g=outOf('juego');
 return `<h1>Juegos</h1><p class="sub">Uní cada concepto con su definición lo más rápido que puedas.</p>${matBar('juegos')}<div id="out">${g?gameHTML(g):wait('Generá un juego con los conceptos de tu material.')}</div>`},
explicaciones(){if(!st.mats.length)return`<h1>Explicaciones IA</h1>${emptyMats}`;const x=outOf('expl');
 return `<h1>Explicaciones IA</h1><p class="sub">Una clase corta en escenas, narrada en voz alta.</p>${matBar('explicaciones')}
 <div id="out">${x?`<div class="stage" id="stage"></div><div class="pdots" id="pd"></div><div class="row" style="justify-content:center"><button id="prev">Anterior</button>${voiceOK()?'<button class="pri" id="play" data-l="Reproducir explicación">Reproducir explicación</button><button id="stop" disabled>Detener</button>':''}<button id="next">Siguiente</button></div><p class="cap" id="cap"></p>`:wait('Generá una explicación tipo video de tu material.')}</div>`},
mapas(){if(!st.mats.length)return`<h1>Mapas conceptuales</h1>${emptyMats}`;const mp=outOf('mapa');
 return `<h1>Mapas conceptuales</h1><p class="sub">Visualizá cómo se conectan las ideas.</p>${matBar('mapas')}<div id="out">${mp?mapHTML(mp):wait('Generá un mapa para ver el material de un vistazo.')}</div>`}};

function transPanel(){const a=!!trans.blob,rec=recorder&&recorder.state==='recording';
 return `<section class="trans"><h2>${a?'Transcribir audio: '+esc(trans.name):'Grabar clase'}</h2>${a?`<audio controls src="${trans.url}"></audio>`:''}
 <p class="note">${a?'Tocá Transcribir y la IA pasa el audio a texto. Tarda más o menos 1 minuto cada 10 minutos de audio.':'Tocá Grabar, dejá la compu cerca de quien habla y al terminar tocá Detener: la IA lo pasa a texto.'}</p>
 <div class="row"><button class="pri${rec?' rec':''}" id="rec"${trans.busy?' disabled':''}>${rec?'Detener':a?'Transcribir':'Grabar'}</button><button id="tsave"${trans.busy?' disabled':''}>Guardar como material</button><button class="ghost" id="tcancel">Cancelar</button></div>
 <div class="live" id="prog">${esc(trans.msg||'')}</div><textarea id="ttext" placeholder="La transcripción aparece acá. Podés corregirla antes de guardar.">${esc(trans.text||'')}</textarea></section>`}

function quizHTML(q){const Q=q.preguntas;if(!qs||qs.id!==st.cur)qs={id:st.cur,i:0,score:0,pick:null};
 if(qs.i>=Q.length)return `<div class="qcard"><p class="qn">Resultado</p><div class="big">${qs.score}/${Q.length}</div><p>${qs.score===Q.length?'¡Perfecto! Lo tenés dominado.':qs.score>=Q.length*.6?'Bien ahí. Repasá las que fallaste y volvé a intentar.':'Te conviene repasar el resumen y volver a practicar.'}</p><button class="pri" id="qre">Intentar de nuevo</button></div>`;
 const c=Q[qs.i];
 return `<div class="qcard"><p class="qn">Pregunta ${qs.i+1} de ${Q.length} · ${qs.score} correctas</p><div class="prog"><i style="width:${qs.i/Q.length*100}%"></i></div><h2 class="q" style="margin-top:0">${esc(c.pregunta)}</h2>
 ${c.opciones.map((o,j)=>`<button class="opt${qs.pick!==null?(j===c.correcta?' ok':j===qs.pick?' no':''):''}" data-o="${j}"${qs.pick!==null?' disabled':''}>${esc(o)}</button>`).join('')}
 ${qs.pick!==null?`<div class="exp"><strong>${qs.pick===c.correcta?'¡Correcto!':'No era esa.'}</strong> ${esc(c.explicacion)}</div><button class="pri" id="qnext">${qs.i+1<Q.length?'Siguiente':'Ver resultado'}</button>`:''}</div>`}

const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
function gameHTML(g){const n=g.pares.length;if(!gs||gs.id!==st.cur)gs={id:st.cur,L:shuf([...Array(n).keys()]),R:shuf([...Array(n).keys()]),sel:null,done:[],err:0,t0:Date.now(),end:null};
 if(gs.done.length===n){gs.end=gs.end||Date.now();const s=Math.round((gs.end-gs.t0)/1000);
  return `<div class="qcard"><p class="qn">¡Completaste el juego!</p><div class="big">${s}s</div><p>${gs.err===0?'Sin errores. Impecable.':gs.err+' error'+(gs.err>1?'es':'')+'. ¿Lo bajás en la próxima?'}</p><button class="pri" id="gre">Jugar de nuevo</button></div>`}
 return `<div class="stats"><span>${gs.done.length}/${n} unidos</span><span>${gs.err} errores</span></div><div class="game"><div>${gs.L.map(i=>`<button data-t="${i}" class="${gs.done.includes(i)?'done':gs.sel===i?'sel':''}"${gs.done.includes(i)?' disabled':''}>${esc(g.pares[i].termino)}</button>`).join('')}</div><div>${gs.R.map(i=>`<button data-d="${i}" class="${gs.done.includes(i)?'done':''}"${gs.done.includes(i)?' disabled':''}>${esc(g.pares[i].definicion)}</button>`).join('')}</div></div><p class="note">Tocá un concepto y después su definición.</p>`}

const COL=['#8a63c9','#4f8fd6','#d0659a','#2f9e7e','#d4902c','#6c7bd9'];
function mapHTML(mp){const R=mp.ramas;
 return `<div class="map" id="map"><svg id="msvg" aria-hidden="true"></svg><div class="node mc" style="grid-row:1 / span ${R.length}">${esc(mp.centro)}</div>
 ${R.map((r,i)=>`<div class="node mb" data-b="${i}" style="grid-row:${i+1};border-left-color:${COL[i%6]}">${esc(r.nombre)}</div><div class="mk" style="grid-row:${i+1}">${(r.hijos||[]).map(h=>`<div class="node" data-k="${i}">${esc(h)}</div>`).join('')}</div>`).join('')}</div>`}
function drawMap(){const m=$('#map'),s=$('#msvg');if(!m||!s)return;if(getComputedStyle(m).display!=='grid'){s.innerHTML='';return}
 const B=m.getBoundingClientRect(),r=e=>{const b=e.getBoundingClientRect();return{l:b.left-B.left,r:b.right-B.left,y:b.top-B.top+b.height/2}};
 const c=r($('.mc')),cv=(a,b,col)=>`<path d="M${a.x} ${a.y}C${(a.x+b.x)/2} ${a.y} ${(a.x+b.x)/2} ${b.y} ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="2" opacity=".55"/>`;let h='';
 $$('.mb').forEach(e=>{const i=+e.dataset.b,b=r(e),col=COL[i%6];h+=cv({x:c.r,y:c.y},{x:b.l,y:b.y},col);$$(`[data-k="${i}"]`).forEach(k=>{const kk=r(k);h+=cv({x:b.r,y:b.y},{x:kk.l,y:kk.y},col)})});s.innerHTML=h}
new ResizeObserver(()=>drawMap()).observe(document.body);

function drawStage(){const x=outOf('expl');if(!x||!$('#stage'))return;if(!es||es.id!==st.cur)es={id:st.cur,i:0};const E=x.escenas,s=E[es.i];
 $('#stage').innerHTML=`<small>${esc(x.titulo||'')} · escena ${es.i+1} de ${E.length}</small><h2>${esc(s.titulo)}</h2><ul>${(s.puntos||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`;
 $('#pd').innerHTML=E.map((_,i)=>`<i class="${i===es.i?'on':''}"></i>`).join('');$('#cap').textContent=s.narracion||'';
 $('#prev').disabled=es.i===0;$('#next').disabled=es.i===E.length-1}

const linesOf=kind=>kind==='podcast'?outOf('podcast').lineas.map(l=>({speaker:l.voz==='B'?'Martín':'Sofi',text:l.texto})):chunks(outOf('resumen')).map(text=>({speaker:'Narradora',text}));
/* ---------- render + eventos ---------- */
function go(h){if(location.hash.slice(1)===h)render();else location.hash=h}
function render(){const v=V[location.hash.slice(1)]?location.hash.slice(1):'inicio';
 $('#nav').innerHTML=NAV.map(([h,t])=>`<a href="#${h}" class="${h===v?'on':''}">${ic(h)}${t}</a>`).join('');
 $('#main').innerHTML=V[v]();bind(v);syncTts()}
function setProg(t){if(trans)trans.msg=t;const p=$('#prog');if(p)p.textContent=t}
async function runTranscribe(){if(!trans||!trans.blob||trans.busy)return;trans.busy=true;render();
 try{const t=await transcribe(trans.blob,trans.url,setProg);if(!trans)return;trans.text=(trans.text?trans.text+'\n\n':'')+t;trans.msg=t.trim()?'Listo. Revisá el texto y guardalo como material.':'No se escuchó habla en el audio.'}
 catch(e){if(trans)trans.msg='';toast(errText(e))}
 if(trans){trans.busy=false;render()}}
function startRec(){if(!navigator.mediaDevices||!window.MediaRecorder)return toast('Tu navegador no permite grabar. Probá con Chrome.');
 navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{const parts=[];recorder=new MediaRecorder(stream);const t0=Date.now();
  recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
  recorder.onstop=()=>{clearInterval(recTimer);stream.getTracks().forEach(t=>t.stop());const blob=new Blob(parts,{type:recorder.mimeType||'audio/webm'});recorder=null;
   if(!trans)return;trans.blob=blob;trans.url=URL.createObjectURL(blob);trans.msg='';render();runTranscribe()};
  recorder.start(1000);recTimer=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);setProg('Grabando '+String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0'))},500);render()
 }).catch(()=>toast('Sin permiso de micrófono no podemos grabar. Revisá los permisos del navegador.'))}
function bind(v){
 const ms=$('#matSel');if(ms)ms.onchange=()=>{stopAll();st.cur=ms.value;save();render()};
 const g=$('#gen');if(g)g.onclick=()=>gen(v);
 const sb=$('#stop');if(sb)sb.onclick=ttsStop;
 const mk=$('#mk');if(mk&&KEY[v])mk.onclick=()=>{ttsStop();makeAudio(KEY[v],linesOf(KEY[v]))};
 if(v==='inicio'){const dz=$('#drop');dz.onclick=e=>{e.preventDefault();$('#file').click()};dz.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file').click()}};
  dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer.files[0];if(f)readFile(f)};
  $('#pasteBtn').onclick=()=>{$('#pasteBox').innerHTML=`<section class="paste"><h2>Pegar texto</h2><input type="text" id="pT" placeholder="Título (ej: Unidad 3 · Comunicación organizacional)" style="width:100%;margin:8px 0"><textarea id="pX" placeholder="Pegá acá tus apuntes, un texto o un capítulo."></textarea><div class="row"><button class="pri" id="pS">Guardar material</button><button class="ghost" id="pC">Cancelar</button></div></section>`;
   $('#pT').focus();$('#pC').onclick=()=>$('#pasteBox').innerHTML='';$('#pS').onclick=()=>{const t=$('#pX').value.trim();if(t.length<30)return toast('Pegá un texto un poco más largo.');addMat($('#pT').value.trim(),'texto',t);toast('Material guardado.');render()}};
  $('#recBtn').onclick=()=>{if(trans&&(trans.busy||recorder))return;trans={name:'Clase del '+new Date().toLocaleDateString('es-UY'),blob:null,url:null,text:''};render()};
  if(trans){const ta=$('#ttext');ta.oninput=()=>{trans.text=ta.value};
   $('#rec').onclick=()=>{if(recorder&&recorder.state==='recording')recorder.stop();else if(trans.blob)runTranscribe();else startRec()};
   $('#tcancel').onclick=()=>{if(recorder&&recorder.state==='recording'){recorder.onstop=null;recorder.stream.getTracks().forEach(t=>t.stop());recorder.stop();recorder=null;clearInterval(recTimer)}if(trans.url)URL.revokeObjectURL(trans.url);trans=null;render()};
   $('#tsave').onclick=()=>{const t=ta.value.trim();if(t.length<20)return toast('La transcripción está vacía o es muy corta.');addMat(trans.name,'audio',t);if(trans.url)URL.revokeObjectURL(trans.url);trans=null;toast('Transcripción guardada como material.');render()}}}
 if(v==='textos'){$$('[data-open]').forEach(b=>b.onclick=()=>{openId=st.cur=b.dataset.open;delArm=null;save();render();$('#detail')?.scrollIntoView({behavior:'smooth'})});
  $$('[data-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.del;if(delArm!==id){delArm=id;return render()}st.mats=st.mats.filter(m=>m.id!==id);delete st.out[id];dropAudio(id,'podcast');dropAudio(id,'resumen');if(st.cur===id)st.cur=st.mats[0]?.id||null;if(openId===id)openId=null;delArm=null;save();render()});
  const o=st.mats.find(m=>m.id===openId);
  const ds=$('#dSave');if(ds)ds.onclick=()=>{o.title=$('#dTitle').value.trim()||o.title;if($('#dText').value!==o.text){o.text=$('#dText').value;dropAudio(o.id,'podcast');dropAudio(o.id,'resumen');const c=(st.out[o.id]||{}).chat;st.out[o.id]=c?{chat:c}:{}}save();toast('Cambios guardados.');render()};
  const dd=$('#dDl');if(dd)dd.onclick=()=>download(o.title+'.txt',o.text);
  const f=$('#ask');if(f)f.onsubmit=async e=>{e.preventDefault();const q=$('#askIn').value.trim();if(!q||busy)return;
   const hist=((st.out[o.id]=st.out[o.id]||{}).chat=(st.out[o.id].chat||[]));hist.push({role:'user',content:q});save();busy='chat';render();
   $('#ans').innerHTML='<div class="msg a">Pensando…</div>';
   try{const conv=hist.slice(-8).map(c=>(c.role==='user'?'Estudiante: ':'reescribo: ')+c.content).join('\n');
    const r=await ai(base(o)+'Respondé la última pregunta del estudiante en 2 a 6 oraciones, basándote solo en el material. Si la respuesta no está en el material, decilo.\n\nConversación:\n'+conv);
    hist.push({role:'assistant',content:r||'No pude responder esa, probá preguntarlo de otra forma.'});save()}catch(err){hist.pop();save();toast(errText(err))}busy=null;render();$('#askIn')?.focus()}}
 if(v==='resumenes'){const c=$('#copy');if(c)c.onclick=()=>navigator.clipboard.writeText(outOf('resumen')).then(()=>toast('Resumen copiado.'),()=>toast('No se pudo copiar.'));
  const d=$('#dl');if(d)d.onclick=()=>download('Resumen - '+(cur()?.title||'reescribo')+'.md',outOf('resumen'));
  const p=$('#play');if(p)p.onclick=()=>playToggle(()=>ttsPlay(chunks(outOf('resumen')).map(text=>({text}))))}
 if(v==='audios'){const p=$('#play'),pod=outOf('podcast'),r=$('#rate');
  if(p)p.onclick=()=>playToggle(()=>{tts.rate=+r.value;const two=voices.length>1;
   ttsPlay(pod.lineas.flatMap((l,i)=>chunks(l.texto).map(text=>({text,id:'l'+i,v:l.voz==='B'&&two?1:0,p:l.voz==='B'&&!two?.8:1.05}))),
    id=>{$$('.ln').forEach(x=>x.classList.toggle('on',x.dataset.id===id));$(`.ln[data-id="${id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'})})});
  if(r)r.onchange=()=>{tts.rate=+r.value}}
 if(v==='cuestionarios'){$$('[data-o]').forEach(b=>b.onclick=()=>{const c=outOf('quiz').preguntas[qs.i];qs.pick=+b.dataset.o;if(qs.pick===c.correcta)qs.score++;render()});
  const n=$('#qnext');if(n)n.onclick=()=>{qs.i++;qs.pick=null;render()};const r=$('#qre');if(r)r.onclick=()=>{qs=null;render()}}
 if(v==='juegos'){$$('[data-t]').forEach(b=>b.onclick=()=>{gs.sel=+b.dataset.t;render()});
  $$('[data-d]').forEach(b=>b.onclick=()=>{if(gs.sel===null)return toast('Primero elegí un concepto de la izquierda.');const d=+b.dataset.d;
   if(d===gs.sel){gs.done.push(d);gs.sel=null;render()}else{gs.err++;b.classList.add('shake');setTimeout(render,380)}});
  const r=$('#gre');if(r)r.onclick=()=>{gs=null;render()}}
 if(v==='explicaciones'&&$('#stage')){drawStage();const E=outOf('expl').escenas;
  $('#prev').onclick=()=>{ttsStop();es.i=Math.max(0,es.i-1);drawStage()};$('#next').onclick=()=>{ttsStop();es.i=Math.min(E.length-1,es.i+1);drawStage()};
  const p=$('#play');if(p)p.onclick=()=>playToggle(()=>ttsPlay(E.slice(es.i).flatMap((s,k)=>chunks(s.narracion).map(text=>({text,id:'s'+(es.i+k)}))),id=>{const i=+id.slice(1);if(i!==es.i){es.i=i;drawStage()}}))}
 if(v==='mapas')requestAnimationFrame(drawMap);
}
addEventListener('hashchange',()=>{ttsStop();render();scrollTo(0,0)});
addEventListener('beforeunload',e=>{if(recorder||(trans&&trans.busy)){e.preventDefault();e.returnValue=''}});
render();
}
