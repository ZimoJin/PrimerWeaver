// Gibson Assembly Primer Designer
// Based on core.js

import * as Core from './core_v1.0.1.js';
import * as VIZ from './bio_visuals_v1.0.1.js';
import { CODON_USAGE, getCodonEntries } from './codon_v1.0.1.js';

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

// Utility functions
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

// IUPAC support for PCR primer matching
const IUPAC = {
  A: new Set(['A']), C: new Set(['C']), G: new Set(['G']), T: new Set(['T']),
  R: new Set(['A','G']), Y: new Set(['C','T']), S: new Set(['G','C']), W: new Set(['A','T']),
  K: new Set(['G','T']), M: new Set(['A','C']),
  B: new Set(['C','G','T']), D: new Set(['A','G','T']), H: new Set(['A','C','T']), V: new Set(['A','C','G']),
  N: new Set(['A','C','G','T'])
};

const IUPAC_COMP = {
  A:'T', T:'A', C:'G', G:'C',
  R:'Y', Y:'R', S:'S', W:'W', K:'M', M:'K',
  B:'V', V:'B', D:'H', H:'D',
  N:'N'
};

function normIUPAC(seq) {
  return (seq||'').toUpperCase().replace(/[^ACGTRYSWKMBDHVN]/g,'');
}

function iupacMatch(pBase, tBase) {
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

// 3' end continuous matching for PCR primers
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

// Populate host organism select
function populateHostSelect(selectElement) {
  const select = selectElement || $('host-organism');
  if (!select) {
    console.warn('host-organism select element not found');
    return;
  }
  
  // Check if CODON_USAGE is available
  if (!CODON_USAGE || typeof CODON_USAGE !== 'object') {
    console.error('CODON_USAGE is not available');
    select.innerHTML = '<option value="">Loading...</option>';
    return;
  }
  
  select.innerHTML = '';
  try {
    for (const [code, org] of Object.entries(CODON_USAGE)) {
      if (!org || typeof org !== 'object') continue;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = org.name || code;
      select.appendChild(opt);
    }
    
    // Set default value
    if (CODON_USAGE.s_cerevisiae) {
      select.value = 's_cerevisiae';
    } else if (select.options.length > 0) {
      select.selectedIndex = 0;
    }
  } catch (error) {
    console.error('Error populating host organism select:', error);
    select.innerHTML = '<option value="">Error loading organisms</option>';
  }
}

// Convert amino acid sequence to DNA using round-robin codon selection
// Uses top 2 preferred codons in round-robin fashion to avoid repetition
function aaToDNA(aaSeq, hostCode = 's_cerevisiae') {
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
    
    // Get codon entries for this amino acid
    const entries = getCodonEntries(hostCode, aa);
    if (!entries || entries.length === 0) {
      throw new Error(`No codon usage data for amino acid ${aa} in organism ${hostCode}.`);
    }
    
    // Use top 2 preferred codons in round-robin fashion to avoid repetition
    const topCodonCount = Math.min(2, entries.length);
    const counter = aaCodonCounters.get(aa) || 0;
    const codonEntry = entries[counter % topCodonCount];
    const codon = codonEntry.codon;
    
    // Update counter for this amino acid
    aaCodonCounters.set(aa, counter + 1);
    
    dnaSeq += codon;
  }
  
  return dnaSeq;
}

let insertCount = 1;

// Vector file upload and demo
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
  
  // Vector demo button: load pESC-His.txt
  const demoBtn = $('btn-vector-demo');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
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
        updateFragmentsInfo();
      } catch (e) {
        console.error('Vector demo load error:', e);
        alert('Failed to load demo sequence.');
      }
    });
  }
  
  // Vector Flip (rc) button
  $('vector-flip-btn').addEventListener('click', () => {
    const textarea = $('vector-seq');
    const input = textarea.value.trim();
    if (!input) {
      showWarning('Vector sequence is empty.');
      return;
    }
    
    // Parse FASTA to preserve header
    const records = Core.parseFASTA(input);
    if (records.length === 0) {
      // Not FASTA format, treat as raw sequence
      const cleaned = Core.normalizeSeq(input);
      if (!cleaned) {
        showWarning('Vector sequence is empty.');
        return;
      }
      textarea.value = Core.reverseComplementSeq(cleaned);
    } else {
      // FASTA format: preserve header, only RC the sequence
      const record = records[0];
      const header = record.header || '';
      const seq = Core.normalizeSeq(record.seq);
      if (!seq) {
        showWarning('Vector sequence is empty.');
        return;
      }
      const rcSeq = Core.reverseComplementSeq(seq);
      // Reconstruct FASTA format
      if (header) {
        textarea.value = '>' + header + '\n' + rcSeq;
      } else {
        textarea.value = rcSeq;
      }
    }
    updateVectorPreview();
  });
  
  // Update vector preview on input
  $('vector-seq').addEventListener('input', () => {
    if (vectorPreviewTimer) clearTimeout(vectorPreviewTimer);
    vectorPreviewTimer = setTimeout(() => {
      updateVectorPreview();
      updateFragmentsInfo();
    }, 300);
  });
  
  // Update vector preview on rotation change
  $('vector-map-rotation').addEventListener('input', () => {
    updateVectorPreview();
  });
  
  // Update fragments info when inputs change
  $('enzyme1').addEventListener('input', updateFragmentsInfo);
  $('enzyme2').addEventListener('input', updateFragmentsInfo);
  $('keep-sites').addEventListener('change', updateFragmentsInfo);
  $('pcr-forward').addEventListener('input', updateFragmentsInfo);
  $('pcr-reverse').addEventListener('input', updateFragmentsInfo);
  
  // Update backboneSeq when selection changes
  $('backbone-select').addEventListener('change', updateBackboneFromSelection);
}

// Load sample sequences
let sampleSequences = null;
async function loadSampleSequences() {
  if (sampleSequences) return sampleSequences;
  try {
    const response = await fetch('../sample/SampleSequence.txt');
    const text = await response.text();
    const sequences = [];
    const lines = text.split('\n');
    let currentHeader = '';
    let currentSeq = '';
    for (const line of lines) {
      if (line.startsWith('>')) {
        if (currentHeader) {
          sequences.push({ header: currentHeader, sequence: currentSeq });
        }
        currentHeader = line.substring(1).trim();
        currentSeq = '';
      } else {
        currentSeq += line.trim();
      }
    }
    if (currentHeader) {
      sequences.push({ header: currentHeader, sequence: currentSeq });
    }
    sampleSequences = sequences;
    return sampleSequences;
  } catch (error) {
    console.error('Failed to load sample sequences:', error);
    return [];
  }
}

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
    
    // Get enzyme sites for annotation
    const enzyme1Name = $('enzyme1').value.trim();
    const enzyme2Name = $('enzyme2').value.trim();
    const annotations = [];
    
    if (enzyme1Name) {
      const sites = Core.findEnzymeSites(seq, enzyme1Name);
      sites.forEach(pos => {
        annotations.push({ pos, name: enzyme1Name });
      });
    }
    if (enzyme2Name && enzyme2Name !== enzyme1Name) {
      const sites = Core.findEnzymeSites(seq, enzyme2Name);
      sites.forEach(pos => {
        annotations.push({ pos, name: enzyme2Name });
      });
    }
    
    // If no enzymes specified, show all single-cut enzymes
    if (!enzyme1Name && !enzyme2Name) {
      // Get all Type II enzymes from ENZYME_DB
      for (const [enzName, enz] of Object.entries(Core.ENZYME_DB)) {
        if (enz.class === 'typeII' && enz.site) {
          const sites = Core.findEnzymeSites(seq, enzName);
          // Only show enzymes with exactly one site (single cut)
          if (sites.length === 1) {
            annotations.push({ pos: sites[0], name: enzName });
          }
        }
      }
    }
    
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
    
    // Count only enzyme sites (those with 'pos' property), not features (which have 'start' and 'end')
    const siteCount = annotations.filter(a => a.pos !== undefined).length;
    if (statsDiv) {
      statsDiv.textContent = `${len} bp${siteCount > 0 ? ` | ${siteCount} site(s)` : ''}`;
    }
    
  } catch (error) {
    if (statsDiv) statsDiv.textContent = 'Error parsing vector';
  }
}

window.addEventListener('common-features-ready', () => {
  try { updateVectorPreview(); } catch (e) {}
}, { once: true });

// Add insert button
function initAddInsert() {
  $('add-insert-btn').addEventListener('click', () => {
    const container = $('inserts-container');
    const currentRows = container.querySelectorAll('.insert-row');
    
    if (currentRows.length >= 6) {
      showWarning('Maximum 6 inserts allowed.');
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
          <div style="display: flex; gap: 4px; align-items: center;">
            <input type="text" class="insert-linker" placeholder="Linker and tag (optional)" list="linker-suggestions-${insertCount - 1}" style="flex: 1; font-family: monospace; font-size: 0.85rem;" autocomplete="off">
            <datalist id="linker-suggestions-${insertCount - 1}">
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
            <button type="button" class="linker-type-btn" data-type="AA" style="padding: 4px 8px; border: 1px solid #d0d0dd; border-radius: 4px; background: #e0f2fe; cursor: pointer; font-size: 0.8rem; white-space: nowrap; color: #0369a1;">AA</button>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
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
    // Trigger height sync after adding new insert
    if (window.__gibsonScheduleSync) {
      window.__gibsonScheduleSync();
    }
  });
  
  // Setup listeners for existing rows
  document.querySelectorAll('.insert-row').forEach(row => {
    setupInsertRowListeners(row);
  });
  
  // Flip order button
  const flipOrderBtn = $('flip-order-btn');
  if (flipOrderBtn) {
    flipOrderBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      const rows = Array.from(container.querySelectorAll('.insert-row'));
      if (rows.length < 2) return;
      rows.reverse().forEach(row => container.appendChild(row));
      updateInsertNumbers();
      updateInsertControls();
      // Trigger height sync after flipping order
      if (window.__gibsonScheduleSync) {
        setTimeout(() => window.__gibsonScheduleSync(), 10);
      }
    });
  }
  
  // File upload for inserts
  const container = $('inserts-container');
  container.addEventListener('change', (e) => {
    const fileInput = e.target.closest('.insert-file');
    if (!fileInput) return;
    const row = e.target.closest('.insert-row');
    if (!row) return;
    const textarea = row.querySelector('.insert-seq');
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        textarea.value = event.target.result;
      };
      reader.readAsText(file);
    }
  });
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
  }
  
  // Demo button
  const demoBtn = row.querySelector('.insert-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      const labelText = row.querySelector('.insert-label')?.textContent || '';
      const insertNum = parseInt(labelText.match(/\d+/)?.[0]) || 1;
      const textarea = row.querySelector('.insert-seq');
      if (!textarea) return;
      
      // Limit to 6 inserts
      if (insertNum > 6) {
        alert('Demo only provides 6 inserts.');
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
  
  // Flip (rc) button
  const flipBtn = row.querySelector('.insert-flip-btn');
  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      const textarea = row.querySelector('.insert-seq');
      const input = textarea.value.trim();
      if (!input) {
        showWarning('Insert sequence is empty.');
        return;
      }
      
      // Parse FASTA to preserve header
      const records = Core.parseFASTA(input);
      if (records.length === 0) {
        // Not FASTA format, treat as raw sequence
        const cleaned = Core.normalizeSeq(input);
        if (!cleaned) {
          showWarning('Insert sequence is empty.');
          return;
        }
        textarea.value = Core.reverseComplementSeq(cleaned);
      } else {
        // FASTA format: preserve header, only RC the sequence
        const record = records[0];
        const header = record.header || '';
        const seq = Core.normalizeSeq(record.seq);
        if (!seq) {
          showWarning('Insert sequence is empty.');
          return;
        }
        const rcSeq = Core.reverseComplementSeq(seq);
        // Reconstruct FASTA format
        if (header) {
          textarea.value = '>' + header + '\n' + rcSeq;
        } else {
          textarea.value = rcSeq;
        }
      }
    });
  }
  
  // Move up button
  const moveUpBtn = row.querySelector('.insert-move-up-btn');
  if (moveUpBtn) {
    moveUpBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      const prevRow = row.previousElementSibling;
      if (prevRow) {
        container.insertBefore(row, prevRow);
        updateInsertNumbers();
        updateInsertControls();
        // Trigger height sync after moving
        if (window.__gibsonScheduleSync) {
          setTimeout(() => window.__gibsonScheduleSync(), 10);
        }
      }
    });
  }
  
  // Move down button
  const moveDownBtn = row.querySelector('.insert-move-down-btn');
  if (moveDownBtn) {
    moveDownBtn.addEventListener('click', () => {
      const container = $('inserts-container');
      const nextRow = row.nextElementSibling;
      if (nextRow) {
        container.insertBefore(nextRow, row);
        updateInsertNumbers();
        updateInsertControls();
        // Trigger height sync after moving
        if (window.__gibsonScheduleSync) {
          setTimeout(() => window.__gibsonScheduleSync(), 10);
        }
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
      updateAddInsertButton();
      // Trigger height sync after removing insert
      if (window.__gibsonScheduleSync) {
        setTimeout(() => window.__gibsonScheduleSync(), 10);
      }
    });
  }
  
  // Linker type button
  const linkerTypeBtn = row.querySelector('.linker-type-btn');
  const linkerInput = row.querySelector('.insert-linker');
  const linkerDatalist = linkerInput ? document.getElementById(linkerInput.getAttribute('list')) : null;
  
  if (linkerTypeBtn) {
    linkerTypeBtn.addEventListener('click', () => {
      const currentType = linkerTypeBtn.getAttribute('data-type');
      const newType = currentType === 'AA' ? 'DNA' : 'AA';
      linkerTypeBtn.setAttribute('data-type', newType);
      linkerTypeBtn.textContent = newType;
      linkerTypeBtn.style.background = newType === 'AA' ? '#e0f2fe' : '#f0f0f0';
      linkerTypeBtn.style.color = newType === 'AA' ? '#0369a1' : '#222';
      
      // Show/hide datalist based on type
      if (linkerInput && linkerDatalist) {
        if (newType === 'AA') {
          linkerInput.setAttribute('list', linkerDatalist.id);
        } else {
          linkerInput.removeAttribute('list');
        }
      }
    });
  }
}

