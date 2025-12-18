// core.js - PrimerWeaver core computation and parsing utilities
// ES module: all exports are named. No DOM or UI logic here.

// ============================================================================
// 0. IUPAC and DNA basics
// ============================================================================

// IUPAC base -> concrete bases
export const IUPAC_MAP = {
  A: ["A"], C: ["C"], G: ["G"], T: ["T"], U: ["T"],
  R: ["A","G"], Y:["C","T"], S:["G","C"], W:["A","T"],
  K:["G","T"], M:["A","C"],
  B:["C","G","T"], D:["A","G","T"], H:["A","C","T"], V:["A","C","G"],
  N:["A","C","G","T"],
  // Extended support: I (inosine), P (any), X (unknown) -> treat as N
  I: ["A","C","G","T"], P: ["A","C","G","T"], X: ["A","C","G","T"]
};

// IUPAC complement map
export const IUPAC_COMP = {
  A:"T", C:"G", G:"C", T:"A", U:"A",
  R:"Y", Y:"R", S:"S", W:"W",
  K:"M", M:"K",
  B:"V", V:"B", D:"H", H:"D",
  N:"N",
  // Extended support: I, P, X -> complement as N
  I:"N", P:"N", X:"N"
};

/**
 * Return the possible base set for an IUPAC symbol.
 * If unknown, returns [].
 */
export function baseSet(b) {
  const up = (b || "").toUpperCase();
  return IUPAC_MAP[up] || [];
}

/**
 * IUPAC-aware complementarity test.
 * Returns true if there exists at least one pairing (x in b1-set, y in b2-set)
 * such that y is the Watson-Crick complement of x.
 */
export function isComplementaryIUPAC(b1, b2) {
  const s1 = baseSet(b1);
  const s2 = baseSet(b2);
  if (!s1.length || !s2.length) return false;
  for (let i = 0; i < s1.length; i++) {
    const c = IUPAC_COMP[s1[i]];
    if (!c) continue;
    if (s2.includes(c)) return true;
  }
  return false;
}

/**
 * Normalize a raw sequence by:
 *  - converting to uppercase
 *  - keeping only valid IUPAC DNA symbols (A,C,G,T,U,R,Y,S,W,K,M,B,D,H,V,N,I,P,X)
 * U is mapped to T at the end (for convenience).
 * I (inosine), P, X are treated as N (any base).
 */
export function normalizeSeq(raw = "") {
  if (!raw) return "";
  const up = raw.toUpperCase().replace(/[^ACGTURYSWKMBDHVNIPX]/g, "");
  // Map U to T
  // Map I, P, X to N (any base)
  return up.replace(/U/g, "T").replace(/[IPX]/g, "N");
}

/**
 * Reverse-complement a DNA sequence, IUPAC-aware.
 */
export function reverseComplementSeq(seq = "") {
  const up = seq.toUpperCase();
  let out = "";
  for (let i = up.length - 1; i >= 0; i--) {
    const b = up[i];
    out += IUPAC_COMP[b] || "N";
  }
  return out;
}

/**
 * GC percentage (0-100). Returns 0 for empty strings.
 */
export function gcPct(seq = "") {
  const s = (seq || "").toUpperCase();
  if (!s.length) return 0;
  const m = s.match(/[GC]/g);
  return m ? (m.length * 100) / s.length : 0;
}

/**
 * Detect homopolymer runs of length >= maxRun (default 4).
 * Only checks A/C/G/T.
 */
export function hasHomopolymer(seq = "", maxRun = 4) {
  if (!seq || maxRun <= 1) return false;
  const n = maxRun;
  const re = new RegExp(`A{${n},}|C{${n},}|G{${n},}|T{${n},}`, "i");
  return re.test(seq);
}

// ============================================================================
// 1. FASTA & Primer Parsing
// ============================================================================

/**
 * Extract the first FASTA header from a raw input string.
 * Useful for displaying vector/insert names in UI components.
 *
 * @param {string} raw - The raw FASTA or sequence string.
 * @returns {string} The header line without the leading ">", or an empty string.
 */
export function extractFirstHeader(raw = "") {
  const m = raw.match(/^>(.*)$/m);
  return m ? m[1].trim() : "";
}

/**
 * Parse a FASTA block defined by one header and its following sequence lines.
 * This helper supports:
 *   - FASTA with header
 *   - Blocks without header (raw sequence mode)
 *
 * @param {string[]} lines - Lines belonging to one FASTA record.
 * @returns {{header: string, seq: string} | null}
 */
export function splitHeaderAndSeqBlock(lines) {
  if (!lines.length) return null;

  let header = "";
  let seqLines = [];

  // If the first line is a header (">something"), extract it
  if (lines[0].startsWith(">")) {
    header = lines[0].slice(1).trim();
    seqLines = lines.slice(1);
  } else {
    // Raw sequence without header
    seqLines = lines;
  }

  const seq = normalizeSeq(seqLines.join(""));
  if (!seq.length) return null;

  return { header, seq };
}

/**
 * Parse a multi-FASTA or raw sequence input.
 * Key behaviors:
 *   - Accepts multi-FASTA: >A ...  >B ...
 *   - Accepts single-FASTA
 *   - Accepts raw sequence with no header (returned as {header:"", seq})
 *   - Removes empty lines automatically
 *
 * @param {string} raw - Raw FASTA text or plain DNA sequence.
 * @returns {Array<{header: string, seq: string}>}
 */
export function parseFASTA(raw = "") {
  const text = raw.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const records = [];
  let currentLines = [];

  const pushCurrent = () => {
    const rec = splitHeaderAndSeqBlock(currentLines);
    if (rec) records.push(rec);
  };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith(">")) {
      if (currentLines.length) pushCurrent();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length) pushCurrent();

  // Handle raw non-FASTA input (no header at all)
  if (!records.length) {
    const seq = normalizeSeq(text);
    if (seq.length) {
      records.push({ header: "", seq });
    }
  }

  return records;
}

/**
 * Parse a plain primer list (one primer per line).
 * Supported formats:
 *   - "name ATGCGTAGCTA"
 *   - "ATGCGTAGCTA"   → assigned auto name: primer_1
 *
 * @param {string} raw - Multi-line primer list.
 * @returns {Array<{label: string, seq: string}>}
 */
export function parsePrimerList(raw = "") {
  const lines = raw.split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const primers = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/\s+/);

    let label, seqRaw;

    if (parts.length === 1) {
      label = `primer_${idx + 1}`;
      seqRaw = parts[0];
    } else {
      label = parts[0];
      seqRaw = parts.slice(1).join("");
    }

    const seq = normalizeSeq(seqRaw);
    if (seq.length) {
      primers.push({ label, seq });
    }
  });

  return primers;
}

// ============================================================================
// 2. Thermodynamics (NN model, dH/dS/dG, Tm)
// ============================================================================

// SantaLucia (1998) / Allawi (1997) NN parameters (DNA/DNA in 1M Na+)
// Units: dH (kcal/mol), dS (cal/mol*K)
export const NN = {
  AA: { dH: -7.9, dS: -22.2 }, TT: { dH: -7.9, dS: -22.2 },
  AT: { dH: -7.2, dS: -20.4 }, TA: { dH: -7.2, dS: -21.3 },
  CA: { dH: -8.5, dS: -22.7 }, TG: { dH: -8.5, dS: -22.7 },
  GT: { dH: -8.4, dS: -22.4 }, AC: { dH: -8.4, dS: -22.4 },
  CT: { dH: -7.8, dS: -21.0 }, AG: { dH: -7.8, dS: -21.0 },
  GA: { dH: -8.2, dS: -22.2 }, TC: { dH: -8.2, dS: -22.2 },
  CG: { dH: -10.6, dS: -27.2 }, GC: { dH: -9.8, dS: -24.4 },
  GG: { dH: -8.0, dS: -19.9 }, CC: { dH: -8.0, dS: -19.9 }
};

