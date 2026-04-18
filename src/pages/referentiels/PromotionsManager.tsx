import { TextInput } from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import CrudManager from '../../components/CrudManager';

// ================= TYPES =================
// Correspond exactement à la structure Rust de Promotion
export interface Promotion {
  id: number;
  libelle: string;
}

// ================= COMPONENT =================

function PromotionsManager() {
  return (
    <CrudManager<Promotion>
      title="Promotions"
      entity="promotions"

      columns={['ID', 'Libellé']}

      renderRow={(p) => [
        p.id,
        p.libelle,
      ]}

      initialValues={{
        libelle: '',
      }}

      validate={{
        libelle: (v: string) => {
          if (!v) return 'Le libellé est requis';
          if (v.trim().length === 0) return 'Le libellé ne peut pas être vide';
          return null;
        },
      }}

      transformData={(values) => ({
        libelle: values.libelle.trim(),
      })}

      formFields={(form) => (
        <TextInput
          label="Libellé"
          placeholder="Ex: 55ème promotion"
          withAsterisk
          description="Libellé de la promotion (obligatoire)"
          {...form.getInputProps('libelle')}
        />
      )}
    />
  );
}

export default PromotionsManager;