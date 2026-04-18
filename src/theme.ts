import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'adminBlue',

  colors: {
    adminBlue: [
      '#eef3f9',
      '#d0deef',
      '#b0c7e4',
      '#90b0d9',
      '#7099ce',
      '#4f82c3',
      '#3669a9',
      '#295080',
      '#1b365d',
      '#12233c',
    ],
  },

  primaryShade: 7,

  // 🔥 FONT PRO
  fontFamily: 'Inter, system-ui, sans-serif',

  // 🔥 ARRONDI MODERNE
  defaultRadius: 'md',

  components: {
    AppShell: {
      styles: {
        main: {
          backgroundColor: '#f5f7fa', // fond pro
        },
        navbar: {
          backgroundColor: '#1b365d', // 🔥 sombre = pro
          borderRight: 'none',
        },
      },
    },

    Card: {
      styles: {
        root: {
          border: '1px solid #e5e7eb',
          backgroundColor: 'white',
        },
      },
    },

    Paper: {
      styles: {
        root: {
          border: '1px solid #e5e7eb',
          backgroundColor: 'white',
        },
      },
    },

    Button: {
      styles: {
        root: {
          borderRadius: '8px',
        },
      },
    },

    Table: {
      styles: {
        thead: {
          backgroundColor: '#1b365d',
        },
        th: {
          color: 'white',
          fontWeight: 600,
        },
        td: {
          borderBottom: '1px solid #f1f3f5',
        },
      },
    },
  },
});