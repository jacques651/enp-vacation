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
  Pagination,
} from '@mantine/core';
import { IconBook, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch, IconFilter } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Cycle {
  id: number;
  designation: string;
}

interface Module {
  id: number;
  designation: string;
  cycle_id: number;
}

interface Matiere {
  id: number;
  designation: string;
  module_id: number;
  vhoraire?: number | null;
  coefficient?: number | null;
  observation?: string;
}

interface CreateMatiere {
  designation: string;
  module_id: number;
  vhoraire?: number | null;
  coefficient?: number | null;
  observation?: string;
}

export default function MatieresManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'designation' | 'module' | 'vhoraire' | 'coefficient' | 'id'>('designation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    designation: '',
    module_id: null as number | null,
    vhoraire: null as number | null,
    coefficient: null as number | null,
    observation: '',
  });

  // Récupérer toutes les matières
  const { data: matieres = [], isLoading: matieresLoading, error: matieresError } = useQuery<Matiere[]>({
    queryKey: ['matieres'],
    queryFn: async () => {
      const result = await invoke('get_matieres');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Récupérer les modules
  const { data: modules = [], isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      const result = await invoke('get_modules');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Récupérer les cycles
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: async () => {
      const result = await invoke('get_cycles');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  const isLoading = matieresLoading || modulesLoading || cyclesLoading;
  const error = matieresError;

  // Maps pour les relations
  const moduleMap = useMemo(() => Object.fromEntries(modules.map(m => [m.id, m])), [modules]);
  const cycleMap = useMemo(() => Object.fromEntries(cycles.map(c => [c.id, c.designation])), [cycles]);

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage par recherche
    let filtered = matieres.filter(m =>
      m.designation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filtre par cycle
    if (cycleFilter) {
      const moduleIdsInCycle = modules
        .filter(mod => mod.cycle_id === parseInt(cycleFilter))
        .map(mod => mod.id);
      filtered = filtered.filter(m => moduleIdsInCycle.includes(m.module_id));
    }

    // Filtre par module
    if (moduleFilter) {
      filtered = filtered.filter(m => m.module_id === parseInt(moduleFilter));
    }

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'designation') {
        comparison = a.designation.localeCompare(b.designation);
      } else if (sortBy === 'module') {
        const moduleA = moduleMap[a.module_id]?.designation || '';
        const moduleB = moduleMap[b.module_id]?.designation || '';
        comparison = moduleA.localeCompare(moduleB);
      } else if (sortBy === 'vhoraire') {
        comparison = (a.vhoraire || 0) - (b.vhoraire || 0);
      } else if (sortBy === 'coefficient') {
        comparison = (a.coefficient || 0) - (b.coefficient || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [matieres, searchTerm, cycleFilter, moduleFilter, sortBy, sortOrder, moduleMap, modules]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Modules filtrés par cycle pour le formulaire
  const filteredModulesForForm = useMemo(() => {
    if (!cycleFilter) return modules;
    return modules.filter(m => m.cycle_id === parseInt(cycleFilter));
  }, [modules, cycleFilter]);

  // Créer une matière
  const createMutation = useMutation({
    mutationFn: (data: CreateMatiere) => invoke('create_matiere', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matieres'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour une matière
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateMatiere) => 
      invoke('update_matiere', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matieres'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer une matière
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_matiere', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matieres'] });
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      designation: '',
      module_id: null,
      vhoraire: null,
      coefficient: null,
      observation: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Matiere) => {
    setEditingId(item.id);
    // Trouver le cycle du module pour pré-sélectionner le filtre
    const module = moduleMap[item.module_id];
    if (module) {
      setCycleFilter(String(module.cycle_id));
    }
    setFormData({
      designation: item.designation,
      module_id: item.module_id,
      vhoraire: item.vhoraire || null,
      coefficient: item.coefficient || null,
      observation: item.observation || '',
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
  if (!formData.designation.trim()) return;
  if (!formData.module_id) return;

  if (editingId) {
    updateMutation.mutate({ id: editingId, ...formData as any });
    // ou
    updateMutation.mutate({ id: editingId, ...formData } as any);
  } else {
    createMutation.mutate(formData as any);
  }
};

  const handleSort = (column: 'id' | 'designation' | 'module' | 'vhoraire' | 'coefficient') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleCycleFilterChange = (value: string | null) => {
    setCycleFilter(value);
    setModuleFilter(null);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des matières...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les matières
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
            <Title order={2} c="white">Gestion des matières</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} matière{filteredAndSortedData.length > 1 ? 's' : ''} enregistrée{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconBook size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Matières</Title>
              <Text size="sm" c="dimmed">
                Gérez les matières enseignées par module
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter une matière
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE ET FILTRES */}
          <Group grow>
            <TextInput
              placeholder="Rechercher par désignation..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            
            <Select
              placeholder="Filtrer par cycle"
              leftSection={<IconFilter size={16} />}
              value={cycleFilter}
              onChange={handleCycleFilterChange}
              clearable
              data={cycles.map(c => ({
                value: String(c.id),
                label: c.designation,
              }))}
            />

            <Select
              placeholder="Filtrer par module"
              leftSection={<IconFilter size={16} />}
              value={moduleFilter}
              onChange={(value) => {
                setModuleFilter(value);
                setCurrentPage(1);
              }}
              clearable
              disabled={!cycleFilter}
              data={modules
                .filter(m => !cycleFilter || m.cycle_id === parseInt(cycleFilter))
                .map(m => ({
                  value: String(m.id),
                  label: m.designation,
                }))}
            />
          </Group>

          {/* TABLEAU DES MATIÈRES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune matière trouvée. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 500 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th 
                        style={{ width: 70, cursor: 'pointer' }}
                        onClick={() => handleSort('id')}
                      >
                        <Group gap={4}>
                          N°
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('designation')}
                      >
                        <Group gap={4}>
                          Désignation
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('module')}
                      >
                        <Group gap={4}>
                          Module
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ width: 120, cursor: 'pointer' }}
                        onClick={() => handleSort('vhoraire')}
                      >
                        <Group gap={4}>
                          Volume horaire
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ width: 80, cursor: 'pointer' }}
                        onClick={() => handleSort('coefficient')}
                      >
                        <Group gap={4}>
                          Coefficient
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th style={{ width: 100, textAlign: 'center' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedData.map((item, index) => {
                      const numero = (currentPage - 1) * itemsPerPage + index + 1;
                      const module = moduleMap[item.module_id];
                      const cycleName = module ? cycleMap[module.cycle_id] : '';
                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Badge color="gray" variant="light" size="sm">
                              {numero}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {item.designation}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={2}>
                              <Badge color="blue" variant="light" size="sm">
                                {module?.designation || '-'}
                              </Badge>
                              {cycleName && (
                                <Text size="xs" c="dimmed">{cycleName}</Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            {item.vhoraire ? (
                              <Badge color="cyan" variant="light" size="sm">
                                {item.vhoraire}h
                              </Badge>
                            ) : '—'}
                          </Table.Td>
                          <Table.Td>
                            {item.coefficient ? (
                              <Badge color="teal" variant="light" size="sm">
                                {item.coefficient}
                              </Badge>
                            ) : '—'}
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
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination 
                    value={currentPage} 
                    onChange={setCurrentPage} 
                    total={totalPages} 
                    color="blue"
                  />
                </Group>
              )}
            </>
          )}

          {/* MESSAGE DE SUCCÈS */}
          {(createMutation.isSuccess || updateMutation.isSuccess) && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Matière {createMutation.isSuccess ? 'ajoutée' : 'modifiée'} avec succès
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
        title={editingId ? "Modifier la matière" : "Ajouter une matière"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Désignation"
            placeholder="Ex: Mathématiques, Physique, Chimie..."
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            withAsterisk
            description="Nom de la matière enseignée"
          />

          <Select
            label="Cycle"
            placeholder="Sélectionner un cycle"
            value={cycleFilter}
            onChange={(value) => {
              setCycleFilter(value);
              setFormData({ ...formData, module_id: null });
            }}
            clearable
            data={cycles.map(c => ({
              value: String(c.id),
              label: c.designation,
            }))}
          />

          <Select
            label="Module"
            placeholder="Sélectionner un module"
            data={filteredModulesForForm.map(m => ({
              value: String(m.id),
              label: m.designation,
            }))}
            value={formData.module_id ? String(formData.module_id) : null}
            onChange={(val) => setFormData({ ...formData, module_id: val ? parseInt(val) : null })}
            withAsterisk
            disabled={!cycleFilter}
            description={!cycleFilter ? "Sélectionnez d'abord un cycle" : ""}
          />

          <NumberInput
            label="Volume horaire"
            placeholder="Ex: 60"
            value={formData.vhoraire || undefined}
            onChange={(val) => setFormData({ ...formData, vhoraire: val as number })}
            min={0}
            description="Nombre d'heures pour cette matière"
          />

          <NumberInput
            label="Coefficient"
            placeholder="Ex: 2"
            value={formData.coefficient || undefined}
            onChange={(val) => setFormData({ ...formData, coefficient: val as number })}
            min={0}
            step={0.5}
            description="Coefficient pour le calcul des moyennes"
          />

          <TextInput
            label="Observation"
            placeholder="Observations éventuelles..."
            value={formData.observation}
            onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              disabled={!formData.designation.trim() || !formData.module_id}
            >
              {editingId ? 'Mettre à jour' : 'Ajouter'}
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
          <Text>Êtes-vous sûr de vouloir supprimer cette matière ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Les vacations associées à cette matière seront également supprimées.
          </Text>
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

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Les matières sont rattachées à des modules spécifiques</Text>
          <Text size="sm">2. Chaque matière peut avoir un volume horaire et un coefficient</Text>
          <Text size="sm">3. Utilisez les filtres pour affiner l'affichage par cycle ou module</Text>
          <Text size="sm">4. Le coefficient est utilisé pour le calcul des moyennes des élèves</Text>
          <Text size="sm">5. La suppression d'une matière affecte les vacations associées</Text>
        </Stack>
      </Card>
    </Stack>
  );
}