// Update Add Insert button state
function updateAddInsertButton() {
  const addBtn = $('add-insert-btn');
  if (!addBtn) return;
  const rows = document.querySelectorAll('.insert-row');
  const count = rows.length;
  
  if (count >= 6) {
    addBtn.disabled = true;
    addBtn.textContent = 'Max 6 inserts';
    addBtn.style.opacity = '0.5';
    addBtn.style.cursor = 'not-allowed';
  } else {
    addBtn.disabled = false;
    addBtn.textContent = '+ Add Insert';
    addBtn.style.opacity = '1';
    addBtn.style.cursor = 'pointer';
  }
}

// Update insert controls (show/hide buttons, enable/disable move buttons)
function updateInsertControls() {
  const rows = document.querySelectorAll('.insert-row');
  updateAddInsertButton();
  rows.forEach((row, idx) => {
    const delBtn = row.querySelector('.remove-insert-btn');
    const moveUpBtn = row.querySelector('.insert-move-up-btn');
    const moveDownBtn = row.querySelector('.insert-move-down-btn');
    
    // Show/hide delete button
    if (rows.length > 1) {
      if (delBtn) delBtn.style.display = 'block';
    } else {
      if (delBtn) delBtn.style.display = 'none';
    }
    
    // Enable/disable move up button
    if (moveUpBtn) {
      if (idx === 0) {
        moveUpBtn.disabled = true;
        moveUpBtn.style.opacity = '0.5';
        moveUpBtn.style.cursor = 'not-allowed';
      } else {
        moveUpBtn.disabled = false;
        moveUpBtn.style.opacity = '1';
        moveUpBtn.style.cursor = 'pointer';
      }
    }
    
    // Enable/disable move down button
    if (moveDownBtn) {
      if (idx === rows.length - 1) {
        moveDownBtn.disabled = true;
        moveDownBtn.style.opacity = '0.5';
        moveDownBtn.style.cursor = 'not-allowed';
      } else {
        moveDownBtn.disabled = false;
        moveDownBtn.style.opacity = '1';
        moveDownBtn.style.cursor = 'pointer';
      }
    }
  });
}

// Remove insert button (kept for backward compatibility)
function updateRemoveButtons() {
  updateInsertControls();
}

function updateInsertNumbers() {
  const rows = document.querySelectorAll('.insert-row');
  rows.forEach((row, idx) => {
    const label = row.querySelector('.insert-label');
    label.textContent = `Insert #${idx + 1}:`;
    row.setAttribute('data-index', idx);
  });
  insertCount = rows.length;
}

// Linearization mode toggle
function initLinearizationMode() {
  document.querySelectorAll('input[name="linearization-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'enzyme') {
        $('enzyme-block').style.display = 'block';
        $('pcr-block').style.display = 'none';
      } else {
        $('enzyme-block').style.display = 'none';
        $('pcr-block').style.display = 'block';
      }
      updateVectorPreview();
      updateFragmentsInfo();
    });
  });
  
  // Update preview when enzyme changes
  $('enzyme1').addEventListener('input', () => {
    updateVectorPreview();
    updateFragmentsInfo();
  });
  $('enzyme2').addEventListener('input', () => {
    updateVectorPreview();
    updateFragmentsInfo();
  });
}

