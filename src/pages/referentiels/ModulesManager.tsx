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
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Modal,
  Pagination,
} from '@mantine/core';
import { IconFolder, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch, IconFilter } from '@tabler/icons-react';
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

interface CreateModule {
  designation: string;
  cycle_id: number;
}

export default function ModulesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'designation' | 'cycle' | 'id'>('designation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    designation: '',
    cycle_id: null as number | null,
  });

  // Récupérer tous les modules
  const { data: modules = [], isLoading: modulesLoading, error: modulesError } = useQuery<Module[]>({
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

  const isLoading = modulesLoading || cyclesLoading;
  const error = modulesError;

  // Map pour les cycles
  const cycleMap = useMemo(() => Object.fromEntries(cycles.map(c => [c.id, c.designation])), [cycles]);

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage par recherche
    let filtered = modules.filter(m =>
      m.designation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filtre par cycle
    if (cycleFilter) {
      filtered = filtered.filter(m => m.cycle_id === parseInt(cycleFilter));
    }

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'designation') {
        comparison = a.designation.localeCompare(b.designation);
      } else if (sortBy === 'cycle') {
        comparison = (cycleMap[a.cycle_id] || '').localeCompare(cycleMap[b.cycle_id] || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [modules, searchTerm, cycleFilter, sortBy, sortOrder, cycleMap]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer un module
  const createMutation = useMutation({
    mutationFn: (data: CreateModule) => invoke('create_module', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour un module
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateModule) => 
      invoke('update_module', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer un module
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_module', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
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
      cycle_id: null,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Module) => {
    setEditingId(item.id);
    setFormData({
      designation: item.designation,
      cycle_id: item.cycle_id,
    });
    setModalOpened(true);
  };

 // Ajouter avant handleSubmit
// Dans la fonction handleSubmit, avant d'appeler la mutation
const handleSubmit = () => {
  // Validation - empêcher la soumission si cycle_id est null
  if (!formData.designation.trim()) {
    return;
  }
  if (!formData.cycle_id) {  // ← Ajouter cette validation
    return;  // cycle_id est requis
  }

  if (editingId) {
    // Maintenant TypeScript sait que cycle_id n'est pas null
    updateMutation.mutate({ id: editingId, ...formData as CreateModule });
  } else {
    createMutation.mutate(formData as CreateModule);
  }
};

// Modifier le type CreateModule
interface CreateModule {
  designation: string;
  cycle_id: number; // Pas de null
}

  const handleSort = (column: 'id' | 'designation' | 'cycle') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des modules...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les modules
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
            <Title order={2} c="white">Gestion des modules</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} module{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconFolder size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Modules</Title>
              <Text size="sm" c="dimmed">
                Gérez les modules d'enseignement par cycle
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un module
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
              onChange={(value) => {
                setCycleFilter(value);
                setCurrentPage(1);
              }}
              clearable
              data={cycles.map(c => ({
                value: String(c.id),
                label: c.designation,
              }))}
            />
          </Group>

          {/* TABLEAU DES MODULES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun module trouvé. Cliquez sur "Ajouter" pour commencer.
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
                        onClick={() => handleSort('cycle')}
                      >
                        <Group gap={4}>
                          Cycle
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th style={{ width: 100, textAlign: 'center' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedData.map((item, index) => {
                      const numero = (currentPage - 1) * itemsPerPage + index + 1;
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
                            <Badge color="blue" variant="light" size="sm">
                              {cycleMap[item.cycle_id] || `Cycle ${item.cycle_id}`}
                            </Badge>
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
              Module {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier le module" : "Ajouter un module"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Désignation"
            placeholder="Ex: module1, module2, module3..."
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            withAsterisk
            description="Nom du module d'enseignement"
          />

          <Select
            label="Cycle"
            placeholder="Sélectionner un cycle"
            data={cycles.map(c => ({
              value: String(c.id),
              label: c.designation,
            }))}
            value={formData.cycle_id ? String(formData.cycle_id) : null}
            onChange={(val) => setFormData({ ...formData, cycle_id: val ? parseInt(val) : null })}
            withAsterisk
            description="Cycle auquel appartient ce module"
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
              disabled={!formData.designation.trim() || !formData.cycle_id}
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
          <Text>Êtes-vous sûr de vouloir supprimer ce module ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Les matières et vacations associées à ce module seront également supprimées.
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
          <Text size="sm">1. Les modules sont des regroupements de matières par cycle</Text>
          <Text size="sm">2. Chaque module est obligatoirement rattaché à un cycle</Text>
          <Text size="sm">3. Utilisez le filtre par cycle pour afficher les modules d'un cycle spécifique</Text>
          <Text size="sm">4. La suppression d'un module entraîne la suppression des matières associées</Text>
          <Text size="sm">5. Les modules sont utilisés pour organiser le programme pédagogique</Text>
        </Stack>
      </Card>
    </Stack>
  );
}