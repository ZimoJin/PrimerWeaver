// USER Cloning Primer Designer v2
// Based on Gibson v2 UI structure and USER cloning logic
//
// USER Cloning Principle:
// 1. Introduce uracil (U) bases at the 5' end of PCR primers
// 2. USER enzyme recognizes and cleaves U, creating sticky ends
// 3. Connect vector and insert fragments through complementary sticky ends

import * as Core from './core_v1.0.1.js';
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

function attachHelpToInput(inputId, tooltipHtml, ariaLabel) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrapper = input.parentElement;
  const label = wrapper?.querySelector?.('label');
  ensureHelpIcon(label, tooltipHtml, ariaLabel);
}

function attachHelpToTextarea(textareaId, tooltipHtml, ariaLabel) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const wrapper = textarea.parentElement;
  const label = wrapper?.querySelector?.('label');
  ensureHelpIcon(label, tooltipHtml, ariaLabel);
}

// Vector preview state
let vectorPreviewTimer = null;

// Draw USER cloning assembly figure based on insert count
function drawUSERAssemblyFigure(insertCount, container) {
  const img = container?.querySelector?.('#asm-img');
  if (!img) return;

  // HTML is loaded via fetch and injected into app-index.html
  // So relative paths are relative to app/ directory
  // Images are in: app/modules/contents/pictures/USER_cloning/
  const folder = 'modules/contents/pictures/USER_cloning';
  const fileMap = {
    1: 'USER_1insert.svg',
    2: 'USER_2insert.svg',
    3: 'USER_3insert.svg'
  };

  const k = Math.min(Math.max(1, insertCount), 3);
  const file = fileMap[k];
  if (!file) {
    img.style.display = 'none';
    return;
  }

  const imagePath = `${folder}/${file}`;
  img.src = imagePath;
  img.style.display = 'block';
  img.onerror = function () {
    img.style.display = 'none';
  };
}

// ==================== Utility Functions ====================

function $(id) {
  return document.getElementById(id);
}

function parseFASTA(text) {
  const records = Core.parseFASTA(text);
  return records.map(r => ({
    name: r.header || 'Unnamed',
    seq: Core.normalizeSeq(r.seq)
  }));
}

function cleanSeq(text) {
  if (!text) return '';
  const records = Core.parseFASTA(text);
  if (records.length === 0) return '';
  return Core.normalizeSeq(records[0].seq);
}

function cleanDNA(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return Core.normalizeSeq(dnaLines.join(''));
}

function stripFASTAHeaders(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return dnaLines.join('');
}

// Reverse complement a textarea content, preserving FASTA headers (no suffix)
function applyRCToTextarea(textarea) {
  if (!textarea) return;
  const raw = (textarea.value || '').trim();
  if (!raw) return;

  const lines = raw.split(/\r?\n/);
  const records = [];
  let header = null;
  let seqLines = [];

  function pushOne() {
    if (!header && seqLines.length === 0) return;
    const seq = seqLines.join('').replace(/\s+/g, '').toUpperCase();
    if (seq) records.push({ header, seq });
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('>')) {
      pushOne();
      header = trimmed; // keep original header
      seqLines = [];
    } else {
      seqLines.push(trimmed);
    }
  }
  pushOne();

  if (records.length === 0) {
    const seq = raw.replace(/\s+/g, '').toUpperCase();
    if (!seq) return;
    textarea.value = Core.reverseComplementSeq(seq);
    return;
  }

  textarea.value = records
    .map(r => r.header + '\n' + Core.reverseComplementSeq(r.seq))
    .join('\n');
}

function extractFASTAHeader(seq) {
  if (!seq) return null;
  const lines = String(seq).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      return trimmed.substring(1).trim().split(' ')[0] || null;
    }
  }
  return null;
}

function revComp(seq) {
  return Core.reverseComplementSeq(seq);
}

function gcContent(seq) {
  return Core.gcPct(seq);
}

function tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) {
  return Core.tmcalNN(seq, na_mM, mg_mM, conc_nM);
}

// ==================== IUPAC Support and 3' End Matching ====================
// IUPAC support for PCR primer matching (aligned with Gibson)
const IUPAC = {
  A: new Set(['A']), C: new Set(['C']), G: new Set(['G']), T: new Set(['T']),
  U: new Set(['T', 'U']), // U matches T (for USER cloning compatibility)
  R: new Set(['A','G']), Y: new Set(['C','T']), S: new Set(['G','C']), W: new Set(['A','T']),
  K: new Set(['G','T']), M: new Set(['A','C']),
  B: new Set(['C','G','T']), D: new Set(['A','G','T']), H: new Set(['A','C','T']), V: new Set(['A','C','G']),
  N: new Set(['A','C','G','T'])
};

const IUPAC_COMP = {
  A:'T', T:'A', C:'G', G:'C', U:'A', // U complements to A (for USER cloning)
  R:'Y', Y:'R', S:'S', W:'W', K:'M', M:'K',
  B:'V', V:'B', D:'H', H:'D',
  N:'N'
};

function normIUPAC(seq) {
  // Preserve U for USER cloning, but normalize other IUPAC bases
  return (seq||'').toUpperCase().replace(/[^ACGTRYSWKMBDHVNIPXU]/g,'');
}

function iupacMatch(pBase, tBase) {
  // Special handling: U matches T (for USER cloning)
  if (pBase === 'U' && (tBase === 'T' || tBase === 'U')) return true;
  if (tBase === 'U' && (pBase === 'T' || pBase === 'U')) return true;
  
  const set = IUPAC[pBase];
  return set ? set.has(tBase) : false;
}

function revCompIUPAC(seq) {
  const s = normIUPAC(seq);
  let out = '';
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    out += (IUPAC_COMP[c] || 'N');
  }
  return out;
}

function wrap(L, x) { 
  x = x % L; 
  return x < 0 ? x + L : x; 
}

// 3' end continuous matching for PCR primers (aligned with Gibson)
function matchLenForward3prime(primer, templ, f3, maxLen) {
  const L = templ.length;
  const pLen = primer.length;
  let m = 0;
  for (let i = 0; i < maxLen && i < pLen; i++) {
    const pb = primer[pLen - 1 - i];
    const tb = templ[wrap(L, f3 - i)];
    if (!iupacMatch(pb, tb)) break;
    m++;
  }
  return m;
}

function matchLenReverse3prime(revRC, templ, r3, maxLen) {
  const L = templ.length;
  const pLen = revRC.length;
  let m = 0;
  for (let i = 0; i < maxLen && i < pLen; i++) {
    const pb = revRC[i];
    const tb = templ[wrap(L, r3 + i)];
    if (!iupacMatch(pb, tb)) break;
    m++;
  }
  return m;
}

function findForward3primeHits(primer, templ, minLen, maxLen) {
  const L = templ.length;
  const hits = [];
  for (let f3 = 0; f3 < L; f3++) {
    const m = matchLenForward3prime(primer, templ, f3, maxLen);
    if (m >= minLen) hits.push({ f3, m });
  }
  return hits;
}

function findReverse3primeHits(revPrimer, templ, minLen, maxLen) {
  const L = templ.length;
  const revRC = revCompIUPAC(revPrimer);
  const hits = [];
  for (let r3 = 0; r3 < L; r3++) {
    const m = matchLenReverse3prime(revRC, templ, r3, maxLen);
    if (m >= minLen) hits.push({ r3, m, revRC });
  }
  return hits;
}

// ==================== USER Cloning Core Logic ====================

/**
 * Parse U-containing PCR primer, extract core and overlap information
 * @param {string} primer - U-containing primer sequence
 * @param {Object} opts - Options
 * @returns {Object} {core, overlap, overlapWithU, overlapPrefixWithU, warning}
 */
function parsePrimerWithU(primer, opts = {}) {
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  const overlapTm = opts.overlapTm || 50;
  
  // Clean primer sequence, preserve U and IUPAC bases
  const cleanPrimer = (primer || '').toUpperCase().replace(/[^ACGTURYSWKMBDHVNIPX]/g, '');
  
  if (!cleanPrimer) {
    throw new Error('Primer sequence cannot be empty');
  }
  
  // Find delimiter U position (closest to 3' end)
  const uPos = cleanPrimer.lastIndexOf('U');
  if (uPos === -1) {
    throw new Error('U base not found in primer');
  }
  
  // Primer format: 5' overlap-U-core 3'.
  // In this tool's convention (and the provided sample), the input U is the substituted last T
  // of the overlap (the USER cleavage base). The corresponding DNA overlap ends with T.
  const prefixBeforeU = cleanPrimer.slice(0, uPos);
  const coreRaw = cleanPrimer.slice(uPos + 1);

  const prefixNorm = Core.normalizeSeq(prefixBeforeU);
  const coreNorm = Core.normalizeSeq(coreRaw);

  // overlapNorm is the DNA overlap with the cleavage base as T.
  const overlapNorm = prefixNorm + 'T';
  const overlapPrefixWithU = prefixNorm + 'U';
  const overlapWithU = overlapPrefixWithU;
  const core = coreNorm;
  
  if (!core) {
    throw new Error('Core sequence after U is required for vector binding');
  }
  
  if (!prefixNorm) {
    throw new Error('Overlap sequence before U is required');
  }
  
  // Calculate overlap Tm
  const overlapTmValue = tmSaltCorrected(overlapNorm, conc_nM, na_mM, mg_mM);
  
  return {
    core: core,
    overlap: overlapNorm,
    overlapWithU: overlapWithU,
    overlapPrefixWithU: overlapPrefixWithU,
    coreNormalized: coreNorm, // For matching vector sequence
    warning: null, // No longer generate warnings
    overlapTm: overlapTmValue
  };
}

/**
 * Design USER cloning primers (U-containing primer version)
 * @param {string} vectorSeq - Vector sequence (circular)
 * @param {string} insertSeq - Insert fragment sequence
 * @param {string} pcrForward - PCR forward primer (with U, for vector linearization)
 * @param {string} pcrReverse - PCR reverse primer (with U, for vector linearization)
 * @param {Object} opts - Options
 * @returns {Object} Primer design results
 */
