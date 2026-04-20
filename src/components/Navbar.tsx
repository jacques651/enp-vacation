import {
  Stack,
  Text,
  useMantineTheme,
  Box,
  Divider,
} from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconCalendar,
  IconFileText,
  IconDatabase,
  IconTransfer,
  IconChartBar,
  
} from '@tabler/icons-react';

function NavItem({
  label,
  path,
  icon,
}: {
  label: string;
  path: string;
  icon?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();

  const active =
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const lightBlue = theme.colors.adminBlue?.[5] || '#799bba';
  const hoverBlue = theme.colors.adminBlue?.[6] || '#5c85ad';
  const yellow = theme.colors.yellow?.[4] || '#e6e600';

  return (
    <Box
      onClick={() => navigate(path)}
      style={{
        cursor: 'pointer',
        padding: '10px 12px',
        borderRadius: theme.radius.sm,
        backgroundColor: active ? lightBlue : 'transparent',
        color: yellow,
        fontWeight: active ? 600 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = hoverBlue;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
      <Text size="sm">{label}</Text>
    </Box>
  );
}

function SectionTitle({ label }: { label: string }) {
  const theme = useMantineTheme();

  return (
    <Text
      mt="md"
      mb="xs"
      fw={600}
      size="xs"
      c={theme.colors.gray[4]}
      style={{
        letterSpacing: '1px',
      }}
    >
      {label}
    </Text>
  );
}

export default function Navbar() {
  const theme = useMantineTheme();
  const darkBlue = theme.colors.adminBlue?.[8] || '#1b365d';

  return (
    <Stack
      p="md"
      style={{
        height: '100%',
        backgroundColor: darkBlue,
      }}
      justify="space-between"
    >
      {/* TOP */}
      <Stack gap="xs">
        {/* Logo */}
        <Text
          fw={700}
          size="lg"
          c="yellow"
          style={{ fontFamily: 'Times New Roman', textAlign: 'center' }}
        >
          ENP VACATIONS
        </Text>

        <Divider color={theme.colors.adminBlue?.[6]} />

        {/* SECTION DASHBOARD */}
        <SectionTitle label="TABLEAU DE BORD" />
        <NavItem
          label="Dashboard"
          path="/"
          icon={<IconLayoutDashboard size={18} />}
        />
        <Divider color={theme.colors.adminBlue?.[6]} />

        {/* SECTION GESTION DES VACATIONS */}
        <SectionTitle label="GESTION DES VACATIONS" />
        <NavItem
          label="Gestion des vacations"
          path="/vacations"
          icon={<IconCalendar size={18} />}
        />

        <Divider color={theme.colors.adminBlue?.[6]} />

        {/* SECTION RÉFÉRENTIELS */}
        <SectionTitle label="RÉFÉRENTIELS" />

        <NavItem
          label="Gestion des référentiels"
          path="/referentiels"
          icon={<IconDatabase size={18} />}
        />

        <Divider color={theme.colors.adminBlue?.[6]} />

        {/* SECTION FINANCES */}
        <SectionTitle label="Gestion des finances" />
        <NavItem
          label="État de liquidation"
          path="/etat"
          icon={<IconFileText size={18} />}
        />

        <NavItem
          label="Ordres de virement"
          path="/ordres"
          icon={<IconTransfer size={18} />}
        />
        <NavItem
          label="Cumuls annuels"
          path="/cumuls"
          icon={<IconChartBar size={18} />}
        />

        <Divider color={theme.colors.adminBlue?.[6]} />

      </Stack>

      {/* FOOTER */}
      <Stack gap="xs">
        <Divider color={theme.colors.adminBlue?.[6]} />
        <Text size="xs" c="dimmed" ta="center">
          © 2026 ENP Gestion des Vacations. Tous droits réservés.
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          Version 1.0.0
        </Text>
      </Stack>
    </Stack>
  );
}