// Multiplex PCR Primer Designer
// Purpose: Design multiplex PCR primers to simultaneously amplify multiple DNA target sequences

import * as Core from './core_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';

// ==================== Utility Functions ====================

function $(id) {
  return document.getElementById(id);
}

/**
 * Show warning modal instead of browser alert
 * @param {string} message - Warning message to display
 */
function showWarning(message) {
  const modal = $('warning-modal');
  const messageEl = $('warning-message');
  const okBtn = $('warning-ok-btn');
  
  if (!modal || !messageEl || !okBtn) {
    // Fallback to alert if modal elements not found
    alert(message);
    return;
  }
  
  messageEl.textContent = message;
  modal.style.display = 'flex';
  
  // Close modal on OK button click
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  okBtn.onclick = closeModal;
  
  // Close modal on overlay click
  const overlay = modal.querySelector('.warning-modal-overlay');
  if (overlay) {
    overlay.onclick = closeModal;
  }
  
  // Close modal on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function cleanDNA(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return Core.normalizeSeq(dnaLines.join(''));
}

// Extract FASTA header (sequence name) from input
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
  return Core.reverseComplementSeq(seq || "");
}

function tmSaltCorrected(seq, conc_nM = 500, na_mM = 50, mg_mM = 0) {
  return Core.tmcalNN(seq, na_mM, mg_mM, conc_nM);
}

function gcContent(seq) {
  return Core.gcPct(seq || "");
}

// ==================== Core Primer Design Functions ====================

/**
 * Search for primer binding sites in sequence
 * @param {string} sequence - Target sequence
 * @param {boolean} isForward - Whether it's a forward primer
 * @param {number} targetTm - Target Tm
 * @param {Object} opts - Options
 * @returns {Object|null} Best primer information
 */
function findPrimerBindingSite(sequence, isForward, targetTm, opts = {}) {
  const minLen = opts.minLen || 15;
  const maxLen = opts.maxLen || 40;
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  const tmTolerance = opts.tmTolerance || 2.5;
  
  let best = null;
  let bestTmDiff = Infinity;
  let bestWithinTolerance = null;
  let bestWithinToleranceDiff = Infinity;
  
  if (isForward) {
    // Forward primer: search from sequence start
    for (let len = minLen; len <= Math.min(maxLen, sequence.length); len++) {
      const primerSeq = sequence.slice(0, len);
      const tm = tmSaltCorrected(primerSeq, conc_nM, na_mM, mg_mM);
      
      if (!isFinite(tm)) continue;
      
      const tmDiff = Math.abs(tm - targetTm);
      
      // 优先选择在容差范围内的引物
      if (tmDiff <= tmTolerance && tmDiff < bestWithinToleranceDiff) {
        bestWithinTolerance = {
          seq: primerSeq,
          len: len,
          tm: tm,
          start: 0,
          end: len
        };
        bestWithinToleranceDiff = tmDiff;
      }
      
      // 同时记录最接近的引物（即使超出容差）
      if (tmDiff < bestTmDiff) {
        best = {
          seq: primerSeq,
          len: len,
          tm: tm,
          start: 0,
          end: len
        };
        bestTmDiff = tmDiff;
      }
    }
  } else {
    // Reverse primer: search from sequence end (needs reverse complement)
    for (let len = minLen; len <= Math.min(maxLen, sequence.length); len++) {
      const primerSeq = sequence.slice(-len);
      const tm = tmSaltCorrected(primerSeq, conc_nM, na_mM, mg_mM);
      
      if (!isFinite(tm)) continue;
      
      const tmDiff = Math.abs(tm - targetTm);
      
      // 优先选择在容差范围内的引物
      if (tmDiff <= tmTolerance && tmDiff < bestWithinToleranceDiff) {
        bestWithinTolerance = {
          seq: primerSeq,
          len: len,
          tm: tm,
          start: sequence.length - len,
          end: sequence.length
        };
        bestWithinToleranceDiff = tmDiff;
      }
      
      // 同时记录最接近的引物（即使超出容差）
      if (tmDiff < bestTmDiff) {
        best = {
          seq: primerSeq,
          len: len,
          tm: tm,
          start: sequence.length - len,
          end: sequence.length
        };
        bestTmDiff = tmDiff;
      }
    }
  }
  
  // Prefer returning primer within tolerance, otherwise return closest primer
  return bestWithinTolerance || best;
}

/**
 * Design primer pair for a single target sequence
 * @param {string} targetSeq - Target sequence
 * @param {Object} opts - Options
 * @returns {Object|null} Primer pair information
 */
function designPrimerPair(targetSeq, opts = {}) {
  const targetTm = opts.targetTm || 60;
  const tmTolerance = opts.tmTolerance || 2.5;
  const minLen = opts.minLen || 15;
  const maxLen = opts.maxLen || 40;
  const conc_nM = opts.conc_nM || 500;
  const na_mM = opts.na_mM || 50;
  const mg_mM = opts.mg_mM || 0;
  
  // Design forward primer
  const fwdPrimer = findPrimerBindingSite(targetSeq, true, targetTm, {
    minLen,
    maxLen,
    conc_nM,
    na_mM,
    mg_mM,
    tmTolerance
  });
  
  if (!fwdPrimer) return null;
  
  // Design reverse primer
  const revPrimer = findPrimerBindingSite(targetSeq, false, targetTm, {
    minLen,
    maxLen,
    conc_nM,
    na_mM,
    mg_mM,
    tmTolerance
  });
  
  if (!revPrimer) return null;
  
  // Calculate expected product length
  const productLength = revPrimer.end - fwdPrimer.start;
  
  // Get reverse complement of reverse primer (actual primer sequence used)
  const revPrimerSeq = revComp(revPrimer.seq);
  
  // Add overlap sequences if provided (for cloning purposes)
  const fwdOverlapSeq = opts.overlapSeqFwd ? Core.normalizeSeq(opts.overlapSeqFwd) : '';
  const revOverlapSeq = opts.overlapSeqRev ? Core.normalizeSeq(opts.overlapSeqRev) : '';
  
  const fwdSeqWithOverlap = fwdOverlapSeq ? fwdOverlapSeq + fwdPrimer.seq : fwdPrimer.seq;
  const revSeqWithOverlap = revOverlapSeq ? revOverlapSeq + revPrimerSeq : revPrimerSeq;
  
  // IMPORTANT: Tm calculation should be based on CORE sequence only, not the full sequence with overlap
  // The overlap portion remains unbound during initial PCR cycles, so it doesn't contribute to annealing
  // Use core sequence Tm for design and evaluation
  const fwdTm = fwdPrimer.tm; // Always use core sequence Tm
  const revTm = revPrimer.tm; // Always use core sequence Tm
  
  // Calculate full sequence Tm (with overlap) only for reference/display purposes, not for design
  const fwdFullTm = fwdOverlapSeq ? tmSaltCorrected(fwdSeqWithOverlap, conc_nM, na_mM, mg_mM) : fwdPrimer.tm;
  const revFullTm = revOverlapSeq ? tmSaltCorrected(revSeqWithOverlap, conc_nM, na_mM, mg_mM) : revPrimer.tm;
  
  return {
    forward: {
      seq: fwdSeqWithOverlap,
      len: fwdSeqWithOverlap.length,
      tm: fwdTm, // Core sequence Tm (used for design and evaluation)
      fullTm: fwdFullTm, // Full sequence Tm with overlap (for reference only)
      gc: gcContent(fwdSeqWithOverlap),
      start: fwdPrimer.start,
      end: fwdPrimer.end,
      coreSeq: fwdPrimer.seq,
      overlapSeq: fwdOverlapSeq
    },
    reverse: {
      seq: revSeqWithOverlap,
      len: revSeqWithOverlap.length,
      tm: revTm, // Core sequence Tm (used for design and evaluation)
      fullTm: revFullTm, // Full sequence Tm with overlap (for reference only)
      gc: gcContent(revSeqWithOverlap),
      start: revPrimer.start,
      end: revPrimer.end,
      coreSeq: revPrimerSeq,
      overlapSeq: revOverlapSeq
    },
    productLength: productLength
  };
}

/**
 * Check off-target amplification: Check if primer pair can form amplicons on non-target templates
 * @param {string} fwdSeq - Forward primer sequence
 * @param {string} revSeq - Reverse primer sequence
 * @param {Array} allTargets - Array of all target sequences
 * @param {number} currentTargetIndex - Current target index (exclude self)
 * @returns {Array} Off-target amplification results [{targetName, amplicons}]
 */
function checkOffTargetAmplification(fwdSeq, revSeq, allTargets, currentTargetIndex) {
  const offTargets = [];
  
  for (let i = 0; i < allTargets.length; i++) {
    if (i === currentTargetIndex) continue; // Skip current target
    
    const template = allTargets[i];
    const amplicons = Core.findAmplicons(template.seq, fwdSeq, revSeq);
    
    if (amplicons.length > 0) {
      offTargets.push({
        targetName: template.name,
        targetIndex: i,
        amplicons: amplicons.map(amp => ({
          length: amp.length,
          start: amp.start,
          end: amp.end
        }))
      });
    }
  }
  
  return offTargets;
}

/**
 * Design primers for all target sequences
 * @param {Array} targets - Array of target sequences [{name, seq, expectedLength}]
 * @param {Object} opts - Options
 * @returns {Array} Primer design results
 */
function designMultiplexPrimers(targets, opts = {}) {
  const results = [];
  const checkOffTarget = opts.checkOffTarget !== false; // Enable off-target amplification check by default
  
  // Step 1: Design primer pairs for each target
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const primerPair = designPrimerPair(target.seq, opts);
    
    if (!primerPair) {
      results.push({
        target: target,
        success: false,
        error: 'Unable to design primer pair'
      });
      continue;
    }
    
    // Check expected product length (if provided)
    if (target.expectedLength) {
      const lengthDiff = Math.abs(primerPair.productLength - target.expectedLength);
      if (lengthDiff > target.expectedLength * 0.1) { // Allow 10% error
        results.push({
          target: target,
          success: false,
          error: `Product length mismatch: expected ${target.expectedLength} bp, actual ${primerPair.productLength} bp`
        });
        continue;
      }
    }
    
    results.push({
      target: target,
      success: true,
      primers: primerPair,
      offTargetAmplification: [] // Will be filled later
    });
  }
  
  // Step 2: Check off-target amplification (if enabled)
  if (checkOffTarget) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.success || !result.primers) continue;
      
      // Use core sequences (without overlap) for off-target check
      const fwdSeq = result.primers.forward.coreSeq || result.primers.forward.seq;
      const revSeq = result.primers.reverse.coreSeq || result.primers.reverse.seq;
      
      // Check if this primer pair can amplify on other targets
      const offTargets = checkOffTargetAmplification(fwdSeq, revSeq, targets, i);
      result.offTargetAmplification = offTargets;
    }
  }
  
  return results;
}

