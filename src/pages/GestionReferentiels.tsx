import { useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Tabs,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import { IconTableImport, IconUpload } from '@tabler/icons-react';

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
import EnteteManager from './referentiels/EnteteManager';
import ComptesBancairesManager from './referentiels/ComptesBancairesManager';
import AnneesScolairesManager from './referentiels/AnneesScolairesManager';

export function GestionReferentiels() {
  const [activeTab, setActiveTab] = useState<string | null>('cycles');

  return (
    <Stack p="md" gap="lg" style={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Gestion des référentiels</Title>
            <Text size="sm" c="gray.3">
              Gérez tous les paramètres de l'application
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconTableImport size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Tabs avec style pour Import Excel */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        keepMounted
        variant="default"
      >
        <Tabs.List grow>
          <Tabs.Tab value="cycles">Cycles</Tabs.Tab>
          <Tabs.Tab value="modules">Modules</Tabs.Tab>
          <Tabs.Tab value="matieres">Matières</Tabs.Tab>
          <Tabs.Tab value="enseignants">Enseignants</Tabs.Tab>
          <Tabs.Tab value="comptes">Comptes bancaires</Tabs.Tab>
          <Tabs.Tab value="banques">Banques</Tabs.Tab>
          <Tabs.Tab value="promotions">Promotions</Tabs.Tab>
          <Tabs.Tab value="annees">Années scolaires</Tabs.Tab>
          <Tabs.Tab value="plafonds">Plafonds</Tabs.Tab>
          <Tabs.Tab value="signataires">Signataires</Tabs.Tab>
          <Tabs.Tab value="entete">Paramètres</Tabs.Tab>

          {/* Onglet Import Excel avec style distinct */}
          <Tabs.Tab
            value="import"
            color="blue"
            leftSection={<IconUpload size={16} />}
            style={(theme) => ({
              backgroundColor: activeTab === 'import' ? theme.colors.blue[8] : 'transparent',
              color: activeTab === 'import' ? 'white' : theme.colors.blue[8],
              fontWeight: activeTab === 'import' ? 600 : 500,
              borderRadius: '8px',
            })}
          >
            Import Excel
          </Tabs.Tab>
        </Tabs.List>

        {/* Panels */}
        <Tabs.Panel value="cycles" pt="md">
          <CyclesManager />
        </Tabs.Panel>

        <Tabs.Panel value="modules" pt="md">
          <ModulesManager />
        </Tabs.Panel>

        <Tabs.Panel value="matieres" pt="md">
          <MatieresManager />
        </Tabs.Panel>

        <Tabs.Panel value="enseignants" pt="md">
          <EnseignantsManager />
        </Tabs.Panel>

        <Tabs.Panel value="comptes" pt="md">
          <ComptesBancairesManager />
        </Tabs.Panel>

        <Tabs.Panel value="banques" pt="md">
          <BanquesManager />
        </Tabs.Panel>

        <Tabs.Panel value="promotions" pt="md">
          <PromotionsManager />
        </Tabs.Panel>

        <Tabs.Panel value="annees" pt="md">
          <AnneesScolairesManager />
        </Tabs.Panel>

        <Tabs.Panel value="plafonds" pt="md">
          <PlafondsManager />
        </Tabs.Panel>

        <Tabs.Panel value="signataires" pt="md">
          <SignatairesManager />
        </Tabs.Panel>

        <Tabs.Panel value="entete" pt="md">
          <EnteteManager />
        </Tabs.Panel>

        <Tabs.Panel value="import" pt="md">
          <ImportExcel />
        </Tabs.Panel>
      </Tabs>

      {/* Instructions */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Utilisez les onglets pour naviguer entre les différents référentiels</Text>
          <Text size="sm">2. Chaque référentiel permet d'ajouter, modifier ou supprimer des éléments</Text>
          <Text size="sm">3. L'onglet "Import Excel" permet d'importer des données en masse</Text>
          <Text size="sm">4. Les modifications sont automatiquement enregistrées</Text>
        </Stack>

        <Divider my="md" />

        <Title order={5} mb="md">📝 Notes importantes</Title>
        <Stack gap="xs">
          <Text size="sm">• Les cycles, modules et matières sont liés hiérarchiquement</Text>
          <Text size="sm">• Un cycle ne peut pas être supprimé s'il contient des modules</Text>
          <Text size="sm">• Un module ne peut pas être supprimé s'il contient des matières</Text>
          <Text size="sm">• Les enseignants peuvent avoir plusieurs comptes bancaires</Text>
          <Text size="sm">• Un seul compte bancaire peut être actif par enseignant</Text>
          <Text size="sm">• Les paramètres de l'établissement apparaissent sur les documents officiels</Text>
        </Stack>
      </Card>
    </Stack>
  );
}