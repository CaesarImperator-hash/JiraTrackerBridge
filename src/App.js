import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Upload, Download, Bug, TrendingUp, LayoutGrid } from 'lucide-react';
import Papa from 'papaparse';

// Tooltip component
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', padding: '8px 12px', background: '#1f2937', color: 'white', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', border: '6px solid transparent', borderTopColor: '#1f2937' }} />
        </span>
      )}
    </span>
  );
};

// Stable debounced input
const DebouncedInput = ({ initialValue, onDebouncedChange, placeholder }) => {
  const [value, setValue] = useState(initialValue || '');
  const timerRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onDebouncedChange(value); }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value]);

  useEffect(() => { if (initialValue === '' && value !== '') setValue(''); }, [initialValue]);

  return <input type="text" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />;
};

const MultiSelectFilter = ({ options, selected, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => !search ? options : options.filter(o => o.toLowerCase().includes(search.toLowerCase())), [options, search]);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div style={{ position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsOpen(false); }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', textAlign: 'left', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>{selected.length > 0 ? `${selected.length} sel.` : placeholder}</span><span>▼</span>
      </button>
      {isOpen && (
        <div style={{ position: 'absolute', zIndex: 50, marginTop: '4px', width: '200px', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}><input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length > 0 ? filtered.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ marginRight: '8px' }} /><span>{opt}</span>
              </label>
            )) : <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280' }}>Aucun</div>}
          </div>
          {selected.length > 0 && <div style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}><button onClick={(e) => { e.stopPropagation(); onChange([]); }} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button></div>}
        </div>
      )}
    </div>
  );
};