// Calculate and display linearization fragments
function updateFragmentsInfo() {
  const vectorText = $('vector-seq').value.trim();
  const fragmentsInfo = $('fragments-info');
  const backboneSelect = $('backbone-select');
  const fragmentsSummary = $('fragments-summary');
  
  if (!vectorText || !fragmentsInfo || !backboneSelect) {
    // Reset dropdown even if no vector
    if (backboneSelect) {
      backboneSelect.innerHTML = '<option value="">No fragments available</option>';
    }
    if (fragmentsSummary) {
      fragmentsSummary.textContent = '';
    }
    return;
  }
  
    try {
    const records = parseFASTA(vectorText);
    if (records.length === 0) {
      backboneSelect.innerHTML = '<option value="">No fragments available</option>';
      if (fragmentsSummary) fragmentsSummary.textContent = '';
      return;
    }
    
    const vector = records[0];
    const seq = vector.seq;
    const mode = document.querySelector('input[name="linearization-mode"]:checked')?.value;
    
    let fragments = [];
    
    if (mode === 'enzyme') {
      // Enzyme linearization
      const enzyme1Name = $('enzyme1').value.trim();
      const enzyme2Name = $('enzyme2').value.trim();
      
      if (!enzyme1Name && !enzyme2Name) {
        backboneSelect.innerHTML = '<option value="">Please select enzyme(s)</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      const enzymeNames = [];
      if (enzyme1Name) enzymeNames.push(enzyme1Name);
      if (enzyme2Name && enzyme2Name !== enzyme1Name) enzymeNames.push(enzyme2Name);
      
      if (enzymeNames.length > 0) {
        fragments = Core.digestCircularTypeII(seq, enzymeNames);
      }
    } else if (mode === 'pcr') {
      // PCR linearization - use new 3' end continuous matching logic
      const forwardPrimer = $('pcr-forward').value.trim();
      const reversePrimer = $('pcr-reverse').value.trim();
      
      if (!forwardPrimer || !reversePrimer) {
        backboneSelect.innerHTML = '<option value="">Please provide PCR primers</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      // Normalize primers (support IUPAC)
      let pcrF = normIUPAC(forwardPrimer);
      let pcrR = normIUPAC(reversePrimer);
      
      const L = seq.length;
      const minLen = 15; // Minimum 3' match length
      const maxLen = 25; // Maximum scan length
      
      // Find 3' end hits using continuous matching
      let fHits = findForward3primeHits(pcrF, seq, minLen, maxLen);
      let rHits = findReverse3primeHits(pcrR, seq, minLen, maxLen);
      
      // Auto-detect RC / swap primers fallback
      let primersSwapped = false;
      if (!fHits.length || !rHits.length) {
        // Try swapped primers
        const fHitsSwapped = findForward3primeHits(pcrR, seq, minLen, maxLen);
        const rHitsSwapped = findReverse3primeHits(pcrF, seq, minLen, maxLen);
        
        if (fHitsSwapped.length > 0 && rHitsSwapped.length > 0) {
          [pcrF, pcrR] = [pcrR, pcrF];
          fHits = fHitsSwapped;
          rHits = rHitsSwapped;
          primersSwapped = true;
        }
      }
      
      if (!fHits.length || !rHits.length) {
        backboneSelect.innerHTML = '<option value="">Primers not found in sequence</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
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
        backboneSelect.innerHTML = '<option value="">No valid PCR product found</option>';
        if (fragmentsSummary) fragmentsSummary.textContent = '';
        return;
      }
      
      const f3 = bestFHit.f3;
      const r3 = bestRHit.r3;
      const revRC = bestRHit.revRC;
      
      // Calculate template sequence (f3+1→r3-1) excluding endpoints to avoid duplication
      const f3Next = (f3 + 1) % L;
      let templateSeq = '';
      if (f3Next !== r3) {
        const tempSeq = Core.pcrProductSeq(seq, f3Next, r3);
        templateSeq = tempSeq.slice(0, -1); // Remove last base (r3 position)
      }
      
      // Calculate full PCR product: forward primer + template + reverse primer RC
      // This is the complete PCR product including primers
      const pcrProduct = pcrF + templateSeq + revRC;
      
      // Create fragment object for dropdown
      fragments = [{
        start: 0,
        end: pcrProduct.length,
        length: pcrProduct.length,
        seq: pcrProduct
      }];
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
    window.currentFragments = fragments;
    
    // Update backboneSeq when selection changes
    updateBackboneFromSelection();
    
    // Display summary
    if (fragmentsSummary) {
      fragmentsSummary.textContent = `(${fragments.length} fragment(s) generated)`;
    }
    
  } catch (error) {
    fragmentsInfo.style.display = 'none';
  }
}

// Update backboneSeq from dropdown selection
function updateBackboneFromSelection() {
  const backboneSelect = $('backbone-select');
  if (!backboneSelect || !window.currentFragments) return;
  
  const selectedIdx = parseInt(backboneSelect.value);
  if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= window.currentFragments.length) {
    // Default to longest if invalid selection
    const longestIdx = window.currentFragments.reduce((maxIdx, frag, idx) => 
      frag.length > window.currentFragments[maxIdx].length ? idx : maxIdx, 0);
    window.currentBackboneSeq = window.currentFragments[longestIdx].seq;
  } else {
    window.currentBackboneSeq = window.currentFragments[selectedIdx].seq;
  }
}

// Design button
function initDesignButton() {
  $('design-btn').addEventListener('click', () => {
    const container = $('module-content') || document.body;
    const seqEls = [
      $('vector-seq'),
      ...Array.from(document.querySelectorAll('#inserts-container .insert-seq'))
    ];

    const doDesign = () => {
      try {
      const warnings = [];
      const vectorTextRaw = $('vector-seq').value || '';
      const insertRowsRaw = document.querySelectorAll('.insert-row');
      const overlapLenRaw = parseInt($('overlap-len').value) || 25;
      const targetTmRaw = parseFloat($('target-tm').value) || 55;
      const primerConcRaw = parseFloat($('primer-conc').value) || 500;
      const naConcRaw = parseFloat($('na-conc').value) || 50;
      const mgConcRaw = parseFloat($('mg-conc').value) || 0;
      const vecLabel = extractFASTAHeader(vectorTextRaw) || 'Vector';
      const vecBody = stripFASTAHeaders(vectorTextRaw);
      if (vecBody && VIZ && VIZ.validateSequenceInput) {
        warnings.push(...VIZ.validateSequenceInput([{ label: vecLabel, seq: vecBody }], 'Vector'));
      }
      if (insertRowsRaw && insertRowsRaw.length && VIZ && VIZ.validateSequenceInput) {
        const insertItems = Array.from(insertRowsRaw).map((row, i) => {
          const textarea = row.querySelector('.insert-seq');
          const raw = textarea ? textarea.value || '' : '';
          return { label: extractFASTAHeader(raw) || `Insert #${i + 1}`, seq: stripFASTAHeaders(raw) };
        }).filter(x => x.seq && x.seq.trim());
        if (insertItems.length) {
          warnings.push(...VIZ.validateSequenceInput(insertItems, 'Insert'));
          if (VIZ.validateFragmentCount) {
            warnings.push(...VIZ.validateFragmentCount(insertItems.length, 1, 'Gibson Assembly'));
          }
        }
      }
      if (VIZ && VIZ.validateOverlapLength) {
        warnings.push(...VIZ.validateOverlapLength(overlapLenRaw, 15, 40));
      }
      if (VIZ && VIZ.validateParameterRange) {
        warnings.push(...VIZ.validateParameterRange({ Na: naConcRaw, Mg: mgConcRaw, conc: primerConcRaw, targetTm: targetTmRaw }));
      }
      const proceed = () => {
        // Parse vector
        const vectorText = $('vector-seq').value.trim();
        if (!vectorText) {
          throw new Error('Please provide vector sequence');
        }
      const vectorRecords = parseFASTA(vectorText);
      if (vectorRecords.length === 0) {
        throw new Error('Unable to parse vector sequence');
      }
      if (vectorRecords.length > 1) {
        throw new Error('Vector sequence should contain only one sequence');
      }
      const vector = vectorRecords[0];

      // Parse inserts and linkers
      const insertRows = document.querySelectorAll('.insert-row');
      const inserts = [];
      const linkers = [];
      insertRows.forEach((row, idx) => {
        const textarea = row.querySelector('.insert-seq');
        const content = textarea.value.trim();
        if (!content) return;
        const records = parseFASTA(content);
        if (records.length === 0) {
          throw new Error(`Insert #${idx + 1}: Unable to parse sequence`);
        }
        if (records.length > 1) {
          throw new Error(`Insert #${idx + 1}: Multiple sequences found, please provide only one sequence per insert`);
        }
        inserts.push(records[0]);
        
        // Process linker (between fragments, not the last one)
        if (idx < insertRows.length - 1) {
          const linkerInput = row.querySelector('.insert-linker')?.value?.trim() || '';
          let linker = '';
          
          if (linkerInput) {
            const linkerTypeBtn = row.querySelector('.linker-type-btn');
            const linkerType = linkerTypeBtn?.getAttribute('data-type') || 'DNA';
            
            if (linkerType === 'AA') {
              // Convert amino acid to DNA (use selected host organism)
              const hostCode = $('host-organism')?.value || 's_cerevisiae';
              try {
                linker = aaToDNA(linkerInput, hostCode);
              } catch (e) {
                throw new Error(`Error converting amino acid linker for Insert #${idx + 1}: ${e.message}`);
              }
            } else {
              // Treat as DNA sequence
              linker = cleanDNA(linkerInput);
            }
          }
          
          linkers.push(linker);
        }
      });

      if (inserts.length === 0) {
        throw new Error('Please provide at least one insert sequence');
      }

      // Get linearization mode
      const mode = document.querySelector('input[name="linearization-mode"]:checked').value;
      const overlapLen = parseInt($('overlap-len').value) || 25;
      const targetTm = parseFloat($('target-tm').value) || 55;
      const deltaTm = parseFloat($('delta-tm').value) || 2.5;
      const primerConc = parseFloat($('primer-conc').value) || 500;
      const naConc = parseFloat($('na-conc').value) || 50;
      const mgConc = parseFloat($('mg-conc').value) || 0;

      // Design primers
      const results = designGibsonAssembly(vector, inserts, linkers, {
        mode,
        overlapLen,
        targetTm,
        deltaTm,
        primerConc,
        naConc,
        mgConc
      });

      // Display results
      renderResults(results, vector, inserts);
      
      // Store data for download
      window.currentPrimers = results.primers || [];
      window.currentAssembledSeq = results.assembledSeq || '';
      const vecName = vector.name || 'vector';
      window.currentAssembledName = vecName ? `${vecName}_Gibson` : 'Gibson_Assembly';

      };
      const warningsBox = $('warnings-box');
      if (warningsBox) {
        if (warnings.length > 0) {
          warningsBox.innerHTML = '';
          warnings.forEach(warning => {
            const p = document.createElement('p');
            p.textContent = warning.message;
            warningsBox.appendChild(p);
          });
        }
      }
      if (warnings.length === 0) {
        proceed();
      }
    } catch (error) {
      showError(error.message);
    }
    };

    if (VIZ && typeof VIZ.guardSingleFastaPerField === 'function') {
      const shown = VIZ.guardSingleFastaPerField(container, seqEls, doDesign);
      if (shown) return;
    }

    doDesign();
  });
}

function designGibsonAssembly(vector, inserts, linkers = [], opts) {
  const {
    mode = 'enzyme',
    overlapLen = 25,
    targetTm = 55,
    deltaTm = 2.5,
    primerConc = 500,
    naConc = 50,
    mgConc = 0
  } = opts;

  const notes = [];
  const insertSeqs = inserts.map(ins => ins.seq);
  
  // Ensure linkers array has correct length (one less than inserts)
  while (linkers.length < insertSeqs.length - 1) {
    linkers.push('');
  }
  
  // Step 1: Determine vector linearization and assemble the complete sequence
  // Use original circular sequence for enzyme site detection
  const originalSeq = vector.seq;
  let backboneLeft = '';
  let backboneRight = '';
  let assembledSeq = '';
  let assembledSeqRaw = '';         // assembled sequence before rotation (enzyme mode)
  let rotationOffset = 0;           // tracks rotation applied to assembled sequence
  let insertPositionsRaw = null;    // insert start/end before rotation
  let assembledLength = 0;          // length of assembled sequence before rotation

  // Check if user has selected a specific backbone fragment
  const selectedBackboneSeq = window.currentBackboneSeq;
  const selectedFragment = window.currentFragments && window.currentFragments.length > 0 
    ? window.currentFragments.find((f, idx) => {
        const backboneSelect = $('backbone-select');
        if (!backboneSelect) return false;
        const selectedIdx = parseInt(backboneSelect.value);
        return !isNaN(selectedIdx) && idx === selectedIdx;
      })
    : null;

  if (mode === 'enzyme') {
    const enzyme1Name = $('enzyme1').value.trim();
    const enzyme2Name = $('enzyme2').value.trim();
    const keepSites = $('keep-sites').value === 'yes';

    if (!enzyme1Name && !enzyme2Name) {
      throw new Error('Please select at least one restriction enzyme');
    }

    const enzyme1 = Core.getEnzyme(enzyme1Name);
    const enzyme2 = enzyme2Name ? Core.getEnzyme(enzyme2Name) : null;

    if (!enzyme1 && !enzyme2) {
      throw new Error('Invalid enzyme name(s)');
    }

    if (enzyme1 && enzyme2 && enzyme1Name === enzyme2Name) {
      throw new Error('Enzyme 1 and Enzyme 2 cannot be the same');
    }

    const useDouble = !!(enzyme1 && enzyme2);

    // Check if enzymes have any sites at all
    const sites1 = enzyme1Name ? Core.findEnzymeSites(originalSeq, enzyme1Name) : [];
    const sites2 = enzyme2Name ? Core.findEnzymeSites(originalSeq, enzyme2Name) : [];
    
    if (useDouble && (sites1.length === 0 || sites2.length === 0)) {
      let msg = 'Double-digest requires at least one site for each enzyme. ';
      if (sites1.length === 0) msg += ` ${enzyme1Name} has no sites in the vector.`;
      if (sites2.length === 0) msg += ` ${enzyme2Name} has no sites in the vector.`;
      throw new Error(msg);
    }
    
    if (!useDouble && sites1.length === 0 && sites2.length === 0) {
      throw new Error('Selected enzyme has no sites in the vector.');
    }

    // Always use fragment-based calculation - no default calculation
    // This ensures consistent behavior regardless of number of sites

    // Always use fragment-based calculation
    // User must select a fragment from the dropdown (which is always populated by updateFragmentsInfo)
    const backboneSelect = $('backbone-select');
    if (!backboneSelect || !window.currentFragments || window.currentFragments.length === 0) {
      throw new Error('No fragments available. Please ensure enzymes are selected and vector sequence is provided.');
    }
    
    const selectedIdx = parseInt(backboneSelect.value);
    if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= window.currentFragments.length) {
      throw new Error('Invalid fragment selection.');
    }
    
    // User selected a specific fragment - this fragment IS the backbone
    // All other fragments will be replaced by inserts
    const selectedFrag = window.currentFragments[selectedIdx];
    const allFragments = window.currentFragments;
    
    // selectedFrag.start and selectedFrag.end are CUT positions (cutTop), not recognition site positions
    // selectedFrag.leftCuts and selectedFrag.rightCuts contain enzyme information at the cut positions
    // To get recognition site position: siteStart = cutTop - cut5
    
    // Helper function to get recognition site start position from cut position
    const getSiteStartFromCut = (cutPos, enzymeName) => {
      const enz = Core.getEnzyme(enzymeName);
      if (!enz || typeof enz.cut5 !== 'number') return null;
      return cutPos - enz.cut5; // cutTop = siteStart + cut5, so siteStart = cutTop - cut5
    };
    
    // Get all fragments that will be replaced (all except the selected one)
    const fragmentsToReplace = allFragments.filter((f, idx) => idx !== selectedIdx);
    
    // New approach: Use the selected fragment's sequence directly
    // Remove recognition sites from fragment boundaries to create blunt ends
    // If keepSites=true, add full recognition site sequences back during assembly
    // If keepSites=false, don't add recognition sites
    
    // Get the backbone fragment sequence (this is the actual backbone)
    let backboneSeq = selectedFrag.seq;
    
    // Get enzyme information at fragment boundaries
    const leftCuts = selectedFrag.leftCuts || [];
    const rightCuts = selectedFrag.rightCuts || [];
    
    // Get recognition site sequences and lengths
    let leftSiteSeq = null;
    let rightSiteSeq = null;
    let leftSiteLen = 0;
    let rightSiteLen = 0;
    
    if (leftCuts.length > 0) {
      const leftEnzymeName = leftCuts[0].enzyme;
      const leftEnzyme = Core.getEnzyme(leftEnzymeName);
      if (leftEnzyme && leftEnzyme.site) {
        leftSiteSeq = leftEnzyme.site;
        leftSiteLen = leftSiteSeq.length;
      }
    }
    
    if (rightCuts.length > 0) {
      const rightEnzymeName = rightCuts[0].enzyme;
      const rightEnzyme = Core.getEnzyme(rightEnzymeName);
      if (rightEnzyme && rightEnzyme.site) {
        rightSiteSeq = rightEnzyme.site;
        rightSiteLen = rightSiteSeq.length;
      }
    }
    
    // Remove recognition sites from fragment boundaries
    // The fragment sequence may include part of the recognition sites at the boundaries
    // We need to remove them to create blunt ends
    
    // For the left boundary: the cut is at cut5 position within the site
    // So the fragment may include (site.length - cut5) bases from the site at the start
    if (leftCuts.length > 0 && leftSiteSeq) {
      const leftEnzyme = Core.getEnzyme(leftCuts[0].enzyme);
      if (leftEnzyme && typeof leftEnzyme.cut5 === 'number') {
        const cut5 = leftEnzyme.cut5;
        const siteBasesInFragment = leftSiteLen - cut5;
        if (siteBasesInFragment > 0 && backboneSeq.length >= siteBasesInFragment) {
          // Check if the fragment starts with the expected site sequence
          const expectedSiteSuffix = leftSiteSeq.slice(cut5);
          if (backboneSeq.startsWith(expectedSiteSuffix)) {
            // Remove the site bases from the start
            backboneSeq = backboneSeq.slice(siteBasesInFragment);
          }
        }
      }
    }
    
    // For the right boundary: the cut is at cut5 position within the site
    // So the fragment may include cut5 bases from the site at the end
    if (rightCuts.length > 0 && rightSiteSeq) {
      const rightEnzyme = Core.getEnzyme(rightCuts[0].enzyme);
      if (rightEnzyme && typeof rightEnzyme.cut5 === 'number') {
        const cut5 = rightEnzyme.cut5;
        if (cut5 > 0 && backboneSeq.length >= cut5) {
          // Check if the fragment ends with the expected site sequence
          const expectedSitePrefix = rightSiteSeq.slice(0, cut5);
          if (backboneSeq.endsWith(expectedSitePrefix)) {
            // Remove the site bases from the end
            backboneSeq = backboneSeq.slice(0, backboneSeq.length - cut5);
          }
        }
      }
    }
    
    // Now backboneSeq is the fragment with recognition sites removed (blunt ends)
    // 
    // New approach: Directly use backboneSeq + insertBlock to build assembled sequence
    // This is simpler and cleaner than using fragmentsToReplace's boundaries
    // 
    // Core idea:
    // - Retained part: Fragment1 (selectedFrag) = backboneSeq
    // - Replaced part: Complement of Fragment1 (from end to start, wrap around)
    // - New plasmid (circular): Fragment1 + Insert = backboneSeq + insertBlock
    //
    // Helper function for string rotation (to preserve starting point if needed)
    const rotateSequence = (seq, shift) => {
      const n = seq.length;
      const k = ((shift % n) + n) % n; // Handle negative shifts
      return seq.slice(k) + seq.slice(0, k);
    };
    
    // Build insertBlock (inserts + linkers)
    const insertBlock = insertSeqs.map((ins, i) => {
      if (i < linkers.length && linkers[i]) {
        return ins + linkers[i];
      }
      return ins;
    }).join('');
    
    // If keepSites=true, add recognition sites around the insert
    // For circular sequence: insert replaces the complement (from end to start, wrap around)
    // So in assembled sequence: backboneSeq + rightSiteSeq (at end) + insertBlock + leftSiteSeq (at start, wrap around)
    // But since we're building a linear representation, it's: backboneSeq + rightSiteSeq + insertBlock + leftSiteSeq
    let assembledCircle;
    if (keepSites && leftSiteSeq && rightSiteSeq) {
      // Keep recognition sites: add them around the insert
      // rightSiteSeq is at Fragment1's end (before insert, since insert replaces from end to start)
      // leftSiteSeq is at Fragment1's start (after insert, since it wraps around)
      assembledCircle = backboneSeq + rightSiteSeq + insertBlock + leftSiteSeq;
    } else {
      // Don't keep recognition sites
      assembledCircle = backboneSeq + insertBlock;
    }
    
    // Calculate insert positions in assembledCircle BEFORE rotation
    // This ensures positions are correct even after rotation
    let insertStartInCircle = backboneSeq.length;
    if (keepSites && rightSiteSeq) {
      insertStartInCircle += rightSiteSeq.length;
    }
    
    // Store insert positions in assembledCircle for later adjustment
    const insertPositionsInCircle = [];
    let currentPos = insertStartInCircle;
    for (let i = 0; i < inserts.length; i++) {
      const start = currentPos;
      const end = currentPos + insertSeqs[i].length;
      insertPositionsInCircle.push({ start, end, seq: insertSeqs[i] });
      currentPos = end;
      if (i < linkers.length && linkers[i]) {
        currentPos += linkers[i].length;
      }
    }
    
    // Rotation logic: preserve original 0 position if it's still in Fragment1
    // If original 0 is not in Fragment1, we need to find where it maps in the assembled sequence
    // and rotate to preserve it
    
    // Initialize assembledSeq (already declared at function start)
    assembledSeq = assembledCircle;
    assembledSeqRaw = assembledCircle;       // keep pre-rotation for coordinate-safe overlap extraction
    assembledLength = assembledCircle.length;
    insertPositionsRaw = insertPositionsInCircle;
    rotationOffset = 0; // Track rotation offset for adjusting insert positions
    
    // Check if original position 0 is within the selected fragment
    const original0InFragment = (selectedFrag.end >= selectedFrag.start && 
                                  0 >= selectedFrag.start && 0 < selectedFrag.end) ||
                                (selectedFrag.end < selectedFrag.start && 
                                 (0 >= selectedFrag.start || 0 < selectedFrag.end));
    
    if (original0InFragment) {
      // Original 0 is within Fragment1, so we need to rotate to preserve it
      // Calculate the offset of 0 within Fragment1 (in original sequence coordinates)
      let offsetInFragment = 0;
      if (selectedFrag.end >= selectedFrag.start) {
        offsetInFragment = 0 - selectedFrag.start;
      } else {
        // Fragment wraps, 0 could be in the wrap-around part
        if (0 >= selectedFrag.start) {
          offsetInFragment = 0 - selectedFrag.start;
        } else {
          offsetInFragment = (originalSeq.length - selectedFrag.start) + 0;
        }
      }
      
      // Adjust for recognition sites removed from backboneSeq
      // The offset needs to account for sites removed at the start of Fragment1
      if (leftCuts.length > 0 && leftSiteSeq) {
        const leftEnzyme = Core.getEnzyme(leftCuts[0].enzyme);
        if (leftEnzyme && typeof leftEnzyme.cut5 === 'number') {
          const siteBasesRemoved = leftSiteSeq.length - leftEnzyme.cut5;
          offsetInFragment = Math.max(0, offsetInFragment - siteBasesRemoved);
        }
      }
      
      // In assembledCircle, backboneSeq starts at position 0.
      // rotateSequence() performs a left-rotation by `shift` (normalized),
      // so to bring the old position `offsetInFragment` to the new 0, we rotate by +offsetInFragment.
      rotationOffset = offsetInFragment;
      assembledSeq = rotateSequence(assembledCircle, rotationOffset);
    } else {
      // Original 0 is not in Fragment1, so it's been replaced by insert
      // Calculate where original 0 is in the replaced region
      let offsetInReplaced = 0;
      if (selectedFrag.end < selectedFrag.start) {
        // Replaced region wraps: from end to 0, then 0 to start
        if (0 >= selectedFrag.end) {
          offsetInReplaced = 0 - selectedFrag.end;
        } else {
          offsetInReplaced = (originalSeq.length - selectedFrag.end) + 0;
        }
      } else {
        // Replaced region: from end to start (wrap around)
        if (0 < selectedFrag.end) {
          // 0 is before end, so it's in the wrap-around part
          offsetInReplaced = (originalSeq.length - selectedFrag.end) + 0;
        } else {
          // 0 is after start, so it's in the normal part
          offsetInReplaced = 0 - selectedFrag.end;
        }
      }
      
      // In assembledCircle, the replaced region starts after backboneSeq
      // So original 0 maps to: backboneSeq.length + offsetInReplaced
      // But we need to account for rightSiteSeq if keepSites=true
      let positionInAssembled = backboneSeq.length;
      if (keepSites && rightSiteSeq) {
        positionInAssembled += rightSiteSeq.length;
      }
      positionInAssembled += offsetInReplaced;
      
      // Rotate so that this position becomes the new 0 (left-rotate by +positionInAssembled)
      rotationOffset = positionInAssembled;
      assembledSeq = rotateSequence(assembledCircle, rotationOffset);
    }
    // For compatibility with existing code structure, we still need backboneLeft and backboneRight
    // They're used for primer design calculations (to determine insert positions)
    // In the new approach: assembledSeq = backboneSeq + insertBlock
    // So: backboneLeft = backboneSeq, backboneRight = '' (inserts come after backboneSeq)
    backboneLeft = backboneSeq;
    backboneRight = '';
    
    // Update notes
    const replacedCount = allFragments.length - 1;
    if (replacedCount === 1) {
      const fragToReplace = fragmentsToReplace[0];
      notes.push(`Using selected backbone fragment #${selectedIdx + 1} (${selectedFrag.length} bp). Fragment #${allFragments.findIndex(f => f === fragToReplace) + 1} (${fragToReplace.length} bp) will be replaced by insert(s).`);
    } else {
      notes.push(`Using selected backbone fragment #${selectedIdx + 1} (${selectedFrag.length} bp). ${replacedCount} fragment(s) will be replaced by insert(s).`);
    }
    notes.push(`Assembled sequence: ${backboneSeq.length} bp backbone + ${insertBlock.length} bp insert(s) = ${assembledSeq.length} bp total.`);

  } else if (mode === 'pcr') {
    // Normalize primers (support IUPAC)
    let pcrF = normIUPAC($('pcr-forward').value.trim());
    let pcrR = normIUPAC($('pcr-reverse').value.trim());

    if (!pcrF || !pcrR) {
      throw new Error('Please provide both forward and reverse PCR primers');
    }

    const L = originalSeq.length;
    const minLen = 15; // Minimum 3' match length
    const maxLen = 25; // Maximum scan length

    // Find 3' end hits using continuous matching
    let fHits = findForward3primeHits(pcrF, originalSeq, minLen, maxLen);
    let rHits = findReverse3primeHits(pcrR, originalSeq, minLen, maxLen);
    
    // Auto-detect RC / swap primers fallback
    let primersSwapped = false;
    if (!fHits.length || !rHits.length) {
      // Try swapped primers
      const fHitsSwapped = findForward3primeHits(pcrR, originalSeq, minLen, maxLen);
      const rHitsSwapped = findReverse3primeHits(pcrF, originalSeq, minLen, maxLen);
      
      if (fHitsSwapped.length > 0 && rHitsSwapped.length > 0) {
        [pcrF, pcrR] = [pcrR, pcrF];
        fHits = fHitsSwapped;
        rHits = rHitsSwapped;
        primersSwapped = true;
        notes.push('Primers auto-swapped (detected RC orientation).');
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
      throw new Error('No valid PCR product found. Please check primer sequences.');
    }

    const f3 = bestFHit.f3;
    const r3 = bestRHit.r3;
    const revRC = bestRHit.revRC;
    
    // Calculate template sequence (f3+1→r3-1) excluding endpoints to avoid duplication
    const f3Next = (f3 + 1) % L;
    let templateSeq = '';
    if (f3Next !== r3) {
      const tempSeq = Core.pcrProductSeq(originalSeq, f3Next, r3);
      templateSeq = tempSeq.slice(0, -1); // Remove last base (r3 position)
    }
    
    // Calculate full PCR product: forward primer + template + reverse primer RC
    // This ensures correct sequence even when primers have 5' overhang (Gibson overlap) not in vector
    const pcrProduct = pcrF + templateSeq + revRC;
    
    notes.push(`Vector linearized by PCR: forward primer 3' end at ${f3}, reverse primer 3' end at ${r3}. PCR product: ${pcrProduct.length} bp (forward: ${pcrF.length} bp + template: ${templateSeq.length} bp + reverse RC: ${revRC.length} bp).`);
    if (primersSwapped) {
      notes.push('Note: Primers were auto-swapped due to RC orientation detection.');
    }

    // Assemble sequence: PCR product + insert block
    // assembledSeq = PCR product + insert(s) + linker(s)
    const assembledParts = [pcrProduct];
    for (let i = 0; i < insertSeqs.length; i++) {
      assembledParts.push(insertSeqs[i]);
      if (i < linkers.length && linkers[i]) {
        assembledParts.push(linkers[i]);
      }
    }
    assembledSeq = assembledParts.join('');
    
    // Update notes with assembly information
    const insertBlockLen = insertSeqs.reduce((sum, seq) => sum + seq.length, 0) + 
                          (linkers.reduce((sum, linker) => sum + (linker ? linker.length : 0), 0));
    notes.push(`Assembled sequence: ${pcrProduct.length} bp PCR product + ${insertBlockLen} bp insert(s) = ${assembledSeq.length} bp total.`);
    
    // For compatibility with existing code structure
    // In PCR mode: assembledSeq = PCR product + insert block
    // So: backboneLeft = PCR product, backboneRight = '' (inserts come after PCR product)
    backboneLeft = pcrProduct;
    backboneRight = '';
  }

  // Step 2: Design primers on the assembled sequence
  const primers = [];
  
  // Calculate insert positions in assembled sequence
  // For enzyme mode, positions were calculated before rotation, now adjust for rotation
  // For PCR mode, calculate positions normally
  
  const insertPositions = [];
  
  if (mode === 'enzyme' && insertPositionsRaw) {
    // Use pre-rotation positions and apply the rotation offset directly
    const seqLen = assembledLength || assembledSeq.length;
    insertPositionsRaw.forEach(raw => {
      // rotateSequence() left-rotates by `rotationOffset`, so old coordinates map to new by subtracting rotationOffset.
      const start = ((raw.start - rotationOffset) % seqLen + seqLen) % seqLen;
      const end = ((raw.end - rotationOffset) % seqLen + seqLen) % seqLen;
      insertPositions.push({ start, end, seq: raw.seq });
    });
  } else {
    // PCR mode or no rotation: calculate positions normally
    let currentPos = backboneLeft.length;
    for (let i = 0; i < inserts.length; i++) {
      const start = currentPos;
      const end = currentPos + insertSeqs[i].length;
      insertPositions.push({ start, end, seq: insertSeqs[i] });
      currentPos = end;
      if (i < linkers.length && linkers[i]) {
        currentPos += linkers[i].length;
      }
    }
  }

  // For PCR mode, we'll extract overlaps from assembled sequence after it's built
  // No need to pre-calculate here

  // Choose sequence/positions for overlap extraction (use pre-rotation coords in enzyme mode)
  const overlapSeqSource = (mode === 'enzyme' && assembledSeqRaw) ? assembledSeqRaw : assembledSeq;
  const designPositions = (mode === 'enzyme' && insertPositionsRaw) ? insertPositionsRaw : insertPositions;

  // Design primers for each insert
  for (let i = 0; i < inserts.length; i++) {
    const insert = inserts[i];
    const insertSeq = insertSeqs[i];
    const posDesign = designPositions[i];

    // Design core primers (on insert sequence, which is the PCR template)
    const fwdCore = pickCorePrimer(insertSeq, true, targetTm, naConc, mgConc, primerConc, 20);
    const revCore = pickCorePrimer(insertSeq, false, targetTm, naConc, mgConc, primerConc, 20);

    // Extract overlaps from assembled sequence (or PCR primers for PCR mode)
    let leftOverlapSeq = '';
    let rightOverlapSeq = '';

    // Both PCR and enzyme modes use the same overlap extraction logic
    if (mode === 'pcr' || mode === 'enzyme') {
      // Enzyme mode: extract overlaps from assembled sequence
      if (i === 0) {
        // First insert: left overlap from backbone
        // Use subseqCircular to handle wrap-around cases safely
        const overlapStart = posDesign.start - overlapLen;
        leftOverlapSeq = Core.subseqCircular(overlapSeqSource, overlapStart, posDesign.start);
      } else {
        // Middle insert: left overlap from previous insert + linker
        const prevPos = designPositions[i - 1];
        const prevLinker = i > 0 && i - 1 < linkers.length ? linkers[i - 1] : '';
        const prevLinkerLen = prevLinker ? prevLinker.length : 0;
        
        if (prevLinkerLen >= overlapLen) {
          // Long linker: overlap is in the middle of linker
          const linkerStartInAssembled = prevPos.end;
          const overlapStartInLinker = Math.floor((prevLinkerLen - overlapLen) / 2);
          leftOverlapSeq = overlapSeqSource.slice(
            linkerStartInAssembled + overlapStartInLinker,
            linkerStartInAssembled + prevLinkerLen
          );
        } else {
          // Short linker or no linker: from linker midpoint backwards
          const linkerStartInAssembled = prevPos.end;
          const linkerMidInAssembled = prevLinkerLen > 0 
            ? linkerStartInAssembled + Math.floor(prevLinkerLen / 2)
            : linkerStartInAssembled;
          const halfOverlap = Math.floor(overlapLen / 2);
          const overlapStartPos = linkerMidInAssembled - halfOverlap;
          leftOverlapSeq = overlapSeqSource.slice(overlapStartPos, posDesign.start);
        }
      }

      if (i === inserts.length - 1) {
        // Last insert: right overlap from backbone
        // Use subseqCircular to handle wrap-around cases safely
        const overlapEnd = posDesign.end + overlapLen;
        rightOverlapSeq = Core.subseqCircular(overlapSeqSource, posDesign.end, overlapEnd);
      } else {
        // Middle insert: right overlap from current insert + linker
        const nextPos = designPositions[i + 1];
        const currentLinker = i < linkers.length ? linkers[i] : '';
        const currentLinkerLen = currentLinker ? currentLinker.length : 0;
        
        if (currentLinkerLen >= overlapLen) {
          // Long linker: overlap is in the middle of linker
          const linkerStartInAssembled = posDesign.end;
          const overlapStartInLinker = Math.floor((currentLinkerLen - overlapLen) / 2);
          const overlapEndInLinker = overlapStartInLinker + overlapLen;
          rightOverlapSeq = overlapSeqSource.slice(
            linkerStartInAssembled,
            linkerStartInAssembled + overlapEndInLinker
          );
        } else {
          // Short linker or no linker: from linker midpoint forwards
          const linkerStartInAssembled = posDesign.end;
          const linkerMidInAssembled = currentLinkerLen > 0
            ? linkerStartInAssembled + Math.floor(currentLinkerLen / 2)
            : linkerStartInAssembled;
          const halfOverlap = Math.floor(overlapLen / 2);
          const overlapEndPos = linkerMidInAssembled + halfOverlap;
          rightOverlapSeq = overlapSeqSource.slice(posDesign.end, overlapEndPos);
        }
      }
    }

    // Build full primers
    // Forward primer: leftOverlap + fwdCore (both in forward direction)
    const fwdFull = leftOverlapSeq + fwdCore;
    
    // Reverse primer: rightOverlap needs to be reverse complemented, then add revCore (which is already RC)
    // The actual reverse primer sequence is: revComp(rightOverlap) + revCore
    const rightOverlapRC = Core.reverseComplementSeq(rightOverlapSeq);
    const revFull = rightOverlapRC + revCore;

    primers.push({
      insertName: insert.name,
      insertIndex: i + 1,
      insertLength: insertSeq.length,
      forward: {
        core: fwdCore,
        full: fwdFull,
        overlap: leftOverlapSeq
      },
      reverse: {
        core: revCore,
        full: revFull,
        overlap: rightOverlapSeq  // Store original direction for display
      }
    });
  }

  // Extract left and right overlaps for display (first and last)
  let leftOverlap = '';
  let rightOverlap = '';
  
  // Extract overlaps from assembled sequence (works for both PCR and enzyme modes)
  if (insertPositions.length > 0) {
    const leftStart = insertPositions[0].start;
    leftOverlap = Core.subseqCircular(assembledSeq, leftStart - overlapLen, leftStart);
  }
  if (insertPositions.length > 0) {
    const rightEnd = insertPositions[insertPositions.length - 1].end;
    rightOverlap = Core.subseqCircular(assembledSeq, rightEnd, rightEnd + overlapLen);
  }

  // Junction overlaps (between inserts)
  const junctionOverlaps = [];
  for (let i = 0; i < insertPositions.length - 1; i++) {
    const currentEnd = insertPositions[i].end;
    const nextStart = insertPositions[i + 1].start;
    const currentLinker = i < linkers.length ? linkers[i] : '';
    const currentLinkerLen = currentLinker ? currentLinker.length : 0;
    
    if (currentLinkerLen >= overlapLen) {
      // Long linker: overlap is in the middle of linker
      const linkerStartInAssembled = currentEnd;
      const overlapStartInLinker = Math.floor((currentLinkerLen - overlapLen) / 2);
      const overlapEndInLinker = overlapStartInLinker + overlapLen;
      const junctionOverlap = Core.subseqCircular(
        assembledSeq,
        linkerStartInAssembled + overlapStartInLinker,
        linkerStartInAssembled + overlapEndInLinker
      );
      junctionOverlaps.push(junctionOverlap);
    } else {
      // Short linker or no linker: from linker midpoint to both sides
      const linkerStartInAssembled = currentEnd;
      const linkerMidInAssembled = currentLinkerLen > 0
        ? linkerStartInAssembled + Math.floor(currentLinkerLen / 2)
        : linkerStartInAssembled;
      const halfOverlap = Math.floor(overlapLen / 2);
      const backPart = Core.subseqCircular(assembledSeq, linkerMidInAssembled - halfOverlap, linkerMidInAssembled);
      const forwardPart = Core.subseqCircular(assembledSeq, linkerMidInAssembled, linkerMidInAssembled + halfOverlap);
      const junctionOverlap = backPart + forwardPart;
      junctionOverlaps.push(junctionOverlap);
    }
  }

  // Debug: print each junction overlap calculation
  try {
    const debugRows = [];
    const seqLenDbg = assembledSeq ? assembledSeq.length : 0;
    const normPos = (p) => {
      if (!seqLenDbg) return 0;
      return ((p % seqLenDbg) + seqLenDbg) % seqLenDbg;
    };
    const subseqCircularMeta = (start, end) => {
      if (!assembledSeq) return { seq: '', start, end, startNorm: 0, endNorm: 0, wrapped: false };
      if (!seqLenDbg) return { seq: '', start, end, startNorm: 0, endNorm: 0, wrapped: false };
      const s = normPos(start);
      const e = normPos(end);
      const wrapped = (start < 0) || (end > seqLenDbg) || (s > e) || (start === end && start !== 0);
      const seq = (s <= e) ? assembledSeq.slice(s, e) : (assembledSeq.slice(s) + assembledSeq.slice(0, e));
      return { seq, start, end, startNorm: s, endNorm: e, wrapped };
    };

    if (insertPositions.length > 0) {
      const leftStart = insertPositions[0].start;
      const leftMeta = subseqCircularMeta(leftStart - overlapLen, leftStart);
      debugRows.push({
        junction: 'Vector -> Insert #1',
        start: leftMeta.start,
        end: leftMeta.end,
        startNorm: leftMeta.startNorm,
        endNorm: leftMeta.endNorm,
        wrapped: leftMeta.wrapped,
        len: leftMeta.seq.length,
        seq: leftMeta.seq
      });

      const lastEnd = insertPositions[insertPositions.length - 1].end;
      const rightMeta = subseqCircularMeta(lastEnd, lastEnd + overlapLen);
      debugRows.push({
        junction: `Insert #${insertPositions.length} -> Vector`,
        start: rightMeta.start,
        end: rightMeta.end,
        startNorm: rightMeta.startNorm,
        endNorm: rightMeta.endNorm,
        wrapped: rightMeta.wrapped,
        len: rightMeta.seq.length,
        seq: rightMeta.seq
      });
    }

    for (let i = 0; i < insertPositions.length - 1; i++) {
      const currentEnd = insertPositions[i].end;
      const currentLinker = i < linkers.length ? linkers[i] : '';
      const currentLinkerLen = currentLinker ? currentLinker.length : 0;

      if (currentLinkerLen >= overlapLen) {
        const linkerStartInAssembled = currentEnd;
        const overlapStartInLinker = Math.floor((currentLinkerLen - overlapLen) / 2);
        const overlapEndInLinker = overlapStartInLinker + overlapLen;
        const meta = subseqCircularMeta(
          linkerStartInAssembled + overlapStartInLinker,
          linkerStartInAssembled + overlapEndInLinker
        );
        debugRows.push({
          junction: `Insert #${i + 1} -> Insert #${i + 2} (linker-mid)`,
          start: meta.start,
          end: meta.end,
          startNorm: meta.startNorm,
          endNorm: meta.endNorm,
          wrapped: meta.wrapped,
          len: meta.seq.length,
          seq: meta.seq
        });
      } else {
        const linkerStartInAssembled = currentEnd;
        const linkerMidInAssembled = currentLinkerLen > 0
          ? linkerStartInAssembled + Math.floor(currentLinkerLen / 2)
          : linkerStartInAssembled;
        const halfOverlap = Math.floor(overlapLen / 2);
        const metaA = subseqCircularMeta(linkerMidInAssembled - halfOverlap, linkerMidInAssembled);
        const metaB = subseqCircularMeta(linkerMidInAssembled, linkerMidInAssembled + halfOverlap);
        const seq = (metaA.seq || '') + (metaB.seq || '');
        debugRows.push({
          junction: `Insert #${i + 1} -> Insert #${i + 2} (split)`,
          start: metaA.start,
          end: metaB.end,
          startNorm: metaA.startNorm,
          endNorm: metaB.endNorm,
          wrapped: metaA.wrapped || metaB.wrapped,
          len: seq.length,
          seq
        });
      }
    }

    const primerOverlapRows = (primers || []).map((p) => ({
      insertIndex: p.insertIndex,
      insertName: p.insertName,
      forwardOverlapLen: p.forward?.overlap?.length || 0,
      reverseOverlapLen: p.reverse?.overlap?.length || 0,
      forwardOverlap: p.forward?.overlap || '',
      reverseOverlap: p.reverse?.overlap || ''
    }));

    console.groupCollapsed('[Gibson] Junction overlap debug');
    console.log({ mode, overlapLen, assembledSeqLen: seqLenDbg, insertCount: insertPositions.length, linkers: (linkers || []).map(l => l ? l.length : 0) });
    if (debugRows.length) console.table(debugRows);
    if (primerOverlapRows.length) console.table(primerOverlapRows);
    console.groupEnd();
  } catch (e) {}

  return {
    primers,
    assembledSeq,
    leftOverlap,
    rightOverlap,
    junctionOverlaps,
    linkers,
    notes,
    vectorName: vector.name
  };
}

function pickCorePrimer(seq, isForward, targetTm, naConc, mgConc, primerConc, defaultCoreLen) {
  const minLen = 18;
  const maxLen = 40;
  const deltaTm = parseFloat($('delta-tm').value) || 2.5;
  const tolerance = deltaTm;
  
  let best = null;
  let bestDiff = Infinity;
  
  if (isForward) {
    // Forward: try different lengths from start
    for (let len = minLen; len <= Math.min(maxLen, seq.length); len++) {
      const coreSeq = seq.slice(0, len);
      const tm = Core.tmcalNN(coreSeq, naConc, mgConc, primerConc);
      
      if (!isFinite(tm)) continue;
      
      const diff = Math.abs(tm - targetTm);
      
      // Prefer sequences within tolerance
      if (tm >= targetTm - tolerance && tm <= targetTm + tolerance) {
        if (!best || diff < bestDiff) {
          best = coreSeq;
          bestDiff = diff;
        }
      } else if (!best) {
        // If no sequence within tolerance yet, keep the closest one
        if (diff < bestDiff) {
          best = coreSeq;
          bestDiff = diff;
        }
      }
    }
  } else {
    // Reverse: try different lengths from end (will be reverse complemented)
    for (let len = minLen; len <= Math.min(maxLen, seq.length); len++) {
      const coreSeq = seq.slice(-len);
      const tm = Core.tmcalNN(coreSeq, naConc, mgConc, primerConc);
      
      if (!isFinite(tm)) continue;
      
      const diff = Math.abs(tm - targetTm);
      
      // Prefer sequences within tolerance
      if (tm >= targetTm - tolerance && tm <= targetTm + tolerance) {
        if (!best || diff < bestDiff) {
          best = coreSeq;
          bestDiff = diff;
        }
      } else if (!best) {
        // If no sequence within tolerance yet, keep the closest one
        if (diff < bestDiff) {
          best = coreSeq;
          bestDiff = diff;
        }
      }
    }
  }
  
  // Fallback to default length if no good match found
  if (!best) {
    if (isForward) {
      best = seq.slice(0, Math.min(defaultCoreLen || 20, seq.length));
    } else {
      best = seq.slice(-Math.min(defaultCoreLen || 20, seq.length));
    }
  }
  
  // For reverse primer, return reverse complement
  if (!isForward) {
    best = Core.reverseComplementSeq(best);
  }
  
  return best;
}

// Draw Gibson assembly figure based on insert count
function drawGibsonAssemblyFigure(insertCount, container) {
  const img = container.querySelector('#asm-img');
  
  if (!img) {
    console.warn('drawGibsonAssemblyFigure: #asm-img element not found');
    return;
  }
  
  // Map insert count to image file
  // HTML is loaded via fetch and injected into app-index.html
  // So relative paths are relative to app/ directory
  // Images are in: app/modules/contents/pictures/Gibson_assembly/
  const folder = "modules/contents/pictures/Gibson_assembly";
  const fileMap = {
    1: "gibson_1insert.svg",
    2: "gibson_2insert.svg",
    3: "gibson_3insert.svg",
    4: "gibson_4insert.svg",
    5: "gibson_5insert.svg",
    6: "gibson_6insert.svg"
  };
  
  const k = Math.min(Math.max(1, insertCount), 6); // Clamp between 1 and 6
  
  if (fileMap[k]) {
    const imagePath = folder + "/" + fileMap[k];
    console.log('drawGibsonAssemblyFigure: insertCount=', insertCount, 'k=', k, 'filename=', fileMap[k], 'path=', imagePath);
    img.src = imagePath;
    img.style.display = "block";
    img.onerror = function() {
      console.error('drawGibsonAssemblyFigure: Failed to load image:', imagePath, 'Actual src:', img.src);
      // If image fails to load, hide it
      img.style.display = "none";
    };
    img.onload = function() {
      console.log('drawGibsonAssemblyFigure: Image loaded successfully:', imagePath);
    };
  } else {
    console.warn('drawGibsonAssemblyFigure: No image mapping for', insertCount, 'inserts, k=', k);
    img.style.display = "none";
  }
}

function renderResults(results, vector, inserts) {
  const resultsDiv = $('results-wrap');
  const resultsContent = $('results-content');
  
  // Clear previous results
  resultsContent.innerHTML = '';

  // Get parameters for QC
  const naConc = parseFloat($('na-conc').value) || 50;
  const mgConc = parseFloat($('mg-conc').value) || 0;
  const primerConc = parseFloat($('primer-conc').value) || 500;

  // Render primer sets (spans 2 columns)
  const primersCell = document.createElement('div');
  primersCell.id = 'cell-primers';
  primersCell.className = 'box';
  primersCell.innerHTML = '<h3>Primer sets</h3>';
  primersCell.innerHTML += renderPrimerSets(results.primers, naConc, mgConc, primerConc);
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
    <div style="text-align: center;">
      <img id="asm-img" class="asm-figure" src="" style="width:100%;display:none;margin:10px auto;">
      <div class="aside" style="margin-top: 8px; text-align: center;">Diagram is schematic only; lengths are not to scale.</div>
    </div>
  `;
  leftCol.appendChild(asmDiagramCell);
  
  // Load assembly diagram image based on insert count
  drawGibsonAssemblyFigure(inserts.length, asmDiagramCell);

  // Render overlap table (left column, bottom)
  const overlapTableCell = document.createElement('div');
  overlapTableCell.className = 'box oh-table';
  overlapTableCell.innerHTML = `
    <h3>Overlap table</h3>
    ${renderOverlapTable(results, inserts, naConc, mgConc, primerConc)}
    <div id="qc-out" class="aside" style="margin-top: 4px;"></div>
    <div id="warning-out" class="aside" style="margin-top: 4px; color: #b91c1c;"></div>
  `;
  leftCol.appendChild(overlapTableCell);

  // Add the warnings-box here (always shown; falls back to summary text when no warnings)
  const warningsBoxElement = document.createElement('div');
  warningsBoxElement.id = 'warnings-box';
  warningsBoxElement.className = 'warnings-box';
  warningsBoxElement.style.marginTop = '10px';
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
  renderGel(results, vector, inserts);
  
  // Add event listener for ladder change
  const ladderSelect = $('ggx-ladder');
  if (ladderSelect) {
    ladderSelect.addEventListener('change', () => {
      renderGel(results, vector, inserts);
    });
  }

  // Assembly legend removed - diagram is self-explanatory

  // Show warnings/notes (or default summary)
  const warningsBox = $('warnings-box');
  if (warningsBox) {
    warningsBox.innerHTML = '';
    const notes = Array.isArray(results.notes) ? results.notes.filter(Boolean) : [];
    if (notes.length > 0) {
      notes.forEach(note => {
        const p = document.createElement('p');
        p.textContent = note;
        warningsBox.appendChild(p);
      });
    } else {
      const assembledLen = (vector && vector.seq ? vector.seq.length : 0) +
        (Array.isArray(inserts) ? inserts.reduce((sum, ins) => sum + (ins && ins.seq ? ins.seq.length : 0), 0) : 0);
      const p1 = document.createElement('p');
      p1.textContent = 'No warnings generated for this design.';
      const p2 = document.createElement('p');
      p2.textContent = `Assembled sequence length: ${assembledLen} bp total.`;
      warningsBox.appendChild(p1);
      warningsBox.appendChild(p2);
    }
  }

  // Show results
  resultsDiv.style.display = 'block';
  resultsDiv.classList.add('show');
}

function renderPrimerSets(primers, naConc, mgConc, primerConc) {
  let html = '';
  
  primers.forEach((primer, idx) => {
    const insertLabel = primer.insertName ? 
      `Insert #${primer.insertIndex} (${primer.insertName}, len: ${primer.insertLength} bp)` :
      `Insert #${primer.insertIndex} (len: ${primer.insertLength} bp)`;

    const labelF = primer.insertName ? `${primer.insertName}-F` : `Forward`;
    const labelR = primer.insertName ? `${primer.insertName}-R` : `Reverse`;

    // Analyze primers using Core functions
    const fwdAnalysis = analyzePrimer(labelF, primer.forward.full, primer.forward.core, naConc, mgConc, primerConc);
    const revAnalysis = analyzePrimer(labelR, primer.reverse.full, primer.reverse.core, naConc, mgConc, primerConc);
    const crossDimer = qcPair(fwdAnalysis, revAnalysis);

    // Build sequence display
    const fwdSeq = buildSeqCell(primer.forward.core, primer.forward.full, primer.forward.overlap);
    const revSeq = buildSeqCell(primer.reverse.core, primer.reverse.full, primer.reverse.overlap);

    // Format values
    const fmt2 = (x) => isFinite(x) ? x.toFixed(2) : '—';

    html += `
      <h3>${insertLabel}</h3>
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
            <td>${labelF}</td>
            <td class="mono seqcell">${fwdSeq.disp}</td>
            <td style="text-align: center;">${fwdSeq.len}</td>
            <td style="text-align: center;">${fwdSeq.gc.toFixed(1)}%</td>
            <td style="text-align: center;">${fwdAnalysis.tmCore.toFixed(1)} / ${fwdAnalysis.tmFull.toFixed(1)}</td>
            <td style="text-align: center;">${fwdAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
            <td style="text-align: center;">${badge(fwdAnalysis.hairpinClass.cls, fwdAnalysis.hairpinClass.label)}</td>
            <td style="text-align: center;">${badge(fwdAnalysis.selfDimerClass.cls, fwdAnalysis.selfDimerClass.label)}</td>
            <td rowspan="2" style="vertical-align: middle; text-align: center;">
              ${crossDimer && crossDimer.info ? badge(crossDimer.info.cls, crossDimer.info.label) : badge('ok', 'None')}
            </td>
          </tr>
          <tr>
            <td>${labelR}</td>
            <td class="mono seqcell">${revSeq.disp}</td>
            <td style="text-align: center;">${revSeq.len}</td>
            <td style="text-align: center;">${revSeq.gc.toFixed(1)}%</td>
            <td style="text-align: center;">${revAnalysis.tmCore.toFixed(1)} / ${revAnalysis.tmFull.toFixed(1)}</td>
            <td style="text-align: center;">${revAnalysis.homopoly ? badge('warn', 'Yes') : badge('ok', 'No')}</td>
            <td style="text-align: center;">${badge(revAnalysis.hairpinClass.cls, revAnalysis.hairpinClass.label)}</td>
            <td style="text-align: center;">${badge(revAnalysis.selfDimerClass.cls, revAnalysis.selfDimerClass.label)}</td>
          </tr>
        </tbody>
      </table>
    `;
  });

  return html;
}

