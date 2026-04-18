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
  ActionIcon,
  TextInput,
  Select,
  Modal,
  LoadingOverlay,
  ThemeIcon,
  Pagination,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTableImport,
  IconBuildingBank,
} from '@tabler/icons-react';

import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================= TYPES =================

interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
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
  actif: boolean;
  banque: string;
}

// ================= COMPONENT =================

export default function ComptesBancairesManager() {
  const queryClient = useQueryClient();

  const [modalOpened, setModalOpened] = useState(false);
  const [selectedEnseignant, setSelectedEnseignant] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    enseignant_id: null as number | null,
    banque_id: null as number | null,
    numero_compte: '',
  });

  // ================= DATA =================

  const { data: enseignants = [], isLoading: isLoadingEnseignants } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: () => invoke('get_enseignants'),
  });

  const { data: banques = [], isLoading: isLoadingBanques } = useQuery<Banque[]>({
    queryKey: ['banques'],
    queryFn: () => invoke('get_banques'),
  });

  const { 
    data: comptes = [], 
    isLoading: isLoadingComptes,
  } = useQuery<CompteBancaire[]>({
    queryKey: ['comptes', selectedEnseignant],
    queryFn: () => {
      if (!selectedEnseignant) return Promise.resolve([]);
      return invoke('get_comptes_by_enseignant', { enseignantId: selectedEnseignant });
    },
    enabled: !!selectedEnseignant,
  });

  const enseignantMap = useMemo(
    () => Object.fromEntries(enseignants.map(e => [e.id, e])),
    [enseignants]
  );

  // Pagination des enseignants
  const filteredEnseignants = enseignants.filter(e => {
    const label = `${e.nom} ${e.prenom}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filteredEnseignants.length / itemsPerPage);
  const paginatedEnseignants = filteredEnseignants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ================= MUTATIONS =================

  const createMutation = useMutation({
    mutationFn: (data: { enseignant_id: number; banque_id: number; numero_compte: string }) =>
      invoke('create_compte_bancaire', { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes', selectedEnseignant] });
      setModalOpened(false);
      setFormData({ enseignant_id: null, banque_id: null, numero_compte: '' });
    },
    onError: (error: string) => {
      console.error('Erreur:', error);
    },
  });

  const setActifMutation = useMutation({
    mutationFn: ({ id, enseignant_id }: { id: number; enseignant_id: number }) =>
      invoke('set_compte_actif', { id, enseignantId: enseignant_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes', selectedEnseignant] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_compte', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comptes', selectedEnseignant] });
    },
  });

  // ================= ACTIONS =================

  const handleSubmit = () => {
    if (!formData.enseignant_id || !formData.banque_id || !formData.numero_compte) {
      return;
    }

    createMutation.mutate({
      enseignant_id: formData.enseignant_id,
      banque_id: formData.banque_id,
      numero_compte: formData.numero_compte,
    });
  };

  const handleSetActif = (id: number, enseignant_id: number) => {
    setActifMutation.mutate({ id, enseignant_id });
  };

  const handleSelectEnseignant = (enseignantId: number) => {
    setSelectedEnseignant(enseignantId);
    setCurrentPage(1);
  };

  const isLoading = isLoadingEnseignants || isLoadingBanques || isLoadingComptes;

  // ================= UI =================

  return (
    <Stack p="md" gap="lg">
      <LoadingOverlay visible={isLoading} />

      {/* HEADER - Même style que ImportExcel */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Gestion des comptes bancaires</Title>
            <Text size="sm" c="gray.3">
              Gérez les comptes bancaires des enseignants
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconBuildingBank size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* SECTION ENSEIGNANTS */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <div>
            <Title order={4}>Sélectionner un enseignant</Title>
            <Text size="sm" c="dimmed">
              Choisissez un enseignant pour gérer ses comptes bancaires
            </Text>
          </div>

          <Divider />

          <TextInput
            placeholder="Rechercher un enseignant..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setCurrentPage(1);
            }}
          />

          {filteredEnseignants.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun enseignant trouvé.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 400 }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>N°</Table.Th>
                      <Table.Th>Nom</Table.Th>
                      <Table.Th>Prénom</Table.Th>
                      <Table.Th style={{ width: 120 }}>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEnseignants.map((enseignant, index) => {
                      const numero = (currentPage - 1) * itemsPerPage + index + 1;
                      return (
                        <Table.Tr 
                          key={enseignant.id}
                          bg={selectedEnseignant === enseignant.id ? 'blue.0' : undefined}
                        >
                          <Table.Td>
                            <Badge color="gray" variant="light" size="sm">
                              {numero}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={500}>{enseignant.nom}</Text>
                          </Table.Td>
                          <Table.Td>{enseignant.prenom}</Table.Td>
                          <Table.Td>
                            <Button
                              variant={selectedEnseignant === enseignant.id ? 'filled' : 'light'}
                              size="xs"
                              onClick={() => handleSelectEnseignant(enseignant.id)}
                              color={selectedEnseignant === enseignant.id ? 'blue' : 'gray'}
                            >
                              {selectedEnseignant === enseignant.id ? 'Sélectionné' : 'Sélectionner'}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

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

      {/* COMPTES BANCAIRES */}
      {selectedEnseignant && (
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <div>
                <Title order={4}>
                  Comptes bancaires de {enseignantMap[selectedEnseignant]?.nom} {enseignantMap[selectedEnseignant]?.prenom}
                </Title>
                <Text size="sm" c="dimmed">
                  {comptes.length} compte{comptes.length > 1 ? 's' : ''} enregistré{comptes.length > 1 ? 's' : ''}
                </Text>
              </div>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setModalOpened(true)}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Ajouter un compte
              </Button>
            </Group>

            <Divider />

            {comptes.length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                Aucun compte bancaire enregistré pour cet enseignant.
              </Alert>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Banque</Table.Th>
                    <Table.Th>Numéro de compte</Table.Th>
                    <Table.Th>Statut</Table.Th>
                    <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {comptes.map((compte) => (
                    <Table.Tr key={compte.id}>
                      <Table.Td>
                        <Badge color="cyan" variant="light" size="sm">
                          {compte.banque}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{compte.numero_compte}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={compte.actif ? 'green' : 'gray'} variant="light">
                          {compte.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {!compte.actif && (
                            <ActionIcon
                              color="green"
                              onClick={() => handleSetActif(compte.id, compte.enseignant_id)}
                              loading={setActifMutation.isPending}
                              title="Définir comme compte actif"
                              variant="subtle"
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          )}
                          <ActionIcon 
                            color="red" 
                            onClick={() => deleteMutation.mutate(compte.id)}
                            loading={deleteMutation.isPending}
                            title="Supprimer"
                            variant="subtle"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Card>
      )}

      {/* MODAL AJOUT COMPTE */}
      <Modal 
        opened={modalOpened} 
        onClose={() => {
          setModalOpened(false);
          setFormData({ enseignant_id: null, banque_id: null, numero_compte: '' });
        }} 
        title="Ajouter un compte bancaire"
        size="md"
        centered
      >
        <Stack gap="md">
          <Select
            label="Enseignant"
            placeholder="Sélectionner un enseignant"
            data={enseignants.map(e => ({
              value: String(e.id),
              label: `${e.nom} ${e.prenom}`,
            }))}
            value={formData.enseignant_id?.toString() || null}
            onChange={(v) => setFormData({ ...formData, enseignant_id: v ? parseInt(v) : null })}
            required
          />

          <Select
            label="Banque"
            placeholder="Sélectionner une banque"
            data={banques.map(b => ({
              value: String(b.id),
              label: b.designation,
            }))}
            value={formData.banque_id?.toString() || null}
            onChange={(v) => setFormData({ ...formData, banque_id: v ? parseInt(v) : null })}
            required
          />

          <TextInput
            label="Numéro de compte"
            placeholder="Entrez le numéro de compte"
            value={formData.numero_compte}
            onChange={(e) => setFormData({ ...formData, numero_compte: e.currentTarget.value })}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              loading={createMutation.isPending}
              disabled={!formData.enseignant_id || !formData.banque_id || !formData.numero_compte}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Créer le compte
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Sélectionnez d'abord un enseignant dans la liste</Text>
          <Text size="sm">2. Cliquez sur "Ajouter un compte" pour créer un compte bancaire</Text>
          <Text size="sm">3. Un seul compte peut être actif par enseignant</Text>
          <Text size="sm">4. Le compte actif sera utilisé pour les virements automatiques</Text>
          <Text size="sm">5. Utilisez la recherche pour trouver rapidement un enseignant</Text>
        </Stack>
        
        <Divider my="md" />
        
        <Title order={5} mb="md">📝 Notes importantes</Title>
        <Stack gap="xs">
          <Text size="sm">• Les comptes bancaires sont liés aux enseignants et aux banques</Text>
          <Text size="sm">• Seul le compte actif reçoit les virements</Text>
          <Text size="sm">• La suppression d'un compte est définitive</Text>
          <Text size="sm">• Les banques doivent être préalablement créées dans le référentiel</Text>
        </Stack>
      </Card>
    </Stack>
  );
}

// Ajout du composant ScrollArea manquant
import { ScrollArea } from '@mantine/core';