const normalize = (s) => !s ? '' : String(s).trim().replace(/[\[\]()]/g, '').replace(/[-–—]/g, '-').replace(/\s+/g, ' ').replace(/:/g, '').trim();
const extractNum = (k) => { if (!k) return null; const n = normalize(k); let m = n.match(/-(\d+)$/); if (m?.[1]) return parseInt(m[1], 10); m = n.match(/(\d{3,7})/); return m?.[1] ? parseInt(m[1], 10) : null; };
const extractCandidates = (t) => { if (!t) return []; const n = normalize(t); const matches = [...n.matchAll(/\d+/g)]; const c = []; const seen = new Set(); for (const m of matches) { const num = parseInt(m[0], 10), len = m[0].length; if (len < 3 || len > 7 || (num >= 2020 && num <= 2035)) continue; if (seen.has(num)) continue; seen.add(num); c.push({ number: num, position: m.index === 0 ? 'leading' : m.index < 30 ? 'early' : 'late' }); } return c; };
const isClientRelated = (t) => extractCandidates(t).length > 0;
const detectCols = (d) => { if (!d?.length) return null; const h = Object.keys(d[0]); const f = (opts) => { for (const o of opts) { const e = h.find(x => x === o); if (e) return e; } return h.find(x => opts.some(o => x.toLowerCase().includes(o.toLowerCase()))); }; return { key: f(['Clé de ticket', 'Issue Key', 'Key', 'Clé']), summary: f(['Résumé', 'Summary', 'Titre']), status: f(['État', 'Status', 'Statut']), type: f(['Type de ticket', 'Issue Type', 'Type']), created: f(['Création', 'Created', 'Créé']), assignee: f(['Personne assignée', 'Assignee', 'Assigné']), component: f(['Composants', 'Composant', 'Component']), criticality: f(['Priorité', 'Priority', 'Criticité']) }; };
const parseDate = (s) => { if (!s) return null; try { const t = String(s).trim(); const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)); const f = new Date(t); return !isNaN(f.getTime()) ? f : null; } catch { return null; } };
const daysSince = (s) => { const d = parseDate(s); if (!d) return null; const now = new Date(); now.setHours(0,0,0,0); d.setHours(0,0,0,0); return Math.floor((now - d) / 86400000); };
const fmtDate = (s) => { const d = parseDate(s); if (!d) return s || '-'; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const statusColor = (s) => { if (!s) return { bg: '#f3f4f6', color: '#374151' }; const l = String(s).toLowerCase(); if (l.includes('en cours') || l.includes('terminé') || l.includes('done') || l.includes('closed')) return { bg: '#d1fae5', color: '#065f46' }; if (l.includes('ouverte') || l.includes('to do')) return { bg: '#fef3c7', color: '#92400e' }; if (l.includes('clarification')) return { bg: '#ffedd5', color: '#c2410c' }; return { bg: '#f3f4f6', color: '#374151' }; };
const ageColor = (days, status) => { if (!status || !days) return null; const l = String(status).toLowerCase(); if (!(l.includes('ouverte') || l.includes('en cours')) || days <= 10) return null; return days > 30 ? { bg: '#fee2e2', color: '#991b1b' } : { bg: '#ffedd5', color: '#c2410c' }; };
const critColor = (c) => ({ 'Bloquant': { bg: '#dc2626', color: 'white' }, 'Critique': { bg: '#ef4444', color: 'white' }, 'Majeur': { bg: '#f97316', color: 'white' }, 'Mineur': { bg: '#eab308', color: 'white' }, 'Confort': { bg: '#3b82f6', color: 'white' }, 'Moyen': { bg: '#6b7280', color: 'white' } }[c] || { bg: '#9ca3af', color: 'white' });

// CSV download function
const downloadCSV = (content, filename) => {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function App() {
  const [tab, setTab] = useState('bogue');
  const [clientData, setClientData] = useState([]);
  const [owtData, setOwtData] = useState([]);
  const [cols, setCols] = useState({ client: null, owt: null });
  const [filters, setFilters] = useState({ search: '', status: 'all', statusCol: [], ageCol: '', compCol: [], clientCol: '', owtCol: '', assignCol: [], priorityCol: [] });
  const [mFilters, setMFilters] = useState({ comps: [], crits: [] });
  const [mSort, setMSort] = useState({ col: 'total', dir: 'desc' });
  const [modal, setModal] = useState({ open: false, tickets: [], title: '' });
  const [csvModal, setCsvModal] = useState({ open: false, content: '', name: '' });

  const loadCSV = (file) => new Promise((res, rej) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => res(r.data), error: rej }));
  const handleFile = async (e, type) => { const f = e.target.files?.[0]; if (!f) return; const d = await loadCSV(f); const c = detectCols(d); if (type === 'client') { setClientData(d); setCols(p => ({ ...p, client: c })); } else { setOwtData(d); setCols(p => ({ ...p, owt: c })); } };

  const clientOwt = useMemo(() => cols.owt?.summary ? owtData.filter(o => isClientRelated(o[cols.owt.summary])) : [], [owtData, cols]);

  const matched = useMemo(() => {
    if (!cols.client?.key || !cols.owt?.summary) return [];
    const res = [];
    const clientNumToData = new Map();
    clientData.forEach(c => { const n = extractNum(c[cols.client.key]); if (n) clientNumToData.set(n, c); });
    const clientNums = new Set(clientNumToData.keys());
    const owtByClientNum = new Map();
    clientNums.forEach(num => owtByClientNum.set(num, []));
    clientOwt.forEach(o => {
      const allCandidates = extractCandidates(o[cols.owt.summary]);
      const matchingNums = allCandidates.map(c => c.number).filter(num => clientNums.has(num));
      matchingNums.forEach(num => { owtByClientNum.get(num).push(o); });
    });
    clientData.forEach(c => {
      const n = extractNum(c[cols.client.key]);
      const owts = n ? (owtByClientNum.get(n) || []) : [];
      res.push({ client: c, owts, num: n, type: owts.length ? 'matched' : 'unmatched', days: daysSince(c[cols.client.created]) });
    });
    return res;
  }, [clientData, clientOwt, cols]);

  const bogues = useMemo(() => cols.client?.type ? matched.filter(i => i.client?.[cols.client.type] === 'Bogue') : [], [matched, cols]);
  const evols = useMemo(() => cols.client?.type ? matched.filter(i => i.client?.[cols.client.type] === 'Evolution') : [], [matched, cols]);

  const applyFilters = useCallback((data) => {
    let f = data;
    if (filters.status === 'no-link') f = f.filter(i => i.type === 'unmatched');
    else if (filters.status === 'at-risk') f = f.filter(i => { const s = (i.client?.[cols.client?.status] || '').toLowerCase(); return (s.includes('ouverte') || s.includes('en cours')) && i.days > 10; });
    else if (filters.status === 'matched') f = f.filter(i => i.type === 'matched');
    if (filters.search) { const s = filters.search.toLowerCase(); f = f.filter(i => (i.client?.[cols.client?.summary] || '').toLowerCase().includes(s) || (i.client?.[cols.client?.key] || '').toLowerCase().includes(s)); }
    if (filters.statusCol.length) f = f.filter(i => filters.statusCol.includes(i.client?.[cols.client?.status]));
    if (filters.ageCol) f = f.filter(i => fmtDate(i.client?.[cols.client?.created]).includes(filters.ageCol) || String(i.days || '').includes(filters.ageCol));
    if (filters.compCol.length) f = f.filter(i => filters.compCol.includes(i.client?.[cols.client?.component]));
    if (filters.clientCol) { const s = filters.clientCol.toLowerCase(); f = f.filter(i => (i.client?.[cols.client?.key] || '').toLowerCase().includes(s) || (i.client?.[cols.client?.summary] || '').toLowerCase().includes(s)); }
    if (filters.owtCol) { const s = filters.owtCol.toLowerCase(); f = f.filter(i => i.owts.some(o => (o[cols.owt?.key] || '').toLowerCase().includes(s))); }
    if (filters.assignCol.length) f = f.filter(i => i.owts.some(o => filters.assignCol.includes(o[cols.owt?.assignee])));
    if (filters.priorityCol.length) f = f.filter(i => filters.priorityCol.includes(i.client?.[cols.client?.criticality]));
    return f;
  }, [filters, cols]);

  const filteredB = useMemo(() => applyFilters(bogues), [bogues, applyFilters]);
  const filteredE = useMemo(() => applyFilters(evols), [evols, applyFilters]);

  const uniqVals = (data, acc) => Array.from(new Set(data.map(acc).filter(Boolean))).sort();
  const uniqStatus = useMemo(() => uniqVals(matched, i => i.client?.[cols.client?.status]), [matched, cols]);
  const uniqComps = useMemo(() => uniqVals(matched, i => i.client?.[cols.client?.component]), [matched, cols]);
  const uniqAssign = useMemo(() => { const s = new Set(); matched.forEach(i => i.owts.forEach(o => { const a = o[cols.owt?.assignee]; if (a) s.add(a); })); return Array.from(s).sort(); }, [matched, cols]);
  const uniqPriority = useMemo(() => uniqVals(matched, i => i.client?.[cols.client?.criticality]), [matched, cols]);

  const clearFilters = useCallback(() => setFilters({ search: '', status: 'all', statusCol: [], ageCol: '', compCol: [], clientCol: '', owtCol: '', assignCol: [], priorityCol: [] }), []);
  const hasFilters = filters.statusCol.length || filters.compCol.length || filters.assignCol.length || filters.priorityCol.length || filters.ageCol || filters.clientCol || filters.owtCol || filters.search || filters.status !== 'all';

  const matrix = useMemo(() => {
    if (!cols.client?.component || !cols.client?.criticality || !cols.client?.status) return null;
    const active = clientData.filter(t => ['Ouverte', 'En cours'].includes(t[cols.client.status]));
    const crits = ['Bloquant', 'Critique', 'Majeur', 'Mineur', 'Confort', 'Moyen'];
    const map = new Map();
    active.forEach(t => { const comp = t[cols.client.component] || 'Non défini', crit = t[cols.client.criticality]; if (!map.has(comp)) { map.set(comp, { comp, tickets: {}, total: 0 }); crits.forEach(c => map.get(comp).tickets[c] = []); } if (crits.includes(crit)) { map.get(comp).tickets[crit].push(t); map.get(comp).total++; } });
    return { comps: Array.from(map.values()), crits, allComps: Array.from(new Set(clientData.map(t => t[cols.client.component] || 'Non défini'))) };
  }, [clientData, cols]);

  const sortedMatrix = useMemo(() => {
    if (!matrix) return null;
    let f = matrix.comps;
    if (mFilters.comps.length) f = f.filter(c => mFilters.comps.includes(c.comp));
    if (mFilters.crits.length) f = f.map(c => { const n = { ...c, tickets: {}, total: 0 }; matrix.crits.forEach(cr => { n.tickets[cr] = mFilters.crits.includes(cr) ? c.tickets[cr] : []; n.total += n.tickets[cr].length; }); return n; });
    f = [...f].sort((a, b) => { const va = mSort.col === 'total' ? a.total : (a.tickets[mSort.col] || []).length; const vb = mSort.col === 'total' ? b.total : (b.tickets[mSort.col] || []).length; return mSort.dir === 'desc' ? vb - va : va - vb; });
    return { ...matrix, comps: f };
  }, [matrix, mFilters, mSort]);

  const stats = useMemo(() => {
    const calc = (t) => { const total = t.length, linked = t.filter(d => d.type === 'matched').length; const unlinked = t.filter(d => { const s = (d.client?.[cols.client?.status] || '').toLowerCase(); return (s.includes('ouverte') || s.includes('en cours')) && d.type === 'unmatched'; }).length; const atRisk = t.filter(d => { const s = (d.client?.[cols.client?.status] || '').toLowerCase(); return (s.includes('ouverte') || s.includes('en cours')) && d.days > 10; }).length; const clar = t.filter(d => (d.client?.[cols.client?.status] || '').toLowerCase().includes('clarification')).length; return { total, linked, unlinked, pct: total ? Math.round(linked / total * 100) : 0, atRisk, clar }; };
    return { bogue: calc(bogues), evol: calc(evols) };
  }, [bogues, evols, cols]);

  const doExport = (data, name) => {
    const rows = [];
    data.forEach(i => {
      const base = { 'Client Key': i.client?.[cols.client.key] || '', 'Type': i.client?.[cols.client.type] || '', 'Priorité': i.client?.[cols.client.criticality] || '', 'Summary': i.client?.[cols.client.summary] || '', 'Status': i.client?.[cols.client.status] || '', 'Composant': i.client?.[cols.client.component] || '', 'Created': i.client?.[cols.client.created] || '', 'Days': i.days || '', 'Match': i.type };
      if (i.owts.length === 0) { rows.push({ ...base, 'OWT Key': '', 'OWT Type': '', 'OWT Status': '', 'Assigné': '' }); }
      else { i.owts.forEach(o => { rows.push({ ...base, 'OWT Key': o[cols.owt.key] || '', 'OWT Type': o[cols.owt.type] || '', 'OWT Status': o[cols.owt.status] || '', 'Assigné': o[cols.owt.assignee] || '' }); }); }
    });
    downloadCSV(Papa.unparse(rows), `${name}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const doExportMatrix = () => { if (!sortedMatrix) return; const h = ['Composant', ...sortedMatrix.crits, 'Total']; const r = sortedMatrix.comps.map(c => [c.comp, ...sortedMatrix.crits.map(cr => (c.tickets[cr] || []).length), c.total]); downloadCSV(Papa.unparse([h, ...r]), `Matrice-${new Date().toISOString().split('T')[0]}.csv`); };

  const setAgeCol = useCallback((v) => setFilters(f => ({ ...f, ageCol: v })), []);
  const setClientCol = useCallback((v) => setFilters(f => ({ ...f, clientCol: v })), []);
  const setOwtCol = useCallback((v) => setFilters(f => ({ ...f, owtCol: v })), []);
  const setStatusCol = useCallback((v) => setFilters(f => ({ ...f, statusCol: v })), []);
  const setCompCol = useCallback((v) => setFilters(f => ({ ...f, compCol: v })), []);
  const setAssignCol = useCallback((v) => setFilters(f => ({ ...f, assignCol: v })), []);
  const setPriorityCol = useCallback((v) => setFilters(f => ({ ...f, priorityCol: v })), []);
  const setSearchFilter = useCallback((v) => setFilters(f => ({ ...f, search: v })), []);

  const currentStats = tab === 'bogue' ? stats.bogue : stats.evol;
  const currentData = tab === 'bogue' ? filteredB : filteredE;
  const ready = clientData.length > 0 && owtData.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Jira Tracker Pro</h1>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', marginBottom: '16px' }}><Upload size={20} />Client CSV</h2>
            <input type="file" accept=".csv" onChange={e => handleFile(e, 'client')} />
            {clientData.length > 0 && <p style={{ color: '#059669', marginTop: '12px', fontSize: '14px' }}>{clientData.length} tickets ✓</p>}
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', marginBottom: '16px' }}><Upload size={20} />OWT CSV</h2>
            <input type="file" accept=".csv" onChange={e => handleFile(e, 'owt')} />
            {owtData.length > 0 && <p style={{ color: '#059669', marginTop: '12px', fontSize: '14px' }}>{owtData.length} tickets ✓</p>}
          </div>
        </div>

        {!ready && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#1e40af' }}><Upload size={48} style={{ marginBottom: '16px' }} /><p style={{ fontSize: '18px', fontWeight: 500 }}>Importez les deux fichiers CSV</p></div>}

        {ready && (
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
              <button onClick={() => setTab('bogue')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', background: tab === 'bogue' ? '#eff6ff' : 'transparent', color: tab === 'bogue' ? '#1d4ed8' : '#6b7280', borderBottom: tab === 'bogue' ? '2px solid #1d4ed8' : 'none' }}><Bug size={16} />Bogue</button>
              <button onClick={() => setTab('evolution')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', background: tab === 'evolution' ? '#eff6ff' : 'transparent', color: tab === 'evolution' ? '#1d4ed8' : '#6b7280', borderBottom: tab === 'evolution' ? '2px solid #1d4ed8' : 'none' }}><TrendingUp size={16} />Evolution</button>
              <button onClick={() => setTab('matrix')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', background: tab === 'matrix' ? '#eff6ff' : 'transparent', color: tab === 'matrix' ? '#1d4ed8' : '#6b7280', borderBottom: tab === 'matrix' ? '2px solid #1d4ed8' : 'none' }}><LayoutGrid size={16} />Matrice</button>
            </div>

            <div style={{ padding: '24px' }}>
              {(tab === 'bogue' || tab === 'evolution') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <Tooltip text="Nombre total de tickets clients dans cet onglet"><button onClick={() => setFilters(f => ({ ...f, status: 'all' }))} style={{ width: '100%', textAlign: 'left', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer' }}><div style={{ fontSize: '24px', fontWeight: 700 }}>{currentStats.total}</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Total</div></button></Tooltip>
                    <Tooltip text="Pourcentage de tickets clients ayant au moins un ticket OWT associé"><button onClick={() => setFilters(f => ({ ...f, status: 'matched' }))} style={{ width: '100%', textAlign: 'left', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer' }}><div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>{currentStats.pct}%</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Liés</div></button></Tooltip>
                    <Tooltip text="Tickets clients 'Ouverte' ou 'En cours' sans ticket OWT associé"><button onClick={() => setFilters(f => ({ ...f, status: 'no-link' }))} style={{ width: '100%', textAlign: 'left', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer' }}><div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>{currentStats.unlinked}</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Sans OWT</div></button></Tooltip>
                    <Tooltip text="Tickets clients 'Ouverte' ou 'En cours' depuis plus de 10 jours"><button onClick={() => setFilters(f => ({ ...f, status: 'at-risk' }))} style={{ width: '100%', textAlign: 'left', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer' }}><div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{currentStats.atRisk}</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>À risque</div></button></Tooltip>
                    <Tooltip text="Tickets clients en attente de clarification"><div style={{ textAlign: 'left', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><div style={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>{currentStats.clar}</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Clarification</div></div></Tooltip>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}><DebouncedInput initialValue={filters.search} onDebouncedChange={setSearchFilter} placeholder="Recherche..." /></div>
                    <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px' }}><option value="all">Tous</option><option value="matched">Liés</option><option value="no-link">Sans OWT</option><option value="at-risk">À risque</option></select>
                    {hasFilters && <button onClick={clearFilters} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Effacer</button>}
                    <button onClick={() => doExport(currentData, tab)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}><Download size={16} />Export</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Statut</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Priorité</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Âge</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Composant</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Ticket Client</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>OWT</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Type OWT</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Assigné</th>
                        </tr>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '8px' }}><MultiSelectFilter options={uniqStatus} selected={filters.statusCol} onChange={setStatusCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}><MultiSelectFilter options={uniqPriority} selected={filters.priorityCol} onChange={setPriorityCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}><DebouncedInput initialValue={filters.ageCol} onDebouncedChange={setAgeCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}><MultiSelectFilter options={uniqComps} selected={filters.compCol} onChange={setCompCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}><DebouncedInput initialValue={filters.clientCol} onDebouncedChange={setClientCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}><DebouncedInput initialValue={filters.owtCol} onDebouncedChange={setOwtCol} placeholder="..." /></th>
                          <th style={{ padding: '8px' }}></th>
                          <th style={{ padding: '8px' }}><MultiSelectFilter options={uniqAssign} selected={filters.assignCol} onChange={setAssignCol} placeholder="..." /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentData.map((item, i) => {
                          const sc = statusColor(item.client?.[cols.client?.status]);
                          const ac = ageColor(item.days, item.client?.[cols.client?.status]);
                          const p = item.client?.[cols.client?.criticality];
                          const pc = critColor(p);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '12px' }}><span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, background: sc.bg, color: sc.color }}>{item.client?.[cols.client?.status]}</span></td>
                              <td style={{ padding: '12px' }}>{p ? <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: pc.bg, color: pc.color }}>{p}</span> : '-'}</td>
                              <td style={{ padding: '12px' }}><div>{fmtDate(item.client?.[cols.client?.created])}</div>{ac && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, marginTop: '4px', background: ac.bg, color: ac.color }}>+{item.days}j</span>}</td>
                              <td style={{ padding: '12px', fontSize: '14px' }}>{item.client?.[cols.client?.component] || '-'}</td>
                              <td style={{ padding: '12px' }}><a href={`https://www.portail.vd.ch/outils/issuetracker/browse/${item.client?.[cols.client?.key]}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{item.client?.[cols.client?.key]}</a><div style={{ fontSize: '12px', color: '#6b7280', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.client?.[cols.client?.summary]}</div></td>
                              <td style={{ padding: '12px' }}>{item.owts.length ? item.owts.map((o, j) => { const oc = statusColor(o[cols.owt?.status]); return <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><a href={`https://openwt.atlassian.net/browse/${o[cols.owt?.key]}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{o[cols.owt?.key]}</a><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', background: oc.bg, color: oc.color }}>{o[cols.owt?.status]}</span></div>; }) : <span style={{ color: '#dc2626' }}>Aucun</span>}</td>
                              <td style={{ padding: '12px' }}>{item.owts.length ? item.owts.map((o, j) => <div key={j} style={{ fontSize: '14px', marginBottom: '4px' }}>{o[cols.owt?.type] || '-'}</div>) : '-'}</td>
                              <td style={{ padding: '12px' }}>{item.owts.length ? item.owts.map((o, j) => <div key={j} style={{ fontSize: '14px', marginBottom: '4px' }}>{o[cols.owt?.assignee] || '-'}</div>) : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>{currentData.length} tickets</div>
                </>
              )}

              {tab === 'matrix' && sortedMatrix && (
                <>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><h3 style={{ fontWeight: 600 }}>Filtres</h3><button onClick={doExportMatrix} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}><Download size={16} />Export</button></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div><label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Composants</label><select multiple value={mFilters.comps} onChange={e => setMFilters(f => ({ ...f, comps: Array.from(e.target.selectedOptions, o => o.value) }))} style={{ width: '100%', height: '120px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>{sortedMatrix.allComps.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Criticités</label><select multiple value={mFilters.crits} onChange={e => setMFilters(f => ({ ...f, crits: Array.from(e.target.selectedOptions, o => o.value) }))} style={{ width: '100%', height: '120px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>{sortedMatrix.crits.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    </div>
                    {(mFilters.comps.length || mFilters.crits.length) > 0 && <button onClick={() => setMFilters({ comps: [], crits: [] })} style={{ marginTop: '12px', fontSize: '14px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Réinitialiser</button>}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead><tr><th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, background: '#f3f4f6', borderRight: '1px solid #e5e7eb' }}>Composant</th>{sortedMatrix.crits.map(cr => { const cc = critColor(cr); return <th key={cr} onClick={() => setMSort(p => ({ col: cr, dir: p.col === cr && p.dir === 'desc' ? 'asc' : 'desc' }))} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', background: cc.bg, color: cc.color }}>{cr} {mSort.col === cr && (mSort.dir === 'desc' ? '↓' : '↑')}</th>; })}<th onClick={() => setMSort(p => ({ col: 'total', dir: p.col === 'total' && p.dir === 'desc' ? 'asc' : 'desc' }))} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', background: '#374151', color: 'white' }}>Total {mSort.col === 'total' && (mSort.dir === 'desc' ? '↓' : '↑')}</th></tr></thead>
                      <tbody>{sortedMatrix.comps.map((c, i) => <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '12px', fontWeight: 500, borderRight: '1px solid #e5e7eb' }}>{c.comp}</td>{sortedMatrix.crits.map(cr => { const n = (c.tickets[cr] || []).length; return <td key={cr} style={{ padding: '12px', textAlign: 'center', background: n > 0 ? '#eff6ff' : 'transparent' }}>{n > 0 ? <button onClick={() => setModal({ open: true, tickets: c.tickets[cr], title: `${c.comp} - ${cr}` })} style={{ padding: '4px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>{n}</button> : <span style={{ color: '#9ca3af' }}>0</span>}</td>; })}<td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, background: '#f3f4f6' }}>{c.total}</td></tr>)}</tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === 'matrix' && !sortedMatrix && <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>Colonnes manquantes pour la matrice</div>}
            </div>
          </div>
        )}
      </main>

      {modal.open && (
        <div onClick={() => setModal({ open: false, tickets: [], title: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '8px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #e5e7eb' }}><h2 style={{ fontSize: '18px', fontWeight: 700 }}>{modal.title} ({modal.tickets.length})</h2><button onClick={() => setModal({ open: false, tickets: [], title: '' })} style={{ fontSize: '24px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>×</button></div>
            <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '70vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead style={{ background: '#f3f4f6' }}><tr><th style={{ padding: '12px', textAlign: 'left' }}>Clé</th><th style={{ padding: '12px', textAlign: 'left' }}>Résumé</th><th style={{ padding: '12px', textAlign: 'left' }}>Statut</th><th style={{ padding: '12px', textAlign: 'left' }}>Criticité</th></tr></thead>
                <tbody>{modal.tickets.map((t, i) => { const sc = statusColor(t[cols.client?.status]); const cc = critColor(t[cols.client?.criticality]); return <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '12px' }}><a href={`https://www.portail.vd.ch/outils/issuetracker/browse/${t[cols.client?.key]}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>{t[cols.client?.key]}</a></td><td style={{ padding: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t[cols.client?.summary]}</td><td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: sc.bg, color: sc.color }}>{t[cols.client?.status]}</span></td><td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: cc.bg, color: cc.color }}>{t[cols.client?.criticality]}</span></td></tr>; })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}