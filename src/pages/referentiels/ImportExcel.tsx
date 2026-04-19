import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconFileExcel,
  IconTableImport,
  IconUpload,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

type EntityType =
  | 'cycles'
  | 'modules'
  | 'matieres'
  | 'enseignants'
  | 'banques'
  | 'promotions'
  | 'plafonds'
  | 'annees_scolaires'
  | 'comptes_bancaires';

interface ImportResult {
  success: number;
  errors: string[];
}

interface EntityConfig {
  label: string;
  columns: string[];
  requiredColumns: string[];
  requiredOneOf?: string[][];
}

const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  cycles: {
    label: 'Cycles',
    columns: ['designation', 'nb_classe'],
    requiredColumns: ['designation', 'nb_classe'],
  },
  modules: {
    label: 'Modules',
    columns: ['designation', 'cycle', 'cycle_id'],
    requiredColumns: ['designation'],
    requiredOneOf: [['cycle', 'cycle_id']],
  },
  matieres: {
    label: 'Matieres',
    columns: ['designation', 'module', 'module_id', 'vhoraire', 'coefficient', 'observation'],
    requiredColumns: ['designation', 'vhoraire'],
    requiredOneOf: [['module', 'module_id']],
  },
  enseignants: {
    label: 'Enseignants',
    columns: [
      'nom',
      'prenom',
      'telephone',
      'titre',
      'statut',
      'banque',
      'numero_compte',
      'cle_rib',
    ],
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
    label: 'Annees scolaires',
    columns: ['libelle'],
    requiredColumns: ['libelle'],
  },
  comptes_bancaires: {
    label: 'Comptes bancaires',
    columns: ['enseignant_nom', 'enseignant_prenom', 'banque_designation', 'numero_compte'],
    requiredColumns: [
      'enseignant_nom',
      'enseignant_prenom',
      'banque_designation',
      'numero_compte',
    ],
  },
};

const TITRES = [
  'directeur',
  'chef de service',
  'chef de division/service',
  'agent',
  'retraite',
  'autre',
];

const normalizeColumnKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeColumnKey(key);

      if (!normalizedKey) {
        continue;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        cleaned[normalizedKey] = String(value);
      } else {
        cleaned[normalizedKey] = value;
      }
    }

    return cleaned;
  });

const getColumnErrors = (rows: Record<string, unknown>[], config: EntityConfig) => {
  const headers = new Set(Object.keys(rows[0] ?? {}));
  const missingColumns = config.requiredColumns.filter((column) => !headers.has(column));
  const missingAlternatives = (config.requiredOneOf ?? []).filter(
    (group) => !group.some((column) => headers.has(column))
  );

  const errors: string[] = [];

  if (missingColumns.length > 0) {
    errors.push(`Colonnes obligatoires manquantes: ${missingColumns.join(', ')}`);
  }

  for (const group of missingAlternatives) {
    errors.push(`Au moins une de ces colonnes est requise: ${group.join(' ou ')}`);
  }

  return errors;
};

