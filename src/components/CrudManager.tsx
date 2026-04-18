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
  searchCommand?: string; // Pour les commandes de recherche personnalisées
  customCommands?: {
    get?: string;
    create?: string;
    update?: string;
    delete?: string;
    search?: string;
  };
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
  useSearch?: boolean; // Activer/désactiver la recherche
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
}: ManagerProps<T>) {
  const queryClient = useQueryClient();

  const singular = entity.endsWith("s") ? entity.slice(0, -1) : entity;

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
    // Utiliser les commandes personnalisées si fournies
    if (extraData?.customCommands && extraData.customCommands[type]) {
      return extraData.customCommands[type]!;
    }

    // Mapping par défaut
    const commandMap: Record<string, Record<string, string>> = {
      get: {
        'enseignants': 'get_enseignants',
        'cycles': 'get_cycles',
        'modules': 'get_modules',
        'matieres': 'get_matieres',
        'banques': 'get_banques',
        'promotions': 'get_promotions',
        'plafonds': 'get_plafonds',
        'entete': 'get_entetes',
      },
      create: {
        'entete': 'set_entete_value', // Cas spécial pour entete (UPSERT)
      },
      update: {
        'entete': 'set_entete_value', // Cas spécial pour entete (UPSERT)
      },
      delete: {
        'entete': 'delete_entete',
      },
      search: {
        'promotions': 'search_promotions',
      }
    };

    if (type === 'get') {
      return commandMap.get[entity] || `get_${entity}`;
    }
    if (type === 'create') {
      return commandMap.create[entity] || `create_${singular}`;
    }
    if (type === 'update') {
      return commandMap.update[entity] || `update_${singular}`;
    }
    if (type === 'delete') {
      return commandMap.delete[entity] || `delete_${singular}`;
    }
    if (type === 'search') {
      return commandMap.search[entity] || `search_${entity}`;
    }
    
    return `get_${entity}`;
  };

  // ================= FETCH DATA =================
  const {
    data: rawData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [entity, search],
    queryFn: async () => {
      // Utiliser la recherche si activée et si terme de recherche
      if (useSearch && search.trim().length > 0) {
        const searchCommand = extraData?.searchCommand || getCommandName('search');
        try {
          const result = await invoke(searchCommand, { search: search.trim() });
          return Array.isArray(result) ? result : [];
        } catch (e) {
          console.warn("Search failed, falling back to get all", e);
          // Fallback: récupérer tous les éléments
          const result = await invoke(getCommandName('get'));
          return Array.isArray(result) ? result : [];
        }
      }
      
      // Récupération normale
      const result = await invoke(getCommandName('get'));
      return Array.isArray(result) ? result : [];
    },
  });

  const data = Array.isArray(rawData) ? rawData : [];

  // ================= FILTRAGE LOCAL (si pas de recherche backend) =================
  const filteredData = !useSearch || search.trim().length === 0
    ? data.filter((item: T) =>
        Object.values(item)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : data;

  // ================= PAGINATION =================
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ================= FORM =================
  const form = useForm({ 
    initialValues, 
    validate,
    validateInputOnBlur: true,
  });

  // ================= ACTIONS =================
  const openCreate = () => {
    setEditing(null);
    form.setValues(initialValues);
    form.resetDirty();
    setModal(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    form.setValues(item);
    form.resetDirty();
    setModal(true);
  };

  // ================= SUBMIT =================
  const handleSubmit = async (values: any) => {
    try {
      let dataToSend = values;
      const transform = transformData || extraData?.transformData;

      if (transform) {
        dataToSend = transform(values);
      }

      const isEntete = entity === 'entete';
      
      if (editing) {
        // Cas spécial pour UPSERT (entete)
        if (isEntete) {
          await invoke(getCommandName('update'), {
            cle: editing.id, // Pour entete, l'ID est en fait la clé
            valeur: dataToSend.valeur,
          });
        } else {
          await invoke(getCommandName('update'), {
            id: editing.id,
            data: dataToSend,
          });
        }
        notifications.show({
          title: "Succès",
          message: `${title} modifié avec succès`,
          color: "green",
        });
      } else {
        // Création
        if (isEntete) {
          await invoke(getCommandName('create'), {
            cle: dataToSend.cle,
            valeur: dataToSend.valeur,
          });
        } else {
          await invoke(getCommandName('create'), {
            data: dataToSend,
          });
        }
        notifications.show({
          title: "Succès",
          message: `${title} créé avec succès`,
          color: "green",
        });
      }

      setModal(false);
      await queryClient.invalidateQueries({ queryKey: [entity] });
      refetch();

    } catch (e: any) {
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

    try {
      setDeleteLoading(true);
      
      const isEntete = entity === 'entete';
      if (isEntete) {
        await invoke(getCommandName('delete'), { id: deleteId });
      } else {
        await invoke(getCommandName('delete'), { id: deleteId });
      }

      notifications.show({
        title: "Succès",
        message: `${title} supprimé avec succès`,
        color: "green",
      });

      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: [entity] });
      refetch();

    } catch (e: any) {
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
          __clearable
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
                <Table.Td colSpan={columns.length + 2} align="center">
                  <Text c="dimmed" py="xl">Aucune donnée trouvée</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              paginatedData.map((item: T, index: number) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
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
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon 
                          variant="subtle" 
                          color="red" 
                          onClick={() => setDeleteId(item.id)}
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

      {totalPages > 1 && (
        <Group justify="space-between" mt="md">
          <Select
            label="Lignes par page"
            value={itemsPerPage.toString()}
            onChange={(val) => {
              setItemsPerPage(Number(val));
              setCurrentPage(1);
            }}
            data={['10', '25', '50', '100']}
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