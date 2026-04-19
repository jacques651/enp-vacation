// src/pages/referentiels/EnteteManager.tsx

import { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  TextInput,
  Textarea,
  Alert,
  Tabs,
  Paper,
  Divider,
  Loader,
  ThemeIcon,
  Image,
  Table,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Pagination,
} from '@mantine/core';
import {
  IconSettings,
  IconPhoto,
  IconBuilding,
  IconUsers,
  IconDeviceFloppy,
  IconTrash,
  IconUpload,
  IconAlertCircle,
  IconCheck,
  IconMail,
  IconPhone,
  IconTableImport,
  IconEdit,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

export default function EnteteManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('informations');
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<Entete | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [initializing, setInitializing] = useState(false);
  const itemsPerPage = 10;

  // Récupérer toutes les entêtes
  const { data: entetes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['entetes'],
    queryFn: async () => {
      const result = await invoke<Entete[]>('get_entetes');
      return Array.isArray(result) ? result : [];
    },
  });

  // Récupérer le logo existant
  const { data: existingLogo, refetch: refetchLogo } = useQuery({
    queryKey: ['logo'],
    queryFn: async () => {
      const result = await invoke<string | null>('get_logo_base64');
      return result;
    },
  });

  // Initialiser les paramètres par défaut
  const initializeDefaultEntetes = useMutation({
    mutationFn: async () => {
      return await invoke('init_default_entetes');
    },
    onSuccess: () => {
      notifications.show({ title: 'Succès', message: 'Paramètres par défaut initialisés', color: 'green' });
      refetch();
    },
    onError: (error: any) => {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    },
  });

  useEffect(() => {
    if (entetes.length === 0 && !isLoading && !initializing) {
      setInitializing(true);
      initializeDefaultEntetes.mutate(undefined, {
        onSettled: () => setInitializing(false)
      });
    }
  }, [entetes, isLoading]);

  // Formulaire pour créer/modifier
  const enteteForm = useForm({
    initialValues: {
      cle: '',
      valeur: '',
    },
    validate: {
      cle: (value) => {
        if (!value) return 'La clé est obligatoire';
        if (!/^[a-z_]+$/.test(value)) return 'La clé doit contenir uniquement des lettres minuscules et underscores';
        return null;
      },
    },
  });

  // Filtrer et paginer
  const filteredData = entetes.filter(entete =>
    entete.cle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entete.valeur && entete.valeur.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedData = [...filteredData].sort((a, b) => a.cle.localeCompare(b.cle));
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // CRUD Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { cle: string; valeur: string | null }) => {
      return await invoke('create_entete', { cle: data.cle, valeur: data.valeur });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setModalOpened(false);
      resetForm();
      notifications.show({ title: 'Succès', message: 'Paramètre créé', color: 'green' });
    },
    onError: (error: any) => {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, cle, valeur }: { id: number; cle: string; valeur: string | null }) => {
      return await invoke('update_entete', { id, cle, valeur });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setModalOpened(false);
      resetForm();
      notifications.show({ title: 'Succès', message: 'Paramètre modifié', color: 'green' });
    },
    onError: (error: any) => {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await invoke('delete_entete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setDeleteId(null);
      notifications.show({ title: 'Succès', message: 'Paramètre supprimé', color: 'green' });
    },
    onError: (error: any) => {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    },
  });

  const resetForm = () => {
    setEditingItem(null);
    enteteForm.reset();
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Entete) => {
    setEditingItem(item);
    enteteForm.setValues({ cle: item.cle, valeur: item.valeur || '' });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!enteteForm.values.cle) return;

    const data = {
      cle: enteteForm.values.cle,
      valeur: enteteForm.values.valeur || null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Helper pour obtenir une valeur
  const getValue = (cle: string): string => {
    const item = entetes.find(e => e.cle === cle);
    return item?.valeur || '';
  };

  // Formulaires pré-configurés
  const infoForm = useForm({
    initialValues: {
      ministere: '',
      secretariat: '',
      nom_etablissement: '',
      sigle: '',
      direction_generale: '',
      direction_financiere: '',
      adresse: '',
      telephone: '',
      email: '',
      numero_courrier: '',
    },
  });

  const directionForm = useForm({
    initialValues: {
      directeur_nom: '',
      directeur_titre: '',
      directeur_fonction: '',
    },
  });

  const comptabiliteForm = useForm({
    initialValues: {
      comptable_nom: '',
      comptable_titre: '',
      comptable_fonction: '',
    },
  });

  const autresForm = useForm({
    initialValues: {
      signataire_defaut: '',
      version_document: '1',
    },
  });

  // Charger les valeurs
  useEffect(() => {
    if (entetes.length > 0) {
      infoForm.setValues({
        ministere: getValue('ministere'),
        secretariat: getValue('secretariat'),
        nom_etablissement: getValue('nom_etablissement'),
        sigle: getValue('sigle'),
        direction_generale: getValue('direction_generale'),
        direction_financiere: getValue('direction_financiere'),
        adresse: getValue('adresse'),
        telephone: getValue('telephone'),
        email: getValue('email'),
        numero_courrier: getValue('numero_courrier'),
      });
      directionForm.setValues({
        directeur_nom: getValue('directeur_nom'),
        directeur_titre: getValue('directeur_titre'),
        directeur_fonction: getValue('directeur_fonction'),
      });
      comptabiliteForm.setValues({
        comptable_nom: getValue('comptable_nom'),
        comptable_titre: getValue('comptable_titre'),
        comptable_fonction: getValue('comptable_fonction'),
      });
      autresForm.setValues({
        signataire_defaut: getValue('signataire_defaut'),
        version_document: getValue('version_document') || '1',
      });
    }
  }, [entetes]);

  // Sauvegardes
  const handleSaveInfo = async (values: typeof infoForm.values) => {
    setSaving(true);
    let success = true;
    for (const [key, value] of Object.entries(values)) {
      try {
        await invoke('set_entete_value', { cle: key, valeur: value || null });
      } catch (error) {
        success = false;
        notifications.show({ title: 'Erreur', message: `Erreur pour ${key}`, color: 'red' });
      }
    }
    if (success) {
      notifications.show({ title: 'Succès', message: 'Informations mises à jour', color: 'green' });
      await queryClient.invalidateQueries({ queryKey: ['entetes'] });
      await refetch();
    }
    setSaving(false);
  };

  const handleSaveDirection = async (values: typeof directionForm.values) => {
    setSaving(true);
    let success = true;
    for (const [key, value] of Object.entries(values)) {
      try {
        await invoke('set_entete_value', { cle: key, valeur: value || null });
      } catch (error) {
        success = false;
      }
    }
    if (success) {
      notifications.show({ title: 'Succès', message: 'Direction mise à jour', color: 'green' });
      await queryClient.invalidateQueries({ queryKey: ['entetes'] });
      await refetch();
    }
    setSaving(false);
  };

  const handleSaveComptabilite = async (values: typeof comptabiliteForm.values) => {
    setSaving(true);
    let success = true;
    for (const [key, value] of Object.entries(values)) {
      try {
        await invoke('set_entete_value', { cle: key, valeur: value || null });
      } catch (error) {
        success = false;
      }
    }
    if (success) {
      notifications.show({ title: 'Succès', message: 'Comptabilité mise à jour', color: 'green' });
      await queryClient.invalidateQueries({ queryKey: ['entetes'] });
      await refetch();
    }
    setSaving(false);
  };

  const handleSaveAutres = async (values: typeof autresForm.values) => {
    setSaving(true);
    let success = true;
    for (const [key, value] of Object.entries(values)) {
      try {
        await invoke('set_entete_value', { cle: key, valeur: value || null });
      } catch (error) {
        success = false;
      }
    }
    if (success) {
      notifications.show({ title: 'Succès', message: 'Paramètres mis à jour', color: 'green' });
      await queryClient.invalidateQueries({ queryKey: ['entetes'] });
      await refetch();
    }
    setSaving(false);
  };

  // Gestion du logo
  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifications.show({ title: 'Erreur', message: 'Logo max 2MB', color: 'red' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      notifications.show({ title: 'Erreur', message: 'Format image requis', color: 'red' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setLogoPreview(base64);
      setUploading(true);
      try {
        await invoke('upload_logo_base64', { logoBase64: base64 });
        notifications.show({ title: 'Succès', message: 'Logo uploadé', color: 'green' });
        await queryClient.invalidateQueries({ queryKey: ['logo'] });
        await queryClient.invalidateQueries({ queryKey: ['entetes'] });
        await refetchLogo();
      } catch (error: any) {
        notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    try {
      await invoke('delete_logo_base64');
      setLogoPreview(null);
      notifications.show({ title: 'Succès', message: 'Logo supprimé', color: 'green' });
      await queryClient.invalidateQueries({ queryKey: ['logo'] });
      await queryClient.invalidateQueries({ queryKey: ['entetes'] });
      await refetchLogo();
    } catch (error: any) {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    }
  };

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          <Text>Impossible de charger les paramètres: {error.toString()}</Text>
          <Button mt="md" onClick={() => refetch()}>Réessayer</Button>
        </Alert>
      </Card>
    );
  }

  if (isLoading || initializing) {
    return (
      <Group justify="center" p="xl">
        <Loader size="lg" />
      </Group>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* Header */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Paramètres généraux</Title>
            <Text size="sm" c="gray.3">Configuration de l'établissement</Text>
          </Stack>
          <Group>
            <Button variant="light" color="white" size="sm" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Rafraîchir
            </Button>
            <ThemeIcon size={48} radius="md" color="white" variant="light">
              <IconTableImport size={28} />
            </ThemeIcon>
          </Group>
        </Group>
      </Card>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
        <Tabs.List grow>
          <Tabs.Tab value="informations" leftSection={<IconBuilding size={16} />}>Informations</Tabs.Tab>
          <Tabs.Tab value="logo" leftSection={<IconPhoto size={16} />}>Logo</Tabs.Tab>
          <Tabs.Tab value="direction" leftSection={<IconUsers size={16} />}>Direction</Tabs.Tab>
          <Tabs.Tab value="comptabilite" leftSection={<IconDeviceFloppy size={16} />}>Comptabilité</Tabs.Tab>
          <Tabs.Tab value="autres" leftSection={<IconSettings size={16} />}>Autres</Tabs.Tab>
          <Tabs.Tab value="liste" leftSection={<IconSettings size={16} />}>Tous les paramètres</Tabs.Tab>
        </Tabs.List>

        {/* Onglet Informations */}
        <Tabs.Panel value="informations" pt="md">
          <Card withBorder radius="md" p="lg">
            <form onSubmit={infoForm.onSubmit(handleSaveInfo)}>
              <Stack gap="md">
                <TextInput label="Ministère" {...infoForm.getInputProps('ministere')} />
                <TextInput label="Secrétariat Général" {...infoForm.getInputProps('secretariat')} />
                <TextInput label="Nom de l'établissement" {...infoForm.getInputProps('nom_etablissement')} />
                <TextInput label="Sigle" {...infoForm.getInputProps('sigle')} />
                <TextInput label="Direction Générale" {...infoForm.getInputProps('direction_generale')} />
                <TextInput label="Direction Financière" {...infoForm.getInputProps('direction_financiere')} />
                <Textarea label="Adresse" rows={3} {...infoForm.getInputProps('adresse')} />
                <TextInput label="Téléphone" leftSection={<IconPhone size={16} />} {...infoForm.getInputProps('telephone')} />
                <TextInput label="Email" leftSection={<IconMail size={16} />} {...infoForm.getInputProps('email')} />
                <TextInput label="Numéro de courrier" {...infoForm.getInputProps('numero_courrier')} />
                <Group justify="flex-end">
                  <Button type="submit" loading={saving} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} leftSection={<IconCheck size={16} />}>
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Tabs.Panel>

        {/* Onglet Logo */}
        <Tabs.Panel value="logo" pt="md">
          <Card withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Title order={4}>Logo</Title>
                  <Text size="sm" c="dimmed">PNG, JPG (max 2MB)</Text>
                </div>
                {(existingLogo || logoPreview) && (
                  <Button variant="light" color="red" size="sm" leftSection={<IconTrash size={16} />} onClick={handleDeleteLogo} loading={uploading}>
                    Supprimer
                  </Button>
                )}
              </Group>
              <Divider />
              {(existingLogo || logoPreview) && (
                <Paper withBorder p="md" bg="#f8f9fa">
                  <Group justify="center">
                    <Image src={logoPreview || existingLogo || undefined} alt="Logo" fit="contain" style={{ maxWidth: 200, maxHeight: 150 }} />
                  </Group>
                </Paper>
              )}
              <div
                style={{ border: '2px dashed #ced4da', borderRadius: '8px', padding: '40px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8f9fa' }}
                onClick={() => document.getElementById('logo-input')?.click()}
              >
                <IconUpload size={48} color="#228be6" />
                <Text size="lg" mt="md">Cliquez pour sélectionner un logo</Text>
                <Text size="sm" c="dimmed" mt="xs">Formats: PNG, JPG, JPEG</Text>
                <input id="logo-input" type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              </div>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Onglet Direction */}
        <Tabs.Panel value="direction" pt="md">
          <Card withBorder radius="md" p="lg">
            <form onSubmit={directionForm.onSubmit(handleSaveDirection)}>
              <Stack gap="md">
                <TextInput label="Nom du Directeur" {...directionForm.getInputProps('directeur_nom')} />
                <TextInput label="Titre du Directeur" {...directionForm.getInputProps('directeur_titre')} />
                <TextInput label="Fonction du Directeur" {...directionForm.getInputProps('directeur_fonction')} />
                <Group justify="flex-end">
                  <Button type="submit" loading={saving} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} leftSection={<IconCheck size={16} />}>
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Tabs.Panel>

        {/* Onglet Comptabilité */}
        <Tabs.Panel value="comptabilite" pt="md">
          <Card withBorder radius="md" p="lg">
            <form onSubmit={comptabiliteForm.onSubmit(handleSaveComptabilite)}>
              <Stack gap="md">
                <TextInput label="Nom du Comptable" {...comptabiliteForm.getInputProps('comptable_nom')} />
                <TextInput label="Titre du Comptable" {...comptabiliteForm.getInputProps('comptable_titre')} />
                <TextInput label="Fonction du Comptable" {...comptabiliteForm.getInputProps('comptable_fonction')} />
                <Group justify="flex-end">
                  <Button type="submit" loading={saving} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} leftSection={<IconCheck size={16} />}>
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Tabs.Panel>

        {/* Onglet Autres */}
        <Tabs.Panel value="autres" pt="md">
          <Card withBorder radius="md" p="lg">
            <form onSubmit={autresForm.onSubmit(handleSaveAutres)}>
              <Stack gap="md">
                <TextInput label="Signataire par défaut" {...autresForm.getInputProps('signataire_defaut')} />
                <TextInput label="Version du document" {...autresForm.getInputProps('version_document')} />
                <Group justify="flex-end">
                  <Button type="submit" loading={saving} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} leftSection={<IconCheck size={16} />}>
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Tabs.Panel>

        {/* Onglet Tous les paramètres - CRUD COMPLET */}
        <Tabs.Panel value="liste" pt="md">
          <Card withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Title order={4}>Tous les paramètres</Title>
                  <Text size="sm" c="dimmed">Gérez tous les paramètres de l'application</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                  Ajouter
                </Button>
              </Group>
              <Divider />
              <TextInput placeholder="Rechercher..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
              
              {sortedData.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">Aucun paramètre trouvé</Alert>
              ) : (
                <>
                  <ScrollArea style={{ maxHeight: 500 }}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>ID</Table.Th><Table.Th>Clé</Table.Th><Table.Th>Valeur</Table.Th><Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {paginatedData.map((item) => (
                          <Table.Tr key={item.id}>
                            <Table.Td><Badge color="gray" variant="light">{item.id}</Badge></Table.Td>
                            <Table.Td><Badge color="blue" variant="light">{item.cle}</Badge></Table.Td>
                            <Table.Td><Text size="sm" lineClamp={2}>{item.valeur || <Text span c="dimmed" fs="italic">(vide)</Text>}</Text></Table.Td>
                            <Table.Td>
                              <Group gap="xs" justify="center">
                                <ActionIcon variant="subtle" color="blue" onClick={() => openEditModal(item)}><IconEdit size={16} /></ActionIcon>
                                <ActionIcon variant="subtle" color="red" onClick={() => setDeleteId(item.id)}><IconTrash size={16} /></ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                  {totalPages > 1 && <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" />}
                </>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Modal CRUD */}
      <Modal opened={modalOpened} onClose={() => { setModalOpened(false); resetForm(); }} title={editingItem ? "Modifier" : "Ajouter"} size="md">
        <form onSubmit={enteteForm.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput label="Clé" placeholder="ex: nom_etablissement" withAsterisk disabled={!!editingItem} {...enteteForm.getInputProps('cle')} />
            <Textarea label="Valeur" rows={4} {...enteteForm.getInputProps('valeur')} />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setModalOpened(false)}>Annuler</Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                {editingItem ? "Modifier" : "Créer"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal opened={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmation" centered>
        <Stack>
          <Text>Supprimer ce paramètre ?</Text>
          <Text size="sm" c="dimmed">Action irréversible</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button color="red" onClick={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}>Supprimer</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Aperçu */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Aperçu de l'en-tête</Title>
        <Paper withBorder p="md" bg="#fafafa">
          <Stack gap={4} align="center">
            {existingLogo && <Image src={existingLogo} alt="Logo" fit="contain" style={{ maxWidth: 100, maxHeight: 80 }} />}
            <Text fw={700} size="xl" tt="uppercase" ta="center">{getValue('nom_etablissement') || 'ECOLE NATIONALE DE POLICE'}</Text>
            {getValue('adresse') && <Text size="xs" c="dimmed">{getValue('adresse')}</Text>}
            <Divider w="100%" />
            <Group gap="xl">
              {getValue('telephone') && <Text size="xs">📞 {getValue('telephone')}</Text>}
              {getValue('email') && <Text size="xs">✉️ {getValue('email')}</Text>}
            </Group>
          </Stack>
        </Paper>
      </Card>
    </Stack>
  );
}