// ==================== QC Functions ====================

function runPrimerQC(seq, conc_nM = 500, na_mM = 50, mg_mM = 0) {
  const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
  const gc = gcContent(seq);
  const hasHomo = Core.hasHomopolymer(seq, 4);
  
  const hairpin = Core.hairpinScan(seq);
  const selfDimer = Core.selfDimerScan(seq);
  
  return {
    tm,
    gc,
    hasHomo,
    hairpin: hairpin ? hairpin.dG : null,
    selfDimer: selfDimer ? selfDimer.dG : null
  };
}

function getQCLabel(qc) {
  const hp = qc.hairpin ? (qc.hairpin <= -7 ? 'Very Strong' : qc.hairpin <= -5 ? 'Strong' : qc.hairpin <= -3 ? 'Medium' : 'Weak') : 'None';
  const sd = qc.selfDimer ? (qc.selfDimer <= -7 ? 'Very Strong' : qc.selfDimer <= -5 ? 'Strong' : qc.selfDimer <= -3 ? 'Medium' : 'Weak') : 'None';
  const homo = qc.hasHomo ? 'Yes' : 'No';
  
  return {
    hp: { label: hp, cls: hp === 'None' ? 'qc-ok' : hp.includes('Strong') || hp === 'Very Strong' ? 'qc-bad' : hp === 'Medium' ? 'qc-moderate' : 'qc-weak' },
    sd: { label: sd, cls: sd === 'None' ? 'qc-ok' : sd.includes('Strong') || sd === 'Very Strong' ? 'qc-bad' : sd === 'Medium' ? 'qc-moderate' : 'qc-weak' },
    homo: { label: homo, cls: homo === 'No' ? 'qc-ok' : 'qc-bad' }
  };
}

function getCrossDimerLabel(seqA, seqB) {
  if (!seqA || !seqB) return { label: 'N/A', cls: 'qc-ok' };
  const dimer = Core.dimerScan(seqA, seqB);
  if (!dimer || !isFinite(dimer.dG)) return { label: 'None', cls: 'qc-ok' };
  const dG = dimer.dG;
  if (dG <= -7) return { label: 'Very Strong', cls: 'qc-bad' };
  if (dG <= -5) return { label: 'Strong', cls: 'qc-bad' };
  if (dG <= -3) return { label: 'Medium', cls: 'qc-warn' };
  return { label: 'Weak', cls: 'qc-weak' };
}

/**
 * Get ΔG value for cross-dimer
 * @param {string} seqA - Primer A sequence
 * @param {string} seqB - Primer B sequence
 * @returns {number|null} ΔG value, returns null if no dimer
 */
function getCrossDimerDG(seqA, seqB) {
  if (!seqA || !seqB) return null;
  const dimer = Core.dimerScan(seqA, seqB);
  if (!dimer || !isFinite(dimer.dG)) return null;
  return dimer.dG;
}

/**
 * Get complete cross-dimer information (including touches3)
 * @param {string} seqA - Primer A sequence
 * @param {string} seqB - Primer B sequence
 * @returns {Object|null} {dG, touches3} or null if no dimer
 */
function getCrossDimerInfo(seqA, seqB) {
  if (!seqA || !seqB) return null;
  const dimer = Core.dimerScan(seqA, seqB);
  if (!dimer || !isFinite(dimer.dG)) return null;
  return {
    dG: dimer.dG,
    touches3: dimer.touches3 || false
  };
}

/**
 * Check if there is severe cross-dimer conflict between two primer pairs
 * Uses seed-and-extend logic: 3' end extension is critical for PCR
 * - If touches3 is true (3' end involved) and dG is low, it's lethal (can be extended by polymerase)
 * - If touches3 is false (5' end only, T-shaped or hanging), it's less critical
 * @param {Object} pair1 - Primer pair 1 {forward: {seq}, reverse: {seq}, target: {name}}
 * @param {Object} pair2 - Primer pair 2
 * @param {number} threshold - Conflict threshold (ΔG, default -6 kcal/mol)
 * @returns {boolean} Whether there is conflict
 */
function hasSevereCrossDimerConflict(pair1, pair2, threshold = -6) {
  // Check all possible cross combinations:
  // pair1.F vs pair2.F, pair1.F vs pair2.R
  // pair1.R vs pair2.F, pair1.R vs pair2.R
  
  const combinations = [
    [pair1.forward.seq, pair2.forward.seq],
    [pair1.forward.seq, pair2.reverse.seq],
    [pair1.reverse.seq, pair2.forward.seq],
    [pair1.reverse.seq, pair2.reverse.seq]
  ];
  
  for (const [seqA, seqB] of combinations) {
    const dimerInfo = getCrossDimerInfo(seqA, seqB);
    if (!dimerInfo) continue;
    
    const { dG, touches3 } = dimerInfo;
    
    // Lethal dimers: 3' end complementary and can be extended by polymerase
    // If touches3 is true, apply stricter threshold (more sensitive)
    if (touches3) {
      // 3' end involved: even moderate binding can be problematic
      // Use a more lenient threshold (less negative) to catch more cases
      if (dG <= -3) {
        return true; // Any moderate or strong binding at 3' end is dangerous
      }
    } else {
      // 5' end only (T-shaped or hanging): less critical
      // Only flag if binding is very strong
      if (dG <= threshold) {
        return true; // Use original threshold for 5' end only dimers
      }
    }
  }
  
  return false;
}

/**
 * Graph coloring algorithm (greedy): Pool primers based on cross-dimer conflicts
 * @param {Array} primerPairs - Array of primer pairs [{target: {name}, primers: {forward, reverse}}]
 * @param {number} conflictThreshold - Conflict threshold (ΔG, default -6 kcal/mol)
 * @returns {Array} Pooling results [{pool: number, target: string, primers: {...}}]
 */
function poolPrimersByThermodynamics(primerPairs, conflictThreshold = -6) {
  const n = primerPairs.length;
  if (n === 0) return [];
  
  // Build conflict graph (adjacency list)
  const conflicts = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hasSevereCrossDimerConflict(primerPairs[i].primers, primerPairs[j].primers, conflictThreshold)) {
        conflicts[i].push(j);
        conflicts[j].push(i);
      }
    }
  }
  
  // Greedy coloring algorithm
  const colors = Array(n).fill(-1); // -1 means uncolored
  const available = Array(n).fill(true);
  
  for (let i = 0; i < n; i++) {
    // Reset available colors
    available.fill(true);
    
    // Mark colors used by adjacent nodes
    for (const neighbor of conflicts[i]) {
      if (colors[neighbor] !== -1) {
        available[colors[neighbor]] = false;
      }
    }
    
    // Find first available color
    let color = 0;
    while (color < n && !available[color]) {
      color++;
    }
    
    colors[i] = color;
  }
  
  // Convert to pooling results
  const maxColor = Math.max(...colors);
  const pools = Array.from({ length: maxColor + 1 }, () => []);
  
  for (let i = 0; i < n; i++) {
    pools[colors[i]].push({
      pool: colors[i] + 1, // Pool numbers start from 1
      target: primerPairs[i].target.name,
      primers: primerPairs[i].primers
    });
  }
  
  return pools;
}

/**
 * Pool primers based on product size resolution
 * @param {Array} primerPairs - Array of primer pairs
 * @param {number} sizeTolerance - Size tolerance (bp, default 10bp)
 * @returns {Array} Pooling results
 */
function poolPrimersBySize(primerPairs, sizeTolerance = 10) {
  const n = primerPairs.length;
  if (n === 0) return [];
  
  // Filter out pairs without product length
  const pairsWithSize = primerPairs.filter(pair => 
    pair.primers.productLength !== null && 
    pair.primers.productLength !== undefined && 
    isFinite(pair.primers.productLength)
  );
  
  if (pairsWithSize.length === 0) {
    // No product length info, return single pool for all
    return [primerPairs.map((pair, idx) => ({
      pool: 1,
      target: pair.target.name,
      primers: pair.primers,
      size: null
    }))];
  }
  
  // Sort by product size
  const sorted = pairsWithSize.map((pair, idx) => ({
    index: idx,
    size: pair.primers.productLength,
    pair: pair
  })).sort((a, b) => a.size - b.size);
  
  // Greedy grouping: if new product size difference < tolerance with any product in pool, cannot place in that pool
  const pools = [];
  
  for (const item of sorted) {
    let placed = false;
    
    // Try to place in existing pool
    for (const pool of pools) {
      const canPlace = pool.every(p => Math.abs(p.size - item.size) >= sizeTolerance);
      if (canPlace) {
        pool.push({
          pool: pools.indexOf(pool) + 1,
          target: item.pair.target.name,
          primers: item.pair.primers,
          size: item.size
        });
        placed = true;
        break;
      }
    }
    
    // If cannot place in existing pool, create new pool
    if (!placed) {
      pools.push([{
        pool: pools.length + 1,
        target: item.pair.target.name,
        primers: item.pair.primers,
        size: item.size
      }]);
    }
  }
  
  return pools;
}

/**
 * Comprehensive pooling strategy: unified conflict graph considering both thermodynamics and size
 * @param {Array} primerPairs - Array of primer pairs
 * @param {Object} opts - Options
 * @returns {Object} Pooling results {thermodynamicPools, sizePools, combinedPools}
 */
