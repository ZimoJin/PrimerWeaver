// --- CORE CONSTANTS ---
const comp = { A: "T", T: "A", G: "C", C: "G" };
const IUPAC_MAP = {
  A: ["A"], C: ["C"], G: ["G"], T: ["T"],
  R: ["A", "G"], Y: ["C", "T"], S: ["G", "C"], W: ["A", "T"],
  K: ["G", "T"], M: ["A", "C"], B: ["C", "G", "T"], D: ["A", "G", "T"],
  H: ["A", "C", "T"], V: ["A", "C", "G"], N: ["A", "C", "G", "T"]
};

// SantaLucia (1998) / Allawi (1997) NN parameters
const NN = {
  AA: { dH: -7.9, dS: -22.2 }, TT: { dH: -7.9, dS: -22.2 },
  AT: { dH: -7.2, dS: -20.4 }, TA: { dH: -7.2, dS: -21.3 },
  CA: { dH: -8.5, dS: -22.7 }, TG: { dH: -8.5, dS: -22.7 },
  GT: { dH: -8.4, dS: -22.4 }, AC: { dH: -8.4, dS: -22.4 },
  CT: { dH: -7.8, dS: -21.0 }, AG: { dH: -7.8, dS: -21.0 },
  GA: { dH: -8.2, dS: -22.2 }, TC: { dH: -8.2, dS: -22.2 },
  CG: { dH: -10.6, dS: -27.2 }, GC: { dH: -9.8, dS: -24.4 },
  GG: { dH: -8.0, dS: -19.9 }, CC: { dH: -8.0, dS: -19.9 }
};

// Loop Entropy Penalty (approximate from SantaLucia 2004)
// This fixes the "False Positive Hairpin" issue.
const LOOP_PENALTY = { 3: 5.7, 4: 5.6, 5: 4.9, 6: 4.4, 7: 4.5, 8: 4.6, 9: 4.6 };

const Rgas = 1.987; // cal/(mol*K)

// --- HELPERS ---

function normalizeSeq(raw) {
  return (raw || "").toUpperCase().replace(/[^ACGTRYSWKMBDHVN]/g, "");
}

function gcPct(seq) {
  if (!seq.length) return 0;
  return (100 * (seq.match(/[GC]/g) || []).length) / seq.length;
}

function has3GCClamp(seq) {
  if (!seq.length) return false;
  const c = seq[seq.length - 1];
  return c === "G" || c === "C";
}

function hasHomopolymer(seq, n) {
  return new RegExp("A{" + n + ",}|C{" + n + ",}|G{" + n + ",}|T{" + n + ",}").test(seq);
}

function baseSet(b) {
  if (IUPAC_MAP[b]) return IUPAC_MAP[b];
  return /[ACGT]/.test(b) ? [b] : [];
}

function isComplementaryIUPAC(b1, b2) {
  const s1 = baseSet(b1);
  const s2 = baseSet(b2);
  if (!s1.length || !s2.length) return false;
  for (let i = 0; i < s1.length; i++) {
    for (let j = 0; j < s2.length; j++) {
      if (comp[s1[i]] === s2[j]) return true;
    }
  }
  return false;
}

// Get entropy penalty for a hairpin loop of size 'len'
function getLoopPenalty(len) {
  if (len < 3) return 999; 
  if (LOOP_PENALTY[len]) return LOOP_PENALTY[len];
  // Linear approx for longer loops
  return 4.6 + (0.1 * (len - 9));
}

// --- THERMODYNAMICS ENGINE ---

function accumulateNNWorst(seq) {
  const s = seq.toUpperCase();
  if (s.length < 2) return null;
  const Tref = 310.15; // 37 C
  let dH = 0;
  let dS = 0;

  for (let i = 0; i < s.length - 1; i++) {
    const b1 = s[i];
    const b2 = s[i + 1];
    const set1 = baseSet(b1);
    const set2 = baseSet(b2);
    if (!set1.length || !set2.length) return null;

    let bestStep = null;
    // Iterate all IUPAC possibilities, pick strongest (Risk Averse)
    for (let x = 0; x < set1.length; x++) {
      for (let y = 0; y < set2.length; y++) {
        const dinuc = set1[x] + set2[y];
        const p = NN[dinuc];
        if (!p) continue;
        const dG = p.dH - (Tref * p.dS) / 1000.0;
        if (!bestStep || dG < bestStep.dG) {
          bestStep = { dH: p.dH, dS: p.dS, dG: dG };
        }
      }
    }
    if (!bestStep) return null;
    dH += bestStep.dH;
    dS += bestStep.dS;
  }
  
  // Terminal corrections (initiation)
  dH += 0.2;
  dS += -5.7;

  return { dH: dH, dS: dS };
}

function duplexDG37Worst(seq, isSymmetric = false) {
  const acc = accumulateNNWorst(seq);
  if (!acc) return NaN;
  const T = 310.15;
  let dS = acc.dS;
  // Symmetry correction for self-dimers (-1.4 eu)
  if (isSymmetric) dS -= 1.4; 
  return acc.dH - (T * dS) / 1000.0;
}

// Tm with Mg2+ and Na+ correction (von Ahsen / Owczarzy approximation)
function tmcalNN(seq, Na_mM, Mg_mM, conc_nM) {
  const s = seq.toUpperCase();
  if (s.length < 2) return NaN;
  const acc = accumulateNNWorst(s);
  if (!acc) return NaN;

  const Cp = conc_nM * 1e-9;
  
  // Calculate equivalent Monovalent cations
  // Let's use the von Ahsen 2001 approximation: [Na_eq] = [Na+] + 4*sqrt([Mg++]) (in mM)
  const monovalentEq = (Na_mM + 4.0 * Math.sqrt(Mg_mM)) / 1000.0; // Molar

  if (monovalentEq <= 0) return NaN;

  const dH = acc.dH * 1000; // cal
  const dS = acc.dS; // eu

  // R ln(C/4) for non-symmetric, R ln(C) is rarely used for primers, usually C/4 or C/2.
  // Standard primer Tm uses Cp/4 (for non-self).
  const entropy = dS + Rgas * Math.log(Cp/4); 
  
  const Tm_1M = dH / entropy; // Kelvin

  // Let's stick to the log salt correction on the Entropy term which is more accurate physically
  const dS_salt = dS + 0.368 * (s.length - 1) * Math.log(monovalentEq); 
  // Re-calc Tm with salt-adjusted entropy
  const Tm_salt_K = dH / (dS_salt + Rgas * Math.log(Cp/4));
  
  return Tm_salt_K - 273.15;
}