function designUSERPrimersWithU(vectorSeq, insertSeq, pcrForward, pcrReverse, opts = {}, selectedFragmentIdx = null) {
  const targetTm = opts.targetTm || 60;
  const overlapTm = opts.overlapTm || 50;
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  
  const vector = cleanDNA(vectorSeq);
  
  // Parse multiple inserts (USER cloning supports up to 3 inserts)
  const insertRecords = parseFASTA(insertSeq);
  if (insertRecords.length === 0) {
    throw new Error('Insert sequences cannot be empty');
  }
  const insertSeqs = insertRecords.map(r => r.seq);
  
  if (!vector || insertSeqs.length === 0) {
    throw new Error('Vector and insert sequences cannot be empty');
  }
  
  // For backward compatibility, use first insert for single insert operations
  const insert = insertSeqs[0];
  
  // Primer format: 5' overlap-U-core 3'
  // Format 1: overlap + U + core (standard format, preferred)
  let pcrFInfo = parsePrimerWithU(pcrForward, { conc_nM, na_mM, mg_mM, overlapTm });
  let pcrRInfo = parsePrimerWithU(pcrReverse, { conc_nM, na_mM, mg_mM, overlapTm });
  
  if (!pcrFInfo || !pcrRInfo) {
    throw new Error('Unable to parse U-containing primers. Please check primer format: should be 5\'overlap-U-core 3\'');
  }
  
  // Step 1: Use 3' end matching with core sequences to find PCR primer binding sites (aligned with Gibson)
  const L = vector.length;
  const minLen = 15; // Minimum 3' match length
  const maxLen = 25; // Maximum scan length
  
  // Find 3' end hits using continuous matching on core sequences
  let fHits = findForward3primeHits(pcrFInfo.coreNormalized, vector, minLen, maxLen);
  let rHits = findReverse3primeHits(pcrRInfo.coreNormalized, vector, minLen, maxLen);
  
  // Auto-detect RC / swap primers fallback
  let primersSwapped = false;
  if (!fHits.length || !rHits.length) {
    // Try swapped primers
    const fHitsSwapped = findForward3primeHits(pcrRInfo.coreNormalized, vector, minLen, maxLen);
    const rHitsSwapped = findReverse3primeHits(pcrFInfo.coreNormalized, vector, minLen, maxLen);
    
    if (fHitsSwapped.length > 0 && rHitsSwapped.length > 0) {
      // Swap primers
      const temp = pcrFInfo;
      pcrFInfo = pcrRInfo;
      pcrRInfo = temp;
      fHits = fHitsSwapped;
      rHits = rHitsSwapped;
      primersSwapped = true;
    }
  }
  
  // If user selected PCR product, use selected product
  let selectedFragment = null;
  if (selectedFragmentIdx !== null && window.currentPCRFragments && 
      selectedFragmentIdx >= 0 && selectedFragmentIdx < window.currentPCRFragments.length) {
    selectedFragment = window.currentPCRFragments[selectedFragmentIdx];
  }
  
  let f3, r3, revRC;
  
  if (selectedFragment && selectedFragment.f3 !== undefined && selectedFragment.r3 !== undefined) {
    // Use selected fragment
    f3 = selectedFragment.f3;
    r3 = selectedFragment.r3;
    revRC = revCompIUPAC(pcrRInfo.coreNormalized);
  } else {
    // Select best hit pair (highest combined match score)
    let bestFHit = null;
    let bestRHit = null;
    let bestScore = -Infinity;
    
    for (const fh of fHits) {
      for (const rh of rHits) {
        const f3Test = fh.f3;
        const r3Test = rh.r3;
        const templateLen = Core.distPlus(L, f3Test, r3Test) + 1;
        if (templateLen <= 0 || templateLen > L) continue;
        
        const score = (fh.m + rh.m) * 1000000 - templateLen;
        if (score > bestScore) {
          bestScore = score;
          bestFHit = fh;
          bestRHit = rh;
        }
      }
    }
    
    if (!bestFHit || !bestRHit) {
      const errorMsg = `PCR primer core part not found in vector sequence.
Primer format: 5' overlap-U-core 3'
Forward primer core (after U): ${pcrFInfo.coreNormalized}
Forward primer core RC: ${Core.reverseComplementSeq(pcrFInfo.coreNormalized)}
Reverse primer core (after U): ${pcrRInfo.coreNormalized}
Reverse primer core RC: ${Core.reverseComplementSeq(pcrRInfo.coreNormalized)}
Please check:
1. Primer format is correct (should be 5'overlap-U-core 3')
2. Core sequence exists in vector sequence
3. Vector sequence is correct`;
      throw new Error(errorMsg);
    }
    
    f3 = bestFHit.f3;
    r3 = bestRHit.r3;
    revRC = bestRHit.revRC;
  }
  
  // Calculate template sequence (f3+1→r3-1) excluding endpoints to avoid duplication
  const f3Next = (f3 + 1) % L;
  let templateSeq = '';
  if (f3Next !== r3) {
    const tempSeq = Core.pcrProductSeq(vector, f3Next, r3);
    templateSeq = tempSeq.slice(0, -1); // Remove last base (r3 position)
  }
  
  // Calculate full PCR product: forward primer + template + reverse primer RC
  // Aligned with Gibson: use normIUPAC to normalize primers (U will be removed for PCR product calculation)
  // But we need to preserve U in the actual primers for USER enzyme cleavage
  const actualPcrForward = primersSwapped ? pcrReverse : pcrForward;
  const actualPcrReverse = primersSwapped ? pcrForward : pcrReverse;
  
  // For PCR product calculation, normalize primers (remove U) to match Gibson behavior
  const pcrF = normIUPAC(actualPcrForward);
  const pcrR = normIUPAC(actualPcrReverse);
  const pcrRRC = revCompIUPAC(pcrR);
  const pcrProduct = pcrF + templateSeq + pcrRRC;
  
  // Convert to positions for compatibility with existing code
  const fwdPos = f3;
  const revPos = r3;
  const workingSeq = vector;
  
  // Step 2: Build assembled sequence (aligned with Gibson PCR mode)
  // In PCR mode: assembledSeq = PCR product + insert block
  // PCR product already includes full primers with U bases
  // USER cloning supports multiple inserts (up to 3), but no linkers
  const assembledParts = [pcrProduct];
  for (let i = 0; i < insertSeqs.length; i++) {
    assembledParts.push(insertSeqs[i]);
  }
  const assembledSeq = assembledParts.join('');
  
  // For compatibility with existing code structure
  // backboneLeft = PCR product, backboneRight = '' (inserts come after PCR product)
  const backboneLeft = pcrProduct;
  const backboneRight = '';
  
  // Convert to positions for compatibility with existing code
  const fwd5Prime = f3;
  const rev5PrimeOnForward = (r3 + pcrRInfo.coreNormalized.length) % vector.length;
  
  // Step 4: Design insert primers
  // - Vector primers: repeat user input (no extra U added).
  // - Insert1-F and InsertLast-R: derived from user-provided vector overlaps (original behavior).
  // - Internal insert-insert junctions: use non-U-style ANT search to find overlap near junction,
  //   then design core from overlap boundary (to avoid overlap/core misplacement).
  const overlapLen = opts.overlapLen || 9;
  const vecFInput = actualPcrForward;
  const vecRInput = actualPcrReverse;
  const F_vec = vecFInput;
  const R_vec = vecRInput;
  const F_vecTm = tmSaltCorrected(Core.normalizeSeq(F_vec), conc_nM, na_mM, mg_mM);
  const R_vecTm = tmSaltCorrected(Core.normalizeSeq(R_vec), conc_nM, na_mM, mg_mM);
  
  const replaceLastTwithU = (seq) => {
    const s = String(seq || '').toUpperCase();
    const idx = s.lastIndexOf('T');
    if (idx < 0) return s + 'U';
    return s.slice(0, idx) + 'U' + s.slice(idx + 1);
  };
  
  // Internal junctions (between inserts only): work on insert block coordinates
  const insertBlock = insertSeqs.join('');
  const insertStarts = [];
  let posAcc = 0;
  for (const s of insertSeqs) {
    insertStarts.push(posAcc);
    posAcc += s.length;
  }
  
  const internalJunctions = [];
  for (let i = 0; i < insertSeqs.length - 1; i++) {
    const junctionPos = insertStarts[i] + insertSeqs[i].length;
    const info = findUSEROverlapAtJunction(
      insertBlock,
      junctionPos,
      overlapTm,
      { conc_nM, na_mM, mg_mM, overlapLen }
    );
    internalJunctions.push({ i, junctionPos, info });
  }
  
  // User-defined vector overlap-derived overhangs for the ends
  const insert1FOverhang = replaceLastTwithU(revComp(pcrRInfo.overlap));
  const insertLastROverhang = replaceLastTwithU(revComp(pcrFInfo.overlap));
  
  const insertsOut = [];
  for (let i = 0; i < insertSeqs.length; i++) {
    const insSeq = insertSeqs[i];
    const insName = insertRecords[i]?.name || `Insert_${i + 1}`;
    
    // Forward primer: from vector overlap for Insert1, otherwise from left internal junction
    let fwdOverhang;
    let fwdCore;
    if (i === 0) {
      fwdOverhang = insert1FOverhang;
      fwdCore = designCoreBindingFromPosition(insSeq, 0, true, targetTm, { conc_nM, na_mM, mg_mM });
    } else {
      const leftInfo = internalJunctions[i - 1].info;
      fwdOverhang = leftInfo.fwdTail;
      fwdCore = designCoreBindingFromPosition(insertBlock, leftInfo.coreStartPos, true, targetTm, { conc_nM, na_mM, mg_mM });
    }
    
    // Reverse primer: from vector overlap for last insert, otherwise from right internal junction
    let revOverhang;
    let revCore;
    if (i === insertSeqs.length - 1) {
      revOverhang = insertLastROverhang;
      revCore = designCoreBindingFromPosition(insSeq, insSeq.length, false, targetTm, { conc_nM, na_mM, mg_mM });
    } else {
      const rightInfo = internalJunctions[i].info;
      revOverhang = rightInfo.revTail;
      revCore = designCoreBindingFromPosition(insertBlock, rightInfo.coreEndPos, false, targetTm, { conc_nM, na_mM, mg_mM });
    }
    
    const revCoreRC = revComp(revCore.seq);
    const insF = fwdOverhang + fwdCore.seq;
    const insR = revOverhang + revCoreRC;
    
    insertsOut.push({
      index: i + 1,
      name: insName,
      length: insSeq.length,
      F: {
        seq: insF,
        len: insF.length,
        gc: gcContent(insF),
        tm: tmSaltCorrected(insF, conc_nM, na_mM, mg_mM),
        coreSeq: fwdCore.seq,
        coreTm: fwdCore.tm,
        overlapSeq: fwdOverhang
      },
      R: {
        seq: insR,
        len: insR.length,
        gc: gcContent(insR),
        tm: tmSaltCorrected(insR, conc_nM, na_mM, mg_mM),
        coreSeq: revCoreRC,
        coreTm: revCore.tm,
        overlapSeq: revOverhang
      }
    });
  }
  
  // Collect all warnings
  const warnings = [];
  if (pcrFInfo.warning) warnings.push({ primer: 'pcr_forward', warning: pcrFInfo.warning });
  if (pcrRInfo.warning) warnings.push({ primer: 'pcr_reverse', warning: pcrRInfo.warning });
  
  const overlapJunctions = [];
  overlapJunctions.push({
    label: 'Vector-Insert1',
    overlapSeq: pcrRInfo.overlapPrefixWithU,
    backboneSeq: pcrRInfo.overlapPrefixWithU,
    insertSeq: insert1FOverhang,
    len: pcrRInfo.overlapPrefixWithU.length,
    tm: tmSaltCorrected(Core.normalizeSeq(pcrRInfo.overlap), conc_nM, na_mM, mg_mM),
    gc: gcContent(Core.normalizeSeq(pcrRInfo.overlap))
  });
  internalJunctions.forEach((j) => {
    overlapJunctions.push({
      label: `Insert${j.i + 1}-Insert${j.i + 2}`,
      overlapSeq: j.info.fwdTail,
      backboneSeq: j.info.fwdTail,
      insertSeq: j.info.revTail,
      len: j.info.len,
      tm: j.info.tm,
      gc: j.info.gc
    });
  });
  overlapJunctions.push({
    label: `Insert${insertSeqs.length}-Vector`,
    overlapSeq: pcrFInfo.overlapPrefixWithU,
    backboneSeq: pcrFInfo.overlapPrefixWithU,
    insertSeq: insertLastROverhang,
    len: pcrFInfo.overlapPrefixWithU.length,
    tm: tmSaltCorrected(Core.normalizeSeq(pcrFInfo.overlap), conc_nM, na_mM, mg_mM),
    gc: gcContent(Core.normalizeSeq(pcrFInfo.overlap))
  });
  
  const leftOverlapInfo = overlapJunctions[0];
  const rightOverlapInfo = overlapJunctions[overlapJunctions.length - 1];
  
  return {
    vector: {
      F: {
        seq: F_vec,
        len: F_vec.length,
        gc: gcContent(Core.normalizeSeq(F_vec)),
        tm: F_vecTm,
        coreSeq: pcrFInfo.core,
        coreTm: tmSaltCorrected(Core.normalizeSeq(pcrFInfo.core), conc_nM, na_mM, mg_mM),
        overlapSeq: pcrFInfo.overlapPrefixWithU
      },
      R: {
        seq: R_vec,
        len: R_vec.length,
        gc: gcContent(Core.normalizeSeq(R_vec)),
        tm: R_vecTm,
        coreSeq: pcrRInfo.core,
        coreTm: tmSaltCorrected(Core.normalizeSeq(pcrRInfo.core), conc_nM, na_mM, mg_mM),
        overlapSeq: pcrRInfo.overlapPrefixWithU
      }
    },
    inserts: insertsOut,
    overlap: {
      leftOverlap: leftOverlapInfo,
      rightOverlap: rightOverlapInfo,
      junctions: overlapJunctions,
      leftCompatibility: checkOverlapCompatibility(leftOverlapInfo.backboneSeq, leftOverlapInfo.insertSeq),
      rightCompatibility: checkOverlapCompatibility(rightOverlapInfo.backboneSeq, rightOverlapInfo.insertSeq)
    },
    warnings: warnings,
    assembledSeq: assembledSeq,
    backbone: {
      left: backboneLeft,
      right: backboneRight,
      leftLen: backboneLeft.length,
      rightLen: backboneRight.length
    },
    pcrInfo: {
      forward: pcrFInfo,
      reverse: pcrRInfo,
      fwd5Prime: fwd5Prime,
      rev5PrimeOnForward: rev5PrimeOnForward,
      isInverse: primersSwapped
    }
  };
}

/**
 * Design core binding region from specified position
 */
function designCoreBindingFromPosition(assembledSeq, startPos, isForward, targetTm, opts = {}) {
  const minLen = 18;
  const maxLen = 40;
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  
  const seq = Core.normalizeSeq(assembledSeq);
  let best = null;
  let bestTmDiff = Infinity;
  
  if (isForward) {
    for (let len = minLen; len <= maxLen; len++) {
      const endPos = startPos + len;
      if (endPos > seq.length) break;
      
      const coreSeq = seq.slice(startPos, endPos);
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      const tmDiff = Math.abs(tm - targetTm);
      
      if (tmDiff < bestTmDiff) {
        bestTmDiff = tmDiff;
        best = { seq: coreSeq, len, tm };
      }
    }
  } else {
    for (let len = minLen; len <= maxLen; len++) {
      const endPos = startPos;
      const beginPos = Math.max(0, endPos - len);
      if (beginPos < 0) break;
      
      const coreSeq = seq.slice(beginPos, endPos);
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      const tmDiff = Math.abs(tm - targetTm);
      
      if (tmDiff < bestTmDiff) {
        bestTmDiff = tmDiff;
        best = { seq: coreSeq, len, tm };
      }
    }
  }
  
  return best || { seq: '', len: 0, tm: 0 };
}

/**
 * Design USER cloning primers (without U in input primers - auto-generate U)
 * @param {string} vectorSeq - Vector sequence (circular)
 * @param {string} insertSeq - Insert fragment sequence
 * @param {string} pcrForward - PCR forward primer (without U, for vector linearization)
 * @param {string} pcrReverse - PCR reverse primer (without U, for vector linearization)
 * @param {Object} opts - Options
 * @returns {Object} Primer design results
 */
