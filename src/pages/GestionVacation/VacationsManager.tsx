import { useState, useMemo } from 'react';
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
  TextInput,
  Select,
  NumberInput,
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Modal,
  SimpleGrid,
  Collapse,
  Grid,
  MultiSelect,
  Pagination,
} from '@mantine/core';
import {
  IconCalendar,
  IconCheck,
  IconAlertCircle,
  IconEdit,
  IconTrash,
  IconPlus,
  IconSearch,
  IconFilter,
  IconEye,
  IconCalculator,
} from '@tabler/icons-react';
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

interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

interface Module {
  id: number;
  designation: string;
  cycle_id: number;
}

interface Matiere {
  id: number;
  designation: string;
  vhoraire: number;
  module_id: number;
}

interface Promotion {
  id: number;
  libelle: string;
}

interface AnneeScolaire {
  id: number;
  libelle: string;
}

interface VacationResponse {
  id: number;
  enseignant_id: number;
  cycle_id: number;
  module_id: number;
  matiere_id: number;
  nb_classe: number;

  vhoraire_matiere: number; // ✔ IMPORTANT

  taux_horaire: number;
  taux_retenue: number;
  vht: number;

  montant_brut: number;
  montant_retenu: number;
  montant_net: number;

  mois: string;
  annee: number;
  date_traitement: string;

  annee_scolaire: string;
  promotion_id: number;

  nom_enseignant?: string;
  prenom_enseignant?: string;
  libelle_cycle?: string;
  libelle_module?: string;
  libelle_matiere?: string;
  libelle_promotion?: string;
}
interface VacationInput {
  enseignant_id: number;
  cycle_id: number;
  module_id: number;
  matiere_id: number;
  nb_classe: number | null;
  taux_horaire: number | null;
  taux_retenue: number | null;
  mois: string;
  annee: number;
  annee_scolaire: string;
  promotion_id: number;
}

interface VacationCalculated {
  volume_horaire_max_enseignant: number;
  cumul_volume_horaire_enseignant: number;
  volume_horaire_restant_enseignant: number;

  vht_total_cycle_matiere: number;
  cumul_vht_cycle_matiere: number;
  vht_restant_cycle_matiere: number;

  nb_classe: number;

  vhoraire_matiere: number; // ✔ IMPORTANT

  vht_demande: number;

  montant_brut: number;
  montant_retenu: number;
  montant_net: number;

  enseignant_ok: boolean;
  cycle_matiere_ok: boolean;
  global_ok: boolean;

  message: string;
}
// ================= BUILD BACKEND PAYLOAD =================
const buildBackendPayload = (formData: VacationInput) => {
  return {
    enseignant_id: formData.enseignant_id,
    matiere_id: formData.matiere_id,
    promotion_id: formData.promotion_id,
    annee_scolaire_id: Number(formData.annee_scolaire),
    nb_classe: formData.nb_classe ?? 0,
    mois: Number(formData.mois),
    annee: formData.annee,
  };
};

// ================= CONSTANTES =================
const MOIS_OPTIONS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' }
];

