import React, { useState, useEffect } from 'react';
import {
    Box, Paper, TextField, Button, Typography, Alert,
    Tabs, Tab, MenuItem, Chip, FormHelperText, Snackbar, Checkbox,
    InputAdornment, IconButton, Container, Grid, ToggleButton, ToggleButtonGroup, FormControlLabel
} from '@mui/material';
import {
    Login, PersonAdd, Visibility, VisibilityOff,
    Email, Lock, Person, Badge, Business, Security, AdminPanelSettings,
    SupervisorAccount, ManageAccounts, GroupWork, Google, Apple,
    TrendingUp, BarChart, PieChart, Timeline, Settings,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, query, collection, getDocs, where, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';


// Predefined teams - you can modify this list
const PREDEFINED_TEAMS = [
    'Development Team',
    'QA Team',
    'DevOps Team',
    'Design Team',
    'Marketing Team',
    'Sales Team'
];

const ROLES = [
    { value: 'employee', label: 'Employee', icon: <Person fontSize="small" /> },
    { value: 'track-lead', label: 'Track Lead', icon: <SupervisorAccount fontSize="small" /> },
    { value: 'team-leader', label: 'Team Leader', icon: <GroupWork fontSize="small" /> },
    { value: 'tech-lead', label: 'Tech Lead', icon: <ManageAccounts fontSize="small" /> },
    { value: 'admin', label: 'Admin', icon: <AdminPanelSettings fontSize="small" color="primary" /> }
];

const AuthPages = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { signIn, signUp,
        getPasswordValidation, getPasswordStrength, showSnackbar: contextShowSnackbar,
        loadUserProfile,
        logout } = useAuth();

    // Updated state for hierarchy selection
    const [trackLeadOptions, setTrackLeadOptions] = useState([]);
    const [teamLeaderOptions, setTeamLeaderOptions] = useState([]);
    const [techLeadOptions, setTechLeadOptions] = useState([]);
    const [selectedTeamInfo, setSelectedTeamInfo] = useState(null);

    // Login state
    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });

    // Register state
    const [registerData, setRegisterData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        role: '',
        teamName: '',
        empId: '',
        empName: '',
        managedTeams: [],
        reportsTo: '',
        adminCode: ''
    });

    // Filter roles based on mode
    const availableRoles = isAdminMode
        ? ROLES.filter(role => role.value === 'admin')
        : ROLES.filter(role => role.value !== 'admin');

    // Password validation
    const passwordValidation = getPasswordValidation ? getPasswordValidation(registerData.password) : {};
    const passwordStrength = getPasswordStrength ? getPasswordStrength(registerData.password) : { strength: '', color: '' };

    const showLocalSnackbar = (message, severity = 'error') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const isRegisterButtonDisabled = () => {
        const hasEmail = registerData.email && registerData.email.trim().length > 0;
        const hasPassword = registerData.password && registerData.password.length > 0;
        if (isAdminMode) {
            return loading || !hasEmail || !hasPassword;
        } else {
            const hasRole = registerData.role && registerData.role.length > 0;
            const hasEmpId = registerData.empId && registerData.empId.trim().length > 0;
            const hasEmpName = registerData.empName && registerData.empName.trim().length > 0;
            return loading || !hasEmail || !hasPassword || !hasRole || !hasEmpId || !hasEmpName;
        }
    };

    // Handle admin mode toggle
    const handleAdminModeToggle = (event, newMode) => {
        const isAdmin = newMode === 'admin';
        setIsAdminMode(isAdmin);
        // Reset form when switching modes
        setRegisterData({
            email: '',
            password: '',
            confirmPassword: '',
            role: isAdmin ? 'admin' : '',
            teamName: '',
            empId: '',
            empName: '',
            managedTeams: [],
            reportsTo: '',
            adminCode: ''
        });
        setSelectedTeamInfo(null);
        setTrackLeadOptions([]);
        setTeamLeaderOptions([]);
        setTechLeadOptions([]);
        setError('');
        setActiveTab(0);
    };

    useEffect(() => {
        const fetchTeamInfo = async () => {
            // Skip for admin role
            if (registerData.role === 'admin' || isAdminMode) {
                setSelectedTeamInfo(null);
                setTrackLeadOptions([]);
                setTeamLeaderOptions([]);
                setTechLeadOptions([]);
                return;
            }
            if (!registerData.teamName) {
                setSelectedTeamInfo(null);
                setTrackLeadOptions([]);
                setTeamLeaderOptions([]);
                setTechLeadOptions([]);
                return;
            }
            try {
                const teamDoc = await getDoc(doc(db, 'teams', registerData.teamName));
                let data = {};
                if (teamDoc.exists()) {
                    data = teamDoc.data();
                    console.log('Team data found:', data);
                } else {
                    console.log('Team document does not exist for:', registerData.teamName);
                }
                setSelectedTeamInfo(data);
                // For EMPLOYEE: Show track-leads assigned to this team
                if (registerData.role === 'employee') {
                    const trackLeadsQuery = query(
                        collection(db, 'users'),
                        where('role', '==', 'track-lead'),
                        where('teamName', '==', registerData.teamName)
                    );
                    const trackLeadsSnapshot = await getDocs(trackLeadsQuery);
                    const trackLeads = trackLeadsSnapshot.docs.map(doc => doc.data());
                    if (trackLeads.length > 0) {
                        setTrackLeadOptions(trackLeads.map(tl => ({
                            empId: tl.empId,
                            empName: tl.empName
                        })));
                    } else {
                        setTrackLeadOptions([]);
                    }
                }
                // For TRACK-LEAD: Show only the team leader assigned to this team
                if (registerData.role === 'track-lead') {
                    const tlEmpId = data.teamLeaderId;
                    if (tlEmpId) {
                        const q = query(
                            collection(db, 'users'),
                            where('empId', '==', tlEmpId)
                        );
                        const snapshot = await getDocs(q);
                        const tl = snapshot.docs[0]?.data();
                        if (tl) {
                            setTeamLeaderOptions([{ empId: tl.empId, empName: tl.empName }]);
                        } else {
                            setTeamLeaderOptions([]);
                        }
                    } else {
                        setTeamLeaderOptions([]);
                    }
                }
                // For TEAM LEADER: Show only the tech lead assigned to this team
                if (registerData.role === 'team-leader') {
                    const tlLeadEmpId = data.techLeadId;
                    console.log('Looking for tech lead with empId:', tlLeadEmpId);
                    if (tlLeadEmpId) {
                        const q = query(
                            collection(db, 'users'),
                            where('empId', '==', tlLeadEmpId)
                        );
                        const snapshot = await getDocs(q);
                        console.log('Query results:', snapshot.docs.length, 'documents found');
                        if (!snapshot.empty) {
                            const tlLead = snapshot.docs[0]?.data();
                            console.log('Tech lead found:', tlLead);
                            if (tlLead) {
                                setTechLeadOptions([{ empId: tlLead.empId, empName: tlLead.empName }]);
                            } else {
                                console.log('No tech lead found with empId:', tlLeadEmpId);
                                setTechLeadOptions([]);
                            }
                        } else {
                            console.log('No techLeadId found in team data');
                            setTechLeadOptions([]);
                        }
                    } else {
                        setTechLeadOptions([]);
                    }
                }
            } catch (error) {
                console.error('Error fetching team info:', error);
                setSelectedTeamInfo(null);
                setTrackLeadOptions([]);
                setTeamLeaderOptions([]);
                setTechLeadOptions([]);
            }
        };
        if (registerData.teamName && registerData.role !== 'admin' && !isAdminMode) {
            fetchTeamInfo();
        }
    }, [registerData.teamName, registerData.role, isAdminMode]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginData.email || !loginData.password) {
            showLocalSnackbar('Please enter email and password', 'warning');
            return;
        }
        setLoading(true);
        setError('');

        try {
            // First let Firebase handle the authentication
            const result = await signIn(loginData.email, loginData.password);

            // If we get here, authentication was successful
            // Now check the role after successful auth
            const userProfile = await loadUserProfile(result.user.uid);

            if (isAdminMode && userProfile?.role !== 'admin') {
                // Sign out immediately if role doesn't match
                await logout();
                showLocalSnackbar('You are not authorized to login as admin. Please switch to team member mode.', 'error');
                setLoading(false);
                return;
            }

            if (!isAdminMode && userProfile?.role === 'admin') {
                showLocalSnackbar('Admin users must login using admin mode', 'error');
                setLoading(false);
                return;
            }

            // If we get here, role matches mode - show success
            showLocalSnackbar(isAdminMode ? 'Admin login successful!' : 'Login successful!', 'success');

        } catch (error) {
            // Let AuthContext handle the specific error messages
            console.error('Login error:', error);
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        // Basic validation before calling signUp
        if (!registerData.email || !registerData.password) {
            showLocalSnackbar('Please fill email and password', 'warning');
            return;
        }
        if (registerData.password !== registerData.confirmPassword) {
            showLocalSnackbar('Passwords do not match', 'warning');
            return;
        }
        // Admin-specific validation
        if (isAdminMode && (!registerData.adminCode || registerData.adminCode.trim() === '')) {
            showLocalSnackbar('Admin access code is required', 'warning');
            return;
        }
        // Regular user validation
        if (!isAdminMode) {
            if (!registerData.empId || !registerData.empName || !registerData.role) {
                showLocalSnackbar('Please fill Employee ID, Name, and select a role', 'warning');
                return;
            }
        }
        setLoading(true);
        setError('');
        try {
            // Prepare profile data
            const profileData = {
                empName: registerData.empName,
                role: registerData.role,
                empId: registerData.empId,
                managedTeams: registerData.managedTeams,
                reportsTo: registerData.reportsTo
            };
            // Add teamName for non-admin, non-tech-lead roles
            if (!isAdminMode && registerData.role !== 'tech-lead') {
                profileData.teamName = registerData.teamName;
            }
            // Add adminCode for admin role
            if (isAdminMode) {
                profileData.adminCode = registerData.adminCode;
            }
            await signUp(registerData.email, registerData.password, profileData);
            // Clear form on success
            setRegisterData({
                email: '',
                password: '',
                confirmPassword: '',
                role: isAdminMode ? 'admin' : '',
                teamName: '',
                empId: '',
                empName: '',
                managedTeams: [],
                reportsTo: '',
                adminCode: ''
            });
            setActiveTab(0); // Switch to login tab
        } catch (error) {
            // Error is already handled in AuthContext with snackbar
            setLoading(false);
        }
    };

    const handleTeamSelection = (teamName, checked) => {
        if (checked) {
            setRegisterData(prev => ({
                ...prev,
                managedTeams: [...prev.managedTeams, teamName]
            }));
        } else {
            setRegisterData(prev => ({
                ...prev,
                managedTeams: prev.managedTeams.filter(team => team !== teamName)
            }));
        }
    };

    // Handle role change - reset dependent fields
    const handleRoleChange = (role) => {
        setRegisterData(prev => ({
            ...prev,
            role,
            teamName: (isAdminMode || role === 'tech-lead') ? '' : prev.teamName,
            reportsTo: '',
            managedTeams: role === 'tech-lead' ? [] : prev.managedTeams,
            adminCode: isAdminMode ? prev.adminCode : ''
        }));
        // Reset hierarchy options
        setSelectedTeamInfo(null);
        setTrackLeadOptions([]);
        setTeamLeaderOptions([]);
        setTechLeadOptions([]);
    };

    // Dashboard Preview Component with placeholder for your dashboard image
    const DashboardPreview = () => (
        <Box sx={{
            background: '#3B48FF',
            borderRadius: 2,
            p: 4,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Content */}
            <Box sx={{ position: 'relative', zIndex: 1, flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: 'white' }}>
                    Effortlessly manage your team and operations.
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 4 }}>
                    Log in to access your CRM dashboard and manage your team.
                </Typography>

                {/* Dashboard Image Placeholder */}
                <Box sx={{
                    width: '100%',
                    height: 300,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.2)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    {/* Replace this with your actual dashboard image */}
                    <img
                        src="/dashboard.png"
                        alt="Dashboard Preview"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                </Box>
            </Box>
        </Box>
    );

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            background: '#f8fafc'
        }}>
            <Container maxWidth="xl" sx={{ display: 'flex', alignItems: 'center', py: 4 }}>
                <Grid container spacing={0} sx={{ height: '80vh', minHeight: 600 }}>
                    {/* Left Panel - Authentication */}
                    <Grid item xs={12} md={5}>
                        <Paper elevation={0} sx={{
                            top: 0,
                            height: '100vh',
                            display: 'flex',
                            flexDirection: 'column',
                            pr: 18,
                            pl: 15,
                            borderRadius: { xs: 0, md: '16px 0 0 16px' },
                            background: 'white'
                        }}>
                            {/* Logo and Header */}
                            <Box sx={{ mb: 4 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                    <Box sx={{
                                        width: 24,
                                        height: 24,
                                        backgroundColor: '#3b48ff',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mr: 1
                                    }}>
                                        <Settings sx={{ fontSize: 16, color: 'white' }} />
                                    </Box>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#1f2937' }}>
                                        Mponline
                                    </Typography>
                                </Box>

                                {/* Admin Mode Toggle */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                    backgroundColor: '#f9fafb',
                                    borderRadius: 1,
                                    p: 0.5,
                                    mb: 3
                                }}>
                                    <ToggleButtonGroup
                                        value={isAdminMode ? 'admin' : 'user'}
                                        exclusive
                                        onChange={handleAdminModeToggle}
                                        size="small"
                                        sx={{
                                            '& .MuiToggleButtonGroup-grouped': {
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                marginRight: 1,
                                                '&.Mui-selected': {
                                                    backgroundColor: '#3b48ff',
                                                    color: 'white',
                                                    '&:hover': {
                                                        backgroundColor: '#2a35c0'
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <ToggleButton value="user">
                                            <Person fontSize="small" sx={{ mr: 0.5 }} />
                                            Team Member
                                        </ToggleButton>
                                        <ToggleButton value="admin">
                                            <AdminPanelSettings fontSize="small" sx={{ mr: 0.5 }} />
                                            Admin
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                            </Box>

                            {/* Tab Navigation */}
                            <Tabs
                                value={activeTab}
                                onChange={handleTabChange}
                                sx={{
                                    mb: 3,
                                    '& .MuiTabs-indicator': {
                                        backgroundColor: '#3b48ff',
                                        height: 2
                                    },
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        '&.Mui-selected': {
                                            color: '#3b48ff'
                                        }
                                    }
                                }}
                            >
                                <Tab label="Welcome Back" />
                                <Tab label="Register Now" />
                            </Tabs>

                            {/* Login Form */}
                            {activeTab === 0 && (
                                <Box sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    height: '100%'
                                }}>
                                    <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                                        Enter your email and password to access your account.
                                    </Typography>
                                    <form onSubmit={handleLogin} style={{ overflow: 'hidden' }}>
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                            Email
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="MpOnline@company.com"
                                            value={loginData.email}
                                            onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1,
                                                    backgroundColor: '#f9fafb',
                                                    '& fieldset': {
                                                        borderColor: '#e5e7eb'
                                                    },
                                                    '&:hover fieldset': {
                                                        borderColor: '#3b48ff'
                                                    },
                                                    '&.Mui-focused fieldset': {
                                                        borderColor: '#3b48ff'
                                                    }
                                                }
                                            }}
                                        />
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                            Password
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="Password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={loginData.password}
                                            onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                            required
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1,
                                                    backgroundColor: '#f9fafb',
                                                    '& fieldset': {
                                                        borderColor: '#e5e7eb'
                                                    },
                                                    '&:hover fieldset': {
                                                        borderColor: '#3b48ff'
                                                    },
                                                    '&.Mui-focused fieldset': {
                                                        borderColor: '#3b48ff'
                                                    }
                                                }
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            sx={{ color: '#6b7280' }}
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={rememberMe}
                                                        onChange={(e) => setRememberMe(e.target.checked)}
                                                        size="small"
                                                        sx={{
                                                            color: '#6b7280',
                                                            '&.Mui-checked': {
                                                                color: '#3b48ff'
                                                            }
                                                        }}
                                                    />
                                                }
                                                label={
                                                    <Typography variant="body2" color="textSecondary">
                                                        Remember Me
                                                    </Typography>
                                                }
                                            />
                                            <Button
                                                variant="text"
                                                sx={{
                                                    textTransform: 'none',
                                                    color: '#3b48ff',
                                                    fontWeight: 500,
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                Forgot Your Password?
                                            </Button>
                                        </Box>
                                        <Button
                                            type="submit"
                                            fullWidth
                                            variant="contained"
                                            disabled={loading || (!loginData.email || !loginData.password)}
                                            sx={{
                                                py: 1.5,
                                                borderRadius: 1,
                                                background: '#3b48ff',
                                                boxShadow: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.875rem',
                                                textTransform: 'none',
                                                mb: 3,
                                                '&:hover': {
                                                    background: '#2a35c0',
                                                    boxShadow: 'none'
                                                },
                                                '&:disabled': {
                                                    background: '#e5e7eb',
                                                    color: '#9ca3af'
                                                }
                                            }}
                                        >
                                            {loading ? 'Signing In...' : 'Log In'}
                                        </Button>
                                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                                Or Login With
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<Google />}
                                                    sx={{
                                                        flex: 1,
                                                        textTransform: 'none',
                                                        borderColor: '#e5e7eb',
                                                        color: '#374151',
                                                        borderRadius: 1,
                                                        py: 1,
                                                        '&:hover': {
                                                            borderColor: '#d1d5db',
                                                            backgroundColor: '#f9fafb'
                                                        }
                                                    }}
                                                >
                                                    Google
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<Apple />}
                                                    sx={{
                                                        flex: 1,
                                                        textTransform: 'none',
                                                        borderColor: '#e5e7eb',
                                                        color: '#374151',
                                                        borderRadius: 1,
                                                        py: 1,
                                                        '&:hover': {
                                                            borderColor: '#d1d5db',
                                                            backgroundColor: '#f9fafb'
                                                        }
                                                    }}
                                                >
                                                    Apple
                                                </Button>
                                            </Box>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="body2" color="textSecondary">
                                                Don&apos;t Have An Account?{' '}
                                                <Button
                                                    variant="text"
                                                    onClick={() => setActiveTab(1)}
                                                    sx={{
                                                        textTransform: 'none',
                                                        color: '#3b48ff',
                                                        fontWeight: 600,
                                                        fontSize: '0.875rem',
                                                        p: 0,
                                                        minWidth: 'auto'
                                                    }}
                                                >
                                                    Register Now.
                                                </Button>
                                            </Typography>
                                        </Box>
                                    </form>
                                </Box>
                            )}

                            {/* Register Form */}
                            {activeTab === 1 && (
                                <Box sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '300%',
                                }}>
                                    <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                                        Create your account to get started with team management.
                                    </Typography>
                                    <form onSubmit={handleRegister} style={{ overflow: 'hidden', height: '100%' }}>
                                        {/* Admin Access Code Field */}
                                        {isAdminMode && (
                                            <Alert
                                                severity="warning"
                                                sx={{ mb: 3, borderRadius: 1 }}
                                                icon={<AdminPanelSettings sx={{ fontSize: 20 }} />}
                                            >
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    Admin Access Required
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                    Admin registration requires a valid access code
                                                </Typography>
                                            </Alert>
                                        )}

                                        {/* Email Field */}
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                            Email
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="Enter your email"
                                            type="email"
                                            value={registerData.email}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1,
                                                    backgroundColor: '#f9fafb',
                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                }
                                            }}
                                        />

                                        {/* Password Field */}
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                            Password
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="Create password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={registerData.password}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                                            required
                                            error={!Object.values(passwordValidation).every(Boolean) && registerData.password.length > 0}
                                            helperText={
                                                !Object.values(passwordValidation).every(Boolean) && registerData.password.length > 0
                                                    ? 'Password must contain at least 8 characters, uppercase, lowercase, number, and special character'
                                                    : ''
                                            }
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1,
                                                    backgroundColor: '#f9fafb',
                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                }
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            sx={{ color: '#6b7280' }}
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                        {registerData.password && (
                                                            <Chip
                                                                label={passwordStrength.strength}
                                                                size="small"
                                                                sx={{
                                                                    backgroundColor: passwordStrength.color + '20',
                                                                    color: passwordStrength.color,
                                                                    fontSize: '0.75rem',
                                                                    height: 24,
                                                                    ml: 1
                                                                }}
                                                            />
                                                        )}
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        {/* Confirm Password Field */}
                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                            Confirm Password
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            placeholder="Confirm your password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={registerData.confirmPassword}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            required
                                            error={registerData.password && registerData.confirmPassword && registerData.password !== registerData.confirmPassword}
                                            helperText={
                                                registerData.password && registerData.confirmPassword && registerData.password !== registerData.confirmPassword
                                                    ? 'Passwords do not match'
                                                    : ''
                                            }
                                            sx={{
                                                mb: 3,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1,
                                                    backgroundColor: '#f9fafb',
                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                }
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            edge="end"
                                                            sx={{ color: '#6b7280' }}
                                                        >
                                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        {/* Admin Access Code */}
                                        {isAdminMode && (
                                            <>
                                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                    Admin Access Code
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Enter admin access code"
                                                    type="password"
                                                    value={registerData.adminCode}
                                                    onChange={(e) => setRegisterData(prev => ({ ...prev, adminCode: e.target.value }))}
                                                    required
                                                    sx={{
                                                        mb: 3,
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 1,
                                                            backgroundColor: '#fef2f2',
                                                            '& fieldset': { borderColor: '#fecaca' },
                                                            '&:hover fieldset': { borderColor: '#dc2626' },
                                                            '&.Mui-focused fieldset': { borderColor: '#dc2626' }
                                                        }
                                                    }}
                                                />
                                            </>
                                        )}

                                        {/* Personal Information - Only for non-admin */}
                                        {!isAdminMode && (
                                            <>
                                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                    Employee ID
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Enter your employee ID"
                                                    value={registerData.empId}
                                                    onChange={(e) => setRegisterData(prev => ({ ...prev, empId: e.target.value }))}
                                                    required
                                                    sx={{
                                                        mb: 2,
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 1,
                                                            backgroundColor: '#f9fafb',
                                                            '& fieldset': { borderColor: '#e5e7eb' },
                                                            '&:hover fieldset': { borderColor: '#3b48ff' },
                                                            '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                        }
                                                    }}
                                                />
                                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                    Full Name
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    placeholder="Enter your full name"
                                                    value={registerData.empName}
                                                    onChange={(e) => setRegisterData(prev => ({ ...prev, empName: e.target.value }))}
                                                    required
                                                    sx={{
                                                        mb: 2,
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 1,
                                                            backgroundColor: '#f9fafb',
                                                            '& fieldset': { borderColor: '#e5e7eb' },
                                                            '&:hover fieldset': { borderColor: '#3b48ff' },
                                                            '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                        }
                                                    }}
                                                />
                                                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                    Role
                                                </Typography>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    placeholder="Select your role"
                                                    value={registerData.role}
                                                    onChange={(e) => handleRoleChange(e.target.value)}
                                                    required
                                                    sx={{
                                                        mb: 2,
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 1,
                                                            backgroundColor: '#f9fafb',
                                                            '& fieldset': { borderColor: '#e5e7eb' },
                                                            '&:hover fieldset': { borderColor: '#3b48ff' },
                                                            '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                        }
                                                    }}
                                                >
                                                    {availableRoles.map(role => (
                                                        <MenuItem key={role.value} value={role.value}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {role.icon}
                                                                {role.label}
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </TextField>

                                                {/* Team Selection for non-TechLead roles */}
                                                {(registerData.role === 'employee' || registerData.role === 'track-lead' || registerData.role === 'team-leader') && (
                                                    <>
                                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                            Team
                                                        </Typography>
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            placeholder="Select your team"
                                                            value={registerData.teamName}
                                                            onChange={(e) => setRegisterData(prev => ({
                                                                ...prev,
                                                                teamName: e.target.value,
                                                                reportsTo: ''
                                                            }))}
                                                            required
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 1,
                                                                    backgroundColor: '#f9fafb',
                                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                                }
                                                            }}
                                                        >
                                                            {PREDEFINED_TEAMS.map(team => (
                                                                <MenuItem key={team} value={team}>
                                                                    {team}
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </>
                                                )}

                                                {/* Hierarchy Selection */}
                                                {registerData.role === 'employee' && (
                                                    <>
                                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                            Track Lead
                                                        </Typography>
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            placeholder="Select your track lead"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!registerData.teamName || trackLeadOptions.length === 0}
                                                            helperText={
                                                                !registerData.teamName
                                                                    ? "Select a team first"
                                                                    : trackLeadOptions.length === 0 && registerData.teamName
                                                                        ? "No track leads assigned to this team yet"
                                                                        : ""
                                                            }
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 1,
                                                                    backgroundColor: '#f9fafb',
                                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                                }
                                                            }}
                                                        >
                                                            <MenuItem value="">
                                                                <em>Select Track Lead</em>
                                                            </MenuItem>
                                                            {trackLeadOptions.map((tl) => (
                                                                <MenuItem key={tl.empId} value={tl.empId}>
                                                                    {tl.empName} ({tl.empId})
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </>
                                                )}
                                                {registerData.role === 'track-lead' && (
                                                    <>
                                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                            Team Leader
                                                        </Typography>
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            placeholder="Select team leader"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!selectedTeamInfo}
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 1,
                                                                    backgroundColor: '#f9fafb',
                                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                                }
                                                            }}
                                                        >
                                                            <MenuItem value="">
                                                                <em>Select Team Leader</em>
                                                            </MenuItem>
                                                            {teamLeaderOptions.map((tl) => (
                                                                <MenuItem key={tl.empId} value={tl.empId}>
                                                                    {tl.empName} ({tl.empId})
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </>
                                                )}
                                                {registerData.role === 'team-leader' && (
                                                    <>
                                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                            Tech Lead
                                                        </Typography>
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            placeholder="Select tech lead"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!selectedTeamInfo}
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 1,
                                                                    backgroundColor: '#f9fafb',
                                                                    '& fieldset': { borderColor: '#e5e7eb' },
                                                                    '&:hover fieldset': { borderColor: '#3b48ff' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#3b48ff' }
                                                                }
                                                            }}
                                                        >
                                                            <MenuItem value="">
                                                                <em>Select Tech Lead</em>
                                                            </MenuItem>
                                                            {techLeadOptions.map((tl) => (
                                                                <MenuItem key={tl.empId} value={tl.empId}>
                                                                    {tl.empName} ({tl.empId})
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </>
                                                )}

                                                {/* Multiple Team Selection for Tech Lead */}
                                                {registerData.role === 'tech-lead' && (
                                                    <Box sx={{ mb: 2 }}>
                                                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                                                            Select Teams to Manage
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                            {PREDEFINED_TEAMS.map(team => (
                                                                <Chip
                                                                    key={team}
                                                                    label={team}
                                                                    color={registerData.managedTeams.includes(team) ? 'primary' : 'default'}
                                                                    onClick={() => handleTeamSelection(team, !registerData.managedTeams.includes(team))}
                                                                    sx={{
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        '&:hover': {
                                                                            transform: 'translateY(-1px)',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                        }
                                                                    }}
                                                                />
                                                            ))}
                                                        </Box>
                                                        <FormHelperText>
                                                            Click to select/deselect teams
                                                        </FormHelperText>
                                                    </Box>
                                                )}
                                            </>
                                        )}

                                        <Button
                                            type="submit"
                                            fullWidth
                                            variant="contained"
                                            disabled={isRegisterButtonDisabled()}
                                            sx={{
                                                py: 1.5,
                                                borderRadius: 1,
                                                background: '#3b48ff',
                                                boxShadow: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.875rem',
                                                textTransform: 'none',
                                                mb: 3,
                                                '&:hover': {
                                                    background: '#2a35c0',
                                                    boxShadow: 'none'
                                                },
                                                '&:disabled': {
                                                    background: '#e5e7eb',
                                                    color: '#9ca3af'
                                                }
                                            }}
                                        >
                                            {loading
                                                ? (isAdminMode ? 'Creating Admin Account...' : 'Creating Account...')
                                                : (isAdminMode ? 'Create Admin Account' : 'Create Account')
                                            }
                                        </Button>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="body2" color="textSecondary">
                                                Already have an account?{' '}
                                                <Button
                                                    variant="text"
                                                    onClick={() => setActiveTab(0)}
                                                    sx={{
                                                        textTransform: 'none',
                                                        color: '#3b48ff',
                                                        fontWeight: 600,
                                                        fontSize: '0.875rem',
                                                        p: 0,
                                                        minWidth: 'auto'
                                                    }}
                                                >
                                                    Sign in here.
                                                </Button>
                                            </Typography>
                                        </Box>
                                    </form>
                                </Box>
                            )}

                            {/* Footer */}
                            <Box sx={{ mt: 'auto', pt: 3 }}>
                                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                                    Copyright © 2025 MpOnline Bhopal
                                </Typography>
                                <Box sx={{ textAlign: 'center', mt: 1 }}>
                                    <Button
                                        variant="text"
                                        size="small"
                                        sx={{
                                            textTransform: 'none',
                                            color: '#6b7280',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        Privacy Policy
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Right Panel - Dashboard Preview */}
                    <Grid item xs={12} md={7}>
                        <Box sx={{
                            position: 'fixed',   // keeps it fixed
                            top: 50,               // top of viewport
                            height: '85vh',      // full viewport height
                            borderRadius: { xs: 0, md: '0 16px 16px 0' },
                            overflow: 'hidden'
                        }}>
                            <DashboardPreview />
                        </Box>
                    </Grid>
                </Grid>
            </Container>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 1.5,
                        fontWeight: 500
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AuthPages;