// Loop entropy penalty (kcal/mol) — approximate from SantaLucia 2004
export const LOOP_PENALTY = {
  3: 5.7, 4: 5.6, 5: 4.9, 6: 4.4, 7: 4.5, 8: 4.6, 9: 4.6
};

export const Rgas = 1.987; // cal/(mol*K)

/**
 * Accumulate nearest-neighbor parameters for the "worst case" (most stable)
 * compatible pairing of an IUPAC-aware sequence (single strand).
 * This is used as a risk-averse estimate of dH, dS for potential duplexes.
 *
 * @param {string} seq - DNA sequence (IUPAC allowed).
 * @returns {{dH:number, dS:number} | null}
 */
export function accumulateNNWorst(seq) {
  const s = normalizeSeq(seq);
  if (s.length < 2) return null;
  const Tref = 310.15; // 37 °C in Kelvin
  let dH = 0;
  let dS = 0;

  for (let i = 0; i < s.length - 1; i++) {
    const b1 = s[i];
    const b2 = s[i + 1];
    const set1 = baseSet(b1);
    const set2 = baseSet(b2);
    if (!set1.length || !set2.length) return null;

    let bestStep = null;
    for (let x = 0; x < set1.length; x++) {
      for (let y = 0; y < set2.length; y++) {
        const dinuc = set1[x] + set2[y];
        const p = NN[dinuc];
        if (!p) continue;
        const dG = p.dH - (Tref * p.dS) / 1000.0;
        if (!bestStep || dG < bestStep.dG) {
          bestStep = { dH: p.dH, dS: p.dS, dG };
        }
      }
    }
    if (!bestStep) return null;
    dH += bestStep.dH;
    dS += bestStep.dS;
  }

  // Terminal correction (initiation) — small adjustment
  dH += 0.2;
  dS += -5.7;

  return { dH, dS };
}

/**
 * Approximate duplex ΔG°37 (kcal/mol) for a self-duplex of seq (risk-averse NN).
 * If isSymmetric is true, applies symmetry correction to entropy.
 */
export function duplexDG37Worst(seq, isSymmetric = false) {
  const acc = accumulateNNWorst(seq);
  if (!acc) return NaN;
  const T = 310.15; // 37 °C
  let dS = acc.dS;
  if (isSymmetric) dS -= 1.4; // symmetry correction
  return acc.dH - (T * dS) / 1000.0;
}

/**
 * Tm calculation using NN thermodynamics (SantaLucia 1998) with
 * salt and Mg2+ correction (Owczarzy / von Ahsen-like approximation).
 *
 * seq: primer sequence
 * Na_mM: monovalent cation concentration (mM)
 * Mg_mM: Mg2+ concentration (mM)
 * conc_nM: total primer concentration (nM)
 *
 * Returns Tm in °C or NaN on failure.
 */
export function tmcalNN(seq, Na_mM, Mg_mM, conc_nM) {
  const s = normalizeSeq(seq);
  if (s.length < 2) return NaN;
  const acc = accumulateNNWorst(s);
  if (!acc) return NaN;

  const Cp = conc_nM * 1e-9; // total primer concentration in M
  if (Cp <= 0) return NaN;

  // Effective monovalent concentration (very simplified)
  // [Na_eq] = [Na+] + 4 * sqrt([Mg2+])  (mM)
  const monovalentEq_mM = Na_mM + 4.0 * Math.sqrt(Math.max(Mg_mM, 0));
  if (monovalentEq_mM <= 0) return NaN;
  const monovalentEq = monovalentEq_mM / 1000.0; // to M

  const dH = acc.dH * 1000.0; // cal/mol
  const dS = acc.dS;          // cal/mol*K

  // Base entropy term (non-self duplex, Cp/4 is common approximation)
  const baseEntropy = dS + Rgas * Math.log(Cp / 4.0);

  // Salt correction for entropy: 0.368 * (N-1) * ln[Na_eq]
  const dS_salt = baseEntropy + 0.368 * (s.length - 1) * Math.log(monovalentEq);

  const Tm_K = dH / dS_salt;
  return Tm_K - 273.15;
}

/**
 * Simplified Tm calculation (NEB-like) ignoring Mg2+ and using 50 mM Na+.
 * Useful for quick overlap checks (e.g. Gibson).
 */
export function tmSimple(seq, conc_nM = 500, Na_mM = 50) {
  return tmcalNN(seq, Na_mM, 0, conc_nM);
}

// ============================================================================
// 3. Secondary structure & dimer scanning (hairpins, self-dimers, cross-dimers)
// ============================================================================

/**
 * Get an approximate entropy penalty (kcal/mol) for a hairpin loop
 * of size 'len'. Large loops are extrapolated linearly.
 */
export function getLoopPenalty(len) {
  if (len < 3) return 999; // impossible / prohibitively large
  if (LOOP_PENALTY[len]) return LOOP_PENALTY[len];
  // Linear approximation for longer loops
  return 4.6 + 0.1 * (len - 9);
}

/**
 * Scan a single sequence for the most stable hairpin structure.
 * Returns an object summarizing the worst (most negative) ΔG37,
 * or null if no hairpin above a minimal threshold is found.
 *
 * This is a heuristic / approximate scan, not a full DP folding algorithm.
 */
export function hairpinScan(seq) {
  const s = normalizeSeq(seq);
  const n = s.length;
  const minStem = 3;
  const minLoop = 3;

  let best = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + minStem + minLoop; j < n; j++) {
      // Try to grow a stem around (i, j-1)
      let stem = 0;
      while (
        i + stem < j - minLoop - stem &&
        j - 1 - stem >= 0 &&
        isComplementaryIUPAC(s[i + stem], s[j - 1 - stem])
      ) {
        stem++;
      }

      if (stem >= minStem) {
        const loopSize = (j - i) - 2 * stem;
        if (loopSize < minLoop) continue;

        const left = s.slice(i, i + stem);
        const right = reverseComplementSeq(s.slice(j - stem, j));
        const stemSeq = left + right;

        const dG = duplexDG37Worst(stemSeq, true) + getLoopPenalty(loopSize);
        if (!isFinite(dG)) continue;

        if (!best || dG < best.dG) {
          best = {
            dG,
            stem,
            loop: loopSize,
            start: i,
            end: j,
            stemSeq
          };
        }
      }
    }
  }

  return best;
}

/**
 * Scan for the most stable duplex between two sequences (self- or cross-dimer).
 * This is a simplified local alignment for ΔG prediction, risk-averse NN model.
 *
 * Returns the worst dG and whether the interaction touches the 3' end of seqA.
 */