// ================= COMPOSANT PRINCIPAL =================
export default function VacationsManager() {
  const queryClient = useQueryClient();

  // États du formulaire
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<VacationResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState<VacationCalculated | null>(null);

  // États de recherche et pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  // État du formulaire
  const [formData, setFormData] = useState<VacationInput>({
    enseignant_id: 0,
    cycle_id: 0,
    module_id: 0,
    matiere_id: 0,
    nb_classe: null,
    taux_horaire: 5000,
    taux_retenue: 2,
    mois: new Date().getMonth() + 1 + '',
    annee: new Date().getFullYear(),
    annee_scolaire: '',
    promotion_id: 0,
  });

  // Récupérer les données référentielles
  const { data: enseignants = [] } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: () => invoke('get_enseignants'),
  });

  const { data: cycles = [] } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: () => invoke('get_cycles'),
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => invoke('get_modules'),
  });

  const { data: matieres = [] } = useQuery<Matiere[]>({
    queryKey: ['matieres'],
    queryFn: () => invoke('get_matieres'),
  });

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: () => invoke('get_promotions'),
  });

  const { data: anneesScolaires = [] } = useQuery<AnneeScolaire[]>({
    queryKey: ['annees_scolaires'],
    queryFn: () => invoke('get_annees_scolaires'),
  });

  // Récupérer toutes les vacations
  const { data: vacations = [], isLoading, error } = useQuery<VacationResponse[]>({
  queryKey: ['vacations'],
  queryFn: async () => {
    try {
      console.log("TEST INVOKE...");

      const result = await invoke('get_vacations');

      console.log("VACATIONS OK:", result);

      if (!Array.isArray(result)) {
        console.warn("RESULT N'EST PAS UN TABLEAU:", result);
        return [];
      }

      return result;
    } catch (e) {
      console.error("ERREUR BACKEND:", e);
      throw e;
    }
  },
});

  // Filtrer les vacations
  const filteredVacations = useMemo(() => {
    if (!searchTerm) return vacations;
    const search = searchTerm.toLowerCase();
    return vacations.filter(v =>
      v.nom_enseignant?.toLowerCase().includes(search) ||
      v.prenom_enseignant?.toLowerCase().includes(search) ||
      v.libelle_matiere?.toLowerCase().includes(search)
    );
  }, [vacations, searchTerm]);

  // Pagination
  const totalItems = filteredVacations.length;
  const totalPages = Math.ceil(totalItems / parseInt(itemsPerPage));
  const paginatedVacations = filteredVacations.slice(
    (currentPage - 1) * parseInt(itemsPerPage),
    currentPage * parseInt(itemsPerPage)
  );

  // Statistiques
  const stats = useMemo(() => {
    const totalBrut = paginatedVacations.reduce((sum, v) => sum + (v.montant_brut ?? 0), 0);
    const totalRetenu = paginatedVacations.reduce((sum, v) => sum + (v.montant_retenu ?? 0), 0);
    const totalNet = paginatedVacations.reduce((sum, v) => sum + (v.montant_net ?? 0), 0);
    const totalHours = paginatedVacations.reduce((sum, v) => sum + (v.vht ?? 0), 0);
    return { totalBrut, totalRetenu, totalNet, totalHours, count: totalItems };
  }, [paginatedVacations, totalItems]);

  const formatNumber = (value: number | null | undefined): string => {
    return (value ?? 0).toLocaleString();
  };

  // ================= MUTATIONS =================
  const createMutation = useMutation({
    mutationFn: (data: VacationInput) =>
      invoke('create_vacation', { input: buildBackendPayload(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setModalOpened(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & VacationInput) =>
      invoke('update_vacation', { id, input: buildBackendPayload(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setModalOpened(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_vacation', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setDeleteId(null);
    },
  });

  // Fonctions utilitaires
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      enseignant_id: 0,
      cycle_id: 0,
      module_id: 0,
      matiere_id: 0,
      nb_classe: null,
      taux_horaire: 5000,
      taux_retenue: 2,
      mois: new Date().getMonth() + 1 + '',
      annee: new Date().getFullYear(),
      annee_scolaire: anneesScolaires[0]?.id.toString() || '',
      promotion_id: 0,
    });
    setCalculatedValues(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: VacationResponse) => {
    setEditingId(item.id);
    setFormData({
      enseignant_id: item.enseignant_id,
      cycle_id: item.cycle_id,
      module_id: item.module_id,
      matiere_id: item.matiere_id,
      nb_classe: item.nb_classe,
      taux_horaire: item.taux_horaire,
      taux_retenue: item.taux_retenue,
      mois: item.mois,
      annee: item.annee,
      annee_scolaire: item.annee_scolaire,
      promotion_id: item.promotion_id,
    });
    setModalOpened(true);
  };

  const handleCalculate = async () => {
    if (
      formData.enseignant_id === 0 ||
      formData.matiere_id === 0 ||
      !formData.nb_classe ||
      !formData.annee_scolaire
    ) return;

    setCalculating(true);

    try {
      const payload = buildBackendPayload(formData);

      const result = await invoke<VacationCalculated>(
        "calculate_vacation",
        { input: payload }
      );

      setCalculatedValues(result); // ✔ essentiel
    } catch (e) {
      console.error("Erreur calcul:", e);
    } finally {
      setCalculating(false);
    }
  };
  
  const handleSubmit = () => {
    if (
      formData.enseignant_id === 0 ||
      formData.matiere_id === 0 ||
      !formData.nb_classe ||
      formData.nb_classe < 1 ||
      formData.promotion_id === 0 ||
      !formData.annee_scolaire
    ) {
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des vacations...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les vacations
        </Alert>
      </Card>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* HEADER */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Gestion des Vacations</Title>
            <Text size="sm" c="gray.3">
              {stats.count} vacation{stats.count > 1 ? 's' : ''} enregistrée{stats.count > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconCalendar size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* KPI CARDS */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Total vacations</Text>
          <Text fw={700} size="xl" c="blue">{stats.count}</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Heures totales</Text>
          <Text fw={700} size="xl" c="cyan">{stats.totalHours.toFixed(1)}h</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Montant brut</Text>
          <Text fw={700} size="xl" c="green">{formatNumber(stats.totalBrut)} F</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Montant net</Text>
          <Text fw={700} size="xl" c="teal">{formatNumber(stats.totalNet)} F</Text>
        </Card>
      </SimpleGrid>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Liste des vacations</Title>
              <Text size="sm" c="dimmed">
                Gérez les paiements des enseignants par vacation
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Nouvelle vacation
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE ET FILTRES */}
          <Group grow>
            <TextInput
              placeholder="Rechercher un enseignant ou une matière..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Button
              variant="light"
              onClick={() => setShowFilters(!showFilters)}
              leftSection={<IconFilter size={16} />}
            >
              Filtres
            </Button>
          </Group>

          <Collapse in={showFilters}>
            <Grid>
              <Grid.Col span={6}>
                <MultiSelect
                  label="Cycles"
                  data={cycles.map(c => ({ value: String(c.id), label: c.designation }))}
                  placeholder="Filtrer par cycles"
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <MultiSelect
                  label="Modules"
                  data={modules.map(m => ({ value: String(m.id), label: m.designation }))}
                  placeholder="Filtrer par modules"
                  clearable
                />
              </Grid.Col>
            </Grid>
          </Collapse>

          {/* TABLEAU DES VACATIONS */}
          {paginatedVacations.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune vacation trouvée. Cliquez sur "Nouvelle vacation" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 500 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Enseignant</Table.Th>
                      <Table.Th>Cycle</Table.Th>
                      <Table.Th>Matière</Table.Th>
                      <Table.Th>Heures</Table.Th>
                      <Table.Th>Brut</Table.Th>
                      <Table.Th>Net</Table.Th>
                      <Table.Th>Période</Table.Th>
                      <Table.Th style={{ width: 100, textAlign: 'center' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedVacations.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.nom_enseignant} {item.prenom_enseignant}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue" variant="light" size="sm">
                            {item.libelle_cycle}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.libelle_matiere}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{(item.vht ?? 0).toFixed(1)}h</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatNumber(item.montant_brut)} F</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={700} c="blue">{formatNumber(item.montant_net)} F</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {MOIS_OPTIONS.find(m => m.value === item.mois)?.label} {item.annee}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="center">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => openEditModal(item)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setDeleteId(item.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => setViewItem(item)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <Group justify="space-between" mt="md">
                  <Select
                    value={itemsPerPage}
                    onChange={(val) => {
                      setItemsPerPage(val || '20');
                      setCurrentPage(1);
                    }}
                    data={['10', '20', '50', '100']}
                    style={{ width: 100 }}
                  />
                  <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} />
                </Group>
              )}
            </>
          )}

          {/* MESSAGE DE SUCCÈS */}
          {(createMutation.isSuccess || updateMutation.isSuccess) && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Vacation {createMutation.isSuccess ? 'créée' : 'modifiée'} avec succès
            </Alert>
          )}
        </Stack>
      </Card>

      {/* MODAL D'AJOUT / MODIFICATION */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          resetForm();
        }}
        title={editingId ? "Modifier la vacation" : "Nouvelle vacation"}
        size="xl"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Enseignant"
              placeholder="Sélectionnez un enseignant"
              data={enseignants.map(e => ({ value: String(e.id), label: `${e.nom} ${e.prenom}` }))}
              value={String(formData.enseignant_id || '')}
              onChange={(val) => setFormData({ ...formData, enseignant_id: parseInt(val || '0') })}
              withAsterisk
            />
            <Select
              label="Cycle"
              placeholder="Sélectionnez un cycle"
              data={cycles.map(c => ({ value: String(c.id), label: c.designation }))}
              value={String(formData.cycle_id || '')}
              onChange={(val) => {
                const cycleId = parseInt(val || '0');
                setFormData({
                  ...formData,
                  cycle_id: cycleId,
                  module_id: 0,
                  matiere_id: 0
                });
              }}
              withAsterisk
            />
            <Select
              label="Module"
              placeholder="Sélectionnez un module"
              data={modules
                .filter(m => m.cycle_id === formData.cycle_id)
                .map(m => ({ value: String(m.id), label: m.designation }))}
              value={String(formData.module_id || '')}
              onChange={(val) => {
                const moduleId = parseInt(val || '0');
                setFormData({
                  ...formData,
                  module_id: moduleId,
                  matiere_id: 0
                });
              }}
              withAsterisk
              disabled={!formData.cycle_id}
            />
            <Select
              label="Matière"
              placeholder="Sélectionnez une matière"
              data={matieres
                .filter(m => m.module_id === formData.module_id)
                .map(m => ({ value: String(m.id), label: m.designation }))}
              value={String(formData.matiere_id || '')}
              onChange={(val) => setFormData({ ...formData, matiere_id: parseInt(val || '0') })}
              withAsterisk
              disabled={!formData.module_id}
            />
            <NumberInput
              label="Nombre de classes"
              placeholder="Ex: 3"
              value={formData.nb_classe || undefined}
              onChange={(val) => setFormData({ ...formData, nb_classe: val as number })}
              min={1}
              withAsterisk
            />
            <Select
              label="Promotion"
              placeholder="Sélectionnez une promotion"
              data={promotions.map(p => ({ value: String(p.id), label: p.libelle }))}
              value={String(formData.promotion_id || '')}
              onChange={(val) => setFormData({ ...formData, promotion_id: parseInt(val || '0') })}
              withAsterisk
            />
            <NumberInput
              label="Taux horaire (F CFA)"
              value={formData.taux_horaire || undefined}
              onChange={(val) => setFormData({ ...formData, taux_horaire: val as number })}
              min={1}
              withAsterisk
            />
            <NumberInput
              label="Taux de retenue (%)"
              value={formData.taux_retenue || undefined}
              onChange={(val) => setFormData({ ...formData, taux_retenue: val as number })}
              min={0}
              max={100}
              withAsterisk
            />
            <Select
              label="Mois"
              data={MOIS_OPTIONS}
              value={formData.mois}
              onChange={(val) => setFormData({ ...formData, mois: val || '1' })}
              withAsterisk
            />
            <NumberInput
              label="Année"
              value={formData.annee}
              onChange={(val) => setFormData({ ...formData, annee: val as number })}
              min={2000}
              max={2100}
              withAsterisk
            />
            <Select
              label="Année scolaire"
              data={anneesScolaires.map(a => ({
                value: String(a.id),
                label: a.libelle
              }))}
              value={formData.annee_scolaire}
              onChange={(val) =>
                setFormData({ ...formData, annee_scolaire: val || '' })
              }
              withAsterisk
            />
          </SimpleGrid>

          {/* Aperçu des calculs */}
          {calculatedValues && (
            <Card withBorder bg="gray.0" p="sm">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm">Aperçu du calcul</Text>
                <Badge color={calculatedValues.global_ok ? "green" : "red"}>
                  {calculatedValues.global_ok ? "Valide" : "Invalide"}
                </Badge>
              </Group>
              <SimpleGrid cols={3} spacing="xs">
                <Text size="xs">VHT: {calculatedValues.vht_demande?.toFixed(1)}h</Text>
                <Text size="xs">Brut: {formatNumber(calculatedValues.montant_brut)} F</Text>
                <Text size="xs">Net: {formatNumber(calculatedValues.montant_net)} F</Text>
              </SimpleGrid>
              <Text size="xs" c="dimmed" mt="xs">{calculatedValues.message}</Text>
            </Card>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleCalculate} loading={calculating}>
              Calculer
            </Button>
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              {editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DE CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmation"
        centered
      >
        <Stack>
          <Text>Êtes-vous sûr de vouloir supprimer cette vacation ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              loading={deleteMutation.isPending}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DE VISUALISATION */}
      <Modal
        opened={viewItem !== null}
        onClose={() => setViewItem(null)}
        title="Détails de la vacation"
        size="md"
      >
        {viewItem && (
          <Stack gap="md">
            <Group>
              <Text fw={700}>Enseignant:</Text>
              <Text>{viewItem.nom_enseignant} {viewItem.prenom_enseignant}</Text>
            </Group>
            <Group>
              <Text fw={700}>Matière:</Text>
              <Text>{viewItem.libelle_matiere}</Text>
            </Group>
            <Group>
              <Text fw={700}>Cycle:</Text>
              <Badge>{viewItem.libelle_cycle}</Badge>
            </Group>
            <Divider />
            <Group>
              <Text fw={700}>Volume horaire:</Text>
              <Text>{(viewItem.vht ?? 0).toFixed(1)} heures</Text>
            </Group>
            <Group>
              <Text fw={700}>Montant brut:</Text>
              <Text>{formatNumber(viewItem.montant_brut)} F</Text>
            </Group>
            <Group>
              <Text fw={700}>Retenue:</Text>
              <Text>{formatNumber(viewItem.montant_retenu)} F</Text>
            </Group>
            <Group>
              <Text fw={700}>Montant net:</Text>
              <Text fw={700} c="blue">{formatNumber(viewItem.montant_net)} F</Text>
            </Group>
            <Divider />
            <Group>
              <Text fw={700}>Période:</Text>
              <Text>{MOIS_OPTIONS.find(m => m.value === viewItem.mois)?.label} {viewItem.annee}</Text>
            </Group>
            <Group>
              <Text fw={700}>Date de traitement:</Text>
              <Text>{new Date(viewItem.date_traitement).toLocaleDateString()}</Text>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Remplissez tous les champs obligatoires pour créer une vacation</Text>
          <Text size="sm">2. Utilisez le bouton "Calculer" pour prévisualiser les montants</Text>
          <Text size="sm">3. Les vacations sont calculées automatiquement selon les règles en vigueur</Text>
          <Text size="sm">4. Consultez l'historique dans le tableau principal</Text>
        </Stack>
      </Card>
    </Stack>
  );
}