// App.js - Updated with Authentication
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box, Typography } from '@mui/material';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AuthPages from '../components/AuthPages';
import Home from '../pages/index';
import '../styles/globals.css'

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
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          bgcolor: "transparent", // transparent background
        }}
      >
        {/* Moving dots loader */}
        <Box
          sx={{
            position: "relative",
            height: "12px",
            width: "200px", // 🔹 wider container for longer movement
            overflow: "hidden",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              bgcolor: "primary.main",
              animation: "moveDots 1.8s infinite linear",
            }}
          />
          <Box
            sx={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              bgcolor: "primary.main",
              animation: "moveDots 1.8s infinite linear",
              animationDelay: "0.3s",
            }}
          />
          <Box
            sx={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              bgcolor: "primary.main",
              animation: "moveDots 1.8s infinite linear",
              animationDelay: "0.6s",
            }}
          />
        </Box>

        {/* <Typography variant="h6" sx={{ mt: 3, color: "text.secondary" }}>
          Loading application...
        </Typography> */}

        {/* keyframes */}
        <style>
          {`
          @keyframes moveDots {
            0%   { transform: translateX(-50px); opacity: 0; }
            20%  { opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateX(200px); opacity: 0; }
          }
        `}
        </style>
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