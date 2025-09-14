// lib/firebase.js - Updated with user context filtering
import { db } from './firebaseConfig';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where
} from 'firebase/firestore';

// -------------------- PREDEFINED VALUES --------------------
const PREDEFINED_VALUES = {
    percentageCompletion: ['5', '10', '25', '40', '50', '65', '75', '85', '90', '100'],
    status: ['Completed', 'In Progress', 'On Hold'],
    workType: ['Full-day', 'Half-day', 'Relaxation']
};

// -------------------- USER MANAGEMENT --------------------

// Get user profile
export const getUserProfile = async (userId) => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
};

// Update user profile
export const updateUserProfile = async (userId, profileData) => {
    try {
        await setDoc(doc(db, 'users', userId), profileData, { merge: true });
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
};

// -------------------- TASKS WITH USER CONTEXT --------------------

export const addTask = async (task, userProfile) => {
    try {
        if (userProfile.role === 'tech-lead') {
            task.teamName = 'techLeads';
        }

        // Validate user can add task to this team/employee
        if (!canUserAccessEmployee(userProfile, task.teamName, task.empId)) {
            throw new Error('You do not have permission to add tasks for this employee');
        }

        // Rest of your existing logic...
        await initializeTeamDefaults(task.teamName);

        // Ensure date document exists
        const dateRef = doc(db, 'teams', task.teamName, 'dates', task.date);
        await setDoc(dateRef, { createdAt: new Date().toISOString() }, { merge: true });

        // Ensure employee document exists with name
        const empRef = doc(db, 'teams', task.teamName, 'dates', task.date, 'employees', task.empId);
        await setDoc(empRef, { name: task.empName }, { merge: true });

        // Auto-save new employee to team employees if not exists
        if (task.empId && task.empName) {
            await addTeamEmployee(task.teamName, task.empId, task.empName);
        }

        // Auto-save new client to team clients if not exists
        if (task.clientId && task.clientName) {
            await addTeamClient(task.teamName, task.clientId, task.clientName);
        }

        // Auto-save new project to team projects if not exists
        if (task.projectId && task.projectName) {
            await addTeamProject(task.teamName, task.projectId, task.projectName);
        }

        const docRef = await addDoc(
            collection(db, 'teams', task.teamName, 'dates', task.date, 'employees', task.empId, 'tasks'),
            { ...task, createdAt: new Date().toISOString(), createdBy: userProfile.empId }
        );

        // Return full task object with ID for consistency
        return {
            ...task,
            id: docRef.id,
            createdAt: new Date().toISOString(),
            createdBy: userProfile.empId
        };
    } catch (error) {
        console.error('Error adding task:', error);
        throw error;
    }
};

// Get tasks based on user permissions
export const getTasks = async (userProfile, teamFilter = null) => {
    try {
        if (!userProfile) {
            throw new Error('User profile is required');
        }

        let allTasks = [];

        // Determine which teams user can access
        let accessibleTeams;
        switch (userProfile.role) {
            case 'tech-lead':
                accessibleTeams = [...(userProfile.managedTeams || []), 'techLeads'];
                break;
            case 'team-leader':
            case 'employee':
                accessibleTeams = [userProfile.teamName];
                break;
            default:
                return [];
        }

        // Apply team filter if provided
        if (teamFilter && teamFilter !== 'all') {
            accessibleTeams = accessibleTeams.filter(team => team === teamFilter);
        }

        // Fetch tasks from accessible teams
        for (const teamName of accessibleTeams) {
            const datesSnapshot = await getDocs(collection(db, 'teams', teamName, 'dates'));

            for (const dateDoc of datesSnapshot.docs) {
                const date = dateDoc.id;
                const employeesSnapshot = await getDocs(
                    collection(db, 'teams', teamName, 'dates', date, 'employees')
                );

                for (const empDoc of employeesSnapshot.docs) {
                    const empId = empDoc.id;

                    // Check if user can access this employee's data
                    if (!canUserAccessEmployee(userProfile, teamName, empId)) {
                        continue;
                    }

                    const tasksSnapshot = await getDocs(
                        collection(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks')
                    );

                    const empTasks = tasksSnapshot.docs.map(taskDoc => ({
                        teamName,
                        date,
                        empId,
                        ...taskDoc.data(),
                        id: taskDoc.id
                    }));

                    allTasks = [...allTasks, ...empTasks];
                }
            }
        }

        return allTasks;
    } catch (error) {
        console.error('Error getting tasks:', error);
        throw error;
    }
};

// Update a task (with user permission check)
export const updateTask = async (teamName, date, empId, taskId, taskData, userProfile) => {
    try {
        // Check if user can update this task
        if (!canUserAccessEmployee(userProfile, teamName, empId)) {
            throw new Error('You do not have permission to update this task');
        }

        const taskRef = doc(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks', taskId);
        await updateDoc(taskRef, {
            ...taskData,
            updatedAt: new Date().toISOString(),
            updatedBy: userProfile.empId
        });
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
};

// Delete a task (with user permission check)
export const deleteTask = async (teamName, date, empId, taskId, userProfile) => {
    try {
        // Check if user can delete this task
        if (!canUserAccessEmployee(userProfile, teamName, empId)) {
            throw new Error('You do not have permission to delete this task');
        }

        const taskRef = doc(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks', taskId);
        await deleteDoc(taskRef);
    } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
};

// -------------------- PERMISSION HELPERS --------------------

// Check if user can access specific team
export const canUserAccessTeam = (userProfile, teamName) => {
    if (!userProfile) {
        console.log('No user profile provided');
        return false;
    }

    console.log(`Checking access for user ${userProfile.empId} (${userProfile.role}) to team ${teamName}`);

    switch (userProfile.role) {
        case 'tech-lead':
            // Tech leads can access:
            // 1. Teams they manage (from managedTeams array)
            // 2. The special 'techLeads' team for their personal tasks
            const canAccessManagedTeam = userProfile.managedTeams?.includes(teamName);
            const canAccessTechLeadsTeam = teamName === 'techLeads';
            const techLeadAccess = canAccessManagedTeam || canAccessTechLeadsTeam;

            console.log('Tech lead access check:', {
                managedTeams: userProfile.managedTeams,
                requestedTeam: teamName,
                canAccessManagedTeam,
                canAccessTechLeadsTeam,
                finalAccess: techLeadAccess
            });

            return techLeadAccess;

        case 'team-leader':
        case 'employee':
            const regularAccess = userProfile.teamName === teamName;
            console.log('Regular user access:', {
                userTeam: userProfile.teamName,
                requestedTeam: teamName,
                access: regularAccess
            });
            return regularAccess;

        default:
            console.log('Unknown role:', userProfile.role);
            return false;
    }
};

// Check if user can access specific employee's data
export const canUserAccessEmployee = (userProfile, teamName, empId) => {
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
export const getAccessibleTeams = (userProfile) => {
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



// -------------------- FILTER BASED ON ROLES --------------------


export const getFilterOptions = async (userProfile) => {
    try {
        const options = {
            teamLeaders: [],
            employees: [],
            teams: []
        };

        if (!userProfile) return options;

        if (userProfile.role === 'tech-lead') {
            // Tech leads can filter by teams they manage, team leaders, and employees
            options.teams = userProfile.managedTeams || [];

            // Get team leaders and employees from managed teams
            const teamLeadersSet = new Set();
            const employeesSet = new Set();

            for (const teamName of userProfile.managedTeams) {
                try {
                    // Get team leaders
                    const teamLeadersQuery = query(
                        collection(db, 'users'),
                        where('role', '==', 'team-leader'),
                        where('teamName', '==', teamName)
                    );
                    const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
                    teamLeadersSnapshot.forEach(doc => {
                        const data = doc.data();
                        teamLeadersSet.add(JSON.stringify({
                            empId: data.empId,
                            empName: data.empName,
                            teamName: data.teamName
                        }));
                    });

                    // Get employees
                    const employeesQuery = query(
                        collection(db, 'users'),
                        where('role', '==', 'employee'),
                        where('teamName', '==', teamName)
                    );
                    const employeesSnapshot = await getDocs(employeesQuery);
                    employeesSnapshot.forEach(doc => {
                        const data = doc.data();
                        employeesSet.add(JSON.stringify({
                            empId: data.empId,
                            empName: data.empName,
                            teamName: data.teamName
                        }));
                    });
                } catch (error) {
                    console.error(`Error loading data for team ${teamName}:`, error);
                }
            }

            options.teamLeaders = Array.from(teamLeadersSet).map(item => JSON.parse(item));
            options.employees = Array.from(employeesSet).map(item => JSON.parse(item));

        } else if (userProfile.role === 'team-leader') {
            // Team leaders can filter by employees in their team + themselves
            try {
                const employees = [];

                // Add themselves as an option to filter their own tasks
                employees.push({
                    empId: userProfile.empId,
                    empName: `${userProfile.empName} (Me)`,
                    teamName: userProfile.teamName,
                    isCurrentUser: true
                });

                // Get employees in their team
                const employeesQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'employee'),
                    where('teamName', '==', userProfile.teamName)
                );
                const employeesSnapshot = await getDocs(employeesQuery);
                employeesSnapshot.forEach(doc => {
                    const data = doc.data();
                    employees.push({
                        empId: data.empId,
                        empName: data.empName,
                        teamName: data.teamName,
                        isCurrentUser: false
                    });
                });

                options.employees = employees;
            } catch (error) {
                console.error('Error loading employees:', error);
            }
        }
        // Employees only get date filters (no additional options needed)

        return options;
    } catch (error) {
        console.error('Error loading filter options:', error);
        return { teamLeaders: [], employees: [], teams: [] };
    }
};

export const applyTaskFilters = (tasks, filters, userProfile) => {
    if (!tasks || tasks.length === 0) return tasks;

    let filteredTasks = [...tasks];

    // Date range filter
    if (filters.dateFrom) {
        filteredTasks = filteredTasks.filter(task => task.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
        filteredTasks = filteredTasks.filter(task => task.date <= filters.dateTo);
    }

    // Team filter (tech leads only)
    if (filters.team && userProfile.role === 'tech-lead') {
        filteredTasks = filteredTasks.filter(task => task.teamName === filters.team);
    }

    // Team leader filter (tech leads only)
    if (filters.teamLeader && userProfile.role === 'tech-lead') {
        // Find tasks created by employees who report to this team leader
        filteredTasks = filteredTasks.filter(task => {
            // This requires checking if the task's empId reports to the selected team leader
            // For now, we'll filter by team since team leaders manage specific teams
            return task.empId === filters.teamLeader ||
                (task.teamName && getTeamLeaderForTeam(task.teamName) === filters.teamLeader);
        });
    }

    // Employee filter (tech leads and team leaders)
    if (filters.employee && (userProfile.role === 'tech-lead' || userProfile.role === 'team-leader')) {
        filteredTasks = filteredTasks.filter(task => task.empId === filters.employee);
    }

    return filteredTasks;
};


// Helper function to get team leader for a team
const getTeamLeaderForTeam = async (teamName) => {
    try {
        const teamDoc = await getDoc(doc(db, 'teams', teamName));
        if (teamDoc.exists() && teamDoc.data().teamLeaderId) {
            return teamDoc.data().teamLeaderId;
        }
        return null;
    } catch (error) {
        console.error('Error getting team leader for team:', teamName, error);
        return null;
    }
};

// Get filtered tasks with all applied filters
export const getFilteredTasks = async (userProfile, filters = {}) => {
    try {
        // First get all accessible tasks
        const allTasks = await getTasks(userProfile);

        // Then apply filters
        const filteredTasks = applyTaskFilters(allTasks, filters, userProfile);

        return filteredTasks;
    } catch (error) {
        console.error('Error getting filtered tasks:', error);
        throw error;
    }
};



// -------------------- DROPDOWNS WITH USER CONTEXT --------------------

// Get dropdown data for a team (with user permission check)
export const getTeamDropdownData = async (teamName, field, userProfile) => {
    try {
        // Check if user can access this team
        if (!canUserAccessTeam(userProfile, teamName)) {
            throw new Error('You do not have permission to access this team data');
        }

        // Return predefined values for specific fields - same for all users
        if (PREDEFINED_VALUES[field]) {
            return PREDEFINED_VALUES[field];
        }

        // For custom dropdown data, fetch from Firestore
        const docRef = doc(db, 'teams', teamName, 'dropdownData', field);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().values || [];
        }
        return [];
    } catch (error) {
        console.error('Error getting team dropdown data:', error);
        // Always return predefined values as fallback
        return PREDEFINED_VALUES[field] || [];
    }
};

// Save dropdown data for a team (with user permission check)
export const saveTeamDropdownData = async (teamName, field, values, userProfile) => {
    try {
        // Check if user can modify this team data (only team leaders and tech leads)
        if (!canUserAccessTeam(userProfile, teamName) || userProfile.role === 'employee') {
            throw new Error('You do not have permission to modify team data');
        }

        // Don't save predefined values to database
        if (PREDEFINED_VALUES[field]) {
            console.warn(`Cannot save predefined values for field: ${field}`);
            return;
        }

        const docRef = doc(db, 'teams', teamName, 'dropdownData', field);
        await setDoc(docRef, { values }, { merge: true });
    } catch (error) {
        console.error('Error saving team dropdown data:', error);
        throw error;
    }
};

// -------------------- TEAMS WITH USER CONTEXT --------------------

// Get teams accessible to user
export const getTeams = async (userProfile) => {
    try {
        if (!userProfile) return [];
        return getAccessibleTeams(userProfile);
    } catch (error) {
        console.error('Error getting teams:', error);
        return [];
    }
};

// -------------------- PROJECTS WITH USER CONTEXT --------------------

// Get team-specific projects (with user permission check)
export const getTeamProjects = async (teamName, userProfile) => {
    try {
        if (!canUserAccessTeam(userProfile, teamName)) {
            return [];
        }
        return await getTeamDropdownData(teamName, 'projects', userProfile);
    } catch (error) {
        console.error('Error getting team projects:', error);
        return [];
    }
};

// Add new project to team (with user permission check)
export const addTeamProject = async (teamName, projectId, projectName, userProfile) => {
    try {
        if (!projectId || !projectName) return;

        if (!canUserAccessTeam(userProfile, teamName) || userProfile.role === 'employee') {
            return; // Silently fail for employees
        }

        const projects = await getTeamProjects(teamName, userProfile);
        const exists = projects.find(p => p.id === projectId);
        if (!exists) {
            const newProjects = [...projects, { id: projectId, name: projectName }];
            await saveTeamDropdownData(teamName, 'projects', newProjects, userProfile);
        }
    } catch (error) {
        console.error('Error adding team project:', error);
        // Don't throw error to prevent task creation failure
    }
};

// -------------------- EMPLOYEES WITH USER CONTEXT --------------------

// Get team-specific employees (with user permission check)
export const getTeamEmployees = async (teamName, userProfile) => {
    try {
        if (!canUserAccessTeam(userProfile, teamName)) {
            return [];
        }
        return await getTeamDropdownData(teamName, 'employees', userProfile);
    } catch (error) {
        console.error('Error getting team employees:', error);
        return [];
    }
};

// Add new employee to team (with user permission check)
export const addTeamEmployee = async (teamName, empId, empName, userProfile) => {
    try {
        if (!empId || !empName) return;

        if (!canUserAccessTeam(userProfile, teamName) || userProfile.role === 'employee') {
            return; // Silently fail for employees
        }

        const employees = await getTeamEmployees(teamName, userProfile);
        const exists = employees.find(e => e.id === empId);
        if (!exists) {
            const newEmployees = [...employees, { id: empId, name: empName }];
            await saveTeamDropdownData(teamName, 'employees', newEmployees, userProfile);
        }
    } catch (error) {
        console.error('Error adding team employee:', error);
        // Don't throw error to prevent task creation failure
    }
};

// -------------------- CLIENTS WITH USER CONTEXT --------------------

// Get team-specific clients (with user permission check)
export const getTeamClients = async (teamName, userProfile) => {
    try {
        if (!canUserAccessTeam(userProfile, teamName)) {
            return [];
        }
        return await getTeamDropdownData(teamName, 'clients', userProfile);
    } catch (error) {
        console.error('Error getting team clients:', error);
        return [];
    }
};

// Add new client to team (with user permission check)
export const addTeamClient = async (teamName, clientId, clientName, userProfile) => {
    try {
        if (!clientId || !clientName) return;

        if (!canUserAccessTeam(userProfile, teamName) || userProfile.role === 'employee') {
            return; // Silently fail for employees
        }

        const clients = await getTeamClients(teamName, userProfile);
        const exists = clients.find(c => c.id === clientId);
        if (!exists) {
            const newClients = [...clients, { id: clientId, name: clientName }];
            await saveTeamDropdownData(teamName, 'clients', newClients, userProfile);
        }
    } catch (error) {
        console.error('Error adding team client:', error);
        // Don't throw error to prevent task creation failure
    }
};

// -------------------- UTILITY FUNCTIONS --------------------

// Get predefined values for a specific field
export const getPredefinedValues = (field) => {
    return PREDEFINED_VALUES[field] || [];
};

// Check if field has predefined values
export const isPredefinedField = (field) => {
    return !!PREDEFINED_VALUES[field];
};

// Check if team document exists
export const teamExists = async (teamName) => {
    try {
        const teamDoc = await getDoc(doc(db, 'teams', teamName));
        return teamDoc.exists();
    } catch (error) {
        return false;
    }
};

// Initialize default dropdown values for a team (only if team doesn't exist yet)
export const initializeTeamDefaults = async (teamName) => {
    try {
        const exists = await teamExists(teamName);
        if (!exists) {
            await setDoc(doc(db, 'teams', teamName), { createdAt: new Date().toISOString() });
        }
    } catch (error) {
        console.error('Error initializing team defaults:', error);
        throw error;
    }
};