// mutagenesis.js (v3, merged core + UI)
// OE-PCR style site-directed mutagenesis primer designer for PrimerWeaver.
// - Core logic adapted from mutagenesis_core.js
// - UI logic adapted from mutagenesis_ui.js
// - All thermodynamic / sequence utilities delegated to core.js

import * as Core from './core_v1.0.1.js';
import { CODON_USAGE, getCodonEntries } from './codon_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';



// mutagenesis_core.js (v3)
// OE-PCR style site-directed mutagenesis:
// - Applies AA mutation using host-preferred codon
// - Designs 4 primers per mutation: F1, Fmut, Rmut, R2
// - Supports FASTA input (ignores header lines)

const geneticCode = {
  TTT: 'F', TTC: 'F',
  TTA: 'L', TTG: 'L', CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I',
  ATG: 'M',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S', AGT: 'S', AGC: 'S',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y',
  TAA: '*', TAG: '*', TGA: '*',
  CAT: 'H', CAC: 'H',
  CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N',
  AAA: 'K', AAG: 'K',
  GAT: 'D', GAC: 'D',
  GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C',
  TGG: 'W',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R', AGA: 'R', AGG: 'R',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G'
};

export function cleanDNA(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return Core.normalizeSeq(dnaLines.join(''));
}

// Extract FASTA header (sequence name) from input
export function extractFASTAHeader(seq) {
  if (!seq) return null;
  const lines = String(seq).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      // Remove '>' and return the header (name)
      return trimmed.substring(1).trim() || null;
    }
  }
  return null;
}

export function translateDNA(seq) {
  const clean = cleanDNA(seq);
  let aa = '';
  for (let i = 0; i + 3 <= clean.length; i += 3) {
    const codon = clean.slice(i, i + 3);
    const res = geneticCode[codon] || 'X';
    aa += res;
  }
  return aa;
}

// Find all ORFs (from ATG to stop codon) in a given sequence and frame
function findORFsInFrame(seq, frame = 0) {
  const orfs = [];
  const clean = seq.toUpperCase();
  
  for (let i = frame; i + 3 <= clean.length; i += 3) {
    const codon = clean.slice(i, i + 3);
    if (codon === 'ATG') {
      // Start of potential ORF
      let j = i + 3;
      while (j + 3 <= clean.length) {
        const endCodon = clean.slice(j, j + 3);
        if (endCodon === 'TAA' || endCodon === 'TAG' || endCodon === 'TGA') {
          // Stop codon found
          const orfSeq = clean.slice(i, j + 3);
          orfs.push({
            start: i,
            end: j + 3,
            length: orfSeq.length,
            seq: orfSeq,
            frame: frame
          });
          break;
        }
        j += 3;
      }
    }
  }
  return orfs;
}

// Scan all 6 reading frames (3 on +, 3 on -)
export function detectLongestCDS(inputSeq) {
  const clean = cleanDNA(inputSeq);
  const revCompSeq = Core.reverseComplementSeq(clean);
  
  const allOrfs = [];
  
  // Scan +strand frames 0,1,2
  for (let frame = 0; frame < 3; frame++) {
    const orfs = findORFsInFrame(clean, frame);
    orfs.forEach(orf => {
      allOrfs.push({
        ...orf,
        strand: '+',
        displayStrand: 'Forward (+)'
      });
    });
  }
  
  // Scan -strand frames 0,1,2
  for (let frame = 0; frame < 3; frame++) {
    const orfs = findORFsInFrame(revCompSeq, frame);
    orfs.forEach(orf => {
      allOrfs.push({
        ...orf,
        strand: '-',
        displayStrand: 'Reverse (-)',
        originalSeq: orf.seq,  // Store for later RC conversion if needed
        seqForUse: Core.reverseComplementSeq(orf.seq)  // Use RC version
      });
    });
  }
  
  // Sort by length (descending)
  allOrfs.sort((a, b) => b.length - a.length);
  
  return allOrfs;
}

// Get top N ORFs for user selection
export function getTopCDSCandidates(inputSeq, topN = 5) {
  const allOrfs = detectLongestCDS(inputSeq);
  return allOrfs.slice(0, topN);
}

// Apply a single AA mutation on the template (no indel, just codon swap).
// aaPos: 1-based amino acid index.
// selectedCodon: optional, if provided use this codon instead of preferred
export function applyAAMutation(template, hostCode, aaPos, newAA, selectedCodon = null) {
  const clean = cleanDNA(template);
  const codonStart = (aaPos - 1) * 3;
  if (codonStart + 3 > clean.length) {
    throw new Error(`AA position ${aaPos} is out of range for this template.`);
  }
  const oldCodon = clean.slice(codonStart, codonStart + 3);
  const oldAA = geneticCode[oldCodon] || 'X';

  let targetCodon;
  if (selectedCodon) {
    // Use user-selected codon
    targetCodon = selectedCodon;
  } else {
    // Use preferred codon
    const entries = getCodonEntries(hostCode, newAA);
    if (!entries || entries.length === 0) {
      throw new Error(`No codon usage data for amino acid ${newAA} in organism ${hostCode}.`);
    }
    targetCodon = entries[0].codon;
  }

  const mutatedTemplate =
    clean.slice(0, codonStart) +
    targetCodon +
    clean.slice(codonStart + 3);

  return {
    originalTemplate: clean,
    mutatedTemplate,
    codonStart,
    oldCodon,
    newCodon: targetCodon,
    oldAA,
    newAA
  };
}

// Apply AA edit (supports substitution of multiple AAs, insertion, deletion)
// operation: 'substitution', 'insertion', 'deletion'
// aaStartPos, aaEndPos: 1-based AA positions
// newAAs: string of amino acids to insert/substitute (can be multiple)
// selectedCodon: codon preference (only for single AA)
export function applyAAEdit(template, hostCode, operation, aaStartPos, aaEndPos, newAAs, selectedCodon = null) {
  const clean = cleanDNA(template);
  
  // Calculate DNA positions
  const dnaStartPos = (aaStartPos - 1) * 3; // 0-based start of first codon
  const dnaEndPos = aaEndPos * 3;           // 0-based end (exclusive) of last codon
  
  if (dnaStartPos >= clean.length) {
    throw new Error(`AA position ${aaStartPos} is out of range for this template.`);
  }
  
  // Get old sequence info
  const oldDNASegment = clean.slice(dnaStartPos, Math.min(dnaEndPos, clean.length));
  const oldAAs = translateDNA(oldDNASegment);
  
  // Build new DNA sequence from new amino acids
  // Use round-robin selection to avoid repetitive codon sequences (e.g., GGTGGTGGT for GGG)
  let newDNASeq = '';
  if (newAAs && newAAs.length > 0) {
    // Track codon usage for each amino acid to implement round-robin
    const aaCodonCounters = new Map();
    
    for (let i = 0; i < newAAs.length; i++) {
      const aa = newAAs[i];
      let codon;
      if (i === 0 && selectedCodon && newAAs.length === 1) {
        // Use selected codon only for single AA
        codon = selectedCodon;
      } else {
        // Use round-robin selection among top preferred codons to avoid repeats
        const entries = getCodonEntries(hostCode, aa);
        if (!entries || entries.length === 0) {
          throw new Error(`No codon usage data for amino acid ${aa} in organism ${hostCode}.`);
        }
        
        // Use top 2-3 preferred codons in round-robin fashion
        // This prevents repetitive sequences like GGTGGTGGTGGT for GGGG
        const topCodonCount = Math.min(3, entries.length);
        const counter = aaCodonCounters.get(aa) || 0;
        const codonEntry = entries[counter % topCodonCount];
        codon = codonEntry.codon;
        
        // Update counter for this amino acid
        aaCodonCounters.set(aa, counter + 1);
      }
      newDNASeq += codon;
    }
  }
  
  let mutatedTemplate;
  let editDescription;
  
  let finalDnaStartPos = dnaStartPos;
  let finalDnaEndPos = dnaEndPos;
  
  switch (operation) {
    case 'substitution':
      // Replace AAs at position range with new AAs
      mutatedTemplate = clean.slice(0, dnaStartPos) + newDNASeq + clean.slice(dnaEndPos);
      if (aaStartPos === aaEndPos) {
        editDescription = `${oldAAs}${aaStartPos}${newAAs}`;
      } else {
        editDescription = `${oldAAs}[${aaStartPos}-${aaEndPos}]→${newAAs}`;
      }
      break;
      
    case 'insertion':
      // Insert new AAs after the position (insert after aaStartPos)
      // IMPORTANT: Insert after codon aaStartPos, so insertPos = aaStartPos * 3
      // This ensures no frameshift - insertion happens after the complete codon
      // Example: AA 55 -> insert after codon 55, which ends at position 55*3 = 165 (0-based) = 166 (1-based)
      const insertPos = aaStartPos * 3; // Insert after this codon (0-based position)
      mutatedTemplate = clean.slice(0, insertPos) + newDNASeq + clean.slice(insertPos);
      editDescription = `ins${aaStartPos}${newAAs}`;
      
      // For insertion, dnaStartPos and dnaEndPos should both be the insertion point
      // (no deletion, just insertion at this point)
      finalDnaStartPos = insertPos;  // 0-based insertion point in WT (e.g., 165 for AA 55)
      finalDnaEndPos = insertPos;    // Same point (no deletion)
      break;
      
    case 'deletion':
      // Delete AAs from start to end
      mutatedTemplate = clean.slice(0, dnaStartPos) + clean.slice(dnaEndPos);
      editDescription = `Δ${oldAAs}[${aaStartPos}-${aaEndPos}]`;
      break;
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    originalTemplate: clean,
    mutatedTemplate,
    operation,
    dnaStartPos: finalDnaStartPos,      // 0-based DNA start position (insertion point for insertion)
    dnaEndPos: finalDnaEndPos,          // 0-based DNA end position (exclusive) in WT (insertion point for insertion)
    oldDNASegment: operation === 'insertion' ? '' : oldDNASegment,  // No old segment for insertion
    newDNASeq,
    oldAAs: operation === 'insertion' ? '' : oldAAs,  // No old AAs for insertion
    newAAs: newAAs || '',
    aaStartPos,
    aaEndPos,
    editDescription,
    // For primer design
    editLen: newDNASeq.length,
    wtEditLen: operation === 'insertion' ? 0 : oldDNASegment.length  // No deletion for insertion
  };
}

function gcContent(seq) {
  return Core.gcPct(seq || "");
}


// Tm wrapper: delegate to core.js NN model
// conc_nM: primer concentration in nM
// na_mM, mg_mM: monovalent and divalent cations in mM
function tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) {
  return Core.tmcalNN(seq || "", na_mM, mg_mM, conc_nM);
}


function revComp(seq) {
  return Core.reverseComplementSeq(seq || "");
}


// Design single-fragment PCR primers (for mutations too close to sequence ends)
// Uses direct mutagenic primers without overlap extension
function designSingleFragmentPCR(mutatedTemplate, codonStart, opts = {}) {
  const clean = cleanDNA(mutatedTemplate);
  const lenGenome = clean.length;
  
  const coreTargetTm = opts.coreTargetTm ?? 60;
  const outerTargetTm = opts.outerTargetTm ?? 60;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  
  const minCoreLen = opts.minCoreLen ?? 18;
  const maxCoreLen = opts.maxCoreLen ?? 40;
  const minOuterLen = opts.minOuterLen ?? 18;
  const maxOuterLen = opts.maxOuterLen ?? 30;
  
  // Determine if mutation is too close to start or end
  const mutationPos = codonStart; // 0-based position of mutation
  const minFragmentLen = opts.minFragmentLen ?? 39; // Minimum PCR fragment length (39 nt = 13 AA)
  const maxSingleFlank = opts.maxSingleFlank ?? 39;
  
  const leftAvailable = mutationPos; // Available sequence before mutation
  const rightAvailable = lenGenome - (mutationPos + 3); // Available sequence after mutation
  
  // Get user-defined overlap sequences (if provided) - these will be added to F1 and R2
  const userFOverlap = opts.userFOverlap ? cleanDNA(opts.userFOverlap) : '';
  const userROverlap = opts.userROverlap ? cleanDNA(opts.userROverlap) : '';
  
  let Fmut, Rmut, F1, R2;
  let useLeftAnchor = false;
  let useRightAnchor = false;
  let FmutOverlapTail = '';
  let RmutOverlapTail = '';
  let bestFmutCore = null;
  let bestRmutCore = null;
  
  // Check if we need to use single-fragment PCR
  if (leftAvailable < minFragmentLen && rightAvailable >= minFragmentLen) {
    // Mutation too close to start: use Fmut (with mutation) + R2 (right anchor)
    useRightAnchor = true;
    
    // Fmut: mutation + right core
    const FmutOverlapStart = Math.max(0, mutationPos - maxSingleFlank);
    FmutOverlapTail = clean.slice(FmutOverlapStart, mutationPos + 3);
    
    // Core for Fmut: after mutation, going right
    for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
      const coreStart = mutationPos + 3;
      const coreEnd = Math.min(lenGenome, coreStart + cLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      if (coreSeq.length < minCoreLen) continue;
      const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!bestFmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestFmutCore.tm - coreTargetTm)) {
        bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm };
      }
    }
    if (!bestFmutCore) {
      const coreStart = mutationPos + 3;
      const coreEnd = Math.min(lenGenome, coreStart + maxCoreLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM) };
    }
    
    Fmut = FmutOverlapTail + bestFmutCore.seq;
    
    // R2: from 3' end (reverse complement)
    let bestR2 = null;
    for (let L = minOuterLen; L <= maxOuterLen; L++) {
      const start = Math.max(0, lenGenome - L);
      const forwardRegion = clean.slice(start, lenGenome);
      const seq = revComp(forwardRegion);
      const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
      if (!bestR2 || Math.abs(tm - outerTargetTm) < Math.abs(bestR2.tm - outerTargetTm)) {
        bestR2 = { seq, len: seq.length, tm };
      }
    }
    if (!bestR2) {
      const start = Math.max(0, lenGenome - maxOuterLen);
      const forwardRegion = clean.slice(start, lenGenome);
      const seq = revComp(forwardRegion);
      bestR2 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
    }
    
    // Add user-defined R overlap sequence to R2
    R2 = (userROverlap ? userROverlap : '') + bestR2.seq;
    F1 = null; // Not used
    Rmut = null; // Not used
    
  } else if (rightAvailable < minFragmentLen && leftAvailable >= minFragmentLen) {
    // Mutation too close to end: use F1 (left anchor) + Rmut (with mutation)
    useLeftAnchor = true;
    
    // F1: from 5' start (add user-defined F overlap sequence)
    let bestF1 = null;
    for (let L = minOuterLen; L <= maxOuterLen; L++) {
      const seq = clean.slice(0, L);
      const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
      if (!bestF1 || Math.abs(tm - outerTargetTm) < Math.abs(bestF1.tm - outerTargetTm)) {
        bestF1 = { seq, len: seq.length, tm };
      }
    }
    if (!bestF1) {
      const seq = clean.slice(0, Math.min(maxOuterLen, lenGenome));
      bestF1 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
    }
    
    // Add user-defined F overlap sequence to F1
    F1 = (userFOverlap ? userFOverlap : '') + bestF1.seq;
    
    // Rmut: core before mutation + mutation + right flank
    for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
      const coreEnd = mutationPos;
      const coreStart = Math.max(0, coreEnd - cLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      if (coreSeq.length < minCoreLen) continue;
      const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!bestRmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestRmutCore.tm - coreTargetTm)) {
        bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm };
      }
    }
    if (!bestRmutCore) {
      const coreEnd = mutationPos;
      const coreStart = Math.max(0, coreEnd - maxCoreLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM) };
    }
    
    const RmutOverlapEnd = Math.min(lenGenome, mutationPos + 3 + maxSingleFlank);
    RmutOverlapTail = clean.slice(mutationPos, RmutOverlapEnd);
    const RmutForward = bestRmutCore.seq + RmutOverlapTail;
    Rmut = revComp(RmutForward);
    
    Fmut = null; // Not used
    R2 = null; // Not used
    
  } else {
    // Both sides are too short - use Fmut + Rmut (minimal single fragment)
    // Fmut: mutation + minimal right core
    const FmutOverlapStart = Math.max(0, mutationPos - maxSingleFlank);
    FmutOverlapTail = clean.slice(FmutOverlapStart, mutationPos + 3);
    const rightCoreLen = Math.min(maxCoreLen, rightAvailable);
    const rightCore = clean.slice(mutationPos + 3, Math.min(lenGenome, mutationPos + 3 + rightCoreLen));
    Fmut = FmutOverlapTail + rightCore;
    bestFmutCore = { seq: rightCore, len: rightCore.length, tm: tmSaltCorrected(rightCore, conc_nM, na_mM, mg_mM) };
    
    // Rmut: minimal left core + mutation
    const leftCoreLen = Math.min(maxCoreLen, leftAvailable);
    const leftCore = clean.slice(Math.max(0, mutationPos - leftCoreLen), mutationPos);
    const RmutOverlapEnd = Math.min(lenGenome, mutationPos + 3 + maxSingleFlank);
    RmutOverlapTail = clean.slice(mutationPos, RmutOverlapEnd);
    const RmutForward = leftCore + RmutOverlapTail;
    Rmut = revComp(RmutForward);
    bestRmutCore = { seq: leftCore, len: leftCore.length, tm: tmSaltCorrected(leftCore, conc_nM, na_mM, mg_mM) };
    
    F1 = null;
    R2 = null;
  }
  
  // Build primer info objects
  function makePrimerInfo(seq, tmVal, mutStartIndex = null, mutLength = 0, coreTm = null, overlapTm = null) {
    if (!seq) return null;
    return {
      seq,
      len: seq.length,
      gc: gcContent(seq),
      tm: tmVal,
      mutStartIndex,
      mutLength,
      coreTm,
      overlapTm
    };
  }
  
  const FmutTm = Fmut ? tmSaltCorrected(Fmut, conc_nM, na_mM, mg_mM) : 0;
  const RmutTm = Rmut ? tmSaltCorrected(Rmut, conc_nM, na_mM, mg_mM) : 0;
  const F1Tm = F1 ? tmSaltCorrected(F1, conc_nM, na_mM, mg_mM) : 0;
  const R2Tm = R2 ? tmSaltCorrected(R2, conc_nM, na_mM, mg_mM) : 0;
  
  // Calculate overlap Tms
  const FmutOverlapTm = Fmut && FmutOverlapTail ? tmSaltCorrected(FmutOverlapTail, conc_nM, na_mM, mg_mM) : null;
  const RmutOverlapTm = Rmut && RmutOverlapTail ? tmSaltCorrected(RmutOverlapTail, conc_nM, na_mM, mg_mM) : null;
  
  // Calculate user-defined overlap sequence Tms (for F1 and R2)
  const F1OverlapTm = F1 && userFOverlap ? tmSaltCorrected(userFOverlap, conc_nM, na_mM, mg_mM) : null;
  const R2OverlapTm = R2 && userROverlap ? tmSaltCorrected(userROverlap, conc_nM, na_mM, mg_mM) : null;
  
  const FmutMutIndex = Fmut && FmutOverlapTail ? FmutOverlapTail.length - 3 : null;
  
  // Get core Tm for F1 and R2 (excluding user-defined overlap)
  const F1CoreSeq = F1 && userFOverlap ? F1.slice(userFOverlap.length) : F1;
  const F1CoreTm = F1CoreSeq ? tmSaltCorrected(F1CoreSeq, conc_nM, na_mM, mg_mM) : F1Tm;
  const R2CoreSeq = R2 && userROverlap ? R2.slice(userROverlap.length) : R2;
  const R2CoreTm = R2CoreSeq ? tmSaltCorrected(R2CoreSeq, conc_nM, na_mM, mg_mM) : R2Tm;
  
  return {
    F1: makePrimerInfo(F1, F1Tm, null, 0, F1CoreTm, F1OverlapTm),
    Fmut: makePrimerInfo(Fmut, FmutTm, FmutMutIndex, 3, Fmut ? bestFmutCore?.tm : null, FmutOverlapTm),
    Rmut: makePrimerInfo(Rmut, RmutTm, null, 3, Rmut ? bestRmutCore?.tm : null, RmutOverlapTm),
    R2: makePrimerInfo(R2, R2Tm, null, 0, R2CoreTm, R2OverlapTm),
    isSingleFragment: true,
    useLeftAnchor,
    useRightAnchor
  };
}

