import { useState, useRef, useEffect } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Alert,
  Table,
  Badge,
  Divider,
  ThemeIcon,
  Select,
  Switch,
  SimpleGrid,
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Collapse,
  Paper,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPrinter,
  IconRefresh,
  IconFilter,
  IconDeviceFloppy,
  IconEye,
  IconFileInvoice,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================= TYPES =================
interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
}

interface Banque {
  id: number;
  designation: string;
}

interface Promotion {
  id: number;
  libelle: string;
  annee_scolaire: string | null;
}

interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

interface LigneOrdre {
  enseignant_id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut_enseignant: string;
  numero_compte: string | null;
  cle_rib: string | null;
  banque_designation: string | null;
  montant_brut: number;
  montant_retenu: number;
  montant_net: number;
}

interface EnteteOrdre {
  ministere: string;
  ecole: string;
  directeur_nom: string;
  directeur_titre: string;
  chef_service_nom: string;
  chef_service_titre: string;
  date_edition: string;
}

interface OrdreVirementOutput {
  id: number;
  numero_ordre: string;
  date_edition: string;
  objet: string;
  motif: string | null;
  total_net: number;
  filtre_banque: string | null;
  filtre_enseignant_id: string | null;
  filtre_mois: string | null;
  filtre_annee: number | null;
  filtre_annee_scolaire: string | null;
  filtre_promotion_libelle: string | null;
  filtre_cycle_designation: string | null;
  filtre_module_designation: string | null;
  filtre_matiere_designation: string | null;
  lignes: LigneOrdre[];
  entete: EnteteOrdre;
}

interface OrdreVirementDB {
  id: number;
  numero_ordre: string;
  date_edition: string;
  objet: string;
  motif: string | null;
  created_at: string;
  created_by: string | null;
}

interface OrdreFiltres {
  filtre_banque: string | null;
  filtre_enseignant_id: string | null;
  filtre_mois: string | null;
  filtre_annee: number | null;
  filtre_annee_scolaire: string | null;
  filtre_promotion_id: number | null;
  filtre_cycle_id: number | null;
  filtre_module_id: number | null;
  filtre_matiere_id: number | null;
  filtre_date_debut: string | null;
  filtre_date_fin: string | null;
}

// ================= CONSTANTES =================
const MOIS_OPTIONS = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' }, { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' }
];

const ANNEES_OPTIONS = [
  { value: '2024', label: '2024' }, { value: '2025', label: '2025' },
  { value: '2026', label: '2026' }, { value: '2027', label: '2027' },
];

