import { useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Select,
  Alert,
  Table,
  Badge,
  Progress,
  Tabs,
  Paper,
  ScrollArea,
  Divider,
  Loader,
  ThemeIcon,
} from '@mantine/core';
import { IconUpload, IconFileExcel, IconCheck, IconX, IconDownload, IconAlertCircle, IconTableImport } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

// Types pour les imports
type EntityType = 'cycles' | 'modules' | 'matieres' | 'enseignants' | 'banques' | 'promotions' | 'plafonds' | 'annees_scolaires' | 'comptes_bancaires';

interface ImportResult {
  success: number;
  errors: string[];
}

const ENTITY_CONFIG: Record<EntityType, { label: string; columns: string[]; requiredColumns: string[] }> = {
  cycles: {
    label: 'Cycles',
    columns: ['designation', 'nb_classe'],
    requiredColumns: ['designation'],
  },
  modules: {
    label: 'Modules',
    columns: ['designation', 'cycle', 'cycle_id'],
    requiredColumns: ['designation'],
  },
  matieres: {
    label: 'Matières',
    columns: ['designation', 'module', 'module_id', 'vhoraire', 'coefficient', 'observation'],
    requiredColumns: ['designation', 'vhoraire'],
  },
  enseignants: {
    label: 'Enseignants',
    columns: ['nom', 'prenom', 'telephone', 'titre', 'statut', 'banque', 'numero_compte', 'cle_rib'],
    requiredColumns: ['nom', 'prenom'],
  },
  banques: {
    label: 'Banques',
    columns: ['designation'],
    requiredColumns: ['designation'],
  },
  promotions: {
    label: 'Promotions',
    columns: ['libelle'],
    requiredColumns: ['libelle'],
  },
  plafonds: {
    label: 'Plafonds',
    columns: ['titre', 'statut', 'volume_horaire_max'],
    requiredColumns: ['titre', 'statut', 'volume_horaire_max'],
  },
  annees_scolaires: {
    label: 'Années Scolaires',
    columns: ['libelle'],
    requiredColumns: ['libelle'],
  },
  comptes_bancaires: {
    label: 'Comptes Bancaires',
    columns: ['enseignant_nom', 'enseignant_prenom', 'banque_designation', 'numero_compte'],
    requiredColumns: ['enseignant_nom', 'enseignant_prenom', 'banque_designation', 'numero_compte'],
  },
};

const STATUTS = ['interne', 'externe'];
const TITRES = ['directeur', 'chef de division/service', 'agent', 'retraité', 'autre'];