// Design OE-PCR primers (Traditional two-round approach):
// Round 1: 
//   - Fmut + F1 -> PCR1_left segment
//   - Rmut + R2 -> PCR1_right segment
// Round 2:
//   - F1 + R2 -> full-length product
// 
// Primer structure (CORRECTED):
//   Fmut: [~13bp overlap tail with mutation] + [~20bp core]
//   Rmut: [~20bp core] + [~13bp overlap tail with mutation]
//         (RC of Fmut's complement region for proper annealing)
//   F1/R2: anchor primers from start/stop regions
export function designOePcrPrimers(mutatedTemplate, codonStart, opts = {}) {
  const clean = cleanDNA(mutatedTemplate);
  const lenGenome = clean.length;

  // Check if mutation is too close to sequence ends - use single-fragment PCR instead
  const minFragmentLen = opts.minFragmentLen ?? 39; // Minimum PCR fragment length (39 nt = 13 AA)
  const mutationPos = codonStart; // 0-based position of mutation
  const leftAvailable = mutationPos; // Available sequence before mutation
  const rightAvailable = lenGenome - (mutationPos + 3); // Available sequence after mutation
  
  // If mutation is too close to either end, use single-fragment PCR
  if (leftAvailable < minFragmentLen || rightAvailable < minFragmentLen) {
    return designSingleFragmentPCR(mutatedTemplate, codonStart, opts);
  }

  const coreTargetTm = opts.coreTargetTm ?? 60;
  const overlapTargetTm = opts.overlapTargetTm ?? 60;
  const outerTargetTm = opts.outerTargetTm ?? 60;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;

  const minCoreLen = opts.minCoreLen ?? 18;
  const maxCoreLen = opts.maxCoreLen ?? 40;
  const overlapTailLen = opts.overlapTailLen ?? 13;

  const minOuterLen = opts.minOuterLen ?? 18;
  const maxOuterLen = opts.maxOuterLen ?? 30;

  // === Step 1: Design Fmut (forward mutagenic primer) ===
  // Fmut = [~13bp overlap tail with mutation (left flank + mutation)] + [~20bp core after mutation]
  // Overlap tail for Fmut: left flank + mutation
  const FmutOverlapStart = Math.max(0, codonStart - 10);
  const FmutOverlapTail = clean.slice(FmutOverlapStart, codonStart + 3);
  
  // Core for Fmut: after mutation, going right
  let bestFmutCore = null;
  for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
    const coreStart = codonStart + 3;
    const coreEnd = Math.min(lenGenome, coreStart + cLen);
    const coreSeq = clean.slice(coreStart, coreEnd);
    if (coreSeq.length < minCoreLen) continue;
    const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
    if (!bestFmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestFmutCore.tm - coreTargetTm)) {
      bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm, end: coreEnd };
    }
  }
  if (!bestFmutCore) {
    const coreStart = codonStart + 3;
    const coreEnd = Math.min(lenGenome, coreStart + maxCoreLen);
    const coreSeq = clean.slice(coreStart, coreEnd);
    bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM), end: coreEnd };
  }

  // Get user-defined overlap sequences (if provided) - these will be added to F1 and R2
  const userFOverlap = opts.userFOverlap ? cleanDNA(opts.userFOverlap) : '';
  const userROverlap = opts.userROverlap ? cleanDNA(opts.userROverlap) : '';

  // Fmut = overlap + core
  const Fmut = FmutOverlapTail + bestFmutCore.seq;
  const FmutTm = tmSaltCorrected(Fmut, conc_nM, na_mM, mg_mM);
  const FmutMutIndex = FmutOverlapTail.length - 3; // where mutation starts in Fmut
  const FmutMutLen = 3;

  // === Step 2: Design Rmut (reverse mutagenic primer) ===
  // Rmut = [~20bp core before mutation] + [~13bp overlap tail with mutation] + user R overlap (if provided) (then RC)
  // But we need to construct it so it's the RC complement for annealing
  
  // Core for Rmut: before mutation, going left
  let bestRmutCore = null;
  for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
    const coreEnd = codonStart;
    const coreStart = Math.max(0, coreEnd - cLen);
    const coreSeq = clean.slice(coreStart, coreEnd);
    if (coreSeq.length < minCoreLen) continue;
    const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
    if (!bestRmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestRmutCore.tm - coreTargetTm)) {
      bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm, start: coreStart };
    }
  }
  if (!bestRmutCore) {
    const coreEnd = codonStart;
    const coreStart = Math.max(0, coreEnd - maxCoreLen);
    const coreSeq = clean.slice(coreStart, coreEnd);
    bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM), start: coreStart };
  }

  // Overlap tail for Rmut: mutation + right flank
  const RmutOverlapEnd = Math.min(lenGenome, codonStart + 3 + 10);
  let RmutOverlapTail = clean.slice(codonStart, RmutOverlapEnd);
  
  // Rmut forward = core + overlap tail
  const RmutForward = bestRmutCore.seq + RmutOverlapTail;
  const Rmut = revComp(RmutForward);
  const RmutTm = tmSaltCorrected(Rmut, conc_nM, na_mM, mg_mM);
  
  // Mutation position in Rmut (after RC)
  const mutStartInForward = bestRmutCore.seq.length; // where mutation starts in forward
  const mutEndInForward = mutStartInForward + 3;
  const RmutLen = Rmut.length;
  const RmutMutIndex = RmutLen - 1 - mutEndInForward; // position in RC
  const RmutMutLen = 3;

  // === Step 3: Design F1 and R2 (anchor primers from start/stop) ===
  // F1: from 5' start codon region
  let bestF1 = null;
  for (let L = minOuterLen; L <= maxOuterLen; L++) {
    const seq = clean.slice(0, L);
    const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
    if (!bestF1 || Math.abs(tm - outerTargetTm) < Math.abs(bestF1.tm - outerTargetTm)) {
      bestF1 = { seq, len: seq.length, tm };
    }
  }
  if (!bestF1) {
    const seq = clean.slice(0, Math.min(maxOuterLen, lenGenome));
    bestF1 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
  }
  
  // Add user-defined F overlap sequence to F1 (5' end)
  const F1Final = (userFOverlap ? userFOverlap : '') + bestF1.seq;
  const F1FinalTm = tmSaltCorrected(F1Final, conc_nM, na_mM, mg_mM);

  // R2: from 3' stop codon region (reverse complement)
  let bestR2 = null;
  for (let L = minOuterLen; L <= maxOuterLen; L++) {
    const start = Math.max(0, lenGenome - L);
    const forwardRegion = clean.slice(start, lenGenome);
    const seq = revComp(forwardRegion);
    const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
    if (!bestR2 || Math.abs(tm - outerTargetTm) < Math.abs(bestR2.tm - outerTargetTm)) {
      bestR2 = { seq, len: seq.length, tm };
    }
  }
  if (!bestR2) {
    const start = Math.max(0, lenGenome - maxOuterLen);
    const forwardRegion = clean.slice(start, lenGenome);
    const seq = revComp(forwardRegion);
    bestR2 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
  }

  // Add user-defined R overlap sequence to R2 (5' end, which is the 3' end of the forward sequence)
  // R2 is already reverse complement, so we add user R overlap to its 5' end
  const R2Final = (userROverlap ? userROverlap : '') + bestR2.seq;
  const R2FinalTm = tmSaltCorrected(R2Final, conc_nM, na_mM, mg_mM);

  function makePrimerInfo(seq, tmVal, mutStartIndex = null, mutLength = 0, coreTm = null, overlapTm = null) {
    return {
      seq,
      len: seq.length,
      gc: gcContent(seq),
      tm: tmVal,
      mutStartIndex,
      mutLength,
      coreTm,
      overlapTm
    };
  }

  // Calculate overlap Tm for round-2 annealing region between the two fragments.
  // This overlap spans mutation start-end and should be the SAME for Fmut and Rmut.
  const fullOverlapSeq = FmutOverlapTail + RmutOverlapTail.slice(3);
  const fullOverlapTm = tmSaltCorrected(fullOverlapSeq, conc_nM, na_mM, mg_mM);
  const FmutOverlapTm = fullOverlapTm;
  const RmutOverlapTm = fullOverlapTm;
  
  // Calculate user-defined overlap sequence Tms (for F1 and R2)
  const F1OverlapTm = userFOverlap ? tmSaltCorrected(userFOverlap, conc_nM, na_mM, mg_mM) : null;
  const R2OverlapTm = userROverlap ? tmSaltCorrected(userROverlap, conc_nM, na_mM, mg_mM) : null;

  const F1info = makePrimerInfo(F1Final, F1FinalTm, null, 0, bestF1.tm, F1OverlapTm);
  const R2info = makePrimerInfo(R2Final, R2FinalTm, null, 0, bestR2.tm, R2OverlapTm);
  const FmutInfo = makePrimerInfo(Fmut, FmutTm, FmutMutIndex, FmutMutLen, bestFmutCore.tm, FmutOverlapTm);
  const RmutInfo = makePrimerInfo(Rmut, RmutTm, RmutMutIndex, RmutMutLen, bestRmutCore.tm, RmutOverlapTm);

  return {
    F1: F1info,
    Fmut: FmutInfo,
    Rmut: RmutInfo,
    R2: R2info,
    info: {
      fmutCoreSeq: bestFmutCore.seq,
      fmutCoreTm: bestFmutCore.tm,
      rmutCoreSeq: bestRmutCore.seq,
      rmutCoreTm: bestRmutCore.tm,
      overlapBefore: FmutOverlapTail,
      overlapAfter: RmutOverlapTail,
      overlapSeq: fullOverlapSeq,
      overlapTm: fullOverlapTm,
      // For reference/debug
      fmutOverlapSeq: FmutOverlapTail,
      fmutOverlapTm: tmSaltCorrected(FmutOverlapTail, conc_nM, na_mM, mg_mM),
      rmutOverlapSeq: RmutOverlapTail,
      rmutOverlapTm: tmSaltCorrected(RmutOverlapTail, conc_nM, na_mM, mg_mM)
    }
  };
}

// ===== Dynamic primer design for DNA edits =====
// This function adaptively assigns overlap and core regions for replacement/insertion edits
// without hard-coding 20/20/20. It attempts to ensure a central overlap with sufficient Tm
// and cores binding to the two flanking fragments. If necessary it will expand overlap
// and fall back to WT sequence around the edit.
// For deletion: wtEndPos (0-based exclusive) should be provided to correctly calculate right core in WT
// Design single-fragment PCR primers for DNA edits (for edits too close to sequence ends)
function designSingleFragmentPCRForDNAEdit(mutantTemplate, wtTemplate, editStart, editEnd, editLen, opts = {}) {
  const clean = cleanDNA(mutantTemplate);
  const cleanWT = wtTemplate ? cleanDNA(wtTemplate) : clean;
  const seqLen = clean.length;
  
  const coreTargetTm = opts.coreTargetTm ?? 60;
  const outerTargetTm = opts.outerTargetTm ?? 60;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  
  const minCoreLen = opts.minCoreLen ?? 18;
  const maxCoreLen = opts.maxCoreLen ?? 40;
  const minOuterLen = opts.minOuterLen ?? 18;
  const maxOuterLen = opts.maxOuterLen ?? 30;
  
  // Get user-defined overlap sequences (if provided)
  const userFOverlap = opts.userFOverlap ? cleanDNA(opts.userFOverlap) : '';
  const userROverlap = opts.userROverlap ? cleanDNA(opts.userROverlap) : '';
  
  // Clamp positions
  editStart = Math.max(0, Math.min(seqLen, editStart));
  editEnd = Math.max(editStart, Math.min(seqLen, editEnd));
  
  const minFragmentLen = opts.minFragmentLen ?? 39;
  const leftAvailable = editStart;
  const rightAvailable = seqLen - editEnd;

  const maxSingleFlank = opts.maxSingleFlank ?? 39;
  const wtRightAnchorPos = (opts.wtEndPos !== undefined && opts.wtEndPos !== null)
    ? Math.max(0, Math.min(cleanWT.length, opts.wtEndPos))
    : editEnd;
  
  let Fmut, Rmut, F1, R2;
  let useLeftAnchor = false;
  let useRightAnchor = false;
  let bestFmutCore = null;
  let bestRmutCore = null;
  
  // Determine operation type based on editLen
  const operation = editLen === 0 ? 'insertion' : (editLen < (editEnd - editStart) ? 'deletion' : 'replacement');
  const newSeq = clean.slice(editStart, editEnd); // The new sequence in mutant template
  const newSeqRC = newSeq ? revComp(newSeq) : '';

  function inferHighlight(seq, target) {
    if (!seq || !target) return { startIndex: null, length: 0 };
    const idx = seq.indexOf(target);
    if (idx < 0) return { startIndex: null, length: 0 };
    return { startIndex: idx, length: target.length };
  }
  
  if (leftAvailable < minFragmentLen && rightAvailable >= minFragmentLen) {
    // Edit too close to start: use Fmut (with edit) + R2 (right anchor)
    useRightAnchor = true;
    
    // Fmut: left flank + new sequence + right core
    const leftFlankLen = Math.min(maxSingleFlank, Math.max(0, editStart));
    const FmutLeftFlank = cleanWT.slice(Math.max(0, editStart - leftFlankLen), editStart);
    Fmut = FmutLeftFlank + newSeq;
    
    // Add right core
    for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
      const coreStart = editEnd;
      const coreEnd = Math.min(seqLen, coreStart + cLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      if (coreSeq.length < minCoreLen) continue;
      const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!bestFmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestFmutCore.tm - coreTargetTm)) {
        bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm };
      }
    }
    if (!bestFmutCore) {
      const coreStart = editEnd;
      const coreEnd = Math.min(seqLen, coreStart + maxCoreLen);
      const coreSeq = clean.slice(coreStart, coreEnd);
      bestFmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM) };
    }
    Fmut = Fmut + bestFmutCore.seq;
    
    // R2: from 3' end (reverse complement)
    let bestR2 = null;
    for (let L = minOuterLen; L <= maxOuterLen; L++) {
      const start = Math.max(0, seqLen - L);
      const forwardRegion = clean.slice(start, seqLen);
      const seq = revComp(forwardRegion);
      const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
      if (!bestR2 || Math.abs(tm - outerTargetTm) < Math.abs(bestR2.tm - outerTargetTm)) {
        bestR2 = { seq, len: seq.length, tm };
      }
    }
    if (!bestR2) {
      const start = Math.max(0, seqLen - maxOuterLen);
      const forwardRegion = clean.slice(start, seqLen);
      const seq = revComp(forwardRegion);
      bestR2 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
    }
    R2 = (userROverlap ? userROverlap : '') + bestR2.seq;
    
    F1 = null;
    Rmut = null;
    
  } else if (rightAvailable < minFragmentLen && leftAvailable >= minFragmentLen) {
    // Edit too close to end: use F1 (left anchor) + Rmut (with edit)
    useLeftAnchor = true;
    
    // F1: from 5' start
    let bestF1 = null;
    for (let L = minOuterLen; L <= maxOuterLen; L++) {
      const seq = clean.slice(0, L);
      const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
      if (!bestF1 || Math.abs(tm - outerTargetTm) < Math.abs(bestF1.tm - outerTargetTm)) {
        bestF1 = { seq, len: seq.length, tm };
      }
    }
    if (!bestF1) {
      const seq = clean.slice(0, Math.min(maxOuterLen, seqLen));
      bestF1 = { seq, len: seq.length, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
    }
    F1 = (userFOverlap ? userFOverlap : '') + bestF1.seq;
    
    // Rmut: left core + new sequence + right flank (then RC)
    for (let cLen = minCoreLen; cLen <= maxCoreLen; cLen++) {
      const coreEnd = editStart;
      const coreStart = Math.max(0, coreEnd - cLen);
      const coreSeq = cleanWT.slice(coreStart, coreEnd);
      if (coreSeq.length < minCoreLen) continue;
      const coreTm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!bestRmutCore || Math.abs(coreTm - coreTargetTm) < Math.abs(bestRmutCore.tm - coreTargetTm)) {
        bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: coreTm };
      }
    }
    if (!bestRmutCore) {
      const coreEnd = editStart;
      const coreStart = Math.max(0, coreEnd - maxCoreLen);
      const coreSeq = cleanWT.slice(coreStart, coreEnd);
      bestRmutCore = { seq: coreSeq, len: coreSeq.length, tm: tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM) };
    }
    
    const rightAvailWT = Math.max(0, cleanWT.length - wtRightAnchorPos);
    const rightFlankLen = Math.min(maxSingleFlank, rightAvailWT);
    const RmutRightFlank = cleanWT.slice(wtRightAnchorPos, wtRightAnchorPos + rightFlankLen);
    const RmutForward = bestRmutCore.seq + newSeq + RmutRightFlank;
    Rmut = revComp(RmutForward);
    
    Fmut = null;
    R2 = null;
    
  } else {
    // Both sides are too short - use Fmut + Rmut (minimal single fragment)
    const leftFlankLen = Math.min(maxSingleFlank, Math.max(0, editStart));
    const FmutLeftFlank = cleanWT.slice(Math.max(0, editStart - leftFlankLen), editStart);
    Fmut = FmutLeftFlank + newSeq;
    const rightCoreLen = Math.min(maxCoreLen, rightAvailable);
    const rightCore = clean.slice(editEnd, Math.min(seqLen, editEnd + rightCoreLen));
    Fmut = Fmut + rightCore;
    bestFmutCore = { seq: rightCore, len: rightCore.length, tm: tmSaltCorrected(rightCore, conc_nM, na_mM, mg_mM) };
    
    const leftCoreLen = Math.min(maxCoreLen, leftAvailable);
    const leftCore = cleanWT.slice(Math.max(0, editStart - leftCoreLen), editStart);
    const rightAvailWT = Math.max(0, cleanWT.length - wtRightAnchorPos);
    const rightFlankLen = Math.min(maxSingleFlank, rightAvailWT);
    const RmutRightFlank = cleanWT.slice(wtRightAnchorPos, wtRightAnchorPos + rightFlankLen);
    const RmutForward = leftCore + newSeq + RmutRightFlank;
    Rmut = revComp(RmutForward);
    bestRmutCore = { seq: leftCore, len: leftCore.length, tm: tmSaltCorrected(leftCore, conc_nM, na_mM, mg_mM) };
    
    F1 = null;
    R2 = null;
  }
  
  // Build primer info objects
  function infoPrimer(seq, tmVal, coreTm = null, overlapTm = null, mutStartIndex = null, mutLength = 0) {
    if (!seq) return null;
    return {
      seq,
      len: seq.length,
      gc: gcContent(seq),
      tm: tmVal,
      mutStartIndex,
      mutLength,
      coreTm,
      overlapTm
    };
  }
  
  const FmutTm = Fmut ? tmSaltCorrected(Fmut, conc_nM, na_mM, mg_mM) : 0;
  const RmutTm = Rmut ? tmSaltCorrected(Rmut, conc_nM, na_mM, mg_mM) : 0;
  const F1Tm = F1 ? tmSaltCorrected(F1, conc_nM, na_mM, mg_mM) : 0;
  const R2Tm = R2 ? tmSaltCorrected(R2, conc_nM, na_mM, mg_mM) : 0;
  
  const F1CoreSeq = F1 && userFOverlap ? F1.slice(userFOverlap.length) : F1;
  const F1CoreTm = F1CoreSeq ? tmSaltCorrected(F1CoreSeq, conc_nM, na_mM, mg_mM) : F1Tm;
  const F1OverlapTm = F1 && userFOverlap ? tmSaltCorrected(userFOverlap, conc_nM, na_mM, mg_mM) : null;
  
  const R2CoreSeq = R2 && userROverlap ? R2.slice(userROverlap.length) : R2;
  const R2CoreTm = R2CoreSeq ? tmSaltCorrected(R2CoreSeq, conc_nM, na_mM, mg_mM) : R2Tm;
  const R2OverlapTm = R2 && userROverlap ? tmSaltCorrected(userROverlap, conc_nM, na_mM, mg_mM) : null;
  
  const fmutHL = inferHighlight(Fmut, newSeq);
  const rmutHL = inferHighlight(Rmut, newSeqRC);

  return {
    F1: infoPrimer(F1, F1Tm, F1CoreTm, F1OverlapTm),
    Fmut: infoPrimer(Fmut, FmutTm, Fmut ? bestFmutCore?.tm : null, null, fmutHL.startIndex, fmutHL.length),
    Rmut: infoPrimer(Rmut, RmutTm, Rmut ? bestRmutCore?.tm : null, null, rmutHL.startIndex, rmutHL.length),
    R2: infoPrimer(R2, R2Tm, R2CoreTm, R2OverlapTm),
    isSingleFragment: true,
    useLeftAnchor,
    useRightAnchor
  };
}

