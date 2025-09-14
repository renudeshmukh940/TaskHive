// components/AuthPages.js
import React, { useState, useEffect } from 'react';
import {
    Box, Paper, TextField, Button, Typography, Alert,
    Tabs, Tab, MenuItem, Chip, FormHelperText, Snackbar,
    InputAdornment, IconButton, Card, CardContent, Divider
} from '@mui/material';
import {
    Login, PersonAdd, Visibility, VisibilityOff,
    Email, Lock, Person, Badge, Business, Security
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, query, collection, getDocs, where, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

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
    { value: 'employee', label: 'Employee' },
    { value: 'team-leader', label: 'Team Leader' },
    { value: 'tech-lead', label: 'Tech Lead' }
];

const AuthPages = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { signIn, signUp } = useAuth();

    const [teamLeaderOptions, setTeamLeaderOptions] = useState([]); // For employees
    const [techLeadOptions, setTechLeadOptions] = useState([]);     // For team leaders
    const [selectedTeamInfo, setSelectedTeamInfo] = useState(null); // { teamLeaderId, techLeadId }

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
        reportsTo: ''
    });

    // Password validation
    const validatePassword = (password) => {
        const validations = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
        return validations;
    };

    const getPasswordStrength = (password) => {
        const validations = validatePassword(password);
        const score = Object.values(validations).filter(Boolean).length;

        if (score < 3) return { strength: 'Weak', color: '#f44336' };
        if (score < 4) return { strength: 'Medium', color: '#ff9800' };
        return { strength: 'Strong', color: '#4caf50' };
    };

    const showSnackbar = (message, severity = 'error') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    useEffect(() => {
        const fetchTeamInfo = async () => {
            if (!registerData.teamName) {
                setSelectedTeamInfo(null);
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

                // For EMPLOYEE: Show only the team leader assigned to this team
                if (registerData.role === 'employee') {
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
                setTeamLeaderOptions([]);
                setTechLeadOptions([]);
            }
        };

        if (registerData.teamName) {
            fetchTeamInfo();
        }
    }, [registerData.teamName, registerData.role]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signIn(loginData.email, loginData.password);
        } catch (error) {
            showSnackbar('Invalid email or password', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Password validation
        const passwordValidations = validatePassword(registerData.password);
        if (!Object.values(passwordValidations).every(Boolean)) {
            showSnackbar('Password must contain at least 8 characters, uppercase, lowercase, number, and special character', 'warning');
            setLoading(false);
            return;
        }

        if (registerData.password !== registerData.confirmPassword) {
            showSnackbar('Passwords do not match', 'warning');
            setLoading(false);
            return;
        }

        if (!registerData.role) {
            showSnackbar('Please select a role', 'warning');
            setLoading(false);
            return;
        }

        if (!registerData.teamName && registerData.role !== 'tech-lead') {
            showSnackbar('Please select a team', 'warning');
            setLoading(false);
            return;
        }

        if (registerData.role === 'tech-lead' && registerData.managedTeams.length === 0) {
            showSnackbar('Tech lead must select at least one team to manage', 'warning');
            setLoading(false);
            return;
        }

        if (!registerData.empId || !registerData.empName) {
            showSnackbar('Employee ID and Name are required', 'warning');
            setLoading(false);
            return;
        }

        // Auto-fill reportsTo based on role and team
        let reportsTo = '';
        if (registerData.role === 'employee' && selectedTeamInfo?.teamLeaderId) {
            reportsTo = selectedTeamInfo.teamLeaderId;
        } else if (registerData.role === 'team-leader' && selectedTeamInfo?.techLeadId) {
            reportsTo = selectedTeamInfo.techLeadId;
        } else if (registerData.role === 'employee' && !selectedTeamInfo?.teamLeaderId) {
            showSnackbar('No team leader assigned to this team. Please contact admin.', 'error');
            setLoading(false);
            return;
        } else if (registerData.role === 'team-leader' && !selectedTeamInfo?.techLeadId) {
            showSnackbar('No tech lead assigned to this team. Please contact admin.', 'error');
            setLoading(false);
            return;
        }

        try {
            const profileData = {
                name: registerData.empName,
                role: registerData.role,
                teamName: registerData.role === 'tech-lead' ? null : registerData.teamName,
                empId: registerData.empId,
                empName: registerData.empName,
                managedTeams: registerData.role === 'tech-lead' ? registerData.managedTeams : [],
                reportsTo: reportsTo,
                createdAt: new Date().toISOString()
            };

            const { user } = await createUserWithEmailAndPassword(auth, registerData.email, registerData.password);

            // Save user profile
            await setDoc(doc(db, 'users', user.uid), profileData);

            // For Tech Lead — auto-create team documents
            if (registerData.role === 'tech-lead') {
                for (const team of registerData.managedTeams) {
                    const teamRef = doc(db, 'teams', team);
                    await setDoc(teamRef, {
                        techLeadId: registerData.empId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
            }

            // For Team Leader — assign them as teamLeaderId in the team doc
            if (registerData.role === 'team-leader') {
                const teamRef = doc(db, 'teams', registerData.teamName);
                await setDoc(teamRef, {
                    teamLeaderId: registerData.empId,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }

            // Add user to teamMembers collection (for fast lookups)
            if (registerData.role === 'employee' || registerData.role === 'team-leader') {
                await setDoc(
                    doc(db, 'teamMembers', registerData.teamName, 'members', registerData.empId),
                    {
                        empId: registerData.empId,
                        empName: registerData.empName,
                        role: registerData.role,
                        teamName: registerData.teamName,
                        reportsTo: reportsTo,
                        joinedAt: new Date().toISOString()
                    }
                );
            }

            showSnackbar('Account created successfully!', 'success');
        } catch (error) {
            console.error('Error signing up:', error);
            showSnackbar(error.message || 'Failed to create account', 'error');
        } finally {
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

    const passwordStrength = getPasswordStrength(registerData.password);

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
                <Box sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    color: 'white',
                    p: 3,
                    textAlign: 'center'
                }}>
                    <Security sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
                    <Typography variant="h4" fontWeight="700" letterSpacing="0.5px">
                        Daily Task Tracker
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                        Streamline your workflow management
                    </Typography>
                </Box>

                <CardContent sx={{ p: 0 }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        centered
                        sx={{
                            borderBottom: '1px solid #e0e0e0',
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#1976d2',
                                height: 3
                            }
                        }}
                    >
                        <Tab
                            icon={<Login />}
                            label="Sign In"
                            sx={{
                                minHeight: 64,
                                fontWeight: 600,
                                color: '#666',
                                '&.Mui-selected': {
                                    color: '#1976d2'
                                }
                            }}
                        />
                        <Tab
                            icon={<PersonAdd />}
                            label="Register"
                            sx={{
                                minHeight: 64,
                                fontWeight: 600,
                                color: '#666',
                                '&.Mui-selected': {
                                    color: '#1976d2'
                                }
                            }}
                        />
                    </Tabs>

                    <Box sx={{ p: 4 }}>
                        {/* Login Form */}
                        {activeTab === 0 && (
                            <form onSubmit={handleLogin}>
                                <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 600, mb: 3 }}>
                                    Welcome Back
                                </Typography>

                                <TextField
                                    fullWidth
                                    label="Email Address"
                                    type="email"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                                    margin="normal"
                                    required
                                    autoComplete="email"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Email sx={{ color: '#1976d2' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: '#1976d2',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#1976d2',
                                            }
                                        }
                                    }}
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={loginData.password}
                                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                    margin="normal"
                                    required
                                    autoComplete="current-password"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock sx={{ color: '#1976d2' }} />
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
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '&:hover fieldset': {
                                                borderColor: '#1976d2',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#1976d2',
                                            }
                                        }
                                    }}
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    sx={{
                                        mt: 3,
                                        mb: 2,
                                        py: 1.5,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                            boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                                        }
                                    }}
                                >
                                    {loading ? 'Signing In...' : 'Sign In'}
                                </Button>
                            </form>
                        )}

                        {/* Register Form */}
                        {activeTab === 1 && (
                            <form onSubmit={handleRegister}>
                                <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 600, mb: 3 }}>
                                    Create Your Account
                                </Typography>

                                {/* Employee Details Section */}
                                <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid #e3f2fd' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                                            <Person sx={{ mr: 1 }} />
                                            Personal Information
                                        </Typography>

                                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                            <TextField
                                                fullWidth
                                                label="Employee ID"
                                                value={registerData.empId}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, empId: e.target.value }))}
                                                required
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Badge sx={{ color: '#1976d2' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#1976d2' },
                                                        '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                    }
                                                }}
                                            />

                                            <TextField
                                                fullWidth
                                                label="Full Name"
                                                value={registerData.empName}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, empName: e.target.value }))}
                                                required
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        '&:hover fieldset': { borderColor: '#1976d2' },
                                                        '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                    }
                                                }}
                                            />
                                        </Box>

                                        <TextField
                                            fullWidth
                                            label="Email Address"
                                            type="email"
                                            value={registerData.email}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                            autoComplete="email"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <Email sx={{ color: '#1976d2' }} />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                }
                                            }}
                                        />

                                        <TextField
                                            fullWidth
                                            label="Password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={registerData.password}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                                            required
                                            autoComplete="new-password"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <Lock sx={{ color: '#1976d2' }} />
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
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                }
                                            }}
                                        />

                                        {/* Password Strength Indicator */}
                                        {registerData.password && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 600 }}>
                                                    Password Strength: {passwordStrength.strength}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                                    {Object.entries(validatePassword(registerData.password)).map(([key, valid], index) => (
                                                        <Box
                                                            key={key}
                                                            sx={{
                                                                flex: 1,
                                                                height: 4,
                                                                borderRadius: 2,
                                                                backgroundColor: valid ? passwordStrength.color : '#e0e0e0',
                                                                transition: 'backgroundColor 0.3s'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        <TextField
                                            fullWidth
                                            label="Confirm Password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={registerData.confirmPassword}
                                            onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            required
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <Lock sx={{ color: '#1976d2' }} />
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
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                }
                                            }}
                                        />
                                    </CardContent>
                                </Card>

                                {/* Role and Team Section */}
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
                                            onChange={(e) => setRegisterData(prev => ({
                                                ...prev,
                                                role: e.target.value,
                                                managedTeams: e.target.value === 'tech-lead' ? [] : prev.managedTeams,
                                                teamName: e.target.value === 'tech-lead' ? '' : prev.teamName,
                                                reportsTo: ''
                                            }))}
                                            required
                                            sx={{
                                                mb: 2,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#1976d2' },
                                                    '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                }
                                            }}
                                        >
                                            {ROLES.map(role => (
                                                <MenuItem key={role.value} value={role.value}>
                                                    {role.label}
                                                </MenuItem>
                                            ))}
                                        </TextField>

                                        {/* Team Selection for Employee and Team Leader */}
                                        {(registerData.role === 'employee' || registerData.role === 'team-leader') && (
                                            <TextField
                                                select
                                                fullWidth
                                                label="Team"
                                                value={registerData.teamName}
                                                onChange={(e) => setRegisterData(prev => ({ ...prev, teamName: e.target.value }))}
                                                required
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

                                        {/* Reports To Fields */}
                                        {registerData.role === 'employee' && (
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
                                                <FormHelperText sx={{ mt: 1 }}>
                                                    Click to select/deselect teams
                                                </FormHelperText>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                            boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                                            transform: 'translateY(-2px)'
                                        },
                                        '&:disabled': {
                                            background: '#ccc'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {loading ? 'Creating Account...' : 'Create Account'}
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