// contexts/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
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

    // Sign up user with profile data
    const signUp = async (email, password, profileData) => {
        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            // Create user profile in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email,
                name: profileData.empName,
                role: profileData.role,
                teamName: profileData.teamName,
                empId: profileData.empId,
                empName: profileData.empName,
                managedTeams: profileData.managedTeams || [],
                createdAt: new Date().toISOString()
            });

            return user;
        } catch (error) {
            console.error('Error signing up:', error);
            throw error;
        }
    };

    // Sign in user
    const signIn = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
        } catch (error) {
            console.error('Error signing in:', error);
            throw error;
        }
    };

    // Sign out user
    const logout = async () => {
        try {
            await signOut(auth);
            setUserProfile(null);
        } catch (error) {
            console.error('Error signing out:', error);
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
            return null;
        }
    };

    // Check if user can access team data
    const canAccessTeam = (teamName) => {
        if (!userProfile) return false;

        switch (userProfile.role) {
            case 'tech-lead':
                return userProfile.managedTeams.includes(teamName);
            case 'team-leader':
            case 'employee':
                return userProfile.teamName === teamName;
            default:
                return false;
        }
    };

    // Check if user can access employee data
    const canAccessEmployee = (teamName, empId) => {
        if (!userProfile) return false;

        switch (userProfile.role) {
            case 'tech-lead':
                return userProfile.managedTeams.includes(teamName);
            case 'team-leader':
                return userProfile.teamName === teamName;
            case 'employee':
                return userProfile.teamName === teamName && userProfile.empId === empId;
            default:
                return false;
        }
    };

    // Get accessible teams for current user
    const getAccessibleTeams = () => {
        if (!userProfile) return [];

        switch (userProfile.role) {
            case 'tech-lead':
                return userProfile.managedTeams;
            case 'team-leader':
            case 'employee':
                return [userProfile.teamName];
            default:
                return [];
        }
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
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};