export function designOePcrPrimersForDNAEditDynamic(mutantTemplate, wtTemplate, editStart, editEnd, editLen, opts = {}) {
  const clean = cleanDNA(mutantTemplate);
  const cleanWT = wtTemplate ? cleanDNA(wtTemplate) : '';
  const seqLen = clean.length;

  // Check if edit is too close to sequence ends - use single-fragment PCR instead
  const minFragmentLen = opts.minFragmentLen ?? 39; // Minimum PCR fragment length
  const leftAvailable = editStart; // Available sequence before edit
  const rightAvailable = seqLen - editEnd; // Available sequence after edit
  
  // If edit is too close to either end, use single-fragment PCR
  if (leftAvailable < minFragmentLen || rightAvailable < minFragmentLen) {
    return designSingleFragmentPCRForDNAEdit(mutantTemplate, wtTemplate, editStart, editEnd, editLen, opts);
  }

  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;

  const desiredCore = opts.desiredCore ?? 20; // typical core binding length
  const desiredOverlap = opts.desiredOverlap ?? 20; // desired central overlap
  const minOverlapTm = opts.minOverlapTm ?? 55; // QC threshold
  const maxCap = opts.maxSearchRadius ?? 60; // 60bp cap
  const minCore = opts.minCore ?? 12;

  // clamp positions
  editStart = Math.max(0, Math.min(seqLen, editStart));
  editEnd = Math.max(editStart, Math.min(seqLen, editEnd));

  // Helper: compute best overlap for various strategies
  function computeOverlapForReplacementOrInsertion() {
    // For replacement/insertion OE-PCR:
    // Two strategies based on new sequence length:
    // 1. Long new sequence (>= desiredOverlap): overlap is WITHIN the new sequence
    // 2. Short new sequence (< desiredOverlap): overlap SPANS the new sequence + flanking WT
    
    let best = null;
    const localEditLen = Math.max(0, editEnd - editStart);

    if (localEditLen === 0) {
      // No edit region (pure insertion point), use default overlap from template
      const overlapLen = Math.min(desiredOverlap, seqLen);
      const overlapStart = Math.max(0, editStart - Math.floor(overlapLen / 2));
      const seq = clean.slice(overlapStart, overlapStart + overlapLen);
      return { seq, start: overlapStart, len: overlapLen, tm: tmSaltCorrected(seq, conc_nM, na_mM, mg_mM) };
    }

    // Strategy decision: if new sequence is shorter than desired overlap,
    // use "short sequence" strategy (like point mutation)
    const useShortStrategy = localEditLen < desiredOverlap;
    
    if (useShortStrategy) {
      // SHORT NEW SEQUENCE STRATEGY:
      // Similar to point mutation - overlap spans: [WT left flank] + [new seq] + [WT right flank]
      // The overlap is centered on the new sequence
      // Fmut = overlap (contains new seq) + coreRight
      // Rmut = coreLeft + overlap (contains new seq)
      // Both primers carry the COMPLETE new sequence in their overlap region
      
      if (!cleanWT) {
        // Need WT template for this strategy
        // Fall back to using mutant template flanking regions
      }
      
      // Get WT boundaries
      let wtEndPos = editStart;
      if (opts.wtEndPos !== undefined) {
        wtEndPos = opts.wtEndPos;
      } else if (cleanWT && cleanWT.length !== seqLen) {
        // Calculate WT end position based on length difference
        const wtEditLen = cleanWT.length - seqLen + localEditLen;
        wtEndPos = editStart + wtEditLen;
      } else {
        // Assume same length edit (replacement of same size) or use editEnd mapping
        wtEndPos = editStart + localEditLen; // This might need adjustment
      }
      
      // For short replacement, overlap = WT_left_flank + new_seq + WT_right_flank
      // Overlap must have Tm >= minOverlapTm (typically 55-60°C)
      // Start with desiredOverlap and increase if needed to meet Tm requirement
      
      const minFlank = 8; // Minimum flank on each side
      const maxFlank = 20; // Maximum flank on each side
      
      let bestScore = Infinity;
      
      // Try different total lengths, starting from minimum that could meet Tm
      // Increase length until we find one that meets Tm requirement
      for (let totalFlank = minFlank * 2; totalFlank <= maxFlank * 2; totalFlank++) {
        // Try different left/right splits
        for (let leftLen = minFlank; leftLen <= totalFlank - minFlank && leftLen <= maxFlank; leftLen++) {
          const rightLen = totalFlank - leftLen;
          if (rightLen < minFlank || rightLen > maxFlank) continue;
          
          const totalLen = leftLen + localEditLen + rightLen;
          
          // Check bounds
          if (editStart - leftLen < 0) continue;
          if (cleanWT && wtEndPos + rightLen > cleanWT.length) continue;
          if (!cleanWT && editEnd + rightLen > seqLen) continue;
          
          // Construct overlap: WT_left + new_seq + WT_right
          let overlapSeq;
          if (cleanWT) {
            const wtLeftFlank = cleanWT.slice(editStart - leftLen, editStart);
            const newSeq = clean.slice(editStart, editEnd);
            const wtRightFlank = cleanWT.slice(wtEndPos, wtEndPos + rightLen);
            overlapSeq = wtLeftFlank + newSeq + wtRightFlank;
          } else {
            const leftFlank = clean.slice(editStart - leftLen, editStart);
            const newSeq = clean.slice(editStart, editEnd);
            const rightFlank = clean.slice(editEnd, editEnd + rightLen);
            overlapSeq = leftFlank + newSeq + rightFlank;
          }
          
          const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
          if (!isFinite(tm)) continue;
          
          // Only accept if Tm meets requirement
          if (tm >= minOverlapTm) {
            const tmDiff = Math.abs(tm - minOverlapTm);
            // Prefer shorter length that still meets Tm, and balanced flanks
            const balancePenalty = Math.abs(leftLen - rightLen) * 0.05;
            const lenPenalty = totalLen * 0.01; // Slight preference for shorter
            const score = tmDiff + balancePenalty + lenPenalty;
            
            if (score < bestScore) {
              best = {
                seq: overlapSeq,
                start: editStart - leftLen,
                len: totalLen,
                tm,
                score,
                isShortReplacement: true,
                leftFlankLen: leftLen,
                rightFlankLen: rightLen,
                newSeqLen: localEditLen
              };
              bestScore = score;
            }
          }
        }
        
        // If we found a valid overlap at this total length, stop searching longer
        if (best && best.tm >= minOverlapTm) {
          break;
        }
    }

      // If still no valid overlap found, take the best Tm we could get
      if (!best) {
        for (let leftLen = minFlank; leftLen <= maxFlank && leftLen <= editStart; leftLen++) {
          const rightLen = leftLen; // Balanced flanks
          const totalLen = leftLen + localEditLen + rightLen;
          
          if (cleanWT && wtEndPos + rightLen > cleanWT.length) continue;
          
          let overlapSeq;
          if (cleanWT) {
            const wtLeftFlank = cleanWT.slice(editStart - leftLen, editStart);
            const newSeq = clean.slice(editStart, editEnd);
            const wtRightFlank = cleanWT.slice(wtEndPos, wtEndPos + rightLen);
            overlapSeq = wtLeftFlank + newSeq + wtRightFlank;
          } else {
            const leftFlank = clean.slice(editStart - leftLen, editStart);
            const newSeq = clean.slice(editStart, editEnd);
            const rightFlank = clean.slice(editEnd, editEnd + rightLen);
            overlapSeq = leftFlank + newSeq + rightFlank;
          }
          
          const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
          if (!isFinite(tm)) continue;
          
          if (!best || tm > best.tm) {
            best = {
              seq: overlapSeq,
              start: editStart - leftLen,
              len: totalLen,
              tm,
              score: Infinity,
              isShortReplacement: true,
              leftFlankLen: leftLen,
              rightFlankLen: rightLen,
              newSeqLen: localEditLen
            };
          }
      }
    }

    return best;
  }

    // LONG NEW SEQUENCE STRATEGY:
    // Overlap is WITHIN the new sequence
    // Fmut tail = back half of new seq (overlap to end)
    // Rmut tail = front half of new seq (start to overlap end)
    const preferredOverlapLen = Math.min(desiredOverlap, localEditLen);
    const minOverlapLen = Math.max(15, Math.floor(preferredOverlapLen * 0.8));
    const maxOverlapLen = Math.min(maxCap, localEditLen, Math.floor(preferredOverlapLen * 1.5));
    
    let bestScore = Infinity;
    
    for (let overlapLen = minOverlapLen; overlapLen <= maxOverlapLen; overlapLen++) {
      // Try different positions for overlap within the new sequence
      // Prefer centered overlap
      const minStart = editStart;
      const maxStart = Math.max(editStart, editEnd - overlapLen);
      
      for (let overlapStart = minStart; overlapStart <= maxStart; overlapStart++) {
        const seq = clean.slice(overlapStart, overlapStart + overlapLen);
        const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
        if (!isFinite(tm)) continue;
        
        const tmDiff = Math.abs(tm - minOverlapTm);
        // Prefer centered overlap
        const centerPos = (editStart + editEnd) / 2;
        const overlapCenter = overlapStart + overlapLen / 2;
        const centerDiff = Math.abs(overlapCenter - centerPos);
        const lenPenalty = Math.abs(overlapLen - preferredOverlapLen) * 0.1;
        const centerPenalty = centerDiff * 0.05;
        const score = tmDiff + lenPenalty + centerPenalty;
        
        if (tm >= minOverlapTm) {
          if (!best || score < bestScore) {
            best = {
              seq,
              start: overlapStart,
              len: overlapLen,
              tm,
              score,
              // CORRECTED: Fmut tail = new seq BACK half (overlap to end) → Fragment 2's 5' end
              // Rmut tail = new seq FRONT half (start to overlap) → Fragment 1's 3' end
              // This ensures correct assembly: [WT left] + [front half] ↔ [back half] + [WT right]
              fmutTailStart: overlapStart,
              fmutTailEnd: editEnd,
              rmutTailStart: editStart,
              rmutTailEnd: overlapStart + overlapLen,
              isReplacementOverlap: true
            };
            bestScore = score;
          }
        } else if (!best || tm > best.tm) {
          best = {
            seq,
            start: overlapStart,
            len: overlapLen,
            tm,
            score: Infinity,
            fmutTailStart: overlapStart,
            fmutTailEnd: editEnd,
            rmutTailStart: editStart,
            rmutTailEnd: overlapStart + overlapLen,
            isReplacementOverlap: true
          };
        }
      }
    }

    return best;
  }

  function computeOverlapForDeletion() {
    // For deletion OE-PCR:
    // - Fmut: [overlap_before (WT before deletion)] + [core binding to WT after deletion]
    // - Rmut: revComp([core binding to WT before deletion] + [overlap_after (WT after deletion)])
    // - The overlap region in the final product = overlap_before + overlap_after
    if (!cleanWT) return null;
    
    // Get WT deletion boundaries
    let wtEndPos = editStart;
    if (opts.wtEndPos !== undefined) {
      wtEndPos = opts.wtEndPos;
    } else if (cleanWT.length > seqLen) {
      const deletedLength = cleanWT.length - seqLen;
      wtEndPos = editStart + deletedLength;
    }
    
    // For deletion, we need two overlap parts:
    // overlap_before: sequence immediately before deletion (will be Fmut's 5' tail)
    // overlap_after: sequence immediately after deletion (will be Rmut's 5' tail after revComp)
    // Total overlap ≈ 20bp, split roughly equally
    const preferredHalf = Math.floor(desiredOverlap / 2);
    const minHalf = Math.max(8, Math.floor(preferredHalf * 0.7));
    const maxHalf = Math.min(15, Math.floor(preferredHalf * 1.5));
    
    let best = null;
    let bestScore = Infinity;
    
    for (let beforeLen = minHalf; beforeLen <= maxHalf; beforeLen++) {
      for (let afterLen = minHalf; afterLen <= maxHalf; afterLen++) {
        const totalLen = beforeLen + afterLen;
        
        // Check bounds
        if (editStart - beforeLen < 0 || wtEndPos + afterLen > cleanWT.length) continue;
        
        // Get overlap parts
        const overlapBefore = cleanWT.slice(editStart - beforeLen, editStart);
        const overlapAfter = cleanWT.slice(wtEndPos, wtEndPos + afterLen);
        const fullOverlap = overlapBefore + overlapAfter;
        
        const tm = tmSaltCorrected(fullOverlap, conc_nM, na_mM, mg_mM);
        if (!isFinite(tm)) continue;
        
        const tmDiff = Math.abs(tm - minOverlapTm);
        const lenPenalty = Math.abs(totalLen - desiredOverlap) * 0.1;
        const score = tmDiff + lenPenalty;
        
        if (tm >= minOverlapTm) {
          if (!best || score < bestScore) {
            best = {
              seq: fullOverlap,
              overlapBefore,
              overlapAfter,
              beforeLen,
              afterLen,
              beforeStart: editStart - beforeLen,
              afterStart: wtEndPos,
              wtEndPos,
              len: totalLen,
              tm,
              fromWT: true,
              score,
              isDeletionOverlap: true
            };
            bestScore = score;
          }
          // Return early if we found a good match
          if (tmDiff < 3 && totalLen >= desiredOverlap - 2 && totalLen <= desiredOverlap + 2) {
            return best;
          }
        } else if (!best || tm > best.tm) {
          best = {
            seq: fullOverlap,
            overlapBefore,
            overlapAfter,
            beforeLen,
            afterLen,
            beforeStart: editStart - beforeLen,
            afterStart: wtEndPos,
            wtEndPos,
            len: totalLen,
            tm,
            fromWT: true,
            score: Infinity,
            isDeletionOverlap: true
          };
        }
      }
    }
    
    return best;
  }

  // Choose overlap strategy
  let overlapBest = null;
  const isDeletion = (editLen === 0 || editEnd - editStart === 0);
  if (isDeletion) {
    overlapBest = computeOverlapForDeletion();
  } else {
    overlapBest = computeOverlapForReplacementOrInsertion();
  }

  if (!overlapBest) {
    throw new Error('Unable to design a sufficient overlap region for this edit. Try adjusting parameters or providing a longer flanking region.');
  }

  // Helper function to find optimal core length based on Tm target
  function findOptimalCore(seq, startPos, direction, targetTm, minLen, maxLen) {
    // direction: 'left' (extend backward) or 'right' (extend forward)
    let best = null;
    let bestTmDiff = Infinity;
    
    for (let len = minLen; len <= maxLen; len++) {
      let coreSeq;
      if (direction === 'left') {
        const coreStart = Math.max(0, startPos - len);
        coreSeq = seq.slice(coreStart, startPos);
      } else {
        const coreEnd = Math.min(seq.length, startPos + len);
        coreSeq = seq.slice(startPos, coreEnd);
      }
      
      if (coreSeq.length < minLen) continue;
      
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!isFinite(tm)) continue;
      
      const tmDiff = Math.abs(tm - targetTm);
      if (!best || tmDiff < bestTmDiff) {
        best = { seq: coreSeq, len: coreSeq.length, tm, tmDiff };
        bestTmDiff = tmDiff;
      }
      
      // If we found a good match, prefer shorter length
      if (tmDiff < 2 && len >= minLen) break;
    }
    
    // Fallback: return minimum length core
    if (!best) {
      if (direction === 'left') {
        const coreStart = Math.max(0, startPos - minLen);
        const fallbackSeq = seq.slice(coreStart, startPos);
        return { seq: fallbackSeq, len: fallbackSeq.length, tm: tmSaltCorrected(fallbackSeq, conc_nM, na_mM, mg_mM), tmDiff: Infinity };
      } else {
        const coreEnd = Math.min(seq.length, startPos + minLen);
        const fallbackSeq = seq.slice(startPos, coreEnd);
        return { seq: fallbackSeq, len: fallbackSeq.length, tm: tmSaltCorrected(fallbackSeq, conc_nM, na_mM, mg_mM), tmDiff: Infinity };
      }
    }
    
    return best;
  }

  // Determine cores: optimize for Tm, GC clamp, etc.
  const coreTargetTm = opts.coreTargetTm ?? minOverlapTm;
  const coreMinLen = opts.minCore ?? 12;
  const coreMaxLen = opts.maxCore ?? 40;
  
  // Left core: upstream of editStart
  let coreLeft, coreLeftStart, coreLeftEnd;
  if (isDeletion && cleanWT) {
    // For deletion: use WT template for left core
    const wtLeftCore = findOptimalCore(cleanWT, editStart, 'left', coreTargetTm, coreMinLen, coreMaxLen);
    coreLeft = wtLeftCore.seq;
    coreLeftEnd = editStart;
    coreLeftStart = editStart - coreLeft.length;
  } else {
    const leftCore = findOptimalCore(clean, editStart, 'left', coreTargetTm, coreMinLen, coreMaxLen);
    coreLeft = leftCore.seq;
    coreLeftEnd = editStart;
    coreLeftStart = editStart - coreLeft.length;
    // Try WT fallback if available
    if (cleanWT && coreLeft.length < desiredCore) {
      const wtLeftCore = findOptimalCore(cleanWT, editStart, 'left', coreTargetTm, coreMinLen, coreMaxLen);
      if (wtLeftCore.seq.length > coreLeft.length) {
        coreLeft = wtLeftCore.seq;
        coreLeftStart = editStart - coreLeft.length;
      }
    }
  }

  // Right core: downstream of edit region
  // IMPORTANT: For OE-PCR, coreRight must bind to WT template AFTER the edit region
  // So we need to use WT template's wtEndPos, not mutant's editEnd
  let coreRight, coreRightStart, coreRightEnd;
  
  // Calculate wtEndPos (position in WT where edit region ends)
  let wtEndPos = editEnd; // Default for same-length replacement
  if (opts.wtEndPos !== undefined) {
    wtEndPos = opts.wtEndPos;
  } else if (cleanWT && cleanWT.length !== seqLen) {
    // WT is longer/shorter than mutant, calculate WT end position
    // wtEndPos = editStart + (WT edit length)
    // WT edit length = cleanWT.length - seqLen + (editEnd - editStart)
    const wtEditLen = cleanWT.length - seqLen + (editEnd - editStart);
    wtEndPos = editStart + wtEditLen;
  }
  
  if (cleanWT) {
    // Use WT template for right core (binds to WT after edit region)
    const wtRightCore = findOptimalCore(cleanWT, wtEndPos, 'right', coreTargetTm, coreMinLen, coreMaxLen);
    coreRight = wtRightCore.seq;
    coreRightStart = wtEndPos;
    coreRightEnd = wtEndPos + coreRight.length;
  } else {
    // No WT template, use mutant template (less ideal)
    const rightCore = findOptimalCore(clean, editEnd, 'right', coreTargetTm, coreMinLen, coreMaxLen);
    coreRight = rightCore.seq;
    coreRightStart = editEnd;
    coreRightEnd = editEnd + coreRight.length;
  }

  if (coreLeft.length < 8 || coreRight.length < 8) {
    throw new Error('Unable to obtain sufficient core length for primers; check sequence boundaries.');
  }

  // Get user-defined overlap sequences (if provided) - these will be added to F1 and R2
  const userFOverlap = opts.userFOverlap ? cleanDNA(opts.userFOverlap) : '';
  const userROverlap = opts.userROverlap ? cleanDNA(opts.userROverlap) : '';

  // Build primers
  let Fmut, RmutForward;
  
  if (isDeletion && overlapBest && overlapBest.isDeletionOverlap) {
    // For deletion: special primer structure
    // Fmut = overlapBefore (5' tail, hangs off WT) + coreRight (3' core, binds to WT after deletion)
    // RmutForward = coreLeft (binds to WT before deletion) + overlapAfter (3' tail, hangs off WT)
    // Then Rmut = revComp(RmutForward)
    // 
    // After Round 1 PCR:
    // - Fragment 1 (F1 + Rmut) 3' end = coreLeft + overlapAfter
    // - Fragment 2 (Fmut + R2) 5' end = overlapBefore + coreRight
    // 
    // Overlap region (where they match) = overlapBefore + overlapAfter
    // This works because coreLeft ends at editStart (includes some of overlapBefore region)
    // and coreRight starts at wtEndPos (includes some of overlapAfter region)
    
    const overlapBefore = overlapBest.overlapBefore;
    const overlapAfter = overlapBest.overlapAfter;
    
    // Fmut: overlapBefore (5' tail) + coreRight (3' binding, starts from wtEndPos)
    Fmut = overlapBefore + coreRight;
    
    // RmutForward: coreLeft (ends at editStart) + overlapAfter (3' tail)
    RmutForward = coreLeft + overlapAfter;
    
  } else if (overlapBest && overlapBest.isShortReplacement) {
    // For SHORT replacement/insertion (new seq < ~20bp):
    // Similar to point mutation - both primers carry the SAME overlap which contains the full new sequence
    // Overlap = [WT left flank] + [complete new seq] + [WT right flank]
    //
    // IMPORTANT: Core regions must NOT overlap with the overlap's flanks!
    // - coreRight starts AFTER the overlap's right edge (wtEndPos + rightFlankLen)
    // - coreLeft ends BEFORE the overlap's left edge (editStart - leftFlankLen)
    //
    // Example for 3bp replacement at position 100-107:
    // - New sequence = 3bp (e.g., "GTG")
    // - leftFlankLen = 8, rightFlankLen = 9
    // - Overlap = WT[91:99] + "GTG" + WT[107:116] = 20bp total
    // - coreRight starts at WT[116], NOT WT[107]
    // - coreLeft ends at WT[91], NOT WT[99]
    // - Fmut = overlap + coreRight(from 116)
    // - Rmut = revComp(coreLeft(to 91) + overlap)
    
  const overlapSeq = overlapBest.seq;
    const leftFlankLen = overlapBest.leftFlankLen || 0;
    const rightFlankLen = overlapBest.rightFlankLen || 0;
    
    // Recalculate cores to avoid overlap with the overlap's flanks
    // coreRight should start from where overlap's right flank ends
    const coreRightStartAdj = wtEndPos + rightFlankLen;
    let coreRightAdj = '';
    if (cleanWT && coreRightStartAdj < cleanWT.length) {
      const adjCore = findOptimalCore(cleanWT, coreRightStartAdj, 'right', coreTargetTm, coreMinLen, coreMaxLen);
      coreRightAdj = adjCore.seq;
    }
    if (coreRightAdj.length < 8) {
      // Fallback to original coreRight if adjusted one is too short
      coreRightAdj = coreRight;
    }
    
    // coreLeft should end where overlap's left flank starts
    const coreLeftEndAdj = editStart - leftFlankLen;
    let coreLeftAdj = '';
    if (cleanWT && coreLeftEndAdj > 0) {
      const adjCore = findOptimalCore(cleanWT, coreLeftEndAdj, 'left', coreTargetTm, coreMinLen, coreMaxLen);
      coreLeftAdj = adjCore.seq;
    }
    if (coreLeftAdj.length < 8) {
      // Fallback to original coreLeft if adjusted one is too short
      coreLeftAdj = coreLeft;
    }
    
    // Fmut: overlap (5' tail with complete new seq) + coreRight (3' binding, starts after overlap)
    Fmut = overlapSeq + coreRightAdj;
    
    // RmutForward: coreLeft (binding, ends before overlap) + overlap (3' tail with complete new seq)
    RmutForward = coreLeftAdj + overlapSeq;
    
  } else if (overlapBest && overlapBest.isReplacementOverlap) {
    // For LONG replacement/insertion (new seq >= ~20bp):
    // CORRECTED LOGIC:
    // - Fmut tail = new sequence BACK half (overlapStart to editEnd) → goes to Fragment 2's 5' end
    // - Rmut tail = new sequence FRONT half (editStart to overlapEnd) → goes to Fragment 1's 3' end
    // - Core regions bind to WT template for PCR
    //
    // Example for 60bp replacement at position 100-107:
    // - New sequence at mutant[99:159] (0-based)
    // - Overlap at mutant[119:139] (20bp in the middle)
    // - Fmut tail = mutant[119:159] (40bp, back half) + coreRight from WT
    // - Rmut tail = mutant[99:139] (40bp, front half) + coreLeft from WT
    //
    // After Round 1 PCR on WT:
    // - Fragment 1 (F1 + Rmut): WT[start:99] + new seq[0:40] (front half from Rmut tail)
    // - Fragment 2 (Fmut + R2): new seq[20:60] (back half from Fmut tail) + WT[107:end]
    //
    // Assembly via overlap (new seq[20:40]):
    // Final: WT[left] + new seq[0:20] + overlap[20:40] + new seq[40:60] + WT[right]
    //      = WT[left] + complete new seq + WT[right] ✓
    
    const fmutTail = clean.slice(overlapBest.fmutTailStart, overlapBest.fmutTailEnd);
    const rmutTail = clean.slice(overlapBest.rmutTailStart, overlapBest.rmutTailEnd);
    
    // Fmut: fmutTail (5' tail with back half of new seq) + coreRight (3' binding to WT after edit)
    Fmut = fmutTail + coreRight;
    
    // RmutForward: coreLeft (binding to WT before edit) + rmutTail (3' tail with front half of new seq)
    RmutForward = coreLeft + rmutTail;
    
  } else {
    // Fallback: simple overlap + core structure
    const overlapSeq = overlapBest.seq;
    Fmut = overlapSeq + coreRight;
    RmutForward = coreLeft + overlapSeq;
  }
  
  const FmutTm = tmSaltCorrected(Fmut, conc_nM, na_mM, mg_mM);
  const Rmut = revComp(RmutForward);
  const RmutTm = tmSaltCorrected(Rmut, conc_nM, na_mM, mg_mM);

  // Anchor primers (F1/R2) as before
  const minOuterLen = opts.minOuterLen ?? 18;
  const maxOuterLen = opts.maxOuterLen ?? 30;
  let bestF1 = null;
  for (let L = minOuterLen; L <= maxOuterLen; L++) {
    const seq = clean.slice(0, L);
    const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
    if (!bestF1 || Math.abs(tm - (opts.outerTargetTm ?? 60)) < Math.abs(bestF1.tm - (opts.outerTargetTm ?? 60))) bestF1 = { seq, len: seq.length, tm };
  }
  let bestR2 = null;
  for (let L = minOuterLen; L <= maxOuterLen; L++) {
    const start = Math.max(0, seqLen - L);
    const forwardRegion = clean.slice(start, seqLen);
    const seq = revComp(forwardRegion);
    const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
    if (!bestR2 || Math.abs(tm - (opts.outerTargetTm ?? 60)) < Math.abs(bestR2.tm - (opts.outerTargetTm ?? 60))) bestR2 = { seq, len: seq.length, tm };
  }

  // Add user-defined overlap sequences to F1 and R2
  const F1Final = (userFOverlap ? userFOverlap : '') + bestF1.seq;
  const F1FinalTm = tmSaltCorrected(F1Final, conc_nM, na_mM, mg_mM);
  const R2Final = (userROverlap ? userROverlap : '') + bestR2.seq;
  const R2FinalTm = tmSaltCorrected(R2Final, conc_nM, na_mM, mg_mM);

  const newSeq = clean.slice(editStart, editEnd);
  const newSeqRC = newSeq ? revComp(newSeq) : '';
  const fmutIdx = newSeq ? (Fmut ? Fmut.indexOf(newSeq) : -1) : -1;
  const rmutIdx = newSeqRC ? (Rmut ? Rmut.indexOf(newSeqRC) : -1) : -1;
  const fmutHL = fmutIdx >= 0 ? { startIndex: fmutIdx, length: newSeq.length } : { startIndex: null, length: 0 };
  const rmutHL = rmutIdx >= 0 ? { startIndex: rmutIdx, length: newSeqRC.length } : { startIndex: null, length: 0 };

  function infoPrimer(seq, tm, coreTm = null, overlapTm = null, mutStartIndex = null, mutLength = 0) { 
    return {
      seq, 
      len: seq.length, 
      gc: gcContent(seq), 
      tm,
      mutStartIndex,
      mutLength,
      coreTm,
      overlapTm
    }; 
  }

  // Calculate core Tms
  const coreLeftTm = tmSaltCorrected(coreLeft, conc_nM, na_mM, mg_mM);
  const coreRightTm = tmSaltCorrected(coreRight, conc_nM, na_mM, mg_mM);
  
  // Calculate overlap Tm (for Fmut and Rmut only, F1 and R2 don't have overlap)
  const overlapTmVal = overlapBest.tm;
  
  // Calculate user-defined overlap sequence Tms (for F1 and R2)
  const F1OverlapTm = userFOverlap ? tmSaltCorrected(userFOverlap, conc_nM, na_mM, mg_mM) : null;
  const R2OverlapTm = userROverlap ? tmSaltCorrected(userROverlap, conc_nM, na_mM, mg_mM) : null;

  // Get overlap info
  const overlapStart = overlapBest.start || overlapBest.beforeStart || 0;
  const overlapLen = overlapBest.len || 0;

  return {
    F1: infoPrimer(F1Final, F1FinalTm, bestF1.tm, F1OverlapTm), // F1 = user F overlap + core (for full-length PCR)
    Fmut: infoPrimer(Fmut, FmutTm, coreRightTm, overlapTmVal, fmutHL.startIndex, fmutHL.length), // Fmut = overlap + coreRight
    Rmut: infoPrimer(Rmut, RmutTm, coreLeftTm, overlapTmVal, rmutHL.startIndex, rmutHL.length),  // Rmut = revComp(coreLeft + overlap)
    R2: infoPrimer(R2Final, R2FinalTm, bestR2.tm, R2OverlapTm),   // R2 = user R overlap + core (for full-length PCR)
    info: {
      overlapStart,
      overlapLen,
      overlapSeq: overlapBest.seq,
      overlapTm: overlapTmVal,
      coreLeftSeq: coreLeft,
      coreLeftTm,
      coreLeftStart,
      coreLeftLen: coreLeft.length,
      coreRightSeq: coreRight,
      coreRightTm,
      coreRightStart,
      coreRightLen: coreRight.length,
      overlapFromWT: !!overlapBest.fromWT,
      isDeletion,
      overlapBefore: overlapBest.overlapBefore || null,
      overlapAfter: overlapBest.overlapAfter || null
    }
  };
}