export function dimerScan(seqA, seqB) {
  const a = normalizeSeq(seqA);
  const b = normalizeSeq(seqB);
  const ra = a;              // 5'→3' of first strand
  const rb = reverseComplementSeq(b); // 5'→3' complement of second strand

  const la = ra.length;
  const lb = rb.length;
  if (!la || !lb) return null;

  let best = null;

  // We slide rb relative to ra, allowing partial overlaps.
  // offset < 0 means rb starts before ra; offset >= 0 means rb starts inside ra.
  for (let offset = -lb + 1; offset < la; offset++) {
    let overlap = "";

    for (let i = 0; i < lb; i++) {
      const ai = offset + i;
      if (ai < 0 || ai >= la) continue;
      const c1 = ra[ai];
      const c2 = rb[i];

      if (isComplementaryIUPAC(c1, c2)) {
        overlap += c1;
      } else {
        // break possible contiguous block; we only consider contiguous binding
        if (overlap.length >= 2) {
          const dG = duplexDG37Worst(overlap, false);
          if (isFinite(dG)) {
            const touches3 = (offset + i === la - 1); // last base of ra?
            if (!best || dG < best.dG) {
              best = { dG, overlap, offset, touches3 };
            }
          }
        }
        overlap = "";
      }
    }

    // End-of-scan flush
    if (overlap.length >= 2) {
      const dG = duplexDG37Worst(overlap, false);
      if (isFinite(dG)) {
        const touches3 = (offset + (overlap.length - 1) === la - 1);
        if (!best || dG < best.dG) {
          best = { dG, overlap, offset, touches3 };
        }
      }
    }
  }

  return best;
}

/**
 * Convenience wrapper to get the worst self-dimer of a sequence.
 */
export function selfDimerScan(seq) {
  return dimerScan(seq, seq);
}

/**
 * Classify a ΔG interaction into qualitative categories, and mark if
 * the interaction touches the 3' end.
 *
 * Returns: { label: string, cls: "ok"|"warn"|"bad" }
 */
export function classifyDG(dg, touches3) {
  if (!isFinite(dg)) return { label: "None", cls: "ok" };

  let label, cls;
  if (dg <= -7) {
    label = "Very strong (≤ -7)";
    cls = "bad";
  } else if (dg <= -5) {
    label = "Strong (-7 ~ -5)";
    cls = "bad";
  } else if (dg <= -3) {
    label = "Moderate (-5 ~ -3)";
    cls = "warn";
  } else {
    label = "Weak (> -3)";
    cls = "ok";
  }
  if (touches3 && cls !== "ok") label = "3′ " + label;
  return { label, cls };
}

/**
 * Quick 3'-end stability descriptor for a primer.
 * Looks at the last 4 bases by default and estimates ΔG37Worst.
 */
export function threePrimeDG(seq, window = 4) {
  const s = normalizeSeq(seq);
  if (s.length < 2) return NaN;
  const w = Math.min(window, s.length);
  const tail = s.slice(-w);
  return duplexDG37Worst(tail, true);
}

// ============================================================================
// 4. Primer QC scoring helpers
// ============================================================================

/**
 * Evaluate a single primer and return a detailed QC object.
 * This is intentionally general and does not depend on any UI layer.
 */
export function qcSinglePrimer(seq, {
  Na_mM = 50,
  Mg_mM = 0,
  conc_nM = 500,
  tmTarget = 60,
  homopolymerMax = 4
} = {}) {
  const s = normalizeSeq(seq);
  const len = s.length;
  const gc = gcPct(s);
  const tm = tmcalNN(s, Na_mM, Mg_mM, conc_nM);
  const hp = hairpinScan(s);
  const sd = selfDimerScan(s);
  const threeDG = threePrimeDG(s);

  const homopolymerFlag = hasHomopolymer(s, homopolymerMax);

  // Rough scoring heuristic (0-100)
  let score = 100;

  // Length penalties
  if (len < 15 || len > 35) score -= 20;

  // Tm deviation
  if (isFinite(tm)) {
    const diff = Math.abs(tm - tmTarget);
    if (diff > 5) score -= 20;
    else if (diff > 3) score -= 10;
  } else {
    score -= 30;
  }

  // GC range penalty
  if (gc < 30 || gc > 70) score -= 10;

  // Hairpin penalty
  if (hp && hp.dG <= -5) {
    score -= 20;
  } else if (hp && hp.dG <= -3) {
    score -= 10;
  }

  // Self-dimer penalty
  if (sd && sd.dG <= -7) {
    score -= 25;
  } else if (sd && sd.dG <= -5) {
    score -= 15;
  }

  // 3' stability penalty (too strong)
  if (isFinite(threeDG) && threeDG <= -5) {
    score -= 10;
  }

  // Homopolymer penalty
  if (homopolymerFlag) {
    score -= 10;
  }

  if (score < 0) score = 0;

  return {
    seq: s,
    length: len,
    gc,
    tm,
    hairpin: hp,
    selfDimer: sd,
    threePrimeDG: threeDG,
    homopolymer: homopolymerFlag,
    score
  };
}

/**
 * QC a primer pair (forward / reverse), including:
 *   - individual primer QC (via qcSinglePrimer)
 *   - cross-dimer assessment
 */
export function qcPrimerPair(fwd, rev, options = {}) {
  const qF = qcSinglePrimer(fwd, options);
  const qR = qcSinglePrimer(rev, options);
  const cross = dimerScan(fwd, rev);
  return {
    fwd: qF,
    rev: qR,
    crossDimer: cross
  };
}

/**
 * Map a numeric score (0-100) to a qualitative label.
 */
export function scoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score > 0)   return "Poor";
  return "Fail";
}

// ============================================================================
// 5. Gel-core helpers (no drawing, only band model)
// ============================================================================

/**
 * Ladder profiles for virtual gel simulation.
 * Sizes in kb, unordered; boldKb marks bands typically drawn stronger.
 */
export const LADDER_PROFILES = {
  neb1kbplus: {
    name: "NEB 1kb Plus DNA Ladder",
    sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.2, 1.0,
              0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
    boldKb: [3.0, 1.0, 0.5]
  },
  neb1kb: {
    name: "NEB 1kb DNA Ladder",
    sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.0, 0.5],
    boldKb: [3.0]
  },
  thermo1kbruler: {
    name: "GeneRuler 1kb DNA Ladder",
    sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.5, 3.0, 2.5, 2.0,
              1.5, 1.0, 0.75, 0.5, 0.25],
    boldKb: [6.0, 3.0, 1.0]
  },
  thermo1kbplus: {
    name: "GeneRuler 1kb Plus DNA Ladder",
    sizesKb: [20.0, 10.0, 7.0, 5.0, 4.0, 3.0, 2.0, 1.5,
              1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.075],
    boldKb: [10.0, 3.0, 1.0]
  }
};

// Empirical constants for migration vs log10(bp).
// y = A + B * log10(bp). UI layer can scale/shift as needed.
export const GEL_MIG_A = 10;
export const GEL_MIG_B = 120;

/**
 * Map fragment size (bp) to an arbitrary vertical position (migration distance).
 * Higher y can mean "lower on the gel" depending on canvas convention.
 */
export function gelYFromBp(bp) {
  const len = Math.max(50, bp); // clamp to reasonable range
  return GEL_MIG_A + GEL_MIG_B * Math.log10(len);
}

/**
 * Approximate effective size (bp) for supercoiled plasmids.
 * Often run slightly faster than linear DNA of same length.
 * Very simple heuristic used for display only.
 */
export function effectiveScBp(bp) {
  return Math.max(100, bp * 0.7);
}

// ============================================================================
// 6. Feature detection core (vector map)
// ============================================================================

/**
 * Internal: seed-based approximate matcher.
 * Returns the best match position and mismatch count for 'pattern'
 * within 'haystack', allowing up to maxMismatchFrac * pattern.length mismatches.
 *
 * Very lightweight helper used for feature detection only.
 */
