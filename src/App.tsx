// src/App.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { AppShell, Loader, Center } from '@mantine/core';
import Navbar from './components/Navbar';

// Lazy loading des composants
const Dashboard = lazy(() => import('./pages/Dashboard'));
const VacationsManager = lazy(() => import('./pages/GestionVacation/VacationsManager'));
const EtatLiquidation = lazy(() => import('./pages/GestionVacation/EtatLiquidation'));
const OrdreVirement = lazy(() => import('./pages/OrdresVirement'));
const GestionReferentiels = lazy(() => import('./pages/GestionReferentiels').then(m => ({ default: m.GestionReferentiels })));
const AnneesScolairesManager = lazy(() => import('./pages/referentiels/AnneesScolairesManager'));
const PromotionsManager = lazy(() => import('./pages/referentiels/PromotionsManager'));
const ComptesBancairesManager = lazy(() => import('./pages/referentiels/ComptesBancairesManager'));
const ImportExcel = lazy(() => import('./pages/referentiels/ImportExcel'));
const EnteteManager = lazy(() => import('./pages/referentiels/EnteteManager')); // Changé de EnteteSimple à EnteteManager

// Composant de chargement
const LoadingFallback = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
);

function App() {
  console.log("App - Route actuelle:", window.location.pathname);

  return (
    <BrowserRouter>
      <AppShell
        padding="md"
        navbar={{ width: 260, breakpoint: 'sm' }}
        styles={{
          main: {
            height: '100%',
            overflow: 'auto',
            backgroundColor: '#f5f7fa',
          },
        }}
      >
        <AppShell.Navbar>
          <Navbar />
        </AppShell.Navbar>

        <AppShell.Main>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Dashboard */}
              <Route path="/" element={<Dashboard />} />
              
              {/* Gestion des vacations */}
              <Route path="/vacations" element={<VacationsManager />} />
              <Route path="/etat" element={<EtatLiquidation mois={0} annee={0} />} />
              <Route path="/ordres" element={<OrdreVirement />} />
              
              {/* Référentiels */}
              <Route path="/referents" element={<GestionReferentiels />} />
              <Route path="/annees-scolaires" element={<AnneesScolairesManager />} />
              <Route path="/promotions" element={<PromotionsManager />} />
              <Route path="/comptes-bancaires" element={<ComptesBancairesManager />} />
              <Route path="/entete" element={<EnteteManager />} /> {/* Nouvelle route pour l'entête */}
              <Route path="/import" element={<ImportExcel />} />
              
              {/* Rapports */}
              <Route path="/cumuls" element={<div>Cumuls annuels (à venir)</div>} />
              
              {/* Route 404 */}
              <Route path="*" element={
                <Center style={{ height: '50vh' }}>
                  <div>Page non trouvée</div>
                </Center>
              } />
            </Routes>
          </Suspense>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;