// mutagenesis_ui.js (v3)
// Vertical layout; OE-PCR primers; highlights mutation positions in protein and primers.

let moduleContainer = null;
let currentResults = null;
let currentSeqName = null;
let currentDNAMode = false;
let currentDNAPrimers = [];
let currentMutantSequence = null;

function debugLogFmutRmutParts(title, primerInfo) {
  if (!primerInfo) return;
  const info = primerInfo.info || {};
  const fmut = primerInfo.Fmut || {};
  const rmut = primerInfo.Rmut || {};

  const fCoreSeq = info.coreRightSeq || info.fmutCoreSeq || null;
  const fCoreTm = info.coreRightTm ?? info.fmutCoreTm ?? fmut.coreTm ?? null;
  const rCoreSeq = info.coreLeftSeq || info.rmutCoreSeq || null;
  const rCoreTm = info.coreLeftTm ?? info.rmutCoreTm ?? rmut.coreTm ?? null;

  const overlapSeq = info.overlapSeq || null;
  const overlapTm = info.overlapTm ?? null;
  const overlapBefore = info.overlapBefore || null;
  const overlapAfter = info.overlapAfter || null;
  const fullOverlap = overlapBefore && overlapAfter ? overlapBefore + overlapAfter : overlapSeq;

  const payload = {
    title,
    fmutCoreSeq: fCoreSeq,
    fmutCoreTm: fCoreTm,
    rmutCoreSeq: rCoreSeq,
    rmutCoreTm: rCoreTm,
    overlapBefore,
    overlapAfter,
    fullOverlap,
    overlapTm,
    overlapSeq,
    // raw primer strings (for quick copy)
    Fmut: fmut.seq || null,
    Rmut: rmut.seq || null
  };

  // Always show a one-line object (no need to expand groups).
  console.log('[Mutagenesis Debug]', payload);

  // Also show an expanded group for readability.
  console.group(`[Mutagenesis Debug] ${title}`);
  console.log('Fmut core seq:', fCoreSeq);
  console.log('Fmut core Tm:', fCoreTm);
  console.log('Rmut core seq:', rCoreSeq);
  console.log('Rmut core Tm:', rCoreTm);
  console.log('OverlapBefore:', overlapBefore);
  console.log('OverlapAfter:', overlapAfter);
  console.log('Full overlap:', fullOverlap);
  console.log('Overlap Tm:', overlapTm);
  console.groupEnd();
}

function $(id) {
  if (moduleContainer) {
    const el = moduleContainer.querySelector(`#${id}`);
    if (el) return el;
  }
  return document.getElementById(id);
}

function showCDSDetectionModal(candidates) {
  // Create or get modal
  let modal = $('cds-detection-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cds-detection-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 20px;
      max-width: 500px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(modal);
  }
  
  let overlay = document.getElementById('cds-detection-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cds-detection-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;
    document.body.appendChild(overlay);
  }
  
  // Build modal content
  let html = '<h3>Detected ORF Candidates</h3>';
  html += '<p style="font-size:0.9rem; color:#666;">Found multiple ORFs. Select the one to use:</p>';
  html += '<div style="max-height: 300px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px;">';
  
  candidates.forEach((cds, idx) => {
    const bp = cds.length;
    const aa = Math.floor(bp / 3);
    const strand = cds.displayStrand;
    const selected = idx === 0 ? 'checked' : '';
    html += `
      <label style="display: block; padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;">
        <input type="radio" name="cds-choice" value="${idx}" ${selected} style="margin-right: 8px;">
        <strong>#${idx + 1}:</strong> ${bp}bp (${aa}AA) - ${strand}
      </label>
    `;
  });
  
  html += '</div>';
  html += '<div style="margin-top: 12px; text-align: right;">';
  html += '<button id="cds-confirm-btn" style="margin-right:8px; padding:6px 12px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;">Use Selected</button>';
  html += '<button id="cds-cancel-btn" style="padding:6px 12px; background:#999; color:white; border:none; border-radius:4px; cursor:pointer;">Cancel</button>';
  html += '</div>';
  
  modal.innerHTML = html;
  
  return new Promise((resolve) => {
    $('cds-confirm-btn').addEventListener('click', () => {
      const selected = document.querySelector('input[name="cds-choice"]:checked').value;
      modal.style.display = 'none';
      overlay.style.display = 'none';
      resolve(parseInt(selected));
    });
    
    $('cds-cancel-btn').addEventListener('click', () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      resolve(-1);  // Cancel
    });
  });
}

function populateHostSelect() {
  const select = $('host-select');
  select.innerHTML = '';
  for (const [code, org] of Object.entries(CODON_USAGE)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = org.name || code;
    select.appendChild(opt);
  }
  if (CODON_USAGE.s_cerevisiae) {
    select.value = 's_cerevisiae';
  }
}

function updateCodonSelect(rowNum, hostCode) {
  const aaToInput = $(`aa-to-${rowNum}`);
  const codonSelect = $(`codon-select-${rowNum}`);
  const aaInput = aaToInput.value.trim().toUpperCase();
  
  if (!aaInput || !hostCode) {
    codonSelect.innerHTML = '<option value="">Select AA first</option>';
    codonSelect.disabled = true;
    return;
  }
  
  // Check if multiple AAs are entered
  if (aaInput.length > 1) {
    // Multiple AAs - use auto preferred codons
    codonSelect.innerHTML = '<option value="">Auto (preferred)</option>';
    codonSelect.disabled = true;
    codonSelect.title = 'Multiple AAs: each will use its preferred codon';
    return;
  }
  
  // Single AA - show codon options
  const aa = aaInput;
  const entries = getCodonEntries(hostCode, aa);
  if (!entries || entries.length === 0) {
    codonSelect.innerHTML = '<option value="">No codons found</option>';
    codonSelect.disabled = true;
    return;
  }
  
  codonSelect.innerHTML = '';
  codonSelect.disabled = false;
  codonSelect.title = '';
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const option = document.createElement('option');
    option.value = entry.codon;
    
    const freq = entry.fraction || 0;
    let label = `${entry.codon} (${(freq * 100).toFixed(1)}%)`;
    
    // Add prefer/rare indicator
    if (i === 0) {
      label += ' ✓ Prefer';
      option.className = 'codon-prefer';
      option.selected = true;
    } else if (freq < 0.1) {
      label += ' (Rare)';
      option.className = 'codon-rare';
    }
    
    option.textContent = label;
    codonSelect.appendChild(option);
  }
}

// Generate a single row for AA edits table
function createAARow(rowNum) {
  const tr = document.createElement('tr');
  tr.id = `aa-row-${rowNum}`;
  tr.innerHTML = `
    <td>${rowNum}</td>
    <td>
      <select id="aa-op-${rowNum}" style="width:100px;">
        <option value="substitution">Substitution</option>
        <option value="insertion">Insertion</option>
        <option value="deletion">Deletion</option>
      </select>
    </td>
    <td><input id="aa-pos-${rowNum}" type="number" min="1" style="width:55px;"></td>
    <td><input id="aa-end-${rowNum}" type="number" min="1" style="width:55px;" placeholder="(opt)"></td>
    <td><input id="aa-current-${rowNum}" type="text" style="width:80px; background:#f5f5f5; text-align:center; font-weight:bold;" readonly placeholder="-"></td>
    <td><input id="aa-to-${rowNum}" type="text" style="width:70px;" placeholder="VKL"></td>
    <td><select id="codon-select-${rowNum}" style="width:95px; font-size:0.85rem;"></select></td>
    <td><button type="button" class="remove-row-btn" data-row="${rowNum}" style="padding:2px 8px; background:#e74c3c; color:white; border:none; border-radius:3px; cursor:pointer; font-size:0.75rem;">×</button></td>
  `;
  return tr;
}

// Initialize AA edits table with default rows
function initializeAAEditsTable() {
  const tbody = $('aa-edits-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Create 5 default rows
  for (let i = 1; i <= 5; i++) {
    const row = createAARow(i);
    tbody.appendChild(row);
  }
  
  // Setup event listeners for all rows
  setupAARowListeners();
}

// Setup event listeners for a specific row
function setupAARowListenersForRow(rowNum) {
  const hostCode = $('host-select').value;
  
  // Position input change - update Current AA
  const posInput = $(`aa-pos-${rowNum}`);
  const endInput = $(`aa-end-${rowNum}`);
  if (posInput) {
    posInput.addEventListener('input', () => updateCurrentAA(rowNum));
  }
  if (endInput) {
    endInput.addEventListener('input', () => updateCurrentAA(rowNum));
  }
  
  // AA to input change - update codon select
  const aaToInput = $(`aa-to-${rowNum}`);
  if (aaToInput) {
    aaToInput.addEventListener('input', () => {
      updateCodonSelect(rowNum, hostCode);
    });
  }
  
  // Remove button
  const removeBtn = document.querySelector(`.remove-row-btn[data-row="${rowNum}"]`);
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeAARow(rowNum);
    });
  }
}

// Setup event listeners for all rows
function setupAARowListeners() {
  const tbody = $('aa-edits-tbody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const rowNum = parseInt(row.id.replace('aa-row-', ''));
    if (!isNaN(rowNum)) {
      setupAARowListenersForRow(rowNum);
    }
  });
}

// Add a new row
function addAARow() {
  const tbody = $('aa-edits-tbody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  const nextRowNum = rows.length + 1;
  
  const newRow = createAARow(nextRowNum);
  tbody.appendChild(newRow);
  
  // Setup listeners for the new row
  setupAARowListenersForRow(nextRowNum);
  
  // Update codon select
  const hostCode = $('host-select').value;
  updateCodonSelect(nextRowNum, hostCode);
}

// Remove a row
function removeAARow(rowNum) {
  const row = $(`aa-row-${rowNum}`);
  if (!row) return;
  
  row.remove();
  
  // Renumber remaining rows
  renumberAARows();
}

// Renumber all rows after deletion
function renumberAARows() {
  const tbody = $('aa-edits-tbody');
  if (!tbody) return;
  
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach((row, idx) => {
    const newNum = idx + 1;
    row.id = `aa-row-${newNum}`;
    row.querySelector('td:first-child').textContent = newNum;
    
    // Update all IDs in the row
    const inputs = row.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input.id) {
        input.id = input.id.replace(/\d+$/, newNum);
      }
      if (input.getAttribute('data-row')) {
        input.setAttribute('data-row', newNum);
      }
    });
    
    // Re-setup listeners
    setupAARowListenersForRow(newNum);
  });
}

