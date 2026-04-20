import { useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Table,
  Badge,
  TextInput,
  NumberInput,
  ActionIcon,
  Modal,
  Alert,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconSchool } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

export default function CyclesManager() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [designation, setDesignation] = useState('');
  const [nbClasse, setNbClasse] = useState<number>(1);

  // Récupérer les cycles
  const { data: cycles = [], isLoading, error } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const result = await invoke<Cycle[]>('get_cycles');
      return result;
    },
  });

  // Créer un cycle (avec payload)
  const createMutation = useMutation({
    mutationFn: async (data: { designation: string; nb_classe: number }) => {
      console.log('Envoi:', data);
      return await invoke('create_cycle', { payload: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setModalOpen(false);
      resetForm();
      notifications.show({
        title: 'Succès',
        message: 'Cycle créé avec succès',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.toString(),
        color: 'red',
      });
    },
  });

  // Modifier un cycle (avec payload)
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; designation: string; nb_classe: number }) => {
      return await invoke('update_cycle', { payload: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setModalOpen(false);
      resetForm();
      notifications.show({
        title: 'Succès',
        message: 'Cycle modifié avec succès',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.toString(),
        color: 'red',
      });
    },
  });

  // Supprimer un cycle
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await invoke('delete_cycle', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      notifications.show({
        title: 'Succès',
        message: 'Cycle supprimé avec succès',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Erreur',
        message: error.toString(),
        color: 'red',
      });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setDesignation('');
    setNbClasse(1);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (cycle: Cycle) => {
    setEditingId(cycle.id);
    setDesignation(cycle.designation);
    setNbClasse(cycle.nb_classe);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!designation.trim()) {
      notifications.show({
        title: 'Erreur',
        message: 'La désignation est requise',
        color: 'red',
      });
      return;
    }
    if (nbClasse < 1) {
      notifications.show({
        title: 'Erreur',
        message: 'Le nombre de classes doit être supérieur à 0',
        color: 'red',
      });
      return;
    }

    const data = { designation: designation.trim(), nb_classe: nbClasse };

    if (editingId) {
      updateMutation.mutate({ ...data, id: editingId });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <Stack p="md">
        <Card withBorder radius="md" p="lg" bg="adminBlue.8">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={2} c="white">
                Gestion des cycles
              </Title>
              <Text size="sm" c="gray.3">
                Gérez les cycles d'études
              </Text>
            </Stack>
            <ThemeIcon size={48} radius="md" color="white" variant="light">
              <IconSchool size={28} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder radius="md" p="lg">
          <Text>Chargement des cycles...</Text>
        </Card>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack p="md">
        <Card withBorder radius="md" p="lg" bg="adminBlue.8">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={2} c="white">
                Gestion des cycles
              </Title>
              <Text size="sm" c="gray.3">
                Gérez les cycles d'études
              </Text>
            </Stack>
            <ThemeIcon size={48} radius="md" color="white" variant="light">
              <IconSchool size={28} />
            </ThemeIcon>
          </Group>
        </Card>
        <Card withBorder radius="md" p="lg">
          <Alert color="red" title="Erreur">
            Impossible de charger les cycles: {error.toString()}
          </Alert>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* Header */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">
              Gestion des cycles
            </Title>
            <Text size="sm" c="gray.3">
              Gérez les cycles d'études et leur nombre de classes
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconSchool size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Contenu principal */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* En-tête tableau */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Cycles</Title>
              <Text size="sm" c="dimmed">
                {cycles.length} cycle{cycles.length > 1 ? 's' : ''} enregistré
                {cycles.length > 1 ? 's' : ''}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreate}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter un cycle
            </Button>
          </Group>

          <Divider />

          {/* Tableau */}
          {cycles.length === 0 ? (
            <Alert color="blue" variant="light">
              Aucun cycle trouvé. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 80 }}>ID</Table.Th>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th style={{ width: 150 }}>Nombre de classes</Table.Th>
                  <Table.Th style={{ width: 100, textAlign: 'center' }}>
                    Actions
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cycles.map((cycle) => (
                  <Table.Tr key={cycle.id}>
                    <Table.Td>
                      <Badge color="gray" variant="light" size="sm">
                        {cycle.id}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {cycle.designation}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="teal" variant="light" size="sm">
                        {cycle.nb_classe} classe{cycle.nb_classe > 1 ? 's' : ''}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => openEdit(cycle)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => deleteMutation.mutate(cycle.id)}
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

      {/* Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Modifier le cycle' : 'Ajouter un cycle'}
        size="md"
        radius="md"
      >
        <Stack gap="md">
          <TextInput
            label="Désignation"
            placeholder="Ex: EL Sous-officiers PN, EL Inspecteurs PM..."
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            withAsterisk
            description="Nom du cycle d'études"
          />
          <NumberInput
            label="Nombre de classes"
            placeholder="Ex: 2"
            value={nbClasse}
            onChange={(val) => setNbClasse(Number(val))}
            min={1}
            withAsterisk
            description="Nombre de classes dans ce cycle"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpen(false)}>
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

      {/* Instructions */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">
          📋 Instructions
        </Title>
        <Stack gap="xs">
          <Text size="sm">1. Les cycles représentent les différents corps élèves</Text>
          <Text size="sm">2. Chaque cycle peut avoir un nombre spécifique de classes</Text>
          <Text size="sm">3. Les cycles sont utilisés pour organiser les modules et matières</Text>
          <Text size="sm">4. La suppression d'un cycle n'est possible que s'il n'a pas de modules associés</Text>
        </Stack>

        <Divider my="md" />

        <Title order={5} mb="md">
          📝 Notes importantes
        </Title>
        <Stack gap="xs">
          <Text size="sm">• La désignation du cycle doit être unique</Text>
          <Text size="sm">• Le nombre de classes influence le calcul des volumes horaires</Text>
          <Text size="sm">• Les modules et matières sont rattachés à un cycle</Text>
          <Text size="sm">• Un cycle utilisé ne peut pas être supprimé</Text>
        </Stack>
      </Card>
    </Stack>
  );
}