export default function ImportExcel() {
  const [activeTab, setActiveTab] = useState<EntityType>('cycles');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const config = ENTITY_CONFIG[activeTab];

  useEffect(() => {
    setFile(null);
    setPreviewData([]);
    setPreviewCount(0);
    setImportResult(null);
    setError(null);
    setInputKey((current) => current + 1);
  }, [activeTab]);

  const readExcelRows = async (selectedFile: File) => {
    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error('Le fichier Excel ne contient aucune feuille');
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: '',
    });

    return normalizeRows(rows);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    setError(null);

    try {
      const rows = await readExcelRows(selectedFile);

      setPreviewCount(rows.length);
      setPreviewData(rows.slice(0, 10));

      if (rows.length === 0) {
        setError('Le fichier Excel est vide');
      }
    } catch (readError) {
      setPreviewData([]);
      setPreviewCount(0);
      setError('Erreur lors de la lecture du fichier Excel');
      console.error(readError);
    }
  };

  const downloadTemplate = () => {
    const templateData = [config.columns.reduce<Record<string, string | number>>((acc, column) => {
      acc[column] = '';
      return acc;
    }, {})];

    if (activeTab === 'cycles') {
      templateData[0] = { designation: 'Licence 1', nb_classe: 2 };
    } else if (activeTab === 'modules') {
      templateData[0] = { designation: 'Mathematiques', cycle: 'Licence 1' };
    } else if (activeTab === 'matieres') {
      templateData[0] = {
        designation: 'Algebre',
        module: 'Mathematiques',
        vhoraire: 2.5,
        coefficient: 1,
        observation: '',
      };
    } else if (activeTab === 'enseignants') {
      templateData[0] = {
        nom: 'DIOP',
        prenom: 'Amadou',
        telephone: '76123456',
        titre: 'agent',
        statut: 'interne',
        banque: 'Banque Malienne de Solidarite',
        numero_compte: '000123456789',
        cle_rib: '12',
      };
    } else if (activeTab === 'banques') {
      templateData[0] = { designation: 'Banque Nationale de Developpement' };
    } else if (activeTab === 'promotions') {
      templateData[0] = { libelle: '55eme promotion' };
    } else if (activeTab === 'plafonds') {
      templateData[0] = { titre: 'agent', statut: 'interne', volume_horaire_max: 100 };
    } else if (activeTab === 'annees_scolaires') {
      templateData[0] = { libelle: '2025-2026' };
    } else if (activeTab === 'comptes_bancaires') {
      templateData[0] = {
        enseignant_nom: 'DIOP',
        enseignant_prenom: 'Amadou',
        banque_designation: 'Banque Nationale de Developpement',
        numero_compte: '000123456789',
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `template_${activeTab}.xlsx`);
  };

  const handleImport = async () => {
    if (!file) {
      setError('Veuillez selectionner un fichier');
      return;
    }

    setImporting(true);
    setImportResult(null);
    setError(null);

    try {
      const cleanedData = await readExcelRows(file);

      if (cleanedData.length === 0) {
        setError('Le fichier Excel est vide');
        return;
      }

      const columnErrors = getColumnErrors(cleanedData, config);
      if (columnErrors.length > 0) {
        setError(columnErrors.join(' | '));
        return;
      }

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
          throw new Error('Type non supporte');
      }

      setImportResult(result);
    } catch (importError) {
      setError(`Erreur lors de l'import: ${importError}`);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setPreviewCount(0);
    setImportResult(null);
    setError(null);
    setInputKey((current) => current + 1);
  };

  return (
    <Stack p="md" gap="lg">
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">
              Import Excel
            </Title>
            <Text size="sm" c="gray.3">
              Importez vos donnees depuis des fichiers Excel
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
          <Tabs.Tab value="matieres">Matieres</Tabs.Tab>
          <Tabs.Tab value="enseignants">Enseignants</Tabs.Tab>
          <Tabs.Tab value="banques">Banques</Tabs.Tab>
          <Tabs.Tab value="promotions">Promotions</Tabs.Tab>
          <Tabs.Tab value="plafonds">Plafonds</Tabs.Tab>
          <Tabs.Tab value="annees_scolaires">Annees scolaires</Tabs.Tab>
          <Tabs.Tab value="comptes_bancaires">Comptes bancaires</Tabs.Tab>
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
              Telecharger le template
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
              {file ? file.name : 'Cliquez pour selectionner un fichier Excel'}
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Formats acceptes: .xlsx, .xls
            </Text>
            <input
              key={inputKey}
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
                <Text fw={600}>Apercu des donnees ({previewData.length} lignes affichees)</Text>
                <Badge size="lg" variant="light" color="blue">
                  Total: {previewCount} lignes
                </Badge>
              </Group>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {Object.keys(previewData[0] ?? {}).map((key) => (
                        <Table.Th key={key}>{key}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewData.map((row, rowIndex) => (
                      <Table.Tr key={rowIndex}>
                        {Object.values(row).map((value, valueIndex) => (
                          <Table.Td key={valueIndex}>{String(value)}</Table.Td>
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
              icon={
                importResult.errors.length === 0 ? (
                  <IconCheck size={16} />
                ) : (
                  <IconAlertCircle size={16} />
                )
              }
              color={importResult.errors.length === 0 ? 'green' : 'orange'}
              title={importResult.errors.length === 0 ? 'Import reussi' : 'Import partiel'}
            >
              <Stack gap="xs">
                <Text>
                  {importResult.success} {config.label} importes
                </Text>
                {importResult.errors.length > 0 && (
                  <>
                    <Divider />
                    <Text fw={600}>{importResult.errors.length} erreurs :</Text>
                    <ScrollArea style={{ maxHeight: 200 }}>
                      {importResult.errors.map((entry, index) => (
                        <Text key={index} size="sm" c="red">
                          - {entry}
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
        <Title order={5} mb="md">
          Instructions
        </Title>
        <Stack gap="xs">
          <Text size="sm">
            1. Telechargez le template correspondant a la table que vous souhaitez importer
          </Text>
          <Text size="sm">
            2. Remplissez le fichier Excel avec vos donnees en respectant les noms de colonnes
          </Text>
          <Text size="sm">3. Selectionnez votre fichier et cliquez sur Importer</Text>
          <Text size="sm">
            4. Verifiez le resultat de l'import et les erreurs eventuelles ligne par ligne
          </Text>
        </Stack>

        <Divider my="md" />

        <Title order={5} mb="md">
          Notes importantes
        </Title>
        <Stack gap="xs">
          <Text size="sm">- Respectez l'ordre d'import: cycles, modules, puis matieres</Text>
          <Text size="sm">
            - Pour les modules, utilisez la colonne cycle ou cycle_id d'un cycle deja existant
          </Text>
          <Text size="sm">
            - Pour les matieres, utilisez la colonne module ou module_id d'un module deja existant
          </Text>
          <Text size="sm">- Pour les enseignants, le statut doit etre interne ou externe</Text>
          <Text size="sm">- Pour les enseignants, le titre doit etre parmi: {TITRES.join(', ')}</Text>
          <Text size="sm">
            - Pour les annees scolaires, le format attendu est YYYY-YYYY, par exemple 2025-2026
          </Text>
          <Text size="sm">
            - Pour les comptes bancaires, la banque et l'enseignant doivent deja exister dans la base
          </Text>
          <Text size="sm">
            - Si vous voulez rattacher un compte a un enseignant pendant l'import, importez d'abord
            les banques puis les enseignants
          </Text>
          <Text size="sm">
            - Formatez telephone et numero_compte en texte dans Excel pour conserver les zeros initiaux
          </Text>
          <Text size="sm">
            - Les entetes sont normalises automatiquement: espaces, accents et tirets sont toleres
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
