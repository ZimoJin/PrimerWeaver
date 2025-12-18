/**
 * bio_visuals.js
 * Pure rendering logic. 
 * Refactored to match V3.3 visuals exactly.
 * * V4.32 Update:
 * - Fixed ReferenceError for legend generation.
 * - Legend now correctly pulls lane data from GGX_STATE.
 */

// --- 1. Vector Map Renderer (Kept same) ---
export function drawVectorMap(canvasId, seqLen, name, annotations = [], rotationDeg = 0) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const R_plasmid = Math.min(W, H) / 2 - 55;
  const rotRad = (rotationDeg * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(cx, cy, R_plasmid, 0, 2 * Math.PI);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();
  const regions = annotations.filter(a => a.start !== undefined);
  regions.forEach(f => {
    const startAng = (f.start / seqLen) * 2 * Math.PI - Math.PI / 2 + rotRad;
    const endAng = (f.end / seqLen) * 2 * Math.PI - Math.PI / 2 + rotRad;
    ctx.beginPath();
    ctx.arc(cx, cy, R_plasmid, startAng, endAng);
    ctx.lineWidth = 8;
    ctx.strokeStyle = f.color || '#3b82f6';
    ctx.stroke();

    // Draw feature name at the middle of the arc (similar to Golden_Gate_v3.3)
    if (f.name) {
      const midAng = (startAng + endAng) / 2;
      const labelX = cx + Math.cos(midAng) * (R_plasmid - 18);
      const labelY = cy + Math.sin(midAng) * (R_plasmid - 18);
      ctx.save();
      ctx.translate(labelX, labelY);
      ctx.fillStyle = f.color || '#3b82f6';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.name, 0, 0);
      ctx.restore();
    }
  });
  const cuts = annotations.filter(a => a.start === undefined);
  const items = cuts.map(a => {
    const angle = (a.pos / seqLen) * 2 * Math.PI - Math.PI / 2 + rotRad;
    return { ...a, angle, cutX: cx + Math.cos(angle) * (R_plasmid + 6), cutY: cy + Math.sin(angle) * (R_plasmid + 6), sortY: cy + Math.sin(angle) * R_plasmid };
  });
  const rightSide = items.filter(i => Math.cos(i.angle) >= 0).sort((a, b) => a.sortY - b.sortY);
  const leftSide = items.filter(i => Math.cos(i.angle) < 0).sort((a, b) => a.sortY - b.sortY);
  const layoutSide = (list, isRight) => {
    if (!list.length) return;
    const xDir = isRight ? 1 : -1;
    const totalH = H * 0.8;
    const startY = (H - totalH) / 2;
    list.forEach((item, i) => {
      const t = list.length > 1 ? i / (list.length - 1) : 0.5;
      item.labelY = startY + t * totalH;
      item.labelY = item.labelY * 0.6 + item.cutY * 0.4;
    });
    for (let k = 0; k < 8; k++) {
      for (let i = 1; i < list.length; i++) {
        if (list[i].labelY < list[i - 1].labelY + 16) { list[i].labelY = list[i - 1].labelY + 16; }
      }
    }
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    list.forEach(s => {
      const dy = s.labelY - cy;
      const ratio = Math.max(-1, Math.min(1, dy / (H / 2 * 0.8)));
      const xOffset = 70 + 20 * Math.pow(Math.cos(ratio * Math.PI / 2), 0.6);
      s.labelX = cx + xOffset * xDir;
      ctx.beginPath();
      ctx.moveTo(s.cutX, s.cutY);
      const midX = s.cutX + (s.labelX - s.cutX) * 0.25;
      ctx.lineTo(midX, s.labelY);
      ctx.lineTo(s.labelX, s.labelY);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.textAlign = isRight ? 'left' : 'right';
      const txtX = s.labelX + (isRight ? 5 : -5);
      ctx.fillText(`${s.name} (${s.pos})`, txtX, s.labelY);
    });
  };
  layoutSide(rightSide, true);
  layoutSide(leftSide, false);
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui';
  ctx.fillText(name || 'Vector', cx, cy - 10);
  ctx.fillStyle = '#64748b';
  ctx.font = '14px system-ui';
  ctx.fillText(`${seqLen} bp`, cx, cy + 12);
}

