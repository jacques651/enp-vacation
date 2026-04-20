import { useState, useRef, useEffect } from 'react';
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
  Select,
  Switch,
  SimpleGrid,
  ScrollArea,
  LoadingOverlay,
  Collapse,
} from '@mantine/core';
import {
  IconPrinter,
  IconRefresh,
  IconFilter,
  IconEye,
  IconFileInvoice,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ================= TYPES =================
interface LigneOrdreResponse {
  id: number;
  enseignant_id: number;
  nom: string;
  prenom: string;
  compte_bancaire_id: number;
  numero_compte: string;
  cle_rib: string;
  montant_brut: number;
  retenue: number;
  montant_net: number;
}

interface OrdreVirementResponse {
  id: number;
  banque_id: number;
  banque_designation: string;
  numero_ordre: string;
  date_edition: string;
  objet: string;
  total_net: number;
  lignes: LigneOrdreResponse[];
}

interface OrdreVirementDB {
  id: number;
  banque_id: number;
  banque_designation: string;
  numero_ordre: string;
  date_edition: string;
  objet: string;
  total_net: number;
  lignes: LigneOrdreResponse[];
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

const ANNEES_OPTIONS = [
  { value: '2024', label: '2024' }, { value: '2025', label: '2025' },
  { value: '2026', label: '2026' }, { value: '2027', label: '2027' },
];

export default function OrdreVirement() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [savedOrdresVisible, setSavedOrdresVisible] = useState(false);

  const [mois, setMois] = useState<string | null>(String(new Date().getMonth() + 1));
  const [annee, setAnnee] = useState<string | null>(String(new Date().getFullYear()));
  const [selectedOrdre, setSelectedOrdre] = useState<OrdreVirementResponse | null>(null);

  // Récupérer les ordres sauvegardés
  const { data: ordresSaved = [], isLoading: ordresLoading, refetch: refetchOrdres } = useQuery<OrdreVirementResponse[]>({
    queryKey: ['ordres_virement'],
    queryFn: async () => {
      const result = await invoke('get_ordres_virement');
      return Array.isArray(result) ? result : [];
    },
    enabled: savedOrdresVisible,
  });

  // Mutation pour générer l'ordre
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!mois || !annee) {
        throw new Error("Veuillez sélectionner un mois et une année");
      }
      const result = await invoke<OrdreVirementResponse[]>('generer_ordre_virement', { 
        mois: parseInt(mois), 
        annee: parseInt(annee) 
      });
      return result;
    },
    onSuccess: (data) => {
      if (data && data.length > 0) {
        setSelectedOrdre(data[0]);
      }
    },
    onError: (err: any) => {
      console.error('Erreur génération:', err);
      alert(`Erreur: ${err}`);
    },
  });

  const handleLoadOrdre = (ordre: OrdreVirementResponse) => {
    setSelectedOrdre(ordre);
    setSavedOrdresVisible(false);
  };

  const handleRefreshOrdres = () => {
    refetchOrdres();
  };

  const handleGenerer = () => {
    if (!mois || !annee) {
      alert("Veuillez sélectionner un mois et une année");
      return;
    }
    generateMutation.mutate();
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['enseignants'] });
      queryClient.invalidateQueries({ queryKey: ['banques'] });
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, queryClient]);

  const formatMoney = (value?: number | null) => (value ?? 0).toLocaleString('fr-FR');
  const total = selectedOrdre?.total_net ?? 0;

  const formatMontantLettre = (montant: number): string => {
    const nombre = Math.floor(montant);
    if (nombre === 0) return 'zéro francs CFA';

    const unite = (n: number): string => {
      const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
      const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
      const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

      if (n < 10) return units[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) {
        const t = Math.floor(n / 10);
        const u = n % 10;
        if (u === 0) return tens[t] + (t === 8 ? 's' : '');
        if (t === 7 || t === 9) return tens[t] + '-' + teens[u];
        return tens[t] + '-' + units[u];
      }
      return n.toString();
    };

    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 100) return unite(n);
      if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        const cent = c === 1 ? 'cent' : unite(c) + ' cents';
        return r === 0 ? cent : cent + ' ' + convert(r);
      }
      if (n < 1000000) {
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        const mille = m === 1 ? 'mille' : convert(m) + ' mille';
        return r === 0 ? mille : mille + ' ' + convert(r);
      }
      return convert(Math.floor(n / 1000000)) + ' million' + (Math.floor(n / 1000000) > 1 ? 's' : '') + ' ' + convert(n % 1000000);
    };

    return convert(nombre) + ' francs CFA';
  };

  const date = new Date();
  const jour = date.getDate();
  const moisActuel = date.getMonth() + 1;
  const anneeActuelle = date.getFullYear();
  const moisLabel = MOIS_OPTIONS.find(m => m.value === String(moisActuel))?.label || '';

  return (
    <Stack p="md" gap="lg">
      {/* HEADER */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={2} c="white">Ordre de virement</Title>
            <Text size="sm" c="gray.3">
              Générez et imprimez les ordres de virement pour les enseignants
            </Text>
          </Stack>
          <ThemeIcon size={48} radius="md" color="white" variant="light">
            <IconFileInvoice size={28} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* PANEL DES FILTRES */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group>
              <Button
                variant="light"
                onClick={() => setFiltersVisible(!filtersVisible)}
                leftSection={<IconFilter size={16} />}
              >
                Filtres
              </Button>
              <Button
                variant="light"
                onClick={() => {
                  setSavedOrdresVisible(!savedOrdresVisible);
                  if (!savedOrdresVisible) handleRefreshOrdres();
                }}
                leftSection={<IconEye size={16} />}
              >
                Ordres sauvegardés
              </Button>
              <Switch
                label="Auto refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
              />
            </Group>

            <Button
              onClick={handleGenerer}
              loading={generateMutation.isPending}
              leftSection={<IconRefresh size={16} />}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Générer
            </Button>
          </Group>

          <Collapse in={filtersVisible}>
            <Divider />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <Select
                label="Mois"
                placeholder="Sélectionner un mois"
                data={MOIS_OPTIONS}
                value={mois}
                onChange={setMois}
              />
              <Select
                label="Année"
                placeholder="Sélectionner une année"
                data={ANNEES_OPTIONS}
                value={annee}
                onChange={setAnnee}
              />
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Card>

      {/* LISTE DES ORDRES SAUVEGARDÉS */}
      <Collapse in={savedOrdresVisible}>
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Ordres de virement sauvegardés</Title>
            <Button size="xs" variant="light" onClick={handleRefreshOrdres}>
              Rafraîchir
            </Button>
          </Group>
          {ordresLoading ? (
            <LoadingOverlay visible={true} />
          ) : ordresSaved.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucun ordre sauvegardé
            </Alert>
          ) : (
            <ScrollArea style={{ maxHeight: 300 }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>N° Ordre</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Banque</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ordresSaved.map((ordre) => (
                    <Table.Tr key={ordre.id}>
                      <Table.Td>
                        <Badge color="blue" variant="light">{ordre.numero_ordre}</Badge>
                      </Table.Td>
                      <Table.Td>{ordre.date_edition}</Table.Td>
                      <Table.Td>{ordre.banque_designation}</Table.Td>
                      <Table.Td>{formatMoney(ordre.total_net)} FCFA</Table.Td>
                      <Table.Td>
                        <Button size="xs" variant="light" onClick={() => handleLoadOrdre(ordre)}>
                          Charger
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      </Collapse>

      {/* MESSAGE D'ERREUR */}
      {generateMutation.isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Erreur lors de la génération de l'ordre de virement. Vérifiez les filtres et réessayez.
        </Alert>
      )}

      {/* RÉSULTAT - ORDRE DE VIREMENT */}
      {selectedOrdre && selectedOrdre.lignes && selectedOrdre.lignes.length > 0 && (
        <>
          <Card withBorder radius="md" p="lg" ref={printRef}>
            {/* EN-TÊTE */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Text fw={700} size="lg" tt="uppercase">MINISTÈRE DE LA SÉCURITÉ</Text>
              <Text fw={500}>SECRÉTARIAT GÉNÉRAL</Text>
              <Text fw={500} tt="uppercase">ECOLE NATIONALE DE POLICE</Text>
              <Text fw={500}>DIRECTION GÉNÉRALE</Text>
              <Text fw={500}>DIRECTION DE L'ADMINISTRATION DES FINANCES</Text>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <Text>N°2026-_____/MSEU/SG/ENP/DG/DAF</Text>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Text fw={700} size="lg">BURKINA FASO</Text>
              <Text>La Patrie ou la Mort, nous vaincrons</Text>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <Text>Ouagadougou, le {jour} {moisLabel} {anneeActuelle}</Text>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Text>Le Directeur Général</Text>
              <Text>À</Text>
              <Text fw={500}>Monsieur le Directeur Général de {selectedOrdre.banque_designation}</Text>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Text fw={700}>Objet: Ordre de virement de fond</Text>
            </div>

            <Text mb={20}>
              J'ai l'honneur de solliciter le virement de la somme de <strong>{formatMontantLettre(total)}</strong> représenté par ce chèque au profit de:
            </Text>

            {/* TABLEAU DES BÉNÉFICIAIRES */}
            <ScrollArea style={{ maxHeight: 400 }} mb={20}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                    <Table.Th style={{ color: 'white', width: 50, textAlign: 'center' }}>N°</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Nom Prénom</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Numéro de compte</Table.Th>
                    <Table.Th style={{ color: 'white', width: 70, textAlign: 'center' }}>Clé</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Banque</Table.Th>
                    <Table.Th style={{ color: 'white', textAlign: 'right' }}>Montant</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedOrdre.lignes.map((ligne, idx) => (
                    <Table.Tr key={ligne.id}>
                      <Table.Td style={{ textAlign: 'center' }}>{idx + 1}</Table.Td>
                      <Table.Td>{ligne.nom} {ligne.prenom}</Table.Td>
                      <Table.Td>{ligne.numero_compte || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>{ligne.cle_rib || '—'}</Table.Td>
                      <Table.Td>{selectedOrdre.banque_designation}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {formatMoney(ligne.montant_net)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ backgroundColor: '#f5f5f5' }}>
                    <Table.Td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      Montant total à virer
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em' }}>
                      {formatMoney(total)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </ScrollArea>

            <div style={{ marginTop: 20 }}>
              <Text>
                Arrêté le présent état à la somme de : <strong>{formatMontantLettre(total)}</strong>
              </Text>
            </div>

            <div style={{ marginTop: 20 }}>
              <Text>
                Ce virement représente le paiement des frais de vacation des cours dispensés aux élèves de la 55ème promotion de l'Ecole Nationale de Police au titre des années scolaires 2024-2025 et 2025-2026.
              </Text>
            </div>

            <Text mt={20}>
              Je vous saurai gré des dispositions que vous ferez prendre pour la satisfaction dudit virement.
            </Text>

            {/* SIGNATURES */}
            <SimpleGrid cols={2} mt={50}>
              <div style={{ textAlign: 'center' }}>
                <Text>Le Directeur de l'Administration des Finances</Text>
                <div style={{ height: 40 }}></div>
                <Text fw={700}>Salif SINDE</Text>
                <Text size="sm">Commissaire Divisionnaire de Police</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text>Le Directeur Général</Text>
                <div style={{ height: 40 }}></div>
                <Text fw={700}>Abdoulaye BELEM</Text>
                <Text size="sm">Commissaire Divisionnaire de Police</Text>
                <Text size="sm">Chevalier de l'Ordre de l'Étalon</Text>
              </div>
            </SimpleGrid>
          </Card>

          <Group justify="center">
            <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />} variant="outline">
              Imprimer
            </Button>
          </Group>
        </>
      )}

      {/* AUCUN RÉSULTAT */}
      {selectedOrdre && (!selectedOrdre.lignes || selectedOrdre.lignes.length === 0) && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="Aucun résultat">
          Aucune vacation trouvée pour les filtres sélectionnés.
        </Alert>
      )}

      {/* SECTION INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Sélectionnez un mois et une année</Text>
          <Text size="sm">2. Cliquez sur "Générer" pour créer l'ordre de virement</Text>
          <Text size="sm">3. L'ordre est généré automatiquement par banque</Text>
          <Text size="sm">4. Consultez les ordres sauvegardés dans l'onglet correspondant</Text>
          <Text size="sm">5. Imprimez l'ordre pour signature et transmission à la banque</Text>
        </Stack>
      </Card>
    </Stack>
  );
}