function fmt2(x) { return isFinite(x) ? x.toFixed(2) : "--"; }
function badge(cls, txt) { return '<span class="badge ' + cls + '">' + txt + "</span>"; }

function classifyDG(dg, touches3) {
  if (!isFinite(dg)) return { label: "None", cls: "ok" };
  let label, cls;
  if (dg <= -7) { label = "Very strong (<= -7)"; cls = "bad"; }
  else if (dg <= -5) { label = "Strong (-7 ~ -5)"; cls = "bad"; }
  else if (dg <= -3) { label = "Moderate (-5 ~ -3)"; cls = "warn"; }
  else { label = "Weak (> -3)"; cls = "ok"; }
  if (touches3 && cls !== "ok") label = "3' " + label;
  return { label: label, cls: cls };
}

// --- NEW SCANNING LOGIC ---

// 1. Hairpin Scan with Loop Entropy
function hairpinScan(seq) {
  const s = normalizeSeq(seq);
  const n = s.length;
  const minStem = 3; 
  const minLoop = 3;
  let best = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + minStem + minLoop; j < n; j++) {
      let a = i;
      let b = j;
      let seg = "";
      
      // Extend stem inwards
      while (a >= 0 && b < n && isComplementaryIUPAC(s[a], s[b])) {
        seg = s[a] + seg;
        if (seg.length >= minStem) {
          const stemDG = duplexDG37Worst(seg);
          const loopLen = (b - a) - 1;
          const loopDG = getLoopPenalty(loopLen);
          const netDG = stemDG + loopDG;

          if (netDG < 0) { // Only record if thermodynamically stable
            const touches3 = j >= n - 5;
            if (!best || netDG < best.dg - 0.1) {
              best = { seg: seg, dg: netDG, touches3: touches3 };
            }
          }
        }
        a--;
        b++;
      }
    }
  }
  if (!best) return null;
  return { seg: best.seg, dg: best.dg, touches3: best.touches3 };
}

// 2. Dimer Scan with Bubble/Gap Tolerance
function dimerScan(seqA, seqB) {
  const A = normalizeSeq(seqA);
  const B = normalizeSeq(seqB);
  const Brev = B.split("").reverse().join("");
  const n = A.length;
  const m = B.length;
  if (!n || !m) return null;
  
  const isSelf = (seqA === seqB);
  let best = null;

  for (let offset = -m + 1; offset <= n - 1; offset++) {
    // Collect matches
    let islands = [];
    let cur = { start: -1, end: -1, seq: "" };

    for (let i = 0; i < n; i++) {
      const j = i - offset;
      if (j < 0 || j >= m) continue;
      
      if (isComplementaryIUPAC(A[i], Brev[j])) {
        if (cur.seq === "") cur.start = i;
        cur.seq += A[i];
        cur.end = i;
      } else {
        if (cur.seq !== "") {
          islands.push(cur);
          cur = { start: -1, end: -1, seq: "" };
        }
      }
    }
    if (cur.seq !== "") islands.push(cur);

    if (islands.length === 0) continue;

    // Stitch islands separated by 1 mismatch
    for (let k = 0; k < islands.length; k++) {
      let runDG = 0;
      let runSeq = islands[k].seq;
      let runEnd = islands[k].end;
      
      // Calculate first block energy
      runDG += duplexDG37Worst(islands[k].seq, isSelf); // Base energy

      // Look ahead for single base mismatch bridge
      if (k + 1 < islands.length) {
        const gap = islands[k+1].start - islands[k].end - 1;
        if (gap === 1) {
          const nextBlockDG = duplexDG37Worst(islands[k+1].seq, isSelf);
          // Penalty for internal mismatch/bubble (~3.5 kcal)
          const bubblePenalty = 3.5; 
          const mergedDG = runDG + nextBlockDG + bubblePenalty;
          
          if (mergedDG < runDG) {
            // The merge is stronger than the single piece
            runDG = mergedDG;
            runSeq += "." + islands[k+1].seq; // visual marker
            runEnd = islands[k+1].end;
            k++; // Skip next
          }
        }
      }

      if (runSeq.length >= 3 && runDG < -1.0) {
        // Calculate touches 3'
        const bEndOnRev = runEnd - offset;
        const bEndOnB = (m - 1) - bEndOnRev;
        const touches3 = (runEnd >= n - 3) || (bEndOnB >= m - 3);

        if (!best || runDG < best.dg - 0.1) {
          best = {
            dg: runDG,
            len: runSeq.length, // approximate
            touches3: touches3,
            offset: offset
          };
        }
      }
    }
  }

  if (!best) return null;

  // Reconstruct Visuals for the best offset
  const off = best.offset;
  let minPos = Math.min(0, off);
  let maxPos = Math.max(n, m + off);
  let lA = "", lB = "", lM = "";

  for (let pos = minPos; pos < maxPos; pos++) {
    const i = pos;
    const j = pos - off;
    const a = (i >= 0 && i < n) ? A[i] : " ";
    const b = (j >= 0 && j < m) ? Brev[j] : " ";
    
    let mChar = " ";
    if (a !== " " && b !== " ") {
      if (isComplementaryIUPAC(a, b)) mChar = "|";
      else mChar = "."; // Mismatch in alignment zone
    }
    lA += a; lB += b; lM += mChar;
  }

  return {
    dg: best.dg,
    len: best.len,
    touches3: best.touches3,
    align: "5' " + lA + " 3'\n   " + lM + "\n3' " + lB + " 5'"
  };
}


function threePrimeDG(seq) {
  const s = normalizeSeq(seq);
  if (s.length < 5) return NaN;
  // Last 5 bases
  return duplexDG37Worst(s.slice(-5));
}

// --- QC BUNDLE ---

function qcPrimer(label, raw, Na_mM, Mg_mM, conc_nM) {
  const seq = normalizeSeq(raw);
  if (!seq) return { label: label, empty: true };

  const len = seq.length;
  const gc = gcPct(seq);
  const tm = tmcalNN(seq, Na_mM, Mg_mM, conc_nM);
  const clamp = has3GCClamp(seq);
  const homopoly = hasHomopolymer(seq, 4);
  const dg3 = threePrimeDG(seq);
  
  const selfD = dimerScan(seq, seq);
  const selfClass = selfD ? classifyDG(selfD.dg, selfD.touches3) : { label: "None", cls: "ok" };

  const hp = hairpinScan(seq);
  const hpClass = hp ? classifyDG(hp.dg, hp.touches3) : { label: "None", cls: "ok" };

  let score = 100;
  if (gc < 40 || gc > 60) score -= 10;
  if (len < 18 || len > 30) score -= 8;
  if (!clamp) score -= 5;
  if (homopoly) score -= 8;
  if (isFinite(dg3) && dg3 <= -9) score -= 10; // too sticky 3'
  if (selfClass.cls === "bad") score -= 25;
  else if (selfClass.cls === "warn") score -= 10;
  if (hpClass.cls === "bad") score -= 12;
  else if (hpClass.cls === "warn") score -= 6;
  if (score < 0) score = 0;

  return {
    label, raw, seq, len, gc, tm, clamp, homopoly, dg3,
    selfD, selfClass, hp, hpClass, score,
    hasIUPAC: /[RYSWKMBDHVN]/.test(seq),
    empty: false
  };
}

