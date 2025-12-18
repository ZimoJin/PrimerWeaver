import * as CORE from './core_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';

export function initRECloning(container){
  if (typeof window !== 'undefined') {
    window.CORE = CORE;
    window.VIZ = VIZ;
    window._ggHasResults = false;
    window._ggPrimers = null;
  }

  (function(){
  function cleanFasta(raw){ return (raw||'').toUpperCase().replace(/^>.*$/gm,'').replace(/[^ACGT]/g,''); }
  const comp = {A:'T',T:'A',G:'C',C:'G'};
  const IUPAC_COMP = {
    A:"T", T:"A", C:"G", G:"C", R:"Y", Y:"R", S:"S", W:"W",
    K:"M", M:"K", B:"V", V:"B", D:"H", H:"D", N:"N"
  };
  function rc(s){ return s.split('').reverse().map(b=>comp[b]||'N').join(''); }
  
  // Apply reverse complement to textarea (preserves FASTA format like QC)
  function applyRCToTextarea(textareaElement){
    if (!textareaElement) return;
    const raw = (textareaElement.value || "").trim();
    if (!raw){
      return;
    }
    const lines = raw.split(/\r?\n/);
    const records = [];
    let header = null;
    let seqLines = [];

    function pushOne(){
      if (!header) return;
      const seq = seqLines.join('').replace(/\s+/g,'').toUpperCase();
      if (seq){
        records.push({ header, seq });
      }
    }

    for (const line of lines){
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('>')){
        pushOne();
        header = trimmed;
        seqLines = [];
      } else {
        seqLines.push(trimmed);
      }
    }
    pushOne();

    // If no FASTA headers found, treat entire textarea as one sequence (backward compatible)
    if (records.length === 0){
      const seq = raw.replace(/\s+/g,'').toUpperCase();
      if (!seq) return;
      records.push({ header: '>RC', seq });
    }

    function rcSeq(s){
      return s.split('').reverse().map(b => IUPAC_COMP[b] || comp[b] || 'N').join('');
    }

    textareaElement.value = records
      .map(r => r.header + '\n' + rcSeq(r.seq))
      .join('\n');
  }
  function gcPct(s){ return s? (100*((s.match(/[GC]/g)||[]).length)/s.length):0; }

    const RE_ENZYMES = {
    AatII: { site:'GACGTC', cut5:5, sticky:'ACGT' },
    Acc65I: { site:'GGTACC', cut5:1, sticky:'GTAC' },
    AclI: { site:'AACGTT', cut5:2, sticky:'CG' },
    AfeI: { site:'AGCGCT', cut5:3 },
    AflII: { site:'CTTAAG', cut5:1, sticky:'TTAA' },
    AgeI: { site:'ACCGGT', cut5:1, sticky:'CCGG' },
    AluI: { site:'AGCT', cut5:2 },
    ApaI: { site:'GGGCCC', cut5:5, sticky:'GGCC' },
    ApaLI: { site:'GTGCAC', cut5:1, sticky:'TGCA' },
    AscI: { site:'GGCGCGCC', cut5:2, sticky:'CGCG' },
    AseI: { site:'ATTAAT', cut5:2, sticky:'TA' },
    AsiSI: { site:'GCGATCGC', cut5:5, sticky:'AT' },
    AvrII: { site:'CCTAGG', cut5:1, sticky:'CTAG' },
    BamHI: { site:'GGATCC', cut5:1, sticky:'GATC' },
    BclI: { site:'TGATCA', cut5:1, sticky:'GATC' },
    BglII: { site:'AGATCT', cut5:1, sticky:'GATC' },
    BmtI: { site:'GCTAGC', cut5:5, sticky:'CTAG' },
    BsiWI: { site:'CGTACG', cut5:1, sticky:'GTAC' },
    BspDI: { site:'ATCGAT', cut5:2, sticky:'CG' },
    BspEI: { site:'TCCGGA', cut5:1, sticky:'CCGG' },
    BspHI: { site:'TCATGA', cut5:1, sticky:'CATG' },
    BsrGI: { site:'TGTACA', cut5:1, sticky:'GTAC' },
    BssHII: { site:'GCGCGC', cut5:1, sticky:'CGCG' },
    BstBI: { site:'TTCGAA', cut5:2, sticky:'CG' },
    BstUI: { site:'CGCG', cut5:2 },
    ClaI: { site:'ATCGAT', cut5:2, sticky:'CG' },
    DraI: { site:'TTTAAA', cut5:3 },
    EagI: { site:'CGGCCG', cut5:1, sticky:'GGCC' },
    Eco53kI: { site:'GAGCTC', cut5:3 },
    EcoRI: { site:'GAATTC', cut5:1, sticky:'AATT' },
    EcoRV: { site:'GATATC', cut5:3 },
    FseI: { site:'GGCCGGCC', cut5:6, sticky:'CCGG' },
    FspI: { site:'TGCGCA', cut5:3 },
    HaeIII: { site:'GGCC', cut5:2 },
    HhaI: { site:'GCGC', cut5:3, sticky:'CG' },
    HindIII: { site:'AAGCTT', cut5:1, sticky:'AGCT' },
    HpaI: { site:'GTTAAC', cut5:3 },
    HpaII: { site:'CCGG', cut5:1, sticky:'CG' },
    HpyCH4IV: { site:'ACGT', cut5:1, sticky:'CG' },
    HpyCH4V: { site:'TGCA', cut5:2 },
    KasI: { site:'GGCGCC', cut5:1, sticky:'GCGC' },
    KpnI: { site:'GGTACC', cut5:5, sticky:'GTAC' },
    MauBI: { site:'CGCGCGCG', cut5:2, sticky:'CGCG' },
    MfeI: { site:'CAATTG', cut5:1, sticky:'AATT' },
    MluI: { site:'ACGCGT', cut5:1, sticky:'CGCG' },
    MreI: { site:'CGCCGGCG', cut5:2, sticky:'CCGG' },
    MscI: { site:'TGGCCA', cut5:3 },
    MseI: { site:'TTAA', cut5:1, sticky:'TA' },
    MspI: { site:'CCGG', cut5:1, sticky:'CG' },
    NaeI: { site:'GCCGGC', cut5:3 },
    NarI: { site:'GGCGCC', cut5:2, sticky:'CG' },
    NcoI: { site:'CCATGG', cut5:1, sticky:'CATG' },
    NdeI: { site:'CATATG', cut5:2, sticky:'TA' },
    NgoMIV: { site:'GCCGGC', cut5:1, sticky:'CCGG' },
    NheI: { site:'GCTAGC', cut5:1, sticky:'CTAG' },
    NotI: { site:'GCGGCCGC', cut5:2, sticky:'GGCC' },
    NruI: { site:'TCGCGA', cut5:3 },
    NsiI: { site:'ATGCAT', cut5:5, sticky:'TGCA' },
    PacI: { site:'TTAATTAA', cut5:5, sticky:'AT' },
    PaeR7I: { site:'CTCGAG', cut5:1, sticky:'TCGA' },
    PciI: { site:'ACATGT', cut5:1, sticky:'CATG' },
    PhoI: { site:'GGCC', cut5:2 },
    PluTI: { site:'GGCGCC', cut5:5, sticky:'GCGC' },
    PmeI: { site:'GTTTAAAC', cut5:4 },
    PmlI: { site:'CACGTG', cut5:3 },
    PsiI: { site:'TTATAA', cut5:3 },
    PspOMI: { site:'GGGCCC', cut5:1, sticky:'GGCC' },
    PstI: { site:'CTGCAG', cut5:5, sticky:'TGCA' },
    PvuI: { site:'CGATCG', cut5:4, sticky:'AT' },
    PvuII: { site:'CAGCTG', cut5:3 },
    RsaI: { site:'GTAC', cut5:2 },
    SacI: { site:'GAGCTC', cut5:5, sticky:'AGCT' },
    SacII: { site:'CCGCGG', cut5:4, sticky:'GC' },
    SalI: { site:'GTCGAC', cut5:1, sticky:'TCGA' },
    SbfI: { site:'CCTGCAGG', cut5:6, sticky:'TGCA' },
    ScaI: { site:'AGTACT', cut5:3 },
    SfoI: { site:'GGCGCC', cut5:3 },
    SgrAI: { site:'CRCCGGYG', cut5:2, sticky:'CCGG' },
    SmaI: { site:'CCCGGG', cut5:3 },
    SmlI: { site:'CTYRAG', cut5:1, sticky:'TYRA' },
    SnaBI: { site:'TACGTA', cut5:3 },
    SphI: { site:'GCATGC', cut5:5, sticky:'CATG' },
    SrfI: { site:'GCCCGGGC', cut5:4 },
    SspI: { site:'AATATT', cut5:3 },
    StuI: { site:'AGGCCT', cut5:3 },
    SwaI: { site:'ATTTAAAT', cut5:4 },
    TaqI: { site:'TCGA', cut5:1, sticky:'CG' },
    TauI: { site:'GCSGC', cut5:4, sticky:'CSG' },
    TspMI: { site:'CCCGGG', cut5:1, sticky:'CCGG' },
    XbaI: { site:'TCTAGA', cut5:1, sticky:'CTAG' },
    XhoI: { site:'CTCGAG', cut5:1, sticky:'TCGA' },
    XmaI: { site:'CCCGGG', cut5:1, sticky:'CCGG' },
    ZraI: { site:'GACGTC', cut5:3 }
  };

  function findRESites(seq, site){
    const pos = [];
    if(!seq || !site) return pos;
    for(let i=0;i<=seq.length-site.length;i++){
      if(seq.slice(i,i+site.length)===site) pos.push(i);
    }
    return pos;
  }

  
  function analyzeVectorDigest(vec, enz1, enz2){
    const N = vec.length;
    const s1 = findRESites(vec, enz1.site);
    const s2 = findRESites(vec, enz2.site);
    const n1 = s1.length;
    const n2 = s2.length;

    // Build list of all cut positions on circular vector
    const cuts = [];
    s1.forEach(p => cuts.push({pos:(p + enz1.cut5) % N, enz:1}));
    s2.forEach(p => cuts.push({pos:(p + enz2.cut5) % N, enz:2}));
    cuts.sort((a,b) => a.pos - b.pos);

    let allFrags = [];
    let longestFragLen = 0;
    let backboneStart = 0;
    let backboneEnds = {left:null,right:null};

    if(cuts.length > 0){
      for(let i=0;i<cuts.length;i++){
        const start = cuts[i].pos;
        const end   = cuts[(i+1) % cuts.length].pos;
        const len = (end - start + N) % N || N;
        allFrags.push(len);
        if(len >= longestFragLen){
          longestFragLen = len;
          backboneStart = start;
          backboneEnds = {left: cuts[i].enz, right: cuts[(i+1)%cuts.length].enz};
        }
      }
    }else{
      allFrags = [N];
    }

    // Flag if the longest fragment behaves like a single-enzyme backbone
    // (both ends cut by the same enzyme)
    const pseudoSingle = (backboneEnds.left !== null &&
                          backboneEnds.left === backboneEnds.right);

    return { sites1:s1, sites2:s2, n1, n2, longestFragLen, backboneStart, backboneEnds, allFrags, pseudoSingle };
  }
function subseqCircular(seq, start, len){
    const N = seq.length;
    if(!N || len<=0) return '';
    start = ((start % N)+N)%N;
    if(start+len <= N) return seq.slice(start,start+len);
    return seq.slice(start) + seq.slice(0,(start+len)%N);
  }

  const NN = {'AA':{dH:-7.9,dS:-22.2},'TT':{dH:-7.9,dS:-22.2},'AT':{dH:-7.2,dS:-20.4},'TA':{dH:-7.2,dS:-21.3},
  'CA':{dH:-8.5,dS:-22.7},'TG':{dH:-8.5,dS:-22.7},'GT':{dH:-8.4,dS:-22.4},'AC':{dH:-8.4,dS:-22.4},
  'CT':{dH:-7.8,dS:-21.0},'AG':{dH:-7.8,dS:-21.0},'GA':{dH:-8.2,dS:-22.2},'TC':{dH:-8.2,dS:-22.2},
  'CG':{dH:-10.6,dS:-27.2},'GC':{dH:-9.8,dS:-24.4},'GG':{dH:-8.0,dS:-19.9},'CC':{dH:-8.0,dS:-19.9}};
  const Rgas = 1.987;
  function tmNEB(seq, Na_mM=50, conc_nM=500){
    const s=seq.toUpperCase(); if(!s || s.length<2) return NaN;
    let dH=0, dS=0;
    for(let i=0;i<s.length-1;i++){
      const p=NN[s.slice(i,i+2)]; if(!p) return NaN;
      dH+=p.dH; dS+=p.dS;
    }
    dH+=0.2; dS+=-5.7;
    const Cp=conc_nM*1e-9;
    const Tm1M_K=(1000*dH)/(dS + Rgas*Math.log(Cp));
    const m=Na_mM/1000;
    const fgc=((s.match(/[GC]/g)||[]).length)/s.length;
    const term=((4.29*fgc - 3.95)*Math.log(m) + 0.94*Math.log(m)**2) * 1e-5;
    return (1/(1/Tm1M_K + term)) - 273.15;
  }

  function pickCorePrimerForward(seq, tmTarget, Na, conc){
    const minL=18, maxL=28; let best=seq.slice(0,minL);
    for(let L=minL; L<=maxL; L++){
      const cand=seq.slice(0,L);
      const ok3=/[GC]$/.test(cand);
      const Tm=tmNEB(cand,Na,conc);
      if(ok3 && Tm>=tmTarget-0.5) return cand;
      best=cand;
    }
    return best;
  }
  function pickCorePrimerReverse(seq, tmTarget, Na, conc){
    const minL=18, maxL=28; let best=rc(seq.slice(-minL));
    for(let L=minL; L<=maxL; L++){
      const core=seq.slice(-L);
      const p=rc(core);
      const ok3=/[GC]$/.test(p);
      const Tm=tmNEB(p,Na,conc);
      if(ok3 && Tm>=tmTarget-0.5) return p;
      best=p;
    }
    return best;
  }

  function makeSmartClamp(n){
    if(!n || n <= 0) return "";
    const bases = ['A','C','G','T'];
    function randomSeq(){
      let s = "";
      for(let i=0;i<n;i++){
        let base;
        let attempts = 0;
        do{
          base = bases[Math.floor(Math.random()*4)];
          attempts++;
        }while(
          attempts < 8 &&
          i >= 3 &&
          s[i-1] === base &&
          s[i-2] === base &&
          s[i-3] === base
        );
        s += base;
      }
      return s;
    }
    for(let tries=0; tries<200; tries++){
      const s = randomSeq();
      if(/A{4,}|C{4,}|G{4,}|T{4,}/.test(s)) continue;
      const rcS = rc(s);
      if(s === rcS) continue;
      return s;
    }
    return 'ACGTACGTAC'.slice(0, n);
  }

  function parseHeader(raw){
    if(!raw) return null;
    const m = raw.match(/^>([^\r\n]+)/m);
    if(!m) return null;
    return m[1].trim().split(/\s+/)[0];
  }

  function designREPrimers(insertRaw, enz1Name, enz2Name, clampN, tmTarget, Na, conc){
    const insertClean = cleanFasta(insertRaw||'');
    const headerName = parseHeader(insertRaw);
    const primers = [];
    if(!insertClean){
      primers.push({
        name:'Insert #1',
        error:'Empty insert sequence',
        insertName:headerName||null,
        labelF:(headerName?headerName+'-F':'Insert1-F'),
        labelR:(headerName?headerName+'-R':'Insert1-R'),
        baseTag:headerName||'insert1'
      });
      return {primers, pcrSize:0, insertLen:0};
    }
    const enz1 = RE_ENZYMES[enz1Name];
    const enz2 = RE_ENZYMES[enz2Name];
    const siteF = enz1.site;
    const siteR = enz2.site;

    const Fcore = pickCorePrimerForward(insertClean, tmTarget, Na, conc);
    const Rcore = pickCorePrimerReverse(insertClean, tmTarget, Na, conc);
    const clamp = makeSmartClamp(clampN);

    const F = clamp + siteF + Fcore;
    const R = clamp + siteR + Rcore;

    const lenInsert = insertClean.length;
    const extraF = F.length - Fcore.length;
    const extraR = R.length - Rcore.length;
    const pcrSize = lenInsert + extraF + extraR;

    primers.push({
      name:'Insert #1',
      len:lenInsert,
      OH_L:enz1.sticky || '',
      OH_R:enz2.sticky || '',
      F,R,Fcore,Rcore,
      tmF:tmNEB(Fcore,Na,conc),
      tmR:tmNEB(Rcore,Na,conc),
      labelF:(headerName?headerName+'-F':'Insert1-F'),
      labelR:(headerName?headerName+'-R':'Insert1-R'),
      insertName:headerName||null,
      baseTag:headerName||'insert1',
      clampLen:clampN,
      siteF,siteR
    });
    return {primers, pcrSize, insertLen:lenInsert};
  }

  const PAL = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#FFEB06'];

  function renderOHTable(junctions, insertNames, vectorName){
    if(!junctions || !junctions.length){
      return '<div class="aside">No junctions.</div>';
    }
    insertNames = insertNames || [];
    function sideTag(label, side){
      if(!label) return '';
      let base = '';
      const mVI = label.match(/^Vector ?Insert #(\d+)/);
      if(mVI){
        base = (side === 'left') ? 'Vector' : `Insert #${mVI[1]}`;
      } else {
        const mIV = label.match(/^Insert #(\d+) ?Vector/);
        if(mIV){
          base = (side === 'left') ? `Insert #${mIV[1]}` : 'Vector';
        } else {
          const mII = label.match(/^Insert #(\d+) ?Insert #(\d+)/);
          if(mII){
            base = (side === 'left') ? `Insert #${mII[1]}` : `Insert #${mII[2]}`;
          }
        }
      }
      if(!base) return '';
      if(base === 'Vector' && vectorName){
        return `Vector, ${vectorName}`;
      }
      const mIns = base.match(/^Insert #(\d+)/);
      if(mIns){
        const idx = parseInt(mIns[1],10)-1;
        const nm = insertNames[idx];
        if(nm){
          return `Insert #${mIns[1]}, ${nm}`;
        }
      }
      return base;
    }
    let rows = '';
    for(let i=0;i<junctions.length;i++){
      const j = junctions[i] || {};
      const color = PAL[Math.min(i, PAL.length-1)];
      const label = j.label || `Junction #${i+1}`;
      let left  = j.leftOH || '';
      let right = j.rightOH || '';
      if(!left) left = 'blunt';
      if(!right) right = 'blunt';
      const leftSource  = sideTag(label,'left');
      const rightSource = sideTag(label,'right');
      rows += `<tr>
        <td><span class="oh-chip"><span class="swatch" style="background:${color}"></span></span></td>
        <td class="oh-seq mono">${left}${leftSource ? ` (${leftSource})` : ''}</td>
        <td class="oh-seq mono">${right}${rightSource ? ` (${rightSource})` : ''}</td>
      </tr>`;
    }
    return `<table>
      <thead>
        <tr>
          <th>Junction</th>
          <th>Left sticky end (5'→3')</th>
          <th>Right sticky end (5'→3')</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const NN2 = NN;
  function cleanSeq(r){ return (r||"").toUpperCase().replace(/[^ACGT]/g,""); }
  function has3GCClamp(s){
    if(!s.length) return false;
    const c = s[s.length-1];
    return c==="G" || c==="C";
  }
  function hasHomopolymer(s,n){ return new RegExp("A{"+n+",}|C{"+n+",}|G{"+n+",}|T{"+n+",}").test((s||"").toUpperCase()); }
  function duplexDG37(seq){
    const s = (seq||"").toUpperCase();
    if(s.length<2) return NaN;
    let dH=0,dS=0;
    for(let i=0;i<s.length-1;i++){
      const p = NN2[s.slice(i,i+2)];
      if(!p) return NaN;
      dH += p.dH;
      dS += p.dS;
    }
    dH += 0.2;
    dS += -5.7;
    const T = 310.15;
    return dH - T*dS/1000;
  }
  function fmt2(x){return isFinite(x)?x.toFixed(2):"--";}
  function badge(cls,txt){return '<span class="badge '+cls+'">'+txt+'</span>';}
  function classifyDG(dg,t3){
    if(!isFinite(dg)) return {label:"None",cls:"ok"};
    let label,cls;
    if(dg<=-7){label="Very strong";cls="bad";}
    else if(dg<=-5){label="Strong";cls="bad";}
    else if(dg<=-3){label="Moderate";cls="warn";}
    else {label="Weak";cls="ok";}
    if(t3 && cls!=="ok") label="3' "+label;
    return {label,cls};
  }
  function dimerScan(seqA, seqB){
    const A = (seqA||"").toUpperCase();
    const B = (seqB||"").toUpperCase();
    const Brev = B.split("").reverse().join("");
    const n=A.length, m=Brev.length;
    const minLen=3;
    let best=null;
    for(let offset=-m+1; offset<=n-1; offset++){
      let cur="", aStart=null, bStart=null;
      for(let i=0;i<n;i++){
        const j = i-offset;
        if(j<0 || j>=m){
          if(cur.length>=minLen) recordSeg(cur,aStart,bStart,offset);
          cur=""; aStart=null; bStart=null;
          continue;
        }
        const a=A[i], b=Brev[j];
        if(comp[a]===b){
          if(cur.length===0){aStart=i;bStart=j;}
          cur+=a;
        }else{
          if(cur.length>=minLen) recordSeg(cur,aStart,bStart,offset);
          cur=""; aStart=null; bStart=null;
        }
      }
      if(cur.length>=minLen) recordSeg(cur,aStart,bStart,offset);
    }
    function recordSeg(seg,aStart,bStart,offset){
      const dg = duplexDG37(seg);
      const aEnd=aStart+seg.length-1;
      const bEnd=bStart+seg.length-1;
      const touches3 = (aEnd>=A.length-3) || (bEnd>=Brev.length-3);
      if(
        !best ||
        dg<best.dg-0.1 ||
        (Math.abs(dg-best.dg)<=0.1 && touches3 && !best.touches3)
      ){
        best = {seg,dg,len:seg.length,touches3,offset};
      }
    }
    if(!best) return null;
    let minI=Math.min(0,best.offset);
    let maxI=Math.max(n,m+best.offset);
    let lineA="",lineB="",lineM="";
    for(let pos=minI; pos<maxI; pos++){
      const i=pos;
      const j=pos-best.offset;
      const a=(i>=0 && i<n)?A[i]:" ";
      const b=(j>=0 && j<m)?Brev[j]:" ";
      lineA+=a;
      lineB+=b;
      lineM += (a!==" " && b!==" " && comp[a]===b)?"|":" ";
    }
    const align = "5' "+lineA+" 3'\n   "+lineM+"\n3' "+lineB+" 5'";
    return {seg:best.seg,dg:best.dg,len:best.len,touches3:best.touches3,align};
  }
  function threePrimeDG(seq){
    const s = (seq||"").toUpperCase();
    if(s.length<5) return NaN;
    return duplexDG37(s.slice(-5));
  }
  function hairpinScan(seq){
    const s = (seq||"").toUpperCase();
    const n = s.length;
    const minStem=4, minLoop=3;
    let best=null;
    for(let i=0;i<n;i++){
      for(let j=i+minLoop+minStem;j<n;j++){
        let a=i,b=j,seg="";
        while(a>=0 && b<n && comp[s[a]]===s[b]){
          seg = s[a] + seg;
          a--; b++;
        }
        if(seg.length>=minStem){
          const dg = duplexDG37(seg);
          const touches3 = (j>=n-5) || (b-1>=n-5);
          if(!best || dg<best.dg-0.1){
            best = {seg,dg,touches3};
          }
        }
      }
    }
    if(!best) return null;
    return {seg:best.seg,dg:best.dg,touches3:best.touches3};
  }
  function analyzePrimer(label, fullSeq, coreSeq, Na, conc){
    const seq = cleanSeq(fullSeq);
    const core = cleanSeq(coreSeq || fullSeq);
    if(!seq || !core) return {label,empty:true};
    const lenCore = core.length;
    const gcCore = gcPct(core);
    const tmCore = tmNEB(core, Na, conc);
    const tmFull = tmNEB(seq, Na, conc);
    const clamp = has3GCClamp(seq);
    const homopoly = hasHomopolymer(seq,4);
    const dg3 = threePrimeDG(seq);
    const dg3Bad = isFinite(dg3) && dg3<=-3;
    const selfD = dimerScan(seq,seq);
    const selfClass = selfD ? classifyDG(selfD.dg,selfD.touches3) : {label:"None",cls:"ok"};
    const hp = hairpinScan(seq);
    const hpClass = hp ? classifyDG(hp.dg,hp.touches3) : {label:"None",cls:"ok"};
    return {
      label,seq,core,lenCore,gcCore,tmCore,tmFull,
      clamp,homopoly,dg3,dg3Bad,
      selfD,selfClass,
      hp,hpClass,
      empty:false
    };
  }
  function qcPair(F,R){
    if(!F || !R || F.empty || R.empty) return null;
    const d = dimerScan(F.seq,R.seq);
    const info = d ? classifyDG(d.dg,d.touches3) : {label:"None",cls:"ok"};
    return {dimer:d,info};
  }

  function buildSeqCell(seqCore, fullSeq, overhangSeq, clampLen, siteSeq){
    const len = fullSeq.length;
    const gc = gcPct(fullSeq);

    let coreIdx = fullSeq.lastIndexOf(seqCore);
    if (coreIdx < 0) coreIdx = fullSeq.length - seqCore.length;
    const prefix = fullSeq.slice(0, coreIdx);
    const core = fullSeq.slice(coreIdx);

    const cLen = clampLen || 0;
    const clampPart = prefix.slice(0, cLen);
    let rest = prefix.slice(cLen);

    let sitePart = '';
    let offsetPart = '';
    if(siteSeq && rest.startsWith(siteSeq)){
      sitePart = rest.slice(0, siteSeq.length);
      offsetPart = rest.slice(siteSeq.length);
    }else{
      offsetPart = rest;
    }

    let siteDisp = sitePart;
    const oh = overhangSeq || '';
    if(sitePart && oh){
      const idx = sitePart.indexOf(oh);
      if(idx >= 0){
        siteDisp = sitePart.slice(0, idx) + '<b>' + oh + '</b>' +
                   sitePart.slice(idx + oh.length);
      }
    }

    const coreMarkup = core;

    const disp =
      (clampPart ? '<i>' + clampPart + '</i>' : '') +
      (siteDisp ? '<u>' + siteDisp + '</u>' : '') +
      offsetPart +
      coreMarkup;

    return {disp, len, gc};
  }

  function renderPrimerBlocks(primers){
    const Na = parseFloat(document.getElementById('gg-na').value || '50');
    const conc = parseFloat(document.getElementById('gg-conc').value || '500');

    let out = '';
    const clampLen = (primers[0] && primers[0].clampLen) || 0;

    primers.forEach((p, i) => {
      const insertLabel = p.insertName
        ? ('Insert #' + (i+1) + ' (' + p.insertName + ', len: ' + p.len + ' bp)')
        : ('Insert #' + (i+1) + ' (len: ' + p.len + ' bp)');

      if (p.error) {
        out += '<div class="box" style="margin-bottom:8px">' +
          '<h3>' + insertLabel + '</h3>' +
          '<div style="color:#b91c1c">' + p.error + '</div>' +
          '</div>';
        return;
      }

      const labelF = p.labelF || 'Forward';
      const labelR = p.labelR || 'Reverse';

      const Fqc = analyzePrimer(labelF, p.F, p.Fcore, Na, conc);
      const Rqc = analyzePrimer(labelR, p.R, p.Rcore, Na, conc);
      const pair = qcPair(Fqc, Rqc);

      const Fseq = buildSeqCell(p.Fcore, p.F, p.OH_L, clampLen, p.siteF || '');
      const Rseq = buildSeqCell(p.Rcore, p.R, p.OH_R, clampLen, p.siteR || '');

      const F_tmCore = fmt2(Fqc.tmCore);
      const F_tmFull = fmt2(Fqc.tmFull);
      const F_homopoly = Fqc.homopoly ? badge("warn","repeat") : badge("ok","OK");
      const F_hairpin  = badge(Fqc.hpClass.cls, Fqc.hpClass.label);
      const F_self     = badge(Fqc.selfClass.cls, Fqc.selfClass.label);

      const R_tmCore = fmt2(Rqc.tmCore);
      const R_tmFull = fmt2(Rqc.tmFull);
      const R_homopoly = Rqc.homopoly ? badge("warn","repeat") : badge("ok","OK");
      const R_hairpin  = badge(Rqc.hpClass.cls, Rqc.hpClass.label);
      const R_self     = badge(Rqc.selfClass.cls, Rqc.selfClass.label);

      let crossBadge = '';
      if (pair && pair.info) {
        crossBadge = badge(pair.info.cls, pair.info.label);
      } else {
        crossBadge = badge("ok","None");
      }

      out += '<div class="box" style="margin-bottom:10px">' +
        '<h3>' + insertLabel + '</h3>' +
        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th>Primer</th>' +
              '<th>Sequence (5\'→3\')</th>' +
              '<th style="text-align: center;">Len</th>' +
              '<th style="text-align: center;">GC%</th>' +
              '<th style="text-align: center;">Tm (core/full, °C)</th>' +
              '<th style="text-align: center;">Homopolymer</th>' +
              '<th style="text-align: center;">Hairpin</th>' +
              '<th style="text-align: center;">Self-dimer</th>' +
              '<th style="text-align: center;">Cross-dimer</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr>' +
              '<td>' + labelF + '</td>' +
              '<td class="mono seqcell">' + Fseq.disp + '</td>' +
              '<td style="text-align: center;">' + Fseq.len + '</td>' +
              '<td style="text-align: center;">' + Fseq.gc.toFixed(1) + '%</td>' +
              '<td style="text-align: center;">' + F_tmCore + ' / ' + F_tmFull + '</td>' +
              '<td style="text-align: center;">' + F_homopoly + '</td>' +
              '<td style="text-align: center;">' + F_hairpin + '</td>' +
              '<td style="text-align: center;">' + F_self + '</td>' +
              '<td rowspan="2" style="vertical-align:middle;text-align:center;">' + crossBadge + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td>' + labelR + '</td>' +
              '<td class="mono seqcell">' + Rseq.disp + '</td>' +
              '<td style="text-align: center;">' + Rseq.len + '</td>' +
              '<td style="text-align: center;">' + Rseq.gc.toFixed(1) + '%</td>' +
              '<td style="text-align: center;">' + R_tmCore + ' / ' + R_tmFull + '</td>' +
              '<td style="text-align: center;">' + R_homopoly + '</td>' +
              '<td style="text-align: center;">' + R_hairpin + '</td>' +
              '<td style="text-align: center;">' + R_self + '</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    });
    return out;
  }

  const LADDER_PROFILES = {
    neb1kbplus: {
      name: 'NEB 1kb Plus DNA Ladder (default)',
      sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.2, 1.0,
                0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
      boldKb: [3.0, 1.0, 0.5]
    },
    neb1kb: {
      name: 'NEB 1kb DNA Ladder',
      sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.0, 0.5],
      boldKb: [3.0]
    },
    thermo1kbruler: {
      name: 'GeneRuler 1kb DNA Ladder',
      sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.5, 3.0, 2.5, 2.0,
                1.5, 1.0, 0.75, 0.5, 0.25],
      boldKb: [6.0, 3.0, 1.0]
    },
    thermo1kbplus: {
      name: 'GeneRuler 1kb Plus DNA Ladder',
      sizesKb: [20.0, 10.0, 7.0, 5.0, 4.0, 3.0, 2.0, 1.5,
                1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.075],
      boldKb: [5.0, 1.5, 0.5]
    }
  };

  const GGX_STATE = {
    lanes: [],
    scIdx: new Set([1,4]),
    profile: 'neb1kbplus',
    assembledLaneIndex: null,
    insertCount: 0,
       insertNames: [],
    vectorName: null,
    enzymeName: null,
    assembledName: null
  };

  const GG_A = 940.5477731863177;
  const GG_B = -180.54925772877257;
  function ggxYFromBp(bp){
    return GG_A + GG_B * Math.log10(bp);
  }
  function ggxScEffective(bp){
    return Math.max(100, bp * 0.7);
  }

  function ggxDrawGel(){
    const canvas = document.getElementById('gg-gel-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const bandTop   = 90;
    const bandRegionHeight = 520;
    const gelTop   = bandTop - 32;
    const gelLeft  = 180;
    const gelWidth = 560;
    const gelHeight = bandRegionHeight + 32;

    const gelGradient = ctx.createLinearGradient(0, gelTop, 0, gelTop + gelHeight);
    gelGradient.addColorStop(0, '#3a3a3a');
    gelGradient.addColorStop(0.5, '#333333');
    gelGradient.addColorStop(1, '#2f2f2f');
    ctx.fillStyle = gelGradient;
    ctx.fillRect(gelLeft, gelTop, gelWidth, gelHeight);

    const laneCount = 10;
    const wellWidth = 42;
    const wellHeight = 12;
    const laneSpacing = (gelWidth - laneCount * wellWidth) / (laneCount + 1);
    let x = gelLeft + laneSpacing;
    const wellY = gelTop + 8;

    ctx.fillStyle = '#050505';
    for(let i=0; i<laneCount; i++){
      ctx.fillRect(x, wellY, wellWidth, wellHeight);
      x += wellWidth + laneSpacing;
    }

    ctx.fillStyle = '#000000';
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    for(let i=0; i<laneCount; i++){
      const lx = gelLeft + laneSpacing * (i + 1) + wellWidth * (i + 0.5);
      ctx.fillText('L' + String(i+1), lx, gelTop - 10);
    }

    const prof = LADDER_PROFILES[GGX_STATE.profile] || LADDER_PROFILES.neb1kbplus;
    const ladderSizesKb = prof.sizesKb;
    const ladderSizesBp = ladderSizesKb.map(kb => kb * 1000);

    const boldKb = (prof.boldKb && prof.boldKb.length) ? prof.boldKb : [3.0, 1.0, 0.5];
    const brightSet = new Set(boldKb.map(kb => kb * 1000));
    const nonBrightKb = ladderSizesKb
      .filter(kb => !boldKb.includes(kb))
      .sort((a,b) => b-a);
    const mediumSet = new Set(nonBrightKb.slice(0,5).map(kb => kb * 1000));

    const markerLaneIndex = 0;
    const markerX = gelLeft + laneSpacing * (markerLaneIndex + 1) +
                    wellWidth * (markerLaneIndex + 0.5);

    const bandWidth  = 34;
    const bandHeight = 5;

    for(const bp of ladderSizesBp){
      const y = ggxYFromBp(bp);
      let alpha;
      if(brightSet.has(bp)) alpha = 0.96;
      else if(mediumSet.has(bp)) alpha = 0.78;
      else alpha = 0.58;

      ctx.fillStyle = 'rgba(255,255,255,'+alpha+')';
      const x0 = markerX - bandWidth/2;
      const y0 = y - bandHeight/2;
      const r = bandHeight/2;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + r);
      ctx.lineTo(x0, y0 + bandHeight - r);
      ctx.quadraticCurveTo(x0, y0 + bandHeight, x0 + r, y0 + bandHeight);
      ctx.lineTo(x0 + bandWidth - r, y0 + bandHeight);
      ctx.quadraticCurveTo(x0 + bandWidth, y0 + bandHeight, x0 + bandWidth, y0 + bandHeight - r);
      ctx.lineTo(x0 + bandWidth, y0 + r);
      ctx.quadraticCurveTo(x0 + bandWidth, y0, x0 + bandWidth - r, y0);
      ctx.lineTo(x0 + r, y0);
      ctx.quadraticCurveTo(x0, y0, x0, y0 + r);
      ctx.closePath();
      ctx.fill();
    }

    const lanes = GGX_STATE.lanes || [];
    for(let laneIdx=1; laneIdx<laneCount; laneIdx++){
      const cx = gelLeft + laneSpacing * (laneIdx + 1) +
                 wellWidth * (laneIdx + 0.5);
      const laneBands = lanes[laneIdx] || [];
      const isSC = GGX_STATE.scIdx && GGX_STATE.scIdx.has(laneIdx);
      for(const bp of laneBands){
        const effBp = isSC ? ggxScEffective(bp) : bp;
        const y = ggxYFromBp(effBp);
        const x0 = cx - bandWidth/2;
        const y0 = y - bandHeight/2;
        const r = bandHeight/2;
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.beginPath();
        ctx.moveTo(x0, y0 + r);
        ctx.lineTo(x0, y0 + bandHeight - r);
        ctx.quadraticCurveTo(x0, y0 + bandHeight, x0 + r, y0 + bandHeight);
        ctx.lineTo(x0 + bandWidth - r, y0 + bandHeight);
        ctx.quadraticCurveTo(x0 + bandWidth, y0 + bandHeight, x0 + bandWidth, y0 + bandHeight - r);
        ctx.lineTo(x0 + bandWidth, y0 + r);
        ctx.quadraticCurveTo(x0 + bandWidth, y0, x0 + bandWidth - r, y0);
        ctx.lineTo(x0 + r, y0);
        ctx.quadraticCurveTo(x0, y0, x0, y0 + r);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const labelX = gelLeft - 72;
    const connectorStartOffset = 8;
    const connectorMidX = gelLeft - 30;
    const connectorEndX = gelLeft - 6;
    let lastLabelY = -Infinity;
    const bandYs = ladderSizesKb.map(kb => ggxYFromBp(kb * 1000));

    ladderSizesKb.forEach((kb, idx)=>{
      const bandY = bandYs[idx];
      let minGap;
      if(idx === 0) minGap = 16;
      else{
        const prevBandY = bandYs[idx-1];
        const bandGap = Math.abs(bandY - prevBandY);
        if(bandGap < 10) minGap = 24;
        else if(bandGap < 18) minGap = 20;
        else minGap = 16;
      }
      let labelY = bandY;
      if(kb === 20.0) labelY = bandY - 6;
      if(labelY - lastLabelY < minGap) labelY = lastLabelY + minGap;
      lastLabelY = labelY;

      const label = kb.toFixed(1).replace(/\.0$/,'');
      const boldForLabels = (prof.boldKb && prof.boldKb.length) ? prof.boldKb : [3.0, 1.0, 0.5];
      if(boldForLabels.includes(kb)){
        ctx.font = "bold 20px 'Segoe UI', sans-serif";
      }else{
        ctx.font = "20px 'Segoe UI', sans-serif";
      }
      ctx.fillStyle = '#000000';
      ctx.fillText(label, labelX, labelY);

      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(labelX + connectorStartOffset, labelY);
      ctx.lineTo(connectorMidX, labelY);
      const midY = (labelY + bandY)/2;
      ctx.lineTo(connectorEndX, midY);
      ctx.lineTo(connectorEndX, bandY);
      ctx.stroke();
    });

    ctx.font = "24px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText('kb', gelLeft - 45, bandTop + 30);
  }

  function ggxFormatBands(arr){
    if(!arr || !arr.length) return '--';
    const sorted = arr.slice().sort((a,b)=>b-a);
    return sorted.map(x => x + ' bp').join(', ');
  }

  function ggxUpdateLegend(){
    const lanes = GGX_STATE.lanes || [];
    if(!lanes.length) return;
    const legend = [];
    const prof = LADDER_PROFILES[GGX_STATE.profile] || LADDER_PROFILES.neb1kbplus;
    legend.push('L1 DNA Ladder (' + prof.name + ')');

    const lane2 = lanes[1] || [];
    const lane3 = lanes[2] || [];
    const vName = GGX_STATE.vectorName || null;
    const enzName = GGX_STATE.enzymeName || null;

    const vLabel = vName ? ('L2 Uncut vector (' + vName + ')') : 'L2 Uncut vector';
    legend.push(vLabel + ': ' + ggxFormatBands(lane2));

    let digestBase = 'RE digest of vector';
    if(enzName){
      digestBase = enzName + ' digest of vector';
    }
    let digestLabel = 'L3 ' + digestBase;
    if(vName){
      digestLabel += ' (' + vName + ')';
    }
    legend.push(digestLabel + ': ' + ggxFormatBands(lane3));

    const insertCount = GGX_STATE.insertCount || 0;
    const assembledLaneIndex = GGX_STATE.assembledLaneIndex;
    const assembledDigestLaneIndex = GGX_STATE.assembledDigestLaneIndex;

    for(let i=0; i<insertCount; i++){
      const laneIdx = 3 + i;
      const sz = lanes[laneIdx] || [];
      const insName = (GGX_STATE.insertNames && GGX_STATE.insertNames[i]) ? ' (' + GGX_STATE.insertNames[i] + ')' : '';
      legend.push('L' + (laneIdx+1) + ' PCR of insert #' + (i+1) + insName + ': ' + ggxFormatBands(sz));
    }

    if(typeof assembledLaneIndex === 'number' && assembledLaneIndex >= 0){
      const last = lanes[assembledLaneIndex] || [];
      const asmName = GGX_STATE.assembledName || 'RE_assembled';
      legend.push('L' + (assembledLaneIndex+1) + ' Assembled plasmid (' + asmName + '): ' + ggxFormatBands(last));
      if(typeof assembledDigestLaneIndex === 'number' && assembledDigestLaneIndex >= 0){
        const dig = lanes[assembledDigestLaneIndex] || [];
        legend.push('L' + (assembledDigestLaneIndex+1) + ' ' +
          (enzName ? (enzName + ' digest of assembled plasmid') : 'RE digest of assembled plasmid') +
          ' (' + asmName + '): ' + ggxFormatBands(dig));
      }
    }

    document.getElementById('ggx-legend').innerHTML =
      legend.map(s => '<div>' + s + '</div>').join('');
  }

  window.showGel = function(vectorLen, cutFrags, pcrSizes, assembledLen, assembledDigestFrags, insertNames, vectorName, enzymeName, assembledName){
    const lane2 = Array.isArray(vectorLen) ? vectorLen : [vectorLen];
    let digest = (cutFrags && cutFrags.length) ? cutFrags.slice() : [];
    const inserts = (pcrSizes && pcrSizes.length) ? pcrSizes.slice() : [];
    const assembled = (assembledLen && assembledLen > 0)
      ? (Array.isArray(assembledLen) ? assembledLen : [assembledLen])
      : [];
    const assembledDigest = (assembledDigestFrags && assembledDigestFrags.length)
      ? assembledDigestFrags.slice()
      : [];

    if(!digest.length){
      digest = lane2.slice();
    }

    const lanes = Array.from({length:10}, ()=>[]);
    lanes[1] = lane2;
    lanes[2] = digest;

    const maxInserts = 6;
    let insertCount = 0;
    for(let i=0; i<inserts.length && insertCount<maxInserts; i++){
      const sz = inserts[i];
      if(sz && sz > 0){
        lanes[3 + insertCount] = [sz];
        insertCount++;
      }
    }

    let assembledLaneIndex = null;
    let assembledDigestLaneIndex = null;
    if(assembled.length){
      assembledLaneIndex = 3 + insertCount;
      if(assembledLaneIndex < 10){
        lanes[assembledLaneIndex] = assembled;
      }
      if(assembledDigest.length && assembledLaneIndex + 1 < 10){
        assembledDigestLaneIndex = assembledLaneIndex + 1;
        lanes[assembledDigestLaneIndex] = assembledDigest;
      }
    }

    GGX_STATE.lanes = lanes;
    GGX_STATE.scIdx = new Set([1].concat(assembledLaneIndex !== null ? [assembledLaneIndex] : []));
    GGX_STATE.assembledLaneIndex = assembledLaneIndex;
    GGX_STATE.assembledDigestLaneIndex = assembledDigestLaneIndex;
    GGX_STATE.insertCount = insertCount;
    GGX_STATE.insertNames = Array.isArray(insertNames) ? insertNames.slice(0, insertCount) : [];
    GGX_STATE.vectorName = vectorName || null;
    GGX_STATE.enzymeName = enzymeName || null;
    GGX_STATE.assembledName = assembledName || null;

    ggxDrawGel();
    ggxUpdateLegend();

    const sec = document.getElementById('gg-gel-section');
    if(sec) sec.style.display = '';
  };

  document.getElementById('ggx-ladder').addEventListener('change', (e)=>{
    GGX_STATE.profile = e.target.value || 'neb1kbplus';
    ggxDrawGel();
    ggxUpdateLegend();
  });

  function syncVectorHeight(){
    const leftTA=document.getElementById('gg-vector');
    const firstInsertTA=document.querySelector('#inserts-container .insert-seq');
    if(!leftTA || !firstInsertTA) return;
    const h = firstInsertTA.offsetHeight || firstInsertTA.getBoundingClientRect().height || firstInsertTA.scrollHeight;
    const target = Math.max(140, Math.min(1200, h || 140));
    leftTA.style.height = target + 'px';
  }
  function scheduleSync(){ window.requestAnimationFrame(syncVectorHeight); }

  // Insert count
  let insertCount = 1;
  
  // Setup event listeners for an insert row (copied from Gibson)
  function setupInsertRowListeners(row) {
    if (!row) return;
    
    // Check if already initialized (prevent duplicate bindings)
    if (row.dataset.listenersSetup === 'true') return;
    row.dataset.listenersSetup = 'true';
    
    // Upload button (same logic as QC)
    const uploadBtn = row.querySelector('.insert-upload-btn');
    const fileInput = row.querySelector('.insert-file');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      
      // File input change handler (same logic as QC)
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => {
          const textarea = row.querySelector('.insert-seq');
          if (textarea) textarea.value = ev.target.result;
        };
        r.readAsText(f);
      });
    }
    
    // Flip (rc) button (same logic as QC)
    const flipBtn = row.querySelector('.insert-flip-btn');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        const textarea = row.querySelector('.insert-seq');
        if (textarea) {
          applyRCToTextarea(textarea);
        }
      });
    }

    // Insert demo button: load Insert_1.txt
    const insertDemoBtn = row.querySelector('.insert-demo-btn');
    if (insertDemoBtn) {
      insertDemoBtn.addEventListener('click', async () => {
        const textarea = row.querySelector('.insert-seq');
        if (!textarea) return;
        
        try {
          const base = new URL('modules/contents/demo/', window.location.href).toString();
          const resp = await fetch(base + 'Insert_1.txt');
          if (!resp.ok) {
            alert('Failed to load demo sequence.');
            return;
          }
          const text = await resp.text();
          textarea.value = text;
        } catch (e) {
          console.error('Insert demo load error:', e);
          alert('Failed to load demo sequence.');
        }
      });
    }
    
    // Delete button
    const delBtn = row.querySelector('.remove-insert-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        row.remove();
        updateInsertNumbers();
        updateInsertControls();
        scheduleSync();
      });
    }
  }
  
  // Update insert numbers
  function updateInsertNumbers() {
    const rows = document.querySelectorAll('.insert-row');
    rows.forEach((row, idx) => {
      const label = row.querySelector('.insert-label');
      label.textContent = `Insert #${idx + 1}:`;
      row.setAttribute('data-index', idx);
    });
    insertCount = rows.length;
  }
  
  // Update insert controls
  function updateInsertControls() {
    const rows = document.querySelectorAll('.insert-row');
    rows.forEach((row, idx) => {
      const delBtn = row.querySelector('.remove-insert-btn');
      
      // Show/hide delete button
      if (rows.length > 1) {
        if (delBtn) delBtn.style.display = 'block';
      } else {
        if (delBtn) delBtn.style.display = 'none';
      }
    });
  }
  
  // Add insert function (copied from Gibson)
  function addInsert() {
    const container = document.getElementById('inserts-container');
    const currentRows = container.querySelectorAll('.insert-row');
    
    insertCount++;
    const newRow = document.createElement('div');
    newRow.className = 'insert-row';
    newRow.setAttribute('data-index', insertCount - 1);
    newRow.innerHTML = `
      <div class="insert-label">Insert #${insertCount}:</div>
      <div class="insert-body">
        <textarea class="insert-seq" placeholder=">insert${insertCount}&#10;ATGCGTAGCTA..."></textarea>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
          <div class="row end" style="gap: 6px;">
            <input type="file" class="insert-file" accept=".fa,.fasta,.fas,.txt" style="display: none;">
            <button type="button" class="btn demo insert-flip-btn">Reverse complement</button>
            <button class="btn demo insert-demo-btn" type="button" data-sample="insert">Demo</button>
            <button class="ghost btn insert-upload-btn" type="button">Upload</button>
          </div>
        </div>
      </div>
      <div></div>
      <div class="insert-controls">
        <button class="ghost btn sm remove-insert-btn" type="button" title="Delete" style="display: none;">×</button>
      </div>
    `;
    container.appendChild(newRow);
    setupInsertRowListeners(newRow);
    updateInsertNumbers();
    updateInsertControls();
    scheduleSync();
  }

  window.addEventListener('resize', scheduleSync);
  
  const insertsContainer = document.getElementById('inserts-container');
  if (insertsContainer) {
    insertsContainer.addEventListener('input', scheduleSync);
    try{
      const mo = new MutationObserver(scheduleSync);
      mo.observe(insertsContainer, {childList:true, subtree:true});
    }catch(e){}
  }

  // Initialize event listeners (with retry mechanism like QC)
  let buttonsInitialized = false;
  function initREButtons() {
    // Check if already initialized
    const vectorUploadBtn = document.getElementById('btn-vector-upload');
    if (!vectorUploadBtn) {
      // Elements not ready yet, will retry
      return;
    }
    
    // Only initialize once
    if (buttonsInitialized) return;
    buttonsInitialized = true;
    
    // Setup listeners for existing rows
    const insertRows = document.querySelectorAll('.insert-row');
    insertRows.forEach((row) => {
      setupInsertRowListeners(row);
    });
    
    // Initialize controls
    updateInsertControls();

    // Vector upload handler (same logic as QC)
    const vectorFileInput = document.getElementById('file-vector');
    if (vectorUploadBtn && vectorFileInput) {
      vectorUploadBtn.addEventListener('click', () => vectorFileInput.click());
      vectorFileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (event) => {
          const textarea = document.getElementById('gg-vector');
          if (textarea) {
            textarea.value = event.target.result;
            updateVectorPreview();
          }
        };
        r.readAsText(f);
      });
    }
    
    // Vector flip (rc) button (same logic as QC)
    const vectorFlipBtn = document.getElementById('vector-flip-btn');
    if (vectorFlipBtn) {
      vectorFlipBtn.addEventListener('click', () => {
        const textarea = document.getElementById('gg-vector');
        if (textarea) {
          applyRCToTextarea(textarea);
          updateVectorPreview();
        }
      });
    }

    // Vector demo button: load pESC-His.txt
    const vectorDemoBtn = document.getElementById('btn-vector-demo');
    if (vectorDemoBtn) {
      vectorDemoBtn.addEventListener('click', async () => {
        const textarea = document.getElementById('gg-vector');
        if (!textarea) return;
        
        try {
          const base = new URL('modules/contents/demo/', window.location.href).toString();
          const resp = await fetch(base + 'pESC-His.txt');
          if (!resp.ok) {
            alert('Failed to load demo sequence.');
            return;
          }
          const text = await resp.text();
          textarea.value = text;
          updateVectorPreview();
          calculateAndDisplayVectorFragments();
        } catch (e) {
          console.error('Vector demo load error:', e);
          alert('Failed to load demo sequence.');
        }
      });
    }

    // Demo Set button: load vector and first insert
    const demoSetBtn = document.getElementById('gg-demo-set');
    if (demoSetBtn) {
      demoSetBtn.addEventListener('click', async () => {
        try {
          const base = new URL('modules/contents/demo/', window.location.href).toString();
          
          // Load vector
          const vectorTextarea = document.getElementById('gg-vector');
          if (vectorTextarea) {
            const vectorResp = await fetch(base + 'pESC-His.txt');
            if (vectorResp.ok) {
              const vectorText = await vectorResp.text();
              vectorTextarea.value = vectorText;
              updateVectorPreview();
            }
          }
          
          // Load first insert
          const insertRows = document.querySelectorAll('.insert-row');
          if (insertRows.length > 0) {
            const firstInsertTextarea = insertRows[0].querySelector('.insert-seq');
            if (firstInsertTextarea) {
              const insertResp = await fetch(base + 'Insert_1.txt');
              if (insertResp.ok) {
                const insertText = await insertResp.text();
                firstInsertTextarea.value = insertText;
              }
            }
          }

          // Set enzymes: BamHI and SalI
          const enzyme1Input = document.getElementById('re-enzyme1');
          const enzyme2Input = document.getElementById('re-enzyme2');
          if (enzyme1Input) enzyme1Input.value = 'BamHI';
          if (enzyme2Input) enzyme2Input.value = 'SalI';
          
          // Update vector preview to show enzyme sites and calculate fragments
          updateVectorPreview();
          calculateAndDisplayVectorFragments();
        } catch (e) {
          console.error('Demo Set load error:', e);
          alert('Failed to load demo sequences.');
        }
      });
    }
  }
  
  // Try to initialize immediately
  initREButtons();
  
  // Also try after delays (in case DOM is not ready yet)
  setTimeout(initREButtons, 100);
  setTimeout(initREButtons, 500);

  // Vector map preview function
  let vectorPreviewTimer = null;
  function updateVectorPreview() {
    const vectorText = document.getElementById('gg-vector').value.trim();
    const statsDiv = document.getElementById('vector-map-stats');
    const canvas = document.getElementById('vector-map-canvas');
    
    if (!vectorText || !canvas) {
      if (statsDiv) statsDiv.textContent = 'Paste vector sequence above to update preview.';
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    
    // Check if Core and VIZ are available
    if (typeof window.CORE === 'undefined' || typeof window.VIZ === 'undefined') {
      if (statsDiv) statsDiv.textContent = 'Loading visualization libraries...';
      return;
    }
    
    try {
      const records = window.CORE.parseFASTA(vectorText);
      if (records.length === 0) {
        if (statsDiv) statsDiv.textContent = 'Unable to parse vector sequence';
        return;
      }
      if (records.length > 1 && statsDiv) {
        statsDiv.textContent = 'Multiple sequences found, using first one';
      }
      
      const vector = records[0];
      const seq = window.CORE.normalizeSeq(vector.seq);
      const len = seq.length;
      const name = vector.name || 'Vector';
      
      // Get enzyme sites for annotation
      const enzyme1Name = document.getElementById('re-enzyme1').value.trim();
      const enzyme2Name = document.getElementById('re-enzyme2').value.trim();
      const annotations = [];
      
      if (enzyme1Name && window.CORE.findEnzymeSites) {
        const sites = window.CORE.findEnzymeSites(seq, enzyme1Name);
        sites.forEach(pos => {
          annotations.push({ pos, name: enzyme1Name });
        });
      }
      if (enzyme2Name && enzyme2Name !== enzyme1Name && window.CORE.findEnzymeSites) {
        const sites = window.CORE.findEnzymeSites(seq, enzyme2Name);
        sites.forEach(pos => {
          annotations.push({ pos, name: enzyme2Name });
        });
      }
      
      // If no enzymes specified, show all single-cut enzymes
      if (!enzyme1Name && !enzyme2Name && window.CORE.ENZYME_DB) {
        for (const [enzName, enz] of Object.entries(window.CORE.ENZYME_DB)) {
          if (enz.class === 'typeII' && enz.site && window.CORE.findEnzymeSites) {
            const sites = window.CORE.findEnzymeSites(seq, enzName);
            if (sites.length === 1) {
              annotations.push({ pos: sites[0], name: enzName });
            }
          }
        }
      }
      
      // Detect features using common_features.js
      if (window.COMMON_FEATURES && window.CORE.detectFeatures) {
        const feats = window.CORE.detectFeatures(seq, window.COMMON_FEATURES);
        feats.forEach(f => {
          annotations.push({ 
            start: f.start, 
            end: f.end, 
            color: f.color || '#3b82f6',
            name: f.name 
          });
        });
      }
      
      const rotation = parseInt(document.getElementById('vector-map-rotation').value) || 0;
      if (window.VIZ && window.VIZ.drawVectorMap) {
        window.VIZ.drawVectorMap('vector-map-canvas', len, name, annotations, rotation);
      }
      
      const siteCount = annotations.filter(a => a.pos !== undefined).length;
      if (statsDiv) {
        statsDiv.textContent = `${len} bp${siteCount > 0 ? ` | ${siteCount} site(s)` : ''}`;
      }
      
    } catch (error) {
      console.error('Error updating vector preview:', error);
      if (statsDiv) statsDiv.textContent = 'Error parsing vector';
    }
  }

  // Calculate and display restriction enzyme fragments
  function calculateAndDisplayVectorFragments() {
    const vectorText = document.getElementById('gg-vector').value.trim();
    const backboneSelect = document.getElementById('re-backbone-select');
    const fragmentsSummary = document.getElementById('re-fragments-summary');
    
    if (!vectorText || !backboneSelect) {
      if (backboneSelect) {
        backboneSelect.innerHTML = '<option value="">No fragments available</option>';
      }
      if (fragmentsSummary) {
        fragmentsSummary.textContent = '';
      }
      return;
    }
    
    try {
      const records = window.CORE.parseFASTA(vectorText);
      if (records.length === 0) {
        backboneSelect.innerHTML = '<option value="">No fragments available</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      const vector = records[0];
      const seq = vector.seq;
      
      // Get enzyme names
      const enzyme1Name = document.getElementById('re-enzyme1').value.trim();
      const enzyme2Name = document.getElementById('re-enzyme2').value.trim();
      
      if (!enzyme1Name && !enzyme2Name) {
        backboneSelect.innerHTML = '<option value="">Please select enzyme(s)</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      const enzymeNames = [];
      if (enzyme1Name) enzymeNames.push(enzyme1Name);
      if (enzyme2Name && enzyme2Name !== enzyme1Name) enzymeNames.push(enzyme2Name);
      
      // Calculate fragments using digestCircularTypeII
      let fragments = [];
      if (enzymeNames.length > 0 && window.CORE.digestCircularTypeII) {
        fragments = window.CORE.digestCircularTypeII(seq, enzymeNames);
      }
      
      if (fragments.length === 0) {
        backboneSelect.innerHTML = '<option value="">No fragments generated</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      // Find longest fragment index
      const longestIdx = fragments.reduce((maxIdx, frag, idx) => 
        frag.length > fragments[maxIdx].length ? idx : maxIdx, 0);
      
      // Populate dropdown
      backboneSelect.innerHTML = '';
      fragments.forEach((frag, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `Fragment ${idx + 1}: ${frag.length} bp${idx === longestIdx ? ' (Longest)' : ''}`;
        if (idx === longestIdx) {
          option.selected = true;
        }
        backboneSelect.appendChild(option);
      });
      
      // Store fragments for later use
      window.currentREFragments = fragments;
      window.currentREBackboneSeq = fragments[longestIdx].seq;
      
      // Display summary
      if (fragmentsSummary) {
        fragmentsSummary.textContent = `(${fragments.length} fragment(s) generated)`;
      }
      
    } catch (error) {
      console.error('Error calculating fragments:', error);
    }
  }

  // Update vector preview on input (debounced)
  document.getElementById('gg-vector').addEventListener('input', () => {
    if (vectorPreviewTimer) clearTimeout(vectorPreviewTimer);
    vectorPreviewTimer = setTimeout(() => {
      updateVectorPreview();
      calculateAndDisplayVectorFragments();
    }, 300);
  });

  window.addEventListener('common-features-ready', () => {
    try { updateVectorPreview(); } catch (e) {}
  }, { once: true });

  // Update vector preview on rotation change
  const rotationSlider = document.getElementById('vector-map-rotation');
  if (rotationSlider) {
    rotationSlider.addEventListener('input', () => {
      const rotLabel = document.getElementById('vector-map-rot-label');
      if (rotLabel) {
        rotLabel.textContent = rotationSlider.value + '°';
      }
      updateVectorPreview();
    });
  }

  // Update vector preview and fragments when enzymes change
  document.getElementById('re-enzyme1').addEventListener('input', () => {
    updateVectorPreview();
    calculateAndDisplayVectorFragments();
  });
  document.getElementById('re-enzyme2').addEventListener('input', () => {
    updateVectorPreview();
    calculateAndDisplayVectorFragments();
  });

  // Update backbone sequence when fragment selection changes
  document.getElementById('re-backbone-select').addEventListener('change', () => {
    const backboneSelect = document.getElementById('re-backbone-select');
    if (!backboneSelect || !window.currentREFragments) return;
    
    const selectedIdx = parseInt(backboneSelect.value);
    if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < window.currentREFragments.length) {
      window.currentREBackboneSeq = window.currentREFragments[selectedIdx].seq;
    }
  });

  document.getElementById('gg-clear').addEventListener('click', ()=>{
    const resWrap = document.getElementById('results-wrap');
    if(resWrap) resWrap.style.display = 'none';

    const primerNode = document.getElementById('primer-table');
    if(primerNode) primerNode.innerHTML = '';

    const qcNode = document.getElementById('qc-out');
    if(qcNode) qcNode.innerHTML = '';

    const ohNode = document.getElementById('oh-table');
    if(ohNode) ohNode.innerHTML = '';

    const gelSec = document.getElementById('gg-gel-section');
    if(gelSec) gelSec.style.display = 'none';

    const gelLegend = document.getElementById('ggx-legend');
    if(gelLegend) gelLegend.innerHTML = '';

    GGX_STATE.lanes = [];
    GGX_STATE.insertCount = 0;
    GGX_STATE.assembledLaneIndex = null;

    window._ggAssembledSeq = '';
    window._ggAssembledName = '';
    window._ggHasResults = false;
    window._ggPrimers = null;
    scheduleSync();
  });

  function hardReset(){ window.location.reload(); }
  document.getElementById('global-reset').addEventListener('click', hardReset);

  function collectFragments(){
    return Array.from(document.querySelectorAll('.insert-row')).map(r=>{
      const raw = r.querySelector('.insert-seq').value || '';
      const headerName = parseHeader(raw);
      return { seq: raw, headerName };
    }).filter(f=> cleanFasta(f.seq).length>0 );
  }

  const runREDesign = async () => {
    try{
      const vectorRaw = document.getElementById('gg-vector').value || '';
      const frags = collectFragments();
      if(!frags.length){
        if(window._ggShowModal){ window._ggShowModal('Please add an insert sequence.'); }
        else { alert('Please add an insert sequence.'); }
        return;
      }
      const insertRaw = frags[0].seq;
      const insertHeader = frags[0].headerName || null;

      const enz1Name = document.getElementById('re-enzyme1').value;
      const enz2Name = document.getElementById('re-enzyme2').value;
      const enz1 = RE_ENZYMES[enz1Name];
      const enz2 = RE_ENZYMES[enz2Name];

      if(!enz1 || !enz2){
        const msg = 'Please select two restriction enzymes. If you want to perform a single-enzyme digestion, please select the same enzyme in both boxes.';
        if(window._ggShowModal){
          window._ggShowModal(msg);
        } else {
          alert(msg);
        }
        return;
      }

      const clampN   = parseInt(document.getElementById('gg-clamp').value||'5',10);
      const tmTarget = parseFloat(document.getElementById('gg-tmTarget').value||'55');
      const Na       = parseFloat(document.getElementById('gg-na').value||'50');
      const conc     = parseFloat(document.getElementById('gg-conc').value||'500');

      const vecClean = cleanFasta(vectorRaw);
      const insClean = cleanFasta(insertRaw);
      if(!vecClean){
        if(window._ggShowModal){ window._ggShowModal('Vector sequence is empty.'); }
        else { alert('Vector sequence is empty.'); }
        return;
      }
      if(!insClean){
        if(window._ggShowModal){ window._ggShowModal('Insert sequence is empty.'); }
        else { alert('Insert sequence is empty.'); }
        return;
      }

      const warnings = [];
      if (window.VIZ && window.VIZ.validateSequenceInput) {
        const stripHeaders = (s) => String(s || '').replace(/^>.*$/gm, '');
        const vecLabel = parseHeader(vectorRaw) || 'Vector';
        const insLabel = insertHeader || 'Insert';
        warnings.push(...window.VIZ.validateSequenceInput([{ label: vecLabel, seq: stripHeaders(vectorRaw) }], 'Vector'));
        warnings.push(...window.VIZ.validateSequenceInput([{ label: insLabel, seq: stripHeaders(insertRaw) }], 'Insert'));
      }
      if (window.VIZ && window.VIZ.validateParameterRange) {
        const MgVal = parseFloat(document.getElementById('gg-mg')?.value ?? '');
        const params = { Na, conc, targetTm: tmTarget };
        if (isFinite(MgVal)) params.Mg = MgVal;
        warnings.push(...window.VIZ.validateParameterRange(params));
      }
      if (window.VIZ && window.VIZ.validatePerformance) {
        const stripLen = (s) => String(s || '').replace(/^>.*$/gm, '').replace(/\s+/g, '').length;
        warnings.push(...window.VIZ.validatePerformance(2, stripLen(vectorRaw) + stripLen(insertRaw)));
      }
      if (warnings.length && window.VIZ && window.VIZ.showMWWarnings) {
        const mwContainer = document.getElementById('module-content') || document.body;
        const ok = await new Promise((resolve) => {
          window.VIZ.showMWWarnings(mwContainer, warnings, () => resolve(true), () => resolve(false));
        });
        if (!ok) return;
      }

      const digestInfo = analyzeVectorDigest(vecClean, enz1, enz2);
      const n1 = digestInfo.n1;
      const n2 = digestInfo.n2;
      const vectorLen = vecClean.length;
      const vectorName = parseHeader(vectorRaw);
      const insertNames = [insertHeader];

      const primerNode = document.getElementById('primer-table');
      const qcNode = document.getElementById('qc-out');
      const ohNode = document.getElementById('oh-table');
      const warningsBox = document.getElementById('warnings-box');
      const qcWrap = document.getElementById('cell-qc');
      if(qcWrap){ qcWrap.style.display = 'none'; }
      if(qcNode){ qcNode.innerHTML = ''; }
      const asmImg = document.getElementById('asm-img');
   
      const asmLegend = document.getElementById('asm-legend');

      // Handle enzyme/site edge cases for RE cloning

      // If exactly one enzyme cuts the vector, fall back to single-enzyme mode
      // (use the cutting enzyme for both ends; non-directional, higher self-ligation risk).
      const hasEnz1 = n1 > 0;
      const hasEnz2 = n2 > 0;
      const singleEnzymeFallback = (hasEnz1 !== hasEnz2);
      const activeEnz = hasEnz1 ? enz1 : enz2;
      const activeEnzName = hasEnz1 ? enz1Name : enz2Name;
      const missingEnzName = hasEnz1 ? enz2Name : enz1Name;
      const activeCutCount = hasEnz1 ? n1 : n2;

      let multiSiteWarnHtml = '';
      let orientationWarnHtml = '';
      let bluntWarnHtml = '';

      const effEnz1 = singleEnzymeFallback ? activeEnz : enz1;
      const effEnz2 = singleEnzymeFallback ? activeEnz : enz2;
      const effEnz1Name = singleEnzymeFallback ? activeEnzName : enz1Name;
      const effEnz2Name = singleEnzymeFallback ? activeEnzName : enz2Name;
      const enzymeLabel = singleEnzymeFallback ? `${activeEnzName} (single-enzyme fallback)` : `${enz1Name}/${enz2Name}`;

      const insertSiteWarnEnzymes = [];
      let insertSiteWarnHtml = '';
      {
        const insSites1 = findRESites(insClean, effEnz1.site);
        const insSites2 = findRESites(insClean, effEnz2.site);
        if (insSites1.length) insertSiteWarnEnzymes.push(effEnz1Name);
        if (effEnz2Name !== effEnz1Name && insSites2.length) insertSiteWarnEnzymes.push(effEnz2Name);
        if (insertSiteWarnEnzymes.length) {
          insertSiteWarnHtml =
            `<div class="aside" style="margin-top:6px;color:#b91c1c">
              Warning: selected enzymes (${insertSiteWarnEnzymes.join(', ')}) have recognition sites in the insert.
              Consider choosing different restriction enzymes for cloning.
            </div>`;
        }
      }

      const blunt1 = !effEnz1.sticky;
      const blunt2 = !effEnz2.sticky;
      const sameSticky = (effEnz1 && effEnz2 && effEnz1.sticky && effEnz2.sticky && (effEnz1.sticky === effEnz2.sticky));

      const mwContainer = document.getElementById('module-content') || document.body;
      const confirmMW = async (msg) => {
        if (window.VIZ && typeof window.VIZ.showMWModal === 'function') {
          return await new Promise((resolve) => {
            window.VIZ.showMWModal(mwContainer, msg || '', () => resolve(true), () => resolve(false));
          });
        }
        return window.confirm(msg || '');
      };


      // 1) Multi-site warning
      if (singleEnzymeFallback) {
        if (activeCutCount > 1) {
          const warningMsg =
            `Vector contains multiple ${activeEnzName} sites (× ${activeCutCount}). ` +
            `In single-enzyme mode the backbone is non-directional; verify the chosen backbone fragment and consider dephosphorylation to reduce background.`;
          multiSiteWarnHtml = `<div class="aside" style="margin-bottom:6px;color:#b45309">${warningMsg}</div>`;
        }
      } else if (n1 > 1 || n2 > 1) {
        if (digestInfo.pseudoSingle) {
          const warningMsg =
            `Vector contains multiple recognition sites: ${enz1Name} × ${n1}, ${enz2Name} × ${n2}. ` +
            `The longest fragment on the vector is flanked by the same enzyme on both ends, so the backbone behaves like a single-enzyme, non-directional digest. ` +
            `Consider choosing a different enzyme combination or dephosphorylating the vector to reduce background.`;

          multiSiteWarnHtml =
            `<div class="aside" style="margin-bottom:6px;color:#b45309">${warningMsg}</div>`;
        } else {
          const warningMsg =
            `Vector contains multiple recognition sites: ${enz1Name} × ${n1}, ${enz2Name} × ${n2}. ` +
            `The longest fragment is flanked by different enzymes and is used as the cloning backbone in this design. ` +
            `Please double-check that this enzyme combination matches your experimental plan; otherwise, select different enzymes.`;
          multiSiteWarnHtml =
            `<div class="aside" style="margin-bottom:6px;color:#b45309">${warningMsg}</div>`;
        }
      }

      // 2) Missing site handling:
      // - both missing: hard stop (no digest possible)
      // - one missing: proceed in single-enzyme fallback mode + warning
      let missingSiteWarnHtml = '';
      if (n1 === 0 && n2 === 0) {
        const reasonShort = `no ${enz1Name} / ${enz2Name} sites in vector`;
        const warningMsg = `There are no ${enz1Name} / ${enz2Name} sites in the vector. Please select appropriate enzymes or modify the vector.`;

        const okToShowNA = await confirmMW(
          warningMsg + '\n\nClick OK to show N/A results, or Cancel to keep inputs unchanged.'
        );
        if (!okToShowNA) return;

        if (primerNode) primerNode.innerHTML = `<div class="aside">N/A (${reasonShort})</div>`;
        if (qcNode) qcNode.innerHTML = `<div class="aside">N/A (${reasonShort})</div>`;

        if (ohNode) {
          let ohHtml = `<div class="aside">N/A (${reasonShort})</div>` +
                       `<div class="aside" style="margin-top:6px;color:#b91c1c">${warningMsg}</div>`;
          ohHtml += insertSiteWarnHtml;
          ohNode.innerHTML = ohHtml;
        }
        if (warningsBox) {
          warningsBox.innerHTML = '';
          const p1 = document.createElement('p');
          p1.textContent = warningMsg;
          const p2 = document.createElement('p');
          p2.textContent = 'No assembled sequence generated (missing restriction sites).';
          warningsBox.appendChild(p1);
          warningsBox.appendChild(p2);
        }

        // Draw RE assembly diagram (will show RE_nocut.svg)
        drawREAssemblyFigure(enz1, enz2, n1, n2, asmImg, asmLegend, null, 0, enz1Name, enz2Name);

        showGel(vectorLen, [], [], 0, null, insertNames, vectorName, `${enz1Name}/${enz2Name}`, '');
        if (typeof GGX_STATE !== 'undefined') {
          GGX_STATE.scIdx = new Set([1,2]);
          ggxDrawGel();
          ggxUpdateLegend();
        }

        document.getElementById('results-wrap').style.display='grid';
        window._ggAssembledSeq = '';
        window._ggAssembledName = '';
        window._ggHasResults = true;
        window._ggPrimers = null;
        scheduleSync();
        return;
      }

      if (singleEnzymeFallback) {
        const msg =
          `Warning: ${missingEnzName} site not found in vector; using ${activeEnzName} for both ends (single-enzyme, non-directional cloning). ` +
          `Vector self-ligation risk is higher; consider dephosphorylation.`;
        missingSiteWarnHtml = `<div class="aside" style="margin-bottom:6px;color:#b45309">${msg}</div>`;

        const ok = await confirmMW(msg + '\n\nClick OK to continue, or Cancel to revise enzymes.');
        if (!ok) return;
      }

      const design = designREPrimers(insertRaw, effEnz1Name, effEnz2Name, clampN, tmTarget, Na, conc);
      const primers = design.primers;
      const pcrSize = design.pcrSize;
      const insertLen = design.insertLen;
      window._ggPrimers = primers;

      if(primerNode){
        primerNode.innerHTML = renderPrimerBlocks(primers);
      }
      if(qcNode){
        qcNode.innerHTML = '';
      }

      const stickyF = primers[0] && primers[0].OH_L ? primers[0].OH_L : (effEnz1.sticky||'');
      const stickyR = primers[0] && primers[0].OH_R ? primers[0].OH_R : (effEnz2.sticky||'');

      const junctions = [
        { label:'Vector > Insert #1', leftOH:stickyF, rightOH:stickyF },
        { label:'Insert #1 > Vector', leftOH:stickyR, rightOH:stickyR }
      ];

      if(ohNode){
        let ohHtml = renderOHTable(junctions, insertNames, vectorName) + insertSiteWarnHtml;
        if (missingSiteWarnHtml) {
          ohHtml += missingSiteWarnHtml;
        }
        if(multiSiteWarnHtml){
          ohHtml += multiSiteWarnHtml;
        }
        if(sameSticky){
          ohHtml += `<div class="aside" style="margin-top:6px;color:#b45309">
            Non-directional cloning: the selected enzymes generate identical sticky ends; insert orientation is not enforced and vector self-ligation may occur. Consider using two different enzymes or dephosphorylating the vector to reduce background.
          </div>`;
        } else if(blunt1 && blunt2){
          ohHtml += `<div class="aside" style="margin-top:6px;color:#b45309">
            Both enzymes generate blunt ends. Cloning will be non-directional with lower ligation efficiency and higher background.
          </div>`;
        } else if(blunt1 !== blunt2){
          ohHtml += `<div class="aside" style="margin-top:6px;color:#b45309">
            One restriction site is blunt and the other is sticky. This combination is generally not recommended for standard restriction cloning.
          </div>`;
        }
        if(insertLen < 50){
          ohHtml += `<div class="aside" style="margin-top:6px;color:#b45309">
            Insert is very short (&lt;50 bp); cloning efficiency and screening may be more challenging.
          </div>`;
        }
        const selfLigationRisk = sameSticky || (blunt1 && blunt2) || digestInfo.pseudoSingle;
        if(selfLigationRisk){
          ohHtml += `<div class="aside" style="margin-top:6px;color:#b91c1c">
            High self-ligation risk for the vector backbone. Consider dephosphorylating the vector and/or changing the enzyme combination to reduce background colonies.
          </div>`;
        }
        ohNode.innerHTML = ohHtml;
      }


      
      // --- Build assembled plasmid sequence (restriction cloning model) ---
      let assembledSeq = '';
      let assembledLen = 0;
      if (!digestInfo || !digestInfo.longestFragLen || !vecClean.length) {
        assembledSeq = '';
        assembledLen = 0;
      } else {
        const vecSeq = vecClean;
        const insSeq = insClean;
        const N = vecSeq.length;

        const hasEnz1 = enz1 && enz1.site;
        const hasEnz2 = enz2 && enz2.site;

        // Check if user has selected a specific fragment via dropdown
        let userSelectedBackboneSeq = null;
        let userSelectedBackboneFrag = null;
        if (window.currentREFragments && window.currentREFragments.length > 0) {
          const backboneSelect = document.getElementById('re-backbone-select');
          if (backboneSelect) {
            const selectedIdx = parseInt(backboneSelect.value);
            if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < window.currentREFragments.length) {
              userSelectedBackboneSeq = window.currentREFragments[selectedIdx].seq;
              userSelectedBackboneFrag = window.currentREFragments[selectedIdx];
            }
          }
        }

        function findBackboneFragmentForSeq(seqStr) {
          if (!seqStr || !window.currentREFragments || !window.currentREFragments.length) return null;
          // Try exact match first
          const exact = window.currentREFragments.find(f => f && f.seq === seqStr);
          if (exact) return exact;
          return null;
        }

        function pickEnzymeNameForCuts(cuts, preferNameA, preferNameB) {
          const list = Array.isArray(cuts) ? cuts : [];
          const pick = (name) => {
            if (!name) return null;
            const hit = list.find(c => c && c.enzyme === name);
            return hit ? name : null;
          };
          return pick(preferNameA) || pick(preferNameB) || (list[0] && list[0].enzyme) || null;
        }

        function getEnzymeInfoByName(name) {
          if (!name) return null;
          const enzObj = window.CORE && window.CORE.getEnzyme ? window.CORE.getEnzyme(name) : null;
          if (!enzObj || !enzObj.site || typeof enzObj.cut5 !== 'number') return null;
          return { name, site: enzObj.site, cut5: enzObj.cut5 };
        }

        // Helper: fallback to simple backbone + insert model (with recognition sites when possible)
        const fallbackBackbonePlusInsert = () => {
          let backboneSeq;
          let backboneFrag = null;
          // Use user-selected fragment if available
          if (userSelectedBackboneSeq) {
            backboneSeq = userSelectedBackboneSeq;
            backboneFrag = userSelectedBackboneFrag;
          } else if (window.currentREBackboneSeq) {
            backboneSeq = window.currentREBackboneSeq;
            backboneFrag = findBackboneFragmentForSeq(window.currentREBackboneSeq);
          } else {
            backboneSeq = subseqCircular(vecSeq, digestInfo.backboneStart, digestInfo.longestFragLen);
          }

          // If we know which enzymes cut the selected backbone fragment, we can restore
          // the recognition sites flanking the insert in the assembled plasmid.
          // IMPORTANT: digest fragments include partial site remnants at their ends (cutTop breakpoints),
          // so we must trim those remnants before adding full recognition sites, otherwise assembled
          // length is inflated by ~site.length.
          const leftEnzName = backboneFrag ? pickEnzymeNameForCuts(backboneFrag.leftCuts, effEnz1Name, effEnz2Name) : null;
          const rightEnzName = backboneFrag ? pickEnzymeNameForCuts(backboneFrag.rightCuts, effEnz2Name, effEnz1Name) : null;
          const leftEnz = getEnzymeInfoByName(leftEnzName);
          const rightEnz = getEnzymeInfoByName(rightEnzName);

          let trimmedBackbone = backboneSeq;
          if (leftEnz && trimmedBackbone) {
            const siteBasesInFragmentStart = leftEnz.site.length - leftEnz.cut5;
            if (siteBasesInFragmentStart > 0 && trimmedBackbone.length >= siteBasesInFragmentStart) {
              const expectedSuffix = leftEnz.site.slice(leftEnz.cut5);
              if (expectedSuffix && trimmedBackbone.startsWith(expectedSuffix)) {
                trimmedBackbone = trimmedBackbone.slice(siteBasesInFragmentStart);
              }
            }
          }
          if (rightEnz && trimmedBackbone) {
            const siteBasesInFragmentEnd = rightEnz.cut5;
            if (siteBasesInFragmentEnd > 0 && trimmedBackbone.length >= siteBasesInFragmentEnd) {
              const expectedPrefix = rightEnz.site.slice(0, rightEnz.cut5);
              if (expectedPrefix && trimmedBackbone.endsWith(expectedPrefix)) {
                trimmedBackbone = trimmedBackbone.slice(0, trimmedBackbone.length - siteBasesInFragmentEnd);
              }
            }
          }

          const seq = (leftEnz && rightEnz)
            ? (trimmedBackbone + rightEnz.site + insSeq + leftEnz.site)
            : (trimmedBackbone + insSeq);
          return { seq, len: seq.length };
        };

        // Case A: both enzymes defined (double digest / pseudo single)
        if (hasEnz1 && hasEnz2) {
          const s1 = (digestInfo.sites1 || []);
          const s2 = (digestInfo.sites2 || []);

          // A1. Each enzyme has a single recognition site: simple replacement between sites
          if (s1.length === 1 && s2.length === 1) {
            // If user selected a specific fragment, use simple model
            if (userSelectedBackboneSeq) {
              const fb = fallbackBackbonePlusInsert();
              assembledSeq = fb.seq;
              assembledLen = fb.len;
            } else {
              let p1 = s1[0];
              let p2 = s2[0];
              let leftPos = p1;
              let rightPos = p2;
              let leftSite = enz1.site;
              let rightSite = enz2.site;

              if (p2 < p1) {
                leftPos = p2;
                rightPos = p1;
                leftSite = enz2.site;
                rightSite = enz1.site;
              }

              assembledSeq =
                vecSeq.slice(0, leftPos) +
                leftSite +
                insSeq +
                rightSite +
                vecSeq.slice(rightPos + rightSite.length);
              assembledLen = assembledSeq.length;
            }
          }
          // A2. Multiple sites: use digestInfo.longestFragLen/backboneStart to
          //     identify the backbone fragment, and treat the complementary
          //     arc as the "removed" MCS that gets replaced.
          else if ((s1.length + s2.length) >= 2) {
            // If user selected a specific fragment, use simple model
            if (userSelectedBackboneSeq) {
              const fb = fallbackBackbonePlusInsert();
              assembledSeq = fb.seq;
              assembledLen = fb.len;
            } else {
              // Rebuild cuts the same way as in analyzeVectorDigest
              const cuts = [];
              s1.forEach(p => cuts.push({ pos: (p + enz1.cut5) % N, enz: 1 }));
              s2.forEach(p => cuts.push({ pos: (p + enz2.cut5) % N, enz: 2 }));
              cuts.sort((a, b) => a.pos - b.pos);

              if (cuts.length >= 2) {
                // Find the cut pair that matches the recorded backbone fragment
                let idxLongest = 0;
                for (let i = 0; i < cuts.length; i++) {
                  const start = cuts[i].pos;
                  const end = cuts[(i + 1) % cuts.length].pos;
                  const len = (end - start + N) % N || N;
                  if (start === digestInfo.backboneStart &&
                      Math.abs(len - digestInfo.longestFragLen) <= 1) {
                    idxLongest = i;
                    break;
                  }
                }

                const cutA = cuts[idxLongest];                 // start of longest fragment
                const cutB = cuts[(idxLongest + 1) % cuts.length]; // end of longest fragment

                // The complementary arc (removed fragment) starts at cutB and ends at cutA
                const shortStartCut = cutB;
                const shortEndCut = cutA;

                const siteStartForCut = (cut) => {
                  const enzObj = (cut.enz === 1 ? enz1 : enz2);
                  if (!enzObj || !enzObj.site) return null;
                  return (cut.pos - enzObj.cut5 + N) % N;
                };

                let leftSiteStart = siteStartForCut(shortStartCut);
                let rightSiteStart = siteStartForCut(shortEndCut);

                if (leftSiteStart != null && rightSiteStart != null) {
                  let leftSiteSeq = (shortStartCut.enz === 1 ? enz1.site : enz2.site);
                  let rightSiteSeq = (shortEndCut.enz === 1 ? enz1.site : enz2.site);

                  // Ensure linear order left -> right
                  if (rightSiteStart < leftSiteStart) {
                    [leftSiteStart, rightSiteStart] = [rightSiteStart, leftSiteStart];
                    [leftSiteSeq, rightSiteSeq] = [rightSiteSeq, leftSiteSeq];
                  }

                  const leftSiteEnd = leftSiteStart + leftSiteSeq.length;
                  const rightSiteEnd = rightSiteStart + rightSiteSeq.length;

                  assembledSeq =
                    vecSeq.slice(0, leftSiteStart) +
                    leftSiteSeq +
                    insSeq +
                    rightSiteSeq +
                    vecSeq.slice(rightSiteEnd);
                  assembledLen = assembledSeq.length;
                } else {
                  const fb = fallbackBackbonePlusInsert();
                  assembledSeq = fb.seq;
                  assembledLen = fb.len;
                }
              } else {
                const fb = fallbackBackbonePlusInsert();
                assembledSeq = fb.seq;
                assembledLen = fb.len;
              }
            }
          }
          // A3. No usable site information; fallback
          else {
            const fb = fallbackBackbonePlusInsert();
            assembledSeq = fb.seq;
            assembledLen = fb.len;
          }
        }
        // Case B: only one enzyme defined (single digest)
        else if (hasEnz1 || hasEnz2) {
          const enz = hasEnz1 ? enz1 : enz2;
          if (enz && enz.site) {
            const s = findRESites(vecSeq, enz.site);
            if (s.length === 1 && !userSelectedBackboneSeq) {
              const siteStart = s[0];
              const siteEnd = siteStart + enz.site.length;
              // Approximate model: site + insert + site at the single recognition locus
              assembledSeq =
                vecSeq.slice(0, siteStart) +
                enz.site +
                insSeq +
                enz.site +
                vecSeq.slice(siteEnd);
              assembledLen = assembledSeq.length;
            } else {
              const fb = fallbackBackbonePlusInsert();
              assembledSeq = fb.seq;
              assembledLen = fb.len;
            }
          } else {
            const fb = fallbackBackbonePlusInsert();
            assembledSeq = fb.seq;
            assembledLen = fb.len;
          }
        }
        // Case C: no enzyme information; fallback safely
        else {
          const fb = fallbackBackbonePlusInsert();
          assembledSeq = fb.seq;
          assembledLen = fb.len;
        }
      }

      // Unified warnings/notes box (always present)
      if (warningsBox) {
        warningsBox.innerHTML = '';
        const notes = [];
        if (insertSiteWarnEnzymes.length) {
          notes.push(`Warning: selected enzymes (${insertSiteWarnEnzymes.join(', ')}) have recognition sites in the insert.`);
        }
        if (n1 > 1 || n2 > 1) {
          notes.push(`Note: vector contains multiple recognition sites (${enz1Name} × ${n1}, ${enz2Name} × ${n2}). Please verify backbone selection.`);
        }
        if (sameSticky) {
          notes.push('Note: non-directional cloning (enzymes generate identical sticky ends).');
        } else if (blunt1 && blunt2) {
          notes.push('Note: both enzymes generate blunt ends (lower ligation efficiency, non-directional).');
        } else if (blunt1 !== blunt2) {
          notes.push('Note: one end is blunt and the other is sticky (generally not recommended).');
        }
        if (insertLen < 50) {
          notes.push('Note: insert is very short (<50 bp); cloning and screening may be more challenging.');
        }
        if (sameSticky || (blunt1 && blunt2) || digestInfo.pseudoSingle) {
          notes.push('Note: high self-ligation risk for the vector backbone; consider dephosphorylation.');
        }
        if (!notes.length) {
          notes.push('No warnings generated for this design.');
        }

        // Summary line (best-effort)
        const backboneLen = (window.currentREBackboneSeq && window.currentREBackboneSeq.length) ||
          digestInfo.longestFragLen || 0;
        if (assembledLen) {
          notes.push(`Assembled sequence length: ${assembledLen} bp total (${backboneLen} bp backbone + ${insertLen} bp insert).`);
        }

        notes.forEach((t) => {
          const p = document.createElement('p');
          p.textContent = t;
          warningsBox.appendChild(p);
        });
      }
      // --- end assembly model ---


      // Compute double-digest of the assembled plasmid with the same enzyme pair
      // For a simple single-insert cloning, the digest of the final plasmid should
      // ideally give two bands: (i) the original backbone fragment between the two
      // restriction sites, and (ii) the inserted fragment.
      let assembledDigestFrags = [];
      if(assembledLen && digestInfo && digestInfo.longestFragLen){
        const backLen = digestInfo.longestFragLen;
        const insLen = Math.max(assembledLen - backLen, 0);
        if(insLen > 0){
          assembledDigestFrags = [backLen, insLen];
        }else{
          assembledDigestFrags = [assembledLen];
        }
      }



      let asmName = null;
      if(vectorName || insertHeader){
        const parts = [];
        if(vectorName) parts.push(vectorName);
        if(insertHeader) parts.push(insertHeader);
        asmName = parts.join('_');
      }else{
        asmName = 'RE_assembled';
      }

      window._ggAssembledSeq = assembledSeq;
      window._ggAssembledName = asmName;

      showGel(vectorLen, digestInfo.allFrags || [digestInfo.longestFragLen], [pcrSize], assembledLen, assembledDigestFrags, insertNames, vectorName, enzymeLabel, asmName);

      if(typeof GGX_STATE !== 'undefined'){
        const lanes = GGX_STATE.lanes || [];
        let assembledLaneIndex = null;
        for(let i=0;i<lanes.length;i++){
          if(lanes[i] && lanes[i].length && lanes[i][0]===assembledLen){
            assembledLaneIndex = i;
          }
        }
        GGX_STATE.scIdx = new Set([1].concat(assembledLaneIndex!=null?[assembledLaneIndex]:[]));
        ggxDrawGel();
        ggxUpdateLegend();
      }

      // Draw RE assembly diagram based on sticky end count
      if (singleEnzymeFallback) {
        drawREAssemblyFigure(activeEnz, activeEnz, activeCutCount, activeCutCount, asmImg, asmLegend, asmName, assembledLen, activeEnzName, activeEnzName);
      } else {
        drawREAssemblyFigure(enz1, enz2, n1, n2, asmImg, asmLegend, asmName, assembledLen, enz1Name, enz2Name);
      }

      document.getElementById('results-wrap').style.display='grid';
      window._ggHasResults = true;
      scheduleSync();
    }catch(err){
      console.error(err);
      if(window._ggShowModal){
        window._ggShowModal('Run error: ' + err.message);
      }else{
        alert('Run error: ' + err.message);
      }
    }
  };

  document.getElementById('gg-run').addEventListener('click', ()=>{
    const seqEls = [
      document.getElementById('gg-vector'),
      ...Array.from(document.querySelectorAll('#inserts-container .insert-seq'))
    ];
    if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
      const shown = VIZ.guardSingleFastaPerField(container || document.body, seqEls, () => { void runREDesign(); });
      if (shown) return;
    }
    void runREDesign();
  });

  // Initial sync
  scheduleSync();
  })();

  // Modal helpers (MW standard)
  (function(){
    function showModal(msg){
      const mwContainer = container || document.body;
      if (window.VIZ && window.VIZ.showMWWarnings) {
        window.VIZ.showMWWarnings(mwContainer, [{ id: 'RE-MSG', message: msg || '' }], () => {}, () => {});
        return;
      }
      alert(msg || '');
    }
    window._ggShowModal = showModal;
  })();

  // Download handler (bind per navigation since DOM is re-injected)
  (function(){
    const root = container || document;
    const btn = root.querySelector('#gg-download-btn') || document.getElementById('gg-download-btn');
    if (!btn) return;

    const cloned = btn.cloneNode(true);
    btn.parentNode.replaceChild(cloned, btn);

    cloned.addEventListener('click', () => {
      try{
        if(!window._ggHasResults){
          if(window._ggShowModal){
            window._ggShowModal('Please design primers first');
          }else{
            alert('Please design primers first');
          }
          return;
        }
        const modeEl = (container?.querySelector?.('#gg-download-type')) || document.getElementById('gg-download-type');
        const mode = modeEl ? (modeEl.value || 'primers') : 'primers';
        let text = '';
        let filename = '';
        let mime = 'text/plain';

        if(mode === 'primers'){
          const wrapFasta = (seq, width=80) => {
            const s = String(seq || '').replace(/\s+/g,'').toUpperCase();
            if(!s) return '';
            let out = '';
            for(let i=0;i<s.length;i+=width) out += s.slice(i,i+width) + '\n';
            return out;
          };
          const primersArr = window._ggPrimers;
          if(Array.isArray(primersArr) && primersArr.length){
            let fasta = '';
            for(const p of primersArr){
              if(!p || p.error) continue;
              const fSeq = String(p.F || '').replace(/\s+/g,'').toUpperCase();
              const rSeq = String(p.R || '').replace(/\s+/g,'').toUpperCase();
              const fName = (p.labelF || 'Forward').trim();
              const rName = (p.labelR || 'Reverse').trim();
              if(fSeq){
                fasta += '>' + fName + '\n' + wrapFasta(fSeq);
              }
              if(rSeq){
                fasta += '>' + rName + '\n' + wrapFasta(rSeq);
              }
            }
            text = fasta.trim() ? (fasta.trimEnd() + '\n') : 'No primer sequences available.';
          } else {
            const node = (container?.querySelector?.('#primer-table')) || document.getElementById('primer-table');
            text = (node && node.innerText) ? node.innerText : 'No primer results';
          }
          const asm = (window._ggAssembledName || 'RE_assembled');
          const safeAsm = asm.replace(/[^A-Za-z0-9_.-]/g,'_');
          filename = 'RE_cloning_primers(' + safeAsm + ').txt';
        } else if(mode === 'fasta'){
          const seq = (window._ggAssembledSeq || '').toUpperCase();
          const name = window._ggAssembledName || 'RE_assembled';
          if(!seq){
            if(window._ggShowModal){ window._ggShowModal('Assembled plasmid sequence is not available. Please run the design first.'); }
            else { alert('Assembled plasmid sequence is not available. Please run the design first.'); }
            return;
          }
          let fasta = '>' + name + '\n';
          for(let i=0;i<seq.length;i+=80){
            fasta += seq.slice(i, i+80) + '\n';
          }
          text = fasta;
          filename = name.replace(/[^A-Za-z0-9_.-]/g,'_') + '.fasta';
        } else {
          text = 'No results';
          filename = 'RE_cloning_output.txt';
        }

        const blob = new Blob([text], {type:mime});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }catch(e){
        if(window._ggShowModal){
          window._ggShowModal('Download failed: ' + e.message);
        }else{
          alert('Download failed: ' + e.message);
        }
      }
    });
  })();
}

