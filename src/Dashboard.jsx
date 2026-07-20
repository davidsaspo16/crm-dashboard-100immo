import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from "recharts";

import { DEPT_MAP } from "./data/deptMap.js";

const INK = "#101820";
const PAPER = "#F6F4EF";
const PANEL = "#FFFFFF";
const LINE = "#E4E0D6";
const TEAL = "#1F6F5C";
const TEAL_SOFT = "#DCEAE6";
const CLAY = "#B5562B";
const GOLD = "#C9A24B";
const SLATE = "#5B6570";
const RED = "#B4432F";
const RED_SOFT = "#F6DED7";
const AMBER_SOFT = "#FBEFD6";
const AMBER = "#B98419";

const STATUT_LABELS = {
  "piste": "Piste",
  "lead a rempli le formulaire = lead chaud": "Formulaire rempli (chaud)",
  "lead envoyé a l'agent": "Envoyé à l'agent",
  "formulaire du lead envoyé a l'agent": "Formulaire envoyé à l'agent",
  "1ere relance envoyé a l'agent": "1re relance envoyée",
  "l'agent a répondu a la 1ere relance mais pas de contact du lead": "1re relance : pas de contact",
  "l'agent a répondu a la 1ere relance et a réussi a contacte le lead": "1re relance : contact réussi",
  "2nd relance envoyé a l'agent": "2e relance envoyée",
  "l'agent a répondu a la 2nd relance mais pas de contact du lead": "2e relance : pas de contact",
  "l'agent a répondu a la 2d relance et a réussi a contacte le lead": "2e relance : contact réussi",
  "mandat obtenu": "Mandat obtenu",
  "refus": "Refus",
};
const STATUT_KEYS = Object.keys(STATUT_LABELS);

const FUNNEL_LABELS = { 0: "Refus", 1: "Piste", 2: "Formulaire rempli", 3: "Envoyé à l'agent", 4: "Relance en cours", 5: "Contact réussi", 6: "Mandat obtenu" };
const PALETTE = [TEAL, CLAY, GOLD, SLATE, "#7A8B99", "#8A6A9C", "#4E8073", "#C77B4B"];
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function fmt(n) { return new Intl.NumberFormat("fr-FR").format(n); }
function pct(n, d) { if (!d) return "0%"; return Math.round((n / d) * 100) + "%"; }
function fmtEUR(n) { return n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n); }

// Étape déduite des dates de progression du bien (pas de mapping de status fiable disponible)
function propertyStage(p) {
  if (p.dateActeAuthentique) return "vente";
  if (p.dateCompromis) return "compromis";
  return "mandat";
}
const PROPERTY_STAGE_LABELS = { mandat: "Mandat actif", compromis: "Compromis signé", vente: "Vente actée" };

const LON_MIN = -5.3, LON_MAX = 9.7, LAT_MIN = 41.2, LAT_MAX = 51.3;
const PX_PER_DEG_LAT = 46;
const PX_PER_DEG_LON = PX_PER_DEG_LAT * 0.694;
const MAP_W = (LON_MAX - LON_MIN) * PX_PER_DEG_LON;
const MAP_H = (LAT_MAX - LAT_MIN) * PX_PER_DEG_LAT;
function proj(lon, lat) { return [(lon - LON_MIN) * PX_PER_DEG_LON, (LAT_MAX - lat) * PX_PER_DEG_LAT]; }
const FRANCE_OUTLINE_LONLAT = [
  [2.37, 51.03], [1.85, 50.95], [-1.6, 49.65], [-1.99, 48.65], [-5.05, 48.45],
  [-2.5, 47.3], [-1.2, 44.5], [-1.77, 43.35], [0.5, 42.7], [2.9, 42.4],
  [5.93, 43.12], [7.3, 43.7], [7.5, 47.5], [7.75, 48.58], [4.7, 49.77], [2.37, 51.03]
];
const FRANCE_PATH = FRANCE_OUTLINE_LONLAT.map(([lo, la], i) => {
  const [x, y] = proj(lo, la);
  return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
}).join(" ") + " Z";

const DEPT_META = {};
DEPT_MAP.forEach(d => { DEPT_META[d.code] = d; });

