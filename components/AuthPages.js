// components/AuthPages.js - Fixed imports and button functionality
import React, { useState, useEffect } from 'react';
import {
    Box, Paper, TextField, Button, Typography, Alert,
    Tabs, Tab, MenuItem, Chip, FormHelperText, Snackbar,
    InputAdornment, IconButton, Card, CardContent, Divider, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
    Login, PersonAdd, Visibility, VisibilityOff,
    Email, Lock, Person, Badge, Business, Security, AdminPanelSettings,
    SupervisorAccount, ManageAccounts, GroupWork
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, query, collection, getDocs, where, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
// REMOVED: Firebase auth imports - these belong in AuthContext only

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
    const { signIn, signUp, getPasswordValidation, getPasswordStrength, showSnackbar: contextShowSnackbar } = useAuth();

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
            await signIn(loginData.email, loginData.password);
            showLocalSnackbar(isAdminMode ? 'Admin login successful!' : 'Login successful!', 'success');
        } catch (error) {
            // Error is already handled in AuthContext
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

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            p: 2,
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 30% 20%, rgba(25, 118, 210, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none'
            }
        }}>
            <Card elevation={20} sx={{
                width: '100%',
                maxWidth: 520,
                borderRadius: 4,
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
                {/* Header with Admin Mode Switcher */}
                <Box sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    color: 'white',
                    p: 3,
                    textAlign: 'center',
                    position: 'relative'
                }}>
                    <Security sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
                    <Typography variant="h4" fontWeight="700" letterSpacing="0.5px">
                        Daily Task Tracker
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mt: 1, mb: 2 }}>
                        {isAdminMode ? 'Admin Portal' : 'Streamline your workflow management'}
                    </Typography>

                    {/* Admin Mode Toggle */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 2,
                        p: 1,
                        mb: 1,
                        backdropFilter: 'blur(10px)'
                    }}>
                        <ToggleButtonGroup
                            value={isAdminMode ? 'admin' : 'user'}
                            exclusive
                            onChange={handleAdminModeToggle}
                            size="small"
                            sx={{
                                '& .MuiToggleButtonGroup-grouped': {
                                    borderRadius: 1.5,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    marginRight: 1,
                                    '&.Mui-selected': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.3)'
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
                                <AdminPanelSettings fontSize="small" sx={{ mr: 2.5 }} />
                                Admin
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <CardContent sx={{ p: 0 }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        centered
                        sx={{
                            borderBottom: '1px solid #e0e0e0',
                            '& .MuiTabs-indicator': {
                                backgroundColor: isAdminMode ? '#f44336' : '#1976d2',
                                height: 3
                            }
                        }}
                    >
                        <Tab
                            icon={<Login />}
                            label={isAdminMode ? "Admin Sign In" : "Sign In"}
                            sx={{
                                minHeight: 64,
                                fontWeight: 600,
                                color: '#666',
                                '&.Mui-selected': {
                                    color: isAdminMode ? '#f44336' : '#1976d2'
                                }
                            }}
                        />
                        <Tab
                            icon={<PersonAdd />}
                            label={isAdminMode ? "Admin Register" : "Register"}
                            sx={{
                                minHeight: 64,
                                fontWeight: 600,
                                color: '#666',
                                '&.Mui-selected': {
                                    color: isAdminMode ? '#f44336' : '#1976d2'
                                }
                            }}
                        />
                    </Tabs>

                    <Box sx={{ p: 4 }}>
                        {/* Login Form */}
                        {activeTab === 0 && (
                            <form onSubmit={handleLogin}>
                                <Typography
                                    variant="h6"
                                    gutterBottom
                                    sx={{
                                        color: '#333',
                                        fontWeight: 600,
                                        mb: 3,
                                        textAlign: 'center'
                                    }}
                                >
                                    {isAdminMode ? 'Admin Login' : 'Welcome Back'}
                                </Typography>

                                {isAdminMode && (
                                    <Alert
                                        severity="info"
                                        sx={{ mb: 2, borderRadius: 2 }}
                                        icon={<AdminPanelSettings sx={{ fontSize: 20 }} />}
                                    >
                                        <Typography variant="body2">
                                            Admin access requires special credentials
                                        </Typography>
                                    </Alert>
                                )}

                                <TextField
                                    fullWidth
                                    label="Email"
                                    type="email"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                    error={!!error && error.includes('email')}
                                    helperText={error && error.includes('email') ? error : ''}
                                    sx={{
                                        mb: 2,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            }
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Email sx={{ color: isAdminMode ? '#f44336' : '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <TextField
                                    fullWidth
                                    label={isAdminMode ? "Admin Password" : "Password"}
                                    type={showPassword ? 'text' : 'password'}
                                    value={loginData.password}
                                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                    error={!!error && error.includes('password')}
                                    helperText={error && error.includes('password') ? error : ''}
                                    sx={{
                                        mb: 3,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            }
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock sx={{ color: isAdminMode ? '#f44336' : '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                {/* FIXED: Simplified login button condition */}
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading || (!loginData.email || !loginData.password)}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 2,
                                        background: isAdminMode
                                            ? 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
                                            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        boxShadow: isAdminMode
                                            ? '0 4px 15px rgba(244, 67, 54, 0.3)'
                                            : '0 4px 15px rgba(25, 118, 210, 0.3)',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        color: 'white',
                                        '&:hover': {
                                            background: isAdminMode
                                                ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
                                                : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                            boxShadow: isAdminMode
                                                ? '0 6px 20px rgba(244, 67, 54, 0.4)'
                                                : '0 6px 20px rgba(25, 118, 210, 0.4)',
                                            transform: 'translateY(-2px)'
                                        },
                                        '&:disabled': {
                                            background: '#ccc',
                                            color: 'rgba(0, 0, 0, 0.26)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {loading ? (isAdminMode ? 'Signing In as Admin...' : 'Signing In...') :
                                        (isAdminMode ? 'Admin Sign In' : 'Sign In')}
                                </Button>
                            </form>
                        )}

                        {/* Register Form */}
                        {activeTab === 1 && (
                            <form onSubmit={handleRegister}>
                                <Typography
                                    variant="h6"
                                    gutterBottom
                                    sx={{
                                        color: '#333',
                                        fontWeight: 600,
                                        mb: 3,
                                        textAlign: 'center'
                                    }}
                                >
                                    {isAdminMode ? 'Admin Registration' : 'Create New Account'}
                                </Typography>

                                {isAdminMode && (
                                    <Alert
                                        severity="warning"
                                        sx={{ mb: 2, borderRadius: 2 }}
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

                                <TextField
                                    fullWidth
                                    label="Email"
                                    type="email"
                                    value={registerData.email}
                                    onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                    error={!!error && error.includes('email')}
                                    helperText={error && error.includes('email') ? error : ''}
                                    sx={{
                                        mb: 2,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            }
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Email sx={{ color: isAdminMode ? '#f44336' : '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={registerData.password}
                                    onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                    error={!Object.values(passwordValidation).every(Boolean)}
                                    helperText={
                                        !Object.values(passwordValidation).every(Boolean)
                                            ? 'Password must contain at least 8 characters, uppercase, lowercase, number, and special character'
                                            : ''
                                    }
                                    sx={{
                                        mb: 2,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            }
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock sx={{ color: isAdminMode ? '#f44336' : '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                                {registerData.password && (
                                                    <InputAdornment position="end" sx={{ ml: 1 }}>
                                                        <Chip
                                                            label={passwordStrength.strength}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: passwordStrength.color + '20',
                                                                color: passwordStrength.color,
                                                                fontSize: '0.75rem',
                                                                height: 24
                                                            }}
                                                        />
                                                    </InputAdornment>
                                                )}
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    label="Confirm Password"
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
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: isAdminMode ? '#f44336' : '#1976d2'
                                            }
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock sx={{ color: isAdminMode ? '#f44336' : '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    edge="end"
                                                >
                                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                {/* Admin Access Code Field */}
                                {isAdminMode && (
                                    <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid #ffcdd2' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ color: '#f44336', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                                                <Security sx={{ mr: 1, color: '#f44336' }} />
                                                Admin Access Code
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                label="Enter Admin Access Code"
                                                type="password"
                                                value={registerData.adminCode}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, adminCode: e.target.value }))}
                                                required
                                                error={!!error && error.includes('admin')}
                                                helperText={
                                                    error && error.includes('admin')
                                                        ? error
                                                        : 'Contact your system administrator for the access code'
                                                }
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#f44336' },
                                                        '&.Mui-focused fieldset': { borderColor: '#f44336' }
                                                    }
                                                }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <AdminPanelSettings sx={{ color: '#f44336' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Personal Information Card - Skip for Admin Registration */}
                                {!isAdminMode && (
                                    <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid #e3f2fd' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                                                <Person sx={{ mr: 1 }} />
                                                Personal Information
                                            </Typography>

                                            <TextField
                                                fullWidth
                                                label="Employee ID"
                                                value={registerData.empId}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, empId: e.target.value }))}
                                                required
                                                error={!!error && error.includes('Employee ID')}
                                                helperText={error && error.includes('Employee ID') ? error : ''}
                                                sx={{
                                                    mb: 2,
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#1976d2' },
                                                        '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                    }
                                                }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Badge sx={{ color: '#1976d2' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                            <TextField
                                                fullWidth
                                                label="Full Name"
                                                value={registerData.empName}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, empName: e.target.value }))}
                                                required
                                                error={!!error && error.includes('Name')}
                                                helperText={error && error.includes('Name') ? error : ''}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#1976d2' },
                                                        '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                    }
                                                }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Person sx={{ color: '#1976d2' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Role and Team Section - Only for non-admin mode */}
                                {!isAdminMode && (
                                    <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid #e3f2fd' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                                                <Business sx={{ mr: 1 }} />
                                                Role & Team Assignment
                                            </Typography>

                                            <TextField
                                                select
                                                fullWidth
                                                label="Role"
                                                value={registerData.role}
                                                onChange={(e) => handleRoleChange(e.target.value)}
                                                required
                                                error={!!error && error.includes('role')}
                                                helperText={error && error.includes('role') ? error : ''}
                                                sx={{
                                                    mb: 2,
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#1976d2' },
                                                        '&.Mui-focused fieldset': { borderColor: '#1976d2' }
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
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Team"
                                                    value={registerData.teamName}
                                                    onChange={(e) => setRegisterData(prev => ({
                                                        ...prev,
                                                        teamName: e.target.value,
                                                        reportsTo: '' // Reset reportsTo when team changes
                                                    }))}
                                                    required
                                                    error={!!error && error.includes('team')}
                                                    helperText={error && error.includes('team') ? error : ''}
                                                    sx={{
                                                        mb: 2,
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 2,
                                                            '&:hover fieldset': { borderColor: '#1976d2' },
                                                            '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                        }
                                                    }}
                                                >
                                                    {PREDEFINED_TEAMS.map(team => (
                                                        <MenuItem key={team} value={team}>
                                                            {team}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            )}

                                            {/* Hierarchy Selection */}
                                            {registerData.role !== 'tech-lead' && (
                                                <>
                                                    {/* EMPLOYEE: Select Track-Lead */}
                                                    {registerData.role === 'employee' && (
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            label="Track Lead"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!registerData.teamName || trackLeadOptions.length === 0}
                                                            error={!registerData.reportsTo && !!registerData.teamName}
                                                            helperText={
                                                                !registerData.teamName
                                                                    ? "Select a team first..."
                                                                    : trackLeadOptions.length === 0 && registerData.teamName
                                                                        ? "No track leads assigned to this team yet. Please contact admin."
                                                                        : !registerData.reportsTo && registerData.teamName
                                                                            ? "Please select your Track Lead"
                                                                            : ""
                                                            }
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 2,
                                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
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
                                                            {trackLeadOptions.length === 0 && !!registerData.teamName && (
                                                                <MenuItem disabled>No track leads available for this team</MenuItem>
                                                            )}
                                                        </TextField>
                                                    )}

                                                    {/* TRACK-LEAD: Select Team Leader */}
                                                    {registerData.role === 'track-lead' && (
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            label="Team Leader"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!selectedTeamInfo}
                                                            error={!registerData.reportsTo && !!registerData.teamName}
                                                            helperText={
                                                                !selectedTeamInfo
                                                                    ? "Select a team first..."
                                                                    : !registerData.reportsTo && registerData.teamName
                                                                        ? "Please select the team leader assigned to this team"
                                                                        : ""
                                                            }
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 2,
                                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
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
                                                            {teamLeaderOptions.length === 0 && !selectedTeamInfo && (
                                                                <MenuItem disabled>No team leader available</MenuItem>
                                                            )}
                                                        </TextField>
                                                    )}

                                                    {/* TEAM LEADER: Select Tech Lead */}
                                                    {registerData.role === 'team-leader' && (
                                                        <TextField
                                                            select
                                                            fullWidth
                                                            label="Tech Lead"
                                                            value={registerData.reportsTo}
                                                            onChange={(e) => setRegisterData(prev => ({ ...prev, reportsTo: e.target.value }))}
                                                            required
                                                            disabled={!selectedTeamInfo}
                                                            error={!registerData.reportsTo && !!registerData.teamName}
                                                            helperText={
                                                                !selectedTeamInfo
                                                                    ? "Select a team first..."
                                                                    : !registerData.reportsTo && registerData.teamName
                                                                        ? "Please select the tech lead assigned to this team"
                                                                        : ""
                                                            }
                                                            sx={{
                                                                mb: 2,
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: 2,
                                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
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
                                                            {techLeadOptions.length === 0 && !selectedTeamInfo && (
                                                                <MenuItem disabled>No tech lead available</MenuItem>
                                                            )}
                                                        </TextField>
                                                    )}
                                                </>
                                            )}

                                            {/* Multiple Team Selection for Tech Lead */}
                                            {registerData.role === 'tech-lead' && (
                                                <Box>
                                                    <Typography variant="body2" gutterBottom sx={{ fontWeight: 600, color: '#666' }}>
                                                        Select Teams to Manage:
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
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
                                                                        transform: 'translateY(-2px)',
                                                                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                                                    }
                                                                }}
                                                            />
                                                        ))}
                                                    </Box>
                                                    <FormHelperText sx={{ mt: 1 }} error={!!error && error.includes('team')}>
                                                        {error && error.includes('team') ? error : 'Click to select/deselect teams'}
                                                    </FormHelperText>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* FIXED: Updated button disabled condition */}
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={isRegisterButtonDisabled()}
                                    onClick={(e) => {
                                        console.log('Button clicked!'); // Debug log
                                        handleRegister(e);
                                    }}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 2,
                                        background: isAdminMode
                                            ? 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
                                            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        boxShadow: isAdminMode
                                            ? '0 4px 15px rgba(244, 67, 54, 0.3)'
                                            : '0 4px 15px rgba(25, 118, 210, 0.3)',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        color: 'white',
                                        '&:hover': {
                                            background: isAdminMode
                                                ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
                                                : 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                            boxShadow: isAdminMode
                                                ? '0 6px 20px rgba(244, 67, 54, 0.4)'
                                                : '0 6px 20px rgba(25, 118, 210, 0.4)',
                                            transform: 'translateY(-2px)'
                                        },
                                        '&:disabled': {
                                            background: '#ccc',
                                            color: 'rgba(0, 0, 0, 0.26)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {loading
                                        ? (isAdminMode ? 'Creating Admin Account...' : 'Creating Account...')
                                        : (isAdminMode ? 'Create Admin Account' : 'Create Account')
                                    }
                                </Button>
                            </form>
                        )}
                    </Box>
                </CardContent>
            </Card>

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
                        borderRadius: 2,
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