import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // "admin" → connexion par email ; "employe" → connexion par username (portée ferme)
  const [type, setType] = useState("admin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const estAdmin = type === "admin";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // le backend choisit la colonne (email/username) selon `type`
        body: JSON.stringify({ identifiant: identifier.trim(), type, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Identifiants incorrects");
      }
      const data = await res.json();
      // Employé au 1er login (ou après reset) → doit changer son mot de passe.
      if (data.mustChangePassword) {
        navigate("/parametres", { replace: true });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-blob login-blob-moss" aria-hidden="true" />
      <div className="login-blob login-blob-terra" aria-hidden="true" />

      <form className="login-card" onSubmit={handleSubmit} noValidate>
        {/* Brand */}
        <div className="login-brand-row">
          <div className="login-brand-mark">🐑</div>
          <div>
            <div className="login-brand-name">Ovinéa</div>
            <div className="login-brand-tagline">Gestion du bétail</div>
          </div>
        </div>

        {/* Heading */}
        <div className="login-heading">
          <h1 className="login-title">Bon retour</h1>
          <p className="login-subtitle">Connectez-vous pour accéder à votre exploitation</p>
        </div>

        {/* Type de compte : détermine email vs identifiant */}
        <div className="login-roletabs" role="tablist" aria-label="Type de compte">
          <button
            type="button" role="tab" aria-selected={estAdmin}
            className={`login-roletab ${estAdmin ? "active" : ""}`}
            onClick={() => { setType("admin"); setError(""); }}
            disabled={loading}
          >
            Administrateur
          </button>
          <button
            type="button" role="tab" aria-selected={!estAdmin}
            className={`login-roletab ${!estAdmin ? "active" : ""}`}
            onClick={() => { setType("employe"); setError(""); }}
            disabled={loading}
          >
            Employé
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Identifier : email (admin) ou username (employé) */}
        <div className="login-field">
          <label htmlFor="identifier">{estAdmin ? "Email" : "Identifiant"}</label>
          <div className="login-input-wrap">
            <User size={16} className="login-input-icon" />
            <input
              id="identifier"
              type={estAdmin ? "email" : "text"}
              autoComplete={estAdmin ? "email" : "username"}
              placeholder={estAdmin ? "vous@exemple.com" : "prenom@nom-ferme"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          {!estAdmin && (
            <p className="login-hint">Identifiant fourni par l'administrateur de votre ferme.</p>
          )}
        </div>

        {/* Password */}
        <div className="login-field">
          <div className="login-field-head">
            <label htmlFor="password">Mot de passe</label>
            {estAdmin ? (
              <Link to="/mot-de-passe-oublie" className="login-link" tabIndex={loading ? -1 : 0}>
                Oublié ?
              </Link>
            ) : (
              <span className="login-hint-inline">Oublié ? Contactez votre administrateur.</span>
            )}
          </div>
          <div className="login-input-wrap">
            <Lock size={16} className="login-input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="login-input-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <label className="login-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={loading}
          />
          Se souvenir de moi
        </label>

        {/* Submit */}
        <button type="submit" className="login-submit" disabled={loading}>
          {loading ? (<><Loader2 size={16} className="spin" />Connexion…</>) : (<>Se connecter<ArrowRight size={16} /></>)}
        </button>

        {/* Footer : seul un administrateur crée une exploitation */}
        {estAdmin && (
          <div className="login-footer">
            Pas encore de compte ?{" "}
            <Link to="/signup" className="login-link">Créer une exploitation</Link>
          </div>
        )}
      </form>
    </div>
  );
}