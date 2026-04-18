// src/hooks/useDashboard.ts
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface DashboardStats {
  totalVacationsMois: number;
  totalNetMois: number;
  totalEnseignants: number;
  totalMatieres: number;
  vacationsParMois: { mois: string; total: number }[];
  repartitionStatut: { statut: string; count: number }[];
  dernieresVacations: {
    id: number;
    enseignant: string;
    matiere: string;
    net: number;
    date: string;
  }[];
}

export function useDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<DashboardStats>('get_dashboard_stats')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}