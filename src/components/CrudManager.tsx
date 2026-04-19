import { useState } from "react";
import {
  Table,
  Button,
  Modal,
  TextInput,
  Group,
  ActionIcon,
  Paper,
  Text,
  Stack,
  LoadingOverlay,
  Box,
  Select,
  Pagination,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconTrash, IconSearch } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ================= TYPES =================
interface ExtraData {
  cycleFilter?: string;
  setCycleFilter?: (v: string | null) => void;
  moduleFilter?: string;
  setModuleFilter?: (v: string | null) => void;
  cycles?: any[];
  modules?: any[];
  transformData?: (values: any) => any;
  searchCommand?: string;
  customCommands?: {
    get?: string;
    create?: string;
    update?: string;
    delete?: string;
    search?: string;
  };
  additionalValidate?: Record<string, (value: any) => string | null>;
}

interface ManagerProps<T> {
  title: string;
  entity: string;
  columns: string[];
  renderRow: (item: T, index: number) => React.ReactNode[];
  formFields: (form: any, extraData?: ExtraData) => React.ReactNode;
  initialValues: any;
  validate?: any;
  extraData?: ExtraData;
  transformData?: (values: any) => any;
  useSearch?: boolean;
  usePagination?: boolean;
  itemsPerPageOptions?: string[];
}

