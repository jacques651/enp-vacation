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
import { IconSignature, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Signataire {
  id: number;
  nom: string;
  prenom: string;
  grade: string;
  fonction: string;
  titre: string;
}

interface CreateSignataire {
  nom: string;
  prenom: string;
  grade: string;
  fonction: string;
  titre: string;
}

export default function SignatairesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'nom' | 'prenom' | 'grade' | 'fonction' | 'id'>('nom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    grade: '',
    fonction: '',
    titre: '',
  });

  // Récupérer tous les signataires
  const { data: signataires = [], isLoading, error } = useQuery<Signataire[]>({
    queryKey: ['signataires'],
    queryFn: async () => {
      const result = await invoke('get_signataires');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    // Filtrage par recherche (sur nom et prénom)
    let filtered = signataires.filter(s =>
      `${s.nom} ${s.prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.prenom.toLowerCase().includes(searchTerm.toLowerCase())
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
      } else if (sortBy === 'grade') {
        comparison = a.grade.localeCompare(b.grade);
      } else if (sortBy === 'fonction') {
        comparison = a.fonction.localeCompare(b.fonction);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [signataires, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Créer un signataire
  const createMutation = useMutation({
    mutationFn: (data: CreateSignataire) => invoke('create_signataire', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signataires'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Mettre à jour un signataire
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateSignataire) => 
      invoke('update_signataire', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signataires'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
    }
  });

  // Supprimer un signataire
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_signataire', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signataires'] });
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
      grade: '',
      fonction: '',
      titre: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Signataire) => {
    setEditingId(item.id);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      grade: item.grade,
      fonction: item.fonction,
      titre: item.titre || '',
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

  const handleSort = (column: 'id' | 'nom' | 'prenom' | 'grade' | 'fonction') => {
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
        <Text>Chargement des signataires...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les signataires
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
            <Title order={2} c="white">Gestion des signataires</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} signataire{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconSignature size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Signataires</Title>
              <Text size="sm" c="dimmed">
                Gérez les personnes autorisées à signer les documents officiels
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un signataire
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

          {/* TABLEAU DES SIGNATAIRES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun signataire trouvé. Cliquez sur "Ajouter" pour commencer.
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
                        onClick={() => handleSort('nom')}
                      >
                        <Group gap={4}>
                          Nom
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('prenom')}
                      >
                        <Group gap={4}>
                          Prénom
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('grade')}
                      >
                        <Group gap={4}>
                          Grade
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('fonction')}
                      >
                        <Group gap={4}>
                          Fonction
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
                              {item.nom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {item.prenom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="cyan" variant="light" size="sm">
                              {item.grade}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="blue" variant="light" size="sm">
                              {item.fonction}
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
              Signataire {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier le signataire" : "Ajouter un signataire"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Nom"
            placeholder="Ex: KORGO"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            withAsterisk
            description="Nom de famille du signataire"
          />

          <TextInput
            label="Prénom"
            placeholder="Ex: Jacques"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            withAsterisk
            description="Prénom du signataire"
          />

          <TextInput
            label="Grade"
            placeholder="Ex: Commissaire Divisionnaire, Contrôleur Général..."
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            withAsterisk
            description="Grade administratif ou policier"
          />

          <TextInput
            label="Fonction"
            placeholder="Ex: Directeur gérnéral, Chef de Division..."
            value={formData.fonction}
            onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
            withAsterisk
            description="Fonction occupée"
          />

          <TextInput
            label="Titre"
            placeholder="Ex: Dr, Pr, Colonel..."
            value={formData.titre}
            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
            description="Titre honorifique (optionnel)"
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
              disabled={!formData.nom.trim() || !formData.prenom.trim()}
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
          <Text>Êtes-vous sûr de vouloir supprimer ce signataire ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Ce signataire ne pourra plus signer les documents officiels.
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
          <Text size="sm">1. Les signataires sont les personnes habilitées à signer les documents officiels</Text>
          <Text size="sm">2. Renseignez le grade et la fonction pour l'identification officielle</Text>
          <Text size="sm">3. Le titre est la distinction honorifique du signataire (ex: Chevalier de l'Ordre de l'Etalon)</Text>
          <Text size="sm">4. Les signataires apparaîtront sur les états de liquidation</Text>
          <Text size="sm">5. Utilisez la recherche pour trouver rapidement un signataire</Text>
        </Stack>
      </Card>
    </Stack>
  );
}