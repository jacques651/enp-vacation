import {
  Stack,
  Text,
  useMantineTheme,
  Box,
  Divider,
} from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconSettings,
  IconLayoutDashboard,
  IconCalendar,
  IconFileText,
  IconDatabase,
  IconTransfer,
  IconChartBar,
  IconUpload,
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
          style={{ fontFamily: 'Times New Roman' }}
        >
          ENP VACATIONS
        </Text>

        <Divider color={theme.colors.adminBlue?.[6]} />

        {/* MAIN */}
        <NavItem
          label="Dashboard"
          path="/"
          icon={<IconLayoutDashboard size={18} />}
        />
        <NavItem
          label="Vacations"
          path="/vacations"
          icon={<IconCalendar size={18} />}
        />
        <NavItem
          label="État liquidation"
          path="/etat"
          icon={<IconFileText size={18} />}
        />

        {/* REFERENTIELS */}
        <SectionTitle label="RÉFÉRENTIELS" />

        <NavItem
          label="Gestion des référentiels"
          path="/referents"
          icon={<IconDatabase size={18} />}
        />
        <NavItem
          label="Configuration en-tête"
          path="/entete-config"
          icon={<IconSettings size={18} />}
        />

        {/* FINANCES */}
        <SectionTitle label="FINANCES" />

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
        <NavItem
          label="Import Excel"
          path="/import"
          icon={<IconUpload size={18} />}
        />
      </Stack>

      {/* FOOTER */}
      <Text size="xs" c="dimmed" ta="center">
        v1.0 • ENP
      </Text>
    </Stack>
  );
}