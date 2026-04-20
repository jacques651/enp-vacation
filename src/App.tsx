// src/App.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { AppShell, Loader, Center, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import Navbar from './components/Navbar';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Lazy loading des composants - Dashboard
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Gestion des vacations
const VacationsManager = lazy(() => import('./pages/GestionVacation/VacationsManager'));
const EtatLiquidation = lazy(() => import('./pages/GestionVacation/EtatLiquidation'));

// Finances
const OrdreVirement = lazy(() => import('./pages/OrdresVirement'));

// Référentiels - Gestion générale
const GestionReferentiels = lazy(() => import('./pages/GestionReferentiels').then(m => ({ default: m.GestionReferentiels })));

// Référentiels - Managers spécifiques
const EnseignantsManager = lazy(() => import('./pages/referentiels/EnseignantsManager'));
const PlafondsManager = lazy(() => import('./pages/referentiels/PlafondsManager'));
const AnneesScolairesManager = lazy(() => import('./pages/referentiels/AnneesScolairesManager'));
const PromotionsManager = lazy(() => import('./pages/referentiels/PromotionsManager'));
const ComptesBancairesManager = lazy(() => import('./pages/referentiels/ComptesBancairesManager'));
const EnteteManager = lazy(() => import('./pages/referentiels/EnteteManager'));

// Import/Export
const ImportExcel = lazy(() => import('./pages/referentiels/ImportExcel'));

// Composant de chargement
const LoadingFallback = () => (
  <Center style={{ height: '100vh' }}>
    <Loader size="xl" variant="dots" />
  </Center>
);

// Créer un client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" zIndex={1000} />
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
                  
                  {/* Finances */}
                  <Route path="/ordres" element={<OrdreVirement />} />
                  <Route path="/etat" element={<EtatLiquidation />} />

                  {/* Référentiels */}
                  <Route path="/referentiels" element={<GestionReferentiels />} />
                  <Route path="/enseignants" element={<EnseignantsManager />} />
                  <Route path="/plafonds" element={<PlafondsManager />} />
                  <Route path="/annees-scolaires" element={<AnneesScolairesManager />} />
                  <Route path="/promotions" element={<PromotionsManager />} />
                  <Route path="/comptes-bancaires" element={<ComptesBancairesManager />} />
                  <Route path="/entete" element={<EnteteManager />} />
                  
                  {/* Import/Export */}
                  <Route path="/import" element={<ImportExcel />} />
                  
                  {/* Rapports (à venir) */}
                  <Route path="/cumuls" element={
                    <Center style={{ height: '50vh' }}>
                      <div style={{ textAlign: 'center' }}>
                        <h2>📊 Cumuls annuels</h2>
                        <p>Fonctionnalité à venir prochainement</p>
                      </div>
                    </Center>
                  } />
                  
                  {/* Route 404 */}
                  <Route path="*" element={
                    <Center style={{ height: '50vh' }}>
                      <div style={{ textAlign: 'center' }}>
                        <h2>🔍 404 - Page non trouvée</h2>
                        <p>La page que vous recherchez n'existe pas.</p>
                      </div>
                    </Center>
                  } />
                </Routes>
              </Suspense>
            </AppShell.Main>
          </AppShell>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;