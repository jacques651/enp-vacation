import { Stack, Text, Group, Loader, Alert, Image } from "@mantine/core";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface Entete {
  id: number;
  cle: string;
  valeur: string | null;
}

interface EnteteDisplayProps {
  showLogo?: boolean;
  showContact?: boolean;
  layout?: "horizontal" | "vertical";
}

export default function EnteteDisplay({ 
  showLogo = false, 
  showContact = false,
  layout = "horizontal" 
}: EnteteDisplayProps) {
  const [entetes, setEntetes] = useState<Entete[]>([]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntetes = async () => {
      try {
        setLoading(true);
        
        // Récupérer toutes les entêtes
        const result = await invoke<Entete[]>("get_entetes");
        setEntetes(Array.isArray(result) ? result : []);
        
        // Récupérer le logo si demandé
        if (showLogo) {
          try {
            const logo = await invoke<string | null>("get_logo_base64");
            setLogoBase64(logo);
          } catch (err) {
            console.error("Erreur chargement logo:", err);
          }
        }
        
        setError(null);
      } catch (err) {
        console.error("Erreur lors du chargement des entêtes:", err);
        setError("Impossible de charger les informations");
      } finally {
        setLoading(false);
      }
    };

    fetchEntetes();
  }, [showLogo]);

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

  const nomEtablissement = getValue("nom_etablissement");
  const sigle = getValue("sigle");
  const adresse = getValue("adresse");
  const telephone = getValue("telephone");
  const email = getValue("email");
  const directeurNom = getValue("directeur_nom");
  const directeurTitre = getValue("directeur_titre");
  const directeurFonction = getValue("directeur_fonction");

  // Layout horizontal (par défaut)
  if (layout === "horizontal") {
    return (
      <Stack gap={0} style={{ fontFamily: "Times New Roman, serif" }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          {/* Logo à gauche */}
          {showLogo && logoBase64 && (
            <Image
              src={logoBase64}
              alt="Logo"
              fit="contain"
              style={{ maxWidth: 80, maxHeight: 80 }}
            />
          )}
          
          {/* Centre - Informations principales */}
          <Stack gap={2} style={{ flex: 1, textAlign: "center" }}>
            <Text fw={700} size="lg" tt="uppercase">
              {nomEtablissement}
            </Text>
            {sigle && (
              <Text fw={600} size="sm" c="dimmed">
                {sigle}
              </Text>
            )}
            {adresse && (
              <Text size="xs" c="dimmed">
                {adresse}
              </Text>
            )}
          </Stack>
          
          {/* Logo à droite (optionnel) */}
          {showLogo && !logoBase64 && <div style={{ width: 80 }} />}
        </Group>

        {/* Contacts */}
        {showContact && (telephone || email) && (
          <Group justify="center" gap="xl" mt="xs">
            {telephone && (
              <Text size="xs" c="dimmed">
                📞 {telephone}
              </Text>
            )}
            {email && (
              <Text size="xs" c="dimmed">
                ✉️ {email}
              </Text>
            )}
          </Group>
        )}
      </Stack>
    );
  }

  // Layout vertical (pour les documents officiels)
  return (
    <Stack gap={4} style={{ fontFamily: "Times New Roman, serif" }}>
      {/* Logo et en-tête */}
      <Group justify="center" align="center" gap="md">
        {showLogo && logoBase64 && (
          <Image
            src={logoBase64}
            alt="Logo"
            fit="contain"
            style={{ maxWidth: 60, maxHeight: 60 }}
          />
        )}
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" tt="uppercase" ta="center">
            {nomEtablissement}
          </Text>
          {sigle && (
            <Text fw={600} size="sm" c="dimmed" ta="center">
              {sigle}
            </Text>
          )}
        </Stack>
      </Group>

      {/* Adresse et contacts */}
      {adresse && (
        <Text size="xs" c="dimmed" ta="center">
          {adresse}
        </Text>
      )}
      
      {showContact && (telephone || email) && (
        <Group justify="center" gap="md">
          {telephone && (
            <Text size="xs" c="dimmed">
              📞 {telephone}
            </Text>
          )}
          {email && (
            <Text size="xs" c="dimmed">
              ✉️ {email}
            </Text>
          )}
        </Group>
      )}

      {/* Directeur */}
      {directeurNom && (
        <Stack gap={0} align="center" mt="md">
          {directeurTitre && (
            <Text size="sm" fw={500}>
              {directeurTitre}
            </Text>
          )}
          <Text size="sm" fw={500}>
            {directeurNom}
          </Text>
          {directeurFonction && (
            <Text size="xs" c="dimmed">
              {directeurFonction}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}