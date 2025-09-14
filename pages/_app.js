// App.js - Updated with Authentication
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box, Typography } from '@mui/material';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AuthPages from '../components/AuthPages';
import Home from '../pages/index';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

// App content component that uses auth context
const AppContent = () => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'grey.50'
      }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading application...
        </Typography>
      </Box>
    );
  }

  // Show auth pages if user is not logged in or profile is missing
  if (!currentUser || !userProfile) {
    return <AuthPages />;
  }

  // Show main app if user is authenticated
  return <Home />;
};

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}