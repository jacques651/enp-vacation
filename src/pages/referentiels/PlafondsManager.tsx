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
  Select,
  NumberInput,
  ActionIcon,
  ScrollArea,
  LoadingOverlay,
  Modal,
  Pagination,
  TextInput,
} from '@mantine/core';
import { IconClock, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Plafond {
  id: number;
  titre: string;
  statut: string;
  volume_horaire_max: number;
}

interface CreatePlafond {
  titre: string;
  statut: string;
  volume_horaire_max: number;
}

const TITRES_VALIDES = [
  { value: 'directeur', label: 'Directeur' },
  { value: 'chef de division/service', label: 'Chef de division/service' },
  { value: 'agent', label: 'Agent' },
  { value: 'retraité', label: 'Retraité' },
  { value: 'autre', label: 'Autre' },
];

const STATUTS_VALIDES = [
  { value: 'interne', label: 'Interne (fonctionnaire)' },
  { value: 'externe', label: 'Externe (contractuel)' },
];

export default function PlafondsManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'titre' | 'statut' | 'volume_horaire_max' | 'id'>('titre');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    titre: 'agent',
    statut: 'interne',
    volume_horaire_max: 30,
  });

  // Récupérer tous les plafonds
  const { data: plafonds = [], isLoading, error } = useQuery<Plafond[]>({
    queryKey: ['plafonds'],
    queryFn: async () => {
      const result = await invoke('get_plafonds');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage par recherche (sur titre et statut)
    let filtered = plafonds.filter(p =>
      p.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.statut.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Tri
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'titre') {
        comparison = a.titre.localeCompare(b.titre);
      } else if (sortBy === 'statut') {
        comparison = a.statut.localeCompare(b.statut);
      } else if (sortBy === 'volume_horaire_max') {
        comparison = a.volume_horaire_max - b.volume_horaire_max;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [plafonds, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer un plafond
  const createMutation = useMutation({
    mutationFn: (data: CreatePlafond) => invoke('create_plafond', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plafonds'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour un plafond
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreatePlafond) => 
      invoke('update_plafond', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plafonds'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer un plafond
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_plafond', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plafonds'] });
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      titre: 'agent',
      statut: 'interne',
      volume_horaire_max: 30,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Plafond) => {
    setEditingId(item.id);
    setFormData({
      titre: item.titre,
      statut: item.statut,
      volume_horaire_max: item.volume_horaire_max,
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formData.titre || !formData.statut) return;
    if (!formData.volume_horaire_max || formData.volume_horaire_max <= 0) return;
    if (formData.volume_horaire_max > 100) return;

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSort = (column: 'id' | 'titre' | 'statut' | 'volume_horaire_max') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const getTitreLabel = (titre: string) => {
    return TITRES_VALIDES.find(t => t.value === titre)?.label || titre;
  };

  const getStatutLabel = (statut: string) => {
    return STATUTS_VALIDES.find(s => s.value === statut)?.label || statut;
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des plafonds horaires...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les plafonds horaires
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
            <Title order={2} c="white">Gestion des plafonds horaires</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} plafond{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconClock size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Plafonds horaires</Title>
              <Text size="sm" c="dimmed">
                Gérez les volumes horaires maximums par titre et statut
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un plafond
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE */}
          <TextInput
            placeholder="Rechercher par titre ou statut..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* TABLEAU DES PLAFONDS */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun plafond trouvé. Cliquez sur "Ajouter" pour commencer.
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
                        onClick={() => handleSort('titre')}
                      >
                        <Group gap={4}>
                          Titre
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('statut')}
                      >
                        <Group gap={4}>
                          Statut
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('volume_horaire_max')}
                      >
                        <Group gap={4}>
                          Volume horaire max
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
                            <Badge color="blue" variant="light" size="sm">
                              {getTitreLabel(item.titre)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge 
                              color={item.statut === 'interne' ? 'cyan' : 'orange'}
                              variant="light"
                              size="sm"
                            >
                              {getStatutLabel(item.statut)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="teal" variant="light" size="lg">
                              {item.volume_horaire_max} heures
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
              Plafond {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier le plafond horaire" : "Ajouter un plafond horaire"}
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Titre"
            placeholder="Choisir un titre"
            data={TITRES_VALIDES}
            value={formData.titre}
            onChange={(val) => setFormData({ ...formData, titre: val || 'agent' })}
            withAsterisk
            description="Détermine le plafond horaire selon le poste"
          />

          <Select
            label="Statut"
            placeholder="Choisir un statut"
            data={STATUTS_VALIDES}
            value={formData.statut}
            onChange={(val) => setFormData({ ...formData, statut: val || 'interne' })}
            withAsterisk
            description="Interne (fonctionnaire) ou Externe (contractuel)"
          />

          <NumberInput
            label="Volume horaire maximum"
            placeholder="Ex: 180"
            value={formData.volume_horaire_max}
            onChange={(val) => setFormData({ ...formData, volume_horaire_max: val as number })}
            min={1}
            max={100}
            withAsterisk
            description="Nombre d'heures maximum autorisé par année scolaire"
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
              disabled={!formData.titre || !formData.statut || !formData.volume_horaire_max || formData.volume_horaire_max <= 0}
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
          <Text>Êtes-vous sûr de vouloir supprimer ce plafond horaire ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: La suppression d'un plafond peut affecter les enseignants associés.
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

      {/* SECTION INSTRUCTIONS ET PLAFONDS PAR DÉFAUT */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Plafonds par défaut</Title>
        <Stack gap="xs">
          <Text size="sm" fw={500} mb="xs">💡 Les plafonds recommandés sont déjà configurés :</Text>
          
          <Group grow>
            <Card withBorder p="xs" bg="gray.0">
              <Text size="xs" fw={700} c="blue"> Les plafonds horaires pour les Internes (ENP)</Text>
              <Text size="xs">• Directeur: 140h</Text>
              <Text size="xs">• Chef de service: 160h</Text>
              <Text size="xs">• autres: 180h</Text>
              <Text size="xs">• Sauf décision contraire du Directeur Général</Text>
            </Card>
            
            <Card withBorder p="xs" bg="gray.0">
              <Text size="xs" fw={700} c="orange"> Les plafonds horaires pour les Externes </Text>
              <Text size="xs">• Directeur: 140h</Text>
              <Text size="xs">• Chef de division/service: 160h</Text>
              <Text size="xs">• Agent: 180h</Text>
              <Text size="xs">• Retraité: 200h</Text>
            </Card>
          </Group>

          <Divider my="sm" />

          <Title order={5} mb="xs">📋 Instructions</Title>
          <Text size="sm">1. Les plafonds horaires définissent le volume horaire maximum par enseignant</Text>
          <Text size="sm">1. Est considéré comme agent, tout enseignant vacataire n'exerçant pas une fonction faisant l'objet de nomination par un acte règlementaire</Text>
          <Text size="sm">2. Chaque combinaison titre/statut doit avoir un plafond unique</Text>
          <Text size="sm">3. Les valeurs par défaut sont préconfigurées selon les normes</Text>
          <Text size="sm">4. Modifiez un plafond pour ajuster les limites horaires</Text>
          <Text size="sm">5. Le volume horaire maximum ne peut pas dépasser 100h par année scolaire</Text>
        </Stack>
      </Card>
    </Stack>
  );
}