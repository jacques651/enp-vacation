import { Modal, Grid, Select, NumberInput, Button, Card, Text, Group, Badge, Stack, ThemeIcon, Paper, Alert, Tooltip, Skeleton, SimpleGrid } from "@mantine/core";
import { IconInfoCircle, IconAlertCircle, IconCalculator, IconUser, IconBook, IconCalendar, IconChartBar, IconClock, IconSchool } from "@tabler/icons-react";
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

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

    // Récupération des années scolaires depuis le backend
    const { data: anneesScolairesList = [] } = useQuery<AnneeScolaire[]>({
        queryKey: ['annees_scolaires'],
        queryFn: () => invoke('get_annees_scolaires'),
    });

    const selectedMatiere = matieres?.find(m => m.id === form.values.matiere_id);
    const selectedCycle = cycles?.find(c => c.id === form.values.cycle_id);
    const selectedEnseignant = enseignants?.find(e => e.id === form.values.enseignant_id);
    const selectedPromotion = promotions?.find(p => p.id === form.values.promotion_id);

    const vhoraire = selectedMatiere?.vhoraire || 0;
    const nbClasseCycle = selectedCycle?.nb_classe || 1;
    const vhtDemande = (form.values.nb_classe || 1) * vhoraire;
    const vhtTotal = vhoraire * nbClasseCycle;

    const cumulVHT = (vacations || [])
        .filter(v =>
            v.id !== editing?.id &&
            v.cycle_id === form.values.cycle_id &&
            v.module_id === form.values.module_id &&
            v.matiere_id === form.values.matiere_id &&
            v.annee === form.values.annee
        )
        .reduce((sum, v) => sum + (v.vht || 0), 0);

    const vhtRestant = vhtTotal - cumulVHT;

    const taux = form.values.taux_horaire || 5000;
    const tauxRetenue = (form.values.taux_retenue || 2) / 100;

    const brut = vhtDemande * taux;
    const retenu = brut * tauxRetenue;
    const net = brut - retenu;

    const isVHTExceeded = vhtRestant < vhtDemande;

    const getVHTStatusColor = () => {
        if (isVHTExceeded) return "red";
        if (vhtRestant === 0) return "orange";
        return "green";
    };

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
            label: m.designation || "Matière"
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

    // Fonction de soumission avec transformation backend
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
        };
        onSubmit(payload);
    };

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
                {/* Enseignant */}
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

                {/* Pédagogique */}
                <Paper withBorder p="xs" radius="md">
                    <Group gap="xs" mb="xs">
                        <IconBook size={16} color="#228be6" />
                        <Text fw={500} size="xs" c="dimmed">PÉDAGOGIQUE</Text>
                    </Group>
                    <Grid gutter="xs">
                        <Grid.Col span={6}>
                            <Select
                                label="Cycle"
                                placeholder="Cycle"
                                data={cyclesData}
                                value={form.values.cycle_id ? String(form.values.cycle_id) : null}
                                onChange={(v) => {
                                    const val = v ? Number(v) : 0;
                                    form.setFieldValue("cycle_id", val);
                                    form.setFieldValue("module_id", 0);
                                    form.setFieldValue("matiere_id", 0);
                                }}
                                required
                                radius="md"
                                size="sm"
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Module"
                                placeholder="Module"
                                data={modulesData}
                                value={form.values.module_id ? String(form.values.module_id) : null}
                                onChange={(v) => {
                                    const val = v ? Number(v) : 0;
                                    form.setFieldValue("module_id", val);
                                    form.setFieldValue("matiere_id", 0);
                                }}
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
                                placeholder="Matière"
                                data={matieresData}
                                value={form.values.matiere_id ? String(form.values.matiere_id) : null}
                                onChange={(v) => form.setFieldValue("matiere_id", Number(v))}
                                searchable
                                required
                                radius="md"
                                size="sm"
                                disabled={!form.values.module_id}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Promotion"
                                placeholder="Promotion"
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
                                label="Nb classes"
                                placeholder="Classes"
                                value={form.values.nb_classe || nbClasseCycle}
                                onChange={(v) => form.setFieldValue("nb_classe", Number(v) || nbClasseCycle)}
                                min={1}
                                max={nbClasseCycle}
                                radius="md"
                                size="sm"
                                description={`Max: ${nbClasseCycle} classes`}
                            />
                        </Grid.Col>
                    </Grid>
                </Paper>

                {/* Cartes d'informations compactes */}
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

                {/* Finance et période */}
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

                {/* Résumé des montants */}
                {selectedMatiere && (
                    <Card withBorder radius="md" p="xs" bg="gray.0">
                        <Grid gutter="xs" align="center">
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">VHT</Text>
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
                                    <Text size="10px" c="dimmed">Retenue</Text>
                                    <Text fw={700} size="sm">{formatNumber(retenu)} F</Text>
                                </Stack>
                            </Grid.Col>
                            <Grid.Col span={3}>
                                <Stack gap={2} align="center">
                                    <Text size="10px" c="dimmed">Net</Text>
                                    <Text fw={700} size="sm" c="green">{formatNumber(net)} F</Text>
                                </Stack>
                            </Grid.Col>
                        </Grid>

                        {isVHTExceeded && (
                            <Alert variant="light" color="red" icon={<IconAlertCircle size={12} />} p="4" mt="xs">
                                <Text size="xs">Volume horaire insuffisant ! Restant: {Math.max(0, vhtRestant).toFixed(0)}h</Text>
                            </Alert>
                        )}
                    </Card>
                )}

                {/* Bouton Calculer */}
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
                        Calculer les montants
                    </Button>
                )}

                {/* Résultats du calcul sécurisé */}
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

                {/* Boutons */}
                <Group justify="flex-end" mt="xs">
                    <Button variant="light" onClick={onClose} radius="md" size="sm">
                        Annuler
                    </Button>
                    <Tooltip label={isVHTExceeded ? "Volume horaire insuffisant" : "Enregistrer"}>
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
            </Stack>
        </Modal>
    );
}