// --- 2. Gel Renderer ---
const GG_A = 940.5477731863177;
const GG_B = -180.54925772877257;

function ggxYFromBp(bp) {
  return GG_A + GG_B * Math.log10(Math.max(1, bp));
}

function ggxScEffective(bp) {
  return Math.max(100, bp * 0.7);
}

// Shared state for gel data
const GGX_STATE = {
  lanes: [],
  scIdx: new Set(),
  profile: 'neb1kbplus',
  assembledLaneIndex: null,
  insertCount: 0,
  insertNames: [],
  vectorName: null,
  enzymeName: null,
  assembledName: null
};

const LADDER_PROFILES = {
  neb1kbplus: { name: 'NEB 1kb Plus DNA Ladder (default)', sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.2, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], boldKb: [3.0, 1.0, 0.5] },
  neb1kb: { name: 'NEB 1kb DNA Ladder', sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.0, 0.5], boldKb: [3.0] },
  thermo1kbruler: { name: 'GeneRuler 1kb DNA Ladder', sizesKb: [10.0, 8.0, 6.0, 5.0, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.75, 0.5, 0.25], boldKb: [6.0, 3.0, 1.0] },
  thermo1kbplus: { name: 'GeneRuler 1kb Plus DNA Ladder', sizesKb: [20.0, 10.0, 7.0, 5.0, 4.0, 3.0, 2.0, 1.5, 1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.075], boldKb: [5.0, 1.5, 0.5] }
};

function ggxFormatBands(arr) {
  if (!arr || !arr.length) return '--';
  const sorted = arr.slice().sort((a, b) => b - a);
  return sorted.map(x => x + ' bp').join(', ');
}

function ggxUpdateLegend() {
  // Access lanes from global state
  const lanes = GGX_STATE.lanes || [];
  if (!lanes.length) return;

  const legend = [];
  const prof = LADDER_PROFILES[GGX_STATE.profile] || LADDER_PROFILES.neb1kbplus;

  // L1: Ladder
  legend.push('L1 DNA Ladder (' + prof.name + ')');

  // L2: Uncut Vector (lane index 1)
  const lane2 = lanes[1] || [];
  const vName = GGX_STATE.vectorName || 'Vector';
  legend.push('L2 Uncut vector (' + vName + '): ' + ggxFormatBands(lane2));

  // L3: Digest or PCR linearized (lane index 2)
  const lane3 = lanes[2] || [];
  const enzName = GGX_STATE.enzymeName || 'Type IIS';
  // Check if it's PCR linearized (contains "PCR" or "linearized" without "digest")
  if (enzName && (enzName.includes('PCR') || (enzName.includes('linearized') && !enzName.includes('digest')))) {
    legend.push('L3 ' + enzName + ' vector (' + vName + '): ' + ggxFormatBands(lane3));
  } else {
    legend.push('L3 ' + enzName + ' digest of vector (' + vName + '): ' + ggxFormatBands(lane3));
  }

  // L4+: Inserts
  const insertCount = GGX_STATE.insertCount || 0;
  for (let i = 0; i < insertCount; i++) {
    const laneIdx = 3 + i; // visual lane L4 starts at index 3
    const sz = lanes[laneIdx] || [];
    const insName = (GGX_STATE.insertNames && GGX_STATE.insertNames[i]) ? ' (' + GGX_STATE.insertNames[i] + ')' : '';
    legend.push('L' + (laneIdx + 1) + ' PCR of insert #' + (i + 1) + insName + ': ' + ggxFormatBands(sz));
  }

  // Last: Assembled
  const assembledLaneIndex = GGX_STATE.assembledLaneIndex;
  if (typeof assembledLaneIndex === 'number' && assembledLaneIndex >= 0) {
    const last = lanes[assembledLaneIndex] || [];
    const asmName = GGX_STATE.assembledName || 'GoldenGate_assembled';
    legend.push('L' + (assembledLaneIndex + 1) + ' Assembled plasmid (' + asmName + '): ' + ggxFormatBands(last));
  }

  // Write to DOM
  const legendEl = document.getElementById('ggx-legend');
  if (legendEl) {
    legendEl.innerHTML = legend.map(s => '<div>' + s + '</div>').join('');
  }
}

