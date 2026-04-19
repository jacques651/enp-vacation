import { Modal, Grid, Select, NumberInput, Button, Card, Text, Group, Badge, Stack, ThemeIcon, Paper, Alert, Tooltip, Skeleton, SimpleGrid } from "@mantine/core";
import { IconInfoCircle, IconAlertCircle, IconCalculator, IconUser, IconBook, IconCalendar, IconChartBar, IconClock, IconSchool } from "@tabler/icons-react";
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from "react";

interface Props {
    opened: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => void;
    onCalculate?: () => void;
    form: any;
    enseignants: any[];
    cycles: any[];
    modules: any[];
    matieres: any[];
    promotions: any[];
    vacations: any[];
    editing?: any;
    isLoading?: boolean;
    calculating?: boolean;
    calculatedValues?: any;
}

interface AnneeScolaire {
    id: number;
    libelle: string;
}

export default function VacationFormModal({
    opened,
    onClose,
    onSubmit,
    onCalculate,
    form,
    enseignants = [],
    cycles = [],
    modules = [],
    matieres = [],
    promotions = [],
    vacations = [],
    editing,
    isLoading = false,
    calculating = false,
    calculatedValues = null
}: Props) {

    // ============================================================
    // 1. RÉCUPÉRATION DES DONNÉES
    // ============================================================

    // Récupération des années scolaires depuis le backend
    const { data: anneesScolairesList = [] } = useQuery<AnneeScolaire[]>({
        queryKey: ['annees_scolaires'],
        queryFn: () => invoke('get_annees_scolaires'),
    });

    // Sélections actuelles pour affichage
    const selectedMatiere = matieres?.find(m => m.id === form.values.matiere_id);
    const selectedCycle = cycles?.find(c => c.id === form.values.cycle_id);
    const selectedEnseignant = enseignants?.find(e => e.id === form.values.enseignant_id);
    const selectedPromotion = promotions?.find(p => p.id === form.values.promotion_id);

    // ============================================================
    // 2. EFFETS AUTOMATIQUES (Réinitialisation des sélections)
    // ============================================================

    // Quand le cycle change → on réinitialise module, matière et VH
    useEffect(() => {
        if (form.values.cycle_id) {
            form.setFieldValue("module_id", null);
            form.setFieldValue("matiere_id", null);
            form.setFieldValue("vhoraire", 0);
        }
    }, [form.values.cycle_id]);

    // Quand le module change → on réinitialise matière et VH
    useEffect(() => {
        if (form.values.module_id) {
            form.setFieldValue("matiere_id", null);
            form.setFieldValue("vhoraire", 0);
        }
    }, [form.values.module_id]);

    // Quand la matière change → on met à jour automatiquement le VH
    useEffect(() => {
        if (selectedMatiere?.vhoraire) {
            form.setFieldValue("vhoraire", selectedMatiere.vhoraire);
        }
    }, [selectedMatiere]);

    // ============================================================
    // 3. CALCULS DES MONTANTS (AFFICHÉS EN TEMPS RÉEL)
    // ============================================================

    const vhoraire = selectedMatiere?.vhoraire || 0;                           // Volume horaire de la matière
    const nbClasseCycle = selectedCycle?.nb_classe || 1;                      // Nombre total de classes du cycle
    const vhtDemande = (form.values.nb_classe || 1) * vhoraire;               // VHT = VH matière × nb classes demandé
    const vhtTotal = vhoraire * nbClasseCycle;                                // VHT total disponible dans le cycle

    // Cumul des VHT déjà utilisés pour cette matière ce mois-ci
    const cumulVHT = (vacations || [])
        .filter(v =>
            v.id !== editing?.id &&
            v.cycle_id === form.values.cycle_id &&
            v.module_id === form.values.module_id &&
            v.matiere_id === form.values.matiere_id &&
            v.annee === form.values.annee
        )
        .reduce((sum, v) => sum + (v.vht || 0), 0);

    const vhtRestant = vhtTotal - cumulVHT;                                   // VHT restant disponible
    const isVHTExceeded = vhtRestant < vhtDemande;                            // Vérifie si on dépasse le quota

    // Calculs financiers
    const taux = form.values.taux_horaire || 5000;
    const tauxRetenue = (form.values.taux_retenue || 2) / 100;
    const brut = vhtDemande * taux;
    const retenu = brut * tauxRetenue;
    const net = brut - retenu;

    // ============================================================
    // 4. GESTION DES CHANGEMENTS DE FORMULAIRE
    // ============================================================

    const handleCycleChange = (cycleId: number | null) => {
        form.setFieldValue("cycle_id", cycleId);
        form.setFieldValue("module_id", null);
        form.setFieldValue("matiere_id", null);
        form.setFieldValue("vhoraire", 0);
    };

    const handleModuleChange = (moduleId: number | null) => {
        form.setFieldValue("module_id", moduleId);
        form.setFieldValue("matiere_id", null);
        form.setFieldValue("vhoraire", 0);
    };

    const handleMatiereChange = (matiereId: number | null) => {
        const matiere = matieres.find(m => m.id === matiereId);
        form.setFieldValue("matiere_id", matiereId);
        if (matiere) {
            form.setFieldValue("vhoraire", matiere.vhoraire || 0);
        } else {
            form.setFieldValue("vhoraire", 0);
        }
    };

    // ============================================================
    // 5. SOUMISSION DU FORMULAIRE
    // ============================================================

    // ============================================================
    // 5. SOUMISSION DU FORMULAIRE - CORRIGÉ
    // ============================================================

    const handleSubmit = () => {
        const payload = {
            enseignant_id: form.values.enseignant_id,
            matiere_id: form.values.matiere_id,
            promotion_id: form.values.promotion_id,
            annee_scolaire_id: Number(form.values.annee_scolaire),
            nb_classe: form.values.nb_classe,
            mois: Number(form.values.mois),
            annee: form.values.annee,
            taux_horaire: form.values.taux_horaire || 5000,
            taux_retenue: form.values.taux_retenue || 2,
            // AJOUTER ces champs pour le calcul
            cycle_id: form.values.cycle_id,
            module_id: form.values.module_id,
        };
        console.log("📤 Payload soumis:", payload);
        onSubmit(payload);
    };

    // ============================================================
    // 6. DONNÉES POUR LES SÉLECTEURS
    // ============================================================

    const enseignantsData = (enseignants || [])
        .map(e => ({
            value: String(e.id ?? 0),
            label: `${e.prenom || ""} ${e.nom || ""}`.trim()
        }))
        .filter(e => e.label.length > 0);

    const cyclesData = (cycles || []).map(c => ({
        value: String(c.id ?? 0),
        label: c.designation || c.libelle || "Cycle"
    }));

    const modulesData = (modules || [])
        .filter(m => m.cycle_id === form.values.cycle_id)
        .map(m => ({
            value: String(m.id ?? 0),
            label: m.designation || "Module"
        }));

    const matieresData = (matieres || [])
        .filter(m => m.module_id === form.values.module_id)
        .map(m => ({
            value: String(m.id ?? 0),
            label: m.designation || "Matière",
            vhoraire: m.vhoraire || 0,
            coefficient: m.coefficient,
            observation: m.observation
        }));

    const promotionsData = (promotions || []).map(p => ({
        value: String(p.id ?? 0),
        label: p.libelle || p.designation || "Promotion"
    }));

    const moisData = [
        { value: "1", label: "Janvier" },
        { value: "2", label: "Février" },
        { value: "3", label: "Mars" },
        { value: "4", label: "Avril" },
        { value: "5", label: "Mai" },
        { value: "6", label: "Juin" },
        { value: "7", label: "Juillet" },
        { value: "8", label: "Août" },
        { value: "9", label: "Septembre" },
        { value: "10", label: "Octobre" },
        { value: "11", label: "Novembre" },
        { value: "12", label: "Décembre" }
    ];

    const formatNumber = (value: number | null | undefined): string => {
        return (value ?? 0).toLocaleString();
    };

    const getVHTStatusColor = () => {
        if (isVHTExceeded) return "red";
        if (vhtRestant === 0) return "orange";
        return "green";
    };

    // ============================================================
    // 7. AFFICHAGE DU CHARGEMENT
    // ============================================================

    if (isLoading) {
        return (
            <Modal opened={opened} onClose={onClose} title="Nouvelle vacation" size="xl" radius="md" padding="md">
                <Stack gap="sm">
                    <Skeleton height={60} radius="md" />
                    <Skeleton height={120} radius="md" />
                    <Skeleton height={80} radius="md" />
                    <Skeleton height={100} radius="md" />
                </Stack>
            </Modal>
        );
    }

    // ============================================================
    // 8. RENDU PRINCIPAL
    // ============================================================

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="xs">
                    <ThemeIcon variant="light" color="blue" size="md" radius="xl">
                        <IconCalculator size={18} />
                    </ThemeIcon>
                    <Text fw={600} size="md">
                        {editing ? "Modifier la vacation" : "Nouvelle vacation"}
                    </Text>
                </Group>
            }
            size="xl"
            radius="md"
            padding="md"
        >
            <Stack gap="xs">
                {/* ================================================ */}
                {/* SECTION 1 : ENSEIGNANT */}
                {/* ================================================ */}
                <Paper withBorder p="xs" radius="md" bg="gray.0">
                    <Group gap="xs" mb="xs">
                        <IconUser size={16} color="#228be6" />
                        <Text fw={500} size="xs" c="dimmed">ENSEIGNANT</Text>
                    </Group>
                    <Select
                        placeholder="Sélectionner un enseignant"
                        data={enseignantsData}
                        value={form.values.enseignant_id ? String(form.values.enseignant_id) : null}
                        onChange={(v) => form.setFieldValue("enseignant_id", Number(v))}
                        searchable
                        required
                        radius="md"
                        size="sm"
                        clearable
                    />
                    {selectedEnseignant && (
                        <Badge variant="light" color="blue" mt="xs" size="xs">
                            {selectedEnseignant.grade || selectedEnseignant.titre || "Enseignant"} - {selectedEnseignant.statut === "interne" ? "Interne" : "Externe"}
                        </Badge>
                    )}
                </Paper>

                {/* ================================================ */}
                {/* SECTION 2 : PÉDAGOGIQUE (Cycle → Module → Matière) */}
                {/* ================================================ */}
                <Paper withBorder p="xs" radius="md">
                    <Group gap="xs" mb="xs">
                        <IconBook size={16} color="#228be6" />
                        <Text fw={500} size="xs" c="dimmed">PÉDAGOGIQUE</Text>
                    </Group>
                    <Grid gutter="xs">
                        <Grid.Col span={6}>
                            <Select
                                label="Cycle"
                                placeholder="Sélectionner un cycle"
                                data={cyclesData}
                                value={form.values.cycle_id ? String(form.values.cycle_id) : null}
                                onChange={(v) => handleCycleChange(v ? Number(v) : null)}
                                required
                                radius="md"
                                size="sm"
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Module"
                                placeholder="Sélectionner un module"
                                data={modulesData}
                                value={form.values.module_id ? String(form.values.module_id) : null}
                                onChange={(v) => handleModuleChange(v ? Number(v) : null)}
                                required
                                radius="md"
                                size="sm"
                                disabled={!form.values.cycle_id}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Matière"
                                placeholder="Sélectionner une matière"
                                data={matieresData}
                                value={form.values.matiere_id ? String(form.values.matiere_id) : null}
                                onChange={(v) => handleMatiereChange(v ? Number(v) : null)}
                                searchable
                                nothingFoundMessage="Aucune matière trouvée"
                                required
                                radius="md"
                                size="sm"
                                disabled={!form.values.module_id}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Paper withBorder p="xs" radius="md" bg="blue.0">
                                <Stack gap={0}>
                                    <Text size="xs" c="dimmed" fw={500}>Volume horaire (VH) matière</Text>
                                    <Group align="baseline" gap={5}>
                                        <Text fw={700} size="xl" c="blue">{vhoraire}</Text>
                                        <Text size="sm" c="dimmed">heures</Text>
                                    </Group>
                                    {selectedMatiere && (
                                        <Text size="xs" c="dimmed" mt={5}>
                                            {selectedMatiere.designation}
                                        </Text>
                                    )}
                                    {!selectedMatiere && (
                                        <Text size="xs" c="dimmed" mt={5}>
                                            Aucune matière sélectionnée
                                        </Text>
                                    )}
                                </Stack>
                            </Paper>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Promotion"
                                placeholder="Sélectionner une promotion"
                                data={promotionsData}
                                value={form.values.promotion_id ? String(form.values.promotion_id) : null}
                                onChange={(v) => form.setFieldValue("promotion_id", Number(v))}
                                searchable
                                required
                                radius="md"
                                size="sm"
                                clearable
                            />
                            {selectedPromotion && (
                                <Text size="xs" c="dimmed" mt={3}>
                                    Année scolaire: {selectedPromotion.annee_scolaire || "Non définie"}
                                </Text>
                            )}
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <NumberInput
                                label="Nombre de classes"
                                placeholder="Classes"
                                value={form.values.nb_classe || 1}
                                onChange={(v) => form.setFieldValue("nb_classe", Number(v) || 1)}
                                min={1}
                                max={nbClasseCycle}
                                radius="md"
                                size="sm"
                                description={`Max: ${nbClasseCycle} classes`}
                            />
                        </Grid.Col>
                    </Grid>

                    {/* Informations supplémentaires sur la matière */}
                    {selectedMatiere && (selectedMatiere.coefficient || selectedMatiere.observation) && (
                        <SimpleGrid cols={2} spacing="xs" mt="xs">
                            {selectedMatiere.coefficient && (
                                <Card withBorder p="xs" bg="green.0" radius="md">
                                    <Text size="xs" c="dimmed" ta="center">Coefficient</Text>
                                    <Text fw={700} size="md" ta="center" c="green">{selectedMatiere.coefficient}</Text>
                                </Card>
                            )}
                            {selectedMatiere.observation && (
                                <Card withBorder p="xs" bg="orange.0" radius="md">
                                    <Text size="xs" c="dimmed" ta="center">Observation</Text>
                                    <Text size="xs" ta="center" c="dimmed" lineClamp={2}>{selectedMatiere.observation}</Text>
                                </Card>
                            )}
                        </SimpleGrid>
                    )}
                </Paper>

                {/* ================================================ */}
                {/* SECTION 3 : INDICATEURS DE VOLUME HORAIRE */}
                {/* ================================================ */}
                {selectedCycle && selectedMatiere && (
                    <SimpleGrid cols={4} spacing="xs">
                        <Card withBorder radius="md" p="4" bg="blue.0" style={{ padding: 6 }}>
                            <Stack gap={2} align="center">
                                <IconSchool size={12} color="#228be6" />
                                <Text size="10px" fw={600} c="dimmed">Classes</Text>
                                <Text fw={700} size="sm">{nbClasseCycle}</Text>
                            </Stack>
                        </Card>
                        <Card withBorder radius="md" p="4" bg="green.0" style={{ padding: 6 }}>
                            <Stack gap={2} align="center">
                                <IconClock size={12} color="#228be6" />
                                <Text size="10px" fw={600} c="dimmed">VH matière</Text>
                                <Text fw={700} size="sm">{vhoraire}h</Text>
                            </Stack>
                        </Card>
                        <Card withBorder radius="md" p="4" bg="orange.0" style={{ padding: 6 }}>
                            <Stack gap={2} align="center">
                                <IconChartBar size={12} color="#228be6" />
                                <Text size="10px" fw={600} c="dimmed">VHT total</Text>
                                <Text fw={700} size="sm">{vhtTotal.toFixed(0)}h</Text>
                            </Stack>
                        </Card>
                        <Card withBorder radius="md" p="4" bg={getVHTStatusColor() === "red" ? "red.0" : getVHTStatusColor() === "orange" ? "yellow.0" : "teal.0"} style={{ padding: 6 }}>
                            <Stack gap={2} align="center">
                                <IconInfoCircle size={12} />
                                <Text size="10px" fw={600} c="dimmed">VHT restant</Text>
                                <Text fw={700} size="sm" c={getVHTStatusColor()}>{Math.max(0, vhtRestant).toFixed(0)}h</Text>
                            </Stack>
                        </Card>
                    </SimpleGrid>
                )}

                {/* ================================================ */}
                {/* SECTION 4 : FINANCE ET PÉRIODE */}
                {/* ================================================ */}
                <Paper withBorder p="xs" radius="md">
                    <Grid gutter="xs">
                        <Grid.Col span={6}>
                            <Group gap="xs" mb="xs">
                                <IconCalculator size={14} color="#228be6" />
                                <Text fw={500} size="xs" c="dimmed">FINANCIER</Text>
                            </Group>
                            <NumberInput
                                label="Taux horaire"
                                placeholder="Taux"
                                value={form.values.taux_horaire || 5000}
                                onChange={(v) => form.setFieldValue("taux_horaire", Number(v) || 5000)}
                                min={0}
                                step={100}
                                radius="md"
                                size="sm"
                                leftSection="F"
                                mb="xs"
                            />
                            <NumberInput
                                label="Retenue (%)"
                                placeholder="%"
                                value={form.values.taux_retenue || 2}
                                onChange={(v) => form.setFieldValue("taux_retenue", Number(v) || 0)}
                                min={0}
                                max={100}
                                step={1}
                                radius="md"
                                size="sm"
                                rightSection="%"
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group gap="xs" mb="xs">
                                <IconCalendar size={14} color="#228be6" />
                                <Text fw={500} size="xs" c="dimmed">PÉRIODE</Text>
                            </Group>
                            <Select
                                label="Année scolaire"
                                placeholder="Année scolaire"
                                data={anneesScolairesList.map(a => ({
                                    value: String(a.id),
                                    label: a.libelle
                                }))}
                                value={form.values.annee_scolaire ? String(form.values.annee_scolaire) : null}
                                onChange={(v) => form.setFieldValue("annee_scolaire", v)}
                                radius="md"
                                size="sm"
                                mb="xs"
                                required
                            />
                            <NumberInput
                                label="Année"
                                placeholder="Année"
                                value={form.values.annee || new Date().getFullYear()}
                                onChange={(v) => form.setFieldValue("annee", Number(v) || new Date().getFullYear())}
                                min={2000}
                                max={2100}
                                radius="md"
                                size="sm"
                                mb="xs"
                            />
                            <Select
                                label="Mois"
                                placeholder="Mois"
                                data={moisData}
                                value={form.values.mois ? String(form.values.mois) : null}
                                onChange={(v) => form.setFieldValue("mois", v)}
                                radius="md"
                                size="sm"
                                required
                                clearable
                            />
                        </Grid.Col>
                    </Grid>
                </Paper>

                {/* ================================================ */}
                {/* SECTION 5 : RÉSUMÉ DES MONTANTS */}
                {/* ================================================ */}
                {selectedMatiere && (
                    <Card withBorder radius="md" p="xs" bg="gray.0">
                        <Grid gutter="xs" align="center">
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">VHT demandé</Text>
                                    <Text fw={700} size="sm">{vhtDemande.toFixed(0)}h</Text>
                                </Stack>
                            </Grid.Col>
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">Brut</Text>
                                    <Text fw={700} size="sm">{formatNumber(brut)} F</Text>
                                </Stack>
                            </Grid.Col>
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">Retenue ({form.values.taux_retenue || 2}%)</Text>
                                    <Text fw={700} size="sm">{formatNumber(retenu)} F</Text>
                                </Stack>
                            </Grid.Col>
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">Net à payer</Text>
                                    <Text fw={700} size="sm" c="green">{formatNumber(net)} F</Text>
                                </Stack>
                            </Grid.Col>
                        </Grid>

                        {/* Message d'alerte si dépassement du volume horaire */}
                        {isVHTExceeded && (
                            <Alert variant="light" color="red" icon={<IconAlertCircle size={12} />} p="4" mt="xs">
                                <Text size="xs">
                                    ⚠️ Volume horaire insuffisant !
                                    VHT demandé: {vhtDemande.toFixed(0)}h,
                                    VHT restant: {Math.max(0, vhtRestant).toFixed(0)}h
                                </Text>
                            </Alert>
                        )}

                        {/* Message d'information si tout est ok */}
                        {!isVHTExceeded && selectedMatiere && vhtRestant > 0 && (
                            <Alert variant="light" color="green" icon={<IconInfoCircle size={12} />} p="4" mt="xs">
                                <Text size="xs">
                                    ✅ Volume horaire suffisant.
                                    Il reste {Math.max(0, vhtRestant).toFixed(0)}h disponibles sur le cycle.
                                </Text>
                            </Alert>
                        )}
                    </Card>
                )}

                {/* ================================================ */}
                {/* SECTION 6 : BOUTONS D'ACTION */}
                {/* ================================================ */}

                {/* Bouton "Calculer les montants" - Optionnel, les calculs sont déjà en temps réel */}
                {onCalculate && (
                    <Button
                        variant="light"
                        onClick={onCalculate}
                        loading={calculating}
                        leftSection={<IconCalculator size={16} />}
                        fullWidth
                        radius="md"
                        size="sm"
                    >
                        Vérifier la vacation
                    </Button>
                )}

                {/* Résultats du calcul sécurisé (si fourni par le parent) */}
                {calculatedValues && (
                    <Paper withBorder p="xs" radius="md" bg={calculatedValues.global_ok ? "green.0" : "red.0"}>
                        <Stack gap={4}>
                            <Group justify="space-between">
                                <Text size="xs" fw={600} c={calculatedValues.global_ok ? "green" : "red"}>
                                    {calculatedValues.global_ok ? "✅" : "❌"} {calculatedValues.global_ok ? "Vacation valide" : "Vacation invalide"}
                                </Text>
                                <Badge size="xs" color={calculatedValues.global_ok ? "green" : "red"}>
                                    {calculatedValues.global_ok ? "OK" : "KO"}
                                </Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                                {calculatedValues.message?.substring(0, 150)}
                            </Text>
                        </Stack>
                    </Paper>
                )}

                {/* Bouton d'enregistrement - Désactivé si VHT insuffisant */}
                <Group justify="flex-end" mt="xs">
                    <Button variant="light" onClick={onClose} radius="md" size="sm">
                        Annuler
                    </Button>
                    <Tooltip label={
                        !form.values.matiere_id ? "Veuillez sélectionner une matière" :
                            isVHTExceeded ? `Volume horaire insuffisant (demande: ${vhtDemande}h, restant: ${Math.max(0, vhtRestant)}h)` :
                                "Enregistrer la vacation"
                    }>
                        <Button
                            onClick={handleSubmit}
                            disabled={isVHTExceeded || !form.values.enseignant_id || !form.values.matiere_id || !form.values.promotion_id || !form.values.annee_scolaire || isLoading}
                            loading={isLoading}
                            radius="md"
                            size="sm"
                            variant="gradient"
                            gradient={{ from: 'blue', to: 'cyan' }}
                        >
                            {editing ? "Mettre à jour" : "Enregistrer"}
                        </Button>
                    </Tooltip>
                </Group>

                {/* Message explicatif du flux de travail */}
                <Text size="xs" c="dimmed" ta="center" mt="xs">
                    💡 Les montants sont calculés automatiquement.
                    Le bouton "Enregistrer" n'est actif que si le volume horaire est suffisant.
                </Text>
            </Stack>
        </Modal>
    );
}