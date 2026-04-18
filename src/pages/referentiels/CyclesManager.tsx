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
  NumberInput,
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Modal,
  Pagination,
} from '@mantine/core';
import { IconSchool, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

interface CreateCycle {
  designation: string;
  nb_classe: number;
}

export default function CyclesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDesignation, setFormDesignation] = useState('');
  const [formNbClasse, setFormNbClasse] = useState<number | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'designation' | 'nb_classe' | 'id'>('designation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // Récupérer tous les cycles
  const { data: cycles = [], isLoading, error } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: async () => {
      const result = await invoke('get_cycles');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage
    let filtered = cycles.filter(c =>
      c.designation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'designation') {
        comparison = a.designation.localeCompare(b.designation);
      } else if (sortBy === 'nb_classe') {
        comparison = a.nb_classe - b.nb_classe;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [cycles, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer un cycle
  const createMutation = useMutation({
    mutationFn: (data: CreateCycle) => invoke('create_cycle'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error: string) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour un cycle
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Cycle) => invoke('update_cycle', { id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error: string) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer un cycle
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_cycle', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setDeleteId(null);
    },
    onError: (error: string) => {
      console.error('Erreur:', error);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormDesignation('');
    setFormNbClasse(undefined);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Cycle) => {
    setEditingId(item.id);
    setFormDesignation(item.designation);
    setFormNbClasse(item.nb_classe);
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formDesignation.trim()) return;
    if (!formNbClasse || formNbClasse < 1) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        designation: formDesignation.trim(),
        nb_classe: formNbClasse,
      });
    } else {
      createMutation.mutate({
        designation: formDesignation.trim(),
        nb_classe: formNbClasse,
      });
    }
  };

  const handleSort = (column: 'id' | 'designation' | 'nb_classe') => {
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
        <Text>Chargement des cycles...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les cycles
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
            <Title order={2} c="white">Gestion des cycles</Title>
            <Text size="sm" c="gray.3">
              Gérez les cycles d'études et leur nombre de classes
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconSchool size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Cycles</Title>
              <Text size="sm" c="dimmed">
                {filteredAndSortedData.length} cycle{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un cycle
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE */}
          <TextInput
            placeholder="Rechercher par désignation..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* TABLEAU DES CYCLES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun cycle trouvé. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 500 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th 
                        style={{ width: 80, cursor: 'pointer' }}
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
                        onClick={() => handleSort('nb_classe')}
                      >
                        <Group gap={4}>
                          Nombre de classes
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
                            <Badge color="teal" variant="light" size="sm">
                              {item.nb_classe} classe{item.nb_classe > 1 ? 's' : ''}
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
              Cycle {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier le cycle" : "Ajouter un cycle"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Désignation"
            placeholder="Ex: Premier cycle, Second cycle, Licence..."
            value={formDesignation}
            onChange={(e) => setFormDesignation(e.target.value)}
            withAsterisk
            description="Nom du cycle d'études"
          />
          <NumberInput
            label="Nombre de classes"
            placeholder="Ex: 6"
            value={formNbClasse}
            onChange={(val) => setFormNbClasse(val as number)}
            min={1}
            withAsterisk
            description="Nombre de classes dans ce cycle"
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
          <Text>Êtes-vous sûr de vouloir supprimer ce cycle ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Un cycle contenant des modules ne peut pas être supprimé.
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
          <Text size="sm">1. Les cycles représentent les différents corps élèves</Text>
          <Text size="sm">2. Chaque cycle peut avoir un nombre spécifique de classes</Text>
          <Text size="sm">3. Les cycles sont utilisés pour organiser les modules et matières</Text>
          <Text size="sm">4. La suppression d'un cycle n'est possible que s'il n'a pas de modules associés</Text>
        </Stack>
      </Card>
    </Stack>
  );
}