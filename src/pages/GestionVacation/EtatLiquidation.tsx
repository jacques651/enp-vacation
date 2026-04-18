import { Table, Paper, Text, Container, Loader, Alert } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

type Props = {
  mois: number;
  annee: number;
  enseignantId?: number;  // ← Note: enseignant_id, pas promotionId
};

// ================= TYPES =================
interface LiquidationRow {
  id: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
  cycle_designation: string;
  module_designation: string;
  matiere_designation: string;
  banque_designation: string | null;
  numero_compte: string | null;
  cle_rib: string | null;
  vhoraire_matiere: number;
  nb_classe: number;
  taux_horaire: number;
  taux_retenue: number;
  vht: number;
  montant_brut: number;
  montant_retenu: number;
  montant_net: number;
  mois: string;
  annee: number;
  annee_scolaire: string;
  promotion_libelle: string | null;
}

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

interface Signataire {
  id: number;
  nom: string;
  prenom: string;
  grade: string | null;
  fonction: string | null;
  titre_honorifique: string | null;
}

interface Promotion {
  id: number;
  libelle: string;
  annee_scolaire: string | null;
}

export default function EtatLiquidation({ mois, annee, enseignantId }: Props) {

  // ================= DATA =================
  const { data: rows = [], isLoading: rowsLoading, error: rowsError } = useQuery({
    queryKey: ['etat_liquidation', mois, annee, enseignantId],
    queryFn: () =>
      invoke<LiquidationRow[]>('get_etat_liquidation', {
        mois: mois.toString().padStart(2, '0'),
        annee,
        enseignant_id: enseignantId,
      }),
  });

  const { data: entetes = [], isLoading: entetesLoading } = useQuery({
    queryKey: ['entete'],
    queryFn: () => invoke<Entete[]>('get_entete'),
  });

  const { data: signataires = [], isLoading: signatairesLoading } = useQuery({
    queryKey: ['signataires'],
    queryFn: () => invoke<Signataire[]>('get_signataires'),
  });

  const { isLoading: promotionsLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => invoke<Promotion[]>('get_promotions'),
  });

  // ================= HELPERS =================
  const getEntete = (cle: string) =>
    entetes.find((e) => e.cle === cle)?.valeur || '';

  const format = (value?: number | null) =>
    (value ?? 0).toLocaleString('fr-FR');

  const percent = (n: number) => (n * 100).toFixed(0) + ' %';

  const today = new Date().toLocaleDateString('fr-FR');

  // Extraire l'année de début de l'année scolaire (ex: "2025-2026" → "2025")

  // Normaliser pour la recherche
  const normalize = (s: string | null) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

  // Trouver le DAF (responsable finances)
  const daf = signataires.find((s) =>
    normalize(s.fonction).includes('finances') ||
    normalize(s.fonction).includes('financier')
  );

  // Trouver le DG (Directeur Général)
  const dg = signataires.find((s) =>
    normalize(s.fonction).includes('directeur') &&
    (normalize(s.fonction).includes('general') || normalize(s.fonction).includes('generale'))
  );

  // ================= TOTAUX =================
  const total = rows.reduce(
    (acc, v) => ({
      nb: acc.nb + v.nb_classe,
      brut: acc.brut + v.montant_brut,
      retenu: acc.retenu + v.montant_retenu,
      net: acc.net + v.montant_net,
    }),
    { nb: 0, brut: 0, retenu: 0, net: 0 }
  );

  // ================= AFFICHAGE CHARGEMENT =================
  if (rowsLoading || entetesLoading || signatairesLoading || promotionsLoading) {
    return (
      <Container size="xl">
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <Loader size="lg" />
          <Text mt="md">Chargement de l'état de liquidation...</Text>
        </Paper>
      </Container>
    );
  }

  if (rowsError) {
    return (
      <Container size="xl">
        <Alert title="Erreur" color="red">
          Erreur lors du chargement des données: {String(rowsError)}
        </Alert>
      </Container>
    );
  }

  // ================= RENDU =================
  return (
    <Container size="xl">
      <Paper p="md" withBorder>

        {/* ================= ENTETE ================= */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Text fw={700}>{getEntete('ministere')}</Text>
            <Text>{getEntete('ecole')}</Text>
            <Text mt="sm">{getEntete('numero') || 'N° ORDRE'}</Text>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Text mt="xl">
              {getEntete('lieudate') || 'Bamako, le'} {today}
            </Text>
          </div>
        </div>

        {/* ================= TITRE ================= */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text fw={700} tt="uppercase" size="lg">
            ETAT DE LIQUIDATION DES FRAIS DE VACATION
          </Text>

          <Text fw={700} size="md" mt="md">
            MOIS {mois.toString().padStart(2, '0')} / {annee}
          </Text>

          {rows[0] && (
            <Text fw={700} size="sm" c="dimmed">
              Année scolaire: {rows[0].annee_scolaire}
            </Text>
          )}
        </div>

        {/* ================= TABLE ================= */}
        <Table mt="md" withColumnBorders withTableBorder striped highlightOnHover>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'center' }}>N°</th>
              <th>Nom Prénom</th>
              <th>Cycle</th>
              <th>Module</th>
              <th>Matière</th>
              <th style={{ textAlign: 'right' }}>VH</th>
              <th style={{ textAlign: 'right' }}>NB</th>
              <th style={{ textAlign: 'right' }}>Taux</th>
              <th style={{ textAlign: 'right' }}>Retenue</th>
              <th style={{ textAlign: 'right' }}>Brut</th>
              <th style={{ textAlign: 'right' }}>Net</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((v, i) => (
              <tr key={v.id}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{v.nom} {v.prenom}</td>
                <td>{v.cycle_designation}</td>
                <td>{v.module_designation}</td>
                <td>{v.matiere_designation}</td>
                <td style={{ textAlign: 'right' }}>{v.vhoraire_matiere}</td>
                <td style={{ textAlign: 'right' }}>{v.nb_classe}</td>
                <td style={{ textAlign: 'right' }}>{format(v.taux_horaire)}</td>
                <td style={{ textAlign: 'right' }}>{percent(v.taux_retenue)}</td>
                <td style={{ textAlign: 'right' }}>{format(v.montant_brut)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {format(v.montant_net)}
                </td>
              </tr>
            ))}

            {/* Ligne de total */}
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
              <td colSpan={5}>TOTAL GÉNÉRAL</td>
              <td style={{ textAlign: 'right' }}></td>
              <td style={{ textAlign: 'right' }}>{total.nb}</td>
              <td style={{ textAlign: 'right' }}></td>
              <td style={{ textAlign: 'right' }}></td>
              <td style={{ textAlign: 'right' }}>{format(total.brut)}</td>
              <td style={{ textAlign: 'right' }}>{format(total.net)}</td>
            </tr>
          </tbody>
        </Table>

        {/* ================= TEXTE ================= */}
        <Text mt="md" fw={600}>
          Arrêté le présent état à la somme de : <strong>{format(total.net)} FCFA</strong>
        </Text>

        {/* ================= SIGNATURES ================= */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text>{daf?.fonction || '_________________'}</Text>
            <Text mt="xl" fw={700}>
              {daf ? `${daf.prenom} ${daf.nom}` : '_________________'}
            </Text>
            <Text>{daf?.grade || ''}</Text>
            {daf?.titre_honorifique && (
              <Text size="sm" c="dimmed" mt="xs">{daf.titre_honorifique}</Text>
            )}
          </div>

          <div style={{ textAlign: 'center', flex: 1 }}>
            <Text>{dg?.fonction || '_________________'}</Text>
            <Text mt="xl" fw={700}>
              {dg ? `${dg.prenom} ${dg.nom}` : '_________________'}
            </Text>
            <Text>{dg?.grade || ''}</Text>
            {dg?.titre_honorifique && (
              <Text size="sm" c="dimmed" mt="xs">{dg.titre_honorifique}</Text>
            )}
          </div>
        </div>

      </Paper>
    </Container>
  );
}