function poolPrimers(primerPairs, opts = {}) {
  const conflictThreshold = opts.conflictThreshold || -6;
  const sizeTolerance = opts.sizeTolerance || 20;
  const n = primerPairs.length;
  
  if (n === 0) {
    return {
      thermodynamicPools: [],
      sizePools: null,
      combinedPools: [],
      poolCount: 0,
      usedThermodynamic: true
    };
  }
  
  // Build unified conflict graph (adjacency matrix/list)
  // A conflict exists if ANY of the following conditions are met:
  // 1. Cross-dimer conflict (ΔG <= conflictThreshold), OR
  // 2. Product size conflict (size difference < sizeTolerance, when sizeTolerance > 0), OR
  // 3. Off-target amplification conflict (both pairs can amplify on the same non-target sequence)
  const conflicts = Array.from({ length: n }, () => []);
  const conflictReasons = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pair1 = primerPairs[i];
      const pair2 = primerPairs[j];
      
      let hasConflict = false;
      const reasons = [];
      
      // Check thermodynamic conflict (cross-dimer)
      if (hasSevereCrossDimerConflict(pair1.primers, pair2.primers, conflictThreshold)) {
        hasConflict = true;
        reasons.push('dimer');
      }
      
      // Check size conflict (only if sizeTolerance > 0 and both have product length)
      if (sizeTolerance > 0) {
        const size1 = pair1.primers.productLength;
        const size2 = pair2.primers.productLength;
        
        if (size1 !== null && size1 !== undefined && isFinite(size1) &&
            size2 !== null && size2 !== undefined && isFinite(size2)) {
          const sizeDiff = Math.abs(size1 - size2);
          if (sizeDiff < sizeTolerance) {
            hasConflict = true;
            reasons.push('size');
          }
        }
      }
      
      // Check off-target amplification conflict
      // If both pairs can amplify on the same non-target sequence, they conflict
      // (because they would produce overlapping bands on gel electrophoresis)
      const offTarget1 = pair1.offTargetAmplification || [];
      const offTarget2 = pair2.offTargetAmplification || [];
      
      if (offTarget1.length > 0 && offTarget2.length > 0) {
        // Check if they share any common off-target sequences
        const offTargetNames1 = new Set(offTarget1.map(off => off.targetName));
        const offTargetNames2 = new Set(offTarget2.map(off => off.targetName));
        
        // Check for intersection
        for (const name of offTargetNames1) {
          if (offTargetNames2.has(name)) {
            hasConflict = true;
            reasons.push('off-target');
            break;
          }
        }
      }
      
      if (hasConflict) {
        conflicts[i].push(j);
        conflicts[j].push(i);
        conflictReasons[i][j] = reasons;
        conflictReasons[j][i] = reasons;
      }
    }
  }
  
  // Apply graph coloring algorithm to unified conflict graph
  const colors = Array(n).fill(-1); // -1 means uncolored
  const available = Array(n).fill(true);
  
  for (let i = 0; i < n; i++) {
    // Reset available colors
    available.fill(true);
    
    // Mark colors used by adjacent nodes (conflicting pairs)
    for (const neighbor of conflicts[i]) {
      if (colors[neighbor] !== -1) {
        available[colors[neighbor]] = false;
      }
    }
    
    // Find first available color
    let color = 0;
    while (color < n && !available[color]) {
      color++;
    }
    
    colors[i] = color;
  }
  
  // Convert to pooling results
  const maxColor = Math.max(...colors);
  const combinedPools = Array.from({ length: maxColor + 1 }, () => []);
  
  for (let i = 0; i < n; i++) {
    combinedPools[colors[i]].push({
      pool: colors[i] + 1, // Pool numbers start from 1
      target: primerPairs[i].target.name,
      primers: primerPairs[i].primers
    });
  }
  
  // For backward compatibility, also calculate separate pools
  // (but these are not used for the final result)
  const thermodynamicPools = poolPrimersByThermodynamics(primerPairs, conflictThreshold);
  const sizePools = sizeTolerance > 0 ? poolPrimersBySize(primerPairs, sizeTolerance) : null;
  
  return {
    thermodynamicPools,
    sizePools: sizePools,
    combinedPools,
    poolCount: combinedPools.length,
    usedThermodynamic: true, // Always true now since we use unified graph
    conflictReasons: conflictReasons // Store conflict reasons for reporting
  };
}

/**
 * Generate heatmap color based on ΔG value
 * @param {number|null} dG - ΔG value (kcal/mol)
 * @returns {Object} {color, intensity, label} Color information
 */
function getHeatmapColor(dG) {
  if (dG === null || !isFinite(dG)) {
    return {
      color: '#f0f0f0',
      intensity: 0,
      label: 'None',
      dG: null
    };
  }
  
  // Use fixed colors matching the legend (not gradient)
  let color, intensity, label;
  
  if (dG > -3) {
    // Weak or no interaction: white/light gray
    color = 'rgb(250, 250, 250)';
    intensity = 0;
    label = 'Weak';
  } else if (dG > -5) {
    // Medium: light yellow
    color = 'rgb(255, 255, 200)';
    intensity = 1;
    label = 'Medium';
  } else if (dG > -7) {
    // Strong: orange
    color = 'rgb(255, 200, 100)';
    intensity = 2;
    label = 'Strong';
  } else {
    // Very strong: dark red
    color = 'rgb(200, 50, 0)';
    intensity = 3;
    label = 'Very Strong';
  }
  
  return {
    color,
    intensity,
    label,
    dG: dG.toFixed(1)
  };
}

/**
 * Build primer dimer matrix (includes ΔG values for heatmap)
 * @param {Array} primerResults - Primer design results
 * @returns {Object} Dimer matrix
 */
function buildDimerMatrix(primerResults) {
  const allPrimers = [];
  
  // Collect all primers
  for (const result of primerResults) {
    if (result.success && result.primers) {
      allPrimers.push({
        label: `${result.target.name}-F`,
        seq: result.primers.forward.seq,
        target: result.target.name
      });
      allPrimers.push({
        label: `${result.target.name}-R`,
        seq: result.primers.reverse.seq,
        target: result.target.name
      });
    }
  }
  
  // Build matrix (includes ΔG values)
  const matrix = [];
  for (let i = 0; i < allPrimers.length; i++) {
    const row = [allPrimers[i].label];
    for (let j = 0; j < allPrimers.length; j++) {
      if (i === j) {
        row.push({ dG: null, label: '-', isDiagonal: true });
      } else {
        const dG = getCrossDimerDG(allPrimers[i].seq, allPrimers[j].seq);
        const heatmapInfo = getHeatmapColor(dG);
        row.push({
          dG: dG,
          ...heatmapInfo
        });
      }
    }
    matrix.push(row);
  }
  
  return {
    primers: allPrimers.map(p => p.label),
    matrix: matrix
  };
}

/**
 * Download primers by pool as FASTA files
 * @param {Array} pools - Array of pools, each pool contains primer pairs
 */
function downloadPrimersByPool(pools) {
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    let fastaContent = '';
    
    for (const item of pool) {
      // Forward primer
      fastaContent += `>${item.target}-F\n`;
      fastaContent += `${item.primers.forward.seq}\n`;
      
      // Reverse primer
      fastaContent += `>${item.target}-R\n`;
      fastaContent += `${item.primers.reverse.seq}\n`;
    }
    
    // Create download link
    const blob = new Blob([fastaContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pool_${i + 1}_primers.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Small delay between downloads to avoid browser blocking
    if (i < pools.length - 1) {
      setTimeout(() => {}, 100);
    }
  }
}

// ==================== UI Functions ====================

/**
 * Parse multi-FASTA sequences and update preview
 */
function parseAndPreviewSequences() {
  const textarea = $('target-sequences');
  const content = textarea.value.trim();
  
  if (!content) {
    $('sequences-preview').style.display = 'none';
    return;
  }
  
  // Use core.js parseFASTA function to parse multi-FASTA
  const records = Core.parseFASTA(content);
  
  if (records.length === 0) {
    $('sequences-preview').style.display = 'none';
    return;
  }
  
  // Update count display
  const countDisplay = $('sequences-count');
  countDisplay.textContent = `Loaded Sequences: ${records.length}`;
  
  // Update preview list (but keep it hidden by default)
  const list = $('sequences-list');
  list.innerHTML = records.map((rec, idx) => {
    const name = rec.header || `Sequence ${idx + 1}`;
    const len = rec.seq.length;
    return `<li><strong>${name}</strong> (${len} bp)</li>`;
  }).join('');
  
  $('sequences-preview').style.display = 'flex';
}

/**
 * Handle file upload (target sequences)
 */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Check file size (limit to 1MB)
  const maxSize = 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    showWarning(`File size exceeds the limit of 1MB. Please upload a smaller file.\n\nCurrent file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    event.target.value = ''; // Clear the file input
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    $('target-sequences').value = content;
    parseAndPreviewSequences();
  };
  reader.onerror = function() {
    showWarning('Failed to read file, please try again.');
  };
  reader.readAsText(file);
}

/**
 * Parse designed primer pair file
 * Supported format:
 * >Target1-F
 * ATGC...
 * >Target1-R
 * GCTA...
 * 
 * @param {string} content - File content
 * @returns {Array} Array of primer pairs [{target: {name}, primers: {forward, reverse}}]
 */
function parsePrimerPairs(content) {
  const records = Core.parseFASTA(content);
  if (records.length === 0) {
    throw new Error('Unable to parse primer file, please ensure it is valid FASTA format.');
  }
  
  // Group primers by name (F and R pairing)
  const primerMap = new Map();
  
  for (const rec of records) {
    const header = rec.header.trim();
    if (!header) continue;
    
    // Try multiple patterns to match primer direction
    // Supported formats:
    // - Target1-F, Target1-R (with dash)
    // - Target1_F, Target1_R (with underscore)
    // - Target1F, Target1R (no separator)
    // - Target1-Forward, Target1-Reverse (full words)
    // - Target1_Forward, Target1_Reverse (full words with underscore)
    // - Target1-forward, Target1-reverse (lowercase)
    // - Target1-fwd, Target1-rev (abbreviated)
    // - Target1_FWD, Target1_REV (uppercase abbreviated)
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
        pair.forward = rec.seq;
      } else if (direction === 'R') {
        pair.reverse = rec.seq;
      }
    } else {
      // If no recognized pattern, throw error with helpful message
      throw new Error(`Unable to identify primer direction: "${header}". Supported formats: Target1-F/Target1-R, Target1_Forward/Target1_Reverse, Target1-fwd/Target1-rev, or Target1F/Target1R.`);
    }
  }
  
  // Convert to result format
  const primerPairs = [];
  for (const [targetName, pair] of primerMap.entries()) {
    if (!pair.forward || !pair.reverse) {
      throw new Error(`Target ${targetName} is missing forward or reverse primer. Please ensure each primer pair contains both -F and -R primers.`);
    }
    
    // Calculate product length (cannot determine, set to null)
    // For designed primers, we don't know template sequence, so cannot calculate product length
    const productLength = null;
    
    primerPairs.push({
      target: { name: targetName },
      primers: {
        forward: {
          seq: pair.forward,
          len: pair.forward.length,
          tm: tmSaltCorrected(pair.forward),
          gc: gcContent(pair.forward),
          start: 0,
          end: pair.forward.length
        },
        reverse: {
          seq: pair.reverse,
          len: pair.reverse.length,
          tm: tmSaltCorrected(pair.reverse),
          gc: gcContent(pair.reverse),
          start: 0,
          end: pair.reverse.length
        },
        productLength: productLength
      }
    });
  }
  
  if (primerPairs.length === 0) {
    throw new Error('No valid primer pairs found. Please ensure file format is correct.');
  }
  
  return primerPairs;
}

/**
 * Parse and preview designed primer pairs
 */
function parseAndPreviewPrimers() {
  const textarea = $('primer-sequences');
  const content = textarea.value.trim();
  
  if (!content) {
    $('primers-preview').style.display = 'none';
    return;
  }
  
  try {
    const primerPairs = parsePrimerPairs(content);
    
    // Update count display
    const countDisplay = $('primers-count');
    countDisplay.textContent = `Loaded Primer Pairs: ${primerPairs.length}`;
    
    // Update preview list (but keep it hidden by default)
    const list = $('primers-list');
    list.innerHTML = primerPairs.map(pair => {
      const name = pair.target.name;
      const fwdLen = pair.primers.forward.len;
      const revLen = pair.primers.reverse.len;
      return `<li><strong>${name}</strong> - F: ${fwdLen}bp, R: ${revLen}bp</li>`;
    }).join('');
    
    $('primers-preview').style.display = 'flex';
  } catch (error) {
    $('primers-preview').style.display = 'none';
    // Don't show error, let user continue typing
  }
}

/**
 * Handle designed primer pair file upload
 */
function handlePrimerFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Check file size (limit to 1MB)
  const maxSize = 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    showWarning(`File size exceeds the limit of 1MB. Please upload a smaller file.\n\nCurrent file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    event.target.value = ''; // Clear the file input
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    $('primer-sequences').value = content;
    parseAndPreviewPrimers();
  };
  reader.onerror = function() {
    showWarning('Failed to read file, please try again.');
  };
  reader.readAsText(file);
}

