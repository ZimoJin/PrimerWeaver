import * as CORE from './core_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';

function ensureHelpIcon(labelEl, tooltipHtml, ariaLabel = 'Help') {
  if (!labelEl) return;
  if (labelEl.querySelector && labelEl.querySelector('.help-icon')) return;

  labelEl.style.display = 'flex';
  labelEl.style.alignItems = 'center';
  labelEl.style.gap = '6px';

  const icon = document.createElement('span');
  icon.className = 'help-icon';
  icon.tabIndex = 0;
  icon.setAttribute('aria-label', ariaLabel);
  icon.innerHTML = `<span>?</span><span class="help-tooltip">${tooltipHtml}</span>`;
  labelEl.appendChild(icon);
}

function attachHelpToInput(container, inputId, tooltipHtml, ariaLabel) {
  const input = container?.querySelector?.(`#${inputId}`) || document.getElementById(inputId);
  if (!input) return;
  const wrapper = input.parentElement;
  const label = wrapper?.querySelector?.('label');
  ensureHelpIcon(label, tooltipHtml, ariaLabel);
}

function attachHelpToTextarea(container, textareaId, tooltipHtml, ariaLabel) {
  const textarea = container?.querySelector?.(`#${textareaId}`) || document.getElementById(textareaId);
  if (!textarea) return;
  const wrapper = textarea.parentElement;
  const label = wrapper?.querySelector?.('label');
  ensureHelpIcon(label, tooltipHtml, ariaLabel);
}

