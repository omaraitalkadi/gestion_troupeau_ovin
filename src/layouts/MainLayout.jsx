import "./layout.css";
import "./theme.css";
import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Sheet,
  HeartPulse,
  Wheat,
  Bell,
  Users,
  Settings,
  User,
  LogOut,
  Wifi,
  Menu,
  X,
} from "lucide-react";
import NotificationBell from "../components/NotificationBell";
import NotificationToaster from "../pages/NotificationToaster";
import {
  NotificationProvider,
  useNotifications,
} from "../context/NotificationContext";

const API_BASE = document.location.origin || "http://localhost";

const initialsOf = (name = "") =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

// Real user from the backend — same source as the dashboard (/api/utilisateur/me)
const useCurrentUser = () => {
  const [user, setUser] = useState({
    name: "Chargement…",
    role: "eleveur",
    initials: "·",
    mustChangePassword: false,
  });

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/utilisateur/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json?.user) return;
        const name = json.user.nom ?? "Utilisateur";
        setUser({
          name,
          role: json.user.role ?? "eleveur",
          initials: initialsOf(name),
          mustChangePassword: json.user.must_change_password === true,
        });
      })
      .catch(() => {
        if (alive) setUser((u) => ({ ...u, name: "Utilisateur" }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return user;
};

const navSections = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      // notifBadge: le badge est alimenté par le count du NotificationContext
      { to: "/notifications", label: "Notifications", icon: Bell, notifBadge: true },
    ],
  },
  {
    label: "Troupeau",
    items: [
      { to: "/troupeau", label: "Mon troupeau", icon: Sheet },
      { to: "/alimentation", label: "Alimentation", icon: Wheat },
    ],
  },
  {
    label: "Suivi",
    items: [
      { to: "/sante", label: "Sante & vaccination", icon: HeartPulse },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { to: "/utilisateurs", label: "Utilisateurs", icon: Users },
    ],
  },
  {
    label: "Compte",
    items: [
      { to: "/utilisateurs", label: "Mon profil", icon: User, hideForAdmin: true },
      { to: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

/**
 * Le shell est un composant SÉPARÉ du provider : MainLayout monte le
 * provider, Shell consomme le context (badge sidebar, via useNotifications).
 * Un composant ne peut pas consommer un context qu'il fournit lui-même.
 */
function Shell() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { count } = useNotifications();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le tiroir à chaque changement de route (navigation mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Ferme le tiroir avec la touche Échap
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => {
    const res = await fetch("api/auth/logout", { method: "POST" });
    if (res.ok) navigate("/login");
    navigate("/");
  };

  const estAdmin = user.role === "ADMINISTRATEUR";

  const visibleSections = navSections
    .filter((s) => !s.adminOnly || estAdmin)
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !(it.hideForAdmin && estAdmin)),
    }))
    .filter((s) => s.items.length > 0);

  // Verrou : tant que le mot de passe doit être changé, seule la page
  // Paramètres est accessible ; toute autre route y renvoie.
  if (user.mustChangePassword && location.pathname !== "/parametres") {
    return <Navigate to="/parametres" replace />;
  }

  return (
    <div className="app-shell">
      <div
        className={"sidebar-backdrop" + (mobileOpen ? " is-open" : "")}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={"sidebar" + (mobileOpen ? " is-open" : "")}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 40 40">
              <rect x="1.5" y="1.5" width="37" height="37" rx="11.5" fill="currentColor" />
              <g fill="#fff">
                <circle cx="15.5" cy="18.5" r="4.2" />
                <circle cx="20" cy="15.6" r="4.7" />
                <circle cx="24.5" cy="18.5" r="4.2" />
                <circle cx="17.7" cy="21.6" r="4.4" />
                <circle cx="22.3" cy="21.6" r="4.4" />
                <ellipse cx="26.4" cy="23.2" rx="3" ry="3.5" />
                <rect x="17.2" y="24.8" width="1.7" height="3.8" rx="0.85" />
                <rect x="21.1" y="24.8" width="1.7" height="3.8" rx="0.85" />
              </g>
              <ellipse cx="26.8" cy="23.7" rx="1.8" ry="2.3" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-title">Ovinéa</span>
          <button
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav">
          {visibleSections.map((section) => (
            <div key={section.label} className="nav-section">
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(
                ({ to, label, icon: Icon, badge, notifBadge, end }) => {
                  // notifBadge → count vivant du context ; badge → valeur statique
                  const badgeValue = notifBadge ? count : badge;
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        "nav-link" + (isActive ? " is-active" : "")
                      }
                    >
                      <Icon size={18} strokeWidth={1.75} />
                      <span>{label}</span>
                      {badgeValue > 0 ? (
                        <span className="nav-badge">
                          {badgeValue > 99 ? "99+" : badgeValue}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                }
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{user.initials}</div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">
                {user.role === "ADMINISTRATEUR" ? "Administrateur"
                  : user.role === "VETERINAIRE" ? "Vétérinaire"
                  : user.role === "OPERATEUR" ? "Opérateur"
                  : "Éleveur"}
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={handleLogout}
              aria-label="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="topbar-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-status">
              <Wifi size={14} />
              <span>Synchronisé · à l'instant</span>
            </div>
          </div>
          <NotificationBell />
        </header>

        <div className="content">
          <Outlet />
        </div>

        <NotificationToaster />
      </main>
    </div>
  );
}

export default function MainLayout() {
  return (
    <NotificationProvider>
      <Shell />
    </NotificationProvider>
  );
}