/**
 * Handle QC mode analysis (analyze designed primer pairs)
 */
function onQCAnalysisClick() {
  console.log('onQCAnalysisClick called');
  const textarea = $('primer-sequences');
  
  if (!textarea) {
    console.error('primer-sequences textarea not found');
    showWarning('Error: Primer sequences input not found. Please refresh the page.');
    return;
  }
  
  const content = textarea.value.trim();
  
  if (!content) {
    showWarning('Please input or upload designed primer pairs.');
    return;
  }
  
  try {
    console.log('Parsing primer pairs...');
    const primerPairs = parsePrimerPairs(content);
    console.log('Parsed primer pairs:', primerPairs);

    if (!primerPairs || primerPairs.length === 0) {
      showWarning('No valid primer pairs found. Please check the input format.');
      return;
    }

    const warnings = [];
    if (VIZ && VIZ.validateSequenceInput) {
      const allPrimers = [];
      primerPairs.forEach((pair, i) => {
        const f = pair?.primers?.forward?.seq;
        const r = pair?.primers?.reverse?.seq;
        if (f) allPrimers.push({ label: `${pair.target || `Target ${i + 1}`} (F)`, seq: f });
        if (r) allPrimers.push({ label: `${pair.target || `Target ${i + 1}`} (R)`, seq: r });
      });
      warnings.push(...VIZ.validateSequenceInput(allPrimers, 'Primer'));
    }
    if (VIZ && VIZ.validatePerformance) {
      const totalBp = primerPairs.reduce((sum, pair) => {
        const f = pair?.primers?.forward?.seq || '';
        const r = pair?.primers?.reverse?.seq || '';
        return sum + f.length + r.length;
      }, 0);
      warnings.push(...VIZ.validatePerformance(primerPairs.length, totalBp));
    }

    // Convert to primerResults format
    const primerResults = primerPairs.map(pair => ({
      target: pair.target,
      success: true,
      primers: pair.primers,
      offTargetAmplification: [] // Cannot check off-target amplification for designed primers (no template sequence)
    }));

    console.log('Rendering results...');
    const proceed = () => renderResults(primerResults);
    const container = document.getElementById('module-content') || document.body;
    if (warnings.length && VIZ && VIZ.showMWWarnings) {
      VIZ.showMWWarnings(container, warnings, proceed, () => { });
    } else {
      proceed();
    }

  } catch (error) {
    console.error('Error in onQCAnalysisClick:', error);
    showWarning('Failed to parse primer pairs: ' + (error.message || error));
  }
}

// Function to initialize tooltip for a help-icon (must be in global scope)
function initializeTooltip(icon) {
  const tooltip = icon.querySelector('.help-tooltip');
  if (!tooltip) return;
  
  // Skip if already initialized
  if (tooltip.dataset.initialized === 'true') return;
  tooltip.dataset.initialized = 'true';
  
  // Clone tooltip and append to body for proper z-index stacking
  const tooltipClone = tooltip.cloneNode(true);
  tooltipClone.style.display = 'none';
  tooltipClone.style.position = 'fixed';
  tooltipClone.style.zIndex = '999999';
  tooltipClone.id = tooltip.id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  document.body.appendChild(tooltipClone);
  
  icon.addEventListener('mouseenter', (e) => {
    const iconRect = icon.getBoundingClientRect();
    
    // Get tooltip position from original inline styles
    // Try both style property and getAttribute to ensure we get the value
    const styleAttr = tooltip.getAttribute('style') || '';
    const originalTop = tooltip.style.top || (styleAttr.match(/top:\s*([^;]+)/)?.[1]?.trim() || '');
    const originalBottom = tooltip.style.bottom || (styleAttr.match(/bottom:\s*([^;]+)/)?.[1]?.trim() || '');
    const originalLeft = tooltip.style.left || (styleAttr.match(/left:\s*([^;]+)/)?.[1]?.trim() || '');
    const originalRight = tooltip.style.right || (styleAttr.match(/right:\s*([^;]+)/)?.[1]?.trim() || '');
    
    // Temporarily show to measure
    tooltipClone.style.display = 'block';
    tooltipClone.style.visibility = 'hidden';
    const tooltipRect = tooltipClone.getBoundingClientRect();
    
    let top, left;
    let offset = 10; // default offset
    
    // Check if tooltip should appear above (bottom style) or below (top style)
    if (originalBottom && originalBottom.includes('calc')) {
      // Tooltip appears above
      const bottomMatch = originalBottom.match(/calc\(100%\s*\+\s*(\d+)px\)/);
      if (bottomMatch) {
        offset = parseInt(bottomMatch[1]);
        top = iconRect.top - tooltipRect.height - offset;
        left = iconRect.left;
      } else {
        // Fallback: show below
        top = iconRect.bottom + 10;
        left = iconRect.left;
      }
    } else if (originalTop && originalTop.includes('calc')) {
      // Tooltip appears below - this is the case for "Primer Pooling Strategy"
      const topMatch = originalTop.match(/calc\(100%\s*\+\s*(\d+)px\)/);
      if (topMatch) {
        offset = parseInt(topMatch[1]);
        top = iconRect.bottom + offset;
        if (originalRight === '0') {
          left = iconRect.right - tooltipRect.width;
        } else {
          left = iconRect.left;
        }
      } else {
        // Fallback: show below
        top = iconRect.bottom + 10;
        left = iconRect.left;
      }
    } else {
      // Default: show below icon
      top = iconRect.bottom + 10;
      left = iconRect.left;
    }
    
    // Ensure tooltip doesn't go off screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (left < 0) {
      left = 10;
    }
    // Only move tooltip above if it would go off bottom of screen
    if (top + tooltipRect.height > window.innerHeight) {
      top = iconRect.top - tooltipRect.height - offset;
    }
    if (top < 0) {
      top = 10;
    }
    
    // Ensure tooltip is positioned correctly relative to icon
    tooltipClone.style.top = `${top}px`;
    tooltipClone.style.left = `${left}px`;
    tooltipClone.style.right = 'auto';
    tooltipClone.style.bottom = 'auto';
    tooltipClone.style.position = 'fixed';
    tooltipClone.style.visibility = 'visible';
    tooltipClone.style.opacity = '1';
    tooltipClone.style.display = 'block';
  });
  
  icon.addEventListener('mouseleave', () => {
    tooltipClone.style.display = 'none';
    tooltipClone.style.opacity = '0';
    tooltipClone.style.visibility = 'hidden';
  });
  
  // Hide original tooltip
  tooltip.style.display = 'none';
}