function initGoldenGate(container) {
  const byId = (id) => container?.querySelector?.(`#${id}`) || document.getElementById(id);

  // Download state (primers.txt and assembled.fasta)
  if (typeof window !== 'undefined') {
    window._ggHasResults = false;
    window._ggAssembledSeq = '';
    window._ggAssembledName = '';
    window._ggPrimers = null;
  }

  // Minimal reverse-complement helper (uses CORE.IUPAC_COMP if available)
  const RC_MAP = CORE.IUPAC_COMP || {
    A:'T', T:'A', G:'C', C:'G',
    R:'Y', Y:'R', S:'S', W:'W', K:'M', M:'K',
    B:'V', V:'B', D:'H', H:'D', N:'N'
  };
  const rc = (seq='')=>{
    let out='';
    for(let i=seq.length-1;i>=0;i--){
      const b = seq[i].toUpperCase();
      out += RC_MAP[b] || b;
    }
    return out;
  };

  // Standard MW warning modal (instead of legacy OK-only popup)
  function showMWMessage(message) {
    const warningsBox = byId('warnings-box');
    if (warningsBox) {
      warningsBox.innerHTML = ''; // Clear previous messages
      warningsBox.style.display = 'block';
      const p = document.createElement('p');
      p.textContent = message;
      warningsBox.appendChild(p);
    } else {
      alert(message);
    }
  }

  // Fallback core-primer pickers (app-main.js used to provide these globals).
  function pickCorePrimerForwardFallback(seq, tmTarget, Na, conc){
    const s = (seq || '').toUpperCase();
    const minL = 18, maxL = 28;
    let best = s.slice(0, minL);
    for (let L = minL; L <= maxL; L++) {
      const cand = s.slice(0, L);
      const ok3 = /[GC]$/.test(cand);
      const Tm = CORE.tmcalNN(cand, Na, 0, conc);
      if (ok3 && Tm >= tmTarget - 0.5) return cand;
      best = cand;
    }
    return best;
  }
  function pickCorePrimerReverseFallback(seq, tmTarget, Na, conc){
    const s = (seq || '').toUpperCase();
    const minL = 18, maxL = 28;
    let best = rc(s.slice(-minL));
    for (let L = minL; L <= maxL; L++) {
      const core = s.slice(-L);
      const p = rc(core);
      const ok3 = /[GC]$/.test(p);
      const Tm = CORE.tmcalNN(p, Na, 0, conc);
      if (ok3 && Tm >= tmTarget - 0.5) return p;
      best = p;
    }
    return best;
  }

  // Add inline help tooltips (page-level)
  attachHelpToTextarea(container, 'gg-vector', "Paste your vector/plasmid DNA sequence in FASTA format (header optional). Line breaks and spaces are ignored.", 'Help: Vector sequence');
  attachHelpToInput(container, 'gg-clamp', "Extra bases added to the 5' end of primers to improve Type IIS digestion efficiency. Typical values: 2–6.", 'Help: Protective base');
  attachHelpToInput(container, 'gg-tmTarget', "Target melting temperature for the primer core region. Primers are optimized to be close to this value.", 'Help: Target Tm');
  attachHelpToInput(container, 'gg-conc', "Effective primer concentration assumed for in silico Tm calculation. Typical range: 25-1000 nM.", 'Help: Primer concentration');
  attachHelpToInput(container, 'gg-na', "Monovalent cation concentration used for salt-corrected Tm calculation. Typical range: 10-200 mM.", 'Help: Na+ concentration');
  attachHelpToInput(container, 'gg-mg', "Divalent cation concentration used for Tm calculation. Set to 0 if Mg²⁺ is absent from reaction. Typical range: 0.5-5 mM.", 'Help: Mg2+ concentration');

  // ===== Nearest-Neighbor Thermodynamic Parameters =====
  const NN={'AA':{dH:-7.9,dS:-22.2},'TT':{dH:-7.9,dS:-22.2},'AT':{dH:-7.2,dS:-20.4},'TA':{dH:-7.2,dS:-21.3},
            'CA':{dH:-8.5,dS:-22.7},'TG':{dH:-8.5,dS:-22.7},'GT':{dH:-8.4,dS:-22.4},'AC':{dH:-8.4,dS:-22.4},
            'CT':{dH:-7.8,dS:-21.0},'AG':{dH:-7.8,dS:-21.0},'GA':{dH:-8.2,dS:-22.2},'TC':{dH:-8.2,dS:-22.2},
            'CG':{dH:-10.6,dS:-27.2},'GC':{dH:-9.8,dS:-24.4},'GG':{dH:-8.0,dS:-19.9},'CC':{dH:-8.0,dS:-19.9}};
  const R = 1.987; // cal/(mol·K)
  // Use IUPAC_COMP from CORE for complement mapping
  const comp = CORE.IUPAC_COMP;

  // ===== FASTA Parser Utility =====
  function parseFasta(text) {
    const sequences = [];
    const lines = text.split(/\r\n/);
    let currentHeader = '';
    let currentSeq = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        // Save previous sequence if exists
        if (currentHeader) {
          sequences.push({ header: currentHeader, sequence: currentSeq });
        }
        currentHeader = trimmed.substring(1).trim();
        currentSeq = '';
      } else {
        // Accumulate sequence, removing whitespace and numbers
        currentSeq += trimmed.replace(/[^A-Za-z]/g, '');
      }
    }
    // Save last sequence
    if (currentHeader) {
      sequences.push({ header: currentHeader, sequence: currentSeq });
    }
    return sequences;
  }

  // Apply reverse complement (QC-style): preserve FASTA headers; if no header, treat as single seq; append " (RC)"
  function applyRCToGGTextarea(textarea){
    if(!textarea) return;
    const raw = (textarea.value || '').trim();
    if(!raw) return;

    const lines = raw.split(/\r?\n/);
    const records = [];
    let header = null;
    let seqLines = [];

    function pushOne(){
      if(!header && seqLines.length === 0) return;
      const seq = seqLines.join('').replace(/\s+/g,'').toUpperCase();
      if(seq){
        records.push({ header, seq });
      }
    }

    for(const line of lines){
      const trimmed = line.trim();
      if(!trimmed) continue;
      if(trimmed.startsWith('>')){
        pushOne();
        header = trimmed; // keep original header text (with '>')
        seqLines = [];
      } else {
        seqLines.push(trimmed);
      }
    }
    pushOne();

    // If no header was found, treat entire textarea as one sequence (with synthetic header)
    if(records.length === 0){
      const seq = raw.replace(/\s+/g,'').toUpperCase();
      if(!seq) return;
      records.push({ header: '>RC', seq });
    }

    textarea.value = records
      .map(r => (r.header || '>RC') + '\n' + rc(r.seq))
      .join('\n');
  }

  // ===== Helpers =====
  // Use CORE functions directly
  function cleanFasta(raw) {
    if (!raw) return '';
    const records = CORE.parseFASTA(raw);
    if (records.length === 0) return '';
    return records.map(r => CORE.normalizeSeq(r.seq)).join('');
  }
  // rc, revcompSeq, gcPct are already declared globally, use them directly

  // ===== Feature Detection =====
  let FEATURES_DB = null;
  let autoFeatures = [];
  
  async function loadFeaturesDB() {
    if (Array.isArray(window.COMMON_FEATURES)) {
      FEATURES_DB = window.COMMON_FEATURES;
      return FEATURES_DB;
    }
    // If DB is not loaded yet, do not cache an empty list:
    // the DB may be loaded later (lazy-loaded after first paint).
    return FEATURES_DB || [];
  }
  
  const getFeatureColor = CORE.getFeatureColor;
  const detectFeatures = CORE.detectFeatures;

  function getFeatures(len) {
    return autoFeatures;
  }

  // ===== Enzymes =====
  const TYPEIIS = CORE.RAW_TYPEIIS_ENZYMES;
  const findTypeIISSites = CORE.findTypeIISSites;
  function deriveVectorOverhangs(seq, enz){
    const N = seq.length;
    if(!N) return null;
    const sites = findTypeIISSites(seq, enz);
    if(!sites.F.length && !sites.R.length) return null;

    // collect all cut positions around the circle
    const cuts = [];
    for(const i of sites.F){
      cuts.push((i + enz.site.length + enz.cutF + N) % N);
    }
    for(const j of sites.R){
      cuts.push((j - enz.cutR + N) % N);
    }
    if(cuts.length < 2) return null;
    cuts.sort((a,b)=>a-b);

    function circDist(a,b){
      return (b > a) ? (b - a) : (N - a + b);
    }

    // choose the neighbouring cut pair that yields the LONGEST fragment
    let bestA = cuts[0], bestB = cuts[1], bestLen = -1;
    for(let idx=0; idx<cuts.length; idx++){
      const a = cuts[idx];
      const b = cuts[(idx+1) % cuts.length];
      const len = circDist(a,b);
      if(len > bestLen){
        bestLen = len;
        bestA = a;
        bestB = b;
      }
    }
    const cutL = bestA;
    const cutR = bestB;

    function subseq(start, len){
      start = ((start % N) + N) % N;
      if(len <= 0) return '';
      if(start + len <= N) return seq.slice(start, start+len);
      return seq.slice(start) + seq.slice(0, (start+len) % N);
    }

    const leftOH  = rc(subseq(cutR, enz.overhang));
    const rightOH =     subseq(cutL, enz.overhang);
    return { leftOH, rightOH, cutL, cutR };
  }

  // Rough circular digest: use recognition-site offsets as cut positions
  function digestCircular(seq, enz){
    const N = seq.length;
    if(!N) return [];
    const sites = findTypeIISSites(seq, enz);
    const cuts = [];
    // Forward sites: cut downstream of the motif (approx site.length + cutF)
    for(const i of sites.F){
      cuts.push((i + enz.site.length + enz.cutF + N) % N);
    }
    // Reverse-complement sites: cut upstream of the motif (approx -cutR)
    for(const j of sites.R){
      cuts.push((j - enz.cutR + N) % N);
    }
    if(cuts.length < 2) return [];
    cuts.sort((a,b)=>a-b);
    const frags = [];
    for(let k=0;k<cuts.length;k++){
      const a = cuts[k];
      const b = cuts[(k+1)%cuts.length];
      const len = (b > a) ? (b - a) : (N - a + b);
      frags.push(len);
    }
    return frags;
  }

  // ===== Tm (NN model from core) =====
  // Use CORE.tmcalNN directly
  function tmNEB(seq, Na_mM = 50, conc_nM = 500) {
    return CORE.tmcalNN(seq, Na_mM, 0, conc_nM);
  }

  // ===== Primer picking (with fallbacks) =====
  const pickCorePrimerForward = CORE.pickCorePrimerForward || pickCorePrimerForwardFallback;
  const pickCorePrimerReverse = CORE.pickCorePrimerReverse || pickCorePrimerReverseFallback;

  function last4(s){ return (s||'').slice(-4); }
  function first4(s){ return (s||'').slice(0,4); }

  const makeSmartClamp = (typeof CORE.makeSmartClamp === 'function')
    ? CORE.makeSmartClamp
    : function makeSmartClamp(n) {
        const len = parseInt(n, 10);
        if (!Number.isFinite(len) || len <= 0) return '';

        const bases = ['A', 'C', 'G', 'T'];
        function randomSeq() {
          let s = '';
          for (let i = 0; i < len; i++) {
            let base;
            let attempts = 0;
            do {
              base = bases[Math.floor(Math.random() * 4)];
              attempts++;
            } while (
              attempts < 8 &&
              i >= 3 &&
              s[i - 1] === base &&
              s[i - 2] === base &&
              s[i - 3] === base
            );
            s += base;
          }
          return s;
        }

        for (let tries = 0; tries < 200; tries++) {
          const s = randomSeq();
          if (/A{4,}|C{4,}|G{4,}|T{4,}/.test(s)) continue;
          const rcS = rc(s);
          if (s === rcS) continue;
          return s;
        }

        return 'ACGTACGTAC'.slice(0, len);
      };

  function designGGPrimers(vectorRaw, frags, enzymeName, clampN, tmTarget, Na, conc, preferVectorEnds){
    const enz = TYPEIIS[enzymeName];
    const vec = cleanFasta(vectorRaw);
    const report = {warnings:[], vector:{len:vec.length}};
    report.enzymeName = enzymeName;

    // parse vector header name (first token after '>')
    let vectorName = null;
    if(vectorRaw){
      const m = String(vectorRaw).match(/^>([^\r\n]+)/m);
      if(m){
        vectorName = m[1].trim().split(/\s+/)[0];
      }
    }
    report.vectorName = vectorName;

    let vOH = null;
    if(preferVectorEnds && vec.length){
      vOH = deriveVectorOverhangs(vec, enz);
      if(!vOH){
        report.warnings.push('Vector ends not found; fallback to seamless rule at ends.');
      }
    }

    const k = frags.length;
    const inserts = frags.map(f => cleanFasta(f.seq || ''));
    const headers = frags.map(f => f.headerName || null);
    report.insertHeaders = headers;

    if(k === 0){
      report.assembledLen = vec.length;
      report.vectorOverhangs = vOH;
      report.junctions = [];
      return {report, primers:[], enzyme:enzymeName};
    }

    const I_L = new Array(k);
    const I_R = new Array(k);
    const usedOH = new Set();

    const head4 = s => (s && s.length >= 4) ? s.slice(0,4) : (s || '');
    const tail4 = s => (s && s.length >= 4) ? s.slice(s.length-4) : (s || '');

    // vector constraints
    if(vOH && vOH.leftOH){
      I_L[0] = rc(vOH.leftOH);            // Insert #1 left end complements vector left
      usedOH.add(vOH.leftOH);
      usedOH.add(I_L[0]);
    }
    if(vOH && vOH.rightOH){
      I_R[k-1] = rc(vOH.rightOH);         // Insert #k right end complements vector right
      usedOH.add(vOH.rightOH);
      usedOH.add(I_R[k-1]);
    }

    // internal junctions: Insert i → Insert i+1
    for(let i=0; i<k-1; i++){
      const prev = inserts[i];
      const next = inserts[i+1];
      const preferred = tail4(prev);
      const alternative = head4(next);
      let chosen = preferred;

      // avoid reused overhangs if possible
      if(chosen && usedOH.has(chosen)){
        if(alternative && !usedOH.has(alternative)){
          chosen = alternative;
        }else if(preferred){
          const msgAlt = (alternative && alternative !== preferred) ? ` / ${alternative}` : '';
          report.warnings.push(`Junction Insert #${i+1} → Insert #${i+2}: overhang ${preferred}${msgAlt} already used; keeping ${preferred}.`);
        }
      }
      if(!chosen){
        chosen = preferred || alternative || 'NNNN';
      }

      // We want front4 = upstream fragment's visible sticky end.
      // So we assign the COMPLEMENT of chosen to the upstream right end,
      // and chosen itself to the downstream left end.
      if(!I_R[i]) I_R[i] = rc(chosen);   // Insert i right end
      if(!I_L[i+1]) I_L[i+1] = chosen;       // Insert i+1 left end

      usedOH.add(chosen);
      usedOH.add(rc(chosen));
    }

    // if vector didn't fix first/last overhangs, fallback to seamless
    if(!I_L[0]) I_L[0] = head4(inserts[0]);
    if(!I_R[k-1]) I_R[k-1] = tail4(inserts[k-1]);

    // build junction list
    const junctions = [];
    if(k > 0){
      const leftV = (vOH && vOH.leftOH) ? vOH.leftOH : I_L[0];
      const rightI1 = I_L[0];
      junctions.push({ label:'Vector → Insert #1', leftOH:leftV, rightOH:rightI1 });

      for(let i=0;i<k-1;i++){
        junctions.push({
          label:`Insert #${i+1} → Insert #${i+2}`,
          leftOH:I_R[i],
          rightOH:I_L[i+1]
        });
      }

      const leftIk = I_R[k-1];
      const rightV = (vOH && vOH.rightOH) ? vOH.rightOH : I_R[k-1];
      junctions.push({ label:`Insert #${k} → Vector`, leftOH:leftIk, rightOH:rightV });
    }

    // primers
    const primers = [];
    const site = enz.site;
    const bases = ['A','C','G','T'];
    const randN = n => Array(n).fill(0).map(()=>bases[Math.floor(Math.random()*4)]).join('');

    for(let idx=0; idx<k; idx++){
      const insertIdx = idx + 1;
      const seq = inserts[idx];
      const headerName = headers[idx];
      const baseTag = headerName ? headerName : ('insert' + insertIdx);
      const primerLabelF = baseTag + '-F';
      const primerLabelR = baseTag + '-R';
      const name = 'Insert #' + insertIdx;
      if(!seq){
        primers.push({name, error:'Empty sequence', labelF: primerLabelF, labelR: primerLabelR, insertName: headerName, baseTag});
        continue;
      }
      const Fcore = pickCorePrimerForward(seq, tmTarget, Na, conc);
      const Rcore = pickCorePrimerReverse(seq, tmTarget, Na, conc);
      const clamp = makeSmartClamp(clampN);
      const offsetLen = enz.cutF || 1;
      const offsetF = randN(offsetLen);
      const offsetR = randN(offsetLen);

      const leftOH = I_L[idx] || '';
      const rightOH = I_R[idx] || '';

      // Forward: clamp + site + offset + overhang + core (with duplication check)
      let F = clamp + site + offsetF;
      const fOH = leftOH;
      const fHead = Fcore.slice(0, fOH.length);
      if(fOH && fHead === fOH){
        F += Fcore;
      }else{
        F += fOH + Fcore;
      }

      // Reverse: clamp + site + offset + overhang + core (with duplication check)
      let R = clamp + site + offsetR;
      const rOH = rightOH || '';
      const rHead = Rcore.slice(0, rOH.length);
      if(rOH && rHead === rOH){
        R += Rcore;
      }else{
        R += rOH + Rcore;
      }

      primers.push({
        name,
        len: seq.length,
        OH_L: leftOH,
        OH_R: rightOH,
        F, R, Fcore, Rcore,
        tmF: tmNEB(Fcore,Na,conc),
        tmR: tmNEB(Rcore,Na,conc),
        labelF: primerLabelF,
        labelR: primerLabelR,
        insertName: headerName,
        baseTag,
        clampLen: clampN,
        site
      });
    }

    report.assembledLen = vec.length + inserts.reduce((a,b)=>a + (b ? b.length : 0), 0);
    // PCR product sizes including primer-added tails
    const pcrSizes = primers.map(p => {
      if(p.error) return 0;
      const extraF = p.F.length - p.Fcore.length;
      const extraR = p.R.length - p.Rcore.length;
      return p.len + extraF + extraR;
    });
    report.pcrSizes = pcrSizes;

    report.vectorOverhangs = vOH;
    report.junctions = junctions;
    return {report, primers, enzyme:enzymeName};
  }

  const PAL = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#FFEB06'];
  
  // Draw Golden Gate assembly figure based on insert count (similar to Gibson)
  function drawAssembledFigure(k, container){
    const img = container.querySelector('#asm-img');
    const legendEl = container.querySelector('#asm-legend');
    
    if (!img) {
      console.warn('drawAssembledFigure: #asm-img element not found');
      return;
    }
    
    // Map insert count to image file
    // HTML is loaded via fetch and injected into app-index.html
    // So relative paths are relative to app/ directory
    // Images are in: app/modules/contents/pictures/Golden_gate_assembly/
    const folder = "modules/contents/pictures/Golden_gate_assembly";
    const fileMap = {
      1: "GGA_1insert.svg",
      2: "GGA_2insert.svg",
      3: "GGA_3insert.svg",
      4: "GGA_4insert.svg",
      5: "GGA_5insert.svg",
      6: "GGA_6insert.svg"
    };
    
    const insertCount = Math.min(Math.max(1, k), 6); // Clamp between 1 and 6
    
    if (fileMap[insertCount]) {
      const imagePath = folder + "/" + fileMap[insertCount];
      console.log('drawAssembledFigure: insertCount=', insertCount, 'filename=', fileMap[insertCount], 'path=', imagePath);
      img.src = imagePath;
      img.style.display = "block";
      img.onerror = function() {
        console.error('drawAssembledFigure: Failed to load image:', imagePath, 'Actual src:', img.src);
        img.style.display = "none";
      };
      img.onload = function() {
        console.log('drawAssembledFigure: Image loaded successfully:', imagePath);
      };
    } else {
      console.warn('drawAssembledFigure: No image mapping for', insertCount, 'inserts');
      img.style.display = "none";
    }
    
    // Update legend (similar to Gibson: show descriptive text below image)
    if (legendEl) {
      legendEl.innerHTML = `<div class="aside" style="margin-top: 8px; text-align: center;">Diagram is schematic only; lengths are not to scale.</div>`;
    }
  }

  function renderOHTable(junctions, k, insertNames, vectorName){
    if(!junctions || !junctions.length){
      return '<div class="aside">No junctions.</div>';
    }
    insertNames = insertNames || [];
    function sideTag(label, side){
      if(!label) return '';
      let base = '';
      const mVI = label.match(/^Vector → Insert #(\d+)/);
      if(mVI){
        base = (side === 'left') ? 'Vector' : `Insert #${mVI[1]}`;
      } else {
        const mIV = label.match(/^Insert #(\d+) → Vector/);
        if(mIV){
          base = (side === 'left') ? `Insert #${mIV[1]}` : 'Vector';
        } else {
          const mII = label.match(/^Insert #(\d+) → Insert #(\d+)/);
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
      const left  = j.leftOH || '';
      const right = j.rightOH || '';
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
          <th>Left overhang (5'→3')</th>
          <th>Right overhang (5'→3')</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Simple dimer checks (k>=5 at 3' end) with "I" alignment guide
  function renderAlignment(A, Brc, off){
    let minI = Math.min(0, off);
    let maxI = Math.max(A.length, Brc.length+off);
    let lineA = "", lineB = "", lineM = "";
    for(let pos=minI; pos<maxI; pos++){
      const i = pos;
      const j = pos - off;
      const a = (i>=0 && i<A.length) ? A[i] : " ";
      const b = (j>=0 && j<Brc.length) ? Brc[j] : " ";
      lineA += a;
      lineB += b;
      lineM += (a!==" " && b!==" " && comp[a]===b) ? "I": " ";
    }
    return [
      "5' "+lineA+" 3'",
      "   "+lineM,
      "3' "+lineB+" 5' (rc)"
    ].join("\\n");
  }
  // Use CORE.dimerScan for dimer detection
  function bestPCRDimer(A, B, kmin=5){
    const result = CORE.dimerScan(A, B);
    if (!result || !result.overlap) return null;
    const k = result.overlap.length;
    if (k < kmin) return null;
    const align = renderAlignment(A.toUpperCase(), rc(B.toUpperCase()), result.offset);
    return {
      off: result.offset,
      side: result.touches3 ? 'A3' : 'B3',
      k: k,
      align: align
    };
  }
  // Use CORE.threePrimeDG to check for palindromic tail
  function selfTail6YES(p){
    if(p.length<6) return false;
    const tail = p.slice(-6).toUpperCase();
    const rcTail = rc(tail);
    return tail === rcTail;
  }
  // Use CORE.hairpinScan for hairpin detection
  function hairpinYES(p){
    const result = CORE.hairpinScan(p);
    if (!result) return false;
    const endWin = 5;
    const p3 = p.length - 1;
    const touches3 = (result.end >= p3 - endWin + 1 && result.end <= p3);
    return result.stem >= 5 && touches3;
  }

  // === QC v1.3-style helpers for Golden Gate ===
  function cleanSeq(r){
    return (r||"").toUpperCase().replace(/[^ACGT]/g,"");
  }
  function has3GCClamp(s){
    if(!s.length) return false;
    const c = s[s.length-1];
    return c==="G" || c==="C";
  }
  function hasHomopolymer(s,n){
    return new RegExp("A{"+n+",}|C{"+n+",}|G{"+n+",}|T{"+n+",}").test((s||"").toUpperCase());
  }
  function duplexDG37(seq){
    const s = (seq||"").toUpperCase();
    if(s.length<2) return NaN;
    let dH=0,dS=0;
    for(let i=0;i<s.length-1;i++){
      const p = NN[s.slice(i,i+2)];
      if(!p) return NaN;
      dH += p.dH;
      dS += p.dS;
    }
    dH += 0.2;
    dS += -5.7;
    const T = 310.15; // 37°C
    return dH - T*dS/1000;
  }
  function fmt2(x){return isFinite(x) ? x.toFixed(2) : "--";}
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
      const a = (i>=0 && i<n) ? A[i] : " ";
      const b = (j>=0 && j<m) ? Brev[j] : " ";
      lineA+=a;
      lineB+=b;
      lineM += (a!==" " && b!==" " && comp[a]===b) ? "|" : " ";
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
    const minStem=4, minLoop=3, threeWin=5;
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
          const touches3 = (j>=n-threeWin) || (b-1>=n-threeWin);
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
    const gcCore = CORE.gcPct(core);
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
  function qcPairGG(F,R){
    if(!F || !R || F.empty || R.empty) return null;
    const d = dimerScan(F.seq,R.seq);
    const info = d ? classifyDG(d.dg,d.touches3) : {label:"None",cls:"ok"};
    return {dimer:d,info};
  }

  // FIXED: This function now uses the container
  function renderPrimerBlocks(primers){
    // Merge primer design + QC into one table per insert
    const Na = parseFloat(container.querySelector('#gg-na').value || '50');
    const conc = parseFloat(container.querySelector('#gg-conc').value || '500');

    // Build formatted sequence cell + basic stats for one primer
    function buildSeqCell(seqCore, fullSeq, overhangSeq, clampLen, site){
      const len = fullSeq.length;
      const gc = CORE.gcPct(fullSeq);

      // --- original visual segmentation logic ---
      let coreIdx = fullSeq.lastIndexOf(seqCore);
      if (coreIdx < 0) {
        coreIdx = fullSeq.length - seqCore.length;
      }
      const prefix = fullSeq.slice(0, coreIdx);
      const core = fullSeq.slice(coreIdx);

      const cLen = clampLen || 0;
      const clampPart = prefix.slice(0, cLen);
      let rest = prefix.slice(cLen);

      let sitePart = '';
      const siteSeq = site || '';
      if (siteSeq && rest.startsWith(siteSeq)) {
        sitePart = rest.slice(0, siteSeq.length);
        rest = rest.slice(siteSeq.length);
      }

      // split remaining into offset + explicit overhang (if present)
      let offsetPart = rest;
      let overhangPart = '';
      const oh = overhangSeq || '';
      if (oh) {
        const idx = rest.lastIndexOf(oh);
        if (idx >= 0) {
          const before = rest.slice(0, idx);
          const ohSeg = rest.slice(idx, idx + oh.length);
          const after = rest.slice(idx + oh.length);
          offsetPart = before + after;
          overhangPart = ohSeg;
        }
      }

      // If overhang not explicitly in prefix but core starts with it, bold that portion
      let coreMarkup = core;
      if (oh && !overhangPart && core.startsWith(oh)) {
        coreMarkup = '<b>' + core.slice(0, oh.length) + '</b>' + core.slice(oh.length);
      }

      const disp =
        (clampPart ? '<i>' + clampPart + '</i>' : '') +
        (sitePart ? '<u>' + sitePart + '</u>' : '') +
        offsetPart +
        (overhangPart ? '<b>' + overhangPart + '</b>' : '') +
        coreMarkup;

      return {disp, len, gc};
    }

    let out = '';
    const clampLen = (primers[0] && primers[0].clampLen) || 0;
    const site = (primers[0] && primers[0].site) || '';

    primers.forEach((p, i) => {
      // Calculate PCR product size: insert length + primer tails
      const fwdTailLen = p.F ? (p.F.length - (p.Fcore || '').length) : 0;
      const revTailLen = p.R ? (p.R.length - (p.Rcore || '').length) : 0;
      const pcrProductSize = (p.len || 0) + fwdTailLen + revTailLen;

      const insertLabel = p.insertName
        ? ('Insert #' + (i+1) + ' (' + p.insertName + ')')
        : ('Insert #' + (i+1));

      const sizeInfo = '<span class="aside" style="font-weight:normal;margin-left:10px;">Template: ' + 
        p.len + ' bp | PCR Product: <b>' + pcrProductSize + ' bp</b></span>';

      if (p.error) {
        out += '<div class="box" style="margin-bottom:8px">' +
          '<h3>' + insertLabel + '</h3>' +
          '<div style="color:#b91c1c">' + p.error + '</div>' +
          '</div>';
        return;
      }

      const labelF = p.labelF || 'Forward';
      const labelR = p.labelR || 'Reverse';

      // Use existing QC helpers; computed once here only
      const Fqc = analyzePrimer(labelF, p.F, p.Fcore, Na, conc);
      const Rqc = analyzePrimer(labelR, p.R, p.Rcore, Na, conc);
      const pair = qcPairGG(Fqc, Rqc);  // includes cross-dimer info

      const Fseq = buildSeqCell(p.Fcore, p.F, p.OH_L, clampLen, site);
      const Rseq = buildSeqCell(p.Rcore, p.R, p.OH_R, clampLen, site);

      // QC badges
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
        '<div style="font-weight:700;margin-bottom:8px;font-size:15px;color:#0f172a;">' + 
        insertLabel + sizeInfo + '</div>' +
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
            // first row: Forward, with cross-dimer cell rowspan=2
            '<tr>' +
              '<td>' + labelF + '</td>' +
              '<td class="mono seqcell">' + Fseq.disp + '</td>' +
              '<td style="text-align: center;">' + Fseq.len + '</td>' +
              '<td style="text-align: center;">' + Fseq.gc.toFixed(1) + '%</td>' +
              '<td style="text-align: center;">' + F_tmCore + ' / ' + F_tmFull + '</td>' +
              '<td style="text-align: center;">' + F_homopoly + '</td>' +
              '<td style="text-align: center;">' + F_hairpin + '</td>' +
              '<td style="text-align: center;">' + F_self + '</td>' +
              '<td rowspan="2" style="vertical-align: middle; text-align: center;">' + crossBadge + '</td>' +
            '</tr>' +
            // second row: Reverse, no cross-dimer cell
            '<tr>' +
              '<td>' + labelR + '</td>' +
              '<td class="mono seqcell">' + Rseq.disp + '</td>' +
              '<td style="text-align: center;">' + Rseq.len + '</td>' +
              '<td style="text-align: center;">' + Rseq.gc.toFixed(1) + '%</td>' +
              '<td style="text-align: center;">' + R_tmCore + ' / ' + R_tmFull + '</td>' +
              '<td>' + R_homopoly + '</td>' +
              '<td>' + R_hairpin + '</td>' +
              '<td>' + R_self + '</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';
    });
    return out;
  }
  function qcSummary(primers, k){
    let issues=[];
    primers.forEach((p,i)=>{
      if(p.error) return;
      const sdF = bestPCRDimer(p.F,p.F,5);
      const sdR = bestPCRDimer(p.R,p.R,5);
      const xd  = bestPCRDimer(p.F,p.R,5);
      if(sdF) issues.push(`Insert #${i+1} Forward self-dimer (3' matches = ${sdF.k})`);
      if(sdR) issues.push(`Insert #${i+1} Reverse self-dimer (3' matches = ${sdR.k})`);
      if(xd)  issues.push(`Insert #${i+1} Cross-dimer F×R (3' matches = ${xd.k})`);
      if(selfTail6YES(p.F)) issues.push(`Insert #${i+1} Forward has 6-bp palindromic tail`);
      if(selfTail6YES(p.R)) issues.push(`Insert #${i+1} Reverse has 6-bp palindromic tail`);
      if(hairpinYES(p.F)) issues.push(`Insert #${i+1} Forward hairpin risk`);
      if(hairpinYES(p.R)) issues.push(`Insert #${i+1} Reverse hairpin risk`);
    });
    if(!issues.length) return '<div class="aside">No red flags with k<sub>min</sub>=5. Binding-region Tm shown in table.</div>';
    return '<ul><li>'+issues.join('</li><li>')+'</li></ul>';
  }

  // ===== Gel (canvas, SnapGene-style) =====
  // Ladder profiles: prefer VIZ, then window; final guard with built-in defaults
  const LADDER_PROFILES = VIZ.LADDER_PROFILES || window.LADDER_PROFILES || {
    neb1kbplus: {
      name: 'NEB 1kb Plus DNA Ladder',
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

  function getLadderProfile(key){
    if (LADDER_PROFILES && LADDER_PROFILES[key]) return LADDER_PROFILES[key];
    const keys = LADDER_PROFILES ? Object.keys(LADDER_PROFILES) : [];
    if (keys.length === 0) return null;
    return LADDER_PROFILES[keys[0]];
  }

  // state shared between Golden Gate core and gel
  const GGX_STATE = {
    lanes: [],
    scIdx: new Set([1, 4]),
    profile: 'neb1kbplus',
    assembledLaneIndex: null,
    insertCount: 0,
    insertNames: [],
    vectorName: null,
    enzymeName: null,
    assembledName: null
  };

  // migration fit removed (handled by VIZ)

  function ggxDrawGel(){
    VIZ.updateGelState({
        lanes: GGX_STATE.lanes,
        scIdx: GGX_STATE.scIdx,
        profile: GGX_STATE.profile,
        assembledLaneIndex: GGX_STATE.assembledLaneIndex,
        insertCount: GGX_STATE.insertCount,
        insertNames: GGX_STATE.insertNames,
        vectorName: GGX_STATE.vectorName,
        enzymeName: GGX_STATE.enzymeName,
        assembledName: GGX_STATE.assembledName
    });
    VIZ.drawGel('gg-gel-canvas'); 
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
    const prof = getLadderProfile(GGX_STATE.profile);
    if(!prof) return;
    legend.push('L1 DNA Ladder (' + prof.name + ')');

    const lane2 = lanes[1] || [];
    const lane3 = lanes[2] || [];
    const vName = GGX_STATE.vectorName || null;
    const enzName = GGX_STATE.enzymeName || null;

    const vLabel = vName ? ('L2 Uncut vector (' + vName + ')') : 'L2 Uncut vector';
    legend.push(vLabel + ': ' + ggxFormatBands(lane2));

    let digestBase = 'Type IIS digest of vector';
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

    for(let i=0; i<insertCount; i++){
      const laneIdx = 3 + i;
      const sz = lanes[laneIdx] || [];
      const insName = (GGX_STATE.insertNames && GGX_STATE.insertNames[i]) ? (' (' + GGX_STATE.insertNames[i] + ')') : '';
      legend.push('L' + (laneIdx+1) + ' PCR of insert #' + (i+1) + insName + ': ' + ggxFormatBands(sz));
    }

    if(typeof assembledLaneIndex === 'number' && assembledLaneIndex >= 0){
      const last = lanes[assembledLaneIndex] || [];
      const asmName = GGX_STATE.assembledName || 'GoldenGate_assembled';
      legend.push('L' + (assembledLaneIndex+1) + ' Assembled plasmid (' + asmName + '): ' + ggxFormatBands(last));
    }

    const legendEl = container.querySelector('#ggx-legend');
    if(legendEl){
      legendEl.innerHTML = legend.map(s => '<div>' + s + '</div>').join('');
    }
  }

  // Public API (called by Golden Gate core)
  function showGel(vectorLen, cutFrags, pcrSizes, assembledLen, insertNames, vectorName, enzymeName, assembledName){
    // Keep ladder profile in sync with UI selection
    const ladderSelect = container.querySelector('#ggx-ladder');
    if (ladderSelect && ladderSelect.value) {
      GGX_STATE.profile = ladderSelect.value;
    }
    const lane2 = Array.isArray(vectorLen) ? vectorLen : [vectorLen];
    let digest = (cutFrags && cutFrags.length) ? cutFrags.slice() : [];
    const inserts = (pcrSizes && pcrSizes.length) ? pcrSizes.slice() : [];
    const assembled = (assembledLen && assembledLen > 0)
        ? (Array.isArray(assembledLen) ? assembledLen : [assembledLen])
        : [];

    // If no digest bands (no enzyme sites), show "cut" vector identical to uncut
    if(!digest.length){
      digest = lane2.slice();
    }

    // fixed 10 lanes
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
    if(assembled.length){
      assembledLaneIndex = 3 + insertCount;
      if(assembledLaneIndex < 10){
        lanes[assembledLaneIndex] = assembled;
      }
    }

    GGX_STATE.lanes = lanes;
    GGX_STATE.scIdx = new Set([1].concat(assembledLaneIndex !== null ? [assembledLaneIndex] : []));
    GGX_STATE.assembledLaneIndex = assembledLaneIndex;
    GGX_STATE.insertCount = insertCount;
    GGX_STATE.insertNames = Array.isArray(insertNames) ? insertNames.slice(0, insertCount) : [];
    GGX_STATE.vectorName = vectorName || null;
    GGX_STATE.enzymeName = enzymeName || null;
    GGX_STATE.assembledName = assembledName || null;

    ggxDrawGel();
    ggxUpdateLegend();
  }

  // Marker change handler is now in renderGGResults

  // ===== Vector Map Preview =====
  let ggRotationDeg = 0;

  function ggUpdateRotLabel(){
    const lbl = container.querySelector('#gg-map-rot-label');
    if(lbl) lbl.textContent = ggRotationDeg + '°';
  }

  const parseHeader = CORE.extractFirstHeader;

  function renderVectorMap(){
    const rawEl = container.querySelector('#gg-vector');
    const raw = rawEl ? rawEl.value : '';
    const seq = cleanFasta(raw);
    const len = seq.length;

    // If no sequence, clear canvas and show placeholder like Gibson
    if (!len) {
      const canvas = container.querySelector('#gg-map-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      const statsEl = container.querySelector('#gg-map-stats');
      if (statsEl) statsEl.textContent = 'Paste vector sequence above to update preview.';
      return;
    }
    
    // Call the visualizer
    // We pass the canvas ID, sequence length, vector name, and annotations
    // But first we need to compute annotations (enzymes + features) to pass to VIZ
    // Alternatively, VIZ.drawVectorMap takes (canvasId, seqLen, name, annotations, rotationDeg)
    
    const vName = parseHeader(raw) || 'Vector';
    
    // Calculate enzyme sites for visualization
    const sites = [];
    const selectedEnz = container.querySelector('#gg-enzyme').value || '';
    const enzymesToShow = selectedEnz ? [selectedEnz] : Object.keys(TYPEIIS);

    if(seq && seq.length >= 50) {
        enzymesToShow.forEach(name => {
          const enz = TYPEIIS[name];
          if(!enz) return;
          const hit = findTypeIISSites(seq, enz);
          (hit.F || []).forEach(i => { sites.push({ name, pos: i+1, strand:'+' }); });
          (hit.R || []).forEach(i => { sites.push({ name, pos: i+1, strand:'-' }); });
        });
    }
    
    // Load features and then draw
    loadFeaturesDB().then(db => {
        let features = [];
        try {
            if(seq && seq.length >= 50) {
                features = detectFeatures(seq, db);
            }
        } catch(e) { console.error(e); }
        
        // Combine enzymes and features
        const annotations = [...features, ...sites];
        VIZ.drawVectorMap('gg-map-canvas', len, vName, annotations, ggRotationDeg);
        
        // Also update stats text
        const statsEl = container.querySelector('#gg-map-stats');
        if(statsEl){
            if(!len) statsEl.textContent = 'Paste vector sequence above to update preview.';
            else if(len < 50) statsEl.textContent = 'Vector too short to draw map (' + len + ' bp).';
            else if(!sites.length) statsEl.textContent = len + ' bp; no Type IIS sites detected.';
            else {
                const counts = {};
                sites.forEach(s => { counts[s.name] = (counts[s.name]||0) + 1; });
                const detail = Object.keys(counts).map(k => k + ': ' + counts[k]).join(', ');
                statsEl.textContent = len + ' bp; ' + sites.length + ' Type IIS sites → ' + detail;
            }
        }
    });
  }

  function initVectorMapPreview(){
    window.addEventListener('common-features-ready', () => {
      FEATURES_DB = null;
      renderVectorMap();
    }, { once: true });

    const txt = container.querySelector('#gg-vector');
    if(txt){
      txt.addEventListener('input', ()=>{
        renderVectorMap();
        updateEnzymeInfo();
        analyzeVectorFragments();
      });
    }
    const fileInput = container.querySelector('#file-vector');
    if(fileInput){
      fileInput.addEventListener('change', ()=>{
        setTimeout(()=>{
          renderVectorMap();
          updateEnzymeInfo();
          analyzeVectorFragments();
        }, 80);
      });
    }
    const rotSlider = container.querySelector('#gg-map-rotation');
    if(rotSlider){
      rotSlider.addEventListener('input', (e)=>{
        ggRotationDeg = parseFloat(e.target.value) || 0;
        ggUpdateRotLabel();
        renderVectorMap();
      });
      ggRotationDeg = parseFloat(rotSlider.value || '0') || 0;
      ggUpdateRotLabel();
    }
    // Listen for enzyme change
    const enzymeSelect = container.querySelector('#gg-enzyme');
    if(enzymeSelect){
      enzymeSelect.addEventListener('change', ()=>{
        updateEnzymeInfo();
        analyzeVectorFragments();
        renderVectorMap();
      });
    }
    window.requestAnimationFrame(renderVectorMap);
  }

  // ===== Enzyme Info and Fragment Analysis =====
  function updateEnzymeInfo(){
    const infoEl = container.querySelector('#gg-enzyme-info');
    const lockedEl = container.querySelector('#gg-enzyme-locked');
    const enzName = container.querySelector('#gg-enzyme').value;
    const enz = TYPEIIS[enzName];
    if(infoEl){
      infoEl.textContent = enz ? (enzName + ': ' + enz.site + ' (Overhang: ' + enz.overhang + ' bp)') : 'Please select enzyme...';
    }
    if(lockedEl){
      lockedEl.value = enz ? enzName : '';
    }
  }

  // Vector fragment analysis state
  let vectorFragments = [];
  let selectedFragmentIdx = 0;

  function analyzeVectorFragments(){
    const backboneSelect = container.querySelector('#gg-backbone-select');
    if(!backboneSelect) return;

    const rawEl = container.querySelector('#gg-vector');
    const raw = rawEl ? rawEl.value : '';
    const seq = cleanFasta(raw);
    const enzName = container.querySelector('#gg-enzyme').value;
    const enz = TYPEIIS[enzName];

    // Require enzyme selection for fragment analysis
    if(!enz){
      backboneSelect.innerHTML = '<option value="">Please select enzyme...</option>';
      backboneSelect.disabled = true;
      vectorFragments = [];
      return;
    }

    if(!seq || seq.length < 50){
      backboneSelect.innerHTML = '<option value="">Analyze vector first...</option>';
      backboneSelect.disabled = true;
      vectorFragments = [];
      return;
    }

    // Find all Type IIS sites
    const sites = findTypeIISSites(seq, enz);
    const siteCount = sites.F.length + sites.R.length;

    if(siteCount < 2){
      backboneSelect.innerHTML = '<option value="">Vector needs ≥ ' + enzName + ' sites</option>';
      backboneSelect.disabled = true;
      vectorFragments = [];
      return;
    }

    // Compute cut positions
    const N = seq.length;
    const cuts = [];
    for(const i of sites.F){
      cuts.push((i + enz.site.length + enz.cutF + N) % N);
    }
    for(const j of sites.R){
      cuts.push((j - enz.cutR + N) % N);
    }
    cuts.sort((a,b)=>a-b);

    // Calculate fragment lengths
    const fragments = [];
    for(let i=0; i<cuts.length; i++){
      const start = cuts[i];
      const end = cuts[(i+1) % cuts.length];
      let len = end - start;
      if(len <= 0) len += N;
      fragments.push({ id: i, start, end, len });
    }

    vectorFragments = fragments;

    // Populate dropdown, auto-select longest
    let longestIdx = 0;
    let longestLen = 0;
    backboneSelect.innerHTML = '';
    fragments.forEach((frag, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = 'Fragment ' + (i+1) + ': ' + frag.len + ' bp';
      if(frag.len > longestLen){
        longestLen = frag.len;
        longestIdx = i;
      }
      backboneSelect.appendChild(opt);
    });

    backboneSelect.value = longestIdx;
    backboneSelect.disabled = false;
    selectedFragmentIdx = longestIdx;

    // Listen for backbone selection change
    backboneSelect.onchange = ()=>{
      selectedFragmentIdx = parseInt(backboneSelect.value) || 0;
    };
  }

  // ===== Modal Dialog System (MW standard) =====
  function showModal(msg){
    showMWMessage(msg || '');
  }
  window._ggShowModal = showModal;

  // ===== UI glue =====
  // FIXED: This function now uses the container
  function syncVectorHeight(){
    const leftTA=container.querySelector('#gg-vector');
    const fragListDiv=container.querySelector('#frag-list');
    if(!leftTA || !fragListDiv) return;
    const rect = fragListDiv.getBoundingClientRect();
    const target = Math.max(140, Math.min(1200, rect.height || fragListDiv.scrollHeight || 140));
    const current = leftTA.getBoundingClientRect().height || 0;
    // Only grow (avoid init-time shrink/jump; min-height is set in HTML).
    if (current + 2 < target) {
      leftTA.style.height = target + 'px';
    }
  }
  function scheduleSync(){ window.requestAnimationFrame(syncVectorHeight); }

  const fragList = container.querySelector('#frag-list');
  function renumberFrags(){ Array.from(fragList.querySelectorAll('.frag-label')).forEach((el,i)=>{ el.textContent = 'Insert #'+(i+1); }); enforceFragCap(); }
  let fragId = 0;
  function fragRow(seq=''){
    const id = ++fragId;
    const wrap = document.createElement('div'); wrap.className='frag-row'; wrap.dataset.fragId=id;
    wrap.innerHTML = `
      <div class="frag-label">Insert #</div>
      <div class="frag-body">
        <textarea class="frag-seq" placeholder=">insert\\nATG...">${seq}</textarea>
        <div class="frag-tools">
          <input type="file" class="file-frag" accept=".fa,.fasta,.fas,.txt" style="display:none">
          <button class="btn demo btn-frag-flip" type="button" title="Reverse-complement this insert">Reverse complement</button>
          <button class="btn demo btn-frag-demo" type="button">Demo</button>
          <button class="ghost btn btn-frag-upload" type="button">Upload</button>
        </div>
      </div>
      <div></div>
      <div class="frag-actions" style="width: 100%;">
        <button class="ghost btn sm up" type="button" title="Move up" style="width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">▲</button>
        <button class="ghost btn sm down" type="button" title="Move down" style="width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">▼</button>
        <button class="ghost btn sm del" type="button" title="Delete" style="width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">✕</button>
      </div>`;
    fragList.appendChild(wrap); renumberFrags(); scheduleSync();
  }
  // FIXED: This function now uses the container
  function enforceFragCap(){
    const count = fragList.querySelectorAll('.frag-row').length;
    const addBtn = container.querySelector('#frag-add');
    addBtn.disabled = count >= 6;
    addBtn.textContent = count>=6 ? 'Max 6 inserts' : '+ Add insert';
  }

  // FIXED: This function now uses the container
  function collectFragments(){
    return Array.from(container.querySelectorAll('.frag-row')).map(r=>{
      const raw = r.querySelector('.frag-seq').value || '';
      const headerName = parseHeader(raw);
      return { seq: raw, headerName };
    }).filter(f=> cleanFasta(f.seq).length>0 ).slice(0,6);
  }

  // Event delegation for fragment list
  window.addEventListener('resize', scheduleSync);
  fragList.addEventListener('input', scheduleSync);
  try{
    const mo = new MutationObserver(scheduleSync);
    mo.observe(fragList, {childList:true, subtree:true});
  }catch(e){}
  fragList.addEventListener('click', (e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const row=e.target.closest('.frag-row'); if(!row) return;
    if(btn.classList.contains('up')){ if(row.previousElementSibling) fragList.insertBefore(row,row.previousElementSibling); renumberFrags(); scheduleSync(); }
    else if(btn.classList.contains('down')){ if(row.nextElementSibling) fragList.insertBefore(row.nextElementSibling,row); renumberFrags(); scheduleSync(); }
    else if(btn.classList.contains('del')){ row.remove(); renumberFrags(); scheduleSync(); }
    else if(btn.classList.contains('btn-frag-upload')){ row.querySelector('.file-frag').click(); }
    else if(btn.classList.contains('btn-frag-flip')){
      const ta=row.querySelector('.frag-seq');
      if(ta){
        applyRCToGGTextarea(ta);
      }
    }
  });
  fragList.addEventListener('change', (e)=>{
    const inp=e.target.closest('.file-frag'); if(!inp) return;
    const row=e.target.closest('.frag-row'); if(!row) return;
    const ta=row.querySelector('.frag-seq'); const f=inp.files && inp.files[0];
    const r=new FileReader(); 
    r.onload=ev=>{ 
      const text = ev.target.result;
      // Keep raw content (preserves FASTA headers) like QC
      ta.value = text;
    }; 
    if(f) r.readAsText(f);
  });

  // Top buttons (all FIXED to use container)
  container.querySelector('#frag-add').addEventListener('click', ()=>{ fragRow(); });
  container.querySelector('#flip-order').addEventListener('click', ()=>{
    const rows=Array.from(fragList.querySelectorAll('.frag-row'));
    if(rows.length<2) return;
    rows.reverse().forEach(r=>fragList.appendChild(r));
    renumberFrags(); scheduleSync();
  });
  container.querySelector('#btn-vector-upload').addEventListener('click', ()=> container.querySelector('#file-vector').click());
  container.querySelector('#file-vector').addEventListener('change', ()=>{
    const f=container.querySelector('#file-vector').files[0]; if(!f) return;
    const r=new FileReader(); 
    r.onload=e=>{ 
      // Keep raw content (preserves FASTA headers) like QC
      const text = e.target.result;
      container.querySelector('#gg-vector').value = text;
    }; 
    r.readAsText(f);
  });

  // Vector RC button
  const vectorRCBtn = container.querySelector('#btn-vector-rc');
  if(vectorRCBtn){
    vectorRCBtn.addEventListener('click', ()=>{
      const ta = container.querySelector('#gg-vector');
      if(ta){
        applyRCToGGTextarea(ta);
        renderVectorMap();
        updateEnzymeInfo();
        analyzeVectorFragments();
      }
    });
  }

  // Demo button functionality
  let sampleSequences = null;
  async function loadSampleSequences() {
    if (sampleSequences) return sampleSequences;
    const demoBase = new URL('modules/contents/demo/', window.location.href).toString();
    const demoFiles = [
      'Golden_Gate_vector.txt',
      'Insert_1.txt',
      'Insert_2.txt',
      'Insert_3.txt',
      'Insert_4.txt',
      'Insert_5.txt',
      'Insert_6.txt',
    ].map(name => demoBase + name);

    const results = [];
    for (const path of demoFiles) {
      try {
        const resp = await fetch(path);
        if (!resp.ok) {
          console.warn('Demo fetch failed', path, resp.status);
          continue;
        }
        const text = await resp.text();
        const parsed = parseFasta(text);
        if (parsed && parsed.length) {
          results.push(...parsed);
        }
      } catch (e) {
        console.error('Failed to load demo file:', path, e);
      }
    }
    console.log('Demo sequences loaded', results.map(r=>r.header));
    sampleSequences = results;
    return sampleSequences;
  }

  // Vector demo button
  container.querySelector('#btn-vector-demo').addEventListener('click', async ()=>{
    const samples = await loadSampleSequences();
    console.log('Vector demo click, samples', samples.map(s=>s.header));
    const vectorSample = samples.find(s => /vector|psev/i.test((s.header || '').toLowerCase()));
    if (vectorSample) {
      container.querySelector('#gg-vector').value = `>${vectorSample.header}\n${vectorSample.sequence}`;
      renderVectorMap();
      updateEnzymeInfo();
      analyzeVectorFragments();
    }
  });

  // Demo Set button - fill vector + first two inserts, set enzyme to BsaI
  container.querySelector('#demo-set-btn').addEventListener('click', async ()=>{
    const samples = await loadSampleSequences();
    console.log('Demo set click, samples', samples.map(s=>s.header));
    
    const vectorSample = samples.find(s => /vector|psev/i.test((s.header || '').toLowerCase()));
    const insertSamples = samples.filter(s => s !== vectorSample);
    if (!vectorSample || insertSamples.length < 2) {
      console.warn('Demo set: missing vector or not enough inserts');
      return;
    }

    // Fill vector and run analysis
    container.querySelector('#gg-vector').value = `>${vectorSample.header}\n${vectorSample.sequence}`;
    renderVectorMap();
    updateEnzymeInfo();
    analyzeVectorFragments();

    // Wait a bit for map/UI to settle
    await new Promise(res => setTimeout(res, 50));

    // Ensure at least two insert rows
    while (fragList.querySelectorAll('.frag-row').length < 2) {
      fragRow();
    }

    const rows = fragList.querySelectorAll('.frag-row');
    const fillInsert = (row, sample) => {
      const ta = row.querySelector('.frag-seq');
      if (ta) ta.value = `>${sample.header}\n${sample.sequence}`;
    };
    fillInsert(rows[0], insertSamples[0]);
    fillInsert(rows[1], insertSamples[1]);

    // Set enzyme to BsaI
    const enzSel = container.querySelector('#gg-enzyme');
    if (enzSel) {
      enzSel.value = 'BsaI';
      enzSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Insert demo buttons (event delegation for dynamically created buttons)
  fragList.addEventListener('click', async (e)=>{
    if (e.target.classList.contains('btn-frag-demo')) {
      const fragRow = e.target.closest('.frag-row');
      const labelText = fragRow.querySelector('.frag-label').textContent;
      const insertNum = parseInt((labelText.match(/\d+/) || [1])[0]) || 1;
      
      const samples = await loadSampleSequences();
      console.log('Insert demo click, samples', samples.map(s=>s.header), 'insertNum', insertNum);
      const vectorSample = samples.find(s => /vector|psev/i.test((s.header || '').toLowerCase()));
      const insertSamples = samples.filter(s => s !== vectorSample);
      const insertSample = insertSamples[insertNum - 1];
      
      if (insertSample) {
        const textarea = fragRow.querySelector('.frag-seq');
        textarea.value = `>${insertSample.header}\n${insertSample.sequence}`;
      }
    }
  });

  // FIXED: This helper function now uses the container
  function hardReset(){
    container.querySelector('#gg-vector').value='';
    container.querySelector('#results-wrap').style.display='none';
    const primerNode = container.querySelector('#primer-table');
    if (primerNode) primerNode.innerHTML = '';
    const ohNode = container.querySelector('#oh-table');
    if (ohNode) ohNode.innerHTML = '';
    const gelSec = container.querySelector('#gg-gel-section');
    if (gelSec) gelSec.style.display = 'none';
    const ggxSvg = container.querySelector('#ggx-svg');
    if (ggxSvg) ggxSvg.innerHTML = '';
    const ggxLegend = container.querySelector('#ggx-legend');
    if (ggxLegend) ggxLegend.innerHTML = '';
    const ggxLanes = container.querySelector('#ggx-lanes');
    if (ggxLanes) ggxLanes.innerHTML = '';
    GGX_STATE.lanes=[];
    const fragListElement = container.querySelector('#frag-list');
    if(fragListElement) {
      fragListElement.innerHTML='';
      fragId=0;
      fragRow();
      fragRow();
      scheduleSync();
    }
    window._ggAssembledSeq = '';
    window._ggAssembledName = '';
    window._ggHasResults = false;
    window._ggPrimers = null;
  }

  // FIXED: Demo button now fetches from sample file (optional - button removed in v3.3)
  const demoBtn = container.querySelector('#global-demo');
  if(demoBtn) demoBtn.addEventListener('click', async ()=>{
    try {
      const sequences = await loadSampleSequences();
      console.log('Global demo click, sequences', sequences.map(s=>s.header));
      if (!sequences.length) throw new Error('No demo sequences found');
      
      const vectorSample = sequences.find(s => /vector|psev/i.test((s.header || '').toLowerCase()));
      const insertSamples = sequences.filter(s => s !== vectorSample);
      if (!vectorSample || insertSamples.length === 0) {
        throw new Error('Demo sequences incomplete (need vector + inserts)');
      }
      
      container.querySelector('#gg-vector').value = `>${vectorSample.header}\n${vectorSample.sequence}`;
      
      fragList.innerHTML = '';
      fragId = 0;
      insertSamples.forEach(ins => fragRow(ins.sequence));
      scheduleSync();
      scheduleSync();
    } catch (error) {
      console.error('Error loading sample:', error);
      showModal('Failed to load sample file: ' + error.message);
    }
  });
      
  // FIXED: Reset button - simply reload the page
  container.querySelector('#global-reset').addEventListener('click', () => {
    window.location.reload();
  });

  // Run
  container.querySelector('#gg-run').addEventListener('click', ()=>{
    const seqEls = [
      container.querySelector('#gg-vector'),
      ...Array.from(container.querySelectorAll('#frag-list .frag-seq'))
    ];
    if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
      const shown = VIZ.guardSingleFastaPerField(container || document.body, seqEls, () => {
        const btn = container.querySelector('#gg-run');
        if (btn) window.setTimeout(() => btn.click(), 0);
      });
      if (shown) return;
    }

    try{
      console.log('Design button clicked');
      const vector = container.querySelector('#gg-vector').value;
      const frags  = collectFragments();
      if(!frags.length){
        showModal('Please add at least one insert sequence.');
        return;
      }
      const enz   = container.querySelector('#gg-enzyme').value;
      if(!enz || !TYPEIIS[enz]){
        showModal('Please select a Type IIS enzyme.');
        return;
      }
      const clampN    = parseInt(container.querySelector('#gg-clamp').value||'5',10);
      const tmTarget  = parseFloat(container.querySelector('#gg-tmTarget').value||'55');
      const Na        = parseFloat(container.querySelector('#gg-na').value||'50');
      const conc      = parseFloat(container.querySelector('#gg-conc').value||'500');
      const preferVectorEnds = true;

      const warnings = [];
      const vecBodyRaw = String(vector || '').replace(/^>.*$/gm, '');
      const vecBodyLen = vecBodyRaw.replace(/\s+/g, '').length;
      if (VIZ && VIZ.validateSequenceInput) {
        const vecLabel = ((vector || '').match(/^>([^\r\n]+)/m) || [])[1]?.trim()?.split(/\s+/)[0] || 'Vector';
        warnings.push(...VIZ.validateSequenceInput([{ label: vecLabel, seq: vecBodyRaw }], 'Vector'));
        const insertItems = frags.map((f, i) => ({
          label: f.headerName || `Insert #${i + 1}`,
          seq: String(f.seq || '').replace(/^>.*$/gm, '')
        }));
        warnings.push(...VIZ.validateSequenceInput(insertItems, 'Insert'));
      }
      if (VIZ && VIZ.validateParameterRange) {
        const Mg = parseFloat(container.querySelector('#gg-mg')?.value ?? '');
        const params = { Na, conc, targetTm: tmTarget };
        if (isFinite(Mg)) params.Mg = Mg;
        warnings.push(...VIZ.validateParameterRange(params));
      }
      if (VIZ && VIZ.validatePerformance) {
        const totalBp = vecBodyLen + frags.reduce((sum, f) => sum + String(f.seq || '').replace(/^>.*$/gm, '').replace(/\s+/g, '').length, 0);
        warnings.push(...VIZ.validatePerformance(frags.length + 1, totalBp));
      }
      if (vecBodyLen > 15000) {
        warnings.push({
          id: 'GG-MW-04',
          message:
            `Warning: Large vector sequence detected (${vecBodyLen} bp > 15 kb).\n` +
            "Assembly efficiency may decrease with very large vectors.\n\n" +
            "Click Cancel to review or OK to proceed."
        });
      }

      const enzObjPreflight = TYPEIIS[enz];
      const preflightInsertSiteNames = [];
      frags.forEach((f, idx) => {
        const s = cleanFasta(f.seq || '');
        if (!s) return;
        const insSites = findTypeIISSites(s, enzObjPreflight);
        if (insSites.F.length || insSites.R.length) {
          const nm = f.headerName || ('Insert #' + (idx + 1));
          preflightInsertSiteNames.push(nm);
        }
      });
      if (preflightInsertSiteNames.length) {
        const uniq = Array.from(new Set(preflightInsertSiteNames));
        warnings.push({
          id: 'GG-MW-05',
          message:
            `Warning: Internal ${enz} sites detected in insert sequence(s).\n` +
            `Affected inserts: ${uniq.join(', ')}\n` +
            "Internal enzyme sites will fragment inserts during Golden Gate assembly.\n\n" +
            "Click Cancel to adjust or OK to proceed."
        });
      }

      const proceed = () => {
        try {
          const enzObj   = TYPEIIS[enz];
          const vecClean = cleanFasta(vector || '');

          // Check enzyme sites on vector
          const vecSites   = findTypeIISSites(vecClean, enzObj);
          const siteCount  = (vecSites.F.length + vecSites.R.length);
          const zeroSite   = siteCount === 0;
          const okForGG    = siteCount >= 2;   // Golden Gate needs at least two sites on the vector backbone

          // Detect enzyme sites on inserts for warning message
          const insertSiteNames = preflightInsertSiteNames.slice();
          let overhangWarningHtml = '';
          if(insertSiteNames.length){
            const uniq = Array.from(new Set(insertSiteNames));
            const namesStr = uniq.join(', ');
            overhangWarningHtml =
              '<div class="aside" style="margin-top:6px;color:#b91c1c">There\'s ' + enz +
              ' sites in ' + namesStr +
              ', please consider using other enzymes.</div>';
          }

          const insertHeaders = frags.map(f=> f.headerName || null);
          const vectorName = ((vector.match(/^>([^\r\n]+)/m) || [])[1] || '').trim().split(/\s+/)[0] || null;

          // If vector is not suitable for Golden Gate (0 or 1 site): N/A tables and gel with only uncut/cut=uncut
          if(!okForGG){
            const primerNode = container.querySelector('#primer-table');
            const ohNode     = container.querySelector('#oh-table');

            const reasonShort = zeroSite
                ? ('no ' + enz + ' sites in vector')
                : ('only one ' + enz + ' site in vector');
            const warningMsg = zeroSite
                ? ('There\'s no ' + enz + ' sites in the vector, please select the correct enzymes.')
                : ('There\'s only one ' + enz + ' site in the vector, please select other enzymes.');

            if(primerNode){
              primerNode.innerHTML = '<div class="aside">N/A (' + reasonShort + ')</div>';
            }
            if(ohNode){
              let ohHtml = '<div class="aside">N/A (' + reasonShort + ')</div>' +
                           '<div class="aside" style="margin-top:6px;color:#b91c1c">' + warningMsg + '</div>';
              ohHtml += overhangWarningHtml;
              ohNode.innerHTML = ohHtml;
            }

            drawAssembledFigure(frags.length, container);

            const vectorLen = vecClean.length;
            window._ggAssembledSeq  = '';
            window._ggAssembledName = '';
            window._ggPrimers = null;

            if(zeroSite){
              // 0 sites: digest lane behaves like uncut supercoiled plasmid
              showGel(vectorLen, [], [], 0, insertHeaders, vectorName, enz, '');
              if(typeof GGX_STATE !== 'undefined'){
                GGX_STATE.scIdx = new Set([1,2]);  // L2 & L3 both treated as supercoiled
                ggxDrawGel();
                ggxUpdateLegend();
              }
            } else {
              // 1 site: plasmid is linearized; digest lane uses same length but runs slower than supercoiled
              showGel(vectorLen, [vectorLen], [], 0, insertHeaders, vectorName, enz, '');
              if(typeof GGX_STATE !== 'undefined'){
                GGX_STATE.scIdx = new Set([1]);  // only L2 (uncut) is supercoiled
                ggxDrawGel();
                ggxUpdateLegend();
              }
            }

            container.querySelector('#results-wrap').style.display='grid';
            window._ggHasResults = true;
            scheduleSync();
            return;
          }

          // Normal case: vector has sites, design primers
          const {report, primers} = designGGPrimers(vector, frags, enz, clampN, tmTarget, Na, conc, preferVectorEnds);
          window._ggPrimers = primers;

          const vecClean2 = cleanFasta(vector);
          const cutFrags = digestCircular(vecClean2, TYPEIIS[enz]);

          // Build assembled plasmid sequence using vector backbone (after Type IIS digest) + inserts
          const insertsCleanList = frags.map(f=> cleanFasta(f.seq));
          let assembledSeq = '';
          let assembledLen = 0;
          if(vecClean2.length){
            const enzObj2 = TYPEIIS[enz];
            const cuts = (cutFrags && cutFrags.length) ? cutFrags.slice() : [];
            if(cuts.length){
              // Recompute backbone from precise cut positions
              const vOH2 = deriveVectorOverhangs(vecClean2, enzObj2);
              if(vOH2){
                const N = vecClean2.length;
                const circDist = (a,b)=> (b > a) ? (b - a) : (N - a + b);
                const backboneLen = circDist(vOH2.cutL, vOH2.cutR);
                function subseq(start,len){
                  start = ((start % N)+N)%N;
                  if(len<=0) return '';
                  if(start+len <= N) return vecClean2.slice(start,start+len);
                  return vecClean2.slice(start) + vecClean2.slice(0,(start+len)%N);
                }
                const backboneSeq = subseq(vOH2.cutL, backboneLen);
                // Include the overhang at the "cutR" end (vOH2.leftOH) once in the assembled sequence.
                // This overhang is not necessarily contained within backboneSeq (which ends at cutR),
                // and omission can lead to an assembled sequence shorter by the overhang length (typically 4 bp).
                const tailOH = vOH2.leftOH || '';
                const tailOHToAdd = (tailOH && !backboneSeq.endsWith(tailOH)) ? tailOH : '';
                if (tailOHToAdd) {
                  console.log('[Golden Gate Debug] Adding vector-end overhang to assembledSeq:', {
                    enz,
                    overhangLen: (enzObj2 && enzObj2.overhang) || null,
                    leftOH: vOH2.leftOH,
                    rightOH: vOH2.rightOH,
                    added: tailOHToAdd
                  });
                }
                assembledSeq = backboneSeq + tailOHToAdd + insertsCleanList.join('');
                assembledLen = assembledSeq.length;
              }else{
                assembledSeq = vecClean2 + insertsCleanList.join('');
                assembledLen = assembledSeq.length;
              }
            }else{
              assembledSeq = vecClean2 + insertsCleanList.join('');
              assembledLen = assembledSeq.length;
            }
          }

          let asmName = null;
          if(report.vectorName || (report.insertHeaders && report.insertHeaders.some(h => h))){
            const parts = [];
            if(report.vectorName) parts.push(report.vectorName);
            if(report.insertHeaders){
              report.insertHeaders.forEach(h => { if(h) parts.push(h); });
            }
            asmName = parts.join('_');
          } else {
            const nameMatch = (vector || '').match(/^(>[^\r\n]+)/m);
            asmName = nameMatch ? nameMatch[1].replace(/^>/,'').trim().split(/\s+/)[0] : 'GoldenGate_assembled';
          }
          window._ggAssembledName = asmName;
          window._ggAssembledSeq = assembledSeq;
          report.assembledLen = assembledLen;
          report.assembledName = asmName;
          report.cutFrags = cutFrags;

          // Render results dynamically (similar to Gibson)
          console.log('Calling renderGGResults...');
          renderGGResults(container, primers, report, frags.length, overhangWarningHtml, Na, conc);
          console.log('renderGGResults completed');

          container.querySelector('#results-wrap').style.display='grid';
          window._ggHasResults = true;
          scheduleSync();
        } catch (err) {
          console.error(err);
          showModal('Run error: ' + (err.message || err));
        }
      };

      if (warnings.length > 0 && VIZ && typeof VIZ.showMWWarnings === 'function') {
        VIZ.showMWWarnings(container, warnings, proceed, () => {});
        return;
      }
      proceed();
    }catch(err){
      console.error(err);
      showModal('Run error: ' + err.message);
    }
  });

  // bootstrap two empty inserts
  (function(){
    const fl = container.querySelector('#frag-list');
    if (!fl) return;
    if (!fl.children.length) {
      fragRow();
    } else {
      renumberFrags();
      enforceFragCap();
    }
    scheduleSync();
  })();

  // Initialize vector map preview and enzyme info
  initVectorMapPreview();
  updateEnzymeInfo();

  // Multi-mode download handler
  container.querySelector('#gg-download-btn').addEventListener('click',()=>{
    try{
      if(!window._ggHasResults){
        showModal('Please design primers first.');
        return;
      }
      const modeEl = container.querySelector('#gg-download-type');
      const mode = modeEl ? (modeEl.value || 'primers') : 'primers';
      let text = '';
      let filename = '';

      if(mode === 'primers'){
        const wrapFasta = (seq, width=80) => {
          const s = String(seq || '').replace(/\s+/g,'').toUpperCase();
          if(!s) return '';
          let out = '';
          for(let i=0;i<s.length;i+=width) out += s.slice(i,i+width) + '\n';
          return out;
        };

        const primersArr = window._ggPrimers;
        if (Array.isArray(primersArr) && primersArr.length) {
          let fasta = '';
          for (const p of primersArr) {
            if (!p || p.error) continue;
            const fSeq = String(p.F || '').replace(/\s+/g,'').toUpperCase();
            const rSeq = String(p.R || '').replace(/\s+/g,'').toUpperCase();
            const fName = (p.labelF || 'Forward').trim();
            const rName = (p.labelR || 'Reverse').trim();
            if (fSeq) fasta += '>' + fName + '\n' + wrapFasta(fSeq);
            if (rSeq) fasta += '>' + rName + '\n' + wrapFasta(rSeq);
          }
          text = fasta.trim() ? (fasta.trimEnd() + '\n') : '';
        }

        if (!text) {
          showModal('No primer sequences available.');
          return;
        }
        const asm = (window._ggAssembledName || 'GoldenGate_assembled');
        const safeAsm = asm.replace(/[^A-Za-z0-9_.-]/g,'_');
        filename = 'GoldenGate_primers(' + safeAsm + ').txt';
        const blob = new Blob([text], {type:'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      } else if(mode === 'fasta'){
        const seq = (window._ggAssembledSeq || '').toUpperCase();
        const name = window._ggAssembledName || 'GoldenGate_assembled';
        if(!seq){
          showModal('Assembled plasmid sequence is not available. Please run the design first.');
          return;
        }
        let fasta = '>' + name + '\n';
        for(let i=0;i<seq.length;i+=80){
          fasta += seq.slice(i, i+80) + '\n';
        }
        text = fasta;
        filename = name.replace(/[^A-Za-z0-9_.-]/g,'_') + '.fasta';
        const blob = new Blob([text], {type:'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }catch(e){
      showModal('Download failed: ' + e.message);
    }
  });

  // Clear button handler
  const clearBtn = container.querySelector('#gg-clear');
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      const resWrap = container.querySelector('#results-wrap');
      if(resWrap) resWrap.style.display = 'none';
      const primerNode = container.querySelector('#primer-table');
      if(primerNode) primerNode.innerHTML = '';
      const qcNode = container.querySelector('#qc-out');
      if(qcNode) qcNode.innerHTML = '';
      const ohNode = container.querySelector('#oh-table');
      if(ohNode) ohNode.innerHTML = '';
      const gelSec = container.querySelector('#gg-gel-section');
      if(gelSec) gelSec.style.display = 'none';
      const gelLegend = container.querySelector('#ggx-legend');
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
  }

  // Render Golden Gate results dynamically (similar to Gibson)
  function renderGGResults(container, primers, report, insertCount, overhangWarningHtml, Na, conc) {
    console.log('renderGGResults called with insertCount:', insertCount);
    const resultsContent = container.querySelector('#results-content');
    
    if (!resultsContent) {
      console.error('renderGGResults: #results-content not found');
      return;
    }
    console.log('renderGGResults: resultsContent found');
    
    // Ensure results-content has the 'results' class for CSS grid layout
    if (!resultsContent.classList.contains('results')) {
      resultsContent.classList.add('results');
    }
    
    // Clear previous results
    resultsContent.innerHTML = '';

    // Render primer sets (spans 2 columns)
    console.log('renderGGResults: Creating primers cell...');
    const primersCell = document.createElement('div');
    primersCell.id = 'cell-primers';
    primersCell.className = 'box';
    primersCell.innerHTML = '<h3>Primer sets by insert</h3>';
    console.log('renderGGResults: Calling renderPrimerBlocks...');
    primersCell.innerHTML += renderPrimerBlocks(primers);
    console.log('renderGGResults: renderPrimerBlocks completed');
    resultsContent.appendChild(primersCell);

    // Left column wrapper: keeps assembly diagram + overhang table stacked tightly,
    // independent of the gel height on the right.
    const leftCol = document.createElement('div');
    leftCol.className = 'results-left';

    // Render assembly diagram (left column, top) - 2nd box
    const asmDiagramCell = document.createElement('div');
    asmDiagramCell.className = 'box';
    asmDiagramCell.innerHTML = `
      <div class="asm-title">Assembly diagram</div>
      <div style="text-align: center;">
        <img id="asm-img" class="asm-figure" src="" style="width:100%;display:none;margin:10px auto;">
        <div id="asm-legend" class="aside" style="margin-top: 8px; text-align: center;"></div>
      </div>
    `;
    leftCol.appendChild(asmDiagramCell);
    
    // Load assembly diagram image based on insert count (will set legend text)
    drawAssembledFigure(insertCount, asmDiagramCell);

    // Render overhang table (left column, bottom) - 3rd box
    const overhangTableCell = document.createElement('div');
    overhangTableCell.className = 'box oh-table';
    overhangTableCell.innerHTML = `
      <h3>Overhang table</h3>
      ${renderOHTable(report.junctions, insertCount, report.insertHeaders, report.vectorName) + overhangWarningHtml}
    `;
    leftCol.appendChild(overhangTableCell);

    // Unified warnings/notes box (always present)
    const warningsBoxElement = document.createElement('div');
    warningsBoxElement.id = 'warnings-box';
    warningsBoxElement.className = 'warnings-box';
    warningsBoxElement.style.marginTop = '10px';
    warningsBoxElement.innerHTML = '';

    const notes = [];
    if (overhangWarningHtml) {
      const tmp = document.createElement('div');
      tmp.innerHTML = overhangWarningHtml;
      const txt = (tmp.textContent || '').trim();
      if (txt) notes.push(txt);
    }
    if (!notes.length) {
      notes.push('No warnings generated for this design.');
    }
    if (report && Number.isFinite(report.assembledLen)) {
      notes.push(`Assembled sequence length: ${report.assembledLen} bp total.`);
    }

    notes.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      warningsBoxElement.appendChild(p);
    });

    leftCol.appendChild(warningsBoxElement);

    resultsContent.appendChild(leftCol);

    // Render gel section (right column) - 4th box
    const gelCell = document.createElement('div');
    gelCell.id = 'cell-gel';
    gelCell.className = 'box';
    gelCell.innerHTML = `
      <h3>Simulated Gel</h3>
      <div style="margin-top:5px; margin-bottom:10px;">
        <label class="aside" style="display:inline-block; margin-right:5px;">Marker:</label>
        <select id="ggx-ladder" style="width:auto; font-size:12px;">
          <option value="neb1kbplus" selected>NEB 1kb Plus DNA Ladder (default)</option>
          <option value="neb1kb">NEB 1kb DNA Ladder</option>
          <option value="thermo1kbruler">GeneRuler 1kb DNA Ladder</option>
          <option value="thermo1kbplus">GeneRuler 1kb Plus DNA Ladder</option>
        </select>
      </div>
      <canvas id="gg-gel-canvas" width="850" height="640" style="max-width: 100%; height: auto;"></canvas>
      <div id="ggx-legend" class="aside" style="margin-top:10px; line-height:1.6; color:#334155;"></div>
    `;
    resultsContent.appendChild(gelCell);
    
    // Render gel
    showGel(report.vector.len, report.cutFrags, report.pcrSizes, report.assembledLen, report.insertHeaders, report.vectorName, report.enzymeName, report.assembledName);
    
    // Add event listener for ladder change
    const ladderSelect = container.querySelector('#ggx-ladder');
    if (ladderSelect) {
      ladderSelect.addEventListener('change', () => {
        showGel(report.vector.len, report.cutFrags, report.pcrSizes, report.assembledLen, report.insertHeaders, report.vectorName, report.enzymeName, report.assembledName);
      });
    }
  }
}

// ===================================================================
//  LOGIC FOR: QC / Restriction Enzyme
// ===================================================================
function initQC(container) {
  // Detect which module we're showing based on URL hash
  const hash = window.location.hash.substring(1);
  const isQC = hash === 'qc';
  const isRE = hash === 'restriction';
  
  // Show appropriate section
  const pqcSection = container.querySelector('#p-pqc');
  const reSection = container.querySelector('#p-re');
  if (isQC && pqcSection) {
    pqcSection.style.display = 'block';
    if (reSection) reSection.style.display = 'none';
  } else if (isRE && reSection) {
    if (pqcSection) pqcSection.style.display = 'none';
    reSection.style.display = 'block';
  }

  /* ==================== Shared helpers/constants from v7.6 ==================== */
  // Use IUPAC_COMP from CORE for complement mapping
  const comp = CORE.IUPAC_COMP;
  const ENZ = {
    EcoRI:  {site:'GAATTC', blunt:false},
    BamHI:  {site:'GGATCC', blunt:false},
    HindIII:{site:'AAGCTT', blunt:false},
    XhoI:   {site:'CTCGAG', blunt:false},
    NheI:   {site:'GCTAGC', blunt:false},
    SpeI:   {site:'ACTAGT', blunt:false},
    KpnI:   {site:'GGTACC', blunt:false},
    NotI:   {site:'GCGGCCGC', blunt:false},
    SalI:   {site:'GTCGAC', blunt:false},
    PstI:   {site:'CTGCAG', blunt:false},
    XbaI:   {site:'TCTAGA', blunt:false},
    SmaI:   {site:'CCCGGG', blunt:true}
  };
  const ENZ_LIST = Object.keys(ENZ);
  function populateEnzymes(){
    const e1=container.querySelector('#re-enz1');
    const e2=container.querySelector('#re-enz2');
    ENZ_LIST.forEach(n=>{ const o1=document.createElement('option'); o1.textContent=n; e1.appendChild(o1);
                          const o2=document.createElement('option'); o2.textContent=n; e2.appendChild(o2); });
    e1.value='EcoRI'; e2.value='BamHI';
  }
  function randClamp(n){
    const b = ['A','C','G','T'];
    let s='';
    for(let i=0;i<n;i++){ s += b[Math.floor(Math.random()*4)]; }
    return s;
  }

  /* Tm helper using CORE.tmcalNN */
  // Uses global tmNEB alias from CORE

  /* Dimer checker + hairpin */
  function renderAlignment(A, Brc, off){
    let minI = Math.min(0, off);
    let maxI = Math.max(A.length, Brc.length+off);
    let lineA = "", lineB = "", lineM = "";
    for(let pos=minI; pos<maxI; pos++){
      const i = pos;
      const j = pos - off;
      const a = (i>=0 && i<A.length) ? A[i] : " ";
      const b = (j>=0 && j<Brc.length) ? Brc[j] : " ";
      lineA += a;
      lineB += b;
      lineM += (a!==" " && b!==" " && comp[a]===b) ? "I": " ";
    }
    return [
      "5' "+lineA+" 3'",
      "   "+lineM,
      "3' "+lineB+" 5' (rc)"
    ].join("\n");
  }
  // Use CORE.dimerScan for dimer detection, but convert to k-based format for compatibility
  function bestPCRDimer(A, B, kmin=4){
    const result = CORE.dimerScan(A, B);
    if (!result || !result.overlap) return null;
    // Convert dG-based result to k-based format for backward compatibility
    const k = result.overlap.length;
    if (k < kmin) return null;
    // Generate alignment string
    const align = renderAlignment(A.toUpperCase(), rc(B.toUpperCase()), result.offset);
    return {
      off: result.offset,
      side: result.touches3 ? 'A3' : 'B3',
      k: k,
      align: align
    };
  }
  function classifyByK(k){
    if(k>=6) return {label:"Strong", cls:"bad"};
    if(k===5) return {label:"Moderate", cls:"warn"};
    if(k===4) return {label:"Weak", cls:"warn"};
    return {label:"None", cls:"ok"};
  }
  // Use CORE.threePrimeDG to check for palindromic tail
  function selfTail6YES(p){
    if(p.length<6) return false;
    const tail = p.slice(-6).toUpperCase();
    const rcTail = rc(tail);
    // Check if tail is palindromic (tail == reverse complement of itself)
    return tail === rcTail;
  }
  // Use CORE.hairpinScan for hairpin detection
  function hairpinYES(p){
    const result = CORE.hairpinScan(p);
    if (!result) return false;
    // Check if hairpin touches 3' end (last 5 bases)
    const endWin = 5;
    const p3 = p.length - 1;
    const touches3 = (result.end >= p3 - endWin + 1 && result.end <= p3);
    // Require stem >= 5 and touching 3' end
    return result.stem >= 5 && touches3;
  }

  /* Primer picking for RE module */
  // uses CORE aliases
  function findSafeClamp(n, s1, s2, Fcore, Rcore, kmin, checks){
    const MAX_TRY = 200;
    function okPrimer(p){
      if(checks.tail6 && selfTail6YES(p)) return false;
      if(checks.hp && hairpinYES(p)) return false;
      return true;
    }
    for(let t=0; t<MAX_TRY; t++){
      const clamp = randClamp(n);
      const F = clamp + s1 + Fcore;
      const R = clamp + s2 + Rcore;
      const badFF = bestPCRDimer(F,F,kmin);
      const badRR = bestPCRDimer(R,R,kmin);
      const badFR = bestPCRDimer(F,R,kmin);
      if(badFF || badRR || badFR) continue;
      if(!okPrimer(F) || !okPrimer(R)) continue;
      return {clamp,F,R};
    }
    const clamp = randClamp(n);
    return {clamp, F: clamp + s1 + Fcore, R: clamp + s2 + Rcore, fallback:true};
  }

  /* Restriction logic + Gel */
  function autoPickEnzymes(vec, ins){
    const preferred = [
      ['EcoRI','BamHI'], ['NheI','XhoI'], ['EcoRI','XbaI'], ['KpnI','XhoI'], ['SpeI','XhoI'], ['HindIII','XhoI']
    ];
    function hasSite(seq, name){ return seq.indexOf(ENZ[name].site) >= 0; }
    function absent(seq, name){ return seq.indexOf(ENZ[name].site) < 0; }
    for(const [a,b] of preferred){
      if(hasSite(vec,a) && hasSite(vec,b) && absent(ins,a) && absent(ins,b) && a!==b) return [a,b];
    }
    for(const a of ENZ_LIST){
      for(const b of ENZ_LIST){
        if(a===b) continue;
        if(hasSite(vec,a) && hasSite(vec,b) && absent(ins,a) && absent(ins,b)) return [a,b];
      }
    }
    return ['EcoRI','BamHI'];
  }
  function designRestrictionPrimers(vecRaw, insRaw, enz1, enz2, opts){
    const vec = cleanFasta(vecRaw); const ins = cleanFasta(insRaw);
    if(!ins || ins.length<40) throw new Error('Insert too short (≥40 nt required).');
    const s1 = ENZ[enz1].site, s2 = ENZ[enz2].site;

    const Fcore = pickCorePrimerForward(ins, opts.tmTarget, opts.Na, opts.conc);
    const Rcore = pickCorePrimerReverse(ins, opts.tmTarget, opts.Na, opts.conc);

    const safe = findSafeClamp(opts.clampN, s1, s2, Fcore, Rcore, opts.kmin, {hp:opts.hp, tail6:opts.tail6});
    const clamp = safe.clamp, F = safe.F, R = safe.R;

    const tF = tmNEB(Fcore, opts.Na, opts.conc);
    const tR = tmNEB(Rcore, opts.Na, opts.conc);

    const bestFF = bestPCRDimer(F,F,opts.kmin);
    const bestRR = bestPCRDimer(R,R,opts.kmin);
    const bestFR = bestPCRDimer(F,R,opts.kmin);
    const cF=classifyByK(bestFF?bestFF.k:0), cR=classifyByK(bestRR?bestRR.k:0), cX=classifyByK(bestFR?bestFR.k:0);

    const tail6F = opts.tail6 ? selfTail6YES(F) : false;
    const tail6R = opts.tail6 ? selfTail6YES(R) : false;
    const hpF = opts.hp ? hairpinYES(F) : false;
    const hpR = opts.hp ? hairpinYES(R) : false;

    return {F,R, Fcore,Rcore, tF,tR, enz1,enz2, clamp, s1,s2,
            gcF:CORE.gcPct(F), gcR:CORE.gcPct(R),
            bestFF,bestRR,bestFR,cF,cR,cX, tail6F,tail6R, hpF,hpR, fallback:safe.fallback||false};
  }
  const SimGel_LADDER = [10000,8000,7000,6000,5000,4000,3500,3000,2500,2000,1500,1200,1000,900,800,700,600,500,400,300,200,100];
  function SimGel_findAll(seq,site){ const pos=[]; let i=seq.indexOf(site,0); while(i!==-1){pos.push(i); i=seq.indexOf(site,i+1);} return pos; }
  function SimGel_circFrags(n,cuts){ if(!cuts.length) return [n]; cuts=[...cuts].sort((a,b)=>a-b); const out=[];
    for(let i=0;i<cuts.length;i++){ const a=cuts[i], b=cuts[(i+1)%cuts.length]; out.push(i<cuts.length-1 ? (b-a) : (n-a+cuts[0])); } return out; }
  function SimGel_vecDoubleCut(vec,site1,site2){ return SimGel_circFrags(vec.length, [...SimGel_findAll(vec,site1),...SimGel_findAll(vec,site2)]); }
  function SimGel_assemblySize(vec,site1,site2,insLen){
    const a=SimGel_findAll(vec,site1), b=SimGel_findAll(vec,site2);
    if(a.length===1 && b.length===1 && a[0]!==b[0]){
      const A=a[0], B=b[0];
      const d1=(B>A)?(B-A):(vec.length-A+B), d2=vec.length-d1;
      const short=Math.min(d1,d2);
      return vec.length - short + insLen;
    }
    return null;
  }
  function SimGel_asmDoubleCut(vec,site1,site2,insLen){
    const asz=SimGel_assemblySize(vec,site1,site2,insLen);
    if(asz===null) return [];
    const a=SimGel_findAll(vec,site1), b=SimGel_findAll(vec,site2);
    if(a.length===1 && b.length===1 && a[0]!==b[0]){
      const A=a[0], B=b[0];
      const d1=(B>A)?(B-A):(vec.length-A+B), d2=vec.length-d1;
      const short=Math.min(d1,d2);
      const backbone=vec.length-short;
      return [insLen, backbone];
    }
    return [asz];
  }
  function SimGel_apparentSC(bp,pct){ return bp*(0.65-0.05*(pct-1)); }
  function SimGel_yFrom(bp,pct){
    const top=22,bottom=392,minbp=80,maxbp=12000;
    const c=Math.max(minbp,Math.min(maxbp,bp));
    const k=1+0.15*(pct-1);
    return top+(Math.log10(maxbp)-Math.log10(c))/(Math.log10(maxbp)-Math.log10(minbp))*(bottom-top)/k;
  }
  function SimGel_draw(lanes,pct,scLanes){
    const svg=container.querySelector('#re-gel-svg');
    const W=1000,H=420,L=30,R=20,T=10,B=10; const laneW=(W-L-R)/lanes.length;
    let g=`<rect x="0" y="0" width="${W}" height="${H}" fill="#0a0a0a"/>`;
    for(let i=0;i<lanes.length;i++){
      const x=L+i*laneW;
      g+=`<line class="gel-sep-sg" x1="${x}" y1="${T}" x2="${x}" y2="${H-B}"/>`;
      g+=`<text class="gel-laneLabel-sg" x="${x+laneW*0.5}" y="${H-6}" text-anchor="middle">L${i+1}</text>`;
    }
    lanes.forEach((bands,i)=>{
      const x0=L+i*laneW; const sc=scLanes && scLanes.has(i);
      bands.forEach(bp=>{
        const eff=sc ? SimGel_apparentSC(bp,1) : bp;
        const y=SimGel_yFrom(eff,1);
        g+=`<rect class="gel-band-sg" x="${x0+laneW*0.2}" y="${y}" width="${laneW*0.6}" height="2" rx="1" ry="1"/>`;
      });
    });
    svg.innerHTML=g;
    const leg=container.querySelector('#re-gel-legend');
    const repr=a=>a && a.length ? a.map(x=>`${x} bp`).join(', ') : '--';
    leg.innerHTML=[
      `<div>L1 Ladder (NEB 1 kb Plus)</div>`,
      `<div>L2 Uncut vector (SC): ${repr(lanes[1])}</div>`,
      `<div>L3 Double-cut vector: ${repr(lanes[2])}</div>`,
      `<div>L4 PCR insert: ${repr(lanes[3])}</div>`,
      `<div>L5 Uncut assembly (SC): ${repr(lanes[4])}</div>`,
      `<div>L6 Double-cut assembly: ${repr(lanes[5])}</div>`
    ].join('<span>·</span>');
  }
  function simulateGelNow(){
    const vec = cleanFasta(container.querySelector('#re-vector').value);
    const ins = cleanFasta(container.querySelector('#re-insert').value);
    if(!vec){ 
      container.querySelector('#re-gel-section').style.display='none';
      container.querySelector('#re-gel-svg').innerHTML='';
      container.querySelector('#re-gel-legend').innerHTML='';
      return;
    }

    let e1=container.querySelector('#re-enz1').value;
    let e2=container.querySelector('#re-enz2').value;
    if(container.querySelector('#re-auto').checked){
      const pair = autoPickEnzymes(vec, ins);
      e1=pair[0]; e2=pair[1];
      container.querySelector('#re-enz1').value=e1;
      container.querySelector('#re-enz2').value=e2;
    }

    const site1 = ENZ[e1].site, site2 = ENZ[e2].site;
    const lane1 = SimGel_LADDER.slice();
    const lane2 = [vec.length];
    const lane3 = SimGel_vecDoubleCut(vec, site1, site2);
    const lane4 = ins ? [ins.length] : [];
    const asz   = ins ? SimGel_assemblySize(vec, site1, site2, ins.length) : null;
    const lane5 = asz ? [asz] : [];
    const lane6 = ins ? SimGel_asmDoubleCut(vec, site1, site2, ins.length) : [];

    container.querySelector('#re-gel-section').style.display='';
    SimGel_draw([lane1,lane2,lane3,lane4,lane5,lane6], 1, new Set([1,4]));
  }

  /* ==================== UI: global buttons ==================== */
  populateEnzymes();

  /* ==================== UI: file loaders ==================== */
  function loadFileInto(fid,tid){
    const f=container.querySelector('#'+fid).files[0];if(!f)return showMWMessage('Choose a file');
    const r=new FileReader();r.onload=e=>container.querySelector('#'+tid).value=e.target.result;r.readAsText(f);
  }
  const reVectorLoad = container.querySelector('#re-vector-load');
  if (reVectorLoad) reVectorLoad.onclick=()=>loadFileInto('re-vector-file','re-vector');
  const reInsertLoad = container.querySelector('#re-insert-load');
  if (reInsertLoad) reInsertLoad.onclick=()=>loadFileInto('re-insert-file','re-insert');

  /* Enable/disable enzyme selects when auto is toggled */
  container.querySelector('#re-auto').addEventListener('change',e=>{
    const on=e.target.checked;
    container.querySelector('#re-enz1').disabled=on;
    container.querySelector('#re-enz2').disabled=on;
  });

  /* Small helpers */
  function fmt2(x){ return (isFinite(x) ? x.toFixed(2) : 'NaN'); }
  function badge(cls,txt){ return `<span class="badge ${cls}">${txt}</span>`; }
  function dimerRow(name, best, call){
    if(!best) return `<tr><td>${name}</td><td>${badge(call.cls, call.label)}</td><td></td></tr>`;
    return `<tr><td>${name}</td><td>${badge(call.cls, call.label)}</td><td><pre class="code mono">${best.align}</pre><div class="aside">3' matches = ${best.k} bp; side=${best.side}</div></td></tr>`;
  }
  function kminFromUI(scope){
    const radios = container.querySelectorAll(`input[name="${scope}-kseg"]`);
    for(const r of radios){ if(r.checked) return parseInt(r.value,10); }
    return 5;
  }

  /* ==================== RE: run/clear ==================== */
  const reRun = container.querySelector('#re-run');
  if (reRun) reRun.onclick=()=>{
    const vec=container.querySelector('#re-vector').value;
    const ins=container.querySelector('#re-insert').value;
    let e1=container.querySelector('#re-enz1').value;
    let e2=container.querySelector('#re-enz2').value;
    const auto=container.querySelector('#re-auto').checked;
    const hp=container.querySelector('#hp').checked;
    const tail6=container.querySelector('#tail6').checked;
    const tmTarget=parseFloat(container.querySelector('#tmTarget').value||'60');
    const Na=parseFloat(container.querySelector('#na').value||'50');
    const conc=parseFloat(container.querySelector('#conc').value||'500');
    const kmin=kminFromUI('');
    const clampN=parseInt(container.querySelector('#clamp').value||'5',10);

    const vclean = cleanFasta(vec), iclean=cleanFasta(ins);
    if(auto){
      const pair = autoPickEnzymes(vclean, iclean);
      e1=pair[0]; e2=pair[1];
      container.querySelector('#re-enz1').value=e1;
      container.querySelector('#re-enz2').value=e2;
    }

    const opts={tmTarget:tmTarget, Na:Na, conc:conc, kmin:kmin, clampN:clampN, hp:hp, tail6:tail6};
    let outEl=container.querySelector('#re-out');
    let sumEl=container.querySelector('#re-summary');
    try{
      const r = designRestrictionPrimers(vec, ins, e1, e2, opts);
      const ktxt = kmin===4 ? 'Low' : (kmin===5 ? 'Medium' : 'High');
      sumEl.innerHTML = `<div class="aside">Restriction pair: <b>${r.enz1}</b> / <b>${r.enz2}</b> &nbsp;|&nbsp; Clamp="${r.clamp}" ${r.fallback?'<span class="badge warn">fallback</span>':''} &nbsp;|&nbsp; Target Tm=${fmt2(tmTarget)} °C (binding region only), Na⁺ ${Na} mM, Cp=${conc} nM, k<sub>min</sub>=${kmin} (${ktxt})</div>`;
      const Fdisp = `<i class="overhang">${r.clamp}${r.s1}</i>${r.Fcore}`;
      const Rdisp = `<i class="overhang">${r.clamp}${r.s2}</i>${r.Rcore}`;
      outEl.innerHTML = `
        <table>
          <thead><tr><th>Primer</th><th>Sequence (5'→3')</th><th>Length</th><th>GC%</th><th>Tm (°C, binding region)</th></tr></thead>
          <tbody>
            <tr>
              <td>Forward</td>
              <td class="mono">${Fdisp}</td>
              <td>${r.F.length}</td>
              <td>${fmt2(r.gcF)}</td>
              <td>${fmt2(r.tF)}</td>
            </tr>
            <tr>
              <td>Reverse</td>
              <td class="mono">${Rdisp}</td>
              <td>${r.R.length}</td>
              <td>${fmt2(r.gcR)}</td>
              <td>${fmt2(r.tR)}</td>
            </tr>
          </tbody>
        </table>
        <p class="aside">ΔTm (binding region) = ${fmt2(Math.abs(r.tF-r.tR))} °C</p>

        <h3>Thermo-like PCR-extensible dimer detection</h3>
        <table>
          <thead><tr><th>Type</th><th>Call</th><th>Alignment</th></tr></thead>
          <tbody>
            ${dimerRow('Self-dimer (Forward)', r.bestFF, r.cF)}
            ${dimerRow('Self-dimer (Reverse)', r.bestRR, r.cR)}
            ${dimerRow('Cross-dimer (F × R)', r.bestFR, r.cX)}
          </tbody>
        </table>
      `;
      simulateGelNow();
    }catch(e){
      sumEl.innerHTML='';
      outEl.innerHTML = `<p style="color:#b91c1c"><strong>Error:</strong> ${e.message}</p>`;
      container.querySelector('#re-gel-section').style.display='none';
      container.querySelector('#re-gel-svg').innerHTML='';
      container.querySelector('#re-gel-legend').innerHTML='';
    }
  };
  const reClear = container.querySelector('#re-clear');
  if (reClear) reClear.onclick=()=>{
    container.querySelector('#re-vector').value='';
    container.querySelector('#re-insert').value='';
    container.querySelector('#re-summary').innerHTML='';
    container.querySelector('#re-out').innerHTML='';
    container.querySelector('#re-gel-section').style.display='none';
    container.querySelector('#re-gel-svg').innerHTML='';
    container.querySelector('#re-gel-legend').innerHTML='';
  };

  /* ==================== Primer QC: run/clear ==================== */
  function pqcKmin(){ const radios=container.querySelectorAll('input[name="pqc-kseg"]'); for(const r of radios){ if(r.checked) return parseInt(r.value,10);} return 5; }
  const pqcRun = container.querySelector('#pqc-run');
  if (pqcRun) pqcRun.onclick=()=>{
    const F=(container.querySelector('#pqc-fwd').value||'').trim().replace(/[^ACGTacgt]/g,'');
    const R=(container.querySelector('#pqc-rev').value||'').trim().replace(/[^ACGTacgt]/g,'');
    const tmTarget=parseFloat(container.querySelector('#pqc-tmTarget').value||'60');
    const Na=parseFloat(container.querySelector('#pqc-na').value||'50');
    const conc=parseFloat(container.querySelector('#pqc-conc').value||'500');
    const kmin=pqcKmin();
    const hp=container.querySelector('#pqc-hp').checked;
    const tail6=container.querySelector('#pqc-tail6').checked;

    if(!F && !R){ container.querySelector('#pqc-out').innerHTML='<p class="aside">Enter at least one primer.</p>'; return; }

    function qc1(p){
      if(!p) return null;
      return {
        len:p.length,
        gc:CORE.gcPct(p),
        tm:tmNEB(p,Na,conc),
        hp: hp ? hairpinYES(p) : false,
        tail6: tail6 ? selfTail6YES(p) : false,
        sd: bestPCRDimer(p,p,kmin)
      };
    }
    const fq = qc1(F), rq = qc1(R);
    const cross = (F && R) ? bestPCRDimer(F, R, kmin) : null;

    function rowQC(label, q){
      if(!q) return '';
      const c = classifyByK(q.sd ? q.sd.k : 0);
      return `
        <tr>
          <td>${label}</td>
          <td>${q.len}</td>
          <td>${fmt2(q.gc)}</td>
          <td>${fmt2(q.tm)}</td>
          <td>${badge(q.hp ? 'bad' : 'ok', q.hp ? 'Hairpin' : 'OK')}</td>
          <td>${badge(q.tail6 ? 'bad' : 'ok', q.tail6 ? 'Tail-6' : 'OK')}</td>
          <td>${badge(c.cls, c.label)}</td>
          <td>${q.sd ? `<pre class="code mono">${q.sd.align}</pre><div class="aside">3' matches = ${q.sd.k}</div>` : ''}</td>
        </tr>`;
    }
    const crossC = classifyByK(cross ? cross.k : 0);
    container.querySelector('#pqc-out').innerHTML = `
      <table>
        <thead><tr><th>Primer</th><th>Len</th><th>GC%</th><th>Tm (°C)</th><th>Hairpin</th><th>Tail-6</th><th>Self-dimer</th><th>Alignment</th></tr></thead>
        <tbody>
          ${rowQC('Forward', fq)}
          ${rowQC('Reverse', rq)}
        </tbody>
      </table>
      <h3>Cross-dimer</h3>
      <div>${badge(crossC.cls, crossC.label)}</div>
      ${cross ? `<pre class="code mono">${cross.align}</pre><div class="aside">3' matches = ${cross.k}</div>` : ''}
    `;
  };
  const pqcClear = container.querySelector('#pqc-clear');
  if (pqcClear) pqcClear.onclick=()=>{
    container.querySelector('#pqc-fwd').value='';
    container.querySelector('#pqc-rev').value='';
    container.querySelector('#pqc-out').innerHTML='';
  };

  /* ==================== Global demo/reset ==================== */
  const globalDemo = container.querySelector('#global-demo');
  if (globalDemo) globalDemo.onclick=()=>{
    const hash = window.location.hash.substring(1);
    const k = hash === 'qc' ? 'pqc' : 're';
    if(k==='re'){
      container.querySelector('#re-vector').value='>vector\nGAATTC...GCTAGC...GGATCC...CTCGAG';
      container.querySelector('#re-insert').value='>insert\nATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG';
      container.querySelector('#re-enz1').value='EcoRI';
      container.querySelector('#re-enz2').value='BamHI';
    }else if(k==='pqc'){
      container.querySelector('#pqc-fwd').value='ATGGTGAGCAAGGGCGAGGAG'; // EGFP-fwd-like
      container.querySelector('#pqc-rev').value='CTTGTACAGCTCGTCCATGCC'; // EGFP-rev-like
    }
  };
  const globalReset = container.querySelector('#global-reset');
  if (globalReset) globalReset.onclick=()=>{
    const hash = window.location.hash.substring(1);
    const k = hash === 'qc' ? 'pqc' : 're';
    if(k==='re'){
      ['re-vector','re-insert'].forEach(id=>container.querySelector('#'+id).value='');
      container.querySelector('#re-summary').innerHTML='';
      container.querySelector('#re-out').innerHTML='';
      container.querySelector('#re-auto').checked=true;
      container.querySelector('#re-enz1').disabled=true;
      container.querySelector('#re-enz2').disabled=true;
      container.querySelector('#re-enz1').value='EcoRI';
      container.querySelector('#re-enz2').value='BamHI';
      container.querySelector('#tmTarget').value=60;
      container.querySelector('#na').value=50;
      container.querySelector('#conc').value=500;
      container.querySelectorAll('input[name="kseg"]').forEach(r=>r.checked = (r.value==='5'));
      container.querySelector('#clamp').value=5;
      container.querySelector('#hp').checked=true;
      container.querySelector('#tail6').checked=true;
      container.querySelector('#re-gel-section').style.display='none';
      container.querySelector('#re-gel-svg').innerHTML='';
      container.querySelector('#re-gel-legend').innerHTML='';
    }else if(k==='pqc'){
      container.querySelector('#pqc-fwd').value='';
      container.querySelector('#pqc-rev').value='';
      container.querySelector('#pqc-out').innerHTML='';
      container.querySelector('#pqc-tmTarget').value=60;
      container.querySelector('#pqc-na').value=50;
      container.querySelector('#pqc-conc').value=500;
      container.querySelectorAll('input[name="pqc-kseg"]').forEach(r=>r.checked = (r.value==='5'));
      container.querySelector('#pqc-hp').checked=true;
      container.querySelector('#pqc-tail6').checked=true;
    }
  };
}

// ===================================================================
window.initGoldenGate = initGoldenGate;
