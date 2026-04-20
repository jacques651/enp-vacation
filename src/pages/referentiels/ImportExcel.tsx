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
  Tabs,
  Paper,
  ScrollArea,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { IconUpload, IconFileExcel, IconCheck, IconDownload, IconAlertCircle, IconTableImport } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

// Types pour les imports
type EntityType = 'cycles' | 'modules' | 'matieres' | 'enseignants' | 'banques' | 'promotions' | 'plafonds' | 'annees_scolaires' | 'comptes_bancaires';

interface ImportResult {
  success: number;
  errors: string[];
}

// Type pour les lignes du fichier Excel
type ExcelRow = Record<string, any>;

const ENTITY_CONFIG: Record<EntityType, { label: string; columns: string[]; requiredColumns: string[]; backendFunction: string }> = {
  cycles: {
    label: 'Cycles',
    columns: ['designation', 'nb_classe'],
    requiredColumns: ['designation'],
    backendFunction: 'import_cycles',
  },
  modules: {
    label: 'Modules',
    columns: ['designation', 'cycle_id', 'cycle'],
    requiredColumns: ['designation'],
    backendFunction: 'import_modules',
  },
  matieres: {
    label: 'Matières',
    columns: ['designation', 'module_id', 'module', 'vhoraire', 'coefficient', 'observation'],
    requiredColumns: ['designation', 'vhoraire'],
    backendFunction: 'import_matieres',
  },
  enseignants: {
    label: 'Enseignants',
    columns: ['nom', 'prenom', 'telephone', 'titre', 'statut'],
    requiredColumns: ['nom', 'prenom', 'titre', 'statut'],
    backendFunction: 'import_enseignants',
  },
  banques: {
    label: 'Banques',
    columns: ['designation'],
    requiredColumns: ['designation'],
    backendFunction: 'import_banques',
  },
  promotions: {
    label: 'Promotions',
    columns: ['libelle'],
    requiredColumns: ['libelle'],
    backendFunction: 'import_promotions',
  },
  plafonds: {
    label: 'Plafonds',
    columns: ['titre', 'statut', 'volume_horaire_max'],
    requiredColumns: ['titre', 'statut', 'volume_horaire_max'],
    backendFunction: 'import_plafonds',
  },
  annees_scolaires: {
    label: 'Années Scolaires',
    columns: ['libelle'],
    requiredColumns: ['libelle'],
    backendFunction: 'import_annees_scolaires',
  },
  comptes_bancaires: {
    label: 'Comptes Bancaires',
    columns: ['enseignant_nom', 'enseignant_prenom', 'banque_designation', 'numero_compte', 'cle_rib'],
    requiredColumns: ['enseignant_nom', 'enseignant_prenom', 'banque_designation', 'numero_compte'],
    backendFunction: 'import_comptes_bancaires',
  },
};