function designUSERPrimers(vectorSeq, insertSeq, pcrForward, pcrReverse, opts = {}) {
  const targetTm = opts.targetTm || 60;
  const overlapTm = opts.overlapTm || 50;
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  
  const vector = cleanDNA(vectorSeq);
  const insertRecords = parseFASTA(insertSeq);
  const insertSeqs = insertRecords.length ? insertRecords.map(r => r.seq) : [cleanDNA(insertSeq)];
  const insertBlock = insertSeqs.join('');
  let pcrF = Core.normalizeSeq(pcrForward);
  let pcrR = Core.normalizeSeq(pcrReverse);
  
  if (!vector || !insertBlock) {
    throw new Error('Vector and insert sequences cannot be empty');
  }
  
  if (!pcrF || !pcrR) {
    throw new Error('Please provide PCR forward and reverse primers for vector linearization');
  }
  
  // Step 1: Use 3' end matching to find PCR primer binding sites (aligned with Gibson)
  // All PCR localization should use the new 3'-anchored continuous matching logic
  // regardless of whether primers contain U
  const L = vector.length;
  const minLen = 15; // Minimum 3' match length
  const maxLen = 25; // Maximum scan length
  
  // Normalize primers (support IUPAC, but U will be treated as T for matching)
  const pcrFNorm = normIUPAC(pcrF);
  const pcrRNorm = normIUPAC(pcrR);
  
  // Find 3' end hits using continuous matching
  let fHits = findForward3primeHits(pcrFNorm, vector, minLen, maxLen);
  let rHits = findReverse3primeHits(pcrRNorm, vector, minLen, maxLen);
  
  // Auto-detect RC / swap primers fallback
  let primersSwapped = false;
  if (!fHits.length || !rHits.length) {
    // Try swapped primers
    const fHitsSwapped = findForward3primeHits(pcrRNorm, vector, minLen, maxLen);
    const rHitsSwapped = findReverse3primeHits(pcrFNorm, vector, minLen, maxLen);
    
    if (fHitsSwapped.length > 0 && rHitsSwapped.length > 0) {
      // Swap primers
      [pcrF, pcrR] = [pcrR, pcrF];
      fHits = fHitsSwapped;
      rHits = rHitsSwapped;
      primersSwapped = true;
    }
  }
  
  if (!fHits.length || !rHits.length) {
    throw new Error('PCR primers not found in vector sequence. Please check primer sequences or try swapping forward and reverse primers.');
  }
  
  // Select best hit pair (highest combined match score)
  let bestFHit = null;
  let bestRHit = null;
  let bestScore = -Infinity;
  
  for (const fh of fHits) {
    for (const rh of rHits) {
      const f3Test = fh.f3;
      const r3Test = rh.r3;
      const templateLen = Core.distPlus(L, f3Test, r3Test) + 1;
      if (templateLen <= 0 || templateLen > L) continue;
      
      const score = (fh.m + rh.m) * 1000000 - templateLen;
      if (score > bestScore) {
        bestScore = score;
        bestFHit = fh;
        bestRHit = rh;
      }
    }
  }
  
  if (!bestFHit || !bestRHit) {
    throw new Error('No valid PCR product found. Please check primer sequences.');
  }
  
  const f3 = bestFHit.f3;
  const r3 = bestRHit.r3;
  const revRC = bestRHit.revRC;
  
  // Calculate template sequence (f3+1→r3-1) excluding endpoints to avoid duplication
  const f3Next = (f3 + 1) % L;
  let templateSeq = '';
  if (f3Next !== r3) {
    const tempSeq = Core.pcrProductSeq(vector, f3Next, r3);
    templateSeq = tempSeq.slice(0, -1); // Remove last base (r3 position)
  }
  
  // Calculate full PCR product: forward primer + template + reverse primer RC
  const pcrFNorm2 = normIUPAC(pcrF);
  const pcrRNorm2 = normIUPAC(pcrR);
  const pcrRRC = revCompIUPAC(pcrRNorm2);
  const pcrProduct = pcrFNorm2 + templateSeq + pcrRRC;
  
  // Multi-insert support (no U in input primers): use the same no-U junction search for ALL junctions
  if (insertSeqs.length > 1) {
    return designUSERPrimersNoUMultiInsertFromPcr(
      pcrProduct,
      insertSeqs,
      {
        targetTm,
        overlapTm,
        conc_nM,
        na_mM,
        mg_mM,
        overlapLen: opts.overlapLen || 9
      },
      {
        pcrF,
        pcrR,
        pcrFCore: pcrFNorm2,
        pcrRCore: pcrRNorm2,
        fwd5Prime: f3,
        rev5PrimeOnForward: (r3 + pcrRNorm2.length) % vector.length,
        primersSwapped
      }
    );
  }
  
  const insert = insertSeqs[0];
  
  // Step 2: Build assembled sequence (aligned with Gibson PCR mode)
  // In PCR mode: assembledSeq = PCR product + insert block
  // Rotate 180 degrees: treat assembledSeq as circular and rotate to avoid origin crossing
  // This ensures PCR product's end is at a safe position for core design
  let assembledSeq = pcrProduct + insert;
  const assembledSeqLen = assembledSeq.length;
  
  // Rotate assembledSeq 180 degrees (half circle)
  // This moves PCR product's end to a position that won't cross origin when designing core
  const rotationOffset = Math.floor(assembledSeqLen / 2);
  assembledSeq = Core.rotateCircular(assembledSeq, rotationOffset);
  
  // Calculate new positions after rotation
  // Original: [0...backboneLeft.length-1] = PCR product, [backboneLeft.length...end] = insert
  // After rotation: positions are shifted by rotationOffset
  const backboneLeft = pcrProduct;
  const backboneRight = '';
  
  // Calculate new junction positions in rotated sequence
  // leftJunction was at backboneLeft.length, now at (backboneLeft.length + rotationOffset) % assembledSeqLen
  // rightJunction was at backboneLeft.length + insert.length, now at (backboneLeft.length + insert.length + rotationOffset) % assembledSeqLen
  
  // Convert to positions for compatibility with existing code
  const fwdPos = f3;
  const revPos = r3;
  const fwd5Prime = fwdPos;
  const rev5PrimeOnForward = (revPos + pcrRNorm2.length) % vector.length;
  
  // Step 4: Design USER cloning overlap
  // Calculate junction positions in rotated assembledSeq (circular coordinates)
  const overlapLen = opts.overlapLen || 9; // User-specified overlap length (default 9)
  const leftJunction = (backboneLeft.length + rotationOffset) % assembledSeqLen;
  const rightJunction = (backboneLeft.length + insert.length + rotationOffset) % assembledSeqLen;
  
  const leftOverlapInfo = findUSEROverlapAtJunction(
    assembledSeq,
    leftJunction,
    overlapTm,
    { conc_nM, na_mM, mg_mM, overlapLen }
  );
  
  const rightOverlapInfo = findUSEROverlapAtJunction(
    assembledSeq,
    rightJunction,
    overlapTm,
    { conc_nM, na_mM, mg_mM, overlapLen }
  );
  
  // Debug: Output sequences around junctions
  console.log('=== Junction Debug Info ===');
  console.log('assembledSeqLen:', assembledSeqLen);
  console.log('rotationOffset:', rotationOffset);
  console.log('pcrProduct.length:', pcrProduct.length);
  console.log('insert.length:', insert.length);
  console.log('leftJunction:', leftJunction);
  console.log('rightJunction:', rightJunction);
  
  // Extract sequences around leftJunction (20bp before and after)
  const leftJunctionBefore = (leftJunction - 20 + assembledSeqLen) % assembledSeqLen;
  const leftJunctionAfter = (leftJunction + 20) % assembledSeqLen;
  let leftJunctionSeq;
  if (leftJunctionBefore < leftJunction) {
    leftJunctionSeq = assembledSeq.slice(leftJunctionBefore, leftJunction + 20);
  } else {
    // Wraps around
    leftJunctionSeq = assembledSeq.slice(leftJunctionBefore) + assembledSeq.slice(0, leftJunction + 20);
  }
  console.log('leftJunction sequence (20bp before + junction + 20bp after):');
  console.log('  Position:', leftJunctionBefore, 'to', (leftJunction + 20) % assembledSeqLen);
  console.log('  Sequence:', leftJunctionSeq);
  console.log('  Junction marker at position:', 20, 'in displayed sequence');
  
  // Extract sequences around rightJunction (20bp before and after)
  const rightJunctionBefore = (rightJunction - 20 + assembledSeqLen) % assembledSeqLen;
  const rightJunctionAfter = (rightJunction + 20) % assembledSeqLen;
  let rightJunctionSeq;
  if (rightJunctionBefore < rightJunction) {
    rightJunctionSeq = assembledSeq.slice(rightJunctionBefore, rightJunction + 20);
  } else {
    // Wraps around
    rightJunctionSeq = assembledSeq.slice(rightJunctionBefore) + assembledSeq.slice(0, rightJunction + 20);
  }
  console.log('rightJunction sequence (20bp before + junction + 20bp after):');
  console.log('  Position:', rightJunctionBefore, 'to', (rightJunction + 20) % assembledSeqLen);
  console.log('  Sequence:', rightJunctionSeq);
  console.log('  Junction marker at position:', 20, 'in displayed sequence');
  
  // Also show PCR product end for comparison
  console.log('PCR product end (last 20bp):', pcrProduct.slice(-20));
  console.log('PCR product start (first 20bp):', pcrProduct.slice(0, 20));
  console.log('Insert start (first 20bp):', insert.slice(0, 20));
  console.log('Insert end (last 20bp):', insert.slice(-20));
  console.log('================================');
  
  // Step 5: Design core binding regions
  // All cores are designed in rotated assembledSeq space (circular)
  const insertFCore = designCoreBindingFromPosition(assembledSeq, leftOverlapInfo.coreStartPos, true, targetTm, { conc_nM, na_mM, mg_mM });
  const vecLeftCore = designCoreBindingFromPosition(assembledSeq, leftOverlapInfo.coreEndPos, false, targetTm, { conc_nM, na_mM, mg_mM });
  const insertRCore = designCoreBindingFromPosition(assembledSeq, rightOverlapInfo.coreEndPos, false, targetTm, { conc_nM, na_mM, mg_mM });
  
  // Vector-F core: bind to PCR product LEFT end (beginning)
  // Vector-F's overlap is at rightJunction (insert's end)
  // In rotated assembledSeq:
  // - rightJunction = insert's end
  // - After rightJunction = PCR product's LEFT end (beginning)
  // - Vector-F's core should bind to PCR product's LEFT end (beginning), not right end!
  // Core should start after the overlap boundary to avoid overlap/core duplication.
  const vecRightCoreStartPosRaw = rightOverlapInfo.coreStartPos;
  let vecRightCoreStartOffset = (vecRightCoreStartPosRaw - rightJunction + assembledSeqLen) % assembledSeqLen;
  let vecRightCoreStartPos = vecRightCoreStartPosRaw;
  if (isFinite(vecRightCoreStartOffset) && vecRightCoreStartOffset > 0 && vecRightCoreStartOffset < pcrProduct.length) {
    vecRightCoreStartOffset -= 1;
    vecRightCoreStartPos = (vecRightCoreStartPosRaw - 1 + assembledSeqLen) % assembledSeqLen;
  }
  if (!isFinite(vecRightCoreStartOffset) || vecRightCoreStartOffset < 0 || vecRightCoreStartOffset >= pcrProduct.length) {
    vecRightCoreStartOffset = 0;
    vecRightCoreStartPos = vecRightCoreStartPosRaw;
  }
  const vecRightCore = designCoreBindingFromPosition(assembledSeq, vecRightCoreStartPos, true, targetTm, { conc_nM, na_mM, mg_mM });
  
  // Verify and fix: ensure vecRightCore is from PCR product's beginning, not insert
  // If the core extends beyond PCR product boundary, use PCR product's beginning directly
  if (vecRightCore.seq && vecRightCore.seq.length > 0) {
    // Check if core is actually from PCR product's beginning
    // In rotated sequence, PCR product starts at rightJunction (after insert)
    // Core should be from the overlap boundary (vecRightCoreStartPos) going forward.
    const coreLen = vecRightCore.seq.length;
    
    // Extract actual core from rotated assembledSeq at vecRightCoreStartPos going forward
    let actualCoreFromRotated;
    if (vecRightCoreStartPos + coreLen <= assembledSeqLen) {
      // No wrapping needed
      actualCoreFromRotated = assembledSeq.slice(vecRightCoreStartPos, vecRightCoreStartPos + coreLen);
    } else {
      // Wraps around: need to handle circular coordinates
      const part1 = assembledSeq.slice(vecRightCoreStartPos);
      const part2 = assembledSeq.slice(0, vecRightCoreStartPos + coreLen - assembledSeqLen);
      actualCoreFromRotated = part1 + part2;
    }
    
    // Compare with expected PCR product segment (starting after overlap boundary)
    const expectedCore = pcrProduct.slice(vecRightCoreStartOffset, Math.min(vecRightCoreStartOffset + coreLen, pcrProduct.length));
    
    // If they don't match, use PCR product's beginning directly
    if (actualCoreFromRotated.length !== expectedCore.length || 
        actualCoreFromRotated !== expectedCore) {
      // Use PCR product segment directly
      const vecCoreMinLen = 18;
      const vecCoreMaxLen = 40;
      let bestTmDiff = Infinity;
      let bestCore = null;
      
      for (let len = vecCoreMinLen; len <= vecCoreMaxLen && vecRightCoreStartOffset + len <= pcrProduct.length; len++) {
        const coreSeq = pcrProduct.slice(vecRightCoreStartOffset, vecRightCoreStartOffset + len);
        const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
        const tmDiff = Math.abs(tm - targetTm);
        
        if (tmDiff < bestTmDiff) {
          bestTmDiff = tmDiff;
          bestCore = { seq: coreSeq, len, tm };
        }
      }
      
      if (bestCore) {
        vecRightCore.seq = bestCore.seq;
        vecRightCore.len = bestCore.len;
        vecRightCore.tm = bestCore.tm;
      }
    }
  } else {
    // Fallback: use PCR product segment directly
    const vecCoreMinLen = 18;
    const vecCoreMaxLen = 40;
    let bestTmDiff = Infinity;
    let bestCore = null;
    
    for (let len = vecCoreMinLen; len <= vecCoreMaxLen && vecRightCoreStartOffset + len <= pcrProduct.length; len++) {
      const coreSeq = pcrProduct.slice(vecRightCoreStartOffset, vecRightCoreStartOffset + len);
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      const tmDiff = Math.abs(tm - targetTm);
      
      if (tmDiff < bestTmDiff) {
        bestTmDiff = tmDiff;
        bestCore = { seq: coreSeq, len, tm };
      }
    }
    
    if (bestCore) {
      vecRightCore.seq = bestCore.seq;
      vecRightCore.len = bestCore.len;
      vecRightCore.tm = bestCore.tm;
    } else if (pcrProduct.length > 0) {
      // Last resort: use whatever is available from PCR product segment
      const fallbackLen = Math.min(25, Math.max(0, pcrProduct.length - vecRightCoreStartOffset));
      vecRightCore.seq = pcrProduct.slice(vecRightCoreStartOffset, vecRightCoreStartOffset + fallbackLen);
      vecRightCore.len = fallbackLen;
      vecRightCore.tm = tmSaltCorrected(vecRightCore.seq, conc_nM, na_mM, mg_mM);
    }
  }
  
  // Step 6: Build USER primers
  const vecLeftCoreRC = revComp(vecLeftCore.seq);
  const R_vec = leftOverlapInfo.revTail + vecLeftCoreRC;
  const R_vecTm = tmSaltCorrected(R_vec, conc_nM, na_mM, mg_mM);
  
  const F_insert = leftOverlapInfo.fwdTail + insertFCore.seq;
  const F_insertTm = tmSaltCorrected(F_insert, conc_nM, na_mM, mg_mM);
  
  const insertRCoreRC = revComp(insertRCore.seq);
  const R_insert = rightOverlapInfo.revTail + insertRCoreRC;
  const R_insertTm = tmSaltCorrected(R_insert, conc_nM, na_mM, mg_mM);
  
  // Vector-F: overlap + core
  // For rightOverlapInfo:
  // - fwdTail = overlapSeq.slice(0, -1) + 'U' (overlap sequence with U)
  // - revTail = revComp(overlapSeq).slice(0, -1) + 'U' (RC of overlap with U)
  // If isRightSide=true, overlap is in insert side, fwdTail is insert-side, revTail is backbone-side
  // Vector-F binds to backbone (PCR product), so it should use revTail (backbone-side overlap)
  // If isRightSide=false or isLeftSide=true, fwdTail is backbone-side, so use fwdTail
  let vecFOverlap = rightOverlapInfo.isRightSide ? rightOverlapInfo.revTail : rightOverlapInfo.fwdTail;
  
  // Ensure vecFOverlap is not empty
  if (!vecFOverlap || vecFOverlap.length === 0) {
    // Fallback: use the other tail or create a default overlap
    vecFOverlap = rightOverlapInfo.isRightSide ? rightOverlapInfo.fwdTail : rightOverlapInfo.revTail;
    if (!vecFOverlap || vecFOverlap.length === 0) {
      // Last resort: create a minimal overlap
      vecFOverlap = 'AAAAAU';  // Default 6bp overlap with U
    }
  }
  
  const F_vec = vecFOverlap + vecRightCore.seq;
  const F_vecTm = tmSaltCorrected(F_vec, conc_nM, na_mM, mg_mM);
  
  // Collect warnings
  const warnings = [];
  if (leftOverlapInfo.warning) warnings.push({ primer: 'left_overlap', warning: leftOverlapInfo.warning });
  if (rightOverlapInfo.warning) warnings.push({ primer: 'right_overlap', warning: rightOverlapInfo.warning });
  
  return {
    vector: {
      F: {
        seq: F_vec,
        len: F_vec.length,
        gc: gcContent(F_vec),
        tm: F_vecTm,
        coreSeq: vecRightCore.seq,
        coreTm: vecRightCore.tm,
        overlapSeq: vecFOverlap  // Use the actual overlap used in F_vec
      },
      R: {
        seq: R_vec,
        len: R_vec.length,
        gc: gcContent(R_vec),
        tm: R_vecTm,
        coreSeq: vecLeftCoreRC,
        coreTm: vecLeftCore.tm,
        overlapSeq: leftOverlapInfo.revTail
      }
    },
    insert: {
      F: {
        seq: F_insert,
        len: F_insert.length,
        gc: gcContent(F_insert),
        tm: F_insertTm,
        coreSeq: insertFCore.seq,
        coreTm: insertFCore.tm,
        overlapSeq: leftOverlapInfo.fwdTail
      },
      R: {
        seq: R_insert,
        len: R_insert.length,
        gc: gcContent(R_insert),
        tm: R_insertTm,
        coreSeq: insertRCoreRC,
        coreTm: insertRCore.tm,
        overlapSeq: rightOverlapInfo.revTail
      }
    },
    overlap: {
      leftOverlap: {
        overlapSeq: leftOverlapInfo.overlapSeq,
        backboneSeq: leftOverlapInfo.backboneSeq,
        insertSeq: leftOverlapInfo.insertSeq,
        len: leftOverlapInfo.len,
        tm: leftOverlapInfo.tm,
        gc: leftOverlapInfo.gc
      },
      rightOverlap: {
        overlapSeq: rightOverlapInfo.overlapSeq,
        backboneSeq: rightOverlapInfo.backboneSeq,
        insertSeq: rightOverlapInfo.insertSeq,
        len: rightOverlapInfo.len,
        tm: rightOverlapInfo.tm,
        gc: rightOverlapInfo.gc
      }
    },
    warnings: warnings,
    backbone: {
      left: backboneLeft,
      right: backboneRight
    },
    assembledSeq: assembledSeq
    ,
    pcrInfo: {
      forward: {
        seq: pcrF,
        coreSeq: pcrFNorm2,
        len: pcrFNorm2.length,
        tm: tmSaltCorrected(pcrFNorm2, conc_nM, na_mM, mg_mM)
      },
      reverse: {
        seq: pcrR,
        coreSeq: pcrRNorm2,
        len: pcrRNorm2.length,
        tm: tmSaltCorrected(pcrRNorm2, conc_nM, na_mM, mg_mM)
      },
      fwd5Prime: fwd5Prime,
      rev5PrimeOnForward: rev5PrimeOnForward,
      primersSwapped: primersSwapped,
      isInverse: primersSwapped
    }
  };
}

