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
  SimpleGrid,
  Collapse,
  Grid,
  MultiSelect,
  Pagination,
  Paper,
  Tooltip,
  NumberInput,
  Menu,
} from '@mantine/core';
import {
  IconCalendar,
  IconCheck,
  IconAlertCircle,
  IconEdit,
  IconTrash,
  IconPlus,
  IconSearch,
  IconFilter,
  IconEye,
  IconDownload,
  IconFileExcel,
  IconFile,
  IconFileWord,
  IconPrinter,
  IconFileText,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// ================= TYPES =================
interface Enseignant {
  id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
}

interface Cycle {
  id: number;
  designation: string;
  nb_classe: number;
}

interface Module {
  id: number;
  designation: string;
  cycle_id: number;
}

interface Matiere {
  id: number;
  designation: string;
  vhoraire: number;
  module_id: number;
}

interface Promotion {
  id: number;
  libelle: string;
}

interface AnneeScolaire {
  id: number;
  libelle: string;
}

interface VacationResponse {
  id: number;
  enseignantId: number;
  cycleId: number;
  moduleId: number;
  matiereId: number;
  nbClasse: number;
  vhoraireMatiere: number;
  tauxHoraire: number;
  tauxRetenue: number;
  vht: number;
  montantBrut: number;
  montantRetenu: number;
  montantNet: number;
  mois: string;
  annee: number;
  dateTraitement: string;
  anneeScolaire: string;
  promotionId: number;
  nomEnseignant?: string;
  prenomEnseignant?: string;
  libelleCycle?: string;
  libelleModule?: string;
  libelleMatiere?: string;
  libellePromotion?: string;
}

interface VacationInput {
  enseignant_id: number;
  cycle_id: number;
  module_id: number;
  matiere_id: number;
  nb_classe: number | null;
  taux_horaire: number | null;
  taux_retenue: number | null;
  mois: string;
  annee: number;
  annee_scolaire: string;
  promotion_id: number;
}

// ================= CONSTANTES =================
const MOIS_OPTIONS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' }
];

const ANNEES_OPTIONS = [2024, 2025, 2026, 2027, 2028].map(a => ({ value: String(a), label: String(a) }));

