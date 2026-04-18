import { Table, Button, Group, Paper, Text } from '@mantine/core';

// ================= TYPES =================
type Vacation = {
  id: number;
  enseignant: string;
  cycleLabel: string;
  moduleLabel: string;
  matiereLabel: string;

  nb_classe: number;
  vhoraire_matiere: number;
  taux_horaire: number;
  taux_retenue: number;
};

// ================= PROPS =================
type Props = {
  data: Vacation[];
  onEdit: (v: Vacation) => void;
  onDelete: (id: number) => void;
};

// ================= FORMAT SAFE =================
const format = (v: number | undefined | null) =>
  (v ?? 0).toLocaleString();

// ================= CALCUL =================
const calcNet = (v: Vacation) => {
  const brut = v.nb_classe * v.vhoraire_matiere * v.taux_horaire;
  const retenu = brut * (v.taux_retenue / 100);
  return brut - retenu;
};

// ================= COMPONENT =================
export function ListeVacation({ data, onEdit, onDelete }: Props) {
  return (
    <Paper withBorder p="sm">
      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>Enseignant</th>
            <th>Cycle</th>
            <th>Module</th>
            <th>Matière</th>
            <th>Net</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <Text ta="center">Aucune donnée</Text>
              </td>
            </tr>
          ) : (
            data.map((v) => {
              const net = calcNet(v);

              return (
                <tr key={v.id}>
                  <td>{v.enseignant}</td>
                  <td>{v.cycleLabel}</td>
                  <td>{v.moduleLabel}</td>
                  <td>{v.matiereLabel}</td>

                  <td>
                    <Text fw={700}>{format(net)} FCFA</Text>
                  </td>

                  <td>
                    <Group gap="xs">
                      <Button size="xs">👁</Button>

                      <Button size="xs" onClick={() => onEdit(v)}>
                        ✏️
                      </Button>

                      <Button
                        size="xs"
                        color="red"
                        onClick={() => onDelete(v.id)}
                      >
                        🗑
                      </Button>
                    </Group>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </Paper>
  );
}