function designUSERPrimersNoUMultiInsertFromPcr(pcrProduct, insertSeqs, cfg, pcrMeta) {
  const { targetTm, overlapTm, conc_nM, na_mM, mg_mM, overlapLen } = cfg;
  const insertBlock = insertSeqs.join('');
  
  // Build circular assembled sequence: PCR product + all inserts
  let assembledSeq = pcrProduct + insertBlock;
  const assembledSeqLen = assembledSeq.length;
  
  // Junction boundaries in unrotated assembledSeq coordinates
  const boundaries = [];
  let cursor = pcrProduct.length;
  boundaries.push(cursor); // Vector-Insert1
  for (let i = 0; i < insertSeqs.length - 1; i++) {
    cursor += insertSeqs[i].length;
    boundaries.push(cursor); // Insert{i}-Insert{i+1}
  }
  boundaries.push(pcrProduct.length + insertBlock.length); // InsertN-Vector (wrap)
  
  // Choose a rotation offset that keeps all junctions away from sequence ends
  const maxCoreLen = 40;
  const overlapSearchMargin = 25;
  const maxOverlapLen = 14;
  let margin = overlapSearchMargin + maxOverlapLen + maxCoreLen + 5;
  margin = Math.max(20, Math.min(margin, Math.floor(assembledSeqLen / 4)));
  
  const preferredOffset = Math.floor(assembledSeqLen / 2);
  let rotationOffset = preferredOffset;
  for (let delta = 0; delta < assembledSeqLen; delta++) {
    const step = Math.floor((delta + 1) / 2);
    const candidate = (preferredOffset + (delta % 2 === 0 ? step : -step) + assembledSeqLen) % assembledSeqLen;
    let ok = true;
    for (const b of boundaries) {
      const pos = (b + candidate) % assembledSeqLen;
      if (pos < margin || pos > assembledSeqLen - margin) {
        ok = false;
        break;
      }
    }
    if (ok) {
      rotationOffset = candidate;
      break;
    }
  }
  
  assembledSeq = Core.rotateCircular(assembledSeq, rotationOffset);
  
  // Find overlap at each junction in rotated space
  const junctionPositions = boundaries.map(b => (b + rotationOffset) % assembledSeqLen);
  const overlapInfos = junctionPositions.map((pos) =>
    findUSEROverlapAtJunction(assembledSeq, pos, overlapTm, { conc_nM, na_mM, mg_mM, overlapLen })
  );
  
  const leftOverlapInfo = overlapInfos[0];
  const rightOverlapInfo = overlapInfos[overlapInfos.length - 1];
  const rightJunction = junctionPositions[junctionPositions.length - 1];
  
  // Design vector cores (same strategy as single-insert no-U path)
  const vecLeftCore = designCoreBindingFromPosition(assembledSeq, leftOverlapInfo.coreEndPos, false, targetTm, { conc_nM, na_mM, mg_mM });
  
  // Vector-F core: bind to PCR product LEFT end (beginning) after the final junction
  const vecRightCoreStartPosRaw = rightOverlapInfo.coreStartPos;
  let vecRightCoreStartOffset = (vecRightCoreStartPosRaw - rightJunction + assembledSeqLen) % assembledSeqLen;
  let vecRightCoreStartPos = vecRightCoreStartPosRaw;
  if (isFinite(vecRightCoreStartOffset) && vecRightCoreStartOffset > 0 && vecRightCoreStartOffset < pcrProduct.length) {
    vecRightCoreStartOffset -= 1;
    vecRightCoreStartPos = (vecRightCoreStartPosRaw - 1 + assembledSeqLen) % assembledSeqLen;
  }
  if (!isFinite(vecRightCoreStartOffset) || vecRightCoreStartOffset < 0 || vecRightCoreStartOffset >= pcrProduct.length) {
    vecRightCoreStartOffset = 0;
    vecRightCoreStartPos = vecRightCoreStartPosRaw;
  }
  
  const vecRightCore = designCoreBindingFromPosition(assembledSeq, vecRightCoreStartPos, true, targetTm, { conc_nM, na_mM, mg_mM });
  
  // Verify vecRightCore matches PCR product start; otherwise take directly from PCR product
  if (vecRightCore.seq && vecRightCore.seq.length > 0) {
    const coreLen = vecRightCore.seq.length;
    const coreEnd = vecRightCoreStartPos + coreLen;
    const actualCoreFromRotated = coreEnd <= assembledSeqLen
      ? assembledSeq.slice(vecRightCoreStartPos, coreEnd)
      : assembledSeq.slice(vecRightCoreStartPos) + assembledSeq.slice(0, coreEnd - assembledSeqLen);
    
    const expectedCore = pcrProduct.slice(vecRightCoreStartOffset, Math.min(vecRightCoreStartOffset + coreLen, pcrProduct.length));
    if (actualCoreFromRotated.length !== expectedCore.length || actualCoreFromRotated !== expectedCore) {
      const vecCoreMinLen = 18;
      const vecCoreMaxLen = 40;
      let bestTmDiff = Infinity;
      let bestCore = null;
      
      for (let len = vecCoreMinLen; len <= vecCoreMaxLen && vecRightCoreStartOffset + len <= pcrProduct.length; len++) {
        const coreSeq = pcrProduct.slice(vecRightCoreStartOffset, vecRightCoreStartOffset + len);
        const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
        const tmDiff = Math.abs(tm - targetTm);
        if (tmDiff < bestTmDiff) {
          bestTmDiff = tmDiff;
          bestCore = { seq: coreSeq, len, tm };
        }
      }
      
      if (bestCore) {
        vecRightCore.seq = bestCore.seq;
        vecRightCore.len = bestCore.len;
        vecRightCore.tm = bestCore.tm;
      }
    }
  }
  
  // Design insert primers per insert using adjacent junction overlaps
  const insertsOut = [];
  for (let i = 0; i < insertSeqs.length; i++) {
    const leftInfo = overlapInfos[i];
    const rightInfo = overlapInfos[i + 1];
    
    const fwdCore = designCoreBindingFromPosition(assembledSeq, leftInfo.coreStartPos, true, targetTm, { conc_nM, na_mM, mg_mM });
    const revCore = designCoreBindingFromPosition(assembledSeq, rightInfo.coreEndPos, false, targetTm, { conc_nM, na_mM, mg_mM });
    
    const revCoreRC = revComp(revCore.seq);
    const insF = leftInfo.fwdTail + fwdCore.seq;
    const insR = rightInfo.revTail + revCoreRC;
    
    insertsOut.push({
      index: i + 1,
      name: `Insert${i + 1}`,
      length: insertSeqs[i].length,
      F: {
        seq: insF,
        len: insF.length,
        gc: gcContent(insF),
        tm: tmSaltCorrected(insF, conc_nM, na_mM, mg_mM),
        coreSeq: fwdCore.seq,
        coreTm: fwdCore.tm,
        overlapSeq: leftInfo.fwdTail
      },
      R: {
        seq: insR,
        len: insR.length,
        gc: gcContent(insR),
        tm: tmSaltCorrected(insR, conc_nM, na_mM, mg_mM),
        coreSeq: revCoreRC,
        coreTm: revCore.tm,
        overlapSeq: rightInfo.revTail
      }
    });
  }
  
  // Vector primers
  const vecLeftCoreRC = revComp(vecLeftCore.seq);
  const R_vec = leftOverlapInfo.revTail + vecLeftCoreRC;
  const R_vecTm = tmSaltCorrected(R_vec, conc_nM, na_mM, mg_mM);
  
  let vecFOverlap = rightOverlapInfo.isRightSide ? rightOverlapInfo.revTail : rightOverlapInfo.fwdTail;
  if (!vecFOverlap || vecFOverlap.length === 0) {
    vecFOverlap = rightOverlapInfo.isRightSide ? rightOverlapInfo.fwdTail : rightOverlapInfo.revTail;
    if (!vecFOverlap || vecFOverlap.length === 0) vecFOverlap = 'AAAAAU';
  }
  
  const F_vec = vecFOverlap + vecRightCore.seq;
  const F_vecTm = tmSaltCorrected(F_vec, conc_nM, na_mM, mg_mM);
  
  const overlapJunctions = overlapInfos.map((info, idx) => {
    let label;
    if (idx === 0) label = 'Vector-Insert1';
    else if (idx === overlapInfos.length - 1) label = `Insert${insertSeqs.length}-Vector`;
    else label = `Insert${idx}-Insert${idx + 1}`;
    
    return {
      label,
      overlapSeq: info.overlapSeq,
      backboneSeq: info.backboneSeq,
      insertSeq: info.insertSeq,
      len: info.len,
      tm: info.tm,
      gc: info.gc
    };
  });
  
  const warnings = [];
  overlapInfos.forEach((info, idx) => {
    if (info.warning) warnings.push({ primer: `junction_${idx + 1}`, warning: info.warning });
  });
  
  return {
    vector: {
      F: {
        seq: F_vec,
        len: F_vec.length,
        gc: gcContent(F_vec),
        tm: F_vecTm,
        coreSeq: vecRightCore.seq,
        coreTm: vecRightCore.tm,
        overlapSeq: vecFOverlap
      },
      R: {
        seq: R_vec,
        len: R_vec.length,
        gc: gcContent(R_vec),
        tm: R_vecTm,
        coreSeq: vecLeftCoreRC,
        coreTm: vecLeftCore.tm,
        overlapSeq: leftOverlapInfo.revTail
      }
    },
    inserts: insertsOut,
    overlap: {
      leftOverlap: overlapJunctions[0],
      rightOverlap: overlapJunctions[overlapJunctions.length - 1],
      junctions: overlapJunctions,
      leftCompatibility: checkOverlapCompatibility(overlapJunctions[0].backboneSeq, overlapJunctions[0].insertSeq),
      rightCompatibility: checkOverlapCompatibility(overlapJunctions[overlapJunctions.length - 1].backboneSeq, overlapJunctions[overlapJunctions.length - 1].insertSeq)
    },
    warnings,
    backbone: {
      left: pcrProduct,
      right: ''
    },
    assembledSeq,
    pcrInfo: {
      forward: {
        seq: pcrMeta.pcrF,
        coreSeq: pcrMeta.pcrFCore,
        len: pcrMeta.pcrFCore.length,
        tm: tmSaltCorrected(pcrMeta.pcrFCore, conc_nM, na_mM, mg_mM)
      },
      reverse: {
        seq: pcrMeta.pcrR,
        coreSeq: pcrMeta.pcrRCore,
        len: pcrMeta.pcrRCore.length,
        tm: tmSaltCorrected(pcrMeta.pcrRCore, conc_nM, na_mM, mg_mM)
      },
      fwd5Prime: pcrMeta.fwd5Prime,
      rev5PrimeOnForward: pcrMeta.rev5PrimeOnForward,
      primersSwapped: pcrMeta.primersSwapped,
      isInverse: pcrMeta.primersSwapped
    }
  };
}

/**
 * Find USER overlap at junction (5'AN(4-13)T3' pattern)
 */
function findUSEROverlapAtJunction(assembledSeq, junctionPos, targetTm = 50, opts = {}) {
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  const targetOverlapLen = opts.overlapLen || 9; // User-specified overlap length (default 9)
  
  const seq = Core.normalizeSeq(assembledSeq);
  
  const searchStart = Math.max(0, junctionPos - 25);
  const searchEnd = Math.min(seq.length, junctionPos + 25);
  const searchRegion = seq.slice(searchStart, searchEnd);
  
  const regex = /A[ACGTURYSWKMBDHVNIPX]{4,13}T/gi;
  const candidates = [];
  
  let match;
  while ((match = regex.exec(searchRegion)) !== null) {
    const overlapSeq = match[0].toUpperCase();
    const overlapLen = overlapSeq.length;
    const tPos = overlapLen - 1;
    
    const overlapStartInSeq = searchStart + match.index;
    const overlapEndInSeq = overlapStartInSeq + overlapLen;
    
    const isLeftSide = overlapEndInSeq <= junctionPos;
    const isRightSide = overlapStartInSeq >= junctionPos;
    
    if (isLeftSide || isRightSide || (overlapStartInSeq < junctionPos && overlapEndInSeq > junctionPos)) {
      const centerOfMatch = (overlapStartInSeq + overlapEndInSeq) / 2;
      const distanceFromJunction = Math.abs(centerOfMatch - junctionPos);
      
      const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
      
      candidates.push({
        overlapSeq: overlapSeq,
        len: overlapLen,
        startInSeq: overlapStartInSeq,
        endInSeq: overlapEndInSeq,
        tPos: tPos,
        tm: tm,
        gc: gcContent(overlapSeq),
        distanceFromJunction: distanceFromJunction,
        isLeftSide: isLeftSide,
        isRightSide: isRightSide
      });
    }
  }
  
  if (candidates.length === 0) {
    // Use user-specified overlap length as default
    const defaultLen = targetOverlapLen;
    const defaultStart = Math.max(0, junctionPos - defaultLen);
    const defaultOverlap = seq.slice(defaultStart, defaultStart + defaultLen);
    
    return {
      backboneSeq: defaultOverlap,
      insertSeq: defaultOverlap,
      len: defaultLen,
      tm: tmSaltCorrected(defaultOverlap, conc_nM, na_mM, mg_mM),
      gc: gcContent(defaultOverlap),
      complementarity: 0.5,
      uPos: -1,
      found: false,
      warning: 'No 5\'AN(4-13)T3\' pattern found, using default sequence with extra U added, please confirm if this may cause frameshift mutation',
      fwdTail: defaultOverlap.slice(0, -1) + 'U',
      revTail: revComp(defaultOverlap).slice(0, -1) + 'U',
      coreStartPos: defaultStart + defaultLen,
      coreEndPos: defaultStart
    };
  }
  
  let bestCandidate = null;
  let bestScore = Infinity;
  
  // Select candidate closest to user-specified overlap length
  // Score = distance from junction * 2 + Tm difference + length difference from target
  for (const cand of candidates) {
    const tmDiff = Math.abs(cand.tm - targetTm);
    const lenDiff = Math.abs(cand.len - targetOverlapLen);
    const score = cand.distanceFromJunction * 2 + tmDiff * 0.5 + lenDiff * 3; // Weight length difference more
    
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = cand;
    }
  }
  
  if (!bestCandidate) {
    bestCandidate = candidates[0];
  }
  
  let backboneSeq, insertSeq;
  
  if (bestCandidate.isLeftSide) {
    backboneSeq = bestCandidate.overlapSeq;
    const insertStart = junctionPos;
    const insertEnd = Math.min(seq.length, insertStart + bestCandidate.len);
    insertSeq = seq.slice(insertStart, insertEnd);
    if (insertSeq.length < bestCandidate.len) {
      insertSeq = insertSeq + 'A'.repeat(bestCandidate.len - insertSeq.length);
    }
  } else if (bestCandidate.isRightSide) {
    insertSeq = bestCandidate.overlapSeq;
    const backboneEnd = junctionPos;
    const backboneStart = Math.max(0, backboneEnd - bestCandidate.len);
    backboneSeq = seq.slice(backboneStart, backboneEnd);
    if (backboneSeq.length < bestCandidate.len) {
      backboneSeq = 'A'.repeat(bestCandidate.len - backboneSeq.length) + backboneSeq;
    }
  } else {
    const leftPart = bestCandidate.overlapSeq.slice(0, junctionPos - bestCandidate.startInSeq);
    const rightPart = bestCandidate.overlapSeq.slice(junctionPos - bestCandidate.startInSeq);
    backboneSeq = leftPart + 'A'.repeat(bestCandidate.len - leftPart.length);
    insertSeq = 'A'.repeat(bestCandidate.len - rightPart.length) + rightPart;
  }
  
  const fwdTail = bestCandidate.overlapSeq.slice(0, -1) + 'U';
  const rcSeq = revComp(bestCandidate.overlapSeq);
  const revTail = rcSeq.slice(0, -1) + 'U';
  
  return {
    overlapSeq: bestCandidate.overlapSeq,
    backboneSeq: backboneSeq,
    insertSeq: insertSeq,
    len: bestCandidate.len,
    tm: bestCandidate.tm,
    gc: bestCandidate.gc,
    complementarity: 1.0,
    uPos: bestCandidate.tPos,
    fwdTail: fwdTail,
    revTail: revTail,
    coreStartPos: bestCandidate.endInSeq,
    coreEndPos: bestCandidate.startInSeq,
    isLeftSide: bestCandidate.isLeftSide,
    isRightSide: bestCandidate.isRightSide,
    found: true,
    warning: null
  };
}

/**
 * Get uracil positions in sequence
 */
function getUracilPositions(seq) {
  const positions = [];
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === 'U' || seq[i] === 'u') {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * Check overlap sequence compatibility
 */
function checkOverlapCompatibility(overlap1, overlap2) {
  const overlap2RC = revComp(overlap2);
  const complementarity = calculateComplementarity(overlap1, overlap2RC);
  
  return {
    compatible: complementarity > 0.7,
    complementarity: complementarity,
    overlap1: overlap1,
    overlap2: overlap2,
    overlap2RC: overlap2RC
  };
}

/**
 * 计算两个序列的互补性
 */
function calculateComplementarity(seq1, seq2) {
  const minLen = Math.min(seq1.length, seq2.length);
  if (minLen === 0) return 0;
  
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    const comp = Core.IUPAC_COMP[seq1[i]] || 'N';
    if (comp === seq2[i] || seq2[i] === 'N' || seq1[i] === 'N') {
      matches++;
    }
  }
  
  return matches / minLen;
}

// ==================== Global State ====================

let currentResults = null;
// Use window object for assembled sequence (aligned with Gibson)
window.currentAssembledSeq = null;
window.currentAssembledName = 'USER_assembled';