function bestApproxSeedMatch(haystack, pattern, maxMismatchFrac) {
  const H = haystack.length;
  const P = pattern.length;
  if (!H || !P || P > H) return { idx: -1, mismatches: P + 1 };

  const maxMismatch = Math.floor(P * maxMismatchFrac);

  const seedLen = Math.min(12, P);
  const seedStart = Math.floor((P - seedLen) / 2);
  const seed = pattern.slice(seedStart, seedStart + seedLen);

  let bestIdx = -1;
  let bestMM = P + 1;
  let from = 0;

  while (true) {
    const pos = haystack.indexOf(seed, from);
    if (pos === -1) break;
    const start = pos - seedStart;
    from = pos + 1;
    if (start < 0 || start + P > H) continue;

    let mm = 0;
    for (let j = 0; j < P; j++) {
      if (haystack[start + j] !== pattern[j]) {
        mm++;
        if (mm > maxMismatch) break;
      }
    }
    if (mm <= maxMismatch && mm < bestMM) {
      bestMM = mm;
      bestIdx = start;
    }
  }

  return { idx: bestIdx, mismatches: bestMM };
}

/**
 * Simple feature type → color mapping helper.
 * UI layer can ignore or override these colors if desired.
 */
export function getFeatureColor(type) {
  const t = (type || "").toLowerCase();
  // Check more specific types first, then general ones
  if (t.includes("origin") || t.includes("ori")) return "#fbbf24";
  if (t.includes("terminator") || t === "terminator") return "#a78bfa";
  if (t.includes("promoter") || t === "promoter") return "#4ade80";
  if (t.includes("cds") || t.includes("gene") || t.includes("orf")) return "#22c55e";
  if (t.includes("marker") || t.includes("resist")) return "#f87171";
  if (t.includes("tag")) return "#38bdf8";
  return "#a5b4fc";
}

/**
 * Detect approximate features in a plasmid sequence using a small feature DB.
 *
 * featureDB is an array of objects like:
 *   { name: "AmpR", sequence: "ATG...", type: "marker" }
 *
 * Returns non-overlapping features:
 *   [{ name, start, end, color }]
 */
export function detectFeatures(seq, featureDB = []) {
  const seqU = normalizeSeq(seq);
  const rc = reverseComplementSeq(seqU);
  const L = seqU.length;

  const rawFeats = [];

  for (const f of featureDB) {
    let pattern = (f.sequence || f.seq || "").toUpperCase().replace(/[^ACGT]/g, "");
    if (!pattern) continue;

    const lenPat = pattern.length;
    if (lenPat < 150) continue; // ignore very short noisy features

    const name = f.name || f.original_name || "feature";
    // Determine color: check name first (for cases where type might be wrong),
    // then fall back to type
    let colorType = f.type || "";
    const nameLower = name.toLowerCase();
    // If name contains specific feature keywords, use those instead of type
    // Check more specific patterns first
    if (nameLower.includes("terminator")) {
      colorType = "terminator";
    } else if (nameLower.includes("promoter")) {
      colorType = "promoter";
    } else if (nameLower.includes("origin") || nameLower.match(/\bori\b/)) {
      // Match "ori" as a whole word (not just as part of other words like "origin")
      // But also match "origin" as substring
      colorType = "origin";
    } else if (nameLower.match(/\bcds\b/) || nameLower.includes("gene") || nameLower.match(/\borf\b/)) {
      colorType = "cds";
    }
    const color = getFeatureColor(colorType);

    const fwd = bestApproxSeedMatch(seqU, pattern, 0.05);
    const rev = bestApproxSeedMatch(rc, pattern, 0.05);

    if (fwd.idx === -1 && rev.idx === -1) continue;

    if (rev.idx === -1 || (fwd.idx !== -1 && fwd.mismatches <= rev.mismatches)) {
      rawFeats.push({
        name,
        start: fwd.idx,
        end: fwd.idx + lenPat,
        len: lenPat,
        color
      });
    } else {
      const start = L - (rev.idx + lenPat);
      rawFeats.push({
        name,
        start,
        end: start + lenPat,
        len: lenPat,
        color
      });
    }
  }

  // If multiple features overlap, keep only the longest at each region.
  rawFeats.sort((a, b) => {
    if (a.start === b.start) return b.len - a.len;
    return a.start - b.start;
  });

  const kept = [];
  rawFeats.forEach(f => {
    const overlap = kept.some(k => !(f.end <= k.start || f.start >= k.end));
    if (!overlap) kept.push(f);
  });

  return kept.map(({ name, start, end, color }) => ({ name, start, end, color }));
}

// ============================================================================
// 7. Circular sequence helpers (for RE / assembly modules)
// ============================================================================

/**
 * Extract a subsequence from a circular sequence.
 * start and end are 0-based, inclusive-exclusive indices (like slice),
 * but can wrap around the end of the circle.
 */
export function subseqCircular(seq, start, end) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) return "";

  let a = ((start % L) + L) % L;
  let b = ((end   % L) + L) % L;

  if (a < b) {
    return s.slice(a, b);
  } else if (a > b) {
    return s.slice(a) + s.slice(0, b);
  } else {
    // full circle
    return s;
  }
}

/**
 * Convenience helper to rotate a circular sequence by 'offset' bases.
 * Positive offset moves the origin forward.
 */
export function rotateCircular(seq, offset) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) return "";
  const off = ((offset % L) + L) % L;
  return s.slice(off) + s.slice(0, off);
}

/**
 * Calculate distance along + direction on a circle.
 * Returns the distance from 'from' to 'to' moving in the positive direction (0..L-1).
 * 
 * @param {number} L - Circle length
 * @param {number} from - Starting position (0-based)
 * @param {number} to - Ending position (0-based)
 * @returns {number} Distance in positive direction (0..L-1)
 */
export function distPlus(L, from, to) {
  return (to - from + L) % L; // 0..L-1
}

/**
 * Get PCR product sequence using direction-driven method (rotation-invariant).
 * 
 * This function defines PCR product as the arc from forward primer 3' end (f3)
 * moving along + direction until reverse primer 3' end (r3), allowing crossing 0 point.
 * 
 * @param {string} seq - Circular sequence (normalized)
 * @param {number} f3 - Forward primer 3' end coordinate (0-based)
 * @param {number} r3 - Reverse primer 3' end coordinate (0-based)
 * @returns {string} PCR product sequence
 */
export function pcrProductSeq(seq, f3, r3) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) return "";
  
  // Normalize coordinates to [0, L)
  const f3Norm = ((f3 % L) + L) % L;
  const r3Norm = ((r3 % L) + L) % L;
  
  // Calculate length: distance from f3 to r3 along + direction, inclusive
  const len = distPlus(L, f3Norm, r3Norm) + 1; // +1 for inclusive
  
  // Extract circular subsequence starting from f3
  return subseqCircular(s, f3Norm, f3Norm + len);
}

/**
 * Generate both PCR product candidates for a primer pair on circular DNA.
 * 
 * For the same pair of primer binding sites, PCR can amplify either:
 * - Arc A: from f3 to r3 along + direction (f3→r3)
 * - Arc B: from r3 to f3 along + direction (r3→f3)
 * 
 * These two arcs are complements of each other. This function calculates both
 * and provides length information for automatic selection.
 * 
 * @param {string} seq - Circular sequence (normalized)
 * @param {number} f3 - Forward primer 3' end coordinate (0-based)
 * @param {number} r3 - Reverse primer 3' end coordinate (0-based)
 * @returns {{arcA: string, arcB: string, lenA: number, lenB: number, shorter: {seq: string, len: number, direction: string}, longer: {seq: string, len: number, direction: string}}}
 */
