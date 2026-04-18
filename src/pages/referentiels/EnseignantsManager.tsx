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
import { IconUsers, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  titre: string;
  statut: string;
}

interface CreateEnseignant {
  nom: string;
  prenom: string;
  telephone: string | null;
  titre: string;
  statut: string;
}

const TITRES_VALIDES = [
  { value: 'directeur', label: 'Directeur' },
  { value: 'chef de service', label: 'Chef de service' },
  { value: 'chef de division/service', label: 'Chef de division/service' },
  { value: 'agent', label: 'Agent' },
  { value: 'retraité', label: 'Retraité' },
  { value: 'autre', label: 'Autre' },
];

const STATUTS_VALIDES = [
  { value: 'interne', label: 'Interne (fonctionnaire)' },
  { value: 'externe', label: 'Externe (contractuel)' },
];

export default function EnseignantsManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'nom' | 'prenom' | 'id'>('nom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    titre: 'agent',
    statut: 'interne',
  });

  // Récupérer tous les enseignants
  const { data: enseignants = [], isLoading, error } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: async () => {
      const result = await invoke('get_enseignants');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage
    let filtered = enseignants.filter(e =>
      `${e.nom} ${e.prenom}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'nom') {
        comparison = a.nom.localeCompare(b.nom);
      } else if (sortBy === 'prenom') {
        comparison = a.prenom.localeCompare(b.prenom);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [enseignants, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer un enseignant
  const createMutation = useMutation({
    mutationFn: (data: CreateEnseignant) => invoke('create_enseignant', { input: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour un enseignant
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateEnseignant) => 
      invoke('update_enseignant', { id, input: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer un enseignant
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_enseignant', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      titre: 'agent',
      statut: 'interne',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Enseignant) => {
    setEditingId(item.id);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      telephone: item.telephone || '',
      titre: item.titre,
      statut: item.statut,
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formData.nom.trim() || !formData.prenom.trim()) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSort = (column: 'id' | 'nom' | 'prenom') => {
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
        <Text>Chargement des enseignants...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les enseignants
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
            <Title order={2} c="white">Gestion des enseignants</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} enseignant{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconUsers size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Enseignants</Title>
              <Text size="sm" c="dimmed">
                Gérez les informations des enseignants
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un enseignant
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE */}
          <TextInput
            placeholder="Rechercher par nom ou prénom..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* TABLEAU DES ENSEIGNANTS */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun enseignant trouvé. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 600 }}>
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
                        onClick={() => handleSort('nom')}
                      >
                        <Group gap={4}>
                          Nom complet
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th>Téléphone</Table.Th>
                      <Table.Th>Titre</Table.Th>
                      <Table.Th>Statut</Table.Th>
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
                              {item.nom} {item.prenom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{item.telephone || '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="cyan" variant="light" size="sm">
                              {item.titre}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge 
                              color={item.statut === 'interne' ? 'blue' : 'orange'}
                              variant="light"
                              size="sm"
                            >
                              {item.statut === 'interne' ? 'Interne' : 'Externe'}
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
              Enseignant {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier l'enseignant" : "Ajouter un enseignant"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Nom"
            placeholder="Ex: DIOP"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            withAsterisk
          />
          
          <TextInput
            label="Prénom"
            placeholder="Ex: Amadou"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            withAsterisk
          />

          <TextInput
            label="Téléphone"
            placeholder="Ex: 76 123 45 67"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          />

          <Select
            label="Titre"
            placeholder="Choisir un titre"
            data={TITRES_VALIDES}
            value={formData.titre}
            onChange={(val) => setFormData({ ...formData, titre: val || 'agent' })}
            withAsterisk
          />

          <Select
            label="Statut"
            placeholder="Choisir un statut"
            data={STATUTS_VALIDES}
            value={formData.statut}
            onChange={(val) => setFormData({ ...formData, statut: val || 'interne' })}
            withAsterisk
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
          <Text>Êtes-vous sûr de vouloir supprimer cet enseignant ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Les vacations associées à cet enseignant seront également supprimées.
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
          <Text size="sm">1. Renseignez les informations personnelles de l'enseignant</Text>
          <Text size="sm">2. Le volume horaire maximum est défini automatiquement selon le statut et le titre de l'enseignant</Text>
          <Text size="sm">3. Les informations bancaires sont gérées séparément dans la section comptes bancaires</Text>
          <Text size="sm">4. Un enseignant interne est un enseignant en service à l'ENP</Text>
          <Text size="sm">5. Un enseignant externe est un intervenant externe</Text>
        </Stack>
      </Card>
    </Stack>
  );
}