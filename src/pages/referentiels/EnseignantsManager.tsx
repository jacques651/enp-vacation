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
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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

  // Formulaire informations générales
  const infoForm = useForm({
    initialValues: {
      nom_etablissement: '',
      sigle: '',
      adresse: '',
      telephone: '',
      email: '',
    },
  });

  // Formulaire direction
  const directionForm = useForm({
    initialValues: {
      directeur_nom: '',
      directeur_titre: '',
      directeur_fonction: '',
    },
  });

  // Formulaire comptabilité
  const comptabiliteForm = useForm({
    initialValues: {
      comptable_nom: '',
      comptable_titre: '',
      comptable_fonction: '',
    },
  });

  // Formulaire autres paramètres
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
      refetch();
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
      refetch();
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
      refetch();
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
      refetch();
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
        refetch();
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
      refetch();
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
      {/* Header - Même style que ImportExcel */}
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

      {/* Tabs - Même style que ImportExcel */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
        <Tabs.List grow>
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
      {/* Onglet Informations */}
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

      {/* Onglet Logo */}
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

      {/* Onglet Direction */}
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

      {/* Onglet Comptabilité */}
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

      {/* Onglet Autres */}
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
      </Tabs>

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

      {/* Instructions - Même style que ImportExcel */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Remplissez les informations de l'établissement dans l'onglet "Informations"</Text>
          <Text size="sm">2. Importez le logo dans l'onglet "Logo" (format PNG ou JPG)</Text>
          <Text size="sm">3. Renseignez les responsables dans les onglets "Direction" et "Comptabilité"</Text>
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
        </Stack>
      </Card>
    </Stack>
  );
}
