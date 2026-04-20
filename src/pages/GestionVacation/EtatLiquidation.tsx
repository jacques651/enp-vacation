// src/pages/GestionVacation/EtatLiquidation.tsx
import { useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Alert,
  Divider,
  ThemeIcon,
  Select,
  ScrollArea,
  LoadingOverlay,
  SimpleGrid,
  Modal,
  Switch,
} from '@mantine/core';
import { IconFileText, IconAlertCircle, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

interface LiquidationRow {
  id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
  cycle: string;
  module: string;
  matiere: string;
  vhoraire: number;
  nb_classe: number;
  vht: number;
  montant_brut: number;
  montant_retenu: number;
  montant_net: number;
  mois: number;
  annee: number;
}

interface Totaux {
  total_heures: number;
  total_brut: number;
  total_retenu: number;
  total_net: number;
}

interface Signataire {
  id: number;
  nom: string;
  prenom: string;
  grade: string;
  fonction: string;
  titre: string;
  ordre_signature: number;
  actif: number;
}

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

const MOIS_OPTIONS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' }
];

const ANNEES_OPTIONS = [2024, 2025, 2026, 2027, 2028].map(a => ({ value: String(a), label: String(a) }));

export default function EtatLiquidation() {
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [selectedPromotion, setSelectedPromotion] = useState<string>('');
  const [selectedAnneeScolaire, setSelectedAnneeScolaire] = useState<string>('');
  const [isLandscape, setIsLandscape] = useState(true);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState<string>('');

  // Récupérer les entêtes
  const { data: entetes = [] } = useQuery<Entete[]>({
    queryKey: ['entetes'],
    queryFn: async () => {
      const result = await invoke('get_entetes');
      return result as Entete[];
    },
  });

  // Récupérer les signataires actifs
  const { data: signataires = [] } = useQuery<Signataire[]>({
    queryKey: ['signataires_actifs'],
    queryFn: async () => {
      const result = await invoke('get_signataires_actifs');
      return result as Signataire[];
    },
  });

  // Récupérer les promotions
  const { data: promotionsList = [] } = useQuery<{ id: number; libelle: string }[]>({
    queryKey: ['promotions'],
    queryFn: async () => {
      const result = await invoke('get_promotions');
      return result as { id: number; libelle: string }[];
    },
  });

  // Récupérer les années scolaires
  const { data: anneesScolairesList = [] } = useQuery<{ id: number; libelle: string }[]>({
    queryKey: ['annees_scolaires'],
    queryFn: async () => {
      const result = await invoke('get_annees_scolaires');
      return result as { id: number; libelle: string }[];
    },
  });

  // Récupérer les données de liquidation
  const { data: rows = [], isLoading, error, refetch } = useQuery<LiquidationRow[]>({
    queryKey: ['etat_liquidation', mois, annee],
    queryFn: async () => {
      const result = await invoke('get_etat_liquidation', { mois, annee });
      return result as LiquidationRow[];
    },
  });

  const { data: totaux } = useQuery<Totaux>({
    queryKey: ['totaux_liquidation', mois, annee],
    queryFn: async () => {
      const result = await invoke('get_totaux_liquidation', { mois, annee });
      return result as Totaux;
    },
  });

  // Fonction pour récupérer une valeur d'entête
  const getEnteteValue = (cle: string): string => {
    const item = entetes.find(e => e.cle === cle);
    return item?.valeur || '';
  };

  const formatNumber = (value: number): string => {
    return value.toLocaleString('fr-FR');
  };

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

  const generatePrintHTML = () => {
    const rowsHtml = rows.map((row, index) => {
      const vhtValue = row.vht;
      const nbClasseValue = row.nb_classe;
      const tauxHoraire = 5000;
      const tauxRetenue = 2;
      const montantBrut = vhtValue * tauxHoraire;
      const montantRetenu = montantBrut * (tauxRetenue / 100);
      const montantNet = montantBrut - montantRetenu;

      return `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${row.nom} ${row.prenom}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${row.cycle}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${row.module}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${row.matiere}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${row.vhoraire}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${nbClasseValue}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${vhtValue}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${tauxHoraire.toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${tauxRetenue}%</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatNumber(montantRetenu)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatNumber(montantBrut)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatNumber(montantNet)}</td>
      </tr>
    `;
    }).join('');

    const moisLabel = MOIS_OPTIONS.find(m => m.value === String(mois))?.label || '';
    const date = new Date();
    const jour = date.getDate();
    const moisActuel = date.getMonth() + 1;
    const anneeActuelle = date.getFullYear();
    const moisLabelActuel = MOIS_OPTIONS.find(m => m.value === String(moisActuel))?.label || '';

    const signataire1 = signataires.find(s => s.ordre_signature === 1);
    const signataire2 = signataires.find(s => s.ordre_signature === 2);

    const nomEtablissement = getEnteteValue('nom_etablissement') || 'ECOLE NATIONALE DE POLICE';
    const adresse = getEnteteValue('adresse') || '01 BP 1234 OUAGADOUGOU 01';
    const telephone = getEnteteValue('telephone') || '25 36 11 11';
    const email = getEnteteValue('email') || 'enp@police.bf';
    const directeurNom = getEnteteValue('directeur_nom') || 'Abdoulaye BELEM';
    const directeurTitre = getEnteteValue('directeur_titre') || 'Commissaire Divisionnaire';
    const directeurFonction = getEnteteValue('directeur_fonction') || 'Directeur Général';
    const comptableNom = getEnteteValue('comptable_nom') || 'Salif SINDE';
    const comptableTitre = getEnteteValue('comptable_titre') || 'Commissaire Principal';
    const comptableFonction = getEnteteValue('comptable_fonction') || 'Directeur Administratif et Financier';

    const promotionLibelle = selectedPromotion || (promotionsList[0]?.libelle || '55ème PROMOTION');
    const anneeScolaireLibelle = selectedAnneeScolaire || (anneesScolairesList[0]?.libelle || '2025-2026');

    const totalBrut = rows.reduce((sum, row) => sum + (row.vht * 5000), 0);
    const totalRetenu = totalBrut * 0.02;
    const totalNet = totalBrut - totalRetenu;
    const totalHeures = rows.reduce((sum, row) => sum + row.vht, 0);

    const pageOrientation = isLandscape ? 'landscape' : 'portrait';
    const pageWidth = isLandscape ? '297mm' : '210mm';
    const pageHeight = isLandscape ? '210mm' : '297mm';
    const tableFontSize = isLandscape ? '8pt' : '7pt';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>État de liquidation - ${moisLabel} ${annee}</title>
        <style>
          @page {
            size: ${pageOrientation};
            margin: 15mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Times New Roman', Arial, serif;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.3;
            width: ${pageWidth};
            min-height: ${pageHeight};
          }
          .page {
            width: 100%;
            padding: 10px;
          }
          /* HEADER FLEX POUR ALIGNER ENTÊTE À GAUCHE ET DEVISE À DROITE */
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .header-left {
            text-align: left;
          }
          .header-left div {
            font-weight: bold;
            text-transform: uppercase;
            margin: 2px 0;
          }
          .header-right {
            text-align: right;
          }
          .header-right div {
            margin: 2px 0;
          }
          .reference {
            text-align: left;
            margin: 15px 0;
          }
          .date {
            text-align: right;
            margin: 15px 0;
          }
          .title {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 30px 0 20px 0;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: ${tableFontSize};
          }
          th {
            background-color: #1b365d;
            color: white;
            padding: 4px;
            border: 1px solid #aaa;
            text-align: center;
            font-weight: bold;
          }
          td {
            padding: 4px;
            border: 1px solid #aaa;
          }
          .total {
            text-align: right;
            font-weight: bold;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #000;
          }
          .montant-lettre {
            margin-top: 20px;
            text-align: left;
          }
          .signatures {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
          }
          .signature-left {
            text-align: center;
            width: 45%;
          }
          .signature-right {
            text-align: center;
            width: 45%;
          }
          .signature-left p, .signature-right p {
            margin: 5px 0;
          }
          .signature-name {
            font-weight: bold;
            margin-top: 40px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 9pt;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
          @media print {
            .no-print {
              display: none;
            }
            body {
              padding: 0;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- EN-TÊTE À GAUCHE ET DEVISE À DROITE SUR LA MÊME LIGNE -->
          <div class="header-row">
            <div class="header-left">
              <div>MINISTÈRE DE LA SÉCURITÉ</div>
              <div>SECRÉTARIAT GÉNÉRAL</div>
              <div>${nomEtablissement}</div>
              <div>DIRECTION GÉNÉRALE</div>
              <div>DIRECTION DE L'ADMINISTRATION DES FINANCES</div>
            </div>
            <div class="header-right">
              <div><strong>Burkina Faso</strong></div>
              <div>La Patrie ou la Mort, nous Vaincrons</div>
            </div>
          </div>

          <!-- RÉFÉRENCE À GAUCHE -->
          <div class="reference">
            N°2026-_____/MSECU/SG/ENP/DG/DAF
          </div>

          <!-- DATE À DROITE -->
          <div class="date">
            Fait à Ouagadougou, le ${jour} ${moisLabelActuel} ${anneeActuelle}
          </div>

          <!-- TITRE DYNAMIQUE -->
          <div class="title">
            ETAT DE LIQUIDATION DES FRAIS DE VACATION DES COURS DISPENSES<br>
            AUX ELEVES DE LA ${promotionLibelle.toUpperCase()} DE L'ECOLE NATIONALE DE POLICE<br>
            AU TITRE DE L'ANNEE SCOLAIRE ${anneeScolaireLibelle}
          </div>

          <!-- TABLEAU -->
          <table>
            <thead>
              <tr>
                <!-- Dans la fonction generatePrintHTML, remplacer NB par Nb classe -->
<th>N°</th>
<th>Nom Prénom</th>
<th>Cycle</th>
<th>Module</th>
<th>Matière</th>
<th>VH</th>
<th>Nb classe</th>
<th>VHT</th>
<th>Taux H</th>
<th>Taux retenue</th>
<th>Mt retenu</th>
<th>Mt brut</th>
<th>Mt net</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- TOTAL GÉNÉRAL -->
          <div class="total">
            <p>Total Général : ${rows.length} | ${totalHeures.toFixed(0)}h | ${formatNumber(totalBrut)} | ${formatNumber(totalRetenu)} | ${formatNumber(totalNet)}</p>
          </div>

          <!-- MONTANT EN LETTRES -->
          <div class="montant-lettre">
            <p>Arrêté le présent état à la somme de : <strong>${formatMontantLettre(totalNet)}</strong></p>
          </div>

          <!-- SIGNATURES CÔTE À CÔTE -->
          <div class="signatures">
            <div class="signature-left">
              <p>${comptableFonction}</p>
              <div style="height: 40px;"></div>
              <p class="signature-name">${comptableNom}</p>
              <p>${comptableTitre}</p>
            </div>
            <div class="signature-right">
              <p>${directeurFonction}</p>
              <div style="height: 40px;"></div>
              <p class="signature-name">${directeurNom}</p>
              <p>${directeurTitre}<br>Chevalier de l'Ordre de l'Étalon</p>
            </div>
          </div>

          <!-- PIED DE PAGE -->
          <div class="footer">
            <p>${adresse} | Tél: ${telephone} | Email: ${email}</p>
          </div>

          <!-- BOUTONS D'IMPRESSION -->
          <div class="no-print" style="text-align: center; margin-top: 20px; padding: 10px;">
            <button onclick="window.print();" style="padding: 8px 16px; background: #1b365d; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Imprimer</button>
            <button onclick="window.close();" style="margin-left: 10px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">❌ Fermer</button>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const htmlContent = generatePrintHTML();
    const printWindow = window.open('', '_blank', 'width=1200,height=800');

    if (!printWindow) {
      setPrintContent(htmlContent);
      setPrintModalOpen(true);
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement de l'état de liquidation...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder radius="md" p="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erreur">
          Impossible de charger l'état de liquidation
        </Alert>
      </Card>
    );
  }

  return (
    <Stack p="md" gap="lg">
      {/* HEADER */}
      <Card withBorder radius="md" p="lg" bg="adminBlue.8">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={2} c="white">État de liquidation</Title>
            <Text size="sm" c="gray.3">
              {rows.length} vacation{rows.length > 1 ? 's' : ''} trouvée{rows.length > 1 ? 's' : ''}
            </Text>
          </Stack>
          <Group>
            <Switch
              label="Mode paysage"
              checked={isLandscape}
              onChange={(e) => setIsLandscape(e.currentTarget.checked)}
              color="blue"
            />
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
              variant="outline"
              color="white"
            >
              Imprimer l'état
            </Button>
          </Group>
        </Group>
      </Card>

      {/* FILTRES */}
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-end">
          <Group>
            <Select
              label="Mois"
              placeholder="Sélectionner un mois"
              data={MOIS_OPTIONS}
              value={String(mois)}
              onChange={(val) => setMois(Number(val))}
              style={{ width: 150 }}
            />
            <Select
              label="Année"
              placeholder="Sélectionner une année"
              data={ANNEES_OPTIONS}
              value={String(annee)}
              onChange={(val) => setAnnee(Number(val))}
              style={{ width: 100 }}
            />
            <Select
              label="Promotion"
              placeholder="Sélectionner une promotion"
              data={promotionsList.map(p => ({ value: p.libelle, label: p.libelle }))}
              value={selectedPromotion}
              onChange={(val) => setSelectedPromotion(val || '')}
              clearable
              searchable
              style={{ width: 200 }}
            />
            <Select
              label="Année scolaire"
              placeholder="Sélectionner une année scolaire"
              data={anneesScolairesList.map(a => ({ value: a.libelle, label: a.libelle }))}
              value={selectedAnneeScolaire}
              onChange={(val) => setSelectedAnneeScolaire(val || '')}
              clearable
              searchable
              style={{ width: 200 }}
            />
            <Button onClick={() => refetch()} mt="auto" variant="light">
              Actualiser
            </Button>
          </Group>
        </Group>
      </Card>

      {/* TOTAUX */}
      {totaux && (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Card withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed">Total heures</Text>
            <Text fw={700} size="xl" c="cyan">{totaux.total_heures.toFixed(0)}h</Text>
          </Card>
          <Card withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed">Total brut</Text>
            <Text fw={700} size="xl" c="green">{formatNumber(totaux.total_brut)} F</Text>
          </Card>
          <Card withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed">Total retenu</Text>
            <Text fw={700} size="xl" c="orange">{formatNumber(totaux.total_retenu)} F</Text>
          </Card>
          <Card withBorder radius="md" p="sm">
            <Text size="xs" c="dimmed">Total net</Text>
            <Text fw={700} size="xl" c="teal">{formatNumber(totaux.total_net)} F</Text>
          </Card>
        </SimpleGrid>
      )}

      {/* APERÇU DU TABLEAU */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={4}>Aperçu des vacations</Title>
          <Divider />

          {rows.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Aucune vacation trouvée pour la période sélectionnée.
            </Alert>
          ) : (
            <ScrollArea style={{ maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                <thead>
                  <tr style={{ backgroundColor: '#1b365d', color: 'white' }}>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>N°</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>Nom Prénom</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>Cycle</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>Matière</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>Nb classe</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>VHT</th>
                    <th style={{ border: '1px solid #ddd', padding: 8 }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{index + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{row.nom} {row.prenom}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{row.cycle}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{row.matiere}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6, textAlign: 'center' }}>{row.nb_classe}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6, textAlign: 'center' }}>{row.vht}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6, textAlign: 'right' }}>{formatNumber(row.montant_net)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}

          <Divider />
          <Text size="sm" c="dimmed" ta="center">
            Cliquez sur "Imprimer l'état" pour générer le document officiel complet.
          </Text>
        </Stack>
      </Card>

      {/* MODAL POUR POP-UP BLOQUÉ */}
      <Modal
        opened={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Impression"
        size="90%"
        fullScreen
      >
        <iframe
          srcDoc={printContent}
          style={{ width: '100%', height: '80vh', border: 'none' }}
          title="Aperçu impression"
        />
        <Group justify="flex-end" mt="md">
          <Button onClick={() => setPrintModalOpen(false)}>Fermer</Button>
          <Button
            onClick={() => {
              const printFrame = document.querySelector('iframe');
              if (printFrame) {
                (printFrame as any).contentWindow.print();
              }
            }}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
          >
            Imprimer
          </Button>
        </Group>
      </Modal>

      {/* INSTRUCTIONS */}
      <Card withBorder radius="md" p="lg">
        <Title order={5} mb="md">📋 Instructions</Title>
        <Stack gap="xs">
          <Text size="sm">1. Sélectionnez un mois et une année pour filtrer les vacations</Text>
          <Text size="sm">2. Sélectionnez une promotion et une année scolaire pour le titre</Text>
          <Text size="sm">3. Choisissez le mode paysage ou portrait avant d'imprimer</Text>
          <Text size="sm">4. Cliquez sur "Imprimer l'état" pour générer le document officiel</Text>
          <Text size="sm">5. Le document peut être imprimé ou sauvegardé en PDF</Text>
        </Stack>
      </Card>
    </Stack>
  );
}