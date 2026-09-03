// Registre d'appartenance — comment CHAQUE table atteint la ferme.
// Toujours un seul saut par règle ; la profondeur vient de la composition
// (ex. naissance → gestation → reproduction → animal → ferme).
//
// LÉGENDE : ✅ = association explicite du diagramme · ⚠️ = supposé, À CONFIRMER.
// ⚠️ Les noms de colonnes FK (brebis_id, dossier_medical_id, …) restent des
//    hypothèses basées sur ta convention `<entité>_id`. Vérifie-les.

export const APPARTENANCE = {
  // ═══════════════════════════════════════════════════════════
  // DIRECT — ferme_id porté par la ligne (association Ferme explicite)
  // ═══════════════════════════════════════════════════════════
  animal:                { direct: "ferme_id" }, // ✅ Ferme "1" -- "0..*" Animal
  lot:                   { direct: "ferme_id" }, // ✅ Ferme "1" -- "0..*" Lot
  race:                  { direct: "ferme_id" }, // ✅ Race "0..*" -- "1" Ferme
  alerte:                { direct: "ferme_id" }, // ✅ Alerte "*" -- "1" Ferme
  medicament:            { direct: "ferme_id" }, // ✅ Medicament "0..*" -- "1" Ferme
  aliment:               { direct: "ferme_id" }, // ✅ Aliment "0..*" -- "1" Ferme
  programme_vaccination: { direct: "ferme_id" }, // ✅ Ferme "1" -- "0..*" ProgrammeVaccination
  plan_alimentaire:      { direct: "ferme_id" }, // ✅ Ferme "1" -- "0..*" PlanAlimentaire
  registre_elevage:      { direct: "ferme_id" }, // ✅ Ferme "1" -- "0..*" RegistreElevage

  transaction_financiere: { direct: "ferme_id" },
  // ⚠️ Ferme "0..1" -- "0..*" → ferme_id NULLABLE. Transaction sans ferme = 404.

  // ── Sans lien Ferme dessiné, mais logiquement au niveau ferme ──
  campagne_de_vaccination: { direct: "ferme_id" },
  // ⚠️ Aucun lien Ferme dans le diagramme + nom de table supposé
  //    (campagne_de_vaccination vs campagne_vaccination ?). Sinon
  //    → { through: "medicament_id", table: "medicament" }.
  rapport:                 { direct: "ferme_id" },
  // ⚠️ Aucun lien Ferme dans le diagramme. Supposé colonne propre.

  // ═══════════════════════════════════════════════════════════
  // VIA animal  (→ animal.ferme_id)
  // ═══════════════════════════════════════════════════════════
  dossier_medical:          { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "1" DossierMedical
  mouvement_troupeau:       { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" MouvementTroupeau
  journal_vie:              { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" JournalVie
  photo_animal:             { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" PhotoAnimal
  commentaire:              { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" Commentaire
  consommation_alimentaire: { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" ConsommationAlimentaire
  document:                 { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" Document
  production:               { through: "animal_id", table: "animal" }, // ✅ Animal "1" -- "*" Production
  reproduction:             { through: "brebis_id", table: "animal" }, // ✅ brebis obligatoire (cardinalité 1)

  // ═══════════════════════════════════════════════════════════
  // VIA dossier_medical  (→ animal → ferme)
  // ═══════════════════════════════════════════════════════════
  traitement:               { through: "dossier_medical_id", table: "dossier_medical" }, // ✅ DossierMedical "1" -- "*" Traitement
  vaccination:              { through: "dossier_medical_id", table: "dossier_medical" }, // ✅ DossierMedical "1" -- "*" Vaccination
  consultation_veterinaire: { through: "dossier_medical_id", table: "dossier_medical" }, // ✅ DossierMedical "1" -- "*" ConsultationVeterinaire

  // ═══════════════════════════════════════════════════════════
  // VIA reproduction / gestation  (→ animal → ferme)
  // ═══════════════════════════════════════════════════════════
  gestation: { through: "reproduction_id", table: "reproduction" }, // ✅ Reproduction "1" -- "0..1" Gestation
  naissance: { through: "gestation_id",    table: "gestation" },     // ✅ Gestation "1" -- "0..1" Naissance

  // ═══════════════════════════════════════════════════════════
  // VIA plan_alimentaire
  // ═══════════════════════════════════════════════════════════
  distribution_alimentaire: { through: "plan_alimentaire_id", table: "plan_alimentaire" }, // ✅ Distribution "0..*" -- "1" PlanAlimentaire
  ligne_plan_alimentaire:   { through: "plan_alimentaire_id", table: "plan_alimentaire" }, // ✅ PlanAlimentaire "1" *-- "*" Ligne

  // ═══════════════════════════════════════════════════════════
  // VIA rapport
  // ═══════════════════════════════════════════════════════════
  statistique:            { through: "rapport_id", table: "rapport" }, // ✅ Rapport "1" -- "*" Statistique
  indicateur_performance: { through: "rapport_id", table: "rapport" }, // ✅ Rapport "1" -- "*" IndicateurPerformance

  // ═══════════════════════════════════════════════════════════
  // HÉRITAGE — ⚠️ dépend de ton mapping ORM
  //   • mono-table   → SUPPRIME les sous-classes (seule la table mère existe)
  //   • table/classe → garde ci-dessous (FK vers la table mère)
  //   • ou sous-classe portant animal_id → { through: "animal_id", table: "animal" }
  // ═══════════════════════════════════════════════════════════
  tonte:             { through: "production_id", table: "production" }, // ⚠️ Production <|-- Tonte
  croissance:        { through: "production_id", table: "production" }, // ⚠️ Production <|-- Croissance
  abattage:          { through: "production_id", table: "production" }, // ⚠️ Production <|-- Abattage
  carnet_sanitaire:  { through: "document_id",   table: "document" },   // ⚠️ Document <|-- CarnetSanitaire
  document_transport:{ through: "document_id",   table: "document" },   // ⚠️ Document <|-- DocumentTransport

  // ═══════════════════════════════════════════════════════════
  // FINANCE — ⚠️ SENS DE FK À CONFIRMER (relations 1-1 / 1)
  // ═══════════════════════════════════════════════════════════
  transaction_animaux: { through: "transaction_financiere_id", table: "transaction_financiere" },
  // ⚠️ TransactionAnimaux "1" -- "1" TransactionFinanciere. Suppose la FK côté
  //    transaction_animaux. Sinon, table probablement dotée de son propre ferme_id.
  ligne_achat:         { through: "transaction_financiere_id", table: "transaction_financiere" },
  // ⚠️ Lien obligatoire vers transaction_financiere → on résout par lui.
  //    (medicament_id / aliment_id sont optionnels 0..1 XOR.)
};

// ═══════════════════════════════════════════════════════════════
// HORS REGISTRE FERME — à garder AUTREMENT (ne pas ajouter ici)
// ═══════════════════════════════════════════════════════════════
//
// • Rattachées à l'UTILISATEUR → garde par identité ( row.utilisateur_id ===
//   req.user.id ), PAS par ferme (sinon un membre voit les données d'un autre) :
//     session, notification, preference_notification, utilisateur_permission,
//     consultation_donnee, historique_modification
//
// • Référence GLOBALE (partagée) → aucune garde d'appartenance :
//     module_permission
//
// • RACINE → garde par ( id === req.user.ferme_id ) :
//     ferme
//
// • utilisateur → garde par identité/rôle (il porte ferme_id, mais on ne "possède"
//   pas un utilisateur via la ferme).