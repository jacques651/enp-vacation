// src/pages/Dashboard.tsx
import {
  Grid,
  Loader,
  Center,
  Card,
  Table,
  Title,
  Text,
  Group,
  Stack,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import KpiCard from '../components/dashboard/KpiCard';

// Types
interface DashboardStats {
  total_vacations_mois: number;
  total_net_mois: number;
  total_enseignants: number;
  total_matieres: number;
  vacations_par_mois: { mois: number; total: number }[];
  repartition_statut: { statut: string; count: number }[];
  dernieres_vacations: {
    id: number;
    enseignant: string;
    matiere: string;
    net: number;
    mois: number;
    annee: number;
  }[];
}

const MOIS_NAMES: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril',
  5: 'Mai', 6: 'Juin', 7: 'Juillet', 8: 'Août',
  9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre'
};

const COLORS = ['#1b365d', '#4a6a8a', '#799bba', '#c4cfad'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🎯 Dashboard monté - chargement des données...");
    
    invoke<DashboardStats>('get_dashboard_stats')
      .then((response) => {
        console.log("📊 Données reçues:", response);
        setData(response);
      })
      .catch((err) => {
        console.error("❌ Erreur:", err);
        setError(err as string);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Center h="100%" style={{ minHeight: '400px' }}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%" style={{ minHeight: '400px' }}>
        <Card withBorder p="xl" bg="red.0">
          <Text c="red" fw={700}>Erreur: {error}</Text>
        </Card>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center h="100%" style={{ minHeight: '400px' }}>
        <Text c="dimmed">Aucune donnée disponible</Text>
      </Center>
    );
  }

  // Transformer les données pour le graphique (mois numériques → noms)
  const chartData = data.vacations_par_mois?.map(item => ({
    mois: MOIS_NAMES[item.mois] || String(item.mois),
    total: item.total,
    moisNum: item.mois
  })).sort((a, b) => a.moisNum - b.moisNum) || [];

  // Transformer les données pour le graphique des statuts
  const statutLabels: Record<string, string> = {
    interne: 'Interne',
    externe: 'Externe'
  };

  const pieData = data.repartition_statut?.map(item => ({
    statut: statutLabels[item.statut] || item.statut,
    count: item.count
  })) || [];

  // Formater la date pour l'affichage
  const formatDate = (mois: number, annee: number): string => {
    return `${MOIS_NAMES[mois]} ${annee}`;
  };

  return (
    <Stack p="md" gap="md">
      <Title order={2} style={{ fontFamily: 'Times New Roman' }}>
        Tableau de bord
      </Title>

      {/* KPI Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard 
            title="Vacations du mois" 
            value={data.total_vacations_mois?.toLocaleString() ?? 0} 
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard 
            title="Montant net" 
            value={`${(data.total_net_mois ?? 0).toLocaleString()} FCFA`} 
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard 
            title="Enseignants" 
            value={data.total_enseignants?.toLocaleString() ?? 0} 
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <KpiCard 
            title="Matières" 
            value={data.total_matieres?.toLocaleString() ?? 0} 
          />
        </Grid.Col>
      </Grid>

      {/* Graphiques */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder radius="md" p="md" shadow="sm">
            <Title order={5} mb="md">Vacations par mois</Title>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} vacations`} />
                  <Bar dataKey="total" fill="#1b365d" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Center h={300}>
                <Text c="dimmed">Aucune donnée disponible</Text>
              </Center>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="md" shadow="sm">
            <Title order={5} mb="md" ta="center">Répartition par statut</Title>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="statut"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Center h={300}>
                <Text c="dimmed">Aucune donnée disponible</Text>
              </Center>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Dernières vacations */}
      <Card withBorder radius="md" p="md" shadow="sm">
        <Title order={5} mb="md">Dernières vacations</Title>
        {data.dernieres_vacations?.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Enseignant</Table.Th>
                <Table.Th>Matière</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Montant</Table.Th>
                <Table.Th>Période</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.dernieres_vacations.map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td fw={500}>{v.enseignant}</Table.Td>
                  <Table.Td>{v.matiere}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c="green">
                      {v.net?.toLocaleString()} FCFA
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatDate(v.mois, v.annee)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Center py="xl">
            <Text c="dimmed">Aucune vacation récente</Text>
          </Center>
        )}
      </Card>
    </Stack>
  );
}