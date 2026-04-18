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
  Switch,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconCheck,
  IconAlertCircle,
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
  banque: string; // jointure avec le nom de la banque
}

// ================= COMPONENT =================

export default function ComptesBancairesManager() {
  const queryClient = useQueryClient();

  const [modalOpened, setModalOpened] = useState(false);
  const [selectedEnseignant, setSelectedEnseignant] = useState<number | null>(null);
  const [search, setSearch] = useState('');

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

  // Récupérer les comptes pour un enseignant spécifique
  const { 
    data: comptes = [], 
    isLoading: isLoadingComptes,
    refetch: refetchComptes 
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

  // ================= FILTER =================

  const filteredEnseignants = enseignants.filter(e => {
    const label = `${e.nom} ${e.prenom}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

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
  };

  const isLoading = isLoadingEnseignants || isLoadingBanques || isLoadingComptes;

  // ================= UI =================

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />

      {/* HEADER */}
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between">
          <div>
            <Title order={3}>Comptes bancaires</Title>
            <Text size="sm" c="dimmed">
              Gérez les comptes bancaires des enseignants
            </Text>
          </div>
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={() => setModalOpened(true)}
            disabled={!selectedEnseignant}
          >
            Ajouter un compte
          </Button>
        </Group>
      </Card>

      {/* RECHERCHE ENSEIGNANT */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">Sélectionner un enseignant</Title>
        <TextInput
          placeholder="Rechercher un enseignant..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="md"
        />
        
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Prénom</Table.Th>
              <Table.Th style={{ width: 100 }}>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEnseignants.map((enseignant) => (
              <Table.Tr 
                key={enseignant.id}
                bg={selectedEnseignant === enseignant.id ? 'blue.0' : undefined}
              >
                <Table.Td>{enseignant.nom}</Table.Td>
                <Table.Td>{enseignant.prenom}</Table.Td>
                <Table.Td>
                  <Button
                    variant={selectedEnseignant === enseignant.id ? 'filled' : 'light'}
                    size="xs"
                    onClick={() => handleSelectEnseignant(enseignant.id)}
                  >
                    {selectedEnseignant === enseignant.id ? 'Sélectionné' : 'Sélectionner'}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* COMPTES BANCAIRES */}
      {selectedEnseignant && (
        <Card withBorder radius="md" p="lg">
          <Title order={5} mb="md">
            Comptes bancaires de {enseignantMap[selectedEnseignant]?.nom} {enseignantMap[selectedEnseignant]?.prenom}
          </Title>

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
                    <Table.Td>{compte.banque}</Table.Td>
                    <Table.Td>{compte.numero_compte}</Table.Td>
                    <Table.Td>
                      <Badge color={compte.actif ? 'green' : 'gray'}>
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
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon 
                          color="red" 
                          onClick={() => deleteMutation.mutate(compte.id)}
                          loading={deleteMutation.isPending}
                          title="Supprimer"
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
      >
        <Stack>
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

          <Button 
            onClick={handleSubmit} 
            loading={createMutation.isPending}
            disabled={!formData.enseignant_id || !formData.banque_id || !formData.numero_compte}
          >
            Créer le compte
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}