function renderResults(primerResults) {
  const resultsDiv = $('results');
  const contentDiv = $('results-content');
  contentDiv.innerHTML = '';
  
  if (!primerResults || primerResults.length === 0) {
    contentDiv.innerHTML = '<p>No primers designed.</p>';
    resultsDiv.classList.add('show');
    return;
  }
  
  // Check for failed designs
  const failed = primerResults.filter(r => !r.success);
  if (failed.length > 0) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'info-box';
    errorDiv.style.background = '#fef2f2';
    errorDiv.style.borderLeftColor = '#dc2626';
    errorDiv.innerHTML = `<strong>Warning:</strong> Unable to design primers for the following target sequences:<ul>${failed.map(f => `<li>${f.target.name}: ${f.error}</li>`).join('')}</ul>`;
    contentDiv.appendChild(errorDiv);
  }
  
  // Check off-target amplification (only when template sequences are available)
  const hasTemplateSequences = primerResults.some(r => r.success && r.offTargetAmplification !== undefined);
  if (hasTemplateSequences) {
    const offTargetWarnings = [];
    for (const result of primerResults) {
      if (result.success && result.offTargetAmplification && result.offTargetAmplification.length > 0) {
        const warnings = result.offTargetAmplification.map(off => {
          const ampliconInfo = off.amplicons.map(amp => `${amp.length}bp`).join(', ');
          return `Primer pair for ${result.target.name} may produce off-target amplicons on <strong>${off.targetName}</strong> (${ampliconInfo})`;
        });
        offTargetWarnings.push(...warnings);
      }
    }
    
    if (offTargetWarnings.length > 0) {
      const warningDiv = document.createElement('div');
      warningDiv.className = 'info-box';
      warningDiv.style.background = '#fff7ed';
      warningDiv.style.borderLeftColor = '#f59e0b';
      warningDiv.innerHTML = `<strong>⚠️ Off-Target Amplification Warning:</strong> The following primer pairs may produce amplicons on non-target sequences, which may cause multiplex PCR failure or confusing gel bands:<ul>${offTargetWarnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
      contentDiv.appendChild(warningDiv);
    }
  } else {
    // Designed primer mode: show info message
    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-box';
    infoDiv.style.background = '#eff6ff';
    infoDiv.style.borderLeftColor = '#3b82f6';
    infoDiv.innerHTML = `<strong>ℹ️ Designed Primer Mode:</strong> Currently analyzing uploaded primer pairs. Off-target amplification check is not available due to lack of template sequence information. Only primer quality check (QC) and pooling analysis are performed.`;
    contentDiv.appendChild(infoDiv);
  }
  
  const successful = primerResults.filter(r => r.success);
  if (successful.length === 0) {
    resultsDiv.classList.add('show');
    return;
  }
  
  // Display primer table
  const table = document.createElement('table');
  table.className = 'results-table';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Target</th>
      <th>Primer</th>
      <th>Sequence (5'→3')</th>
      <th>Length</th>
      <th>GC%</th>
      <th>Tm (°C)</th>
      <th>Homopolymer</th>
      <th>Hairpin</th>
      <th>Self-Dimer</th>
      <th>Cross-Dimer</th>
      <th>Off-Target</th>
    </tr>
  `;
  
  // Check if product length information is available
  const hasProductLength = successful.some(r => r.primers && r.primers.productLength !== null && r.primers.productLength !== undefined);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('na-conc').value) || 50;
  const mg_mM = parseFloat($('mg-conc').value) || 0;
  
  for (const result of successful) {
    const targetName = result.target.name;
    const primers = result.primers;
    
    // Forward primer
    const fwdQC = runPrimerQC(primers.forward.seq, conc_nM, na_mM, mg_mM);
    const fwdQCLabel = getQCLabel(fwdQC);
    
    // Check cross-dimer conflicts with other primer pairs
    let crossDimerBadge = '';
    let worstCrossDimerDG = null;
    let worstCrossDimerTarget = null;
    
    for (const otherResult of successful) {
      if (otherResult === result) continue; // Skip self
      
      // Check all cross combinations between this pair and other pair
      const combinations = [
        [primers.forward.seq, otherResult.primers.forward.seq],
        [primers.forward.seq, otherResult.primers.reverse.seq],
        [primers.reverse.seq, otherResult.primers.forward.seq],
        [primers.reverse.seq, otherResult.primers.reverse.seq]
      ];
      
      for (const [seqA, seqB] of combinations) {
        const dG = getCrossDimerDG(seqA, seqB);
        if (dG !== null && (worstCrossDimerDG === null || dG < worstCrossDimerDG)) {
          worstCrossDimerDG = dG;
          worstCrossDimerTarget = otherResult.target.name;
        }
      }
    }
    
    if (worstCrossDimerDG === null) {
      crossDimerBadge = '<span class="qc-badge qc-ok">None</span>';
    } else {
      // Determine label based on ΔG value
      let label, cls;
      if (worstCrossDimerDG <= -7) {
        label = 'Very Strong';
        cls = 'qc-bad';
      } else if (worstCrossDimerDG <= -5) {
        label = 'Strong';
        cls = 'qc-bad';
      } else if (worstCrossDimerDG <= -3) {
        label = 'Medium';
        cls = 'qc-moderate';
      } else {
        label = 'Weak';
        cls = 'qc-weak';
      }
      const title = worstCrossDimerTarget ? `Cross-dimer with ${worstCrossDimerTarget} (ΔG = ${worstCrossDimerDG.toFixed(1)} kcal/mol)` : `ΔG = ${worstCrossDimerDG.toFixed(1)} kcal/mol`;
      crossDimerBadge = `<span class="qc-badge ${cls}" title="${title}">${label}</span>`;
    }
    
    // Check off-target amplification
    // hasTemplateSequences is calculated earlier in renderResults function (line 1054)
    // It checks if any result has offTargetAmplification !== undefined
    // In QC mode, offTargetAmplification is set to [] (empty array), so !== undefined is true
    // But we need to distinguish: in QC mode it's [] because we CAN'T check, in design mode it's [] because we checked and found nothing
    // The key difference: in design mode, offTargetAmplification is set by checkOffTargetAmplification function
    // In QC mode, it's explicitly set to [] in onQCAnalysisClick
    // Actually, the hasTemplateSequences check at line 1054 uses !== undefined, which will be true for both cases
    // So we need a different approach: check if we're actually in QC mode by looking at the mode radio button
    const isQCMode = document.getElementById('mode-qc')?.checked || false;
    const offTargetInfo = result.offTargetAmplification || [];
    let offTargetBadge = '';
    if (isQCMode || !hasTemplateSequences) {
      // QC mode: cannot check off-target amplification
      offTargetBadge = '<span class="qc-badge" style="background: #e5e7eb; color: #6b7280;">Unknown</span>';
    } else if (offTargetInfo.length > 0) {
      const offTargetNames = offTargetInfo.map(off => off.targetName).join(', ');
      offTargetBadge = `<span class="qc-badge qc-bad" title="May produce off-target amplification on: ${offTargetNames}">⚠️ ${offTargetInfo.length}</span>`;
    } else {
      offTargetBadge = '<span class="qc-badge qc-ok">None</span>';
    }
    
    const fwdTr = document.createElement('tr');
    fwdTr.innerHTML = `
      <td rowspan="2" class="target-name" style="text-align: left; vertical-align: middle;">${targetName}</td>
      <td style="text-align: center;"><strong>${targetName}-F</strong></td>
      <td class="mono" style="text-align: left;"><code style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${primers.forward.seq}</code></td>
      <td style="text-align: center;">${primers.forward.len}</td>
      <td style="text-align: center;">${primers.forward.gc.toFixed(1)}%</td>
      <td style="text-align: center;">${primers.forward.tm.toFixed(1)}</td>
      <td style="text-align: center;"><span class="qc-badge ${fwdQCLabel.homo.cls}">${fwdQCLabel.homo.label}</span></td>
      <td style="text-align: center;"><span class="qc-badge ${fwdQCLabel.hp.cls}">${fwdQCLabel.hp.label}</span></td>
      <td style="text-align: center;"><span class="qc-badge ${fwdQCLabel.sd.cls}">${fwdQCLabel.sd.label}</span></td>
      <td rowspan="2" style="text-align:center; vertical-align:middle;">${crossDimerBadge}</td>
      <td rowspan="2" style="text-align:center; vertical-align:middle;">${offTargetBadge}</td>
    `;
    tbody.appendChild(fwdTr);
    
    // Reverse primer
    const revQC = runPrimerQC(primers.reverse.seq, conc_nM, na_mM, mg_mM);
    const revQCLabel = getQCLabel(revQC);
    
    const revTr = document.createElement('tr');
    revTr.innerHTML = `
      <td style="text-align: center;"><strong>${targetName}-R</strong></td>
      <td class="mono" style="text-align: left;"><code style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${primers.reverse.seq}</code></td>
      <td style="text-align: center;">${primers.reverse.len}</td>
      <td style="text-align: center;">${primers.reverse.gc.toFixed(1)}%</td>
      <td style="text-align: center;">${primers.reverse.tm.toFixed(1)}</td>
      <td style="text-align: center;"><span class="qc-badge ${revQCLabel.homo.cls}">${revQCLabel.homo.label}</span></td>
      <td style="text-align: center;"><span class="qc-badge ${revQCLabel.hp.cls}">${revQCLabel.hp.label}</span></td>
      <td style="text-align: center;"><span class="qc-badge ${revQCLabel.sd.cls}">${revQCLabel.sd.label}</span></td>
    `;
    tbody.appendChild(revTr);
  }
  
  table.appendChild(tbody);
  contentDiv.appendChild(table);
  
  // Primer pooling analysis
  let poolingResult = null;
  if (successful.length > 1) {
    const primerPairs = successful.map(r => ({
      target: r.target,
      primers: r.primers,
      offTargetAmplification: r.offTargetAmplification || [] // Include off-target amplification info for pooling
    }));
    
    // Get size tolerance parameter (from UI or use default)
    // In QC mode (no product length info), set to 0 to disable size-based pooling
    const hasProductLength = successful.some(r => r.primers && r.primers.productLength !== null && r.primers.productLength !== undefined);
    let sizeTolerance = parseFloat($('size-tolerance')?.value) || 20;
    if (!hasProductLength) {
      // QC mode: no product length info, disable size-based pooling
      sizeTolerance = 0;
    }
    
    poolingResult = poolPrimers(primerPairs, {
      conflictThreshold: -6, // ΔG < -6 kcal/mol considered severe conflict
      sizeTolerance: sizeTolerance // Product size difference < sizeTolerance bp considered conflict, 0 means disabled
    });
    
    const poolingDiv = document.createElement('div');
    poolingDiv.style.marginTop = '24px';
    poolingDiv.style.position = 'relative';
    poolingDiv.style.overflow = 'visible';
    
    // Check if in QC mode (no product length info) - need this for tooltip content
    const hasTemplateSequences = successful.some(r => r.success && r.offTargetAmplification !== undefined && r.offTargetAmplification.length >= 0);
    const isQCMode = !hasTemplateSequences || !successful.some(r => r.success && r.offTargetAmplification && Array.isArray(r.offTargetAmplification));
    
    // Build tooltip content (general explanation, QC limitations shown in warning box below)
    let tooltipContent = '<p style="margin: 0 0 8px 0;">Primers are divided into multiple pools based on three types of conflicts:</p>';
    tooltipContent += '<p style="margin: 0 0 8px 0;"><strong>1. Cross-dimer conflicts:</strong> Strong thermodynamic interactions between primers (ΔG ≤ -6 kcal/mol) can lead to primer-dimer formation, consuming primers and causing amplification failure.</p>';
    tooltipContent += '<p style="margin: 0 0 8px 0;"><strong>2. Product size conflicts:</strong> PCR products with similar sizes (difference < size tolerance) may not be distinguishable on gel electrophoresis, requiring separation into different pools.</p>';
    tooltipContent += '<p style="margin: 0 0 8px 0;"><strong>3. Off-target amplification conflicts:</strong> Multiple primer pairs that can amplify on the same non-target sequence would produce overlapping bands on gel electrophoresis, making it difficult to distinguish target products. These pairs must be separated into different pools.</p>';
    
    if (!hasProductLength || isQCMode) {
      // QC mode: add brief note in tooltip (detailed info shown in warning box)
      tooltipContent += '<p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #f59e0b;"><strong>Note:</strong> In QC mode, size-based pooling and off-target amplification checks are limited. See warning box below for details.</p>';
    }
    
    // Create title with help icon - use CSS hover instead of JavaScript for simpler tooltip
    poolingDiv.innerHTML = `
      <h3 style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        Primer Pooling Strategy
        <span class="help-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
          <span style="display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 50%; background: #6b7280; color: white; font-size: 0.7rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">?</span>
          <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); left: 0; width: 400px; padding: 12px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.5; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 999999 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
            ${tooltipContent}
            <span style="position: absolute; top: -6px; left: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
          </span>
        </span>
      </h3>
    `;
    
    // Note: Tooltip will use CSS :hover defined in HTML - no JavaScript initialization needed for this one
    
    if (poolingResult.poolCount === 1) {
      const successBox = document.createElement('div');
      successBox.className = 'info-box';
      successBox.style.background = '#d1fae5';
      successBox.style.borderLeftColor = '#10b981';
      successBox.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <strong>✓ All primers can be placed in the same reaction tube</strong>
            <p style="margin: 8px 0 0 0; font-size: 0.85rem;">No severe cross-dimer conflicts or product size conflicts detected, single-tube multiplex PCR is possible.</p>
          </div>
          ${!hasProductLength || isQCMode ? `
          <span class="help-icon qc-warning-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0; margin-top: 2px;">
            <span style="display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 50%; background: #f59e0b; color: white; font-size: 0.7rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">!</span>
            <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); right: 0; width: 400px; padding: 12px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.5; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 999999 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
              <p style="margin: 0 0 8px 0;"><strong>⚠️ QC Mode Limitations:</strong></p>
              <p style="margin: 0 0 8px 0;"><strong>1. Size-based pooling:</strong> Size-based pooling is disabled in QC mode. In QC mode, no PCR product length information is available. The pooling strategy is based solely on thermodynamic parameters (cross-dimer conflicts). PCR products may not be distinguishable based on size on gel electrophoresis. If products have similar sizes, they may not be distinguishable even if they are in the same pool.</p>
              <p style="margin: 0;"><strong>2. Off-target amplification:</strong> Off-target amplification check is not available in QC mode. In design mode, the tool checks for potential non-specific amplification products on non-target sequences. In QC mode, this analysis cannot be performed because template sequences are not provided.</p>
              <span style="position: absolute; top: -6px; right: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
            </span>
          </span>
          ` : ''}
        </div>
      `;
      poolingDiv.appendChild(successBox);
      
      // Note: Tooltip will use CSS :hover defined in HTML - no JavaScript initialization needed
      
      // Add download button for single pool
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-primary';
      downloadBtn.style.marginTop = '12px';
      downloadBtn.textContent = 'Download Primers (FASTA)';
      downloadBtn.onclick = () => {
        downloadPrimersByPool(poolingResult.combinedPools);
      };
      poolingDiv.appendChild(downloadBtn);
    } else {
      // Collect pooling reasons first
      const reasons = [];
      
      if (poolingResult.thermodynamicPools.length > 1) {
        reasons.push('Severe cross-dimer conflicts detected (ΔG ≤ -6 kcal/mol), separation needed to avoid primer consumption and amplification failure');
      }
      
      const sizeTolerance = parseFloat($('size-tolerance')?.value) || 20;
      if (sizeTolerance > 0 && poolingResult.sizePools && poolingResult.sizePools.length > 1) {
        if (poolingResult.sizePools.length >= poolingResult.thermodynamicPools.length) {
          reasons.push(`Some products have similar sizes (difference < ${sizeTolerance}bp), may not be distinguishable in gel electrophoresis, need separation into different reaction pools`);
        } else if (poolingResult.thermodynamicPools.length === 1) {
          // If no thermodynamic conflict but size conflict exists
          reasons.push(`Some products have similar sizes (difference < ${sizeTolerance}bp), may not be distinguishable in gel electrophoresis, need separation into different reaction pools`);
        }
      }
      
      // Check for off-target amplification conflicts
      // Check if any primer pairs have off-target amplification on the same non-target sequence
      const hasOffTargetConflicts = successful.some((r1, i) => {
        if (!r1.success || !r1.offTargetAmplification || r1.offTargetAmplification.length === 0) return false;
        const offTargetNames1 = new Set(r1.offTargetAmplification.map(off => off.targetName));
        return successful.some((r2, j) => {
          if (i >= j || !r2.success || !r2.offTargetAmplification || r2.offTargetAmplification.length === 0) return false;
          const offTargetNames2 = new Set(r2.offTargetAmplification.map(off => off.targetName));
          // Check if they share any common off-target sequences
          for (const name of offTargetNames1) {
            if (offTargetNames2.has(name)) return true;
          }
          return false;
        });
      });
      
      if (hasOffTargetConflicts) {
        reasons.push('Off-target amplification conflicts detected (multiple primer pairs can amplify on the same non-target sequence), separation needed to avoid confusing gel bands and multiplex PCR failure');
      }
      
      // Display warning box with QC mode help icon if applicable
      const warningBox = document.createElement('div');
      warningBox.className = 'info-box';
      warningBox.style.background = '#fff7ed';
      warningBox.style.borderLeftColor = '#f59e0b';
      warningBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1;">
            <strong>⚠️ Need to divide into ${poolingResult.poolCount} reaction pools</strong>
            ${reasons.length > 0 ? `<p style="margin: 8px 0 0 0; font-size: 0.85rem;"><strong>Pooling Reasons:</strong> ${reasons.join('; ')}.</p>` : ''}
          </div>
          ${!hasProductLength || isQCMode ? `
          <span class="help-icon qc-warning-icon" style="position: relative; display: inline-block; cursor: help; z-index: 1; flex-shrink: 0;">
            <span style="display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 50%; background: #f59e0b; color: white; font-size: 0.7rem; font-weight: bold; transition: background 0.2s; position: relative; z-index: 1;">!</span>
            <span class="help-tooltip" style="position: absolute; top: calc(100% + 10px); right: 0; width: 400px; padding: 12px; background: #1f2937; color: #fff; border-radius: 8px; font-size: 0.85rem; line-height: 1.5; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s; z-index: 999999 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; white-space: normal;">
              <p style="margin: 0 0 8px 0;"><strong>⚠️ QC Mode Limitations:</strong></p>
              <p style="margin: 0 0 8px 0;"><strong>1. Size-based pooling:</strong> Size-based pooling is disabled in QC mode. In QC mode, no PCR product length information is available. The pooling strategy is based solely on thermodynamic parameters (cross-dimer conflicts). PCR products may not be distinguishable based on size on gel electrophoresis. If products have similar sizes, they may not be distinguishable even if they are in the same pool.</p>
              <p style="margin: 0;"><strong>2. Off-target amplification:</strong> Off-target amplification check is not available in QC mode. In design mode, the tool checks for potential non-specific amplification products on non-target sequences. In QC mode, this analysis cannot be performed because template sequences are not provided.</p>
              <span style="position: absolute; top: -6px; right: 20px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;"></span>
            </span>
          </span>
          ` : ''}
        </div>
      `;
      poolingDiv.appendChild(warningBox);
      
      // Note: Tooltip will use CSS :hover defined in HTML - no JavaScript initialization needed
      
      // Display pooling details
      const poolsTable = document.createElement('table');
      poolsTable.className = 'results-table';
      poolsTable.style.marginTop = '12px';
      const poolsThead = document.createElement('thead');
      poolsThead.innerHTML = `
        <tr>
          <th>Reaction Pool</th>
          <th>Target Sequence</th>
          <th>Product Size (bp)</th>
          <th>Primer Pair</th>
        </tr>
      `;
      poolsTable.appendChild(poolsThead);
      
      const poolsTbody = document.createElement('tbody');
      for (let i = 0; i < poolingResult.combinedPools.length; i++) {
        const pool = poolingResult.combinedPools[i];
        for (let j = 0; j < pool.length; j++) {
          const item = pool[j];
          const tr = document.createElement('tr');
          const rowspan = j === 0 ? pool.length : 0;
          tr.innerHTML = `
            ${j === 0 ? `<td rowspan="${rowspan}" style="text-align:center; vertical-align:middle; font-weight:600; background:#f8f9fa;">Pool ${i + 1}</td>` : ''}
            <td>${item.target}</td>
            <td style="text-align:center;">${item.primers.productLength}</td>
            <td class="mono" style="font-size:0.75rem;">
              <div><strong>${item.target}-F:</strong> ${item.primers.forward.seq}</div>
              <div><strong>${item.target}-R:</strong> ${item.primers.reverse.seq}</div>
            </td>
          `;
          poolsTbody.appendChild(tr);
        }
      }
      poolsTable.appendChild(poolsTbody);
      poolingDiv.appendChild(poolsTable);
      
      // Add download button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-primary';
      downloadBtn.style.marginTop = '12px';
      downloadBtn.textContent = 'Download Primers by Pool (FASTA)';
      downloadBtn.onclick = () => {
        downloadPrimersByPool(poolingResult.combinedPools);
      };
      poolingDiv.appendChild(downloadBtn);
      
      if (sizeTolerance === 0) {
        const noteDiv = document.createElement('div');
        noteDiv.style.marginTop = '8px';
        noteDiv.style.fontSize = '0.85rem';
        noteDiv.style.color = '#6b7280';
        noteDiv.style.fontStyle = 'italic';
        if (!hasProductLength) {
          noteDiv.innerHTML = `<strong>Note:</strong> No product length information is available, size-based pooling is disabled. Primers cannot be distinguished based on size on gel electrophoresis. Pooling is based only on thermodynamic parameters (cross-dimer conflicts).`;
        } else {
          noteDiv.innerHTML = `<strong>Note:</strong> Size-based pooling is currently disabled (size tolerance = 0), pooling is based only on thermodynamic parameters.`;
        }
        poolingDiv.appendChild(noteDiv);
      }
    }
    
    contentDiv.appendChild(poolingDiv);
  }
  
  // Display primer-primer dimer matrix (heatmap)
  // Build full matrix first
  const fullDimerMatrix = buildDimerMatrix(successful);
  
  // Create a helper function to render a heatmap for a specific set of primers
  function renderHeatmapForPrimers(primers, title) {
    if (primers.length === 0) return null;
    
    // Build matrix for these primers only
    const primerIndexMap = new Map();
    fullDimerMatrix.primers.forEach((p, idx) => {
      primerIndexMap.set(p, idx);
    });
    
    const matrix = [];
    for (let i = 0; i < primers.length; i++) {
      const rowLabel = primers[i];
      const oldRowIdx = primerIndexMap.get(rowLabel);
      const row = [rowLabel];
      
      for (let j = 0; j < primers.length; j++) {
        const colLabel = primers[j];
        const oldColIdx = primerIndexMap.get(colLabel);
        if (i === j) {
          row.push({ dG: null, label: '-', isDiagonal: true, color: '#e5e7eb' });
        } else {
          row.push(fullDimerMatrix.matrix[oldRowIdx][oldColIdx + 1]); // +1 because first element is label
        }
      }
      matrix.push(row);
    }
    
    const matrixDiv = document.createElement('div');
    matrixDiv.className = 'dimer-matrix';
    matrixDiv.style.marginTop = '20px';
    matrixDiv.innerHTML = `<h3 style="margin-bottom: 12px;">${title}</h3>`;
    
    const matrixTable = document.createElement('table');
    matrixTable.style.borderCollapse = 'collapse';
    const matrixThead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th style="min-width: 100px;"></th>' + primers.map(p => `<th style="min-width: 80px; font-size: 0.7rem;">${p}</th>`).join('');
    matrixThead.appendChild(headerRow);
    matrixTable.appendChild(matrixThead);
    
    const matrixTbody = document.createElement('tbody');
    for (const row of matrix) {
      const tr = document.createElement('tr');
      tr.innerHTML = row.map((cell, idx) => {
        if (idx === 0) {
          return `<td style="font-size: 0.7rem;"><strong>${cell}</strong></td>`;
        } else {
          const isDiagonal = cell.isDiagonal;
          const bgColor = isDiagonal ? '#e5e7eb' : cell.color;
          const title = isDiagonal ? 'Self-interaction (ignored)' : 
                       cell.dG !== null ? `ΔG = ${cell.dG} kcal/mol (${cell.label})` : 'No interaction';
          
          return `<td class="heatmap-cell ${isDiagonal ? 'diagonal' : ''}" 
                         style="background-color: ${bgColor};" 
                         title="${title}">
                    ${isDiagonal ? '' : ''}
                  </td>`;
        }
      }).join('');
      matrixTbody.appendChild(tr);
    }
    matrixTable.appendChild(matrixTbody);
    matrixDiv.appendChild(matrixTable);
    
    // Add legend (only for the first heatmap)
    return matrixDiv;
  }
  
  // Render heatmaps based on pooling
  if (poolingResult && poolingResult.poolCount > 1) {
    // Render separate heatmap for each pool
    for (let i = 0; i < poolingResult.combinedPools.length; i++) {
      const pool = poolingResult.combinedPools[i];
      const poolPrimers = [];
      
      for (const item of pool) {
        poolPrimers.push(`${item.target}-F`, `${item.target}-R`);
      }
      
      const heatmapDiv = renderHeatmapForPrimers(poolPrimers, `Primer-Primer Dimer Matrix - Pool ${i + 1}`);
      if (heatmapDiv) {
        contentDiv.appendChild(heatmapDiv);
      }
    }
    
    // Add legend once at the end
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
      <div style="font-weight: 600;">Legend:</div>
      <div class="heatmap-legend-items">
        <div class="heatmap-legend-item">
          <div class="heatmap-legend-color" style="background: rgb(250, 250, 250);"></div>
          <span>None/Weak (ΔG > -3)</span>
        </div>
        <div class="heatmap-legend-item">
          <div class="heatmap-legend-color" style="background: rgb(255, 255, 200);"></div>
          <span>Medium (-5 < ΔG ≤ -3)</span>
        </div>
        <div class="heatmap-legend-item">
          <div class="heatmap-legend-color" style="background: rgb(255, 200, 100);"></div>
          <span>Strong (-7 < ΔG ≤ -5)</span>
        </div>
        <div class="heatmap-legend-item">
          <div class="heatmap-legend-color" style="background: rgb(200, 50, 0);"></div>
          <span>Very Strong (ΔG ≤ -7)</span>
        </div>
        <div class="heatmap-legend-item" style="margin-left: auto;">
          <span style="font-size: 0.75rem; color: #6b7280;">Hover to view detailed ΔG value</span>
        </div>
      </div>
    `;
    contentDiv.appendChild(legend);
  } else {
    // Single heatmap for all primers (no pooling or single pool)
    if (fullDimerMatrix.primers.length > 0) {
      const heatmapDiv = renderHeatmapForPrimers(fullDimerMatrix.primers, 'Primer-Primer Dimer Matrix (Heatmap)');
      if (heatmapDiv) {
        contentDiv.appendChild(heatmapDiv);
        
        // Add legend
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
          <div style="font-weight: 600;">Legend:</div>
          <div class="heatmap-legend-items">
            <div class="heatmap-legend-item">
              <div class="heatmap-legend-color" style="background: rgb(250, 250, 250);"></div>
              <span>None/Weak (ΔG > -3)</span>
            </div>
            <div class="heatmap-legend-item">
              <div class="heatmap-legend-color" style="background: rgb(255, 255, 200);"></div>
              <span>Medium (-5 < ΔG ≤ -3)</span>
            </div>
            <div class="heatmap-legend-item">
              <div class="heatmap-legend-color" style="background: rgb(255, 200, 100);"></div>
              <span>Strong (-7 < ΔG ≤ -5)</span>
            </div>
            <div class="heatmap-legend-item">
              <div class="heatmap-legend-color" style="background: rgb(200, 50, 0);"></div>
              <span>Very Strong (ΔG ≤ -7)</span>
            </div>
            <div class="heatmap-legend-item" style="margin-left: auto;">
              <span style="font-size: 0.75rem; color: #6b7280;">Hover to view detailed ΔG value</span>
            </div>
          </div>
        `;
        contentDiv.appendChild(legend);
      }
    }
  }
  
  resultsDiv.classList.add('show');
}