export function pcrProductCandidates(seq, f3, r3) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) {
    return {
      arcA: "",
      arcB: "",
      lenA: 0,
      lenB: 0,
      shorter: { seq: "", len: 0, direction: "" },
      longer: { seq: "", len: 0, direction: "" }
    };
  }
  
  // Normalize coordinates to [0, L)
  const f3Norm = ((f3 % L) + L) % L;
  const r3Norm = ((r3 % L) + L) % L;
  
  // Candidate A: f3→r3 (inward, usually shorter)
  const lenA = distPlus(L, f3Norm, r3Norm) + 1;
  const arcA = pcrProductSeq(s, f3Norm, r3Norm);
  
  // Candidate B: r3→f3 (outward, usually longer)
  const lenB = distPlus(L, r3Norm, f3Norm) + 1;
  const arcB = pcrProductSeq(s, r3Norm, f3Norm);
  
  // Determine shorter and longer arcs
  const shorter = lenA <= lenB 
    ? { seq: arcA, len: lenA, direction: 'f3→r3' }
    : { seq: arcB, len: lenB, direction: 'r3→f3' };
    
  const longer = lenA > lenB
    ? { seq: arcA, len: lenA, direction: 'f3→r3' }
    : { seq: arcB, len: lenB, direction: 'r3→f3' };
  
  return {
    arcA,
    arcB,
    lenA,
    lenB,
    shorter,
    longer
  };
}


// ============================================================================
// 8. Enzyme database (unified core for RE / Golden Gate / Gibson)
// ============================================================================

// Raw restriction enzyme set (standard Type II), ported from RE_cloning_v3.9.html
// NOTE: These are kept in their original form for compatibility (site, cut5, sticky).
export const RAW_RE_ENZYMES = {
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

// Raw Type IIS enzyme set (Golden Gate), ported from Golden_Gate_v2.3.1_vectorMap_rotation_features_v3.html
// Fields:
//   site  - recognition sequence on forward strand
//   rc    - recognition sequence on reverse complement
//   overhang - length of cohesive end
//   cutF - offset (in bp) from motif end on forward strand (downstream)
//   cutR - offset (in bp) from motif start on reverse strand (upstream)
export const RAW_TYPEIIS_ENZYMES = {
    BsaI: { site:'GGTCTC',  rc:'GAGACC',  overhang:4, cutF:1, cutR:5 },
    Esp3I:{ site:'CGTCTC',  rc:'GAGACG',  overhang:4, cutF:1, cutR:5 },
    BbsI: { site:'GAAGAC',  rc:'GTCTTC',  overhang:4, cutF:2, cutR:6 },
    PaqCI:{ site:'CACCTGC', rc:'GCAGGTG', overhang:4, cutF:4, cutR:8 }
  };

/**
 * Unified enzyme database.
 *
 * Each entry has the form:
 *   {
 *     name: string,
 *     class: "typeII" | "typeIIS",
 *     site: string,         // recognition sequence (forward)
 *     recog: string,        // alias of site
 *     sticky?: string,      // sticky overhang sequence (for many Type II)
 *     cut5?: number,        // cut position on 5'->3' forward strand (from site start)
 *     rc?: string,          // reverse-complement recognition sequence (Type IIS)
 *     overhang?: number,    // overhang length (Type IIS)
 *     cutF?: number,        // forward cut offset after motif (Type IIS)
 *     cutR?: number         // reverse cut offset before motif (Type IIS)
 *   }
 *
 * This allows RE cloning, Golden Gate, Gibson and gel modules to share a single
 * source of truth, while still preserving the original fields for legacy code.
 */
export const ENZYME_DB = (() => {
  const db = {};

  // Standard Type II enzymes (palindromic or near-palindromic)
  for (const [name, e] of Object.entries(RAW_RE_ENZYMES)) {
    db[name] = {
      name,
      class: "typeII",
      site: e.site,
      recog: e.site,
      sticky: e.sticky || "",
      cut5: typeof e.cut5 === "number" ? e.cut5 : null
    };
  }

  // Type IIS enzymes used in Golden Gate
  for (const [name, e] of Object.entries(RAW_TYPEIIS_ENZYMES)) {
    db[name] = {
      name,
      class: "typeIIS",
      site: e.site,
      recog: e.site,
      rc: e.rc,
      overhang: e.overhang,
      cutF: e.cutF,
      cutR: e.cutR
    };
  }

  return db;
})();

/**
 * Get an enzyme entry by name (case-sensitive).
 * Returns null if not found.
 */
export function getEnzyme(name) {
  return ENZYME_DB[name] || null;
}

/**
 * Simple site search for a given enzyme name.
 * Returns an array of 0-based positions where the recognition site appears.
 */
export function findEnzymeSites(seq, enzName) {
  const enz = getEnzyme(enzName);
  if (!enz || !enz.site) return [];
  const s = normalizeSeq(seq);
  const site = enz.site;
  const pos = [];
  for (let i = 0; i <= s.length - site.length; i++) {
    if (s.slice(i, i + site.length) === site) pos.push(i);
  }
  return pos;
}


// ============================================================================
// 9. Restriction / Type IIS digestion helpers
// ============================================================================

/**
 * Compute cut information for a Type II (palindromic) enzyme on a linear sequence.
 * For an enzyme with recognition site of length L and cut5 offset c:
 *   - Top strand is cut between positions (start + c - 1) and (start + c)
 *   - Bottom strand is cut symmetrically.
 *
 * Returns an array of objects:
 *   [{ siteStart, siteEnd, cutTop, cutBottom }]
 * where indices are 0-based positions on the forward strand.
 */
export function computeCutsTypeII(seq, enzName) {
  const enz = getEnzyme(enzName);
  if (!enz || enz.class !== "typeII" || !enz.site || typeof enz.cut5 !== "number") return [];
  const s = normalizeSeq(seq);
  const L = enz.site.length;
  const c = enz.cut5; // positions from site start on top strand (1..L)

  const sites = findEnzymeSites(s, enzName);
  const cuts = [];
  for (const start of sites) {
    const siteStart = start;
    const siteEnd = start + L; // exclusive
    const cutTop = start + c;  // 0-based index AFTER the cut on top strand
    // For perfect palindromes the bottom cut is symmetrical:
    const cutBottom = start + (L - c);
    cuts.push({ siteStart, siteEnd, cutTop, cutBottom });
  }
  return cuts;
}

/**
 * Digest a linear sequence with a Type II enzyme.
 * Returns an array of fragment objects:
 *   [{ start, end, length, seq }]
 * where start/end are 0-based (end exclusive).
 */
export function digestLinearTypeII(seq, enzName) {
  const s = normalizeSeq(seq);
  const cuts = computeCutsTypeII(s, enzName);
  if (!cuts.length) {
    return [{ start: 0, end: s.length, length: s.length, seq: s }];
  }

  // For linear DNA, we use the top-strand cut positions as breakpoints.
  const breakpoints = new Set([0, s.length]);
  cuts.forEach(c => breakpoints.add(c.cutTop));
  const pts = Array.from(breakpoints).sort((a, b) => a - b);

  const frags = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    if (end > start) {
      frags.push({
        start,
        end,
        length: end - start,
        seq: s.slice(start, end)
      });
    }
  }
  return frags;
}

