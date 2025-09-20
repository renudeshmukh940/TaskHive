// lib/firebase.js - Updated with user context filtering
import { db } from './firebaseConfig';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where
} from 'firebase/firestore';
import { format } from "date-fns";

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

// lib/firebase.js - Keep addTask for new tasks only
export const addTask = async (task, userProfile) => {
    try {
        if (userProfile.role === 'tech-lead') {
            task.teamName = 'techLeads';
        }

        // Validate user can add task to this team/employee
        if (!canUserAccessEmployee(userProfile, task.teamName, task.empId)) {
            throw new Error('You do not have permission to add tasks for this employee');
        }

        // Create the default team name...
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

        const taskData = {
            ...task,
            createdAt: new Date().toISOString(),
            createdBy: userProfile.empId
        };

        const docRef = await addDoc(
            collection(db, 'teams', task.teamName, 'dates', task.date, 'employees', task.empId, 'tasks'),
            taskData
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

// Update the existing updateTask function to handle auto-save logic
export const updateTask = async (teamName, date, empId, taskId, taskData, userProfile) => {
    try {
        // Check if user can update this task
        if (!canUserAccessEmployee(userProfile, teamName, empId)) {
            throw new Error('You do not have permission to update this task');
        }

        // Auto-save new employee to team employees if not exists
        if (taskData.empId && taskData.empName) {
            await addTeamEmployee(teamName, taskData.empId, taskData.empName);
        }

        // Auto-save new client to team clients if not exists
        if (taskData.clientId && taskData.clientName) {
            await addTeamClient(teamName, taskData.clientId, taskData.clientName);
        }

        // Auto-save new project to team projects if not exists
        if (taskData.projectId && taskData.projectName) {
            await addTeamProject(teamName, taskData.projectId, taskData.projectName);
        }

        const taskRef = doc(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks', taskId);
        await updateDoc(taskRef, {
            ...taskData,
            updatedAt: new Date().toISOString(),
            updatedBy: userProfile.empId
        });

        // Return the updated task data for consistency
        return {
            ...taskData,
            id: taskId,
            teamName,
            date,
            empId,
            updatedAt: new Date().toISOString(),
            updatedBy: userProfile.empId
        };
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
};

export const getTasks = async (userProfile, teamFilter = null) => {
    try {
        if (!userProfile) {
            throw new Error('User profile is required');
        }

        let allTasks = [];
        const today = format(new Date(), 'yyyy-MM-dd');

        // Determine which teams user can access
        let accessibleTeams;
        switch (userProfile.role) {
            case 'tech-lead':
                accessibleTeams = [...(userProfile.managedTeams || []), 'techLeads'];
                break;
            case 'team-leader':
            case 'track-lead':
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

        console.log(`Fetching today's tasks for ${userProfile.role} (${userProfile.empId}) from teams:`, accessibleTeams);

        // Fetch tasks from accessible teams for TODAY only
        for (const teamName of accessibleTeams) {
            try {
                const employeesSnapshot = await getDocs(
                    collection(db, 'teams', teamName, 'dates', today, 'employees')
                );

                for (const empDoc of employeesSnapshot.docs) {
                    const empId = empDoc.id;

                    // Check access
                    const canAccess = await canUserAccessEmployee(userProfile, teamName, empId);

                    if (!canAccess) {
                        console.log(`Access denied for ${userProfile.role} (${userProfile.empId}) to employee ${empId} in team ${teamName}`);
                        continue;
                    }

                    console.log(`Access granted for ${userProfile.role} (${userProfile.empId}) to employee ${empId} in team ${teamName}`);

                    const tasksSnapshot = await getDocs(
                        collection(db, 'teams', teamName, 'dates', today, 'employees', empId, 'tasks')
                    );

                    const empTasks = tasksSnapshot.docs.map(taskDoc => ({
                        teamName,
                        date: today,
                        empId,
                        ...taskDoc.data(),
                        id: taskDoc.id
                    }));

                    allTasks = [...allTasks, ...empTasks];
                    console.log(`Found ${empTasks.length} tasks for employee ${empId} on ${today}`);
                }
            } catch (teamError) {
                console.error(`Error fetching tasks for team ${teamName}:`, teamError);
            }
        }

        console.log(`Total today's tasks fetched for ${userProfile.role}: ${allTasks.length}`);
        return allTasks.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error getting tasks:', error);
        throw error;
    }
};

// // Update a task (with user permission check)
// export const updateTask = async (teamName, date, empId, taskId, taskData, userProfile) => {
//     try {
//         // Check if user can update this task
//         if (!canUserAccessEmployee(userProfile, teamName, empId)) {
//             throw new Error('You do not have permission to update this task');
//         }

//         const taskRef = doc(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks', taskId);
//         await updateDoc(taskRef, {
//             ...taskData,
//             updatedAt: new Date().toISOString(),
//             updatedBy: userProfile.empId
//         });
//     } catch (error) {
//         console.error('Error updating task:', error);
//         throw error;
//     }
// };

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
        case 'track-lead': // ← Track-Lead can access their own team
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
export const canUserAccessEmployee = async (userProfile, teamName, targetEmpId) => {
    if (!userProfile) return false;
    if (userProfile.teamName !== teamName && userProfile.role !== 'tech-lead') {
        return false;
    }

    switch (userProfile.role) {
        case 'tech-lead':
            return userProfile.managedTeams?.includes(teamName);
        case 'team-leader':
            if (userProfile.teamName !== teamName) return false;
            return true;

        case 'track-lead':
            if (userProfile.teamName !== teamName) return false;
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('empId', '==', targetEmpId)
                );
                const snapshot = await getDocs(usersQuery);
                if (snapshot.empty) return false;
                const targetUser = snapshot.docs[0].data();
                const canAccess = targetUser.empId === userProfile.empId ||
                    (targetUser.role === 'employee' && targetUser.reportsTo === userProfile.empId);

                return canAccess;
            } catch (error) {
                console.error('Error checking employee access:', error);
                return false;
            }

        case 'employee':
            return userProfile.teamName === teamName && userProfile.empId === targetEmpId;
        default:
            return false;
    }
};


// Get accessible teams for current user
export const getAccessibleTeams = (userProfile) => {
    if (!userProfile) return [];

    switch (userProfile.role) {
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



// -------------------- FILTER BASED ON ROLES --------------------


export const getFilterOptions = async (userProfile) => {
    try {
        const options = {
            techLeads: [],
            teamLeaders: [],
            trackLeads: [],
            employees: [],
            teams: []
        };

        if (!userProfile) return options;

        if (userProfile.role === 'tech-lead') {
            // Tech leads can filter by everything in their managed teams
            options.teams = userProfile.managedTeams || [];

            // Use Set for deduplication like old logic
            const techLeadsSet = new Set();
            const teamLeadersSet = new Set();
            const trackLeadsSet = new Set();
            const employeesSet = new Set();

            for (const teamName of userProfile.managedTeams) {
                try {
                    // Get all users in this team (more efficient than separate queries)
                    const usersQuery = query(
                        collection(db, 'users'),
                        where('teamName', '==', teamName)
                    );
                    const usersSnapshot = await getDocs(usersQuery);

                    usersSnapshot.forEach(doc => {
                        const data = doc.data();
                        const userData = {
                            empId: data.empId,
                            empName: data.empName,
                            teamName: data.teamName
                        };

                        // Create unique key for deduplication
                        const key = `${data.role}-${data.empId}`;

                        switch (data.role) {
                            case 'tech-lead':
                                if (!techLeadsSet.has(key)) {
                                    techLeadsSet.add(JSON.stringify(userData));
                                }
                                break;
                            case 'team-leader':
                                if (!teamLeadersSet.has(key)) {
                                    teamLeadersSet.add(JSON.stringify(userData));
                                }
                                break;
                            case 'track-lead':
                                if (!trackLeadsSet.has(key)) {
                                    trackLeadsSet.add(JSON.stringify(userData));
                                }
                                break;
                            case 'employee':
                                if (!employeesSet.has(key)) {
                                    employeesSet.add(JSON.stringify(userData));
                                }
                                break;
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching data for team ${teamName}:`, error);
                }
            }

            // Convert sets back to arrays with consistent structure
            options.techLeads = Array.from(techLeadsSet).map(JSON.parse);
            options.teamLeaders = Array.from(teamLeadersSet).map(JSON.parse);
            options.trackLeads = Array.from(trackLeadsSet).map(JSON.parse);
            options.employees = Array.from(employeesSet).map(JSON.parse);

        } else if (userProfile.role === 'team-leader') {
            // Team leaders can filter by track-leads and employees in their team
            options.teams = [userProfile.teamName];

            try {
                // Get track-leads - Use Set for consistency
                const trackLeadsSet = new Set();
                const trackLeadsQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'track-lead'),
                    where('teamName', '==', userProfile.teamName)
                );
                const trackLeadsSnapshot = await getDocs(trackLeadsQuery);
                trackLeadsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const userData = {
                        empId: data.empId,
                        empName: data.empName,
                        teamName: data.teamName
                    };
                    const key = `${data.role}-${data.empId}`;
                    if (!trackLeadsSet.has(key)) {
                        trackLeadsSet.add(JSON.stringify(userData));
                    }
                });
                options.trackLeads = Array.from(trackLeadsSet).map(JSON.parse);

                // Get employees - Use Set for consistency
                const employeesSet = new Set();
                const employeesQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'employee'),
                    where('teamName', '==', userProfile.teamName)
                );
                const employeesSnapshot = await getDocs(employeesQuery);
                employeesSnapshot.forEach(doc => {
                    const data = doc.data();
                    const userData = {
                        empId: data.empId,
                        empName: data.empName,
                        teamName: data.teamName
                    };
                    const key = `${data.role}-${data.empId}`;
                    if (!employeesSet.has(key)) {
                        employeesSet.add(JSON.stringify(userData));
                    }
                });
                options.employees = Array.from(employeesSet).map(JSON.parse);

            } catch (error) {
                console.error('Error fetching team-leader filter options:', error);
                options.trackLeads = [];
                options.employees = [];
            }

        } else if (userProfile.role === 'track-lead') {
            // Track leads can filter by their direct reports (employees)
            options.teams = [userProfile.teamName];

            try {
                // Get employees who report to this track-lead - hierarchy-aware
                const employeesSet = new Set();
                const employeesQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'employee'),
                    where('teamName', '==', userProfile.teamName),
                    where('reportsTo', '==', userProfile.empId)
                );
                const employeesSnapshot = await getDocs(employeesQuery);
                employeesSnapshot.forEach(doc => {
                    const data = doc.data();
                    const userData = {
                        empId: data.empId,
                        empName: data.empName,
                        teamName: data.teamName
                    };
                    const key = `${data.role}-${data.empId}`;
                    if (!employeesSet.has(key)) {
                        employeesSet.add(JSON.stringify(userData));
                    }
                });
                options.employees = Array.from(employeesSet).map(JSON.parse);
            } catch (error) {
                console.error('Error fetching track-lead filter options:', error);
                options.employees = [];
            }

        } else if (userProfile.role === 'employee') {
            // Employees can only filter by themselves
            options.teams = [userProfile.teamName];
            options.employees = [{
                empId: userProfile.empId,
                empName: userProfile.empName,
                teamName: userProfile.teamName
            }];
        }

        return options;
    } catch (error) {
        console.error('Error getting filter options:', error);
        return {
            techLeads: [],
            teamLeaders: [],
            trackLeads: [],
            employees: [],
            teams: []
        };
    }
};


// -------------------- Get Weekly Task For Current User Only!!! --------------------

export const getTasksForDateRange = async (userProfile, startDate, endDate, teamFilter = null, empIdFilter = null) => {
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
            case 'track-lead':
            case 'employee':
                accessibleTeams = [userProfile.teamName];
                break;
            default:
                return [];
        }

        // Apply team filter if provided and accessible
        if (teamFilter && accessibleTeams.includes(teamFilter)) {
            accessibleTeams = [teamFilter];
        } else if (teamFilter) {
            return []; // Invalid team filter
        }

        // Generate date range
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const date = format(d, 'yyyy-MM-dd');

            // Fetch tasks from accessible teams for this date
            for (const teamName of accessibleTeams) {
                try {
                    const employeesSnapshot = await getDocs(
                        collection(db, 'teams', teamName, 'dates', date, 'employees')
                    );

                    for (const empDoc of employeesSnapshot.docs) {
                        const empId = empDoc.id;

                        // Apply empIdFilter if provided
                        if (empIdFilter && empId !== empIdFilter) {
                            continue;
                        }

                        // Check access
                        const canAccess = await canUserAccessEmployee(userProfile, teamName, empId);

                        if (!canAccess) {
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
                } catch (teamError) {
                    console.error(`Error fetching tasks for team ${teamName} on ${date}:`, teamError);
                }
            }
        }

        return allTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
        console.error('Error getting tasks for date range:', error);
        throw error;
    }
};

export const applyTaskFilters = (tasks, filters, userProfile) => {
    if (!tasks || tasks.length === 0) return tasks;

    let filteredTasks = [...tasks];

    // Status filter
    if (filters.status) {
        filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }

    // Work type filter
    if (filters.workType) {
        filteredTasks = filteredTasks.filter(task => task.workType === filters.workType);
    }

    // Progress filter
    if (filters.percentageCompletion) {
        const [min, max] = filters.percentageCompletion.split('-').map(Number);
        filteredTasks = filteredTasks.filter(task => {
            const progress = parseInt(task.percentageCompletion) || 0;
            return progress >= min && progress <= max;
        });
    }

    // Team filter (only for tech leads)
    if (filters.team && userProfile.role === 'tech-lead') {
        filteredTasks = filteredTasks.filter(task => task.teamName === filters.team);
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