// ================= COMPOSANT PRINCIPAL =================
export default function VacationsManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // États du formulaire
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<VacationResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // États de recherche et pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  // État pour stocker le vhoraire de la matière sélectionnée
  const [selectedVhoraire, setSelectedVhoraire] = useState(0);

  // ============================================================
  // ÉTATS DES FILTRES
  // ============================================================
  const [filterMois, setFilterMois] = useState<string | null>(null);
  const [filterAnnee, setFilterAnnee] = useState<string | null>(String(new Date().getFullYear()));
  const [filterAnneeScolaire, setFilterAnneeScolaire] = useState<string | null>(null);
  const [filterPromotion, setFilterPromotion] = useState<string | null>(null);
  const [filterEnseignant, setFilterEnseignant] = useState<string | null>(null);
  const [filterCycle, setFilterCycle] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [filterMatiere, setFilterMatiere] = useState<string | null>(null);

  // État du formulaire pour la création/modification
  const [formData, setFormData] = useState<VacationInput>({
    enseignant_id: 0,
    cycle_id: 0,
    module_id: 0,
    matiere_id: 0,
    nb_classe: null,
    taux_horaire: 5000,
    taux_retenue: 2,
    mois: new Date().getMonth() + 1 + '',
    annee: new Date().getFullYear(),
    annee_scolaire: '',
    promotion_id: 0,
  });

  // ============================================================
  // FONCTIONS D'EXPORT
  // ============================================================

  const formatNumber = (value: number | null | undefined): string => {
    return (value ?? 0).toLocaleString();
  };

  // Générer l'état de liquidation
  const generateEtatLiquidation = () => {
    const mois = filterMois || formData.mois;
    const annee = filterAnnee || String(formData.annee);
    
    if (!mois || !annee) {
      alert("Veuillez sélectionner un mois et une année");
      return;
    }
    
    navigate(`/etat?mois=${mois}&annee=${annee}`);
  };

  // Export Excel
  const exportToExcel = async () => {
    try {
      setExporting(true);
      
      const filePath = await save({
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        defaultPath: `vacations_${new Date().toISOString().split('T')[0]}.xlsx`
      });

      if (!filePath) return;

      const data = filteredVacations.map(v => ({
        'ID': v.id,
        'Enseignant': `${v.nomEnseignant} ${v.prenomEnseignant}`,
        'Cycle': v.libelleCycle,
        'Module': v.libelleModule,
        'Matière': v.libelleMatiere,
        'Classes': v.nbClasse,
        'VHT': v.vht,
        'Montant net': v.montantNet,
        'Mois': MOIS_OPTIONS.find(m => m.value === v.mois)?.label,
        'Année': v.annee,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vacations');
      
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 8 }];

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(excelBuffer));
      
      alert(`✅ Export Excel réussi !`);
    } catch (error) {
      console.error('Erreur export Excel:', error);
      alert('❌ Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  // Export PDF
  const exportToPDF = async () => {
    try {
      setExporting(true);
      
      const filePath = await save({
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        defaultPath: `vacations_${new Date().toISOString().split('T')[0]}.pdf`
      });

      if (!filePath) return;

      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      doc.setFontSize(18);
      doc.text('Liste des Vacations', 14, 15);
      doc.setFontSize(10);
      doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 14, 25);
      doc.text(`Total : ${filteredVacations.length} vacation(s)`, 14, 32);

      const tableData = filteredVacations.map(v => [
        v.id.toString(),
        `${v.nomEnseignant} ${v.prenomEnseignant}`,
        v.libelleCycle || '',
        v.libelleMatiere || '',
        `${v.vht?.toFixed(1)}h`,
        `${formatNumber(v.montantNet)} F`,
      ]);

      doc.autoTable({
        head: [['ID', 'Enseignant', 'Cycle', 'Matière', 'VHT', 'Net']],
        body: tableData,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      const pdfBuffer = doc.output('arraybuffer');
      await writeFile(filePath, new Uint8Array(pdfBuffer));
      
      alert(`✅ Export PDF réussi !`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('❌ Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  // Export Word
  const exportToWord = async () => {
    try {
      setExporting(true);
      
      const filePath = await save({
        filters: [{ name: 'Word Files', extensions: ['doc'] }],
        defaultPath: `vacations_${new Date().toISOString().split('T')[0]}.doc`
      });

      if (!filePath) return;

      const rows = filteredVacations.map(v => `
        <tr>
          <td>${v.id}</td>
          <td>${v.nomEnseignant} ${v.prenomEnseignant}</td>
          <td>${v.libelleCycle || ''}</td>
          <td>${v.libelleMatiere || ''}</td>
          <td>${v.vht?.toFixed(1)}h</td>
          <td>${formatNumber(v.montantNet)} F</td>
        </tr>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Liste des Vacations</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2980b9; border-bottom: 2px solid #2980b9; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #2980b9; color: white; padding: 10px; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
      </head>
      <body>
        <h1>📋 Liste des Vacations</h1>
        <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
        <p>Total: ${filteredVacations.length} vacation(s)</p>
        <table>
          <thead><tr><th>ID</th><th>Enseignant</th><th>Cycle</th><th>Matière</th><th>VHT</th><th>Net</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>`;

      const encoder = new TextEncoder();
      await writeFile(filePath, encoder.encode(htmlContent));
      
      alert(`✅ Export Word réussi !`);
    } catch (error) {
      console.error('Erreur export Word:', error);
      alert('❌ Erreur lors de l\'export Word');
    } finally {
      setExporting(false);
    }
  };

  // Impression
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les pop-ups pour cette application");
      return;
    }

    const rows = filteredVacations.map(v => `
      <tr>
        <td>${v.id}</td>
        <td>${v.nomEnseignant} ${v.prenomEnseignant}</td>
        <td>${v.libelleCycle || ''}</td>
        <td>${v.libelleMatiere || ''}</td>
        <td>${v.vht?.toFixed(1)}h</td>
        <td>${formatNumber(v.montantNet)} F</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Liste des Vacations</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2980b9; border-bottom: 2px solid #2980b9; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #2980b9; color: white; padding: 10px; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        @media print { .no-print { display: none; } }
      </style>
      </head>
      <body>
        <h1>📋 Liste des Vacations</h1>
        <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
        <p>Total: ${filteredVacations.length} vacation(s)</p>
        <table>
          <thead><tr><th>ID</th><th>Enseignant</th><th>Cycle</th><th>Matière</th><th>VHT</th><th>Net</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print();">🖨️ Imprimer</button>
          <button onclick="window.close();">❌ Fermer</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================================
  // FONCTION UTILITAIRE POUR CONSTRUIRE LE PAYLOAD
  // ============================================================
  const buildPayload = (data: VacationInput) => {
    return {
      enseignant_id: data.enseignant_id,
      matiere_id: data.matiere_id,
      promotion_id: data.promotion_id,
      annee_scolaire_id: Number(data.annee_scolaire),
      nb_classe: data.nb_classe ?? 0,
      mois: Number(data.mois),
      annee: data.annee,
      cycle_id: data.cycle_id,
      module_id: data.module_id,
      taux_horaire: data.taux_horaire ?? 5000,
      taux_retenue: data.taux_retenue ?? 2,
    };
  };

  // ============================================================
  // RÉCUPÉRATION DES DONNÉES RÉFÉRENTIELLES
  // ============================================================

  const { data: enseignants = [] } = useQuery<Enseignant[]>({
    queryKey: ['enseignants'],
    queryFn: () => invoke('get_enseignants'),
  });

  const { data: cycles = [] } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: () => invoke('get_cycles'),
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => invoke('get_modules'),
  });

  const { data: matieres = [] } = useQuery<Matiere[]>({
    queryKey: ['matieres'],
    queryFn: () => invoke('get_matieres'),
  });

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: () => invoke('get_promotions'),
  });

  const { data: anneesScolaires = [] } = useQuery<AnneeScolaire[]>({
    queryKey: ['annees_scolaires'],
    queryFn: () => invoke('get_annees_scolaires'),
  });

  // ============================================================
  // RÉCUPÉRATION DES VACATIONS
  // ============================================================

  const { data: vacations = [], isLoading, error } = useQuery<VacationResponse[]>({
    queryKey: ['vacations'],
    queryFn: async () => {
      try {
        const result = await invoke('get_vacations');
        if (!Array.isArray(result)) return [];
        return result;
      } catch (e) {
        console.error("ERREUR BACKEND:", e);
        throw e;
      }
    },
  });

  // ============================================================
  // FILTRAGE AVANCÉ
  // ============================================================

  const filteredVacations = useMemo(() => {
    let filtered = [...vacations];

    // Filtre par recherche textuelle
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.nomEnseignant?.toLowerCase().includes(search) ||
        v.prenomEnseignant?.toLowerCase().includes(search) ||
        v.libelleMatiere?.toLowerCase().includes(search)
      );
    }

    // Filtre par mois
    if (filterMois) {
      filtered = filtered.filter(v => v.mois === filterMois);
    }

    // Filtre par année
    if (filterAnnee) {
      filtered = filtered.filter(v => v.annee === parseInt(filterAnnee));
    }

    // Filtre par année scolaire
    if (filterAnneeScolaire) {
      filtered = filtered.filter(v => v.anneeScolaire === filterAnneeScolaire);
    }

    // Filtre par promotion
    if (filterPromotion) {
      filtered = filtered.filter(v => v.libellePromotion === filterPromotion);
    }

    // Filtre par enseignant
    if (filterEnseignant) {
      const enseignantId = parseInt(filterEnseignant);
      filtered = filtered.filter(v => v.enseignantId === enseignantId);
    }

    // Filtre par cycle
    if (filterCycle) {
      const cycleId = parseInt(filterCycle);
      filtered = filtered.filter(v => v.cycleId === cycleId);
    }

    // Filtre par module
    if (filterModule) {
      const moduleId = parseInt(filterModule);
      filtered = filtered.filter(v => v.moduleId === moduleId);
    }

    // Filtre par matière
    if (filterMatiere) {
      const matiereId = parseInt(filterMatiere);
      filtered = filtered.filter(v => v.matiereId === matiereId);
    }

    return filtered;
  }, [vacations, searchTerm, filterMois, filterAnnee, filterAnneeScolaire, filterPromotion, filterEnseignant, filterCycle, filterModule, filterMatiere]);

  const totalItems = filteredVacations.length;
  const totalPages = Math.ceil(totalItems / parseInt(itemsPerPage));
  const paginatedVacations = filteredVacations.slice(
    (currentPage - 1) * parseInt(itemsPerPage),
    currentPage * parseInt(itemsPerPage)
  );

  // ============================================================
  // STATISTIQUES
  // ============================================================

  const stats = useMemo(() => {
    const totalBrut = filteredVacations.reduce((sum, v) => sum + (v.montantBrut ?? 0), 0);
    const totalRetenu = filteredVacations.reduce((sum, v) => sum + (v.montantRetenu ?? 0), 0);
    const totalNet = filteredVacations.reduce((sum, v) => sum + (v.montantNet ?? 0), 0);
    const totalHours = filteredVacations.reduce((sum, v) => sum + (v.vht ?? 0), 0);
    return { totalBrut, totalRetenu, totalNet, totalHours, count: totalItems };
  }, [filteredVacations]);

  // ============================================================
  // MUTATIONS CRUD
  // ============================================================

  const createMutation = useMutation({
    mutationFn: (data: VacationInput) =>
      invoke('create_vacation', { input: buildPayload(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erreur création:", error);
      alert(`Erreur: ${error.message || "Impossible de créer la vacation"}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & VacationInput) =>
      invoke('update_vacation', { id, input: buildPayload(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setModalOpened(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erreur modification:", error);
      alert(`Erreur: ${error.message || "Impossible de modifier la vacation"}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoke('delete_vacation', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      setDeleteId(null);
    },
    onError: (error: any) => {
      console.error("Erreur suppression:", error);
      alert(`Erreur: ${error.message || "Impossible de supprimer la vacation"}`);
    }
  });

  // ============================================================
  // FONCTIONS UTILITAIRES
  // ============================================================

  const resetForm = () => {
    setEditingId(null);
    setSelectedVhoraire(0);
    setFormData({
      enseignant_id: 0,
      cycle_id: 0,
      module_id: 0,
      matiere_id: 0,
      nb_classe: null,
      taux_horaire: 5000,
      taux_retenue: 2,
      mois: new Date().getMonth() + 1 + '',
      annee: new Date().getFullYear(),
      annee_scolaire: anneesScolaires[0]?.id.toString() || '',
      promotion_id: 0,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpened(true);
  };

  const openEditModal = (item: VacationResponse) => {
    setEditingId(item.id);
    setSelectedVhoraire(item.vhoraireMatiere || 0);
    setFormData({
      enseignant_id: item.enseignantId,
      cycle_id: item.cycleId,
      module_id: item.moduleId,
      matiere_id: item.matiereId,
      nb_classe: item.nbClasse,
      taux_horaire: item.tauxHoraire,
      taux_retenue: item.tauxRetenue,
      mois: item.mois,
      annee: item.annee,
      annee_scolaire: item.anneeScolaire,
      promotion_id: item.promotionId,
    });
    setModalOpened(true);
  };

  const handleSubmit = () => {
    if (!formData.enseignant_id) {
      alert("Veuillez sélectionner un enseignant");
      return;
    }
    if (!formData.cycle_id) {
      alert("Veuillez sélectionner un cycle");
      return;
    }
    if (!formData.module_id) {
      alert("Veuillez sélectionner un module");
      return;
    }
    if (!formData.matiere_id) {
      alert("Veuillez sélectionner une matière");
      return;
    }
    if (!formData.nb_classe || formData.nb_classe < 1) {
      alert("Veuillez saisir un nombre de classes valide");
      return;
    }
    if (!formData.promotion_id) {
      alert("Veuillez sélectionner une promotion");
      return;
    }
    if (!formData.annee_scolaire) {
      alert("Veuillez sélectionner une année scolaire");
      return;
    }
    if (!formData.mois) {
      alert("Veuillez sélectionner un mois");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetFilters = () => {
    setFilterMois(null);
    setFilterAnnee(String(new Date().getFullYear()));
    setFilterAnneeScolaire(null);
    setFilterPromotion(null);
    setFilterEnseignant(null);
    setFilterCycle(null);
    setFilterModule(null);
    setFilterMatiere(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // ============================================================
  // GESTION DES ERREURS ET CHARGEMENT
  // ============================================================

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement des vacations...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger les vacations
        </Alert>
      </Card>
    );
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================

  return (
    <Stack p="md" gap="lg">
      {/* HEADER */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Gestion des Vacations</Title>
            <Text size="sm" c="gray.3">
              {stats.count} vacation{stats.count > 1 ? 's' : ''} trouvée{stats.count > 1 ? 's' : ''}
            </Text>
          </Stack>
          <Group>
            <Button
              leftSection={<IconFileText size={16} />}
              onClick={generateEtatLiquidation}
              variant="outline"
              color="teal"
            >
              État de liquidation
            </Button>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button leftSection={<IconDownload size={16} />} variant="outline" color="white" loading={exporting}>
                  Exporter
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Choisir le format</Menu.Label>
                <Menu.Item leftSection={<IconFileExcel size={16} color="#00a84f" />} onClick={exportToExcel}>
                  Excel (.xlsx)
                </Menu.Item>
                <Menu.Item leftSection={<IconFile size={16} color="#e74c3c" />} onClick={exportToPDF}>
                  PDF (.pdf)
                </Menu.Item>
                <Menu.Item leftSection={<IconFileWord size={16} color="#2980b9" />} onClick={exportToWord}>
                  Word (.doc)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint} variant="outline" color="white">
              Imprimer
            </Button>
            <ThemeIcon size={48} radius="md" color="white" variant="light">
              <IconCalendar size={28} />
            </ThemeIcon>
          </Group>
        </Group>
      </Card>

      {/* KPI CARDS */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Total vacations</Text>
          <Text fw={700} size="xl" c="blue">{stats.count}</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Heures totales</Text>
          <Text fw={700} size="xl" c="cyan">{stats.totalHours.toFixed(1)}h</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Montant brut</Text>
          <Text fw={700} size="xl" c="green">{formatNumber(stats.totalBrut)} F</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed">Montant net</Text>
          <Text fw={700} size="xl" c="teal">{formatNumber(stats.totalNet)} F</Text>
        </Card>
      </SimpleGrid>

      {/* CONTENU PRINCIPAL */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          {/* EN-TÊTE */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={4}>Liste des vacations</Title>
              <Text size="sm" c="dimmed">Gérez les paiements des enseignants par vacation</Text>
            </div>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              Nouvelle vacation
            </Button>
          </Group>

          <Divider />

          {/* RECHERCHE RAPIDE */}
          <TextInput
            placeholder="Rechercher un enseignant ou une matière..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />

          {/* BOUTON FILTRES AVANCÉS */}
          <Button variant="light" onClick={() => setShowFilters(!showFilters)} leftSection={<IconFilter size={16} />}>
            {showFilters ? "Masquer les filtres" : "Afficher les filtres avancés"}
          </Button>

          {/* FILTRES AVANCÉS */}
          <Collapse in={showFilters}>
            <Card withBorder p="md" radius="md">
              <Grid gutter="md">
                <Grid.Col span={3}>
                  <Select
                    label="Mois"
                    placeholder="Tous les mois"
                    data={MOIS_OPTIONS}
                    value={filterMois}
                    onChange={setFilterMois}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Année"
                    placeholder="Toutes les années"
                    data={ANNEES_OPTIONS}
                    value={filterAnnee}
                    onChange={setFilterAnnee}
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Année scolaire"
                    placeholder="Toutes les années"
                    data={anneesScolaires.map(a => ({ value: a.libelle, label: a.libelle }))}
                    value={filterAnneeScolaire}
                    onChange={setFilterAnneeScolaire}
                    clearable
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Promotion"
                    placeholder="Toutes les promotions"
                    data={promotions.map(p => ({ value: p.libelle, label: p.libelle }))}
                    value={filterPromotion}
                    onChange={setFilterPromotion}
                    clearable
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Enseignant"
                    placeholder="Tous les enseignants"
                    data={enseignants.map(e => ({ value: String(e.id), label: `${e.nom} ${e.prenom}` }))}
                    value={filterEnseignant}
                    onChange={setFilterEnseignant}
                    clearable
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Cycle"
                    placeholder="Tous les cycles"
                    data={cycles.map(c => ({ value: String(c.id), label: c.designation }))}
                    value={filterCycle}
                    onChange={setFilterCycle}
                    clearable
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Module"
                    placeholder="Tous les modules"
                    data={modules.filter(m => !filterCycle || m.cycle_id === parseInt(filterCycle)).map(m => ({ value: String(m.id), label: m.designation }))}
                    value={filterModule}
                    onChange={setFilterModule}
                    clearable
                    searchable
                    disabled={!filterCycle}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    label="Matière"
                    placeholder="Toutes les matières"
                    data={matieres.filter(m => !filterModule || m.module_id === parseInt(filterModule)).map(m => ({ value: String(m.id), label: m.designation }))}
                    value={filterMatiere}
                    onChange={setFilterMatiere}
                    clearable
                    searchable
                    disabled={!filterModule}
                  />
                </Grid.Col>
              </Grid>
              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={resetFilters} size="sm">Réinitialiser les filtres</Button>
              </Group>
            </Card>
          </Collapse>

          {/* TABLEAU DES VACATIONS */}
          {paginatedVacations.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune vacation trouvée. Cliquez sur "Nouvelle vacation" pour commencer.
            </Alert>
          ) : (
            <>
              <ScrollArea style={{ maxHeight: 600 }}>
                <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Enseignant</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Cycle</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Module</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Matière</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Classes</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px' }}>Net</Table.Th>
                      <Table.Th style={{ color: 'white', padding: '12px 16px', textAlign: 'center' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedVacations.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Text fw={500} size="sm">{item.nomEnseignant} {item.prenomEnseignant}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Badge color="blue" variant="light" size="sm">{item.libelleCycle}</Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Text size="sm">{item.libelleModule}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Text size="sm" fw={500}>{item.libelleMatiere}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Badge color="gray" variant="light" size="sm">{item.nbClasse}</Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px' }}>
                          <Text fw={700} c="green" size="sm">{formatNumber(item.montantNet)} FCFA</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <Group gap="xs" justify="center">
                            <Tooltip label="Voir détails">
                              <ActionIcon variant="subtle" color="blue" onClick={() => setViewItem(item)} size="sm">
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Modifier">
                              <ActionIcon variant="subtle" color="yellow" onClick={() => openEditModal(item)} size="sm">
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Supprimer">
                              <ActionIcon variant="subtle" color="red" onClick={() => setDeleteId(item.id)} size="sm">
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <Group justify="space-between" mt="md">
                  <Select
                    value={itemsPerPage}
                    onChange={(val) => { setItemsPerPage(val || '20'); setCurrentPage(1); }}
                    data={['10', '20', '50', '100']}
                    style={{ width: 100 }}
                  />
                  <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} />
                </Group>
              )}
            </>
          )}

          {/* MESSAGE DE SUCCÈS */}
          {(createMutation.isSuccess || updateMutation.isSuccess) && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Vacation {createMutation.isSuccess ? 'créée' : 'modifiée'} avec succès
            </Alert>
          )}
        </Stack>
      </Card>

      {/* MODAL DE VISUALISATION */}
      <Modal opened={viewItem !== null} onClose={() => setViewItem(null)} title="Détails de la vacation" size="md">
        {viewItem && (
          <Stack gap="md">
            <Group><Text fw={700}>Enseignant:</Text><Text>{viewItem.nomEnseignant} {viewItem.prenomEnseignant}</Text></Group>
            <Group><Text fw={700}>Matière:</Text><Text>{viewItem.libelleMatiere}</Text></Group>
            <Group><Text fw={700}>Cycle:</Text><Badge>{viewItem.libelleCycle}</Badge></Group>
            <Divider />
            <Group><Text fw={700}>Volume horaire:</Text><Text>{(viewItem.vht ?? 0).toFixed(1)} heures</Text></Group>
            <Group><Text fw={700}>Montant brut:</Text><Text>{formatNumber(viewItem.montantBrut)} F</Text></Group>
            <Group><Text fw={700}>Retenue:</Text><Text>{formatNumber(viewItem.montantRetenu)} F</Text></Group>
            <Group><Text fw={700}>Montant net:</Text><Text fw={700} c="blue">{formatNumber(viewItem.montantNet)} F</Text></Group>
            <Divider />
            <Group><Text fw={700}>Période:</Text><Text>{MOIS_OPTIONS.find(m => m.value === viewItem.mois)?.label} {viewItem.annee}</Text></Group>
            <Group><Text fw={700}>Date de traitement:</Text><Text>{new Date(viewItem.dateTraitement).toLocaleDateString()}</Text></Group>
          </Stack>
        )}
      </Modal>

      {/* MODAL DE CONFIRMATION SUPPRESSION */}
      <Modal opened={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmation" centered>
        <Stack>
          <Text>Êtes-vous sûr de vouloir supprimer cette vacation ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button color="red" onClick={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending}>Supprimer</Button>
          </Group>
        </Stack>
      </Modal>

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Utilisez les filtres pour affiner la liste des vacations</Text>
          <Text size="sm">2. Cliquez sur "État de liquidation" pour générer le document officiel</Text>
          <Text size="sm">3. Les montants sont calculés automatiquement en temps réel</Text>
          <Text size="sm">4. Utilisez les boutons d'action pour voir, modifier ou supprimer une vacation</Text>
        </Stack>
      </Card>
    </Stack>
  );
}