// ==================== Vector Preview ====================

function updateVectorPreview() {
  const vectorText = $('vector-seq').value.trim();
  const statsDiv = $('vector-map-stats');
  
  if (!vectorText) {
    if (statsDiv) statsDiv.textContent = 'Paste vector above';
    const canvas = $('vector-map-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }
  
  try {
    const records = parseFASTA(vectorText);
    if (records.length === 0) {
      if (statsDiv) statsDiv.textContent = 'Unable to parse vector sequence';
      return;
    }
    if (records.length > 1 && statsDiv) {
      statsDiv.textContent = 'Multiple sequences found, using first one';
    }
    
    const vector = records[0];
    const seq = vector.seq;
    const len = seq.length;
    const name = vector.name || 'Vector';
    
    const annotations = [];
    
    // Detect features using common_features.js
    if (window.COMMON_FEATURES) {
      const feats = Core.detectFeatures(seq, window.COMMON_FEATURES);
      feats.forEach(f => {
        annotations.push({ 
          start: f.start, 
          end: f.end, 
          color: f.color || '#3b82f6',
          name: f.name 
        });
      });
    }
    
    const rotation = parseInt($('vector-map-rotation').value) || 0;
    VIZ.drawVectorMap('vector-map-canvas', len, name, annotations, rotation);
    
    if (statsDiv) {
      statsDiv.textContent = `${len} bp`;
    }
    
  } catch (error) {
    if (statsDiv) statsDiv.textContent = 'Error parsing vector';
  }
}

window.addEventListener('common-features-ready', () => {
  try { updateVectorPreview(); } catch (e) {}
}, { once: true });

// ==================== UI Functions ====================

function highlightUracil(seq) {
  return seq.split('').map((base, i) => {
    if (base === 'U' || base === 'u') {
      return `<span class="uracil-highlight">U</span>`;
    }
    return base;
  }).join('');
}

function displayResults(results) {
  currentResults = results;
  
  if (results.assembledSeq) {
    window.currentAssembledSeq = results.assembledSeq;
  } else if (results.backbone && (results.insert || results.inserts)) {
    const insertSeq = cleanDNA(getCombinedInsertSeq());
    window.currentAssembledSeq = results.backbone.left + insertSeq + results.backbone.right;
  } else {
    window.currentAssembledSeq = null;
  }
  
  const vectorHeader = extractFASTAHeader($('vector-seq').value);
  const insertSeqs = getAllInsertSeqs();
  const insertHeader = insertSeqs.length > 0 ? extractFASTAHeader(insertSeqs[0]) : '';
  if (vectorHeader || insertHeader) {
    window.currentAssembledName = (vectorHeader || 'vector') + '_' + (insertHeader || 'insert');
  } else {
    window.currentAssembledName = 'USER_assembled';
  }
  
  const resultsDiv = $('results-wrap');
  const resultsContent = $('results-content');
  
  // Clear previous results
  resultsContent.innerHTML = '';
  
  // Get parameters for QC
  const naConc = parseFloat($('na-conc').value) || 50;
  const mgConc = parseFloat($('mg-conc').value) || 0;
  const primerConc = parseFloat($('primer-conc').value) || 500;
  
  // Parse vector and insert for diagram and gel
  const vectorText = $('vector-seq').value.trim();
  const insertText = getCombinedInsertSeq();
  const vector = parseFASTA(vectorText)[0] || { seq: cleanDNA(vectorText), name: 'vector' };
  const insert = parseFASTA(insertText)[0] || { seq: cleanDNA(insertText), name: 'insert' };
  
  // Render primer sets (spans 2 columns)
  const primersCell = document.createElement('div');
  primersCell.id = 'cell-primers';
  primersCell.className = 'box';
  primersCell.innerHTML = '<h3>Primer sets</h3>';
  primersCell.innerHTML += renderPrimerSets(results, naConc, mgConc, primerConc);
  resultsContent.appendChild(primersCell);
  
  // Left column wrapper: keeps assembly diagram + overlap table stacked tightly,
  // independent of the gel height on the right.
  const leftCol = document.createElement('div');
  leftCol.className = 'results-left';

  // Render assembly diagram (left column, top)
  const asmDiagramCell = document.createElement('div');
  asmDiagramCell.className = 'box';
  asmDiagramCell.innerHTML = `
    <div class="asm-title">Assembly diagram</div>
    <div style="text-align:center">
      <img id="asm-img" class="asm-figure" src="" style="width:100%;display:none;margin:10px auto;">
      <div class="aside" style="margin-top: 8px; text-align: center;">Diagram is schematic only; lengths are not to scale.</div>
    </div>
  `;
  leftCol.appendChild(asmDiagramCell);
  
  // Render overlap table (left column, bottom)
  const overlapTableCell = document.createElement('div');
  overlapTableCell.className = 'box oh-table';
  overlapTableCell.innerHTML = `
    <h3>Overlap table</h3>
    ${renderOverlapTable(results, naConc, mgConc, primerConc)}
    <div id="warning-out" class="aside" style="margin-top: 8px; color: #b91c1c;"></div>
  `;
  leftCol.appendChild(overlapTableCell);

  // Unified warnings/notes box (always present)
  const warningsBoxElement = document.createElement('div');
  warningsBoxElement.id = 'warnings-box';
  warningsBoxElement.className = 'warnings-box';
  warningsBoxElement.style.marginTop = '10px';
  warningsBoxElement.innerHTML = '';

  const notes = [];
  if (results.warnings && results.warnings.length > 0) {
    notes.push(...results.warnings.map(w => `${w.primer}: ${w.warning}`));
  } else {
    notes.push('No warnings generated for this design.');
  }
  const assembledSeq = window.currentAssembledSeq || '';
  if (assembledSeq) {
    notes.push(`Assembled sequence length: ${assembledSeq.length} bp total.`);
  }
  notes.forEach((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    warningsBoxElement.appendChild(p);
  });
  leftCol.appendChild(warningsBoxElement);

  resultsContent.appendChild(leftCol);
  
  // Render gel section (right column)
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
  const insertsForGel = Array.isArray(results.inserts) && results.inserts.length
    ? results.inserts
    : (insert ? [{ index: 1, name: insert.name, length: insert.seq.length }] : []);
  renderGel(results, vector, insertsForGel);
  
  // Add event listener for ladder change
  const ladderSelect = $('ggx-ladder');
    if (ladderSelect) {
      ladderSelect.addEventListener('change', () => {
        renderGel(results, vector, insertsForGel);
      });
    }
  
  // Load assembly diagram image based on insert count
  const imgInsertCount = Array.isArray(insertsForGel) && insertsForGel.length ? insertsForGel.length : 1;
  drawUSERAssemblyFigure(imgInsertCount, asmDiagramCell);
  
  // Show warnings
  if (results.warnings && results.warnings.length > 0) {
    const warningOut = overlapTableCell.querySelector('#warning-out');
    if (warningOut) {
      warningOut.innerHTML = '<strong>⚠️ Warning:</strong><br>' + 
        results.warnings.map(w => `<div style="margin-top: 4px;"><strong>${w.primer}:</strong> ${w.warning}</div>`).join('');
    }
  }
  
  // Show results
  resultsDiv.style.display = 'block';
  resultsDiv.classList.add('show');
}

function renderPrimerSets(results, naConc, mgConc, primerConc) {
  let html = '';
  
  const vectorBaseName = extractFASTAHeader($('vector-seq')?.value || '') || 'Vector';
  const vectorFLabel = `${vectorBaseName}-F`;
  const vectorRLabel = `${vectorBaseName}-R`;
  const getInsertBaseName = (index1Based) => {
    const idx = Math.max(1, parseInt(index1Based, 10) || 1);
    const insertSeqs = getAllInsertSeqs();
    const raw = insertSeqs[idx - 1] || '';
    return extractFASTAHeader(raw) || `Insert${idx}`;
  };

  // Vector primers
  const vecFwdAnalysis = analyzePrimer(vectorFLabel, results.vector.F.seq, results.vector.F.coreSeq, naConc, mgConc, primerConc);
  const vecRevAnalysis = analyzePrimer(vectorRLabel, results.vector.R.seq, results.vector.R.coreSeq, naConc, mgConc, primerConc);
  const vecCrossDimer = qcPair(vecFwdAnalysis, vecRevAnalysis);
  
  const vecFwdSeq = buildSeqCellWithU(results.vector.F.coreSeq, results.vector.F.seq, results.vector.F.overlapSeq);
  const vecRevSeq = buildSeqCellWithU(results.vector.R.coreSeq, results.vector.R.seq, results.vector.R.overlapSeq);
  
  html += `
    <h3 style="margin-top: 16px;">Vector Primers</h3>
    <table>
      <thead>
        <tr>
          <th>Primer</th>
          <th>Sequence (5′→3′)</th>
          <th style="text-align: center;">Len</th>
          <th style="text-align: center;">GC%</th>
          <th style="text-align: center;">Tm (core/full, °C)</th>
          <th style="text-align: center;">Homopolymer</th>
          <th style="text-align: center;">Hairpin</th>
          <th style="text-align: center;">Self-dimer</th>
          <th style="text-align: center;">Cross-dimer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${vectorFLabel}</td>
          <td class="mono seqcell">${vecFwdSeq.disp}</td>
          <td style="text-align: center;">${vecFwdSeq.len}</td>
          <td style="text-align: center;">${vecFwdSeq.gc.toFixed(1)}%</td>
          <td style="text-align: center;">${vecFwdAnalysis.tmCore.toFixed(1)} / ${vecFwdAnalysis.tmFull.toFixed(1)}</td>
          <td style="text-align: center;">${vecFwdAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
          <td style="text-align: center;">${badge(vecFwdAnalysis.hairpinClass.cls, vecFwdAnalysis.hairpinClass.label)}</td>
          <td style="text-align: center;">${badge(vecFwdAnalysis.selfDimerClass.cls, vecFwdAnalysis.selfDimerClass.label)}</td>
          <td rowspan="2" style="vertical-align: middle; text-align: center;">
            ${vecCrossDimer && vecCrossDimer.info ? badge(vecCrossDimer.info.cls, vecCrossDimer.info.label) : badge('ok', 'None')}
          </td>
        </tr>
        <tr>
          <td>${vectorRLabel}</td>
          <td class="mono seqcell">${vecRevSeq.disp}</td>
          <td style="text-align: center;">${vecRevSeq.len}</td>
          <td style="text-align: center;">${vecRevSeq.gc.toFixed(1)}%</td>
          <td style="text-align: center;">${vecRevAnalysis.tmCore.toFixed(1)} / ${vecRevAnalysis.tmFull.toFixed(1)}</td>
          <td style="text-align: center;">${vecRevAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
          <td style="text-align: center;">${badge(vecRevAnalysis.hairpinClass.cls, vecRevAnalysis.hairpinClass.label)}</td>
          <td style="text-align: center;">${badge(vecRevAnalysis.selfDimerClass.cls, vecRevAnalysis.selfDimerClass.label)}</td>
        </tr>
      </tbody>
    </table>
  `;
  
  // Insert primers (multi-insert supported)
  const fallbackInsertSeq = cleanDNA(getCombinedInsertSeq());
  const inserts = results.inserts && results.inserts.length ? results.inserts : (results.insert ? [{
    index: 1,
    name: 'insert',
    length: fallbackInsertSeq.length,
    F: results.insert.F,
    R: results.insert.R
  }] : []);

  if (inserts.length === 0) {
    return html;
  }
  
  const firstIns = inserts[0];
  const firstIndex = firstIns.index || 1;
  const insertBaseName = getInsertBaseName(firstIndex);
  const fLabel = `${insertBaseName}-F`;
  const rLabel = `${insertBaseName}-R`;
  const insertTitle = firstIns.name ? `Insert #${firstIndex} (${firstIns.name}, len: ${firstIns.length} bp)` : `Insert #${firstIndex} (len: ${firstIns.length} bp)`;
  
  const insFwdAnalysis = analyzePrimer(fLabel, firstIns.F.seq, firstIns.F.coreSeq, naConc, mgConc, primerConc);
  const insRevAnalysis = analyzePrimer(rLabel, firstIns.R.seq, firstIns.R.coreSeq, naConc, mgConc, primerConc);
  const insCrossDimer = qcPair(insFwdAnalysis, insRevAnalysis);
  
  const insFwdSeq = buildSeqCellWithU(firstIns.F.coreSeq, firstIns.F.seq, firstIns.F.overlapSeq);
  const insRevSeq = buildSeqCellWithU(firstIns.R.coreSeq, firstIns.R.seq, firstIns.R.overlapSeq);
  
  html += `
    <h3 style="margin-top: 24px;">${insertTitle}</h3>
    <table>
      <thead>
        <tr>
          <th>Primer</th>
          <th>Sequence (5′→3′)</th>
          <th style="text-align: center;">Len</th>
          <th style="text-align: center;">GC%</th>
          <th style="text-align: center;">Tm (core/full, °C)</th>
          <th style="text-align: center;">Homopolymer</th>
          <th style="text-align: center;">Hairpin</th>
          <th style="text-align: center;">Self-dimer</th>
          <th style="text-align: center;">Cross-dimer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${fLabel}</td>
          <td class="mono seqcell">${insFwdSeq.disp}</td>
          <td style="text-align: center;">${insFwdSeq.len}</td>
          <td style="text-align: center;">${insFwdSeq.gc.toFixed(1)}%</td>
          <td style="text-align: center;">${insFwdAnalysis.tmCore.toFixed(1)} / ${insFwdAnalysis.tmFull.toFixed(1)}</td>
          <td style="text-align: center;">${insFwdAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
          <td style="text-align: center;">${badge(insFwdAnalysis.hairpinClass.cls, insFwdAnalysis.hairpinClass.label)}</td>
          <td style="text-align: center;">${badge(insFwdAnalysis.selfDimerClass.cls, insFwdAnalysis.selfDimerClass.label)}</td>
          <td rowspan="2" style="vertical-align: middle; text-align: center;">
            ${insCrossDimer && insCrossDimer.info ? badge(insCrossDimer.info.cls, insCrossDimer.info.label) : badge('ok', 'None')}
          </td>
        </tr>
        <tr>
          <td>${rLabel}</td>
          <td class="mono seqcell">${insRevSeq.disp}</td>
          <td style="text-align: center;">${insRevSeq.len}</td>
          <td style="text-align: center;">${insRevSeq.gc.toFixed(1)}%</td>
          <td style="text-align: center;">${insRevAnalysis.tmCore.toFixed(1)} / ${insRevAnalysis.tmFull.toFixed(1)}</td>
          <td style="text-align: center;">${insRevAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
          <td style="text-align: center;">${badge(insRevAnalysis.hairpinClass.cls, insRevAnalysis.hairpinClass.label)}</td>
          <td style="text-align: center;">${badge(insRevAnalysis.selfDimerClass.cls, insRevAnalysis.selfDimerClass.label)}</td>
        </tr>
      </tbody>
    </table>
  `;
  
  // Render additional inserts (if any)
  if (inserts.length > 1) {
    inserts.slice(1).forEach((ins) => {
      const idx = ins.index || 1;
      const fL = `Insert${idx}-F`;
      const rL = `Insert${idx}-R`;
      const title = ins.name ? `Insert #${idx} (${ins.name}, len: ${ins.length} bp)` : `Insert #${idx} (len: ${ins.length} bp)`;
      
      const fa = analyzePrimer(fL, ins.F.seq, ins.F.coreSeq, naConc, mgConc, primerConc);
      const ra = analyzePrimer(rL, ins.R.seq, ins.R.coreSeq, naConc, mgConc, primerConc);
      const cd = qcPair(fa, ra);
      
      const fSeq = buildSeqCellWithU(ins.F.coreSeq, ins.F.seq, ins.F.overlapSeq);
      const rSeq = buildSeqCellWithU(ins.R.coreSeq, ins.R.seq, ins.R.overlapSeq);
      
      html += `
        <h3 style="margin-top: 24px;">${title}</h3>
        <table>
          <thead>
            <tr>
              <th>Primer</th>
              <th>Sequence (5′→3′)</th>
              <th style="text-align: center;">Len</th>
              <th style="text-align: center;">GC%</th>
              <th style="text-align: center;">Tm (core/full, °C)</th>
              <th style="text-align: center;">Homopolymer</th>
              <th style="text-align: center;">Hairpin</th>
              <th style="text-align: center;">Self-dimer</th>
              <th style="text-align: center;">Cross-dimer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${fL}</td>
              <td class="mono seqcell">${fSeq.disp}</td>
              <td style="text-align: center;">${fSeq.len}</td>
              <td style="text-align: center;">${fSeq.gc.toFixed(1)}%</td>
              <td style="text-align: center;">${fa.tmCore.toFixed(1)} / ${fa.tmFull.toFixed(1)}</td>
              <td style="text-align: center;">${fa.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
              <td style="text-align: center;">${badge(fa.hairpinClass.cls, fa.hairpinClass.label)}</td>
              <td style="text-align: center;">${badge(fa.selfDimerClass.cls, fa.selfDimerClass.label)}</td>
              <td rowspan="2" style="vertical-align: middle; text-align: center;">
                ${cd && cd.info ? badge(cd.info.cls, cd.info.label) : badge('ok', 'None')}
              </td>
            </tr>
            <tr>
              <td>${rL}</td>
              <td class="mono seqcell">${rSeq.disp}</td>
              <td style="text-align: center;">${rSeq.len}</td>
              <td style="text-align: center;">${rSeq.gc.toFixed(1)}%</td>
              <td style="text-align: center;">${ra.tmCore.toFixed(1)} / ${ra.tmFull.toFixed(1)}</td>
              <td style="text-align: center;">${ra.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
              <td style="text-align: center;">${badge(ra.hairpinClass.cls, ra.hairpinClass.label)}</td>
              <td style="text-align: center;">${badge(ra.selfDimerClass.cls, ra.selfDimerClass.label)}</td>
            </tr>
          </tbody>
        </table>
      `;
    });
  }
  
  return html;
}

function buildSeqCellWithU(seqCore, fullSeq, overhangSeq) {
  const len = fullSeq.length;
  const gc = Core.gcPct(Core.normalizeSeq(fullSeq));
  
  const oh = overhangSeq || '';
  let disp = '';
  
  if (!oh) {
    // No overlap, just display the full sequence with U highlighting
    disp = highlightUracil(fullSeq);
  } else {
    // Check if overlap is at the start of full sequence
    const ohNorm = Core.normalizeSeq(oh);
    const ohRC = Core.reverseComplementSeq(ohNorm);
    const fullNorm = Core.normalizeSeq(fullSeq);
    
    if (fullNorm.startsWith(ohNorm)) {
      // Forward primer: overlap is at the start
      const corePart = fullSeq.slice(oh.length);
      disp = '<b style="color: #000; font-weight: bold;">' + highlightUracil(oh) + '</b>' + highlightUracil(corePart);
    } else if (fullNorm.startsWith(ohRC)) {
      // Reverse primer: reverse complement of overlap is at the start
      const corePart = fullSeq.slice(oh.length);
      disp = '<b style="color: #000; font-weight: bold;">' + highlightUracil(oh) + '</b>' + highlightUracil(corePart);
    } else {
      // Try to find overlap in the sequence
      const ohIdx = fullNorm.indexOf(ohNorm);
      const ohRCIdx = fullNorm.indexOf(ohRC);
      
      if (ohIdx >= 0) {
        const before = fullSeq.slice(0, ohIdx);
        const after = fullSeq.slice(ohIdx + oh.length);
        disp = highlightUracil(before) + '<b style="color: #000; font-weight: bold;">' + highlightUracil(oh) + '</b>' + highlightUracil(after);
      } else if (ohRCIdx >= 0) {
        const before = fullSeq.slice(0, ohRCIdx);
        const after = fullSeq.slice(ohRCIdx + oh.length);
        disp = highlightUracil(before) + '<b style="color: #000; font-weight: bold;">' + highlightUracil(oh) + '</b>' + highlightUracil(after);
      } else {
        // Overlap not found, just display full sequence
        disp = highlightUracil(fullSeq);
      }
    }
  }
  
  return { disp, len, gc };
}

function renderOverlapTable(results, naConc, mgConc, primerConc) {
  const PAL = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#FFEB06'];
  
  // Helper function to convert U to T for display
  function uToT(seq) {
    return seq.replace(/U/gi, 'T');
  }
  
  let html = '<table><thead><tr><th>Junction</th><th>Overlap (5′→3′, vector direction)</th><th>Len</th><th>GC%</th><th>Tm (°C)</th></tr></thead><tbody>';
  
  let colorIdx = 0;

  // Multi-insert: render all junction overlaps (computed in design step)
  if (results.overlap && Array.isArray(results.overlap.junctions) && results.overlap.junctions.length > 0) {
    results.overlap.junctions.forEach((j) => {
      const color = PAL[colorIdx % PAL.length];
      colorIdx++;
      const seq = uToT(j.overlapSeq || '');
      const tm = Core.tmcalNN(Core.normalizeSeq(seq), naConc, mgConc, primerConc);
      const gc = Core.gcPct(Core.normalizeSeq(seq));
      html += `
        <tr>
          <td><span class="oh-chip"><span class="swatch" style="background:${color}"></span>${j.label || ''}</span></td>
          <td class="oh-seq mono">${seq}</td>
          <td style="text-align: center;">${j.len || seq.length}</td>
          <td style="text-align: center;">${isFinite(gc) ? gc.toFixed(1) : 'NA'}%</td>
          <td style="text-align: center;">${isFinite(tm) ? tm.toFixed(1) : 'NA'}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    return html;
  }
  
  // Left overlap - RC backboneSeq to get vector 5'-3' direction, convert U to T
  const leftOverlap = results.overlap.leftOverlap;
  const leftColor = PAL[colorIdx % PAL.length];
  colorIdx++;
  
  // RC backboneSeq to get vector 5'-3' direction (F_vec primer's overlap is in primer direction, need RC for vector direction)
  const leftOverlapSeqVector = Core.reverseComplementSeq(leftOverlap.backboneSeq);
  const leftOverlapSeq = uToT(leftOverlapSeqVector);
  const leftTm = Core.tmcalNN(Core.normalizeSeq(leftOverlapSeqVector), naConc, mgConc, primerConc);
  const leftGc = Core.gcPct(Core.normalizeSeq(leftOverlapSeqVector));
  
  html += `
    <tr>
      <td><span class="oh-chip"><span class="swatch" style="background:${leftColor}"></span>Left</span></td>
      <td class="oh-seq mono">${leftOverlapSeq}</td>
      <td style="text-align: center;">${leftOverlap.len}</td>
      <td style="text-align: center;">${leftGc.toFixed(1)}%</td>
      <td style="text-align: center;">${isFinite(leftTm) ? leftTm.toFixed(1) : 'NA'}</td>
    </tr>
  `;
  
  // Right overlap - use backboneSeq (vector 5'-3' direction), convert U to T
  const rightOverlap = results.overlap.rightOverlap;
  const rightColor = PAL[colorIdx % PAL.length];
  
  // Use backboneSeq which is already in vector 5'-3' direction
  const rightOverlapSeq = uToT(rightOverlap.backboneSeq);
  const rightTm = Core.tmcalNN(Core.normalizeSeq(rightOverlap.backboneSeq), naConc, mgConc, primerConc);
  const rightGc = Core.gcPct(Core.normalizeSeq(rightOverlap.backboneSeq));
  
  html += `
    <tr>
      <td><span class="oh-chip"><span class="swatch" style="background:${rightColor}"></span>Right</span></td>
      <td class="oh-seq mono">${rightOverlapSeq}</td>
      <td style="text-align: center;">${rightOverlap.len}</td>
      <td style="text-align: center;">${rightGc.toFixed(1)}%</td>
      <td style="text-align: center;">${isFinite(rightTm) ? rightTm.toFixed(1) : 'NA'}</td>
    </tr>
  `;
  
  html += '</tbody></table>';
  return html;
}

function getSimpleQCLabel(dg, touches3) {
  if (!isFinite(dg)) return { label: "None", cls: "ok" };
  
  let label, cls;
  if (dg <= -7) {
    label = "Very Strong";
    cls = "bad";
  } else if (dg <= -5) {
    label = "Strong";
    cls = "bad";
  } else if (dg <= -3) {
    label = "Medium";
    cls = "warn";
  } else {
    label = "Weak";
    cls = "ok";
  }
  
  if (touches3 && cls !== "ok") {
    label = "3' " + label;
  }
  
  return { label, cls };
}

function analyzePrimer(label, fullSeq, coreSeq, naConc, mgConc, primerConc) {
  // Normalize sequences (replace U with T for calculations)
  const seq = Core.normalizeSeq(fullSeq);
  const core = Core.normalizeSeq(coreSeq || fullSeq);
  
  if (!seq || !core) {
    return { label, empty: true };
  }

  const lenCore = core.length;
  const gcCore = Core.gcPct(core);
  const tmCore = Core.tmcalNN(core, naConc, mgConc, primerConc);
  const tmFull = Core.tmcalNN(seq, naConc, mgConc, primerConc);
  
  // Check homopolymer (≥4 repeats)
  const homopoly = hasHomopolymer(seq, 4);
  
  // Check 3' end stability
  const dg3 = Core.threePrimeDG(seq);
  const dg3Bad = isFinite(dg3) && dg3 <= -3;
  
  // Self-dimer
  const selfDimer = Core.selfDimerScan(seq);
  const selfDimerClass = getSimpleQCLabel(selfDimer ? selfDimer.dG : NaN, selfDimer ? selfDimer.touches3 : false);
  
  // Hairpin
  const hairpin = Core.hairpinScan(seq);
  const hairpinClass = getSimpleQCLabel(hairpin ? hairpin.dG : NaN, hairpin ? hairpin.touches3 : false);

  return {
    label,
    seq,
    core,
    lenCore,
    gcCore,
    tmCore,
    tmFull,
    homopoly,
    dg3,
    dg3Bad,
    selfDimer,
    selfDimerClass,
    hairpin,
    hairpinClass,
    empty: false
  };
}

function qcPair(fwdAnalysis, revAnalysis) {
  if (!fwdAnalysis || !revAnalysis || fwdAnalysis.empty || revAnalysis.empty) {
    return null;
  }
  const dimer = Core.dimerScan(fwdAnalysis.seq, revAnalysis.seq);
  const info = getSimpleQCLabel(dimer ? dimer.dG : NaN, dimer ? dimer.touches3 : false);
  return { dimer, info };
}

function hasHomopolymer(seq, n) {
  return new RegExp(`A{${n},}|C{${n},}|G{${n},}|T{${n},}`).test(seq.toUpperCase());
}

function badge(cls, txt) {
  // Map old class names to new qc-badge classes
  const classMap = {
    'ok': 'qc-ok',
    'warn': 'qc-warn',
    'bad': 'qc-bad',
    'weak': 'qc-weak'
  };
  const qcClass = classMap[cls] || cls;
  return `<span class="qc-badge ${qcClass}">${txt}</span>`;
}

// ==================== Event Handlers ====================

function initVectorUpload() {
  $('vector-upload-btn').addEventListener('click', () => {
    $('vector-file').click();
  });
  $('vector-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      $('vector-seq').value = event.target.result;
      updateVectorPreview();
    };
    reader.readAsText(file);
  });
  
  $('vector-flip-btn').addEventListener('click', () => {
    const textarea = $('vector-seq');
    if (!textarea) return;
    if (!textarea.value.trim()) {
      showWarning('Vector sequence is empty.');
      return;
    }
    applyRCToTextarea(textarea);
    updateVectorPreview();
  });

  // Vector demo button: load pESC-His.txt
  const vectorDemoBtn = $('vector-demo-btn');
  if (vectorDemoBtn) {
    vectorDemoBtn.addEventListener('click', async () => {
      const textarea = $('vector-seq');
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
      } catch (e) {
        console.error('Vector demo load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  $('vector-seq').addEventListener('input', () => {
    if (vectorPreviewTimer) clearTimeout(vectorPreviewTimer);
    vectorPreviewTimer = setTimeout(() => {
      updateVectorPreview();
    }, 300);
  });
  
  const rotationSlider = $('vector-map-rotation');
  if (rotationSlider) {
    rotationSlider.addEventListener('input', () => {
      // Update rotation label
      const rotLabel = $('vector-map-rot-label');
      if (rotLabel) {
        rotLabel.textContent = rotationSlider.value + '°';
      }
      updateVectorPreview();
    });
  }
}

function initUserDemoSetButton() {
  const demoSetBtn = $('user-demo-set');
  if (!demoSetBtn) return;

  demoSetBtn.addEventListener('click', async () => {
    const prevText = demoSetBtn.textContent;
    demoSetBtn.disabled = true;
    demoSetBtn.textContent = 'Loading...';
    try {
      const base = new URL('modules/contents/demo/', window.location.href).toString();
      const [vectorResp, insertResp] = await Promise.all([
        fetch(base + 'pESC-His.txt'),
        fetch(base + 'Insert_1.txt')
      ]);

      if (!vectorResp.ok || !insertResp.ok) {
        showWarning('Failed to load demo sequences.');
        return;
      }

      const vectorText = await vectorResp.text();
      const insertText = await insertResp.text();

      const vectorTextarea = $('vector-seq');
      if (vectorTextarea) {
        vectorTextarea.value = vectorText;
        updateVectorPreview();
      }

      const firstInsertRow = document.querySelector('#inserts-container .insert-row');
      const firstInsertTextarea = firstInsertRow ? firstInsertRow.querySelector('.insert-seq') : null;
      if (firstInsertTextarea) {
        firstInsertTextarea.value = insertText;
      }

      const pcrForward = $('pcr-forward');
      if (pcrForward) pcrForward.value = 'AGTCGACAUGGAACAGAAGTTGATTTCCGAAGAAG';
      const pcrReverse = $('pcr-reverse');
      if (pcrReverse) pcrReverse.value = 'AGGATCCGGGGTUTTTTCTCCTTGACGTTAAAGTATAGAGG';

      // Refresh PCR product dropdown immediately (otherwise it only updates on "Design")
      const f = (pcrForward && pcrForward.value || '').trim();
      const r = (pcrReverse && pcrReverse.value || '').trim();
      updatePCRFragments(f, r);
      const backboneSelectU = $('backbone-select-u');
      if (backboneSelectU && backboneSelectU.options && backboneSelectU.options.length) {
        backboneSelectU.selectedIndex = 0;
        backboneSelectU.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {
      console.error('USER Demo Set load error:', e);
      showWarning('Failed to load demo sequences.');
    } finally {
      demoSetBtn.disabled = false;
      demoSetBtn.textContent = prevText;
    }
  });
}

// Insert management (similar to Gibson, but max 3 inserts, no linker/host)
let insertCount = 1;

function initInsertUpload() {
  // Add insert button
  const addInsertBtn = $('add-insert-btn');
  if (addInsertBtn) {
    addInsertBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      if (!container) return;
      const currentRows = container.querySelectorAll('.insert-row');
      
      if (currentRows.length >= 3) {
        showWarning('Maximum 3 inserts allowed.');
        return;
      }
      
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
              <button class="btn demo xs insert-flip-btn" type="button">Reverse complement</button>
              <button class="btn demo xs insert-demo-btn" type="button">Demo</button>
              <button class="ghost btn xs insert-upload-btn" type="button">Upload</button>
            </div>
          </div>
        </div>
        <div></div>
        <div class="insert-controls" style="width: 100%;">
          <button class="ghost btn sm insert-move-up-btn" type="button" title="Move up" style="width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">▲</button>
          <button class="ghost btn sm insert-move-down-btn" type="button" title="Move down" style="width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">▼</button>
          <button class="ghost btn sm remove-insert-btn" type="button" title="Delete" style="display: none; width: 100%; min-width: 32px; padding: 5px 8px; text-align: center;">✕</button>
        </div>
      `;
      container.appendChild(newRow);
      setupInsertRowListeners(newRow);
      updateInsertControls();
      updateAddInsertButton();
    });
  }
  
  // Setup listeners for existing rows
  const container = $('inserts-container');
  if (container) {
    container.querySelectorAll('.insert-row').forEach(row => {
      setupInsertRowListeners(row);
    });
  }
  
  // Flip order button
  const flipOrderBtn = $('flip-order-btn');
  if (flipOrderBtn) {
    flipOrderBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      if (!container) return;
      const rows = Array.from(container.querySelectorAll('.insert-row'));
      if (rows.length < 2) return;
      rows.reverse().forEach(row => container.appendChild(row));
      updateInsertNumbers();
      updateInsertControls();
    });
  }
}

