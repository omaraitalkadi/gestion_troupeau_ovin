import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Layers, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Search, Filter,
  X, MoreVertical, RefreshCw, Loader2, ServerCrash,ClipboardList
} from "lucide-react";
import "./LotAnimals.css";
import NouveauPlanAlimentaireModal from "./NouveauPlanAlimentaireModal";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";
const PAGE_SIZE = 25;

// ── helpers ──────────────────────────────────────────────────
function ageLabel(dateStr) {
  if (!dateStr) return "—";
  const months = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (30.44 * 864e5)
  );
  if (months < 0)  return "—";
  if (months < 24) return `${months} mois`;
  return `${Math.floor(months / 12)} ans`;
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

function useDebounce(value, delay = 350) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ── filter chip options ────────────────────────────────────
const SEXE_OPTIONS   = ["Tous", "MALE", "FEMELLE"];
const ETAT_OPTIONS   = ["Tous", "ACTIF", "GESTATION", "ALLAITEMENT", "AGNEAU", "VENDU", "DECEDE"];
const CC_OPTIONS     = ["Tous", "MAIGRE", "NORMALE", "GRASSE"];

// ════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function LotAnimals() {
  const { id }   = useParams();
  const navigate = useNavigate();

  // ── data ─────────────────────────────────────────────────
  const [lot,     setLot]     = useState(null);
  const [animals, setAnimals] = useState([]);
  const [count,   setCount]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── filters ───────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [filterSexe,   setFilterSexe]   = useState("Tous");
  const [filterRace,   setFilterRace]   = useState("Toutes");
  const [filterEtat,   setFilterEtat]   = useState("Tous");
  const [filterCC,     setFilterCC]     = useState("Tous");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── sort ──────────────────────────────────────────────────
  const [sortBy,  setSortBy]  = useState("numero_rfid");
  const [sortDir, setSortDir] = useState("asc");

  // ── selection ─────────────────────────────────────────────
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selected, setSelected] = useState(new Set());

  // ── dynamic race options (built from loaded data) ─────────
  const [optRaces, setOptRaces] = useState([]);

  const debouncedSearch = useDebounce(search);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterSexe, filterRace, filterEtat, filterCC]);

  // ── fetch lot header ──────────────────────────────────────
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/lots/${id}`)
      .then(r => r.json())
      .then(d => { if (alive) setLot(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);

  // ── fetch animals ─────────────────────────────────────────
  const fetchAnimals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE, orderBy: "numero_rfid" });
      if (debouncedSearch)              params.set("search", debouncedSearch);
      if (filterSexe  !== "Tous")       params.set("sexe",  filterSexe);
      if (filterRace  !== "Toutes")     params.set("race",  filterRace);
      if (filterEtat  !== "Tous")       params.set("etat",  filterEtat);
      if (filterCC    !== "Tous")       params.set("condition_corporelle", filterCC);

      const res  = await fetch(`${API_BASE}/api/lots/${id}/animals?${params}`);
      const ct   = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Le serveur n'a pas renvoyé du JSON (${res.status}).`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);

      const json = await res.json();
      const data = json.data ?? [];
      setAnimals(data);
      setCount(json.count ?? 0);

      // accumulate race options
      const races = new Set(data.map(a => a.race).filter(Boolean));
      setOptRaces(prev => {
        const merged = new Set([...prev, ...races]);
        return [...merged].sort();
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, page, debouncedSearch, filterSexe, filterRace, filterEtat, filterCC]);

  useEffect(() => { fetchAnimals(); }, [fetchAnimals]);

  // ── sort (client-side on loaded page) ────────────────────
  const sorted = useMemo(() => {
    return [...animals].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = typeof av === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [animals, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  // ── selection ─────────────────────────────────────────────
  const toggleSelect    = id => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map(a => a.id)));

  const resetFilters = useCallback(() => {
    setSearch(""); setFilterSexe("Tous"); setFilterRace("Toutes");
    setFilterEtat("Tous"); setFilterCC("Tous");
  }, []);

  const totalPages    = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeFilters = [filterSexe !== "Tous", filterRace !== "Toutes", filterEtat !== "Tous", filterCC !== "Tous"].filter(Boolean).length;
  const raceOptions   = ["Toutes", ...optRaces];

  // ═══════════════════════════════════════════════════════
  return (
    <div className="troupeau-page">

      {/* ── Topbar ─────────────────────────── */}
     <div className="detail-topbar">
  <button className="btn-ghost" onClick={() => navigate(-1)}>
    <ArrowLeft size={16} /> Retour
  </button>
  <button className="btn-primary" onClick={() => setShowPlanModal(true)}>
    <ClipboardList size={16} /> Ajouter plan alimentaire
  </button>
</div>

      {/* ── Hero lot ───────────────────────── */}
      <div className="animal-hero">
        <div className="animal-avatar">
          <Layers size={28} strokeWidth={1.5} />
        </div>
        <div className="animal-identity">
          <div className="eyebrow">Lot</div>
          <h1 className="page-title" style={{ margin: "4px 0 8px" }}>
            {lot?.nom ?? "…"}
          </h1>
          <div className="animal-meta">
            {lot?.type && <span className="badge badge-info">{lot.type}</span>}
            {lot?.code && <span className="badge badge-muted" style={{ fontFamily: "monospace" }}>{lot.code}</span>}
            {lot?.localisation && <span className="muted">{lot.localisation}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {lot?.animal_count ?? count}
            </div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>animaux</div>
          </div>
          {typeof lot?.capacite_max === "number" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>{lot.capacite_max}</div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>capacité</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Recherche ───────────────────────── */}
      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Rechercher par RFID, numéro légal, race…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className={`btn-secondary ${showAdvanced ? "is-active" : ""}`}
          onClick={() => setShowAdvanced(s => !s)}
        >
          <Filter size={16} />
          Filtres
          {activeFilters > 0 && (
            <span className="nav-badge" style={{ marginLeft: 4 }}>{activeFilters}</span>
          )}
        </button>
        <button className="btn-secondary" onClick={fetchAnimals} disabled={loading} title="Rafraîchir">
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      {/* ── Filtres chips ────────────────────── */}
      <div className="filter-groups">
        <FilterChips label="Sexe"      options={SEXE_OPTIONS} value={filterSexe} onChange={setFilterSexe} />
        <FilterChips label="État"      options={ETAT_OPTIONS} value={filterEtat} onChange={setFilterEtat} />
        <FilterChips label="Condition" options={CC_OPTIONS}   value={filterCC}   onChange={setFilterCC}   />
        <FilterChips label="Race"      options={raceOptions}  value={filterRace} onChange={setFilterRace} />
      </div>

      {/* ── Filtres avancés ─────────────────── */}
      {showAdvanced && (
        <div className="advanced-filters">
          <div className="adv-field">
            <label>Poids min (kg)</label>
            <input type="number" min="0" placeholder="0" />
          </div>
          <div className="adv-field">
            <label>Poids max (kg)</label>
            <input type="number" min="0" placeholder="200" />
          </div>
          <div className="adv-field">
            <label>Né après le</label>
            <input type="date" />
          </div>
          <div className="adv-field">
            <label>Né avant le</label>
            <input type="date" />
          </div>
        </div>
      )}

      {/* ── Actions groupées ────────────────── */}
      {selected.size > 0 && (
        <div className="bulk-actions">
          <span>{selected.size} animal{selected.size > 1 ? "aux" : ""} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <div className="bulk-buttons">
            <button>Changer de lot</button>
            <button>Programmer traitement</button>
            <button>Exporter</button>
          </div>
        </div>
      )}

      {/* ── Loading ──────────────────────────── */}
      {loading && (
        <div className="table-state">
          <Loader2 size={28} className="spin" />
          <p>Chargement des animaux…</p>
        </div>
      )}

      {/* ── Erreur ───────────────────────────── */}
      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} />
          <p>{error}</p>
          <button className="btn-secondary" onClick={fetchAnimals}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      )}

      {/* ── Tableau ─────────────────────────── */}
      {!loading && !error && (
        <div className="table-wrap">
          {/* sous-titre */}
          <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Animaux du lot</span>
            <span className="badge badge-muted">{count}</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <SortableTh col="numero_rfid"          label="N° RFID"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="numero_legal"         label="N° Légal"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="race"                 label="Race"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th>Sexe</th>
                <SortableTh col="date_naissance"       label="Âge"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="poids"                label="Poids"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="etat"                 label="État"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="condition_corporelle" label="Condition"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => (
                <tr
                  key={a.id}
                  className={selected.has(a.id) ? "is-selected" : ""}
                  onClick={() => navigate(`/troupeau/${a.id}`)}
                >
                  <td className="col-check" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                    />
                  </td>
                  <td className="rfid-cell">{a.numero_rfid ?? "—"}</td>
                  <td className="muted">{a.numero_legal ?? "—"}</td>
                  <td>{a.race ?? "—"}</td>
                  <td>
                    {a.sexe
                      ? <span className={`sex-badge sex-${a.sexe}`}>
                          {a.sexe === "FEMELLE" ? "♀" : "♂"}
                        </span>
                      : "—"
                    }
                  </td>
                  <td>
                    <span>{fmtDate(a.date_naissance)}</span>
                    {a.date_naissance && (
                      <span className="muted" style={{ fontSize: 11, marginLeft: 5 }}>
                        {ageLabel(a.date_naissance)}
                      </span>
                    )}
                  </td>
                  <td>{a.poids != null ? `${a.poids} kg` : <span className="muted">—</span>}</td>
                  <td><EtatBadge etat={a.etat} /></td>
                  <td><CCBadge cc={a.condition_corporelle} /></td>
                  <td className="col-actions" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn-small">
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* empty state */}
          {sorted.length === 0 && (
            <div className="empty-state">
              <p>
                {activeFilters > 0 || search
                  ? "Aucun animal ne correspond à vos critères."
                  : "Ce lot ne contient aucun animal."}
              </p>
              {(activeFilters > 0 || search) && (
                <button className="link" onClick={resetFilters}>
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}

          {/* pagination */}
          {count > PAGE_SIZE && (
            <div className="la-pagination">
              <button
                className="btn-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Précédent
              </button>

              <div className="la-page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const n = start + i;
                  if (n < 1 || n > totalPages) return null;
                  return (
                    <button
                      key={n}
                      className={`la-page-num ${n === page ? "is-active" : ""}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <button
                className="btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      {showPlanModal && (
  <NouveauPlanAlimentaireModal
    onClose={() => setShowPlanModal(false)}
    onCreated={(plan) => navigate(`/alimentation/plans/${plan.id}?lot=${id}`)}
    lot_id={id}
  />
)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS
// ════════════════════════════════════════════════════════════

function FilterChips({ label, options, value, onChange }) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="chips">
        {options.map(opt => (
          <button
            key={opt}
            className={`chip ${value === opt ? "is-active" : ""}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortableTh({ col, label, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th onClick={() => onSort(col)} className="sortable">
      <span>{label}</span>
      {active && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </th>
  );
}

function EtatBadge({ etat }) {
  const map = {
    ACTIF:       { label: "Actif",       cls: "badge-success" },
    GESTATION:   { label: "Gestation",   cls: "badge-info"    },
    ALLAITEMENT: { label: "Allaitement", cls: "badge-info"    },
    AGNEAU:      { label: "Agneau",      cls: "badge-warning" },
    VENDU:       { label: "Vendu",       cls: "badge-muted"   },
    DECEDE:      { label: "Décédé",      cls: "badge-danger"  },
    ARCHIVE:     { label: "Archivé",     cls: "badge-muted"   },
  };
  const cfg = map[etat] ?? { label: etat ?? "—", cls: "badge-muted" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

function CCBadge({ cc }) {
  if (!cc) return <span className="muted">—</span>;
  const map = {
    MAIGRE:  { label: "Maigre",  cls: "badge-danger"  },
    NORMALE: { label: "Normale", cls: "badge-success"  },
    GRASSE:  { label: "Grasse",  cls: "badge-warning"  },
  };
  const cfg = map[cc] ?? { label: cc, cls: "badge-muted" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}