import { Tabs, Container, Title } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';

import {
  CyclesManager,
  ModulesManager,
  MatieresManager,
  EnseignantsManager,
  BanquesManager,
  SignatairesManager,
  PlafondsManager,
  PromotionsManager,
} from './referentiels';

import ImportExcel from './referentiels/ImportExcel';
import EnteteSimple from '../components/admin/EnteteSimple';
import ComptesBancairesManager from './referentiels/ComptesBancairesManager';
import AnneesScolairesManager from './referentiels/AnneesScolairesManager';

export function GestionReferentiels() {
  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        Gestion des référentiels
      </Title>

      <Tabs defaultValue="cycles" keepMounted>
        {/* ================= TABS ================= */}
        <Tabs.List>

          {/* ===== PEDAGOGIE ===== */}
          <Tabs.Tab value="cycles">Cycles</Tabs.Tab>
          <Tabs.Tab value="modules">Modules</Tabs.Tab>
          <Tabs.Tab value="matieres">Matières</Tabs.Tab>

          {/* ===== RH ===== */}
          <Tabs.Tab value="enseignants">Enseignants</Tabs.Tab>
          <Tabs.Tab value="comptes">Comptes bancaires</Tabs.Tab>
          <Tabs.Tab value="banques">Banques</Tabs.Tab>

          {/* ===== ACADEMIQUE ===== */}
          <Tabs.Tab value="promotions">Promotions</Tabs.Tab>
          <Tabs.Tab value="annees">Années scolaires</Tabs.Tab>

          {/* ===== CONFIG ===== */}
          <Tabs.Tab value="plafonds">Plafonds</Tabs.Tab>
          <Tabs.Tab value="signataires">Signataires</Tabs.Tab>
          <Tabs.Tab value="entete">Configuration en-tête</Tabs.Tab>

          {/* ===== IMPORT ===== */}
          <Tabs.Tab
            value="import"
            color="yellow"
            leftSection={<IconUpload size={16} />}
          >
            Import Excel
          </Tabs.Tab>
        </Tabs.List>

        {/* ================= PANELS ================= */}

        {/* PEDAGOGIE */}
        <Tabs.Panel value="cycles">
          <CyclesManager />
        </Tabs.Panel>

        <Tabs.Panel value="modules">
          <ModulesManager />
        </Tabs.Panel>

        <Tabs.Panel value="matieres">
          <MatieresManager />
        </Tabs.Panel>

        {/* RH */}
        <Tabs.Panel value="enseignants">
          <EnseignantsManager />
        </Tabs.Panel>

        <Tabs.Panel value="comptes">
          <ComptesBancairesManager />
        </Tabs.Panel>

        <Tabs.Panel value="banques">
          <BanquesManager />
        </Tabs.Panel>

        {/* ACADEMIQUE */}
        <Tabs.Panel value="promotions">
          <PromotionsManager />
        </Tabs.Panel>

        <Tabs.Panel value="annees">
          <AnneesScolairesManager />
        </Tabs.Panel>

        {/* CONFIG */}
        <Tabs.Panel value="plafonds">
          <PlafondsManager />
        </Tabs.Panel>

        <Tabs.Panel value="signataires">
          <SignatairesManager />
        </Tabs.Panel>

        <Tabs.Panel value="entete">
          <EnteteSimple />
        </Tabs.Panel>

        {/* IMPORT */}
        <Tabs.Panel value="import">
          <ImportExcel />
        </Tabs.Panel>

      </Tabs>
    </Container>
  );
}