// Setup event listeners for an insert row
function setupInsertRowListeners(row) {
  // Upload button
  const uploadBtn = row.querySelector('.insert-upload-btn');
  const fileInput = row.querySelector('.insert-file');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const textarea = row.querySelector('.insert-seq');
        if (textarea) textarea.value = event.target.result;
      };
      reader.readAsText(file);
    });
  }
  
  // Flip (rc) button
  const flipBtn = row.querySelector('.insert-flip-btn');
  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      const textarea = row.querySelector('.insert-seq');
      if (textarea) {
        applyRCToTextarea(textarea);
      }
    });
  }
  
  // Demo button: load Insert_1.txt to Insert_3.txt
  const demoBtn = row.querySelector('.insert-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      const labelText = row.querySelector('.insert-label')?.textContent || '';
      const insertNum = parseInt(labelText.match(/\d+/)?.[0]) || 1;
      const textarea = row.querySelector('.insert-seq');
      if (!textarea) return;
      
      // Limit to 3 inserts
      if (insertNum > 3) {
        alert('Demo only provides 3 inserts.');
        return;
      }
      
      try {
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        const resp = await fetch(base + `Insert_${insertNum}.txt`);
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
  
  // Move up button
  const moveUpBtn = row.querySelector('.insert-move-up-btn');
  if (moveUpBtn) {
    moveUpBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      if (!container) return;
      const rows = Array.from(container.querySelectorAll('.insert-row'));
      const currentIndex = rows.indexOf(row);
      if (currentIndex > 0) {
        container.insertBefore(row, rows[currentIndex - 1]);
        updateInsertNumbers();
        updateInsertControls();
      }
    });
  }
  
  // Move down button
  const moveDownBtn = row.querySelector('.insert-move-down-btn');
  if (moveDownBtn) {
    moveDownBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      if (!container) return;
      const rows = Array.from(container.querySelectorAll('.insert-row'));
      const currentIndex = rows.indexOf(row);
      if (currentIndex < rows.length - 1) {
        container.insertBefore(row, rows[currentIndex + 1].nextSibling);
        updateInsertNumbers();
        updateInsertControls();
      }
    });
  }
  
  // Remove button
  const removeBtn = row.querySelector('.remove-insert-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      row.remove();
      updateInsertNumbers();
      updateInsertControls();
      updateAddInsertButton();
    });
  }
}

