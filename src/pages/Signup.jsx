import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User, Mail, Lock, Eye, EyeOff, Phone, ArrowRight, ArrowLeft,
  AlertCircle, Loader2, Building2, FileText, Calendar, CheckCircle2,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PHONE_RE = /^[+\d\s\-]{8,20}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/;

function isEmpty(v) { return !v || !v.trim(); }

// ── Step definitions ──────────────────────────────────────────────────────────
// Step 1 : compte administrateur
// Step 2 : informations de la ferme
const STEPS = ["Votre compte", "Votre ferme", "Vérification"];

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ id, label, optional, error, hint, children }) {
  return (
    <div className="signup-field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="signup-optional"> (optionnel)</span>}
      </label>
      {children}
      {hint && !error && <p className="signup-hint">{hint}</p>}
      {error && (
        <p className="signup-field-error" role="alert">
          <AlertCircle size={12} />{error}
        </p>
      )}
    </div>
  );
}

// ── InputWrap ─────────────────────────────────────────────────────────────────
function InputWrap({ icon: Icon, error, children }) {
  return (
    <div className={`login-input-wrap${error ? " input-error" : ""}`}>
      {Icon && <Icon size={16} className="login-input-icon" />}
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Vérification (étape 3) ──
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmMotDePasse, setConfirmMotDePasse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [fermeNom, setFermeNom] = useState("");
  const [numeroRegistre, setNumeroRegistre] = useState("");
  const [numeroPatente, setNumeroPatente] = useState("");
  const [numeroIFU, setNumeroIFU] = useState("");
  const [telephoneContact, setTelephoneContact] = useState("");
  const [emailContact, setEmailContact] = useState("");
  const [telephoneSecondaire, setTelephoneSecondaire] = useState("");
  const [dateDebutExploitation, setDateDebutExploitation] = useState("");

  // ── Field-level errors ────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const setFieldError = (field, msg) =>
    setErrors((prev) => ({ ...prev, [field]: msg }));
  const clearError = (field) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  // ── Step 1 validation ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (isEmpty(nom) || nom.trim().length < 2)
      e.nom = "Le nom doit contenir au moins 2 caractères.";
    if (isEmpty(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = "Adresse email invalide.";
    if (isEmpty(motDePasse))
      e.motDePasse = "Le mot de passe est requis.";
    else if (motDePasse.length < 8)
      e.motDePasse = "Minimum 8 caractères.";
    else if (!PASSWORD_RE.test(motDePasse))
      e.motDePasse = "Doit contenir majuscule, minuscule, chiffre et caractère spécial (@$!%*?&).";
    if (isEmpty(confirmMotDePasse))
      e.confirmMotDePasse = "Veuillez confirmer le mot de passe.";
    else if (confirmMotDePasse !== motDePasse)
      e.confirmMotDePasse = "Les mots de passe ne correspondent pas.";
    if (telephone && !PHONE_RE.test(telephone))
      e.telephone = "Format invalide (8–20 chiffres, +, espaces ou tirets).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 2 validation ─────────────────────────────────────────────────────
  const validateStep2 = () => {
    const e = {};
    if (isEmpty(fermeNom) || fermeNom.trim().length < 2)
      e.fermeNom = "Le nom de la ferme doit contenir au moins 2 caractères.";
    if (isEmpty(numeroRegistre))
      e.numeroRegistre = "Le numéro de registre ONCA est requis.";
    if (telephoneContact && !PHONE_RE.test(telephoneContact))
      e.telephoneContact = "Format invalide.";
    if (telephoneSecondaire && !PHONE_RE.test(telephoneSecondaire))
      e.telephoneSecondaire = "Format invalide.";
    if (emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContact.trim()))
      e.emailContact = "Adresse email invalide.";
    if (dateDebutExploitation && new Date(dateDebutExploitation) >= new Date())
      e.dateDebutExploitation = "La date doit être dans le passé.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Next / Back ───────────────────────────────────────────────────────────
  const handleNext = (e) => {
    e.preventDefault();
    setGlobalError("");
    if (step === 0 && validateStep1()) setStep(1);
  };

  const handleBack = () => {
    setGlobalError("");
    setStep((st) => Math.max(0, st - 1));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const body = {
        // Administrateur
        nom: nom.trim(),
        email: email.trim(),
        motDePasse,
        ...(telephone && { telephone: telephone.trim() }),
        // Ferme
        fermeNom: fermeNom.trim(),
        numeroRegistre: numeroRegistre.trim(),
        ...(numeroPatente       && { numeroPatente: numeroPatente.trim() }),
        ...(numeroIFU           && { numeroIFU: numeroIFU.trim() }),
        ...(telephoneContact    && { telephoneContact: telephoneContact.trim() }),
        ...(emailContact        && { emailContact: emailContact.trim() }),
        ...(telephoneSecondaire && { telephoneSecondaire: telephoneSecondaire.trim() }),
        ...(dateDebutExploitation && { dateDebutExploitation }),
      };

      // Étape 2 → démarre l'inscription (envoie le code). NE crée rien encore.
      const res = await fetch("/api/auth/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Erreur lors de l'envoi du code.");
      }
      setStep(2);            // → étape 3 : saisie du code
      setResendCooldown(30);
    } catch (err) {
      setGlobalError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  // Étape 3 → vérifie le code, CRÉE le compte + ferme, connecte.
  const handleVerify = async (e) => {
    e.preventDefault();
    setGlobalError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setGlobalError("Entrez le code à 6 chiffres reçu par email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Code incorrect.");
      }
      setSuccess(true);
      setTimeout(() => navigate("/"), 1500); // compte créé + session posée
    } catch (err) {
      setGlobalError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setGlobalError("");
    try {
      const res = await fetch("/api/auth/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Renvoi impossible.");
      }
      setResendCooldown(30);
    } catch (err) {
      setGlobalError(err.message || "Renvoi impossible.");
    }
  };

  // ── Password strength indicator ───────────────────────────────────────────
  const pwdStrength = (() => {
    if (!motDePasse) return 0;
    let s = 0;
    if (motDePasse.length >= 8) s++;
    if (/[A-Z]/.test(motDePasse)) s++;
    if (/\d/.test(motDePasse)) s++;
    if (/[@$!%*?&]/.test(motDePasse)) s++;
    return s;
  })();
  const pwdLabels = ["", "Faible", "Moyen", "Bon", "Fort"];
  const pwdColors = ["", "#e53e3e", "#dd8800", "#3182ce", "#38a169"];

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="login-page">
        <div className="login-blob login-blob-moss" aria-hidden="true" />
        <div className="login-blob login-blob-terra" aria-hidden="true" />
        <div className="login-card signup-success">
          <div className="signup-success-icon"><CheckCircle2 size={48} /></div>
          <h2>Compte créé !</h2>
          <p>Votre exploitation <strong>{fermeNom}</strong> a bien été enregistrée.<br />Redirection vers votre tableau de bord…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-blob login-blob-moss" aria-hidden="true" />
      <div className="login-blob login-blob-terra" aria-hidden="true" />

      <div className="login-card signup-card">
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
          <h1 className="login-title">Créer une exploitation</h1>
          <p className="login-subtitle">Étape {step + 1} sur {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Step progress */}
        <div className="signup-steps" aria-label="Progression">
          {STEPS.map((label, i) => (
            <div key={i} className={`signup-step ${i < step ? "done" : i === step ? "active" : ""}`}>
              <div className="signup-step-dot">{i < step ? "✓" : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
          <div className="signup-step-line">
            <div className="signup-step-line-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </div>

        {/* Global error */}
        {globalError && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} /><span>{globalError}</span>
          </div>
        )}

        {/* ── Step 1 : Administrateur ─────────────────────────────────── */}
        {step === 0 && (
          <form onSubmit={handleNext} noValidate>
            <Field id="nom" label="Nom complet" error={errors.nom}>
              <InputWrap icon={User} error={errors.nom}>
                <input
                  id="nom" type="text" autoComplete="name"
                  placeholder="Karim Benali"
                  value={nom} onChange={(e) => { setNom(e.target.value); clearError("nom"); }}
                  required
                />
              </InputWrap>
            </Field>

            <Field id="email" label="Adresse email" error={errors.email}>
              <InputWrap icon={Mail} error={errors.email}>
                <input
                  id="email" type="email" autoComplete="email"
                  placeholder="karim@ferme.ma"
                  value={email} onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                  required
                />
              </InputWrap>
            </Field>

            <Field
              id="motDePasse" label="Mot de passe" error={errors.motDePasse}
              hint="Min. 8 caractères, avec majuscule, chiffre et caractère spécial."
            >
              <InputWrap icon={Lock} error={errors.motDePasse}>
                <input
                  id="motDePasse" type={showPwd ? "text" : "password"}
                  autoComplete="new-password" placeholder="••••••••"
                  value={motDePasse} onChange={(e) => { setMotDePasse(e.target.value); clearError("motDePasse"); }}
                  required
                />
                <button type="button" className="login-input-toggle"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Masquer" : "Afficher"} tabIndex={-1}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </InputWrap>
              {motDePasse && (
                <div className="signup-pwd-strength">
                  {[1,2,3,4].map((n) => (
                    <div key={n} className="signup-pwd-bar"
                      style={{ background: pwdStrength >= n ? pwdColors[pwdStrength] : "var(--pwd-bar-empty)" }} />
                  ))}
                  <span style={{ color: pwdColors[pwdStrength] }}>{pwdLabels[pwdStrength]}</span>
                </div>
              )}
            </Field>

            <Field id="confirmMotDePasse" label="Confirmer le mot de passe" error={errors.confirmMotDePasse}>
              <InputWrap icon={Lock} error={errors.confirmMotDePasse}>
                <input
                  id="confirmMotDePasse" type={showConfirm ? "text" : "password"}
                  autoComplete="new-password" placeholder="••••••••"
                  value={confirmMotDePasse} onChange={(e) => { setConfirmMotDePasse(e.target.value); clearError("confirmMotDePasse"); }}
                  required
                />
                <button type="button" className="login-input-toggle"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Masquer" : "Afficher"} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </InputWrap>
            </Field>

            <Field id="telephone" label="Téléphone" optional error={errors.telephone}>
              <InputWrap icon={Phone} error={errors.telephone}>
                <input
                  id="telephone" type="tel" autoComplete="tel"
                  placeholder="+212 6XX XXX XXX"
                  value={telephone} onChange={(e) => { setTelephone(e.target.value); clearError("telephone"); }}
                />
              </InputWrap>
            </Field>

            <button type="submit" className="login-submit">
              Continuer <ArrowRight size={16} />
            </button>

            <div className="login-footer">
              Déjà un compte ?{" "}
              <Link to="/login" className="login-link">Se connecter</Link>
            </div>
          </form>
        )}

        {/* ── Step 2 : Ferme ──────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleSubmit} noValidate>
            <Field id="fermeNom" label="Nom de la ferme" error={errors.fermeNom}>
              <InputWrap icon={Building2} error={errors.fermeNom}>
                <input
                  id="fermeNom" type="text"
                  placeholder="Ferme Al Baraka"
                  value={fermeNom} onChange={(e) => { setFermeNom(e.target.value); clearError("fermeNom"); }}
                  required
                />
              </InputWrap>
            </Field>

            <Field id="numeroRegistre" label="Numéro de registre ONCA" error={errors.numeroRegistre}
              hint="Numéro d'enregistrement délivré par l'ONCA.">
              <InputWrap icon={FileText} error={errors.numeroRegistre}>
                <input
                  id="numeroRegistre" type="text"
                  placeholder="ONCA-2024-XXXXX"
                  value={numeroRegistre} onChange={(e) => { setNumeroRegistre(e.target.value); clearError("numeroRegistre"); }}
                  required
                />
              </InputWrap>
            </Field>

            <Field id="numeroPatente" label="Numéro de patente" optional error={errors.numeroPatente}>
              <InputWrap icon={FileText} error={errors.numeroPatente}>
                <input
                  id="numeroPatente" type="text"
                  placeholder="Patente commerciale marocaine"
                  value={numeroPatente} onChange={(e) => { setNumeroPatente(e.target.value); clearError("numeroPatente"); }}
                />
              </InputWrap>
            </Field>

            <Field id="numeroIFU" label="Numéro IFU" optional error={errors.numeroIFU}
              hint="Identifiant Fiscal Unique (DGI).">
              <InputWrap icon={FileText} error={errors.numeroIFU}>
                <input
                  id="numeroIFU" type="text"
                  placeholder="Identifiant Fiscal Unique"
                  value={numeroIFU} onChange={(e) => { setNumeroIFU(e.target.value); clearError("numeroIFU"); }}
                />
              </InputWrap>
            </Field>

            <Field id="telephoneContact" label="Téléphone de contact" optional error={errors.telephoneContact}>
              <InputWrap icon={Phone} error={errors.telephoneContact}>
                <input
                  id="telephoneContact" type="tel"
                  placeholder="+212 5XX XXX XXX"
                  value={telephoneContact} onChange={(e) => { setTelephoneContact(e.target.value); clearError("telephoneContact"); }}
                />
              </InputWrap>
            </Field>

            <Field id="telephoneSecondaire" label="Téléphone secondaire" optional error={errors.telephoneSecondaire}>
              <InputWrap icon={Phone} error={errors.telephoneSecondaire}>
                <input
                  id="telephoneSecondaire" type="tel"
                  placeholder="+212 5XX XXX XXX"
                  value={telephoneSecondaire} onChange={(e) => { setTelephoneSecondaire(e.target.value); clearError("telephoneSecondaire"); }}
                />
              </InputWrap>
            </Field>

            <Field id="emailContact" label="Email de contact" optional error={errors.emailContact}>
              <InputWrap icon={Mail} error={errors.emailContact}>
                <input
                  id="emailContact" type="email"
                  placeholder="contact@ferme.ma"
                  value={emailContact} onChange={(e) => { setEmailContact(e.target.value); clearError("emailContact"); }}
                />
              </InputWrap>
            </Field>

            <Field id="dateDebutExploitation" label="Date de début d'exploitation" optional
              error={errors.dateDebutExploitation}>
              <InputWrap icon={Calendar} error={errors.dateDebutExploitation}>
                <input
                  id="dateDebutExploitation" type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={dateDebutExploitation} onChange={(e) => { setDateDebutExploitation(e.target.value); clearError("dateDebutExploitation"); }}
                />
              </InputWrap>
            </Field>

            <div className="signup-actions">
              <button type="button" className="signup-back" onClick={handleBack} disabled={loading}>
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" className="login-submit signup-submit-btn" disabled={loading}>
                {loading ? (
                  <><Loader2 size={16} className="spin" />Envoi du code…</>
                ) : (
                  <>Recevoir le code <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Étape 3 : Vérification email ── */}
        {step === 2 && (
          <form onSubmit={handleVerify} noValidate>
            <p className="login-subtitle" style={{ marginBottom: 16 }}>
              Un code à 6 chiffres a été envoyé à <strong>{email}</strong>. Il expire dans 20 minutes.
            </p>

            <Field id="code" label="Code de vérification">
              <InputWrap>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                  required
                />
              </InputWrap>
            </Field>

            <div className="signup-actions">
              <button type="button" className="signup-back" onClick={handleBack} disabled={loading}>
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" className="login-submit signup-submit-btn" disabled={loading}>
                {loading ? (
                  <><Loader2 size={16} className="spin" />Vérification…</>
                ) : (
                  <>Créer le compte <ArrowRight size={16} /></>
                )}
              </button>
            </div>

            <div className="signup-resend">
              <button
                type="button"
                className="login-link"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{ background: "none", border: "none", cursor: resendCooldown > 0 ? "default" : "pointer" }}
              >
                {resendCooldown > 0 ? `Renvoyer le code (${resendCooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}