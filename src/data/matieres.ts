export interface Matiere {
  id: number;
  designation: string;
  module_id: number;
  vhoraire: number | null;   // ✅ autorise null
  coefficient: number | null; // ✅ autorise null
  observation: string;
}