// ================= COMPONENT =================
function CrudManager<T extends { id: number }>({
  title,
  entity,
  columns,
  renderRow,
  formFields,
  initialValues,
  validate,
  extraData,
  transformData,
  useSearch = true,
  usePagination = true,
  itemsPerPageOptions = ['10', '25', '50', '100'],
}: ManagerProps<T>) {
  const queryClient = useQueryClient();

  const singular = entity.endsWith('s') ? entity.slice(0, -1) : entity;

  // ================= STATE =================
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ================= COMMAND MAPPING =================
  const getCommandName = (type: 'get' | 'create' | 'update' | 'delete' | 'search') => {
    if (extraData?.customCommands && extraData.customCommands[type]) {
      return extraData.customCommands[type]!;
    }

    const commandMap: Record<string, Record<string, string>> = {
      get: {
        'annees_scolaires': 'get_annees_scolaires',
        'promotions': 'get_promotions',
        'cycles': 'get_cycles',
        'modules': 'get_modules',
        'matieres': 'get_matieres',
        'enseignants': 'get_enseignants',
        'banques': 'get_banques',
        'comptes_bancaires': 'get_comptes_bancaires',
        'plafonds': 'get_plafonds',
        'vacations': 'get_vacations',
        'ordres_virement': 'get_ordres_virement',
      },
      create: {
        'annees_scolaires': 'create_annee_scolaire',
        'promotions': 'create_promotion',
        'cycles': 'create_cycle',
        'modules': 'create_module',
        'matieres': 'create_matiere',
        'enseignants': 'create_enseignant',
        'banques': 'create_banque',
        'comptes_bancaires': 'create_compte_bancaire',
        'plafonds': 'create_plafond',
        'vacations': 'create_vacation',
        'ordres_virement': 'create_ordre_virement',
      },
      update: {
        'annees_scolaires': 'update_annee_scolaire',
        'promotions': 'update_promotion',
        'cycles': 'update_cycle',
        'modules': 'update_module',
        'matieres': 'update_matiere',
        'enseignants': 'update_enseignant',
        'banques': 'update_banque',
        'comptes_bancaires': 'update_compte_bancaire',
        'plafonds': 'update_plafond',
        'vacations': 'update_vacation',
        'ordres_virement': 'update_ordre_virement',
      },
      delete: {
        'annees_scolaires': 'delete_annee_scolaire',
        'promotions': 'delete_promotion',
        'cycles': 'delete_cycle',
        'modules': 'delete_module',
        'matieres': 'delete_matiere',
        'enseignants': 'delete_enseignant',
        'banques': 'delete_banque',
        'comptes_bancaires': 'delete_compte_bancaire',
        'plafonds': 'delete_plafond',
        'vacations': 'delete_vacation',
        'ordres_virement': 'delete_ordre_virement',
      },
      search: {
        'promotions': 'search_promotions',
        'enseignants': 'search_enseignants',
        'matieres': 'search_matieres',
        'modules': 'search_modules',
      }
    };

    if (commandMap[type] && commandMap[type][entity]) {
      return commandMap[type][entity];
    }

    const defaultCommands: Record<string, string> = {
      get: `get_${entity}`,
      create: `create_${singular}`,
      update: `update_${singular}`,
      delete: `delete_${singular}`,
      search: `search_${entity}`,
    };

    return defaultCommands[type] || `get_${entity}`;
  };

  // ================= FETCH DATA =================
  const {
    data: rawData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [entity, search],
    queryFn: async () => {
      console.log(`📡 Fetching ${entity}...`);

      if (useSearch && search.trim().length > 0) {
        const searchCommand = extraData?.searchCommand || getCommandName('search');
        try {
          console.log(`🔍 Searching ${entity} with:`, search);
          const result = await invoke(searchCommand, { search: search.trim() });
          console.log(`✅ Search result:`, result);
          return Array.isArray(result) ? result : [];
        } catch (e) {
          console.warn("Search failed, falling back to get all", e);
          const result = await invoke(getCommandName('get'));
          return Array.isArray(result) ? result : [];
        }
      }

      const result = await invoke(getCommandName('get'));
      console.log(`✅ Fetched ${entity}:`, result);
      return Array.isArray(result) ? result : [];
    },
  });

  const data = Array.isArray(rawData) ? rawData : [];

  // ================= FILTRAGE LOCAL =================
  const filteredData = !useSearch || search.trim().length === 0
    ? data.filter((item: T) =>
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    : data;

  // ================= PAGINATION =================
  const totalPages = usePagination ? Math.ceil(filteredData.length / itemsPerPage) : 1;
  const paginatedData = usePagination
    ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredData;

  // ================= FORM =================
  const mergedValidate = {
    ...validate,
    ...extraData?.additionalValidate,
  };

  const form = useForm({
    initialValues,
    validate: mergedValidate,
    validateInputOnBlur: true,
  });

  // ================= ACTIONS =================
  const openCreate = () => {
    console.log("📝 Opening create modal");
    setEditing(null);
    form.setValues(initialValues);
    form.resetDirty();
    setModal(true);
  };

  const openEdit = (item: T) => {
    console.log("✏️ Opening edit modal for:", item);
    setEditing(item);
    form.setValues(item);
    form.resetDirty();
    setModal(true);
  };

  // ================= SUBMIT =================
  const handleSubmit = async (values: any) => {
    console.log("📤 Submitting form...", { editing, values });

    try {
      let dataToSend = values;
      const transform = transformData || extraData?.transformData;

      if (transform) {
        dataToSend = transform(values);
        console.log("🔄 Transformed data:", dataToSend);
      }

      // Nettoyer les données (enlever les champs undefined)
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === undefined) {
          delete dataToSend[key];
        }
      });

      if (editing) {
        // Mise à jour - envoyer les champs directement
        const updatePayload = {
          id: editing.id,
          ...dataToSend
        };
        console.log(`📡 Calling ${getCommandName('update')} with:`, updatePayload);
        await invoke(getCommandName('update'), updatePayload);

        notifications.show({
          title: "Succès",
          message: `${title} modifié${title.endsWith('e') ? 'e' : ''} avec succès`,
          color: "green",
        });
      } else {
        // Création - envoyer les champs directement
        console.log(`📡 Calling ${getCommandName('create')} with:`, dataToSend);
        await invoke(getCommandName('create'), dataToSend);

        notifications.show({
          title: "Succès",
          message: `${title} créé${title.endsWith('e') ? 'e' : ''} avec succès`,
          color: "green",
        });
      }

      setModal(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: [entity] });
      refetch();

    } catch (e: any) {
      console.error("❌ Submit error:", e);
      notifications.show({
        title: "Erreur",
        message: e.toString() || "Une erreur est survenue",
        color: "red",
      });
    }
  };

  // ================= DELETE =================
  const confirmDelete = async () => {
    if (!deleteId) return;

    console.log(`🗑️ Deleting ${entity} with id:`, deleteId);

    try {
      setDeleteLoading(true);

      await invoke(getCommandName('delete'), { id: deleteId });
      console.log(`✅ Deleted successfully`);

      notifications.show({
        title: "Succès",
        message: `${title} supprimé${title.endsWith('e') ? 'e' : ''} avec succès`,
        color: "green",
      });

      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: [entity] });
      refetch();

    } catch (e: any) {
      console.error("❌ Delete error:", e);
      notifications.show({
        title: "Erreur",
        message: e.toString() || "Impossible de supprimer",
        color: "red",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ================= RENDU =================
  return (
    <Box pos="relative">
      <LoadingOverlay visible={isLoading} zIndex={1000} />

      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">{title}</Text>
        <Button onClick={openCreate}>Ajouter</Button>
      </Group>

      {useSearch && (
        <TextInput
          placeholder="Rechercher..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setCurrentPage(1);
          }}
          mb="md"
          rightSection={
            search && (
              <ActionIcon
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                size="sm"
              >
                <IconTrash size={14} />
              </ActionIcon>
            )
          }
        />
      )}

      <Paper withBorder radius="md" p="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 60 }}>N°</Table.Th>
              {columns.map((c) => (
                <Table.Th key={c}>{c}</Table.Th>
              ))}
              <Table.Th style={{ width: 100 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {paginatedData.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length + 2} style={{ textAlign: "center" }}>
                  <Text c="dimmed" py="xl">Aucune donnée trouvée</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              paginatedData.map((item: T, index: number) => {
                const globalIndex = usePagination
                  ? (currentPage - 1) * itemsPerPage + index + 1
                  : index + 1;
                return (
                  <Table.Tr key={item.id}>
                    <Table.Td>{globalIndex}</Table.Td>
                    {renderRow(item, index).map((cell, i) => (
                      <Table.Td key={i}>{cell}</Table.Td>
                    ))}
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => openEdit(item)}
                          aria-label="Modifier"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteId(item.id)}
                          aria-label="Supprimer"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {usePagination && totalPages > 1 && (
        <Group justify="space-between" mt="md">
          <Select
            label="Lignes par page"
            value={itemsPerPage.toString()}
            onChange={(val) => {
              setItemsPerPage(Number(val));
              setCurrentPage(1);
            }}
            data={itemsPerPageOptions}
            style={{ width: 150 }}
          />
          <Pagination
            value={currentPage}
            onChange={setCurrentPage}
            total={totalPages}
          />
        </Group>
      )}

      {/* MODAL FORMULAIRE */}
      <Modal
        opened={modal}
        onClose={() => {
          setModal(false);
          form.reset();
        }}
        title={editing ? `Modifier ${title}` : `Ajouter ${title}`}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {formFields(form, extraData)}
          </Stack>

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => {
              setModal(false);
              form.reset();
            }}>
              Annuler
            </Button>
            <Button type="submit" loading={form.submitting}>
              {editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </Group>
        </form>
      </Modal>

      {/* MODAL CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmation"
        centered
      >
        <Stack>
          <Text>Êtes-vous sûr de vouloir supprimer cet élément ?</Text>
          <Text size="sm" c="dimmed">Cette action est irréversible.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default CrudManager;