export default function ImportExcel() {
  const [activeTab, setActiveTab] = useState<EntityType>('cycles');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [rawColumns, setRawColumns] = useState<string[]>([]);

  // Valider les colonnes requises
  const validateColumns = (data: ExcelRow[], entityType: EntityType): { missing: string[]; available: string[] } => {
    if (data.length === 0) return { missing: [], available: [] };
    
    const config = ENTITY_CONFIG[entityType];
    const availableColumns = Object.keys(data[0]).map(k => k.toLowerCase());
    
    // Pour modules et matieres, les colonnes requises sont flexibles
    if (entityType === 'modules') {
      const hasCycleId = availableColumns.includes('cycle_id');
      const hasCycle = availableColumns.includes('cycle') || availableColumns.includes('cycle_designation');
      const missing = [];
      if (!hasCycleId && !hasCycle) {
        missing.push('cycle_id ou cycle');
      }
      return { missing, available: availableColumns };
    }
    
    if (entityType === 'matieres') {
      const hasModuleId = availableColumns.includes('module_id');
      const hasModule = availableColumns.includes('module') || availableColumns.includes('module_designation');
      const missing = [];
      if (!hasModuleId && !hasModule) {
        missing.push('module_id ou module');
      }
      return { missing, available: availableColumns };
    }
    
    const missingColumns = config.requiredColumns.filter(
      col => !availableColumns.includes(col.toLowerCase())
    );
    
    return { missing: missingColumns, available: availableColumns };
  };

  // Détecter automatiquement le mapping des colonnes
  const autoDetectMapping = (availableColumns: string[], entityType: EntityType): Record<string, string> => {
    const config = ENTITY_CONFIG[entityType];
    const mapping: Record<string, string> = {};
    
    for (const requiredCol of config.requiredColumns) {
      const match = availableColumns.find(col => 
        col === requiredCol ||
        col.includes(requiredCol) ||
        requiredCol.includes(col)
      );
      if (match) {
        mapping[requiredCol] = match;
      }
    }
    
    return mapping;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);
    setError(null);
    setShowMapping(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ExcelRow[];
        
        setPreviewData(jsonData.slice(0, 10));
        
        if (jsonData.length === 0) {
          setError('Le fichier Excel est vide');
          return;
        }

        const availableColumns = Object.keys(jsonData[0]);
        setRawColumns(availableColumns);
        
        const { missing, available } = validateColumns(jsonData, activeTab);
        
        if (missing.length > 0) {
          const autoMapping = autoDetectMapping(available, activeTab);
          setColumnMapping(autoMapping);
          setShowMapping(true);
        } else {
          setShowMapping(false);
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
    let templateData: ExcelRow[] = [];
    
    switch (activeTab) {
      case 'cycles':
        templateData = [
          { designation: 'EL Sous-officiers PN', nb_classe: 25 },
          { designation: 'EL Agents PM', nb_classe: 1 },
          { designation: 'EL Assistants PM', nb_classe: 1 },
          { designation: 'EL Contrôleurs PM', nb_classe: 1 },
          { designation: 'EL Inspecteurs PM', nb_classe: 1 },
        ];
        break;
      case 'modules':
        templateData = [
          { designation: 'Module 1', cycle_id: 1 },
          { designation: 'Module 2', cycle_id: 1 },
          { designation: 'Module 3', cycle: 'EL Sous-officiers PN' },
        ];
        break;
      case 'matieres':
        templateData = [
          { designation: 'Mathématiques', module_id: 1, vhoraire: 60 },
          { designation: 'Français', module: 'Module 1', vhoraire: 45 },
        ];
        break;
      case 'enseignants':
        templateData = [
          { nom: 'KORGO', prenom: 'Jacques', telephone: '75118161', titre: 'agent', statut: 'externe' },
          { nom: 'DJAFOU', prenom: 'Boureima', telephone: '75301138', titre: 'chef de service', statut: 'interne' },
          { nom: 'OUATTARA', prenom: 'Moussa', telephone: '70123456', titre: 'directeur', statut: 'interne' },
        ];
        break;
      case 'banques':
        templateData = [
          { designation: 'ORABANK' },
          { designation: 'CORIS BANK INTERNATIONALE' },
          { designation: 'ECOBANK' },
        ];
        break;
      case 'promotions':
        templateData = [
          { libelle: '55ème promotion' },
          { libelle: '56ème promotion' },
        ];
        break;
      case 'plafonds':
        templateData = [
          { titre: 'agent', statut: 'interne', volume_horaire_max: 180 },
          { titre: 'directeur', statut: 'interne', volume_horaire_max: 140 },
          { titre: 'chef de service', statut: 'interne', volume_horaire_max: 160 },
          { titre: 'agent', statut: 'externe', volume_horaire_max: 180 },
          { titre: 'directeur', statut: 'externe', volume_horaire_max: 140 },
        ];
        break;
      case 'annees_scolaires':
        templateData = [
          { libelle: '2025-2026' },
          { libelle: '2026-2027' },
        ];
        break;
      case 'comptes_bancaires':
        templateData = [
          { enseignant_nom: 'KORGO', enseignant_prenom: 'Jacques', banque_designation: 'ORABANK', numero_compte: '612095100001', cle_rib: '23' },
          { enseignant_nom: 'DJAFOU', enseignant_prenom: 'Boureima', banque_designation: 'ECOBANK', numero_compte: '612095100002', cle_rib: '45' },
        ];
        break;
      default:
        templateData = [config.columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})];
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
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ExcelRow[];

          if (jsonData.length === 0) {
            setError('Le fichier Excel est vide');
            setImporting(false);
            return;
          }
          
          let cleanedData: ExcelRow[] = jsonData;
          
          if (showMapping && Object.keys(columnMapping).length > 0) {
            cleanedData = jsonData.map((row: ExcelRow) => {
              const mapped: ExcelRow = {};
              for (const [target, source] of Object.entries(columnMapping)) {
                if (row[source]) {
                  mapped[target] = row[source];
                }
              }
              for (const [key, value] of Object.entries(row)) {
                if (!Object.values(columnMapping).includes(key)) {
                  mapped[key] = value;
                }
              }
              return mapped;
            });
          }

          const normalizedData = cleanedData.map((row: ExcelRow) => {
            const normalized: ExcelRow = {};
            for (const key of Object.keys(row)) {
              const normalizedKey = key.toLowerCase().trim();
              let value = row[key];
              
              // Convertir les nombres en chaînes pour cle_rib si nécessaire
              if (normalizedKey === 'cle_rib' && typeof value === 'number') {
                value = value.toString();
              }
              
              normalized[normalizedKey] = value;
            }
            return normalized;
          });

          const config = ENTITY_CONFIG[activeTab];
          let result: ImportResult;
          
          console.log(`📊 Import de ${normalizedData.length} lignes pour ${config.label}`);
          console.log("Première ligne:", normalizedData[0]);
          
          result = await invoke(config.backendFunction, { data: normalizedData });
          
          console.log("Résultat import:", result);
          setImportResult(result);
          
          if (result.errors.length === 0) {
            setTimeout(() => {
              resetImport();
            }, 3000);
          }
        } catch (err: any) {
          console.error("Erreur détaillée:", err);
          setError(`Erreur lors de l'import: ${err.message || err}`);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(`Erreur: ${err.message || err}`);
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    setError(null);
    setShowMapping(false);
    setColumnMapping({});
    setRawColumns([]);
  };

  const updateColumnMapping = (target: string, source: string) => {
    setColumnMapping(prev => ({ ...prev, [target]: source }));
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

      <Tabs value={activeTab} onChange={(value) => {
        setActiveTab(value as EntityType);
        resetImport();
      }}>
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
                Colonnes requises: {config.requiredColumns.join(', ')}
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

          {rawColumns.length > 0 && (
            <Alert color="blue" variant="light" title="Colonnes détectées dans le fichier">
              <Group gap="xs">
                {rawColumns.map((col) => (
                  <Badge key={col} color={config.requiredColumns.includes(col) ? "green" : "gray"} variant="light">
                    {col}
                  </Badge>
                ))}
              </Group>
            </Alert>
          )}

          {showMapping && (
            <Paper withBorder p="md" radius="md" bg="yellow.0">
              <Stack gap="md">
                <Group>
                  <IconAlertCircle size={20} color="#fab005" />
                  <Text fw={600}>Mapping des colonnes requis</Text>
                </Group>
                <Text size="sm">
                  Certaines colonnes obligatoires n'ont pas été trouvées. Veuillez les mapper :
                </Text>
                {config.requiredColumns.map((requiredCol) => (
                  <Select
                    key={requiredCol}
                    label={`Colonne pour "${requiredCol}"`}
                    placeholder="Sélectionner une colonne"
                    value={columnMapping[requiredCol] || ''}
                    onChange={(value) => updateColumnMapping(requiredCol, value || '')}
                    data={rawColumns.map(col => ({ value: col, label: col }))}
                    required
                  />
                ))}
                <Group justify="flex-end">
                  <Button variant="light" onClick={() => setShowMapping(false)} size="sm">
                    Ignorer
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

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

          {file && !importResult && (
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
          <Text size="sm">• Pour les modules, utilisez "cycle_id" (l'ID du cycle) ou "cycle" (le nom du cycle)</Text>
          <Text size="sm">• Pour les matières, utilisez "module_id" (l'ID du module) ou "module" (le nom du module)</Text>
          <Text size="sm">• Pour les enseignants, le statut doit être "interne" ou "externe"</Text>
          <Text size="sm">• Pour les enseignants, le titre doit être parmi: directeur, chef de service, chef de division/service, agent, retraité, autre</Text>
          <Text size="sm">• Le volume horaire maximum (vh_max) est automatiquement défini par le plafond correspondant</Text>
          <Text size="sm">• Pour les années scolaires, le format doit être YYYY-YYYY (ex: 2025-2026)</Text>
          <Text size="sm">• Pour les comptes bancaires, l'enseignant et la banque doivent déjà exister dans la base</Text>
          <Text size="sm">• La clé RIB (cle_rib) doit être au format texte</Text>
          <Text size="sm">• Les lignes en erreur sont ignorées, les lignes valides sont importées</Text>
          <Text size="sm">• Assurez-vous que les plafonds existent avant d'importer les enseignants</Text>
        </Stack>
      </Card>
    </Stack>
  );
}