function qcPair(F, R) {
  if (!F || !R || F.empty || R.empty) return null;
  const d = dimerScan(F.seq, R.seq);
  const info = d ? classifyDG(d.dg, d.touches3) : { label: "None", cls: "ok" };
  return { dimer: d, info: info };
}

function scoreLabel(score) {
  if (score >= 85) return { txt: "Excellent", cls: "good" };
  if (score >= 65) return { txt: "Acceptable", cls: "mid" };
  return { txt: "Risky", cls: "bad" };
}


// --- UI WIRING ---

function splitHeaderAndSeq(raw){
  const txt = raw || "";
  const lines = txt.split(/\r?\n/);
  let headerLine = null;
  const seqLines = [];
  for (let i = 0; i < lines.length; i++){
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (!headerLine && trimmed.charAt(0) === '>'){
      headerLine = trimmed;
    } else {
      seqLines.push(trimmed);
    }
  }
  return { headerLine: headerLine, seqString: seqLines.join("") };
}

function parsePrimerInput(raw, defaultLabel){
  const parts = splitHeaderAndSeq(raw);
  const label = parts.headerLine ? (parts.headerLine.slice(1).trim() || defaultLabel) : defaultLabel;
  return { label: label, seq: parts.seqString };
}

const IUPAC_COMP = {
  A:"T", T:"A", C:"G", G:"C", R:"Y", Y:"R", S:"S", W:"W",
  K:"M", M:"K", B:"V", V:"B", D:"H", H:"D", N:"N"
};

function reverseComplementSeq(seq){
  const s = normalizeSeq(seq);
  const chars = s.split("");
  const rc = [];
  for (let i = chars.length - 1; i >= 0; i--){
    const b = chars[i];
    rc.push(IUPAC_COMP[b] || "N");
  }
  return rc.join("");
}


function parsePrimerList(raw, defaultPrefix){
  const lines = (raw || "").split(/\r?\n/);
  const records = [];
  let header = null;
  let seqLines = [];
  let headerSeen = false;

  function pushOne(){
    if (seqLines.length === 0) return;
    const seq = seqLines.join("");
    const label = header
      ? (header.slice(1).trim() || (defaultPrefix + (records.length+1)))
      : (defaultPrefix + (records.length+1));
    records.push({ label: label, seq: seq });
  }

  for (let i = 0; i < lines.length; i++){
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.charAt(0) === '>'){
      headerSeen = true;
      // start of a new record
      pushOne();
      header = trimmed;
      seqLines = [];
    } else {
      seqLines.push(trimmed);
    }
  }
  pushOne();

  // If no header lines at all and no records yet but we have some sequence,
  // treat entire content as a single primer.
  if (!headerSeen){
    const joined = lines.join("").replace(/\s+/g,"");
    if (joined){
      return [{ label: defaultPrefix + "1", seq: joined }];
    }
  }

  return records;
}

/**
 * Parse primer pairs from mixed input (Forward and Reverse primers together)
 * Automatically identifies primer direction from name patterns
 * Supported formats:
 * - Target1-F / Target1-R (with dash)
 * - Target1_F / Target1_R (with underscore)
 * - Target1F / Target1R (no separator)
 * - Target1-Forward / Target1-Reverse (full words)
 * - Target1_Forward / Target1_Reverse (full words with underscore)
 * - Target1-fwd / Target1-rev (abbreviated)
 * - Target1_FWD / Target1_REV (uppercase abbreviated)
 */
function parsePrimerPairsFromMixed(raw) {
  const records = parsePrimerList(raw, "");
  if (records.length === 0) return [];
  
  const primerMap = new Map();
  
  for (const rec of records) {
    const header = rec.label.trim();
    if (!header) continue;
    
    let targetName = null;
    let direction = null;
    
    // Pattern 1: -F, -R, _F, _R, or direct F/R
    let match = header.match(/^(.+?)[-_]?([FRfr])$/);
    if (match) {
      targetName = match[1].trim();
      direction = match[2].toUpperCase();
    } else {
      // Pattern 2: Forward, Reverse, forward, reverse
      match = header.match(/^(.+?)[-_]?(Forward|Reverse|forward|reverse)$/i);
      if (match) {
        targetName = match[1].trim();
        direction = match[2].toLowerCase().startsWith('f') ? 'F' : 'R';
      } else {
        // Pattern 3: fwd, rev, FWD, REV
        match = header.match(/^(.+?)[-_]?(fwd|rev|FWD|REV)$/i);
        if (match) {
          targetName = match[1].trim();
          direction = match[2].toLowerCase().startsWith('f') ? 'F' : 'R';
        }
      }
    }
    
    if (targetName && direction) {
      if (!primerMap.has(targetName)) {
        primerMap.set(targetName, { name: targetName, forward: null, reverse: null });
      }
      
      const pair = primerMap.get(targetName);
      if (direction === 'F') {
        pair.forward = { label: header, seq: rec.seq };
      } else if (direction === 'R') {
        pair.reverse = { label: header, seq: rec.seq };
      }
    }
  }
  
  // Convert to array of pairs
  const pairs = [];
  for (const [targetName, pair] of primerMap.entries()) {
    if (pair.forward && pair.reverse) {
      pairs.push({
        target: targetName,
        forward: pair.forward,
        reverse: pair.reverse
      });
    }
  }
  
  return pairs;
}

/**
 * Smart pairing: Try to pair primers by name if possible, otherwise fall back to index-based pairing
 */