// Get all row numbers currently in the table
function getAllAARowNumbers() {
  const tbody = $('aa-edits-tbody');
  if (!tbody) return [];
  
  const rows = tbody.querySelectorAll('tr');
  return Array.from(rows).map(row => {
    const rowNum = parseInt(row.id.replace('aa-row-', ''));
    return isNaN(rowNum) ? null : rowNum;
  }).filter(n => n !== null);
}

function parseMutations() {
  const rows = [];
  const hostCode = $('host-select').value;
  
  // Get all row numbers dynamically
  const rowNumbers = getAllAARowNumbers();
  console.log('parseMutations: rowNumbers =', rowNumbers);
  
  for (const i of rowNumbers) {
    const posEl = $(`aa-pos-${i}`);
    const opEl = $(`aa-op-${i}`);
    const endPosEl = $(`aa-end-${i}`);
    const newAAsEl = $(`aa-to-${i}`);
    const codonSelect = $(`codon-select-${i}`);
    
    console.log(`Row ${i}:`, {
      posEl: posEl ? 'found' : 'NOT FOUND',
      opEl: opEl ? 'found' : 'NOT FOUND',
      endPosEl: endPosEl ? 'found' : 'NOT FOUND',
      newAAsEl: newAAsEl ? 'found' : 'NOT FOUND',
      codonSelect: codonSelect ? 'found' : 'NOT FOUND'
    });
    
    if (!posEl) {
      console.log(`Row ${i}: posEl not found, skipping`);
      continue;
    }
    
    const posVal = posEl.value;
    console.log(`Row ${i}: posVal =`, posVal);
    if (!posVal) {
      console.log(`Row ${i}: posVal empty, skipping`);
      continue;
    }
    
    const pos = parseInt(posVal, 10);
    const operation = opEl ? (opEl.value || 'substitution') : 'substitution';
    const endPosVal = endPosEl ? endPosEl.value : '';
    const endPos = endPosVal ? parseInt(endPosVal, 10) : pos;
    const newAAs = newAAsEl ? newAAsEl.value.trim().toUpperCase() : '';
    
    console.log(`Row ${i} values:`, { pos, operation, endPos, newAAs });
    
    // Validate based on operation type
    if (isNaN(pos)) {
      console.log(`Row ${i}: pos is NaN, skipping`);
      continue;
    }
    
    // For deletion, newAAs can be empty
    // For substitution/insertion, newAAs is required
    if (operation !== 'deletion' && !newAAs) {
      console.log(`Row ${i}: operation=${operation} but newAAs empty, skipping`);
      continue;
    }
    
    // Get selected codon preference from dropdown
    const selectedCodon = codonSelect ? codonSelect.value : '';
    
    console.log(`Row ${i}: Adding mutation:`, { index: i, operation, aaPos: pos, aaEndPos: endPos, newAAs, selectedCodon });
    
    rows.push({ 
      index: i, 
      operation,      // 'substitution', 'insertion', 'deletion'
      aaPos: pos,     // Start position (1-based)
      aaEndPos: endPos, // End position (1-based, for multi-AA edits)
      newAAs,         // New amino acid sequence (can be multiple AAs)
      selectedCodon   // Codon preference (only used if single AA)
    });
  }
  console.log('parseMutations: returning', rows.length, 'mutations');
  return rows;
}

function renderAASequences(origAA, finalAA, mutations, results = null) {
  const origEl = $('aa-original');
  const finalEl = $('aa-translation');

  // Build sets of affected positions for original and final sequences separately
  const origMutPositions = new Set();
  const finalMutPositions = new Set();
  
  // Track deletions for placeholder display (position in original -> number of AAs deleted)
  const deletions = [];
  // Track insertions for placeholder display (in original sequence)
  const insertions = [];
  
  // Calculate position offset due to insertions/deletions
  let posOffset = 0;
  
  for (const m of mutations) {
    const startPos = m.aaPos;
    const endPos = m.aaEndPos || m.aaPos;
    const newAAsLen = (m.newAAs || '').length;
    const oldAAsLen = endPos - startPos + 1;
    
    // Original sequence: highlight the affected region
    if (m.operation !== 'insertion') {
      for (let p = startPos; p <= endPos; p++) {
        origMutPositions.add(p);
      }
    }
    
    // Final sequence: highlight where new AAs are (accounting for offset)
    const finalStartPos = startPos + posOffset;
    if (m.operation === 'insertion') {
      insertions.push({
        afterPos: startPos,
        count: newAAsLen,
        seq: m.newAAs || ''
      });
      // Insertion: new AAs are after the position
      for (let i = 0; i < newAAsLen; i++) {
        finalMutPositions.add(finalStartPos + 1 + i);
      }
      posOffset += newAAsLen;
    } else if (m.operation === 'deletion') {
      // Deletion: track for placeholder display
      deletions.push({
        origPos: startPos,
        finalPos: finalStartPos,
        count: oldAAsLen
      });
      posOffset -= oldAAsLen;
    } else {
      // Substitution: highlight new AAs at the same position
      for (let i = 0; i < newAAsLen; i++) {
        finalMutPositions.add(finalStartPos + i);
      }
      posOffset += (newAAsLen - oldAAsLen);
    }
  }

  function buildHighlighted(seq, positions) {
    const parts = [];
    for (let i = 0; i < seq.length; i++) {
      const aa = seq[i];
      const pos = i + 1; // 1-based
      if (positions.has(pos)) {
        parts.push(`<span class="mut-aa" title="pos ${pos}">${aa}</span>`);
      } else {
        parts.push(aa);
      }
    }
    return parts.join('');
  }

  function buildOriginalWithInsertions(seq, positions, insertionList) {
    if (!insertionList.length) return buildHighlighted(seq, positions);

    const sortedIns = [...insertionList].sort((a, b) => a.afterPos - b.afterPos);
    const insByAfter = new Map();
    sortedIns.forEach(ins => {
      if (!insByAfter.has(ins.afterPos)) insByAfter.set(ins.afterPos, []);
      insByAfter.get(ins.afterPos).push(ins);
    });

    const parts = [];
    for (let i = 0; i < seq.length; i++) {
      const aa = seq[i];
      const pos = i + 1; // 1-based
      if (positions.has(pos)) parts.push(`<span class="mut-aa" title="pos ${pos}">${aa}</span>`);
      else parts.push(aa);

      const insList = insByAfter.get(pos);
      if (insList && insList.length) {
        for (const ins of insList) {
          const placeholder = '-'.repeat(ins.count);
          const label = ins.seq ? `Inserted ${ins.count} AA(s): ${ins.seq}` : `Inserted ${ins.count} AA(s)`;
          parts.push(`<span class="mut-aa ins-placeholder" title="${escapeHtml(label)}" style="color:#1d4ed8; background:#dbeafe; border:1px solid #93c5fd; border-radius:3px; padding:0 2px;">${placeholder}</span>`);
        }
      }
    }

    return parts.join('');
  }

  // Build final sequence with deletion placeholders
  function buildFinalWithDeletions(seq, positions, deletionList) {
    if (deletionList.length === 0) {
      return buildHighlighted(seq, positions);
    }
    
    // Sort deletions by original position
    const sortedDels = [...deletionList].sort((a, b) => a.origPos - b.origPos);
    
    const parts = [];
    let seqIdx = 0;
    let currentOrigPos = 1;
    let delIdx = 0;
    
    while (seqIdx < seq.length || delIdx < sortedDels.length) {
      // Check if we need to insert a deletion placeholder here
      if (delIdx < sortedDels.length && sortedDels[delIdx].origPos === currentOrigPos) {
        const del = sortedDels[delIdx];
        const placeholder = '-'.repeat(del.count);
        parts.push(`<span class="mut-aa del-placeholder" title="Deleted ${del.count} AA(s) at pos ${del.origPos}" style="color:#e74c3c; text-decoration:line-through;">${placeholder}</span>`);
        currentOrigPos += del.count;
        delIdx++;
      } else if (seqIdx < seq.length) {
        // Add regular AA
        const aa = seq[seqIdx];
        const displayPos = seqIdx + 1;
        if (positions.has(displayPos)) {
          parts.push(`<span class="mut-aa" title="pos ${currentOrigPos}">${aa}</span>`);
        } else {
          parts.push(aa);
        }
        seqIdx++;
        currentOrigPos++;
      } else {
        break;
      }
    }
    
    return parts.join('');
  }

  origEl.innerHTML = buildOriginalWithInsertions(origAA || '', origMutPositions, insertions);
  finalEl.innerHTML = buildFinalWithDeletions(finalAA || '', finalMutPositions, deletions);
}