// Update insert numbers
function updateInsertNumbers() {
  const container = $('inserts-container');
  if (!container) return;
  const rows = container.querySelectorAll('.insert-row');
  rows.forEach((row, idx) => {
    const label = row.querySelector('.insert-label');
    if (label) label.textContent = `Insert #${idx + 1}:`;
    row.setAttribute('data-index', idx);
  });
  insertCount = rows.length;
}

// Update insert controls (show/hide delete buttons)
function updateInsertControls() {
  const container = $('inserts-container');
  if (!container) return;
  const rows = container.querySelectorAll('.insert-row');
  rows.forEach((row) => {
    const delBtn = row.querySelector('.remove-insert-btn');
    if (delBtn) {
      delBtn.style.display = rows.length > 1 ? 'block' : 'none';
    }
  });
}

// Update add insert button (disable if max reached)
function updateAddInsertButton() {
  const addBtn = $('add-insert-btn');
  if (!addBtn) return;
  const container = $('inserts-container');
  if (!container) return;
  const currentRows = container.querySelectorAll('.insert-row');
  if (currentRows.length >= 3) {
    addBtn.disabled = true;
    addBtn.style.opacity = '0.5';
  } else {
    addBtn.disabled = false;
    addBtn.style.opacity = '1';
  }
}

// Helper function to get all insert sequences
function getAllInsertSeqs() {
  const container = $('inserts-container');
  if (!container) return [];
  const insertRows = container.querySelectorAll('.insert-row');
  const insertSeqs = [];
  insertRows.forEach(row => {
    const textarea = row.querySelector('.insert-seq');
    if (textarea && textarea.value.trim()) {
      insertSeqs.push(textarea.value.trim());
    }
  });
  return insertSeqs;
}

// Helper function to get combined insert sequence (for backward compatibility)
function getCombinedInsertSeq() {
  const insertSeqs = getAllInsertSeqs();
  return insertSeqs.length > 0 ? insertSeqs.join('\n\n') : '';
}

// Helper function to check if primer contains U
function hasU(primer) {
  if (!primer) return false;
  return primer.toUpperCase().indexOf('U') !== -1;
}

function validateUPrimerPattern(primer, opts = {}) {
  const cleaned = String(primer || '').toUpperCase().replace(/\s+/g, '');
  const uPos = cleaned.lastIndexOf('U');
  if (uPos === -1) {
    return { ok: false, reason: 'No U base found in primer' };
  }
  const prefix = cleaned.slice(0, uPos);
  const core = cleaned.slice(uPos + 1);
  if (!prefix || !core) {
    return { ok: false, reason: 'Primer must be 5\' overlap-U-core 3\'' };
  }
  // Enforce 5' A N{6-13} U 3' rule: first base must be A, overlap length 6-13
  if (prefix[0] !== 'A') {
    return { ok: false, reason: 'Overlap must start with A (5\' A...)' };
  }
  if (prefix.length < 6 || prefix.length > 13) {
    return { ok: false, reason: 'Overlap length must be between 6 and 13 bp before U' };
  }
  // Basic nucleotide check around U (prefix last base and core first base) must be DNA IUPAC
  const preBase = prefix.slice(-1);
  const coreBase = core[0];
  const validDNA = /^[ACGTRYSWKMBDHVN]$/;
  if (!validDNA.test(preBase) || !validDNA.test(coreBase)) {
    return { ok: false, reason: 'Invalid bases adjacent to U (should be DNA IUPAC)' };
  }
  return { ok: true };
}

// Function to update PCR fragments dropdown (aligned with Gibson's updateFragmentsInfo)
function updatePCRFragments(pcrForward, pcrReverse) {
  const pcrFragmentsInfo = $('pcr-fragments-info');
  if (!pcrFragmentsInfo) return;
  
  const vectorText = $('vector-seq').value.trim();
  const backboneSelectU = $('backbone-select-u');
  const pcrFragmentsSummary = $('pcr-fragments-summary');
  
  if (!vectorText || !pcrForward || !pcrReverse) {
    if (backboneSelectU) {
      backboneSelectU.innerHTML = '<option value="">Please enter vector sequence and PCR primers first</option>';
    }
    if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'none';
    window.currentPCRFragments = null;
    return;
  }
  
  try {
    const vectorSeq = cleanDNA(vectorText);
    if (!vectorSeq) {
      if (backboneSelectU) {
        backboneSelectU.innerHTML = '<option value="">Invalid vector sequence</option>';
      }
      if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'none';
      window.currentPCRFragments = null;
      return;
    }
    
    let pcrFInfo = parsePrimerWithU(pcrForward, {});
    let pcrRInfo = parsePrimerWithU(pcrReverse, {});
    
    if (!pcrFInfo || !pcrRInfo) {
      if (backboneSelectU) {
        backboneSelectU.innerHTML = '<option value="">Primer format error</option>';
      }
      if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'none';
      window.currentPCRFragments = null;
      return;
    }
    
    // Use 3' end matching with core sequences (aligned with Gibson)
    const L = vectorSeq.length;
    const minLen = 15; // Minimum 3' match length
    const maxLen = 25; // Maximum scan length
    
    // Find 3' end hits using continuous matching on core sequences
    let fHits = findForward3primeHits(pcrFInfo.coreNormalized, vectorSeq, minLen, maxLen);
    let rHits = findReverse3primeHits(pcrRInfo.coreNormalized, vectorSeq, minLen, maxLen);
    
    // Auto-detect RC / swap primers fallback
    let primersSwapped = false;
    let actualPcrForward = pcrForward;
    let actualPcrReverse = pcrReverse;
    
    if (!fHits.length || !rHits.length) {
      // Try swapped primers
      const fHitsSwapped = findForward3primeHits(pcrRInfo.coreNormalized, vectorSeq, minLen, maxLen);
      const rHitsSwapped = findReverse3primeHits(pcrFInfo.coreNormalized, vectorSeq, minLen, maxLen);
      
      if (fHitsSwapped.length > 0 && rHitsSwapped.length > 0) {
        // Swap primers
        const temp = pcrFInfo;
        pcrFInfo = pcrRInfo;
        pcrRInfo = temp;
        fHits = fHitsSwapped;
        rHits = rHitsSwapped;
        actualPcrForward = pcrReverse;
        actualPcrReverse = pcrForward;
        primersSwapped = true;
      }
    }
    
    if (!fHits.length || !rHits.length) {
      if (backboneSelectU) {
        backboneSelectU.innerHTML = '<option value="">Primers not found in sequence</option>';
      }
      if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'none';
      window.currentPCRFragments = null;
      return;
    }
    
    // Select best hit pair (highest combined match score)
    let bestFHit = null;
    let bestRHit = null;
    let bestScore = -Infinity;
    
    for (const fh of fHits) {
      for (const rh of rHits) {
        const f3 = fh.f3;
        const r3 = rh.r3;
        const templateLen = Core.distPlus(L, f3, r3) + 1;
        if (templateLen <= 0 || templateLen > L) continue;
        
        const score = (fh.m + rh.m) * 1000000 - templateLen;
        if (score > bestScore) {
          bestScore = score;
          bestFHit = fh;
          bestRHit = rh;
        }
      }
    }
    
    if (!bestFHit || !bestRHit) {
      if (backboneSelectU) {
        backboneSelectU.innerHTML = '<option value="">No valid PCR product found</option>';
      }
      if (pcrFragmentsSummary) pcrFragmentsSummary.textContent = '';
      window.currentPCRFragments = null;
      return;
    }
    
    const f3 = bestFHit.f3;
    const r3 = bestRHit.r3;
    const revRC = bestRHit.revRC;
    
    // Calculate template sequence (f3+1→r3-1) excluding endpoints to avoid duplication
    const f3Next = (f3 + 1) % L;
    let templateSeq = '';
    if (f3Next !== r3) {
      const tempSeq = Core.pcrProductSeq(vectorSeq, f3Next, r3);
      templateSeq = tempSeq.slice(0, -1); // Remove last base (r3 position)
    }
    
    // Calculate full PCR product: forward primer + template + reverse primer RC
    // Aligned with Gibson: use normIUPAC to normalize primers (U will be removed for PCR product calculation)
    const pcrF = normIUPAC(actualPcrForward);
    const pcrR = normIUPAC(actualPcrReverse);
    const pcrRRC = revCompIUPAC(pcrR);
    const pcrProduct = pcrF + templateSeq + pcrRRC;
    
    // Create fragment object for dropdown
    const fragments = [{
      start: 0,
      end: pcrProduct.length,
      length: pcrProduct.length,
      seq: pcrProduct,
      f3: f3,
      r3: r3,
      templateSeq: templateSeq,
      primersSwapped: primersSwapped
    }];
    
    // Find longest fragment index (for consistency, though we only have one)
    const longestIdx = 0;
    
    // Populate dropdown
    if (backboneSelectU) {
      backboneSelectU.innerHTML = '';
      fragments.forEach((frag, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `Product ${idx + 1}: ${frag.length} bp${idx === longestIdx ? ' (Longest)' : ''}`;
        if (idx === longestIdx) {
          option.selected = true;
        }
        backboneSelectU.appendChild(option);
      });
    }
    
    // Store fragments for later use (include amplicon info for compatibility)
    window.currentPCRFragments = fragments.map(frag => ({
      ...frag,
      amplicon: {
        fwdPos: frag.f3,
        revPos: frag.r3,
        length: frag.length
      }
    }));
    
    // Display summary
    if (pcrFragmentsSummary) {
      pcrFragmentsSummary.textContent = `(${fragments.length} product(s) generated)`;
    }
    
    if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'block';
    
  } catch (error) {
    console.error('Error updating PCR products:', error);
    const backboneSelectU = $('backbone-select-u');
    if (backboneSelectU) {
      backboneSelectU.innerHTML = '<option value="">Update failed</option>';
    }
    if (pcrFragmentsInfo) pcrFragmentsInfo.style.display = 'none';
    window.currentPCRFragments = null;
  }
}

