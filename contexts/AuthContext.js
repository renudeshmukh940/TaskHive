// contexts/AuthContext.js - Updated with Admin role support and error handling
import { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

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
        setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 6000);
    };

    // Sign up user with profile data - Updated for Admin role
    const signUp = async (email, password, profileData) => {
        try {
            setError(null);

            // Password validation
            const passwordValidations = validatePassword(password);
            if (!Object.values(passwordValidations).every(Boolean)) {
                const missingCriteria = [];
                if (!passwordValidations.length) missingCriteria.push('at least 8 characters');
                if (!passwordValidations.uppercase) missingCriteria.push('uppercase letter');
                if (!passwordValidations.lowercase) missingCriteria.push('lowercase letter');
                if (!passwordValidations.number) missingCriteria.push('number');
                if (!passwordValidations.special) missingCriteria.push('special character');

                throw new Error(`Password must contain: ${missingCriteria.join(', ')}`);
            }

            // Admin role validation
            if (profileData.role === 'admin') {
                const ADMIN_ACCESS_CODE = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE || 'ADMIN2024';
                if (!profileData.adminCode || profileData.adminCode !== ADMIN_ACCESS_CODE) {
                    throw new Error('Invalid admin access code');
                }
                // Admin doesn't need team or reportsTo
                delete profileData.teamName;
                delete profileData.reportsTo;
                delete profileData.managedTeams;
            }

            // Validate required fields based on role
            if (!profileData.role) {
                throw new Error('Please select a role');
            }

            if (profileData.role !== 'admin' && profileData.role !== 'tech-lead' && !profileData.teamName) {
                throw new Error('Please select a team');
            }

            if (profileData.role === 'tech-lead' && (!profileData.managedTeams || profileData.managedTeams.length === 0)) {
                throw new Error('Tech lead must select at least one team to manage');
            }

            if (!isAdmin && (!profileData.empId || !profileData.empName)) {
                throw new Error('Employee ID and Name are required');
            }


            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            // Create user profile in Firestore
            const profileToSave = {
                email,
                name: profileData.empName,
                role: profileData.role,
                empId: profileData.empId,
                empName: profileData.empName,
                createdAt: new Date().toISOString()
            };

            // Add role-specific fields
            switch (profileData.role) {
                case 'admin':
                    profileToSave.role = 'admin';
                    profileToSave.isAdmin = true;
                    break;

                case 'tech-lead':
                    profileToSave.teamName = null; // Tech-leads don't belong to a specific team
                    profileToSave.managedTeams = profileData.managedTeams || [];
                    break;

                case 'team-leader':
                case 'track-lead':
                case 'employee':
                    profileToSave.teamName = profileData.teamName;
                    profileToSave.reportsTo = profileData.reportsTo || null;
                    break;

                default:
                    profileToSave.teamName = profileData.teamName;
                    break;
            }

            await setDoc(doc(db, 'users', user.uid), profileToSave);

            // For Tech Lead — auto-create team documents
            if (profileData.role === 'tech-lead') {
                for (const team of profileData.managedTeams) {
                    const teamRef = doc(db, 'teams', team);
                    await setDoc(teamRef, {
                        techLeadId: profileData.empId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
            }

            // For Team Leader — assign them as teamLeaderId in the team doc
            if (profileData.role === 'team-leader') {
                const teamRef = doc(db, 'teams', profileData.teamName);
                await setDoc(teamRef, {
                    teamLeaderId: profileData.empId,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }

            // Add user to teamMembers collection (for fast lookups)
            if (profileData.role !== 'admin' && profileData.role !== 'tech-lead') {
                await setDoc(
                    doc(db, 'teamMembers', profileData.teamName, 'members', profileData.empId),
                    {
                        empId: profileData.empId,
                        empName: profileData.empName,
                        role: profileData.role,
                        teamName: profileData.teamName,
                        reportsTo: profileData.reportsTo,
                        joinedAt: new Date().toISOString()
                    }
                );
            }

            showSnackbar('Account created successfully!', 'success');
            return user;

        } catch (error) {
            console.error('Error signing up:', error);
            const errorMessage = error.message || 'Failed to create account';
            setError(errorMessage);
            showSnackbar(errorMessage, 'error');
            throw error;
        }
    };

    // Sign in user - Updated with better error handling
    const signIn = async (email, password) => {
        try {
            setError(null);
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
        } catch (error) {
            console.error('Error signing in:', error);
            let errorMessage = 'Invalid email or password';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address';
                    break;
                default:
                    errorMessage = error.message || 'Login failed';
            }

            setError(errorMessage);
            showSnackbar(errorMessage, 'error');
            throw error;
        }
    };

    // Sign out user
    const logout = async () => {
        try {
            await signOut(auth);
            setUserProfile(null);
            setError(null);
            showSnackbar('Signed out successfully', 'success');
        } catch (error) {
            console.error('Error signing out:', error);
            showSnackbar('Error signing out', 'error');
            throw error;
        }
    };

    // Load user profile from Firestore
    const loadUserProfile = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                const profile = userDoc.data();
                setUserProfile(profile);
                return profile;
            }
            return null;
        } catch (error) {
            console.error('Error loading user profile:', error);
            showSnackbar('Error loading profile', 'error');
            return null;
        }
    };

    // Check if user can access team data - Updated for Admin
    const canAccessTeam = (teamName) => {
        if (!userProfile) return false;

        switch (userProfile.role) {
            case 'admin':
                return true; // Admin can access all teams
            case 'tech-lead':
                return userProfile.managedTeams?.includes(teamName) || teamName === 'techLeads';
            case 'team-leader':
            case 'track-lead':
            case 'employee':
                return userProfile.teamName === teamName;
            default:
                return false;
        }
    };

    // Check if user can access employee data - Updated for Admin
    const canAccessEmployee = async (teamName, empId) => {
        if (!userProfile) return false;

        // Admin can access all employees
        if (userProfile.role === 'admin') {
            return true;
        }

        // Own data access
        if (userProfile.empId === empId) return true;

        switch (userProfile.role) {
            case 'tech-lead':
                // Can access subordinates in managed teams (not other tech-leads)
                if (teamName === 'techLeads') {
                    return empId === userProfile.empId; // Only own data from techLeads team
                }
                return userProfile.managedTeams?.includes(teamName);

            case 'team-leader':
                if (userProfile.teamName !== teamName) return false;
                // Can access track-leads and employees, not other team-leaders
                // This simplified version - you might want to check actual user roles
                return true;

            case 'track-lead':
                if (userProfile.teamName !== teamName) return false;
                // Can access only employees who report to them
                // This simplified version - you might want to check reportsTo field
                return true;

            case 'employee':
                return false; // Employees can only see own data

            default:
                return false;
        }
    };

    // Get accessible teams for current user - Updated for Admin
    const getAccessibleTeams = () => {
        if (!userProfile) return [];

        switch (userProfile.role) {
            case 'admin':
                // Admin gets all teams - this will be handled by firebase.js
                return [];
            case 'tech-lead':
                return userProfile.managedTeams || [];
            case 'team-leader':
            case 'track-lead':
            case 'employee':
                return [userProfile.teamName];
            default:
                return [];
        }
    };

    // Check if user is admin
    const isAdmin = () => {
        return userProfile?.role === 'admin';
    };

    // Get password validation for UI
    const getPasswordValidation = (password) => {
        return validatePassword(password);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                await loadUserProfile(user.uid);
            } else {
                setCurrentUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userProfile,
        signUp,
        signIn,
        logout,
        loadUserProfile,
        canAccessTeam,
        canAccessEmployee,
        getAccessibleTeams,
        isAdmin,
        getPasswordValidation,
        getPasswordStrength,
        loading,
        error,
        showSnackbar
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};