/**
 * Find Type IIS sites for a given enzyme in a sequence.
 * Returns an object with arrays of indices for forward (F) and reverse (R) motifs:
 *   { F: [...], R: [...] }
 * Matches are exact on the forward strand for both site and rc fields.
 */
export function findTypeIISSites(seq, enz) {
  const s = normalizeSeq(seq);
  const F = [], R = [];
  const site = enz.site || "";
  const rc = enz.rc || "";
  if (site) {
    for (let i = 0; i <= s.length - site.length; i++) {
      if (s.slice(i, i + site.length) === site) F.push(i);
    }
  }
  if (rc) {
    for (let i = 0; i <= s.length - rc.length; i++) {
      if (s.slice(i, i + rc.length) === rc) R.push(i);
    }
  }
  return { F, R };
}

/**
 * Compute cut positions for a Type IIS enzyme on a linear sequence.
 *
 * For an enzyme with fields:
 *   site (forward motif, length Ls)
 *   rc   (reverse-complement motif, length Lr)
 *   cutF (distance from site end downstream on top strand)
 *   cutR (distance from rc start upstream on bottom strand)
 *
 * On the forward-strand coordinate:
 *   - Forward-site cut is at:  start_site + Ls + cutF
 *   - Reverse-site cut (bottom) is approximated as: start_rc - cutR
 *
 * Returns array of objects:
 *   [{ siteType: "F"|"R", siteStart, siteEnd, cutPos }]
 */
export function computeCutsTypeIIS(seq, enzName) {
  const enz = getEnzyme(enzName);
  if (!enz || enz.class !== "typeIIS") return [];
  const s = normalizeSeq(seq);
  const sites = findTypeIISSites(s, enz);
  const cuts = [];

  const siteLen = (enz.site || "").length;
  const rcLen = (enz.rc || "").length;

  // Forward motif cuts (top strand)
  if (siteLen && typeof enz.cutF === "number") {
    for (const start of sites.F) {
      const siteStart = start;
      const siteEnd = start + siteLen;
      const cutPos = siteEnd + enz.cutF; // downstream from motif
      cuts.push({ siteType: "F", siteStart, siteEnd, cutPos });
    }
  }

  // Reverse motif cuts (bottom strand, mapped to forward coordinate approx)
  if (rcLen && typeof enz.cutR === "number") {
    for (const start of sites.R) {
      const siteStart = start;
      const siteEnd = start + rcLen;
      const cutPos = siteStart - enz.cutR; // upstream from motif start
      cuts.push({ siteType: "R", siteStart, siteEnd, cutPos });
    }
  }

  return cuts;
}


// ============================================================================
// 10. Higher-level restriction / overhang / ligation helpers
// ============================================================================

/**
 * Digest a circular plasmid with one or more Type II enzymes.
 *
 * enzNames can be a single name or an array of names.
 * Returns an array of fragment objects:
 *   [{ start, end, length, seq, leftCuts, rightCuts }]
 * where start/end are 0-based positions on the circular coordinate
 * (end may be less than start for wrap-around fragments).
 */
export function digestCircularTypeII(seq, enzNames) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) return [];

  const names = Array.isArray(enzNames) ? enzNames : [enzNames];

  const cutsAt = new Map(); // pos -> array of { enzyme, cutTop }
  for (const name of names) {
    const enz = getEnzyme(name);
    if (!enz || enz.class !== "typeII") continue;
    const cuts = computeCutsTypeII(s, name);
    for (const c of cuts) {
      const pos = c.cutTop;
      if (!cutsAt.has(pos)) cutsAt.set(pos, []);
      cutsAt.get(pos).push({ enzyme: name, cutTop: pos });
    }
  }

  const cutPositions = Array.from(cutsAt.keys()).sort((a, b) => a - b);
  if (!cutPositions.length) {
    // No cut: plasmid remains intact
    return [{
      start: 0,
      end: L,
      length: L,
      seq: s,
      leftCuts: [],
      rightCuts: []
    }];
  }

  const frags = [];
  const n = cutPositions.length;
  for (let i = 0; i < n; i++) {
    const start = cutPositions[i];
    const end = cutPositions[(i + 1) % n];
    const seqFrag = subseqCircular(s, start, end);
    const length = seqFrag.length;
    frags.push({
      start,
      end,
      length,
      seq: seqFrag,
      leftCuts: cutsAt.get(start) || [],
      rightCuts: cutsAt.get(end) || []
    });
  }
  return frags;
}

/**
 * Annotate termini of linear Type II digest fragments with simple end-type
 * information (blunt vs sticky) and a canonical sticky sequence (if known).
 *
 * Returns fragments of the form:
 *   [{ start, end, length, seq, left, right }]
 * where left/right are { type: "blunt"|"sticky"|"unknown", seq: string }.
 */
export function annotateTypeIITermini(seq, enzName) {
  const s = normalizeSeq(seq);
  const frags = digestLinearTypeII(s, enzName);
  const enz = getEnzyme(enzName);
  const stickySeq = (enz && enz.sticky) ? normalizeSeq(enz.sticky) : "";
  const sticky = !!stickySeq;

  return frags.map(f => {
    if (!enz) {
      return {
        ...f,
        left: { type: "unknown", seq: "" },
        right: { type: "unknown", seq: "" }
      };
    }
    if (sticky) {
      return {
        ...f,
        left: { type: "sticky", seq: stickySeq },
        right: { type: "sticky", seq: stickySeq }
      };
    }
    return {
      ...f,
      left: { type: "blunt", seq: "" },
      right: { type: "blunt", seq: "" }
    };
  });
}

/**
 * Compute local sequence context around Type IIS cut positions.
 * This helper does not attempt to infer true strand orientation;
 * instead it returns upstream/downstream windows around each cut position.
 *
 * window: number of bases to report upstream and downstream;
 *         if omitted, defaults to enz.overhang (or 4).
 *
 * Returns:
 *   [{ siteType, siteStart, siteEnd, cutPos, upstream, downstream }]
 */
export function computeTypeIISOverhangs(seq, enzName, window) {
  const enz = getEnzyme(enzName);
  if (!enz || enz.class !== "typeIIS") return [];
  const s = normalizeSeq(seq);
  const cuts = computeCutsTypeIIS(s, enzName);
  const w = window || enz.overhang || 4;

  const out = [];
  for (const c of cuts) {
    const cutPos = Math.max(0, Math.min(s.length, c.cutPos));
    const upStart = Math.max(0, cutPos - w);
    const upEnd = cutPos;
    const downStart = cutPos;
    const downEnd = Math.min(s.length, cutPos + w);
    out.push({
      ...c,
      cutPos,
      upstream: s.slice(upStart, upEnd),
      downstream: s.slice(downStart, downEnd)
    });
  }
  return out;
}

/**
 * Multi-enzyme linear digest for Type II restriction enzymes.
 *
 * enzNames: array of enzyme names.
 * Returns fragments:
 *   [{ start, end, length, seq, leftCuts, rightCuts }]
 */