function buildSeqCell(seqCore, fullSeq, overhangSeq) {
  const len = fullSeq.length;
  const gc = Core.gcPct(fullSeq);

  const oh = overhangSeq || '';
  let disp = '';

  if (!oh) {
    // No overlap, just display the full sequence
    disp = fullSeq;
  } else {
    // Check if overlap is at the start of full sequence
    // For forward primer: full = overlap + core, so full starts with overlap
    // For reverse primer: full = reverseComplement(overlap) + core, so we need to check RC
    const ohRC = Core.reverseComplementSeq(oh);
    
    if (fullSeq.startsWith(oh)) {
      // Forward primer: overlap is at the start
      const corePart = fullSeq.slice(oh.length);
      disp = '<b style="color: #000; font-weight: bold;">' + oh + '</b>' + corePart;
    } else if (fullSeq.startsWith(ohRC)) {
      // Reverse primer: reverse complement of overlap is at the start
      const corePart = fullSeq.slice(ohRC.length);
      disp = '<b style="color: #000; font-weight: bold;">' + ohRC + '</b>' + corePart;
    } else {
      // Overlap not found at start, try to find it anywhere
      const ohIdx = fullSeq.indexOf(oh);
      const ohRCIdx = fullSeq.indexOf(ohRC);
      
      if (ohIdx >= 0) {
        const before = fullSeq.slice(0, ohIdx);
        const after = fullSeq.slice(ohIdx + oh.length);
        disp = before + '<b style="color: #000; font-weight: bold;">' + oh + '</b>' + after;
      } else if (ohRCIdx >= 0) {
        const before = fullSeq.slice(0, ohRCIdx);
        const after = fullSeq.slice(ohRCIdx + ohRC.length);
        disp = before + '<b style="color: #000; font-weight: bold;">' + ohRC + '</b>' + after;
      } else {
        // Overlap not found, just display full sequence
        disp = fullSeq;
      }
    }
  }

  return { disp, len, gc };
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

function renderOverlapTable(results, inserts, naConc, mgConc, primerConc) {
  const targetTm = parseFloat($('target-tm').value) || 55;
  
  const PAL = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#FFEB06'];
  
  let html = '<table><thead><tr><th>Junction</th><th>Overlap (5′→3′)</th><th>Len</th><th>GC%</th><th>Tm (°C)</th></tr></thead><tbody>';

  let colorIdx = 0;

  const rows = [];

  // Prefer recomputed "full overlaps" at each assembly junction (vector↔insert, insert↔insert, insert↔vector).
  // This avoids relying on primer overlap highlighting, which can be ambiguous and sometimes incorrect.
  const insertCount = Array.isArray(inserts) ? inserts.length : 0;
  const leftOverlap = (results && typeof results.leftOverlap === 'string') ? results.leftOverlap : '';
  const rightOverlap = (results && typeof results.rightOverlap === 'string') ? results.rightOverlap : '';
  const junctionOverlaps = (results && Array.isArray(results.junctionOverlaps)) ? results.junctionOverlaps : [];

  const expectedJunctionCount = Math.max(0, insertCount - 1);
  const hasCompleteJunctionOverlaps =
    insertCount > 0 &&
    !!leftOverlap &&
    !!rightOverlap &&
    junctionOverlaps.length === expectedJunctionCount;

  if (hasCompleteJunctionOverlaps) {
    const vectorName = (results && results.vectorName) ? results.vectorName : 'Vector';
    const nameOfInsert = (idx) => {
      const ins = inserts && inserts[idx] ? inserts[idx] : null;
      return (ins && (ins.name || ins.label)) ? (ins.name || ins.label) : `Insert #${idx + 1}`;
    };

    if (leftOverlap) {
      rows.push({ label: `${vectorName} → ${nameOfInsert(0)}`, seq: leftOverlap });
    }

    for (let i = 0; i < junctionOverlaps.length; i++) {
      const seq = (typeof junctionOverlaps[i] === 'string') ? junctionOverlaps[i] : '';
      if (!seq) continue;
      rows.push({ label: `${nameOfInsert(i)} → ${nameOfInsert(i + 1)}`, seq });
    }

    if (rightOverlap) {
      rows.push({ label: `${nameOfInsert(insertCount - 1)} → ${vectorName}`, seq: rightOverlap });
    }
  } else {
    // Fallback (legacy): use overlaps stored on primer sets.
    const primerSets = (results && Array.isArray(results.primers)) ? results.primers : [];
    primerSets.forEach((p, idx) => {
      const ins = inserts && inserts[idx] ? inserts[idx] : null;
      const insertLabel = (p && p.insertName) || (ins && (ins.label || ins.name)) || `Insert #${idx + 1}`;
      const fOverlap = p && p.forward ? (p.forward.overlap || '') : '';
      const rOverlap = p && p.reverse ? (p.reverse.overlap || '') : '';
      if (fOverlap) rows.push({ label: `${insertLabel} (F)`, seq: fOverlap });
      if (rOverlap) rows.push({ label: `${insertLabel} (R)`, seq: rOverlap });
    });
  }

  if (!rows.length) {
    return '<div class="aside">No overlaps available.</div>';
  }

  rows.forEach((row) => {
    const seq = row.seq;
    const len = seq.length;
    const gc = Core.gcPct(seq);
    const tm = Core.tmcalNN(seq, naConc, mgConc, primerConc);
    const color = PAL[colorIdx % PAL.length];
    html += `
      <tr>
        <td title="${row.label}"><span class="oh-chip"><span class="swatch" style="background:${color}"></span></span></td>
        <td class="oh-seq mono">${seq}</td>
        <td>${len}</td>
        <td>${gc.toFixed(1)}%</td>
        <td>${isFinite(tm) ? tm.toFixed(1) : 'NA'}</td>
      </tr>
    `;
    colorIdx++;
  });

  html += '</tbody></table>';
  return html;
}

function updateAssemblyLegend(results, vector, inserts) {
  const legendDiv = $('asm-legend');
  if (!legendDiv) return;

  const ladderSelect = $('ggx-ladder');
  const ladKey = ladderSelect ? (ladderSelect.value || 'neb1kbplus') : 'neb1kbplus';
  const lad = Core.LADDER_PROFILES[ladKey] || Core.LADDER_PROFILES.neb1kbplus;

  const vecName = results.vectorName || 'vector';
  const assembledName = vecName ? `${vecName}_Gibson` : 'Gibson_Assembly';
  const linkers = results.linkers || [];
  
  const mode = document.querySelector('input[name="linearization-mode"]:checked')?.value;
  let linearizedLabel = '';
  
  if (mode === 'enzyme') {
    const enzyme1Name = $('enzyme1').value.trim();
    const enzyme2Name = $('enzyme2').value.trim();
    if (enzyme1Name && enzyme2Name) {
      linearizedLabel = `Double-digest (${enzyme1Name} + ${enzyme2Name})`;
    } else if (enzyme1Name) {
      linearizedLabel = `Single-digest (${enzyme1Name})`;
    } else if (enzyme2Name) {
      linearizedLabel = `Single-digest (${enzyme2Name})`;
    } else {
      linearizedLabel = 'Linearized';
    }
  } else if (mode === 'pcr') {
    linearizedLabel = 'PCR linearized';
  } else {
    linearizedLabel = 'Linearized';
  }
  
  // Get linearized fragments for legend
  let linearizedFragments = [];
  if (window.currentFragments && window.currentFragments.length > 0) {
    linearizedFragments = window.currentFragments;
  } else {
    linearizedFragments = [{ length: vector.seq.length }];
  }
  
  let legend = '';
  legend += `<div>L1 DNA Ladder (${lad.name})</div>`;
  legend += `<div><strong>L2</strong> Uncut vector (${vecName}, SC): ${vector.seq.length} bp</div>`;
  
  // L3: Linearized vector (may have multiple bands)
  if (linearizedFragments.length === 1) {
    legend += `<div><strong>L3</strong> ${linearizedLabel} vector: ${linearizedFragments[0].length} bp</div>`;
  } else {
    legend += `<div><strong>L3</strong> ${linearizedLabel} vector (${linearizedFragments.length} fragments):</div>`;
    linearizedFragments.forEach((frag, idx) => {
      legend += `<div style="margin-left: 20px;">Fragment ${idx + 1}: ${frag.length} bp</div>`;
    });
  }
  
  // L4-L(3+insertCount): PCR of inserts
  inserts.forEach((ins, idx) => {
    const laneNum = idx + 4;
    legend += `<div><strong>L${laneNum}</strong> PCR of insert #${idx + 1} (${ins.name}): ${ins.seq.length} bp</div>`;
    if (idx < linkers.length && linkers[idx]) {
      legend += `<div style="margin-left: 20px; color: #92400e;">Linker: ${linkers[idx].length} bp</div>`;
    }
  });
  
  // L(4+insertCount): Assembled plasmid
  const assembledLaneNum = 4 + inserts.length;
  legend += `<div><strong>L${assembledLaneNum}</strong> Assembled plasmid (${assembledName}): ${results.assembledSeq.length} bp`;
  if (linkers.some(l => l)) {
    const linkerCount = linkers.filter(l => l).length;
    legend += ` | ${linkerCount} linker(s) included`;
  }
  legend += `</div>`;
  
  legendDiv.innerHTML = legend;
}

function renderGel(results, vector, inserts) {
  const canvas = $('gg-gel-canvas');
  const ladderSelect = $('ggx-ladder');
  if (!canvas || !ladderSelect) return;
  
  const ladKey = ladderSelect.value || 'neb1kbplus';
  const lad = Core.LADDER_PROFILES[ladKey] || Core.LADDER_PROFILES.neb1kbplus;
  
  // Build lanes array
  const lanes = [];
  lanes.push([]); // L1: Ladder placeholder
  
  // L2: Uncut vector (supercoiled - SC)
  // Pass actual size, ggxDrawGel will apply scEffective automatically based on scIdx
  lanes.push([vector.seq.length]); // L2: Uncut vector (SC)
  
  // L3: Linearized vector (enzyme or PCR)
  const mode = document.querySelector('input[name="linearization-mode"]:checked')?.value;
  let linearizedFragments = [];
  
  if (mode === 'enzyme') {
    // Enzyme linearization: use fragments from updateFragmentsInfo
    if (window.currentFragments && window.currentFragments.length > 0) {
      linearizedFragments = window.currentFragments.map(f => f.length);
    } else {
      // Fallback: calculate fragments
      const enzyme1Name = $('enzyme1').value.trim();
      const enzyme2Name = $('enzyme2').value.trim();
      const enzymeNames = [];
      if (enzyme1Name) enzymeNames.push(enzyme1Name);
      if (enzyme2Name && enzyme2Name !== enzyme1Name) enzymeNames.push(enzyme2Name);
      
      if (enzymeNames.length > 0) {
        const fragments = Core.digestCircularTypeII(vector.seq, enzymeNames);
        linearizedFragments = fragments.map(f => f.length);
      } else {
        linearizedFragments = [vector.seq.length]; // Fallback to full length
      }
    }
  } else if (mode === 'pcr') {
    // PCR linearization: single fragment
    if (window.currentFragments && window.currentFragments.length > 0) {
      linearizedFragments = window.currentFragments.map(f => f.length);
    } else {
      linearizedFragments = [vector.seq.length]; // Fallback to full length
    }
  } else {
    // Fallback
    linearizedFragments = [vector.seq.length];
  }
  
  lanes.push(linearizedFragments); // L3: Linearized vector (may have multiple bands)
  
  // L4-L(3+insertCount): PCR of inserts
  inserts.forEach((ins) => {
    lanes.push([ins.seq.length]);
  });
  
  // L(4+insertCount): Assembled plasmid (only one, the final product)
  lanes.push([results.assembledSeq.length]);
  
  const vecName = results.vectorName || 'vector';
  const assembledName = vecName ? `${vecName}_Gibson` : 'Gibson_Assembly';
  
  // Determine linearization method for legend (mode already declared above)
  let linearizationLabel = '';
  
  if (mode === 'enzyme') {
    const enzyme1Name = $('enzyme1').value.trim();
    const enzyme2Name = $('enzyme2').value.trim();
    if (enzyme1Name && enzyme2Name) {
      linearizationLabel = `Double-digest (${enzyme1Name} + ${enzyme2Name})`;
    } else if (enzyme1Name) {
      linearizationLabel = `Single-digest (${enzyme1Name})`;
    } else if (enzyme2Name) {
      linearizationLabel = `Single-digest (${enzyme2Name})`;
    } else {
      linearizationLabel = 'Enzyme digest';
    }
  } else if (mode === 'pcr') {
    linearizationLabel = 'PCR linearized';
  } else {
    linearizationLabel = 'Linearized';
  }
  
  // Update gel state
  // scIdx: lanes that are supercoiled (L2 = index 1, assembled plasmid = last lane)
  const scIndices = new Set([1, lanes.length - 1]); // L2 (uncut) and assembled plasmid are supercoiled
  
  VIZ.updateGelState({
    lanes: lanes,
    insertCount: inserts.length,
    insertNames: inserts.map(ins => ins.name),
    vectorName: vecName,
    enzymeName: linearizationLabel, // Pass the linearization method label
    assembledName: assembledName,
    assembledLaneIndex: lanes.length - 1,
    profile: ladKey,
    scIdx: scIndices
  });
  
  // Draw gel
  // Highlight: L2 (uncut), L3 (linearized), and assembled plasmid
  const highlightIndices = new Set([1, 2, lanes.length - 1]); // L2, L3, and assembled plasmid
  VIZ.drawGel('gg-gel-canvas', lanes, lad.sizesKb.map(k => k * 1000), lad.boldKb.map(k => k * 1000), lad.name, { 
    highlightIndices,
    scIdx: scIndices  // Pass scIdx explicitly to ensure it's not overridden
  });
}

/**
 * Show warning modal instead of browser alert
 * @param {string} message - Warning message to display
 */
function showWarning(message) {
  const host = document.getElementById('module-content') || document.body;
  if (VIZ && typeof VIZ.showMWModal === 'function') {
    VIZ.showMWModal(host, message || '', () => {}, () => {});
    return;
  }

  const warningsBox = $('warnings-box');
  if (warningsBox) {
    warningsBox.innerHTML = '';
    warningsBox.style.display = 'block';
    const p = document.createElement('p');
    p.textContent = message;
    warningsBox.appendChild(p);
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

// Download button
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
  if (!window.currentPrimers || !Array.isArray(window.currentPrimers) || window.currentPrimers.length === 0) {
    showWarning('No primers available. Please design primers first.');
    return;
  }
  
  let fasta = '';
  
  window.currentPrimers.forEach((primer) => {
    const insertName = primer.insertName || `Insert${primer.insertIndex}`;
    const labelF = `${insertName}-F`;
    const labelR = `${insertName}-R`;
    
    // Forward primer
    const fwdSeq = primer.forward.full || '';
    if (fwdSeq) {
      fasta += `>${labelF}\n`;
      // Format sequence (80 chars per line)
      const formattedSeq = fwdSeq.replace(/(.{80})/g, '$1\n') + (fwdSeq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
    
    // Reverse primer
    const revSeq = primer.reverse.full || '';
    if (revSeq) {
      fasta += `>${labelR}\n`;
      // Format sequence (80 chars per line)
      const formattedSeq = revSeq.replace(/(.{80})/g, '$1\n') + (revSeq.length % 80 !== 0 ? '\n' : '');
      fasta += formattedSeq;
    }
  });
  
  const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const name = window.currentAssembledName || 'Gibson_primers';
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
  const name = window.currentAssembledName || 'Gibson_assembled';
  
  // Format FASTA (80 chars per line)
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

// Reset button - reloads the page (aligned with Golden Gate)
function initResetButton() {
  const resetBtn = $('global-reset');
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  const clearBtn = $('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Clear results content
      const resultsContent = $('results-content');
      if (resultsContent) {
        resultsContent.innerHTML = '';
      }
      // Hide results wrap
      const resultsDiv = $('results-wrap');
      if (resultsDiv) {
        resultsDiv.style.display = 'none';
        resultsDiv.classList.remove('show');
      }
    });
  }
}

// Initialize enzyme list
function initEnzymeList() {
  const datalist = $('enzyme-list');
  if (!datalist) return;
  
  // Clear any existing options
  datalist.innerHTML = '';
  
  // Get all Type II enzymes from ENZYME_DB
  const enzymes = [];
  for (const [name, enz] of Object.entries(Core.ENZYME_DB)) {
    if (enz.class === 'typeII' && enz.site) {
      enzymes.push({ name, site: enz.site });
    }
  }
  
  // Sort by name for better UX
  enzymes.sort((a, b) => a.name.localeCompare(b.name));
  
  // Create options
  enzymes.forEach(({ name, site }) => {
    const option = document.createElement('option');
    option.value = name;
    option.setAttribute('label', `${name} (${site})`);
    datalist.appendChild(option);
  });
}

// Demo Set button - fills vector and Insert #1, sets enzymes or primers based on mode
function initDemoSetButton() {
  const demoSetBtn = $('demo-set-btn');
  if (demoSetBtn) {
    console.log('Demo Set button found, binding event listener');
    demoSetBtn.addEventListener('click', async () => {
      console.log('Demo Set button clicked');
      try {
        const base = new URL('modules/contents/demo/', window.location.href).toString();
        
        // Load vector (pESC-His.txt)
        const vectorTextarea = $('vector-seq');
        if (vectorTextarea) {
          console.log('Loading vector from:', base + 'pESC-His.txt');
          const vectorResp = await fetch(base + 'pESC-His.txt');
          if (vectorResp.ok) {
            const vectorText = await vectorResp.text();
            vectorTextarea.value = vectorText;
            updateVectorPreview();
            updateFragmentsInfo();
            console.log('Vector loaded successfully');
          } else {
            console.error('Vector load failed:', vectorResp.status);
          }
        } else {
          console.error('Vector textarea not found');
        }
        
        // Load Insert #1 (Insert_1.txt)
        const firstRow = document.querySelector('.insert-row[data-index="0"]');
        if (firstRow) {
          const insertTextarea = firstRow.querySelector('.insert-seq');
          if (insertTextarea) {
            console.log('Loading insert from:', base + 'Insert_1.txt');
            const insertResp = await fetch(base + 'Insert_1.txt');
            if (insertResp.ok) {
              const insertText = await insertResp.text();
              insertTextarea.value = insertText;
              console.log('Insert loaded successfully');
            } else {
              console.error('Insert load failed:', insertResp.status);
            }
          } else {
            console.error('Insert textarea not found');
          }
        } else {
          console.error('First insert row not found');
        }
        
        // Check linearization mode
        const modeRadio = document.querySelector('input[name="linearization-mode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'enzyme';
        console.log('Current mode:', mode);
        
        if (mode === 'enzyme') {
          // Restriction enzyme mode: set BamHI and SalI
          const enzyme1Input = $('enzyme1');
          const enzyme2Input = $('enzyme2');
          if (enzyme1Input) {
            enzyme1Input.value = 'BamHI';
            enzyme1Input.dispatchEvent(new Event('input', { bubbles: true }));
            enzyme1Input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (enzyme2Input) {
            enzyme2Input.value = 'SalI';
            enzyme2Input.dispatchEvent(new Event('input', { bubbles: true }));
            enzyme2Input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          // Refresh fragments/backbone dropdown
          updateFragmentsInfo();
          console.log('Enzymes set: BamHI, SalI');
        } else if (mode === 'pcr') {
          // PCR mode: set forward and reverse primers
          const pcrForwardInput = $('pcr-forward');
          const pcrReverseInput = $('pcr-reverse');
          if (pcrForwardInput) {
            pcrForwardInput.value = 'GGATCCGGGGTTTTTTCTCCTTGAC';
            pcrForwardInput.dispatchEvent(new Event('input', { bubbles: true }));
            pcrForwardInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (pcrReverseInput) {
            pcrReverseInput.value = 'GTCGACATGGAACAGAAGTTGATTTC';
            pcrReverseInput.dispatchEvent(new Event('input', { bubbles: true }));
            pcrReverseInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          updateFragmentsInfo();
          updateVectorPreview();
          console.log('PCR primers set');
        }
      } catch (e) {
        console.error('Demo Set load error:', e);
        alert('Failed to load demo sequences: ' + e.message);
      }
    });
  } else {
    console.error('Demo Set button not found!');
  }
}

// Initialize function - can be called after HTML is injected
function initGibsonModule() {
  // Add inline help tooltips (page-level)
  attachHelpToTextarea('vector-seq', "Paste your vector/plasmid DNA sequence in FASTA format (header optional). Line breaks and spaces are ignored.", 'Help: Vector sequence');
  ensureHelpIcon(document.querySelector('#right-panel > label'), "Add insert fragments in order (FASTA supported). For multi-insert designs, each insert can optionally include a linker sequence.", 'Help: Assembly plan');
  attachHelpToInput('target-tm', "Target melting temperature for primer design. Primers are optimized to be close to this value.", 'Help: Target Tm');
  attachHelpToInput('delta-tm', "Maximum allowed deviation from the target Tm. Larger values allow more flexibility but may yield less uniform primer pairs.", 'Help: ΔTm');
  attachHelpToInput('primer-conc', "Effective primer concentration assumed for in silico Tm calculation. Typical range: 25-1000 nM.", 'Help: Primer concentration');
  attachHelpToInput('na-conc', "Monovalent cation concentration used for salt-corrected Tm calculation. Typical range: 10-200 mM.", 'Help: Na+ concentration');
  attachHelpToInput('mg-conc', "Divalent cation concentration used for Tm calculation. Set to 0 if Mg²⁺ is absent from reaction. Typical range: 0.5-5 mM.", 'Help: Mg2+ concentration');
  attachHelpToInput('overlap-len', "Desired overlap length at each junction (bp). Typical Gibson overlaps are ~20–40 bp.", 'Help: Overlap length');

  // Initialize host organism select (with retry if CODON_USAGE not ready)
  function tryPopulateHostSelect() {
    if (CODON_USAGE && typeof CODON_USAGE === 'object' && Object.keys(CODON_USAGE).length > 0) {
      populateHostSelect();
    } else {
      // Retry after a short delay if CODON_USAGE not ready
      setTimeout(tryPopulateHostSelect, 100);
    }
  }
  tryPopulateHostSelect();
  
  initEnzymeList();
  initVectorUpload();
  initAddInsert();
  initLinearizationMode();
  initDesignButton();
  initDownloadButton();
  initResetButton();
  initDemoSetButton();
  updateInsertControls();
  updateAddInsertButton();
  updateVectorPreview();
  updateFragmentsInfo();
  
  // Auto-height sync for vector textarea (exactly like Golden Gate)
  function syncVectorHeight() {
    const leftTA = $('vector-seq');
    const insertsContainer = $('inserts-container');
    if (!leftTA || !insertsContainer) return;
    const rect = insertsContainer.getBoundingClientRect();
    const target = Math.max(140, Math.min(1200, rect.height || insertsContainer.scrollHeight || 140));
    leftTA.style.height = target + 'px';
  }
  
  function scheduleSync() {
    window.requestAnimationFrame(syncVectorHeight);
  }
  
  // Export scheduleSync for use in other functions
  window.__gibsonScheduleSync = scheduleSync;
  
  // Event listeners - aligned with Golden Gate (with null guards)
  const insertsContainer = $('inserts-container');
  
  // Listen for window resize and page load
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('load', scheduleSync);
  
  if (insertsContainer) {
    // Listen for input events on inserts container
    insertsContainer.addEventListener('input', scheduleSync);
  
    // MutationObserver for DOM changes (add/remove inserts)
    try {
      const mo = new MutationObserver(scheduleSync);
      mo.observe(insertsContainer, { childList: true, subtree: true });
    } catch (e) {
      // Fallback
    }
  }
  
  // Initial sync with retries to catch late layout
  syncVectorHeight();
  setTimeout(scheduleSync, 50);
  setTimeout(scheduleSync, 200);
  setTimeout(scheduleSync, 500);
}

// Export for app-main.js
window.initGibsonModule = initGibsonModule;

// Auto-initialize if DOMContentLoaded already fired (for standalone mode)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.__gibsonInitialized) {
      initGibsonModule();
      window.__gibsonInitialized = true;
    }
  });
} else {
  // DOM already loaded, but only auto-init if not called by app-main.js
  if (!window.__gibsonInitialized && !document.getElementById('module-content')) {
    initGibsonModule();
    window.__gibsonInitialized = true;
  }
}
