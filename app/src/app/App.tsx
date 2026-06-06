import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#dc2626',
    },
    secondary: {
      main: '#ffffff',
    },
    background: {
      default: '#0a0a0a',
      paper: '#151515',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="dark">
        <RouterProvider router={router} />
      </div>
    </ThemeProvider>
  );
}