export function digestLinearMultiTypeII(seq, enzNames) {
  const s = normalizeSeq(seq);
  const L = s.length;
  if (!L) return [];

  const names = Array.isArray(enzNames) ? enzNames : [enzNames];
  const cutsAt = new Map(); // pos -> array of { enzyme, cutTop }

  for (const name of names) {
    const enz = getEnzyme(name);
    if (!enz || enz.class !== "typeII") continue;
    const cuts = computeCutsTypeII(s, name);
    for (const c of cuts) {
      const pos = c.cutTop;
      if (!cutsAt.has(pos)) cutsAt.set(pos, []);
      cutsAt.get(pos).push({ enzyme: name, cutTop: pos });
    }
  }

  if (!cutsAt.size) {
    return [{
      start: 0,
      end: L,
      length: L,
      seq: s,
      leftCuts: [],
      rightCuts: []
    }];
  }

  const breakpoints = new Set([0, L]);
  for (const pos of cutsAt.keys()) breakpoints.add(pos);
  const pts = Array.from(breakpoints).sort((a, b) => a - b);

  const frags = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    if (end <= start) continue;
    frags.push({
      start,
      end,
      length: end - start,
      seq: s.slice(start, end),
      leftCuts: cutsAt.get(start) || [],
      rightCuts: cutsAt.get(end) || []
    });
  }

  return frags;
}

/**
 * Build a simple overhang compatibility matrix.
 *
 * overhangs: array of objects like:
 *   [{ label: "frag1-5'", seq: "AATT" }, ...]
 *
 * Returns an array of nodes:
 *   [{
 *      index,
 *      label,
 *      seq,
 *      same: [indices of overhangs with identical seq],
 *      rc:   [indices of overhangs whose sequence is reverse-complement]
 *    }, ...]
 */
export function buildOverhangMatrix(overhangs) {
  const norm = overhangs.map((o, i) => ({
    index: i,
    label: o.label || o.name || `overhang_${i + 1}`,
    seq: normalizeSeq(o.seq || "")
  }));

  const n = norm.length;
  const out = norm.map(x => ({ ...x, same: [], rc: [] }));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const si = out[i].seq;
      const sj = out[j].seq;
      if (!si || !sj) continue;
      if (si === sj) {
        out[i].same.push(j);
        out[j].same.push(i);
      } else if (reverseComplementSeq(si) === sj) {
        out[i].rc.push(j);
        out[j].rc.push(i);
      }
    }
  }

  return out;
}

/**
 * Determine whether two termini can ligate based on a minimal
 * sticky/blunt model.
 *
 * End objects are expected to have:
 *   { type: "blunt"|"sticky", seq: string }
 */
export function canLigate(endA, endB) {
  if (!endA || !endB) return false;

  const typeA = endA.type || "unknown";
  const typeB = endB.type || "unknown";

  // Blunt ligation
  if (typeA === "blunt" && typeB === "blunt") return true;

  // Sticky ligation
  if (typeA !== "sticky" || typeB !== "sticky") return false;
  const sa = normalizeSeq(endA.seq || "");
  const sb = normalizeSeq(endB.seq || "");
  if (!sa || !sb) return false;

  if (sa === sb) return true;
  if (reverseComplementSeq(sa) === sb) return true;
  return false;
}

/**
 * Scan a sequence for forbidden restriction sites.
 *
 * enzymeNames: array of enzyme names to scan for.
 * Returns an object:
 *   { EcoRI: [pos1, pos2, ...], BamHI: [...], ... }
 */
export function scanForbiddenSites(seq, enzymeNames) {
  const s = normalizeSeq(seq);
  const names = Array.isArray(enzymeNames) ? enzymeNames : [enzymeNames];
  const out = {};

  for (const name of names) {
    const enz = getEnzyme(name);
    if (!enz || !enz.site) continue;
    const positions = findEnzymeSites(s, name);
    if (positions.length) out[name] = positions;
  }

  return out;
}

/**
 * Predict band sizes (bp) on a linear digest using one or more Type II enzymes.
 * Returns an array of fragment lengths sorted descending.
 */
export function predictDigestBandsLinear(seq, enzNames) {
  const frags = digestLinearMultiTypeII(seq, enzNames);
  return frags.map(f => f.length).sort((a, b) => b - a);
}


// ============================================================================
// 11. Additional common primer / overlap / sequence helpers
// ============================================================================

/**
 * Simple 3' GC clamp check.
 * Returns true if the last base of the primer is G or C.
 */
export function has3GCClamp(seq) {
  const s = normalizeSeq(seq);
  if (!s.length) return false;
  const c = s[s.length - 1];
  return c === "G" || c === "C";
}

/**
 * Build a primer–primer dimer matrix using the generic dimerScan function.
 *
 * primers: array of objects like:
 *   [{ label: "F1", seq: "ATGC..." }, ...]
 *
 * Returns:
 *   {
 *     primers: [{ label, seq }...],
 *     matrix: [
 *       [ { dG, touches3, label, cls }, ... ],
 *       ...
 *     ]
 *   }
 *
 * matrix[i][j] describes the interaction between primers[i] and primers[j].
 * For i === j this is the self-dimer.
 */
export function buildPrimerDimerMatrix(primers) {
  const arr = primers.map((p, i) => ({
    index: i,
    label: p.label || p.name || `primer_${i + 1}`,
    seq: normalizeSeq(p.seq || "")
  }));

  const n = arr.length;
  const matrix = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null)
  );

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = arr[i].seq;
      const b = arr[j].seq;
      if (!a || !b) {
        matrix[i][j] = matrix[j][i] = null;
        continue;
      }
      const d = dimerScan(a, b);
      if (!d) {
        matrix[i][j] = matrix[j][i] = {
          dG: NaN,
          touches3: false,
          label: "None",
          cls: "ok"
        };
        continue;
      }
      const cls = classifyDG(d.dG, d.touches3);
      const cell = {
        dG: d.dG,
        touches3: d.touches3,
        label: cls.label,
        cls: cls.cls
      };
      matrix[i][j] = matrix[j][i] = cell;
    }
  }

  return {
    primers: arr.map(p => ({ label: p.label, seq: p.seq })),
    matrix
  };
}

/**
 * Find potential amplicons on a given template for a primer pair.
 *
 * The function searches for exact matches of the forward primer sequence
 * on the template (5'->3') and exact matches of the reverse primer's
 * reverse complement. For each pair of matches with fwdPos < revPos, an
 * amplicon is reported.
 *
 * Returns an array:
 *   [{ fwdPos, revPos, start, end, length, seq }]
 * where start/end are 0-based (end exclusive).
 */
/**
 * Check if primer matches template with seed-and-extend method
 * 3' end (last seedLen bases) must match exactly for extension
 * 5' end allows mismatches (maxMismatchRatio)
 * @param {string} template - Template sequence
 * @param {number} pos - Position in template
 * @param {string} primer - Primer sequence
 * @param {number} seedLen - Length of 3' seed that must match exactly (default 10)
 * @param {number} maxMismatchRatio - Maximum allowed mismatch ratio in 5' region (default 0.2, i.e., 20%)
 * @returns {boolean} Whether primer can bind and extend
 */
function primerMatchesWithMismatch(template, pos, primer, seedLen = 10, maxMismatchRatio = 0.2) {
  if (pos + primer.length > template.length) return false;
  
  const templateSlice = template.slice(pos, pos + primer.length);
  
  // 3' end (last seedLen bases) must match exactly for polymerase extension
  const seedRegion = primer.slice(-seedLen);
  const templateSeed = templateSlice.slice(-seedLen);
  if (seedRegion !== templateSeed) return false;
  
  // 5' end allows mismatches
  const fivePrimeRegion = primer.slice(0, -seedLen);
  const templateFivePrime = templateSlice.slice(0, -seedLen);
  
  if (fivePrimeRegion.length === 0) return true; // Only seed region, already matched
  
  // Count mismatches in 5' region
  let mismatches = 0;
  for (let i = 0; i < fivePrimeRegion.length; i++) {
    if (fivePrimeRegion[i] !== templateFivePrime[i]) {
      mismatches++;
    }
  }
  
  // Allow if mismatch ratio is within threshold
  return mismatches / fivePrimeRegion.length <= maxMismatchRatio;
}

