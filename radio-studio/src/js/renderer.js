// ── RadioFlare v3 — VDJ-Style Renderer ─────────────────────────────────
import { AudioEngine }      from './audio-engine.js';
import { WaveformRenderer } from './waveform.js';
import { Library }          from './library.js';
import { Scheduler, Clockwheel } from './scheduler.js';
import { StreamingManager } from './streaming.js';
import { Knob, VUMeter }    from './knob.js';
import { JogWheel }         from './jogwheel.js';
import { SetupWizard }      from './setup-wizard.js';
import { Auth }             from './auth.js';

const $  = id => document.getElementById(id);
const fmtTime = s => { if (!s||isNaN(s)) return '0:00.0'; return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`; };
const fmtDur  = s => { if (!s) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; };
const vuDB    = rms => Math.max(0,Math.min(100,(20*Math.log10(Math.max(rms,1e-6))+60)/60*100));

// ── STEMS simulation using EQ filters ────────────────────────────────────────
const STEMS = {
  // [high, mid, low] EQ values: 0 = mute, 1 = unity, 2 = boost
  vocal:  [2,   2,   0  ],  // remove bass → keeps vocals/melody
  instru: [1.5, 1.5, 1  ],  // slight bass reduction
  bass:   [0,   0.5, 2  ],  // boost bass, remove highs
  acap:   [2,   2,   0  ],  // alias for vocal
  kick:   [0,   0,   2  ],  // only low end (kick)
  hihat:  [2,   0,   0  ],  // only highs (hi-hats)
  snare:  [0.5, 2,   0  ],  // mids (snare range)
  all:    [1,   1,   1  ],  // reset all
};

const App = {
  engine:    null,
  library:   new Library(),
  scheduler: new Scheduler(),
  cw:        new Clockwheel('Default'),
  streaming: null,
  wf:        [null, null],
  jog:       [null, null],
  knobs:     {},
  vu:        [null, null],
  faderVals: [0.85, 0.85],
  state: {
    playing:[false,false], cue:[false,false],
    autoDJ:false, schedRun:false,
    streamOn:false, streamCfg:null,
    ctxTrack:null, profile:0,
    profiles:[{},{},{}],
    stems: [[false,false,false,false,false,false,false,false],
            [false,false,false,false,false,false,false,false]],
    folders: [],
    activeView: 'tracks',
  },
  log: [],
  _lastTick: 0,

  async init() {
    // Auth first
    try {
      this.auth = new Auth(user => this._onLogin(user));
      await this.auth.init();
    } catch(e) {
      console.error('Auth init error:', e);
    }

    this.engine    = new AudioEngine();
    await this.engine.init();
    this.streaming = new StreamingManager(this.engine);
    this.wizard    = new SetupWizard((settings, skipped) => this._onWizardComplete(settings, skipped));

    this._initWaveforms();
    this._initJogWheels();
    this._initHotCues();
    this._initPads();
    this._initKnobs();
    this._initFaders();
    this._initVU();
    this._initControls();
    this._initLibrary();
    this._initScheduler();
    this._initStems();
    this._startAnimLoop();
    this._startClock();
    await this._loadCfg();

    // Show setup wizard on first launch
    const setupDone = await window.radioAPI.getSetting('setupDone');
    if (!setupDone) {
      setTimeout(() => this.wizard.show(), 600);
    }

    this.streaming.on('status', d => this._onStreamStatus(d));
    this.engine.on('trackloaded',  d => this._onLoaded(d));
    this.engine.on('trackended',   d => this._onEnded(d));
    this.engine.on('loopstate',    d => this._onLoopState(d));
    this.engine.on('hotcueupdate', d => this._onHCUpdate(d));
    this.engine.on('sampleloaded', d => this._onSampleLoaded(d));

    this.cw.addSlot('music','Musik','3 Songs');
    this.cw.addSlot('jingle','Jingle','Station ID');
    this.cw.addSlot('music','Musik','Song');
    this.cw.addSlot('ad','Werbung','Werbeblock');
    this._renderCW();
  },

  // ── Waveforms ─────────────────────────────────────────────────────────────
  _initWaveforms() {
    for (let i=0;i<2;i++) {
      const c=$(`wf-${i}`), ov=$(`wfov-${i}`);
      const rs=()=>{ c.width=c.offsetWidth||600; ov.width=ov.offsetWidth||600; };
      rs();
      this.wf[i] = new WaveformRenderer(c, ov);
      c.addEventListener('click', e => {
        const d=this.engine.decks[i];
        if (!d.buffer) return;
        const np=d.peakData?d.peakData.length/2:1;
        const vis=np/this.wf[i].zoom;
        const cl=(e.clientX-c.getBoundingClientRect().left)/c.clientWidth;
        this.engine.seekTo(i,Math.max(0,Math.min(1,this.engine.getPosition(i)+(cl-0.5)*vis/np)));
      });
      ov.addEventListener('click',e=>{
        const r=ov.getBoundingClientRect();
        this.engine.seekTo(i,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
      });
    }
    window.addEventListener('resize',()=>{
      for(let i=0;i<2;i++){
        const c=$(`wf-${i}`),ov=$(`wfov-${i}`);
        c.width=c.offsetWidth||600; ov.width=ov.offsetWidth||600;
        if(this.engine.decks[i].peakData) this.wf[i].setPeaks(this.engine.decks[i].peakData);
      }
    });
  },

  // ── Jog Wheels ────────────────────────────────────────────────────────────
  _initJogWheels() {
    for (let i=0;i<2;i++) {
      const canvas = $(`jog-${i}`);
      this.jog[i] = new JogWheel(canvas, {
        label: i===0?'A':'B',
        onScratch: (deltaY) => {
          if (!this.engine.decks[i].buffer) return;
          const pos = this.engine.getPosition(i);
          const scratchAmount = -deltaY / 1000;
          this.engine.seekTo(i, Math.max(0,Math.min(1, pos + scratchAmount)));
        }
      });
    }
  },

  // ── Hot Cues ──────────────────────────────────────────────────────────────
  _initHotCues() {
    for(let d=0;d<2;d++){
      const c=$(`d${d}-hc`); c.innerHTML='';
      for(let i=0;i<8;i++){
        const b=document.createElement('button');
        b.className='hc'; b.id=`hc-${d}-${i}`; b.textContent=i+1;
        b.addEventListener('click',()=>{ if(this.engine.decks[d].hotCues[i]!==null) this.engine.gotoHotCue(d,i); else this.engine.setHotCue(d,i); });
        b.addEventListener('contextmenu',e=>{e.preventDefault();this.engine.deleteHotCue(d,i);});
        c.appendChild(b);
      }
    }
  },
  _onHCUpdate({deckIdx,index,position}){
    const b=$(`hc-${deckIdx}-${index}`);
    if(b) b.classList.toggle('on',position!==null);
    if(position!==null&&this.wf[deckIdx]) this.wf[deckIdx].setHotCue(index,position);
  },

  // ── Sampler Pads ──────────────────────────────────────────────────────────
  _initPads() {
    ['pads-a','pads-b'].forEach((containerId, group) => {
      const c=document.getElementById(containerId); if(!c) return;
      c.innerHTML='';
      const offset = group*8;
      for(let i=0;i<8;i++){
        const padIdx=offset+i;
        const p=document.createElement('div');
        p.className='spad'; p.id=`pad-${padIdx}`;
        p.innerHTML=`<span class="sp-num">${padIdx+1}</span><span class="sp-lbl">—</span>`;
        p.title=`Pad ${padIdx+1} — Rechtsklick: Datei laden`;
        p.addEventListener('click',()=>{
          if(!this.engine.samples[padIdx]) return;
          this.engine.playSample(padIdx);
          p.classList.add('playing');
          const dur=(this.engine.samples[padIdx].buffer.duration*1000)+100;
          setTimeout(()=>p.classList.remove('playing'),Math.min(dur,8000));
        });
        p.addEventListener('contextmenu',async e=>{
          e.preventDefault();
          const f=await window.radioAPI.openFileDialog();
          if(f?.length) await this.engine.loadSample(padIdx,f[0]);
        });
        p.addEventListener('dragover',e=>{e.preventDefault();p.classList.add('dov');});
        p.addEventListener('dragleave',()=>p.classList.remove('dov'));
        p.addEventListener('drop',async e=>{
          e.preventDefault();p.classList.remove('dov');
          const path=e.dataTransfer.getData('text/plain');
          if(path) await this.engine.loadSample(padIdx,path);
        });
        c.appendChild(p);
      }
    });
  },
  _onSampleLoaded({padIdx,name}){
    const p=$(`pad-${padIdx}`);
    if(!p) return;
    p.classList.add('loaded');
    p.querySelector('.sp-lbl').textContent=name.slice(0,10);
  },

  // ── STEMS ─────────────────────────────────────────────────────────────────
  _initStems() {
    document.querySelectorAll('.stem-btn').forEach(btn => {
      const d=parseInt(btn.dataset.d);
      const stem=btn.dataset.stem;
      btn.addEventListener('click', () => {
        const wasOn=btn.classList.contains('on');
        if(stem==='all') {
          // Reset all EQ
          this.engine.setEQ(d,'high',1); this.engine.setEQ(d,'mid',1); this.engine.setEQ(d,'low',1);
          document.querySelectorAll(`.stem-btn[data-d="${d}"]`).forEach(b=>b.classList.remove('on'));
          if(this.knobs[`eq-${d}-h`]) { this.knobs[`eq-${d}-h`].setValue(1); this.knobs[`eq-${d}-h`].draw(); }
          if(this.knobs[`eq-${d}-m`]) { this.knobs[`eq-${d}-m`].setValue(1); this.knobs[`eq-${d}-m`].draw(); }
          if(this.knobs[`eq-${d}-l`]) { this.knobs[`eq-${d}-l`].setValue(1); this.knobs[`eq-${d}-l`].draw(); }
          return;
        }
        btn.classList.toggle('on');
        // Apply stem EQ
        const vals=STEMS[stem]||[1,1,1];
        if(!wasOn) {
          this.engine.setEQ(d,'high',vals[0]);
          this.engine.setEQ(d,'mid', vals[1]);
          this.engine.setEQ(d,'low', vals[2]);
        } else {
          this.engine.setEQ(d,'high',1);
          this.engine.setEQ(d,'mid',1);
          this.engine.setEQ(d,'low',1);
        }
        if(this.knobs[`eq-${d}-h`]){ this.knobs[`eq-${d}-h`].setValue(vals[0]); this.knobs[`eq-${d}-h`].draw(); }
        if(this.knobs[`eq-${d}-m`]){ this.knobs[`eq-${d}-m`].setValue(vals[1]); this.knobs[`eq-${d}-m`].draw(); }
        if(this.knobs[`eq-${d}-l`]){ this.knobs[`eq-${d}-l`].setValue(vals[2]); this.knobs[`eq-${d}-l`].draw(); }
      });
    });
  },

  // ── Knobs ─────────────────────────────────────────────────────────────────
  _initKnobs() {
    const mk=(id,min,max,def,cb)=>{
      const canvas=$(id); if(!canvas) return;
      const k=new Knob(canvas,{min,max,value:def,onChange:cb});
      this.knobs[id]=k;
    };
    const eq=(d,band)=>v=>this.engine.setEQ(d,band,v);
    mk('eq-0-h',0,2,1,eq(0,'high')); mk('eq-0-m',0,2,1,eq(0,'mid')); mk('eq-0-l',0,2,1,eq(0,'low'));
    mk('eq-1-h',0,2,1,eq(1,'high')); mk('eq-1-m',0,2,1,eq(1,'mid')); mk('eq-1-l',0,2,1,eq(1,'low'));
    mk('gn-0',0,2,1,v=>this.engine.setGain(0,v)); mk('gn-1',0,2,1,v=>this.engine.setGain(1,v));
    mk('fl-0',0,1,0.5,v=>this.engine.setFilter(0,v)); mk('fl-1',0,1,0.5,v=>this.engine.setFilter(1,v));
  },

  // ── Faders ────────────────────────────────────────────────────────────────
  _initFaders() {
    for(let i=0;i<2;i++){
      this._makeFader(`ft-${i}`,`ff-${i}`,`fth-${i}`,this.faderVals[i],v=>{this.faderVals[i]=v;this.engine.setVolume(i,v);});
    }
    $('mvol').addEventListener('input',e=>{this.engine.setMasterVolume(e.target.value/100);$('mv-v').textContent=e.target.value+'%';});
    $('pvol').addEventListener('input',e=>{this.engine.setHeadphoneVolume(e.target.value/100);$('pv-v').textContent=e.target.value+'%';});
    $('xf').addEventListener('input',e=>this.engine.setCrossfader(e.target.value/100));
    for(let i=0;i<2;i++){
      const sl=$(`d${i}-pt`);
      sl.addEventListener('input',()=>{
        const p=parseFloat(sl.value);
        this.engine.setPitch(i,1+p/100);
        $(`d${i}-pt-v`).textContent=(p>=0?'+':'')+p.toFixed(1)+'%';
      });
    }
    // FX
    document.querySelectorAll('.fx-on').forEach(led=>{
      const d=parseInt(led.dataset.d),s=parseInt(led.dataset.s);
      const wet=document.getElementById(`fxw-${d}-${s}`);
      led.addEventListener('click',()=>{
        led.classList.toggle('on');
        this.engine.setEffect(d,s,led.classList.contains('on'),wet?wet.value/100:0.4);
      });
      if(wet) wet.addEventListener('input',()=>{ if(led.classList.contains('on')) this.engine.setEffect(d,s,true,wet.value/100); });
    });
    // Auto-DJ xfade
    $('adj-xf').addEventListener('input',e=>{
      $('axf-v').textContent=e.target.value+'s';
      if($('adj-xf-i')) $('adj-xf-i').textContent=e.target.value+'s';
      if($('am-xf')) $('am-xf').textContent=e.target.value+'s';
    });
    $('adj-pill').addEventListener('click',()=>this.toggleAutoDJ());
  },

  _makeFader(trackId,fillId,thumbId,initVal,onChange){
    const track=$(trackId),fill=$(fillId),thumb=$(thumbId);
    if(!track) return;
    let val=initVal,dragging=false,startY=0,startVal=0;
    const set=v=>{
      val=Math.max(0,Math.min(1,v));
      const pct=val*100;
      fill.style.height=pct+'%';
      thumb.style.bottom=`calc(${pct}% - 4px)`;
      onChange(val);
    };
    set(val);
    thumb.addEventListener('mousedown',e=>{dragging=true;startY=e.clientY;startVal=val;e.preventDefault();});
    track.addEventListener('click',e=>{if(dragging)return;const r=track.getBoundingClientRect();set(1-(e.clientY-r.top)/r.height);});
    window.addEventListener('mousemove',e=>{if(!dragging)return;const h=track.offsetHeight||90;set(startVal-(e.clientY-startY)/h);});
    window.addEventListener('mouseup',()=>{dragging=false;});
  },

  // ── VU ───────────────────────────────────────────────────────────────────
  _initVU(){
    this.vu[0]=new VUMeter($('vu-0-l'),$('vu-0-r'));
    this.vu[1]=new VUMeter($('vu-1-l'),$('vu-1-r'));
  },

  // ── Controls ─────────────────────────────────────────────────────────────
  _initControls(){
    $('wc-min').onclick=()=>window.radioAPI.minimizeWindow();
    $('wc-max').onclick=()=>window.radioAPI.maximizeWindow();
    $('wc-cls').onclick=()=>window.radioAPI.closeWindow();

    document.querySelectorAll('.mbtn').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.mbtn').forEach(x=>x.classList.remove('on'));
      document.querySelectorAll('.mview').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      $(b.dataset.m==='dj'?'dj':'auto').classList.add('on');
      if(b.dataset.m==='dj') setTimeout(()=>{for(let i=0;i<2;i++){const c=$(`wf-${i}`);c.width=c.offsetWidth||600;}},50);
    }));

    // Library tabs
    document.querySelectorAll('.ltab').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.ltab').forEach(x=>x.classList.remove('on'));
      document.querySelectorAll('.lview').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); $(`lv-${b.dataset.lb}`).classList.add('on');
    }));

    // Auto tabs
    document.querySelectorAll('.atab').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.atab').forEach(x=>x.classList.remove('on'));
      document.querySelectorAll('.apanel').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); $(`ap-${b.dataset.ap}`).classList.add('on');
    }));

    // Settings tabs
    document.querySelectorAll('.ctab').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.ctab').forEach(x=>x.classList.remove('on'));
      document.querySelectorAll('.csec').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); $(`ct-${b.dataset.ct}`).classList.add('on');
    }));

    // Profile tabs
    document.querySelectorAll('.ptab').forEach(b=>b.addEventListener('click',()=>{
      this._saveProfile();
      document.querySelectorAll('.ptab').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      this.state.profile=parseInt(b.dataset.p);
      this._loadProfile(this.state.profile);
    }));

    $('btn-cfg').onclick=()=>this.openCfg();
    const wizBtn=$('btn-wizard');
    if(wizBtn) wizBtn.onclick=()=>this.wizard.show();
    const usrBtn=$('btn-users');
    if(usrBtn) usrBtn.onclick=()=>this.auth?.showUserPanel();
    $('cfg-ov').addEventListener('click',e=>{ if(e.target===$('cfg-ov')) this.closeCfg(); });

    // Context menu
    document.addEventListener('click',()=>$('ctx').classList.remove('on'));
    document.addEventListener('contextmenu',e=>{
      const row=e.target.closest('tr[data-path]'); if(!row) return;
      e.preventDefault();
      this.state.ctxTrack=this.library.tracks.find(t=>t.path===row.dataset.path);
      const m=$('ctx'); m.style.left=e.clientX+'px'; m.style.top=Math.min(e.clientY,window.innerHeight-150)+'px';
      m.classList.add('on');
    });

    // Keyboard
    document.addEventListener('keydown',e=>this._onKey(e));

    // Lib search
    $('lib-search').addEventListener('input',e=>this.library.setFilter(e.target.value));

    // Sort
    document.querySelectorAll('#tbl th[data-s]').forEach(th=>th.addEventListener('click',()=>{
      document.querySelectorAll('#tbl th').forEach(t=>t.classList.remove('asc','desc'));
      this.library.setSort(th.dataset.s);
      th.classList.add(this.library._sortDir===1?'asc':'desc');
    }));
  },

  _onKey(e){
    if(e.target.matches('input,select,textarea')) return;
    switch(e.code){
      case 'Space': e.preventDefault(); this.deckPlay(0); break;
      case 'Enter': e.preventDefault(); this.deckPlay(1); break;
      case 'KeyQ':  this.deckCue(0); break;
      case 'KeyW':  this.deckCue(1); break;
      case 'KeyS':  this.deckSync(0); break;
      case 'KeyD':  this.deckSync(1); break;
      case 'Digit1':case 'Digit2':case 'Digit3':case 'Digit4':
      case 'Digit5':case 'Digit6':case 'Digit7':case 'Digit8':{
        const idx=parseInt(e.code.replace('Digit',''))-1;
        this.engine.gotoHotCue(e.shiftKey?1:0,idx); break;
      }
    }
  },

  // ── Deck actions ──────────────────────────────────────────────────────────
  deckPlay(i){ if(this.engine.decks[i].playing) this.engine.pause(i); else this.engine.play(i); this._updPlay(i,this.engine.decks[i].playing); },
  deckCue(i) { this.engine.cue(i); this._updPlay(i,false); },
  deckSync(i){ this.engine.syncDecks(i===0?1:0); const b=$(`d${i}-sync`); b.classList.add('on'); setTimeout(()=>b.classList.remove('on'),700); },
  deckZoomIn(i)  { this.wf[i]?.zoomIn(); },
  deckZoomOut(i) { this.wf[i]?.zoomOut(); },
  loopIn(i)    { this.engine.setLoopIn(i); },
  loopOut(i)   { this.engine.setLoopOut(i); },
  loopSet(i)   {
    const bars=parseFloat($(`d${i}-ls`).value);
    this.engine.setLoopSize(i,bars);
    $(`d${i}-lb`).classList.add('on');
    const d=this.engine.decks[i];
    if(d.loopStart!==null&&this.wf[i]) this.wf[i].setLoop(d.loopStart/d.duration,d.loopEnd/d.duration);
  },
  loopToggle(i){ const d=this.engine.decks[i]; if(d.looping) this.engine.disableLoop(i); else if(d.loopStart!==null) this.engine.enableLoop(i); else this.loopSet(i); },
  loopClear(i) { this.engine.disableLoop(i); this.wf[i]?.clearLoop(); $(`d${i}-lb`).classList.remove('on'); },
  toggleCue(i) { this.state.cue[i]=!this.state.cue[i]; this.engine.setCue(i,this.state.cue[i]); $(`pfl-${i}`).classList.toggle('on',this.state.cue[i]); },
  _onLoopState({deckIdx,active}){ $(`d${deckIdx}-lb`).classList.toggle('on',active); $(`d${deckIdx}-lpb`).classList.toggle('on',active); if(!active) this.wf[deckIdx]?.clearLoop(); },
  _updPlay(i,on){ this.state.playing[i]=on; const b=$(`d${i}-play`); b.classList.toggle('on',on); b.textContent=on?'⏸':'▶'; if(this.jog[i]) this.jog[i].spinning=on; },

  // ── File loading ──────────────────────────────────────────────────────────
  async openFileDeck(i){ const f=await window.radioAPI.openFileDialog(); if(f?.length) await this.loadToDeck(i,f[0]); },
  async loadToDeck(i,path){
    $(`d${i}-title`).textContent='⏳ Laden…';
    try{ const meta=await window.radioAPI.getMetadata(path); await this.engine.loadTrack(i,path,meta); }
    catch(err){ $(`d${i}-title`).textContent='⚠ '+err.message; console.error(err); }
  },
  _onLoaded({deckIdx,meta,duration,bpm}){
    const d=this.engine.decks[deckIdx];
    const name=meta?.title||window.radioAPI.basename(d.filePath,window.radioAPI.extname(d.filePath));
    $(`d${deckIdx}-title`).textContent=name;
    $(`d${deckIdx}-artist`).textContent=meta?.artist||'';
    $(`d${deckIdx}-bpm`).textContent=bpm?bpm.toFixed(1):'—';
    $(`d${deckIdx}-key`).textContent=meta?.key||'';
    $(`d${deckIdx}-el`).textContent=fmtTime(0);
    $(`d${deckIdx}-rem`).textContent='-'+fmtTime(duration);
    if(d.peakData){
      const c=$(`wf-${deckIdx}`),ov=$(`wfov-${deckIdx}`);
      c.width=c.offsetWidth||600; ov.width=ov.offsetWidth||600;
      this.wf[deckIdx].setPeaks(d.peakData);
    }
    for(let j=0;j<8;j++){const b=$(`hc-${deckIdx}-${j}`);if(b)b.classList.remove('on');}
    this._addLog({time:new Date(),title:meta?.title||name,artist:meta?.artist||'',type:'track'});
    if(meta) this.library.addToHistory(meta);
    this._renderHist();
  },
  _onEnded({deckIdx}){ this._updPlay(deckIdx,false); if(this.state.autoDJ) this._adjNext(deckIdx); },
  dropDeck(e,i){ e.preventDefault(); document.getElementById(`deck-${i}`).classList.remove('dov'); const p=e.dataTransfer.getData('text/plain'); if(p) this.loadToDeck(i,p); },

  // ── Library ───────────────────────────────────────────────────────────────
  _initLibrary(){
    this.library.on('update',()=>this._renderTracks());
    this.library.on('status',d=>{ if($('lib-st')) $('lib-st').textContent=d.msg; });
    this.library.on('historyupdate',()=>this._renderHist());
    this.library.on('queueupdate',()=>this._renderQueue());
    this.library.on('requestupdate',()=>this._renderReq());
  },
  async openFolder(){ const f=await window.radioAPI.openFolderDialog(); if(f) await this._addFolderToLib(f); },
  async addFolder()  { const f=await window.radioAPI.openFolderDialog(); if(f) await this._addFolderToLib(f); },
  async _addFolderToLib(folderPath){
    if(!this.state.folders.includes(folderPath)) this.state.folders.push(folderPath);
    await this.library.addFolder(folderPath);
    this._renderFolderTree();
  },
  async openFiles(){ const f=await window.radioAPI.openFileDialog(); if(f?.length) await this.library.addFiles(f); },
  showAllTracks(){ document.querySelectorAll('.folder-item').forEach(x=>x.classList.remove('active')); $('fi-all')?.classList.add('active'); this.library.setFilter(''); this._switchLibTab('tracks'); },
  showHistory()  { this._switchLibTab('hist'); },
  showQueue()    { this._switchLibTab('queue'); },
  _switchLibTab(id){
    document.querySelectorAll('.ltab').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.lview').forEach(x=>x.classList.remove('on'));
    const btn=document.querySelector(`.ltab[data-lb="${id}"]`);
    if(btn) btn.classList.add('on');
    $(`lv-${id}`)?.classList.add('on');
  },
  _renderFolderTree(){
    const list=$('folder-items'); if(!list) return;
    list.innerHTML=this.state.folders.map((f,i)=>`
      <div class="folder-item" onclick="App.filterByFolder('${f.replace(/\\/g,'\\\\')}')" title="${f}">
        <span class="fi-icon">📂</span>
        <span class="fi-name">${f.split('\\').pop()||f.split('/').pop()}</span>
        <span class="fi-count">${this.library.tracks.filter(t=>t.path.startsWith(f)).length}</span>
      </div>`).join('');
    $('fi-all-ct').textContent=this.library.tracks.length;
  },
  filterByFolder(folder){
    document.querySelectorAll('.folder-item').forEach(x=>x.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    this.library.setFilter('');
    const tracks=this.library.tracks.filter(t=>t.path.startsWith(folder));
    this._renderTrackList(tracks);
  },
  _renderTracks(){ this._renderTrackList(this.library.filteredTracks); this._renderFolderTree(); },
  _renderTrackList(tracks){
    if($('lib-st')) $('lib-st').textContent=`${tracks.length} Tracks`;
    $('tbody').innerHTML=tracks.map(t=>`
      <tr data-path="${t.path}" draggable="true">
        <td class="ct" title="${t.title}">${t.title}</td>
        <td class="ca" title="${t.artist}">${t.artist}</td>
        <td class="cal">${t.album}</td>
        <td class="cb">${t.bpm?t.bpm.toFixed(1):''}</td>
        <td class="ck">${t.key||''}</td>
        <td class="cd">${fmtDur(t.duration)}</td>
        <td class="cg">${t.genre}</td>
      </tr>`).join('');
    $('tbody').querySelectorAll('tr').forEach(row=>{
      row.addEventListener('dblclick',()=>this.loadToDeck(0,row.dataset.path));
      row.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',row.dataset.path);e.dataTransfer.effectAllowed='copy';});
    });
  },
  _renderHist(){
    const h=$('hist-list'); if(!h) return;
    h.innerHTML=this.library.history.slice(0,100).map(x=>`
      <div class="h-row">
        <span class="ht">${new Date(x.playedAt).toLocaleTimeString('de-DE')}</span>
        <span class="htit">${x.title}</span>
        <span class="hart">${x.artist}</span>
      </div>`).join('');
  },
  _renderQueue(){
    const html=this.library.queue.map((t,i)=>`
      <div class="q-item">
        <span class="qn">${i+1}</span>
        <div class="qi"><div class="qt">${t.title}</div><div class="qa">${t.artist}</div></div>
        <button class="qdl" onclick="App.library.removeFromQueue(${i});App._renderQueue()">✕</button>
      </div>`).join('');
    if($('q-list')) $('q-list').innerHTML=html;
    if($('am-q'))   $('am-q').innerHTML=html;
    if($('adj-q'))  $('adj-q').innerHTML=html;
    if($('q-st'))   $('q-st').textContent=this.library.queue.length;
    const nxt=this.library.queue[0]?.title||'— kein Track —';
    if($('am-next')) $('am-next').textContent=nxt;
    if($('adj-next')) $('adj-next').textContent=nxt;
  },
  _renderReq(){
    const r=$('req-list'); if(!r) return;
    r.innerHTML=this.library.requests.map((x,i)=>`
      <div class="q-item">
        <span class="qn" style="color:var(--acc)">♥</span>
        <div class="qi"><div class="qt">${x.title}</div><div class="qa">${x.artist} — <span style="color:var(--acc)">${x.requester}</span></div></div>
        <button class="qdl" onclick="App.library.requests.splice(${i},1);App._renderReq()">✕</button>
      </div>`).join('');
  },
  addQueueFromLib(){ const t=this.library.filteredTracks[0]; if(t){this.library.addToQueue(t);this._renderQueue();} },
  addReq(){ const nm=$('req-nm')?.value.trim()||'Anonym',q=$('req-q')?.value.trim().toLowerCase(); const t=this.library.tracks.find(x=>x.title.toLowerCase().includes(q)||x.artist.toLowerCase().includes(q)); if(t){this.library.addRequest(t,nm);if($('req-q'))$('req-q').value='';}else{if($('req-q')){$('req-q').style.borderColor='var(--red)';setTimeout(()=>{$('req-q').style.borderColor='';},1000);}} },

  ctx(a){
    const t=this.state.ctxTrack; if(!t) return;
    if(a==='d0') this.loadToDeck(0,t.path);
    if(a==='d1') this.loadToDeck(1,t.path);
    if(a==='q')  {this.library.addToQueue(t);this._renderQueue();}
    if(a==='req'){this.library.addRequest(t,'Listener');this._renderReq();}
    if(a==='info') alert(`${t.title}\n${t.artist}\nBPM: ${t.bpm||'?'}  Key: ${t.key||'?'}\nDauer: ${fmtDur(t.duration)}`);
    $('ctx').classList.remove('on');
  },

  // ── Auto-DJ ───────────────────────────────────────────────────────────────
  toggleAutoDJ(){
    this.state.autoDJ=!this.state.autoDJ;
    const on=this.state.autoDJ;
    $('adj-pill').textContent='AUTO-DJ: '+(on?'AN':'AUS');
    $('adj-pill').classList.toggle('on',on);
    if($('adj-btn'))  { $('adj-btn').textContent=on?'STOPPEN':'STARTEN'; $('adj-btn').classList.toggle('on',on); }
    if($('adj-btn2')) { $('adj-btn2').textContent=on?'STOPPEN':'STARTEN'; $('adj-btn2').classList.toggle('on',on); }
    if($('am-st'))    $('am-st').textContent=on?'Aktiv':'Gestoppt';
  },
  _adjNext(from){
    const to=1-from;
    const next=this.library.nextQueueTrack(); if(!next) return;
    this.loadToDeck(to,next.path).then(()=>{
      setTimeout(()=>{
        this.engine.play(to); this._updPlay(to,true);
        const ms=parseFloat($('adj-xf')?.value||8)*1000;
        let prog=0;
        const timer=setInterval(()=>{
          prog+=50/ms; if(prog>=1){clearInterval(timer);prog=1;}
          this.engine.setVolume(from,1-prog); this.engine.setVolume(to,prog);
          const pf=(1-prog)*100,pt=prog*100;
          const ff0=$(`ff-${from}`),fth0=$(`fth-${from}`),ff1=$(`ff-${to}`),fth1=$(`fth-${to}`);
          if(ff0){ff0.style.height=pf+'%';fth0.style.bottom=`calc(${pf}% - 4px)`;}
          if(ff1){ff1.style.height=pt+'%';fth1.style.bottom=`calc(${pt}% - 4px)`;}
        },50);
      },500);
    });
    this._renderQueue();
  },

  // ── Scheduler ─────────────────────────────────────────────────────────────
  _initScheduler(){
    this.scheduler.on('event',ev=>this._schedFire(ev));
    this.scheduler.on('update',()=>this._renderSched());
    this.scheduler.on('log',l=>this._addLog(l));
  },
  addSchedEv(){ const t=$('ev-t')?.value,ty=$('ev-ty')?.value,d=$('ev-d')?.value.trim(),r=$('ev-r')?.value; if(!t||!d) return; this.scheduler.addEvent(t,ty,d,r); },
  toggleSched(){
    if(this.state.schedRun){
      this.scheduler.stop();this.state.schedRun=false;
      if($('sched-btn')){$('sched-btn').textContent='▶ Starten';$('sched-btn').classList.remove('grn');}
    }else{
      this.scheduler.start();this.state.schedRun=true;
      if($('sched-btn')){$('sched-btn').textContent='⏹ Stoppen';$('sched-btn').classList.add('grn');}
    }
  },
  _renderSched(){
    const el=$('ev-list'); if(!el) return;
    el.innerHTML=this.scheduler.events.map(ev=>`
      <div class="ev-row ${ev.active?'':'off'}">
        <span class="ev-t">${ev.time}</span>
        <span class="ev-ty ${ev.type}">${ev.type}</span>
        <span class="ev-da" title="${ev.data}">${ev.data}</span>
        <span class="ev-rp">${ev.repeat}</span>
        <div class="ev-ac">
          <button onclick="App.scheduler.toggleEvent(${ev.id});App._renderSched()">${ev.active?'⏸':'▶'}</button>
          <button onclick="App.scheduler.removeEvent(${ev.id})">✕</button>
        </div>
      </div>`).join('');
  },
  _schedFire(ev){
    const t=this.library.tracks.find(x=>x.title.toLowerCase().includes(ev.data.toLowerCase())||x.path.toLowerCase().includes(ev.data.toLowerCase()));
    if(t) this.loadToDeck(0,t.path).then(()=>{this.engine.play(0);this._updPlay(0,true);});
  },
  cwAdd(type){ const l=prompt(`Label für ${type}:`,'Song'); if(!l) return; this.cw.addSlot(type,type,l); this._renderCW(); },
  cwClear(){ this.cw.slots=[]; this._renderCW(); },
  _renderCW(){
    const cols={music:'var(--grn)',jingle:'var(--blu)',ad:'var(--red)',show:'var(--ylw)'};
    const el=$('cw-list'); if(!el) return;
    el.innerHTML=this.cw.slots.length===0?'<div style="color:var(--txt2);padding:10px;font-size:10px">Keine Slots.</div>'
      :this.cw.slots.map((s,i)=>`<div class="cw-slot"><span class="cw-n">${i+1}</span><span class="cw-type" style="color:${cols[s.type]||'#888'}">${s.type}</span><span class="cw-lbl">${s.label}</span><button class="cw-del" onclick="App.cw.slots.splice(${i},1);App._renderCW()">✕</button></div>`).join('');
  },

  // ── Log ───────────────────────────────────────────────────────────────────
  _addLog(e){
    this.log.unshift(e);
    const l=$('log-list'); if(!l) return;
    l.innerHTML=this.log.slice(0,500).map(x=>`<div class="log-r"><span class="log-t">${x.time instanceof Date?x.time.toLocaleTimeString('de-DE'):x.time}</span><span class="log-tp">${x.type||'track'}</span><span class="log-tr">${x.title||x.msg||''} ${x.artist?'— '+x.artist:''}</span></div>`).join('');
    if($('log-cnt')) $('log-cnt').textContent=this.log.length;
  },
  async exportLog(){ const csv=this.library.exportLog(); await window.radioAPI.saveLog(csv); },

  // ── Streaming ─────────────────────────────────────────────────────────────
  async toggleStream(){
    if(this.state.streamOn){ await this.streaming.disconnect(); }
    else{
      const cfg=this._getCfg(); this.state.streamCfg=cfg;
      if($('st-txt')) $('st-txt').textContent='Verbinde…';
      if($('st-btn')) $('st-btn').disabled=true;
      const r=await this.streaming.connect(cfg);
      if($('st-btn')) $('st-btn').disabled=false;
      if(!r.success&&$('st-txt')){ $('st-txt').textContent='✗ '+r.error; if($('st-dot')) $('st-dot').className='st-dot err'; }
    }
  },
  _onStreamStatus(d){
    this.state.streamOn=d.connected;
    const oa=$('on-air');
    if(oa) oa.classList.toggle('live',d.connected);
    if($('oa-t')) $('oa-t').textContent=d.connected?'ON AIR':'OFF AIR';
    if($('st-dot')) $('st-dot').className='st-dot'+(d.connected?' ok':d.error?' err':'');
    if($('st-txt')) $('st-txt').textContent=d.connected?`✓ Verbunden — ${this.state.streamCfg?.host}:${this.state.streamCfg?.port}${this.state.streamCfg?.mountpoint}`:d.error?'✗ '+d.error:'Getrennt';
    if($('st-btn')) $('st-btn').textContent=d.connected?'Trennen':'Verbinden';
  },
  _getCfg(){return{protocol:$('c-proto')?.value||'icecast2',host:$('c-host')?.value||'localhost',port:parseInt($('c-port')?.value)||8000,mountpoint:$('c-mnt')?.value||'/stream',password:$('c-pass')?.value||'',format:$('c-fmt')?.value||'mp3',bitrate:parseInt($('c-br')?.value)||128,channels:parseInt($('c-ch')?.value)||2,stationName:$('c-sn')?.value||'',description:$('c-desc')?.value||'',genre:$('c-genre')?.value||'',website:$('c-web')?.value||''};},

  // ── Login callback ───────────────────────────────────────────────────────
  async _onLogin(user) {
    // Show user name in titlebar
    const usrBtn = $('btn-users');
    if (usrBtn) {
      if (user.role === 'admin') {
        usrBtn.style.display = '';
        usrBtn.title = `Angemeldet als ${user.displayName} (Admin) — Klick zum Verwalten`;
      } else {
        usrBtn.style.display = 'none';
      }
    }
    // Show station name
    const station = await window.radioAPI.authGetStation();
    const stn = $('stn');
    if (stn && station.name) stn.textContent = station.name;
  },

  // ── Wizard complete ───────────────────────────────────────────────────────
  async _onWizardComplete(settings, skipped) {
    // Apply settings to UI
    if (settings.stationName) {
      const stn=$('stn'); if(stn) stn.textContent=settings.stationName;
      this._updateProfileBadge(settings);
    }
    // Apply streaming profile
    if (settings.profiles?.[0]) {
      const p = settings.profiles[0];
      if($('c-proto')&&p.protocol) $('c-proto').value=p.protocol;
      if($('c-host')&&p.host)      $('c-host').value=p.host;
      if($('c-port')&&p.port)      $('c-port').value=p.port;
      if($('c-mnt')&&p.mount)      $('c-mnt').value=p.mount;
      if($('c-pass')&&p.pass)      $('c-pass').value=p.pass;
      if($('c-fmt')&&p.format)     $('c-fmt').value=p.format;
      if($('c-br')&&p.bitrate)     $('c-br').value=p.bitrate;
    }
    if($('c-sn')&&settings.stationName)  $('c-sn').value=settings.stationName;
    if($('c-desc')&&settings.slogan)     $('c-desc').value=settings.slogan;
    if($('c-genre')&&settings.genre)     $('c-genre').value=settings.genre;
    if($('c-web')&&settings.website)     $('c-web').value=settings.website;
    // Load music folders
    for (const folder of (settings.musicFolders||[])) {
      if (!this.state.folders.includes(folder)) this.state.folders.push(folder);
      await this.library.addFolder(folder);
    }
    // Update wunschbox in UI
    this._updateWunschbox(settings);
  },

  _updateProfileBadge(s) {
    let badge = $('radio-profile-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'radio-profile-badge';
      badge.onclick = () => this.wizard.show();
      badge.innerHTML = `<span class="rp-name" id="rp-name">—</span><span class="rp-genre" id="rp-genre"></span>`;
      const stnEl = $('stn');
      if (stnEl) stnEl.after(badge);
    }
    const nm = $('rp-name'), gr = $('rp-genre');
    if(nm) nm.textContent = s.stationName || '—';
    if(gr) gr.textContent = s.genre || '';
  },

  _updateWunschbox(s) {
    // Update wunschbox display in library sidebar if enabled
    const existingPanel = $('wunschbox-panel');
    if (existingPanel) existingPanel.remove();
    if (!s.wunschboxEnabled) return;
    const panel = document.createElement('div');
    panel.id = 'wunschbox-panel';
    panel.innerHTML = `
      <div class="wb-header">🎤 Wunschbox</div>
      <div class="wb-contact">
        ${s.wunschboxPhone    ? `<div class="wb-row"><span class="wb-icon">📞</span><span class="wb-val">${s.wunschboxPhone}</span></div>` : ''}
        ${s.wunschboxWhatsapp ? `<div class="wb-row"><span class="wb-icon">💬</span><span class="wb-val">${s.wunschboxWhatsapp}</span></div>` : ''}
        ${s.wunschboxEmail    ? `<div class="wb-row"><span class="wb-icon">📧</span><span class="wb-val">${s.wunschboxEmail}</span></div>` : ''}
      </div>`;
    const tree = $('folder-tree');
    if (tree) tree.appendChild(panel);
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  openCfg(){  $('cfg-ov').classList.add('on'); },
  closeCfg(){ $('cfg-ov').classList.remove('on'); },
  async saveCfg(){
    this._saveProfile();
    const s={profiles:this.state.profiles,stationName:$('c-sn')?.value,description:$('c-desc')?.value,genre:$('c-genre')?.value,website:$('c-web')?.value,xfade:$('c-xf')?.value};
    await window.radioAPI.saveSettings(s);
    const stn=$('stn'); if(stn) stn.textContent=s.stationName||'—';
    this.closeCfg();
  },
  async _loadCfg(){
    const s=await window.radioAPI.getSettings(); if(!s) return;
    if(s.stationName){if($('c-sn'))$('c-sn').value=s.stationName;const stn=$('stn');if(stn)stn.textContent=s.stationName;}
    if(s.slogan&&$('c-desc'))    $('c-desc').value=s.slogan;
    if(s.description&&$('c-desc'))$('c-desc').value=s.description;
    if(s.genre&&$('c-genre'))    $('c-genre').value=s.genre;
    if(s.website&&$('c-web'))    $('c-web').value=s.website;
    if(s.xfade&&$('c-xf'))       $('c-xf').value=s.xfade;
    if(s.profiles){this.state.profiles=s.profiles;this._loadProfile(0);}
    // Restore profile badge
    if(s.stationName) setTimeout(()=>this._updateProfileBadge(s), 100);
    // Restore wunschbox
    if(s.wunschboxEnabled) setTimeout(()=>this._updateWunschbox(s), 100);
    // Reload music folders from last session
    if(s.musicFolders?.length) {
      for(const f of s.musicFolders) {
        if(!this.state.folders.includes(f)) this.state.folders.push(f);
      }
      // Load folders in background
      setTimeout(async()=>{
        for(const f of s.musicFolders) await this.library.addFolder(f);
      }, 1000);
    }
  },
  _saveProfile(){ const i=this.state.profile; this.state.profiles[i]={protocol:$('c-proto')?.value,host:$('c-host')?.value,port:$('c-port')?.value,mount:$('c-mnt')?.value,user:$('c-user')?.value,pass:$('c-pass')?.value,format:$('c-fmt')?.value,bitrate:$('c-br')?.value,channels:$('c-ch')?.value}; },
  _loadProfile(i){ const p=this.state.profiles[i]||{}; if(p.protocol&&$('c-proto'))$('c-proto').value=p.protocol; if(p.host&&$('c-host'))$('c-host').value=p.host; if(p.port&&$('c-port'))$('c-port').value=p.port; if(p.mount&&$('c-mnt'))$('c-mnt').value=p.mount; if(p.user&&$('c-user'))$('c-user').value=p.user; if(p.pass&&$('c-pass'))$('c-pass').value=p.pass; if(p.format&&$('c-fmt'))$('c-fmt').value=p.format; if(p.bitrate&&$('c-br'))$('c-br').value=p.bitrate; if(p.channels&&$('c-ch'))$('c-ch').value=p.channels; },

  // ── Animation Loop ────────────────────────────────────────────────────────
  _startAnimLoop(){
    let last=performance.now();
    const loop=(now)=>{
      const dt=now-last; last=now;
      this._updDecks(dt);
      this._updJogs(dt);
      this._updVU();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  _updDecks(dt){
    for(let i=0;i<2;i++){
      const d=this.engine.decks[i]; if(!d.buffer) continue;
      const pos=this.engine.getPosition(i);
      const el=pos*d.duration,rem=d.duration-el;
      $(`d${i}-el`).textContent=fmtTime(el);
      $(`d${i}-rem`).textContent='-'+fmtTime(rem);
      this.wf[i]?.setPosition(pos);
    }
  },
  _updJogs(dt){
    for(let i=0;i<2;i++){
      const d=this.engine.decks[i];
      if(this.jog[i]) this.jog[i].tick(dt, d.bpm);
    }
  },
  _updVU(){
    for(let i=0;i<2;i++){ const {left,right}=this.engine.getVULevel(i); this.vu[i]?.setLevels(left,right); }
    const {left,right}=this.engine.getMasterVU();
    const ml=$('mu-l'),mr=$('mu-r');
    if(ml) ml.style.width=vuDB(left)+'%';
    if(mr) mr.style.width=vuDB(right)+'%';
  },
  _startClock(){
    const u=()=>{ const el=$('clk'); if(el) el.textContent=new Date().toLocaleTimeString('de-DE'); };
    u(); setInterval(u,1000);
  }
};

window.App=App;
window.addEventListener('DOMContentLoaded',()=>App.init());