const TIME_PRESETS = [
  { value: "all", label: "Toute la période" },
  { value: "90d", label: "90 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "7d", label: "7 derniers jours" },
  { value: "custom", label: "Personnalisé" },
];

function timeRangeStart(preset, maxDate) {
  const d = new Date(maxDate);
  if (preset === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (preset === "30d") { d.setDate(d.getDate() - 30); return d; }
  if (preset === "90d") { d.setDate(d.getDate() - 90); return d; }
  return null; // all / custom (handled separately)
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "18px 20px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: SLATE, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent || INK, fontFamily: "Georgia, serif", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, right }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "18px 20px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: SLATE, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 10px", fontSize: 12.5, background: PAPER, color: INK, fontFamily: "inherit", cursor: "pointer", ...style }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SortableTh({ label, sortKey, activeKey, dir, onSort, align }) {
  const active = activeKey === sortKey;
  return (
    <th onClick={() => onSort(sortKey)}
      style={{ padding: "8px 10px", fontWeight: 600, cursor: "pointer", userSelect: "none", textAlign: align || "left", color: active ? INK : SLATE }}>
      {label}{active ? (dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );
}

function weekLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function AlertRow({ level, title, detail }) {
  const styles = {
    high: { bg: RED_SOFT, fg: RED, dot: RED },
    medium: { bg: AMBER_SOFT, fg: AMBER, dot: AMBER },
    good: { bg: TEAL_SOFT, fg: TEAL, dot: TEAL },
  }[level];
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: styles.bg, marginBottom: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: styles.dot, marginTop: 5, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: styles.fg }}>{title}</div>
        <div style={{ fontSize: 12, color: INK, marginTop: 2, opacity: 0.85 }}>{detail}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [view, setView] = useState("manager");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [agenceFilter, setAgenceFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [search, setSearch] = useState("");
  const [hoveredDept, setHoveredDept] = useState(null);
  const [agenceSortKey, setAgenceSortKey] = useState("leads");
  const [agenceSortDir, setAgenceSortDir] = useState("desc");
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState(null);
  const [propertiesCappedAt, setPropertiesCappedAt] = useState(null);
  const [propAgenceFilter, setPropAgenceFilter] = useState("all");

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const resp = await fetch("/api/leads");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Requête échouée (${resp.status})`);
      setRecords(data.records);
      setLastRefreshAt(new Date());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const loadProperties = useCallback(async () => {
    setPropertiesLoading(true);
    setPropertiesError(null);
    try {
      const resp = await fetch("/api/properties");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Requête échouée (${resp.status})`);
      setProperties(data.properties);
      setPropertiesCappedAt(data.cappedAt);
    } catch (e) {
      setPropertiesError(e.message);
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const combinedRecords = records;

  const commercials = useMemo(() => {
    const names = new Set();
    combinedRecords.forEach(r => { if (r.commercial && r.commercial !== "Non assigné") names.add(r.commercial); });
    return [...names].sort();
  }, [combinedRecords]);

  useEffect(() => {
    if (commercials.length > 0 && !selectedAgent) setSelectedAgent(commercials[0]);
  }, [commercials, selectedAgent]);

  const currentMaxDate = useMemo(() => {
    if (combinedRecords.length === 0) return new Date();
    const dates = combinedRecords.map(r => new Date(r.created));
    return new Date(Math.max(...dates));
  }, [combinedRecords]);
  const currentMaxDateStr = currentMaxDate.toISOString().slice(0, 10);

  const minDateStr = useMemo(() => {
    if (combinedRecords.length === 0) return currentMaxDateStr;
    const dates = combinedRecords.map(r => new Date(r.created));
    return new Date(Math.min(...dates)).toISOString().slice(0, 10);
  }, [combinedRecords, currentMaxDateStr]);

  useEffect(() => {
    if (combinedRecords.length > 0 && !customStart) {
      setCustomStart(minDateStr);
      setCustomEnd(currentMaxDateStr);
    }
  }, [combinedRecords, minDateStr, currentMaxDateStr, customStart]);

    const agenceOptions = useMemo(() => {
    const counts = {};
    combinedRecords.forEach(r => {
      const a = r.agence || "Non renseigné";
      counts[a] = (counts[a] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [{ value: "all", label: `Tous les agents affiliés (${sorted.length})` },
      ...sorted.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))];
  }, [combinedRecords]);

  const propertiesWithStage = useMemo(() => properties.map(p => ({ ...p, stage: propertyStage(p) })), [properties]);

  const propAgenceOptions = useMemo(() => {
    const counts = {};
    propertiesWithStage.forEach(p => { counts[p.agence] = (counts[p.agence] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [{ value: "all", label: `Toutes les agences (${sorted.length})` },
      ...sorted.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))];
  }, [propertiesWithStage]);

  const filteredProperties = useMemo(() => {
    if (propAgenceFilter === "all") return propertiesWithStage;
    return propertiesWithStage.filter(p => p.agence === propAgenceFilter);
  }, [propertiesWithStage, propAgenceFilter]);

  const propStageCounts = useMemo(() => {
    const c = { mandat: 0, compromis: 0, vente: 0 };
    filteredProperties.forEach(p => { c[p.stage] += 1; });
    return c;
  }, [filteredProperties]);

  const propVenteVolume = useMemo(() => {
    return filteredProperties
      .filter(p => p.stage === "vente")
      .reduce((sum, p) => sum + (p.priceFinal || p.price || 0), 0);
  }, [filteredProperties]);

  const propAgenceData = useMemo(() => {
    const c = {};
    filteredProperties.forEach(p => {
      if (!c[p.agence]) c[p.agence] = { name: p.agence, mandat: 0, compromis: 0, vente: 0, total: 0 };
      c[p.agence][p.stage] += 1;
      c[p.agence].total += 1;
    });
    return Object.values(c).sort((a, b) => b.total - a.total);
  }, [filteredProperties]);

  const timeStart = timeFilter === "custom" ? new Date(customStart + "T00:00:00") : timeRangeStart(timeFilter, currentMaxDate);
  const timeEnd = timeFilter === "custom" ? new Date(customEnd + "T23:59:59") : null;

  const filteredRecords = useMemo(() => {
    return combinedRecords.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (agenceFilter !== "all" && r.agence !== agenceFilter) return false;
      if (view === "agent" && r.commercial !== selectedAgent) return false;
      if (timeStart && new Date(r.created) < timeStart) return false;
      if (timeEnd && new Date(r.created) > timeEnd) return false;
      if (search && !(STATUT_LABELS[r.statut] || r.statut || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [typeFilter, agenceFilter, view, selectedAgent, search, timeFilter, customStart, customEnd, combinedRecords]);

  const total = filteredRecords.length;
  const refusCount = filteredRecords.filter((r) => r.statut === "refus").length;
  const contactReussi = filteredRecords.filter((r) => (r.statut || "").includes("réussi")).length;
  const envoyesCount = filteredRecords.filter((r) => r.statut && r.statut !== "piste").length;

  const statutData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => { const l = STATUT_LABELS[r.statut] || r.statut || "Non renseigné"; c[l] = (c[l] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filteredRecords]);

  const typeData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => { c[r.type] = (c[r.type] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [filteredRecords]);

  const sourceData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => { c[r.source] = (c[r.source] || 0) + 1; });
    return Object.entries(c).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value }));
  }, [filteredRecords]);

  const weeklyData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => {
      const d = new Date(r.created);
      const day = d.getDay(); const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(d); monday.setDate(d.getDate() - diff);
      const key = monday.toISOString().slice(0, 10);
      c[key] = (c[key] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => a[0].localeCompare(b[0])).map(([week, value]) => ({ week: weekLabel(week), value }));
  }, [filteredRecords]);

  const commercialData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => {
      const name = r.commercial || "Non assigné";
      if (name === "Non assigné") return;
      if (!c[name]) c[name] = { name, leads: 0, refus: 0, reussi: 0 };
      c[name].leads += 1;
      if (r.statut === "refus") c[name].refus += 1;
      if ((r.statut || "").includes("réussi")) c[name].reussi += 1;
    });
    return Object.values(c).sort((a, b) => b.leads - a.leads);
  }, [filteredRecords]);

  const agenceData = useMemo(() => {
    const c = {};
    filteredRecords.forEach((r) => {
      const name = r.agence || "Non renseigné";
      if (!c[name]) c[name] = { name, leads: 0, refus: 0, reussi: 0, envoyes: 0 };
      c[name].leads += 1;
      if (r.statut === "refus") c[name].refus += 1;
      if ((r.statut || "").includes("réussi")) c[name].reussi += 1;
      if (r.statut && r.statut !== "piste") c[name].envoyes += 1;
    });
    const arr = Object.values(c).map(a => ({
      ...a,
      reussiRate: a.leads ? a.reussi / a.leads : 0,
      refusRate: a.leads ? a.refus / a.leads : 0,
    }));
    arr.sort((a, b) => {
      const dir = agenceSortDir === "desc" ? -1 : 1;
      const av = a[agenceSortKey], bv = b[agenceSortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return arr;
  }, [filteredRecords, agenceSortKey, agenceSortDir]);

  const toggleAgenceSort = (key) => {
    if (agenceSortKey === key) setAgenceSortDir(d => d === "desc" ? "asc" : "desc");
    else { setAgenceSortKey(key); setAgenceSortDir("desc"); }
  };

    const funnelData = useMemo(() => {
    const stages = [1, 2, 3, 4, 5, 6];
    const counts = {};
    filteredRecords.forEach((r) => {
      let stage = 1; const s = r.statut || "";
      if (s === "refus") return;
      if (s.includes("réussi")) stage = 5;
      else if (s.includes("relance envoyé")) stage = 4;
      else if (s.includes("formulaire") && s.includes("agent")) stage = 3;
      else if (s.includes("formulaire")) stage = 2;
      else if (s === "mandat obtenu") stage = 6;
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return stages.map((s) => {
      const atStage = stages.filter(x => x >= s).reduce((sum, x) => sum + (counts[x] || 0), 0);
      return { stage: FUNNEL_LABELS[s], count: atStage };
    });
  }, [filteredRecords]);

  const deptFiltered = useMemo(() => {
    const agg = {};
    filteredRecords.forEach(r => {
      if (!r.dept) return;
      if (!agg[r.dept]) agg[r.dept] = { leads: 0, refus: 0, reussi: 0 };
      agg[r.dept].leads += 1;
      if (r.statut === "refus") agg[r.dept].refus += 1;
      if ((r.statut||"").includes("réussi")) agg[r.dept].reussi += 1;
    });
    return Object.entries(agg).map(([code, a]) => {
      const meta = DEPT_META[code] || {};
      return { code, name: meta.name || code, lon: meta.lon, lat: meta.lat, ...a };
    }).filter(d => d.lon != null).sort((a,b) => b.leads - a.leads);
  }, [filteredRecords]);
  const maxDeptLeads = deptFiltered[0]?.leads || 1;

  const heatGrid = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    filteredRecords.forEach((r) => {
      const d = new Date(r.created);
      const day = d.getDay(); const dow = day === 0 ? 6 : day - 1;
      grid[dow][d.getHours()] += 1;
    });
    return grid;
  }, [filteredRecords]);
  const heatMax = Math.max(...heatGrid.flat(), 1);

  const typeOptions = [
    { value: "all", label: "Tous types" }, { value: "Maison", label: "Maison" },
    { value: "Appartement", label: "Appartement" }, { value: "Non renseigné", label: "Non renseigné" },
  ];

  const agentPerf = useMemo(() => {
    const list = filteredRecords;
    return {
      leads: list.length,
      refus: list.filter(r => r.statut === "refus").length,
      contact_reussi: list.filter(r => (r.statut||"").includes("réussi")).length,
      envoyes: list.filter(r => r.statut && r.statut !== "piste").length,
    };
  }, [filteredRecords]);

  const alerts = useMemo(() => {
    const recs = combinedRecords;
    const maxDate = currentMaxDate;
    const weekMs = 7 * 24 * 3600 * 1000;
    const inRange = (d, start, end) => d >= start && d < end;
    const w0start = new Date(maxDate.getTime() - weekMs);
    const w1start = new Date(maxDate.getTime() - 2 * weekMs);
    const w2start = new Date(maxDate.getTime() - 3 * weekMs);
    const thisWeek = recs.filter(r => inRange(new Date(r.created), w0start, maxDate));
    const lastWeek = recs.filter(r => inRange(new Date(r.created), w1start, w0start));
    const out = [];
    if (lastWeek.length > 5) {
      const delta = (thisWeek.length - lastWeek.length) / lastWeek.length;
      if (delta <= -0.25) out.push({ level: "high", title: "Forte baisse des leads cette semaine", detail: `${thisWeek.length} leads vs ${lastWeek.length} la semaine précédente (${Math.round(delta*100)}%).` });
      else if (delta >= 0.4) out.push({ level: "good", title: "Forte hausse des leads cette semaine", detail: `${thisWeek.length} leads vs ${lastWeek.length} la semaine précédente (+${Math.round(delta*100)}%).` });
    }
    const byAgent = {};
    recs.forEach(r => { const a = r.commercial || "Non assigné"; if (a === "Non assigné") return; if (!byAgent[a]) byAgent[a] = { leads: 0, reussi: 0 }; byAgent[a].leads += 1; if ((r.statut||"").includes("réussi")) byAgent[a].reussi += 1; });
    const agentEntries = Object.entries(byAgent).filter(([,v]) => v.leads >= 15);
    const avgRate = agentEntries.reduce((s,[,v]) => s + v.reussi/v.leads, 0) / (agentEntries.length || 1);
    agentEntries.forEach(([name, v]) => { const rate = v.reussi / v.leads; if (rate < avgRate * 0.5 && rate < 0.15) out.push({ level: "medium", title: `Taux de conversion faible — ${name}`, detail: `${Math.round(rate*100)}% de contacts réussis sur ${v.leads} leads (moyenne équipe : ${Math.round(avgRate*100)}%).` }); });
    const byDeptRecent = {}; const byDeptPrior = {};
    recs.forEach(r => { if (!r.dept) return; const d = new Date(r.created); if (d >= w1start && d < maxDate) byDeptRecent[r.dept] = (byDeptRecent[r.dept]||0) + 1; else if (d >= w2start && d < w1start) byDeptPrior[r.dept] = (byDeptPrior[r.dept]||0) + 1; });
    Object.entries(byDeptRecent).forEach(([dept, count]) => { const prior = byDeptPrior[dept] || 0; if (count >= 6 && count >= prior * 2 + 3) { const name = (DEPT_META[dept] || {}).name || dept; out.push({ level: "good", title: `Zone en forte croissance — ${name} (${dept})`, detail: `${count} leads sur les 2 dernières semaines contre ${prior} la période précédente.` }); } });
    const bySourceRecent = {}; const bySourcePrior = {};
    recs.forEach(r => { const d = new Date(r.created); if (d >= w1start && d < maxDate) bySourceRecent[r.source] = (bySourceRecent[r.source]||0)+1; else if (d >= w2start && d < w1start) bySourcePrior[r.source] = (bySourcePrior[r.source]||0)+1; });
    Object.entries(bySourcePrior).forEach(([src, prior]) => { const recent = bySourceRecent[src] || 0; if (prior >= 10 && recent <= prior * 0.6) out.push({ level: "medium", title: `Source en baisse — ${src}`, detail: `${recent} leads sur les 2 dernières semaines contre ${prior} avant (baisse de ${Math.round((1-recent/prior)*100)}%).` }); });
    const staleCutoff = new Date(maxDate.getTime() - 10 * 24 * 3600 * 1000);
    const stale = recs.filter(r => r.statut === "piste" && new Date(r.created) < staleCutoff);
    if (stale.length > 0) out.push({ level: "high", title: "Leads sans relance depuis plus de 10 jours", detail: `${stale.length} leads encore au statut "piste", jamais transmis à un agent.` });
    const refusRate = recs.filter(r => r.statut === "refus").length / recs.length;
    if (refusRate > 0.22) out.push({ level: "medium", title: "Taux de refus élevé sur la période", detail: `${Math.round(refusRate*100)}% des leads analysés sont en refus.` });
    const order = { high: 0, medium: 1, good: 2 };
    return out.sort((a,b) => order[a.level] - order[b.level]);
  }, [combinedRecords, currentMaxDate]);

  if (loading && combinedRecords.length === 0) {
    return (
      <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: PAPER, color: INK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5 }}>
        Chargement des leads depuis Airtable…
      </div>
    );
  }

  if (loadError && combinedRecords.length === 0) {
    return (
      <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: PAPER, color: INK, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13.5 }}>
        <div style={{ color: RED, fontWeight: 600 }}>Impossible de charger les données Airtable</div>
        <div style={{ color: SLATE, maxWidth: 420, textAlign: "center" }}>{loadError}</div>
        <button onClick={loadLeads} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: PANEL, color: INK }}>Réessayer</button>
      </div>
    );
  }

    return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: PAPER, color: INK, minHeight: "100vh", fontSize: 13.5 }}>
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, background: PANEL }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Georgia, serif", letterSpacing: "-0.01em" }}>CRM Vendeurs · 100% Immo</div>
          <div style={{ fontSize: 12, color: SLATE, marginTop: 2 }}>
            Données live Airtable · {new Date(minDateStr).toLocaleDateString("fr-FR")} → {currentMaxDate.toLocaleDateString("fr-FR")} · {fmt(combinedRecords.length)} leads analysés
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <button onClick={loadLeads} disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: `1px solid ${LINE}`, borderRadius: 8,
                padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: loading ? "default" : "pointer",
                background: loading ? PAPER : PANEL, color: loading ? SLATE : INK,
              }}>
              <span style={{ display: "inline-block", transform: loading ? "rotate(360deg)" : "none", transition: loading ? "transform 0.8s linear infinite" : "none" }}>⟳</span>
              {loading ? "Actualisation…" : "Actualiser"}
            </button>
            {loadError && (
              <div style={{ fontSize: 11, maxWidth: 260, textAlign: "right", color: RED }}>{loadError}</div>
            )}
            {lastRefreshAt && !loadError && (
              <div style={{ fontSize: 10.5, color: SLATE }}>Actualisé à {lastRefreshAt.toLocaleTimeString("fr-FR")}</div>
            )}
          </div>
          <div style={{ display: "flex", background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setView("manager")} style={{ border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: view === "manager" ? TEAL : "transparent", color: view === "manager" ? "#fff" : SLATE }}>Vue Manager</button>
            <button onClick={() => setView("agent")} style={{ border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: view === "agent" ? TEAL : "transparent", color: view === "agent" ? "#fff" : SLATE }}>Vue Agent</button>
            <button onClick={() => setView("properties")} style={{ border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: view === "properties" ? TEAL : "transparent", color: view === "properties" ? "#fff" : SLATE }}>Mandats & Ventes</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px 40px", maxWidth: 1360, margin: "0 auto" }}>
        {view !== "properties" && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 3 }}>
                {TIME_PRESETS.map(tp => (
                  <button key={tp.value} onClick={() => setTimeFilter(tp.value)}
                    style={{ border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                      background: timeFilter === tp.value ? INK : "transparent", color: timeFilter === tp.value ? "#fff" : SLATE }}>
                    {tp.label}
                  </button>
                ))}
              </div>
              {timeFilter === "custom" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
                  <input type="date" value={customStart} min={minDateStr} max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: PANEL, color: INK, fontFamily: "inherit" }} />
                  <span style={{ fontSize: 12, color: SLATE }}>→</span>
                  <input type="date" value={customEnd} min={customStart} max={currentMaxDateStr}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: PANEL, color: INK, fontFamily: "inherit" }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
              <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
              <Select value={agenceFilter} onChange={setAgenceFilter} options={agenceOptions} style={{ maxWidth: 260 }} />
              {view === "agent" && <Select value={selectedAgent} onChange={setSelectedAgent} options={commercials.map((c) => ({ value: c, label: c }))} />}
              <input placeholder="Rechercher un statut…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 10px", fontSize: 12.5, background: PANEL, color: INK, width: 200 }} />
              <div style={{ fontSize: 11, color: SLATE, marginLeft: "auto" }}>
                Filtres temporels calculés depuis la date la plus récente des données ({currentMaxDate.toLocaleDateString("fr-FR")})
              </div>
            </div>
          </>
        )}

        {view === "properties" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
            <Select value={propAgenceFilter} onChange={setPropAgenceFilter} options={propAgenceOptions} style={{ maxWidth: 300 }} />
            <button onClick={loadProperties} disabled={propertiesLoading}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: `1px solid ${LINE}`, borderRadius: 8,
                padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: propertiesLoading ? "default" : "pointer",
                background: propertiesLoading ? PAPER : PANEL, color: propertiesLoading ? SLATE : INK,
              }}>
              <span style={{ display: "inline-block", transform: propertiesLoading ? "rotate(360deg)" : "none", transition: propertiesLoading ? "transform 0.8s linear infinite" : "none" }}>⟳</span>
              {propertiesLoading ? "Actualisation…" : "Actualiser"}
            </button>
            {propertiesError && <div style={{ fontSize: 11, color: RED }}>{propertiesError}</div>}
            {propertiesCappedAt && (
              <div style={{ fontSize: 11, color: SLATE }}>
                ⚠ L'API MyProprio plafonne à {propertiesCappedAt} biens — il pourrait y en avoir davantage non affichés ici.
              </div>
            )}
            <div style={{ fontSize: 11, color: SLATE, marginLeft: "auto" }}>
              Étapes déduites des dates de progression (pas de code status fourni)
            </div>
          </div>
        )}

        {view === "manager" ? (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
              <Card label="Leads (filtrés)" value={fmt(total)} sub={`sur ${fmt(combinedRecords.length)} au total`} />
              <Card label="Taux de refus" value={pct(refusCount, total)} sub={`${fmt(refusCount)} refus`} accent={RED} />
              <Card label="Contact réussi" value={pct(contactReussi, total)} sub={`${fmt(contactReussi)} leads recontactés`} accent={TEAL} />
              <Card label="Envoyés à un agent" value={pct(envoyesCount, total)} sub={`${fmt(envoyesCount)} leads transmis`} accent={GOLD} />
              <Card label="Commerciaux actifs" value={commercials.length} sub="dont Dalila en tête de volume" />
            </div>

            <Panel title="Alertes intelligentes" subtitle="Détectées automatiquement sur l'ensemble de la base (indépendant des filtres ci-dessus)">
              {alerts.length === 0 ? (
                <div style={{ fontSize: 12.5, color: SLATE, padding: "6px 2px" }}>Aucune alerte notable sur la période analysée.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                  {alerts.map((a, i) => <AlertRow key={i} {...a} />)}
                </div>
              )}
            </Panel>

            <div style={{ height: 14 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
              <Panel title="Évolution hebdomadaire des leads" subtitle="Nombre de leads créés par semaine">
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="fillTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TEAL} stopOpacity={0.35} /><stop offset="95%" stopColor={TEAL} stopOpacity={0.02} />
                    </linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: SLATE }} axisLine={{ stroke: LINE }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Area type="monotone" dataKey="value" name="Leads" stroke={TEAL} strokeWidth={2} fill="url(#fillTeal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Pipeline commercial" subtitle="Leads actifs à chaque étape (hors refus)">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="stage" width={130} tick={{ fontSize: 10.5, fill: INK }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Panel title="Carte des leads par département" subtitle={`${deptFiltered.length} départements représentés (filtres appliqués) · taille = volume`}>
                <svg viewBox={`-10 -10 ${MAP_W+20} ${MAP_H+20}`} width="100%" height={340} style={{ overflow: "visible" }}>
                  <path d={FRANCE_PATH} fill="#EFEAE0" stroke={LINE} strokeWidth={1.5} />
                  {deptFiltered.map((d) => {
                    const [x, y] = proj(d.lon, d.lat);
                    const r = 3 + Math.sqrt(d.leads / maxDeptLeads) * 16;
                    const refusRate = d.leads ? d.refus / d.leads : 0;
                    const color = refusRate > 0.3 ? CLAY : TEAL;
                    return (
                      <g key={d.code} onMouseEnter={() => setHoveredDept(d)} onMouseLeave={() => setHoveredDept(null)} style={{ cursor: "pointer" }}>
                        <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.55} stroke={color} strokeWidth={1.2} />
                      </g>
                    );
                  })}
                </svg>
                <div style={{ minHeight: 40, fontSize: 12, color: SLATE, borderTop: `1px solid ${LINE}`, paddingTop: 8, marginTop: 4 }}>
                  {hoveredDept ? (
                    <span><strong style={{ color: INK }}>{hoveredDept.name} ({hoveredDept.code})</strong> — {fmt(hoveredDept.leads)} leads, {fmt(hoveredDept.reussi)} contacts réussis, {pct(hoveredDept.refus, hoveredDept.leads)} de refus</span>
                  ) : "Survolez un point pour le détail du département."}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10.5, color: SLATE }}>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: TEAL, marginRight: 4 }} />Taux de refus &lt; 30%</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: CLAY, marginRight: 4 }} />Taux de refus ≥ 30%</span>
                </div>
              </Panel>

              <Panel title="Heatmap jour × heure" subtitle="Quand les leads arrivent (filtres appliqués)">
                <div style={{ overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `34px repeat(24, 1fr)`, gap: 2, minWidth: 560 }}>
                    <div />
                    {Array.from({ length: 24 }).map((_, h) => (<div key={h} style={{ fontSize: 8.5, color: SLATE, textAlign: "center" }}>{h % 3 === 0 ? h : ""}</div>))}
                    {heatGrid.map((row, dayIdx) => (
                      <React.Fragment key={dayIdx}>
                        <div style={{ fontSize: 10.5, color: SLATE, display: "flex", alignItems: "center" }}>{DAY_LABELS[dayIdx]}</div>
                        {row.map((val, h) => {
                          const intensity = heatMax ? val / heatMax : 0;
                          return (<div key={h} title={`${DAY_LABELS[dayIdx]} ${h}h : ${val} leads`}
                            style={{ aspectRatio: "1", borderRadius: 2, background: intensity === 0 ? "#F1EFE7" : `rgba(31,111,92,${0.12 + intensity * 0.88})` }} />);
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: SLATE, marginTop: 10 }}>Les pics se concentrent en semaine, en matinée et fin d'après-midi.</div>
              </Panel>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Panel title="Répartition par source" subtitle="Donnée exacte (champ Source du lead)">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {sourceData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>
                  {sourceData.map((s, i) => (<div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: SLATE }}><span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }} />{s.name}</div>))}
                </div>
              </Panel>

              <Panel title="Type de bien" subtitle="Maison vs appartement">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {typeData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>
                  {typeData.map((s, i) => (<div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: SLATE }}><span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }} />{s.name} ({s.value})</div>))}
                </div>
              </Panel>

              <Panel title="Top 8 statuts" subtitle="Répartition détaillée du pipeline">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={statutData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={0} tick={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11.5, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>{statutData.slice(0, 8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <Panel title="Performance par commercial" subtitle="Volume, refus et contacts réussis (filtres appliqués)">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", color: SLATE }}>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Commercial</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Leads</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Contacts réussis</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Taux de réussite</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Refus</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Taux de refus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commercialData.map((c) => (
                      <tr key={c.name} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: "9px 10px", fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(c.leads)}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(c.reussi)}</td>
                        <td style={{ padding: "9px 10px", color: TEAL, fontWeight: 600 }}>{pct(c.reussi, c.leads)}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(c.refus)}</td>
                        <td style={{ padding: "9px 10px", color: RED, fontWeight: 600 }}>{pct(c.refus, c.leads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div style={{ height: 14 }} />

            <Panel title="Performance par agent affilié au secteur" subtitle={`${agenceData.length} agences · cliquez sur une colonne pour trier`}>
              <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", position: "sticky", top: 0, background: PANEL }}>
                      <SortableTh label="Agent affilié" sortKey="name" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Leads reçus" sortKey="leads" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Envoyés / traités" sortKey="envoyes" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Contacts réussis" sortKey="reussi" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Taux de réussite" sortKey="reussiRate" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Refus" sortKey="refus" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                      <SortableTh label="Taux de refus" sortKey="refusRate" activeKey={agenceSortKey} dir={agenceSortDir} onSort={toggleAgenceSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {agenceData.map((a) => (
                      <tr key={a.name}
                        onClick={() => { setAgenceFilter(a.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        style={{
                          borderBottom: `1px solid ${LINE}`, cursor: "pointer",
                          background: agenceFilter === a.name ? TEAL_SOFT : "transparent",
                        }}
                        onMouseEnter={(e) => { if (agenceFilter !== a.name) e.currentTarget.style.background = PAPER; }}
                        onMouseLeave={(e) => { if (agenceFilter !== a.name) e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "9px 10px", fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(a.leads)}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(a.envoyes)}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(a.reussi)}</td>
                        <td style={{ padding: "9px 10px", color: TEAL, fontWeight: 600 }}>{pct(a.reussi, a.leads)}</td>
                        <td style={{ padding: "9px 10px" }}>{fmt(a.refus)}</td>
                        <td style={{ padding: "9px 10px", color: RED, fontWeight: 600 }}>{pct(a.refus, a.leads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {agenceFilter !== "all" && (
              <Panel title={`Leads de ${agenceFilter}`} subtitle={`${fmt(total)} leads filtrés`}
                right={<button onClick={() => setAgenceFilter("all")}
                  style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", background: PAPER, color: SLATE }}>
                  ✕ Effacer le filtre
                </button>}>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", color: SLATE, position: "sticky", top: 0, background: PANEL }}>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Date</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Type</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Commercial</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice().reverse().slice(0, 150).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                          <td style={{ padding: "8px 10px" }}>{new Date(r.created).toLocaleDateString("fr-FR")}</td>
                          <td style={{ padding: "8px 10px" }}>{r.type}</td>
                          <td style={{ padding: "8px 10px" }}>{r.commercial}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: r.statut === "refus" ? "#FBE7E2" : (r.statut || "").includes("réussi") ? TEAL_SOFT : "#F1EFE7",
                              color: r.statut === "refus" ? RED : (r.statut || "").includes("réussi") ? TEAL : SLATE }}>
                              {STATUT_LABELS[r.statut] || r.statut || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </>
        ) : view === "agent" ? (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
              <Card label="Mes leads" value={fmt(agentPerf.leads)} sub={selectedAgent} />
              <Card label="Contacts réussis" value={fmt(agentPerf.contact_reussi)} sub={pct(agentPerf.contact_reussi, agentPerf.leads) + " de mes leads"} accent={TEAL} />
              <Card label="Refus" value={fmt(agentPerf.refus)} sub={pct(agentPerf.refus, agentPerf.leads) + " de mes leads"} accent={RED} />
              <Card label="Envoyés" value={fmt(agentPerf.envoyes)} sub="transmis pour traitement" accent={GOLD} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
              <Panel title={`Évolution des leads de ${selectedAgent}`} subtitle="Par semaine">
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: SLATE }} axisLine={{ stroke: LINE }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Line type="monotone" dataKey="value" name="Leads" stroke={TEAL} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Mon pipeline" subtitle="Étapes atteintes (hors refus)">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="stage" width={130} tick={{ fontSize: 10.5, fill: INK }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Bar dataKey="count" fill={CLAY} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <Panel title="Mes leads récents" subtitle={`${fmt(total)} leads filtrés`}>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", color: SLATE, position: "sticky", top: 0, background: PANEL }}>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Date</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice().reverse().slice(0, 150).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: "8px 10px" }}>{new Date(r.created).toLocaleDateString("fr-FR")}</td>
                        <td style={{ padding: "8px 10px" }}>{r.type}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: r.statut === "refus" ? "#FBE7E2" : (r.statut || "").includes("réussi") ? TEAL_SOFT : "#F1EFE7",
                            color: r.statut === "refus" ? RED : (r.statut || "").includes("réussi") ? TEAL : SLATE }}>
                            {STATUT_LABELS[r.statut] || r.statut || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        ) : propertiesLoading && properties.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: SLATE }}>Chargement des biens depuis MyProprio…</div>
        ) : propertiesError && properties.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ color: RED, fontWeight: 600, marginBottom: 8 }}>Impossible de charger les biens MyProprio</div>
            <div style={{ color: SLATE, marginBottom: 12 }}>{propertiesError}</div>
            <button onClick={loadProperties} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: PANEL, color: INK }}>Réessayer</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
              <Card label="Mandats actifs" value={fmt(propStageCounts.mandat)} sub={`sur ${fmt(filteredProperties.length)} biens`} />
              <Card label="Compromis signés" value={fmt(propStageCounts.compromis)} sub={pct(propStageCounts.compromis, filteredProperties.length) + " des biens"} accent={GOLD} />
              <Card label="Ventes actées" value={fmt(propStageCounts.vente)} sub={pct(propStageCounts.vente, filteredProperties.length) + " des biens"} accent={TEAL} />
              <Card label="Taux de transformation" value={pct(propStageCounts.vente, filteredProperties.length)} sub="mandat → vente actée" accent={TEAL} />
              <Card label="Volume vendu" value={fmtEUR(propVenteVolume)} sub={`sur ${fmt(propStageCounts.vente)} ventes actées`} accent={CLAY} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 14 }}>
              <Panel title="Répartition par étape" subtitle="Mandat actif → compromis signé → vente actée">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[
                    { stage: "Mandat actif", count: propStageCounts.mandat },
                    { stage: "Compromis signé", count: propStageCounts.compromis },
                    { stage: "Vente actée", count: propStageCounts.vente },
                  ]} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="stage" width={130} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}` }} />
                    <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Panel title="Performance par agence" subtitle={`${propAgenceData.length} agences · cliquez sur une ligne pour filtrer`}>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", color: SLATE, position: "sticky", top: 0, background: PANEL }}>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Agence</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Total biens</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Mandat actif</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Compromis</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Ventes</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Taux de transformation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propAgenceData.map((a) => (
                        <tr key={a.name}
                          onClick={() => { setPropAgenceFilter(a.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          style={{
                            borderBottom: `1px solid ${LINE}`, cursor: "pointer",
                            background: propAgenceFilter === a.name ? TEAL_SOFT : "transparent",
                          }}
                          onMouseEnter={(e) => { if (propAgenceFilter !== a.name) e.currentTarget.style.background = PAPER; }}
                          onMouseLeave={(e) => { if (propAgenceFilter !== a.name) e.currentTarget.style.background = "transparent"; }}>
                          <td style={{ padding: "9px 10px", fontWeight: 600 }}>{a.name}</td>
                          <td style={{ padding: "9px 10px" }}>{fmt(a.total)}</td>
                          <td style={{ padding: "9px 10px" }}>{fmt(a.mandat)}</td>
                          <td style={{ padding: "9px 10px" }}>{fmt(a.compromis)}</td>
                          <td style={{ padding: "9px 10px" }}>{fmt(a.vente)}</td>
                          <td style={{ padding: "9px 10px", color: TEAL, fontWeight: 600 }}>{pct(a.vente, a.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <Panel title={propAgenceFilter === "all" ? "Tous les biens" : `Biens de ${propAgenceFilter}`}
              subtitle={`${fmt(filteredProperties.length)} biens filtrés`}
              right={propAgenceFilter !== "all" && (
                <button onClick={() => setPropAgenceFilter("all")}
                  style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", background: PAPER, color: SLATE }}>
                  ✕ Effacer le filtre
                </button>
              )}>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", color: SLATE, position: "sticky", top: 0, background: PANEL }}>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Ville</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Agence</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Agent</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Prix</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Étape</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.slice(0, 200).map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: "8px 10px" }}>{p.city || "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{p.agence}</td>
                        <td style={{ padding: "8px 10px" }}>{p.agent || "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{fmtEUR(p.priceFinal || p.price)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: p.stage === "vente" ? TEAL_SOFT : p.stage === "compromis" ? AMBER_SOFT : "#F1EFE7",
                            color: p.stage === "vente" ? TEAL : p.stage === "compromis" ? AMBER : SLATE }}>
                            {PROPERTY_STAGE_LABELS[p.stage]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: SLATE, textAlign: "center" }}>
          {fmt(combinedRecords.length)} leads couvrant l'intégralité de la période disponible dans la base, actualisés en direct depuis Airtable.
        </div>
      </div>
    </div>
  );
}
