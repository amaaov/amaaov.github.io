(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.getElementById("void-canvas");
  var startGate = document.getElementById("start-gate");
  var startBtn = document.getElementById("start-btn");
  var replayBtn = document.getElementById("replay-btn");
  var muteBtn = document.getElementById("mute-btn");
  var demoFooter = document.getElementById("demo-footer");
  var progressFill = document.getElementById("progress-fill");
  var sceneCounter = document.getElementById("scene-counter");
  var chromeEls = document.querySelectorAll(".demo-chrome");

  var eyebrowEl = document.getElementById("scene-eyebrow");
  var titleEl = document.getElementById("scene-title");
  var bodyEl = document.getElementById("scene-body");
  var triadEl = document.getElementById("scene-triad");
  var ctaEl = document.getElementById("scene-cta");
  var sceneLayer = document.getElementById("scene-layer");
  var fadeCurtain = document.getElementById("fade-curtain");

  var FADE_MS = reduced ? 0 : 1500;
  var contentFade = false;
  var sceneBlocks = [eyebrowEl, titleEl, bodyEl, triadEl, ctaEl];

  var SCENES = [
    {
      id: "threshold",
      duration: 5200,
      mood: 0,
      speak: "Before inference, language. Before answer, pray.",
      show: function () {
        showTitle("pray", 0);
        showEyebrow("language before inference", 420);
      }
    },
    {
      id: "room",
      duration: 6800,
      mood: 0.15,
      speak: "The space is full before the first word.",
      show: function () {
        showEyebrow("orientation before answer", 0);
        showTitle("space", 160);
        showBody("breath · repetition · attention — already in the chamber", 320);
      }
    },
    {
      id: "dependency",
      duration: 6200,
      mood: 0.28,
      speak: "At the threshold, pray. In the record, dependency.",
      show: function () {
        showEyebrow("dependency for the word", 0);
        showTitle("threshold", 160);
        showBody("the verb is pray · the manifest holds the span", 320);
      }
    },
    {
      id: "dissolve",
      duration: 5500,
      mood: 0.42,
      speak: "Logos dissolve. The form remains. Orientation stays.",
      show: function () {
        showEyebrow("after the logos", 0);
        showTitle("afterimage", 160);
        showBody("borrowed ritual shape · halos fade · the chamber remembers", 320);
      }
    },
    {
      id: "triad",
      duration: 7000,
      mood: 0.35,
      speak: "Sworn in the lock. Kept in the cache. Given to inference.",
      show: function () {
        showEyebrow("word made ready", 0);
        showTriad();
      }
    },
    {
      id: "silence",
      duration: 6200,
      mood: 0.55,
      speak: "Silence, deliberate as speech. Declared beside the prayer.",
      show: function () {
        showEyebrow("silence", 0);
        showTitle("listen", 160);
        showBody("weight without words · declared beside speech", 320);
      }
    },
    {
      id: "confession",
      duration: 6200,
      mood: 0.62,
      speak: "Small oath. Large echo. The chamber answers.",
      show: function () {
        showEyebrow("confession", 1100);
        showTitle("echo", 1400);
        showBody("sworn once · accepted or refused · amend as new line", 1700);
      }
    },
    {
      id: "cta",
      duration: 8000,
      mood: 0.7,
      speak: "Pray. Let the word go forth.",
      show: function () {
        showCta();
      }
    }
  ];

  var TOTAL_MS = SCENES.reduce(function (sum, s) {
    return sum + s.duration;
  }, 0);

  function toRomanNumeral(n) {
    var values = [10, 9, 5, 4, 1];
    var numerals = ["X", "IX", "V", "IV", "I"];
    var result = "";
    var i = 0;
    while (n > 0) {
      while (n >= values[i]) {
        result += numerals[i];
        n -= values[i];
      }
      i += 1;
    }
    return result;
  }

  function formatScenePage(n) {
    return toRomanNumeral(n);
  }

  var gl = null;
  var program = null;
  var uniforms = {};
  var buffer = null;
  var glReady = false;
  var pW = 0;
  var pH = 0;
  var voidTime = 0;
  var mood = 0;
  var moodTarget = 0;
  var rafId = null;
  var plasmaFrame = 0;
  var MODE_COUNT = 7;
  var morphWeights = [0.42, 0.12, 0.1, 0.1, 0.12, 0.08, 0.06];
  var morphTargets = [0.42, 0.12, 0.1, 0.1, 0.12, 0.08, 0.06];
  var morphSharp = 0.45;
  var morphTargetSharp = 0.45;
  var morphPulse = 0;
  var chromaPaint = { r: 1, g: 0.94, b: 1.02, sat: 1.05 };
  var plasmaTime = 0;
  var plasmaSignal = { feedback: 0, surge: 0 };
  var plasmaFbDelay = { impulse: 0, echo: 0.1, surge: 0 };
  var plasmaFrameDt = 0.016;
  var plasmaFlow = { x: 1, y: -1, z: 1, w: -1 };
  var plasmaFaint = 0.42;
  var plasmaFeedback = 0.12;
  var plasmaFlowSpeed = 0.28;
  var frameAstro = null;
  var atmosphereFrame = 0;

  var audioCtx = null;
  var master = null;
  var dry = null;
  var send = null;
  var wet = null;
  var bassBus = null;
  var drumBus = null;
  var ambientBus = null;
  var delayA = null;
  var delayB = null;
  var delayFbA = null;
  var delayFbB = null;
  var padNodes = null;
  var voiceChamber = null;
  var masterGlue = null;
  var analyser = null;
  var timeDomainBuf = null;
  var freqBuf = null;
  var scopeTex = null;
  var scopeTexSize = 512;
  var scopePixels = null;
  var audioReactive = { rms: 0, bass: 0, mid: 0, high: 0, peak: 0 };
  var feedbackBase = { a: 0.58, b: 0.5 };
  var MASTER_LEVEL = 0.84;
  var AMBIENT_LEVEL = 0.94;
  var audioOn = true;
  var audioPlaying = false;
  var BPM = 127;
  var BEATS_PER_BAR = 5;
  var STEPS_PER_BEAT = 2;
  var SEC_PER_STEP = 60 / BPM / STEPS_PER_BEAT;
  var STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT;
  var audioTick = 0;
  var audioNextTime = 0;
  var audioTimer = null;
  var tabHidden = document.hidden;
  var barIndex = 0;
  var brightness = 0.22;
  var brightnessTarget = 0.22;
  var scaleIndex = 0;
  var dubStep = 0;

  var SCALES_MELANCHOLY = [
    [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440],
    [196, 220, 233.08, 261.63, 293.66, 311.13, 349.23, 392],
    [174.61, 196, 207.65, 233.08, 261.63, 277.18, 311.13, 349.23],
    [155.56, 174.61, 185, 207.65, 233.08, 246.94, 277.18, 311.13]
  ];

  var SCALES_BRIGHT = [
    [220, 246.94, 277.18, 293.66, 329.63, 370, 392, 440],
    [196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392],
    [233.08, 261.63, 293.66, 311.13, 349.23, 392, 415.3, 466.16],
    [246.94, 277.18, 311.13, 329.63, 370, 415.3, 440, 493.88]
  ];

  var ARP_BARS = [
    [0, 2, 3, 5, 7],
    [7, 5, 4, 3, 2],
    [0, 1, 3, 4, 6],
    [6, 4, 3, 1, 0]
  ];

  var PLASMA_PHASES = [
    {
      name: "noble gas",
      mix: [0.54, 0.06, 0.05, 0.1, 0.16, 0.05, 0.04],
      sharp: 0.28,
      visc: 0.08, crystal: 0.05, turb: 0.18, diff: 0.82,
      faint: 0.44,
      chroma: [0.88, 0.94, 1.08],
      sat: 0.8
    },
    {
      name: "cloud mist",
      mix: [0.06, 0.08, 0.1, 0.12, 0.46, 0.06, 0.12],
      sharp: 0.22,
      visc: 0.15, crystal: 0.04, turb: 0.12, diff: 0.92,
      faint: 0.52,
      chroma: [0.9, 0.93, 0.98],
      sat: 0.72
    },
    {
      name: "liquid metal",
      mix: [0.08, 0.1, 0.12, 0.08, 0.52, 0.06, 0.04],
      sharp: 0.38,
      visc: 0.78, crystal: 0.1, turb: 0.24, diff: 0.35,
      faint: 0.3,
      chroma: [0.82, 0.86, 0.92],
      sat: 0.68
    },
    {
      name: "ionized reaction",
      mix: [0.14, 0.1, 0.1, 0.14, 0.12, 0.34, 0.06],
      sharp: 0.82,
      visc: 0.12, crystal: 0.08, turb: 0.88, diff: 0.42,
      faint: 0.32,
      chroma: [1.02, 0.88, 0.95],
      sat: 0.92
    },
    {
      name: "ice lattice",
      mix: [0.08, 0.12, 0.44, 0.38, 0.06, 0.14, 0.08],
      sharp: 0.68,
      visc: 0.42, crystal: 0.88, turb: 0.1, diff: 0.55,
      faint: 0.38,
      chroma: [0.86, 0.92, 1.04],
      sat: 0.76
    },
    {
      name: "frozen vapor",
      mix: [0.12, 0.38, 0.32, 0.1, 0.14, 0.18, 0.08],
      sharp: 0.55,
      visc: 0.55, crystal: 0.72, turb: 0.06, diff: 0.78,
      faint: 0.58,
      chroma: [0.84, 0.9, 1.02],
      sat: 0.62
    },
    {
      name: "plasma flame",
      mix: [0.42, 0.08, 0.1, 0.12, 0.1, 0.22, 0.16],
      sharp: 0.62,
      visc: 0.18, crystal: 0.12, turb: 0.72, diff: 0.38,
      faint: 0.34,
      chroma: [1.04, 0.9, 0.82],
      sat: 0.88
    },
    {
      name: "fluid aurora",
      mix: [0.1, 0.1, 0.12, 0.28, 0.32, 0.08, 0.3],
      sharp: 0.48,
      visc: 0.32, crystal: 0.15, turb: 0.45, diff: 0.62,
      faint: 0.36,
      chroma: [0.9, 0.96, 1.06],
      sat: 0.84
    }
  ];

  var phaseState = {
    visc: 0.2, crystal: 0.05, turb: 0.2, diff: 0.5,
    faint: 0.34, sat: 0.74,
    chroma: [0.9, 0.92, 0.96]
  };
  var phaseTarget = {
    visc: 0.2, crystal: 0.05, turb: 0.2, diff: 0.5,
    faint: 0.34, sat: 0.74,
    chroma: [0.9, 0.92, 0.96]
  };

  var BASS_PATTERN = [
    { d: 0, v: 0.88 }, null, null,
    { d: 4, v: 0.52 }, null,
    { d: 2, v: 0.48 }, null,
    { d: 0, v: 0.72 }, null,
    { d: 4, v: 0.56 }, null
  ];

  var DUB_PATTERN = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

  var KICK_PATTERN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  var SKANK_PATTERN = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  var HAT_PATTERN = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0];

  var running = false;
  var sceneIndex = 0;
  var sceneStart = 0;
  var sceneTimer = null;
  var endFadeTimer = null;
  var speechMuted = false;

  var VS =
    "attribute vec2 a_pos;" +
    "varying vec2 v_uv;" +
    "void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}";

  var FS =
    "precision mediump float;" +
    "varying vec2 v_uv;" +
    "uniform float u_time;" +
    "uniform float u_frame;" +
    "uniform float u_mood;" +
    "uniform float u_sharp;" +
    "uniform vec2 u_res;" +
    "uniform vec4 u_mix0;" +
    "uniform vec4 u_mix1;" +
    "uniform vec3 u_chroma;" +
    "uniform float u_sat;" +
    "uniform vec4 u_flow;" +
    "uniform vec4 u_astro;" +
    "uniform float u_feedback;" +
    "uniform float u_faint;" +
    "uniform sampler2D u_scope;" +
    "uniform vec4 u_audio;" +
    "uniform vec4 u_phase;" +
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
    "float noise(vec2 p){" +
    "vec2 i=floor(p);vec2 f=fract(p);" +
    "float a=hash(i);float b=hash(i+vec2(1.0,0.0));" +
    "float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));" +
    "vec2 u=f*f*(3.0-2.0*f);return mix(a,b,u.x)+mix(c,d,u.x)*u.y*(1.0-u.y);}" +
    "float fbm(vec2 p){" +
    "float v=0.0;float a=0.5;mat2 rot=mat2(0.8,-0.6,0.6,0.8);" +
    "for(int i=0;i<4;i++){v+=a*noise(p);p=rot*p*2.05;a*=0.5;}return v;}" +
    "float plasmaClassic(vec2 uv,float t,vec4 dir){" +
    "vec2 d=uv-0.5;float s=0.26;" +
    "return sin(uv.x*12.4+t*dir.x*s)+" +
    "sin(uv.y*10.8-t*dir.y*s*0.94)+" +
    "sin((uv.x+uv.y)*9.2+t*dir.z*s*0.82)+" +
    "sin((uv.x-uv.y)*8.4-t*dir.w*s*0.76)+" +
    "sin(dot(d,d)*36.0-t*(dir.x+dir.y)*s*0.48);}" +
    "float plasmaPixel(vec2 uv,float t,vec4 dir){" +
    "vec2 grid=max(floor(u_res/vec2(9.0,11.0)),vec2(1.0));" +
    "vec2 cell=floor(uv*u_res/grid);" +
    "vec2 q=(cell+0.5)/grid;" +
    "float h=hash(cell+floor(t*0.85));" +
    "return sin(q.x*22.0+t*dir.x*0.62+h*6.28)*sin(q.y*18.0-t*dir.y*0.58+h*4.1);}" +
    "float plasmaCubic(vec2 uv,float t,vec4 dir){" +
    "vec2 g=uv*10.0;vec2 id=floor(g);vec2 f=fract(g)-0.5;" +
    "float box=max(abs(f.x),abs(f.y));" +
    "float cell=hash(id+floor(t*0.55));" +
    "return sin(box*16.0-t*dir.z*0.48+cell*6.28)*1.4+cos((f.x*dir.x+f.y*dir.y)*12.0+t*0.28);}" +
    "float plasmaTri(vec2 uv,float t,vec4 dir){" +
    "vec2 p=uv*9.0;float a=sin(p.x*1.2+t*dir.x*0.35)+sin(p.y*1.05-t*dir.y*0.32);" +
    "float b=sin((p.x*0.866+p.y*0.5)*1.4+t*dir.z*0.3);" +
    "float c=sin((-p.x*0.866+p.y*0.5)*1.4-t*dir.w*0.28);" +
    "return a+b*0.7+c*0.7;}" +
    "float plasmaOil(vec2 uv,float t,vec4 dir){" +
    "vec2 p=uv*2.8+vec2(t*dir.x*0.018,-t*dir.y*0.014);" +
    "float n=fbm(p);float m=fbm(p*1.7+vec2(1.7,9.2)+t*dir.z*0.012);" +
    "return (n*2.1+m*1.4-1.8)*3.2;}" +
    "float plasmaSharp(vec2 uv,float t,vec4 dir){" +
    "float v=plasmaClassic(uv,t,dir);" +
    "return sign(v)*pow(abs(v),mix(0.25,0.92,u_sharp));}" +
    "float plasmaMycelium(vec2 uv,float t,vec4 dir){" +
    "vec2 p=uv*4.5;float n=fbm(p+vec2(t*dir.x*0.016,0.0));" +
    "float ridge=1.0-abs(n-fbm(p+vec2(0.0,t*dir.y*0.013)+3.7));" +
    "float vein=pow(ridge,2.8)*6.0;" +
    "float branch=sin(uv.x*38.0+vein*4.0+t*dir.z*0.4)*cos(uv.y*34.0-vein*3.0-t*dir.w*0.35);" +
    "return vein*1.6+branch*0.35;}" +
    "vec3 plasmaColor(float field,float t,vec2 uv,float faint,float fb){" +
    "float whisper=pow(abs(field),1.0-faint*0.35);" +
    "field=sign(field)*mix(abs(field),whisper,0.28+faint*0.22);" +
    "field+=sin(field*3.2+t*0.22)*fb*0.08;" +
    "float hue=field*0.38+t*0.22+uv.x*2.1+uv.y*1.6+u_astro.x*0.8;" +
    "vec3 c=vec3(sin(hue)*0.5+0.5,sin(hue+2.094)*0.5+0.5,sin(hue+4.188)*0.5+0.5);" +
    "float gray=dot(c,vec3(0.299,0.587,0.114));" +
    "c=mix(vec3(gray),c,u_sat);" +
    "c*=u_chroma;c+=vec3(fb*0.05);return c;}" +
    "float audioPulse(float x){float s=texture2D(u_scope,vec2(clamp(x,0.001,0.999),0.5)).r;return s*2.0-1.0;}" +
    "void main(){" +
    "vec2 uv=v_uv;float t=u_time;float f=u_frame;" +
    "vec4 dir=u_flow;" +
    "float phaseVisc=u_phase.x;float phaseCrystal=u_phase.y;float phaseTurb=u_phase.z;float phaseDiff=u_phase.w;" +
    "float astroPulse=sin(u_astro.x*6.283+t*0.12)*0.5+sin(u_astro.y*0.523+t*0.09)*0.35;" +
    "vec2 warp=vec2(sin(t*0.11+uv.y*6.0+astroPulse),cos(t*0.09+uv.x*5.0-astroPulse))*0.014;" +
    "warp+=vec2(noise(uv*3.0+f*0.004)-0.5,noise(uv*3.0+f*0.004+4.2)-0.5)*0.022;" +
    "float audioAmp=u_audio.x;float audioBass=u_audio.y;float audioMid=u_audio.z;" +
    "float pulse=audioPulse(uv.x)*0.62+audioPulse(uv.y*0.41+t*0.015)*0.38;" +
    "float vibe=pulse*audioAmp*(0.14+phaseTurb*0.22);" +
    "float rip=sin((uv.x+uv.y)*20.0+t*1.4+pulse*4.5)*audioBass*phaseTurb*0.022;" +
    "warp+=vec2(vibe*0.009+rip,vibe*0.011*phaseDiff);" +
    "vec2 p=uv+warp;" +
    "p+=vec2(sin(p.y*16.0+t*1.1+pulse*2.8),cos(p.x*14.0-t*0.9))*audioAmp*phaseTurb*0.006;" +
    "float lattice=6.0+phaseCrystal*14.0;" +
    "vec2 pIce=floor(p*lattice)/lattice;" +
    "p=mix(p,pIce,phaseCrystal*0.42);" +
    "float m0=plasmaClassic(p,t,dir)*u_mix0.x;" +
    "float m1=plasmaPixel(p,t,dir)*u_mix0.y;" +
    "float m2=plasmaCubic(p,t,dir)*u_mix0.z;" +
    "float m3=plasmaTri(p,t,dir)*u_mix0.w;" +
    "float m4=plasmaOil(p,t,dir)*u_mix1.x;" +
    "float m5=plasmaSharp(p,t,dir)*u_mix1.y;" +
    "float m6=plasmaMycelium(p,t,dir)*u_mix1.z;" +
    "float field=m0+m1+m2+m3+m4+m5+m6;" +
    "float mist=fbm(p*2.1+vec2(t*0.035,-t*0.02))*2.0-1.0;" +
    "field=mix(field,mist*(1.6+field*0.25),phaseDiff*0.32*(1.0-phaseCrystal*0.45));" +
    "float jitter=hash(uv*floor(u_res*0.5)+f*0.02)*0.08;" +
    "field+=jitter*(0.02+u_mood*0.02+u_faint*0.03);" +
    "float r=length(uv-0.5);" +
    "float echo=sin(r*16.0-t*0.42+u_feedback*6.28+u_astro.z*0.9)*u_feedback*0.022;" +
    "float echo2=cos(r*24.0+t*0.28-u_astro.w*1.4)*u_feedback*0.014;" +
    "field+=echo+echo2;" +
    "field+=pulse*0.32*audioAmp+audioBass*0.2*phaseTurb+audioMid*0.08;" +
    "field*=1.0+audioAmp*0.045+audioBass*0.035;" +
    "field=mix(field,sign(field)*pow(abs(field),1.0+phaseVisc*0.5),phaseVisc*0.38);" +
    "field+=sin(field*phaseTurb*4.0+t*0.35+pulse*2.0)*audioAmp*0.12*phaseTurb;" +
    "float smoothAmt=mix(0.15,0.92,u_mix1.w);" +
    "field=mix(field,sign(field)*pow(abs(field),0.55),smoothAmt);" +
    "vec3 col=plasmaColor(field,t,uv,u_faint,u_feedback);" +
    "vec3 base=vec3(0.1,0.102,0.11);" +
    "vec3 ochre=vec3(0.79,0.66,0.49);" +
    "vec3 cyan=vec3(0.43,0.77,0.77);" +
    "vec3 rose=vec3(0.72,0.48,0.60);" +
    "float vign=smoothstep(0.95,0.35,r);" +
    "col=mix(base,col,vign*(0.82+u_mood*0.14));" +
    "col+=ochre*exp(-r*3.2)*(0.1+u_mood*0.08);" +
    "col+=cyan*fbm(uv*3.0+t*0.008)*0.04*(0.5+phaseDiff*0.5);" +
    "col+=rose*step(0.96,hash(floor(uv*u_res*0.08)+f*0.02))*0.012*phaseTurb;" +
    "float scan=pow(sin((uv.y+u_mood*0.05)*u_res.y*0.65+t*0.55)*0.5+0.5,10.0)*0.012;" +
    "col+=vec3(scan);" +
    "col=pow(col,vec3(0.97));" +
    "col=max(col,vec3(0.09));" +
    "gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);}";

  function compileShader(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initGL() {
    if (!canvas) return false;
    gl =
      canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true }) ||
      canvas.getContext("experimental-webgl", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return false;

    var vs = compileShader(gl.VERTEX_SHADER, VS);
    var fs = compileShader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    uniforms = {
      time: gl.getUniformLocation(program, "u_time"),
      frame: gl.getUniformLocation(program, "u_frame"),
      mood: gl.getUniformLocation(program, "u_mood"),
      sharp: gl.getUniformLocation(program, "u_sharp"),
      res: gl.getUniformLocation(program, "u_res"),
      mix0: gl.getUniformLocation(program, "u_mix0"),
      mix1: gl.getUniformLocation(program, "u_mix1"),
      chroma: gl.getUniformLocation(program, "u_chroma"),
      sat: gl.getUniformLocation(program, "u_sat"),
      flow: gl.getUniformLocation(program, "u_flow"),
      astro: gl.getUniformLocation(program, "u_astro"),
      feedback: gl.getUniformLocation(program, "u_feedback"),
      faint: gl.getUniformLocation(program, "u_faint"),
      scope: gl.getUniformLocation(program, "u_scope"),
      audio: gl.getUniformLocation(program, "u_audio"),
      phase: gl.getUniformLocation(program, "u_phase")
    };

    scopePixels = new Uint8Array(scopeTexSize * 4);
    var i;
    for (i = 0; i < scopeTexSize; i++) {
      scopePixels[i * 4] = 128;
      scopePixels[i * 4 + 1] = 128;
      scopePixels[i * 4 + 2] = 128;
      scopePixels[i * 4 + 3] = 255;
    }
    scopeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, scopeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scopeTexSize, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, scopePixels);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    glReady = true;
    return true;
  }

  function resizeGL() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(window.innerWidth * dpr));
    var h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (w === pW && h === pH) return;
    pW = w;
    pH = h;
    canvas.width = pW;
    canvas.height = pH;
    if (gl && glReady) gl.viewport(0, 0, pW, pH);
  }

  function normalizeMorph() {
    var sum = 0;
    var i;
    for (i = 0; i < MODE_COUNT; i++) sum += Math.max(0, morphWeights[i]);
    if (sum < 0.001) {
      morphWeights[0] = 1;
      return;
    }
    for (i = 0; i < MODE_COUNT; i++) morphWeights[i] = Math.max(0, morphWeights[i]) / sum;
  }

  function applyPhaseTarget(phase) {
    phaseTarget.visc = phase.visc;
    phaseTarget.crystal = phase.crystal;
    phaseTarget.turb = phase.turb;
    phaseTarget.diff = phase.diff;
    phaseTarget.faint = phase.faint;
    phaseTarget.sat = phase.sat;
    phaseTarget.chroma[0] = phase.chroma[0];
    phaseTarget.chroma[1] = phase.chroma[1];
    phaseTarget.chroma[2] = phase.chroma[2];
  }

  function setScenePlasmaTargets(index) {
    var phase = PLASMA_PHASES[index % PLASMA_PHASES.length];
    var i;
    for (i = 0; i < MODE_COUNT; i++) {
      morphTargets[i] = phase.mix[i];
      morphWeights[i] = morphWeights[i] * 0.82 + phase.mix[i] * 0.18;
    }
    normalizeMorph();
    morphTargetSharp = phase.sharp;
    applyPhaseTarget(phase);
    phaseState.visc = phaseState.visc * 0.55 + phase.visc * 0.45;
    phaseState.crystal = phaseState.crystal * 0.55 + phase.crystal * 0.45;
    phaseState.turb = phaseState.turb * 0.55 + phase.turb * 0.45;
    phaseState.diff = phaseState.diff * 0.55 + phase.diff * 0.45;
    phaseState.faint = phaseState.faint * 0.55 + phase.faint * 0.45;
    phaseState.sat = phaseState.sat * 0.55 + phase.sat * 0.45;
    phaseState.chroma[0] = phaseState.chroma[0] * 0.55 + phase.chroma[0] * 0.45;
    phaseState.chroma[1] = phaseState.chroma[1] * 0.55 + phase.chroma[1] * 0.45;
    phaseState.chroma[2] = phaseState.chroma[2] * 0.55 + phase.chroma[2] * 0.45;
    plasmaSignal.feedback = 0;
    plasmaSignal.surge = 0;
    plasmaFbDelay.impulse = 0;
    plasmaFbDelay.echo = 0.1;
    plasmaFbDelay.surge = 0;
    pickFlowDirections();
    plasmaFlowSpeed = 0.2 + (index % 5) * 0.04 + astroUnit(index * 2.1) * 0.08;
  }

  function astroChrono() {
    var d = new Date();
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var day = d.getUTCDate();
    var hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var doy = Math.floor((Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
    var moon = ((year - 2000) * 12.3685 + month + day / 30.6) % 1;
    if (moon < 0) moon += 1;
    var zodiac = Math.floor((doy / 365.25) * 12 + month * 0.27) % 12;
    return { hour: hour, day: day, month: month, moon: moon, zodiac: zodiac, doy: doy };
  }

  function astroUnit(salt) {
    var a = frameAstro || astroChrono();
    var v =
      Math.sin(a.hour * 0.618 + salt) * 0.27 +
      Math.cos(a.day * 0.271 + a.month * 0.513 + salt * 1.7) * 0.25 +
      Math.sin(a.moon * 6.2831853 + salt * 0.9) * 0.24 +
      Math.cos(a.zodiac * 0.523 + a.doy * 0.041 + salt) * 0.21 +
      Math.sin(plasmaFrame * 0.011 + salt * 2.1) * 0.12 +
      Math.random() * 0.05;
    return Math.max(0, Math.min(1, 0.5 + v));
  }

  function pickFlowDirections() {
    plasmaFlow.x = astroUnit(20.1) > 0.5 ? 1 : -1;
    plasmaFlow.y = astroUnit(21.2) > 0.5 ? -1 : 1;
    plasmaFlow.z = astroUnit(22.3) > 0.5 ? 1 : -1;
    plasmaFlow.w = astroUnit(23.4) > 0.5 ? -1 : 1;
    plasmaFlowSpeed = 0.22 + astroUnit(24.5) * 0.14;
  }

  function stepPlasmaFeedbackDelay(dt) {
    dt = dt || plasmaFrameDt || 0.016;
    var fps = dt * 60;
    plasmaFbDelay.impulse *= Math.pow(0.9, fps);
    plasmaFbDelay.surge *= Math.pow(0.93, fps);
    var follow = 0.011 * fps;
    var bleed = 0.007 * fps;
    plasmaFbDelay.echo += (plasmaFbDelay.impulse - plasmaFbDelay.echo) * follow;
    if (plasmaFbDelay.impulse < plasmaFbDelay.echo * 0.4) {
      plasmaFbDelay.echo *= 1 - bleed;
    }
    plasmaFbDelay.impulse = Math.min(plasmaFbDelay.impulse, 0.65);
    plasmaFbDelay.echo = Math.min(Math.max(0, plasmaFbDelay.echo), 0.34);
    plasmaFbDelay.surge = Math.min(plasmaFbDelay.surge, 0.45);
    plasmaSignal.feedback = plasmaFbDelay.echo;
    plasmaSignal.surge = plasmaFbDelay.surge * 0.22;
  }

  function mutatePlasma(dt) {
    dt = dt || plasmaFrameDt || 0.016;
    plasmaFrameDt = dt;
    plasmaFrame++;
    var t = plasmaTime;
    var a = frameAstro || astroChrono();
    var i;
    var lerp = 0.022 + astroUnit(12.4) * 0.012;

    if (plasmaFrame % 420 === 0) {
      pickFlowDirections();
    }

    var moonWobble = Math.sin(a.moon * 6.2831853 + t * 0.18) * 0.04;
    var zodiacWobble = Math.cos(a.zodiac * 0.523 + a.hour * 0.09) * 0.03;
    stepPlasmaFeedbackDelay(dt);

    for (i = 0; i < MODE_COUNT; i += 1) {
      morphWeights[i] += (morphTargets[i] - morphWeights[i]) * lerp;
    }

    morphPulse = Math.sin(t * 0.55 + a.zodiac * 0.4) * 0.5 + 0.5;
    morphSharp += (morphTargetSharp - morphSharp) * 0.028;
    normalizeMorph();

    var pl = 0.024;
    phaseState.visc += (phaseTarget.visc - phaseState.visc) * pl;
    phaseState.crystal += (phaseTarget.crystal - phaseState.crystal) * pl;
    phaseState.turb += (phaseTarget.turb - phaseState.turb) * pl;
    phaseState.diff += (phaseTarget.diff - phaseState.diff) * pl;
    phaseState.faint += (phaseTarget.faint - phaseState.faint) * pl;
    phaseState.sat += (phaseTarget.sat - phaseState.sat) * pl;
    phaseState.chroma[0] += (phaseTarget.chroma[0] - phaseState.chroma[0]) * pl;
    phaseState.chroma[1] += (phaseTarget.chroma[1] - phaseState.chroma[1]) * pl;
    phaseState.chroma[2] += (phaseTarget.chroma[2] - phaseState.chroma[2]) * pl;

    plasmaFaint = phaseState.faint + mood * 0.06 + morphPulse * 0.03;
    if (typeof ecoSignalField !== "undefined") {
      plasmaFaint += ecoSignalField.faint * 0.022 + ecoSignalField.resonance * 0.012;
      plasmaFaint = Math.min(0.68, plasmaFaint);
    }
    plasmaFeedback = 0.03 + audioReactive.rms * 0.14 + audioReactive.bass * 0.08;
    plasmaFeedback += plasmaFbDelay.echo * 0.042;
    if (typeof ecoSignalField !== "undefined") {
      plasmaFeedback += ecoSignalField.resonance * 0.028 + ecoSignalField.ring * 0.012;
    }
    plasmaFeedback = Math.min(0.36, Math.max(0.02, plasmaFeedback));

    chromaPaint.r = phaseState.chroma[0] + mood * 0.05 + audioReactive.bass * 0.04;
    chromaPaint.g = phaseState.chroma[1] + mood * 0.04 + audioReactive.mid * 0.03;
    chromaPaint.b = phaseState.chroma[2] + mood * 0.05 + audioReactive.high * 0.04 + moonWobble * 0.03;
    chromaPaint.sat = phaseState.sat + mood * 0.18 + morphPulse * 0.06 + audioReactive.mid * 0.05;
  }

  function sampleAudioScope() {
    var decay = 0.94;
    if (!analyser || !scopeTex || !glReady) {
      audioReactive.rms *= decay;
      audioReactive.bass *= decay;
      audioReactive.mid *= decay;
      audioReactive.high *= decay;
      audioReactive.peak *= decay;
      return;
    }

    analyser.getByteTimeDomainData(timeDomainBuf);
    analyser.getByteFrequencyData(freqBuf);

    var rms = 0;
    var peak = 0;
    var step = Math.max(1, Math.floor(timeDomainBuf.length / scopeTexSize));
    var i;
    var px;
    for (i = 0; i < scopeTexSize; i++) {
      var sample = timeDomainBuf[Math.min(timeDomainBuf.length - 1, i * step)];
      var centered = (sample - 128) / 128;
      rms += centered * centered;
      peak = Math.max(peak, Math.abs(centered));
      px = i * 4;
      scopePixels[px] = sample;
      scopePixels[px + 1] = sample;
      scopePixels[px + 2] = sample;
      scopePixels[px + 3] = 255;
    }
    rms = Math.sqrt(rms / scopeTexSize);

    var bass = 0;
    var mid = 0;
    var high = 0;
    var bins = freqBuf.length;
    for (i = 0; i < bins; i++) {
      var e = freqBuf[i] / 255;
      if (i < 14) bass += e;
      else if (i < 96) mid += e;
      else high += e;
    }
    bass /= 14;
    mid /= 82;
    high /= Math.max(1, bins - 96);

    var smooth = 0.34;
    audioReactive.rms += (rms - audioReactive.rms) * smooth;
    audioReactive.peak += (peak - audioReactive.peak) * smooth;
    audioReactive.bass += (bass - audioReactive.bass) * smooth;
    audioReactive.mid += (mid - audioReactive.mid) * smooth;
    audioReactive.high += (high - audioReactive.high) * smooth;

    if (typeof ecoPulse === "function" && audioReactive.rms < 0.06) {
      ecoPulse(audioReactive.rms * 0.02 + audioReactive.high * 0.014);
    }

    gl.bindTexture(gl.TEXTURE_2D, scopeTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, scopeTexSize, 1, gl.RGBA, gl.UNSIGNED_BYTE, scopePixels);
  }

  function drawGL() {
    if (!glReady) return;
    var a = frameAstro || astroChrono();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    var posLoc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uniforms.time, plasmaTime);
    gl.uniform1f(uniforms.frame, plasmaFrame);
    gl.uniform1f(uniforms.mood, mood);
    gl.uniform1f(uniforms.sharp, morphSharp);
    gl.uniform2f(uniforms.res, pW, pH);
    gl.uniform4f(
      uniforms.mix0,
      morphWeights[0],
      morphWeights[1],
      morphWeights[2],
      morphWeights[3]
    );
    gl.uniform4f(
      uniforms.mix1,
      morphWeights[4],
      morphWeights[5],
      morphWeights[6],
      morphSharp
    );
    gl.uniform3f(uniforms.chroma, chromaPaint.r, chromaPaint.g, chromaPaint.b);
    gl.uniform1f(uniforms.sat, chromaPaint.sat);
    gl.uniform4f(uniforms.flow, plasmaFlow.x, plasmaFlow.y, plasmaFlow.z, plasmaFlow.w);
    gl.uniform4f(
      uniforms.astro,
      a.moon,
      a.zodiac / 12,
      a.hour / 24,
      a.doy / 365
    );
    gl.uniform1f(uniforms.feedback, plasmaFeedback);
    gl.uniform1f(uniforms.faint, plasmaFaint);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scopeTex);
    gl.uniform1i(uniforms.scope, 0);
    gl.uniform4f(
      uniforms.audio,
      audioReactive.rms,
      audioReactive.bass,
      audioReactive.mid,
      audioReactive.peak
    );
    gl.uniform4f(
      uniforms.phase,
      phaseState.visc,
      phaseState.crystal,
      phaseState.turb,
      phaseState.diff
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var plasmaLastTs = 0;

  function frame(ts) {
    voidTime = ts * 0.001;
    var dt = plasmaLastTs ? Math.min(0.05, (ts - plasmaLastTs) * 0.001) : 0.016;
    plasmaLastTs = ts;
    plasmaTime += 0.014 + astroUnit(3.3) * 0.01;
    mood += (moodTarget - mood) * 0.018;
    atmosphereFrame++;
    if (atmosphereFrame % 24 === 0) frameAstro = astroChrono();
    sampleAudioScope();
    mutatePlasma(dt);
    drawGL();
    rafId = requestAnimationFrame(frame);
  }

  function startPlasmaLoop() {
    if (rafId || reduced || !glReady) return;
    rafId = requestAnimationFrame(frame);
  }

  function stopPlasmaLoop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function setCurtain(active) {
    if (!fadeCurtain || reduced) return Promise.resolve();
    fadeCurtain.classList.toggle("is-active", active);
    return wait(FADE_MS);
  }

  function forceHideAll() {
    sceneBlocks.forEach(function (el) {
      if (!el) return;
      el.hidden = true;
      el.classList.remove("is-visible", "is-fading-out", "is-dim");
    });
    if (sceneLayer) sceneLayer.classList.remove("is-exiting");
  }

  function fadeOutBlocks() {
    return new Promise(function (resolve) {
      var visible = sceneBlocks.filter(function (el) {
        return el && !el.hidden && el.classList.contains("is-visible");
      });
      if (!visible.length || reduced) {
        forceHideAll();
        resolve();
        return;
      }
      if (sceneLayer) sceneLayer.classList.add("is-exiting");
      visible.forEach(function (el) {
        el.classList.remove("is-visible");
        el.classList.add("is-fading-out");
      });
      wait(FADE_MS).then(function () {
        visible.forEach(function (el) {
          el.classList.remove("is-fading-out");
          el.hidden = true;
        });
        if (sceneLayer) sceneLayer.classList.remove("is-exiting");
        resolve();
      });
    });
  }

  function hideEl(el) {
    if (!el) return;
    if (contentFade && el.classList.contains("is-visible")) {
      el.classList.remove("is-visible");
      el.classList.add("is-fading-out");
      window.setTimeout(function () {
        el.classList.remove("is-fading-out");
        el.hidden = true;
      }, FADE_MS);
      return;
    }
    el.hidden = true;
    el.classList.remove("is-visible", "is-fading-out", "is-dim");
  }

  function showEl(el, delay) {
    if (!el) return;
    if (!contentFade) {
      el.hidden = false;
      el.classList.remove("is-fading-out");
      el.classList.add("is-visible");
      return;
    }
    delay = delay || 0;
    window.setTimeout(function () {
      el.hidden = false;
      el.classList.remove("is-fading-out");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.classList.add("is-visible");
        });
      });
    }, delay);
  }

  function hideAllText() {
    sceneBlocks.forEach(function (el) {
      hideEl(el);
    });
  }

  function showEyebrow(text, delay) {
    hideEl(eyebrowEl);
    if (!text) return;
    eyebrowEl.textContent = text;
    showEl(eyebrowEl, delay);
  }

  function showTitle(text, delay) {
    hideEl(titleEl);
    if (!text) return;
    titleEl.textContent = text;
    showEl(titleEl, delay);
  }

  function showBody(text, delay) {
    hideEl(bodyEl);
    if (!text) return;
    bodyEl.textContent = text;
    showEl(bodyEl, delay);
  }

  function showTriad() {
    showEl(triadEl, 200);
  }

  function showCta() {
    showEl(ctaEl, 0);
  }

  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    var preferred = voices.find(function (v) {
      return v.lang && v.lang.toLowerCase().startsWith("en") && /female|samantha|karen|moira|victoria|fiona/i.test(v.name);
    });
    if (preferred) return preferred;
    var en = voices.find(function (v) {
      return v.lang && v.lang.toLowerCase().startsWith("en");
    });
    return en || voices[0];
  }

  function speak(text, onEnd) {
    if (!text || speechMuted || !("speechSynthesis" in window)) {
      if (onEnd) window.setTimeout(onEnd, 400);
      return;
    }
    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(text);
    var voice = pickVoice();
    utt.lang = "en-US";
    if (voice) utt.voice = voice;
    utt.rate = 0.78;
    utt.pitch = 0.9;
    utt.volume = 1;
    utt.onend = function () {
      blendForSpeech(false);
      stopVoiceChamber();
      if (onEnd) onEnd();
    };
    utt.onerror = function () {
      blendForSpeech(false);
      stopVoiceChamber();
      if (onEnd) onEnd();
    };
    blendForSpeech(true);
    startVoiceChamber();
    window.speechSynthesis.speak(utt);
  }

  function makeNoiseBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    var i;
    for (i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  function startVoiceChamber() {
    if (!audioCtx || !ambientBus || !send) return;
    stopVoiceChamber();
    var ctx = audioCtx;
    var t = ctx.currentTime;
    var mix = ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t);
    mix.gain.linearRampToValueAtTime(0.28, t + 0.45);

    var noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 2.4);
    noise.loop = true;

    var formants = [
      { f: 220, q: 0.9, g: 0.42 },
      { f: 520, q: 1.05, g: 0.55 },
      { f: 1380, q: 1.2, g: 0.38 }
    ];
    var i;
    for (i = 0; i < formants.length; i++) {
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = formants[i].f;
      bp.Q.value = formants[i].q;
      var fg = ctx.createGain();
      fg.gain.value = formants[i].g;
      noise.connect(bp);
      bp.connect(fg);
      fg.connect(mix);
    }

    var hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 174;
    var humGain = ctx.createGain();
    humGain.gain.value = 0.06;
    hum.connect(humGain);
    humGain.connect(mix);

    var breath = ctx.createOscillator();
    breath.type = "triangle";
    breath.frequency.value = 0.22;
    var breathAmt = ctx.createGain();
    breathAmt.gain.value = 0.14;
    breath.connect(breathAmt);
    breathAmt.connect(mix.gain);

    mix.connect(ambientBus);
    var chamberSend = ctx.createGain();
    chamberSend.gain.value = 0.92;
    mix.connect(chamberSend);
    chamberSend.connect(send);

    noise.start(t);
    hum.start(t);
    breath.start(t);
    voiceChamber = {
      mix: mix,
      noise: noise,
      hum: hum,
      breath: breath,
      chamberSend: chamberSend
    };
  }

  function stopVoiceChamber() {
    if (!voiceChamber || !audioCtx) return;
    var t = audioCtx.currentTime;
    voiceChamber.mix.gain.cancelScheduledValues(t);
    voiceChamber.mix.gain.setValueAtTime(voiceChamber.mix.gain.value, t);
    voiceChamber.mix.gain.linearRampToValueAtTime(0.0001, t + 0.75);
    var stopT = t + 0.85;
    voiceChamber.noise.stop(stopT);
    voiceChamber.hum.stop(stopT);
    voiceChamber.breath.stop(stopT);
    voiceChamber = null;
  }

  function makeReverbIR(ctx, seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    var ch;
    for (ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      var n;
      for (n = 0; n < len; n++) {
        data[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
      }
    }
    return buffer;
  }

  function makeDriveCurve(drive) {
    var curve = new Float32Array(512);
    var i;
    for (i = 0; i < 512; i++) {
      var x = (i * 2) / 511 - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    return curve;
  }

  function makeDriveNode(ctx, amount, mix) {
    var input = ctx.createGain();
    var shaper = ctx.createWaveShaper();
    shaper.curve = makeDriveCurve(amount);
    shaper.oversample = "4x";
    var dryGain = ctx.createGain();
    var wetGain = ctx.createGain();
    dryGain.gain.value = 1 - mix;
    wetGain.gain.value = mix;
    var output = ctx.createGain();
    input.connect(dryGain);
    input.connect(shaper);
    shaper.connect(wetGain);
    dryGain.connect(output);
    wetGain.connect(output);
    return { input: input, output: output };
  }

  function updateDelayTimes() {
    if (!delayA || !delayB || !audioCtx) return;
    var beat = 60 / BPM;
    delayA.delayTime.setValueAtTime(beat * 0.76, audioCtx.currentTime);
    delayB.delayTime.setValueAtTime(beat * 1.32, audioCtx.currentTime);
  }

  function currentScale() {
    var pool = brightness > 0.52 ? SCALES_BRIGHT : SCALES_MELANCHOLY;
    return pool[scaleIndex % pool.length];
  }

  function scaleNote(degree, octave) {
    var scale = currentScale();
    var idx = ((degree % 8) + 8) % 8;
    octave = octave || 0;
    return scale[idx] * Math.pow(2, octave);
  }

  function updateSmokedPad() {
    if (!padNodes || !audioCtx) return;
    var root = scaleNote(0, -1);
    var fifth = scaleNote(4, -1);
    var third = scaleNote(brightness > 0.52 ? 2 : 3, -1);
    var t = audioCtx.currentTime;
    padNodes.root.frequency.setTargetAtTime(root, t, 1.8);
    padNodes.third.frequency.setTargetAtTime(third, t, 1.8);
    padNodes.fifth.frequency.setTargetAtTime(fifth, t, 1.8);
    padNodes.padGain.gain.setTargetAtTime(0.062 + brightness * 0.048, t, 2.2);
  }

  function pickMusicMood() {
    brightnessTarget = 0.12 + mood * 0.55 + (Math.random() - 0.5) * 0.12;
    if (Math.random() < 0.14 + mood * 0.1) {
      brightnessTarget = 0.62 + Math.random() * 0.32;
    }
    if (Math.random() < 0.1) {
      scaleIndex = Math.floor(Math.random() * SCALES_MELANCHOLY.length);
    }
    if (brightnessTarget > 0.55 && Math.random() < 0.45) {
      scaleIndex = Math.floor(Math.random() * SCALES_BRIGHT.length);
    }
    updateSmokedPad();
  }

  function startSmokedPad(ctx) {
    if (padNodes) return;
    var smoke = ctx.createBiquadFilter();
    smoke.type = "lowpass";
    smoke.frequency.value = 340;
    smoke.Q.value = 0.55;
    var body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 220;
    body.Q.value = 0.7;
    var wobble = ctx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 0.06;
    var wobbleAmt = ctx.createGain();
    wobbleAmt.gain.value = 95;
    wobble.connect(wobbleAmt);
    wobbleAmt.connect(body.frequency);
    var padGain = ctx.createGain();
    padGain.gain.value = 0.068;
    var root = ctx.createOscillator();
    root.type = "sine";
    root.frequency.value = 55;
    var third = ctx.createOscillator();
    third.type = "triangle";
    third.frequency.value = 65.41;
    var fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 82.5;
    root.connect(body);
    third.connect(body);
    fifth.connect(body);
    body.connect(smoke);
    smoke.connect(padGain);
    padGain.connect(ambientBus);
    var wetSend = ctx.createGain();
    wetSend.gain.value = 0.62;
    padGain.connect(wetSend);
    wetSend.connect(send);
    root.start();
    third.start();
    fifth.start();
    wobble.start();
    padNodes = { root: root, third: third, fifth: fifth, padGain: padGain, body: body };
    updateSmokedPad();
  }

  function connectSoundSystem(ctx) {
    master = ctx.createGain();
    master.gain.value = 0;
    dry = ctx.createGain();
    dry.gain.value = 0.64;
    send = ctx.createGain();
    send.gain.value = 1;
    wet = ctx.createGain();
    wet.gain.value = 0.74;

    var bassDrive = makeDriveNode(ctx, 5.4, 0.64);
    var drumDrive = makeDriveNode(ctx, 3.2, 0.44);
    bassBus = bassDrive.input;
    drumBus = drumDrive.input;
    ambientBus = ctx.createGain();
    bassBus.gain.value = 1.18;
    drumBus.gain.value = 0.58;
    ambientBus.gain.value = AMBIENT_LEVEL;

    var drumComp = ctx.createDynamicsCompressor();
    drumComp.threshold.value = -26;
    drumComp.ratio.value = 3.5;
    drumComp.attack.value = 0.01;
    drumComp.release.value = 0.35;

    var bassComp = ctx.createDynamicsCompressor();
    bassComp.threshold.value = -28;
    bassComp.ratio.value = 2.8;
    bassComp.attack.value = 0.018;
    bassComp.release.value = 0.88;

    drumDrive.output.connect(drumComp);
    bassDrive.output.connect(bassComp);
    drumComp.connect(dry);
    bassComp.connect(dry);
    bassComp.connect(send);
    ambientBus.connect(dry);
    ambientBus.connect(send);

    var beat = 60 / BPM;
    delayA = ctx.createDelay(6);
    delayA.delayTime.value = beat * 0.76;
    delayB = ctx.createDelay(6);
    delayB.delayTime.value = beat * 1.32;
    delayFbA = ctx.createGain();
    delayFbA.gain.value = feedbackBase.a;
    delayFbB = ctx.createGain();
    delayFbB.gain.value = feedbackBase.b;

    var reverb = ctx.createConvolver();
    reverb.buffer = makeReverbIR(ctx, 5.8, 2.6);
    reverb.normalize = false;

    var wetDark = ctx.createBiquadFilter();
    wetDark.type = "lowpass";
    wetDark.frequency.value = 3800;
    wetDark.Q.value = 0.42;

    send.connect(delayA);
    delayA.connect(delayFbA);
    delayFbA.connect(delayA);
    delayA.connect(delayB);
    delayB.connect(delayFbB);
    delayFbB.connect(delayB);
    delayB.connect(reverb);
    reverb.connect(wetDark);
    wetDark.connect(wet);
    wet.connect(master);
    dry.connect(master);

    masterGlue = ctx.createDynamicsCompressor();
    masterGlue.threshold.value = -20;
    masterGlue.ratio.value = 2.6;
    masterGlue.attack.value = 0.006;
    masterGlue.release.value = 0.32;
    masterGlue.knee.value = 8;

    var subShelf = ctx.createBiquadFilter();
    subShelf.type = "lowshelf";
    subShelf.frequency.value = 72;
    subShelf.gain.value = 7.8;
    var systemLow = ctx.createBiquadFilter();
    systemLow.type = "lowpass";
    systemLow.frequency.value = 7200;
    systemLow.Q.value = 0.42;
    master.connect(masterGlue);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.38;
    analyser.minDecibels = -84;
    analyser.maxDecibels = -6;
    timeDomainBuf = new Uint8Array(analyser.fftSize);
    freqBuf = new Uint8Array(analyser.frequencyBinCount);
    masterGlue.connect(analyser);
    analyser.connect(subShelf);
    subShelf.connect(systemLow);
    systemLow.connect(ctx.destination);

    startSmokedPad(ctx);
  }

  function envHit(node, peak, attack, release, when, bus, wetAmt) {
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + release);
    node.connect(g);
    g.connect(bus);
    if (wetAmt) {
      var wetSend = audioCtx.createGain();
      wetSend.gain.value = wetAmt;
      g.connect(wetSend);
      wetSend.connect(send);
    }
  }

  function playKick(when) {
    var body = audioCtx.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(98, when);
    body.frequency.exponentialRampToValueAtTime(42, when + 0.18);
    var sub = audioCtx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(52, when);
    sub.frequency.exponentialRampToValueAtTime(38, when + 0.28);
    var mix = audioCtx.createGain();
    body.connect(mix);
    sub.connect(mix);
    var lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 280;
    mix.connect(lp);
    envHit(lp, 0.84, 0.004, 0.78, when, drumBus, 0.22);
    body.start(when);
    body.stop(when + 0.78);
    sub.start(when);
    sub.stop(when + 0.78);
  }

  function playSkank(when) {
    var noise = audioCtx.createBufferSource();
    var len = Math.floor(audioCtx.sampleRate * 0.05);
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    var filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.9;
    noise.connect(filter);
    envHit(filter, 0.16, 0.003, 0.14, when, drumBus, 0.28);
    noise.start(when);
    noise.stop(when + 0.12);
  }

  function playHat(when) {
    var noise = audioCtx.createBufferSource();
    var len = Math.floor(audioCtx.sampleRate * 0.025);
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    var filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6200;
    noise.connect(filter);
    envHit(filter, 0.035, 0.001, 0.05, when, drumBus, 0.08);
    noise.start(when);
    noise.stop(when + 0.06);
  }

  function playSmokedBass(when, freq, velocity) {
    var release = 2.6 + Math.random() * 1.8;
    var sub = audioCtx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq * 0.5;
    var growl = audioCtx.createOscillator();
    growl.type = "triangle";
    growl.frequency.value = freq * 0.96;
    var growlGain = audioCtx.createGain();
    growlGain.gain.value = 0.14;
    var smoke = audioCtx.createBiquadFilter();
    smoke.type = "lowpass";
    smoke.frequency.setValueAtTime(320, when);
    smoke.frequency.exponentialRampToValueAtTime(48, when + release * 0.92);
    smoke.Q.value = 1.1;
    var dubLfo = audioCtx.createOscillator();
    dubLfo.type = "sine";
    dubLfo.frequency.value = 0.18;
    var dubAmt = audioCtx.createGain();
    dubAmt.gain.value = 140;
    dubLfo.connect(dubAmt);
    dubAmt.connect(smoke.frequency);
    var mix = audioCtx.createGain();
    sub.connect(mix);
    growl.connect(growlGain);
    growlGain.connect(mix);
    mix.connect(smoke);
    envHit(smoke, 0.88 * velocity, 0.022, release, when, bassBus, 0.76);
    sub.start(when);
    sub.stop(when + release + 0.35);
    growl.start(when);
    growl.stop(when + release + 0.35);
    dubLfo.start(when);
    dubLfo.stop(when + release + 0.35);
  }

  function playDubChord(when) {
    var release = 1.8 + Math.random() * 1.2;
    var root = scaleNote(0, -1);
    var chord = scaleNote(brightness > 0.52 ? 2 : 3, -1);
    var osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = root;
    var osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = chord;
    var filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(480, when);
    filter.frequency.exponentialRampToValueAtTime(120, when + release);
    filter.Q.value = 0.8;
    var mix = audioCtx.createGain();
    osc.connect(mix);
    osc2.connect(mix);
    mix.connect(filter);
    envHit(filter, 0.32 + brightness * 0.1, 0.012, release, when, ambientBus, 0.78);
    osc.start(when);
    osc.stop(when + release + 0.2);
    osc2.start(when);
    osc2.stop(when + release + 0.2);
  }

  function playArpNote(when, freq, velocity) {
    var release = 0.9 + Math.random() * 0.8;
    var osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    var shimmer = audioCtx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = freq * 2.01;
    var shimmerGain = audioCtx.createGain();
    shimmerGain.gain.value = 0.22;
    var filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 + brightness * 1400, when);
    filter.frequency.exponentialRampToValueAtTime(420, when + release * 0.85);
    filter.Q.value = 0.55;
    var mix = audioCtx.createGain();
    osc.connect(mix);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(mix);
    mix.connect(filter);
    envHit(filter, 0.15 * velocity, 0.05, release, when, ambientBus, 0.72);
    osc.start(when);
    osc.stop(when + release + 0.15);
    shimmer.start(when);
    shimmer.stop(when + release + 0.15);
  }

  function scheduleAudioStep(tick, when) {
    var stepInBar = tick % STEPS_PER_BAR;

    if (tick % STEPS_PER_BAR === 0 && tick > 0) {
      barIndex++;
      pickMusicMood();
    }

    brightness += (brightnessTarget - brightness) * 0.025;

    if (tick % STEPS_PER_BEAT === 0) {
      var beatInBar = Math.floor(stepInBar / STEPS_PER_BEAT) % BEATS_PER_BAR;
      var arpBar = ARP_BARS[barIndex % ARP_BARS.length];
      var arpOct = brightness > 0.55 ? 1 : 0;
      playArpNote(when, scaleNote(arpBar[beatInBar], arpOct), 0.62 + brightness * 0.38);
    }

    var bassHit = BASS_PATTERN[stepInBar];
    if (bassHit) {
      playSmokedBass(when, scaleNote(bassHit.d, -1), bassHit.v);
    }

    if (DUB_PATTERN[stepInBar]) {
      playDubChord(when);
    }

    if (KICK_PATTERN[stepInBar]) playKick(when);
    if (SKANK_PATTERN[stepInBar] && Math.random() < 0.65) playSkank(when);
    if (HAT_PATTERN[stepInBar] && Math.random() < 0.5) playHat(when);

    dubStep++;
  }

  function audioScheduler() {
    if (!audioPlaying || !audioCtx) return;
    var now = audioCtx.currentTime;
    var horizon = tabHidden ? 8 : 0.5;
    var maxSteps = tabHidden ? 480 : 64;
    var steps = 0;
    while (audioNextTime < now + horizon && steps < maxSteps) {
      scheduleAudioStep(audioTick, audioNextTime);
      audioNextTime += SEC_PER_STEP;
      audioTick++;
      steps++;
    }
    audioTimer = window.setTimeout(audioScheduler, tabHidden ? 350 : 25);
  }

  function connectAmbient(ctx) {
    connectSoundSystem(ctx);
  }

  function startAmbient() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || !audioOn) return;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
      connectAmbient(audioCtx);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioTick = 0;
    barIndex = 0;
    dubStep = 0;
    pickMusicMood();
    brightness = brightnessTarget;
    audioNextTime = audioCtx.currentTime + 0.06;
    if (master) {
      master.gain.cancelScheduledValues(audioCtx.currentTime);
      master.gain.setValueAtTime(master.gain.value, audioCtx.currentTime);
      master.gain.linearRampToValueAtTime(MASTER_LEVEL, audioCtx.currentTime + 1.4);
    }
    audioPlaying = true;
    if (audioTimer) window.clearTimeout(audioTimer);
    audioScheduler();
  }

  function stopAmbient() {
    audioPlaying = false;
    if (audioTimer) {
      window.clearTimeout(audioTimer);
      audioTimer = null;
    }
    if (audioCtx && master) {
      master.gain.cancelScheduledValues(audioCtx.currentTime);
      master.gain.setValueAtTime(master.gain.value, audioCtx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
      window.setTimeout(function () {
        if (!audioPlaying && audioCtx && audioCtx.state === "running") audioCtx.suspend();
      }, 1000);
    }
  }

  function blendForSpeech(active) {
    if (!audioCtx || !master || !audioOn) return;
    var t = audioCtx.currentTime;
    var masterTarget = active ? MASTER_LEVEL * 0.9 : MASTER_LEVEL;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(masterTarget, t + (active ? 0.2 : 0.55));
    if (ambientBus) {
      ambientBus.gain.cancelScheduledValues(t);
      ambientBus.gain.setValueAtTime(ambientBus.gain.value, t);
      ambientBus.gain.linearRampToValueAtTime(active ? AMBIENT_LEVEL * 0.92 : AMBIENT_LEVEL, t + 0.3);
    }
    if (wet) {
      wet.gain.cancelScheduledValues(t);
      wet.gain.setValueAtTime(wet.gain.value, t);
      wet.gain.linearRampToValueAtTime(active ? 0.92 : 0.74, t + 0.35);
    }
    if (bassBus) {
      bassBus.gain.cancelScheduledValues(t);
      bassBus.gain.setValueAtTime(bassBus.gain.value, t);
      bassBus.gain.linearRampToValueAtTime(active ? 0.95 : 1.18, t + 0.25);
    }
    if (padNodes && padNodes.padGain) {
      padNodes.padGain.gain.cancelScheduledValues(t);
      padNodes.padGain.gain.setValueAtTime(padNodes.padGain.gain.value, t);
      padNodes.padGain.gain.linearRampToValueAtTime(
        active ? 0.058 + brightness * 0.038 : 0.062 + brightness * 0.048,
        t + 0.35
      );
    }
  }

  function updateProgress() {
    if (!progressFill) return;
    var elapsed = 0;
    for (var i = 0; i < sceneIndex; i++) elapsed += SCENES[i].duration;
    if (running && sceneStart) elapsed += performance.now() - sceneStart;
    var pct = Math.min(100, (elapsed / TOTAL_MS) * 100);
    progressFill.style.width = pct + "%";
    if (sceneCounter) {
      sceneCounter.textContent =
        formatScenePage(sceneIndex + 1) + " / " + formatScenePage(SCENES.length);
    }
  }

  function enterScene(index) {
    var scene = SCENES[index];
    forceHideAll();
    sceneIndex = index;
    sceneStart = performance.now();
    moodTarget = scene.mood;
    brightnessTarget = 0.1 + scene.mood * 0.58;
    if (scene.mood > 0.45 && Math.random() < 0.35) {
      brightnessTarget = 0.58 + Math.random() * 0.35;
    }
    setScenePlasmaTargets(index);
    scene.show();
    updateProgress();
    if (scene.speak) speak(scene.speak);
  }

  function transitionToScene(index) {
    if (index >= SCENES.length) {
      endDemo();
      return;
    }

    var afterEnter = function () {
      if (sceneTimer) window.clearTimeout(sceneTimer);
    if (endFadeTimer) window.clearTimeout(endFadeTimer);
    endFadeTimer = null;
      sceneTimer = window.setTimeout(function () {
        transitionToScene(index + 1);
      }, SCENES[index].duration);
    };

    if (index === 0) {
      contentFade = true;
      if (fadeCurtain) fadeCurtain.classList.remove("is-active");
      enterScene(0);
      wait(FADE_MS + 600).then(function () {
        contentFade = false;
        afterEnter();
      });
      return;
    }

    contentFade = false;
    enterScene(index);
    afterEnter();
  }

  function setDemoChrome(visible) {
    chromeEls.forEach(function (el) {
      if (!el) return;
      el.classList.toggle("is-hidden", !visible);
    });
    if (demoFooter) {
      demoFooter.hidden = true;
      demoFooter.classList.remove("is-visible");
    }
  }

  function endDemo() {
    running = false;
    contentFade = false;
    if (sceneTimer) window.clearTimeout(sceneTimer);
    if (endFadeTimer) window.clearTimeout(endFadeTimer);
    endFadeTimer = null;
    window.speechSynthesis.cancel();
    moodTarget = 0.75;
    setDemoChrome(false);
    if (progressFill) progressFill.style.width = "100%";
    if (sceneCounter) sceneCounter.textContent = "";
    showCta();
    if (ctaEl) {
      ctaEl.hidden = false;
      ctaEl.classList.remove("is-fading-out");
      ctaEl.classList.add("is-visible");
    }
    if (sceneLayer) sceneLayer.classList.remove("is-exiting");
    if (fadeCurtain) fadeCurtain.classList.remove("is-active");
    endFadeTimer = window.setTimeout(function () {
      endFadeTimer = null;
      fadeOutBlocks();
    }, reduced ? 0 : 5000);
  }

  function startDemo() {
    if (running) return;
    running = true;
    setDemoChrome(true);
    if (startGate) startGate.classList.add("is-hidden");
    startAmbient();
    startPlasmaLoop();
    transitionToScene(0);
  }

  function resetDemo() {
    running = false;
    if (sceneTimer) window.clearTimeout(sceneTimer);
    if (endFadeTimer) window.clearTimeout(endFadeTimer);
    endFadeTimer = null;
    window.speechSynthesis.cancel();
    sceneIndex = 0;
    moodTarget = 0;
    mood = 0;
    forceHideAll();
    contentFade = false;
    setDemoChrome(true);
    if (fadeCurtain) fadeCurtain.classList.remove("is-active");
    if (progressFill) progressFill.style.width = "0%";
    if (sceneCounter) sceneCounter.textContent = "";
    if (demoFooter) {
      demoFooter.hidden = true;
      demoFooter.classList.remove("is-visible");
    }
    if (startGate) startGate.classList.remove("is-hidden");
    if (startBtn) {
      startBtn.classList.remove("is-unlocking");
      startBtn.disabled = false;
    }
    stopAmbient();
  }

  function replayDemo() {
    resetDemo();
    window.setTimeout(startDemo, 400);
  }

  if (startBtn) {
    startBtn.addEventListener("click", function () {
      if (running) return;
      startBtn.classList.add("is-unlocking");
      startBtn.disabled = true;
      window.setTimeout(startDemo, reduced ? 0 : 1050);
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener("click", replayDemo);
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", function () {
      audioOn = !audioOn;
      speechMuted = !audioOn;
      muteBtn.setAttribute("aria-pressed", audioOn ? "false" : "true");
      muteBtn.textContent = audioOn ? "mute" : "unmute";
      if (!audioOn) {
        window.speechSynthesis.cancel();
        blendForSpeech(false);
        stopVoiceChamber();
        if (master && audioCtx) {
          master.gain.cancelScheduledValues(audioCtx.currentTime);
          master.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        }
      } else if (running) {
        startAmbient();
      } else if (audioCtx && audioPlaying && !audioTimer) {
        audioScheduler();
      }
    });
  }

  window.addEventListener("resize", resizeGL);

  document.addEventListener("visibilitychange", function () {
    tabHidden = document.hidden;
    if (document.hidden) {
      stopPlasmaLoop();
      stopAnts();
      stopSpiders();
      stopMycelium();
      return;
    }
    startPlasmaLoop();
    startMycelium();
    startSpiders();
    startAnts();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (audioPlaying && !audioTimer) audioScheduler();
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = function () {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.getVoices();
  }

  resizeGL();

  if (!reduced && canvas) {
    initGL();
    frameAstro = astroChrono();
    pickFlowDirections();
    setScenePlasmaTargets(0);
    mutatePlasma();
    drawGL();
    startPlasmaLoop();
  } else if (canvas) {
    canvas.style.display = "none";
  }

  var myceliumCanvas = document.getElementById("mycelium-field");
  var myceliumCtx = null;
  var myceliumColonies = [];
  var myceliumSegments = [];
  var myceliumFruits = [];
  var myceliumSpores = [];
  var myceliumRings = [];
  var myceliumPairs = {};
  var myceliumColonyId = 0;
  var myceliumRingId = 0;
  var myceliumRaf = null;
  var myceliumLast = 0;
  var myceliumGrowAccum = 0;
  var myceliumGrowTurn = 0;
  var myceliumCrawlStimulus = 0;
  var ecoPulseBuf = 0;
  var ecoSignalField = { faint: 0, resonance: 0, ring: 0 };
  var ecoFeedbackLast = 0;
  var ecoFrameTick = 0;
  var envPressureCache = null;
  var envPressureCacheAt = 0;
  var colonySegmentCountsDirty = true;
  var colonyCountsFrame = 0;
  var MAX_MYCELIUM_SEGMENTS = 560;
  var colonySegmentCounts = {};
  var myceliumW = 0;
  var myceliumH = 0;
  var cosmology = null;
  var COSMO_ZODIAC = [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
  ];
  var antCorpses = [];
  var antEggs = [];
  var antEggId = 0;
  var MAX_ANTS = 16;
  var ANT_TARGET_FLOOR = 10;
  var ANT_INITIAL_COUNT = 14;
  var MAX_CORPSES = 14;
  var MAX_EGGS = 28;
  var EGG_HATCH_MIN = 6000;
  var EGG_HATCH_MAX = 16000;
  var ANT_LIFESPAN_MIN = 52000;
  var ANT_LIFESPAN_MAX = 98000;
  var ANT_FUNGUS_LOAD_MAX = 0.82;
  var ANT_FUNGUS_LOAD_DECAY = 0.38;
  var ANT_TOXIN_DECAY = 0.11;
  var COVERAGE_COLS = 24;
  var COVERAGE_ROWS = 16;
  var coverageCells = [];
  var screenHoles = [];
  var space5Phase = 0;

  function resizeCoverageGrid() {
    var n = COVERAGE_COLS * COVERAGE_ROWS;
    if (coverageCells.length !== n) {
      coverageCells = new Array(n);
      var i;
      for (i = 0; i < n; i += 1) {
        coverageCells[i] = 0;
      }
    }
  }

  function coverageCellIndex(x, y) {
    if (!myceliumW || !myceliumH) return -1;
    var cx = Math.floor((x / myceliumW) * COVERAGE_COLS);
    var cy = Math.floor((y / myceliumH) * COVERAGE_ROWS);
    if (cx < 0 || cy < 0 || cx >= COVERAGE_COLS || cy >= COVERAGE_ROWS) return -1;
    return cy * COVERAGE_COLS + cx;
  }

  function markCoverage(x, y, weight) {
    var idx = coverageCellIndex(x, y);
    if (idx < 0) return;
    coverageCells[idx] = Math.min(1, coverageCells[idx] + (weight || 0.03));
  }

  function coverageFraction() {
    if (!coverageCells.length) return 0;
    var filled = 0;
    var i;
    for (i = 0; i < coverageCells.length; i += 1) {
      if (coverageCells[i] > 0.14) filled += 1;
    }
    return filled / coverageCells.length;
  }

  function spreadSeekPoint(fromX, fromY) {
    var bestX = myceliumW * 0.5;
    var bestY = myceliumH * 0.5;
    var bestScore = Infinity;
    var cx;
    var cy;
    for (cy = 0; cy < COVERAGE_ROWS; cy += 1) {
      for (cx = 0; cx < COVERAGE_COLS; cx += 1) {
        var idx = cy * COVERAGE_COLS + cx;
        var cov = coverageCells[idx] || 0;
        var px = ((cx + 0.5) / COVERAGE_COLS) * myceliumW;
        var py = ((cy + 0.5) / COVERAGE_ROWS) * myceliumH;
        var dx = px - fromX;
        var dy = py - fromY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var score = cov * 2.4 + dist * 0.0018;
        if (score < bestScore) {
          bestScore = score;
          bestX = px;
          bestY = py;
        }
      }
    }
    return { x: bestX, y: bestY };
  }

  function spreadSeekAngle(fromX, fromY, fromAngle) {
    var target = spreadSeekPoint(fromX, fromY);
    return envAngleDiff(fromAngle, Math.atan2(target.y - fromY, target.x - fromX));
  }

  function spreadSeekWeight() {
    var cov = coverageFraction();
    return 0.18 + Math.max(0, 1 - cov) * 0.42;
  }

  function initScreenHoles() {
    var w = myceliumW;
    var h = myceliumH;
    if (!w || !h) return;
    screenHoles = [
      { edge: "left", x: 2, y: h * 0.28, len: 58, pair: 1 },
      { edge: "right", x: w - 2, y: h * 0.72, len: 58, pair: 0 },
      { edge: "top", x: w * 0.34, y: 2, len: 54, pair: 3 },
      { edge: "bottom", x: w * 0.66, y: h - 2, len: 54, pair: 2 },
      { edge: "left", x: 2, y: h * 0.72, len: 46, pair: 5 },
      { edge: "right", x: w - 2, y: h * 0.28, len: 46, pair: 4 }
    ];
  }

  function nearestScreenHole(x, y, radius) {
    var best = null;
    var bestD = radius * radius;
    var i;
    for (i = 0; i < screenHoles.length; i += 1) {
      var hole = screenHoles[i];
      var hx = hole.x;
      var hy = hole.y;
      if (hole.edge === "left" || hole.edge === "right") {
        hy = hole.y + Math.max(-hole.len * 0.5, Math.min(hole.len * 0.5, y - hole.y));
      } else {
        hx = hole.x + Math.max(-hole.len * 0.5, Math.min(hole.len * 0.5, x - hole.x));
      }
      var dx = x - hx;
      var dy = y - hy;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = hole;
      }
    }
    return best;
  }

  function screenHoleExit(hole) {
    var paired = screenHoles[hole.pair];
    var along = (Math.random() - 0.5) * paired.len * 0.82;
    if (paired.edge === "left") {
      return { x: 14, y: paired.y + along, angle: 0 };
    }
    if (paired.edge === "right") {
      return { x: myceliumW - 14, y: paired.y + along, angle: Math.PI };
    }
    if (paired.edge === "top") {
      return { x: paired.x + along, y: 14, angle: Math.PI * 0.5 };
    }
    return { x: paired.x + along, y: myceliumH - 14, angle: -Math.PI * 0.5 };
  }

  function project5D(x, y, z, w, t) {
    var zz = z == null ? 0 : z;
    var ww = w == null ? 0 : w;
    var tt = t == null ? space5Phase : t;
    var reel = Math.sin(ww * 1.05 + tt * 0.62) * (12 + zz * 0.035);
    var coil = Math.cos(tt * 0.74 + ww * 0.48) * reel;
    var lift = Math.sin(tt * 0.74 + ww * 0.48) * reel * 0.84;
    var depthFade = 1 / (1 + Math.max(0, zz) * 0.0018);
    return {
      x: x + coil,
      y: y + lift,
      alpha: Math.max(0.2, Math.min(1, depthFade * (1 - zz * 0.00025))),
      scale: Math.max(0.5, depthFade)
    };
  }

  function spiralDrift(w, t, z) {
    var reel = Math.sin(w * 1.1 + t * 0.58) * (8 + (z || 0) * 0.04);
    return {
      dx: Math.cos(t + w * 0.7) * reel,
      dy: Math.sin(t + w * 0.7) * reel * 0.86
    };
  }

  function initEntity5D(entity) {
    if (entity.z == null) entity.z = 0;
    if (entity.w == null) entity.w = Math.random() * Math.PI * 2;
    if (entity.tPhase == null) entity.tPhase = Math.random() * Math.PI * 2;
    if (entity.reelRate == null) entity.reelRate = 0.45 + Math.random() * 0.55;
  }

  function stepEntity5D(entity, dt, boost) {
    initEntity5D(entity);
    var rate = entity.reelRate * (boost || 1);
    entity.tPhase += dt * (0.55 + rate);
    entity.w += dt * rate * 0.62;
    return project5D(entity.x, entity.y, entity.z, entity.w, entity.tPhase);
  }

  function drawScreenHoles(ctx) {
    var i;
    ctx.lineCap = "butt";
    for (i = 0; i < screenHoles.length; i += 1) {
      var hole = screenHoles[i];
      var pulse = 0.7 + Math.sin(space5Phase * 1.4 + i) * 0.3;
      ctx.strokeStyle = "rgba(248, 242, 228, " + (0.06 + pulse * 0.05) + ")";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      if (hole.edge === "left" || hole.edge === "right") {
        ctx.moveTo(hole.x, hole.y - hole.len * 0.5);
        ctx.lineTo(hole.x, hole.y + hole.len * 0.5);
      } else {
        ctx.moveTo(hole.x - hole.len * 0.5, hole.y);
        ctx.lineTo(hole.x + hole.len * 0.5, hole.y);
      }
      ctx.stroke();
    }
  }

  function drawSpiralReel(ctx, cx, cy, baseR, turns, phase, vitality, minerals, alpha) {
    var steps = 28;
    var s;
    ctx.strokeStyle = myceliumInk(vitality, 0, minerals, alpha);
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    for (s = 0; s <= steps; s += 1) {
      var u = s / steps;
      var ang = phase + u * turns * Math.PI * 2;
      var rad = baseR * (0.18 + u * 0.92);
      var px = cx + Math.cos(ang) * rad;
      var py = cy + Math.sin(ang) * rad * 0.78;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function tryMyceliumPortal(tip, colony) {
    if (tip.depth < 6 || Math.random() > 0.38) return false;
    var hole = nearestScreenHole(tip.x, tip.y, 34);
    if (!hole) return false;
    var exit = screenHoleExit(hole);
    var hx = hole.x;
    var hy = hole.y;
    if (hole.edge === "left" || hole.edge === "right") {
      hy = hole.y + Math.max(-hole.len * 0.5, Math.min(hole.len * 0.5, tip.y - hole.y));
    } else {
      hx = hole.x + Math.max(-hole.len * 0.5, Math.min(hole.len * 0.5, tip.x - hole.x));
    }
    pushMyceliumSegment({
      x1: tip.x,
      y1: tip.y,
      x2: hx,
      y2: hy,
      w: 0.34,
      a: 0.22,
      health: 0.9,
      minerals: 0.62,
      rot: 0,
      colonyId: colony.id,
      portal: true
    });
    tip.x = exit.x;
    tip.y = exit.y;
    tip.angle = exit.angle + (Math.random() - 0.5) * 0.35;
    pushMyceliumSegment({
      x1: exit.x,
      y1: exit.y,
      x2: exit.x + Math.cos(tip.angle) * 3.2,
      y2: exit.y + Math.sin(tip.angle) * 3.2,
      w: 0.4,
      a: 0.28,
      health: 1,
      minerals: 0.7,
      rot: 0,
      colonyId: colony.id,
      portal: true
    });
    markCoverage(exit.x, exit.y, 0.08);
    return true;
  }

  function tryAntPortal(ant) {
    var hole = nearestScreenHole(ant.x, ant.y, 28);
    if (!hole) return false;
    var exit = screenHoleExit(hole);
    ant.x = exit.x;
    ant.y = exit.y;
    ant.headAngle = exit.angle + (Math.random() - 0.5) * 0.45;
    ant.bodyAngle = ant.headAngle;
    ant.tailAngle = ant.headAngle;
    ant.angle = ant.headAngle;
    markCoverage(ant.x, ant.y, 0.06);
    return true;
  }

  function cosmoUnitFrom(a, salt) {
    var v =
      Math.sin(a.hour * 0.618 + salt) * 0.27 +
      Math.cos(a.day * 0.271 + a.month * 0.513 + salt * 1.7) * 0.25 +
      Math.sin(a.moon * 6.2831853 + salt * 0.9) * 0.24 +
      Math.cos(a.zodiac * 0.523 + a.doy * 0.041 + salt) * 0.21 +
      Math.sin((a.doy + salt * 0.37) * 0.17) * 0.18;
    return Math.max(0, Math.min(1, 0.5 + v));
  }

  function cosmoJitter(salt, span) {
    var a = cosmology ? cosmology.astro : (frameAstro || astroChrono());
    return (cosmoUnitFrom(a, salt) - 0.5) * span;
  }

  function layoutCosmologyColonies(a, spec) {
    var w = myceliumW || window.innerWidth;
    var h = myceliumH || window.innerHeight;
    var pad = 18 + cosmoUnitFrom(a, 1.1) * 42;
    var focalX = w * spec.focalNx;
    var focalY = h * spec.focalNy;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var colonies = [];
    var i;
    for (i = 0; i < spec.colonyCount; i += 1) {
      var ru = cosmoUnitFrom(a, 4 + i * 1.7);
      var rv = cosmoUnitFrom(a, 5 + i * 2.1);
      var ang = i * golden + cosmoUnitFrom(a, 6 + i) * Math.PI * 2;
      var rad = pad + ru * Math.min(w, h) * (0.2 + cosmoUnitFrom(a, 7.4) * 0.2);
      var x = focalX + Math.cos(ang) * rad * (0.68 + rv * 0.64);
      var y = focalY + Math.sin(ang) * rad * (0.68 + rv * 0.64);
      x = Math.max(pad, Math.min(w - pad, x));
      y = Math.max(pad, Math.min(h - pad, y));
      var biasAngle = Math.atan2(h * 0.5 - y, w * 0.5 - x) +
        (cosmoUnitFrom(a, 8 + i) - 0.5) * 1.35;
      var sign = Math.floor(cosmoUnitFrom(a, 9 + i) * 12) % 12;
      colonies.push({
        x: x,
        y: y,
        angle: biasAngle,
        sign: sign,
        signName: COSMO_ZODIAC[sign],
        epoch: i,
        vein: cosmoUnitFrom(a, 30 + i * 1.3)
      });
    }
    return colonies;
  }

  function deriveCosmology(a) {
    var colonyCount = 3 + Math.floor(cosmoUnitFrom(a, 2.3) * 5);
    var antMax = 10 + Math.floor(cosmoUnitFrom(a, 10.2) * 10);
    var antInitial = 6 + Math.floor(cosmoUnitFrom(a, 11.3) * Math.max(4, antMax - 5));
    var antWeights = [];
    var wi;
    for (wi = 0; wi < colonyCount; wi += 1) {
      antWeights.push(0.35 + cosmoUnitFrom(a, 12 + wi * 0.8) * 0.65);
    }
    var spec = {
      colonyCount: colonyCount,
      focalNx: 0.3 + cosmoUnitFrom(a, 3.1) * 0.4,
      focalNy: 0.24 + cosmoUnitFrom(a, 3.2) * 0.48
    };
    return {
      astro: a,
      seed: a.doy * 1000 + a.month * 100 + Math.floor(a.moon * 28) + a.zodiac * 17,
      colonyCount: colonyCount,
      focalNx: spec.focalNx,
      focalNy: spec.focalNy,
      colonies: layoutCosmologyColonies(a, spec),
      antWeights: antWeights,
      primingSteps: 14 + Math.floor(cosmoUnitFrom(a, 18.6) * 14),
      spreadDrive: 0.62 + cosmoUnitFrom(a, 19.7) * 0.38,
      feedbackGain: 0.38 + cosmoUnitFrom(a, 26.7) * 0.52,
      signalQ: 0.48 + cosmoUnitFrom(a, 27.8) * 0.46,
      faintBias: 0.22 + cosmoUnitFrom(a, 28.9) * 0.38,
      feedbackRings: 2 + Math.floor(cosmoUnitFrom(a, 29.1) * 4),
      species: {
        antMax: antMax,
        antFloor: Math.max(4, Math.floor(antMax * (0.42 + cosmoUnitFrom(a, 13.1) * 0.22))),
        antInitial: antInitial,
        eggMax: 18 + Math.floor(cosmoUnitFrom(a, 14.2) * 18),
        corpseMax: 8 + Math.floor(cosmoUnitFrom(a, 15.3) * 10),
        segmentMax: 420 + Math.floor(cosmoUnitFrom(a, 16.4) * 200),
        spiderMax: 2 + Math.floor(cosmoUnitFrom(a, 20.1) * 4),
        spiderInitial: 1 + Math.floor(cosmoUnitFrom(a, 21.2) * 3),
        webThreadMax: 160 + Math.floor(cosmoUnitFrom(a, 22.3) * 180),
        flyMax: 6 + Math.floor(cosmoUnitFrom(a, 23.4) * 10),
        flyInitial: 3 + Math.floor(cosmoUnitFrom(a, 24.5) * 6)
      }
    };
  }

  function applyCosmologyLimits(cos) {
    MAX_ANTS = cos.species.antMax;
    ANT_TARGET_FLOOR = cos.species.antFloor;
    ANT_INITIAL_COUNT = cos.species.antInitial;
    MAX_EGGS = cos.species.eggMax;
    MAX_CORPSES = cos.species.corpseMax;
    MAX_MYCELIUM_SEGMENTS = cos.species.segmentMax;
    MAX_SPIDERS = cos.species.spiderMax;
    SPIDER_INITIAL_COUNT = cos.species.spiderInitial;
    MAX_WEB_THREADS = cos.species.webThreadMax;
    MAX_FLIES = cos.species.flyMax;
    FLY_INITIAL_COUNT = cos.species.flyInitial;
  }

  function computeCosmology(refresh) {
    if (!cosmology || refresh) {
      cosmology = deriveCosmology(frameAstro || astroChrono());
    } else {
      cosmology.colonies = layoutCosmologyColonies(cosmology.astro, cosmology);
    }
    applyCosmologyLimits(cosmology);
    return cosmology;
  }

  function cosmologyAntSpawnPlan(colonies) {
    var cos = cosmology || computeCosmology(true);
    var total = cos.species.antInitial;
    var counts = [];
    var sum = 0;
    var i;
    for (i = 0; i < colonies.length; i += 1) {
      sum += cos.antWeights[i] || 1;
    }
    var placed = 0;
    for (i = 0; i < colonies.length; i += 1) {
      var n = i === colonies.length - 1
        ? Math.max(0, total - placed)
        : Math.max(1, Math.round(total * (cos.antWeights[i] || 1) / sum));
      counts.push(n);
      placed += n;
    }
    return counts;
  }

  function myceliumCornerSources() {
    if (!cosmology) computeCosmology(true);
    return cosmology.colonies.slice();
  }

  function ensureColonyAnchorTip(colony) {
    var a;
    for (a = 0; a < colony.tips.length; a += 1) {
      if (colony.tips[a].anchor) {
        return colony.tips[a];
      }
    }
    var tip = {
      x: colony.anchorX,
      y: colony.anchorY,
      angle: colony.biasAngle + (Math.random() - 0.5) * 0.55,
      depth: 0,
      anchor: true
    };
    colony.tips.unshift(tip);
    return tip;
  }

  function primeMyceliumColony(colony, steps) {
    ensureColonyAnchorTip(colony);
    var s;
    for (s = 0; s < steps; s += 1) {
      if (!colony.tips.length) break;
      var tipIndex = Math.floor(Math.random() * colony.tips.length);
      var tip = colony.tips[tipIndex];
      if (!growMyceliumTip(colony, tip)) {
        if (!tip.anchor) {
          colony.tips.splice(tipIndex, 1);
        } else {
          tip.angle = colony.biasAngle + (Math.random() - 0.5) * 1.1;
        }
      }
    }
    ensureColonyAnchorTip(colony);
  }

  function envAngleDiff(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function ecoClamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function ecoHslRgb(h, s, l, alpha) {
    h = ((h % 360) + 360) % 360;
    s = ecoClamp(s, 0, 1);
    l = ecoClamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = h / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0;
    var g = 0;
    var b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    var m = l - c * 0.5;
    return "rgba(" +
      Math.round((r + m) * 255) + "," +
      Math.round((g + m) * 255) + "," +
      Math.round((b + m) * 255) + "," +
      alpha + ")";
  }

  function ecoCreateGenome(seed) {
    var a = frameAstro || astroChrono();
    var s = seed != null ? seed : Math.random() * 99999;
    return {
      seed: s,
      hue: cosmoUnitFrom(a, s * 1.7) * 360,
      sat: 0.1 + cosmoUnitFrom(a, s * 2.3) * 0.42,
      light: 0.66 + cosmoUnitFrom(a, s * 3.1) * 0.2,
      form: Math.floor(cosmoUnitFrom(a, s * 4.7) * 5),
      drift: 0.007 + cosmoUnitFrom(a, s * 5.9) * 0.04,
      identity: Math.floor(cosmoUnitFrom(a, s * 6.7) * 99999),
      wave: cosmoUnitFrom(a, s * 8.1) * Math.PI * 2
    };
  }

  function ecoEnsureGenome(entity, seed) {
    if (!entity.genome) {
      entity.genome = ecoCreateGenome(seed != null ? seed : entity.id || entity.antId || entity.seed);
    }
    return entity.genome;
  }

  function ecoMutateStep(entity, dt, pressure, frameTick) {
    if (!entity) return;
    if (frameTick != null) {
      var entityId = entity.id != null ? entity.id : (entity.antId != null ? entity.antId : 0);
      if ((entityId + frameTick) % 2 !== 0) return;
    }
    var g = ecoEnsureGenome(entity);
    var rate = g.drift * (1 + (pressure && pressure.recycleLoad ? pressure.recycleLoad * 0.28 : 0));
    if (Math.random() < dt * rate * 3.4) {
      g.hue = (g.hue + (Math.random() - 0.5) * 20) % 360;
      g.sat = ecoClamp(g.sat + (Math.random() - 0.5) * 0.08, 0.05, 0.72);
      g.light = ecoClamp(g.light + (Math.random() - 0.5) * 0.07, 0.5, 0.9);
      g.wave += (Math.random() - 0.5) * 0.45;
      if (Math.random() < 0.04) {
        g.form = (g.form + 1 + Math.floor(Math.random() * 3)) % 5;
      }
      if (Math.random() < 0.02) {
        g.identity = (g.identity + 97 + Math.floor(Math.random() * 500)) % 100000;
      }
    }
    if (entity.scale != null && Math.random() < dt * rate * 0.55) {
      entity.scale = ecoClamp(entity.scale + (Math.random() - 0.5) * 0.045, 0.42, 1.7);
    }
    if (entity.alpha != null && Math.random() < dt * rate * 0.35) {
      entity.alpha = ecoClamp(entity.alpha + (Math.random() - 0.5) * 0.06, 0.28, 0.95);
    }
  }

  function ecoStroke(entity, alpha, energyTint) {
    var g = entity && entity.genome;
    if (!g) {
      return "rgba(236, 240, 248, " + (alpha != null ? alpha : 0.72) + ")";
    }
    var a = alpha != null ? alpha : 0.72;
    if (energyTint != null) {
      a *= 0.82 + energyTint * 0.18;
    }
    return ecoHslRgb(g.hue, g.sat, g.light, a);
  }

  function ecoFormScale(entity, axis) {
    var g = entity && entity.genome;
    if (!g) return 1;
    var w = Math.sin(g.wave + (axis || 0)) * 0.12;
    return 1 + w + g.form * 0.04;
  }

  function ecoColonyInk(colony, vitality, rot, minerals, alpha) {
    if (!colony || !colony.genome) {
      return myceliumInk(vitality, rot, minerals, alpha);
    }
    var g = colony.genome;
    var v = vitality == null ? 1 : vitality;
    var r = rot == null ? 0 : rot;
    var mix = 0.35 + g.sat * 0.25;
    return ecoHslRgb(
      g.hue + r * 18 - (1 - minerals) * 12,
      g.sat * (0.55 + v * 0.25),
      g.light - r * 0.08 - (1 - v) * 0.06,
      alpha * mix
    );
  }

  function randomScreenPoint(margin, w, h) {
    margin = margin || 18;
    w = w != null ? w : (typeof spiderW !== "undefined" ? spiderW : window.innerWidth);
    h = h != null ? h : (typeof spiderH !== "undefined" ? spiderH : window.innerHeight);
    return {
      x: margin + Math.random() * Math.max(8, w - margin * 2),
      y: margin + Math.random() * Math.max(8, h - margin * 2)
    };
  }

  function myceliumPairKey(a, b) {
    return a < b ? a + "-" + b : b + "-" + a;
  }

  function resizeMycelium() {
    if (!myceliumCanvas) return;
    myceliumW = window.innerWidth;
    myceliumH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    myceliumCanvas.width = Math.floor(myceliumW * dpr);
    myceliumCanvas.height = Math.floor(myceliumH * dpr);
    myceliumCanvas.style.width = myceliumW + "px";
    myceliumCanvas.style.height = myceliumH + "px";
    if (myceliumCtx) {
      myceliumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCoverageGrid();
    initScreenHoles();
  }

  function spawnMyceliumColony(source) {
    var anchorX = source.x;
    var anchorY = source.y;
    var biasAngle = source.angle;
    var reach = Math.hypot(myceliumW, myceliumH) * (0.38 + (source.vein || 0.5) * 0.18);
    var colony = {
      id: myceliumColonyId++,
      anchorX: anchorX,
      anchorY: anchorY,
      biasAngle: biasAngle,
      maxReach: reach,
      vitality: 0.88 + (source.vein || 0.5) * 0.12,
      minerals: 0.88 + (source.vein || 0.5) * 0.12,
      cosmoSign: source.sign,
      cosmoSignName: source.signName,
      cosmoEpoch: source.epoch,
      tips: [{
        x: anchorX,
        y: anchorY,
        angle: biasAngle + cosmoJitter(40 + source.epoch, 0.5),
        depth: 0,
        anchor: true
      }]
    };
    ecoEnsureGenome(colony, colony.id);
    initColonyOrbital(colony);
    return colony;
  }

  function colonyNearAnchor(x, y, radius) {
    var r2 = radius * radius;
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      var dx = x - colony.anchorX;
      var dy = y - colony.anchorY;
      if (dx * dx + dy * dy < r2) {
        return colony;
      }
    }
    return null;
  }

  function colonyById(id) {
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      if (myceliumColonies[c].id === id) {
        return myceliumColonies[c];
      }
    }
    return null;
  }

  function rebuildColonySegmentCounts() {
    var counts = {};
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      counts[myceliumColonies[c].id] = 0;
    }
    var i;
    for (i = 0; i < myceliumSegments.length; i += 1) {
      var id = myceliumSegments[i].colonyId;
      if (id != null) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    colonySegmentCounts = counts;
    colonySegmentCountsDirty = false;
  }

  function maybeRebuildColonySegmentCounts(force) {
    colonyCountsFrame += 1;
    if (force || colonySegmentCountsDirty || colonyCountsFrame % 6 === 0) {
      rebuildColonySegmentCounts();
    }
  }

  function colonySegmentCount(colonyId) {
    return colonySegmentCounts[colonyId] || 0;
  }

  function nearestColonyTo(x, y) {
    var best = null;
    var bestD = Infinity;
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      var dx = x - colony.anchorX;
      var dy = y - colony.anchorY;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = colony;
      }
    }
    return best;
  }

  function growCrawlHypha(ant) {
    var colony = ant.homeColonyId != null ? colonyById(ant.homeColonyId) : nearestColonyTo(ant.x, ant.y);
    if (!colony) return;
    var attach = nearestNetworkPoint(ant.x, ant.y, colony.id, 18);
    if (!attach || attach.dist > 16) return;
    var head = antHeadAngle(ant);
    var len = 2.2 + Math.min(ant.speed, 72) * 0.035;
    var nx = attach.x + Math.cos(head) * len;
    var ny = attach.y + Math.sin(head) * len;
    var dx = nx - colony.anchorX;
    var dy = ny - colony.anchorY;
    if (Math.sqrt(dx * dx + dy * dy) > colony.maxReach * 0.92) return;
    pushMyceliumSegment({
      x1: attach.x,
      y1: attach.y,
      x2: nx,
      y2: ny,
      w: 0.44 + Math.random() * 0.18,
      a: 0.34 + Math.random() * 0.16,
      health: 0.95,
      minerals: 0.58 + (colony.minerals || 0.7) * 0.2,
      rot: 0,
      colonyId: colony.id,
      crawl: true
    });
    if (Math.random() < 0.14 && colony.tips.length < 52) {
      colony.tips.push({
        x: nx,
        y: ny,
        angle: head + (Math.random() - 0.5) * 0.35,
        depth: 3
      });
    }
  }

  function antStimulateMycelium(ant, dt) {
    if (ant.speed < 1.8 || ant.resting) return;
    var crawl = ant.speed * dt;
    myceliumCrawlStimulus += crawl * (0.016 + ant.mass * 0.0045);
    ecoPulse(crawl * 0.012);

    var stimR = 10 + Math.min(ant.speed, 64) * 0.09;
    var stimR2 = stimR * stimR;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 64));
    var i;
    var touched = 0;
    for (i = 0; i < myceliumSegments.length && touched < 9; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var sdx = mx - ant.x;
      var sdy = my - ant.y;
      if (sdx * sdx + sdy * sdy > stimR2) continue;
      touched += 1;
      seg.minerals = Math.min(1, (seg.minerals || 0.5) + dt * (0.1 + ant.speed * 0.0016));
      seg.rot = Math.max(0, (seg.rot || 0) - dt * 0.038);
      if (seg.colonyId != null) {
        var home = colonyById(seg.colonyId);
        if (home) {
          home.minerals = Math.min(1, (home.minerals || 0.7) + dt * 0.007);
        }
      }
    }

    var nearColony = colonyNearAnchor(ant.x, ant.y, 88);
    if (nearColony) {
      nearColony.vitality = Math.min(1, (nearColony.vitality || 1) + dt * 0.014);
      nearColony.minerals = Math.min(1, (nearColony.minerals || 0.8) + dt * 0.008);
    }

    if (crawl > 0.32 && Math.random() < crawl * 0.012) {
      growCrawlHypha(ant);
    }
  }

  function myceliumInk(vitality, rot, minerals, alpha) {
    var v = vitality == null ? 1 : vitality;
    var r = rot == null ? 0 : rot;
    var m = minerals == null ? 1 : minerals;
    var starve = Math.max(0, 1 - m);
    var rr = 248 - starve * 58 - r * 68 + r * 16 + starve * 10;
    var gg = 244 - starve * 42 - r * 98 + r * 10;
    var bb = 236 - starve * 8 + r * 22 - starve * 18;
    return "rgba(" +
      Math.round(Math.max(88, Math.min(250, rr))) + "," +
      Math.round(Math.max(82, Math.min(246, gg))) + "," +
      Math.round(Math.max(78, Math.min(240, bb))) + "," +
      alpha + ")";
  }

  function myceliumHash2(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function myceliumNoise2(x, y) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);
    var a = myceliumHash2(ix, iy);
    var b = myceliumHash2(ix + 1, iy);
    var c = myceliumHash2(ix, iy + 1);
    var d = myceliumHash2(ix + 1, iy + 1);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }

  function myceliumFbm(x, y, octaves) {
    var v = 0;
    var a = 0.5;
    var o = octaves || 4;
    var i;
    for (i = 0; i < o; i += 1) {
      v += a * myceliumNoise2(x, y);
      x *= 2.05;
      y *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  function initColonyOrbital(colony) {
    colony.orbital = {
      phase: colony.id * 1.7 + Math.random() * 4,
      reelSpeed: 0.5 + Math.random() * 0.7,
      orbitR: 9 + Math.random() * 14,
      turns: 1.8 + Math.random() * 1.6,
      traces: []
    };
    initEntity5D(colony);
  }

  function stepColonyOrbital(colony, dt) {
    if (!colony.orbital) initColonyOrbital(colony);
    var vitality = colony.vitality != null ? colony.vitality : 1;
    colony.orbital.phase += dt * colony.orbital.reelSpeed * (0.35 + vitality * 0.55) * (reduced ? 0.35 : 1);
    stepEntity5D(colony, dt, 0.4 + vitality * 0.3);
    var traces = colony.orbital.traces;
    traces.push({
      x: colony.anchorX,
      y: colony.anchorY,
      phase: colony.orbital.phase
    });
    if (traces.length > 18) traces.shift();
  }

  function pruneMyceliumSegments(removeN) {
    var removed = 0;
    var j = myceliumSegments.length - 1;
    while (j >= 0 && removed < removeN) {
      var seg = myceliumSegments[j];
      if ((seg.mass || 0) > 0.95) {
        j -= 1;
        continue;
      }
      if ((seg.health != null && seg.health <= 0 && (seg.mass || 0) < 0.5 && (seg.rot || 0) > 0.3) ||
          ((seg.rot || 0) > 0.9 && (seg.mass || 0) < 0.45) ||
          (seg.dormant && (seg.minerals || 0) < 0.1 && (seg.mass || 0) < 0.4)) {
        myceliumSegments.splice(j, 1);
        removed += 1;
      }
      j -= 1;
    }
    while (removed < removeN && myceliumSegments.length > 0) {
      var lowIdx = 0;
      var lowMass = Infinity;
      var k;
      for (k = 0; k < Math.min(myceliumSegments.length, 48); k += 1) {
        var cand = myceliumSegments[k];
        var cm = cand.mass != null ? cand.mass : 0.5;
        if (cm < lowMass) {
          lowMass = cm;
          lowIdx = k;
        }
      }
      myceliumSegments.splice(lowIdx, 1);
      removed += 1;
    }
    if (removed > 0) colonySegmentCountsDirty = true;
  }

  function pushMyceliumSegment(seg) {
    if (seg.minerals == null) seg.minerals = 0.72 + Math.random() * 0.22;
    if (seg.rot == null) seg.rot = 0;
    if (seg.stress == null) seg.stress = 0;
    if (seg.health == null) seg.health = 1;
    if (seg.mass == null) seg.mass = 0.58 + (seg.w || 0.5) * 0.42;
    myceliumSegments.push(seg);
    colonySegmentCountsDirty = true;
    if (myceliumSegments.length > MAX_MYCELIUM_SEGMENTS) {
      pruneMyceliumSegments(myceliumSegments.length - MAX_MYCELIUM_SEGMENTS);
    }
  }

  function segmentDensityAt(x, y, colonyId, radius) {
    var r2 = radius * radius;
    var count = 0;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 52));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      if (colonyId != null && seg.colonyId !== colonyId) continue;
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - x;
      var dy = my - y;
      if (dx * dx + dy * dy < r2) {
        count += 1;
      }
    }
    return count;
  }

  function antSegmentToughness(seg, density) {
    return (seg.mass || 0.65) *
      (0.58 + (seg.minerals || 0.55) * 0.52) *
      (0.5 + (seg.w || 0.5) * 0.5) *
      (1 + (density || 0) * 0.13);
  }

  function growLateralBranch(colony, ox, oy, mainAngle, depth) {
    var spread = (Math.random() < 0.5 ? 1 : -1) * (0.42 + Math.random() * 0.38);
    var angle = mainAngle + spread;
    var len = 2.4 + Math.random() * 2.8;
    var nx = ox + Math.cos(angle) * len;
    var ny = oy + Math.sin(angle) * len;
    var dx = nx - colony.anchorX;
    var dy = ny - colony.anchorY;
    if (Math.sqrt(dx * dx + dy * dy) > colony.maxReach * 0.92) {
      return false;
    }
    var density = segmentDensityAt((ox + nx) * 0.5, (oy + ny) * 0.5, colony.id, 13);
    if (density > 7) return false;
    pushMyceliumSegment({
      x1: ox,
      y1: oy,
      x2: nx,
      y2: ny,
      w: 0.5 + Math.random() * 0.28 + density * 0.02,
      a: 0.32 + Math.random() * 0.18,
      health: 1 + Math.min(0.35, density * 0.05),
      mass: 0.72 + Math.random() * 0.18 + density * 0.04,
      minerals: Math.min(1, (colony.minerals || 0.75) * (0.88 + Math.random() * 0.08)),
      rot: 0,
      colonyId: colony.id,
      lateral: true
    });
    if (Math.random() < 0.22 && colony.tips.length < 64) {
      colony.tips.push({
        x: nx,
        y: ny,
        angle: angle + (Math.random() - 0.5) * 0.28,
        depth: depth + 1
      });
    }
    return true;
  }

  function tryMyceliumWeave(colony, tip) {
    if (!colony || !tip || tip.anchor) return;
    var end = nearestSegmentEndpoint(tip.x, tip.y, colony.id, 26);
    if (!end || end.dist < 4 || end.dist > 26) return;
    var dx = end.x - tip.x;
    var dy = end.y - tip.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;
    var density = segmentDensityAt((tip.x + end.x) * 0.5, (tip.y + end.y) * 0.5, colony.id, 12);
    pushMyceliumSegment({
      x1: tip.x,
      y1: tip.y,
      x2: end.x,
      y2: end.y,
      w: 0.56 + density * 0.06,
      a: 0.32 + Math.min(0.18, density * 0.03),
      health: 1.2 + Math.min(0.45, density * 0.07),
      mass: 0.92 + density * 0.08,
      minerals: Math.min(1, (colony.minerals || 0.8) * 0.92),
      rot: 0,
      colonyId: colony.id,
      weave: true
    });
    tip.x = end.x;
    tip.y = end.y;
    tip.angle = Math.atan2(dy, dx);
  }

  function nearestSegmentEndpoint(x, y, colonyId, radius) {
    var best = null;
    var bestD = radius * radius;
    var i;
    for (i = 0; i < myceliumSegments.length; i += 1) {
      var seg = myceliumSegments[i];
      if (colonyId != null && seg.colonyId !== colonyId) continue;
      var pts = [
        { x: seg.x2, y: seg.y2 },
        { x: seg.x1, y: seg.y1 }
      ];
      var p;
      for (p = 0; p < pts.length; p += 1) {
        var dx = pts[p].x - x;
        var dy = pts[p].y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = {
            x: pts[p].x,
            y: pts[p].y,
            dist: Math.sqrt(d2),
            angle: Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1)
          };
        }
      }
    }
    return best;
  }

  function snapTipToNetwork(tip, colony) {
    var end = nearestSegmentEndpoint(tip.x, tip.y, colony.id, 22);
    if (!end || end.dist < 1.5) return false;
    if (end.dist > 18) return false;
    pushMyceliumSegment({
      x1: tip.x,
      y1: tip.y,
      x2: end.x,
      y2: end.y,
      w: 0.46,
      a: 0.3,
      health: 1,
      mass: 0.72,
      minerals: colony.minerals || 0.75,
      rot: 0,
      colonyId: colony.id,
      bridge: true
    });
    tip.x = end.x;
    tip.y = end.y;
    return true;
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.001) {
      return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1) };
    }
    var t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var cx = x1 + t * dx;
    var cy = y1 + t * dy;
    return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
  }

  function nearestNetworkPoint(x, y, colonyId, radius) {
    var best = null;
    var bestD = radius * radius;
    var r2 = bestD;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 72));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      if (colonyId != null && seg.colonyId !== colonyId) continue;
      var near = closestPointOnSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      var d2 = near.dist * near.dist;
      if (d2 < bestD) {
        bestD = d2;
        best = { x: near.x, y: near.y, dist: near.dist, angle: Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) };
      }
    }
    if (colonyId != null) {
      var colony = colonyById(colonyId);
      if (colony) {
        var t;
        for (t = 0; t < colony.tips.length; t += 1) {
          var tip = colony.tips[t];
          var tdx = tip.x - x;
          var tdy = tip.y - y;
          var td2 = tdx * tdx + tdy * tdy;
          if (td2 < bestD) {
            bestD = td2;
            best = { x: tip.x, y: tip.y, dist: Math.sqrt(td2), angle: tip.angle };
          }
        }
      }
    }
    return best;
  }

  function seekMyceliumTarget(colony, tip) {
    var best = null;
    var bestScore = Infinity;
    var maxSeek = colony.maxReach * 1.15;

    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var other = myceliumColonies[c];
      if (other.id === colony.id) continue;
      var adx = other.anchorX - tip.x;
      var ady = other.anchorY - tip.y;
      var ad = Math.sqrt(adx * adx + ady * ady);
      if (ad < maxSeek) {
        var anchorScore = ad * 0.82;
        if (anchorScore < bestScore) {
          bestScore = anchorScore;
          best = {
            x: other.anchorX,
            y: other.anchorY,
            dist: ad,
            colonyId: other.id,
            kind: "anchor"
          };
        }
      }
      var t;
      for (t = 0; t < other.tips.length; t += 1) {
        var ot = other.tips[t];
        var tdx = ot.x - tip.x;
        var tdy = ot.y - tip.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy);
        if (td < maxSeek) {
          var tipScore = td * 0.72;
          if (tipScore < bestScore) {
            bestScore = tipScore;
            best = { x: ot.x, y: ot.y, dist: td, colonyId: other.id, kind: "tip" };
          }
        }
      }
    }

    var step = Math.max(1, Math.floor(myceliumSegments.length / 64));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      if (seg.colonyId === colony.id) continue;
      var endDx = seg.x2 - tip.x;
      var endDy = seg.y2 - tip.y;
      var endD = Math.sqrt(endDx * endDx + endDy * endDy);
      if (endD < maxSeek) {
        var endScore = endD * 0.68;
        if (endScore < bestScore) {
          bestScore = endScore;
          best = {
            x: seg.x2,
            y: seg.y2,
            dist: endD,
            colonyId: seg.colonyId,
            kind: "hypha"
          };
        }
      }
      var near = closestPointOnSegment(tip.x, tip.y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (near.dist < maxSeek) {
        var nearScore = near.dist * 0.9;
        if (nearScore < bestScore) {
          bestScore = nearScore;
          best = {
            x: near.x,
            y: near.y,
            dist: near.dist,
            colonyId: seg.colonyId,
            kind: "hypha"
          };
        }
      }
    }

    var r;
    for (r = 0; r < myceliumRings.length; r += 1) {
      var ring = myceliumRings[r];
      if (ring.colonyIds.indexOf(colony.id) !== -1) continue;
      var rdx = ring.x - tip.x;
      var rdy = ring.y - tip.y;
      var rd = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rd < maxSeek * 0.85) {
        var ringScore = rd * 0.75;
        if (ringScore < bestScore) {
          bestScore = ringScore;
          best = { x: ring.x, y: ring.y, dist: rd, colonyId: ring.colonyIds[0], kind: "ring" };
        }
      }
    }

    return best;
  }

  function initMyceliumColonies() {
    myceliumColonyId = 0;
    myceliumRingId = 0;
    myceliumPairs = {};
    myceliumFruits = [];
    myceliumSpores = [];
    myceliumRings = [];
    myceliumSegments = [];
    antCorpses = [];
    antEggs = [];
    antEggId = 0;
    if (!cosmology) computeCosmology(true);
    var corners = myceliumCornerSources();
    myceliumColonies = corners.map(function (corner) {
      return spawnMyceliumColony(corner);
    });
    var c;
    var primeSteps = cosmology.primingSteps;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      primeMyceliumColony(myceliumColonies[c], primeSteps);
      ensureColonyAnchorTip(myceliumColonies[c]);
      initColonyOrbital(myceliumColonies[c]);
    }
  }

  function nearestTargetForRing(ring) {
    var best = null;
    var bestD = Infinity;
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      if (ring.colonyIds.indexOf(colony.id) !== -1) continue;
      var dx = colony.anchorX - ring.x;
      var dy = colony.anchorY - ring.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = { x: colony.anchorX, y: colony.anchorY, kind: "colony", id: colony.id };
      }
    }
    var r;
    for (r = 0; r < myceliumRings.length; r += 1) {
      var other = myceliumRings[r];
      if (other.id === ring.id) continue;
      var rdx = other.x - ring.x;
      var rdy = other.y - ring.y;
      var rd = rdx * rdx + rdy * rdy;
      if (rd < bestD) {
        bestD = rd;
        best = { x: other.x, y: other.y, kind: "ring", id: other.id };
      }
    }
    return best;
  }

  function spawnMyceliumRing(x, y, colonyIdA, colonyIdB) {
    var baseR = 12 + Math.random() * 9;
    var ring = {
      id: myceliumRingId++,
      x: x,
      y: y,
      radius: 3,
      maxRadius: baseR,
      age: 0,
      vitality: 0.92 + Math.random() * 0.08,
      rot: 0,
      state: "growing",
      colonyIds: [colonyIdA, colonyIdB],
      fruited: false,
      membraneAngle: Math.random() * Math.PI * 2,
      mineralLevel: 0.45,
      scouts: []
    };
    var s;
    for (s = 0; s < 3; s += 1) {
      ring.scouts.push({
        angle: Math.random() * Math.PI * 2,
        len: 0,
        active: true
      });
    }
    myceliumRings.push(ring);
    return ring;
  }

  function tryMyceliumRingMeet(ring, otherX, otherY, otherKind, otherId) {
    var dx = otherX - ring.x;
    var dy = otherY - ring.y;
    if (dx * dx + dy * dy > (ring.radius + 30) * (ring.radius + 30)) return;
    if (otherKind === "colony") {
      if (ring.colonyIds.indexOf(otherId) !== -1) return;
      var key = myceliumPairKey(ring.colonyIds[0], otherId);
      if (!myceliumPairs[key]) {
        myceliumPairs[key] = true;
        ring.colonyIds.push(otherId);
      }
    }
  }

  function ringTargetRadius(ring) {
    return ring.maxRadius + ring.vitality * 9 + ring.colonyIds.length * 2.2;
  }

  function ringNutrition(ring) {
    var feed = ring.colonyIds.length * 0.09;
    var r2 = (ring.radius + 36) * (ring.radius + 36);
    var step = Math.max(1, Math.floor(myceliumSegments.length / 56));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - ring.x;
      var dy = my - ring.y;
      if (dx * dx + dy * dy < r2) feed += 0.018;
    }
    var c;
    for (c = 0; c < antCorpses.length; c += 1) {
      var corpse = antCorpses[c];
      var cdx = corpse.x - ring.x;
      var cdy = corpse.y - ring.y;
      if (cdx * cdx + cdy * cdy < r2 * 1.4) feed += 0.06 + corpse.colonize * 0.08;
    }
    return feed;
  }

  function growRingMembrane(ring) {
    if (ring.vitality < 0.28) return;
    var arc = 0.22 + Math.random() * 0.38;
    var r = ring.radius * (0.94 + Math.sin(ring.membraneAngle * 2.1) * 0.04);
    var a0 = ring.membraneAngle;
    var a1 = a0 + arc;
    pushMyceliumSegment({
      x1: ring.x + Math.cos(a0) * r,
      y1: ring.y + Math.sin(a0) * r,
      x2: ring.x + Math.cos(a1) * r,
      y2: ring.y + Math.sin(a1) * r,
      w: 0.42 + ring.vitality * 0.35,
      a: 0.22 + ring.vitality * 0.32,
      health: 0.65 + ring.vitality * 0.55,
      minerals: Math.min(1, (ring.mineralLevel || 0.5) * 0.9),
      rot: ring.rot * 0.35,
      ringId: ring.id
    });
    ring.membraneAngle += arc + 0.08;
  }

  function renewRingScouts(ring, dt) {
    if (ring.vitality < 0.14) return;
    var s;
    for (s = 0; s < ring.scouts.length; s += 1) {
      var scout = ring.scouts[s];
      if (scout.active) continue;
      if (Math.random() < dt * (0.7 + ring.vitality * 0.9)) {
        scout.active = true;
        scout.len = ring.radius * (0.12 + Math.random() * 0.18);
        scout.angle = Math.random() * Math.PI * 2;
      }
    }
    if (ring.vitality > 0.62 && ring.scouts.length < 4 && Math.random() < dt * 0.35) {
      ring.scouts.push({
        angle: Math.random() * Math.PI * 2,
        len: ring.radius * 0.1,
        active: true
      });
    }
  }

  function decayRingSegments(ringId) {
    var i = myceliumSegments.length - 1;
    while (i >= 0) {
      if (myceliumSegments[i].ringId === ringId) {
        myceliumSegments.splice(i, 1);
      }
      i -= 1;
    }
  }

  function growRingScout(ring, scout) {
    if (!scout.active || ring.vitality < 0.1) return;
    var target = nearestTargetForRing(ring);
    if (target) {
      var seek = Math.atan2(target.y - ring.y, target.x - ring.x);
      scout.angle += envAngleDiff(scout.angle, seek) * (0.32 + ring.vitality * 0.12);
      tryMyceliumRingMeet(ring, target.x, target.y, target.kind, target.id);
    } else {
      scout.angle += (Math.random() - 0.5) * 0.35;
    }
    var prevLen = scout.len;
    var growStep = (2.1 + Math.random() * 1.6) * (0.55 + ring.vitality * 0.65);
    scout.len = Math.min(scout.len + growStep, 130 + ring.vitality * 24);
    if (scout.len > prevLen + 0.5) {
      var sx = ring.x + Math.cos(scout.angle) * (ring.radius + prevLen);
      var sy = ring.y + Math.sin(scout.angle) * (ring.radius + prevLen);
      var ex = ring.x + Math.cos(scout.angle) * (ring.radius + scout.len);
      var ey = ring.y + Math.sin(scout.angle) * (ring.radius + scout.len);
      pushMyceliumSegment({
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        w: 0.5 + ring.vitality * 0.28,
        a: 0.34 + ring.vitality * 0.24,
        health: 0.7 + ring.vitality * 0.5,
        minerals: Math.min(1, (ring.mineralLevel || 0.45) * 0.85),
        rot: ring.rot * 0.25,
        ringId: ring.id
      });
    }
    if (scout.len >= 118) {
      if (ring.vitality > 0.38) {
        scout.len = ring.radius * (0.1 + Math.random() * 0.14);
        scout.angle += (Math.random() - 0.5) * 0.9;
      } else {
        scout.active = false;
      }
    }
  }

  function tryMyceliumMeet(colony, tip, foreign) {
    if (!foreign || foreign.colonyId === colony.id || foreign.dist > 52) return;
    var key = myceliumPairKey(colony.id, foreign.colonyId);
    if (myceliumPairs[key]) return;
    myceliumPairs[key] = true;
    var mx = (tip.x + foreign.x) * 0.5;
    var my = (tip.y + foreign.y) * 0.5;
    spawnMyceliumRing(mx, my, colony.id, foreign.colonyId);
  }

  function burstMyceliumSpores(x, y, count) {
    var i;
    for (i = 0; i < count; i += 1) {
      var a = Math.random() * Math.PI * 2;
      var sp = 8 + Math.random() * 28;
      myceliumSpores.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 6 - Math.random() * 10,
        life: 1,
        r: 0.35 + Math.random() * 0.55,
        w: a
      });
    }
  }

  function stepMyceliumRings(dt) {
    var pressure = envPressure();
    var i = myceliumRings.length - 1;
    while (i >= 0) {
      var ring = myceliumRings[i];
      ring.age += dt;
      var nutrition = ringNutrition(ring);
      ring.mineralLevel = Math.min(1, nutrition * 0.55);
      var targetR = ringTargetRadius(ring);

      ring.rot += dt * (
        0.005 +
        (ring.fruited ? 0.01 : 0.002) +
        pressure.antCrowd * 0.008 +
        Math.random() * 0.003
      );
      ring.rot -= dt * nutrition * 0.14;
      ring.rot = Math.max(0, Math.min(1, ring.rot));

      ring.vitality += dt * (
        nutrition * 0.2 -
        ring.rot * 0.16 -
        (ring.fruited ? 0.022 : 0.008) -
        pressure.myceliumMass * 0.012
      );
      ring.vitality = Math.max(0, Math.min(1, ring.vitality));

      if (ring.state === "dormant" && nutrition > 0.12) {
        ring.vitality += dt * nutrition * 0.1;
      }

      if (ring.vitality > 0.38 && ring.radius < targetR) {
        ring.radius += dt * (0.95 + ring.vitality * 1.5);
        ring.state = ring.radius < ring.maxRadius * 0.9 ? "growing" : "mature";
      } else if (ring.vitality < 0.14 || ring.rot > 0.72) {
        ring.state = "declining";
        ring.radius -= dt * (0.35 + ring.rot * 1.4 + (1 - ring.vitality) * 0.65);
      } else if (ring.vitality < 0.34) {
        ring.state = "dormant";
      } else if (ring.state !== "declining") {
        ring.state = ring.fruited ? "mature" : "growing";
        ring.radius += dt * ring.vitality * 0.28;
      }

      if (!ring.fruited && ring.radius >= ring.maxRadius * 0.9 && ring.vitality > 0.35) {
        ring.fruited = true;
        myceliumFruits.push({
          x: ring.x,
          y: ring.y,
          age: 0,
          cap: 2.4 + Math.random() * 2,
          stalk: 3 + Math.random() * 3.5
        });
        burstMyceliumSpores(ring.x, ring.y - 2, 8 + Math.floor(Math.random() * 8));
      }

      ring.membraneAngle += dt * (0.55 + ring.vitality * 0.9);
      if (ring.vitality > 0.32 && Math.random() < dt * (1.6 + ring.vitality * 1.4)) {
        growRingMembrane(ring);
      }

      renewRingScouts(ring, dt);

      if (ring.state === "declining" || ring.state === "dormant") {
        var ri = myceliumSegments.length - 1;
        var touched = 0;
        while (ri >= 0 && touched < 6) {
          var rseg = myceliumSegments[ri];
          if (rseg.ringId === ring.id) {
            if (rseg.health == null) rseg.health = 1;
            rseg.rot = Math.min(1, (rseg.rot || 0) + dt * 0.09);
            rseg.minerals = Math.max(0, (rseg.minerals || 0.5) - dt * 0.03);
            rseg.health -= dt * (0.14 + ring.rot * 0.22);
            touched += 1;
          }
          ri -= 1;
        }
      }

      if (ring.vitality < 0.1) {
        var s;
        for (s = 0; s < ring.scouts.length; s += 1) {
          ring.scouts[s].active = false;
        }
      }

      if ((ring.vitality <= 0 && ring.age > 8) || (ring.radius < 1.2 && ring.age > 14 && ring.vitality < 0.12)) {
        if (ring.vitality > 0) {
          burstMyceliumSpores(ring.x, ring.y, 2 + Math.floor(Math.random() * 3));
        }
        decayRingSegments(ring.id);
        myceliumRings.splice(i, 1);
      }
      i -= 1;
    }
  }

  function stepMyceliumColonySources(dt) {
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      if (colony.vitality == null) colony.vitality = 1;
      if (colony.minerals == null) colony.minerals = 0.9;
      var segN = colonySegmentCount(colony.id);
      var starved = segN < 16;
      colony.minerals = Math.min(1, colony.minerals + dt * (starved ? 0.17 : 0.1));
      colony.vitality = Math.min(1, colony.vitality + dt * (starved ? 0.04 : 0.025));
      var anchorTip = ensureColonyAnchorTip(colony);
      if (anchorTip.depth < 1) {
        anchorTip.x = colony.anchorX;
        anchorTip.y = colony.anchorY;
      }
      stepColonyOrbital(colony, dt);
      if (colony.antBond == null) colony.antBond = 0;
      if (colony.broodNeed == null) colony.broodNeed = 0;
      var broodPull = colony.broodNeed || 0;
      if (broodPull > 0.45) {
        colony.minerals = Math.min(1, colony.minerals + dt * 0.04 * broodPull);
        colony.vitality = Math.min(1, colony.vitality + dt * 0.018 * broodPull);
      }
      if (!colony.tips.length) {
        colony.tips.push({
          x: colony.anchorX,
          y: colony.anchorY,
          angle: colony.biasAngle + (Math.random() - 0.5) * 0.7,
          depth: 0,
          anchor: true
        });
      }
    }
  }

  function stepMyceliumSegments(dt) {
    var pressure = envPressure();
    var stride = Math.max(1, Math.floor(myceliumSegments.length / 100));
    var i;
    for (i = 0; i < myceliumSegments.length; i += stride) {
      var seg = myceliumSegments[i];
      if (seg.minerals == null) seg.minerals = 0.7;
      if (seg.rot == null) seg.rot = 0;
      if (seg.stress == null) seg.stress = 0;
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var mineralFeed = 0;
      var homeColony = seg.colonyId != null ? colonyById(seg.colonyId) : null;
      if (homeColony) {
        var hdx = mx - homeColony.anchorX;
        var hdy = my - homeColony.anchorY;
        var hd2 = hdx * hdx + hdy * hdy;
        var homeCore = homeColony.maxReach * homeColony.maxReach * 0.1;
        var homeTerritory = homeColony.maxReach * homeColony.maxReach * 0.48;
        if (hd2 < homeCore) {
          mineralFeed += 0.58 * (homeColony.minerals || 0.85);
          seg.rot = Math.max(0, seg.rot - dt * 0.024 * stride);
          seg.stress = Math.max(0, (seg.stress || 0) - dt * 0.026 * stride);
        } else if (hd2 < homeTerritory) {
          mineralFeed += 0.16 * (homeColony.minerals || 0.8);
          seg.rot = Math.max(0, seg.rot - dt * 0.01 * stride);
        }
      }
      var c;
      for (c = 0; c < myceliumColonies.length; c += 1) {
        var colony = myceliumColonies[c];
        if (homeColony && colony.id === homeColony.id) continue;
        var dx = mx - colony.anchorX;
        var dy = my - colony.anchorY;
        var ad2 = dx * dx + dy * dy;
        if (ad2 < 3600) {
          mineralFeed += 0.22 * (colony.minerals || 0.85);
          seg.rot = Math.max(0, seg.rot - dt * 0.012 * stride);
          seg.stress = Math.max(0, (seg.stress || 0) - dt * 0.014 * stride);
        }
        var reach2 = colony.maxReach * colony.maxReach * 0.14;
        if (ad2 < reach2) {
          mineralFeed += 0.03 * (colony.minerals || 0.8);
        }
      }
      var cp;
      for (cp = 0; cp < antCorpses.length; cp += 1) {
        var corpse = antCorpses[cp];
        var cdx = mx - corpse.x;
        var cdy = my - corpse.y;
        if (cdx * cdx + cdy * cdy < 900) {
          mineralFeed += 0.04 * corpse.colonize;
        }
      }
      seg.minerals = Math.min(1, seg.minerals + dt * mineralFeed * stride);
      seg.minerals = Math.max(0, seg.minerals - dt * 0.0025 * stride);
      var meshDensity = segmentDensityAt(mx, my, seg.colonyId, 14);
      var mass = seg.mass != null ? seg.mass : 0.65;
      if (meshDensity > 1 || seg.minerals > 0.4) {
        seg.mass = Math.min(2.1, mass + dt * (0.034 + meshDensity * 0.006 + seg.minerals * 0.012) * stride);
        seg.w = Math.min(1.85, (seg.w || 0.5) + dt * (0.012 + meshDensity * 0.002) * stride);
        if (seg.health != null && seg.health < 1.35) {
          seg.health = Math.min(1.5, seg.health + dt * 0.018 * stride);
        }
      }
      if (seg.minerals < 0.22) {
        seg.rot = Math.min(1, seg.rot + dt * (0.006 + pressure.antCrowd * 0.005) * stride);
        seg.stress = Math.min(1, seg.stress + dt * 0.015 * stride);
      } else {
        seg.rot = Math.max(0, seg.rot - dt * 0.005 * stride);
        seg.stress = Math.max(0, seg.stress - dt * 0.008 * stride);
      }
      if (seg.rot > 0.5) {
        if (seg.health == null) seg.health = 1;
        seg.health = Math.max(0, seg.health - dt * 0.04 * stride);
      }
      if (homeColony) {
        var dormantDx = mx - homeColony.anchorX;
        var dormantDy = my - homeColony.anchorY;
        var dormantR2 = homeColony.maxReach * homeColony.maxReach * 0.2;
        seg.dormant = dormantDx * dormantDx + dormantDy * dormantDy > dormantR2 &&
          seg.minerals < 0.14 && seg.rot > 0.42;
      } else {
        seg.dormant = seg.minerals < 0.14 && seg.rot > 0.42;
      }
    }
    if (Math.random() < dt * 1.2) {
      var j = myceliumSegments.length - 1;
      while (j >= 0) {
        var dead = myceliumSegments[j];
        if ((dead.health != null && dead.health <= 0 && (dead.mass || 0) < 0.55 &&
            (dead.rot || 0) > 0.35) ||
            ((dead.rot || 0) > 0.9 && (dead.minerals || 0) < 0.06 && (dead.mass || 0) < 0.4)) {
          myceliumSegments.splice(j, 1);
        }
        j -= 1;
      }
    }
  }

  function envPressure(force) {
    var now = performance.now();
    if (!force && envPressureCache && now - envPressureCacheAt < 14) {
      return envPressureCache;
    }
    var antN = typeof ants !== "undefined" ? ants.length : 0;
    var eggN = antEggs.length;
    var segN = myceliumSegments.length;
    var floorGap = Math.max(0, ANT_TARGET_FLOOR - antN);
    var flyN = typeof flies !== "undefined" ? flies.length : 0;
    var spiderN = typeof spiders !== "undefined" ? spiders.length : 0;
    var webN = typeof spiderWebThreads !== "undefined" ? spiderWebThreads.length : 0;
    var stuckFlies = 0;
    if (typeof flies !== "undefined") {
      var fi;
      for (fi = 0; fi < flies.length; fi += 1) {
        if (flies[fi].state === "stuck") stuckFlies += 1;
      }
    }
    envPressureCache = {
      antCrowd: antN / MAX_ANTS,
      antScarcity: Math.min(1, floorGap / ANT_TARGET_FLOOR),
      broodMass: eggN / MAX_EGGS,
      myceliumMass: Math.min(1, segN / 400),
      fungusPerAnt: segN / Math.max(1, antN * 44),
      belowFloor: floorGap,
      flyCrowd: flyN / Math.max(1, MAX_FLIES),
      webMass: Math.min(1, webN / Math.max(1, MAX_WEB_THREADS)),
      spiderPresence: spiderN / Math.max(1, MAX_SPIDERS),
      flyTrapped: stuckFlies / Math.max(1, flyN),
      recycleLoad: Math.min(1, (antCorpses.length / MAX_CORPSES) * 0.5 + stuckFlies * 0.12),
      signalResonance: ecoSignalField.resonance,
      faintLevel: ecoSignalField.faint,
      feedbackRing: ecoSignalField.ring
    };
    envPressureCacheAt = now;
    return envPressureCache;
  }

  function ecoPulse(amount) {
    if (amount > 0) ecoPulseBuf += amount;
  }

  function stepEcoFeedback(dt, now) {
    if (now != null && now - ecoFeedbackLast < 6) {
      return ecoSignalField;
    }
    if (now != null) ecoFeedbackLast = now;
    var cos = cosmology || computeCosmology(false);
    var pressure = {
      broodMass: antEggs.length / Math.max(1, MAX_EGGS),
      recycleLoad: Math.min(1, antCorpses.length / Math.max(1, MAX_CORPSES)),
      flyTrapped: 0,
      webMass: typeof spiderWebThreads !== "undefined"
        ? Math.min(1, spiderWebThreads.length / Math.max(1, MAX_WEB_THREADS))
        : 0,
      myceliumMass: Math.min(1, myceliumSegments.length / 400),
      antScarcity: Math.min(1, Math.max(0, ANT_TARGET_FLOOR - (typeof ants !== "undefined" ? ants.length : 0)) / ANT_TARGET_FLOOR)
    };
    if (typeof flies !== "undefined") {
      var fi;
      var stuck = 0;
      for (fi = 0; fi < flies.length; fi += 1) {
        if (flies[fi].state === "stuck") stuck += 1;
      }
      pressure.flyTrapped = stuck / Math.max(1, flies.length);
      pressure.recycleLoad = Math.min(1, pressure.recycleLoad * 0.5 + stuck * 0.12);
    }
    var gain = cos.feedbackGain || 0.65;
    var q = cos.signalQ || 0.7;
    var rings = cos.feedbackRings || 3;
    var astro = cos.astro || frameAstro || astroChrono();
    var whisper = (
      Math.sin(astro.moon * 6.2831853 + astro.hour * 0.171) * 0.5 +
      Math.cos(astro.zodiac * 0.523 + astro.doy * 0.041) * 0.5
    ) * (cos.faintBias || 0.35) * dt;
    var carrier = (
      pressure.broodMass * 0.045 +
      pressure.recycleLoad * 0.065 +
      pressure.flyTrapped * 0.085 +
      pressure.webMass * 0.035 +
      (1 - pressure.myceliumMass) * 0.025 +
      pressure.antScarcity * 0.04
    ) * dt * gain;
    var faintIn = ecoPulseBuf + whisper + carrier;
    ecoPulseBuf = 0;
    ecoSignalField.faint += faintIn;
    ecoSignalField.faint *= 1 - dt * (0.055 + (1 - q) * 0.038);
    var ringAcc = ecoSignalField.faint * gain;
    var r;
    for (r = 0; r < rings; r += 1) {
      ringAcc *= q * (0.7 + gain * 0.3);
      ecoSignalField.faint += ringAcc * dt * 0.13;
    }
    ecoSignalField.resonance += dt * (ecoSignalField.faint * gain * 0.36 + ringAcc * 0.11);
    ecoSignalField.resonance *= 1 - dt * (0.032 + (1 - gain) * 0.048);
    ecoSignalField.ring = ringAcc;
    var amp = ecoSignalField.resonance * gain;
    myceliumCrawlStimulus += dt * amp * (0.62 + (cos.spreadDrive || 0.7) * 0.38);
    if (typeof plasmaFbDelay !== "undefined") {
      plasmaFbDelay.impulse += amp * dt * 0.038;
      plasmaFbDelay.surge += faintIn * 0.07;
    }
    var ci;
    for (ci = 0; ci < myceliumColonies.length; ci += 1) {
      var col = myceliumColonies[ci];
      col.vitality = Math.min(1, (col.vitality || 1) + dt * amp * 0.009);
      col.signal = (col.signal || 0) * 0.965 + faintIn * 0.38 + ringAcc * 0.04;
    }
    return ecoSignalField;
  }

  function ecoFeedbackDrive() {
    var cos = cosmology || computeCosmology(false);
    return 1 + ecoSignalField.resonance * (cos.feedbackGain || 0.65) * 0.55;
  }

  function ecoDepositAt(x, y, amount, colonyId) {
    if (amount <= 0) return;
    ecoPulse(amount * 0.35);
    var r2 = 22 * 22;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 40));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      if (colonyId != null && seg.colonyId !== colonyId) continue;
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - x;
      var dy = my - y;
      if (dx * dx + dy * dy < r2) {
        seg.minerals = Math.min(1, (seg.minerals || 0.5) + amount);
        seg.rot = Math.max(0, (seg.rot || 0) - amount * 0.35);
      }
    }
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      if (colonyId != null && colony.id !== colonyId) continue;
      var cdx = colony.anchorX - x;
      var cdy = colony.anchorY - y;
      if (cdx * cdx + cdy * cdy < r2 * 1.6) {
        colony.minerals = Math.min(1, (colony.minerals || 0.8) + amount * 0.4);
      }
    }
  }

  function stepEcosystem(dt) {
    var pressure = envPressure();
    var i;

    for (i = flies.length - 1; i >= 0; i -= 1) {
      var fly = flies[i];
      if (fly.state !== "stuck" && fly.state !== "dying") continue;
      if (fly.state === "dying") {
        fly.life -= dt;
        ecoDepositAt(fly.x, fly.y, dt * 0.14, fly.rideColonyId);
        if (fly.life <= 0) {
          flies.splice(i, 1);
        }
        continue;
      }
      var si;
      for (si = 0; si < spiders.length; si += 1) {
        var spider = spiders[si];
        var sdx = spider.x - fly.x;
        var sdy = spider.y - fly.y;
        if (sdx * sdx + sdy * sdy < 196) {
          fly.state = "dying";
          fly.life = 0.55;
          spider.silk = Math.min(spider.silkMax, spider.silk + 0.12);
          ecoPulse(0.14);
          pushWebThread({
            x1: fly.x,
            y1: fly.y,
            x2: spider.x,
            y2: spider.y,
            w: 0.24,
            a: 0.22,
            silk: 0.5,
            spiderId: spider.id,
            recycle: true
          });
          break;
        }
      }
    }

    if (typeof ants !== "undefined") {
      var ai;
      var fi2;
      var ant;
      for (fi2 = flies.length - 1; fi2 >= 0; fi2 -= 1) {
        var prey = flies[fi2];
        if (prey.state !== "stuck" && prey.state !== "dying") continue;
        for (ai = 0; ai < ants.length; ai += 1) {
          ant = ants[ai];
          var pdx = prey.x - ant.x;
          var pdy = prey.y - ant.y;
          if (pdx * pdx + pdy * pdy > 256) continue;
          ant.energy = Math.min(1, ant.energy + dt * 0.22);
          ant.fungusLoad = Math.min(ANT_FUNGUS_LOAD_MAX, ant.fungusLoad + dt * 0.08);
          prey.state = "dying";
          prey.life = 0.35;
          ecoDepositAt(prey.x, prey.y, 0.06, ant.homeColonyId);
          ecoPulse(0.09);
          break;
        }
      }
      for (ai = 0; ai < ants.length; ai += 1) {
        ant = ants[ai];
        if (ant.speed <= 3 || (ant.antId + ecoFrameTick) % 4 !== 0) continue;
        if (Math.random() >= dt * 0.32) continue;
        var segStep = Math.max(1, Math.floor(myceliumSegments.length / 36));
        var si2;
        for (si2 = 0; si2 < myceliumSegments.length; si2 += segStep) {
          var seg = myceliumSegments[si2];
          var mx = (seg.x1 + seg.x2) * 0.5;
          var my = (seg.y1 + seg.y2) * 0.5;
          var adx = mx - ant.x;
          var ady = my - ant.y;
          if (adx * adx + ady * ady < 196 && (seg.rot || 0) > 0.2) {
            seg.rot = Math.max(0, seg.rot - dt * 0.05);
            seg.minerals = Math.min(1, (seg.minerals || 0.5) + dt * 0.02);
            ecoPulse(dt * 0.04);
          }
        }
      }
    }

    var sp;
    var flyStep = Math.max(1, Math.floor(flies.length / 24));
    for (sp = myceliumSpores.length - 1; sp >= 0; sp -= 1) {
      var spore = myceliumSpores[sp];
      var fl;
      for (fl = 0; fl < flies.length; fl += flyStep) {
        var flyer = flies[fl];
        if (flyer.state === "stuck" || flyer.state === "dying") continue;
        var fdx = spore.x - flyer.x;
        var fdy = spore.y - flyer.y;
        if (fdx * fdx + fdy * fdy < 100) {
          flyer.energy = Math.min(1, (flyer.energy || 0.5) + dt * 0.35);
          flyer.sporeCargo = Math.min(1, (flyer.sporeCargo || 0) + dt * 0.45);
          ecoPulse(dt * 0.08);
          spore.life -= dt * 0.5;
          if (spore.life <= 0) myceliumSpores.splice(sp, 1);
          break;
        }
      }
    }

    if (pressure.webMass > 0.08 && pressure.flyTrapped > 0.1) {
      ecoPulse(dt * pressure.flyTrapped * 0.12);
    }
    if (pressure.recycleLoad > 0.2) {
      var ci;
      for (ci = 0; ci < myceliumColonies.length; ci += 1) {
        var col = myceliumColonies[ci];
        col.vitality = Math.min(1, (col.vitality || 1) + dt * pressure.recycleLoad * 0.012);
      }
    }
  }

  function countColonyAnts(colonyId) {
    if (colonyId == null || typeof ants === "undefined") return 0;
    var n = 0;
    var i;
    for (i = 0; i < ants.length; i += 1) {
      if (ants[i].homeColonyId === colonyId) {
        n += 1;
      }
    }
    return n;
  }

  function countColonyEggs(colonyId) {
    if (colonyId == null) return 0;
    var n = 0;
    var i;
    for (i = 0; i < antEggs.length; i += 1) {
      if (antEggs[i].colonyId === colonyId) {
        n += 1;
      }
    }
    return n;
  }

  function antFedForBrood(ant) {
    var satiation = ant.fungusLoad + ant.toxicity * 0.45;
    return satiation > 0.18 && ant.energy > 0.32;
  }

  function tendNearbyEggs(ant, now, dt) {
    if (!ant.homeColonyId) return false;
    var tended = false;
    var i;
    for (i = 0; i < antEggs.length; i += 1) {
      var egg = antEggs[i];
      if (egg.colonyId !== ant.homeColonyId) continue;
      var dx = egg.x - ant.x;
      var dy = egg.y - ant.y;
      if (dx * dx + dy * dy > 324) continue;
      egg.care = Math.min(1, egg.care + dt * (0.32 + ant.energy * 0.18));
      egg.warmth = Math.min(1, egg.warmth + dt * 0.1);
      tended = true;
      if (ant.speed > 2.5) {
        ant.speedTarget = Math.min(ant.speedTarget, 1.5);
      }
      if (Math.random() < dt * 0.55) {
        ant.pauseUntil = Math.max(ant.pauseUntil, now + 350 + Math.random() * 750);
      }
    }
    return tended;
  }

  function colonyBroodNeed(colony, pressure) {
    if (!pressure) pressure = envPressure();
    var antN = countColonyAnts(colony.id);
    var eggN = countColonyEggs(colony.id);
    var crowdEase = Math.max(0, 1 - pressure.antCrowd * 0.82);
    var fungusEase = Math.min(1.2, 0.62 + pressure.fungusPerAnt * 0.75);
    var floorBoost = 1 + (pressure.belowFloor || 0) * 0.22;
    return (Math.max(0, 2.8 - antN * 0.34) + eggN * 0.06) * crowdEase * fungusEase * floorBoost;
  }

  function antHomeBroodNeed(ant) {
    if (ant.homeColonyId == null) return 0;
    var home = colonyById(ant.homeColonyId);
    return home ? (home.broodNeed || 0) : 0;
  }

  function antReproBalance() {
    var pressure = envPressure();
    var crowdDamp = Math.max(0.08, 1 - pressure.antCrowd * 0.88);
    var fungusDamp = Math.min(1.2, 0.45 + pressure.fungusPerAnt * 0.95);
    var scarcityBoost = 1 + pressure.antScarcity * 0.85;
    return Math.max(0.18, crowdDamp * fungusDamp * scarcityBoost);
  }

  function updateColonyAntBond(pressure) {
    if (!pressure) pressure = envPressure();
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      var antN = countColonyAnts(colony.id);
      var eggN = countColonyEggs(colony.id);
      colony.antBond = Math.min(1, antN * 0.24 + eggN * 0.2);
      colony.broodNeed = colonyBroodNeed(colony, pressure);
    }
  }

  function nearestBroodForColony(colony) {
    var best = null;
    var bestD = Infinity;
    var i;
    for (i = 0; i < antEggs.length; i += 1) {
      var egg = antEggs[i];
      if (egg.colonyId !== colony.id) continue;
      var edx = egg.x - colony.anchorX;
      var edy = egg.y - colony.anchorY;
      var ed = edx * edx + edy * edy;
      if (ed < bestD) {
        bestD = ed;
        best = { x: egg.x, y: egg.y, kind: "egg" };
      }
    }
    if (typeof ants !== "undefined") {
      for (i = 0; i < ants.length; i += 1) {
        var ant = ants[i];
        if (ant.homeColonyId !== colony.id) continue;
        var adx = ant.x - colony.anchorX;
        var ady = ant.y - colony.anchorY;
        var ad = adx * adx + ady * ady;
        if (ad < bestD) {
          bestD = ad;
          best = { x: ant.x, y: ant.y, kind: "ant" };
        }
      }
    }
    return best;
  }

  function spawnAntEgg(ant, now) {
    if (antEggs.length >= MAX_EGGS) {
      antEggs.shift();
    }
    var home = ant.homeColonyId != null ? colonyById(ant.homeColonyId) : nearestColonyTo(ant.x, ant.y);
    antEggs.push({
      id: antEggId++,
      x: ant.x + (Math.random() - 0.5) * 5,
      y: ant.y + (Math.random() - 0.5) * 5,
      colonyId: home ? home.id : null,
      laidAt: now,
      hatchAt: now + EGG_HATCH_MIN + Math.random() * (EGG_HATCH_MAX - EGG_HATCH_MIN),
      warmth: 0.32 + Math.random() * 0.16,
      care: 0.38 + Math.random() * 0.2,
      tilt: Math.random() * Math.PI
    });
    ant.energy = Math.max(0.14, ant.energy - 0.14);
    ant.eggCooldown = now + 5000 + Math.random() * 12000;
    ecoPulse(0.18);
    if (home) {
      home.minerals = Math.min(1, (home.minerals || 0.8) + 0.04);
      myceliumCrawlStimulus += 1.1;
    }
  }

  function stepAntEggs(dt, now) {
    var pressure = envPressure();
    var scarcity = pressure.antScarcity;
    var floorBoost = 1 + (pressure.belowFloor || 0) * 0.35;
    var i = antEggs.length - 1;
    while (i >= 0) {
      var egg = antEggs[i];
      var warm = 0;
      var colony = egg.colonyId != null ? colonyById(egg.colonyId) : null;
      if (colony) {
        warm += (colony.minerals || 0.7) * 0.09;
        warm += (colony.antBond || 0) * 0.08;
        warm += (colony.broodNeed || 0) * 0.05;
        warm += (colony.signal || 0) * 0.09 * ecoFeedbackDrive();
        warm += pressure.signalResonance * 0.07;
        var cdx = egg.x - colony.anchorX;
        var cdy = egg.y - colony.anchorY;
        if (cdx * cdx + cdy * cdy < 8100) {
          warm += 0.22;
        }
      }
      var step = Math.max(1, Math.floor(myceliumSegments.length / 40));
      var si;
      for (si = 0; si < myceliumSegments.length; si += step) {
        var seg = myceliumSegments[si];
        var mx = (seg.x1 + seg.x2) * 0.5;
        var my = (seg.y1 + seg.y2) * 0.5;
        var sdx = mx - egg.x;
        var sdy = my - egg.y;
        if (sdx * sdx + sdy * sdy < 900) {
          warm += 0.042 * (seg.minerals || 0.6);
        }
      }
      if (typeof ants !== "undefined") {
        var ai;
        var tended = 0;
        for (ai = 0; ai < ants.length && tended < 5; ai += 1) {
          var tendAnt = ants[ai];
          var tdx = tendAnt.x - egg.x;
          var tdy = tendAnt.y - egg.y;
          if (tdx * tdx + tdy * tdy < 400) {
            tended += 1;
            egg.care = Math.min(1, egg.care + dt * (0.22 + tendAnt.speed * 0.002));
            warm += dt * 0.12;
          }
        }
      }
      egg.warmth = Math.min(1, egg.warmth + dt * warm * (1 + scarcity * 0.65) * floorBoost);
      egg.care = Math.min(1, egg.care + dt * (warm * 0.42 + scarcity * 0.06) * floorBoost);
      var ready = egg.warmth > 0.22 && egg.care > 0.2;
      var late = now >= egg.hatchAt + (pressure.belowFloor > 0 ? 2500 : 6000);
      if ((now >= egg.hatchAt && ready) || (late && egg.warmth > 0.14)) {
        if (typeof ants !== "undefined" && ants.length < MAX_ANTS) {
          ants.push(spawnAnt(now, {
            juvenile: true,
            x: egg.x + (Math.random() - 0.5) * 6,
            y: egg.y + (Math.random() - 0.5) * 6,
            angle: Math.random() * Math.PI * 2,
            homeColonyId: egg.colonyId
          }));
        }
        if (colony) {
          colony.vitality = Math.min(1, (colony.vitality || 1) + 0.06);
          myceliumCrawlStimulus += 1.6;
          ecoPulse(0.24);
        }
        antEggs.splice(i, 1);
      } else if (egg.warmth < 0.07 && now - egg.laidAt > 22000) {
        antEggs.splice(i, 1);
      } else if (now - egg.laidAt > 95000) {
        antEggs.splice(i, 1);
      }
      i -= 1;
    }
  }

  function drawAntEgg(ctx, egg) {
    var colony = egg.colonyId != null ? colonyById(egg.colonyId) : null;
    var minerals = colony && colony.minerals != null ? colony.minerals : 0.75;
    var pulse = 0.88 + Math.sin(myceliumLast * 0.0028 + egg.id) * 0.12;
    var grow = Math.min(1, egg.warmth * 0.65 + egg.care * 0.35);
    var len = (2.2 + grow * 1.4) * pulse;
    var tilt = egg.tilt;
    var cx = egg.x;
    var cy = egg.y;
    ctx.strokeStyle = myceliumInk(egg.care, 0, minerals, 0.14 + egg.warmth * 0.24);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(tilt) * len, cy - Math.sin(tilt) * len);
    ctx.lineTo(cx + Math.cos(tilt) * len, cy + Math.sin(tilt) * len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(tilt + 0.9) * len * 0.55, cy - Math.sin(tilt + 0.9) * len * 0.55);
    ctx.lineTo(cx + Math.cos(tilt + 0.9) * len * 0.55, cy + Math.sin(tilt + 0.9) * len * 0.55);
    ctx.stroke();
    ctx.strokeStyle = "rgba(248, 242, 228, " + (0.28 + egg.care * 0.22) + ")";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy - len * 0.35);
    ctx.lineTo(cx - len * 0.28, cy + len * 0.22);
    ctx.lineTo(cx + len * 0.28, cy + len * 0.22);
    ctx.closePath();
    ctx.stroke();
  }

  function spawnAntCorpse(ant) {
    if (antCorpses.length >= MAX_CORPSES) {
      antCorpses.shift();
    }
    antCorpses.push({
      x: ant.x,
      y: ant.y,
      age: 0,
      mass: ant.mass * ant.scale,
      colonize: 0,
      tips: [{
        x: ant.x,
        y: ant.y,
        angle: (ant.headAngle != null ? ant.headAngle : ant.angle) + Math.PI + (Math.random() - 0.5) * 0.8,
        depth: 0
      }],
      maxReach: 38 + ant.mass * 28,
      hyphae: 0
    });
  }

  function growCorpseTip(corpse, tip) {
    var len = 1.8 + Math.random() * 3.2;
    var angle = tip.angle + (Math.random() - 0.5) * 0.72;
    var nx = tip.x + Math.cos(angle) * len;
    var ny = tip.y + Math.sin(angle) * len;
    var dx = nx - corpse.x;
    var dy = ny - corpse.y;
    if (Math.sqrt(dx * dx + dy * dy) > corpse.maxReach) {
      return false;
    }
    pushMyceliumSegment({
      x1: tip.x,
      y1: tip.y,
      x2: nx,
      y2: ny,
      w: 0.45 + Math.random() * 0.3,
      a: 0.32 + corpse.colonize * 0.28,
      health: 1.15,
      minerals: 0.5 + corpse.colonize * 0.35,
      rot: Math.max(0, 0.15 - corpse.colonize * 0.1),
      substrate: true
    });
    tip.x = nx;
    tip.y = ny;
    tip.angle = angle;
    tip.depth += 1;
    corpse.hyphae += 1;
    if (tip.depth < 22 && Math.random() < 0.16) {
      corpse.tips.push({
        x: nx,
        y: ny,
        angle: angle + (Math.random() - 0.5) * 1.2,
        depth: tip.depth
      });
    }
    return true;
  }

  function stepAntCorpses(dt) {
    var pressure = envPressure();
    var colonizeRate = dt * (0.035 + (1 - pressure.myceliumMass) * 0.055);
    var i = antCorpses.length - 1;
    while (i >= 0) {
      var corpse = antCorpses[i];
      corpse.age += dt;
      corpse.colonize = Math.min(1, corpse.colonize + colonizeRate);
      if (corpse.colonize > 0.18 && corpse.tips.length && Math.random() < dt * 2.2) {
        var tipIndex = Math.floor(Math.random() * corpse.tips.length);
        if (!growCorpseTip(corpse, corpse.tips[tipIndex])) {
          corpse.tips.splice(tipIndex, 1);
        }
      }
      if (corpse.colonize > 0.88 && corpse.age > 4 && !corpse.spored) {
        corpse.spored = true;
        burstMyceliumSpores(corpse.x, corpse.y - 1, 3 + Math.floor(Math.random() * 4));
      }
      if (corpse.age > 110 || (corpse.colonize > 0.95 && corpse.hyphae > 10)) {
        antCorpses.splice(i, 1);
      }
      i -= 1;
    }
  }

  function drawAntCorpse(ctx, corpse) {
    var fade = Math.max(0.12, 1 - corpse.age / 95);
    var minerals = 0.35 + corpse.colonize * 0.45;
    var rot = Math.max(0, 0.2 - corpse.colonize * 0.15);
    var alpha = 0.07 * fade + corpse.colonize * 0.14;
    ctx.strokeStyle = myceliumInk(0.5 + corpse.colonize * 0.4, rot, minerals, alpha + 0.12);
    ctx.lineWidth = 0.45;
    var rays = 5;
    var r;
    for (r = 0; r < rays; r += 1) {
      var ang = (r / rays) * Math.PI * 2 + corpse.age * 0.08;
      var len = (2.2 + corpse.colonize * 5.5 + corpse.mass * 1.8) * fade;
      ctx.beginPath();
      ctx.moveTo(corpse.x, corpse.y);
      ctx.lineTo(corpse.x + Math.cos(ang) * len, corpse.y + Math.sin(ang) * len);
      ctx.stroke();
    }
    if (corpse.colonize > 0.12) {
      ctx.strokeStyle = myceliumInk(corpse.colonize, rot * 0.5, minerals, corpse.colonize * 0.38);
      ctx.lineWidth = 0.4;
      var h;
      for (h = 0; h < 3; h += 1) {
        var ha = corpse.age * 0.12 + h * 1.1;
        var hy = 2 + corpse.colonize * 6;
        ctx.beginPath();
        ctx.moveTo(corpse.x, corpse.y);
        ctx.lineTo(corpse.x + Math.cos(ha) * hy, corpse.y + Math.sin(ha) * hy);
        ctx.stroke();
      }
    }
  }

  function antFungusCapacity(ant) {
    return Math.max(0, ANT_FUNGUS_LOAD_MAX - ant.fungusLoad - ant.toxicity * 0.45);
  }

  function antApplyFungusIntake(ant, amount, potency) {
    if (amount <= 0) return 0;
    var load = amount * potency;
    var room = antFungusCapacity(ant);
    var taken = Math.min(load, room);
    var excess = load - taken;
    ant.fungusLoad += taken;
    if (excess > 0) {
      ant.toxicity = Math.min(1, ant.toxicity + excess * 0.62);
    }
    return taken;
  }

  function stepAntIntoxication(ant, dt, now) {
    ant.fungusLoad = Math.max(0, ant.fungusLoad - dt * ANT_FUNGUS_LOAD_DECAY);
    var toxinDecay = ant.fungusLoad < 0.18 ? ANT_TOXIN_DECAY * 1.35 : ANT_TOXIN_DECAY;
    ant.toxicity = Math.max(0, ant.toxicity - dt * toxinDecay);
    if (ant.toxicity > 0.72 && Math.random() < dt * 0.12) {
      ant.intoxUntil = Math.max(ant.intoxUntil, now + 700 + Math.random() * 1400);
    }
  }

  function antFeedFromMycelium(ant, dt, now, pressure) {
    if (now < ant.intoxUntil) return;
    var capacity = antFungusCapacity(ant);
    if (capacity < 0.025) return;
    if (!pressure) pressure = envPressure();

    var eatR = 11;
    var eatR2 = eatR * eatR;
    var bite = dt * (0.26 + Math.max(ant.speed, 6) * 0.0042);
    if (ant.speed < 1.2) bite = dt * 0.48;
    bite *= Math.min(1, capacity / 0.28);
    bite *= 1 - ant.toxicity * 0.45;
    bite *= 1 + pressure.antScarcity * 0.55;

    var fed = 0;
    var segN = myceliumSegments.length;
    if (!segN) return;
    var step = Math.max(1, Math.floor(segN / 40));
    var checks = 0;
    var maxChecks = 34;
    var i = segN - 1;
    while (i >= 0 && checks < maxChecks) {
      if ((segN - 1 - i) % step !== 0) {
        i -= 1;
        continue;
      }
      checks += 1;
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - ant.x;
      var dy = my - ant.y;
      if (dx * dx + dy * dy >= eatR2) {
        i -= 1;
        continue;
      }
      var segBite = bite * (seg.substrate ? 0.7 : 1);
      if (colonyNearAnchor(mx, my, 34)) {
        segBite *= 0.28 + pressure.antScarcity * 0.42;
      }
      if (seg.colonyId != null) {
        var home = colonyById(seg.colonyId);
        if (home) {
          var hdx = mx - home.anchorX;
          var hdy = my - home.anchorY;
          var homeR2 = home.maxReach * home.maxReach * 0.16;
          if (hdx * hdx + hdy * hdy < homeR2) {
            var homeSegN = colonySegmentCount(home.id);
            var homeProtect = pressure.antScarcity * 0.5;
            if (homeSegN < 42) {
              segBite *= 0.22 + homeProtect;
            } else if (homeSegN < 78) {
              segBite *= 0.52 + homeProtect * 0.35;
            }
          }
        }
      }
      if (seg.health == null) seg.health = 1;
      var meshDensity = segmentDensityAt(mx, my, seg.colonyId, 12);
      var toughness = antSegmentToughness(seg, meshDensity);
      var wound = segBite / (0.48 + toughness);
      seg.health -= wound;
      fed += wound * (seg.substrate ? 0.55 : 1) * Math.min(1, 1.05 / (0.6 + toughness * 0.22));
      if (seg.health <= 0) {
        if ((seg.mass || 0) > 0.85 && (seg.minerals || 0) > 0.18) {
          seg.health = 0.1 + Math.random() * 0.12;
          seg.mass = Math.max(0.32, seg.mass - 0.055);
          seg.minerals = Math.max(0, seg.minerals - 0.025);
          seg.rot = Math.min(1, (seg.rot || 0) + 0.035);
        } else {
          seg.health = 0;
          seg.rot = Math.min(1, (seg.rot || 0) + 0.12);
          seg.minerals = Math.max(0, (seg.minerals || 0.4) - 0.06);
          if (seg.mass != null) seg.mass = Math.max(0.2, seg.mass - 0.12);
        }
      }
      if (antFungusCapacity(ant) < 0.02) break;
      i -= 1;
    }
    if (fed > 0) {
      var taken = antApplyFungusIntake(ant, fed, 1);
      ant.energy = Math.min(1, ant.energy + taken * 0.84);
      ant.fed += taken;
    }
    var f;
    for (f = myceliumFruits.length - 1; f >= 0; f -= 1) {
      if (antFungusCapacity(ant) < 0.02) break;
      var fruit = myceliumFruits[f];
      var fdx = ant.x - fruit.x;
      var fdy = ant.y - (fruit.y - fruit.stalk);
      if (fdx * fdx + fdy * fdy < eatR2 * 1.4) {
        var fruitBite = dt * 0.4 * Math.min(1, antFungusCapacity(ant) / 0.2);
        var fruitTaken = antApplyFungusIntake(ant, fruitBite, 1.85);
        ant.energy = Math.min(1, ant.energy + fruitTaken * 0.76);
        ant.fed += fruitTaken;
        fruit.cap = Math.max(0, fruit.cap - dt * 1.3 * Math.min(1, capacity / 0.28));
        if (fruit.cap < 0.35) {
          myceliumFruits.splice(f, 1);
        }
      }
    }
    var r;
    for (r = 0; r < myceliumRings.length; r += 1) {
      if (antFungusCapacity(ant) < 0.02) break;
      var ring = myceliumRings[r];
      var rdx = ring.x - ant.x;
      var rdy = ring.y - ant.y;
      var dist = Math.sqrt(rdx * rdx + rdy * rdy);
      if (dist < ring.radius + 10) {
        var graze = dt * (0.35 + Math.max(ant.speed, 4) * 0.02);
        ring.radius = Math.max(1.8, ring.radius - graze);
        ring.vitality = Math.max(0, ring.vitality - graze * 0.06);
        ring.rot = Math.min(1, ring.rot + dt * 0.028);
        if (dist < ring.radius + 4) {
          var ringTaken = antApplyFungusIntake(ant, dt * 0.07, 1.35);
          ant.energy = Math.min(1, ant.energy + ringTaken * 0.42);
        }
      }
    }
  }

  function antConsumeMycelium(ant, dt, now, pressure) {
    antFeedFromMycelium(ant, dt, now, pressure);
  }

  function growMyceliumTip(colony, tip) {
    if (!tip.anchor) {
      snapTipToNetwork(tip, colony);
    }
    var tipDensity = segmentDensityAt(tip.x, tip.y, colony.id, 12);
    var target = seekMyceliumTarget(colony, tip);
    var segN = colonySegmentCount(colony.id);
    var expandHome = segN < 34;
    var len = 3.4 + Math.random() * 4.6;
    var seek = 0;
    var foreign = target && target.colonyId !== colony.id ? target : null;
    if (target) {
      seek = envAngleDiff(tip.angle, Math.atan2(target.y - tip.y, target.x - tip.x));
      if (foreign) {
        tryMyceliumMeet(colony, tip, foreign);
      }
    }
    var seekWeight = foreign
      ? (foreign.dist < colony.maxReach * 1.05 ? 0.5 : 0.32)
      : (target ? 0.14 : 0.08);
    if (expandHome && foreign) {
      seekWeight = Math.max(seekWeight, 0.38);
    }
    var biasWeight = expandHome ? 0.16 : 0.05;
    var wander = 0.24 + Math.min(0.12, tip.depth * 0.004);
    var orbit = colony.orbital
      ? envAngleDiff(tip.angle, colony.biasAngle + Math.sin(colony.orbital.phase) * 0.85) * 0.14
      : 0;
    var spread = spreadSeekAngle(tip.x, tip.y, tip.angle) * spreadSeekWeight() * (tipDensity > 1 ? 0.28 : 0.1);
    var turn =
      (Math.random() - 0.5) * wander +
      envAngleDiff(tip.angle, colony.biasAngle) * biasWeight +
      seek * seekWeight +
      orbit +
      spread;
    var brood = nearestBroodForColony(colony);
    var broodNeed = colony.broodNeed != null ? colony.broodNeed : 0;
    if (brood && broodNeed > 0.28) {
      var broodSeek = envAngleDiff(tip.angle, Math.atan2(brood.y - tip.y, brood.x - tip.x));
      turn += broodSeek * Math.min(0.38, broodNeed * 0.2);
    }
    var angle = tip.angle + turn;
    var nx = tip.x + Math.cos(angle) * len;
    var ny = tip.y + Math.sin(angle) * len;
    var dx = nx - colony.anchorX;
    var dy = ny - colony.anchorY;
    if (Math.sqrt(dx * dx + dy * dy) > colony.maxReach) {
      if (tip.anchor) {
        tip.angle = colony.biasAngle + (Math.random() - 0.5) * 0.75;
        return true;
      }
      return false;
    }
    var midX = (tip.x + nx) * 0.5;
    var midY = (tip.y + ny) * 0.5;
    var density = segmentDensityAt(midX, midY, colony.id, 14);
    var segW = Math.max(0.44, 1.18 - tip.depth * 0.022 + density * 0.035);
    pushMyceliumSegment({
      x1: tip.x,
      y1: tip.y,
      x2: nx,
      y2: ny,
      w: segW,
      a: 0.38 + Math.random() * 0.22,
      health: 1 + Math.min(0.5, density * 0.08),
      mass: 0.62 + segW * 0.34 + density * 0.1,
      minerals: Math.min(1, (colony.minerals || 0.75) * (0.9 + Math.random() * 0.08)),
      rot: 0,
      colonyId: colony.id
    });
    if (density > 1 && density < 6 && Math.random() < 0.1) {
      growLateralBranch(colony, tip.x, tip.y, angle, tip.depth);
    }
    colony.minerals = Math.max(0.35, (colony.minerals || 0.8) - (tip.anchor ? 0.003 : 0.006));
    tip.x = nx;
    tip.y = ny;
    tip.angle = angle;
    tip.depth += 1;
    markCoverage(nx, ny, 0.035);
    if (tryMyceliumPortal(tip, colony)) {
      markCoverage(tip.x, tip.y, 0.05);
    }
    if (tip.depth < 38 && Math.random() < 0.22) {
      colony.tips.push({
        x: nx,
        y: ny,
        angle: angle + (Math.random() - 0.5) * 0.45,
        depth: tip.depth
      });
    }
    if (tipDensity > 1 && Math.random() < 0.18) {
      tryMyceliumWeave(colony, tip);
    }
    return true;
  }

  function pickRingGrowth() {
    if (!myceliumRings.length) return null;
    var liveRings = myceliumRings.filter(function (ring) {
      return ring.vitality > 0.2 && ring.state !== "declining";
    });
    var pool = liveRings.length ? liveRings : myceliumRings;
    var ring = pool[Math.floor(Math.random() * pool.length)];
    var activeScouts = ring.scouts.filter(function (scout) {
      return scout.active;
    });
    var scout = activeScouts.length
      ? activeScouts[Math.floor(Math.random() * activeScouts.length)]
      : ring.scouts[Math.floor(Math.random() * ring.scouts.length)];
    if (!scout) return null;
    return { ring: ring, scout: scout };
  }

  function growColonyBranch(colony) {
    if (!colony || !colony.tips.length) return;
    var branchTips = [];
    var t;
    for (t = 0; t < colony.tips.length; t += 1) {
      if (!colony.tips[t].anchor) {
        branchTips.push(t);
      }
    }
    var tipIndex = branchTips.length
      ? branchTips[Math.floor(Math.random() * branchTips.length)]
      : 0;
    var tip = colony.tips[tipIndex];
    if (!growMyceliumTip(colony, tip)) {
      if (!tip.anchor) {
        colony.tips.splice(tipIndex, 1);
      } else {
        tip.angle = colony.biasAngle + (Math.random() - 0.5) * 1.1;
      }
    }
    ensureColonyAnchorTip(colony);
  }

  function growMyceliumColonies() {
    if (!myceliumColonies.length && !myceliumRings.length) return;

    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      ensureColonyAnchorTip(colony);
      if ((colony.minerals || 0) > 0.08) {
        var anchor = ensureColonyAnchorTip(colony);
        var adx = anchor.x - colony.anchorX;
        var ady = anchor.y - colony.anchorY;
        if (adx * adx + ady * ady < 1600 || colonySegmentCount(colony.id) < 8) {
          if (!growMyceliumTip(colony, anchor)) {
            anchor.angle = colony.biasAngle + (Math.random() - 0.5) * 1.1;
          }
        }
      }
    }

    if (myceliumColonies.length) {
      myceliumGrowTurn += 1;
      growColonyBranch(myceliumColonies[myceliumGrowTurn % myceliumColonies.length]);
      if (coverageFraction() < 0.78 || Math.random() < 0.62) {
        growColonyBranch(myceliumColonies[(myceliumGrowTurn + 1) % myceliumColonies.length]);
      }
    }

    if (myceliumRings.length && Math.random() < 0.07) {
      var ringPick = pickRingGrowth();
      if (ringPick) {
        growRingScout(ringPick.ring, ringPick.scout);
      }
    }

    var scarcity = envPressure().antScarcity;
    if (scarcity > 0.28 && myceliumColonies.length) {
      var neediest = myceliumColonies[0];
      var needScore = neediest.broodNeed || 0;
      var nc;
      for (nc = 1; nc < myceliumColonies.length; nc += 1) {
        var cand = myceliumColonies[nc];
        var cs = cand.broodNeed || 0;
        if (cs > needScore) {
          neediest = cand;
          needScore = cs;
        }
      }
      if (needScore > 0.35) {
        growColonyBranch(neediest);
      }
    }
  }

  function stepMyceliumSpores(dt) {
    var i = myceliumSpores.length - 1;
    while (i >= 0) {
      var sp = myceliumSpores[i];
      sp.life -= dt * (0.22 + Math.random() * 0.08);
      sp.vx *= 1 - dt * 0.35;
      sp.vy *= 1 - dt * 0.2;
      sp.vy -= dt * 3.5;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      if (sp.life <= 0) {
        myceliumSpores.splice(i, 1);
      }
      i -= 1;
    }
    if (myceliumSpores.length > 90) {
      myceliumSpores.splice(0, myceliumSpores.length - 90);
    }
  }

  function stepMyceliumFruits(dt) {
    var i;
    for (i = 0; i < myceliumFruits.length; i += 1) {
      var fruit = myceliumFruits[i];
      fruit.age += dt;
      if (fruit.age > 2.4 && fruit.age < 2.55) {
        burstMyceliumSpores(fruit.x, fruit.y - fruit.stalk, 4);
      }
    }
  }

  function drawMyceliumFruit(ctx, fruit) {
    var grow = Math.min(1, fruit.age * 0.35);
    var rot = Math.max(0, (fruit.age - 3.2) * 0.12);
    var minerals = Math.max(0.2, 1 - rot * 0.5);
    var sh = fruit.stalk * grow;
    var cap = fruit.cap * grow;
    var topY = fruit.y - sh;
    ctx.strokeStyle = myceliumInk(1 - rot * 0.3, rot * 0.4, minerals, 0.55);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(fruit.x, fruit.y);
    ctx.lineTo(fruit.x, topY);
    ctx.stroke();
    ctx.strokeStyle = myceliumInk(1 - rot * 0.25, rot * 0.55, minerals, 0.42 + grow * 0.28);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(fruit.x - cap * 0.7, topY - cap * 0.2);
    ctx.lineTo(fruit.x, topY - cap * 0.75);
    ctx.lineTo(fruit.x + cap * 0.7, topY - cap * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fruit.x - cap * 0.45, topY);
    ctx.lineTo(fruit.x + cap * 0.45, topY);
    ctx.stroke();
  }

  function drawMyceliumSource(ctx, colony) {
    if (!colony.orbital) initColonyOrbital(colony);
    var orbital = colony.orbital;
    var pulse = 0.85 + Math.sin(myceliumLast * 0.0012 + colony.id) * 0.15;
    var vitality = colony.vitality != null ? colony.vitality : 1;
    var minerals = colony.minerals != null ? colony.minerals : 1;
    var hasTips = colony.tips && colony.tips.length > 0;
    var active = hasTips && minerals > 0.25;
    var rot = active ? 0 : 0.14;
    var proj = project5D(colony.anchorX, colony.anchorY, colony.z, colony.w, colony.tPhase);
    var ax = proj.x;
    var ay = proj.y;
    var i;

    drawSpiralReel(
      ctx, ax, ay, orbital.orbitR * pulse, orbital.turns,
      orbital.phase, vitality, minerals, (0.14 + (active ? 0.08 : 0)) * vitality * proj.alpha
    );
    drawSpiralReel(
      ctx, ax, ay, orbital.orbitR * 0.62 * pulse, orbital.turns * 1.35,
      orbital.phase + 1.2, vitality, minerals, (0.1 + (active ? 0.06 : 0)) * vitality * proj.alpha
    );

    var traces = orbital.traces;
    if (traces.length > 2) {
      ctx.strokeStyle = myceliumInk(vitality, rot * 0.5, minerals, 0.08 * vitality);
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      for (i = 0; i < traces.length; i += 1) {
        var tr = traces[i];
        var tproj = project5D(tr.x, tr.y, colony.z, colony.w, tr.phase);
        if (i === 0) ctx.moveTo(tproj.x, tproj.y);
        else ctx.lineTo(tproj.x, tproj.y);
      }
      ctx.stroke();
    }

    if (active) {
      var stem = nearestSegmentEndpoint(colony.anchorX, colony.anchorY, colony.id, 140);
      if (stem) {
        ctx.strokeStyle = myceliumInk(vitality, 0, minerals, 0.2 * vitality);
        ctx.lineWidth = 0.42;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(stem.x, stem.y);
        ctx.stroke();
      }
      var t;
      for (t = 0; t < colony.tips.length && t < 4; t += 1) {
        var tip = colony.tips[t];
        if (tip.anchor) continue;
        ctx.strokeStyle = myceliumInk(vitality, 0, minerals, 0.12 * vitality);
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(colony.anchorX, colony.anchorY);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }
    }
  }

  function drawMyceliumRing(ctx, ring) {
    var pulse = 0.9 + Math.sin(myceliumLast * 0.002 + ring.id) * (0.06 + ring.vitality * 0.08);
    var minerals = ring.mineralLevel != null ? ring.mineralLevel : 0.5;
    var ringAlpha = Math.min(0.68, (0.2 + ring.age * 0.025) * ring.vitality);
    var dormant = ring.state === "dormant";
    var rotFade = 1 - ring.rot * 0.45;
    var vitalityDraw = ring.vitality * (dormant ? 0.72 : 1);
    var turns = ring.state === "declining" ? 1.4 : 2.2 + ring.colonyIds.length * 0.25;
    drawSpiralReel(
      ctx, ring.x, ring.y, ring.radius * pulse, turns,
      ring.membraneAngle + space5Phase * 0.4, vitalityDraw, minerals, ringAlpha * rotFade
    );
    drawSpiralReel(
      ctx, ring.x, ring.y, ring.radius * pulse * 0.55, turns * 1.3,
      ring.membraneAngle + 1.4 + space5Phase * 0.3, vitalityDraw, minerals * 0.85,
      ringAlpha * rotFade * 0.42
    );
    var s;
    for (s = 0; s < ring.scouts.length; s += 1) {
      var scout = ring.scouts[s];
      if (!scout.active) continue;
      var innerR = ring.radius * 0.65;
      var outerR = ring.radius + 6 + scout.len * 0.04;
      ctx.strokeStyle = myceliumInk(ring.vitality, ring.rot * 0.5, minerals, 0.22 + ring.vitality * 0.22);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(
        ring.x + Math.cos(scout.angle) * innerR,
        ring.y + Math.sin(scout.angle) * innerR
      );
      ctx.lineTo(
        ring.x + Math.cos(scout.angle) * outerR,
        ring.y + Math.sin(scout.angle) * outerR
      );
      ctx.stroke();
    }
  }

  function drawMycelium() {
    if (!myceliumCtx) return;
    myceliumCtx.clearRect(0, 0, myceliumW, myceliumH);
    myceliumCtx.lineCap = "round";
    myceliumCtx.lineJoin = "round";
    var i;
    for (i = 0; i < myceliumColonies.length; i += 1) {
      drawMyceliumSource(myceliumCtx, myceliumColonies[i]);
    }
    var segN = myceliumSegments.length;
    var drawStep = segN > 480 ? 3 : (segN > 320 ? 2 : 1);
    for (i = 0; i < segN; i += drawStep) {
      var seg = myceliumSegments[i];
      var health = seg.health != null ? Math.max(0, seg.health) : 1;
      var minerals = seg.minerals != null ? seg.minerals : 0.75;
      var rot = seg.rot != null ? seg.rot : 0;
      var vitality = health * (seg.dormant ? 0.45 : 1);
      var mass = seg.mass != null ? seg.mass : 0.65;
      var alpha = seg.a * vitality * (0.55 + minerals * 0.45) * (0.82 + mass * 0.12);
      if (alpha < 0.035) continue;
      var colony = seg.colonyId != null ? colonyById(seg.colonyId) : null;
      myceliumCtx.strokeStyle = ecoColonyInk(colony, vitality, rot, minerals, alpha);
      myceliumCtx.lineWidth = seg.w * (0.45 + health * 0.4) * (0.7 + minerals * 0.3) * (0.68 + mass * 0.42);
      myceliumCtx.beginPath();
      myceliumCtx.moveTo(seg.x1, seg.y1);
      myceliumCtx.lineTo(seg.x2, seg.y2);
      myceliumCtx.stroke();
    }
    for (i = 0; i < myceliumRings.length; i += 1) {
      drawMyceliumRing(myceliumCtx, myceliumRings[i]);
    }
    for (i = 0; i < antCorpses.length; i += 1) {
      drawAntCorpse(myceliumCtx, antCorpses[i]);
    }
    for (i = 0; i < antEggs.length; i += 1) {
      drawAntEgg(myceliumCtx, antEggs[i]);
    }
    for (i = 0; i < myceliumFruits.length; i += 1) {
      drawMyceliumFruit(myceliumCtx, myceliumFruits[i]);
    }
    for (i = 0; i < myceliumSpores.length; i += 1) {
      var sp = myceliumSpores[i];
      var spA = sp.life * 0.55;
      var spLen = sp.r * 2.2;
      var spAng = sp.w != null ? sp.w : space5Phase + i;
      myceliumCtx.strokeStyle = "rgba(250, 246, 240, " + spA + ")";
      myceliumCtx.lineWidth = 0.35;
      myceliumCtx.beginPath();
      myceliumCtx.moveTo(sp.x, sp.y);
      myceliumCtx.lineTo(
        sp.x + Math.cos(spAng) * spLen,
        sp.y + Math.sin(spAng) * spLen * 0.7
      );
      myceliumCtx.stroke();
    }
    drawScreenHoles(myceliumCtx);
  }

  function stepMycelium(now) {
    var dt = Math.min(0.05, (now - myceliumLast) / 1000);
    myceliumLast = now;
    myceliumGrowAccum += dt;
    space5Phase += dt * 0.85;
    var ci;
    for (ci = 0; ci < coverageCells.length; ci += 1) {
      coverageCells[ci] = Math.max(0, coverageCells[ci] - dt * 0.004);
    }
    var pressure = envPressure();
    stepEcoFeedback(dt, now);
    var feedback = ecoFeedbackDrive();
    var crawlDrive = Math.min(2.8, myceliumCrawlStimulus);
    var ci;
    for (ci = 0; ci < myceliumColonies.length; ci += 1) {
      ecoMutateStep(myceliumColonies[ci], dt, pressure, ecoFrameTick);
    }
    myceliumCrawlStimulus = Math.max(0, myceliumCrawlStimulus - dt * (0.32 + crawlDrive * 0.18));
    var growInterval = 0.088 * (1 + pressure.antCrowd * 0.32 + pressure.myceliumMass * 0.12);
    growInterval /= Math.max(0.72, feedback);
    growInterval *= Math.max(0.42, 1 - crawlDrive * 0.22);
    growInterval *= Math.max(0.62, 1 - pressure.antScarcity * 0.16);
    growInterval *= Math.max(0.62, 1 + (pressure.antCrowd - 0.62) * 0.3);
    growInterval *= Math.max(0.72, 1 - (1 - coverageFraction()) * (0.18 + (cosmology ? cosmology.spreadDrive * 0.08 : 0.1)));
    growInterval = Math.max(0.024, growInterval);
    myceliumGrowAccum += dt * crawlDrive * 0.48;
    var growSteps = 0;
    while (myceliumGrowAccum >= growInterval && growSteps < 3) {
      myceliumGrowAccum -= growInterval;
      growMyceliumColonies();
      growSteps += 1;
    }
    if (myceliumGrowAccum > growInterval * 2.5) {
      myceliumGrowAccum = growInterval * 2.5;
    }
    if (crawlDrive > 0.42 && myceliumColonies.length && Math.random() < dt * crawlDrive * 1.15) {
      growColonyBranch(myceliumColonies[myceliumGrowTurn % myceliumColonies.length]);
      myceliumCrawlStimulus = Math.max(0, myceliumCrawlStimulus - 0.55);
    }
    stepMyceliumSpores(dt);
    stepMyceliumFruits(dt);
    stepMyceliumColonySources(dt);
    updateColonyAntBond(pressure);
    stepAntEggs(dt, now);
    stepMyceliumSegments(dt);
    stepMyceliumRings(dt);
    stepAntCorpses(dt);
    maybeRebuildColonySegmentCounts();
    drawMycelium();
  }

  function myceliumLoop(now) {
    if (!tabHidden && !reduced) {
      stepMycelium(now);
    }
    myceliumRaf = window.requestAnimationFrame(myceliumLoop);
  }

  function startMycelium() {
    if (!myceliumCanvas || reduced) return;
    myceliumCtx = myceliumCanvas.getContext("2d");
    resizeMycelium();
    if (!frameAstro) frameAstro = astroChrono();
    computeCosmology(!cosmology);
    initMyceliumColonies();
    rebuildColonySegmentCounts();
    drawMycelium();
    myceliumLast = performance.now();
    myceliumGrowAccum = 0;
    myceliumGrowTurn = 0;
    myceliumCrawlStimulus = 0;
    ecoPulseBuf = 0;
    ecoSignalField = { faint: 0, resonance: 0, ring: 0 };
    ecoFeedbackLast = 0;
    if (myceliumRaf) window.cancelAnimationFrame(myceliumRaf);
    myceliumRaf = window.requestAnimationFrame(myceliumLoop);
  }

  function stopMycelium() {
    if (myceliumRaf) {
      window.cancelAnimationFrame(myceliumRaf);
      myceliumRaf = null;
    }
  }

  function onEnvironmentResize() {
    resizeMycelium();
    computeCosmology(false);
    initMyceliumColonies();
    rebuildColonySegmentCounts();
    drawMycelium();
    resizeSpiders();
    resizeAnts();
    if (spiderCanvas && !reduced) startSpiders();
    if (antCanvas && !reduced) startAnts();
  }

  var spiderCanvas = document.getElementById("spider-field");
  var spiderCtx = null;
  var spiders = [];
  var spiderWebThreads = [];
  var spiderIdCounter = 0;
  var spiderRaf = null;
  var spiderLast = 0;
  var spiderW = 0;
  var spiderH = 0;
  var MAX_SPIDERS = 5;
  var SPIDER_INITIAL_COUNT = 2;
  var MAX_WEB_THREADS = 280;
  var flies = [];
  var flyIdCounter = 0;
  var MAX_FLIES = 12;
  var FLY_INITIAL_COUNT = 5;
  var SPIDER_GRAVITY = 112;

  function threadScanStep(threadN) {
    if (threadN <= 64) return 1;
    if (threadN <= 140) return 2;
    return Math.max(2, Math.floor(threadN / 48));
  }

  function spiderWeaveDrive(pressure) {
    var cos = cosmology || computeCosmology(false);
    var u = cosmoUnitFrom(cos.astro, 25.6);
    var base = 0.26 + u * 0.34 + pressure.webMass * 0.24 - pressure.myceliumMass * 0.05;
    return base + ecoSignalField.resonance * (cos.feedbackGain || 0.65) * 0.22;
  }

  function spiderNearestThread(spider, maxDist) {
    maxDist = maxDist != null ? maxDist : 42;
    var best = null;
    var step = threadScanStep(spiderWebThreads.length);
    var start = spider.id % step;
    var w;
    if (spider.hangThread) {
      var nearHang = closestPointOnSegment(
        spider.x, spider.y,
        spider.hangThread.x1, spider.hangThread.y1,
        spider.hangThread.x2, spider.hangThread.y2
      );
      if (nearHang.dist < maxDist) {
        best = {
          thread: spider.hangThread,
          t: nearHang.t != null ? nearHang.t : 0,
          dist: nearHang.dist,
          x: nearHang.x,
          y: nearHang.y
        };
      }
    }
    for (w = start; w < spiderWebThreads.length; w += step) {
      var thread = spiderWebThreads[w];
      var near = closestPointOnSegment(spider.x, spider.y, thread.x1, thread.y1, thread.x2, thread.y2);
      if (near.dist < maxDist && (!best || near.dist < best.dist)) {
        best = {
          thread: thread,
          t: near.t != null ? near.t : 0,
          dist: near.dist,
          x: near.x,
          y: near.y
        };
      }
    }
    return best;
  }

  function spiderNearestThreadAt(x, y, skipThread, maxDist) {
    maxDist = maxDist != null ? maxDist : 32;
    var best = null;
    var step = threadScanStep(spiderWebThreads.length);
    var w;
    for (w = 0; w < spiderWebThreads.length; w += step) {
      var thread = spiderWebThreads[w];
      if (thread === skipThread) continue;
      var near = closestPointOnSegment(x, y, thread.x1, thread.y1, thread.x2, thread.y2);
      if (near.dist < maxDist && (!best || near.dist < best.dist)) {
        best = {
          thread: thread,
          t: near.t != null ? near.t : 0,
          dist: near.dist,
          x: near.x,
          y: near.y
        };
      }
    }
    return best;
  }

  function spiderEnsureOnThread(spider) {
    if (spider.hangThread) {
      var wi;
      for (wi = 0; wi < spiderWebThreads.length; wi += 1) {
        if (spiderWebThreads[wi] === spider.hangThread) {
          return true;
        }
      }
      spider.hangThread = null;
      spider.hangT = null;
    }
    var hit = spiderNearestThread(spider, 48);
    if (!hit) return false;
    spider.hangThread = hit.thread;
    spider.hangT = hit.t;
    spider.x = hit.x;
    spider.y = hit.y;
    spider.locomotion = "hang";
    spider.vy = 0;
    return true;
  }

  function spiderSeedAnchorWeb(spider) {
    var topY = 12 + cosmoJitter(spider.id * 3.1, Math.min(48, spiderH * 0.12));
    var sag = Math.max(4, (spider.y - topY) * 0.09);
    var thread = {
      x1: spider.x,
      y1: topY,
      x2: spider.x,
      y2: spider.y,
      sag: sag,
      w: 0.3,
      a: 0.36,
      silk: 0.72,
      spiderId: spider.id,
      mycelium: true,
      age: 0
    };
    pushWebThread(thread);
    spider.hangThread = thread;
    spider.hangT = 1;
    spider.x = thread.x2;
    spider.y = thread.y2;
    spider.locomotion = "hang";
    spider.state = "crawl";
    spider.vy = 0;
  }

  function spiderInitOnNet(spider) {
    if (spiderEnsureOnThread(spider)) {
      spider.state = "crawl";
      return;
    }
    spiderSeedAnchorWeb(spider);
  }

  function spiderPointOnThread(thread, t) {
    var x = thread.x1 + (thread.x2 - thread.x1) * t;
    var y = thread.y1 + (thread.y2 - thread.y1) * t;
    var sag = (thread.sag || 0) * Math.sin(t * Math.PI);
    return { x: x, y: y + sag };
  }

  function spiderDist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  function spiderQueueTravel(spider, x, y, opts) {
    opts = opts || {};
    spider.travelTo = {
      x: x,
      y: y,
      climb: !!opts.climb,
      arrive: opts.arrive != null ? opts.arrive : 8
    };
  }

  function spiderStepTravel(spider, dt) {
    if (!spider.travelTo) return null;
    var dest = spider.travelTo;
    var dx = dest.x - spider.x;
    var dy = dest.y - spider.y;
    var dist = Math.hypot(dx, dy);
    if (dist <= dest.arrive) {
      spider.x = dest.x;
      spider.y = dest.y;
      if (spider.vx != null) spider.vx = 0;
      if (spider.vy != null) spider.vy = 0;
      spider.travelTo = null;
      spider.locomotion = "ground";
      return dest;
    }
    var crawl = dest.climb ? 14 + spider.speed * 0.35 : 20 + spider.speed * 0.45;
    var step = Math.min(dist, crawl * dt);
    spider.x += (dx / dist) * step;
    spider.y += (dy / dist) * step;
    spider.angle = Math.atan2(dy, dx) + Math.PI * 0.5;
    spider.locomotion = dest.climb ? "climb" : "crawl";
    spider.speed = step / Math.max(dt, 0.001);
    return null;
  }

  function resizeSpiders() {
    if (!spiderCanvas) return;
    spiderW = window.innerWidth;
    spiderH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    spiderCanvas.width = Math.floor(spiderW * dpr);
    spiderCanvas.height = Math.floor(spiderH * dpr);
    spiderCanvas.style.width = spiderW + "px";
    spiderCanvas.style.height = spiderH + "px";
    if (spiderCtx) {
      spiderCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function pushWebThread(thread) {
    if (thread.w == null) thread.w = 0.28;
    if (thread.a == null) thread.a = 0.34;
    if (thread.silk == null) thread.silk = 0.7;
    if (thread.age == null) thread.age = 0;
    spiderWebThreads.push(thread);
    if (spiderWebThreads.length > MAX_WEB_THREADS) {
      spiderWebThreads.splice(0, spiderWebThreads.length - MAX_WEB_THREADS);
    }
  }

  function spawnSpider(now, opts) {
    opts = opts || {};
    var ang = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
    var spider = {
      id: (spiderIdCounter += 1),
      x: opts.x != null ? opts.x : spiderW * 0.5,
      y: opts.y != null ? opts.y : spiderH * 0.5,
      angle: ang,
      speed: 6 + Math.random() * 10,
      speedTarget: 14 + Math.random() * 22,
      phase: Math.random() * 10,
      legPhase: Math.random() * 10,
      silk: 0.32 + Math.random() * 0.28,
      silkMax: 0.95 + Math.random() * 0.35,
      state: opts.state || "crawl",
      locomotion: "hang",
      webAnchor: null,
      weavePhase: null,
      weaveTask: null,
      hangThread: null,
      hangT: null,
      crawlDir: Math.random() < 0.5 ? 1 : -1,
      crawlTarget: null,
      webSpokes: 5 + Math.floor(Math.random() * 4),
      webSpokeIdx: 0,
      weaveTurn: 0,
      ringSeg: 0,
      homeColonyId: opts.homeColonyId != null ? opts.homeColonyId : null,
      alpha: 0.55 + Math.random() * 0.3,
      scale: 1.38 + Math.random() * 0.42,
      vx: 0,
      vy: 0,
      travelTo: null,
      weaveQueuedLine: null
    };
    ecoEnsureGenome(spider, spider.id);
    spiderInitOnNet(spider);
    if (opts.randomBehavior !== false) {
      spiderPickBehavior(spider);
    }
    return spider;
  }

  function spiderPickBehavior(spider) {
    var pressure = envPressure();
    var weaveDrive = spiderWeaveDrive(pressure);
    if (spiderWebThreads.length < 3 || pressure.webMass < weaveDrive * 0.55) {
      spider.state = "weave";
      spider.webAnchor = { x: spider.x, y: spider.y };
      spider.weavePhase = null;
    } else if (spider.silk >= spider.silkMax * (0.68 - weaveDrive * 0.1)) {
      spider.state = "weave";
      spider.webAnchor = { x: spider.x, y: spider.y };
      spider.weavePhase = null;
    } else if (spider.silk < spider.silkMax * 0.38) {
      spider.state = "crawl";
      var food = spiderNearestMycelium(spider);
      if (food) spider.crawlTarget = { x: food.x, y: food.y };
    } else {
      spider.state = "crawl";
      spider.crawlTarget = null;
    }
  }

  function spiderRandomSpawnState(spider) {
    spiderPickBehavior(spider);
  }

  function flyRandomSpawnState(fly) {
    var roll = Math.random();
    if (roll < 0.14) {
      fly.state = "rest";
      fly.speed = 0;
      fly.speedTarget = 0;
    } else if (roll < 0.28) {
      fly.speedTarget = 68 + Math.random() * 48;
    } else {
      fly.state = "cruise";
    }
  }

  function spiderNearestMycelium(spider) {
    var best = null;
    var bestD = Infinity;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 48));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - spider.x;
      var dy = my - spider.y;
      var d = dx * dx + dy * dy;
      var score = d / (0.4 + (seg.minerals || 0.5) * (seg.mass || 0.6));
      if (score < bestD) {
        bestD = score;
        best = { x: mx, y: my, seg: seg, dist: Math.sqrt(d) };
      }
    }
    return best;
  }

  function spiderHarvestMycelium(spider, dt) {
    var near = spiderNearestMycelium(spider);
    if (!near || near.dist > 30) return null;
    var seg = near.seg;
    var pull = dt * (0.28 + spider.speed * 0.004) * (seg.minerals || 0.5) * (seg.mass || 0.65);
    if (pull <= 0) return near;
    var taken = Math.min(pull, (seg.minerals || 0.3) * 0.42);
    seg.minerals = Math.max(0.08, (seg.minerals || 0.5) - taken * 0.55);
    seg.mass = Math.max(0.25, (seg.mass || 0.6) - taken * 0.12);
    spider.silk = Math.min(spider.silkMax, spider.silk + taken * 1.15);
    return near;
  }

  function spiderFindAttachPoint(spider) {
    var topY = 10 + Math.random() * Math.min(52, spiderH * 0.14);
    var best = { x: spider.x + (Math.random() - 0.5) * 40, y: topY, kind: "ceiling" };
    var near = spiderNearestMycelium(spider);
    if (near && near.y < spider.y + 8 && near.dist < 140) {
      best = { x: near.x, y: near.y, kind: "mycelium" };
    }
    var w;
    for (w = 0; w < spiderWebThreads.length; w += 1) {
      var th = spiderWebThreads[w];
      var mx = (th.x1 + th.x2) * 0.5;
      var my = (th.y1 + th.y2) * 0.5;
      if (my < spider.y + 6) {
        var d = (mx - spider.x) * (mx - spider.x) + (my - spider.y) * (my - spider.y);
        if (d < 120 * 120) {
          best = { x: mx, y: my, kind: "web" };
        }
      }
    }
    return best;
  }

  function spiderBeginPayout(spider, tx, ty, strength) {
    var len = Math.hypot(tx - spider.x, ty - spider.y);
    if (len < 2.5) return false;
    var cost = (strength || 0.5) * 0.055;
    if (spider.silk < cost) return false;
    spider.weaveTask = {
      ax: spider.x,
      ay: spider.y,
      tx: tx,
      ty: ty,
      ex: spider.x,
      ey: spider.y,
      strength: strength || 0.55,
      progress: 0,
      sag: 0,
      threadRef: null
    };
    spider.hangFrom = { x: spider.x, y: spider.y };
    spider.locomotion = "hang";
    spider.vy = 0;
    return true;
  }

  function spiderStepPayout(spider, dt) {
    var task = spider.weaveTask;
    if (!task) return true;
    var len = Math.hypot(task.tx - task.ax, task.ty - task.ay);
    if (len < 2) {
      spider.weaveTask = null;
      spider.locomotion = "ground";
      return true;
    }
    var payRate = 14 + spider.speed * 0.65;
    task.progress = Math.min(1, task.progress + (payRate * dt) / len);
    task.ex = task.ax + (task.tx - task.ax) * task.progress;
    task.ey = task.ay + (task.ty - task.ay) * task.progress;
    task.sag = Math.sin(task.progress * Math.PI) * len * 0.13 * (0.55 + task.strength * 0.45);
    var mdx = task.ex - spider.x;
    var mdy = task.ey - spider.y;
    var md = Math.hypot(mdx, mdy);
    var follow = payRate * dt * 0.95;
    if (md > 0.4) {
      var step = Math.min(md, follow);
      spider.x += (mdx / md) * step;
      spider.y += (mdy / md) * step + task.sag * 0.04 * dt;
    } else {
      spider.x = task.ex;
      spider.y = task.ey + task.sag * 0.18;
    }
    if (spider.vy != null) spider.vy = 0;
    spider.angle = Math.atan2(task.ey - task.ay, task.ex - task.ax) + Math.PI * 0.5;
    if (!task.threadRef) {
      task.threadRef = {
        x1: task.ax,
        y1: task.ay,
        x2: task.ex,
        y2: task.ey,
        sag: task.sag,
        growing: true,
        w: 0.16 + task.strength * 0.22,
        a: 0.24 + task.strength * 0.18,
        silk: task.strength,
        spiderId: spider.id,
        mycelium: true,
        age: 0
      };
      pushWebThread(task.threadRef);
      spider.silk -= task.strength * 0.05;
    } else {
      task.threadRef.x2 = task.ex;
      task.threadRef.y2 = task.ey;
      task.threadRef.sag = task.sag;
    }
    if (task.progress >= 1) {
      task.threadRef.growing = false;
      spider.weaveTask = null;
      spider.hangThread = task.threadRef;
      spider.hangT = 1;
      spider.locomotion = "hang";
      ecoPulse(0.08 + task.strength * 0.06);
      return true;
    }
    return false;
  }

  function spiderStepCrawl(spider, dt, pressure) {
    if (!spiderEnsureOnThread(spider)) {
      spiderSeedAnchorWeb(spider);
      return;
    }
    var thread = spider.hangThread;
    if (spider.hangT == null) {
      var near = closestPointOnSegment(spider.x, spider.y, thread.x1, thread.y1, thread.x2, thread.y2);
      spider.hangT = near.t != null ? near.t : 0;
    }
    var weaveDrive = spiderWeaveDrive(pressure);
    var dir = spider.crawlDir != null ? spider.crawlDir : 1;
    var threadLen = Math.max(14, Math.hypot(thread.x2 - thread.x1, thread.y2 - thread.y1));
    var crawlRate = (0.1 + spider.speed * 0.005 + weaveDrive * 0.04) * (14 / threadLen);

    if (spider.crawlTarget) {
      var ptF = spiderPointOnThread(thread, Math.min(1, spider.hangT + 0.04));
      var ptB = spiderPointOnThread(thread, Math.max(0, spider.hangT - 0.04));
      var dF = spiderDist(ptF.x, ptF.y, spider.crawlTarget.x, spider.crawlTarget.y);
      var dB = spiderDist(ptB.x, ptB.y, spider.crawlTarget.x, spider.crawlTarget.y);
      dir = dF < dB ? 1 : -1;
      if (Math.min(dF, dB) < 18) {
        spider.crawlTarget = null;
        if (spider.webAnchor) spider.state = "weave";
      }
    } else if (spider.silk < spider.silkMax * 0.42) {
      var food = spiderNearestMycelium(spider);
      if (food && food.dist < 160) {
        spider.crawlTarget = { x: food.x, y: food.y };
      }
    } else if (Math.random() < dt * 0.07) {
      dir *= -1;
    }
    spider.crawlDir = dir;
    spider.hangT += dt * crawlRate * dir;

    if (spider.hangT < 0 || spider.hangT > 1) {
      var endT = spider.hangT < 0 ? 0 : 1;
      var endPt = spiderPointOnThread(thread, endT);
      var next = spiderNearestThreadAt(endPt.x, endPt.y, thread, 30);
      spider.hangT = endT;
      if (next) {
        spider.hangThread = next.thread;
        spider.hangT = next.t;
      } else if (spider.silk > spider.silkMax * (0.55 - weaveDrive * 0.08)) {
        spider.state = "weave";
        spider.webAnchor = { x: endPt.x, y: endPt.y };
        spider.x = endPt.x;
        spider.y = endPt.y;
        spider.weavePhase = null;
        spider.crawlTarget = null;
      } else {
        spider.hangT = ecoClamp(spider.hangT, 0.02, 0.98);
        spider.crawlDir = -dir;
      }
    }

    var pt = spiderPointOnThread(thread, ecoClamp(spider.hangT, 0, 1));
    spider.x = pt.x;
    spider.y = pt.y;
    spider.angle = Math.atan2(thread.y2 - thread.y1, thread.x2 - thread.x1) + Math.PI * 0.5;
    spider.locomotion = "hang";
    spider.vy = 0;
    spider.speed = Math.max(spider.speed, crawlRate * threadLen);
    spiderHarvestMycelium(spider, dt);

    if (spider.webAnchor && spiderDist(spider.x, spider.y, spider.webAnchor.x, spider.webAnchor.y) < 12) {
      spider.crawlTarget = null;
      spider.state = "weave";
    } else if (spider.silk >= spider.silkMax * (0.74 - weaveDrive * 0.12) && Math.random() < dt * (0.35 + weaveDrive)) {
      spider.state = "weave";
      spider.webAnchor = { x: spider.x, y: spider.y };
      spider.weavePhase = null;
    }
  }

  function stepWebSag(dt) {
    var w;
    for (w = 0; w < spiderWebThreads.length; w += 1) {
      var th = spiderWebThreads[w];
      if (th.growing) continue;
      var len = Math.hypot(th.x2 - th.x1, th.y2 - th.y1);
      var targetSag = len * 0.075 * (th.silk || 0.5) * (1 + spiderH * 0.00008);
      th.sag = (th.sag || 0) + (targetSag - (th.sag || 0)) * Math.min(1, dt * 0.65);
    }
  }

  function spiderWeaveThread(spider, tx, ty, strength) {
    return spiderBeginPayout(spider, tx, ty, strength);
  }

  function spiderLayWebRing(spider, cx, cy, radius, spokes) {
    var s = spider.ringSeg || 0;
    if (s >= spokes) return;
    var a0 = (s / spokes) * Math.PI * 2 + spider.phase * 0.08;
    var a1 = ((s + 1) / spokes) * Math.PI * 2 + spider.phase * 0.08;
    var x0 = cx + Math.cos(a0) * radius;
    var y0 = cy + Math.sin(a0) * radius;
    var x1 = cx + Math.cos(a1) * radius;
    var y1 = cy + Math.sin(a1) * radius;
    if (spiderDist(spider.x, spider.y, x0, y0) > 12) {
      spider.crawlTarget = { x: x0, y: y0 };
      spider.state = "crawl";
      return;
    }
    if (!spiderBeginPayout(spider, x1, y1, 0.42)) return;
    spider.ringSeg = s + 1;
  }

  function stepSpiderWeave(spider, dt) {
    if (!spiderEnsureOnThread(spider) && !spider.weaveTask) {
      spiderSeedAnchorWeb(spider);
    }
    if (spider.weaveTask) {
      spiderStepPayout(spider, dt);
      return;
    }
    if (spider.weavePending) {
      var bridge = spider.weavePending;
      spider.weavePending = null;
      if (spiderBeginPayout(spider, bridge.x2, bridge.y2, bridge.strength || 0.68)) {
        return;
      }
    }
    if (!spider.webAnchor) {
      spider.webAnchor = { x: spider.x, y: spider.y };
      spider.webSpokeIdx = 0;
      spider.weaveTurn = 0;
      spider.ringSeg = 0;
      spider.weavePhase = "radial";
    }
    if (!spider.weavePhase) {
      spider.weavePhase = "radial";
    }
    if (spider.silk < 0.08) {
      spider.state = "crawl";
      spider.webAnchor = null;
      spider.weavePhase = null;
      return;
    }
    var anchor = spider.webAnchor;
    var weaveDrive = spiderWeaveDrive(envPressure());
    var ringR = (10 + spider.weaveTurn * 4.8) * (0.85 + weaveDrive * 0.25);

    if (spider.weavePhase === "radial") {
      if (spiderDist(spider.x, spider.y, anchor.x, anchor.y) > 12) {
        spider.crawlTarget = { x: anchor.x, y: anchor.y };
        spider.state = "crawl";
        return;
      }
      var spokeAng = (spider.webSpokeIdx / spider.webSpokes) * Math.PI * 2 + spider.phase;
      var rimX = anchor.x + Math.cos(spokeAng) * ringR;
      var rimY = anchor.y + Math.sin(spokeAng) * ringR;
      if (!spiderBeginPayout(spider, rimX, rimY, 0.58)) {
        spider.state = "crawl";
        spider.webAnchor = null;
        return;
      }
      var scaffold = nearestSegmentEndpoint(rimX, rimY, null, 42);
      if (scaffold && scaffold.dist < 36 && spider.silk > 0.12) {
        spider.weavePending = {
          x2: scaffold.x,
          y2: scaffold.y,
          strength: 0.68
        };
      }
      spider.webSpokeIdx += 1;
      if (spider.webSpokeIdx >= spider.webSpokes) {
        spider.webSpokeIdx = 0;
        spider.weaveTurn += 1;
        if (spider.weaveTurn >= 2 + Math.floor(weaveDrive * 3)) {
          spider.weavePhase = "ring";
          spider.ringSeg = 0;
        }
      }
      return;
    }

    if (spider.weavePhase === "ring") {
      spiderLayWebRing(spider, anchor.x, anchor.y, ringR, spider.webSpokes);
      if (spider.ringSeg >= spider.webSpokes) {
        spider.ringSeg = 0;
        spider.weaveTurn += 1;
        if (spider.weaveTurn > 5 + Math.floor(weaveDrive * 4) || spider.silk < spider.silkMax * 0.28) {
          spider.state = "crawl";
          spider.webAnchor = null;
          spider.weavePhase = null;
        } else {
          spider.weavePhase = "radial";
          spider.webSpokeIdx = 0;
        }
      }
    }
  }

  function spawnFly(opts) {
    opts = opts || {};
    var ang = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
    var fly = {
      id: (flyIdCounter += 1),
      x: opts.x != null ? opts.x : spiderW * 0.5,
      y: opts.y != null ? opts.y : spiderH * 0.5,
      angle: ang,
      speed: 38 + Math.random() * 28,
      speedTarget: 52 + Math.random() * 42,
      wingPhase: Math.random() * 10,
      energy: 0.45 + Math.random() * 0.35,
      state: "cruise",
      stick: 0,
      stuckX: 0,
      stuckY: 0,
      wiggle: 0,
      sporeCargo: 0,
      rideColonyId: opts.rideColonyId != null ? opts.rideColonyId : null,
      alpha: 0.5 + Math.random() * 0.28,
      scale: 1.12 + Math.random() * 0.38,
      life: 1
    };
    ecoEnsureGenome(fly, fly.id);
    if (opts.randomBehavior !== false) {
      flyRandomSpawnState(fly);
    }
    return fly;
  }

  function flyNearestThread(fly) {
    var best = null;
    var bestD = Infinity;
    var step = threadScanStep(spiderWebThreads.length);
    var start = fly.id % step;
    var w;
    for (w = start; w < spiderWebThreads.length; w += step) {
      var thread = spiderWebThreads[w];
      var near = closestPointOnSegment(fly.x, fly.y, thread.x1, thread.y1, thread.x2, thread.y2);
      var catchR = (thread.w || 0.3) * 2.8 + 2.5 + (thread.silk || 0.5) * 2;
      if (near.dist < catchR && near.dist < bestD) {
        bestD = near.dist;
        best = { thread: thread, near: near, catchR: catchR };
      }
    }
    return best;
  }

  function flyTryStick(fly) {
    if (fly.state === "stuck" || fly.state === "dying") return;
    if (fly.speed < 55 && (fly.id + ecoFrameTick) % 3 !== 0) return;
    var hit = flyNearestThread(fly);
    if (!hit) return;
    var stickOdds = 0.08 + (hit.thread.silk || 0.5) * 0.22 + fly.speed * 0.0018 - fly.energy * 0.04;
    if (Math.random() > stickOdds) return;
    fly.state = "stuck";
    fly.stick = 0.35 + Math.random() * 0.45;
    fly.stuckX = hit.near.x;
    fly.stuckY = hit.near.y;
    fly.x = hit.near.x;
    fly.y = hit.near.y;
    fly.speed = 0;
    fly.speedTarget = 0;
    hit.thread.sticky = Math.min(1, (hit.thread.sticky || 0) + 0.08);
  }

  function flyNearestMyceliumFood(fly) {
    var best = null;
    var bestD = Infinity;
    var step = Math.max(1, Math.floor(myceliumSegments.length / 36));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var dx = mx - fly.x;
      var dy = my - fly.y;
      var d = dx * dx + dy * dy;
      if (d < bestD && (seg.minerals || 0) > 0.2) {
        bestD = d;
        best = { x: mx, y: my, dist: Math.sqrt(d), seg: seg };
      }
    }
    return best;
  }

  function stepFlies(dt) {
    var pressure = envPressure();
    var i = flies.length - 1;
    while (i >= 0) {
      var fly = flies[i];
      fly.wingPhase += dt * (18 + fly.speed * 0.35);
      ecoMutateStep(fly, dt, pressure, ecoFrameTick);

      if (fly.state === "dying") {
        i -= 1;
        continue;
      }

      if (fly.state === "rest") {
        fly.wingPhase += dt * 4;
        fly.energy = Math.min(1, fly.energy + dt * 0.22);
        if (fly.energy > 0.55 || Math.random() < dt * 0.04) {
          fly.state = "cruise";
          fly.speedTarget = 52 + Math.random() * 38;
        }
        i -= 1;
        continue;
      }

      if (fly.state === "stuck") {
        fly.stick += dt * (0.04 + (spiderWebThreads.length / Math.max(1, MAX_WEB_THREADS)) * 0.06);
        fly.wiggle += dt * 8;
        fly.x = fly.stuckX + Math.sin(fly.wiggle) * 0.35 * (1 - fly.stick);
        fly.y = fly.stuckY + Math.cos(fly.wiggle * 1.1) * 0.28 * (1 - fly.stick);
        if (Math.random() < dt * fly.stick * 0.35) {
          fly.state = "cruise";
          fly.stick = 0;
          fly.speed = 24 + Math.random() * 20;
          fly.speedTarget = 48 + Math.random() * 36;
          fly.angle += (Math.random() - 0.5) * 1.8;
        }
        i -= 1;
        continue;
      }

      if (fly.energy < 0.35) {
        var food = flyNearestMyceliumFood(fly);
        if (food && food.dist < 120) {
          fly.angle += envAngleDiff(fly.angle, Math.atan2(food.y - fly.y, food.x - fly.x)) * Math.min(1, dt * 5);
          fly.speedTarget = food.dist < 14 ? 18 : 55 + Math.min(40, food.dist * 0.35);
          if (food.dist < 14) {
            food.seg.minerals = Math.max(0.06, (food.seg.minerals || 0.4) - dt * 0.12);
            fly.energy = Math.min(1, fly.energy + dt * 0.4);
            if (fly.energy < 0.2) {
              fly.state = "rest";
              fly.speed = 0;
              fly.speedTarget = 0;
            }
          }
        }
      }

      if (fly.sporeCargo > 0.18 && fly.speed > 20 && Math.random() < dt * 0.22) {
        myceliumSpores.push({
          x: fly.x + Math.cos(fly.angle) * 3,
          y: fly.y + Math.sin(fly.angle) * 3,
          vx: Math.cos(fly.angle) * 6 + (Math.random() - 0.5) * 4,
          vy: Math.sin(fly.angle) * 6 + (Math.random() - 0.5) * 4,
          life: 0.85,
          r: 0.3 + Math.random() * 0.35,
          w: fly.angle
        });
        fly.sporeCargo = Math.max(0, fly.sporeCargo - 0.22);
        ecoPulse(0.07);
      }

      if (Math.random() < dt * 0.35) {
        fly.speedTarget = 45 + Math.random() * 55;
        fly.angle += (Math.random() - 0.5) * dt * 3.5;
      }

      if (pressure.webMass > 0.05 && Math.random() < dt * 0.4) {
        fly.angle += (Math.random() - 0.5) * dt * 2.2;
      }

      fly.speed += (fly.speedTarget - fly.speed) * Math.min(1, dt * 6);
      if (fly.speed > 2) {
        fly.x += Math.cos(fly.angle) * fly.speed * dt;
        fly.y += Math.sin(fly.angle) * fly.speed * dt;
        flyTryStick(fly);
      }

      fly.energy -= dt * (0.008 + fly.speed * 0.00012);
      if (fly.energy <= 0) {
        fly.state = "dying";
        fly.life = 0.5;
      }

      if (fly.x < 4) { fly.x = 4; fly.angle = Math.PI - fly.angle; }
      if (fly.x > spiderW - 4) { fly.x = spiderW - 4; fly.angle = Math.PI - fly.angle; }
      if (fly.y < 4) { fly.y = 4; fly.angle = -fly.angle; }
      if (fly.y > spiderH - 4) { fly.y = spiderH - 4; fly.angle = -fly.angle; }

      i -= 1;
    }

    if (flies.length < MAX_FLIES && Math.random() < dt * (0.14 + pressure.myceliumMass * 0.1)) {
      var pt = randomScreenPoint(14, spiderW, spiderH);
      flies.push(spawnFly({ x: pt.x, y: pt.y }));
    }
  }

  function drawFly(ctx, fly) {
    var sc = fly.scale * ecoFormScale(fly, 1);
    var form = fly.genome ? fly.genome.form : 0;
    var cx = fly.x;
    var cy = fly.y;
    var ang = fly.angle;
    var bodyLen = (form % 2 === 0 ? 0.9 : 1.15) * sc;
    var wingAmp = (form === 2 ? 0.7 : form === 4 ? 0.45 : 0.55) * sc;
    var wing = Math.sin(fly.wingPhase) * (fly.state === "stuck" ? 0.15 : wingAmp);
    ctx.save();
    ctx.globalAlpha = fly.alpha * (fly.state === "dying" ? Math.max(0.15, fly.life) : 1);
    ctx.strokeStyle = ecoStroke(fly, fly.state === "stuck"
      ? 0.55 + fly.stick * 0.3
      : fly.state === "rest"
        ? 0.45 + fly.energy * 0.25
        : 0.62 + fly.energy * 0.2, fly.energy);
    ctx.lineWidth = 0.58;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * bodyLen, cy - Math.sin(ang) * bodyLen);
    ctx.lineTo(cx + Math.cos(ang) * 0.5 * sc, cy + Math.sin(ang) * 0.5 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang + 1.4) * wing * 2.2, cy + Math.sin(ang + 1.4) * wing * 2.2);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang - 1.4) * wing * 2.2, cy + Math.sin(ang - 1.4) * wing * 2.2);
    ctx.stroke();
    ctx.restore();
  }

  function cosmologyFlySpawns() {
    var cos = cosmology || computeCosmology(true);
    var total = Math.min(MAX_FLIES, cos.species.flyInitial);
    var placements = [];
    var i;
    for (i = 0; i < total; i += 1) {
      var pt = randomScreenPoint(16, spiderW, spiderH);
      placements.push({
        x: pt.x,
        y: pt.y,
        angle: Math.random() * Math.PI * 2,
        rideColonyId: null
      });
    }
    return placements;
  }

  function stepSpiders(now) {
    var dt = Math.min(0.05, (now - spiderLast) / 1000);
    spiderLast = now;
    ecoFrameTick += 1;
    var pressure = envPressure();
    var i;
    for (i = 0; i < spiders.length; i += 1) {
      var spider = spiders[i];
      spider.phase += dt * (1.6 + spider.speed * 0.02);
      spider.legPhase += dt * (4.2 + spider.speed * 0.05);
      ecoMutateStep(spider, dt, pressure, ecoFrameTick);

      if (spider.state === "weave") {
        if (spider.weaveTask) {
          stepSpiderWeave(spider, dt);
        } else if (spider.crawlTarget && spiderDist(spider.x, spider.y, spider.crawlTarget.x, spider.crawlTarget.y) > 14) {
          spider.state = "crawl";
          stepSpiderCrawl(spider, dt, pressure);
        } else {
          stepSpiderWeave(spider, dt);
        }
        continue;
      }

      spider.state = "crawl";
      spiderStepCrawl(spider, dt, pressure);
    }

    var w;
    for (w = 0; w < spiderWebThreads.length; w += 1) {
      spiderWebThreads[w].age += dt;
    }
    stepWebSag(dt);
    stepFlies(dt);
    stepEcosystem(dt);

    if (spiders.length < MAX_SPIDERS && Math.random() < dt * (0.05 + pressure.webMass * 0.04)) {
      var margin = 22;
      spiders.push(spawnSpider(spiderLast, {
        x: margin + Math.random() * Math.max(30, spiderW - margin * 2),
        y: margin + Math.random() * Math.max(30, spiderH * 0.5)
      }));
    }
  }

  function webThreadInk(silk, age, alpha) {
    var fade = Math.max(0.35, 1 - age * 0.0018);
    var rr = 238 - silk * 18;
    var gg = 242 - silk * 8;
    var bb = 250 - silk * 4;
    return "rgba(" +
      Math.round(rr) + "," +
      Math.round(gg) + "," +
      Math.round(bb) + "," +
      (alpha * fade) + ")";
  }

  function drawWebThreads(ctx) {
    var w;
    var spiderById = {};
    var si;
    for (si = 0; si < spiders.length; si += 1) {
      spiderById[spiders[si].id] = spiders[si];
    }
    ctx.lineCap = "round";
    for (w = 0; w < spiderWebThreads.length; w += 1) {
      var thread = spiderWebThreads[w];
      var alpha = thread.a * (0.5 + (thread.silk || 0.5) * 0.5);
      var owner = spiderById[thread.spiderId] || null;
      if (owner && owner.genome) {
        ctx.strokeStyle = ecoStroke(owner, alpha * 0.85, thread.silk);
      } else {
        ctx.strokeStyle = webThreadInk(thread.silk || 0.6, thread.age || 0, alpha);
      }
      ctx.lineWidth = thread.w * (0.85 + (thread.mycelium ? 0.2 : 0));
      ctx.beginPath();
      ctx.moveTo(thread.x1, thread.y1);
      var sag = thread.sag || 0;
      if (sag > 0.4) {
        var mx = (thread.x1 + thread.x2) * 0.5;
        var my = (thread.y1 + thread.y2) * 0.5 + sag;
        ctx.quadraticCurveTo(mx, my, thread.x2, thread.y2);
      } else {
        ctx.lineTo(thread.x2, thread.y2);
      }
      ctx.stroke();
    }
  }

  function drawSpiderLeg(ctx, cx, cy, angle, side, legIdx, phase, sc) {
    var swing = Math.sin(phase + legIdx * 0.9) * 0.35;
    var perp = angle + (side < 0 ? -0.85 : 0.85);
    var len1 = 1.45 * sc;
    var len2 = 1.9 * sc;
    var kx = cx + Math.cos(perp) * 0.35 * sc;
    var ky = cy + Math.sin(perp) * 0.35 * sc;
    var kneeA = angle + swing * 0.5 + side * 0.4;
    var jx = kx + Math.cos(kneeA) * len1;
    var jy = ky + Math.sin(kneeA) * len1;
    var footA = kneeA + side * 0.55 + swing * 0.3;
    var fx = jx + Math.cos(footA) * len2;
    var fy = jy + Math.sin(footA) * len2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(jx, jy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  function drawSpider(ctx, spider) {
    var sc = spider.scale * ecoFormScale(spider, 0);
    var form = spider.genome ? spider.genome.form : 0;
    var cx = spider.x;
    var cy = spider.y;
    var ang = spider.angle;
    var cephStretch = 1 + (form % 3) * 0.08;
    var abdStretch = 1 + ((form + 1) % 3) * 0.12;
    var cephX = cx + Math.cos(ang) * 0.5 * sc * cephStretch;
    var cephY = cy + Math.sin(ang) * 0.5 * sc * cephStretch;
    var abdX = cx - Math.cos(ang) * 1.1 * sc * abdStretch;
    var abdY = cy - Math.sin(ang) * 1.1 * sc * abdStretch;
    ctx.save();
    ctx.globalAlpha = spider.alpha;
    ctx.strokeStyle = ecoStroke(spider, 0.75 + spider.silk * 0.2, spider.silk);
    ctx.lineWidth = 0.62;
    ctx.lineCap = "round";
    var leg;
    var legN = form === 4 ? 5 : 4;
    for (leg = 0; leg < legN; leg += 1) {
      drawSpiderLeg(ctx, cephX, cephY, ang, -1, leg, spider.legPhase, sc * (1 + (form === 3 ? 0.12 : 0)));
      drawSpiderLeg(ctx, cephX, cephY, ang, 1, leg + 0.5, spider.legPhase, sc * (1 + (form === 3 ? 0.12 : 0)));
    }
    ctx.beginPath();
    ctx.moveTo(cephX - Math.cos(ang + 1.57) * 0.35 * sc, cephY - Math.sin(ang + 1.57) * 0.35 * sc);
    ctx.lineTo(cephX + Math.cos(ang + 1.57) * 0.35 * sc, cephY + Math.sin(ang + 1.57) * 0.35 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(abdX - Math.cos(ang + 1.2) * 0.55 * sc, abdY - Math.sin(ang + 1.2) * 0.55 * sc);
    ctx.lineTo(abdX + Math.cos(ang + 1.2) * 0.55 * sc, abdY + Math.sin(ang + 1.2) * 0.55 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cephX, cephY);
    ctx.lineTo(abdX, abdY);
    ctx.stroke();
    if (spider.silk > 0.35 || spider.locomotion === "hang") {
      ctx.strokeStyle = ecoStroke(spider, 0.15 + spider.silk * 0.25, 1);
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.moveTo(cephX, cephY);
      var hangX = spider.hangFrom ? spider.hangFrom.x : cephX - Math.cos(ang - 0.4) * spider.silk * 3.5 * sc;
      var hangY = spider.hangFrom ? spider.hangFrom.y : cephY - Math.sin(ang - 0.4) * spider.silk * 3.5 * sc;
      ctx.lineTo(hangX, hangY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpiders() {
    if (!spiderCtx) return;
    spiderCtx.clearRect(0, 0, spiderW, spiderH);
    drawWebThreads(spiderCtx);
    var i;
    for (i = 0; i < flies.length; i += 1) {
      drawFly(spiderCtx, flies[i]);
    }
    for (i = 0; i < spiders.length; i += 1) {
      drawSpider(spiderCtx, spiders[i]);
    }
  }

  function spiderLoop(now) {
    if (!tabHidden && !reduced) {
      stepSpiders(now);
      drawSpiders();
    }
    spiderRaf = window.requestAnimationFrame(spiderLoop);
  }

  function cosmologySpiderSpawns() {
    var cos = cosmology || computeCosmology(true);
    var total = Math.min(MAX_SPIDERS, cos.species.spiderInitial);
    var placements = [];
    var p;
    var margin = 24;
    for (p = 0; p < total; p += 1) {
      placements.push({
        x: margin + cosmoUnitFrom(cos.astro, 60 + p * 1.7) * Math.max(40, spiderW - margin * 2),
        y: margin + cosmoUnitFrom(cos.astro, 61 + p * 1.9) * Math.max(40, spiderH * 0.52),
        angle: Math.random() * Math.PI * 2,
        homeColonyId: null
      });
    }
    return placements;
  }

  function startSpiders() {
    if (!spiderCanvas || reduced) return;
    spiderCtx = spiderCanvas.getContext("2d");
    resizeSpiders();
    spiders = [];
    spiderWebThreads = [];
    flies = [];
    spiderIdCounter = 0;
    flyIdCounter = 0;
    spiderLast = performance.now();
    if (!cosmology) computeCosmology(true);
    var placements = cosmologySpiderSpawns();
    var i;
    for (i = 0; i < placements.length; i += 1) {
      var place = placements[i];
      spiders.push(spawnSpider(spiderLast, {
        x: place.x,
        y: place.y,
        angle: place.angle,
        homeColonyId: place.homeColonyId
      }));
    }
    var flyPlaces = cosmologyFlySpawns();
    for (i = 0; i < flyPlaces.length; i += 1) {
      var fp = flyPlaces[i];
      flies.push(spawnFly({
        x: fp.x,
        y: fp.y,
        angle: fp.angle,
        rideColonyId: fp.rideColonyId
      }));
    }
    if (spiderRaf) window.cancelAnimationFrame(spiderRaf);
    spiderRaf = window.requestAnimationFrame(spiderLoop);
  }

  function stopSpiders() {
    if (spiderRaf) {
      window.cancelAnimationFrame(spiderRaf);
      spiderRaf = null;
    }
  }

  var antCanvas = document.getElementById("ant-field");
  var antCtx = null;
  var ants = [];
  var antIdCounter = 0;
  var antRaf = null;
  var antLast = 0;
  var antW = 0;
  var antH = 0;

  function resizeAnts() {
    if (!antCanvas) return;
    antW = window.innerWidth;
    antH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    antCanvas.width = Math.floor(antW * dpr);
    antCanvas.height = Math.floor(antH * dpr);
    antCanvas.style.width = antW + "px";
    antCanvas.style.height = antH + "px";
    if (antCtx) {
      antCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function spawnAnt(now, opts) {
    var t = now || performance.now();
    opts = opts || {};
    var juvenile = !!opts.juvenile;
    var baseAngle = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
    var ant = {
      x: opts.x != null ? opts.x : Math.random() * antW,
      y: opts.y != null ? opts.y : Math.random() * antH,
      angle: baseAngle,
      headAngle: baseAngle,
      bodyAngle: baseAngle,
      tailAngle: baseAngle,
      flex: 0,
      angleVel: 0,
      antId: (antIdCounter += 1),
      speed: juvenile ? 2 + Math.random() * 6 : 8 + Math.random() * 18,
      speedTarget: juvenile ? 8 + Math.random() * 18 : 35 + Math.random() * 55,
      mass: 0.9 + Math.random() * 0.45,
      phase: Math.random() * 10,
      gaitPhase: Math.random() * 10,
      wander: Math.random() * 20,
      wanderBias: (Math.random() - 0.5) * 1.2,
      pauseUntil: 0,
      nextShift: t + 300 + Math.random() * 800,
      birthCooldown: 0,
      bornAt: t,
      lifespan: ANT_LIFESPAN_MIN + Math.random() * (ANT_LIFESPAN_MAX - ANT_LIFESPAN_MIN),
      energy: juvenile ? 0.5 + Math.random() * 0.32 : 0.58 + Math.random() * 0.34,
      fed: 0,
      fungusLoad: 0,
      toxicity: 0,
      intoxUntil: 0,
      scale: (0.95 + Math.random() * 0.45) * (juvenile ? 0.72 : 1),
      alpha: 0.62 + Math.random() * 0.32,
      homeColonyId: opts.homeColonyId != null ? opts.homeColonyId : null,
      travelColonyId: null,
      travelUntil: 0,
      eggCooldown: t + 1800 + Math.random() * 4500,
      flying: false,
      z: 0,
      w: Math.random() * Math.PI * 2,
      tPhase: Math.random() * Math.PI * 2,
      reelRate: 0.4 + Math.random() * 0.5
    };
    ecoEnsureGenome(ant, ant.antId);
    return ant;
  }

  function startAntHiveTravel(ant, now) {
    if (myceliumColonies.length < 2) return;
    var broodNeed = antHomeBroodNeed(ant);
    if (broodNeed > 0.32) return;
    if (ant.homeColonyId != null && countColonyEggs(ant.homeColonyId) > 0 && antFedForBrood(ant)) return;
    var homeId = ant.homeColonyId;
    var candidates = [];
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      if (myceliumColonies[c].id !== homeId) {
        candidates.push(myceliumColonies[c]);
      }
    }
    if (!candidates.length) {
      candidates = myceliumColonies.slice();
    }
    if (candidates.length < 2 && homeId != null) return;
    var target = candidates[Math.floor(Math.random() * candidates.length)];
    if (homeId != null && target.id === homeId) {
      target = candidates[(Math.floor(Math.random() * candidates.length) + 1) % candidates.length];
    }
    if (!target || (homeId != null && target.id === homeId)) return;
    ant.travelColonyId = target.id;
    ant.travelUntil = now + 6500 + Math.random() * 15000;
    ant.speedTarget = 40 + Math.random() * 58;
    ant.wanderBias *= 0.3;
    ant.pauseUntil = 0;
  }

  function antHiveTravelInterest(ant, now) {
    if (!ant.travelColonyId) return null;
    if (now >= ant.travelUntil) {
      ant.travelColonyId = null;
      ant.travelUntil = 0;
      return null;
    }
    var colony = colonyById(ant.travelColonyId);
    if (!colony) {
      ant.travelColonyId = null;
      ant.travelUntil = 0;
      return null;
    }
    var dx = colony.anchorX - ant.x;
    var dy = colony.anchorY - ant.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 50) {
      ant.homeColonyId = colony.id;
      ant.travelColonyId = null;
      ant.travelUntil = 0;
      ant.pauseUntil = now + 220 + Math.random() * 720;
      ant.energy = Math.min(1, ant.energy + 0.07);
      colony.minerals = Math.min(1, (colony.minerals || 0.8) + 0.07);
      colony.vitality = Math.min(1, (colony.vitality || 1) + 0.05);
      myceliumCrawlStimulus += 2.8;
      ecoPulse(0.32);
      return null;
    }
    return {
      dist: dist,
      steer: envAngleDiff(ant.headAngle != null ? ant.headAngle : ant.angle, Math.atan2(dy, dx)),
      weight: 2.5 * Math.min(1, 200 / Math.max(dist, 52)),
      traveling: true
    };
  }

  function antColonyGrowthInterest(ant, now) {
    if (!ant.homeColonyId || ant.travelColonyId) return null;
    var broodNeed = antHomeBroodNeed(ant);
    if (broodNeed < 0.1) return null;
    if (ants.length >= MAX_ANTS && antEggs.length >= MAX_EGGS * 0.75) return null;

    var repro = antReproBalance();
    if (repro < 0.08) return null;

    var satiation = ant.fungusLoad + ant.toxicity * 0.5;
    if (satiation < 0.14 && ant.energy < 0.3) return null;
    if (ant.toxicity > 0.42) return null;
    if (antAilment(ant, now).elder > 0.68) return null;

    var home = colonyById(ant.homeColonyId);
    if (!home) return null;

    var nestX = home.anchorX + Math.cos(home.biasAngle) * 16;
    var nestY = home.anchorY + Math.sin(home.biasAngle) * 16;
    var dx = nestX - ant.x;
    var dy = nestY - ant.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 34) {
      if (satiation > 0.2 && ant.energy > 0.34 && now >= ant.eggCooldown) {
        ant.pauseUntil = Math.max(ant.pauseUntil, now + 700 + Math.random() * 1400);
        ant.speedTarget = 0;
      }
      return {
        dist: dist,
        steer: 0,
        weight: (2 + broodNeed * 0.95) * repro,
        nesting: true
      };
    }

    return {
      dist: dist,
      steer: envAngleDiff(ant.headAngle != null ? ant.headAngle : ant.angle, Math.atan2(dy, dx)),
      weight: (1.65 + broodNeed * 1.05) * repro * Math.min(1.15, satiation + 0.48),
      nesting: true
    };
  }

  function antTendEggsInterest(ant, now) {
    if (!ant.homeColonyId || ant.travelColonyId) return null;
    if (!antFedForBrood(ant)) return null;
    var homeEggs = countColonyEggs(ant.homeColonyId);
    if (!homeEggs) return null;
    var best = null;
    var bestD = Infinity;
    var i;
    for (i = 0; i < antEggs.length; i += 1) {
      var egg = antEggs[i];
      if (egg.colonyId !== ant.homeColonyId) continue;
      var dx = egg.x - ant.x;
      var dy = egg.y - ant.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = egg;
      }
    }
    if (!best || bestD > 220 * 220) return null;
    var dist = Math.sqrt(bestD);
    var broodNeed = antHomeBroodNeed(ant);
    if (dist < 18) {
      ant.pauseUntil = Math.max(ant.pauseUntil, now + 400 + Math.random() * 900);
      ant.speedTarget = 0;
      return {
        dist: dist,
        steer: 0,
        weight: (2.2 + broodNeed * 0.8) * antReproBalance(),
        tending: true
      };
    }
    return {
      dist: dist,
      steer: envAngleDiff(ant.headAngle != null ? ant.headAngle : ant.angle, Math.atan2(best.y - ant.y, best.x - ant.x)),
      weight: (1.75 + broodNeed * 0.75) * Math.min(1.35, antReproBalance() + 0.15),
      tending: true
    };
  }

  function antAtHomeNest(ant) {
    if (ant.homeColonyId == null) return false;
    var home = colonyById(ant.homeColonyId);
    if (!home) return false;
    var dx = ant.x - home.anchorX;
    var dy = ant.y - home.anchorY;
    return dx * dx + dy * dy < 95 * 95;
  }

  function tryLayAntEgg(ant, now, dt, pressure) {
    if (antEggs.length >= MAX_EGGS) return;
    if (ants.length >= MAX_ANTS && antEggs.length > MAX_EGGS * 0.6) return;
    if (now < ant.eggCooldown) return;
    if (ant.energy < 0.32) return;
    if (ant.toxicity > 0.38) return;
    if (antAilment(ant, now).elder > 0.68) return;
    if (ant.speed > 7 && !ant.resting) return;
    if (!antAtHomeNest(ant)) return;
    var home = colonyById(ant.homeColonyId);
    if (!home) return;
    var colonyEggs = countColonyEggs(home.id);
    if (colonyEggs >= 8) return;
    var repro = antReproBalance();
    var broodNeed = home.broodNeed || 0;
    if (!pressure) pressure = envPressure();
    var layChance = dt * (1.05 + broodNeed * 0.72) * ant.energy * repro;
    if (pressure.belowFloor > 0) {
      layChance *= 1 + pressure.belowFloor * 0.45;
    }
    if (ant.resting || ant.speed < 3) {
      layChance *= 2.1;
    } else if (ant.speed < 5.5) {
      layChance *= 1.35;
    }
    if (colonyEggs === 0) {
      layChance *= 1.4;
    }
    if (Math.random() < layChance) {
      spawnAntEgg(ant, now);
    }
  }

  function pickAntIntent(ant, now) {
    var pressure = envPressure();
    var broodNeed = antHomeBroodNeed(ant);
    var homeEggs = ant.homeColonyId != null ? countColonyEggs(ant.homeColonyId) : 0;
    var travelChance = 0.16 * (1 - broodNeed * 0.78) * (1 - pressure.antScarcity * 0.42);
    if (homeEggs > 0) travelChance *= 0.35;
    if (myceliumColonies.length > 1 && !ant.travelColonyId && Math.random() < travelChance) {
      startAntHiveTravel(ant, now);
      return;
    }
    if ((broodNeed > 0.22 || homeEggs > 0) && antFedForBrood(ant)) {
      ant.speedTarget = 8 + Math.random() * 18;
      ant.nextShift = now + 900 + Math.random() * 2000;
      if (Math.random() < 0.42 + broodNeed * 0.18 + homeEggs * 0.08) {
        ant.pauseUntil = now + 400 + Math.random() * 1100;
        ant.speedTarget = 0;
      }
      return;
    }
    if (broodNeed > 0.35 && ant.energy > 0.36) {
      ant.speedTarget = 14 + Math.random() * 28;
      ant.nextShift = now + 600 + Math.random() * 1400;
      if (Math.random() < 0.22 + broodNeed * 0.14) {
        ant.pauseUntil = now + 220 + Math.random() * 700;
        ant.speedTarget = 0;
      }
      return;
    }
    ant.speedTarget = 12 + Math.random() * 98;
    ant.wanderBias = (Math.random() - 0.5) * 2.2;
    ant.nextShift = now + 500 + Math.random() * 1800;
    if (Math.random() < 0.1) {
      ant.pauseUntil = now + 140 + Math.random() * 520;
      ant.speedTarget = 0;
    }
  }

  function antSpreadInterest(ant) {
    var cov = coverageFraction();
    if (cov > 0.9) return null;
    var target = spreadSeekPoint(ant.x, ant.y);
    var dx = target.x - ant.x;
    var dy = target.y - ant.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 18) return null;
    return {
      dist: dist,
      steer: envAngleDiff(antHeadAngle(ant), Math.atan2(dy, dx)),
      weight: (1.05 + (1 - cov) * 1.6) * (ant.flying ? 1.4 : 0.9),
      spreading: true
    };
  }

  function myceliumInterest(ant) {
    var satiation = ant.fungusLoad + ant.toxicity * 0.55;
    var broodNeed = antHomeBroodNeed(ant);
    if (satiation > 0.78) return null;
    if (satiation > 0.38 && broodNeed > 0.25) return null;
    if (satiation > 0.48 && countColonyEggs(ant.homeColonyId) > 0) return null;

    var bestD = Infinity;
    var tx = 0;
    var ty = 0;
    var weight = 0;

    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      var cdx = colony.anchorX - ant.x;
      var cdy = colony.anchorY - ant.y;
      var cd = cdx * cdx + cdy * cdy;
      var hiveWeight = colony.id === ant.homeColonyId ? 1.15 : 1.5;
      if (cd < bestD) {
        bestD = cd;
        tx = colony.anchorX;
        ty = colony.anchorY;
        weight = hiveWeight;
      }
    }

    var f;
    for (f = 0; f < myceliumFruits.length; f += 1) {
      var fruit = myceliumFruits[f];
      var dx = fruit.x - ant.x;
      var dy = fruit.y - fruit.stalk - ant.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        tx = fruit.x;
        ty = fruit.y - fruit.stalk;
        weight = 2.2;
      }
    }

    var step = Math.max(1, Math.floor(myceliumSegments.length / 48));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var sdx = mx - ant.x;
      var sdy = my - ant.y;
      var sd = sdx * sdx + sdy * sdy;
      if (sd < bestD) {
        bestD = sd;
        tx = mx;
        ty = my;
        weight = 1;
      }
    }

    if (bestD === Infinity || bestD > 220 * 220) return null;
    var dist = Math.sqrt(bestD);
    var satiationDamp = Math.max(0.06, 1 - satiation * 1.15);
    return {
      dist: dist,
      steer: envAngleDiff(ant.headAngle != null ? ant.headAngle : ant.angle, Math.atan2(ty - ant.y, tx - ant.x)),
      weight: weight * (1 - dist / 260) * satiationDamp
    };
  }

  function pointNearMycelium(x, y, radius) {
    var r2 = radius * radius;
    var c;
    for (c = 0; c < myceliumColonies.length; c += 1) {
      var colony = myceliumColonies[c];
      var cdx = x - colony.anchorX;
      var cdy = y - colony.anchorY;
      if (cdx * cdx + cdy * cdy < r2 * 1.8) return true;
    }
    var f;
    for (f = 0; f < myceliumFruits.length; f += 1) {
      var fruit = myceliumFruits[f];
      var fdx = x - fruit.x;
      var fdy = y - (fruit.y - fruit.stalk);
      if (fdx * fdx + fdy * fdy < r2) return true;
    }
    var step = Math.max(1, Math.floor(myceliumSegments.length / 64));
    var i;
    for (i = 0; i < myceliumSegments.length; i += step) {
      var seg = myceliumSegments[i];
      var mx = (seg.x1 + seg.x2) * 0.5;
      var my = (seg.y1 + seg.y2) * 0.5;
      var sdx = x - mx;
      var sdy = y - my;
      if (sdx * sdx + sdy * sdy < r2) return true;
    }
    return false;
  }

  function sustainAntColony(now, dt) {
    var pressure = envPressure();
    if (pressure.belowFloor <= 0) return;
    var deficit = pressure.belowFloor;
    if (ants.length < MAX_ANTS && Math.random() < dt * (0.018 + deficit * 0.012)) {
      var neediest = myceliumColonies[0];
      var needScore = -1;
      var c;
      for (c = 0; c < myceliumColonies.length; c += 1) {
        var colony = myceliumColonies[c];
        var score = (colony.broodNeed || 0) + 0.5 / Math.max(1, countColonyAnts(colony.id));
        if (score > needScore) {
          needScore = score;
          neediest = colony;
        }
      }
      if (neediest) {
        ants.push(spawnAnt(now, {
          x: neediest.anchorX + (Math.random() - 0.5) * 28,
          y: neediest.anchorY + (Math.random() - 0.5) * 28,
          angle: neediest.biasAngle + (Math.random() - 0.5) * 1.2,
          homeColonyId: neediest.id
        }));
      }
    }
    if (antEggs.length < deficit && ants.length > 0 && Math.random() < dt * 0.04 * deficit) {
      var layer = ants[Math.floor(Math.random() * ants.length)];
      if (layer.energy > 0.35 && antAtHomeNest(layer)) {
        spawnAntEgg(layer, now);
      }
    }
  }

  function tryAntRecruit(now, dt) {
    if (ants.length >= MAX_ANTS || !myceliumColonies.length) return;
    var pressure = envPressure();
    if (pressure.antCrowd > 0.85) return;
    if (myceliumSegments.length < 28) return;
    var recruitRate = dt * (0.006 + pressure.antScarcity * 0.028) * Math.min(1.3, pressure.fungusPerAnt + 0.35);
    if (Math.random() > recruitRate) return;
    var colony = myceliumColonies[Math.floor(Math.random() * myceliumColonies.length)];
    ants.push(spawnAnt(now, {
      x: colony.anchorX + (Math.random() - 0.5) * 20,
      y: colony.anchorY + (Math.random() - 0.5) * 20,
      angle: colony.biasAngle + (Math.random() - 0.5) * 1.1,
      homeColonyId: colony.id
    }));
  }

  function tryAntBirth(now) {
    if (ants.length >= MAX_ANTS) return;
    var pressure = envPressure();
    var repro = antReproBalance();
    if (repro < 0.1) return;
    var crowdDamp = 1 - pressure.antCrowd * 0.7;
    var i;
    for (i = 0; i < ants.length; i += 1) {
      var j;
      for (j = i + 1; j < ants.length; j += 1) {
        var a = ants[i];
        var b = ants[j];
        if (now < a.birthCooldown || now < b.birthCooldown) continue;
        if (a.energy < 0.4 || b.energy < 0.4) continue;
        if (a.toxicity > 0.32 || b.toxicity > 0.32) continue;
        if (antAilment(a, now).elder > 0.72 || antAilment(b, now).elder > 0.72) continue;
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        if (dx * dx + dy * dy > 18 * 18) continue;
        var mx = (a.x + b.x) * 0.5;
        var my = (a.y + b.y) * 0.5;
        if (!pointNearMycelium(mx, my, 58)) continue;
        var birthChance = 0.32 * crowdDamp * a.energy * b.energy * repro;
        if (pressure.fungusPerAnt < 0.45) birthChance *= 0.65;
        if (Math.random() > birthChance) continue;
        if (Math.random() < 0.72 && antEggs.length < MAX_EGGS) {
          spawnAntEgg(a, now);
          a.energy = Math.max(0.12, a.energy - 0.12);
          b.energy = Math.max(0.12, b.energy - 0.1);
          a.birthCooldown = now + 7000;
          b.birthCooldown = now + 7000;
          return;
        }
        var baby = spawnAnt(now, {
          juvenile: true,
          x: mx + (Math.random() - 0.5) * 8,
          y: my + (Math.random() - 0.5) * 8,
          angle: Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() - 0.5) * 0.8,
          homeColonyId: a.homeColonyId != null ? a.homeColonyId : b.homeColonyId
        });
        ants.push(baby);
        a.energy = Math.max(0.12, a.energy - 0.18);
        b.energy = Math.max(0.12, b.energy - 0.18);
        a.birthCooldown = now + 9000;
        b.birthCooldown = now + 9000;
        return;
      }
    }
  }

  function wrapAnt(ant) {
    if (tryAntPortal(ant)) return;
    if (ant.x < -16) ant.x = antW + 16;
    if (ant.x > antW + 16) ant.x = -16;
    if (ant.y < -16) ant.y = antH + 16;
    if (ant.y > antH + 16) ant.y = -16;
  }

  function antHeadAngle(ant) {
    return ant.headAngle != null ? ant.headAngle : ant.angle;
  }

  function antTurnAuthority(speed) {
    var slow = 12;
    var fast = 30;
    if (speed <= slow) return 1;
    if (speed >= fast) return 0.05;
    var t = (speed - slow) / (fast - slow);
    return 1 - t * 0.95;
  }

  function antAilment(ant, now) {
    var age = now - ant.bornAt;
    var lifeFrac = Math.max(0, Math.min(1, 1 - age / ant.lifespan));
    var elder = Math.max(0, Math.min(1, (age / ant.lifespan - 0.58) / 0.38));
    var tox = ant.toxicity || 0;
    var intox = Math.max(tox, elder * 0.35);
    var frail = Math.max(elder, tox * 0.82);
    return {
      age: age,
      lifeFrac: lifeFrac,
      elder: elder,
      tox: tox,
      intox: intox,
      frail: frail
    };
  }

  function stepAntBodyFlex(ant, dt, paused, ailment, turnAuth) {
    var head = antHeadAngle(ant);
    var frail = ailment ? ailment.frail : 0;
    var auth = turnAuth != null ? turnAuth : antTurnAuthority(ant.speed);
    var align = (paused ? 2.4 : 1.6 + auth * 1.4) * (1 - frail * 0.38);
    var tailLag = (paused ? 1.6 : 1.5 + auth * 1.1) * (1 - frail * 0.22);
    ant.bodyAngle += envAngleDiff(ant.bodyAngle, head) * Math.min(1, dt * align);
    ant.tailAngle += envAngleDiff(ant.tailAngle, ant.bodyAngle) * Math.min(1, dt * tailLag);
    ant.flex = envAngleDiff(ant.tailAngle, head);
    if (ailment && ailment.intox > 0.28) {
      ant.flex += Math.sin(ant.phase * (2.4 + ailment.intox * 2)) * ailment.intox * 0.42;
    }
    if (ailment && ailment.elder > 0.35) {
      ant.flex += Math.sin(ant.phase * 0.85 + (ant.antId || 0)) * ailment.elder * 0.18;
    }
    ant.angle = head;
  }

  function antLegTripodSwing(legIdx, gaitPhase) {
    var tripodA = legIdx === 0 || legIdx === 3 || legIdx === 4;
    return Math.sin(gaitPhase + (tripodA ? 0 : Math.PI));
  }

  function antLegAttach(thoraxX, thoraxY, bodyAngle, headAngle, tailAngle, offsetX, side, sc) {
    var blend = offsetX > 0.35 ? headAngle : (offsetX < -0.35 ? tailAngle : bodyAngle);
    var ang = bodyAngle + (blend - bodyAngle) * Math.min(1, Math.abs(offsetX) * 0.9);
    var px = thoraxX + Math.cos(ang) * offsetX * sc;
    var py = thoraxY + Math.sin(ang) * offsetX * sc;
    var perp = ang + (side < 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
    return {
      x: px + Math.cos(perp) * 0.4 * sc,
      y: py + Math.sin(perp) * 0.4 * sc,
      angle: ang
    };
  }

  function drawAntLeg(ctx, attachX, attachY, bodyAngle, side, legIdx, gaitPhase, stride, sc, ailment) {
    var swing = antLegTripodSwing(legIdx, gaitPhase);
    var stance = swing < 0;
    var str = stride;
    var perp = bodyAngle + (side < 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
    var coxa = 0.36 * sc;
    var femur = 0.82 * sc;
    var tibia = (0.95 + str * 0.72) * sc;
    var sx = attachX + Math.cos(perp) * coxa * 0.55;
    var sy = attachY + Math.sin(perp) * coxa * 0.55;
    var lift = stance ? 0 : Math.max(0, swing) * 0.32 * sc;
    var sweep = stance ? (-0.42 - Math.max(0, -swing) * 0.12) : (0.12 + Math.max(0, swing) * 0.2);
    if (ailment.frail > 0.35) {
      sweep *= 0.78;
      tibia *= 0.88;
    }
    if (ailment.intox > 0.4) {
      sweep += Math.sin(gaitPhase * 3 + legIdx) * ailment.intox * 0.08;
    }
    var kneeA = bodyAngle + sweep;
    var kx = sx + Math.cos(kneeA) * femur;
    var ky = sy + Math.sin(kneeA) * femur;
    var footA = kneeA + (stance ? -0.38 : 0.32);
    var fx = kx + Math.cos(footA) * tibia;
    var fy = ky + Math.sin(footA) * tibia - lift;
    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(sx, sy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
  }

  function drawAntLegs(ctx, ant, ailment, sc, thoraxX, thoraxY, headA, bodyA, tailA, stride) {
    var gait = ant.gaitPhase != null ? ant.gaitPhase : ant.phase;
    var pairs = [
      { ox: 0.82, idxL: 0, idxR: 1 },
      { ox: 0.02, idxL: 2, idxR: 3 },
      { ox: -0.88, idxL: 4, idxR: 5 }
    ];
    var p;
    for (p = 0; p < pairs.length; p += 1) {
      var pair = pairs[p];
      var left = antLegAttach(thoraxX, thoraxY, bodyA, headA, tailA, pair.ox, -1, sc);
      var right = antLegAttach(thoraxX, thoraxY, bodyA, headA, tailA, pair.ox, 1, sc);
      drawAntLeg(ctx, left.x, left.y, left.angle, -1, pair.idxL, gait, stride, sc, ailment);
      drawAntLeg(ctx, right.x, right.y, right.angle, 1, pair.idxR, gait, stride, sc, ailment);
    }
  }

  function drawAntSegment(ctx, cx, cy, angle, length, width, squash) {
    var perp = angle + Math.PI * 0.5;
    var hw = width * squash;
    var hl = length;
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);
    var cosP = Math.cos(perp);
    var sinP = Math.sin(perp);
    var fx = cx + cosA * hl + cosP * hw;
    var fy = cy + sinA * hl + sinP * hw;
    var bx = cx - cosA * hl + cosP * hw;
    var by = cy - sinA * hl + sinP * hw;
    var fx2 = cx + cosA * hl - cosP * hw;
    var fy2 = cy + sinA * hl - sinP * hw;
    var bx2 = cx - cosA * hl - cosP * hw;
    var by2 = cy - sinA * hl - sinP * hw;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx2, fy2);
    ctx.lineTo(bx2, by2);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + cosP * hw * 0.3, cy + sinP * hw * 0.3);
    ctx.lineTo(cx - cosP * hw * 0.3, cy - sinP * hw * 0.3);
    ctx.stroke();
  }

  function drawAntBridge(ctx, x1, y1, x2, y2, bulge) {
    var mx = (x1 + x2) * 0.5;
    var my = (y1 + y2) * 0.5;
    var perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(
      mx + Math.cos(perp) * bulge,
      my + Math.sin(perp) * bulge,
      x2,
      y2
    );
    ctx.stroke();
  }

  function drawAnt(ctx, ant, now) {
    var ailment = antAilment(ant, now);
    var gait = ant.gaitPhase != null ? ant.gaitPhase : ant.phase;
    var stride = ant.resting
      ? 0.08
      : Math.min(0.8, 0.16 + Math.sqrt(Math.min(ant.speed, 95)) * 0.078);
    var turnAuth = antTurnAuthority(ant.speed);
    var vitality = Math.max(0.28, Math.min(1, ant.energy * 0.65 + ailment.lifeFrac * 0.35));
    vitality *= 1 - ailment.tox * 0.28 - ailment.elder * 0.14;
    var form = ant.genome ? ant.genome.form : 0;
    var headA = antHeadAngle(ant) + Math.sin(ant.phase * 1.2) * ailment.intox * 0.18 * Math.max(0.15, turnAuth);
    var bodyA = ant.bodyAngle + Math.sin(ant.phase * 1.0 + 0.6) * ailment.intox * 0.1 * Math.max(0.2, turnAuth);
    var tailA = ant.tailAngle + Math.sin(ant.phase * 0.85 + 1.2) * ailment.intox * 0.06;
    tailA += ailment.elder * Math.sin(ant.phase * 0.7) * 0.15;
    var flex = Math.abs(ant.flex || 0);
    var strideSquash = 1 + Math.sin(gait * 2) * 0.025 * stride;
    strideSquash *= 1 - ailment.elder * 0.08;
    var heave = Math.sin(gait * 2) * 0.05 * ant.scale * stride;
    if (ailment.intox > 0.5) {
      heave += Math.sin(gait * 3.2) * ailment.intox * 0.12 * ant.scale;
    }
    var sc = ant.scale * (1 - ailment.elder * 0.08) * ecoFormScale(ant, 2);
    var drawPos = project5D(ant.x, ant.y, ant.z || 0, ant.w || 0, ant.tPhase || ant.phase);
    sc *= drawPos.scale;
    var offX = drawPos.x - ant.x;
    var offY = drawPos.y - ant.y;
    var thoraxX = ant.x + offX + (ailment.intox > 0.55 ? Math.sin(ant.phase * 2.2) * ailment.intox * 0.2 : 0);
    var thoraxY = ant.y + offY + heave;
    var abdLen = (3.15 + ailment.elder * 0.35 + form * 0.12) * sc;
    var abdW = (0.92 + flex * 0.08 - ailment.elder * 0.12) * sc;
    var thorLen = (2.05 - ailment.elder * 0.18 + (form % 2) * 0.15) * sc;
    var thorW = (0.78 + Math.sin(ant.phase * 0.9) * 0.04 - ailment.frail * 0.1) * sc;
    var headLen = (1.05 - ailment.elder * 0.12 + (form % 3) * 0.08) * sc;
    var headW = (0.72 - ailment.frail * 0.08) * sc;
    var segmentSlump = ailment.elder * 0.55 * sc;
    var abdCx = thoraxX - Math.cos(bodyA) * (1.05 * sc + segmentSlump) - Math.cos(tailA) * abdLen * 0.42;
    var abdCy = thoraxY - Math.sin(bodyA) * (1.05 * sc + segmentSlump) - Math.sin(tailA) * abdLen * 0.42;
    var headCx = thoraxX + Math.cos(headA) * (0.88 * sc + headLen * 0.38);
    var headCy = thoraxY + Math.sin(headA) * (0.88 * sc + headLen * 0.38);
    if (ailment.intox > 0.4) {
      headCx += Math.sin(ant.phase * 3.1) * ailment.intox * 0.55 * sc;
      headCy += Math.cos(ant.phase * 2.7) * ailment.intox * 0.4 * sc;
    }
    var bridgeBulge = (0.35 + flex * 0.55 + ailment.intox * 0.25) * sc;

    ctx.save();
    ctx.globalAlpha = ant.alpha * vitality * drawPos.alpha;
    ctx.strokeStyle = ecoStroke(ant, 0.92 - ailment.frail * 0.22, ant.energy);
    ctx.lineWidth = 0.5 - ailment.elder * 0.08;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawAntLegs(ctx, ant, ailment, sc, thoraxX, thoraxY, headA, bodyA, tailA, stride);

    drawAntSegment(ctx, abdCx, abdCy, tailA, abdLen, abdW, strideSquash * (0.94 - ailment.elder * 0.08));
    drawAntBridge(ctx, abdCx + Math.cos(tailA) * abdLen * 0.35, abdCy + Math.sin(tailA) * abdLen * 0.35, thoraxX, thoraxY, bridgeBulge);
    drawAntSegment(ctx, thoraxX, thoraxY, bodyA, thorLen, thorW, strideSquash * (1 - ailment.frail * 0.1));
    drawAntBridge(ctx, thoraxX + Math.cos(bodyA) * thorLen * 0.35, thoraxY + Math.sin(bodyA) * thorLen * 0.35, headCx - Math.cos(headA) * headLen * 0.2, headCy - Math.sin(headA) * headLen * 0.2, bridgeBulge * 0.75);
    drawAntSegment(ctx, headCx, headCy, headA, headLen, headW, strideSquash * (1.02 - ailment.intox * 0.1));

    if (ant.flying) {
      var wing = Math.sin((ant.tPhase || ant.phase) * 4.2) * (1.2 + ailment.elder * 0.8) * sc;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(thoraxX - Math.cos(bodyA + 0.9) * wing, thoraxY - Math.sin(bodyA + 0.9) * wing);
      ctx.lineTo(thoraxX + Math.cos(bodyA - 0.9) * wing, thoraxY + Math.sin(bodyA - 0.9) * wing);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(headCx, headCy);
    ctx.rotate(headA);
    var antennaReach = 1.65 + ailment.intox * 0.35 - ailment.elder * 0.2;
    ctx.beginPath();
    ctx.moveTo(headLen * 0.55, -0.22 * sc);
    ctx.lineTo(
      headLen * antennaReach,
      -0.82 * sc + Math.sin(ant.phase * (0.35 + ailment.intox * 2)) * (0.1 + ailment.intox * 0.35) * sc
    );
    ctx.moveTo(headLen * 0.55, 0.22 * sc);
    ctx.lineTo(
      headLen * antennaReach,
      0.82 * sc - Math.sin(ant.phase * (0.35 + ailment.intox * 2)) * (0.1 + ailment.intox * 0.35) * sc
    );
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function stepAnts(now) {
    var dt = Math.min(0.05, (now - antLast) / 1000);
    antLast = now;
    var pressure = envPressure();
    maybeRebuildColonySegmentCounts();
    var i = ants.length - 1;
    while (i >= 0) {
      var ant = ants[i];
      var age = now - ant.bornAt;
      ecoMutateStep(ant, dt, pressure, ecoFrameTick);
      var ailment = antAilment(ant, now);
      var hunger = 0.0052 + ant.speed * 0.000036 + (1 - ant.energy) * 0.0032;
      if (pressure.myceliumMass < 0.35) hunger += 0.0018;
      if (ailment.elder > 0.4) hunger += 0.0022 * ailment.elder;
      if (ant.energy < 0.22) hunger *= 0.82;
      if (pressure.belowFloor > 0) hunger *= 0.88;
      ant.energy -= dt * hunger;
      if (ant.energy <= 0 || age >= ant.lifespan) {
        spawnAntCorpse(ant);
        ants.splice(i, 1);
        i -= 1;
        continue;
      }
      if (ant.energy > 0.72 && age > ant.lifespan * 0.55 && ant.toxicity < 0.25) {
        ant.lifespan += dt * 12;
      }

      stepAntIntoxication(ant, dt, now);

      if (ailment.elder > 0.5 || age / ant.lifespan > 0.6) {
        ant.flying = true;
      }
      if (ant.flying) {
        initEntity5D(ant);
        ant.z += dt * (10 + ailment.elder * 26);
        ant.z = Math.min(ant.z, 120 + ailment.elder * 70);
        stepEntity5D(ant, dt, 1 + ailment.elder * 0.8);
        ant.speedTarget = Math.max(ant.speedTarget, 30 + ailment.elder * 42);
      }

      var massTau = 0.18 + ant.mass * 0.16 + ailment.elder * 0.12 + ailment.tox * 0.08;
      var paused = now < ant.pauseUntil || now < ant.intoxUntil;
      ant.resting = paused;

      if (ailment.elder > 0.42 && !ant.flying) {
        ant.speedTarget *= Math.max(0.35, 1 - ailment.elder * 0.48);
        if (Math.random() < dt * ailment.elder * 0.22) {
          ant.pauseUntil = Math.max(ant.pauseUntil, now + 400 + Math.random() * 1200);
        }
      }
      if (ailment.tox > 0.38) {
        ant.speedTarget *= Math.max(0.2, 1 - ailment.tox * 0.75);
        if (ant.speed < 20) {
          ant.wanderBias += (Math.random() - 0.5) * dt * (1.2 + ailment.tox * 3);
        }
      }
      if (ailment.tox > 0.62) {
        ant.energy -= dt * 0.009;
      }
      if (ailment.intox > 0.45 && Math.random() < dt * ailment.intox * 0.18 && ant.speed < 16) {
        ant.pauseUntil = Math.max(ant.pauseUntil, now + 300 + Math.random() * 900);
        ant.headAngle += (Math.random() - 0.5) * ailment.intox * 0.9;
      }

      if (!paused && now >= ant.nextShift) {
        pickAntIntent(ant, now);
      }

      if (paused) {
        ant.speedTarget = 0;
        ant.angleVel *= 1 - Math.min(1, dt * 4);
        stepAntBodyFlex(ant, dt, true, ailment, 1);
      } else {
        var turnAuth = antTurnAuthority(ant.speed);
        ant.wander += dt * (1.4 + ant.speed * 0.008) * (0.35 + turnAuth * 0.65);
        var steer =
          (Math.sin(ant.wander) * 0.48 +
          Math.sin(ant.wander * 0.37 + 1.8) * 0.2 +
          ant.wanderBias * 0.1) * turnAuth;
        var interest = antTendEggsInterest(ant, now) ||
          antColonyGrowthInterest(ant, now) ||
          antSpreadInterest(ant) ||
          antHiveTravelInterest(ant, now) ||
          myceliumInterest(ant);
        if (interest) {
          var seekWeight = 0.95 * (1 - ailment.elder * 0.45 - ailment.tox * 0.35);
          if (interest.traveling) {
            seekWeight = 1.15;
            ant.speedTarget = Math.max(ant.speedTarget, 34 + interest.weight * 32);
          }
          if (interest.spreading) {
            seekWeight = 1.2;
            ant.speedTarget = Math.max(ant.speedTarget, ant.flying ? 48 + interest.weight * 28 : 24 + interest.weight * 18);
          }
          if (interest.tending) {
            seekWeight = 1.35;
            ant.speedTarget = Math.min(ant.speedTarget, 10 + interest.weight * 8);
          }
          if (interest.nesting) {
            seekWeight = 1.35;
            ant.speedTarget = Math.min(ant.speedTarget, 11 + interest.weight * 10);
          }
          var bearErr = Math.abs(interest.steer);
          if (ant.speed > 22 && bearErr > 0.45) {
            ant.speedTarget = Math.min(ant.speedTarget, 14 + interest.weight * 18);
          }
          steer += interest.steer * interest.weight * seekWeight * turnAuth;
          if (!interest.traveling && !interest.tending && !interest.nesting && interest.dist < 28 && ant.fungusLoad < 0.55 && ailment.intox < 0.5) {
            ant.speedTarget = Math.min(ant.speedTarget, 10 + interest.weight * 6);
            if (Math.random() < dt * 0.35 * (1 - ailment.tox)) {
              ant.pauseUntil = now + 200 + Math.random() * 700;
            }
          } else if (!interest.traveling && !interest.tending && !interest.nesting && interest.dist < 90 && ailment.elder < 0.65 && turnAuth > 0.35) {
            ant.speedTarget = Math.max(ant.speedTarget, 28 + interest.weight * 22);
          }
        } else if (ailment.elder > 0.5) {
          ant.speedTarget = Math.min(ant.speedTarget, 18 + Math.random() * 12);
        }
        if (turnAuth < 0.12) {
          ant.angleVel *= 1 - Math.min(1, dt * 4.5);
        } else {
          ant.angleVel += (steer - ant.angleVel) * Math.min(1, dt * (0.2 + turnAuth * 1.35 - ailment.frail * 0.4));
        }
        var maxAngVel = (0.25 + turnAuth * 1.75) * (1 - ailment.frail * 0.42);
        ant.angleVel = Math.max(-maxAngVel, Math.min(maxAngVel, ant.angleVel));
        ant.headAngle += ant.angleVel * dt;
        stepAntBodyFlex(ant, dt, false, ailment, turnAuth);
      }

      ant.speed += (ant.speedTarget - ant.speed) * Math.min(1, dt / massTau);
      if (ant.speed > 0.4) {
        var head = antHeadAngle(ant);
        var sideSlip = (ant.flex || 0) * Math.min(ant.speed, 50) * 0.00075 * antTurnAuthority(ant.speed);
        var crawl = 1 - ailment.frail * 0.28;
        var drift = ant.flying ? spiralDrift(ant.w, ant.tPhase, ant.z) : { dx: 0, dy: 0 };
        ant.x += (Math.cos(head) - Math.sin(head) * sideSlip) * ant.speed * dt * crawl + drift.dx * dt;
        ant.y += (Math.sin(head) + Math.cos(head) * sideSlip) * ant.speed * dt * crawl + drift.dy * dt;
        markCoverage(ant.x, ant.y, ant.flying ? 0.05 : 0.028);
        if (ant.gaitPhase == null) ant.gaitPhase = ant.phase;
        ant.gaitPhase += dt * (3.6 + Math.sqrt(Math.min(ant.speed, 95)) * 0.5);
        ant.phase += dt * (0.85 + ailment.intox * 0.9);
      } else {
        ant.gaitPhase = (ant.gaitPhase != null ? ant.gaitPhase : ant.phase) + dt * 0.55;
        ant.phase += dt * 0.75;
      }

      wrapAnt(ant);

      antStimulateMycelium(ant, dt);
      antConsumeMycelium(ant, dt, now, pressure);
      if (antFedForBrood(ant)) {
        tendNearbyEggs(ant, now, dt);
      }
      tryLayAntEgg(ant, now, dt, pressure);

      var spStep = Math.max(1, Math.floor(myceliumSpores.length / 20));
      var s;
      for (s = 0; s < myceliumSpores.length; s += spStep) {
        var sp = myceliumSpores[s];
        var sdx = sp.x - ant.x;
        var sdy = sp.y - ant.y;
        if (sdx * sdx + sdy * sdy < 144 && ant.speed > 2) {
          var head = antHeadAngle(ant);
          sp.vx += Math.cos(head) * ant.speed * 0.035;
          sp.vy += Math.sin(head) * ant.speed * 0.035;
        }
      }
      i -= 1;
    }
    if (ants.length < MAX_ANTS && Math.random() < dt * (0.55 + pressure.antScarcity * 0.45) * (1 - pressure.antCrowd * 0.35)) {
      tryAntBirth(now);
    }
    tryAntRecruit(now, dt);
    sustainAntColony(now, dt);
  }

  function drawAnts(now) {
    if (!antCtx) return;
    antCtx.clearRect(0, 0, antW, antH);
    var i;
    for (i = 0; i < ants.length; i += 1) {
      drawAnt(antCtx, ants[i], now);
    }
  }

  function antLoop(now) {
    if (!tabHidden && !reduced) {
      stepAnts(now);
      drawAnts(now);
    }
    antRaf = window.requestAnimationFrame(antLoop);
  }

  function startAnts() {
    if (!antCanvas || reduced) return;
    antCtx = antCanvas.getContext("2d");
    resizeAnts();
    ants = [];
    antEggs = [];
    antEggId = 0;
    antLast = performance.now();
    if (!cosmology) computeCosmology(true);
    var colonies = myceliumColonies.length ? myceliumColonies : [];
    var spawnPlan = cosmologyAntSpawnPlan(colonies);
    var c;
    var ai = 0;
    for (c = 0; c < colonies.length; c += 1) {
      var colony = colonies[c];
      var n = spawnPlan[c] || 0;
      var j;
      for (j = 0; j < n; j += 1) {
        var ant = spawnAnt(antLast, {
          x: colony.anchorX + cosmoJitter(50 + ai * 1.7, 56),
          y: colony.anchorY + cosmoJitter(51 + ai * 1.9, 56),
          angle: colony.biasAngle + cosmoJitter(52 + ai * 2.1, 0.95),
          homeColonyId: colony.id
        });
        ants.push(ant);
        ai += 1;
      }
    }
    if (antRaf) window.cancelAnimationFrame(antRaf);
    antRaf = window.requestAnimationFrame(antLoop);
  }

  function stopAnts() {
    if (antRaf) {
      window.cancelAnimationFrame(antRaf);
      antRaf = null;
    }
  }

  if (!reduced && (myceliumCanvas || spiderCanvas || antCanvas)) {
    if (myceliumCanvas) startMycelium();
    if (spiderCanvas) startSpiders();
    if (antCanvas) startAnts();
    window.addEventListener("resize", onEnvironmentResize);
  } else {
    if (myceliumCanvas) myceliumCanvas.style.display = "none";
    if (spiderCanvas) spiderCanvas.style.display = "none";
    if (antCanvas) antCanvas.style.display = "none";
  }

  window.setInterval(function () {
    if (running) updateProgress();
  }, 200);
})();
