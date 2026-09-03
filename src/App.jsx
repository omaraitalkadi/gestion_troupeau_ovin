import { createBrowserRouter, RouterProvider, Navigate } from "react-router";
import MainLayout from "./layouts/MainLayout";
import Utilisateurs from "./pages/Utilisateurs";

// Pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Troupeau from "./pages/Troupeau";

import AnimalDetail from "./pages/AnimalDetail";
import LotAnimals from "./pages/LotAnimals"; // adjust path
import Signup from "./pages/Signup";
import AlimentDetail from "./pages/AlimentDetail";
import PlanAlimentaireDetail from "./pages/PlanAlimentaireDetail";
import Alimentation from "./pages/Alimentation";
import Notifications from './pages/Notifications'
import Sante from './pages/Sante';
import { requireAuth } from "./Auth.js";
import MedicamentDetail from "./pages/MedicamentDetail.jsx";
import CampagneVaccinationDetail from './pages/CampagneVaccinationDetail.jsx'
import Parametres from "./pages/Parametres.jsx";
/*
import AnimalForm from "./pages/AnimalForm";
import ScannerRFID from "./pages/ScannerRFID";
import CalendrierSanitaire from "./pages/CalendrierSanitaire";
import CalendrierReproduction from "./pages/CalendrierReproduction";
import Production from "./pages/Production";
import Finance from "./pages/Finance";
import Reglementaire from "./pages/Reglementaire";
import Alimentation from "./pages/Alimentation";
import Notifications from "./pages/Notifications";
import Rapports from "./pages/Rapports";
import Profil from "./pages/Profil";
import Parametres from "./pages/Parametres";

// Admin-only pages
import GestionComptes from "./pages/admin/GestionComptes";
import CompteDetail from "./pages/admin/CompteDetail";

// Route guard
import RequireAdmin from "./components/RequireAdmin";
*/
const router = createBrowserRouter([
  // Public route
  {
    path: "/login",
    element: <Login />,
  },
  { path: "/signup",                  
    element: <Signup /> 
  },

  // Authenticated routes wrapped in MainLayout
  {
    element: <MainLayout />,
    loader: async ({ request }) => requireAuth(request),
    children: [
      { path: "/",                      element: <Dashboard /> },
      { path: "troupeau",               element: <Troupeau /> },
      { path: "troupeau/:id",           element: <AnimalDetail /> },
      { path: "lots/:id",               element: <LotAnimals /> },
      { path: "alimentation/aliments/:id", element:<AlimentDetail />},
      { path: "alimentation/plans/:id" ,element:<PlanAlimentaireDetail />},
      { path: "sante" , element:<Sante />},
      { path: "sante/medicaments/:id", element:<MedicamentDetail />},
      { path:"/sante/campagnes/:id", element:<CampagneVaccinationDetail />},
      { path:"/utilisateurs", element:<Utilisateurs />,loader: async ({ request }) => requireAuth(request),},
      //{ path: "troupeau/nouveau",       element: <AnimalForm /> },
    //  { path: "troupeau/:id/modifier",  element: <AnimalForm /> },
     //{ path: "scanner",                element: <ScannerRFID /> },
     // { path: "sanitaire",              element: <CalendrierSanitaire /> },
     // { path: "reproduction",           element: <CalendrierReproduction /> },
     // { path: "production",             element: <Production /> },
     // { path: "finance",                element: <Finance /> },
     // { path: "reglementaire",          element: <Reglementaire /> },
      { path: "alimentation",           element: <Alimentation /> },
      { path: "notifications",          element: <Notifications /> },
     //  { path: "rapports",               element: <Rapports /> },
     // { path: "profil",                 element: <Profil /> },
      { path: "/parametres",             element: <Parametres /> },

      // Admin-only routes
      /*
      {
        element: <RequireAdmin />,
        children: [
          { path: "admin/comptes",      element: <GestionComptes /> },
          { path: "admin/comptes/:id",  element: <CompteDetail /> },
        ],
      },
      */
    ],
  },

  // Fallback
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}