function onDesignClick() {
  try {
    const textarea = $('target-sequences');
    if (!textarea) {
      showWarning('Error: Target sequences textarea not found.');
      console.error('Target sequences textarea not found');
      return;
    }
    
    const content = textarea.value.trim();
    
    if (!content) {
      showWarning('Please input or upload target sequences.');
      return;
    }
    
    // Use core.js parseFASTA function to parse multi-FASTA
    const records = Core.parseFASTA(content);
    
    if (records.length === 0) {
      showWarning('Unable to parse sequences, please ensure input is valid FASTA format.');
      return;
    }
    
    // Convert to targets array
    const targets = records.map((rec, idx) => {
      const name = rec.header || `Target ${idx + 1}`;
      return {
        name: name,
        seq: rec.seq,
        expectedLength: null  // Multi-FASTA input does not support expected length
      };
    });
    
    if (targets.length < 1) {
      showWarning('Please add at least 1 target sequence.');
      return;
    }
    
    const targetTm = parseFloat($('target-tm').value) || 60;
    const conc_nM = parseFloat($('primer-conc').value) || 500;
    const na_mM = parseFloat($('na-conc').value) || 50;
    const mg_mM = parseFloat($('mg-conc').value) || 0;
    const overlapSeqFwd = ($('overlap-seq-fwd').value || '').trim();
    const overlapSeqRev = ($('overlap-seq-rev').value || '').trim();

    const warnings = [];
    if (VIZ && VIZ.validateSequenceInput) {
      warnings.push(...VIZ.validateSequenceInput(
        targets.map(t => ({ label: t.name, seq: t.seq })),
        'Target'
      ));
    }
    if (VIZ && VIZ.validateParameterRange) {
      warnings.push(...VIZ.validateParameterRange({ Na: na_mM, Mg: mg_mM, conc: conc_nM, targetTm }));
    }
    if (VIZ && VIZ.validateOverlapLength) {
      if (overlapSeqFwd) warnings.push(...VIZ.validateOverlapLength(overlapSeqFwd.length, 15, 40).map(w => ({ id: 'MPX-F-OVERLAP', message: w.message })));
      if (overlapSeqRev) warnings.push(...VIZ.validateOverlapLength(overlapSeqRev.length, 15, 40).map(w => ({ id: 'MPX-R-OVERLAP', message: w.message })));
    }
    if (targets.length > 10) {
      warnings.push({
        id: 'MPX-MW-01',
        message:
          `Warning: Large number of targets detected (${targets.length}).\n` +
          "Large multiplex panels may have reduced efficiency and increased primer cross-interactions.\n" +
          "Consider splitting into multiple reactions.\n\n" +
          "Click Cancel to adjust or OK to proceed."
      });
    }
    if (VIZ && VIZ.validatePerformance) {
      const totalBp = targets.reduce((sum, t) => sum + (t.seq?.length || 0), 0);
      warnings.push(...VIZ.validatePerformance(targets.length, totalBp));
    }

    const proceed = () => {
      // Show progress message (for large number of sequences)
      if (targets.length > 5) {
        const resultsDiv = $('results');
        const contentDiv = $('results-content');
        if (!resultsDiv || !contentDiv) {
          showWarning('Error: Results container not found.');
          console.error('Results container not found');
          return;
        }
        resultsDiv.classList.add('show');
        contentDiv.innerHTML = `
          <div class="info-box" style="text-align: center;">
            <p>Designing primers and checking off-target amplification...</p>
            <p style="font-size: 0.85rem; color: #6b7280;">Total ${targets.length} target sequences, estimated time ${Math.ceil(targets.length * targets.length / 10)} seconds</p>
            <p style="font-size: 0.85rem; color: #6b7280;">Please wait, calculation in progress...</p>
          </div>
        `;

        // Use setTimeout to allow UI to update
        setTimeout(() => {
          try {
            performDesign(targets);
          } catch (error) {
            console.error('Error in performDesign:', error);
            showWarning('Error designing primers: ' + (error.message || error));
          }
        }, 50);
      } else {
        try {
          performDesign(targets);
        } catch (error) {
          console.error('Error in performDesign:', error);
          showWarning('Error designing primers: ' + (error.message || error));
        }
      }
    };

    const container = document.getElementById('module-content') || document.body;
    if (warnings.length && VIZ && VIZ.showMWWarnings) {
      VIZ.showMWWarnings(container, warnings, proceed, () => { });
    } else {
      proceed();
    }
  } catch (error) {
    console.error('Error in onDesignClick:', error);
    showWarning('Error: ' + (error.message || error));
  }
}

