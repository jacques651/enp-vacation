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
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Modal,
  Pagination,
} from '@mantine/core';
import { IconBuildingBank, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Banque {
  id: number;
  designation: string;
}

interface CreateBanque {
  designation: string;
}

export default function BanquesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDesignation, setFormDesignation] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'designation' | 'id'>('designation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // Récupérer toutes les banques
  const { data: banques = [], isLoading, error } = useQuery<Banque[]>({
    queryKey: ['banques'],
    queryFn: async () => {
      const result = await invoke('get_banques');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage
    let filtered = banques.filter(b =>
      b.designation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'designation') {
        comparison = a.designation.localeCompare(b.designation);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [banques, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer une banque
  const createMutation = useMutation({
    mutationFn: (data: CreateBanque) => invoke('create_banque', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banques'] });
      setModalOpened(false);
      resetForm();
    },
  });

  // Mettre à jour une banque
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBanque }) =>
      invoke('update_banque', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banques'] });
      setModalOpened(false);
      resetForm();
    },
  });

  // Supprimer une banque
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_banque', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banques'] });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setFormDesignation('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Banque) => {
    setEditingId(item.id);
    setFormDesignation(item.designation);
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formDesignation.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { designation: formDesignation.trim() } });
    } else {
      createMutation.mutate({ designation: formDesignation.trim() });
    }
  };

  const handleSort = (column: 'id' | 'designation') => {
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
        <Text>Chargement des banques...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les banques
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
            <Title order={2} c="white">Gestion des banques</Title>
            <Text size="sm" c="gray.3">
              Gérez les établissements bancaires pour les paiements
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconBuildingBank size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Banques</Title>
              <Text size="sm" c="dimmed">
                {filteredAndSortedData.length} banque{filteredAndSortedData.length > 1 ? 's' : ''} enregistrée{filteredAndSortedData.length > 1 ? 's' : ''}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter une banque
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

          {/* TABLEAU DES BANQUES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune banque trouvée. Cliquez sur "Ajouter" pour commencer.
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
              Banque {createMutation.isSuccess ? 'ajoutée' : 'modifiée'} avec succès
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
        title={editingId ? "Modifier la banque" : "Ajouter une banque"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Désignation"
            placeholder="Ex: BICEC, SCB, BGFI, Afriland..."
            value={formDesignation}
            onChange={(e) => setFormDesignation(e.target.value)}
            withAsterisk
            description="Nom de l'établissement bancaire"
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
          <Text>Êtes-vous sûr de vouloir supprimer cette banque ?</Text>
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

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Ajoutez les établissements bancaires avec lesquels vous travaillez</Text>
          <Text size="sm">2. Les banques seront disponibles pour les paiements et les virements</Text>
          <Text size="sm">3. Vous pouvez modifier ou supprimer une banque à tout moment</Text>
          <Text size="sm">4. Utilisez la recherche pour filtrer rapidement une banque</Text>
        </Stack>
      </Card>
    </Stack>
  );
}