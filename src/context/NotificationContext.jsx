import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

// Intervalle de poll. Baissé à 15s pour que l'apparition des toasts
// paraisse « instantanée » sans surcharger le serveur. Remonte-le si besoin.
const POLL_INTERVAL_MS = 15000;

// Durée d'affichage d'un toast avant auto-disparition (ms).
const TOAST_TTL_MS = 6000;
// Nombre max de toasts empilés simultanément (évite le spam si le cron
// insère 50 alertes d'un coup).
const MAX_TOASTS = 4;

const NotificationContext = createContext(null);

/**
 * Provider des notifications — UNIQUE point d'entrée réseau du module.
 * À monter une seule fois, au-dessus du routeur, sous le provider d'auth.
 *
 * @param {boolean} enabled  Interrupteur du poller. Passer `!!user` depuis
 *                           le contexte d'auth pour éviter les 401 avant login.
 */
export function NotificationProvider({ enabled = true, children }) {
  const [count, setCount] = useState(0);
  // null = jamais chargé (dropdown jamais ouvert) ; [] = chargé et vide
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  // File des toasts vivants (les plus récents en tête).
  const [toasts, setToasts] = useState([]);

  // count observé au moment du dernier fetch de liste → détection de staleness
  const lastFetchedCountRef = useRef(null);

  // count observé au poll précédent → détection d'une HAUSSE (= nouvelles alertes).
  // Mis à jour UNIQUEMENT dans fetchCount : les mutations optimistes locales
  // (marquerLue/toutMarquerLu) baissent le count mais ne doivent jamais
  // déclencher de toast ni fausser la ligne de base.
  const prevCountRef = useRef(null);

  // Ids déjà « toastés » → anti-doublon si le même item réapparaît dans un
  // fetch de liste ultérieur.
  const toastedIdsRef = useRef(new Set());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToasts = useCallback((nouvelles) => {
    if (!nouvelles || nouvelles.length === 0) return;
    setToasts((prev) => {
      // dédoublonne par id, garde les plus récentes, plafonne à MAX_TOASTS
      const fusion = [...nouvelles, ...prev];
      const vus = new Set();
      const uniques = [];
      for (const t of fusion) {
        if (vus.has(t.id)) continue;
        vus.add(t.id);
        uniques.push(t);
      }
      return uniques.slice(0, MAX_TOASTS);
    });
  }, []);

  /**
   * Récupère les `n` notifications les plus récentes et les affiche en toast.
   * Appelé seulement quand le badge a AUGMENTÉ depuis le dernier poll serveur.
   */
  const toasterNouvelles = useCallback(
    async (n) => {
      try {
        const res = await fetch("/api/alertes/notifications?limit=20", {
          credentials: "include",
        });
        if (!res.ok) return;
        const liste = await res.json(); // supposé trié du plus récent au plus ancien

        // les non lues d'abord, on ne garde que celles jamais toastées
        const candidates = liste
          .filter((x) => !x.lu && !toastedIdsRef.current.has(x.id))
          .slice(0, Math.max(1, n));

        if (candidates.length === 0) return;
        candidates.forEach((c) => toastedIdsRef.current.add(c.id));
        pushToasts(candidates);
      } catch {
        /* silencieux : la prochaine hausse réessaiera */
      }
    },
    [pushToasts]
  );

  const fetchCount = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/alertes/notifications/count", {
        credentials: "include",
      });
      if (!res.ok) return;
      const nouveauCount = (await res.json()).count;

      // Détection de hausse : uniquement si on a déjà une ligne de base.
      // Au tout premier poll (prev === null) on ne toaste pas les notifs
      // préexistantes — seulement celles qui arrivent PENDANT la session.
      const prev = prevCountRef.current;
      if (prev != null && nouveauCount > prev) {
        toasterNouvelles(nouveauCount - prev);
      }
      prevCountRef.current = nouveauCount;
      setCount(nouveauCount);
    } catch {
      /* silencieux : le prochain tick réessaie */
    }
  }, [toasterNouvelles]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alertes/notifications?limit=20", {
        credentials: "include",
      });
      if (res.ok) {
        setItems(await res.json());
        lastFetchedCountRef.current = null; // resynchronisé au prochain ouvrirListe
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * À appeler à l'ouverture du dropdown.
   * Fetch si jamais chargé, ou si le badge a bougé depuis le dernier fetch
   * (liste périmée). Sinon, réutilise le cache — pas de "clignotement".
   */
  const ouvrirListe = useCallback(() => {
    const stale = items === null || lastFetchedCountRef.current !== count;
    if (stale) {
      lastFetchedCountRef.current = count;
      fetchList();
    }
  }, [items, count, fetchList]);

  /**
   * Mutation optimiste : état local d'abord, réseau ensuite.
   * Le PATCH est idempotent (204 systématique) ; un échec réseau est
   * auto-corrigé par le poll suivant — pas de rollback à gérer.
   * NB : l'appelant vérifie `!n.lu` avant d'appeler (sinon le badge
   * décrémenterait à tort).
   */
  const marquerLue = useCallback(
    (id) => {
      setItems((prev) =>
        prev?.map((n) => (n.id === id ? { ...n, lu: true } : n))
      );
      setCount((c) => {
        const suivant = Math.max(0, c - 1);
        // resynchronise la ligne de base des toasts sur la baisse locale,
        // pour qu'un futur poll ne prenne pas cette baisse pour une hausse.
        prevCountRef.current = suivant;
        return suivant;
      });
      // la notif lue disparaît des toasts si elle y était
      dismissToast(id);
      fetch(`/api/notifications/${id}/lu`, {
        method: "PATCH",
        credentials: "include",
      }).catch(() => {});
    },
    [dismissToast]
  );

  const toutMarquerLu = useCallback(() => {
    setItems((prev) => prev?.map((n) => ({ ...n, lu: true })));
    setCount(0);
    prevCountRef.current = 0; // ligne de base resynchronisée
    setToasts([]); // plus rien à signaler
    fetch("/api/alertes/notifications/tout-lu", {
      method: "PATCH",
      credentials: "include",
    }).catch(() => {});
  }, []);

  // Le poller : un seul, pour toute l'app, gelé quand l'onglet est masqué.
  useEffect(() => {
    if (!enabled) return;
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", fetchCount);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", fetchCount);
    };
  }, [enabled, fetchCount]);

  // Session terminée → on purge (évite d'afficher les notifs de l'ancien user)
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setItems(null);
      setToasts([]);
      lastFetchedCountRef.current = null;
      prevCountRef.current = null;
      toastedIdsRef.current = new Set();
    }
  }, [enabled]);

  return (
    <NotificationContext.Provider
      value={{
        count,
        items,
        loading,
        toasts,
        ouvrirListe,
        marquerLue,
        toutMarquerLu,
        dismissToast,
        TOAST_TTL_MS,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications doit être utilisé sous <NotificationProvider>."
    );
  }
  return ctx;
}