const ANNEES_SCOLAIRES_OPTIONS = [
  { value: '2024-2025', label: '2024-2025' }, { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' }, { value: '2027-2028', label: '2027-2028' },
];

export default function OrdreVirement() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [savedOrdresVisible, setSavedOrdresVisible] = useState(false);
  const [selectedOrdreId, setSelectedOrdreId] = useState<number | null>(null);

  // État des filtres
  const [filters, setFilters] = useState({
    filtre_mois: null as string | null,
    filtre_annee: null as number | null,
    filtre_enseignant_id: null as string | null,
    filtre_banque: null as string | null,
    filtre_annee_scolaire: null as string | null,
    filtre_promotion_id: null as number | null,
    filtre_cycle_id: null as number | null,
    filtre_module_id: null as number | null,
    filtre_matiere_id: null as number | null,
    filtre_date_debut: null as Date | null,
    filtre_date_fin: null as Date | null,
  });

  // Récupérer les données référentielles
  const { data: enseignants = [], isLoading: enseignantsLoading } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: async () => {
      const result = await invoke('get_enseignants');
      return Array.isArray(result) ? result : [];
    },
  });

  const { data: banques = [], isLoading: banquesLoading } = useQuery<Banque[]>({
    queryKey: ['banques'],
    queryFn: async () => {
      const result = await invoke('get_banques');
      return Array.isArray(result) ? result : [];
    },
  });

  const { data: promotions = [], isLoading: promotionsLoading } = useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const result = await invoke('get_promotions');
      return Array.isArray(result) ? result : [];
    },
  });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: async () => {
      const result = await invoke('get_cycles');
      return Array.isArray(result) ? result : [];
    },
  });

  const { data: ordresSaved = [], isLoading: ordresLoading } = useQuery<OrdreVirementDB[]>({
    queryKey: ['ordres_virement'],
    queryFn: async () => {
      const result = await invoke('get_ordres_virement');
      return Array.isArray(result) ? result : [];
    },
    enabled: savedOrdresVisible,
  });

  const isLoading = enseignantsLoading || banquesLoading || promotionsLoading || cyclesLoading;

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (filtres: OrdreFiltres) =>
      invoke<OrdreVirementOutput>('generer_ordre_virement_simulation', { filtres }),
    onError: (err: any) => {
      console.error('Erreur génération:', err);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { filtres: OrdreFiltres; objet: string; motif?: string }) =>
      invoke<OrdreVirementOutput>('sauvegarder_ordre_virement', {
        filtres: data.filtres,
        objet: data.objet,
        motif: data.motif,
        created_by: 'Utilisateur'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordres_virement'] });
    },
    onError: (err: any) => {
      console.error('Erreur sauvegarde:', err);
    },
  });

  const loadOrdreMutation = useMutation({
    mutationFn: (id: number) => invoke<OrdreVirementOutput>('get_ordre_virement_by_id', { id }),
    onSuccess: (data) => {
      generateMutation.data = data;
      setSelectedOrdreId(null);
      setSavedOrdresVisible(false);
    },
    onError: (err: any) => {
      console.error('Erreur chargement:', err);
    },
  });

  const ordre = generateMutation.data;

  // Générer l'ordre
  const handleGenerer = () => {
    const filtres: OrdreFiltres = {
      filtre_banque: filters.filtre_banque || null,
      filtre_enseignant_id: filters.filtre_enseignant_id || null,
      filtre_mois: filters.filtre_mois || null,
      filtre_annee: filters.filtre_annee || null,
      filtre_annee_scolaire: filters.filtre_annee_scolaire || null,
      filtre_promotion_id: filters.filtre_promotion_id || null,
      filtre_cycle_id: filters.filtre_cycle_id || null,
      filtre_module_id: filters.filtre_module_id || null,
      filtre_matiere_id: filters.filtre_matiere_id || null,
      filtre_date_debut: filters.filtre_date_debut
        ? filters.filtre_date_debut.toISOString().split('T')[0]
        : null,
      filtre_date_fin: filters.filtre_date_fin
        ? filters.filtre_date_fin.toISOString().split('T')[0]
        : null,
    };
    generateMutation.mutate(filtres);
  };

  // Sauvegarder l'ordre
  const handleSauvegarder = () => {
    if (!ordre) return;

    const filtres: OrdreFiltres = {
      filtre_banque: filters.filtre_banque || null,
      filtre_enseignant_id: filters.filtre_enseignant_id || null,
      filtre_mois: filters.filtre_mois || null,
      filtre_annee: filters.filtre_annee || null,
      filtre_annee_scolaire: filters.filtre_annee_scolaire || null,
      filtre_promotion_id: filters.filtre_promotion_id || null,
      filtre_cycle_id: filters.filtre_cycle_id || null,
      filtre_module_id: filters.filtre_module_id || null,
      filtre_matiere_id: filters.filtre_matiere_id || null,
      filtre_date_debut: filters.filtre_date_debut
        ? filters.filtre_date_debut.toISOString().split('T')[0]
        : null,
      filtre_date_fin: filters.filtre_date_fin
        ? filters.filtre_date_fin.toISOString().split('T')[0]
        : null,
    };

    saveMutation.mutate({
      filtres,
      objet: `Ordre de virement - ${new Date().toLocaleDateString()}`,
      motif: 'Paiement des vacations'
    });
  };

  // Charger un ordre sauvegardé
  const handleLoadOrdre = (id: number) => {
    loadOrdreMutation.mutate(id);
  };

  // Impression
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      queryClient.invalidateQueries({ queryKey: ['banques'] });
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  const formatMoney = (value?: number | null) => (value ?? 0).toLocaleString('fr-FR');
  const total = ordre?.total_net ?? 0;

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des données...</Text>
      </Card>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* HEADER */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Ordre de virement</Title>
            <Text size="sm" c="gray.3">
              Générez et imprimez les ordres de virement pour les enseignants
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconFileInvoice size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* PANEL DES FILTRES */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group>
              <Button
                variant="light"
                onClick={() => setFiltersVisible(!filtersVisible)}
                leftSection={<IconFilter size={16} />}
              >
                Filtres
              </Button>
              <Button
                variant="light"
                onClick={() => setSavedOrdresVisible(!savedOrdresVisible)}
                leftSection={<IconEye size={16} />}
              >
                Ordres sauvegardés
              </Button>
              <Switch
                label="Auto refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
              />
            </Group>

            <Group>
              <Button
                onClick={handleGenerer}
                loading={generateMutation.isPending}
                leftSection={<IconRefresh size={16} />}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Générer
              </Button>
              {ordre && (
                <Button
                  onClick={handleSauvegarder}
                  loading={saveMutation.isPending}
                  leftSection={<IconDeviceFloppy size={16} />}
                  color="green"
                >
                  Sauvegarder
                </Button>
              )}
            </Group>
          </Group>

          <Collapse in={filtersVisible}>
            <Divider />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <Select
                label="Mois"
                placeholder="Sélectionner un mois"
                data={MOIS_OPTIONS}
                value={filters.filtre_mois}
                onChange={(val) => setFilters({ ...filters, filtre_mois: val })}
                clearable
              />
              <Select
                label="Année"
                placeholder="Sélectionner une année"
                data={ANNEES_OPTIONS}
                value={filters.filtre_annee?.toString()}
                onChange={(val) => setFilters({ ...filters, filtre_annee: val ? parseInt(val) : null })}
                clearable
              />
              <Select
                label="Année scolaire"
                placeholder="Sélectionner une année scolaire"
                data={ANNEES_SCOLAIRES_OPTIONS}
                value={filters.filtre_annee_scolaire}
                onChange={(val) => setFilters({ ...filters, filtre_annee_scolaire: val })}
                clearable
              />
              <Select
                label="Enseignant"
                placeholder="Tous"
                data={enseignants.map((e) => ({
                  value: e.id.toString(),
                  label: `${e.nom} ${e.prenom}`,
                }))}
                value={filters.filtre_enseignant_id}
                onChange={(val) => setFilters({ ...filters, filtre_enseignant_id: val })}
                clearable
                searchable
              />
              <Select
                label="Banque"
                placeholder="Toutes"
                data={banques.map((b) => ({
                  value: b.designation,
                  label: b.designation,
                }))}
                value={filters.filtre_banque}
                onChange={(val) => setFilters({ ...filters, filtre_banque: val })}
                clearable
              />
              <Select
                label="Promotion"
                placeholder="Toutes"
                data={promotions.map((p) => ({
                  value: p.id.toString(),
                  label: p.libelle,
                }))}
                value={filters.filtre_promotion_id?.toString()}
                onChange={(val) => setFilters({ ...filters, filtre_promotion_id: val ? parseInt(val) : null })}
                clearable
              />
              <Select
                label="Cycle"
                placeholder="Tous"
                data={cycles.map((c) => ({
                  value: c.id.toString(),
                  label: c.designation,
                }))}
                value={filters.filtre_cycle_id?.toString()}
                onChange={(val) => setFilters({ ...filters, filtre_cycle_id: val ? parseInt(val) : null })}
                clearable
              />
              <DateInput
                label="Date début"
                placeholder="JJ/MM/AAAA"
                value={filters.filtre_date_debut}
                onChange={(val) => setFilters({ ...filters, filtre_date_debut: val })}
                clearable
              />
              <DateInput
                label="Date fin"
                placeholder="JJ/MM/AAAA"
                value={filters.filtre_date_fin}
                onChange={(val) => setFilters({ ...filters, filtre_date_fin: val })}
                clearable
              />
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Card>

      {/* LISTE DES ORDRES SAUVEGARDÉS */}
      <Collapse in={savedOrdresVisible}>
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Ordres de virement sauvegardés</Title>
          {ordresLoading ? (
            <LoadingOverlay visible={true} />
          ) : ordresSaved.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun ordre sauvegardé
            </Alert>
          ) : (
            <ScrollArea style={{ maxHeight: 300 }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>N° Ordre</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Objet</Table.Th>
                    <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ordresSaved.map((o) => (
                    <Table.Tr key={o.id}>
                      <Table.Td>
                        <Badge color="blue" variant="light">{o.numero_ordre}</Badge>
                      </Table.Td>
                      <Table.Td>{o.date_edition}</Table.Td>
                      <Table.Td>{o.objet}</Table.Td>
                      <Table.Td>
                        <Button size="xs" variant="light" onClick={() => handleLoadOrdre(o.id)}>
                          Charger
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      </Collapse>

      {/* MESSAGE D'ERREUR */}
      {generateMutation.isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Erreur lors de la génération de l'ordre de virement. Vérifiez les filtres et réessayez.
        </Alert>
      )}

      {/* MESSAGE DE SUCCÈS */}
      {saveMutation.isSuccess && (
        <Alert icon={<IconCheck size={16} />} color="green" variant="light">
          Ordre de virement sauvegardé avec succès
        </Alert>
      )}

      {/* RÉSULTAT - ORDRE DE VIREMENT */}
      {ordre && ordre.lignes && ordre.lignes.length > 0 && (
        <>
          <Card withBorder radius="md" p="lg" ref={printRef}>
            {/* En-tête */}
            <Stack gap="md" style={{ textAlign: 'center' }}>
              <Text fw={700} size="lg">{ordre.entete.ministere}</Text>
              <Text>{ordre.entete.ecole}</Text>
              <Divider />
              <Title order={3}>ORDRE DE VIREMENT</Title>
              <Text>N° {ordre.numero_ordre}</Text>
              <Text>Date: {ordre.date_edition}</Text>
              <Text>Objet: {ordre.objet}</Text>
              {ordre.motif && <Text>Motif: {ordre.motif}</Text>}
            </Stack>

            {/* Filtres appliqués */}
            {(ordre.filtre_mois || ordre.filtre_annee || ordre.filtre_promotion_libelle) && (
              <Stack gap="xs" mt="md" p="sm" bg="gray.0" style={{ borderRadius: 8 }}>
                <Text size="sm" fw={500}>Filtres appliqués:</Text>
                <Group gap="xs">
                  {ordre.filtre_mois && (
                    <Badge variant="light">
                      Mois: {MOIS_OPTIONS.find(m => m.value === ordre.filtre_mois)?.label}
                    </Badge>
                  )}
                  {ordre.filtre_annee && (
                    <Badge variant="light">Année: {ordre.filtre_annee}</Badge>
                  )}
                  {ordre.filtre_annee_scolaire && (
                    <Badge variant="light">Année scolaire: {ordre.filtre_annee_scolaire}</Badge>
                  )}
                  {ordre.filtre_promotion_libelle && (
                    <Badge variant="light">Promotion: {ordre.filtre_promotion_libelle}</Badge>
                  )}
                </Group>
              </Stack>
            )}

            {/* Tableau des bénéficiaires */}
            <ScrollArea style={{ maxHeight: 500 }} mt="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 50 }}>N°</Table.Th>
                    <Table.Th>Enseignant</Table.Th>
                    <Table.Th>Statut</Table.Th>
                    <Table.Th>Banque</Table.Th>
                    <Table.Th>Compte</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Montant Net (FCFA)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ordre.lignes.map((ligne, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{idx + 1}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{ligne.nom} {ligne.prenom}</Text>
                        <Text size="xs" c="dimmed">{ligne.titre}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={ligne.statut_enseignant === 'interne' ? 'green' : 'orange'}>
                          {ligne.statut_enseignant === 'interne' ? 'Interne' : 'Externe'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{ligne.banque_designation || '—'}</Table.Td>
                      <Table.Td>{ligne.numero_compte || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {formatMoney(ligne.montant_net)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ backgroundColor: '#f5f5f5' }}>
                    <Table.Td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      TOTAL GÉNÉRAL
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em' }}>
                      {formatMoney(total)} FCFA
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>

            {/* Arrêté */}
            <Text mt="xl" fw={500}>
              Arrêté le présent ordre à la somme de : <strong>{formatMoney(total)} FCFA</strong>
            </Text>

            {/* Signatures */}
            <SimpleGrid cols={2} mt={60}>
              <Stack align="center" gap="xl">
                <Text>Le Chef du Service Financier</Text>
                <Text fw={700}>{ordre.entete.chef_service_nom || '_________________'}</Text>
                <Text size="sm">{ordre.entete.chef_service_titre || ''}</Text>
              </Stack>
              <Stack align="center" gap="xl">
                <Text>Le Directeur</Text>
                <Text fw={700}>{ordre.entete.directeur_nom || '_________________'}</Text>
                <Text size="sm">{ordre.entete.directeur_titre || ''}</Text>
              </Stack>
            </SimpleGrid>
          </Card>

          <Group justify="center">
            <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />} variant="outline">
              Imprimer
            </Button>
          </Group>
        </>
      )}

      {/* AUCUN RÉSULTAT */}
      {ordre && (!ordre.lignes || ordre.lignes.length === 0) && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="Aucun résultat">
          Aucune vacation trouvée pour les filtres sélectionnés.
        </Alert>
      )}

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Sélectionnez les filtres souhaités (mois, année, enseignant, etc.)</Text>
          <Text size="sm">2. Cliquez sur "Générer" pour créer l'ordre de virement</Text>
          <Text size="sm">2. L'ordre de virement est généré après validation de la vacation</Text>
          <Text size="sm">3. Vérifiez le tableau des bénéficiaires et les montants</Text>
          <Text size="sm">4. Sauvegardez l'ordre pour une utilisation ultérieure</Text>
          <Text size="sm">5. Imprimez l'ordre pour signature et transmission à la banque</Text>
        </Stack>
      </Card>
    </Stack>
  );
}