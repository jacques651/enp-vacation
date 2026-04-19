// src/components/LogoUploader.tsx

import { useState } from 'react';
import {
  Stack,
  Card,
  Text,
  Group,
  Button,
  Image,
  FileInput,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { IconUpload, IconTrash, IconPhoto, IconAlertCircle } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function LogoUploader() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Récupérer le logo existant
  const { data: logoBase64, isLoading } = useQuery({
    queryKey: ['logo'],
    queryFn: async () => {
      const result = await invoke<string | null>('get_logo_base64');
      return result;
    },
  });

  // Upload du logo
  const uploadMutation = useMutation({
    mutationFn: async (base64: string) => {
      await invoke('upload_logo_base64', { logoBase64: base64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logo'] });
      setFile(null);
      setPreview(null);
    },
    onError: (error) => {
      console.error('Erreur upload:', error);
    },
  });

  // Suppression du logo
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await invoke('delete_logo_base64');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logo'] });
      setPreview(null);
    },
    onError: (error) => {
      console.error('Erreur suppression:', error);
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPreview(base64);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        uploadMutation.mutate(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Card withBorder radius="md" p="lg" pos="relative">
      <LoadingOverlay visible={isLoading || uploadMutation.isPending || deleteMutation.isPending} />
      
      <Group justify="space-between" mb="md">
        <Group>
          <IconPhoto size={24} />
          <Text fw={600}>Logo de l'établissement</Text>
        </Group>
        {(logoBase64 || preview) && (
          <Button
            variant="light"
            color="red"
            size="sm"
            leftSection={<IconTrash size={16} />}
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        )}
      </Group>

      {/* Aperçu du logo */}
      {(logoBase64 || preview) && (
        <Card withBorder p="md" mb="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="center">
            <Image
              src={preview || logoBase64 || undefined}
              alt="Logo"
              fit="contain"
              style={{ maxWidth: 200, maxHeight: 150 }}
            />
          </Group>
        </Card>
      )}

      {/* Upload de nouveau logo */}
      <Stack gap="md">
        <FileInput
          label="Choisir un logo"
          description="Formats supportés: PNG, JPG, JPEG (max 2MB)"
          placeholder="Cliquez pour sélectionner"
          accept="image/png,image/jpeg,image/jpg"
          value={file}
          onChange={handleFileChange}
          leftSection={<IconUpload size={16} />}
        />

        {file && (
          <Alert icon={<IconAlertCircle size={16} />} color="info" variant="light">
            Fichier sélectionné: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          loading={uploadMutation.isPending}
          disabled={!file}
          variant="gradient"
          gradient={{ from: 'blue', to: 'cyan' }}
          fullWidth
        >
          {uploadMutation.isPending ? 'Upload en cours...' : 'Uploader le logo'}
        </Button>
      </Stack>

      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mt="md">
        <Text size="sm">Le logo apparaîtra sur les en-têtes des documents officiels (états de liquidation, ordres de virement, etc.)</Text>
      </Alert>
    </Card>
  );
}