function showConfirmModal(message, onConfirm, onCancel) {
  const modal = $('warning-modal');
  const messageEl = $('warning-message');
  const okBtn = $('warning-ok-btn');
  
  if (!modal || !messageEl || !okBtn) {
    if (onConfirm) onConfirm();
    return;
  }
  
  messageEl.textContent = message;
  modal.style.display = 'flex';
  
  // Remove existing listeners
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  newOkBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  const overlay = modal.querySelector('.warning-modal-overlay');
  if (overlay) {
    overlay.onclick = () => {
      closeModal();
      if (onCancel) onCancel();
    };
  }
  
  const handleEscape = (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function initDesignButton() {
  $('design-btn').addEventListener('click', () => {
    const container = document.getElementById('module-content') || document.body;
    const seqEls = [
      $('vector-seq'),
      ...Array.from(document.querySelectorAll('#inserts-container .insert-seq'))
    ];

    const doDesign = () => {
      try {
      const vectorSeq = $('vector-seq').value;
      const insertSeq = getCombinedInsertSeq();
      
      if (!vectorSeq || !insertSeq) {
        showWarning('Please enter vector and at least one insert sequence');
        return;
      }
      
      const pcrForward = $('pcr-forward').value.trim();
      const pcrReverse = $('pcr-reverse').value.trim();
      
      if (!pcrForward || !pcrReverse) {
        showWarning('Please enter PCR forward and reverse primers for vector linearization');
        return;
      }
      
      // Detect U in primers
      const forwardHasU = hasU(pcrForward);
      const reverseHasU = hasU(pcrReverse);
      
      const opts = {
        targetTm: parseFloat($('target-tm').value) || 60,
        overlapTm: parseFloat($('overlap-tm').value) || 50,
        overlapLen: parseInt($('overlap-len').value) || 9,
        conc_nM: parseInt($('primer-conc').value) || 500,
        na_mM: parseInt($('na-conc').value) || 50,
        mg_mM: parseFloat($('mg-conc').value) || 0
      };
      
      const warnings = [];
      const container = $('module-content') || document.body;
      const insertSeqsRaw = getAllInsertSeqs();
      const vectorLabel = extractFASTAHeader(vectorSeq) || 'Vector';
      const vectorBody = stripFASTAHeaders(vectorSeq);
      if (vectorBody && VIZ && VIZ.validateSequenceInput) {
        warnings.push(...VIZ.validateSequenceInput([{ label: vectorLabel, seq: vectorBody }], 'Vector'));
      }
      if (insertSeqsRaw && insertSeqsRaw.length && VIZ && VIZ.validateSequenceInput) {
        const insertItems = insertSeqsRaw.map((raw, i) => ({ label: extractFASTAHeader(raw) || `Insert ${i + 1}`, seq: stripFASTAHeaders(raw) }));
        warnings.push(...VIZ.validateSequenceInput(insertItems, 'Insert'));
      }
      // Do not run Non-IUPAC MW for USER primers with U; keep dedicated USER warnings below
      if (VIZ && VIZ.validateParameterRange) {
        warnings.push(...VIZ.validateParameterRange({ Na: opts.na_mM, Mg: opts.mg_mM, conc: opts.conc_nM, targetTm: opts.targetTm }));
      }
      
      const proceed = () => {
        if (forwardHasU && reverseHasU) {
          const fCheck = validateUPrimerPattern(pcrForward, { overlapLen: opts.overlapLen });
          const rCheck = validateUPrimerPattern(pcrReverse, { overlapLen: opts.overlapLen });
          if (!fCheck.ok || !rCheck.ok) {
            const msg = 'USER Primer format error:\n' +
              (!fCheck.ok ? `Forward: ${fCheck.reason}\n` : '') +
              (!rCheck.ok ? `Reverse: ${rCheck.reason}\n` : '') +
              '\nPrimers must follow 5\' A N{6-13} U core 3\' rule.\n' +
              'Return or Cancel to modify primers.';
            if (VIZ && VIZ.showMWModal) {
              VIZ.showMWModal(container, msg, () => {}, () => {});
              const modal = document.getElementById('mw-modal');
              if (modal) {
                const confirmBtn = modal.querySelector('#mw-confirm-btn');
                const cancelBtn = modal.querySelector('#mw-cancel-btn');
                if (confirmBtn) confirmBtn.textContent = 'Return';
                if (cancelBtn) cancelBtn.textContent = 'Cancel';
              }
            } else {
              showWarning(msg);
            }
            return;
          }
          updatePCRFragments(pcrForward, pcrReverse);
          const backboneSelectU = $('backbone-select-u');
          const selectedFragmentIdx = backboneSelectU ? parseInt(backboneSelectU.value) : null;
          const results = designUSERPrimersWithU(vectorSeq, insertSeq, pcrForward, pcrReverse, opts, selectedFragmentIdx);
          displayResults(results);
          return;
        }
        
        if (forwardHasU || reverseHasU) {
          showConfirmModal(
            'Warning: One primer contains U while the other does not.\n\n' +
            'Please provide either:\n' +
            '1. Both primers with U bases (for USER cloning), or\n' +
            '2. Both primers without U bases (for standard cloning).\n\n' +
            'Click OK to continue with current primers (may cause errors).',
            () => {
              try {
                if (forwardHasU && reverseHasU) {
                  updatePCRFragments(pcrForward, pcrReverse);
                  const backboneSelectU = $('backbone-select-u');
                  const selectedFragmentIdx = backboneSelectU ? parseInt(backboneSelectU.value) : null;
                  const results = designUSERPrimersWithU(vectorSeq, insertSeq, pcrForward, pcrReverse, opts, selectedFragmentIdx);
                  displayResults(results);
                } else {
                  showWarning('Cannot proceed: primers must both contain U or both not contain U');
                }
              } catch (error) {
                console.error('Design failed:', error);
                showError('Design failed: ' + error.message);
              }
            },
            () => {}
          );
          return;
        }
        
        showConfirmModal(
          'Warning: Neither primer contains U bases.\n\n' +
          'USER Cloning requires U bases in primers for USER enzyme cleavage.\n' +
          'If you proceed, the design will use standard cloning logic (not USER cloning).\n\n' +
          'Click OK to continue with non-U primers, or Cancel to modify your primers.',
          () => {
            try {
              const results = designUSERPrimers(vectorSeq, insertSeq, pcrForward, pcrReverse, opts);
              displayResults(results);
            } catch (error) {
              console.error('Design failed:', error);
              showError('Design failed: ' + error.message);
            }
          },
          () => {}
        );
      };
      
      if (warnings.length && VIZ && VIZ.showMWWarnings) {
        VIZ.showMWWarnings(container, warnings, proceed, () => {});
        return;
      }
      
      // Case 1: Both primers have U - use U-containing design automatically
      if (forwardHasU && reverseHasU) {
        // Update PCR fragments dropdown
        updatePCRFragments(pcrForward, pcrReverse);
        
        const backboneSelectU = $('backbone-select-u');
        const selectedFragmentIdx = backboneSelectU ? parseInt(backboneSelectU.value) : null;
        const results = designUSERPrimersWithU(vectorSeq, insertSeq, pcrForward, pcrReverse, opts, selectedFragmentIdx);
        displayResults(results);
        return;
      }
      
      // Case 2: One primer has U, one doesn't - show warning
      if (forwardHasU || reverseHasU) {
        showConfirmModal(
          'Warning: One primer contains U while the other does not.\n\n' +
          'Please provide either:\n' +
          '1. Both primers with U bases (for USER cloning), or\n' +
          '2. Both primers without U bases (for standard cloning).\n\n' +
          'Click OK to continue with current primers (may cause errors).',
          () => {
            // User confirmed, try to proceed (will likely fail)
            try {
              if (forwardHasU && reverseHasU) {
                updatePCRFragments(pcrForward, pcrReverse);
                const backboneSelectU = $('backbone-select-u');
                const selectedFragmentIdx = backboneSelectU ? parseInt(backboneSelectU.value) : null;
                const results = designUSERPrimersWithU(vectorSeq, insertSeq, pcrForward, pcrReverse, opts, selectedFragmentIdx);
                displayResults(results);
              } else {
                showWarning('Cannot proceed: primers must both contain U or both not contain U');
              }
            } catch (error) {
              console.error('Design failed:', error);
              showError('Design failed: ' + error.message);
            }
          },
          () => {
            // User cancelled
          }
        );
        return;
      }
      
      // Case 3: Neither primer has U - show warning and ask for confirmation
      showConfirmModal(
        'Warning: Neither primer contains U bases.\n\n' +
        'USER Cloning requires U bases in primers for USER enzyme cleavage.\n' +
        'If you proceed, the design will use standard cloning logic (not USER cloning).\n\n' +
        'Click OK to continue with non-U primers, or Cancel to modify your primers.',
        () => {
          // User confirmed - proceed with non-U design
          try {
            const results = designUSERPrimers(vectorSeq, insertSeq, pcrForward, pcrReverse, opts);
            displayResults(results);
          } catch (error) {
            console.error('Design failed:', error);
            showError('Design failed: ' + error.message);
          }
        },
        () => {
          // User cancelled
        }
      );
      
      } catch (error) {
        console.error('Design failed:', error);
        showError('Design failed: ' + error.message);
      }
    };

    if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
      const shown = VIZ.guardSingleFastaPerField(container, seqEls, doDesign);
      if (shown) return;
    }

    doDesign();
  });
}

function initDownloadButton() {
  $('download-btn').addEventListener('click', () => {
    const downloadType = $('download-type').value;
    
    if (downloadType === 'primers') {
      downloadPrimersTXT();
    } else if (downloadType === 'fasta') {
      downloadAssembledFASTA();
    }
  });
}

function downloadPrimersTXT() {
  if (!currentResults) {
    showWarning('No primers available. Please design primers first.');
    return;
  }
  
  let fasta = '';
  const vectorBaseName = extractFASTAHeader($('vector-seq')?.value || '') || 'Vector';
  const vectorFLabel = `${vectorBaseName}-F`;
  const vectorRLabel = `${vectorBaseName}-R`;
  const getInsertBaseName = (index1Based) => {
    const idx = Math.max(1, parseInt(index1Based, 10) || 1);
    const insertSeqs = getAllInsertSeqs();
    const raw = insertSeqs[idx - 1] || '';
    return extractFASTAHeader(raw) || `Insert${idx}`;
  };
  
  if (currentResults.vector) {
    if (currentResults.vector.R && currentResults.vector.R.seq) {
      fasta += `>${vectorRLabel}\n`;
      const seq = currentResults.vector.R.seq;
      const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
    
    if (currentResults.vector.F && currentResults.vector.F.seq) {
      fasta += `>${vectorFLabel}\n`;
      const seq = currentResults.vector.F.seq;
      const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
  }
  
  if (currentResults.inserts && currentResults.inserts.length) {
    currentResults.inserts.forEach((ins) => {
      const idx = ins.index || 1;
      const base = getInsertBaseName(idx);
      if (ins.F && ins.F.seq) {
        fasta += `>${base}-F\n`;
        const seq = ins.F.seq;
        const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
        fasta += formattedSeq;
      }
      if (ins.R && ins.R.seq) {
        fasta += `>${base}-R\n`;
        const seq = ins.R.seq;
        const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
        fasta += formattedSeq;
      }
    });
  } else if (currentResults.insert) {
    if (currentResults.insert.F && currentResults.insert.F.seq) {
      fasta += `>${getInsertBaseName(1)}-F\n`;
      const seq = currentResults.insert.F.seq;
      const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
    
    if (currentResults.insert.R && currentResults.insert.R.seq) {
      fasta += `>${getInsertBaseName(1)}-R\n`;
      const seq = currentResults.insert.R.seq;
      const formattedSeq = seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
  }
  
  if (!fasta) {
    showWarning('No primer sequences available.');
    return;
  }
  
  const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const name = window.currentAssembledName || 'USER_primers';
  a.href = URL.createObjectURL(blob);
  a.download = name + '_primers.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function downloadAssembledFASTA() {
  if (!window.currentAssembledSeq) {
    showWarning('Assembled plasmid sequence is not available. Please design primers first.');
    return;
  }
  
  const seq = Core.normalizeSeq(window.currentAssembledSeq);
  const name = window.currentAssembledName || 'USER_assembled';
  
  // Format FASTA (80 chars per line) - aligned with Gibson
  const fasta = '>' + name + '\n' + seq.replace(/(.{80})/g, '$1\n') + (seq.length % 80 !== 0 ? '\n' : '');
  
  const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '.fasta';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function initResetButton() {
  const resetBtn = $('global-reset');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => window.location.reload());
}

function initClearButton() {
  const clearBtn = $('clear-btn');
  if (!clearBtn) return;

  clearBtn.addEventListener('click', () => {
    // Clear inputs
    const vectorTextarea = $('vector-seq');
    if (vectorTextarea) vectorTextarea.value = '';

    const pcrForward = $('pcr-forward');
    if (pcrForward) pcrForward.value = '';
    const pcrReverse = $('pcr-reverse');
    if (pcrReverse) pcrReverse.value = '';

    // Clear inserts and reset to a single empty row
    const insertsContainer = $('inserts-container');
    if (insertsContainer) {
      const rows = Array.from(insertsContainer.querySelectorAll('.insert-row'));
      rows.forEach((row, idx) => {
        if (idx === 0) {
          const textarea = row.querySelector('.insert-seq');
          if (textarea) textarea.value = '';
        } else {
          row.remove();
        }
      });
      updateInsertNumbers();
      updateInsertControls();
      updateAddInsertButton();
    }

    // Reset PCR fragments UI
    const backboneSelectU = $('backbone-select-u');
    if (backboneSelectU) {
      backboneSelectU.innerHTML = '<option value=\"\">Please enter PCR primers first</option>';
    }
    const fragSummary = $('pcr-fragments-summary');
    if (fragSummary) fragSummary.textContent = '';

    // Clear results
    const resultsDiv = $('results-wrap');
    const resultsContent = $('results-content');
    if (resultsContent) resultsContent.innerHTML = '';
    if (resultsDiv) resultsDiv.style.display = 'none';

    // Reset stored state
    currentResults = null;
    window.currentAssembledSeq = null;
    window.currentAssembledName = 'USER_assembled';

    // Reset gel state (best-effort)
    if (VIZ && typeof VIZ.updateGelState === 'function') {
      VIZ.updateGelState({
        lanes: [],
        scIdx: new Set(),
        assembledLaneIndex: null,
        insertCount: 0,
        insertNames: [],
        vectorName: null,
        enzymeName: null,
        assembledName: null
      });
    }

    // Update vector preview (clears canvas/annotations)
    try { updateVectorPreview(); } catch (e) {}
  });
}

/**
 * Show warning modal
 */
function renderGel(results, vector, inserts) {
  const ladderSelect = $('ggx-ladder');
  if (!ladderSelect) return;
  
  const ladKey = ladderSelect.value || 'neb1kbplus';
  const lad = Core.LADDER_PROFILES[ladKey] || Core.LADDER_PROFILES.neb1kbplus;
  
  // Build lanes array
  const lanes = [];
  lanes.push([]); // L1: Ladder placeholder
  
  // L2: Uncut vector (supercoiled - SC)
  lanes.push([vector.seq.length]); // L2: Uncut vector (SC; rendered via scIdx)
  
  // L3: Linearized vector (PCR)
  lanes.push([vector.seq.length]); // L3: Linearized vector
  
  // L4..: PCR of inserts
  let insertCount = 0;
  const insertNames = [];
  if (Array.isArray(inserts) && inserts.length) {
    for (const ins of inserts) {
      const len = ins.length || 0;
      lanes.push([len]);
      insertCount++;
      insertNames.push(ins.name || `Insert${insertCount}`);
    }
  }
  
  // Last: Assembled plasmid
  const assembledLen = results.assembledSeq
    ? results.assembledSeq.length
    : (window.currentAssembledSeq ? Core.normalizeSeq(window.currentAssembledSeq).length : 0);
  if (assembledLen > 0) {
    lanes.push([assembledLen]);
  }
  
  const vecName = vector.name || 'vector';
  const assembledName = vecName ? `${vecName}_USER` : 'USER_Assembly';
  
  // Update gel state
  const assembledLaneIndex = (assembledLen > 0) ? (lanes.length - 1) : null;
  const scIdx = new Set([1].concat(typeof assembledLaneIndex === 'number' ? [assembledLaneIndex] : []));

  VIZ.updateGelState({
    lanes: lanes,
    insertCount: insertCount,
    insertNames: insertNames,
    vectorName: vecName,
    enzymeName: 'PCR linearized',
    assembledName: assembledName,
    assembledLaneIndex,
    profile: ladKey,
    scIdx
  });
  
  // Draw gel
  const highlightIndices = new Set([1, 2].concat(typeof assembledLaneIndex === 'number' ? [assembledLaneIndex] : []));
  VIZ.drawGel('gg-gel-canvas', lanes, lad.sizesKb.map(k => k * 1000), lad.boldKb.map(k => k * 1000), lad.name, { highlightIndices, scIdx });
}

function showWarning(message) {
  const host = document.getElementById('module-content') || document.body;
  if (VIZ && typeof VIZ.showMWModal === 'function') {
    VIZ.showMWModal(host, message || '', () => {}, () => {});
    return;
  }
  alert(message);
}

function showError(message) {
  const resultsDiv = $('results-wrap');
  if (resultsDiv) {
    resultsDiv.style.display = 'none';
  }
  showWarning(message);
}

// ==================== Initialize ====================

function initUSERModule() {
  // Add inline help tooltips (page-level)
  attachHelpToTextarea('vector-seq', "Paste your vector/plasmid DNA sequence in FASTA format (header optional). Line breaks and spaces are ignored.", 'Help: Vector sequence');
  ensureHelpIcon(document.querySelector('#right-panel > label'), "Add insert fragments in order (FASTA supported). USER cloning uses a dU site to create complementary sticky ends between vector and inserts.", 'Help: Assembly plan');
  attachHelpToInput('pcr-forward', "Vector PCR forward primer sequence (5'→3'). If it contains U, format is typically overlap + U + core.", 'Help: Vector PCR forward primer');
  attachHelpToInput('pcr-reverse', "Vector PCR reverse primer sequence (5'→3'). If it contains U, format is typically overlap + U + core.", 'Help: Vector PCR reverse primer');
  attachHelpToInput('target-tm', "Target melting temperature for the core (annealing) region of primers.", 'Help: Target core Tm');
  attachHelpToInput('overlap-tm', "Target melting temperature for the overlap region used at each junction.", 'Help: Overlap Tm');
  attachHelpToInput('overlap-len', "Desired overlap length at each junction (bp). For USER cloning, this is typically short (e.g., 8–15 bp) plus a dU site.", 'Help: Overlap length');
  attachHelpToInput('primer-conc', "Effective primer concentration assumed for in silico Tm calculation. Typical range: 25-1000 nM.", 'Help: Primer concentration');
  attachHelpToInput('na-conc', "Monovalent cation concentration used for salt-corrected Tm calculation. Typical range: 10-200 mM.", 'Help: Na+ concentration');
  attachHelpToInput('mg-conc', "Divalent cation concentration used for Tm calculation. Set to 0 if Mg²⁺ is absent from reaction. Typical range: 0.5-5 mM.", 'Help: Mg2+ concentration');

  initVectorUpload();
  initInsertUpload();
  initUserDemoSetButton();
  initDesignButton();
  initDownloadButton();
  initResetButton();
  initClearButton();
  updateVectorPreview();
  updateInsertControls();
  updateAddInsertButton();
}

// Export for dynamic loading
window.initUSERModule = initUSERModule;
