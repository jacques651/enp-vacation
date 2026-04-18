import { TextInput } from '@mantine/core';
import CrudManager from '../../components/CrudManager';

// ================= TYPES =================
// Correspond exactement à la structure Rust de AnneeScolaire
export interface AnneeScolaire {
  id: number;
  libelle: string;
}

// ================= VALIDATION =================
// Validation du format "YYYY-YYYY" (ex: 2025-2026)
const validateAnneeScolaire = (libelle: string): string | null => {
  if (!libelle || libelle.trim().length === 0) {
    return 'Le libellé est requis';
  }

  // Vérifier le format avec regex
  const regex = /^\d{4}-\d{4}$/;
  if (!regex.test(libelle)) {
    return 'Format invalide. Utilisez le format YYYY-YYYY (ex: 2025-2026)';
  }

  // Vérifier que les années sont consécutives
  const [debut, fin] = libelle.split('-').map(Number);
  if (fin !== debut + 1) {
    return 'Les années doivent être consécutives (ex: 2025-2026)';
  }

  // Vérifier que les années sont raisonnables
  const currentYear = new Date().getFullYear();
  if (debut < 2000 || debut > currentYear + 10) {
    return `L'année de début doit être entre 2000 et ${currentYear + 10}`;
  }

  return null;
};

// ================= COMPONENT =================

function AnneesScolairesManager() {
  return (
    <CrudManager<AnneeScolaire>
      title="Années Scolaires"
      entity="annees_scolaires"

      columns={['ID', 'Libellé']}

      renderRow={(a) => [
        a.id,
        a.libelle,
      ]}

      initialValues={{
        libelle: '',
      }}

      validate={{
        libelle: validateAnneeScolaire,
      }}

      transformData={(values) => ({
        libelle: values.libelle.trim(),
      })}

      formFields={(form) => (
        <TextInput
          label="Année Scolaire"
          placeholder="Ex: 2025-2026"
          withAsterisk
          description="Format: YYYY-YYYY (années consécutives)"
          {...form.getInputProps('libelle')}
        />
      )}
    />
  );
}

export default AnneesScolairesManager;