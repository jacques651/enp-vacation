import { useState } from 'react';
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
} from '@mantine/core';
import { IconSettings, IconCheck, IconAlertCircle, IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

export default function EnteteSimple() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  // Récupérer toutes les configurations
  const { data: entetes = [], isLoading, error } = useQuery<Entete[]>({
    queryKey: ['entete'],
    queryFn: async () => {
      const result = await invoke<Entete[]>('get_entetes');
      return result || [];
    },
  });

  // Mettre à jour ou créer une configuration (UPSERT)
  const upsertMutation = useMutation({
    mutationFn: ({ cle, valeur }: { cle: string; valeur: string | null }) =>
      invoke<Entete>('set_entete_value', { cle, valeur }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entete'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error: string) => {
      console.error('Erreur:', error);
    },
  });

  // Supprimer une configuration
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_entete', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entete'] });
      setDeleteKey(null);
    },
  });

  const resetForm = () => {
    setEditingKey(null);
    setFormKey('');
    setFormValue('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Entete) => {
    setEditingKey(item.cle);
    setFormKey(item.cle);
    setFormValue(item.valeur || '');
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formKey.trim()) return;

    upsertMutation.mutate({
      cle: formKey.trim(),
      valeur: formValue.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement de la configuration...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger la configuration
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
            <Title order={2} c="white">Configuration de l'en-tête</Title>
            <Text size="sm" c="gray.3">
              Personnalisez les informations qui apparaissent sur les états de liquidation
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconSettings size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Configurations</Title>
              <Text size="sm" c="dimmed">
                Gérez les clés et valeurs utilisées dans les états
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Ajouter une configuration
            </Button>
          </Group>

          <Divider />

          {/* TABLEAU DES CONFIGURATIONS */}
          {entetes.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune configuration trouvée. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <ScrollArea style={{ maxHeight: 500 }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 200 }}>Clé</Table.Th>
                    <Table.Th>Valeur</Table.Th>
                    <Table.Th style={{ width: 100, textAlign: 'center' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...entetes]
                    .sort((a, b) => a.id - b.id)
                    .map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Badge color="blue" variant="light" size="sm">
                            {item.cle}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.valeur || '—'}
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
                              onClick={() => setDeleteKey(item.cle)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}

          {/* MESSAGE DE SUCCÈS */}
          {upsertMutation.isSuccess && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Configuration sauvegardée avec succès
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
        title={editingKey ? "Modifier la configuration" : "Ajouter une configuration"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Clé"
            placeholder="ex: directeur_nom, ecole, ministere"
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            disabled={!!editingKey}
            withAsterisk
            description="Identifiant unique de la configuration"
          />
          <TextInput
            label="Valeur"
            placeholder="ex: BELEM, ECOLE NATIONALE DE POLICE"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            description="Valeur associée à la clé (optionnel)"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              loading={upsertMutation.isPending}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              {editingKey ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DE CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteKey !== null}
        onClose={() => setDeleteKey(null)}
        title="Confirmation de suppression"
        centered
      >
        <Stack>
          <Text>
            Êtes-vous sûr de vouloir supprimer la configuration <strong>"{deleteKey}"</strong> ?
          </Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setDeleteKey(null)}>
              Annuler
            </Button>
            <Button
              color="red"
              onClick={() => {
                const enteteToDelete = entetes.find(e => e.cle === deleteKey);
                if (enteteToDelete) {
                  deleteMutation.mutate(enteteToDelete.id);
                }
              }}
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
          <Text size="sm">1. Les configurations sont stockées sous forme de clé-valeur</Text>
          <Text size="sm">2. Utilisez la clé pour identifier le champ (ex: "directeur_nom")</Text>
          <Text size="sm">3. La valeur sera affichée sur les états de liquidation</Text>
          <Text size="sm">4. La clé est unique - si elle existe déjà, elle sera mise à jour</Text>
          <Text size="sm">5. Vous pouvez modifier ou supprimer n'importe quelle configuration</Text>
        </Stack>
      </Card>
    </Stack>
  );
}