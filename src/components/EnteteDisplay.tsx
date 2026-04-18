import { Stack, Text, Group, Loader, Alert } from "@mantine/core";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

export default function EnteteDisplay() {
  const [entetes, setEntetes] = useState<Entete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntetes = async () => {
      try {
        setLoading(true);
        const result = await invoke<Entete[]>("get_entetes");
        setEntetes(Array.isArray(result) ? result : []);
        setError(null);
      } catch (err) {
        console.error("Erreur lors du chargement des entêtes:", err);
        setError("Impossible de charger les informations");
      } finally {
        setLoading(false);
      }
    };

    fetchEntetes();
  }, []);

  // Fonction utilitaire pour obtenir une valeur par clé
  const getValue = (cle: string): string => {
    const item = entetes.find(e => e.cle === cle);
    return item?.valeur || "";
  };

  if (loading) {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        {error}
      </Alert>
    );
  }

  return (
    <Stack gap={0} style={{ fontFamily: "Times New Roman, serif" }}>
      <Group justify="space-between" align="flex-start">
        {/* Gauche */}
        <Stack gap={2}>
          <Text fw={700} size="sm">
            {getValue("ministere")}
          </Text>
          <Text fw={700} size="sm">
            {getValue("secretariat")}
          </Text>
          <Text fw={700} size="sm">
            {getValue("ecole")}
          </Text>
        </Stack>

        {/* Droite */}
        <Stack gap={2} align="flex-end">
          <Text fw={700} size="sm">
            {getValue("pays")}
          </Text>
          <Text fs="italic" size="sm">
            {getValue("devise")}
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
}