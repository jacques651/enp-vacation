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
          backgroundColor: '#f5f7fa',
        },
        navbar: {
          backgroundColor: '#1b365d',
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

    // ✅ CORRECTION : Badge sans majuscules
    Badge: {
      styles: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          letterSpacing: 'normal',
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

    // ✅ Configuration supplémentaire pour les titres
    Title: {
      styles: {
        root: {
          fontWeight: 600,
        },
      },
    },

    // ✅ Configuration pour les Alertes
    Alert: {
      styles: {
        root: {
          borderRadius: '8px',
        },
      },
    },

    // ✅ Configuration pour les Modals
    Modal: {
      styles: {
        header: {
          backgroundColor: '#1b365d',
          color: 'white',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        },
        title: {
          color: 'white',
          fontWeight: 600,
        },
        content: {
          borderRadius: '8px',
        },
      },
    },

    // ✅ Configuration pour les Select
    Select: {
      styles: {
        input: {
          borderRadius: '8px',
        },
      },
    },

    // ✅ Configuration pour les NumberInput
    NumberInput: {
      styles: {
        input: {
          borderRadius: '8px',
        },
      },
    },

    // ✅ Configuration pour les TextInput
    TextInput: {
      styles: {
        input: {
          borderRadius: '8px',
        },
      },
    },

    // ✅ Configuration pour les Pagination
    Pagination: {
      styles: {
        control: {
          borderRadius: '8px',
        },
      },
    },
  },
});