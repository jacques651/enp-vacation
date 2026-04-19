import { Table, Paper, Text, Container, Loader, Alert, Group, Stack, Title, Divider } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

type Props = {
  mois: number;
  annee: number;
  enseignantId?: number;
};

// ================= TYPES (ALIGNÉS AVEC LA BASE) =================
interface LiquidationRow {
  numero_ordre: number;
  nom: string;
  prenom: string;
  titre: string;
  statut: string;
  cycle: string;
  module: string;
  matiere: string;
  banque: string | null;
  vhoraire: number;
  nb_classe: number;
  vht: number;
  taux_horaire: number;
  taux_retenue: number;
  montant_brut: number;
  montant_retenu: number;
  montant_net: number;
  mois: number;  // ✅ CORRIGÉ : number au lieu de string
  annee: number;
  annee_scolaire: string;
  promotion: string;
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
  fonction: string;
  titre: string;
  ordre_signature: number;
  actif: number;
}

export default function EtatLiquidation({ mois, annee, enseignantId }: Props) {

  // ================= DATA =================
  const { data: rows = [], isLoading: rowsLoading, error: rowsError } = useQuery({
    queryKey: ['etat_liquidation', mois, annee, enseignantId],
    queryFn: () =>
      invoke<LiquidationRow[]>('get_etat_liquidation', {
        mois: Number(mois),  // ✅ CORRIGÉ : envoie un nombre, pas une string
        annee: Number(annee),  // ✅ CORRIGÉ : envoie un nombre aussi
        enseignant_id: enseignantId,
      }),
  });

  const { data: entetes = [], isLoading: entetesLoading } = useQuery({
    queryKey: ['entetes'],
    queryFn: () => invoke<Entete[]>('get_entetes'),
  });

  const { data: signataires = [], isLoading: signatairesLoading } = useQuery({
    queryKey: ['signataires'],
    queryFn: () => invoke<Signataire[]>('get_signataires'),
  });

  // ================= HELPERS =================
  const getEntete = (cle: string) =>
    entetes.find((e) => e.cle === cle)?.valeur || '';

  const format = (value?: number | null) =>
    (value ?? 0).toLocaleString('fr-FR');

  const today = new Date().toLocaleDateString('fr-FR');

  // Normaliser pour la recherche
  const normalize = (s: string | null) =>
    s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

  // Trouver le DAF (responsable finances)
  const daf = signataires.find((s) =>
    normalize(s.fonction).includes('finances') ||
    normalize(s.fonction).includes('financier') ||
    normalize(s.fonction).includes('comptable')
  );

  // Trouver le DG (Directeur Général)
  const dg = signataires.find((s) =>
    normalize(s.fonction).includes('directeur') &&
    (normalize(s.fonction).includes('general') || normalize(s.fonction).includes('generale'))
  ) || signataires.find((s) => s.ordre_signature === 1);

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
  if (rowsLoading || entetesLoading || signatairesLoading) {
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
    <Container size="xl" py="md">
      <Paper p="xl" withBorder>
        {/* ================= ENTETE ================= */}
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={2}>
            <Text fw={700} size="sm">{getEntete('nom_etablissement') || 'ECOLE NATIONALE DE POLICE'}</Text>
            {getEntete('sigle') && <Text size="sm" c="dimmed">{getEntete('sigle')}</Text>}
            {getEntete('adresse') && <Text size="xs" c="dimmed">{getEntete('adresse')}</Text>}
          </Stack>

          <Stack gap={2} align="flex-end">
            <Text size="sm">
              {getEntete('lieudate') || 'Ouagadougou, le'} {today}
            </Text>
          </Stack>
        </Group>

        <Divider my="md" />

        {/* ================= TITRE ================= */}
        <Stack align="center" gap="xs" mb="lg">
          <Title order={2} tt="uppercase" ta="center">
            ETAT DE LIQUIDATION DES FRAIS DE VACATION
          </Title>

          <Title order={4} ta="center" c="blue">
            MOIS {mois.toString().padStart(2, '0')} / {annee}  {/* ✅ Affichage formaté */}
          </Title>

          {rows[0] && (
            <Text size="sm" c="dimmed">
              Année scolaire: {rows[0].annee_scolaire}
            </Text>
          )}
        </Stack>

        {/* ================= TABLE ================= */}
        {rows.length === 0 ? (
          <Alert title="Aucune donnée" color="blue" variant="light">
            Aucune vacation trouvée pour la période sélectionnée.
          </Alert>
        ) : (
          <>
            <Table withColumnBorders withTableBorder striped highlightOnHover>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f5f5f5' }}>
                  <Table.Th style={{ textAlign: 'center', width: 50 }}>N°</Table.Th>
                  <Table.Th>Enseignant</Table.Th>
                  <Table.Th>Promotion</Table.Th>
                  <Table.Th>Cycle</Table.Th>
                  <Table.Th>Module</Table.Th>
                  <Table.Th>Matière</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>VH</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>NB Cl.</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>VHT</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Taux H.</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Brut</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Retenue</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Net</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((v, i) => (
                  <Table.Tr key={i}>
                    <Table.Td style={{ textAlign: 'center' }}>{i + 1}</Table.Td>
                    <Table.Td>
                      <Text fw={500}>{v.nom} {v.prenom}</Text>
                      <Text size="xs" c="dimmed">{v.titre} ({v.statut})</Text>
                    </Table.Td>
                    <Table.Td>{v.promotion}</Table.Td>
                    <Table.Td>{v.cycle}</Table.Td>
                    <Table.Td>{v.module}</Table.Td>
                    <Table.Td>{v.matiere}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{v.vhoraire}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{v.nb_classe}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{v.vht}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{format(v.taux_horaire)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{format(v.montant_brut)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{format(v.montant_retenu)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {format(v.montant_net)}
                    </Table.Td>
                  </Table.Tr>
                ))}

                {/* Ligne de total */}
                <Table.Tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                  <Table.Td colSpan={7} style={{ textAlign: 'right' }}>
                    TOTAL GÉNÉRAL
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{total.nb}</Table.Td>
                  <Table.Td colSpan={2}></Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{format(total.brut)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{format(total.retenu)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{format(total.net)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            {/* ================= TEXTE ================= */}
            <Text mt="md" fw={600}>
              Arrêté le présent état à la somme de : <strong>{format(total.net)} FCFA</strong>
            </Text>

            {/* ================= SIGNATURES ================= */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <Text>{daf?.fonction || 'Le Comptable'}</Text>
                <Text mt="xl" fw={700}>
                  {daf ? `${daf.prenom} ${daf.nom}` : '_________________'}
                </Text>
                <Text>{daf?.titre || ''}</Text>
              </div>

              <div style={{ textAlign: 'center', flex: 1 }}>
                <Text>{dg?.fonction || 'Le Directeur Général'}</Text>
                <Text mt="xl" fw={700}>
                  {dg ? `${dg.prenom} ${dg.nom}` : '_________________'}
                </Text>
                <Text>{dg?.titre || ''}</Text>
              </div>
            </div>
          </>
        )}
      </Paper>
    </Container>
  );
}