export default function ImportExcel() {
  const [activeTab, setActiveTab] = useState<EntityType>('cycles');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Limiter l'aperçu à 10 lignes
        setPreviewData(jsonData.slice(0, 10));
        
        if (jsonData.length === 0) {
          setError('Le fichier Excel est vide');
        }
      } catch (err) {
        setError('Erreur lors de la lecture du fichier Excel');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const downloadTemplate = () => {
    const config = ENTITY_CONFIG[activeTab];
    const templateData = [config.columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})];
    
    // Ajouter des exemples pour chaque entité
    if (activeTab === 'cycles') {
      templateData[0] = { designation: 'Licence 1', nb_classe: 2 };
    } else if (activeTab === 'modules') {
      templateData[0] = { designation: 'Mathématiques', cycle: 'Licence 1' };
    } else if (activeTab === 'matieres') {
      templateData[0] = { designation: 'Algèbre', module: 'Mathématiques', vhoraire: 2.5, coefficient: 1, observation: '' };
    } else if (activeTab === 'enseignants') {
      templateData[0] = { 
        nom: 'DIOP', 
        prenom: 'Amadou', 
        telephone: '76123456', 
        titre: 'agent', 
        statut: 'interne', 
        banque: 'Banque Malienne de Solidarité', 
        numero_compte: '000123456789', 
        cle_rib: '12' 
      };
    } else if (activeTab === 'banques') {
      templateData[0] = { designation: 'Banque Nationale de Développement' };
    } else if (activeTab === 'promotions') {
      templateData[0] = { libelle: '55ème promotion' };
    } else if (activeTab === 'plafonds') {
      templateData[0] = { titre: 'agent', statut: 'interne', volume_horaire_max: 100 };
    } else if (activeTab === 'annees_scolaires') {
      templateData[0] = { libelle: '2025-2026' };
    } else if (activeTab === 'comptes_bancaires') {
      templateData[0] = { 
        enseignant_nom: 'DIOP', 
        enseignant_prenom: 'Amadou', 
        banque_designation: 'Banque Nationale de Développement', 
        numero_compte: '000123456789'
      };
    }
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `template_${activeTab}.xlsx`);
  };

  const handleImport = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          if (jsonData.length === 0) {
            setError('Le fichier Excel est vide');
            setImporting(false);
            return;
          }

          // Nettoyer les données
          const cleanedData = jsonData.map((row: any) => {
            const cleaned: any = {};
            for (const key of Object.keys(row)) {
              const normalizedKey = key.toLowerCase().trim();
              cleaned[normalizedKey] = row[key];
            }
            return cleaned;
          });

          let result: ImportResult;
          
          switch (activeTab) {
            case 'cycles':
              result = await invoke('import_cycles', { data: cleanedData });
              break;
            case 'modules':
              result = await invoke('import_modules', { data: cleanedData });
              break;
            case 'matieres':
              result = await invoke('import_matieres', { data: cleanedData });
              break;
            case 'enseignants':
              result = await invoke('import_enseignants', { data: cleanedData });
              break;
            case 'banques':
              result = await invoke('import_banques', { data: cleanedData });
              break;
            case 'promotions':
              result = await invoke('import_promotions', { data: cleanedData });
              break;
            case 'plafonds':
              result = await invoke('import_plafonds', { data: cleanedData });
              break;
            case 'annees_scolaires':
              result = await invoke('import_annees_scolaires', { data: cleanedData });
              break;
            case 'comptes_bancaires':
              result = await invoke('import_comptes_bancaires', { data: cleanedData });
              break;
            default:
              throw new Error('Type non supporté');
          }
          
          setImportResult(result);
        } catch (err) {
          setError(`Erreur lors de l'import: ${err}`);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError(`Erreur: ${err}`);
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    setError(null);
  };

  const config = ENTITY_CONFIG[activeTab];

  return (
    <Stack p="md" gap="lg">
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Import Excel</Title>
            <Text size="sm" c="gray.3">
              Importez vos données depuis des fichiers Excel
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconTableImport size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as EntityType)}>
        <Tabs.List grow>
          <Tabs.Tab value="cycles">Cycles</Tabs.Tab>
          <Tabs.Tab value="modules">Modules</Tabs.Tab>
          <Tabs.Tab value="matieres">Matières</Tabs.Tab>
          <Tabs.Tab value="enseignants">Enseignants</Tabs.Tab>
          <Tabs.Tab value="banques">Banques</Tabs.Tab>
          <Tabs.Tab value="promotions">Promotions</Tabs.Tab>
          <Tabs.Tab value="plafonds">Plafonds</Tabs.Tab>
          <Tabs.Tab value="annees_scolaires">Années Scolaires</Tabs.Tab>
          <Tabs.Tab value="comptes_bancaires">Comptes Bancaires</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Importer des {config.label}</Title>
              <Text size="sm" c="dimmed">
                Format attendu: {config.columns.join(', ')}
              </Text>
            </div>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={downloadTemplate}
            >
              Télécharger le template
            </Button>
          </Group>

          <Divider />

          <div
            style={{
              border: '2px dashed #ced4da',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#f8f9fa',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <IconFileExcel size={48} color="#2ecc71" />
            <Text size="lg" mt="md">
              {file ? file.name : 'Cliquez pour sélectionner un fichier Excel'}
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Formats acceptés: .xlsx, .xls
            </Text>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {previewData.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" mb="md">
                <Text fw={600}>Aperçu des données ({previewData.length} lignes)</Text>
                <Badge size="lg" variant="light" color="blue">
                  Total: {previewData.length} lignes
                </Badge>
              </Group>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {Object.keys(previewData[0] || {}).map((key) => (
                        <Table.Th key={key}>{key}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewData.map((row, idx) => (
                      <Table.Tr key={idx}>
                        {Object.values(row).map((value: any, i) => (
                          <Table.Td key={i}>{String(value)}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
              {error}
            </Alert>
          )}

          {importResult && (
            <Alert
              icon={importResult.errors.length === 0 ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
              color={importResult.errors.length === 0 ? 'green' : 'orange'}
              title={importResult.errors.length === 0 ? 'Import réussi' : 'Import partiel'}
            >
              <Stack gap="xs">
                <Text>
                  ✅ {importResult.success} {config.label} importés
                </Text>
                {importResult.errors.length > 0 && (
                  <>
                    <Divider />
                    <Text fw={600}>⚠️ {importResult.errors.length} erreurs :</Text>
                    <ScrollArea style={{ maxHeight: 200 }}>
                      {importResult.errors.map((err, idx) => (
                        <Text key={idx} size="sm" c="red">
                          • {err}
                        </Text>
                      ))}
                    </ScrollArea>
                  </>
                )}
              </Stack>
            </Alert>
          )}

          {file && (
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={resetImport}>
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                leftSection={<IconUpload size={16} />}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Importer
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Téléchargez le template correspondant à la table que vous souhaitez importer</Text>
          <Text size="sm">2. Remplissez le fichier Excel avec vos données (respectez les noms des colonnes)</Text>
          <Text size="sm">3. Les colonnes marquées d'un * sont obligatoires</Text>
          <Text size="sm">4. Sélectionnez votre fichier et cliquez sur "Importer"</Text>
          <Text size="sm">5. Vérifiez le résultat de l'import (succès/erreurs)</Text>
        </Stack>
        
        <Divider my="md" />
        
        <Title order={5} mb="md">📝 Notes importantes</Title>
        <Stack gap="xs">
          <Text size="sm">• Pour les modules, la colonne "cycle" doit correspondre à la désignation d'un cycle existant</Text>
          <Text size="sm">• Pour les matières, la colonne "module" doit correspondre à la désignation d'un module existant</Text>
          <Text size="sm">• Pour les enseignants, le statut doit être "interne" ou "externe"</Text>
          <Text size="sm">• Pour les enseignants, le titre doit être parmi: directeur, chef de division/service, agent, retraité, autre</Text>
          <Text size="sm">• Pour les années scolaires, le format doit être YYYY-YYYY (ex: 2025-2026)</Text>
          <Text size="sm">• Pour les comptes bancaires, l'enseignant et la banque doivent déjà exister dans la base</Text>
          <Text size="sm">• Les lignes en erreur sont ignorées, les lignes valides sont importées</Text>
        </Stack>
      </Card>
    </Stack>
  );
}