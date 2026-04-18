import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const queryClient = new QueryClient();

const theme = createTheme({
  primaryColor: 'adminBlue',

  colors: {
    adminBlue: [
      '#e8edf3',
      '#c5d2e0',
      '#9fb6cd',
      '#799bba',
      '#537fa7',
      '#3c6890',
      '#2c4f6f',
      '#1f3c56',
      '#1b365d',
      '#12233c',
    ],
  },

  primaryShade: 8,
  fontFamily: 'Times New Roman, serif',
  defaultRadius: 0,

  components: {
    AppShell: {
      styles: {
        header: {
          backgroundColor: '#1b365d',
          borderBottom: '3px solid #e6e600',
        },
        navbar: {
          backgroundColor: '#c4cfad',
          borderRight: '2px solid #e6e600',
        },
        main: {
          backgroundColor: '#ffffff', // fond blanc pour le contenu principal
        },
      },
    },

    Button: {
      defaultProps: { radius: 0 },
      styles: {
        root: {
          backgroundColor: '#1b365d',
          border: '1px solid #0f223a',
          color: 'white',
          boxShadow: 'inset 0 1px 0 #4a6a8a',
          fontFamily: 'Times New Roman',
          fontWeight: 600,
          '&:hover': {
            backgroundColor: '#244a7c',
          },
        },
      },
    },

    // ✅ PAPER : fond blanc
    Paper: {
      defaultProps: { radius: 0, withBorder: true },
      styles: {
        root: {
          backgroundColor: 'white',
          border: '1px solid #7a8b5a',
        },
      },
    },

    // ✅ TEXINPUT : fond blanc
    TextInput: {
      defaultProps: { radius: 0 },
      styles: {
        input: {
          backgroundColor: 'white',
          border: '1px solid #ced4da',
          color: '#000',
        },
        label: {
          fontWeight: 600,
          fontFamily: 'Times New Roman',
        },
      },
    },

    // ✅ SELECT : fond blanc
    Select: {
      defaultProps: { radius: 0 },
      styles: {
        input: {
          backgroundColor: 'white',
          border: '1px solid #ced4da',
        },
        dropdown: {
          backgroundColor: 'white',
        },
      },
    },

    // ✅ NUMBERINPUT : fond blanc
    NumberInput: {
      defaultProps: { radius: 0 },
      styles: {
        input: {
          backgroundColor: 'white',
          border: '1px solid #ced4da',
        },
      },
    },

    // ✅ TABLE : fond blanc pour le corps, en-tête bleu
    Table: {
      styles: {
        thead: {
          backgroundColor: '#1b365d',
        },
        th: {
          color: 'white',
          border: '1px solid #dee2e6',
          fontFamily: 'Times New Roman',
        },
        tbody: {
          backgroundColor: 'white',
        },
        td: {
          border: '1px solid #dee2e6',
          color: '#212529',
        },
      },
    },

    Text: {
      styles: {
        root: {
          fontFamily: 'Times New Roman',
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <Notifications />
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);