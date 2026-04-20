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
  Tooltip,
  Switch,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconCheck,
  IconAlertCircle,
  IconEdit,
  IconTrash,
  IconPlus,
  IconSearch,
  IconInfoCircle,
  IconCreditCard,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================= TYPES =================
interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  titre: string;      // Ajouté
  statut: string;     // Ajouté
  telephone?: string | null;
  vh_max?: number;
}

interface Banque {
  id: number;
  designation: string;
}

interface CompteBancaire {
  id: number;
  enseignant_id: number;
  banque_id: number;
  numero_compte: string;
  cle_rib: string;
  actif: number;
  date_debut: string | null;
  date_fin: string | null;
  enseignant_nom?: string;
  enseignant_prenom?: string;
  banque_designation?: string;
}

interface CreateCompteBancaire {
  enseignant_id: number;
  banque_id: number;
  numero_compte: string;
  cle_rib: string;
  actif?: number;
  date_debut?: string | null;
  date_fin?: string | null;
}

// ================= CONSTANTES =================
export default function ComptesBancairesManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'enseignant' | 'banque' | 'numero_compte'>('enseignant');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState<CreateCompteBancaire>({
    enseignant_id: 0,
    banque_id: 0,
    numero_compte: '',
    cle_rib: '',
    actif: 1,
    date_debut: null,
    date_fin: null,
  });

  // Récupérer les enseignants
  const { data: enseignants = [] } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: async () => {
      const result = await invoke('get_enseignants');
      return result as Enseignant[];
    },
  });

  // Récupérer les banques
  const { data: banques = [] } = useQuery<Banque[]>({
    queryKey: ['banques'],
    queryFn: async () => {
      const result = await invoke('get_banques');
      return result as Banque[];
    },
  });

  // Récupérer les comptes bancaires
  const { data: comptes = [], isLoading, error } = useQuery<CompteBancaire[]>({
    queryKey: ['comptes_bancaires'],
    queryFn: async () => {
      const result = await invoke('get_comptes_bancaires');
      return result as CompteBancaire[];
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    let filtered = comptes.filter(c =>
      `${c.enseignant_nom} ${c.enseignant_prenom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.banque_designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numero_compte.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'enseignant') {
        comparison = `${a.enseignant_nom} ${a.enseignant_prenom}`.localeCompare(`${b.enseignant_nom} ${b.enseignant_prenom}`);
      } else if (sortBy === 'banque') {
        comparison = (a.banque_designation || '').localeCompare(b.banque_designation || '');
      } else if (sortBy === 'numero_compte') {
        comparison = a.numero_compte.localeCompare(b.numero_compte);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [comptes, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mutations CRUD
  const createMutation = useMutation({
    mutationFn: (data: CreateCompteBancaire) => invoke('create_compte_bancaire', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes_bancaires'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la création du compte bancaire');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateCompteBancaire) =>
      invoke('update_compte_bancaire', { id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes_bancaires'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la modification du compte bancaire');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_compte_bancaire', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes_bancaires'] });
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression du compte bancaire');
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      enseignant_id: 0,
      banque_id: 0,
      numero_compte: '',
      cle_rib: '',
      actif: 1,
      date_debut: null,
      date_fin: null,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: CompteBancaire) => {
    setEditingId(item.id);
    setFormData({
      enseignant_id: item.enseignant_id,
      banque_id: item.banque_id,
      numero_compte: item.numero_compte,
      cle_rib: item.cle_rib,
      actif: item.actif,
      date_debut: item.date_debut,
      date_fin: item.date_fin,
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formData.enseignant_id || !formData.banque_id || !formData.numero_compte.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSort = (column: 'enseignant' | 'banque' | 'numero_compte') => {
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
        <Text>Chargement des comptes bancaires...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les comptes bancaires
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
            <Title order={2} c="white">Gestion des comptes bancaires</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} compte{filteredAndSortedData.length > 1 ? 's' : ''} bancaire enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
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
              <Title order={4}>Comptes bancaires</Title>
              <Text size="sm" c="dimmed">
                Gérez les comptes bancaires des enseignants
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un compte bancaire
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE */}
          <TextInput
            placeholder="Rechercher par enseignant, banque ou numéro de compte..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* TABLEAU DES COMPTES BANCAIRES */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun compte bancaire trouvé. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 600 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 70 }}>N°</Table.Th>
                      <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('enseignant')}>
                        Enseignant
                      </Table.Th>
                      <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('banque')}>
                        Banque
                      </Table.Th>
                      <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('numero_compte')}>
                        Numéro de compte
                      </Table.Th>
                      <Table.Th>Clé RIB</Table.Th>
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
                              {item.enseignant_nom} {item.enseignant_prenom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="blue" variant="light" size="sm">
                              {item.banque_designation}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                              {item.numero_compte}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" style={{ fontFamily: 'monospace' }}>
                              {item.cle_rib}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={item.actif === 1 ? 'green' : 'red'}
                              variant="light"
                              size="sm"
                            >
                              {item.actif === 1 ? 'Actif' : 'Inactif'}
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
              Compte bancaire {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
  title={editingId ? "Modifier le compte bancaire" : "Ajouter un compte bancaire"}
  size="md"
>
  <Stack gap="md">
    <Select
      label="Enseignant"
      placeholder="Sélectionnez un enseignant"
      data={enseignants.map(e => ({ 
        value: String(e.id), 
        label: `${e.nom} ${e.prenom} (${e.titre} - ${e.statut === 'interne' ? 'Interne' : 'Externe'})`
      }))}
      value={formData.enseignant_id ? String(formData.enseignant_id) : ''}
      onChange={(val) => {
        if (val) {
          const enseignantId = parseInt(val, 10);
          setFormData({ ...formData, enseignant_id: enseignantId });
        } else {
          setFormData({ ...formData, enseignant_id: 0 });
        }
      }}
      withAsterisk
      searchable
      clearable
      error={formData.enseignant_id === 0 && editingId === null ? "Veuillez sélectionner un enseignant" : undefined}
    />

    <Select
      label="Banque"
      placeholder="Sélectionnez une banque"
      data={banques.map(b => ({ 
        value: String(b.id), 
        label: b.designation 
      }))}
      value={formData.banque_id ? String(formData.banque_id) : ''}
      onChange={(val) => {
        if (val) {
          const banqueId = parseInt(val, 10);
          setFormData({ ...formData, banque_id: banqueId });
        } else {
          setFormData({ ...formData, banque_id: 0 });
        }
      }}
      withAsterisk
      searchable
      clearable
      error={formData.banque_id === 0 && editingId === null ? "Veuillez sélectionner une banque" : undefined}
    />

    <TextInput
      label="Numéro de compte"
      placeholder="Ex: 612095100001"
      value={formData.numero_compte}
      onChange={(e) => setFormData({ ...formData, numero_compte: e.target.value })}
      withAsterisk
      error={!formData.numero_compte && editingId === null ? "Le numéro de compte est requis" : undefined}
    />

    <TextInput
      label="Clé RIB"
      placeholder="Ex: 23"
      value={formData.cle_rib}
      onChange={(e) => setFormData({ ...formData, cle_rib: e.target.value })}
      withAsterisk
      error={!formData.cle_rib && editingId === null ? "La clé RIB est requise" : undefined}
    />

    <Switch
      label="Compte actif"
      checked={formData.actif === 1}
      onChange={(e) => setFormData({ ...formData, actif: e.currentTarget.checked ? 1 : 0 })}
      size="md"
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
        disabled={
          formData.enseignant_id === 0 || 
          formData.banque_id === 0 || 
          !formData.numero_compte.trim() || 
          !formData.cle_rib.trim()
        }
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
          <Text>Êtes-vous sûr de vouloir supprimer ce compte bancaire ?</Text>
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
          <Text size="sm">1. Sélectionnez l'enseignant et la banque</Text>
          <Text size="sm">2. Saisissez le numéro de compte bancaire et la clé RIB</Text>
          <Text size="sm">3. Un compte peut être désactivé sans être supprimé</Text>
          <Text size="sm">4. Chaque enseignant peut avoir plusieurs comptes bancaires</Text>
          <Text size="sm">5. Le compte actif sera utilisé par défaut pour les virements</Text>
        </Stack>
      </Card>
    </Stack>
  );
}