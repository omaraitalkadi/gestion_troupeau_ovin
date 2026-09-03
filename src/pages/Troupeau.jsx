import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Search, Plus, ScanLine, Download, Filter,
  ChevronDown, ChevronUp, MoreVertical,
  X, RefreshCw, Loader2, ServerCrash, RotateCcw,Wheat,
  FlaskConical, Minus,
} from "lucide-react";
import NouvelAlimentModal from "./NouvelAlimentModal";
import './test-bar.css'

const API_BASE = document.location.origin || "http://localhost";

// ─── Colonnes DB (snake_case) ────────────────────────────────
// id, numero_rfid, numero_legal, sexe, date_naissance,
// date_arrivee, date_sortie, race, poids, etat,
// condition_corporelle, lot_id, lot { id, nom }
// ────────────────────────────────────────────────────────────

// La recherche texte reste côté serveur ; les filtres "chips" sont
// appliqués côté client → multi-sélection instantanée, sans aller-retour réseau.
function useAnimaux(search) {
  const [animaux, setAnimaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAnimaux = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "1000");

      const res = await fetch(`/api/animals?${params.toString()}`);

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Le serveur n'a pas renvoyé du JSON (status ${res.status}). Vérifiez que Express tourne sur ${API_BASE}.`);
      }
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Erreur ${res.status}`);
      }

      const json = await res.json();
      setAnimaux(json.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchAnimaux(); }, [fetchAnimaux]);

  return { animaux, loading, error, refetch: fetchAnimaux };
}

// ─── Options de filtres ──────────────────────────────────────
const ETATS      = ["SAIN", "MALADE", "SOUS_TRAITEMENT", "ISOLE"];
const RACES      = ["Mérinos", "Timahdite", "Boujaad", "Sardi","D'man"];
const SEXES      = ["FEMELLE", "MALE"];
const CONDITIONS = ["MAIGRE", "NORMALE", "GRASSE"];

// Libellés lisibles
const ETAT_LABEL = { SAIN: "Sain", MALADE: "Malade", SOUS_TRAITEMENT: "Sous traitement", ISOLE: "Isolé" };
const SEXE_LABEL = { FEMELLE: "Femelles ♀", MALE: "Mâles ♂" };
const CC_LABEL   = { MAIGRE: "Maigre", NORMALE: "Normale", GRASSE: "Grasse" };

// ─── Barre de test (DEV UNIQUEMENT) ──────────────────────────
// Décale les dates de tous les animaux de la ferme pour simuler le passage
// du temps et tester les programmes de vaccination / scanners par âge.
function BarreTestTemps({ onDone }) {
  const [jours, setJours] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const appliquer = async (signe) => {
    const n = Math.abs(Number(jours)) * signe;
    if (!Number.isFinite(n) || n === 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/test/decaler-temps`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jours: n }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      const { modifies } = json.data;
      setMsg(`${modifies} animal(aux) ${n > 0 ? "vieillis" : "rajeunis"} de ${Math.abs(n)} j.`);
      onDone?.();
    } catch (e) {
      setMsg(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="test-bar">
      <span className="test-bar-tag"><FlaskConical size={14} /> Test</span>
      <span className="test-bar-label">Décaler l'âge de tout le troupeau de</span>
      <input
        type="number" min="1" className="test-bar-input"
        value={jours} onChange={(e) => setJours(e.target.value)}
      />
      <span className="test-bar-unit">jours</span>
      <button className="btn-secondary btn-small" disabled={busy} onClick={() => appliquer(+1)} title="Vieillir">
        {busy ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Vieillir
      </button>
      <button className="btn-secondary btn-small" disabled={busy} onClick={() => appliquer(-1)} title="Rajeunir">
        {busy ? <Loader2 size={13} className="spin" /> : <Minus size={13} />} Rajeunir
      </button>
      {msg && <span className="test-bar-msg">{msg}</span>}
    </div>
  );
}

export default function Troupeau() {
  const navigate = useNavigate();
  const [showAlimentModal, setShowAlimentModal] = useState(false);
  const [search,       setSearch]       = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy,       setSortBy]       = useState("numero_rfid");
  const [sortDir,      setSortDir]      = useState("asc");
  const [selected,     setSelected]     = useState(new Set());

  // Filtres multi-sélection (cumulables avec Ctrl/⌘)
  const [etat, setEtat] = useState(() => new Set());
  const [race, setRace] = useState(() => new Set());
  const [sexe, setSexe] = useState(() => new Set());
  const [cc,   setCc]   = useState(() => new Set());
  const [lot,  setLot]  = useState(() => new Set());

  // Filtres avancés
  const [poidsMin, setPoidsMin] = useState("");
  const [poidsMax, setPoidsMax] = useState("");
  const [neApres,  setNeApres]  = useState("");
  const [neAvant,  setNeAvant]  = useState("");

  // Debounce recherche
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { animaux, loading, error, refetch } = useAnimaux(debouncedSearch);

  // Lots disponibles, dérivés des données
  const lotOptions = useMemo(
    () => [...new Set(animaux.map(a => a.lot?.nom).filter(Boolean))].sort(),
    [animaux]
  );

  // Bascule une valeur. additive = true (Ctrl/⌘) → cumule ; sinon remplace.
  const makeToggle = (setFn) => (value, additive) =>
    setFn(prev => {
      const next = new Set(prev);
      if (additive) {
        next.has(value) ? next.delete(value) : next.add(value);
      } else if (next.size === 1 && next.has(value)) {
        next.clear();
      } else {
        next.clear();
        next.add(value);
      }
      return next;
    });

  const toggleEtat = makeToggle(setEtat);
  const toggleRace = makeToggle(setRace);
  const toggleSexe = makeToggle(setSexe);
  const toggleCc   = makeToggle(setCc);
  const toggleLot  = makeToggle(setLot);

  // ── Filtrage côté client ───────────────────────────────────
  const filtered = useMemo(() => {
    return animaux.filter(a => {
      if (etat.size && !etat.has(a.etat)) return false;
      if (race.size && !race.has(a.race)) return false;
      if (sexe.size && !sexe.has(a.sexe)) return false;
      if (cc.size   && !cc.has(a.condition_corporelle)) return false;
      if (lot.size  && !lot.has(a.lot?.nom)) return false;
      if (poidsMin !== "" && (a.poids == null || a.poids < Number(poidsMin))) return false;
      if (poidsMax !== "" && (a.poids == null || a.poids > Number(poidsMax))) return false;
      if (neApres && (!a.date_naissance || a.date_naissance < neApres)) return false;
      if (neAvant && (!a.date_naissance || a.date_naissance > neAvant)) return false;
      return true;
    });
  }, [animaux, etat, race, sexe, cc, lot, poidsMin, poidsMax, neApres, neAvant]);

  // Tri côté client
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      const cmp = typeof av === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortBy, sortDir]);

  const activeCount =
    etat.size + race.size + sexe.size + cc.size + lot.size +
    (poidsMin !== "" ? 1 : 0) + (poidsMax !== "" ? 1 : 0) +
    (neApres ? 1 : 0) + (neAvant ? 1 : 0);
  const hasFilters = activeCount > 0 || !!search;

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(
      selected.size === sorted.length
        ? new Set()
        : new Set(sorted.map(a => a.id))
    );
  };

  const resetFilters = () => {
    setSearch("");
    setEtat(new Set()); setRace(new Set()); setSexe(new Set());
    setCc(new Set());   setLot(new Set());
    setPoidsMin(""); setPoidsMax(""); setNeApres(""); setNeAvant("");
  };

  const calculerAge = (dateStr) => {
    if (!dateStr) return "—";
    const mois = Math.floor(
      (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 30.44)
    );
    if (mois < 1)  return "< 1 mois";
    if (mois < 12) return `${mois} mois`;
    const ans = Math.floor(mois / 12);
    const rem = mois % 12;
    return rem > 0 ? `${ans}a ${rem}m` : `${ans} ans`;
  };

  return (
    <div className="troupeau-page">

      {/* ── Barre de test (à retirer en production) ─────────── */}
      <BarreTestTemps onDone={refetch} />

      {/* ── En-tête ─────────────────────────── */}
      <header className="page-header">
        <div>
          <p className="eyebrow">U2 · U3 · Gestion du troupeau</p>
          <h1 className="page-title">Mon troupeau</h1>
          <p className="page-subtitle">
            {loading
              ? "Chargement…"
              : <><strong>{sorted.length}</strong> animal{sorted.length > 1 ? "aux" : ""} affiché{sorted.length > 1 ? "s" : ""}</>
            }
          </p>
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={refetch} disabled={loading} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>

          <button className="btn-secondary" onClick={() => setShowAlimentModal(true)}>
              <Wheat size={16} /> Ajouter aliment
          </button>
          <button className="btn-primary" onClick={() => navigate("/troupeau/nouveau")}>
            <Plus size={16} /> Nouvel animal
          </button>
        </div>
      </header>

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
          <Filter size={16} /> Filtres
          {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        </button>
      </div>

      {/* ── Filtres chips ────────────────────── */}
      <div className="filter-groups">
        <FilterChips label="État"      options={ETATS}      selected={etat} onToggle={toggleEtat} onClear={() => setEtat(new Set())} format={(o) => ETAT_LABEL[o] ?? o} />
        <FilterChips label="Race"      options={RACES}      selected={race} onToggle={toggleRace} onClear={() => setRace(new Set())} allLabel="Toutes" />
        <FilterChips label="Sexe"      options={SEXES}      selected={sexe} onToggle={toggleSexe} onClear={() => setSexe(new Set())} format={(o) => SEXE_LABEL[o] ?? o} />
        <FilterChips label="Condition" options={CONDITIONS} selected={cc}   onToggle={toggleCc}   onClear={() => setCc(new Set())}   format={(o) => CC_LABEL[o] ?? o} />
        {lotOptions.length > 0 && (
          <FilterChips label="Lot" options={lotOptions} selected={lot} onToggle={toggleLot} onClear={() => setLot(new Set())} allLabel="Tous" />
        )}

        <div className="filter-meta">
          <span className="filter-hint">
            Astuce : maintenez <kbd>Ctrl</kbd>/<kbd>⌘</kbd> et cliquez pour cumuler plusieurs valeurs.
          </span>
          {hasFilters && (
            <button type="button" className="filter-reset" onClick={resetFilters}>
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Filtres avancés ─────────────────── */}
      {showAdvanced && (
        <div className="advanced-filters">
          <div className="adv-field">
            <label>Poids min (kg)</label>
            <input type="number" min="0" placeholder="0" value={poidsMin} onChange={e => setPoidsMin(e.target.value)} />
          </div>
          <div className="adv-field">
            <label>Poids max (kg)</label>
            <input type="number" min="0" placeholder="200" value={poidsMax} onChange={e => setPoidsMax(e.target.value)} />
          </div>
          <div className="adv-field">
            <label>Né après le</label>
            <input type="date" value={neApres} onChange={e => setNeApres(e.target.value)} />
          </div>
          <div className="adv-field">
            <label>Né avant le</label>
            <input type="date" value={neAvant} onChange={e => setNeAvant(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Actions groupées ────────────────── */}
      {selected.size > 0 && (
        <div className="bulk-actions">
          <span>{selected.size} animal{selected.size > 1 ? "aux" : ""} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <div className="bulk-buttons">
            <button>Affecter à un lot</button>
            <button>Programmer traitement</button>
            <button>Exporter</button>
            <button className="danger">Archiver</button>
          </div>
        </div>
      )}

      {/* ── Loading ──────────────────────────── */}
      {loading && (
        <div className="table-state">
          <Loader2 size={28} className="spin" />
          <p>Chargement du troupeau…</p>
        </div>
      )}

      {/* ── Erreur ───────────────────────────── */}
      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} />
          <p>{error}</p>
          <button className="btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      )}

      {/* ── Tableau ─────────────────────────── */}
      {!loading && !error && (
        <div className="table-wrap">
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
                <th>Lot</th>
                <SortableTh col="etat"                 label="État"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh col="condition_corporelle" label="CC"           sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
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

                  {/* numero_rfid */}
                  <td className="rfid-cell">{a.numero_rfid ?? "—"}</td>

                  {/* numero_legal */}
                  <td className="muted">{a.numero_legal ?? "—"}</td>

                  {/* race */}
                  <td>{a.race ?? "—"}</td>

                  {/* sexe */}
                  <td>
                    {a.sexe
                      ? <span className={`sex-badge sex-${a.sexe}`}>
                          {a.sexe === "FEMELLE" ? "♀" : "♂"}
                        </span>
                      : "—"
                    }
                  </td>

                  {/* date_naissance → âge calculé */}
                  <td>{calculerAge(a.date_naissance)}</td>

                  {/* poids */}
                  <td>{a.poids != null ? `${a.poids} kg` : <span className="muted">—</span>}</td>

                  {/* lot.nom via la jointure */}
                  <td>{a.lot?.nom ?? <span className="muted">—</span>}</td>

                  {/* etat */}
                  <td><EtatBadge etat={a.etat} /></td>

                  {/* condition_corporelle */}
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

          {sorted.length === 0 && (
            <div className="empty-state">
              <p>Aucun animal ne correspond à vos critères.</p>
              <button className="link" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      )}
      {showAlimentModal && (
       <NouvelAlimentModal
        onClose={() => setShowAlimentModal(false)}
        onCreated={(aliment) => navigate(`/alimentation/aliments/${aliment.id}`)}
         />
       )}
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────

function FilterChips({ label, options, selected, onToggle, onClear, allLabel = "Tous", format = (x) => x }) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="chips">
        <button
          type="button"
          className={`chip ${selected.size === 0 ? "is-active" : ""}`}
          onClick={onClear}
        >
          {allLabel}
        </button>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            className={`chip ${selected.has(opt) ? "is-active" : ""}`}
            title="Ctrl/⌘ + clic pour cumuler les filtres"
            onClick={(e) => onToggle(opt, e.ctrlKey || e.metaKey)}
          >
            {format(opt)}
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
    MAIGRE: { label: "Maigre",  cls: "badge-danger"  },
    NORMALE: { label: "Normale", cls: "badge-success" },
    GRASSE:  { label: "Grasse",  cls: "badge-warning" },
  };
  const cfg = map[cc] ?? { label: cc, cls: "badge-muted" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}