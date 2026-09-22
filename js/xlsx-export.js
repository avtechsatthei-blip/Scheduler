/* iHotel AV Scheduler — Excel/CSV export and import for the inventory and monthly audits.
 * ExcelJS is loaded from a CDN only when you use one of these (in Node tests set globalThis.ExcelJS). */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const X = (IH.Xlsx = {});

  const URL_EXCELJS = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  const NAVY = 'FF10294B', ORANGE = 'FFF15A32', CREAM = 'FFF9F7F4', INPUT = 'FFFFF6D6', LINE = 'FFD9D3C7', MUTED = 'FF6B7485';
  const CONDITIONS = ['Good', 'Fair', 'Needs repair', 'Retired'];

  X.load = async () => {
    if (!root.ExcelJS) await IH.Imp.loadScript(URL_EXCELJS);
    return root.ExcelJS;
  };

  /* ---------------- shared styling ---------------- */
  const thin = { style: 'thin', color: { argb: LINE } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const font = (o) => Object.assign({ name: 'Calibri', size: 11 }, o || {});
  function titleBlock(ws, text, sub, lastCol) {
    ws.mergeCells(1, 1, 1, lastCol);
    const t = ws.getCell(1, 1);
    t.value = text;
    t.font = font({ size: 18, bold: true, color: { argb: 'FFFFFFFF' } });
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    t.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, lastCol);
    const s = ws.getCell(2, 1);
    s.value = sub;
    s.font = font({ size: 10, italic: true, color: { argb: MUTED } });
    s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    ws.getRow(2).height = 4;
  }
  function headerRow(ws, rowNum, labels) {
    const r = ws.getRow(rowNum);
    labels.forEach((l, i) => {
      const c = r.getCell(i + 1);
      c.value = l;
      c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } });
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      c.alignment = { vertical: 'middle', horizontal: i >= 6 ? 'center' : 'left', wrapText: true };
      c.border = box;
    });
    r.height = 30;
  }
  const fmtDate = (iso) => (iso ? U.fmtLong(iso) : '');

  /* ---------------- audit workbook ---------------- */
  // opts: { prefill: bool (include counts already entered), results: bool (add Summary + Discrepancies sheets) }
  X.auditWorkbook = async (state, audit, opts) => {
    opts = opts || {};
    const E = await X.load();
    const wb = new E.Workbook();
    wb.creator = 'iHotel AV Scheduler';
    wb.created = new Date();
    const A = IH.Audit;
    const sm = A.summary(audit);
    const label = A.monthLabel(audit.month);

    if (opts.results) summarySheet(wb, state, audit, sm, label);

    const ws = wb.addWorksheet('Audit Sheet', {
      views: [{ state: 'frozen', ySplit: 6, xSplit: 0 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '6:6', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 } },
      headerFooter: { oddFooter: `&L${label} equipment audit&CPage &P of &N&RAuditor: ______________` },
    });
    const cols = [
      ['ID', 0], ['Location', 20], ['Category', 17], ['Item', 30], ['Make / model', 22], ['Asset tag / serial', 20],
      ['Expected', 10], ['Counted', 10], ['Variance', 10], ['Out of service', 11], ['Condition', 15], ['Notes', 34],
    ];
    ws.columns = cols.map(([, w]) => ({ width: w || 2 }));
    ws.getColumn(1).hidden = true;
    titleBlock(ws, 'Hotel Illinois Conference Center · AV equipment audit', '', cols.length);

    // who / when
    ws.getCell('B3').value = 'Month'; ws.getCell('C3').value = label;
    ws.getCell('D3').value = 'Auditor'; ws.getCell('E3').value = audit.auditor || '';
    ws.getCell('F3').value = 'Date'; ws.getCell('G3').value = audit.date || '';
    ws.mergeCells('G3:H3');
    ['B3', 'D3', 'F3'].forEach((a) => { ws.getCell(a).font = font({ bold: true, color: { argb: NAVY } }); });
    ['E3', 'G3'].forEach((a) => { const c = ws.getCell(a); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }; c.border = box; c.protection = { locked: false }; });
    ws.mergeCells('B4:L4');
    ws.getCell('B4').value = 'Fill the yellow cells. Counted is how many you physically found. Variance and totals fill in by themselves. Put the number of units that are broken or away in Out of service. Anything found that is not listed goes on the "Extra items found" tab.';
    ws.getCell('B4').font = font({ size: 10, italic: true, color: { argb: MUTED } });
    ws.getCell('B4').alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(4).height = 30;
    headerRow(ws, 6, cols.map((c) => c[0]));

    const first = 7;
    audit.lines.forEach((l, i) => {
      const r = first + i;
      const row = ws.getRow(r);
      const tagSerial = [l.assetTag, l.serial].filter(Boolean).join(' / ');
      row.getCell(1).value = l.id;
      row.getCell(2).value = l.location;
      row.getCell(3).value = l.category;
      row.getCell(4).value = l.name;
      row.getCell(5).value = l.model;
      row.getCell(6).value = tagSerial;
      row.getCell(7).value = +l.expected || 0;
      const counted = opts.prefill && l.counted != null && l.counted !== '' ? +l.counted : null;
      row.getCell(8).value = counted;
      row.getCell(9).value = { formula: `IF(H${r}="","",H${r}-G${r})`, result: counted == null ? '' : counted - l.expected };
      row.getCell(10).value = opts.prefill ? +l.out || 0 : null;
      row.getCell(11).value = l.condition || 'Good';
      row.getCell(12).value = opts.prefill ? l.notes || '' : '';
      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.font = font(c === 4 ? { bold: true } : {});
        cell.border = box;
        cell.alignment = { vertical: 'middle', horizontal: c >= 7 && c <= 10 ? 'center' : 'left', wrapText: c === 12 };
        if ([8, 10, 11, 12].includes(c)) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }; cell.protection = { locked: false }; }
        else if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFAF7' } };
      }
      row.getCell(8).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Counted', error: 'Enter a whole number, 0 or more.' };
      row.getCell(10).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Out of service', error: 'Enter a whole number, 0 or more.' };
      row.getCell(11).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${CONDITIONS.join(',')}"`] };
      row.height = 20;
    });
    const last = first + audit.lines.length - 1;
    const tot = last + 1;
    const tr = ws.getRow(tot);
    tr.getCell(6).value = 'Totals';
    tr.getCell(7).value = { formula: `SUM(G${first}:G${last})`, result: sm.expectedUnits };
    tr.getCell(8).value = { formula: `SUM(H${first}:H${last})`, result: sm.countedUnits };
    tr.getCell(9).value = { formula: `SUM(I${first}:I${last})`, result: sm.countedUnits - sm.countedExpected };
    tr.getCell(10).value = { formula: `SUM(J${first}:J${last})`, result: 0 };
    for (let c = 6; c <= 10; c++) {
      const cell = tr.getCell(c);
      cell.font = font({ bold: true, color: { argb: NAVY } });
      cell.border = { top: { style: 'medium', color: { argb: NAVY } } };
      cell.alignment = { horizontal: c === 6 ? 'right' : 'center' };
    }
    if (audit.lines.length) {
      ws.addConditionalFormatting({
        ref: `I${first}:I${last}`,
        rules: [{ type: 'expression', formulae: [`AND(I${first}<>"",I${first}<>0)`], style: { font: { bold: true, color: { argb: 'FF9B2C1F' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE4DF' } } } }],
      });
      ws.autoFilter = { from: { row: 6, column: 2 }, to: { row: last, column: 12 } };
    }
    // Lock everything except the yellow cells, so the sheet works as a form. No password: Review > Unprotect Sheet.
    await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, autoFilter: true, sort: false });

    // extras
    const ex = wb.addWorksheet('Extra items found', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ex.columns = [{ width: 34 }, { width: 10 }, { width: 22 }, { width: 18 }, { width: 44 }];
    titleBlock(ex, 'Equipment found that is not on the list', '', 5);
    const eh = ex.getRow(4);
    ['Item', 'Qty', 'Location', 'Category', 'Notes'].forEach((l, i) => {
      const c = eh.getCell(i + 1);
      c.value = l; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.border = box;
    });
    const extras = (audit.extras || []).filter((x) => String(x.name || '').trim());
    const n = Math.max(15, extras.length + 5);
    for (let i = 0; i < n; i++) {
      const row = ex.getRow(5 + i);
      const x = extras[i];
      if (x) { row.getCell(1).value = x.name; row.getCell(2).value = +x.qty || 1; row.getCell(3).value = x.location || ''; row.getCell(4).value = x.category || ''; row.getCell(5).value = x.notes || ''; }
      for (let c = 1; c <= 5; c++) { const cell = row.getCell(c); cell.border = box; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }; cell.font = font(); }
      row.height = 20;
    }
    ex.views = [{ state: 'frozen', ySplit: 4 }];

    if (opts.results) discrepancySheet(wb, sm);
    return wb;
  };

  function summarySheet(wb, state, audit, sm, label) {
    const ws = wb.addWorksheet('Summary', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 42 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }];
    titleBlock(ws, `Equipment audit · ${label}`, '', 5);
    const kv = [
      ['Auditor', audit.auditor || ''], ['Audit date', fmtDate(audit.date)], ['Status', audit.status === 'done' ? 'Completed' : 'In progress'],
      ['Items on the list', sm.items], ['Items counted', sm.counted], ['Items not counted', sm.uncounted],
      ['Units expected (counted items)', sm.countedExpected], ['Units found', sm.countedUnits], ['Units missing', sm.missingUnits], ['Extra units', sm.extraUnits],
      ['Items with a discrepancy', sm.discrepancies.length], ['Items out of service or needing repair', sm.needsAttention.length], ['Extra items found (not on the list)', sm.extras.length],
    ];
    let r = 4;
    kv.forEach(([k, v]) => {
      ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = font({ bold: true, color: { argb: NAVY } });
      ws.getCell(r, 2).value = v; ws.getCell(r, 2).alignment = { horizontal: 'left' };
      r++;
    });
    r += 1;
    const h = ws.getRow(r);
    ['Category', 'Items', 'Expected', 'Counted', 'Difference'].forEach((l, i) => {
      const c = h.getCell(i + 1); c.value = l; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.border = box;
      c.alignment = { horizontal: i ? 'center' : 'left' };
    });
    Object.keys(sm.byCategory).sort().forEach((cat) => {
      r++;
      const c = sm.byCategory[cat];
      const cnt = audit.lines.filter((l) => (l.category || 'Uncategorized') === cat && l.counted != null && l.counted !== '').reduce((t, l) => t + (+l.expected || 0), 0);
      const row = ws.getRow(r);
      [cat, c.items, c.expected, c.counted, c.counted - cnt].forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v; cell.border = box; cell.font = font(); cell.alignment = { horizontal: i ? 'center' : 'left' }; });
    });
    if (audit.notes) { r += 2; ws.getCell(r, 1).value = 'Notes'; ws.getCell(r, 1).font = font({ bold: true, color: { argb: NAVY } }); ws.mergeCells(r, 2, r, 5); ws.getCell(r, 2).value = audit.notes; ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' }; ws.getRow(r).height = 48; }
  }

  function discrepancySheet(wb, sm) {
    const ws = wb.addWorksheet('Discrepancies', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 20 }, { width: 30 }, { width: 22 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 40 }];
    titleBlock(ws, 'Discrepancies and items needing attention', '', 8);
    const h = ws.getRow(4);
    ['Location', 'Item', 'Asset tag / serial', 'Expected', 'Counted', 'Difference', 'Condition', 'Notes'].forEach((l, i) => {
      const c = h.getCell(i + 1); c.value = l; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.border = box;
    });
    const rows = sm.discrepancies.map((d) => d.line).concat(sm.needsAttention.filter((l) => !sm.discrepancies.some((d) => d.line.id === l.id)));
    rows.forEach((l, i) => {
      const row = ws.getRow(5 + i);
      const diff = l.counted == null || l.counted === '' ? '' : +l.counted - +l.expected;
      [l.location, l.name, [l.assetTag, l.serial].filter(Boolean).join(' / '), l.expected, l.counted, diff, l.condition + (+l.out ? ` · ${l.out} out` : ''), l.notes].forEach((v, c) => {
        const cell = row.getCell(c + 1); cell.value = v; cell.border = box; cell.font = font(c === 1 ? { bold: true } : {}); cell.alignment = { horizontal: c >= 3 && c <= 5 ? 'center' : 'left', wrapText: c === 7 };
      });
      if (diff !== '' && diff !== 0) row.getCell(6).font = font({ bold: true, color: { argb: 'FF9B2C1F' } });
    });
    if (!rows.length) { ws.mergeCells(5, 1, 5, 8); ws.getCell(5, 1).value = 'Nothing to report. Every counted item matched.'; ws.getCell(5, 1).font = font({ italic: true, color: { argb: MUTED } }); }
  }

  /* ---------------- full inventory export ---------------- */
  X.inventoryWorkbook = async (state) => {
    const E = await X.load();
    const wb = new E.Workbook();
    wb.creator = 'iHotel AV Scheduler';
    const ws = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4' }, headerFooter: { oddFooter: '&LAV equipment inventory&CPage &P of &N&R&D' } });
    const heads = ['Category', 'Item', 'Make / model', 'Asset tag', 'Serial', 'Location', 'Own', 'Out of service', 'Available', 'Condition', 'Purchased', 'Value each', 'Total value', 'Rentable', 'Rent $/day', 'Last audit', 'Notes'];
    ws.columns = [16, 28, 22, 14, 16, 18, 8, 10, 10, 13, 12, 11, 12, 10, 10, 13, 36].map((width) => ({ width }));
    titleBlock(ws, 'Hotel Illinois Conference Center · AV equipment inventory', '', heads.length);
    headerRow(ws, 4, heads);
    const items = state.inventory.slice().sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));
    items.forEach((i, k) => {
      const r = 5 + k;
      const row = ws.getRow(r);
      const vals = [i.category, i.name, i.model, i.assetTag, i.serial, i.location, +i.qty || 0, +i.out || 0, { formula: `MAX(0,G${r}-H${r})`, result: Math.max(0, (+i.qty || 0) - (+i.out || 0)) }, i.condition, i.purchased, i.value === '' ? null : +i.value, { formula: `IF(L${r}="","",L${r}*G${r})`, result: i.value === '' ? '' : (+i.value || 0) * (+i.qty || 0) }, i.rentable ? 'Yes' : 'No', i.rentable ? +i.rentCost || 0 : null, i.lastAudit, i.notes];
      vals.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v; cell.border = box; cell.font = font(c === 1 ? { bold: true } : {});
        cell.alignment = { vertical: 'middle', horizontal: c >= 6 && c <= 8 ? 'center' : 'left', wrapText: c === 16 };
        if (c === 11 || c === 12 || c === 14) cell.numFmt = '$#,##0.00';
        if (k % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBFAF7' } };
      });
      if ((+i.out || 0) > 0) row.getCell(8).font = font({ bold: true, color: { argb: 'FF9B2C1F' } });
    });
    const end = 4 + items.length;
    const t = ws.getRow(end + 1);
    t.getCell(6).value = 'Totals';
    t.getCell(7).value = { formula: `SUM(G5:G${end})`, result: items.reduce((s, i) => s + (+i.qty || 0), 0) };
    t.getCell(8).value = { formula: `SUM(H5:H${end})`, result: items.reduce((s, i) => s + (+i.out || 0), 0) };
    t.getCell(9).value = { formula: `SUM(I5:I${end})`, result: items.reduce((s, i) => s + Math.max(0, (+i.qty || 0) - (+i.out || 0)), 0) };
    t.getCell(13).value = { formula: `SUM(M5:M${end})`, result: items.reduce((s, i) => s + (i.value === '' ? 0 : (+i.value || 0) * (+i.qty || 0)), 0) };
    t.getCell(13).numFmt = '$#,##0.00';
    for (let c = 6; c <= 13; c++) { t.getCell(c).font = font({ bold: true, color: { argb: NAVY } }); t.getCell(c).border = { top: { style: 'medium', color: { argb: NAVY } } }; t.getCell(c).alignment = { horizontal: c === 6 ? 'right' : 'center' }; }
    if (items.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: end, column: heads.length } };
    return wb;
  };

  // Blank template to fill in and import
  X.templateWorkbook = async () => {
    const E = await X.load();
    const wb = new E.Workbook();
    const ws = wb.addWorksheet('Inventory to import', { views: [{ state: 'frozen', ySplit: 1 }] });
    const heads = ['Item', 'Category', 'Qty', 'Location', 'Make / model', 'Asset tag', 'Serial', 'Condition', 'Value each', 'Rentable', 'Rent $/day', 'Notes'];
    ws.columns = [28, 16, 8, 18, 22, 14, 16, 13, 11, 10, 10, 34].map((width) => ({ width }));
    headerRow(ws, 1, heads);
    [['Projector', 'Video', 6, 'AV closet', 'Epson 2250U', '', '', 'Good', 1500, 'Yes', 150, ''], ['Wireless Mic', 'Audio', 8, 'AV closet', 'Shure QLXD', '', '', 'Good', 700, 'Yes', 35, 'Handheld']].forEach((vals, i) => {
      vals.forEach((v, c) => { const cell = ws.getRow(2 + i).getCell(c + 1); cell.value = v; cell.font = font({ color: { argb: MUTED }, italic: true }); cell.border = box; });
    });
    return wb;
  };

  X.save = async (wb, filename) => {
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    U.download(blob, filename);
  };

  /* ---------------- reading files ---------------- */
  // Tiny CSV parser (quotes, commas, tabs, CRLF)
  X.parseCSV = (text) => {
    const t = String(text || '').replace(/^\uFEFF/, '');
    const delim = (t.split('\n')[0].match(/\t/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
  };

  const HEAD_MAP = [
    ['name', /^(item|name|equipment|description|item name)$/i],
    ['category', /^(category|type|group)$/i],
    ['model', /^(make\s*\/?\s*model|model|make|manufacturer)$/i],
    ['assetTag', /^(asset\s*(tag|#|number|no\.?)?|tag|inventory\s*(#|tag))$/i],
    ['serial', /^(serial(\s*(#|number|no\.?))?|s\/n)$/i],
    ['location', /^(location|storage|stored\s*(in|at)|room)$/i],
    ['qty', /^(qty|quantity|own|owned|count|total|on hand)$/i],
    ['out', /^(out(\s*of\s*service)?|broken|unavailable)$/i],
    ['condition', /^(condition|status)$/i],
    ['purchased', /^(purchased|purchase\s*date|date\s*purchased|acquired)$/i],
    ['value', /^(value(\s*each)?|cost|price|unit\s*cost|unit\s*price)$/i],
    ['rentable', /^(rentable|rent\s*able|can\s*rent)$/i],
    ['rentCost', /^(rent(\s*\$?\s*\/?\s*day)?|rent\s*cost|rental(\s*cost)?)$/i],
    ['notes', /^(notes?|comments?|remarks?)$/i],
  ];
  const yes = (v) => /^(y|yes|true|1|x)$/i.test(String(v == null ? '' : v).trim());
  const numOrBlank = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[$,]/g, '')); return isNaN(n) ? '' : n; };

  // rows: array of arrays, first non-empty row = headers. Returns { items, unknown: [headers we ignored], error }
  X.itemsFromRows = (rows) => {
    rows = rows.filter((r) => r && r.some((c) => String(c == null ? '' : c).trim() !== ''));
    if (!rows.length) return { items: [], unknown: [], error: 'The file is empty.' };
    let hi = rows.findIndex((r) => r.some((c) => HEAD_MAP[0][1].test(String(c || '').trim())));
    let map = {}, unknown = [];
    let body;
    if (hi === -1) { // no header: assume Item, Qty, Category, Location
      map = { name: 0, qty: 1, category: 2, location: 3 };
      body = rows;
    } else {
      rows[hi].forEach((h, ci) => {
        const label = String(h == null ? '' : h).trim();
        if (!label) return;
        const hit = HEAD_MAP.find(([k, re]) => re.test(label) && map[k] === undefined);
        if (hit) map[hit[0]] = ci; else unknown.push(label);
      });
      body = rows.slice(hi + 1);
    }
    const items = [];
    body.forEach((r) => {
      const get = (k) => (map[k] === undefined ? '' : r[map[k]] == null ? '' : r[map[k]]);
      const name = String(get('name')).trim();
      if (!name) return;
      const qty = numOrBlank(get('qty'));
      const cond = String(get('condition')).trim();
      const condHit = CONDITIONS.find((c) => c.toLowerCase() === cond.toLowerCase()) || (/repair|broken|bad|poor/i.test(cond) ? 'Needs repair' : /retire|dispose/i.test(cond) ? 'Retired' : /fair|ok/i.test(cond) ? 'Fair' : 'Good');
      items.push({
        name, category: String(get('category')).trim(), model: String(get('model')).trim(), assetTag: String(get('assetTag')).trim(), serial: String(get('serial')).trim(),
        location: String(get('location')).trim(), qty: qty === '' ? 1 : Math.max(0, Math.round(qty)), out: Math.max(0, Math.round(numOrBlank(get('out')) || 0)), condition: condHit,
        purchased: String(get('purchased')).trim(), value: numOrBlank(get('value')), rentable: yes(get('rentable')) || (map.rentable === undefined && numOrBlank(get('rentCost')) > 0),
        rentCost: numOrBlank(get('rentCost')) || 0, notes: String(get('notes')).trim(),
      });
    });
    return { items, unknown, error: items.length ? '' : 'I could not find any item names. The first column should be the item name.' };
  };

  const cellText = (c) => {
    const v = c && c.value;
    if (v == null) return '';
    if (typeof v === 'object') { if (v.result !== undefined) return v.result == null ? '' : v.result; if (v.richText) return v.richText.map((t) => t.text).join(''); if (v instanceof Date) return U.iso(v); if (v.text) return v.text; return ''; }
    return v;
  };
  X.sheetRows = (ws) => { const out = []; ws.eachRow({ includeEmpty: false }, (row) => { const arr = []; for (let c = 1; c <= row.cellCount; c++) arr.push(cellText(row.getCell(c))); out.push(arr); }); return out; };

  // File (xlsx or csv) -> items
  X.readInventoryFile = async (file) => {
    if (/\.(csv|tsv|txt)$/i.test(file.name)) return X.itemsFromRows(X.parseCSV(await file.text()));
    const E = await X.load();
    const wb = new E.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
    return X.itemsFromRows(X.sheetRows(ws));
  };

  // A filled-in audit sheet -> { lines: {lineId: {counted,out,condition,notes}}, extras: [], auditor, date }
  X.readAuditFile = async (fileOrBuffer) => {
    const E = await X.load();
    const wb = new E.Workbook();
    await wb.xlsx.load(fileOrBuffer.arrayBuffer ? await fileOrBuffer.arrayBuffer() : fileOrBuffer);
    const ws = wb.getWorksheet('Audit Sheet');
    if (!ws) throw new Error('This does not look like an audit sheet from this app (no "Audit Sheet" tab).');
    const lines = {};
    let n = 0;
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (rn < 7) return;
      const id = String(cellText(row.getCell(1)) || '').trim();
      if (!id || !id.startsWith('al_')) return;
      const counted = cellText(row.getCell(8));
      const out = cellText(row.getCell(10));
      const cond = String(cellText(row.getCell(11)) || '').trim();
      lines[id] = { counted: counted === '' ? null : Math.max(0, Math.round(+counted)), out: out === '' ? null : Math.max(0, Math.round(+out)), condition: CONDITIONS.includes(cond) ? cond : '', notes: String(cellText(row.getCell(12)) || '') };
      n++;
    });
    const extras = [];
    const ex = wb.getWorksheet('Extra items found');
    if (ex) ex.eachRow({ includeEmpty: false }, (row, rn) => {
      if (rn < 5) return;
      const name = String(cellText(row.getCell(1)) || '').trim();
      if (name) extras.push({ id: U.uid('ax'), name, qty: Math.max(1, Math.round(+cellText(row.getCell(2)) || 1)), location: String(cellText(row.getCell(3)) || ''), category: String(cellText(row.getCell(4)) || ''), notes: String(cellText(row.getCell(5)) || '') });
    });
    return { lines, extras, auditor: String(cellText(ws.getCell('E3')) || '').trim(), date: String(cellText(ws.getCell('G3')) || '').trim(), rows: n };
  };
})(typeof window !== 'undefined' ? window : globalThis);