// Draw RE assembly figure based on sticky end count (similar to Gibson)
function drawREAssemblyFigure(enz1, enz2, n1, n2, imgElement, legendElement, asmName, assembledLen, enz1Name, enz2Name) {
  if (!imgElement) {
    console.warn('drawREAssemblyFigure: img element not found');
    return;
  }
  
  // Map insert count to image file
  // HTML is loaded via fetch and injected into app-index.html
  // So relative paths are relative to app/ directory
  // Images are in: app/modules/contents/pictures/RE_cloning/
  const folder = "modules/contents/pictures/RE_cloning";
  
  let imageFile = '';
  
  // Determine which image to use based on enzyme sites and sticky ends
  if (n1 === 0 || n2 === 0) {
    // No cut sites: use nocut image
    imageFile = "RE_nocut.svg";
  } else {
    // Count sticky ends
    const sticky1 = enz1 && enz1.sticky ? 1 : 0;
    const sticky2 = enz2 && enz2.sticky ? 1 : 0;
    const stickyCount = sticky1 + sticky2;
    
    if (stickyCount === 0) {
      imageFile = "RE_1insert_0sticky_end.svg";
    } else if (stickyCount === 1) {
      imageFile = "RE_1insert_1sticky_end.svg";
    } else {
      imageFile = "RE_1insert_2sticky_end.svg";
    }
  }
  
  if (imageFile) {
    const imagePath = folder + "/" + imageFile;
    console.log('drawREAssemblyFigure: n1=', n1, 'n2=', n2, 'stickyCount=', (enz1 && enz1.sticky ? 1 : 0) + (enz2 && enz2.sticky ? 1 : 0), 'filename=', imageFile, 'path=', imagePath);
    imgElement.src = imagePath;
    imgElement.style.display = "block";
    imgElement.onerror = function() {
      console.error('drawREAssemblyFigure: Failed to load image:', imagePath, 'Actual src:', imgElement.src);
      imgElement.style.display = "none";
    };
    imgElement.onload = function() {
      console.log('drawREAssemblyFigure: Image loaded successfully:', imagePath);
    };
  } else {
    console.warn('drawREAssemblyFigure: No image file determined');
    imgElement.style.display = "none";
  }
  
  // Update legend
  if (legendElement) {
    if (n1 === 0 || n2 === 0) {
      const reasonShort = (n1===0 && n2===0)
        ? `no ${enz1Name || 'enzyme1'} / ${enz2Name || 'enzyme2'} sites in vector`
        : `missing ${ (n1===0 ? (enz1Name || 'enzyme1') : (enz2Name || 'enzyme2')) } site in vector`;
      legendElement.innerHTML = `<div class="aside" style="margin-top: 8px; text-align: center;">N/A (${reasonShort}; no assembled plasmid)</div>`;
    } else if (assembledLen > 0) {
      legendElement.innerHTML = `<div class="aside" style="margin-top: 8px; text-align: center;">Diagram is schematic only; lengths are not to scale.</div>`;
    } else {
      legendElement.innerHTML = '';
    }
  }
}