function performDesign(targets) {
  // Get parameters
  const targetTm = parseFloat($('target-tm').value) || 60;
  const tmTolerance = parseFloat($('tm-tolerance').value) || 5;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('na-conc').value) || 50;
  const mg_mM = parseFloat($('mg-conc').value) || 0;
  const minLen = 15;
  const maxLen = 40;
  const overlapSeqFwd = ($('overlap-seq-fwd').value || '').trim();
  const overlapSeqRev = ($('overlap-seq-rev').value || '').trim();
  
  const opts = {
    targetTm: targetTm,
    tmTolerance: tmTolerance,
    conc_nM: conc_nM,
    na_mM: na_mM,
    mg_mM: mg_mM,
    minLen: minLen,
    maxLen: maxLen,
    overlapSeqFwd: overlapSeqFwd || undefined,  // Only include if provided
    overlapSeqRev: overlapSeqRev || undefined,  // Only include if provided
    checkOffTarget: true  // Enable off-target amplification check
  };
  
  try {
    const startTime = performance.now();
    const primerResults = designMultiplexPrimers(targets, opts);
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`Primer design completed, took ${duration} seconds`);
    
    renderResults(primerResults);
  } catch (e) {
    console.error(e);
    showWarning('Error designing primers: ' + (e.message || e));
  }
}

// ==================== Initialization ====================