function ggxDrawGel() {
  const canvas = document.getElementById('gg-gel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (canvas.height !== 640) canvas.height = 640;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const bandTop = 90;
  const gelTop = bandTop - 32;
  const gelLeft = 180;
  const gelWidth = 560;
  const gelHeight = 552;

  // Background
  const grd = ctx.createLinearGradient(0, gelTop, 0, gelTop + gelHeight);
  grd.addColorStop(0, '#3a3a3a');
  grd.addColorStop(0.5, '#333333');
  grd.addColorStop(1, '#2f2f2f');
  ctx.fillStyle = grd;
  ctx.fillRect(gelLeft, gelTop, gelWidth, gelHeight);

  // Wells
  const laneCount = 10;
  const wellWidth = 42;
  const wellHeight = 12;
  const spacing = (gelWidth - laneCount * wellWidth) / 11;
  let x = gelLeft + spacing;
  const wellY = gelTop + 8;

  ctx.fillStyle = '#050505';
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.textAlign = 'center';

  for (let i = 0; i < laneCount; i++) {
    ctx.fillRect(x, wellY, wellWidth, wellHeight);
    const lx = gelLeft + spacing * (i + 1) + wellWidth * (i + 0.5);
    ctx.fillText('L' + (i + 1), lx, gelTop - 10);
    x += wellWidth + spacing;
  }

  const bandWidth = 34;
  const bandHeight = 5;

  const paintBand = (cx, bp, isBright, isSC) => {
    const effBp = isSC ? ggxScEffective(bp) : bp;
    const y = ggxYFromBp(effBp);
    if (y < gelTop || y > gelTop + gelHeight - 2) return;

    let alpha = isBright ? 0.96 : 0.78;
    if (!isBright && !isSC) alpha = 0.58;

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const x0 = cx - bandWidth / 2;
    const y0 = y - 2.5;
    ctx.beginPath();
    ctx.roundRect(x0, y0, bandWidth, bandHeight, 2);
    ctx.fill();
  };

  // Ladder Data
  const prof = LADDER_PROFILES[GGX_STATE.profile] || LADDER_PROFILES.neb1kbplus;
  const ladderBands = prof.sizesKb.map(k => k * 1000);
  const ladderBold = prof.boldKb.map(k => k * 1000);
  const boldSet = new Set(ladderBold);

  // Draw Ladder (L1)
  const markerX = gelLeft + spacing + wellWidth * 0.5;
  ladderBands.forEach(bp => {
    paintBand(markerX, bp, boldSet.has(bp), false);
  });

  // Draw Samples
  const lanes = GGX_STATE.lanes;
  for (let i = 1; i < Math.min(lanes.length, 10); i++) {
    const laneIdx = i;
    const cx = gelLeft + spacing * (laneIdx + 1) + wellWidth * (laneIdx + 0.5);
    const bands = lanes[i];
    const isSC = GGX_STATE.scIdx.has(i);
    if (Array.isArray(bands)) {
      bands.forEach(bp => paintBand(cx, bp, false, isSC));
    }
  }

  // Left Labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const labelX = gelLeft - 72;
  const connectorStart = gelLeft - 64;
  const connectorMid = gelLeft - 30;
  const connectorEnd = gelLeft - 6;

  const sortedLadder = [...ladderBands].sort((a, b) => b - a);
  const labels = [];

  sortedLadder.forEach((bp) => {
    const bandY = ggxYFromBp(bp);
    const kb = bp / 1000;
    const labelTxt = kb.toFixed(1);
    const isBold = boldSet.has(bp);
    labels.push({ bp, y: bandY, text: labelTxt, isBold, labelY: bandY });
  });

  const minSpacing = 20;
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const curr = labels[i];
    if (curr.labelY < prev.labelY + minSpacing) {
      curr.labelY = prev.labelY + minSpacing;
    }
  }

  labels.forEach(l => {
    if (l.labelY > H - 10) return;
    ctx.font = l.isBold ? "bold 18px 'Segoe UI', sans-serif" : "18px 'Segoe UI', sans-serif";
    ctx.fillStyle = '#000000';
    ctx.fillText(l.text, labelX, l.labelY);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(connectorStart, l.labelY);
    ctx.lineTo(connectorMid, l.labelY);
    ctx.lineTo(connectorEnd, l.y);
    ctx.stroke();
  });

  ctx.font = "bold 24px 'Segoe UI', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('kb', gelLeft - 50, gelTop - 10);
}