// Render DNA sequences with highlights for edited regions (similar to renderAASequences)
function renderDNASequences(origSeq, finalSeq, edits) {
  const origEl = $('aa-original');
  const finalEl = $('aa-translation');
  
  // Build sets of affected positions (1-based) for original and final sequences
  const origEditPositions = new Set();
  const finalEditPositions = new Set();
  
  // Track deletions for placeholder display
  const deletions = [];
  // Track insertions for placeholder display (in original sequence)
  const insertions = [];
  
  // Track position offset due to insertions/deletions in final sequence
  let posOffset = 0;
  
  for (const edit of edits) {
    const startPos = edit.startPos; // 1-based inclusive
    const endPos = edit.endPos;     // 1-based inclusive
    const operation = edit.operation;
    const newSeqLen = (edit.newSeq || '').length;
    
    // Calculate old sequence length (for deletion and substitution)
    // For insertion, oldSeqLen is 0 (nothing is deleted)
    const oldSeqLen = (operation === 'insertion') ? 0 : (endPos - startPos + 1);
    
    // Original sequence: highlight the affected region
    if (operation !== 'insertion') {
      // For deletion and substitution, highlight the region being removed/replaced
      for (let p = startPos; p <= endPos; p++) {
        origEditPositions.add(p);
      }
    }
    
    // Final sequence: highlight where new sequence is (accounting for offset)
    const finalStartPos = startPos + posOffset;
    
    if (operation === 'insertion') {
      insertions.push({
        afterPos: startPos,
        count: newSeqLen,
        seq: edit.newSeq || ''
      });
      // Insertion: new sequence is inserted after startPos
      // In final sequence, new sequence starts at finalStartPos + 1 (after the insertion point)
      for (let i = 0; i < newSeqLen; i++) {
        finalEditPositions.add(finalStartPos + 1 + i); // Inserted after startPos
      }
      posOffset += newSeqLen;
    } else if (operation === 'deletion') {
      // Deletion: track for placeholder display
      deletions.push({
        origPos: startPos,
        finalPos: finalStartPos,
        count: oldSeqLen
      });
      posOffset -= oldSeqLen;
    } else if (operation === 'substitution') {
      // Substitution: highlight new sequence at the same position
      for (let i = 0; i < newSeqLen; i++) {
        finalEditPositions.add(finalStartPos + i);
      }
      posOffset += (newSeqLen - oldSeqLen);
    }
  }
  
  function buildHighlightedDNA(seq, positions) {
    const parts = [];
    for (let i = 0; i < seq.length; i++) {
      const base = seq[i];
      const pos = i + 1; // 1-based
      if (positions.has(pos)) {
        parts.push(`<span class="mut-aa" title="pos ${pos}">${base}</span>`);
      } else {
        parts.push(escapeHtml(base));
      }
    }
    return parts.join('');
  }

  function buildOriginalWithInsertionsDNA(seq, positions, insertionList) {
    if (!insertionList.length) return buildHighlightedDNA(seq, positions);

    const sortedIns = [...insertionList].sort((a, b) => a.afterPos - b.afterPos);
    const insByAfter = new Map();
    sortedIns.forEach(ins => {
      if (!insByAfter.has(ins.afterPos)) insByAfter.set(ins.afterPos, []);
      insByAfter.get(ins.afterPos).push(ins);
    });

    const parts = [];
    for (let i = 0; i < seq.length; i++) {
      const base = seq[i];
      const pos = i + 1; // 1-based
      if (positions.has(pos)) parts.push(`<span class="mut-aa" title="pos ${pos}">${escapeHtml(base)}</span>`);
      else parts.push(escapeHtml(base));

      const insList = insByAfter.get(pos);
      if (insList && insList.length) {
        for (const ins of insList) {
          const placeholder = '-'.repeat(ins.count);
          const label = ins.seq ? `Inserted ${ins.count} bp: ${ins.seq}` : `Inserted ${ins.count} bp`;
          parts.push(`<span class="mut-aa ins-placeholder" title="${escapeHtml(label)}" style="color:#1d4ed8; background:#dbeafe; border:1px solid #93c5fd; border-radius:3px; padding:0 2px;">${placeholder}</span>`);
        }
      }
    }

    return parts.join('');
  }
  
  // Build final sequence with deletion placeholders
  function buildFinalWithDeletionsDNA(seq, positions, deletionList) {
    if (deletionList.length === 0) {
      return buildHighlightedDNA(seq, positions);
    }
    
    // Sort deletions by original position
    const sortedDels = [...deletionList].sort((a, b) => a.origPos - b.origPos);
    
    const parts = [];
    let seqIdx = 0;
    let currentOrigPos = 1;
    let delIdx = 0;
    
    while (seqIdx < seq.length || delIdx < sortedDels.length) {
      // Check if we need to insert a deletion placeholder here
      if (delIdx < sortedDels.length && sortedDels[delIdx].origPos === currentOrigPos) {
        const del = sortedDels[delIdx];
        const placeholder = '-'.repeat(del.count);
        parts.push(`<span class="mut-aa del-placeholder" title="Deleted ${del.count} bp at pos ${del.origPos}" style="color:#e74c3c; text-decoration:line-through;">${placeholder}</span>`);
        currentOrigPos += del.count;
        delIdx++;
      } else if (seqIdx < seq.length) {
        // Add regular base
        const base = seq[seqIdx];
        const displayPos = seqIdx + 1;
        if (positions.has(displayPos)) {
          parts.push(`<span class="mut-aa" title="pos ${currentOrigPos}">${escapeHtml(base)}</span>`);
        } else {
          parts.push(escapeHtml(base));
        }
        seqIdx++;
        currentOrigPos++;
      } else {
        break;
      }
    }
    
    return parts.join('');
  }
  
  origEl.innerHTML = `<code style="font-family: monospace; word-break: break-all; font-size: 0.8rem;">${buildOriginalWithInsertionsDNA(origSeq || '', origEditPositions, insertions)}</code>`;
  finalEl.innerHTML = `<code style="font-family: monospace; word-break: break-all; font-size: 0.8rem;">${buildFinalWithDeletionsDNA(finalSeq || '', finalEditPositions, deletions)}</code>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightPrimerRegion(seq, startIndex, length) {
  if (seq == null || startIndex == null || length <= 0) return escapeHtml(seq || '');
  const L = seq.length;
  const s = Math.max(0, Math.min(startIndex, L));
  const e = Math.min(L, s + length);
  const left = seq.slice(0, s);
  const mid = seq.slice(s, e);
  const right = seq.slice(e);
  return (
    escapeHtml(left) +
    '<span class="mut-primer">' +
    escapeHtml(mid) +
    '</span>' +
    escapeHtml(right)
  );
}

function runPrimerQC(seq, tmTarget = 60) {
  return Core.qcSinglePrimer(seq, {
    Na_mM: 50,
    Mg_mM: 0,
    conc_nM: 500,
    tmTarget,
    homopolymerMax: 4
  });
}

function getQCLabel(qc) {
  if (!qc) return { hp: { label: 'N/A', cls: 'qc-ok' }, sd: { label: 'N/A', cls: 'qc-ok' }, homo: { label: 'OK', cls: 'qc-ok' } };
  
  // Hairpin
  let hp = { label: 'None', cls: 'qc-ok' };
  if (qc.hairpin) {
    const hpDG = qc.hairpin.dG;
    if (hpDG <= -7) {
      hp = { label: 'Very strong', cls: 'qc-bad' };
    } else if (hpDG <= -5) {
      hp = { label: 'Strong', cls: 'qc-bad' };
    } else if (hpDG <= -3) {
      hp = { label: 'Moderate', cls: 'qc-warn' };
    } else {
      hp = { label: 'Weak', cls: 'qc-weak' };
    }
  }
  
  // Self-dimer
  let sd = { label: 'None', cls: 'qc-ok' };
  if (qc.selfDimer) {
    const sdDG = qc.selfDimer.dG;
    if (sdDG <= -7) {
      sd = { label: 'Very strong', cls: 'qc-bad' };
    } else if (sdDG <= -5) {
      sd = { label: 'Strong', cls: 'qc-bad' };
    } else if (sdDG <= -3) {
      sd = { label: 'Moderate', cls: 'qc-warn' };
    } else {
      sd = { label: 'Weak', cls: 'qc-weak' };
    }
  }
  
  // Homopolymer
  let homo = { label: qc.homopolymer ? 'Yes' : 'OK', cls: qc.homopolymer ? 'qc-warn' : 'qc-ok' };
  
  return { hp, sd, homo };
}

function getCrossDimerLabel(seqA, seqB) {
  if (!seqA || !seqB) return { label: 'N/A', cls: 'qc-ok' };
  
  const crossDimer = Core.dimerScan(seqA, seqB);
  if (!crossDimer || !crossDimer.dG) {
    return { label: 'None', cls: 'qc-ok' };
  }
  
  const dG = crossDimer.dG;
  if (dG <= -7) {
    return { label: 'Very strong', cls: 'qc-bad' };
  } else if (dG <= -5) {
    return { label: 'Strong', cls: 'qc-bad' };
  } else if (dG <= -3) {
    return { label: 'Moderate', cls: 'qc-warn' };
  } else {
    return { label: 'Weak', cls: 'qc-weak' };
  }
}

/**
 * Download mutant sequence in FASTA format
 */
function downloadMutantFASTA() {
  if (!currentMutantSequence) {
    alert('Mutant sequence is not available. Please design primers first.');
    return;
  }
  
  const seq = currentMutantSequence;
  const name = currentSeqName ? currentSeqName + '_mutant' : 'mutant';
  
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

/**
 * Download primers in FASTA format
 */
function downloadPrimersFASTA() {
  let fastaContent = '';
  let primersToDownload = [];

  function normalizePrimerSeq(seq) {
    return (seq || '').toString().replace(/\s+/g, '').toUpperCase();
  }

  function getPrimerSeq(primerInfo) {
    if (!primerInfo) return '';
    if (typeof primerInfo === 'string') return normalizePrimerSeq(primerInfo);
    if (typeof primerInfo.seq === 'string') return normalizePrimerSeq(primerInfo.seq);
    return '';
  }

  function wrapFasta(seq, width = 80) {
    const s = normalizePrimerSeq(seq);
    if (!s) return '';
    const chunks = [];
    for (let i = 0; i < s.length; i += width) chunks.push(s.slice(i, i + width));
    return chunks.join('\n');
  }

  if (currentDNAMode) {
    if (!currentDNAPrimers || currentDNAPrimers.length === 0) {
      alert('No primers available for DNA mode. Please design primers first.');
      return;
    }
    primersToDownload = currentDNAPrimers;
  } else {
    if (!currentResults || currentResults.length === 0) {
      alert('No primers available for CDS mode. Please design primers first.');
      return;
    }
    primersToDownload = currentResults;
  }

  for (let idx = 0; idx < primersToDownload.length; idx++) {
    const r = primersToDownload[idx];
    // Generate operation string for naming
    let operationStr = r.operationStr || r.description || `edit${idx + 1}`;

    // Generate primer names
    const baseName = currentSeqName || 'fragment';
    const uniqueSuffix = primersToDownload.length > 1 ? `_edit${idx + 1}` : '';
    const f1Name = `${baseName}-F${uniqueSuffix}`;
    const r2Name = `${baseName}-R${uniqueSuffix}`;
    const fmutName = `${baseName}(${operationStr})-F${uniqueSuffix}`;
    const rmutName = `${baseName}(${operationStr})-R${uniqueSuffix}`;

    // Add primers in order: F1, Rmut, Fmut, R2
    const primers = [
      { key: 'F1', name: f1Name },
      { key: 'Rmut', name: rmutName },
      { key: 'Fmut', name: fmutName },
      { key: 'R2', name: r2Name }
    ];

    for (const p of primers) {
      const seq = getPrimerSeq(r[p.key]);
      if (!seq) continue;
      fastaContent += `>${p.name}\n`;
      fastaContent += `${wrapFasta(seq)}\n`;
    }
  }

  if (!fastaContent) {
    alert('No primer sequences available.');
    return;
  }

  // Create and download file
  const blob = new Blob([fastaContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = currentSeqName
    ? `${currentSeqName.replace(/[^A-Za-z0-9_.-]/g, '_')}_mutagenesis_primers.txt`
    : 'mutagenesis_primers.txt';
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderResults(results, origAA, finalAA, mutations, rawTemplate = null) {
  console.log('renderResults called');
  console.log('renderResults: results.length =', results.length);
  
  // Store results for download
  currentResults = results;
  currentSeqName = rawTemplate ? extractFASTAHeader(rawTemplate) : null;
  currentDNAMode = false;
  
  // Store mutant sequence for download
  if (results && results.length > 0) {
    const finalTemplate = results[results.length - 1].mutatedTemplate;
    currentMutantSequence = finalTemplate ? Core.normalizeSeq(finalTemplate) : null;
  }
  
  // Show results section
  const resultsSection = $('results-section');
  if (resultsSection) {
    console.log('renderResults: Showing results-section');
    resultsSection.style.display = 'block';
  } else {
    console.warn('renderResults: results-section not found!');
  }
  
  const outSummary = $('summary');
  const outTable = $('results-table');
  
  console.log('renderResults: outSummary =', outSummary);
  console.log('renderResults: outTable =', outTable);
  
  if (!outSummary || !outTable) {
    console.error('renderResults: outSummary or outTable not found!');
    return;
  }
  
  outSummary.innerHTML = '';
  outTable.innerHTML = '';

  if (!results || results.length === 0) {
    outSummary.textContent = 'No valid mutations were parsed.';
    return;
  }
  
  // Extract sequence name from FASTA header if available
  const seqName = rawTemplate ? extractFASTAHeader(rawTemplate) : null;

  // Summary
  const ul = document.createElement('ul');
  for (const r of results) {
    const li = document.createElement('li');
    
    // Build description based on operation type
    let descText;
    if (r.description) {
      descText = `Edit ${r.id}: ${r.description}`;
    } else if (r.operation === 'substitution') {
      if (r.oldCodon && r.newCodon) {
        descText = `Mutation ${r.id}: AA ${r.aaPos} ${r.oldAAs || r.oldAA}→${r.newAAs || r.newAA} (codon ${r.oldCodon}→${r.newCodon})`;
      } else {
        descText = `Mutation ${r.id}: AA ${r.aaPos} ${r.oldAAs}→${r.newAAs}`;
      }
    } else if (r.operation === 'insertion') {
      descText = `Insert ${r.id}: ${r.newAAs} after AA ${r.aaPos}`;
    } else if (r.operation === 'deletion') {
      descText = `Delete ${r.id}: ${r.oldAAs} (AA ${r.aaPos}-${r.aaEndPos})`;
    } else {
      descText = `Edit ${r.id}: AA ${r.aaPos}`;
    }
    
    li.textContent = descText;
    ul.appendChild(li);
  }
  outSummary.appendChild(ul);

  // AA sequences with highlights
  renderAASequences(origAA, finalAA, mutations);

  // Table with primers (4 per mutation)
  for (const r of results) {
    // Add fragment title
    const fragmentTitle = document.createElement('h4');
    fragmentTitle.style.marginTop = '16px';
    fragmentTitle.style.marginBottom = '8px';
    
    // Build title based on operation
    const isSingleFragment = r.isSingleFragment || false;
    const pcrType = isSingleFragment ? 'Single-fragment PCR' : 'OE-PCR';
    let titleText;
    if (r.description) {
      titleText = `${pcrType} - Fragment ${r.id}: ${r.description}`;
    } else if (r.operation === 'insertion') {
      titleText = `${pcrType} - Fragment ${r.id} (Insert ${r.newAAs} after AA ${r.aaPos})`;
    } else if (r.operation === 'deletion') {
      titleText = `${pcrType} - Fragment ${r.id} (Delete AA ${r.aaPos}-${r.aaEndPos})`;
    } else {
      titleText = `${pcrType} - Fragment ${r.id} (AA ${r.aaPos}: ${r.oldAAs || r.oldAA}→${r.newAAs || r.newAA})`;
    }
    fragmentTitle.textContent = titleText;
    outTable.appendChild(fragmentTitle);

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Primer</th>
        <th>Sequence (5'→3')</th>
        <th>Len</th>
        <th>GC%</th>
        <th>Core Tm</th>
        <th>Overlap Tm</th>
        <th>Homopolymer</th>
        <th>Hairpin</th>
        <th>Self-dimer</th>
        <th>Cross-dimer</th>
      </tr>
    `;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    // Generate operation string for Fmut/Rmut naming (e.g., V55A, ins55SA, ΔV[55-55])
    let operationStr = '';
    if (r.description) {
      operationStr = r.description;
    } else if (r.operation === 'substitution') {
      operationStr = `${r.oldAAs || r.oldAA}${r.aaPos}${r.newAAs || r.newAA}`;
    } else if (r.operation === 'insertion') {
      operationStr = `ins${r.aaPos}${r.newAAs}`;
    } else if (r.operation === 'deletion') {
      operationStr = `Δ${r.oldAAs}[${r.aaPos}-${r.aaEndPos}]`;
    } else {
      operationStr = `edit${r.id}`;
    }
    
    // Generate primer names based on naming convention
    // F1/R2: if header exists, use "name-F" and "name-R", otherwise use "fragment-F" and "fragment-R"
    // Fmut/Rmut: use "name(operation)-F" and "name(operation)-R", or "fragment(operation)-F"/"fragment(operation)-R" if no header
    const f1Name = seqName ? `${seqName}-F` : 'fragment-F';
    const r2Name = seqName ? `${seqName}-R` : 'fragment-R';
    const fmutName = seqName ? `${seqName}(${operationStr})-F` : `fragment(${operationStr})-F`;
    const rmutName = seqName ? `${seqName}(${operationStr})-R` : `fragment(${operationStr})-R`;
    
    // Reorder primers: F1 and Rmut are a pair (Fragment 1), Fmut and R2 are a pair (Fragment 2)
    // For single-fragment PCR, only show primers that exist
    const allPrimers = [
      { key: 'F1', label: f1Name, role: 'Fragment 1 forward', pairKey: 'Rmut' },
      { key: 'Rmut', label: rmutName, role: 'Fragment 1 reverse', pairKey: 'F1' },
      { key: 'Fmut', label: fmutName, role: 'Fragment 2 forward', pairKey: 'R2' },
      { key: 'R2', label: r2Name, role: 'Fragment 2 reverse', pairKey: 'Fmut' }
    ];
    
    // Filter out null primers for single-fragment PCR
    const primers = isSingleFragment 
      ? allPrimers.filter(p => r[p.key] !== null && r[p.key] !== undefined)
      : allPrimers;
    
    for (let i = 0; i < primers.length; i++) {
      const p = primers[i];
      const info = r[p.key];
      
      // Skip if info is null (shouldn't happen after filtering, but double-check)
      if (!info || !info.seq) continue;
      
      // Get QC for this primer
      const qc = runPrimerQC(info.seq, 60);
      const qcLabel = getQCLabel(qc);
      
      const tr = document.createElement('tr');
      const seqHtml = highlightPrimerRegion(info.seq, info.mutStartIndex, info.mutLength);
      const hpBadge = `<span class="qc-badge ${qcLabel.hp.cls}">${qcLabel.hp.label}</span>`;
      const sdBadge = `<span class="qc-badge ${qcLabel.sd.cls}">${qcLabel.sd.label}</span>`;
      const homoBadge = `<span class="qc-badge ${qcLabel.homo.cls}">${qcLabel.homo.label}</span>`;
      
      // Format Tms
      const coreTmStr = info.coreTm !== null && info.coreTm !== undefined ? info.coreTm.toFixed(1) : '-';
      const overlapTmStr = info.overlapTm !== null && info.overlapTm !== undefined ? info.overlapTm.toFixed(1) : '-';
      
      // Calculate cross-dimer with paired primer
      // For OE-PCR: F1 and Rmut are a pair, Fmut and R2 are a pair
      // For single-fragment PCR: only one pair exists (Fmut+R2, F1+Rmut, or Fmut+Rmut)
      let crossDimerCell = '';
      if (isSingleFragment) {
        // For single-fragment PCR, find the paired primer
        const pairKey = p.pairKey;
        const pairInfo = r[pairKey];
        if (pairInfo && pairInfo.seq) {
          // Only show cross-dimer for the first primer in the pair
          if (i === 0 || (i > 0 && primers[i-1].key !== pairKey)) {
            const crossDimerLabel = getCrossDimerLabel(info.seq, pairInfo.seq);
            const crossDimerBadge = `<span class="qc-badge ${crossDimerLabel.cls}">${crossDimerLabel.label}</span>`;
            const pairIndex = primers.findIndex(pr => pr.key === pairKey);
            const rowspan = pairIndex !== -1 && pairIndex > i ? '2' : '1';
            crossDimerCell = `<td rowspan="${rowspan}" style="text-align:center; vertical-align:middle;">${crossDimerBadge}</td>`;
          }
        }
      } else {
        // OE-PCR: F1 and Rmut are a pair, Fmut and R2 are a pair
        if (i === 0 || i === 2) {
          // First primer in pair (F1 or Fmut)
          const pairInfo = r[p.pairKey];
          const crossDimerLabel = getCrossDimerLabel(info.seq, pairInfo ? pairInfo.seq : null);
          const crossDimerBadge = `<span class="qc-badge ${crossDimerLabel.cls}">${crossDimerLabel.label}</span>`;
          crossDimerCell = `<td rowspan="2" style="text-align:center; vertical-align:middle;">${crossDimerBadge}</td>`;
        }
        // For second primer in pair (Rmut or R2), don't add cross-dimer cell (it's merged)
      }
      
      tr.innerHTML = `
        <td><strong>${p.label}</strong></td>
        <td class="mono">${seqHtml}</td>
        <td>${info.len}</td>
        <td>${info.gc.toFixed(1)}</td>
        <td>${coreTmStr}</td>
        <td>${overlapTmStr}</td>
        <td>${homoBadge}</td>
        <td>${hpBadge}</td>
        <td>${sdBadge}</td>
        ${crossDimerCell}
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    outTable.appendChild(table);
  }
}

async function confirmMWWarnings(warnings) {
  if (!warnings || warnings.length === 0) return true;
  if (!VIZ || !VIZ.showMWWarnings) return true;
  const container = document.getElementById('module-content') || document.body;
  return await new Promise((resolve) => {
    VIZ.showMWWarnings(container, warnings, () => resolve(true), () => resolve(false));
  });
}

function stripFASTAHeaders(raw) {
  return String(raw || '').replace(/^>.*$/gm, '').replace(/\s+/g, '');
}

function addOverlapWarnings(warnings, overlapSeq, idPrefix, minLen = 15, maxLen = 40) {
  if (!overlapSeq || !overlapSeq.length) return;
  if (!VIZ || !VIZ.validateOverlapLength) return;
  warnings.push(...VIZ.validateOverlapLength(overlapSeq.length, minLen, maxLen).map(w => ({ id: `${idPrefix}-OVERLAP`, message: w.message })));
}

async function onDesignClick() {
  console.log('onDesignClick called');

  const container = document.getElementById('module-content') || document.body;
  const templateEl = $('template-seq');
  if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
    const shown = VIZ.guardSingleFastaPerField(container, [templateEl], () => {
      // The template input has debounced ORF detection; force-refresh so CDS/backbone selection stays correct.
      try { detectAndUpdateORFs(); } catch {}
      window.setTimeout(() => { onDesignClick(); }, 0);
    });
    if (shown) return;
  }

  const rawTemplate = $('template-seq').value;
  const hostCode = $('host-select').value;
  console.log('Template length:', rawTemplate ? rawTemplate.length : 0);
  console.log('Host code:', hostCode);

  if (!rawTemplate || !cleanDNA(rawTemplate)) {
    alert('Please paste a DNA template sequence.');
    return;
  }

  // MW preflight warnings (template + parameters + user overlaps + performance)
  const warnings = [];
  if (VIZ && VIZ.validateSequenceInput) {
    warnings.push(...VIZ.validateSequenceInput([{ label: 'Template', seq: stripFASTAHeaders(rawTemplate) }], 'Template'));
  }
  const outerTm = parseFloat($('outer-tm').value) || 60;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('primer-na').value) || 50;
  const mg_mM = parseFloat($('primer-mg').value) || 0;
  const userFOverlap = ($('f-overlap-seq').value || '').trim();
  const userROverlap = ($('r-overlap-seq').value || '').trim();
  if (VIZ && VIZ.validateParameterRange) {
    warnings.push(...VIZ.validateParameterRange({ Na: na_mM, Mg: mg_mM, conc: conc_nM, targetTm: outerTm }));
  }
  addOverlapWarnings(warnings, userFOverlap, 'MUT-F', 15, 40);
  addOverlapWarnings(warnings, userROverlap, 'MUT-R', 15, 40);
  if (VIZ && VIZ.validatePerformance) {
    const totalBp = stripFASTAHeaders(rawTemplate).length;
    warnings.push(...VIZ.validatePerformance(1, totalBp));
  }
  const okMW = await confirmMWWarnings(warnings);
  if (!okMW) return;

  // Use pre-selected ORF from dropdown (no modal popup)
  if (currentCDS) {
    console.log('Using currentCDS, length:', currentCDS.length);
    // Use the already selected ORF
    performDesign(currentCDS, hostCode, rawTemplate);
          } else {
    console.log('No currentCDS, using raw template');
    // No ORF detected/selected - use raw template as-is
    const template = cleanDNA(rawTemplate);
    if (template.length < 30) {
      alert('Sequence too short. Please enter a valid CDS sequence.');
      return;
    }
          performDesign(template, hostCode, rawTemplate);
        }
}

function performDesign(template, hostCode, rawTemplate) {
  console.log('performDesign called');
  const origAA = translateDNA(template);
  console.log('Original AA length:', origAA.length);
  const mutations = parseMutations();
  console.log('Parsed mutations:', mutations);
  if (mutations.length === 0) {
    alert('Please define at least one amino-acid edit (position + operation).');
    return;
  }

  // primer parameters
  const outerTm = parseFloat($('outer-tm').value) || 60;
  const overlapTm = parseFloat($('overlap-tm').value) || 60;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('primer-na').value) || 50;
  const mg_mM = parseFloat($('primer-mg').value) || 0;
  const userFOverlap = ($('f-overlap-seq').value || '').trim();
  const userROverlap = ($('r-overlap-seq').value || '').trim();

  const results = [];
  let currentTemplate = template;
  let wtTemplate = template; // Keep original for primer design

  try {
    for (const mut of mutations) {
      const { operation, aaPos, aaEndPos, newAAs, selectedCodon } = mut;
      
      // Check if this is a simple single-AA substitution (use old method for compatibility)
      const isSimpleSubstitution = operation === 'substitution' && 
                                    aaPos === aaEndPos && 
                                    newAAs.length === 1;
      
      let mInfo, primerInfo;
      
      if (isSimpleSubstitution) {
        // Use original simple method for single AA substitution
        mInfo = applyAAMutation(currentTemplate, hostCode, aaPos, newAAs, selectedCodon);
        
        primerInfo = designOePcrPrimers(
        mInfo.mutatedTemplate,
        mInfo.codonStart,
        {
            coreTargetTm: outerTm,
          overlapTargetTm: overlapTm,
          outerTargetTm: outerTm,
          coreTargetLen: 20,
          overlapTailLen: 13,
          conc_nM,
          na_mM,
            mg_mM,
            userFOverlap,
            userROverlap
        }
      );
        debugLogFmutRmutParts(`${mInfo.oldAA}${aaPos}${mInfo.newAA}`, primerInfo);

      results.push({
        id: mut.index,
          operation: 'substitution',
        aaPos,
          aaEndPos,
          oldAAs: mInfo.oldAA,
          newAAs: mInfo.newAA,
        oldCodon: mInfo.oldCodon,
        newCodon: mInfo.newCodon,
          description: `${mInfo.oldAA}${aaPos}${mInfo.newAA}`,
        mutatedTemplate: mInfo.mutatedTemplate,
        F1: primerInfo.F1,
        Fmut: primerInfo.Fmut,
        Rmut: primerInfo.Rmut,
        R2: primerInfo.R2,
        isSingleFragment: primerInfo.isSingleFragment || false
      });
        
      } else {
        // Use new method for multi-AA edits (insertion, deletion, multi-AA substitution)
        mInfo = applyAAEdit(currentTemplate, hostCode, operation, aaPos, aaEndPos, newAAs, selectedCodon);
        
        // Use DNA edit dynamic primer design (more flexible)
        const editStart = mInfo.dnaStartPos; // 0-based
        let editEnd, editLen;
        
        if (operation === 'insertion') {
          // For insertion, edit region in mutant is where new sequence was inserted
          editEnd = mInfo.dnaStartPos + mInfo.editLen;
          editLen = mInfo.editLen;
        } else if (operation === 'deletion') {
          // For deletion, edit region in mutant is the junction point
          editEnd = mInfo.dnaStartPos;
          editLen = 0;
        } else {
          // For substitution, edit region is where new sequence replaced old
          editEnd = mInfo.dnaStartPos + mInfo.editLen;
          editLen = mInfo.editLen;
        }
        
        const opts = {
          desiredCore: 20,
          desiredOverlap: 20,
          minOverlapTm: overlapTm,
          maxSearchRadius: 60,
          coreTargetTm: outerTm,
          outerTargetTm: outerTm,
          minCore: 12,
          maxCore: 40,
          conc_nM,
          na_mM,
          mg_mM,
          userFOverlap,
          userROverlap
        };
        
        // Set wtEndPos for correct right core calculation
        if (operation === 'deletion' || operation === 'substitution') {
          opts.wtEndPos = mInfo.dnaEndPos; // Where WT edit region ends
        } else if (operation === 'insertion') {
          opts.wtEndPos = mInfo.dnaStartPos; // Insertion point in WT
        }
        
        primerInfo = designOePcrPrimersForDNAEditDynamic(
          mInfo.mutatedTemplate,
          wtTemplate,
          editStart,
          editEnd,
          editLen,
          opts
        );
        debugLogFmutRmutParts(mInfo.editDescription, primerInfo);
        
        results.push({
          id: mut.index,
          operation,
          aaPos,
          aaEndPos,
          oldAAs: mInfo.oldAAs,
          newAAs: mInfo.newAAs,
          oldDNA: mInfo.oldDNASegment,
          newDNA: mInfo.newDNASeq,
          description: mInfo.editDescription,
          mutatedTemplate: mInfo.mutatedTemplate,
          F1: primerInfo.F1,
          Fmut: primerInfo.Fmut,
          Rmut: primerInfo.Rmut,
          R2: primerInfo.R2,
          info: primerInfo.info,
          isSingleFragment: primerInfo.isSingleFragment || false
        });
      }

      currentTemplate = mInfo.mutatedTemplate;
    }
  } catch (e) {
    console.error(e);
    alert(e.message || 'Error during mutagenesis design.');
    return;
  }

  const finalTemplate = results[results.length - 1].mutatedTemplate;
  const finalAA = translateDNA(finalTemplate);

  console.log('performDesign: About to call renderResults');
  console.log('performDesign: results.length =', results.length);
  console.log('performDesign: origAA.length =', origAA.length);
  console.log('performDesign: finalAA.length =', finalAA.length);
  console.log('performDesign: mutations.length =', mutations.length);
  
  try {
    renderResults(results, origAA, finalAA, mutations, rawTemplate);
    console.log('performDesign: renderResults completed successfully');
  } catch (e) {
    console.error('performDesign: Error in renderResults:', e);
    alert('Error rendering results: ' + (e.message || String(e)));
  }
}

// ===== DNA EDITING MODE FUNCTIONS =====

// Apply DNA sequence edits (deletion, replacement, insertion)
export function applyDNAEdit(template, startPos, endPos, operation, newSeq = '') {
  const clean = cleanDNA(template);
  
  // Convert 1-based positions to 0-based
  // startPos is 1-based inclusive -> start is 0-based inclusive
  // endPos is 1-based inclusive -> end should be 0-based exclusive (endPos + 1 - 1 = endPos, but we need endPos + 1 for exclusive)
  const start = startPos - 1;
  const end = endPos;  // For deletion: endPos is 1-based inclusive, but we need 0-based exclusive, so end = endPos (since slice uses exclusive end)
  
  // Actually, if endPos is 1-based inclusive, to get 0-based exclusive we need endPos (not endPos+1)
  // Because: position 15 (1-based) = index 14 (0-based), and slice(0, 15) gives indices 0-14
  // So endPos (1-based inclusive) = endPos (0-based exclusive) is correct for slice
  
  if (start < 0 || end > clean.length || start >= end) {
    throw new Error(`Invalid position range: ${startPos}-${endPos} (sequence length: ${clean.length}bp)`);
  }
  
  let editedSeq;
  
  switch(operation) {
    case 'deletion':
      // Delete from start to end (inclusive in 1-based, exclusive in 0-based)
      // If startPos=10, endPos=15 (1-based), we delete positions 10-15 (6 bases)
      // start=9, end=15 (0-based), slice(0,9) + slice(15) removes indices 9-14 (6 bases) ✓
      editedSeq = clean.slice(0, start) + clean.slice(end);
      break;
      
    case 'substitution':
      // Replace sequence from start to end with newSeq
      if (!newSeq || newSeq.length === 0) {
        throw new Error('Substitution operation requires a new sequence.');
      }
      editedSeq = clean.slice(0, start) + newSeq.toUpperCase() + clean.slice(end);
      break;
      
    case 'insertion':
      // Insert newSeq AFTER startPos (matching AA mode logic)
      // If startPos is 10 (1-based), we want to keep positions 1-10 (indices 0-9), then insert.
      // slice(0, N) includes N items (indices 0 to N-1), so use startPos directly as the slice index
      if (!newSeq || newSeq.length === 0) {
        throw new Error('Insertion operation requires a sequence to insert.');
      }
      // Use startPos (1-based) directly as the slice index to insert AFTER the position
      // Example: startPos=10 (1-based) -> slice(0, 10) keeps indices 0-9 (10 bases), then insert
      const insertIndex = startPos; // Keep 1-based number as the slice index
      editedSeq = clean.slice(0, insertIndex) + newSeq.toUpperCase() + clean.slice(insertIndex);
      break;
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    originalTemplate: clean,
    editedTemplate: editedSeq,
    startPos,
    endPos,
    operation,
    newSeq,
    originalSegment: clean.slice(start, end),
    resultingSegment: editedSeq.slice(start, start + newSeq.length)
  };
}

// Generate a single row for DNA edits table
function createDNARow(rowNum) {
  const tr = document.createElement('tr');
  tr.id = `dna-row-${rowNum}`;
  tr.innerHTML = `
    <td>${rowNum}</td>
    <td>
      <select id="dna-op-${rowNum}" style="width:110px;">
        <option value="substitution">Substitution</option>
        <option value="insertion">Insertion</option>
        <option value="deletion" selected>Deletion</option>
      </select>
    </td>
    <td><input id="dna-start-${rowNum}" type="number" min="1" style="width:80px;"></td>
    <td><input id="dna-end-${rowNum}" type="number" min="1" style="width:80px;"></td>
    <td><input id="dna-current-${rowNum}" type="text" style="width:120px; background:#f5f5f5; text-align:center; font-weight:bold; font-family:monospace; font-size:0.85rem;" readonly placeholder="-"></td>
    <td><input id="dna-seq-${rowNum}" type="text" placeholder="ATGC..." style="width:150px; font-family:monospace; font-size:0.85rem;"></td>
    <td><button type="button" class="remove-dna-row-btn" data-row="${rowNum}" style="padding:2px 8px; background:#e74c3c; color:white; border:none; border-radius:3px; cursor:pointer; font-size:0.75rem;">×</button></td>
  `;
  
  return tr;
}

// Initialize DNA edits table with default rows
function initializeDNAEditsTable() {
  const tbody = $('dna-edits-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Create 5 default rows
  for (let i = 1; i <= 5; i++) {
    const row = createDNARow(i);
    tbody.appendChild(row);
  }
  
  // Setup event listeners for all rows
  setupDNARowListeners();
}

// Setup event listeners for a specific DNA row
function setupDNARowListenersForRow(rowNum) {
  // Preview update listeners
  const startInput = $(`dna-start-${rowNum}`);
  const endInput = $(`dna-end-${rowNum}`);
  
  if (startInput) {
    startInput.addEventListener('input', () => updateDNAPreview(rowNum));
  }
  if (endInput) {
    endInput.addEventListener('input', () => updateDNAPreview(rowNum));
  }
  
  // Remove button
  const removeBtn = document.querySelector(`.remove-dna-row-btn[data-row="${rowNum}"]`);
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeDNARow(rowNum);
    });
  }
}

// Setup event listeners for all DNA rows
function setupDNARowListeners() {
  const tbody = $('dna-edits-tbody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr[id^="dna-row-"]');
  rows.forEach(row => {
    const rowNum = parseInt(row.id.replace('dna-row-', ''));
    if (!isNaN(rowNum)) {
      setupDNARowListenersForRow(rowNum);
    }
  });
}

// Add a new DNA row
function addDNARow() {
  const tbody = $('dna-edits-tbody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr[id^="dna-row-"]');
  const nextRowNum = rows.length + 1;
  
  const row = createDNARow(nextRowNum);
  tbody.appendChild(row);
  
  // Setup listeners for the new row
  setupDNARowListenersForRow(nextRowNum);
  
  // Update current sequence display
  updateDNAPreview(nextRowNum);
}

// Remove a DNA row
function removeDNARow(rowNum) {
  const dataRow = $(`dna-row-${rowNum}`);
  
  if (dataRow) dataRow.remove();
  
  // Renumber remaining rows
  renumberDNARows();
}

// Renumber all DNA rows after deletion
function renumberDNARows() {
  const tbody = $('dna-edits-tbody');
  if (!tbody) return;
  
  const dataRows = Array.from(tbody.querySelectorAll('tr[id^="dna-row-"]'));
  
  // Sort by current row number
  dataRows.sort((a, b) => {
    const aNum = parseInt(a.id.replace('dna-row-', ''));
    const bNum = parseInt(b.id.replace('dna-row-', ''));
    return aNum - bNum;
  });
  
  // Clear and re-add in order
  tbody.innerHTML = '';
  dataRows.forEach((dataRow, idx) => {
    const newNum = idx + 1;
    dataRow.id = `dna-row-${newNum}`;
    dataRow.querySelector('td:first-child').textContent = newNum;
    
    // Update all IDs in the row
    const inputs = dataRow.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input.id) {
        input.id = input.id.replace(/\d+$/, newNum);
      }
      if (input.getAttribute('data-row')) {
        input.setAttribute('data-row', newNum);
      }
    });
    
    tbody.appendChild(dataRow);
    
    // Re-setup listeners
    setupDNARowListenersForRow(newNum);
  });
}

// Get all DNA row numbers currently in the table
function getAllDNARowNumbers() {
  const tbody = $('dna-edits-tbody');
  if (!tbody) return [];
  
  const rows = tbody.querySelectorAll('tr[id^="dna-row-"]');
  return Array.from(rows).map(row => {
    const rowNum = parseInt(row.id.replace('dna-row-', ''));
    return isNaN(rowNum) ? null : rowNum;
  }).filter(n => n !== null);
}

// Parse DNA edits from UI inputs
function parseDNAEdits() {
  const edits = [];
  
  // Get all row numbers dynamically
  const rowNumbers = getAllDNARowNumbers();
  console.log('parseDNAEdits: rowNumbers =', rowNumbers);
  
  for (const i of rowNumbers) {
    const startPosEl = $(`dna-start-${i}`);
    const endPosEl = $(`dna-end-${i}`);
    const operationEl = $(`dna-op-${i}`);
    const newSeqEl = $(`dna-seq-${i}`);
    
    console.log(`Row ${i}:`, {
      startPosEl: startPosEl ? 'found' : 'NOT FOUND',
      endPosEl: endPosEl ? 'found' : 'NOT FOUND',
      operationEl: operationEl ? 'found' : 'NOT FOUND',
      newSeqEl: newSeqEl ? 'found' : 'NOT FOUND'
    });
    
    if (!startPosEl || !operationEl) {
      console.log(`Row ${i}: Missing elements, skipping`);
      continue;
    }
    
    const startPos = startPosEl.value.trim();
    const endPos = endPosEl ? endPosEl.value.trim() : '';
    const operation = operationEl.value;
    const newSeq = newSeqEl ? newSeqEl.value.trim() : '';
    
    console.log(`Row ${i} values:`, { startPos, endPos, operation, newSeq });
    
    // Skip empty rows (operation must be selected, not "Select...")
    if (!startPos || !operation || operation === '') {
      console.log(`Row ${i}: Empty or invalid, skipping`);
      continue;
    }
    
    const start = parseInt(startPos);
    const end = parseInt(endPos) || start;
    
    if (isNaN(start) || isNaN(end)) {
      throw new Error(`Row ${i}: Invalid position numbers.`);
    }
    
    if (start > end) {
      throw new Error(`Row ${i}: Start position must be ≤ end position.`);
    }
    
    const editObj = {
      index: i,
      startPos: start,
      endPos: end,
      operation,
      newSeq,
      description: `${operation.charAt(0).toUpperCase() + operation.slice(1)} [${start}-${end}]`
    };
    
    console.log(`Row ${i}: Adding edit:`, editObj);
    edits.push(editObj);
  }
  
  console.log('parseDNAEdits: Final edits array:', edits);
  console.log('parseDNAEdits: Returning', edits.length, 'edits');
  return edits;
}

// ===== MODE SWITCHING =====

function switchMutationMode(mode) {
  if (mode === 'cds') {
    $('cds-mode-section').style.display = 'block';
    $('cds-mutations-section').style.display = 'block';
    $('dna-mutations-section').style.display = 'none';
  } else if (mode === 'dna') {
    $('cds-mode-section').style.display = 'none';
    $('cds-mutations-section').style.display = 'none';
    $('dna-mutations-section').style.display = 'block';
  }
}

// Update DNA sequence preview for a row (now updates the Current sequence column)
function updateDNAPreview(rowNum) {
  const template = cleanDNA($('template-seq').value);
  const startPos = parseInt($(`dna-start-${rowNum}`).value) || 0;
  const endPos = parseInt($(`dna-end-${rowNum}`).value) || 0;
  const currentSeqEl = $(`dna-current-${rowNum}`);
  
  if (!currentSeqEl) return;
  
  if (!template || !startPos) {
    currentSeqEl.value = '';
    currentSeqEl.placeholder = '-';
    return;
  }
  
  // Convert 1-based to 0-based
  const start = startPos - 1;
  const end = endPos || startPos;
  
  if (start < 0 || end > template.length || start >= end) {
    currentSeqEl.value = '';
    currentSeqEl.placeholder = '⚠ Invalid';
    currentSeqEl.style.color = '#e74c3c';
    return;
  }
  
  const seq = template.slice(start, end);
  currentSeqEl.value = seq;
  currentSeqEl.style.color = '#27ae60';
  currentSeqEl.placeholder = '';
}

// ===== DESIGN WORKFLOW FOR DNA MODE =====

async function onDesignClickDNAMode() {
  console.log('onDesignClickDNAMode called');
  const rawTemplate = $('template-seq').value;
  console.log('Raw template length:', rawTemplate ? rawTemplate.length : 0);
  let template = cleanDNA(rawTemplate);

  if (!template) {
    alert('Please paste a DNA template sequence.');
    return;
  }

  const edits = parseDNAEdits();
  console.log('onDesignClickDNAMode: Received edits from parseDNAEdits:', edits);
  console.log('onDesignClickDNAMode: edits.length =', edits.length);
  console.log('onDesignClickDNAMode: edits content:', JSON.stringify(edits, null, 2));
  
  if (edits.length === 0) {
    alert('Please define at least one DNA edit.');
    return;
  }

  // MW preflight warnings (template + parameters + user overlaps + performance)
  const warnings = [];
  if (VIZ && VIZ.validateSequenceInput) {
    warnings.push(...VIZ.validateSequenceInput([{ label: 'Template', seq: stripFASTAHeaders(rawTemplate) }], 'Template'));
  }
  const outerTm = parseFloat($('outer-tm').value) || 60;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('primer-na').value) || 50;
  const mg_mM = parseFloat($('primer-mg').value) || 0;
  const userFOverlap = ($('f-overlap-seq').value || '').trim();
  const userROverlap = ($('r-overlap-seq').value || '').trim();
  if (VIZ && VIZ.validateParameterRange) {
    warnings.push(...VIZ.validateParameterRange({ Na: na_mM, Mg: mg_mM, conc: conc_nM, targetTm: outerTm }));
  }
  addOverlapWarnings(warnings, userFOverlap, 'DNA-F', 15, 40);
  addOverlapWarnings(warnings, userROverlap, 'DNA-R', 15, 40);
  if (VIZ && VIZ.validatePerformance) {
    warnings.push(...VIZ.validatePerformance(edits.length, template.length));
  }
  const okMW = await confirmMWWarnings(warnings);
  if (!okMW) return;

  const results = [];
  let currentTemplate = template;
  const origSeq = currentTemplate;

  try {
    console.log('onDesignClickDNAMode: Starting to process', edits.length, 'edits');
    for (const edit of edits) {
      console.log('onDesignClickDNAMode: Processing edit:', edit);
      // Store the state BEFORE this specific edit (this is the "WT" for primer design)
      // For Edit #1, stepWt = origSeq; for Edit #N, stepWt = result of Edit #(N-1)
      const stepWt = currentTemplate;
      
      console.log('onDesignClickDNAMode: Calling applyDNAEdit with:', {
        template: currentTemplate.substring(0, 50) + '...',
        startPos: edit.startPos,
        endPos: edit.endPos,
        operation: edit.operation,
        newSeq: edit.newSeq
      });
      
      const eInfo = applyDNAEdit(
        currentTemplate,
        edit.startPos,
        edit.endPos,
        edit.operation,
        edit.newSeq
      );
      
      console.log('onDesignClickDNAMode: applyDNAEdit returned:', {
        originalSegment: eInfo.originalSegment,
        resultingSegment: eInfo.resultingSegment,
        editedTemplateLength: eInfo.editedTemplate.length
      });

      results.push({
        id: edit.index,
        description: edit.description,
        operation: edit.operation,
        startPos: edit.startPos,
        endPos: edit.endPos,
        newSeq: edit.newSeq,
        originalSegment: eInfo.originalSegment,
        resultingSegment: eInfo.resultingSegment,
        editedTemplate: eInfo.editedTemplate,
        wtTemplate: stepWt, // Use the immediate predecessor as the template for primer design
        // Store WT positions (1-based) for primer design
        // Note: These positions are relative to stepWt (the template before this edit)
        wtStartPos: edit.startPos,
        wtEndPos: edit.endPos
      });

      currentTemplate = eInfo.editedTemplate;
      console.log('onDesignClickDNAMode: Updated currentTemplate length:', currentTemplate.length);
    }
    
    console.log('onDesignClickDNAMode: Processed', results.length, 'results');
    console.log('onDesignClickDNAMode: About to call renderDNAEditResults');
  } catch (e) {
    console.error('onDesignClickDNAMode: Error during DNA editing:', e);
    console.error('onDesignClickDNAMode: Error stack:', e.stack);
    alert(e.message || 'Error during DNA editing.');
    return;
  }

  console.log('onDesignClickDNAMode: Calling renderDNAEditResults with', results.length, 'results');
  renderDNAEditResults(results, origSeq, currentTemplate, edits, rawTemplate);
  console.log('onDesignClickDNAMode: renderDNAEditResults completed');
}

function renderDNAEditResults(results, origSeq, finalSeq, edits, rawTemplate = null) {
  console.log('renderDNAEditResults called');
  console.log('renderDNAEditResults: results.length =', results.length);
  console.log('renderDNAEditResults: origSeq.length =', origSeq.length);
  console.log('renderDNAEditResults: finalSeq.length =', finalSeq.length);
  
  // Store results for download
  currentResults = results;
  currentSeqName = rawTemplate ? extractFASTAHeader(rawTemplate) : null;
  currentDNAMode = true;
  currentDNAPrimers = results;
  
  // Store mutant sequence for download
  currentMutantSequence = finalSeq ? Core.normalizeSeq(finalSeq) : null;
  
  // Show results section
  const resultsSection = $('results-section');
  if (resultsSection) {
    console.log('renderDNAEditResults: Showing results-section');
    resultsSection.style.display = 'block';
  } else {
    console.warn('renderDNAEditResults: results-section not found!');
  }
  
  const outTable = $('results-table');
  if (!outTable) {
    console.error('renderDNAEditResults: outTable not found!');
    return;
  }
  
  outTable.innerHTML = '';

  // Extract sequence name from FASTA header if available
  const seqName = rawTemplate ? extractFASTAHeader(rawTemplate) : null;

  // Show original and final sequences with highlights
  renderDNASequences(origSeq, finalSeq, edits);

  // Show summary
  const summaryDiv = $('summary');
  let summaryHtml = '<ul style="margin: 8px 0; padding-left: 20px;">';
  results.forEach((r, idx) => {
    const origLen = r.originalSegment ? r.originalSegment.length : 0;
    const newLen = r.resultingSegment ? r.resultingSegment.length : 0;
    summaryHtml += `<li>Edit #${idx + 1}: ${r.description}<br>`;
    summaryHtml += `  Original (${origLen}bp): <code>${r.originalSegment || '(empty)'}</code><br>`;
    summaryHtml += `  Result (${newLen}bp): <code>${r.resultingSegment || '(empty)'}</code></li>`;
  });
  summaryHtml += '</ul>';
  summaryDiv.innerHTML = summaryHtml;

  // Design primers for each edit
  outTable.innerHTML = '<h3 style="margin-top:12px; color:#27ae60;">Primer Design for DNA Edits</h3>';
  
  // Get primer parameters
  const outerTm = parseFloat($('outer-tm').value) || 60;
  const overlapTm = parseFloat($('overlap-tm').value) || 60;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('primer-na').value) || 50;
  const mg_mM = parseFloat($('primer-mg').value) || 0;
  const userFOverlap = ($('f-overlap-seq').value || '').trim();
  const userROverlap = ($('r-overlap-seq').value || '').trim();

  try {
    // Design primers around each edit location
    results.forEach((editResult, editIdx) => {
      // Use the edited template (result of this edit combined with previous edits)
      const mutantTemplate = editResult.editedTemplate;
      const wtTemplate = editResult.wtTemplate || origSeq;

      // Determine edit length (for substitution/insertion use new sequence length; for deletion use 0)
      let editLen = 0;
      if (editResult.operation === 'substitution' || editResult.operation === 'insertion') {
        editLen = (editResult.newSeq || '').length;
      } else if (editResult.operation === 'deletion') {
        editLen = 0;
      } else {
        editLen = Math.max(0, (editResult.endPos || 0) - (editResult.startPos || 0));
      }

      // Convert 1-based positions to 0-based for primer design
      // For deletion: we need to track both WT positions and mutantTemplate positions
      // WT: deletion region is [startPos, endPos] (1-based inclusive)
      // Mutant: deletion region is removed, so in mutantTemplate, editStart and editEnd are the same (junction)
      let editStart, editEnd;
      if (editResult.operation === 'deletion') {
        // For deletion: editStart is where deletion starts in WT (0-based)
        // In mutantTemplate, this position still exists (it's the junction)
        editStart = Math.max(0, (editResult.startPos || 1) - 1);
        // In mutantTemplate, after deletion, editEnd equals editStart (the junction point)
        // But we need WT endPos for right core calculation - we'll pass it via opts
        editEnd = editStart; // In mutantTemplate, junction is at editStart
      } else {
        // For substitution/insertion: editStart and editEnd are the boundaries of the edit region
        if (editResult.operation === 'insertion') {
          // For insertion: insert AFTER startPos (1-based), so in mutant template:
          // - editStart is startPos (0-based, which is startPos in 1-based since we insert after it)
          // - editEnd is editStart + newSeq.length (where new sequence ends in mutant)
          editStart = editResult.startPos || 1; // Use 1-based directly (insert after this position)
          editEnd = editStart + editLen; // new sequence inserted after startPos
        } else if (editResult.operation === 'substitution') {
          // For substitution: editStart is 0-based (startPos - 1)
          editStart = Math.max(0, (editResult.startPos || 1) - 1);
          editEnd = editStart + editLen; // new sequence replaces old region
        } else {
          editStart = Math.max(0, (editResult.startPos || 1) - 1);
          editEnd = (editResult.endPos || editResult.startPos || 1) - 1; // fallback
        }
      }

      // For deletion, pass WT endPos for correct right core calculation
      // Set desiredOverlap to ~20bp for deletion, or based on editLen for substitution/insertion
      let desiredOverlapVal = 20; // Default for deletion
      if (editResult.operation === 'substitution' || editResult.operation === 'insertion') {
        desiredOverlapVal = Math.min(20, Math.max(8, editLen || 20));
      }
      
      const opts = {
        desiredCore: 20, // This is just a starting point, will be optimized by findOptimalCore
        desiredOverlap: desiredOverlapVal,
        minOverlapTm: overlapTm, // Use user-specified overlap Tm as threshold
          maxSearchRadius: 60,
        coreTargetTm: outerTm,   // Use user-specified core Tm for core optimization
        outerTargetTm: outerTm,  // F1/R2 anchor primers Tm
        minCore: 12,
        maxCore: 40,
          conc_nM,
          na_mM,
        mg_mM,
        userFOverlap,
        userROverlap
      };
      // Pass WT endPos (0-based exclusive) for right core calculation
      // This is needed for deletion, substitution, and insertion to correctly bind to WT template
      if (editResult.operation === 'deletion' || editResult.operation === 'substitution') {
        // editResult.endPos is 1-based inclusive, which equals 0-based exclusive
        opts.wtEndPos = (editResult.endPos || editResult.startPos || 1);
      } else if (editResult.operation === 'insertion') {
        // For insertion: insert AFTER startPos (1-based)
        // In WT template, insertion happens after startPos, so wtEndPos = startPos (1-based = 0-based exclusive for slice)
        // coreRight should start from WT position startPos (where insertion happens)
        opts.wtEndPos = editResult.startPos || 1; // Use 1-based startPos directly
      }

      const designResult = designOePcrPrimersForDNAEditDynamic(
        mutantTemplate,
        wtTemplate,
        editStart,
        editEnd,
        editLen,
        opts
      );
      debugLogFmutRmutParts(`DNA Edit #${editIdx + 1}: ${editResult.description}`, designResult);

      // Persist designed primers onto the result object for downloads (FASTA export).
      // This keeps currentDNAPrimers/currentResults in sync with what is displayed.
      editResult.F1 = designResult.F1 || null;
      editResult.Fmut = designResult.Fmut || null;
      editResult.Rmut = designResult.Rmut || null;
      editResult.R2 = designResult.R2 || null;

      // Display primers for this edit
      const fragmentDiv = document.createElement('div');
      fragmentDiv.style.marginTop = '16px';
      
      const title = document.createElement('h4');
      title.style.marginTop = '12px';
      title.style.marginBottom = '8px';
      title.textContent = `Edit #${editIdx + 1}: ${editResult.description}`;
      fragmentDiv.appendChild(title);

      const table = document.createElement('table');
      table.className = 'results-table';
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Primer</th>
          <th>Sequence (5'→3')</th>
          <th>Len</th>
          <th>GC%</th>
          <th>Core Tm</th>
          <th>Overlap Tm</th>
          <th>Homopolymer</th>
          <th>Hairpin</th>
          <th>Self-dimer</th>
          <th>Cross-dimer</th>
        </tr>
      `;
      table.appendChild(thead);
      
      const tbody = document.createElement('tbody');
      
      // Generate operation string for Fmut/Rmut naming (e.g., del100-107, rep100-107, ins100)
      let operationStr = editResult.description || `edit${editIdx + 1}`;
      
      // Generate primer names based on naming convention
      // F1/R2: if header exists, use "name-F" and "name-R", otherwise use "fragment-F" and "fragment-R"
      // Fmut/Rmut: use "name(operation)-F" and "name(operation)-R", or "fragment(operation)-F"/"fragment(operation)-R" if no header
      const f1Name = seqName ? `${seqName}-F` : 'fragment-F';
      const r2Name = seqName ? `${seqName}-R` : 'fragment-R';
      const fmutName = seqName ? `${seqName}(${operationStr})-F` : `fragment(${operationStr})-F`;
      const rmutName = seqName ? `${seqName}(${operationStr})-R` : `fragment(${operationStr})-R`;
      
      // Reorder primers: F1 and Rmut are a pair (Fragment 1), Fmut and R2 are a pair (Fragment 2)
      const primers = [
        { key: 'F1', label: f1Name, info: designResult.F1, pairKey: 'Rmut' },
        { key: 'Rmut', label: rmutName, info: designResult.Rmut, pairKey: 'F1' },
        { key: 'Fmut', label: fmutName, info: designResult.Fmut, pairKey: 'R2' },
        { key: 'R2', label: r2Name, info: designResult.R2, pairKey: 'Fmut' }
      ];

      for (let i = 0; i < primers.length; i++) {
        const p = primers[i];
        
        // Skip if primer info is null or missing sequence
        if (!p.info || !p.info.seq) {
          continue;
        }
        
        const row = document.createElement('tr');
        
        // Get QC for this primer
        const qc = runPrimerQC(p.info.seq, 60);
        const qcLabel = getQCLabel(qc);
        const hpBadge = `<span class="qc-badge ${qcLabel.hp.cls}">${qcLabel.hp.label}</span>`;
        const sdBadge = `<span class="qc-badge ${qcLabel.sd.cls}">${qcLabel.sd.label}</span>`;
        const homoBadge = `<span class="qc-badge ${qcLabel.homo.cls}">${qcLabel.homo.label}</span>`;
        
        // Format Tms
        const coreTmStr = p.info.coreTm !== null ? p.info.coreTm.toFixed(1) : '-';
        const overlapTmStr = p.info.overlapTm !== null ? p.info.overlapTm.toFixed(1) : '-';
        
        // Calculate cross-dimer with paired primer (only for first primer in each pair)
        // F1 and Rmut are a pair (index 0 and 1), Fmut and R2 are a pair (index 2 and 3)
        let crossDimerCell = '';
        if (i === 0 || i === 2) {
          // First primer in pair (F1 or Fmut)
          const pairPrimer = primers.find(pr => pr.key === p.pairKey);
          const pairSeq = pairPrimer && pairPrimer.info && pairPrimer.info.seq ? pairPrimer.info.seq : null;
          const crossDimerLabel = getCrossDimerLabel(p.info.seq, pairSeq);
          const crossDimerBadge = `<span class="qc-badge ${crossDimerLabel.cls}">${crossDimerLabel.label}</span>`;
          crossDimerCell = `<td rowspan="2" style="text-align:center; vertical-align:middle;">${crossDimerBadge}</td>`;
        }
        // For second primer in pair (Rmut or R2), don't add cross-dimer cell (it's merged)
        
        row.innerHTML = `
          <td><strong>${p.label}</strong></td>
          <td class="mono"><code style="font-family:monospace; font-size:0.8rem; word-break:break-all;">${highlightPrimerRegion(p.info.seq, p.info.mutStartIndex, p.info.mutLength)}</code></td>
          <td>${p.info.len}</td>
          <td>${p.info.gc.toFixed(1)}%</td>
          <td>${coreTmStr}</td>
          <td>${overlapTmStr}</td>
          <td>${homoBadge}</td>
          <td>${hpBadge}</td>
          <td>${sdBadge}</td>
          ${crossDimerCell}
        `;
        tbody.appendChild(row);
      }
      
      table.appendChild(tbody);
      fragmentDiv.appendChild(table);
      
      // Add overlap/core info summary (only if info exists)
      if (designResult && designResult.info) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'font-size:0.8rem; color:#666; margin-top:8px;';
        infoDiv.innerHTML = `
          <strong>Design Info:</strong> 
          Overlap: ${designResult.info.overlapLen || '-'}bp (Tm: ${designResult.info.overlapTm?.toFixed(1) || '-'}°C) | 
          Core Left: ${designResult.info.coreLeftLen || '-'}bp (Tm: ${designResult.info.coreLeftTm?.toFixed(1) || '-'}°C) | 
          Core Right: ${designResult.info.coreRightLen || '-'}bp (Tm: ${designResult.info.coreRightTm?.toFixed(1) || '-'}°C)
        `;
        fragmentDiv.appendChild(infoDiv);
      }
      
      outTable.appendChild(fragmentDiv);
    });
  } catch (e) {
    console.error(e);
    outTable.innerHTML += `<p style="color:#e74c3c;"><strong>⚠ Primer design error:</strong> ${e.message}</p>`;
  }
}

// Global variable to store current CDS/ORF
let currentCDS = null;
let detectedORFs = [];

// Update ORF dropdown based on detected ORFs
function updateORFSelect(orfs) {
  const orfSelect = $('orf-select');
  const orfInfo = $('orf-info');
  
  detectedORFs = orfs || [];
  orfSelect.innerHTML = '';
  
  if (!orfs || orfs.length === 0) {
    orfSelect.innerHTML = '<option value="">No ORFs detected</option>';
    orfInfo.textContent = '';
    currentCDS = null;
    updateAllCurrentAA();
    return;
  }
  
  orfs.forEach((orf, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    const strandLabel = orf.strand === '+' ? 'Fwd' : 'Rev';
    const aaLen = Math.floor(orf.length / 3);
    option.textContent = `ORF ${idx + 1}: ${orf.start + 1}-${orf.end} (${strandLabel}, ${aaLen} AA)`;
    if (idx === 0) option.selected = true;
    orfSelect.appendChild(option);
  });
  
  // Select the first (longest) ORF by default
  selectORF(0);
}

// Select a specific ORF
function selectORF(idx) {
  if (idx < 0 || idx >= detectedORFs.length) {
    currentCDS = null;
    $('orf-info').textContent = '';
    updateAllCurrentAA();
    return;
  }
  
  const orf = detectedORFs[idx];
  if (orf.strand === '-') {
    currentCDS = orf.seqForUse || revComp(orf.seq);
  } else {
    currentCDS = orf.seq;
  }
  
  const aa = translateDNA(currentCDS);
  $('orf-info').textContent = `Selected: ${aa.length} amino acids, starts with ${aa.slice(0, 5)}...`;
  
  updateAllCurrentAA();
}

// Update Current AA display for a specific row
function updateCurrentAA(rowNum) {
  const posInput = $(`aa-pos-${rowNum}`);
  const endInput = $(`aa-end-${rowNum}`);
  const currentAAInput = $(`aa-current-${rowNum}`);
  
  if (!currentCDS || !posInput) {
    if (currentAAInput) currentAAInput.value = '';
    return;
  }
  
  const pos = parseInt(posInput.value);
  const endPos = parseInt(endInput?.value) || pos;
  
  if (isNaN(pos) || pos < 1) {
    currentAAInput.value = '';
    return;
  }
  
  const aa = translateDNA(currentCDS);
  if (pos > aa.length) {
    currentAAInput.value = '?';
    currentAAInput.title = 'Position out of range';
    return;
  }
  
  // Get AAs from start to end position
  const startIdx = pos - 1;
  const endIdx = Math.min(endPos, aa.length);
  const currentAAs = aa.slice(startIdx, endIdx);
  
  currentAAInput.value = currentAAs;
  currentAAInput.title = `Current AA at position ${pos}${endPos > pos ? '-' + endPos : ''}: ${currentAAs}`;
}

// Update all Current AA displays
function updateAllCurrentAA() {
  const rowNumbers = getAllAARowNumbers();
  rowNumbers.forEach(i => updateCurrentAA(i));
}

// Debounce function for sequence input
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Detect ORFs from template sequence
function detectAndUpdateORFs() {
  const rawTemplate = $('template-seq').value;
  const template = cleanDNA(rawTemplate);
  
  if (!template || template.length < 30) {
    updateORFSelect([]);
    return;
  }
  
  const candidates = getTopCDSCandidates(template, 10);
  updateORFSelect(candidates);
}

export function initMutagenesisModule(container) {
  console.log('Mutagenesis module initializing...', container);
  
  if (container) {
    moduleContainer = container;
  }
  
  populateHostSelect();
  
  // Mode switching
  const modeRadios = (moduleContainer || document).querySelectorAll('input[name="mutation-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      switchMutationMode(e.target.value);
    });
  });
  
  // Design button - routes to appropriate handler
  const designBtn = $('design-btn');
  console.log('Design button found:', designBtn);
  if (designBtn) {
    designBtn.addEventListener('click', () => {
      console.log('Design button clicked!');
      const modeRadio = (moduleContainer || document).querySelector('input[name="mutation-mode"]:checked');
      const mode = modeRadio ? modeRadio.value : 'cds';
      console.log('Current mode:', mode);
      if (mode === 'cds') {
        console.log('Calling onDesignClick()');
        onDesignClick();
      } else if (mode === 'dna') {
        console.log('Calling onDesignClickDNAMode()');
        onDesignClickDNAMode();
      } else {
        console.warn('Unknown mode:', mode);
      }
    });
  } else {
    console.error('Design button not found!');
  }
  
  // ===== CDS Mode: Initialize AA edits table =====
  initializeAAEditsTable();
  
  // Setup codon selector updates (CDS mode)
  const hostSelect = $('host-select');
  if (hostSelect) {
    hostSelect.addEventListener('change', () => {
      const hostCode = hostSelect.value;
      const rowNumbers = getAllAARowNumbers();
      rowNumbers.forEach(i => updateCodonSelect(i, hostCode));
    });
  }
  
  // ===== NEW: ORF detection and Current AA display =====
  
  // Template sequence input - detect ORFs with debounce
  const templateInput = $('template-seq');
  if (templateInput) {
    templateInput.addEventListener('input', debounce(detectAndUpdateORFs, 500));
    
    // Update DNA previews when template changes
    templateInput.addEventListener('input', () => {
      const rowNumbers = getAllDNARowNumbers();
      rowNumbers.forEach(i => updateDNAPreview(i));
    });
  }

  // ===== Reverse Complement helper (preserve FASTA headers, no extra suffix) =====
  function applyRCToTemplateTextarea(textarea) {
    if (!textarea) return;
    const raw = (textarea.value || '').trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/);
    const records = [];
    let header = null;
    let seqLines = [];

    function pushOne() {
      if (!header) return;
      const seq = seqLines.join('').replace(/\s+/g, '').toUpperCase();
      if (seq) {
        records.push({ header, seq });
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('>')) {
        pushOne();
        header = trimmed;
        seqLines = [];
      } else {
        seqLines.push(trimmed);
      }
    }
    pushOne();

    // If no FASTA headers found, treat entire textarea as one sequence
    if (records.length === 0) {
      const seq = raw.replace(/\s+/g, '').toUpperCase();
      if (!seq) return;
      records.push({ header: '>rc', seq });
    }

    textarea.value = records
      .map(r => r.header + '\n' + Core.reverseComplementSeq(r.seq))
      .join('\n');
  }
  
  // ORF select change
  const orfSelect = $('orf-select');
  if (orfSelect) {
    orfSelect.addEventListener('change', () => {
      const idx = parseInt(orfSelect.value);
      if (!isNaN(idx)) {
        selectORF(idx);
      }
    });
  }
  
  // Add row button (CDS mode)
  const addAARowBtn = $('add-aa-row-btn');
  if (addAARowBtn) {
    addAARowBtn.addEventListener('click', addAARow);
  }
  
  // ===== DNA Mode: Initialize DNA edits table =====
  initializeDNAEditsTable();
  
  // Add row button (DNA mode)
  const addDNARowBtn = $('add-dna-row-btn');
  if (addDNARowBtn) {
    addDNARowBtn.addEventListener('click', addDNARow);
  }
  
  // ===== File Upload =====
  const uploadBtn = $('mut-upload-btn');
  const fileInput = $('mut-file-upload');
  const rcBtn = $('mut-rc-btn');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      // Check file size (limit to 1MB)
      const maxSize = 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        alert(`File size exceeds the limit of 1MB. Please upload a smaller file.\n\nCurrent file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        event.target.value = ''; // Clear the file input
        return;
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target.result;
        const templateTextarea = $('template-seq');
        if (templateTextarea) {
          templateTextarea.value = content;
          // Trigger input event to detect ORFs
          templateTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      reader.onerror = function() {
        alert('Failed to read file, please try again.');
      };
      reader.readAsText(file);
      
      // Clear the file input so the same file can be selected again
      event.target.value = '';
    });
  } else {
    console.warn('Upload button or file input not found for template sequence');
  }

  // RC button: apply reverse complement to template textarea, then trigger input updates
  if (rcBtn) {
    rcBtn.addEventListener('click', () => {
      const templateTextarea = $('template-seq');
      if (templateTextarea) {
        applyRCToTemplateTextarea(templateTextarea);
        // Trigger input to refresh ORF detection/previews
        templateTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  // Demo button: load Insert_1.txt
  const demoBtn = $('mut-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      const templateTextarea = $('template-seq');
      if (!templateTextarea) return;
      
      try {
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        const resp = await fetch(base + 'Insert_1.txt');
        if (!resp.ok) {
          alert('Failed to load demo sequence.');
          return;
        }
        const text = await resp.text();
        templateTextarea.value = text;
        // Trigger input event to detect ORFs
        templateTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        console.error('Demo load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }

  // Demo Set button: load Insert_1.txt, then add V55A (if CDS) or Deletion 100-107 (if DNA)
  const demoSetBtn = $('mut-demo-set');
  if (demoSetBtn) {
    demoSetBtn.addEventListener('click', async () => {
      const templateTextarea = $('template-seq');
      if (!templateTextarea) return;
      
      try {
        // Load Insert_1.txt
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        const resp = await fetch(base + 'Insert_1.txt');
        if (!resp.ok) {
          alert('Failed to load demo sequence.');
          return;
        }
        const text = await resp.text();
        templateTextarea.value = text;
        
        // Check current mutation mode from radio button
        const modeRadio = (moduleContainer || document).querySelector('input[name="mutation-mode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'cds';
        
        if (mode === 'dna') {
          // DNA mode: no need to wait, fill directly
          const opSelect = $('dna-op-1');
          const startInput = $('dna-start-1');
          const endInput = $('dna-end-1');
          if (opSelect) opSelect.value = 'deletion';
          if (startInput) startInput.value = '100';
          if (endInput) endInput.value = '107';
          
          // Trigger input event to detect ORFs (for DNA preview)
          templateTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Trigger update to show current sequence
          if (startInput) startInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (endInput) endInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // CDS mode: trigger input event and wait for CDS detection
          templateTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Wait for CDS detection to complete (500ms should be enough)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (currentCDS) {
            // CDS mode: set AA substitution V55A in first row
            const opSelect = $('aa-op-1');
            const posInput = $('aa-pos-1');
            const aaToInput = $('aa-to-1');
            if (opSelect) opSelect.value = 'substitution';
            if (posInput) posInput.value = '55';
            if (aaToInput) aaToInput.value = 'A';
            
            // Trigger update to get current AA and update codon select
            if (posInput) posInput.dispatchEvent(new Event('input', { bubbles: true }));
            if (aaToInput) aaToInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      } catch (e) {
        console.error('Demo Set load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  // ===== Clear Button =====
  const clearBtn = $('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      console.log('Clear button clicked');
      // Hide results section
      const resultsSection = $('results-section');
      if (resultsSection) {
        resultsSection.style.display = 'none';
      }
      
      // Clear results content
      const summary = $('summary');
      const resultsTable = $('results-table');
      const aaOriginal = $('aa-original');
      const aaTranslation = $('aa-translation');
      
      if (summary) summary.innerHTML = '';
      if (resultsTable) resultsTable.innerHTML = '';
      if (aaOriginal) aaOriginal.innerHTML = '';
      if (aaTranslation) aaTranslation.innerHTML = '';
      
      // Clear stored results for download
      currentResults = null;
      currentSeqName = null;
      currentDNAMode = false;
      currentDNAPrimers = [];
    });
  } else {
    console.warn('Clear button not found');
  }
  
  // ===== Download Button =====
  const downloadBtn = $('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const downloadType = $('download-type').value;
      
      if (downloadType === 'primers') {
        downloadPrimersFASTA();
      } else if (downloadType === 'fasta') {
        downloadMutantFASTA();
      }
    });
  }
  
  // ===== Reset Button =====
  const resetBtn = $('global-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      console.log('Reset button clicked - reloading page');
      window.location.reload();
    });
  } else {
    console.warn('Reset button not found');
  }
  
  console.log('Mutagenesis module initialized successfully');
}

window.initMutagenesisModule = initMutagenesisModule;
