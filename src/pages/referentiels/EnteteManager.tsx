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
  IconEye,
  IconEyeOff,
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

interface CreateEntete {
  cle: string;
  valeur: string | null;
}

export default function EnteteManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('liste');
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Récupérer toutes les entêtes
  const { data: entetes = [], isLoading, refetch } = useQuery({
    queryKey: ['entetes'],
    queryFn: async () => {
      const result = await invoke<Entete[]>('get_entetes');
      return Array.isArray(result) ? result : [];
    },
  });

  // Récupérer le logo existant
  const { data: existingLogo } = useQuery({
    queryKey: ['logo'],
    queryFn: async () => {
      const result = await invoke<string | null>('get_logo_base64');
      return result;
    },
  });

  // Formulaire pour créer/modifier
  const enteteForm = useForm({
    initialValues: {
      cle: '',
      valeur: '',
    },
    validate: {
      cle: (value) => (!value ? 'La clé est obligatoire' : null),
    },
  });

  // Filtrer les entêtes
  const filteredData = entetes.filter(entete =>
    entete.cle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entete.valeur && entete.valeur.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // CRUD Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateEntete) => {
      return await invoke('create_entete', { data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setModalOpened(false);
      resetForm();
      notifications.show({
        title: 'Succès',
        message: 'Paramètre créé avec succès',
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreateEntete }) => {
      return await invoke('update_entete', { id, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setModalOpened(false);
      resetForm();
      notifications.show({
        title: 'Succès',
        message: 'Paramètre mis à jour avec succès',
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await invoke('delete_entete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
      setDeleteId(null);
      notifications.show({
        title: 'Succès',
        message: 'Paramètre supprimé avec succès',
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
    enteteForm.reset();
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Entete) => {
    setEditingId(item.id);
    enteteForm.setValues({
      cle: item.cle,
      valeur: item.valeur || '',
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    const submitData = {
      cle: enteteForm.values.cle.trim(),
      valeur: enteteForm.values.valeur.trim() || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  // Formulaires pré-configurés
  const infoForm = useForm({
    initialValues: {
      nom_etablissement: '',
      sigle: '',
      adresse: '',
      telephone: '',
      email: '',
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

  // Charger les valeurs dans les formulaires
  useEffect(() => {
    if (entetes.length > 0) {
      const getValue = (cle: string) => entetes.find(e => e.cle === cle)?.valeur || '';
      
      infoForm.setValues({
        nom_etablissement: getValue('nom_etablissement'),
        sigle: getValue('sigle'),
        adresse: getValue('adresse'),
        telephone: getValue('telephone'),
        email: getValue('email'),
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

  // Sauvegarder une valeur
  const saveValue = async (cle: string, valeur: string | null) => {
    try {
      await invoke('set_entete_value', { cle, valeur });
      return true;
    } catch (error) {
      console.error(`Erreur sauvegarde ${cle}:`, error);
      return false;
    }
  };

  // Sauvegarder formulaire
  const handleSaveInfo = async (values: typeof infoForm.values) => {
    setSaving(true);
    let success = true;
    
    for (const [key, value] of Object.entries(values)) {
      const saved = await saveValue(key, value || null);
      if (!saved) success = false;
    }
    
    if (success) {
      notifications.show({ title: 'Succès', message: 'Informations mises à jour', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
    } else {
      notifications.show({ title: 'Erreur', message: 'Erreur lors de la sauvegarde', color: 'red' });
    }
    setSaving(false);
  };

  const handleSaveDirection = async (values: typeof directionForm.values) => {
    setSaving(true);
    let success = true;
    
    for (const [key, value] of Object.entries(values)) {
      const saved = await saveValue(key, value || null);
      if (!saved) success = false;
    }
    
    if (success) {
      notifications.show({ title: 'Succès', message: 'Informations direction mises à jour', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
    } else {
      notifications.show({ title: 'Erreur', message: 'Erreur lors de la sauvegarde', color: 'red' });
    }
    setSaving(false);
  };

  const handleSaveComptabilite = async (values: typeof comptabiliteForm.values) => {
    setSaving(true);
    let success = true;
    
    for (const [key, value] of Object.entries(values)) {
      const saved = await saveValue(key, value || null);
      if (!saved) success = false;
    }
    
    if (success) {
      notifications.show({ title: 'Succès', message: 'Informations comptabilité mises à jour', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
    } else {
      notifications.show({ title: 'Erreur', message: 'Erreur lors de la sauvegarde', color: 'red' });
    }
    setSaving(false);
  };

  const handleSaveAutres = async (values: typeof autresForm.values) => {
    setSaving(true);
    let success = true;
    
    for (const [key, value] of Object.entries(values)) {
      const saved = await saveValue(key, value || null);
      if (!saved) success = false;
    }
    
    if (success) {
      notifications.show({ title: 'Succès', message: 'Paramètres mis à jour', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
    } else {
      notifications.show({ title: 'Erreur', message: 'Erreur lors de la sauvegarde', color: 'red' });
    }
    setSaving(false);
  };

  // Gestion du logo
  const handleLogoUpload = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setLogoPreview(base64);
      setUploading(true);
      
      try {
        await invoke('upload_logo_base64', { logoBase64: base64 });
        notifications.show({ title: 'Succès', message: 'Logo uploadé avec succès', color: 'green' });
        queryClient.invalidateQueries({ queryKey: ['logo'] });
        queryClient.invalidateQueries({ queryKey: ['entetes'] });
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
      queryClient.invalidateQueries({ queryKey: ['logo'] });
      queryClient.invalidateQueries({ queryKey: ['entetes'] });
    } catch (error: any) {
      notifications.show({ title: 'Erreur', message: error.toString(), color: 'red' });
    }
  };

  if (isLoading) {
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
            <Text size="sm" c="gray.3">
              Configuration de l'établissement et des responsables
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconTableImport size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
        <Tabs.List grow>
          <Tabs.Tab value="liste" leftSection={<IconSettings size={16} />}>
            Liste des paramètres
          </Tabs.Tab>
          <Tabs.Tab value="informations" leftSection={<IconBuilding size={16} />}>
            Informations
          </Tabs.Tab>
          <Tabs.Tab value="logo" leftSection={<IconPhoto size={16} />}>
            Logo
          </Tabs.Tab>
          <Tabs.Tab value="direction" leftSection={<IconUsers size={16} />}>
            Direction
          </Tabs.Tab>
          <Tabs.Tab value="comptabilite" leftSection={<IconDeviceFloppy size={16} />}>
            Comptabilité
          </Tabs.Tab>
          <Tabs.Tab value="autres" leftSection={<IconSettings size={16} />}>
            Autres
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Onglet Liste des paramètres (NOUVEAU) */}
      <Tabs.Panel value="liste">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <div>
                <Title order={4}>Tous les paramètres</Title>
                <Text size="sm" c="dimmed">
                  Gérez tous les paramètres de l'application
                </Text>
              </div>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCreateModal}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Ajouter un paramètre
              </Button>
            </Group>

            <Divider />

            {/* Recherche */}
            <TextInput
              placeholder="Rechercher par clé ou valeur..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />

            {/* Tableau */}
            {filteredData.length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                Aucun paramètre trouvé. Cliquez sur "Ajouter" pour commencer.
              </Alert>
            ) : (
              <>
                <ScrollArea style={{ maxHeight: 500 }}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>ID</Table.Th>
                        <Table.Th>Clé</Table.Th>
                        <Table.Th>Valeur</Table.Th>
                        <Table.Th style={{ width: 100, textAlign: 'center' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paginatedData.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Badge color="gray" variant="light" size="sm">
                              {item.id}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="blue" variant="light" size="sm">
                              {item.cle}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" lineClamp={2}>
                              {item.valeur || <Text span c="dimmed">(vide)</Text>}
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
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                {/* Pagination */}
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
      </Tabs.Panel>

      {/* Onglet Informations (inchangé) */}
      <Tabs.Panel value="informations">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <div>
                <Title order={4}>Informations de l'établissement</Title>
                <Text size="sm" c="dimmed">
                  Modifiez les informations générales de l'établissement
                </Text>
              </div>
            </Group>

            <Divider />

            <form onSubmit={infoForm.onSubmit(handleSaveInfo)}>
              <Stack gap="md">
                <TextInput
                  label="Nom de l'établissement"
                  placeholder="ECOLE NATIONALE DE POLICE"
                  withAsterisk
                  {...infoForm.getInputProps('nom_etablissement')}
                />
                
                <TextInput
                  label="Sigle"
                  placeholder="ENP"
                  {...infoForm.getInputProps('sigle')}
                />
                
                <Textarea
                  label="Adresse"
                  placeholder="01 BP 1234 OUAGADOUGOU 01"
                  rows={3}
                  {...infoForm.getInputProps('adresse')}
                />
                
                <TextInput
                  label="Téléphone"
                  placeholder="25 36 11 11"
                  leftSection={<IconPhone size={16} />}
                  {...infoForm.getInputProps('telephone')}
                />
                
                <TextInput
                  label="Email"
                  placeholder="enp@police.bf"
                  leftSection={<IconMail size={16} />}
                  {...infoForm.getInputProps('email')}
                />
                
                <Group justify="flex-end" mt="md">
                  <Button 
                    type="submit" 
                    loading={saving} 
                    variant="gradient" 
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconCheck size={16} />}
                  >
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Tabs.Panel>

      {/* Onglet Logo (inchangé) */}
      <Tabs.Panel value="logo">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <div>
                <Title order={4}>Logo de l'établissement</Title>
                <Text size="sm" c="dimmed">
                  Format PNG, JPG (max 2MB)
                </Text>
              </div>
              {(existingLogo || logoPreview) && (
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  leftSection={<IconTrash size={16} />}
                  onClick={handleDeleteLogo}
                  loading={uploading}
                >
                  Supprimer
                </Button>
              )}
            </Group>

            <Divider />

            {(existingLogo || logoPreview) && (
              <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
                <Group justify="center">
                  <Image
                    src={logoPreview || existingLogo || undefined}
                    alt="Logo"
                    fit="contain"
                    style={{ maxWidth: 200, maxHeight: 150 }}
                  />
                </Group>
              </Paper>
            )}

            <div
              style={{
                border: '2px dashed #ced4da',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#f8f9fa',
              }}
              onClick={() => document.getElementById('logo-input')?.click()}
            >
              <IconUpload size={48} color="#228be6" />
              <Text size="lg" mt="md">
                Cliquez pour sélectionner un logo
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                Formats acceptés: PNG, JPG, JPEG
              </Text>
              <input
                id="logo-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
            </div>
          </Stack>
        </Card>
      </Tabs.Panel>

      {/* Onglet Direction (inchangé) */}
      <Tabs.Panel value="direction">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <div>
              <Title order={4}>Direction de l'établissement</Title>
              <Text size="sm" c="dimmed">
                Informations du Directeur
              </Text>
            </div>

            <Divider />

            <form onSubmit={directionForm.onSubmit(handleSaveDirection)}>
              <Stack gap="md">
                <TextInput
                  label="Nom du Directeur"
                  placeholder="Nom et prénom"
                  {...directionForm.getInputProps('directeur_nom')}
                />
                
                <TextInput
                  label="Titre du Directeur"
                  placeholder="Colonel, Contrôleur Général..."
                  {...directionForm.getInputProps('directeur_titre')}
                />
                
                <TextInput
                  label="Fonction du Directeur"
                  placeholder="Directeur Général"
                  {...directionForm.getInputProps('directeur_fonction')}
                />
                
                <Group justify="flex-end" mt="md">
                  <Button 
                    type="submit" 
                    loading={saving} 
                    variant="gradient" 
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconCheck size={16} />}
                  >
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Tabs.Panel>

      {/* Onglet Comptabilité (inchangé) */}
      <Tabs.Panel value="comptabilite">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <div>
              <Title order={4}>Service Comptabilité</Title>
              <Text size="sm" c="dimmed">
                Informations du Comptable
              </Text>
            </div>

            <Divider />

            <form onSubmit={comptabiliteForm.onSubmit(handleSaveComptabilite)}>
              <Stack gap="md">
                <TextInput
                  label="Nom du Comptable"
                  placeholder="Nom et prénom"
                  {...comptabiliteForm.getInputProps('comptable_nom')}
                />
                
                <TextInput
                  label="Titre du Comptable"
                  placeholder="Inspecteur, Agent principal..."
                  {...comptabiliteForm.getInputProps('comptable_titre')}
                />
                
                <TextInput
                  label="Fonction du Comptable"
                  placeholder="Comptable Matières"
                  {...comptabiliteForm.getInputProps('comptable_fonction')}
                />
                
                <Group justify="flex-end" mt="md">
                  <Button 
                    type="submit" 
                    loading={saving} 
                    variant="gradient" 
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconCheck size={16} />}
                  >
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Tabs.Panel>

      {/* Onglet Autres (inchangé) */}
      <Tabs.Panel value="autres">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <div>
              <Title order={4}>Autres paramètres</Title>
              <Text size="sm" c="dimmed">
                Configuration avancée
              </Text>
            </div>

            <Divider />

            <form onSubmit={autresForm.onSubmit(handleSaveAutres)}>
              <Stack gap="md">
                <TextInput
                  label="Signataire par défaut"
                  placeholder="Nom du signataire par défaut"
                  description="Utilisé si aucun signataire spécifique n'est choisi"
                  {...autresForm.getInputProps('signataire_defaut')}
                />
                
                <TextInput
                  label="Version du document"
                  placeholder="1"
                  description="Version actuelle des documents"
                  {...autresForm.getInputProps('version_document')}
                />
                
                <Group justify="flex-end" mt="md">
                  <Button 
                    type="submit" 
                    loading={saving} 
                    variant="gradient" 
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconCheck size={16} />}
                  >
                    Enregistrer
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Tabs.Panel>

      {/* Modal CRUD */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          resetForm();
        }}
        title={editingId ? "Modifier le paramètre" : "Ajouter un paramètre"}
        size="md"
      >
        <form onSubmit={enteteForm.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Clé"
              placeholder="ex: nom_etablissement"
              description="Identifiant unique du paramètre"
              withAsterisk
              disabled={!!editingId}
              {...enteteForm.getInputProps('cle')}
            />
            
            <Textarea
              label="Valeur"
              placeholder="Valeur du paramètre"
              rows={4}
              {...enteteForm.getInputProps('valeur')}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setModalOpened(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                {editingId ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmation"
        centered
      >
        <Stack>
          <Text>Êtes-vous sûr de vouloir supprimer ce paramètre ?</Text>
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

      {/* Section Aperçu */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Aperçu de l'en-tête</Title>
        <Paper withBorder p="md" style={{ backgroundColor: '#fafafa' }}>
          <Stack gap={4} align="center">
            {existingLogo && (
              <Image src={existingLogo} alt="Logo" fit="contain" style={{ maxWidth: 100, maxHeight: 80 }} />
            )}
            <Text fw={700} size="xl" tt="uppercase" ta="center">
              {infoForm.values.nom_etablissement || 'ECOLE NATIONALE DE POLICE'}
            </Text>
            {infoForm.values.sigle && (
              <Text size="sm" c="dimmed">{infoForm.values.sigle}</Text>
            )}
            {infoForm.values.adresse && (
              <Text size="xs" c="dimmed">{infoForm.values.adresse}</Text>
            )}
            <Divider my="sm" w="100%" />
            <Group justify="center" gap="xl">
              {infoForm.values.telephone && <Text size="xs">📞 {infoForm.values.telephone}</Text>}
              {infoForm.values.email && <Text size="xs">✉️ {infoForm.values.email}</Text>}
            </Group>
          </Stack>
        </Paper>
      </Card>

      {/* Instructions */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Utilisez l'onglet "Liste des paramètres" pour voir, ajouter, modifier ou supprimer des paramètres</Text>
          <Text size="sm">2. Les onglets "Informations", "Direction", "Comptabilité" et "Autres" sont des raccourcis vers les paramètres courants</Text>
          <Text size="sm">3. Importez le logo dans l'onglet "Logo" (format PNG ou JPG)</Text>
          <Text size="sm">4. Les modifications sont automatiquement enregistrées</Text>
          <Text size="sm">5. L'aperçu en bas montre le rendu sur les documents officiels</Text>
        </Stack>
        
        <Divider my="md" />
        
        <Title order={5} mb="md">📝 Notes importantes</Title>
        <Stack gap="xs">
          <Text size="sm">• Le logo apparaîtra sur les états de liquidation et les ordres de virement</Text>
          <Text size="sm">• Les informations de direction sont utilisées pour les signatures officielles</Text>
          <Text size="sm">• Le signataire par défaut sera pré-sélectionné dans les documents</Text>
          <Text size="sm">• La version du document permet de suivre les mises à jour des templates</Text>
          <Text size="sm">• Vous pouvez ajouter n'importe quel paramètre personnalisé via l'onglet "Liste"</Text>
        </Stack>
      </Card>
    </Stack>
  );
}