function initMultiplexPCRModule(container) {
  // Use container if provided, otherwise use document
  // Use querySelector to search within container first, then fallback to getElementById
  const $ = (id) => {
    if (container) {
      const el = container.querySelector(`#${id}`);
      if (el) return el;
    }
    return document.getElementById(id);
  };
  
  // If container is provided, ensure all queries are scoped to it
  if (!container) {
    container = document;
  }
  // 模式切换
  const modeDesign = $('mode-design');
  const modeQC = $('mode-qc');
  const designModeContent = $('design-mode-content');
  const qcModeContent = $('qc-mode-content');
  
  function switchMode() {
    if (modeDesign.checked) {
      designModeContent.style.display = 'block';
      qcModeContent.style.display = 'none';
      $('design-btn').textContent = 'Design Primers';
      // Restore size tolerance to default if it was set to 0 in QC mode
      const sizeToleranceInput = $('size-tolerance');
      if (sizeToleranceInput && sizeToleranceInput.value === '0') {
        sizeToleranceInput.value = '20';
      }
      // Hide QC mode warning if exists
      const qcWarning = $('qc-size-tolerance-warning');
      if (qcWarning) {
        qcWarning.style.display = 'none';
      }
    } else {
      designModeContent.style.display = 'none';
      qcModeContent.style.display = 'block';
      $('design-btn').textContent = 'Analyze Primers';
      // Set size tolerance to 0 in QC mode
      const sizeToleranceInput = $('size-tolerance');
      if (sizeToleranceInput) {
        sizeToleranceInput.value = '0';
      }
    }
  }
  
  
  modeDesign.addEventListener('change', switchMode);
  modeQC.addEventListener('change', switchMode);
  
  // Toggle sequences list visibility
  const toggleSequencesBtn = $('toggle-sequences-btn');
  const sequencesListContainer = $('sequences-list-container');
  if (toggleSequencesBtn && sequencesListContainer) {
    toggleSequencesBtn.addEventListener('click', () => {
      const isVisible = sequencesListContainer.style.display !== 'none';
      if (isVisible) {
        sequencesListContainer.style.display = 'none';
        toggleSequencesBtn.textContent = 'Show Details';
      } else {
        sequencesListContainer.style.display = 'block';
        toggleSequencesBtn.textContent = 'Hide Details';
      }
    });
  }
  
  // Toggle primers list visibility
  const togglePrimersBtn = $('toggle-primers-btn');
  const primersListContainer = $('primers-list-container');
  if (togglePrimersBtn && primersListContainer) {
    togglePrimersBtn.addEventListener('click', () => {
      const isVisible = primersListContainer.style.display !== 'none';
      if (isVisible) {
        primersListContainer.style.display = 'none';
        togglePrimersBtn.textContent = 'Show Details';
      } else {
        primersListContainer.style.display = 'block';
        togglePrimersBtn.textContent = 'Hide Details';
      }
    });
  }
  
  // Fix tooltip positioning: clone to body for proper z-index stacking
  document.querySelectorAll('.help-icon').forEach(icon => {
    initializeTooltip(icon);
  });

  // Target sequence file upload button
  const uploadBtn = $('upload-btn');
  const fileInput = $('fasta-upload');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', handleFileUpload);
  } else {
    console.warn('Upload button or file input not found for target sequences');
  }
  
  // Designed primer pair file upload button
  const uploadPrimerBtn = $('upload-primer-btn');
  const primerFileInput = $('primer-upload');
  
  if (uploadPrimerBtn && primerFileInput) {
    uploadPrimerBtn.addEventListener('click', () => {
      primerFileInput.click();
    });
    
    primerFileInput.addEventListener('change', handlePrimerFileUpload);
  } else {
    console.warn('Upload button or file input not found for primer sequences');
  }
  
  // Update preview when textarea changes
  const targetTextarea = $('target-sequences');
  targetTextarea.addEventListener('input', parseAndPreviewSequences);
  
  const primerTextarea = $('primer-sequences');
  primerTextarea.addEventListener('input', parseAndPreviewPrimers);
  
  // Design/Analyze button
  const designBtn = $('design-btn');
  if (!designBtn) {
    console.error('Design button not found! Container:', container);
    // Try to find it in document as fallback
    const fallbackBtn = document.getElementById('design-btn');
    if (fallbackBtn) {
      fallbackBtn.addEventListener('click', () => {
        try {
          if (modeDesign && modeDesign.checked) {
            onDesignClick();
          } else if (modeQC && modeQC.checked) {
            onQCAnalysisClick();
          }
        } catch (error) {
          console.error('Error in design button click handler:', error);
          showWarning('Error: ' + (error.message || error));
        }
      });
    } else {
      showWarning('Error: Design button not found. Please refresh the page.');
    }
  } else {
    console.log('Design button found, attaching event listener');
    designBtn.addEventListener('click', () => {
      console.log('Design button clicked, modeDesign:', modeDesign?.checked, 'modeQC:', modeQC?.checked);
      try {
        if (modeDesign && modeDesign.checked) {
          console.log('Calling onDesignClick');
          onDesignClick();
        } else if (modeQC && modeQC.checked) {
          console.log('Calling onQCAnalysisClick');
          onQCAnalysisClick();
        } else {
          console.warn('Neither mode is checked');
        }
      } catch (error) {
        console.error('Error in design button click handler:', error);
        showWarning('Error: ' + (error.message || error));
      }
    });
  }
  
  // Clear button
  $('clear-btn').addEventListener('click', () => {
    const resultsDiv = $('results');
    const contentDiv = $('results-content');
    resultsDiv.classList.remove('show');
    resultsDiv.style.display = 'none';
    contentDiv.innerHTML = '';
    $('file-name').textContent = '';
    $('primer-file-name').textContent = '';
  });
  
  // Reset button
  const resetBtn = $('global-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Full page refresh to reset state
      window.location.reload();
    });
  }
  
  // Demo Set button: load demo based on current mode
  const demoSetBtn = $('demo-set-btn');
  if (demoSetBtn) {
    demoSetBtn.addEventListener('click', async () => {
      const modeDesign = $('mode-design');
      const modeQC = $('mode-qc');
      const base = new URL('modules/contents/demo/', window.location.href).toString();
      
      try {
        if (modeDesign && modeDesign.checked) {
          // De Novo Design Mode: load multiplex_fragment.txt
          const textarea = $('target-sequences');
          if (!textarea) return;
          
          const resp = await fetch(base + 'multiplex_fragment.txt');
          if (!resp.ok) {
            alert('Failed to load demo sequence.');
            return;
          }
          const text = await resp.text();
          textarea.value = text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (modeQC && modeQC.checked) {
          // QC Mode: load multiplex_primer_pool.txt
          const textarea = $('primer-sequences');
          if (!textarea) return;
          
          const resp = await fetch(base + 'multiplex_primer_pool.txt');
          if (!resp.ok) {
            alert('Failed to load demo sequence.');
            return;
          }
          const text = await resp.text();
          textarea.value = text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (e) {
        console.error('Demo Set load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  // Target sequences Reverse complement button
  const targetRCBtn = $('target-reverse-complement-btn');
  if (targetRCBtn) {
    targetRCBtn.addEventListener('click', () => {
      const textarea = $('target-sequences');
      if (!textarea || !textarea.value.trim()) return;
      
      const content = textarea.value;
      const records = Core.parseFASTA(content);
      
      if (records.length === 0) {
        // If not FASTA format, just reverse complement the whole thing
        const cleaned = cleanDNA(content);
        if (cleaned) {
          textarea.value = Core.reverseComplementSeq(cleaned);
        }
      } else {
        // FASTA format: reverse complement each sequence, keep headers
        let result = '';
        for (const rec of records) {
          result += `>${rec.header}\n`;
          const rcSeq = Core.reverseComplementSeq(rec.seq);
          // Wrap at 70 characters per line
          for (let i = 0; i < rcSeq.length; i += 70) {
            result += rcSeq.slice(i, i + 70) + '\n';
          }
          result += '\n';
        }
        textarea.value = result.trim();
      }
      
      // Trigger input event to update preview
      textarea.dispatchEvent(new Event('input'));
    });
  }
  
  // Primer sequences Reverse complement button
  const primerRCBtn = $('primer-reverse-complement-btn');
  if (primerRCBtn) {
    primerRCBtn.addEventListener('click', () => {
      const textarea = $('primer-sequences');
      if (!textarea || !textarea.value.trim()) return;
      
      const content = textarea.value;
      const records = Core.parseFASTA(content);
      
      if (records.length === 0) {
        // If not FASTA format, just reverse complement the whole thing
        const cleaned = cleanDNA(content);
        if (cleaned) {
          textarea.value = Core.reverseComplementSeq(cleaned);
        }
      } else {
        // FASTA format: reverse complement each sequence, keep headers
        let result = '';
        for (const rec of records) {
          result += `>${rec.header}\n`;
          const rcSeq = Core.reverseComplementSeq(rec.seq);
          // Wrap at 70 characters per line
          for (let i = 0; i < rcSeq.length; i += 70) {
            result += rcSeq.slice(i, i + 70) + '\n';
          }
          result += '\n';
        }
        textarea.value = result.trim();
      }
      
      // Trigger input event to update preview
      textarea.dispatchEvent(new Event('input'));
    });
  }
  
  // Target sequences Demo button (De Novo Design Mode): load multiplex_fragment.txt
  const targetDemoBtn = $('target-demo-btn');
  if (targetDemoBtn) {
    targetDemoBtn.addEventListener('click', async () => {
      const textarea = $('target-sequences');
      if (!textarea) return;
      
      try {
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        const resp = await fetch(base + 'multiplex_fragment.txt');
        if (!resp.ok) {
          alert('Failed to load demo sequence.');
          return;
        }
        const text = await resp.text();
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        console.error('Target demo load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  // Primer sequences Demo button (QC Mode): load multiplex_primer_pool.txt
  const primerDemoBtn = $('primer-demo-btn');
  if (primerDemoBtn) {
    primerDemoBtn.addEventListener('click', async () => {
      const textarea = $('primer-sequences');
      if (!textarea) return;
      
      try {
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        const resp = await fetch(base + 'multiplex_primer_pool.txt');
        if (!resp.ok) {
          alert('Failed to load demo sequence.');
          return;
        }
        const text = await resp.text();
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        console.error('Primer demo load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  // Initialize mode
  switchMode();
}

// Export for app-main.js
window.initMultiplexPCRModule = initMultiplexPCRModule;

// Auto-initialize if DOMContentLoaded already fired (for standalone mode)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__multiplexPCRInitialized) {
      initMultiplexPCRModule();
      window.__multiplexPCRInitialized = true;
    }
  });
} else {
  // DOM already loaded, but only auto-init if not called by app-main.js
  if (!window.__multiplexPCRInitialized && !document.getElementById('module-content')) {
    initMultiplexPCRModule();
    window.__multiplexPCRInitialized = true;
  }
}
