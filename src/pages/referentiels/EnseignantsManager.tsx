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
  Menu,
} from '@mantine/core';
import {
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconEdit,
  IconTrash,
  IconPlus,
  IconSearch,
  IconInfoCircle,
  IconDownload,
  IconFileExcel,
  IconFile,
  IconFileWord,
  IconPrinter,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Déclaration du type pour jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  titre: string;
  statut: string;
  vh_max: number;
}

interface CreateEnseignant {
  nom: string;
  prenom: string;
  telephone: string | null;
  titre: string;
  statut: string;
}

const TITRES_VALIDES = [
  { value: 'directeur', label: 'Directeur' },
  { value: 'chef de service', label: 'Chef de service' },
  { value: 'chef de division/service', label: 'Chef de division/service' },
  { value: 'agent', label: 'Agent' },
  { value: 'retraité', label: 'Retraité' },
  { value: 'autre', label: 'Autre' },
];

const STATUTS_VALIDES = [
  { value: 'interne', label: 'Interne' },
  { value: 'externe', label: 'Externe' },
];

export default function EnseignantsManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'nom' | 'prenom' | 'id'>('nom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);
  const itemsPerPage = 10;

  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    titre: 'agent',
    statut: 'interne',
  });

  // Récupérer tous les enseignants
  const { data: enseignants = [], isLoading, error } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: async () => {
      const result = await invoke('get_enseignants');
      if (!Array.isArray(result)) return [];
      return result;
    },
  });

  // Filtrer et trier les données
  const filteredAndSortedData = useMemo(() => {
    let filtered = enseignants.filter(e =>
      `${e.nom} ${e.prenom}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'id') {
        comparison = a.id - b.id;
      } else if (sortBy === 'nom') {
        comparison = a.nom.localeCompare(b.nom);
      } else if (sortBy === 'prenom') {
        comparison = a.prenom.localeCompare(b.prenom);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [enseignants, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================================
  // EXPORT EXCEL
  // ============================================================
  const exportToExcel = () => {
    try {
      setExporting(true);
      
      const data = filteredAndSortedData.map(e => ({
        'ID': e.id,
        'Nom': e.nom,
        'Prénom': e.prenom,
        'Téléphone': e.telephone || '—',
        'Titre': e.titre,
        'Statut': e.statut === 'interne' ? 'Interne' : 'Externe',
        'Volume Horaire Max': e.vh_max,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Enseignants');
      
      // Ajuster la largeur des colonnes
      ws['!cols'] = [
        { wch: 8 },  // ID
        { wch: 20 }, // Nom
        { wch: 20 }, // Prénom
        { wch: 15 }, // Téléphone
        { wch: 25 }, // Titre
        { wch: 12 }, // Statut
        { wch: 18 }, // VH Max
      ];

      XLSX.writeFile(wb, `enseignants_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      alert('✅ Export Excel réussi !');
    } catch (error) {
      console.error('Erreur export Excel:', error);
      alert('❌ Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // EXPORT PDF
  // ============================================================
  const exportToPDF = () => {
    try {
      setExporting(true);
      
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      doc.setFontSize(18);
      doc.text('Liste des Enseignants', 14, 15);
      doc.setFontSize(10);
      doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 14, 25);
      doc.text(`Total : ${filteredAndSortedData.length} enseignant(s)`, 14, 32);

      const tableData = filteredAndSortedData.map(e => [
        e.id.toString(),
        e.nom,
        e.prenom,
        e.telephone || '—',
        e.titre,
        e.statut === 'interne' ? 'Interne' : 'Externe',
        `${e.vh_max}h`,
      ]);

      doc.autoTable({
        head: [['ID', 'Nom', 'Prénom', 'Téléphone', 'Titre', 'Statut', 'VH Max']],
        body: tableData,
        startY: 40,
        theme: 'striped',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 40 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 45 },
          5: { cellWidth: 25 },
          6: { cellWidth: 20 },
        },
      });

      doc.save(`enseignants_${new Date().toISOString().split('T')[0]}.pdf`);
      
      alert('✅ Export PDF réussi !');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('❌ Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // EXPORT WORD
  // ============================================================
  const exportToWord = () => {
    try {
      setExporting(true);
      
      const rows = filteredAndSortedData.map(e => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.id}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.nom}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.prenom}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.telephone || '—'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.titre}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.statut === 'interne' ? 'Interne' : 'Externe'}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${e.vh_max}h</td>
        </tr>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Liste des Enseignants</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #2980b9; border-bottom: 2px solid #2980b9; padding-bottom: 10px; }
          .info { margin: 20px 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #2980b9; color: white; padding: 10px; border: 1px solid #ddd; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <h1>📋 Liste des Enseignants</h1>
        <div class="info">
          <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <p><strong>Total :</strong> ${filteredAndSortedData.length} enseignant(s)</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Nom</th><th>Prénom</th><th>Téléphone</th><th>Titre</th><th>Statut</th><th>VH Max</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          <p>Document généré automatiquement par le système de gestion des vacations</p>
        </div>
      </body>
      </html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `enseignants_${new Date().toISOString().split('T')[0]}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      alert('✅ Export Word réussi !');
    } catch (error) {
      console.error('Erreur export Word:', error);
      alert('❌ Erreur lors de l\'export Word');
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // IMPRESSION
  // ============================================================
  const handlePrint = () => {
    const rows = filteredAndSortedData.map(e => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.id}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.nom}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.prenom}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.telephone || '—'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.titre}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.statut === 'interne' ? 'Interne' : 'Externe'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${e.vh_max}h</td>
      </tr>
    `).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Liste des Enseignants</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2980b9; border-bottom: 2px solid #2980b9; padding-bottom: 10px; }
          .info { margin: 20px 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #2980b9; color: white; padding: 10px; border: 1px solid #ddd; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>📋 Liste des Enseignants</h1>
        <div class="info">
          <p><strong>Date d'impression :</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <p><strong>Nombre total :</strong> ${filteredAndSortedData.length} enseignant(s)</p>
          <p><strong>Statistiques :</strong> ${enseignants.filter(e => e.statut === 'interne').length} interne(s) | ${enseignants.filter(e => e.statut === 'externe').length} externe(s)</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Nom</th><th>Prénom</th><th>Téléphone</th><th>Titre</th><th>Statut</th><th>VH Max</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          <p>Document généré automatiquement par le système de gestion des vacations</p>
          <p>© ${new Date().getFullYear()} - ENP Vacation Management System</p>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print();" style="padding: 10px 20px; background: #2980b9; color: white; border: none; border-radius: 5px; cursor: pointer;">🖨️ Imprimer</button>
          <button onclick="window.close();" style="margin-left: 10px; padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">❌ Fermer</button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      alert("Veuillez autoriser les pop-ups pour cette application");
    }
  };

  // ============================================================
  // MUTATIONS CRUD
  // ============================================================
  const createMutation = useMutation({
    mutationFn: (data: CreateEnseignant) => invoke('create_enseignant', { input: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la création');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & CreateEnseignant) =>
      invoke('update_enseignant', { id, input: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la modification');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_enseignant', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression');
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      titre: 'agent',
      statut: 'interne',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: Enseignant) => {
    setEditingId(item.id);
    setFormData({
      nom: item.nom,
      prenom: item.prenom,
      telephone: item.telephone || '',
      titre: item.titre,
      statut: item.statut,
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

  const handleSort = (column: 'id' | 'nom' | 'prenom') => {
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
        <Text>Chargement des enseignants...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les enseignants
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
            <Title order={2} c="white">Gestion des enseignants</Title>
            <Text size="sm" c="gray.3">
              {filteredAndSortedData.length} enseignant{filteredAndSortedData.length > 1 ? 's' : ''} enregistré{filteredAndSortedData.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconUsers size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE DU CARD */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Enseignants</Title>
              <Text size="sm" c="dimmed">
                Gérez les informations des enseignants
              </Text>
            </div>
            <Group>
              {/* Menu d'export */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="outline"
                    loading={exporting}
                  >
                    Exporter
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Choisir le format</Menu.Label>
                  <Menu.Item
                    leftSection={<IconFileExcel size={16} color="#00a84f" />}
                    onClick={exportToExcel}
                  >
                    Excel (.xlsx)
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFile size={16} color="#e74c3c" />}
                    onClick={exportToPDF}
                  >
                    PDF (.pdf)
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFileWord size={16} color="#2980b9" />}
                    onClick={exportToWord}
                  >
                    Word (.doc)
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>

              {/* Bouton Impression */}
              <Button
                leftSection={<IconPrinter size={16} />}
                onClick={handlePrint}
                variant="outline"
                color="teal"
              >
                Imprimer
              </Button>

              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCreateModal}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
              >
                Ajouter un enseignant
              </Button>
            </Group>
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

          {/* TABLEAU DES ENSEIGNANTS */}
          {filteredAndSortedData.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun enseignant trouvé. Cliquez sur "Ajouter" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 600 }}>
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
                          Nom complet
                          <IconSearch size={12} style={{ transform: 'rotate(90deg)' }} />
                        </Group>
                      </Table.Th>
                      <Table.Th>Téléphone</Table.Th>
                      <Table.Th>Titre</Table.Th>
                      <Table.Th>Statut</Table.Th>
                      <Table.Th style={{ width: 100, textAlign: 'center' }}>
                        <Group gap={4} justify="center">
                          VH Max
                          <Tooltip label="Volume horaire maximum défini par le plafond">
                            <IconInfoCircle size={14} />
                          </Tooltip>
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
                              {item.nom} {item.prenom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{item.telephone || '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="cyan" variant="light" size="sm">
                              {item.titre}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={item.statut === 'interne' ? 'blue' : 'orange'}
                              variant="light"
                              size="sm"
                            >
                              {item.statut === 'interne' ? 'Interne' : 'Externe'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color="green"
                              variant="light"
                              size="sm"
                              style={{ fontFamily: 'monospace' }}
                            >
                              {item.vh_max}h
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
              Enseignant {createMutation.isSuccess ? 'ajouté' : 'modifié'} avec succès
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
        title={editingId ? "Modifier l'enseignant" : "Ajouter un enseignant"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Nom"
            placeholder="Ex: KORGO"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            withAsterisk
          />

          <TextInput
            label="Prénom"
            placeholder="Ex: Jacques"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            withAsterisk
          />

          <TextInput
            label="Téléphone"
            placeholder="Ex: 75 11 81 61"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          />

          <Select
            label="Titre"
            placeholder="Choisir un titre"
            data={TITRES_VALIDES}
            value={formData.titre}
            onChange={(val) => setFormData({ ...formData, titre: val || 'agent' })}
            withAsterisk
          />

          <Select
            label="Statut"
            placeholder="Choisir un statut"
            data={STATUTS_VALIDES}
            value={formData.statut}
            onChange={(val) => setFormData({ ...formData, statut: val || 'interne' })}
            withAsterisk
          />

          {formData.titre && formData.statut && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
              variant="light"
              radius="md"
            >
              <Text size="sm" fw={500}>
                Volume horaire maximum :
                <Text component="span" fw={700} ml={5}>
                  À déterminer selon le titre et statut
                </Text>
              </Text>
              <Text size="xs" c="dimmed" mt={5}>
                Le volume horaire maximum sera automatiquement défini par le plafond correspondant
              </Text>
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
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

      {/* MODAL DE CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmation"
        centered
      >
        <Stack>
          <Text>Êtes-vous sûr de vouloir supprimer cet enseignant ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Text size="sm" c="orange" fw={500}>
            ⚠️ Attention: Les vacations associées à cet enseignant seront également supprimées.
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
          <Text size="sm">1. Renseignez les informations personnelles de l'enseignant</Text>
          <Text size="sm">2. Le volume horaire maximum est défini automatiquement selon le statut et le titre de l'enseignant</Text>
          <Text size="sm">3. Les informations bancaires sont gérées séparément dans la section comptes bancaires</Text>
          <Text size="sm">4. Un enseignant interne est un enseignant en service à l'ENP</Text>
          <Text size="sm">5. Un enseignant externe est un intervenant externe</Text>
        </Stack>
      </Card>
    </Stack>
  );
}