function smartPairPrimers(fList, rList) {
  const pairs = [];
  
  // Try to match by name first
  const fMap = new Map();
  const rMap = new Map();
  
  // Parse forward primers and extract target names
  for (const f of fList) {
    const header = f.label.trim();
    let targetName = null;
    let match = header.match(/^(.+?)[-_]?([FRfr])$/);
    if (match) {
      targetName = match[1].trim();
    } else {
      match = header.match(/^(.+?)[-_]?(Forward|Reverse|forward|reverse|fwd|rev|FWD|REV)$/i);
      if (match) {
        targetName = match[1].trim();
      } else {
        targetName = header; // Use full name if no pattern matches
      }
    }
    if (!fMap.has(targetName)) {
      fMap.set(targetName, []);
    }
    fMap.get(targetName).push(f);
  }
  
  // Parse reverse primers and extract target names
  for (const r of rList) {
    const header = r.label.trim();
    let targetName = null;
    let match = header.match(/^(.+?)[-_]?([FRfr])$/);
    if (match) {
      targetName = match[1].trim();
    } else {
      match = header.match(/^(.+?)[-_]?(Forward|Reverse|forward|reverse|fwd|rev|FWD|REV)$/i);
      if (match) {
        targetName = match[1].trim();
      } else {
        targetName = header; // Use full name if no pattern matches
      }
    }
    if (!rMap.has(targetName)) {
      rMap.set(targetName, []);
    }
    rMap.get(targetName).push(r);
  }
  
  // Try to pair by target name
  const usedF = new Set();
  const usedR = new Set();
  
  for (const [targetName, fPrimers] of fMap.entries()) {
    if (rMap.has(targetName)) {
      const rPrimers = rMap.get(targetName);
      const minLen = Math.min(fPrimers.length, rPrimers.length);
      for (let i = 0; i < minLen; i++) {
        const fIdx = fList.indexOf(fPrimers[i]);
        const rIdx = rList.indexOf(rPrimers[i]);
        if (fIdx >= 0 && rIdx >= 0 && !usedF.has(fIdx) && !usedR.has(rIdx)) {
          pairs.push({ forward: fList[fIdx], reverse: rList[rIdx] });
          usedF.add(fIdx);
          usedR.add(rIdx);
        }
      }
    }
  }
  
  // Fall back to index-based pairing for unmatched primers
  for (let i = 0; i < Math.max(fList.length, rList.length); i++) {
    if (i < fList.length && !usedF.has(i) && i < rList.length && !usedR.has(i)) {
      pairs.push({ forward: fList[i], reverse: rList[i] });
    } else if (i < fList.length && !usedF.has(i)) {
      pairs.push({ forward: fList[i], reverse: { label: "Reverse " + (i+1), seq: "" } });
    } else if (i < rList.length && !usedR.has(i)) {
      pairs.push({ forward: { label: "Forward " + (i+1), seq: "" }, reverse: rList[i] });
    }
  }
  
  return pairs;
}

function inferPrimerDirectionFromLabel(label) {
  const header = String(label || '').trim();
  if (!header) return null;

  let match = header.match(/^(.+?)[-_]?([FRfr])$/);
  if (match) return match[2].toUpperCase();

  match = header.match(/^(.+?)[-_]?(Forward|Reverse)$/i);
  if (match) return match[2].toLowerCase().startsWith('f') ? 'F' : 'R';

  match = header.match(/^(.+?)[-_]?(fwd|rev)$/i);
  if (match) return match[2].toLowerCase().startsWith('f') ? 'F' : 'R';

  return null;
}

function detectNamingScheme(label) {
  const header = String(label || '').trim();
  if (!header) return 'none';

  if (/^(.+?)-([FR])$/i.test(header)) return 'dashFR';
  if (/^(.+?)_([FR])$/i.test(header)) return 'underscoreFR';
  if (/^(.+?)([FR])$/i.test(header)) return 'bareFR';
  if (/^(.+?)[-_]?(Forward|Reverse)$/i.test(header)) return 'word';
  if (/^(.+?)[-_]?(fwd|rev)$/i.test(header)) return 'abbr';
  return 'none';
}

function analyzePrimerSequence(rawSeq) {
  const cleaned = String(rawSeq || '').replace(/\s+/g, '').toUpperCase();
  const normalized = normalizeSeq(rawSeq);
  const invalidMatches = cleaned.match(/[^ACGTRYSWKMBDHVN]/g) || [];
  const invalidCount = invalidMatches.length;
  const invalidAt3 = cleaned.length ? /[^ACGTRYSWKMBDHVN]/.test(cleaned.slice(-5)) : false;

  const degenerateMatches = normalized.match(/[RYSWKMBDHVN]/g) || [];
  const degenerateCount = degenerateMatches.length;
  const degenerateFrac = normalized.length ? (degenerateCount / normalized.length) : 0;

  return {
    cleaned,
    normalized,
    invalidCount,
    invalidAt3,
    degenerateCount,
    degenerateFrac,
    isValid: normalized.length > 0
  };
}

