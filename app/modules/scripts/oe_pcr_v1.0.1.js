// OE-PCR Primer Designer for Multi-Fragment Assembly
// Purpose: Design primers to join multiple DNA fragments together using Overlap Extension PCR

import * as VIZ from './bio_visuals_v1.0.1.js';

/**
 * Show warning modal (similar to QC module)
 */
function showOEPCRWarningModal(container, message, opts = {}) {
  // Create modal if it doesn't exist
  let modal = container.querySelector('#oe-pcr-warning-modal');
  if (!modal) {
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
      #oe-pcr-warning-modal {
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
      .oe-pcr-warning-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .oe-pcr-warning-modal-content {
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
        animation: oePcrModalSlideIn 0.3s ease-out;
      }
      @keyframes oePcrModalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .oe-pcr-warning-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px;
        background: #fff7ed;
        border-bottom: 1px solid #fde68a;
      }
      .oe-pcr-warning-icon {
        font-size: 1.5rem;
        line-height: 1;
      }
      .oe-pcr-warning-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #92400e;
        font-weight: 600;
      }
      .oe-pcr-warning-modal-body {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .oe-pcr-warning-modal-body p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-line;
      }
      .oe-pcr-warning-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      .oe-pcr-warning-modal-footer .btn {
        min-width: 80px;
      }
    `;
    document.head.appendChild(style);
    
    modal = document.createElement('div');
    modal.id = 'oe-pcr-warning-modal';
    modal.style.display = 'none';
    
    const overlay = document.createElement('div');
    overlay.className = 'oe-pcr-warning-modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'oe-pcr-warning-modal-content';
    
    const header = document.createElement('div');
    header.className = 'oe-pcr-warning-modal-header';
    const icon = document.createElement('span');
    icon.className = 'oe-pcr-warning-icon';
    icon.textContent = '⚠️';
    const title = document.createElement('h3');
    title.textContent = 'Warning';
    header.appendChild(icon);
    header.appendChild(title);
    
    const body = document.createElement('div');
    body.className = 'oe-pcr-warning-modal-body';
    const messageP = document.createElement('p');
    messageP.id = 'oe-pcr-warning-message';
    body.appendChild(messageP);
    
    const footer = document.createElement('div');
    footer.className = 'oe-pcr-warning-modal-footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'oe-pcr-warning-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn';
    cancelBtn.style.marginRight = '8px';
    
    const okBtn = document.createElement('button');
    okBtn.id = 'oe-pcr-warning-ok-btn';
    okBtn.textContent = 'OK';
    okBtn.className = 'btn';
    
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    
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
  const messageEl = modal.querySelector('#oe-pcr-warning-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Remove existing listeners and add new ones
  const okBtn = modal.querySelector('#oe-pcr-warning-ok-btn');
  const cancelBtn = modal.querySelector('#oe-pcr-warning-cancel-btn');
  const overlay = modal.querySelector('.oe-pcr-warning-modal-overlay');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  // Clone button to remove old listeners
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  
  newOkBtn.onclick = () => {
    closeModal();
    if (typeof opts.onOk === 'function') opts.onOk();
  };
  newCancelBtn.onclick = () => {
    closeModal();
    if (typeof opts.onCancel === 'function') opts.onCancel();
  };
  
  if (overlay) {
    overlay.onclick = () => {
      closeModal();
      if (typeof opts.onCancel === 'function') opts.onCancel();
    };
  }
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
      if (typeof opts.onCancel === 'function') opts.onCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

import * as Core from './core_v1.0.1.js';
import { CODON_USAGE, getCodonEntries } from './codon_v1.0.1.js';

// ==================== Utility Functions ====================

function $(id) {
  return document.getElementById(id);
}

function cleanDNA(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return Core.normalizeSeq(dnaLines.join(''));
}

// Sanitize AA linker input: keep 20 AA + '*' (stop), ignore whitespace, collect invalid chars
function sanitizeAALinker(raw) {
  const s = String(raw || '').toUpperCase();
  const allowed = new Set('ACDEFGHIKLMNPQRSTVWY*'.split(''));
  let cleaned = '';
  const ignoredCounts = new Map();
  for (const ch of s) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    if (allowed.has(ch)) {
      cleaned += ch;
    } else {
      ignoredCounts.set(ch, (ignoredCounts.get(ch) || 0) + 1);
    }
  }
  const ignoredList = Array.from(ignoredCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ch, n]) => ({ ch, n }));
  const ignoredTotal = ignoredList.reduce((acc, x) => acc + x.n, 0);
  return { cleaned, ignoredList, ignoredTotal };
}

// Extract FASTA header (sequence name) from input
function extractFASTAHeader(seq) {
  if (!seq) return null;
  const lines = String(seq).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      // Remove '>' and return the header (name), take first word only
      return trimmed.substring(1).trim().split(' ')[0] || null;
    }
  }
  return null;
}

function stripFASTAHeaders(seq) {
  if (!seq) return '';
  const lines = String(seq).split(/\r?\n/);
  const dnaLines = lines.filter(line => !line.trim().startsWith('>'));
  return dnaLines.join('\n');
}

// Convert amino acid sequence to DNA using round-robin codon selection
// Similar to CDS mode auto algorithm to avoid repetitive sequences
function aaToDNA(aaSeq, hostCode = 'ecoli') {
  if (!aaSeq || aaSeq.length === 0) return '';
  
  // Remove whitespace and convert to uppercase
  const cleanAA = aaSeq.replace(/\s+/g, '').toUpperCase();
  
  // Track codon usage for each amino acid to implement round-robin
  const aaCodonCounters = new Map();
  let dnaSeq = '';
  
  for (let i = 0; i < cleanAA.length; i++) {
    const aa = cleanAA[i];
    
    // Skip non-amino acid characters
    if (!/[ACDEFGHIKLMNPQRSTVWY*]/.test(aa)) {
      continue;
    }
    
    // Handle stop: '*' -> default TAA
    if (aa === '*') {
      dnaSeq += 'TAA';
      continue;
    }
    
    // Get codon entries for this amino acid
    const entries = getCodonEntries(hostCode, aa);
    if (!entries || entries.length === 0) {
      throw new Error(`No codon usage data for amino acid ${aa} in organism ${hostCode}.`);
    }
    
    // Use top 2-3 preferred codons in round-robin fashion
    // This prevents repetitive sequences like GGTGGTGGTGGT for GGGG
    const topCodonCount = Math.min(3, entries.length);
    const counter = aaCodonCounters.get(aa) || 0;
    const codonEntry = entries[counter % topCodonCount];
    const codon = codonEntry.codon;
    
    // Update counter for this amino acid
    aaCodonCounters.set(aa, counter + 1);
    
    dnaSeq += codon;
  }
  
  return dnaSeq;
}

// Check if input is amino acid sequence (contains only amino acid letters)
function isAminoAcidSequence(input) {
  if (!input) return false;
  const clean = input.replace(/\s+/g, '').toUpperCase();
  // Check if it contains only amino acid letters (and possibly stop codon *)
  return /^[ACDEFGHIKLMNPQRSTVWY*]+$/.test(clean) && clean.length > 0;
}

// Populate host organism select (same as mutagenesis)
function populateHostSelect(selectElement) {
  // If no element provided, try to get the global one (for backward compatibility)
  const select = selectElement || $('host-organism');
  if (!select) return;
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

function revComp(seq) {
  return Core.reverseComplementSeq(seq || "");
}

function tmSaltCorrected(seq, conc_nM = 500, na_mM = 50, mg_mM = 0) {
  return Core.tmcalNN(seq, na_mM, mg_mM, conc_nM);
}

function gcContent(seq) {
  return Core.gcPct(seq || "");
}

// ==================== Overlap Design ====================

// Design optimal overlap region between two fragments
// Strategy similar to mutagenesis DNA edit mode:
// - If linker is long (>= desiredOverlap): overlap is WITHIN the linker (economical)
// - If linker is short (< desiredOverlap): overlap SPANS linker + flanking fragment sequences
function designOverlap(fragment1End, fragment2Start, linker = '', opts = {}) {
  const desiredOverlap = opts.desiredOverlap ?? 20;
  const minOverlapTm = opts.minOverlapTm ?? 55;
  const maxOverlap = opts.maxOverlap ?? 30;  // Cap at 30bp for economy
  const minOverlap = 18;  // Minimum overlap length: 18bp
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  
  const linkerLen = linker.length;
  const minFlank = 8;
  const maxFlank = 12;  // Reduced from 20 to keep overlap shorter
  const minLeftRightPart = 9;  // Minimum length for leftPart/rightPart in long linker strategy
  const maxLeftRightPart = 15;  // Maximum length for leftPart/rightPart in long linker strategy
  
  let best = null;
  let bestScore = Infinity;
  
  // Strategy decision: use long linker strategy only if linker is significantly longer than desired overlap
  // For linker = 18bp: should use SHORT linker strategy (extend from center to fragments)
  // For linker = 30bp+: should use LONG linker strategy (overlap within linker)
  // Note: linkerLen = 0 (no linker) should use SHORT LINKER strategy (which handles empty linker correctly)
  // Threshold: use long strategy only if linker >= 25bp (enough room for overlap + leftPart + rightPart)
  const useLinkerInternalStrategy = linkerLen >= 25;
  
  if (useLinkerInternalStrategy) {
    // LONG LINKER STRATEGY: Overlap is WITHIN the linker (economical)
    // Similar to long replacement in mutagenesis
    // Overlap = fragment1_end (minimal) + linker_middle_part + fragment2_start (minimal)
    // Target: 20-25bp total overlap for economy
    
    const preferredOverlapLen = Math.min(desiredOverlap, linkerLen);
    // minOverlapLen must respect the global minOverlap (18bp)
    const minOverlapLen = Math.max(minOverlap, Math.floor(preferredOverlapLen * 0.7));
    const maxOverlapLen = Math.min(maxOverlap, linkerLen, Math.floor(preferredOverlapLen * 1.2));
    
    // Try different overlap positions within linker, prefer shorter overlaps
    for (let overlapLen = minOverlapLen; overlapLen <= maxOverlapLen; overlapLen++) {
      // Try centered position first (preferred), then try other positions
      const centerStart = Math.floor((linkerLen - overlapLen) / 2);
      const startPositions = [centerStart];
      for (let offset = 1; offset <= Math.min(5, Math.floor(linkerLen / 4)); offset++) {
        if (centerStart - offset >= 0) startPositions.push(centerStart - offset);
        if (centerStart + offset + overlapLen <= linkerLen) startPositions.push(centerStart + offset);
      }
      
      for (const linkerStart of startPositions) {
        const linkerOverlap = linker.slice(linkerStart, linkerStart + overlapLen);
        
        // For long linker: leftPart and rightPart are extracted from linker itself
        // leftPart = linker from (linkerCenter - leftLen) to linkerCenter
        // rightPart = linker from linkerCenter to (linkerCenter + rightLen)
        // where linkerCenter = linkerLen / 2, and leftLen/rightLen are 9-15bp
        const linkerCenter = Math.floor(linkerLen / 2);
        
        // Try different leftPart and rightPart lengths (9-15bp each)
        for (let leftLen = minLeftRightPart; leftLen <= maxLeftRightPart && leftLen <= linkerCenter; leftLen++) {
          for (let rightLen = minLeftRightPart; rightLen <= maxLeftRightPart && rightLen <= (linkerLen - linkerCenter); rightLen++) {
            // Extract leftPart and rightPart from linker (not from fragment boundaries)
            const leftPartStart = linkerCenter - leftLen;
            const leftPart = linker.slice(leftPartStart, linkerCenter);
            const rightPart = linker.slice(linkerCenter, linkerCenter + rightLen);
            
            // Overlap sequence = leftPart + linkerOverlap + rightPart
            const overlapSeq = leftPart + linkerOverlap + rightPart;
            const totalLen = leftLen + overlapLen + rightLen;
        
            if (totalLen < minOverlap || totalLen > maxOverlap) continue;
            
            // For long-linker strategy, the annealing overlap between fragments is the
            // economical linkerOverlap region (not the extra leftPart/rightPart context).
            const tm = tmSaltCorrected(linkerOverlap, conc_nM, na_mM, mg_mM);
            if (!isFinite(tm)) continue;
            
            if (tm >= minOverlapTm) {
              const tmDiff = Math.abs(tm - minOverlapTm);
              const lenPenalty = totalLen * 0.05;  // Much stronger penalty for longer overlaps
              const score = tmDiff + lenPenalty;
              
              if (score < bestScore) {
                best = {
                  seq: overlapSeq,
                  leftLen: leftLen,  // Length of leftPart (from linker)
                  rightLen: rightLen,  // Length of rightPart (from linker)
                  linkerLen: overlapLen,  // Only the part of linker used in overlap
                  linkerStart,  // Start position in linker
                  tm,
                  score,
                  leftPart,
                  rightPart,
                  linkerOverlap
                };
                bestScore = score;
              }
            }
          }
        }
      }
      
      // If we found a valid overlap, prefer shorter ones (early exit)
      if (best && best.tm >= minOverlapTm && best.score < 5) {
        break;
      }
    }
    
    // Fallback: use best we can get (still keep it economical)
    if (!best) {
      const overlapLen = Math.min(desiredOverlap, linkerLen, 20);  // Cap at 20bp
      const linkerStart = Math.floor((linkerLen - overlapLen) / 2);
      const linkerOverlap = linker.slice(linkerStart, linkerStart + overlapLen);
      const linkerCenter = Math.floor(linkerLen / 2);
      
      // Use default leftPart and rightPart lengths (12bp each)
      const defaultLeftRightLen = 12;
      const leftPartStart = Math.max(0, linkerCenter - defaultLeftRightLen);
      const leftPart = linker.slice(leftPartStart, linkerCenter);
      const rightPart = linker.slice(linkerCenter, Math.min(linkerLen, linkerCenter + defaultLeftRightLen));
      const overlapSeq = leftPart + linkerOverlap + rightPart;
      const tm = tmSaltCorrected(linkerOverlap, conc_nM, na_mM, mg_mM);
      
      best = {
        seq: overlapSeq,
        leftLen: leftPart.length,
        rightLen: rightPart.length,
        linkerLen: overlapLen,
        linkerStart,
        tm,
        leftPart,
        rightPart,
        linkerOverlap
      };
    }
    
  } else {
    // SHORT LINKER STRATEGY: Overlap spans linker + flanking fragment sequences
    // Similar to short replacement in mutagenesis
    // Find linker center, then extend left and right (9-15bp each)
    // This will extend into fragment1 end and fragment2 start
    // When linker is empty (length 0): Overlap = fragment1_end + fragment2_start (direct connection)
    
    const linkerCenter = Math.floor(linkerLen / 2);
    
    // For short linker, adjust leftLen and rightLen to ensure totalLen >= minOverlap but allow > maxOverlap
    // The maxOverlap constraint is relaxed for short linker strategy since we need to span linker + fragments
    const effectiveMaxOverlap = Math.max(maxOverlap, minOverlap + linkerLen + 10);  // Allow larger overlap for short linker
    
    for (let leftLen = minLeftRightPart; leftLen <= maxLeftRightPart; leftLen++) {
      for (let rightLen = minLeftRightPart; rightLen <= maxLeftRightPart; rightLen++) {
        const totalLen = leftLen + linkerLen + rightLen;
        if (totalLen < minOverlap) continue;
        // For short linker, we allow totalLen > maxOverlap since we need to span the linker
        // But we still prefer shorter overlaps if possible
        
        // leftPart: extend left from linker center (may go into fragment1)
        // If linkerCenter < leftLen, take remaining from fragment1End
        let leftPart = '';
        if (linkerLen > 0) {
          const takeFromLinker = Math.min(leftLen, linkerCenter);
          const takeFromFragment = leftLen - takeFromLinker;
          if (takeFromFragment > 0) {
            if (fragment1End.length < takeFromFragment) continue;
            leftPart = fragment1End.slice(-takeFromFragment) + linker.slice(0, linkerCenter);
          } else {
            leftPart = linker.slice(linkerCenter - leftLen, linkerCenter);
          }
        } else {
          // Empty linker: take from fragment1End
          if (fragment1End.length < leftLen) continue;
          leftPart = fragment1End.slice(-leftLen);
        }
        
        // rightPart: extend right from linker center (may go into fragment2)
        // If (linkerLen - linkerCenter) < rightLen, take remaining from fragment2Start
        let rightPart = '';
        if (linkerLen > 0) {
          const takeFromLinker = Math.min(rightLen, linkerLen - linkerCenter);
          const takeFromFragment = rightLen - takeFromLinker;
          if (takeFromFragment > 0) {
            if (fragment2Start.length < takeFromFragment) continue;
            rightPart = linker.slice(linkerCenter) + fragment2Start.slice(0, takeFromFragment);
          } else {
            rightPart = linker.slice(linkerCenter, linkerCenter + rightLen);
          }
        } else {
          // Empty linker: take from fragment2Start
          if (fragment2Start.length < rightLen) continue;
          rightPart = fragment2Start.slice(0, rightLen);
        }
        
        // In short-linker strategy, leftPart/rightPart already include the linker portions
        // around the center (and may extend into fragment flanks). Do NOT concatenate the
        // full linker again here, otherwise the overlap sequence (and Tm) is inflated.
        const overlapSeq = leftPart + rightPart;
        
        const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
        if (!isFinite(tm)) continue;
        
        if (tm >= minOverlapTm) {
          const tmDiff = Math.abs(tm - minOverlapTm);
          const balancePenalty = Math.abs(leftLen - rightLen) * 0.05;
          // For short linker, prefer overlaps closer to maxOverlap but allow larger ones
          const lenPenalty = totalLen > maxOverlap 
            ? (totalLen - maxOverlap) * 0.1 + maxOverlap * 0.05  // Heavier penalty for exceeding maxOverlap
            : totalLen * 0.05;
          const score = tmDiff + balancePenalty + lenPenalty;
          
          if (score < bestScore) {
            best = {
              seq: overlapSeq,
              leftLen,
              rightLen,
              linkerLen,  // 0 when no linker
              tm,
              score,
              leftPart,
              rightPart
              // Note: linkerStart is undefined for short linker strategy
            };
            bestScore = score;
          }
        }
      }
      
      if (best && best.tm >= minOverlapTm) {
        break;
      }
    }
    
    // Fallback: if no valid overlap found with Tm requirement, use best available
    if (!best) {
      const linkerCenter = Math.floor(linkerLen / 2);
      for (let leftLen = minLeftRightPart; leftLen <= maxLeftRightPart; leftLen++) {
        for (let rightLen = minLeftRightPart; rightLen <= maxLeftRightPart; rightLen++) {
          const totalLen = leftLen + linkerLen + rightLen;
          
          // leftPart: extend left from linker center (may go into fragment1)
          let leftPart = '';
          if (linkerLen > 0) {
            const takeFromLinker = Math.min(leftLen, linkerCenter);
            const takeFromFragment = leftLen - takeFromLinker;
            if (takeFromFragment > 0) {
              if (fragment1End.length < takeFromFragment) continue;
              leftPart = fragment1End.slice(-takeFromFragment) + linker.slice(0, linkerCenter);
            } else {
              leftPart = linker.slice(linkerCenter - leftLen, linkerCenter);
            }
          } else {
            if (fragment1End.length < leftLen) continue;
            leftPart = fragment1End.slice(-leftLen);
          }
          
          // rightPart: extend right from linker center (may go into fragment2)
          let rightPart = '';
          if (linkerLen > 0) {
            const takeFromLinker = Math.min(rightLen, linkerLen - linkerCenter);
            const takeFromFragment = rightLen - takeFromLinker;
            if (takeFromFragment > 0) {
              if (fragment2Start.length < takeFromFragment) continue;
              rightPart = linker.slice(linkerCenter) + fragment2Start.slice(0, takeFromFragment);
            } else {
              rightPart = linker.slice(linkerCenter, linkerCenter + rightLen);
            }
          } else {
            if (fragment2Start.length < rightLen) continue;
            rightPart = fragment2Start.slice(0, rightLen);
          }
          
          // Same logic as above: avoid double-counting the linker.
          const overlapSeq = leftPart + rightPart;
          
          // For fallback, only require minOverlap, allow larger overlaps
          if (totalLen < minOverlap) continue;
          
          const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
          if (!isFinite(tm)) continue;
          
          if (!best || tm > best.tm) {
            best = {
              seq: overlapSeq,
              leftLen,
              rightLen,
              linkerLen,  // 0 when no linker
              tm,
              leftPart,
              rightPart
              // Note: linkerStart is undefined for short linker strategy
            };
          }
        }
      }
    }
    
    // Final fallback: if still no result, use minimum valid overlap
    if (!best) {
      const linkerCenter = Math.floor(linkerLen / 2);
      // Use minimum lengths to ensure we get at least minOverlap
      const minLeftLen = Math.max(1, Math.floor((minOverlap - linkerLen) / 2));
      const minRightLen = minOverlap - linkerLen - minLeftLen;
      
      if (minLeftLen > 0 && minRightLen > 0) {
        // Build leftPart
        let leftPart = '';
        if (linkerLen > 0) {
          const takeFromLinker = Math.min(minLeftLen, linkerCenter);
          const takeFromFragment = minLeftLen - takeFromLinker;
          if (takeFromFragment > 0 && fragment1End.length >= takeFromFragment) {
            leftPart = fragment1End.slice(-takeFromFragment) + linker.slice(0, linkerCenter);
          } else if (takeFromFragment <= 0) {
            leftPart = linker.slice(Math.max(0, linkerCenter - minLeftLen), linkerCenter);
          } else {
            leftPart = fragment1End.slice(-minLeftLen);
          }
        } else {
          if (fragment1End.length >= minLeftLen) {
            leftPart = fragment1End.slice(-minLeftLen);
          }
        }
        
        // Build rightPart
        let rightPart = '';
        if (linkerLen > 0) {
          const takeFromLinker = Math.min(minRightLen, linkerLen - linkerCenter);
          const takeFromFragment = minRightLen - takeFromLinker;
          if (takeFromFragment > 0 && fragment2Start.length >= takeFromFragment) {
            rightPart = linker.slice(linkerCenter) + fragment2Start.slice(0, takeFromFragment);
          } else if (takeFromFragment <= 0) {
            rightPart = linker.slice(linkerCenter, Math.min(linkerLen, linkerCenter + minRightLen));
          } else {
            rightPart = fragment2Start.slice(0, minRightLen);
          }
        } else {
          if (fragment2Start.length >= minRightLen) {
            rightPart = fragment2Start.slice(0, minRightLen);
          }
        }
        
        if (leftPart && rightPart) {
          const overlapSeq = leftPart + rightPart;
          const tm = tmSaltCorrected(overlapSeq, conc_nM, na_mM, mg_mM);
          if (isFinite(tm)) {
            best = {
              seq: overlapSeq,
              leftLen: leftPart.length,
              rightLen: rightPart.length,
              linkerLen,
              tm,
              leftPart,
              rightPart
            };
          }
        }
      }
    }
  }
  
  return best;
}

// Calculate complementarity score between two sequences
function calculateComplementarity(seq1, seq2) {
  const minLen = Math.min(seq1.length, seq2.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (seq1[i] === seq2[i]) {
      matches++;
    }
  }
  return matches / minLen;
}

// ==================== Core Primer Design ====================

// Design core binding region for a primer
function designCore(sequence, isForward, targetTm, opts = {}) {
  const minCoreLen = opts.minCoreLen ?? 18;
  const maxCoreLen = opts.maxCoreLen ?? 40;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  
  let best = null;
  
  if (isForward) {
    // Forward primer: take from start of sequence
    for (let len = minCoreLen; len <= Math.min(maxCoreLen, sequence.length); len++) {
      const coreSeq = sequence.slice(0, len);
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!best || Math.abs(tm - targetTm) < Math.abs(best.tm - targetTm)) {
        best = { seq: coreSeq, len, tm };
      }
    }
  } else {
    // Reverse primer: take from end of sequence (will be reverse complemented)
    for (let len = minCoreLen; len <= Math.min(maxCoreLen, sequence.length); len++) {
      const coreSeq = sequence.slice(-len);
      const tm = tmSaltCorrected(coreSeq, conc_nM, na_mM, mg_mM);
      if (!best || Math.abs(tm - targetTm) < Math.abs(best.tm - targetTm)) {
        best = { seq: coreSeq, len, tm };
      }
    }
  }
  
  return best || { seq: sequence.slice(0, Math.min(maxCoreLen, sequence.length)), len: Math.min(maxCoreLen, sequence.length), tm: tmSaltCorrected(sequence.slice(0, Math.min(maxCoreLen, sequence.length)), conc_nM, na_mM, mg_mM) };
}

function debugLogOverlapTmDetails(ctx) {
  try {
    const {
      fragment1Name,
      fragment2Name,
      linker,
      conc_nM,
      na_mM,
      mg_mM,
      overlapInfo,
      r1Overlap,
      f2Overlap,
      R1,
      F2
    } = ctx || {};

    const rOverlapShown = (R1 && r1Overlap) ? R1.slice(Math.max(0, R1.length - r1Overlap.length)) : null;
    const fOverlapShown = (F2 && f2Overlap) ? F2.slice(0, f2Overlap.length) : null;

    const tm = (s) => (s ? tmSaltCorrected(s, conc_nM, na_mM, mg_mM) : null);

    const sharedOverlap = overlapInfo
      ? (overlapInfo.linkerStart !== undefined ? overlapInfo.linkerOverlap : overlapInfo.seq)
      : null;

    const payload = {
      junction: `${fragment1Name || 'Fragment1'} -> ${fragment2Name || 'Fragment2'}`,
      params: { conc_nM, na_mM, mg_mM },
      linkerLen: (linker || '').length,
      isLongLinker: overlapInfo && overlapInfo.linkerStart !== undefined,
      overlapInfo: overlapInfo
        ? {
            tm: overlapInfo.tm,
            seq: overlapInfo.seq,
            len: overlapInfo.seq ? overlapInfo.seq.length : null,
            leftPart: overlapInfo.leftPart,
            rightPart: overlapInfo.rightPart,
            linkerOverlap: overlapInfo.linkerOverlap,
            linkerStart: overlapInfo.linkerStart,
            linkerLen: overlapInfo.linkerLen
          }
        : null,
      sharedOverlap: {
        seq: sharedOverlap,
        len: sharedOverlap ? sharedOverlap.length : null,
        tm: tm(sharedOverlap)
      },
      primerOverlap: {
        r1Overlap: r1Overlap || null,
        r1OverlapLen: r1Overlap ? r1Overlap.length : null,
        r1OverlapTm: tm(r1Overlap),
        r1OverlapShown: rOverlapShown,
        r1OverlapShownTm: tm(rOverlapShown),
        f2Overlap: f2Overlap || null,
        f2OverlapLen: f2Overlap ? f2Overlap.length : null,
        f2OverlapTm: tm(f2Overlap),
        f2OverlapShown: fOverlapShown,
        f2OverlapShownTm: tm(fOverlapShown)
      }
    };

    console.log('[OE-PCR Debug] Overlap Tm details', payload);
  } catch (e) {
    console.warn('[OE-PCR Debug] Failed to log overlap details:', e);
  }
}

// Design primers for connecting two fragments
function designConnectionPrimers(fragment1, fragment2, linker, opts = {}) {
  const coreTargetTm = opts.coreTargetTm ?? 60;
  const overlapTargetTm = opts.overlapTargetTm ?? 60;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  
  // Get fragment ends for overlap design (use last 50bp of fragment1, first 50bp of fragment2)
  const frag1End = fragment1.seq.slice(-50);
  const frag2Start = fragment2.seq.slice(0, 50);
  
  // Design overlap (economical: 20-30bp, uses only part of linker if linker is long)
  const overlapInfo = designOverlap(frag1End, frag2Start, linker, {
    desiredOverlap: 20,
    minOverlapTm: overlapTargetTm,
    maxOverlap: 30,  // Cap at 30bp for economy
    conc_nM,
    na_mM,
    mg_mM
  });
  
  if (!overlapInfo) {
    console.error('Failed to design overlap:', {
      fragment1End: frag1End,
      fragment2Start: frag2Start,
      linker: linker,
      linkerLen: linker.length,
      frag1EndLen: frag1End.length,
      frag2StartLen: frag2Start.length
    });
    throw new Error('Failed to design overlap between fragments');
  }
  
  // Debug: log overlap info when linker is empty
  if (!linker || linker.length === 0) {
    console.log('Empty linker - overlapInfo:', overlapInfo);
    console.log('leftPart:', overlapInfo.leftPart, 'rightPart:', overlapInfo.rightPart);
  }
  
  // Design R1: reverse primer for fragment 1 with overlap to fragment 2
  // Core primer ALWAYS starts from end/start of fragment (never exclude any fragment sequence)
  // For R1: core is designed from the END of fragment1 (reverse direction)
  
  // Get fragment1 core: ALWAYS use full fragment sequence (from END)
  const r1Core = fragment1.seq.length >= 12 
    ? designCore(fragment1.seq, false, coreTargetTm, { conc_nM, na_mM, mg_mM })
    : { seq: fragment1.seq, len: fragment1.seq.length, tm: tmSaltCorrected(fragment1.seq, conc_nM, na_mM, mg_mM) };
  
  // R1 overlap part: depends on linker length
  // For long linker: R1 = core + linkerFront
  // For short linker: R1 = core + frontHalfLinker + rightPart
  // For empty linker: R1 = core + rightPart
  let r1Overlap;
  if (overlapInfo.linkerStart !== undefined) {
    // Long linker strategy: R1 = core + linkerFront
    // linkerFront = linker from start to overlap end (includes the overlap region)
    // leftPart and rightPart are ONLY used for Tm calculation, NOT in primer sequence
    const linkerFront = linker.slice(0, overlapInfo.linkerStart + overlapInfo.linkerLen);
    r1Overlap = linkerFront;
  } else {
    // Short linker strategy (including empty linker)
    if (linker && linker.length > 0) {
      // Short linker: R1 = core + frontHalfLinker + rightPart
      const linkerCenter = Math.floor(linker.length / 2);
      const frontHalfLinker = linker.slice(0, linkerCenter);
      r1Overlap = frontHalfLinker + overlapInfo.rightPart;
    } else {
      // Empty linker (length = 0): R1 = core + rightPart
      r1Overlap = overlapInfo.rightPart || '';
    }
  }
  const r1Forward = r1Core.seq + r1Overlap;
  const R1 = revComp(r1Forward);
  const R1Tm = tmSaltCorrected(R1, conc_nM, na_mM, mg_mM);
  
  // Design F2: forward primer for fragment 2 with overlap from fragment 1
  // Core primer ALWAYS starts from end/start of fragment (never exclude any fragment sequence)
  // For F2: core is designed from the START of fragment2 (forward direction)
  
  // F2 overlap part: depends on linker length
  // For long linker: F2 = linkerBack + core
  // For short linker: F2 = leftPart + backHalfLinker + core
  // For empty linker: F2 = leftPart + core
  let f2Overlap;
  if (overlapInfo.linkerStart !== undefined) {
    // Long linker strategy: F2 = linkerBack + core
    // linkerBack = linker from overlap start to linker end (includes the overlap region)
    // leftPart and rightPart are ONLY used for Tm calculation, NOT in primer sequence
    const linkerBack = linker.slice(overlapInfo.linkerStart);
    f2Overlap = linkerBack;
  } else {
    // Short linker strategy (including empty linker)
    if (linker && linker.length > 0) {
      // Short linker: F2 = leftPart + backHalfLinker + core
      const linkerCenter = Math.floor(linker.length / 2);
      const backHalfLinker = linker.slice(linkerCenter);
      f2Overlap = overlapInfo.leftPart + backHalfLinker;
    } else {
      // Empty linker (length = 0): F2 = leftPart + core
      f2Overlap = overlapInfo.leftPart || '';
    }
  }
  
  // Get fragment2 core: ALWAYS use full fragment sequence (from START)
  const f2Core = fragment2.seq.length >= 12 
    ? designCore(fragment2.seq, true, coreTargetTm, { conc_nM, na_mM, mg_mM })
    : { seq: fragment2.seq, len: fragment2.seq.length, tm: tmSaltCorrected(fragment2.seq, conc_nM, na_mM, mg_mM) };
  const F2 = f2Overlap + f2Core.seq;
  const F2Tm = tmSaltCorrected(F2, conc_nM, na_mM, mg_mM);
  
  // Calculate overlap Tm (only the part used for annealing, not the full linker)
  const overlapTm = overlapInfo.tm; // This is the Tm of the economical overlap region

  // Debug log (no logic changes): help inspect why UI overlap Tm might differ from overlap segments in primers.
  debugLogOverlapTmDetails({
    fragment1Name: fragment1?.name,
    fragment2Name: fragment2?.name,
    linker,
    conc_nM,
    na_mM,
    mg_mM,
    overlapInfo,
    r1Overlap,
    f2Overlap,
    R1,
    F2
  });
  
  return {
    R1: {
      seq: R1,
      len: R1.length,
      gc: gcContent(R1),
      tm: R1Tm,
      coreTm: r1Core.tm,
      coreLen: r1Core.len,  // Core length for display
      coreSeq: r1Core.seq,  // Core sequence for highlighting
      overlapTm: overlapTm,  // Tm of the economical overlap region (20-30bp)
      overlapLen: r1Overlap.length,  // Overlap length for display
      overlapSeq: overlapInfo.seq,  // Full overlap sequence (leftPart + linker + rightPart)
      leftPart: overlapInfo.leftPart,  // Left part of overlap (for short linker)
      rightPart: overlapInfo.rightPart,  // Right part of overlap (for short linker)
      linkerOverlap: overlapInfo.linkerOverlap,  // Linker overlap region (for long linker)
      isLongLinker: overlapInfo.linkerStart !== undefined  // Flag to indicate long linker strategy
    },
    F2: {
      seq: F2,
      len: F2.length,
      gc: gcContent(F2),
      tm: F2Tm,
      coreTm: f2Core.tm,
      coreLen: f2Core.len,  // Core length for display
      coreSeq: f2Core.seq,  // Core sequence for highlighting
      overlapTm: overlapTm,  // Tm of the economical overlap region (20-30bp)
      overlapLen: f2Overlap.length,  // Overlap length for display
      overlapSeq: overlapInfo.seq,  // Full overlap sequence (leftPart + linker + rightPart)
      leftPart: overlapInfo.leftPart,  // Left part of overlap (for short linker)
      rightPart: overlapInfo.rightPart,  // Right part of overlap (for short linker)
      linkerOverlap: overlapInfo.linkerOverlap,  // Linker overlap region (for long linker)
      isLongLinker: overlapInfo.linkerStart !== undefined  // Flag to indicate long linker strategy
    },
    overlap: overlapInfo
  };
}

// Design primers for all fragments
function designMultiFragmentPrimers(fragments, linkers, opts = {}) {
  const coreTargetTm = opts.coreTargetTm ?? 60;
  const conc_nM = opts.conc_nM ?? 500;
  const na_mM = opts.na_mM ?? 50;
  const mg_mM = opts.mg_mM ?? 0;
  const userFOverlap = opts.userFOverlap ? cleanDNA(opts.userFOverlap) : '';
  const userROverlap = opts.userROverlap ? cleanDNA(opts.userROverlap) : '';
  
  // Initialize results array - one entry per fragment
  const results = fragments.map(frag => ({
    fragment: frag,
    F: null,
    R: null
  }));
  
  // Design F1: forward primer for first fragment
  const f1Core = designCore(fragments[0].seq, true, coreTargetTm, { conc_nM, na_mM, mg_mM });
  const f1Overlap = userFOverlap ? userFOverlap : '';
  const F1 = f1Overlap + f1Core.seq;
  const F1Tm = tmSaltCorrected(F1, conc_nM, na_mM, mg_mM);
  const F1OverlapTm = userFOverlap ? tmSaltCorrected(userFOverlap, conc_nM, na_mM, mg_mM) : null;
  
  results[0].F = {
    seq: F1,
    len: F1.length,
    gc: gcContent(F1),
    tm: F1Tm,
    coreTm: f1Core.tm,
    coreLen: f1Core.len,
    coreSeq: f1Core.seq,  // Core sequence for highlighting
    overlapTm: F1OverlapTm,
    overlapLen: f1Overlap.length
  };
  
  // Design connection primers for each pair of fragments
  for (let i = 0; i < fragments.length - 1; i++) {
    const linker = linkers[i] || '';
    const connPrimers = designConnectionPrimers(fragments[i], fragments[i + 1], linker, opts);
    
    // Set R primer for fragment i (reverse primer with overlap to fragment i+1)
    results[i].R = connPrimers.R1;
    
    // Set F primer for fragment i+1 (forward primer with overlap from fragment i)
    results[i + 1].F = connPrimers.F2;
  }
  
  // Design RN: reverse primer for last fragment
  // userROverlap is added to 5' end of RN, so we need to reverse complement it first
  // Then add it to the 3' end of rnForward (which becomes 5' end of RN after RC)
  const lastFragment = fragments[fragments.length - 1];
  const rnCore = designCore(lastFragment.seq, false, coreTargetTm, { conc_nM, na_mM, mg_mM });
  const rnOverlap = userROverlap ? Core.reverseComplementSeq(userROverlap) : '';
  const rnForward = rnCore.seq + rnOverlap;
  const RN = revComp(rnForward);
  const RNTm = tmSaltCorrected(RN, conc_nM, na_mM, mg_mM);
  const RNOverlapTm = userROverlap ? tmSaltCorrected(userROverlap, conc_nM, na_mM, mg_mM) : null;
  
  results[results.length - 1].R = {
    seq: RN,
    len: RN.length,
    gc: gcContent(RN),
    tm: RNTm,
    coreTm: rnCore.tm,
    coreLen: rnCore.len,
    coreSeq: rnCore.seq,  // Core sequence for highlighting
    overlapTm: RNOverlapTm,
    overlapLen: rnOverlap.length,
    userROverlap: userROverlap || null  // Original user input (not RC) for display
  };
  
  return results;
}

// ==================== QC Functions ====================

function runPrimerQC(seq, targetTm, conc_nM = 500, na_mM = 50, mg_mM = 0) {
  const tm = tmSaltCorrected(seq, conc_nM, na_mM, mg_mM);
  const gc = gcContent(seq);
  const hasHomo = Core.hasHomopolymer(seq, 4);
  
  const hairpin = Core.duplexDG37Worst(seq, true);
  const selfDimer = Core.duplexDG37Worst(seq, false);
  
  return {
    tm,
    gc,
    hasHomo,
    hairpin: hairpin ? hairpin.dG : null,
    selfDimer: selfDimer ? selfDimer.dG : null
  };
}

function getQCLabel(qc) {
  const hp = qc.hairpin ? (qc.hairpin <= -7 ? 'Very strong' : qc.hairpin <= -5 ? 'Strong' : qc.hairpin <= -3 ? 'Moderate' : 'Weak') : 'None';
  const sd = qc.selfDimer ? (qc.selfDimer <= -7 ? 'Very strong' : qc.selfDimer <= -5 ? 'Strong' : qc.selfDimer <= -3 ? 'Moderate' : 'Weak') : 'None';
  const homo = qc.hasHomo ? 'Yes' : 'No';
  
  return {
    hp: { label: hp, cls: hp === 'None' ? 'ok' : hp.includes('strong') ? 'bad' : 'warn' },
    sd: { label: sd, cls: sd === 'None' ? 'ok' : sd.includes('strong') ? 'bad' : 'warn' },
    homo: { label: homo, cls: homo === 'No' ? 'ok' : 'warn' }
  };
}

function getCrossDimerLabel(seqA, seqB) {
  if (!seqA || !seqB) return { label: 'N/A', cls: 'ok' };
  const dimer = Core.duplexDG37Worst(seqA + seqB, false);
  if (!dimer || !dimer.dG) return { label: 'None', cls: 'ok' };
  const dG = dimer.dG;
  if (dG <= -7) return { label: 'Very strong', cls: 'bad' };
  if (dG <= -5) return { label: 'Strong', cls: 'bad' };
  if (dG <= -3) return { label: 'Moderate', cls: 'warn' };
  return { label: 'Weak', cls: 'ok' };
}

// ==================== UI Functions ====================

let fragmentRowCount = 0;
let oeLinkerVisible = false;

// Warning modal for OE-PCR demo (styled like QC modal)
function showOeWarning(message) {
  const existing = document.getElementById('oe-demo-modal');
  if (existing) existing.remove();

  const styleId = 'oe-demo-modal-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #oe-demo-modal {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .oe-demo-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
      }
      .oe-demo-content {
        position: relative;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: oeDemoModalIn 0.3s ease-out;
      }
      @keyframes oeDemoModalIn {
        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .oe-demo-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px;
        background: #fff7ed;
        border-bottom: 1px solid #fde68a;
      }
      .oe-demo-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #92400e;
        font-weight: 600;
      }
      .oe-demo-body {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .oe-demo-body p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-line;
      }
      .oe-demo-footer {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      .oe-demo-footer .btn {
        min-width: 80px;
        padding: 8px 14px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid #d1d5db;
        background: #fff;
      }
      .oe-demo-footer .btn.primary {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  const modal = document.createElement('div');
  modal.id = 'oe-demo-modal';
  const overlay = document.createElement('div');
  overlay.className = 'oe-demo-overlay';
  const content = document.createElement('div');
  content.className = 'oe-demo-content';

  const header = document.createElement('div');
  header.className = 'oe-demo-header';
  const icon = document.createElement('span');
  icon.textContent = '⚠️';
  icon.style.fontSize = '1.5rem';
  const title = document.createElement('h3');
  title.textContent = 'Warning';
  header.appendChild(icon);
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'oe-demo-body';
  const messageP = document.createElement('p');
  messageP.textContent = message;
  body.appendChild(messageP);

  const footer = document.createElement('div');
  footer.className = 'oe-demo-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'min-width:80px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#0f172a;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.cssText = 'min-width:80px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid #2563eb;background:#2563eb;color:#fff;';
  footer.appendChild(cancelBtn);
  footer.appendChild(okBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  modal.appendChild(overlay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  const close = () => modal.remove();
  overlay.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', close);
}

// Load demo sequences for overlap PCR fragments (6 inserts)
let oeDemoSequences = null;
async function loadOeDemoSequences() {
  if (oeDemoSequences) return oeDemoSequences;
  const base = new URL('modules/contents/demo/', window.location.href).toString();
  const files = ['Insert_1.txt', 'Insert_2.txt', 'Insert_3.txt', 'Insert_4.txt', 'Insert_5.txt', 'Insert_6.txt'];
  const results = [];
  for (const name of files) {
    try {
      const resp = await fetch(base + name);
      if (!resp.ok) continue;
      const text = await resp.text();
      const parsed = Core.parseFASTA(text) || [];
      parsed.forEach(p => {
        const header = p.header || name.replace('.txt', '');
        const seq = Core.normalizeSeq(p.seq || p.sequence || '');
        if (seq) results.push({ header, seq });
      });
    } catch (e) {
      console.warn('Overlap PCR demo load failed', name, e);
    }
  }
  oeDemoSequences = results;
  return oeDemoSequences;
}

function createFragmentRow() {
  fragmentRowCount++;
  const tbody = $('fragment-rows');
  const tr = document.createElement('tr');
  tr.id = `fragment-row-${fragmentRowCount}`;
  tr.innerHTML = `
    <td style="width: 2%; vertical-align: top;">${fragmentRowCount}</td>
    <td id="dna-seq-cell-${fragmentRowCount}" style="width: 65%;">
      <textarea id="frag-seq-${fragmentRowCount}" placeholder="Enter DNA sequence (FASTA format supported)..."></textarea>
      <div class="row end" style="margin-top:6px">
        <input type="file" id="file-frag-${fragmentRowCount}" accept=".fa,.fasta,.fas,.txt" style="display:none">
        <button type="button" class="btn demo" id="frag-rc-${fragmentRowCount}">Reverse complement</button>
        <button class="btn demo" id="frag-demo-${fragmentRowCount}" type="button">Demo</button>
        <button class="ghost btn" id="frag-upload-${fragmentRowCount}" type="button">Upload</button>
      </div>
    </td>
    <td class="linker-column" style="display: ${oeLinkerVisible ? 'table-cell' : 'none'}; width: 30%; position: relative; overflow: hidden;">
      <div style="display: flex; flex-direction: column; gap: 4px; position: relative;">
        <div style="display: flex; gap: 4px; align-items: center;">
          <input type="text" id="frag-linker-${fragmentRowCount}" placeholder="Linker and tag (optional)" list="linker-suggestions-${fragmentRowCount}" style="flex: 1; min-width: 0;" autocomplete="off">
          <datalist id="linker-suggestions-${fragmentRowCount}">
            <option value="GS">GS</option>
              <option value="GSGS">2x(GS)</option>
              <option value="GSGSGS">3x(GS)</option>
              <option value="GSGSGSGS">4x(GS)</option>
              <option value="GSGSGSGSGS">5x(GS)</option>
              <option value="GGS">GGS</option>
              <option value="GGGGS">GGGGS</option>
              <option value="GGGGGS">GGGGGS</option>
              <option value="GGGGSGGGGS">2x(G4S)</option>
              <option value="GGGGSGGGGSGGGGS">3x(G4S)</option>
              <option value="GGGGSGGGGSGGGGSGGGGS">4x(G4S)</option>
              <option value="GGGGSGGGGSGGGGSGGGGSGGGGS">5x(G4S)</option>
              <option value="EAAAK">EAAAK</option>
              <option value="EAAAKEAAAK">2x(EAAAK)</option>
              <option value="EAAAKEAAAKEAAAK">3x(EAAAK)</option>
              <option value="HHHHHH">His-tag (6xHis affinity tag)</option>
              <option value="HHHHHHHH">His-tag (8xHis affinity tag)</option>
              <option value="DYKDDDDK">FLAG-tag</option>
              <option value="YPYDVPDYA">HA-tag</option>
              <option value="EQKLISEEDL">c-Myc-tag</option>
              <option value="WSHPQFEK">Strep-tag II</option>
          </datalist>
          <button type="button" id="linker-type-btn-${fragmentRowCount}" class="linker-type-btn" data-type="AA" style="padding: 4px 6px; border: 1px solid #d0d0dd; border-radius: 4px; background: #e0f2fe; cursor: pointer; font-size: 0.75rem; white-space: nowrap; color: #0369a1; flex-shrink: 0;">AA</button>
        </div>
        <div id="host-organism-container-${fragmentRowCount}" style="display: block;">
          <label for="host-organism-${fragmentRowCount}" style="font-size: 0.75rem; margin: 0 0 2px 0; display: block;">Host organism:</label>
          <div style="position: relative; overflow: visible;">
            <select id="host-organism-${fragmentRowCount}" style="width: 100%; padding: 4px 6px; font-size: 0.8rem;"></select>
          </div>
        </div>
      </div>
    </td>
    <td style="white-space: nowrap; vertical-align: top; width: 3%; padding: 4px 2px 4px 4px; text-align: left;">
      <div class="frag-actions" style="width: 100%;">
        <button class="ghost btn sm up" onclick="moveFragmentRowUp(${fragmentRowCount})" title="Move up" type="button" style="width: 100%; min-width: 0;">▲</button>
        <button class="ghost btn sm down" onclick="moveFragmentRowDown(${fragmentRowCount})" title="Move down" type="button" style="width: 100%; min-width: 0;">▼</button>
        <button class="ghost btn sm del" onclick="removeFragmentRow(${fragmentRowCount})" title="Delete" type="button" style="width: 100%; min-width: 0;">✕</button>
      </div>
    </td>
  `;
  tbody.appendChild(tr);
  
  // Add event listener for linker type button
  const linkerTypeBtn = $(`linker-type-btn-${fragmentRowCount}`);
  const hostOrganismContainer = $(`host-organism-container-${fragmentRowCount}`);
  const hostOrganismSelect = $(`host-organism-${fragmentRowCount}`);
  
  // Populate host organism dropdown for this row
  populateHostSelect(hostOrganismSelect);
  
  linkerTypeBtn.addEventListener('click', () => {
    const currentType = linkerTypeBtn.getAttribute('data-type');
    const newType = currentType === 'AA' ? 'DNA' : 'AA';
    linkerTypeBtn.setAttribute('data-type', newType);
    linkerTypeBtn.textContent = newType;
    linkerTypeBtn.style.background = newType === 'AA' ? '#e0f2fe' : '#f0f0f0';
    linkerTypeBtn.style.color = newType === 'AA' ? '#0369a1' : '#222';
    
    // Show/hide host organism selector based on type
    if (newType === 'AA') {
      hostOrganismContainer.style.display = 'block';
    } else {
      hostOrganismContainer.style.display = 'none';
    }
  });
  
  // Add event listener for Upload button - use rowNum to avoid closure issues
  const rowNum = fragmentRowCount; // Capture the current row number
  const uploadBtn = $(`frag-upload-${rowNum}`);
  const fileInput = $(`file-frag-${rowNum}`);
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }
  
  // Add event listener for file input - use rowNum to avoid closure issues
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const textarea = $(`frag-seq-${rowNum}`);
        if (textarea) {
          textarea.value = ev.target.result;
        }
      };
      r.readAsText(f);
    });
  }
  
  // Add event listener for Reverse complement button - use rowNum to avoid closure issues
  const rcBtn = $(`frag-rc-${rowNum}`);
  if (rcBtn) {
    rcBtn.addEventListener('click', () => {
      const textarea = $(`frag-seq-${rowNum}`);
      if (!textarea) return;
      const raw = (textarea.value || "").trim();
      if (!raw) return;
      
      // Parse FASTA to preserve header
      const records = Core.parseFASTA(raw);
      if (records.length === 0) {
        // Not FASTA format, treat as raw sequence
        const cleaned = Core.normalizeSeq(raw);
        if (!cleaned) return;
        textarea.value = Core.reverseComplementSeq(cleaned);
      } else {
        // FASTA format: preserve header, only RC the sequence
        const result = records.map(record => {
          const header = record.header || '';
          const seq = Core.normalizeSeq(record.seq);
          if (!seq) {
            // If no sequence, just return the header
            return header ? '>' + header : '';
          }
          const rcSeq = Core.reverseComplementSeq(seq);
          // Reconstruct FASTA format - header from parseFASTA doesn't include '>'
          if (header) {
            return '>' + header + '\n' + rcSeq;
          } else {
            return rcSeq;
          }
        }).filter(r => r).join('\n');
        textarea.value = result;
      }
    });
  }

  // Add event listener for Demo button
  const demoBtn = $(`frag-demo-${rowNum}`);
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      const textarea = $(`frag-seq-${rowNum}`);
      if (!textarea) return;
      const demos = await loadOeDemoSequences();
      if (!demos.length) return;
      if (rowNum > demos.length) {
        showOeWarning(`Demo only provides ${demos.length} inserts.`);
        return;
      }
      const sample = demos[rowNum - 1];
      if (sample) {
        textarea.value = `>${sample.header}\n${sample.seq}`;
      }
    });
  }
  
  return fragmentRowCount;
}

function removeFragmentRow(rowNum) {
  const row = $(`fragment-row-${rowNum}`);
  if (row) row.remove();
  updateRowNumbers();
  updateMoveButtons();
}

function moveFragmentRowUp(rowNum) {
  const tbody = $('fragment-rows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const currentIndex = rows.findIndex(row => row.id === `fragment-row-${rowNum}`);
  
  if (currentIndex <= 0) return; // Already at top
  
  const currentRow = rows[currentIndex];
  const previousRow = rows[currentIndex - 1];
  
  // Swap rows
  tbody.insertBefore(currentRow, previousRow);
  updateRowNumbers();
  updateMoveButtons();
}

function moveFragmentRowDown(rowNum) {
  const tbody = $('fragment-rows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const currentIndex = rows.findIndex(row => row.id === `fragment-row-${rowNum}`);
  
  if (currentIndex < 0 || currentIndex >= rows.length - 1) return; // Already at bottom
  
  const currentRow = rows[currentIndex];
  const nextRow = rows[currentIndex + 1];
  
  // Swap rows
  if (nextRow.nextSibling) {
    tbody.insertBefore(currentRow, nextRow.nextSibling);
  } else {
    tbody.appendChild(currentRow);
  }
  updateRowNumbers();
  updateMoveButtons();
}

function updateRowNumbers() {
  const tbody = $('fragment-rows');
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    row.querySelector('td:first-child').textContent = index + 1;
  });
}

function updateMoveButtons() {
  const tbody = $('fragment-rows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  rows.forEach((row, index) => {
    const upBtn = row.querySelector('button[onclick*="moveFragmentRowUp"]');
    const downBtn = row.querySelector('button[onclick*="moveFragmentRowDown"]');
    
    // Disable/enable up button
    if (upBtn) {
      if (index === 0) {
        upBtn.disabled = true;
        upBtn.style.opacity = '0.5';
        upBtn.style.cursor = 'not-allowed';
      } else {
        upBtn.disabled = false;
        upBtn.style.opacity = '1';
        upBtn.style.cursor = 'pointer';
      }
    }
    
    // Disable/enable down button
    if (downBtn) {
      if (index === rows.length - 1) {
        downBtn.disabled = true;
        downBtn.style.opacity = '0.5';
        downBtn.style.cursor = 'not-allowed';
      } else {
        downBtn.disabled = false;
        downBtn.style.opacity = '1';
        downBtn.style.cursor = 'pointer';
      }
    }
  });
}

function initializeFragmentRows() {
  const tbody = $('fragment-rows');
  tbody.innerHTML = '';
  fragmentRowCount = 0;
  // Create 2 default rows
  for (let i = 0; i < 2; i++) {
    createFragmentRow();
  }
  updateMoveButtons();
}

function renderResults(primerResults, linkers) {
  console.log('renderResults called with:', primerResults, linkers);
  const resultsDiv = $('results');
  const contentDiv = $('results-content');
  
  if (!resultsDiv) {
    console.error('results div not found!');
    alert('Error: Results container not found. Please refresh the page.');
    return;
  }
  
  if (!contentDiv) {
    console.error('results-content div not found!');
    alert('Error: Results content container not found. Please refresh the page.');
    return;
  }
  
  contentDiv.innerHTML = '';
  
  if (!primerResults || primerResults.length === 0) {
    contentDiv.innerHTML = '<p>No primers were designed.</p>';
    resultsDiv.classList.add('show');
    return;
  }
  
  // Save to global variables for download
  window.currentPrimerResults = primerResults;
  window.currentLinkers = linkers;
  
  // Show assembled sequence with linkers
  let assembledSeq = '';
  let linkerInfo = [];
  
  // Collect fragment names for header
  // If user provided FASTA headers, use them; otherwise use fragment1name_fragment2name format
  const fragmentNames = [];
  const userProvidedHeaders = [];
  for (let i = 0; i < primerResults.length; i++) {
    const fragName = primerResults[i].fragment.name || `Fragment ${i + 1}`;
    fragmentNames.push(fragName);
    
    // Check if this fragment had a user-provided FASTA header
    // We need to check the original input - this info should be in fragment.name if it came from FASTA
    // For now, we'll use the fragment name as-is (it may already be from FASTA header)
    userProvidedHeaders.push(fragName);
    
    assembledSeq += primerResults[i].fragment.seq;
    if (i < linkers.length && linkers[i]) {
      assembledSeq += linkers[i];
      linkerInfo.push({
        position: assembledSeq.length - linkers[i].length,
        length: linkers[i].length,
        seq: linkers[i]
      });
    }
  }
  
  // Generate FASTA header:
  // - If user provided FASTA headers (names don't match "Fragment X" pattern), use them joined with "_"
  // - Otherwise, use fragment1name_fragment2name format
  const hasUserHeaders = fragmentNames.some(name => !name.match(/^Fragment \d+$/));
  const fastaHeader = hasUserHeaders && fragmentNames.length > 1
    ? fragmentNames.join('_')
    : fragmentNames.length > 1
    ? fragmentNames.join('_')
    : fragmentNames[0] || 'Assembled_Sequence';
  
  // Save assembled sequence and header to global variables
  window.currentAssembledSeq = assembledSeq;
  window.currentAssembledName = fastaHeader;
  
  const assembledDiv = document.createElement('div');
  assembledDiv.style.cssText = 'background:#f1f5f9;padding:10px 12px;border-radius:12px;margin-top:12px;';
  
  // Format sequence as FASTA with line breaks (70 characters per line)
  function formatFASTA(seq, header) {
    let fasta = `>${header}\n`;
    for (let i = 0; i < seq.length; i += 70) {
      fasta += seq.slice(i, i + 70) + '\n';
    }
    return fasta;
  }
  
  // Format sequence with highlights: core (bold and underline)
  function formatFASTAWithHighlights(seq, header, primerResults, linkers) {
    // Create maps to track which primer's core region each position belongs to
    // Use different styles for different primers
    const f1CorePositions = new Set();  // F1: single underline
    const r1CorePositions = new Set();  // R1: double underline
    const f2CorePositions = new Set();  // F2: dotted underline
    const rnCorePositions = new Set();  // RN: wavy underline
    
    // Helper function to mark core positions by finding the core sequence in assembled sequence
    function markCoreBySequence(coreSeq, searchStart, searchEnd, positionSet) {
      if (!coreSeq || coreSeq.length === 0) return;
      
      // Ensure search range is valid
      const actualSearchStart = Math.max(0, searchStart);
      const actualSearchEnd = Math.min(seq.length, searchEnd);
      
      if (actualSearchStart >= actualSearchEnd) return;
      
      // Search for core sequence in the assembled sequence
      const searchRegion = seq.slice(actualSearchStart, actualSearchEnd);
      let coreStart = searchRegion.indexOf(coreSeq);
      
      if (coreStart >= 0) {
        // Found exact match
        const actualCoreStart = actualSearchStart + coreStart;
        const actualCoreEnd = actualCoreStart + coreSeq.length;
        for (let j = actualCoreStart; j < actualCoreEnd; j++) {
          positionSet.add(j);
        }
        return; // Success, exit early
      }
      
      // Try reverse complement for reverse primers
      const coreSeqRC = Core.reverseComplementSeq(coreSeq);
      coreStart = searchRegion.indexOf(coreSeqRC);
      if (coreStart >= 0) {
        const actualCoreStart = actualSearchStart + coreStart;
        const actualCoreEnd = actualCoreStart + coreSeqRC.length;
        for (let j = actualCoreStart; j < actualCoreEnd; j++) {
          positionSet.add(j);
        }
        return; // Success, exit early
      }
      
      // If still not found, try searching in the entire sequence (fallback)
      // This handles cases where the search range might be slightly off
      const fullSeqMatch = seq.indexOf(coreSeq);
      if (fullSeqMatch >= 0) {
        const actualCoreEnd = fullSeqMatch + coreSeq.length;
        for (let j = fullSeqMatch; j < actualCoreEnd; j++) {
          positionSet.add(j);
        }
        return;
      }
      
      // Last resort: try reverse complement in full sequence
      const fullSeqMatchRC = seq.indexOf(coreSeqRC);
      if (fullSeqMatchRC >= 0) {
        const actualCoreEnd = fullSeqMatchRC + coreSeqRC.length;
        for (let j = fullSeqMatchRC; j < actualCoreEnd; j++) {
          positionSet.add(j);
        }
        return;
      }
    }
    
    let currentPos = 0;
    
    // Process each fragment and its primers
    for (let i = 0; i < primerResults.length; i++) {
      const result = primerResults[i];
      const fragSeq = result.fragment.seq;
      const fragLen = fragSeq.length;
      
      // F1 (first fragment forward primer) - at the start of fragment 1
      if (i === 0 && result.F) {
        // Use coreSeq if available, otherwise extract from primer sequence
        const f1CoreSeq = result.F.coreSeq || result.F.seq.slice(result.F.overlapLen || 0, (result.F.overlapLen || 0) + (result.F.coreLen || 0));
        markCoreBySequence(f1CoreSeq, currentPos, currentPos + fragLen, f1CorePositions);
      }
      
      // R1 (reverse primer for fragment i, connects to fragment i+1)
      if (result.R && i < primerResults.length - 1) {
        // R1 = revComp(core + overlap), so R1 forward = core + overlap
        // Use coreSeq if available, otherwise extract from reverse complemented sequence
        let r1CoreSeq;
        if (result.R.coreSeq) {
          // Core sequence is already in forward direction (from designCore)
          r1CoreSeq = result.R.coreSeq;
        } else {
          const r1Forward = Core.reverseComplementSeq(result.R.seq);
          r1CoreSeq = r1Forward.slice(0, result.R.coreLen || 0);
        }
        // Search at the end of fragment i (before overlap)
        // R1 core is at the end of fragment i, before the overlap region
        const fragEnd = currentPos + fragLen;
        const r1OverlapLen = result.R.overlapLen || 0;
        const r1CoreLen = result.R.coreLen || 0;
        // Core should be right before overlap, so search from (fragEnd - overlapLen - coreLen - margin) to (fragEnd - overlapLen)
        const searchEnd = fragEnd - r1OverlapLen;
        const searchStart = Math.max(currentPos, searchEnd - r1CoreLen - 50); // Wider margin to ensure we find it
        markCoreBySequence(r1CoreSeq, searchStart, searchEnd, r1CorePositions);
      }
      
      currentPos += fragLen;
      
      // Add linker if present
      if (i < linkers.length && linkers[i]) {
        currentPos += linkers[i].length;
      }
      
      // F2 (forward primer for fragment i+1, connects from fragment i)
      if (i < primerResults.length - 1 && primerResults[i + 1].F) {
        const f2Result = primerResults[i + 1];
        // Use coreSeq if available, otherwise extract from primer sequence
        const f2CoreSeq = f2Result.F.coreSeq || f2Result.F.seq.slice(f2Result.F.overlapLen || 0, (f2Result.F.overlapLen || 0) + (f2Result.F.coreLen || 0));
        // Search at the start of fragment i+1 (after overlap)
        // F2 = overlap + core, so core is at the start of fragment i+1, after the overlap
        const f2FragLen = primerResults[i + 1].fragment.seq.length;
        const f2OverlapLen = f2Result.F.overlapLen || 0;
        const f2CoreLen = f2Result.F.coreLen || 0;
        // Core should be right after overlap, so search from (currentPos + overlapLen) to (currentPos + overlapLen + coreLen + margin)
        const searchStart = currentPos + f2OverlapLen;
        const searchEnd = Math.min(currentPos + f2FragLen, searchStart + f2CoreLen + 50); // Wider margin to ensure we find it
        markCoreBySequence(f2CoreSeq, searchStart, searchEnd, f2CorePositions);
      }
    }
    
    // RN (last fragment reverse primer)
    if (primerResults.length > 0) {
      const lastResult = primerResults[primerResults.length - 1];
      if (lastResult.R) {
        // Find the start position of the last fragment
        let lastFragStart = 0;
        for (let i = 0; i < primerResults.length - 1; i++) {
          lastFragStart += primerResults[i].fragment.seq.length;
          if (i < linkers.length && linkers[i]) {
            lastFragStart += linkers[i].length;
          }
        }
        
        // RN = revComp(core + overlap), so RN forward = core + overlap
        // Use coreSeq if available, otherwise extract from reverse complemented sequence
        let rnCoreSeq;
        if (lastResult.R.coreSeq) {
          // Core sequence is already in forward direction (from designCore)
          rnCoreSeq = lastResult.R.coreSeq;
        } else {
          const rnForward = Core.reverseComplementSeq(lastResult.R.seq);
          rnCoreSeq = rnForward.slice(0, lastResult.R.coreLen || 0);
        }
        // Search at the end of last fragment (before overlap)
        const lastFragLen = lastResult.fragment.seq.length;
        const lastFragEnd = lastFragStart + lastFragLen;
        const searchEnd = lastFragEnd - (lastResult.R.overlapLen || 0);
        const searchStart = Math.max(lastFragStart, searchEnd - (lastResult.R.coreLen || 0) - 50); // Wider margin
        markCoreBySequence(rnCoreSeq, searchStart, searchEnd, rnCorePositions);
      }
    }
    
    // Build highlighted sequence with HTML
    // Different primers use different underline styles
    let highlightedSeq = `>${header}\n`;
    let linePos = 0;
    
    for (let i = 0; i < seq.length; i++) {
      const char = seq[i];
      let charHtml = char;
      
      // Check which primer core regions this position belongs to
      const isF1 = f1CorePositions.has(i);
      const isR1 = r1CorePositions.has(i);
      const isF2 = f2CorePositions.has(i);
      const isRN = rnCorePositions.has(i);
      
      // Determine style based on which primers overlap at this position
      if (isF1 || isR1 || isF2 || isRN) {
        let style = '';
        
        // If multiple primers overlap, combine styles
        if (isR1 && isF2) {
          // R1 and F2 overlap: double underline (thicker)
          style = 'text-decoration: underline; border-bottom: 2px solid currentColor;';
        } else if (isR1) {
          // R1 only: double underline
          style = 'text-decoration: underline; border-bottom: 2px solid currentColor;';
        } else if (isF2) {
          // F2 only: dotted underline
          style = 'text-decoration: underline; border-bottom: 1px dotted currentColor;';
        } else if (isF1) {
          // F1 only: single underline
          style = 'text-decoration: underline;';
        } else if (isRN) {
          // RN only: wavy underline
          style = 'text-decoration: underline; border-bottom: 1px wavy currentColor;';
        }
        
        charHtml = `<strong style="${style}">${char}</strong>`;
      }
      
      highlightedSeq += charHtml;
      linePos++;
      
      // Add line break every 70 characters
      if (linePos >= 70) {
        highlightedSeq += '\n';
        linePos = 0;
      }
    }
    
    // Add final newline if needed
    if (linePos > 0) {
      highlightedSeq += '\n';
    }
    
    return highlightedSeq;
  }
  
  // For display: format as FASTA with highlights
  const seqDisplayFASTA = formatFASTAWithHighlights(assembledSeq, fastaHeader, primerResults, linkers);
  
  // Create header with info
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
  headerDiv.innerHTML = `
    <strong>Assembled Sequence:</strong>
    <div class="aside">
      Total length: ${assembledSeq.length} bp
      ${linkerInfo.length > 0 ? ` | ${linkerInfo.length} linker(s) included` : ''}
    </div>
  `;
  assembledDiv.appendChild(headerDiv);
  
  // Create button container
  const btnContainer = document.createElement('div');
  btnContainer.className = 'row';
  btnContainer.style.cssText = 'margin-bottom: 12px;';
  
  // Create toggle button to show/hide sequence
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn ghost';
  toggleBtn.textContent = 'Show Sequence';
  const seqDisplayDiv = document.createElement('div');
  seqDisplayDiv.className = 'mono';
  seqDisplayDiv.style.cssText = 'margin-top: 8px; display: none; white-space: pre-wrap; word-break: break-all; font-family: monospace; font-size: 0.875rem; line-height: 1.5;';
  seqDisplayDiv.id = 'assembled-seq-display';
  seqDisplayDiv.innerHTML = seqDisplayFASTA;  // Use innerHTML to render HTML highlights
  
  let isVisible = false;
  toggleBtn.onclick = () => {
    isVisible = !isVisible;
    if (isVisible) {
      seqDisplayDiv.style.display = 'block';
      toggleBtn.textContent = 'Hide Sequence';
    } else {
      seqDisplayDiv.style.display = 'none';
      toggleBtn.textContent = 'Show Sequence';
    }
  };
  btnContainer.appendChild(toggleBtn);

  // Create download dropdown and button
  const downloadContainer = document.createElement('div');
  downloadContainer.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const downloadSelect = document.createElement('select');
  downloadSelect.id = 'download-type-select';
  downloadSelect.className = 'ghost btn';
  downloadSelect.style.cssText = 'min-width:140px;width:auto;border:1px solid var(--line);color:#0b1220;background:#ffffff';
  downloadSelect.innerHTML = `
    <option value="primers">primers.txt</option>
    <option value="fasta">assembled.fasta</option>
  `;
  downloadContainer.appendChild(downloadSelect);

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn ghost';
  downloadBtn.textContent = 'Download';
  downloadContainer.appendChild(downloadBtn);
  btnContainer.appendChild(downloadContainer);

  downloadBtn.onclick = () => {
    const selectedType = downloadSelect.value;

    if (selectedType === 'fasta') {
      downloadAssembledFASTA();
    } else if (selectedType === 'primers') {
      downloadPrimersTXT();
    }
  };
  
  assembledDiv.appendChild(btnContainer);
  assembledDiv.appendChild(seqDisplayDiv);
  contentDiv.appendChild(assembledDiv);
  
  // Show primers table
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Fragment</th>
      <th>Primer</th>
      <th>Sequence (5'→3')</th>
      <th style="text-align:center;">Len</th>
      <th style="text-align:center;">GC%</th>
      <th style="text-align:center;">Core Tm</th>
      <th style="text-align:center;">Overlap Tm</th>
      <th style="text-align:center;">Homopolymer</th>
      <th style="text-align:center;">Hairpin</th>
      <th style="text-align:center;">Self-dimer</th>
      <th style="text-align:center;">Cross-dimer</th>
    </tr>
  `;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  
  for (let i = 0; i < primerResults.length; i++) {
    const result = primerResults[i];
    const fragName = result.fragment.name || `Fragment ${i + 1}`;
    const conc_nM = parseFloat($('primer-conc').value) || 500;
    const na_mM = parseFloat($('na-conc').value) || 50;
    const mg_mM = parseFloat($('mg-conc').value) || 0;
    
    // Forward primer
    if (result.F) {
      const qc = runPrimerQC(result.F.seq, 60, conc_nM, na_mM, mg_mM);
      const qcLabel = getQCLabel(qc);
      
      const tr = document.createElement('tr');
      const coreTmStr = result.F.coreTm !== null && result.F.coreTm !== undefined ? result.F.coreTm.toFixed(1) : '-';
      const overlapTmStr = result.F.overlapTm !== null && result.F.overlapTm !== undefined ? result.F.overlapTm.toFixed(1) : '-';
      
      let crossDimerCell = '';
      if (result.R) {
        const crossDimerLabel = getCrossDimerLabel(result.F.seq, result.R.seq);
        const crossDimerBadge = `<span class="badge ${crossDimerLabel.cls}">${crossDimerLabel.label}</span>`;
        crossDimerCell = `<td rowspan="2" style="text-align:center; vertical-align:middle;">${crossDimerBadge}</td>`;
      }
      
      // Format sequence with overlap in bold
      // For long linker: F2 = linkerBack + core, overlap is linkerOverlap at the beginning of linkerBack
      // For short linker: F2 = leftPart + backHalfLinker + core, overlap is leftPart + linker + rightPart
      let seqDisplay = result.F.seq;
      if (result.F.isLongLinker && result.F.linkerOverlap) {
        // Long linker strategy: find linkerOverlap in the primer sequence
        // F2 = linkerBack + core, where linkerBack starts with linkerOverlap
        const linkerOverlap = result.F.linkerOverlap;
        const seq = result.F.seq;
        const overlapStart = seq.indexOf(linkerOverlap);
        if (overlapStart >= 0) {
          const overlapEnd = overlapStart + linkerOverlap.length;
          const before = seq.slice(0, overlapStart);
          const overlap = seq.slice(overlapStart, overlapEnd);
          const after = seq.slice(overlapEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        }
      } else if (result.F.leftPart && result.F.rightPart) {
        // Short linker strategy: overlap = leftPart + linker + rightPart
        const leftPart = result.F.leftPart;
        const rightPart = result.F.rightPart;
        const seq = result.F.seq;
        
        // Find leftPart at the beginning
        let leftStart = seq.indexOf(leftPart);
        let leftEnd = leftStart >= 0 ? leftStart + leftPart.length : 0;
        
        // Find rightPart (may be in core)
        let rightStart = seq.indexOf(rightPart, leftEnd);
        let rightEnd = rightStart >= 0 ? rightStart + rightPart.length : seq.length;
        
        if (leftStart >= 0 && rightStart >= 0) {
          // Both parts found: bold and italic the entire overlap region
          const before = seq.slice(0, leftStart);
          const overlap = seq.slice(leftStart, rightEnd);
          const after = seq.slice(rightEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        } else if (leftStart >= 0) {
          // Only leftPart found: bold and italic it
          const before = seq.slice(0, leftStart);
          const overlap = seq.slice(leftStart, leftEnd);
          const after = seq.slice(leftEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        }
      } else if (result.F.overlapLen && result.F.overlapLen > 0) {
        // Fallback: use overlapLen if leftPart/rightPart not available
        const overlapSeq = result.F.seq.slice(0, result.F.overlapLen);
        const coreSeq = result.F.seq.slice(result.F.overlapLen);
        seqDisplay = `<strong><em>${overlapSeq}</em></strong>${coreSeq}`;
      }
      
      tr.innerHTML = `
        <td rowspan="${result.R ? '2' : '1'}" class="fragment-name">${fragName}</td>
        <td><strong>${fragName}-F</strong></td>
        <td class="mono" style="text-align: left;"><code style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${seqDisplay}</code></td>
        <td style="text-align:center;">${result.F.len}</td>
        <td style="text-align:center;">${result.F.gc.toFixed(1)}%</td>
        <td style="text-align:center;">${coreTmStr}</td>
        <td style="text-align:center;">${overlapTmStr}</td>
        <td style="text-align:center;"><span class="badge ${qcLabel.homo.cls}">${qcLabel.homo.label}</span></td>
        <td style="text-align:center;"><span class="badge ${qcLabel.hp.cls}">${qcLabel.hp.label}</span></td>
        <td style="text-align:center;"><span class="badge ${qcLabel.sd.cls}">${qcLabel.sd.label}</span></td>
        ${crossDimerCell}
      `;
      tbody.appendChild(tr);
    }
    
    // Reverse primer
    if (result.R) {
      const qc = runPrimerQC(result.R.seq, 60, conc_nM, na_mM, mg_mM);
      const qcLabel = getQCLabel(qc);
      
      const tr = document.createElement('tr');
      const coreTmStr = result.R.coreTm !== null && result.R.coreTm !== undefined ? result.R.coreTm.toFixed(1) : '-';
      const overlapTmStr = result.R.overlapTm !== null && result.R.overlapTm !== undefined ? result.R.overlapTm.toFixed(1) : '-';
      
      // Format sequence with overlap in bold
      // For RN (last fragment): check userROverlap first (added to 5' end)
      // For long linker: R1 = revComp(core + linkerFront), overlap is linkerOverlap at the end of linkerFront
      // For short linker: R1 = revComp(core + frontHalfLinker + rightPart), overlap is leftPart + linker + rightPart
      let seqDisplay = result.R.seq;
      if (result.R.userROverlap) {
        // User-provided R overlap sequence: it's at the 5' end of RN (beginning of sequence)
        // userROverlap is the original input (not RC), which appears at RN's 5' end
        const userROverlap = result.R.userROverlap;
        const overlapLen = userROverlap.length;
        if (result.R.seq.length >= overlapLen) {
          const overlap = result.R.seq.slice(0, overlapLen);
          const coreSeq = result.R.seq.slice(overlapLen);
          seqDisplay = `<strong><em>${overlap}</em></strong>${coreSeq}`;
        }
      } else if (result.R.isLongLinker && result.R.linkerOverlap) {
        // Long linker strategy: find linkerOverlap in the primer sequence
        // R1 = revComp(core + linkerFront), where linkerFront ends with linkerOverlap
        // Reverse complement R1 to get forward sequence: r1Forward = core + linkerFront
        const linkerOverlap = result.R.linkerOverlap;
        const r1Forward = Core.reverseComplementSeq(result.R.seq);
        const overlapStart = r1Forward.lastIndexOf(linkerOverlap);
        if (overlapStart >= 0) {
          const overlapEnd = overlapStart + linkerOverlap.length;
          // Map from forward sequence to R1 (reverse complemented)
          const forwardLen = r1Forward.length;
          const r1OverlapEnd = forwardLen - overlapStart;  // overlap start in forward -> overlap end in R1
          const r1OverlapStart = forwardLen - overlapEnd;  // overlap end in forward -> overlap start in R1
          
          const before = result.R.seq.slice(0, r1OverlapStart);
          const overlap = result.R.seq.slice(r1OverlapStart, r1OverlapEnd);
          const after = result.R.seq.slice(r1OverlapEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        }
      } else if (result.R.leftPart && result.R.rightPart) {
        // Short linker strategy: overlap = leftPart + linker + rightPart
        const leftPart = result.R.leftPart;
        const rightPart = result.R.rightPart;
        const seq = result.R.seq;
        
        // Reverse complement R1 back to forward sequence: r1Forward = core + frontHalfLinker + rightPart
        const r1Forward = Core.reverseComplementSeq(seq);
        
        // Find leftPart and rightPart in the forward sequence
        // rightPart should be at the end of forward sequence (R1 contains rightPart)
        // leftPart may be in core (at the end of core, before rightPart)
        let rightStart = r1Forward.lastIndexOf(rightPart);
        let rightEnd = rightStart >= 0 ? rightStart + rightPart.length : -1;
        
        // Find leftPart before rightPart (may overlap with core)
        let leftStart = rightStart >= 0 ? r1Forward.lastIndexOf(leftPart, rightStart) : r1Forward.lastIndexOf(leftPart);
        let leftEnd = leftStart >= 0 ? leftStart + leftPart.length : -1;
        
        if (leftStart >= 0 && rightStart >= 0 && leftEnd <= rightStart) {
          // Both parts found in forward sequence, leftPart before rightPart
          // Map positions from forward sequence to R1 (reverse complemented)
          const forwardLen = r1Forward.length;
          const forwardOverlapStart = leftStart;
          const forwardOverlapEnd = rightEnd;
          
          // Convert to R1 positions (reverse order)
          const r1OverlapEnd = forwardLen - forwardOverlapStart;
          const r1OverlapStart = forwardLen - forwardOverlapEnd;
          
          const before = seq.slice(0, r1OverlapStart);
          const overlap = seq.slice(r1OverlapStart, r1OverlapEnd);
          const after = seq.slice(r1OverlapEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        } else if (rightStart >= 0) {
          // Only rightPart found: it's at the end of forward sequence, so at the beginning of R1
          const forwardRightLen = rightPart.length;
          const r1RightEnd = forwardRightLen;
          
          const before = seq.slice(0, 0);
          const overlap = seq.slice(0, r1RightEnd);
          const after = seq.slice(r1RightEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        } else if (leftStart >= 0) {
          // Only leftPart found: find its position in R1
          const forwardLeftLen = leftPart.length;
          const forwardLeftEnd = leftStart + forwardLeftLen;
          const forwardLen = r1Forward.length;
          
          const r1LeftStart = forwardLen - forwardLeftEnd;
          const r1LeftEnd = forwardLen - leftStart;
          
          const before = seq.slice(0, r1LeftStart);
          const overlap = seq.slice(r1LeftStart, r1LeftEnd);
          const after = seq.slice(r1LeftEnd);
          seqDisplay = `${before}<strong><em>${overlap}</em></strong>${after}`;
        }
      } else if (result.R.overlapLen && result.R.overlapLen > 0) {
        // Fallback: use overlapLen if leftPart/rightPart not available
        const coreSeq = result.R.seq.slice(0, result.R.seq.length - result.R.overlapLen);
        const overlapSeq = result.R.seq.slice(result.R.seq.length - result.R.overlapLen);
        seqDisplay = `${coreSeq}<strong><em>${overlapSeq}</em></strong>`;
      }
      
      tr.innerHTML = `
        <td><strong>${fragName}-R</strong></td>
        <td class="mono" style="text-align: left;"><code style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${seqDisplay}</code></td>
        <td style="text-align:center;">${result.R.len}</td>
        <td style="text-align:center;">${result.R.gc.toFixed(1)}%</td>
        <td style="text-align:center;">${coreTmStr}</td>
        <td style="text-align:center;">${overlapTmStr}</td>
        <td style="text-align:center;"><span class="badge ${qcLabel.homo.cls}">${qcLabel.homo.label}</span></td>
        <td style="text-align:center;"><span class="badge ${qcLabel.hp.cls}">${qcLabel.hp.label}</span></td>
        <td style="text-align:center;"><span class="badge ${qcLabel.sd.cls}">${qcLabel.sd.label}</span></td>
      `;
      tbody.appendChild(tr);
    }
  }
  
  table.appendChild(tbody);
  contentDiv.appendChild(table);
  
  console.log('Adding show class to results div');
  resultsDiv.style.display = 'block';
  resultsDiv.classList.add('show');
  console.log('Results should now be visible');
}

function onDesignClick() {
  console.log('onDesignClick called');
  const tbody = $('fragment-rows');
  if (!tbody) {
    console.error('fragment-rows tbody not found');
    alert('Error: Fragment table not found. Please refresh the page.');
    return;
  }
  const rows = tbody.querySelectorAll('tr');
  if (!rows || rows.length === 0) {
    alert('No fragments found. Please add at least one fragment.');
    return;
  }

  const mwContainer = document.getElementById('module-content') || document.body;
  if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
    const seqEls = Array.from(rows).map((row) => row.querySelector('textarea[id^="frag-seq-"]')).filter(Boolean);
    const shown = VIZ.guardSingleFastaPerField(mwContainer, seqEls, () => {
      window.setTimeout(() => { onDesignClick(); }, 0);
    });
    if (shown) return;
  }
  
  const fragments = [];
  const linkers = [];
  
  // First, collect all fragments with valid sequences
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = row.id.replace('fragment-row-', '');
    
    // Extract name from FASTA or use default
    const seqInput = row.querySelector(`#frag-seq-${rowId}`)?.value || '';
    const fastaName = extractFASTAHeader(seqInput);
    const name = fastaName || `Fragment ${i + 1}`;
    
    const seq = cleanDNA(seqInput);
    
    // Only add fragments with valid sequences
    if (seq && seq.length > 0) {
      fragments.push({ name, seq });
      
      // Process linker: use button selection to determine type
      if (i < rows.length - 1) {
        // Linker between fragments (not the last one)
        const linkerInput = row.querySelector(`#frag-linker-${rowId}`)?.value?.trim() || '';
        let linker = '';
        
        if (linkerInput) {
          const linkerTypeBtn = row.querySelector(`#linker-type-btn-${rowId}`);
          const linkerType = linkerTypeBtn?.getAttribute('data-type') || 'DNA';
          
          if (linkerType === 'AA') {
            // Get host organism from this row's selector
            const hostOrganismSelect = row.querySelector(`#host-organism-${rowId}`);
            const hostCode = hostOrganismSelect?.value || 's_cerevisiae';
            
            // Sanitize AA linker
            const { cleaned, ignoredList, ignoredTotal } = sanitizeAALinker(linkerInput);
            if (ignoredTotal > 0) {
              const lines = ignoredList.map(x => `• '${x.ch}' × ${x.n}`).join('\n');
              const msg = `AA linker contains illegal character(s).\nIgnored characters (count):\n${lines}\n\nCancel: go back and edit.\nOK: ignore and continue — all non-amino acid characters will be automatically removed.`;
              const container = document.getElementById('module-content') || document.body;
              window.VIZ && window.VIZ.showMWModal(container, msg, () => {
                const el = row.querySelector(`#frag-linker-${rowId}`);
                if (el) el.value = cleaned;
                try {
                  const dna = aaToDNA(cleaned, hostCode);
                  linker = dna;
                  setTimeout(onDesignClick, 0);
                } catch (e) {
                  window.VIZ && window.VIZ.showMWModal(container, `Error converting amino acid linker for Fragment ${i + 1}: ${e.message}`);
                }
              }, () => {
                const el = row.querySelector(`#frag-linker-${rowId}`);
                if (el) el.focus();
              });
              return;
            }
            // Convert amino acid to DNA using round-robin
            try {
              linker = aaToDNA(cleaned, hostCode);
            } catch (e) {
              const container = document.getElementById('module-content') || document.body;
              window.VIZ && window.VIZ.showMWModal(container, `Error converting amino acid linker for Fragment ${i + 1}: ${e.message}`);
              return;
            }
          } else {
            // Treat as DNA sequence
            linker = cleanDNA(linkerInput);
          }
        }
        
        linkers.push(linker);
      }
    }
  }
  
  // Check if we have at least 2 valid fragment sequences
  if (fragments.length < 2) {
    const container = document.getElementById('module-content') || document.body;
    window.VIZ && window.VIZ.showMWModal(container, 'Please input at least 2 fragment sequences for Overlap PCR.');
    return;
  }
  
  // Get parameters
  const coreTm = parseFloat($('core-tm').value) || 60;
  const overlapTm = parseFloat($('overlap-tm').value) || 60;
  const conc_nM = parseFloat($('primer-conc').value) || 500;
  const na_mM = parseFloat($('na-conc').value) || 50;
  const mg_mM = parseFloat($('mg-conc').value) || 0;
  const userFOverlap = ($('f-overlap-seq').value || '').trim();
  
  // Get userROverlap from R overlap sequence input OR from last fragment's linker
  let userROverlap = ($('r-overlap-seq').value || '').trim();
  
  // Check if last fragment has a linker input (for C-terminal tag)
  const lastRow = rows[rows.length - 1];
  const lastRowId = lastRow.id.replace('fragment-row-', '');
  const lastLinkerInput = lastRow.querySelector(`#frag-linker-${lastRowId}`)?.value?.trim() || '';
  
  if (lastLinkerInput) {
    const lastLinkerTypeBtn = lastRow.querySelector(`#linker-type-btn-${lastRowId}`);
    const lastLinkerType = lastLinkerTypeBtn?.getAttribute('data-type') || 'DNA';
    let lastLinker = '';
    
    if (lastLinkerType === 'AA') {
      // Get host organism from last row's selector
      const hostOrganismSelect = lastRow.querySelector(`#host-organism-${lastRowId}`);
      const hostCode = hostOrganismSelect?.value || 's_cerevisiae';
      
      // Sanitize AA linker
      const { cleaned, ignoredList, ignoredTotal } = sanitizeAALinker(lastLinkerInput);
      if (ignoredTotal > 0) {
        const lines = ignoredList.map(x => `• '${x.ch}' × ${x.n}`).join('\n');
        const msg = `AA linker contains illegal character(s).\nIgnored characters (count):\n${lines}\n\nCancel: go back and edit.\nOK: ignore and continue — all non-amino acid characters will be automatically removed.`;
        const container = document.getElementById('module-content') || document.body;
        window.VIZ && window.VIZ.showMWModal(container, msg, () => {
          const el = lastRow.querySelector(`#frag-linker-${lastRowId}`);
          if (el) el.value = cleaned;
          try {
            const dna = aaToDNA(cleaned, hostCode);
            lastLinker = dna;
            setTimeout(onDesignClick, 0);
          } catch (e) {
            window.VIZ && window.VIZ.showMWModal(container, `Error converting amino acid linker for last fragment: ${e.message}`);
          }
        }, () => {
          const el = lastRow.querySelector(`#frag-linker-${lastRowId}`);
          if (el) el.focus();
        });
        return;
      }
      // Convert amino acid to DNA using round-robin
      try {
        lastLinker = aaToDNA(cleaned, hostCode);
      } catch (e) {
        window.VIZ && window.VIZ.showMWModal(container, `Error converting amino acid linker for last fragment: ${e.message}`);
        return;
      }
    } else {
      // Treat as DNA sequence
      lastLinker = cleanDNA(lastLinkerInput);
    }
    
    // If both R overlap input and last fragment linker exist, combine them (last fragment linker first, then R overlap)
    // Otherwise, use whichever is available
    if (userROverlap) {
      userROverlap = lastLinker + userROverlap;
    } else {
      userROverlap = lastLinker;
    }
  }
  
  const opts = {
    coreTargetTm: coreTm,
    overlapTargetTm: overlapTm,
    conc_nM,
    na_mM,
    mg_mM,
    userFOverlap,
    userROverlap
  };
  
  console.log('Fragments:', fragments);
  console.log('Linkers:', linkers);
  console.log('Options:', opts);
  
  const container = document.getElementById('module-content') || document.body;
  const warnings = [];
  if (window.VIZ && window.VIZ.validateSequenceInput) {
    const seqs = Array.from(rows).map((row, i) => {
      const rowId = row.id.replace('fragment-row-', '');
      const raw = row.querySelector(`#frag-seq-${rowId}`)?.value || '';
      const label = extractFASTAHeader(raw) || `Fragment ${i + 1}`;
      const body = stripFASTAHeaders(raw);
      return { label, seq: body };
    });
    warnings.push(...window.VIZ.validateSequenceInput(seqs, 'Fragment'));
  }
  if (window.VIZ && window.VIZ.validateParameterRange) {
    warnings.push(...window.VIZ.validateParameterRange({ Na: na_mM, Mg: mg_mM, conc: conc_nM, targetTm: coreTm }));
  }
  if (window.VIZ && window.VIZ.validateOverlapLength) {
    if (userFOverlap && userFOverlap.length) {
      warnings.push(...window.VIZ.validateOverlapLength(userFOverlap.length, 15, 30).map(w => ({ id: 'OE-F-OVERLAP', message: w.message })));
    }
    if (userROverlap && userROverlap.length) {
      warnings.push(...window.VIZ.validateOverlapLength(userROverlap.length, 15, 30).map(w => ({ id: 'OE-R-OVERLAP', message: w.message })));
    }
  }
  const proceed = () => {
    try {
      const primerResults = designMultiFragmentPrimers(fragments, linkers, opts);
      renderResults(primerResults, linkers);
    } catch (e) {
      alert('Error designing primers: ' + (e.message || e));
    }
  };
  if (warnings.length && window.VIZ && window.VIZ.showMWWarnings) {
    window.VIZ.showMWWarnings(container, warnings, proceed, () => {});
  } else {
    proceed();
  }
}

// ==================== Download Functions ====================

function downloadPrimersTXT() {
  if (!window.currentPrimerResults || !Array.isArray(window.currentPrimerResults) || window.currentPrimerResults.length === 0) {
    alert('No primers available. Please design primers first.');
    return;
  }
  
  let fasta = '';
  
  window.currentPrimerResults.forEach((result, i) => {
    const fragmentName = result.fragment.name || `Fragment ${i + 1}`;
    
    if (result.F && result.F.seq) {
      const labelF = `${fragmentName}-F`;
      fasta += `>${labelF}\n`;
      const fwdSeq = result.F.seq;
      const formattedSeq = fwdSeq.replace(/(.{80})/g, '$1\n') + (fwdSeq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
    
    if (result.R && result.R.seq) {
      const labelR = `${fragmentName}-R`;
      fasta += `>${labelR}\n`;
      const revSeq = result.R.seq;
      const formattedSeq = revSeq.replace(/(.{80})/g, '$1\n') + (revSeq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
  });
  
  const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const name = window.currentAssembledName || 'OE_primers';
  a.href = URL.createObjectURL(blob);
  a.download = name + '_primers.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function downloadAssembledFASTA() {
  if (!window.currentAssembledSeq) {
    alert('Assembled sequence is not available. Please design primers first.');
    return;
  }
  
  const seq = Core.normalizeSeq(window.currentAssembledSeq);
  const name = window.currentAssembledName || 'OE_assembled';
  
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

// ==================== Initialization ====================

function initOEPCRModule() {
  if (typeof window !== 'undefined') {
    window.VIZ = VIZ;
  }
  // Check if elements exist (for both standalone and embedded modes)
  if (!$('fragment-rows')) {
    // If elements don't exist yet, wait a bit and try again
    setTimeout(initOEPCRModule, 100);
    return;
  }
  
  initializeFragmentRows();
  // populateHostSelect() is no longer needed here since each row has its own selector
  
  const addBtn = $('add-fragment-row');
  if (addBtn) {
    // Remove existing listeners by cloning the button
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    newAddBtn.addEventListener('click', () => {
      createFragmentRow();
      updateMoveButtons();
    });
  }
  
  // Toggle linker column visibility
  const toggleLinkerBtn = $('toggle-linker');
  if (toggleLinkerBtn) {
    // Remove existing listeners by cloning the button (module DOM may be re-injected)
    const newToggleBtn = toggleLinkerBtn.cloneNode(true);
    toggleLinkerBtn.parentNode.replaceChild(newToggleBtn, toggleLinkerBtn);

    // Ensure the control is clickable even if it was accidentally disabled by the host
    newToggleBtn.disabled = false;
    newToggleBtn.removeAttribute('disabled');
    newToggleBtn.style.pointerEvents = 'auto';

    // Initialize state from DOM (in case module is re-entered)
    const anyVisible = Array.from(document.querySelectorAll('.linker-column'))
      .some(col => (col instanceof HTMLElement) && col.style.display !== 'none');
    oeLinkerVisible = anyVisible;
    newToggleBtn.textContent = oeLinkerVisible ? 'Hide Linker' : 'Show Linker';

    newToggleBtn.addEventListener('click', () => {
      oeLinkerVisible = !oeLinkerVisible;
      const linkerColumns = document.querySelectorAll('.linker-column');
      
      linkerColumns.forEach(col => {
        col.style.display = oeLinkerVisible ? 'table-cell' : 'none';
      });
      
      // Column widths remain constant: 2% (#) + 65% (DNA) + 30% (Linker) + 3% (Action) = 100%
      // The linker column visibility is controlled by display property only
      
      newToggleBtn.textContent = oeLinkerVisible ? 'Hide Linker' : 'Show Linker';
    });
  }

  // Demo Set button: load 2 inserts, show linker, set linker value and host
  const demoSetBtn = $('demo-set-btn');
  if (demoSetBtn) {
    demoSetBtn.addEventListener('click', async () => {
      const demos = await loadOeDemoSequences();
      if (!demos.length) return;
      if (demos.length < 2) {
        showOeWarning('Demo needs at least 2 inserts (found ' + demos.length + ').');
        return;
      }

      // Ensure at least 2 rows exist
      const tbody = $('fragment-rows');
      while (tbody.querySelectorAll('tr').length < 2) {
        createFragmentRow();
      }

      // Fill first 2 rows with demo data
      const rows = tbody.querySelectorAll('tr');
      const applyFragment = (row, sample) => {
        const ta = row.querySelector('textarea[id^="frag-seq-"]');
        if (ta) ta.value = `>${sample.header}\n${sample.seq}`;
        const hostSel = row.querySelector('select[id^="host-organism-"]');
        if (hostSel) hostSel.value = 's_cerevisiae';
      };
      applyFragment(rows[0], demos[0]);
      applyFragment(rows[1], demos[1]);

      // Show linker by simulating toggle button click (if not already visible)
      if (toggleLinkerBtn && toggleLinkerBtn.textContent === 'Show Linker') {
        toggleLinkerBtn.click();
      }

      // Set linker value for first fragment
      const linkerInput = document.getElementById('frag-linker-1');
      if (linkerInput) linkerInput.value = 'GSGSGS';
    });
  }
  
  const designBtn = $('design-btn');
  if (designBtn) {
    console.log('Design button found, binding event listener');
    // Remove existing listeners by cloning the button
    const newDesignBtn = designBtn.cloneNode(true);
    designBtn.parentNode.replaceChild(newDesignBtn, designBtn);
    newDesignBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Design button clicked');
      try {
        onDesignClick();
      } catch (error) {
        console.error('Error in onDesignClick:', error);
        alert('Error designing primers: ' + (error.message || error));
      }
    });
  } else {
    console.error('Design button not found!');
  }
  
  const clearBtn = $('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Clear results and hide the results area
      const resultsDiv = $('results');
      const contentDiv = $('results-content');
      if (resultsDiv) {
        resultsDiv.classList.remove('show');
        resultsDiv.style.display = 'none';  // Explicitly hide to collapse space
      }
      if (contentDiv) {
        contentDiv.innerHTML = '';
      }
    });
  }
  
  const flipOrderBtn = $('flip-order');
  if (flipOrderBtn) {
    // Remove existing listeners by cloning the button
    const newFlipOrderBtn = flipOrderBtn.cloneNode(true);
    flipOrderBtn.parentNode.replaceChild(newFlipOrderBtn, flipOrderBtn);
    newFlipOrderBtn.addEventListener('click', () => {
      const tbody = $('fragment-rows');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (rows.length < 2) return;
      // Reverse the order
      rows.reverse().forEach(row => tbody.appendChild(row));
      updateRowNumbers();
      updateMoveButtons();
    });
  }
  
  // Reset button
  const resetBtn = $('global-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Full page refresh to reset state
      window.location.reload();
    });
  }


  
  // Make functions globally available
  window.removeFragmentRow = removeFragmentRow;
  window.moveFragmentRowUp = moveFragmentRowUp;
  window.moveFragmentRowDown = moveFragmentRowDown;
}

// Support both DOMContentLoaded (standalone) and manual initialization (embedded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOEPCRModule);
} else {
  // DOM already loaded, initialize immediately
  initOEPCRModule();
}

// Export for manual initialization
if (typeof window !== 'undefined') {
  window.initOEPCRModule = initOEPCRModule;
}