export function findAmplicons(templateSeq, fwdSeq, revSeq) {
  const tpl = normalizeSeq(templateSeq);
  const fwd = normalizeSeq(fwdSeq);
  const rev = normalizeSeq(revSeq);
  const revRC = reverseComplementSeq(rev);

  const hitsF = [];
  const hitsR = [];

  // Seed-and-extend method: 3' end must match exactly, 5' end allows mismatches
  // For forward primer: 3' end is the last part of the primer (extension site)
  // For reverse primer (revRC): 5' end in template is the 3' end of original primer (extension site)
  const seedLen = Math.min(10, Math.min(fwd.length, rev.length)); // Use 10bp or primer length, whichever is smaller
  const maxMismatchRatio = 0.2; // Allow up to 20% mismatches in 5' region

  // Find all forward-primer matches (with mismatch tolerance)
  if (fwd.length) {
    for (let i = 0; i <= tpl.length - fwd.length; i++) {
      if (primerMatchesWithMismatch(tpl, i, fwd, seedLen, maxMismatchRatio)) {
        hitsF.push(i);
      }
    }
  }

  // Find all reverse-primer matches (via reverse complement, with mismatch tolerance)
  if (revRC.length) {
    for (let i = 0; i <= tpl.length - revRC.length; i++) {
      if (primerMatchesWithMismatch(tpl, i, revRC, seedLen, maxMismatchRatio)) {
        hitsR.push(i);
      }
    }
  }

  const amplicons = [];
  hitsF.forEach(fPos => {
    hitsR.forEach(rPos => {
      if (fPos < rPos) {
        const start = fPos;
        const end = rPos + revRC.length;
        const length = end - start;
        if (length > 0) {
          amplicons.push({
            fwdPos: fPos,
            revPos: rPos,
            start,
            end,
            length,
            seq: tpl.slice(start, end)
          });
        }
      }
    });
  });

  return amplicons;
}

/**
 * Evaluate a single overlap region between two fragments.
 * Returns an object with basic properties used in Gibson/In-Fusion design.
 *
 * seq: overlap sequence (5'->3')
 * options:
 *   { Na_mM, Mg_mM, conc_nM, tmTarget }
 */
export function evalOverlap(seq, options = {}) {
  const { Na_mM = 50, Mg_mM = 0, conc_nM = 500, tmTarget = 60 } = options;
  const s = normalizeSeq(seq);
  const len = s.length;
  const gc = gcPct(s);
  const tm = tmcalNN(s, Na_mM, Mg_mM, conc_nM);
  const dG = duplexDG37Worst(s, true);
  const tmDiff = isFinite(tm) ? Math.abs(tm - tmTarget) : NaN;

  return {
    seq: s,
    length: len,
    gc,
    tm,
    dG,
    tmDiff
  };
}

/**
 * Scan two sequences for possible overlaps within a length window [Lmin, Lmax],
 * and return the best overlap according to proximity to tmTarget.
 *
 * seqA: 5'->3' sequence of fragment A (e.g. end of a fragment)
 * seqB: 5'->3' sequence of fragment B (e.g. beginning of next fragment)
 *
 * options:
 *   { Lmin: 15, Lmax: 40, tmTarget: 60, Na_mM, Mg_mM, conc_nM }
 *
 * Returns either null or an object:
 *   {
 *     overlapSeq, length, gc, tm, dG, tmDiff,
 *     aStart, aEnd, bStart, bEnd
 *   }
 * where [aStart,aEnd) and [bStart,bEnd) are 0-based ranges in seqA/seqB
 * that define the overlapping region.
 */
export function findBestOverlap(seqA, seqB, options = {}) {
  const {
    Lmin = 15,
    Lmax = 40,
    tmTarget = 60,
    Na_mM = 50,
    Mg_mM = 0,
    conc_nM = 500
  } = options;

  const A = normalizeSeq(seqA);
  const B = normalizeSeq(seqB);
  if (!A.length || !B.length) return null;

  const revB = reverseComplementSeq(B);
  const best = { tmDiff: Infinity, result: null };

  const LminClamped = Math.max(5, Lmin);
  const LmaxClamped = Math.max(LminClamped, Lmax);

  // We align the 3' end of A with the 3' end of revB (i.e., 5' end of B)
  for (let len = LminClamped; len <= LmaxClamped; len++) {
    if (len > A.length || len > revB.length) break;
    const aStart = A.length - len;
    const aEnd = A.length;
    const bStart = revB.length - len;
    const bEnd = revB.length;

    const overlap = A.slice(aStart, aEnd);

    const r = evalOverlap(overlap, { Na_mM, Mg_mM, conc_nM, tmTarget });
    if (!isFinite(r.tm)) continue;
    if (r.tmDiff < best.tmDiff) {
      best.tmDiff = r.tmDiff;
      best.result = {
        overlapSeq: overlap,
        length: r.length,
        gc: r.gc,
        tm: r.tm,
        dG: r.dG,
        tmDiff: r.tmDiff,
        aStart,
        aEnd,
        bStart,
        bEnd
      };
    }
  }

  return best.result;
}

/**
 * Basic base composition statistics,
 * including length and GC percentage.
 *
 * Returns:
 *   { A, C, G, T, N, len, gcPct }
 */
export function baseComposition(seq) {
  const s = normalizeSeq(seq);
  let A = 0, C = 0, G = 0, T = 0, N = 0;
  for (const ch of s) {
    if (ch === "A") A++;
    else if (ch === "C") C++;
    else if (ch === "G") G++;
    else if (ch === "T") T++;
    else N++;
  }
  const len = s.length;
  const gc = len ? ((G + C) * 100) / len : 0;
  return { A, C, G, T, N, len, gcPct: gc };
}

/**
 * Simple sequence complexity metric.
 *
 * Returns:
 *   {
 *     len,
 *     entropy,        // Shannon entropy (bits) for A/C/G/T frequency
 *     repeatRatio,    // fraction of positions where base[i] == base[i+1]
 *     lowComplexity   // boolean flag if entropy is low or repeats are high
 *   }
 */
export function seqComplexity(seq) {
  const s = normalizeSeq(seq);
  const len = s.length;
  if (!len) {
    return {
      len: 0,
      entropy: 0,
      repeatRatio: 0,
      lowComplexity: false
    };
  }

  // Base frequencies for A/C/G/T only
  let counts = { A: 0, C: 0, G: 0, T: 0 };
  for (const ch of s) {
    if (ch === "A" || ch === "C" || ch === "G" || ch === "T") {
      counts[ch]++;
    }
  }
  const totalACGT = counts.A + counts.C + counts.G + counts.T;
  let entropy = 0;
  if (totalACGT > 0) {
    ["A","C","G","T"].forEach(b => {
      const p = counts[b] / totalACGT;
      if (p > 0) entropy -= p * Math.log2(p);
    });
  }

  // Repeat ratio: fraction of adjacent equal bases
  let repeatMatches = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === s[i + 1]) repeatMatches++;
  }
  const repeatRatio = (s.length > 1) ? repeatMatches / (s.length - 1) : 0;

  // Heuristic low-complexity flag
  const lowComplexity = (entropy < 1.2) || (repeatRatio > 0.6);

  return {
    len,
    entropy,
    repeatRatio,
    lowComplexity
  };
}