function buildQCPreflightWarnings(fList, rList, fRaw, rRaw, Na, Mg, conc, targetTm) {
  const warnings = [];

  const fHasAny = fList.length > 0;
  const rHasAny = rList.length > 0;

  const fAnalyses = fList.map(p => ({ label: p.label, ...analyzePrimerSequence(p.seq) }));
  const rAnalyses = rList.map(p => ({ label: p.label, ...analyzePrimerSequence(p.seq) }));

  const fValidCount = fAnalyses.filter(p => p.isValid).length;
  const rValidCount = rAnalyses.filter(p => p.isValid).length;

  // MW-04: No valid primers after normalization (e.g., input contains only non-IUPAC characters)
  if (fHasAny || rHasAny || String(fRaw || '').trim() || String(rRaw || '').trim()) {
    if (fValidCount === 0 && rValidCount === 0) {
      warnings.push({
        id: 'MW-04',
        message:
          "Warning: No valid primer sequences detected.\n" +
          "All provided sequences become empty after normalization (only IUPAC DNA codes are kept: A/C/G/T/R/Y/S/W/K/M/B/D/H/V/N).\n\n" +
          "Click Cancel to check your input or OK to proceed (results will be empty)."
      });
      return warnings;
    }
  }

  // MW-01 / MW-02 variants: only one side effectively usable
  if (fValidCount > 0 && rValidCount === 0) {
    const note = rHasAny
      ? "Reverse primer input is present but none of the sequences are valid after normalization."
      : "No reverse primers are provided.";
    warnings.push({
      id: 'MW-01',
      message:
        "Warning: Only forward primers are available for QC.\n" +
        note + "\n" +
        "QC will be performed only on forward primers (no cross-dimer / pair-level analysis).\n\n" +
        "Click Cancel to check your input or OK to proceed."
    });
  } else if (rValidCount > 0 && fValidCount === 0) {
    const note = fHasAny
      ? "Forward primer input is present but none of the sequences are valid after normalization."
      : "No forward primers are provided.";
    warnings.push({
      id: 'MW-02',
      message:
        "Warning: Only reverse primers are available for QC.\n" +
        note + "\n" +
        "QC will be performed only on reverse primers (no cross-dimer / pair-level analysis).\n\n" +
        "Click Cancel to check your input or OK to proceed."
    });
  }

  // MW-03: Count mismatch (input counts, not just valid counts)
  if (fHasAny && rHasAny && fList.length !== rList.length) {
    warnings.push({
      id: 'MW-03',
      message:
        `Warning: Primer count mismatch detected.\n` +
        `Forward primers: ${fList.length}\n` +
        `Reverse primers: ${rList.length}\n` +
        "The tool will attempt to pair primers by name. If pairing fails, some primers may be evaluated individually.\n\n" +
        "Click Cancel to check your input or OK to proceed."
    });
  }

  // MW-05: Non-IUPAC characters removed
  const invalidF = fAnalyses.filter(p => p.invalidCount > 0);
  const invalidR = rAnalyses.filter(p => p.invalidCount > 0);
  const invalidAt3 = [...invalidF, ...invalidR].filter(p => p.invalidAt3);
  if (invalidF.length || invalidR.length) {
    const examples = [...invalidF, ...invalidR].slice(0, 4).map(p => p.label);
    warnings.push({
      id: 'MW-05',
      message:
        "Warning: Non-IUPAC characters were removed from primer sequences.\n" +
        `Affected primers: ${invalidF.length + invalidR.length}\n` +
        (examples.length ? `Examples: ${examples.join(', ')}\n` : "") +
        (invalidAt3.length
          ? "At least one primer contains invalid characters near the 3' end, which is especially risky for PCR.\n"
          : "") +
        "QC will proceed using the normalized sequences only.\n\n" +
        "Click Cancel to review/correct your input or OK to proceed."
    });
  }

  // MW-06: Ambiguous/degenerate bases detected
  const degenerateThresholdCount = 1;
  const degenerateThresholdFrac = 0.10;
  const degeneratePrimers = [...fAnalyses, ...rAnalyses].filter(p =>
    p.degenerateCount >= degenerateThresholdCount || p.degenerateFrac > degenerateThresholdFrac
  );
  if (degeneratePrimers.length) {
    const examples = degeneratePrimers.slice(0, 4).map(p => p.label);
    warnings.push({
      id: 'MW-06',
      message:
        "Warning: Degenerate (IUPAC) bases detected.\n" +
        `Affected primers: ${degeneratePrimers.length}\n` +
        (examples.length ? `Examples: ${examples.join(', ')}\n` : "") +
        "Thermodynamic values (Tm and ΔG) are estimated for the most stable variant (worst-case), which may be conservative.\n\n" +
        "Click Cancel to confirm/replace degenerate bases or OK to proceed."
    });
  }

  // MW-07: Duplicate primer names (can break pairing logic)
  const nameCounts = new Map();
  [...fList, ...rList].forEach(p => {
    const k = String(p.label || '').trim().toLowerCase();
    if (!k) return;
    nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
  });
  const dupNames = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dupNames.length) {
    const examples = dupNames.slice(0, 5);
    warnings.push({
      id: 'MW-07',
      message:
        "Warning: Duplicate primer names detected.\n" +
        "Duplicate headers can cause ambiguous pairing and confusing output.\n" +
        `Examples: ${examples.join(', ')}\n\n` +
        "Click Cancel to rename duplicates or OK to proceed."
    });
  }

  // MW-08: Direction appears reversed in the wrong input box / mixed naming schemes
  const misplacedF = fList.filter(p => inferPrimerDirectionFromLabel(p.label) === 'R').map(p => p.label);
  const misplacedR = rList.filter(p => inferPrimerDirectionFromLabel(p.label) === 'F').map(p => p.label);
  const schemes = new Set([...fList, ...rList].map(p => detectNamingScheme(p.label)).filter(s => s !== 'none'));
  if (misplacedF.length || misplacedR.length || schemes.size > 1) {
    const lines = [];
    if (misplacedF.length) lines.push(`Forward box contains reverse-looking names: ${misplacedF.slice(0, 4).join(', ')}`);
    if (misplacedR.length) lines.push(`Reverse box contains forward-looking names: ${misplacedR.slice(0, 4).join(', ')}`);
    if (schemes.size > 1) lines.push(`Mixed naming schemes detected: ${[...schemes].join(', ')}`);

    warnings.push({
      id: 'MW-08',
      message:
        "Warning: Primer naming may prevent reliable pairing.\n" +
        lines.join('\n') + "\n" +
        "The tool will still run, but pairing may not match your intention.\n\n" +
        "Click Cancel to standardize names or OK to proceed."
    });
  }

  // MW-09: Too many primers (performance)
  const totalPrimers = fList.length + rList.length;
  if (totalPrimers > 500) {
    warnings.push({
      id: 'MW-09',
      message:
        "Warning: Large primer set detected.\n" +
        `Total primers: ${totalPrimers}\n` +
        "QC may run slowly and could cause the browser tab to become unresponsive.\n\n" +
        "Click Cancel to reduce your input (e.g., run in batches) or OK to proceed."
    });
  }

  const naMin = 10, naMax = 200;
  const mgMin = 0.5, mgMax = 5;
  const concMin = 25, concMax = 1000;
  const tmMin = 45, tmMax = 75;

  if (!isFinite(Na) || Na < naMin || Na > naMax) {
    warnings.push({
      id: 'MW-10',
      message:
        `Na+ out of range: current ${isFinite(Na) ? Na : 'unset'} mM (recommended ${naMin}–${naMax} mM).\n\n` +
        "Click Cancel to adjust or OK to proceed (results may be unreliable)."
    });
  }

  if (!isFinite(Mg) || Mg < mgMin || Mg > mgMax) {
    warnings.push({
      id: 'MW-11',
      message:
        `Mg2+ out of range: current ${isFinite(Mg) ? Mg : 'unset'} mM (recommended ${mgMin}–${mgMax} mM).\n` +
        "Mg2+ strongly affects Tm and structures; keep it within the recommended range.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if (!isFinite(conc) || conc < concMin || conc > concMax) {
    warnings.push({
      id: 'MW-12',
      message:
        `Primer concentration out of range: current ${isFinite(conc) ? conc : 'unset'} nM (recommended ${concMin}–${concMax} nM).\n\n` +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if (!isFinite(targetTm) || targetTm < tmMin || targetTm > tmMax) {
    warnings.push({
      id: 'MW-13',
      message:
        `Target Tm out of range: current ${isFinite(targetTm) ? targetTm : 'unset'} °C (recommended ${tmMin}–${tmMax} °C).\n\n` +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if (isFinite(Mg) && isFinite(Na) && Mg >= 4 && Na >= 150) {
    warnings.push({
      id: 'MW-14',
      message:
        "High Mg2+ and Na+ concentrations provided simultaneously.\n" +
        "Duplex stability may be substantially overestimated by the model.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if ((isFinite(Na) && Na < 5) || (isFinite(Mg) && Mg > 10) || (isFinite(conc) && conc > 5000)) {
    warnings.push({
      id: 'MW-15',
      message:
        "Selected parameters fall outside the validated range of the thermodynamic model.\n" +
        "Results may not be physically meaningful.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if ((isFinite(targetTm) && targetTm > 85)) {
    warnings.push({
      id: 'MW-16',
      message:
        "Extremely high duplex stability detected (very high Target Tm).\n" +
        "Numerical estimates may be sensitive to small parameter changes.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  } else {
    const anyExtremeDG = [...fAnalyses, ...rAnalyses].some(p => {
      const dg = duplexDG37Worst(p.normalized, true);
      return isFinite(dg) && dg < -25;
    });
    if (anyExtremeDG) {
      warnings.push({
        id: 'MW-16',
        message:
          "Extremely high duplex stability detected (ΔG37 < -25 kcal/mol).\n" +
          "Numerical estimates may be sensitive to small parameter changes.\n\n" +
          "Click Cancel to adjust or OK to proceed."
      });
    }
  }

  const allLens = [...fAnalyses, ...rAnalyses].map(p => p.normalized.length).filter(n => n > 0);
  if (allLens.length > 1) {
    const minLen = Math.min(...allLens);
    const maxLen = Math.max(...allLens);
    if (maxLen - minLen >= 15) {
      warnings.push({
        id: 'MW-17',
        message:
          "Large variation in primer length detected across the dataset.\n" +
          "Cross-primer comparability and scoring may be affected.\n\n" +
          "Click Cancel to adjust or OK to proceed."
      });
    }
  }

  const totalBp = [...fAnalyses, ...rAnalyses].reduce((sum, p) => sum + p.normalized.length, 0);
  if (totalBp > 20000) {
    warnings.push({
      id: 'MW-19',
      message:
        "Large total sequence size detected (>20,000 bp).\n" +
        "Computation may be slow in browser environments.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  // MW-21: Pair-level results largely degraded to single-primer QC
  // Compute reliably paired count using naming-based pairing only
  if (fList.length && rList.length) {
    const fMap = new Map();
    const rMap = new Map();
    for (const f of fList) {
      const header = String(f.label || '').trim();
      let match = header.match(/^(.+?)[-_]?([FRfr])$/);
      let targetName = match ? match[1].trim() : null;
      if (!targetName) {
        match = header.match(/^(.+?)[-_]?(Forward|Reverse|forward|reverse|fwd|rev|FWD|REV)$/i);
        targetName = match ? match[1].trim() : header;
      }
      const arr = fMap.get(targetName) || [];
      arr.push(f);
      fMap.set(targetName, arr);
    }
    for (const r of rList) {
      const header = String(r.label || '').trim();
      let match = header.match(/^(.+?)[-_]?([FRfr])$/);
      let targetName = match ? match[1].trim() : null;
      if (!targetName) {
        match = header.match(/^(.+?)[-_]?(Forward|Reverse|forward|reverse|fwd|rev|FWD|REV)$/i);
        targetName = match ? match[1].trim() : header;
      }
      const arr = rMap.get(targetName) || [];
      arr.push(r);
      rMap.set(targetName, arr);
    }
    let pairedByName = 0;
    for (const [name, fArr] of fMap.entries()) {
      if (rMap.has(name)) {
        const rArr = rMap.get(name);
        pairedByName += Math.min(fArr.length, rArr.length);
      }
    }
    const minPool = Math.min(fList.length, rList.length);
    if (minPool > 0 && (pairedByName / minPool) < 0.5) {
      warnings.push({
        id: 'MW-21',
        message:
          "Most primers could not be paired reliably and were evaluated individually.\n" +
          "Pair-level metrics (e.g., cross-dimer, ΔTm) may be incomplete.\n\n" +
          "Click Cancel to adjust names or OK to proceed."
      });
    }
  }

  return warnings;
}

function renderResultCard(F, R, pair, index, targetTm){
  const hasF = F && !F.empty;
  const hasR = R && !R.empty;
  const anyPrimer = hasF || hasR;
  const bothPrimers = hasF && hasR;

  // Global score
  let global = null;
  if (hasF && hasR){
    let pp = pair && pair.info
      ? (pair.info.cls==="ok"?10:(pair.info.cls==="warn"?-10:-25))
      : 0;
    const dTm = Math.abs(F.tm - R.tm);
    if (dTm > 5) pp -= 10;
    global = Math.round(0.45*F.score + 0.45*R.score + pp);
    if (global < 0) global = 0;
    if (global > 100) global = 100;
  }

  let html = '<div class="qc-card">';
  html += '<div class="section-title">Primer pair ' + index + '</div>';

  if (global !== null){
    const sl = scoreLabel(global);
    const dTm = Math.abs(F.tm - R.tm).toFixed(1);
    const tmStatus = dTm > 5 ? 'bad' : 'ok';
    html +=
      '<div class="score-row">'+
        '<div class="score '+sl.cls+'">'+global+'</div>'+
        '<div>'+
          '<div class="score-caption">Reliability Score: '+sl.txt+
          ' · ΔTm: '+dTm+'°C '+badge(tmStatus, tmStatus==="ok"?"OK":"High Diff")+
          '</div>'+
        '</div>'+
      '</div>';
  } else if (anyPrimer){
    html += '<div class="aside">Only one primer in this pair.</div>';
  } else {
    html += '<div class="aside">No valid primers in this pair.</div>';
  }

  // Per-primer table
  function primerCells(p){
    if (!p || p.empty) return "";
    const tmDiff = (p.tm - targetTm).toFixed(1);
    return ''+'<td>'+p.label+(p.hasIUPAC?'*':'')+'</td>'+
      '<td>'+p.len+'</td>'+
      '<td>'+fmt2(p.gc)+'</td>'+
      '<td>'+fmt2(p.tm)+
         ' <span style="font-size:10px;color:#64748b">('+
         (tmDiff>0?"+":"") + tmDiff +')</span></td>'+
      '<td>'+(p.clamp?badge("ok","G/C"):badge("warn","A/T"))+'</td>'+
      '<td>'+(p.homopoly?badge("warn","High"):badge("ok","OK"))+'</td>'+
      '<td>'+badge(p.hpClass.cls,p.hpClass.label)+'</td>'+
      '<td>'+(isFinite(p.dg3)?fmt2(p.dg3):"--")+'</td>'+
      '<td>'+badge(p.selfClass.cls,p.selfClass.label)+'</td>';
  }

  if (anyPrimer){
    let tableHTML =
      '<div class="section-title">Per-primer metrics</div>'+
      '<table><thead><tr>'+
      '<th>Primer</th><th>Len</th><th>GC%</th><th>Tm (Δ)</th>'+
      '<th>3\' clamp</th><th>Homopoly</th><th>Hairpin</th><th>ΔG(3\' 5bp)</th>'+
      '<th>Self-dimer</th><th style="text-align:center;">Cross-dimer</th>'+
      '</tr></thead><tbody>';

    let crossCellHtml = '';
    if (bothPrimers){
      const inf = pair && pair.info ? pair.info : {label:"None",cls:"ok"};
      crossCellHtml =
        '<td rowspan="2" style="text-align:center;vertical-align:middle;">'+
        badge(inf.cls,inf.label)+'</td>';
    } else {
      crossCellHtml =
        '<td style="text-align:center;vertical-align:middle;">'+
        badge("ok","--")+'</td>';
    }

    let firstRowDone = false;
    if (hasF){
      tableHTML += '<tr>'+ primerCells(F);
      if (crossCellHtml && !firstRowDone){
        tableHTML += crossCellHtml;
        firstRowDone = true;
      }
      tableHTML += '</tr>';
    }
    if (hasR){
      tableHTML += '<tr>'+ primerCells(R);
      if (crossCellHtml && !firstRowDone){
        tableHTML += crossCellHtml;
        firstRowDone = true;
      }
      tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table>';
    // Notes
    const notes = [];
    if (hasF && F.hasIUPAC || hasR && R.hasIUPAC){
      notes.push('* Contains degenerate (IUPAC) bases; Tm and ΔG are estimated for the most stable variant (worst-case).');
    }
    if (notes.length){
      tableHTML += '<div class="aside" style="margin-top:4px;">'+notes.join(' ')+'</div>';
    }
    html += tableHTML;
  }

  // Structures block (dimers only, no hairpin drawing yet)
  const blocks = [];
  function addDimerBlock(title, info, obj){
    if (!obj) return;
    const desc = info.label + ' · ΔG ≈ ' + fmt2(obj.dg) + ' kcal/mol' +
      (obj.touches3 ? ' · <strong style="color:var(--danger)">Touches 3\'</strong>' : '');
    blocks.push(
      '<div class="struct-block">' +
        '<div class="aside" style="margin-bottom:4px;"><strong>' +
        title +
        ':</strong> ' + desc + '</div>' +
        '<pre class="align mono">' + obj.align + '</pre>' +
      '</div>'
    );
  }

  if (hasF){
    if (F.selfD) addDimerBlock("Self-dimer ("+F.label+")", F.selfClass, F.selfD);
    else blocks.push('<div class="struct-block"><div class="aside"><strong>Self-dimer ('+F.label+')</strong>: None detected</div></div>');
  }
  if (hasR){
    if (R.selfD) addDimerBlock("Self-dimer ("+R.label+")", R.selfClass, R.selfD);
    else blocks.push('<div class="struct-block"><div class="aside"><strong>Self-dimer ('+R.label+')</strong>: None detected</div></div>');
  }
  if (bothPrimers && pair && pair.dimer) addDimerBlock("Cross-dimer", pair.info, pair.dimer);

  if (blocks.length){
    html += '<div class="section-title">Predicted structures</div>'+blocks.join("");
  }

  html += '</div>'; // end qc-card
  return html;
}


function applyRCToTextarea(id){
  const container = document.getElementById('module-content') || document.body;
  const ta = container.querySelector('#' + id);
  if (!ta) return;
  const raw = (ta.value || "").trim();
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

  const map = IUPAC_COMP; // reuse global complement map
  function rcSeq(s){
    return s.split('').reverse().map(b => map[b] || 'N').join('');
  }

  // Toggle: if header already has (RC), strip it and RC again to restore;
  // otherwise append (RC) and RC once.
  ta.value = records
    .map(r => {
      const header = r.header || '>RC';
      const hasRC = /\(RC\)\s*$/i.test(header);
      const baseHeader = hasRC ? header.replace(/\s*\(RC\)\s*$/i, '') : header;
      const newHeader = hasRC ? baseHeader : (baseHeader + ' (RC)');
      const newSeq = rcSeq(r.seq);
      return newHeader + '\n' + newSeq;
    })
    .join('\n');
}

/**
 * Show warning modal for incomplete primer pairs
 */
function showQCWarningModal(container, message, onConfirm, onCancel) {
  // Create modal if it doesn't exist
  let modal = container.querySelector('#qc-warning-modal');
  if (!modal) {
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
      #qc-warning-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .qc-warning-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .qc-warning-modal-content {
        position: relative;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: qcModalSlideIn 0.3s ease-out;
      }
      @keyframes qcModalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .qc-warning-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px;
        background: #fff7ed;
        border-bottom: 1px solid #fde68a;
      }
      .qc-warning-icon {
        font-size: 1.5rem;
        line-height: 1;
      }
      .qc-warning-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #92400e;
        font-weight: 600;
      }
      .qc-warning-modal-body {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .qc-warning-modal-body p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-line;
      }
      .qc-warning-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      .qc-warning-modal-footer .btn {
        min-width: 80px;
      }
    `;
    document.head.appendChild(style);
    
    modal = document.createElement('div');
    modal.id = 'qc-warning-modal';
    modal.style.display = 'none';
    
    const overlay = document.createElement('div');
    overlay.className = 'qc-warning-modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'qc-warning-modal-content';
    
    const header = document.createElement('div');
    header.className = 'qc-warning-modal-header';
    const icon = document.createElement('span');
    icon.className = 'qc-warning-icon';
    icon.textContent = '⚠️';
    const title = document.createElement('h3');
    title.textContent = 'Warning';
    header.appendChild(icon);
    header.appendChild(title);
    
    const body = document.createElement('div');
    body.className = 'qc-warning-modal-body';
    const messageP = document.createElement('p');
    messageP.id = 'qc-warning-message';
    body.appendChild(messageP);
    
    const footer = document.createElement('div');
    footer.className = 'qc-warning-modal-footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'qc-warning-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn ghost';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'qc-warning-confirm-btn';
    confirmBtn.textContent = 'OK';
    confirmBtn.className = 'btn';
    
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    
    modal.appendChild(overlay);
    modal.appendChild(content);
    
    // Append to container or body
    const parent = container || document.body;
    parent.appendChild(modal);
  }
  
  // Update message
  const messageEl = modal.querySelector('#qc-warning-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Remove existing listeners and add new ones
  const confirmBtn = modal.querySelector('#qc-warning-confirm-btn');
  const cancelBtn = modal.querySelector('#qc-warning-cancel-btn');
  const overlay = modal.querySelector('.qc-warning-modal-overlay');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  // Clone buttons to remove old listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  
  newConfirmBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  newCancelBtn.onclick = () => {
    closeModal();
    if (onCancel) onCancel();
  };
  
  if (overlay) {
    overlay.onclick = () => {
      closeModal();
      if (onCancel) onCancel();
    };
  }
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function initQC_V4(container) {
  // Make sure container is set
  if (!container) {
    container = document.getElementById('module-content') || document.body;
  }
  
  // Reset button
  const resetBtn = container.querySelector("#global-reset");
  if (resetBtn) {
    resetBtn.onclick = function() {
      // Full page refresh to reset state
      window.location.reload();
    };
  }
  
  const runBtn = container.querySelector("#run");
  if (runBtn) {
    runBtn.onclick = function(){
      const fRaw = container.querySelector("#fwd")?.value || "";
      const rRaw = container.querySelector("#rev")?.value || "";
      const Na = parseFloat(container.querySelector("#na")?.value||"50");
      const Mg = parseFloat(container.querySelector("#mg")?.value||"0");
      const conc = parseFloat(container.querySelector("#conc")?.value||"500");
      const targetTm = parseFloat(container.querySelector("#tmTarget")?.value||"55");

      const fList = parsePrimerList(fRaw, "F");
      const rList = parsePrimerList(rRaw, "R");

      if (fList.length === 0 && rList.length === 0){
        showQCWarningModal(container,
          "Warning: No primers provided.\nPlease enter at least one primer in either input box.",
          () => {},
          () => {}
        );
        return;
      }

      const warnings = buildQCPreflightWarnings(fList, rList, fRaw, rRaw, Na, Mg, conc, targetTm);
      if (warnings.length) {
        let idx = 0;
        const showNext = () => {
          idx += 1;
          if (idx >= warnings.length) {
            proceedWithQC();
            return;
          }
          showQCWarningModal(container, warnings[idx].message, showNext, () => {});
        };
        showQCWarningModal(container, warnings[0].message, showNext, () => {});
        return;
      }

      proceedWithQC();

      function proceedWithQC() {
        // Smart pairing: try to match primers by name patterns, fall back to index-based pairing
        const pairs = smartPairPrimers(fList, rList);
        
        let allHtml = "";

        for (let i = 0; i < pairs.length; i++){
          const pair = pairs[i];
          const fInfo = pair.forward || { label: "Forward " + (i+1), seq: "" };
          const rInfo = pair.reverse || { label: "Reverse " + (i+1), seq: "" };

          const F = qcPrimer(fInfo.label, fInfo.seq, Na, Mg, conc);
          const R = qcPrimer(rInfo.label, rInfo.seq, Na, Mg, conc);
          const pairResult = qcPair(F, R);

          allHtml += renderResultCard(F, R, pairResult, i+1, targetTm);
        }

        const res = container.querySelector("#results");
        if (res) res.innerHTML = allHtml;
      }
    };
  }

  const clearBtn = container.querySelector("#clear");
  if (clearBtn) {
    clearBtn.onclick = function(){
      const fwd = container.querySelector("#fwd");
      const rev = container.querySelector("#rev");
      if (fwd) fwd.value = "";
      if (rev) rev.value = "";
      const res = container.querySelector("#results");
      if (res) res.innerHTML = "";
    };
  }

  // Demo Set button (moved to top right)
  const demoSetBtn = container.querySelector("#demo-set-btn");
  if (demoSetBtn) {
    demoSetBtn.onclick = function(){
      const fwd = container.querySelector("#fwd");
      const rev = container.querySelector("#rev");
      if (fwd) {
        fwd.value = ">primer1-F\nATGGTGAGRAAGGGAGGAG\n>primer2-F\nGCTACCGTAACTGCGTACAA";
      }
      if (rev) {
        rev.value = ">primer1-R\nCTTGTACAGCTCGTCATGCC\n>primer2-R\nTTGCTACGCAGTTACGGTAC";
      }
    };
  }

  // Forward primer Demo and Upload buttons
  const btnFwdUpload = container.querySelector("#btn-fwd-upload");
  if (btnFwdUpload) {
    btnFwdUpload.addEventListener('click', () => container.querySelector("#file-fwd").click());
  }
  const fileFwd = container.querySelector("#file-fwd");
  if (fileFwd) {
    fileFwd.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const fwd = container.querySelector("#fwd");
        if (fwd) fwd.value = ev.target.result;
      };
      r.readAsText(f);
    });
  }
  const btnFwdDemo = container.querySelector("#btn-fwd-demo");
  if (btnFwdDemo) {
    btnFwdDemo.addEventListener('click', () => {
      const fwd = container.querySelector("#fwd");
      if (fwd) {
        fwd.value = ">primer1-F\nATGGTGAGRAAGGGAGGAG\n>primer2-F\nGCTACCGTAACTGCGTACAA";
      }
    });
  }

  // Reverse primer Demo and Upload buttons
  const btnRevUpload = container.querySelector("#btn-rev-upload");
  if (btnRevUpload) {
    btnRevUpload.addEventListener('click', () => container.querySelector("#file-rev").click());
  }
  const fileRev = container.querySelector("#file-rev");
  if (fileRev) {
    fileRev.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const rev = container.querySelector("#rev");
        if (rev) rev.value = ev.target.result;
      };
      r.readAsText(f);
    });
  }
  const btnRevDemo = container.querySelector("#btn-rev-demo");
  if (btnRevDemo) {
    btnRevDemo.addEventListener('click', () => {
      const rev = container.querySelector("#rev");
      if (rev) {
        rev.value = ">primer1-R\nCTTGTACAGCTCGTCATGCC\n>primer2-R\nTTGCTACGCAGTTACGGTAC";
      }
    });
  }

  const fwdRC = container.querySelector("#fwdRC");
  if (fwdRC) fwdRC.onclick = function(){ applyRCToTextarea("fwd"); };
  const revRC = container.querySelector("#revRC");
  if (revRC) revRC.onclick = function(){ applyRCToTextarea("rev"); };
}

// Export for manual initialization from app-main.js
if (typeof window !== 'undefined') {
  window.initQC_V4 = initQC_V4;
}

export { initQC_V4 };