// Public API called by main script
export function drawGel(canvasId, lanes, ladderBands, ladderBold, ladderName, options = {}) {
  // This function signature is kept for compatibility but we rely on GGX_STATE internally for full legend data
  // The main script sets GGX_STATE properties directly before calling this if needed,
  // OR we can update GGX_STATE here from arguments.
  // For V4.32, we assume the main script populates GGX_STATE fully (including vector names etc)
  // and then calls this function. But since 'lanes' are passed here, let's update state.

  if (lanes) GGX_STATE.lanes = lanes;
  // Only update scIdx if explicitly provided in options, don't override from highlightIndices
  // highlightIndices is for visual highlighting, not for supercoiled detection
  if (options.scIdx !== undefined) {
    GGX_STATE.scIdx = options.scIdx;
  }
  // Note: highlightIndices is handled separately for visual highlighting only

  // Trigger internal draw and update
  ggxDrawGel();
  ggxUpdateLegend();
}

// Helper for main script to update state directly
export function updateGelState(newState) {
  Object.assign(GGX_STATE, newState);
}

// ============================================================================
// MW (MESSAGE WARNING) SYSTEM
// ============================================================================
// Unified warning/error modal system for all PrimerWeaver modules
// Extracted from QC module and generalized for reuse
// @version 1.0.0

/**
 * Show a single MW warning modal
 * @param {HTMLElement} container - Container element (or document.body)
 * @param {string} message - Warning message to display
 * @param {Function} onConfirm - Callback when user clicks OK
 * @param {Function} onCancel - Callback when user clicks Cancel
 */
