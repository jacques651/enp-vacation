// src/pages/referentiels/AnneesScolairesManager.tsx

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
import { IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch, IconTableImport, IconCalendar } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================= TYPES =================
export interface AnneeScolaire {
  id: number;
  libelle: string;
}

interface CreateAnneeScolaire {
  libelle: string;
}

// ================= VALIDATION =================
const validateAnneeScolaire = (libelle: string): string | null => {
  if (!libelle || libelle.trim().length === 0) {
    return 'Le libellé est requis';
  }

  // Vérifier le format avec regex
  const regex = /^\d{4}-\d{4}$/;
  if (!regex.test(libelle)) {
    return 'Format invalide. Utilisez le format YYYY-YYYY (ex: 2025-2026)';
  }

  // Vérifier que les années sont consécutives
  const [debut, fin] = libelle.split('-').map(Number);
  if (fin !== debut + 1) {
    return 'Les années doivent être consécutives (ex: 2025-2026)';
  }

  // Vérifier que les années sont raisonnables
  const currentYear = new Date().getFullYear();
  if (debut < 2000 || debut > currentYear + 10) {
    return `L'année de début doit être entre 2000 et ${currentYear + 10}`;
  }

  return null;
};

// ================= COMPONENT =================
export default function AnneesScolairesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'libelle' | 'id'>('libelle');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    libelle: '',
  });

  // Récupérer toutes les années scolaires
  const { data: anneesScolaires = [], isLoading, error, refetch } = useQuery<AnneeScolaire[]>({
    queryKey: ['annees_scolaires'],
    queryFn: async () => {
      const result = await invoke('get_annees_scolaires');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    let filtered = anneesScolaires.filter(a =>
      a.libelle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'libelle') {
        comparison = a.libelle.localeCompare(b.libelle);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [anneesScolaires, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer une année scolaire
  const createMutation = useMutation({
    mutationFn: (data: CreateAnneeScolaire) => invoke('create_annee_scolaire', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annees_scolaires'] });
      setModalOpened(false);
      resetForm();
      setErrorMessage(null);
      refetch();
    },
    onError: (error: any) => {
      setErrorMessage(error.toString());
    }
  });

  // Mettre à jour une année scolaire
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateAnneeScolaire) =>
      invoke('update_annee_scolaire', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annees_scolaires'] });
      setModalOpened(false);
      resetForm();
      setErrorMessage(null);
      refetch();
    },
    onError: (error: any) => {
      setErrorMessage(error.toString());
    }
  });

  // Supprimer une année scolaire
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_annee_scolaire', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annees_scolaires'] });
      setDeleteId(null);
      refetch();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({ libelle: '' });
    setErrorMessage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: AnneeScolaire) => {
    setEditingId(item.id);
    setFormData({ libelle: item.libelle });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    const validationError = validateAnneeScolaire(formData.libelle);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const submitData = {
      libelle: formData.libelle.trim(),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleSort = (column: 'id' | 'libelle') => {
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
        <Text>Chargement des années scolaires...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les années scolaires
        </Alert>
      </Card>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* HEADER - Même style que ImportExcel */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Gestion des années scolaires</Title>
            <Text size="sm" c="gray.3">
              Gérez les années académiques
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconCalendar size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Années scolaires</Title>
              <Text size="sm" c="dimmed">
                {filteredAndSortedData.length} année{filteredAndSortedData.length > 1 ? 's' : ''} scolaire{filteredAndSortedData.length > 1 ? 's' : ''} enregistrée{filteredAndSortedData.length > 1 ? 's' : ''}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter une année
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE */}
          <TextInput
            placeholder="Rechercher par libellé (ex: 2025-2026)..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* TABLEAU DES ANNÉES SCOLAIRES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune année scolaire trouvée. Cliquez sur "Ajouter" pour commencer.
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
                        N°
                      </Table.Th>
                      <Table.Th
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('libelle')}
                      >
                        Libellé
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
                              {item.libelle}
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
        </Stack>
      </Card>

      {/* MODAL D'AJOUT / MODIFICATION */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          resetForm();
        }}
        title={editingId ? "Modifier l'année scolaire" : "Ajouter une année scolaire"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Année Scolaire"
            placeholder="Ex: 2025-2026"
            value={formData.libelle}
            onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
            withAsterisk
            description="Format: YYYY-YYYY (années consécutives)"
            error={errorMessage}
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
          <Text>Êtes-vous sûr de vouloir supprimer cette année scolaire ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Les vacations liées à cette année seront affectées.
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
          <Text size="sm">1. Les années scolaires représentent les périodes académiques</Text>
          <Text size="sm">2. Format attendu: YYYY-YYYY (ex: 2025-2026)</Text>
          <Text size="sm">3. Les années doivent être consécutives (ex: 2025-2026, pas 2025-2027)</Text>
          <Text size="sm">4. Utilisez la recherche pour trouver rapidement une année</Text>
          <Text size="sm">5. La suppression d'une année affecte les vacations associées</Text>
        </Stack>
        
        <Divider my="md" />
        
        <Title order={5} mb="md">📝 Exemples valides</Title>
        <Stack gap="xs">
          <Text size="sm">• 2024-2025</Text>
          <Text size="sm">• 2025-2026</Text>
          <Text size="sm">• 2026-2027</Text>
        </Stack>
      </Card>
    </Stack>
  );
}