export function showMWModal(container, message, onConfirm, onCancel) {
  // Create modal if it doesn't exist
  let modal = container.querySelector('#mw-modal');
  if (!modal) {
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
      #mw-modal {
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
      .mw-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .mw-modal-content {
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
        animation: mwModalSlideIn 0.3s ease-out;
      }
      @keyframes mwModalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .mw-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px;
        background: #fff7ed;
        border-bottom: 1px solid #fde68a;
      }
      .mw-warning-icon {
        font-size: 1.5rem;
        line-height: 1;
      }
      .mw-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #92400e;
        font-weight: 600;
      }
      .mw-modal-body {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .mw-modal-body p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #374151;
        white-space: pre-line;
      }
      .mw-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      .mw-modal-footer .btn {
        min-width: 80px;
      }
      .mw-modal-footer .btn.ghost {
        background: #e5e7eb;
        color: #374151;
      }
      .mw-modal-footer .btn.ghost:hover {
        background: #d1d5db;
      }
      .mw-modal-footer .btn:not(.ghost) {
        background: #3b82f6;
        color: white;
      }
      .mw-modal-footer .btn:not(.ghost):hover {
        background: #2563eb;
      }
    `;
    document.head.appendChild(style);

    modal = document.createElement('div');
    modal.id = 'mw-modal';
    modal.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.className = 'mw-modal-overlay';

    const content = document.createElement('div');
    content.className = 'mw-modal-content';

    const header = document.createElement('div');
    header.className = 'mw-modal-header';
    const icon = document.createElement('span');
    icon.className = 'mw-warning-icon';
    icon.textContent = '⚠️';
    const title = document.createElement('h3');
    title.textContent = 'Warning';
    header.appendChild(icon);
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'mw-modal-body';
    const messageP = document.createElement('p');
    messageP.id = 'mw-message';
    body.appendChild(messageP);

    const footer = document.createElement('div');
    footer.className = 'mw-modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'mw-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn ghost';

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'mw-confirm-btn';
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
  const messageEl = modal.querySelector('#mw-message');
  if (messageEl) {
    messageEl.textContent = message;
  }

  // Show modal
  modal.style.display = 'flex';

  // Remove existing listeners and add new ones
  const confirmBtn = modal.querySelector('#mw-confirm-btn');
  const cancelBtn = modal.querySelector('#mw-cancel-btn');
  const overlay = modal.querySelector('.mw-modal-overlay');

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

/**
 * Show multiple warnings in sequence
 * @param {HTMLElement} container - Container element
 * @param {Array<{id: string, message: string}>} warnings - Array of warning objects
 * @param {Function} onComplete - Callback when all warnings are confirmed
 * @param {Function} onCancel - Callback when user cancels
 */
export function showMWWarnings(container, warnings, onComplete, onCancel) {
  if (!warnings || warnings.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  let idx = 0;
  const showNext = () => {
    idx += 1;
    if (idx >= warnings.length) {
      if (onComplete) onComplete();
      return;
    }
    showMWModal(container, warnings[idx].message, showNext, onCancel || (() => { }));
  };

  showMWModal(container, warnings[0].message, showNext, onCancel || (() => { }));
}

function countFastaHeaders(raw) {
  return (String(raw || '').match(/^>/gm) || []).length;
}

function keepFirstFastaRecord(raw) {
  const text = String(raw || '');
  const matches = Array.from(text.matchAll(/^>.*$/gm));
  if (matches.length === 0) return text;
  const start = matches[0].index ?? 0;
  const end = matches.length > 1 ? (matches[1].index ?? text.length) : text.length;
  return text.slice(start, end).trimEnd();
}

/**
 * Guard a design action against multiple FASTA headers per input field.
 * If multiple headers are detected, shows MW modal:
 * - Cancel: return to input fields (no changes)
 * - OK: keep only the first FASTA record per offending field, then calls onProceed
 *
 * @param {HTMLElement} container
 * @param {Array<HTMLInputElement|HTMLTextAreaElement>} elements
 * @param {Function} onProceed
 * @returns {boolean} true if modal shown (caller should stop), false otherwise
 */
export function guardSingleFastaPerField(container, elements, onProceed) {
  const els = Array.isArray(elements) ? elements.filter(Boolean) : [];
  const offenders = els.filter(el => countFastaHeaders(el.value) > 1);
  if (!offenders.length) return false;

  const msg = 'Only one sequence is allowed per input field; if multiple FASTA headers are detected, only the first sequence will be used.';
  const host = container || document.body;
  showMWModal(host, msg, () => {
    offenders.forEach((el) => {
      el.value = keepFirstFastaRecord(el.value);
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    });
    if (typeof onProceed === 'function') window.setTimeout(() => onProceed(), 0);
  }, () => {
    try { offenders[0]?.focus?.(); } catch {}
  });

  return true;
}

/**
 * Normalize sequence (keep only IUPAC DNA codes)
 */
export function normalizeSeq(raw) {
  return (raw || "").toUpperCase().replace(/[^ACGTRYSWKMBDHVN]/g, "");
}

/**
 * Analyze primer sequence for invalid/degenerate characters
 */
export function analyzePrimerSequence(rawSeq) {
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

/**
 * Validate sequence input and generate warnings
 * @param {Array} sequences - Array of {label, seq} objects
 * @param {string} inputType - Type of input (e.g., "Forward", "Reverse", "Fragment")
 * @returns {Array} Array of warning objects
 */
export function validateSequenceInput(sequences, inputType = "Sequence") {
  const warnings = [];

  if (!sequences || sequences.length === 0) {
    return warnings;
  }

  const analyses = sequences.map(s => ({ label: s.label, ...analyzePrimerSequence(s.seq) }));
  const validCount = analyses.filter(a => a.isValid).length;

  // MW-04: No valid sequences after normalization
  if (validCount === 0) {
    warnings.push({
      id: 'MW-04',
      message:
        `Warning: No valid ${inputType} sequences detected.\n` +
        "All provided sequences become empty after normalization (only IUPAC DNA codes are kept: A/C/G/T/R/Y/S/W/K/M/B/D/H/V/N).\n\n" +
        "Click Cancel to check your input or OK to proceed (results will be empty)."
    });
    return warnings;
  }

  // MW-05: Non-IUPAC characters removed
  const invalidSeqs = analyses.filter(a => a.invalidCount > 0);
  const invalidAt3 = invalidSeqs.filter(a => a.invalidAt3);
  if (invalidSeqs.length > 0) {
    const examples = invalidSeqs.slice(0, 4).map(a => a.label);
    warnings.push({
      id: 'MW-05',
      message:
        `Warning: Non-IUPAC characters were removed from ${inputType} sequences.\n` +
        `Affected sequences: ${invalidSeqs.length}\n` +
        (examples.length ? `Examples: ${examples.join(', ')}\n` : "") +
        (invalidAt3.length
          ? "At least one sequence contains invalid characters near the 3' end, which is especially risky.\n"
          : "") +
        "Processing will proceed using the normalized sequences only.\n\n" +
        "Click Cancel to review/correct your input or OK to proceed."
    });
  }

  // MW-06: Degenerate bases detected
  const degenerateThresholdCount = 1;
  const degenerateThresholdFrac = 0.10;
  const degenerateSeqs = analyses.filter(a =>
    a.degenerateCount >= degenerateThresholdCount || a.degenerateFrac > degenerateThresholdFrac
  );
  if (degenerateSeqs.length > 0) {
    const examples = degenerateSeqs.slice(0, 4).map(a => a.label);
    warnings.push({
      id: 'MW-06',
      message:
        `Warning: Degenerate (IUPAC) bases detected in ${inputType} sequences.\n` +
        `Affected sequences: ${degenerateSeqs.length}\n` +
        (examples.length ? `Examples: ${examples.join(', ')}\n` : "") +
        "Thermodynamic values (Tm and ΔG) are estimated for the most stable variant (worst-case), which may be conservative.\n\n" +
        "Click Cancel to confirm/replace degenerate bases or OK to proceed."
    });
  }

  return warnings;
}

/**
 * Validate parameter ranges (Na+, Mg2+, primer concentration, Tm)
 * @param {Object} params - {Na, Mg, conc, targetTm}
 * @returns {Array} Array of warning objects
 */
export function validateParameterRange(params) {
  const warnings = [];
  const { Na, Mg, conc, targetTm } = params;

  const naMin = 10, naMax = 200;
  const mgMin = 0.5, mgMax = 5;
  const concMin = 25, concMax = 1000;
  const tmMin = 45, tmMax = 75;

  if (Na !== undefined && (!isFinite(Na) || Na < naMin || Na > naMax)) {
    warnings.push({
      id: 'MW-10',
      message:
        `Na+ out of range: current ${isFinite(Na) ? Na : 'unset'} mM (recommended ${naMin}–${naMax} mM).\n\n` +
        "Click Cancel to adjust or OK to proceed (results may be unreliable)."
    });
  }

  if (Mg !== undefined && (!isFinite(Mg) || Mg < mgMin || Mg > mgMax)) {
    warnings.push({
      id: 'MW-11',
      message:
        `Mg2+ out of range: current ${isFinite(Mg) ? Mg : 'unset'} mM (recommended ${mgMin}–${mgMax} mM).\n` +
        "Mg2+ strongly affects Tm and structures; keep it within the recommended range.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if (conc !== undefined && (!isFinite(conc) || conc < concMin || conc > concMax)) {
    warnings.push({
      id: 'MW-12',
      message:
        `Primer concentration out of range: current ${isFinite(conc) ? conc : 'unset'} nM (recommended ${concMin}–${concMax} nM).\n\n` +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  if (targetTm !== undefined && (!isFinite(targetTm) || targetTm < tmMin || targetTm > tmMax)) {
    warnings.push({
      id: 'MW-13',
      message:
        `Target Tm out of range: current ${isFinite(targetTm) ? targetTm : 'unset'} °C (recommended ${tmMin}–${tmMax} °C).\n\n` +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  // MW-14: High Mg2+ and Na+ simultaneously
  if (isFinite(Mg) && isFinite(Na) && Mg >= 4 && Na >= 150) {
    warnings.push({
      id: 'MW-14',
      message:
        "High Mg2+ and Na+ concentrations provided simultaneously.\n" +
        "Duplex stability may be substantially overestimated by the model.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  // MW-15: Parameters outside validated range
  if ((isFinite(Na) && Na < 5) || (isFinite(Mg) && Mg > 10) || (isFinite(conc) && conc > 5000)) {
    warnings.push({
      id: 'MW-15',
      message:
        "Selected parameters fall outside the validated range of the thermodynamic model.\n" +
        "Results may not be physically meaningful.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  return warnings;
}

/**
 * Validate performance (large datasets)
 * @param {number} totalItems - Total number of items to process
 * @param {number} totalBp - Total base pairs
 * @returns {Array} Array of warning objects
 */
export function validatePerformance(totalItems, totalBp) {
  const warnings = [];

  // MW-09: Too many items
  if (totalItems > 500) {
    warnings.push({
      id: 'MW-09',
      message:
        "Warning: Large dataset detected.\n" +
        `Total items: ${totalItems}\n` +
        "Processing may run slowly and could cause the browser tab to become unresponsive.\n\n" +
        "Click Cancel to reduce your input (e.g., run in batches) or OK to proceed."
    });
  }

  // MW-19: Large total sequence size
  // Use ~1MB threshold to match typical browser performance constraints.
  // Here totalBp is treated as total input characters/bases across sequences.
  if (totalBp > 1_000_000) {
    warnings.push({
      id: 'MW-19',
      message:
        "Warning: Large total input size detected (>1 MB).\n" +
        `Total size: ${(totalBp / 1_000_000).toFixed(2)} MB (approx.)\n` +
        "Computation may be slow in browser environments.\n\n" +
        "Click Cancel to adjust or OK to proceed."
    });
  }

  return warnings;
}

/**
 * Validate fragment count for assembly methods
 * @param {number} fragmentCount - Number of fragments
 * @param {number} minFragments - Minimum required fragments
 * @param {string} methodName - Name of assembly method
 * @returns {Array} Array of warning objects
 */
export function validateFragmentCount(fragmentCount, minFragments, methodName = "Assembly") {
  const warnings = [];

  if (fragmentCount < minFragments) {
    warnings.push({
      id: 'MW-FRAG-01',
      message:
        `Warning: Insufficient fragments for ${methodName}.\n` +
        `Provided: ${fragmentCount}, Required: at least ${minFragments}\n\n` +
        "Click Cancel to add more fragments or OK to proceed."
    });
  }

  return warnings;
}

/**
 * Validate overlap length for assembly methods
 * @param {number} overlapLength - Overlap length in bp
 * @param {number} minOverlap - Minimum recommended overlap
 * @param {number} maxOverlap - Maximum recommended overlap
 * @returns {Array} Array of warning objects
 */
export function validateOverlapLength(overlapLength, minOverlap = 15, maxOverlap = 40) {
  const warnings = [];

  if (overlapLength < minOverlap || overlapLength > maxOverlap) {
    warnings.push({
      id: 'MW-OVERLAP-01',
      message:
        `Warning: Overlap length outside recommended range.\n` +
        `Current: ${overlapLength} bp, Recommended: ${minOverlap}–${maxOverlap} bp\n` +
        (overlapLength < minOverlap
          ? "Short overlaps may reduce assembly efficiency.\n"
          : "Long overlaps may increase off-target assembly.\n") +
        "\nClick Cancel to adjust or OK to proceed."
    });
  }

  return warnings;
}
