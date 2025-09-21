// lib/firebase.js - Updated with user context filtering
import { db } from './firebaseConfig';
import {
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, query, where
} from 'firebase/firestore';
import { format, addDays } from "date-fns";

// -------------------- PREDEFINED VALUES --------------------
const PREDEFINED_VALUES = {
    percentageCompletion: ['5', '10', '25', '40', '50', '65', '75', '85', '90', '100'],
    status: ['Completed', 'In Progress', 'On Hold'],
    workType: ['Full-day', 'Half-day', 'Relaxation']
};


// -------------------- ADMIN MANAGEMENT --------------------
const ADMIN_ACCESS_CODE = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE || 'ADMIN2024';

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

        // Admin cannot create tasks
        if (userProfile.role === 'admin') {
            throw new Error('Admin users cannot create tasks');
        }

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

        const taskData = {
            ...task,
            createdAt: new Date().toISOString(),
            createdBy: userProfile.empId
        };

        // First create the task
        const docRef = await addDoc(
            collection(db, 'teams', task.teamName, 'dates', task.date, 'employees', task.empId, 'tasks'),
            taskData
        );

        // ONLY AFTER successful task creation, save the dropdown values
        try {
            // Auto-save new employee to team employees if not exists
            if (task.empId && task.empName) {
                await addTeamEmployee(task.teamName, task.empId, task.empName, userProfile);
            }

            // Auto-save new client to team clients if not exists
            if (task.clientId && task.clientName) {
                await addTeamClient(task.teamName, task.clientId, task.clientName, userProfile);
            }

            // Auto-save new project to team projects if not exists
            if (task.projectId && task.projectName) {
                await addTeamProject(task.teamName, task.projectId, task.projectName, userProfile);
            }
        } catch (dropdownError) {
            // Don't fail the task creation if dropdown save fails
            console.warn('Warning: Failed to save dropdown values:', dropdownError);
        }

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

        // Admin cannot update tasks
        if (userProfile.role === 'admin') {
            throw new Error('Admin users cannot update tasks');
        }

        // Check if user can update this task
        if (!canUserAccessEmployee(userProfile, teamName, empId)) {
            throw new Error('You do not have permission to update this task');
        }

        const taskRef = doc(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks', taskId);

        // First update the task
        await updateDoc(taskRef, {
            ...taskData,
            updatedAt: new Date().toISOString(),
            updatedBy: userProfile.empId
        });

        // ONLY AFTER successful task update, save the dropdown values
        try {
            // Auto-save new employee to team employees if not exists
            if (taskData.empId && taskData.empName) {
                await addTeamEmployee(teamName, taskData.empId, taskData.empName, userProfile);
            }

            // Auto-save new client to team clients if not exists
            if (taskData.clientId && taskData.clientName) {
                await addTeamClient(teamName, taskData.clientId, taskData.clientName, userProfile);
            }

            // Auto-save new project to team projects if not exists
            if (taskData.projectId && taskData.projectName) {
                await addTeamProject(teamName, taskData.projectId, taskData.projectName, userProfile);
            }
        } catch (dropdownError) {
            // Don't fail the task update if dropdown save fails
            console.warn('Warning: Failed to save dropdown values:', dropdownError);
        }

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
            case 'admin':
                const teamsSnapshot = await getDocs(collection(db, 'teams'));
                accessibleTeams = teamsSnapshot.docs.map(doc => doc.id);
                break;
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

        // Admin cannot delete tasks
        if (userProfile.role === 'admin') {
            throw new Error('Admin users cannot delete tasks');
        }

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
    if (!userProfile) return false;

    // Admin can access all teams
    if (userProfile.role === 'admin') {
        return true;
    }

    switch (userProfile.role) {
        case 'tech-lead':
            const canAccessManagedTeam = userProfile.managedTeams?.includes(teamName);
            const canAccessTechLeadsTeam = teamName === 'techLeads';
            const techLeadAccess = canAccessManagedTeam || canAccessTechLeadsTeam;

            return techLeadAccess;

        case 'team-leader':
        case 'track-lead':
        case 'employee':
            const regularAccess = userProfile.teamName === teamName;
            console.log('Regular user access:', {
                userTeam: userProfile.teamName,
                requestedTeam: teamName,
                access: regularAccess
            });
            return regularAccess;
        default:
            return false;
    }
};


// Updated getAdminDashboardStats with date range support
export const getAdminDashboardStats = async (startDate, endDate) => {
    try {
        const stats = {
            totalTeams: 0,
            totalEmployees: 0,
            totalTasks: 0,
            totalProjects: 0,
            teamBreakdown: [],
            projectStatus: {  // Actually task status
                completed: 0,
                inProgress: 0,
                onHold: 0
            },
            timeByProject: {},
            recentActivity: [],
            topPerformers: [],
            dateRange: {
                start: startDate,
                end: endDate,
                days: 1  // Will be calculated
            }
        };

        // Calculate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        stats.dateRange.days = diffDays;

        // Get all teams (static, not date-dependent)
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        stats.totalTeams = teamsSnapshot.size;

        // Get total employees from users collection (static)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        stats.totalEmployees = usersSnapshot.size;

        // Process each date in the range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const date = format(d, 'yyyy-MM-dd');
            console.log(`Processing date: ${date}`);

            // Get all teams for this date
            const teamsSnapshot = await getDocs(collection(db, 'teams'));

            for (const teamDoc of teamsSnapshot.docs) {
                const teamName = teamDoc.id;

                try {
                    // Get employees for this date in this team
                    const dateEmployeesSnapshot = await getDocs(
                        collection(db, 'teams', teamName, 'dates', date, 'employees')
                    );

                    for (const empDoc of dateEmployeesSnapshot.docs) {
                        const empId = empDoc.id;
                        const empData = empDoc.data();
                        const empName = empData.name || empId;

                        const tasksSnapshot = await getDocs(
                            collection(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks')
                        );

                        const empTaskCount = tasksSnapshot.size;
                        stats.totalTasks += empTaskCount;

                        let empHours = 0;

                        // Process each task
                        tasksSnapshot.docs.forEach(taskDoc => {
                            const task = taskDoc.data();

                            // Compute hours based on workType
                            let hours = 0;
                            if (task.workType === 'Full-day') hours = 8;
                            else if (task.workType === 'Half-day') hours = 4;
                            else if (task.workType === 'Relaxation') hours = 0;

                            empHours += hours;

                            // Update time by project
                            const projectKey = `${task.projectName || 'Unknown'}-${task.projectId || 'Unknown'}`;
                            stats.timeByProject[projectKey] = (stats.timeByProject[projectKey] || 0) + hours;

                            // Update status counts
                            if (task.status === 'Completed') {
                                stats.projectStatus.completed++;
                            } else if (task.status === 'In Progress') {
                                stats.projectStatus.inProgress++;
                            } else if (task.status === 'On Hold') {
                                stats.projectStatus.onHold++;
                            }
                        });

                        // Add to recent activity (aggregate by team)
                        const existingActivity = stats.recentActivity.find(activity => activity.team === teamName);
                        if (existingActivity) {
                            existingActivity.tasks += empTaskCount;
                            existingActivity.hours = (parseFloat(existingActivity.hours) + empHours).toFixed(1);
                        } else if (empTaskCount > 0) {
                            stats.recentActivity.push({
                                team: teamName,
                                tasks: empTaskCount,
                                hours: empHours.toFixed(1)
                            });
                        }

                        // Add to top performers (aggregate by employee)
                        const existingPerformer = stats.topPerformers.find(performer => performer.empId === empId);
                        if (existingPerformer) {
                            existingPerformer.tasks += empTaskCount;
                            existingPerformer.hours += empHours;
                        } else if (empTaskCount > 0) {
                            stats.topPerformers.push({
                                empId,
                                empName,
                                tasks: empTaskCount,
                                hours: empHours
                            });
                        }
                    }
                } catch (teamError) {
                    console.error(`Error processing team ${teamName} on ${date}:`, teamError);
                }
            }
        }

        // Update team breakdown with date range data
        for (const teamDoc of teamsSnapshot.docs) {
            const teamName = teamDoc.id;
            const teamStats = {
                name: teamName,
                employeeCount: 0,
                tasksTotal: 0,  // Renamed from tasksToday
                projects: {
                    completed: 0,
                    inProgress: 0,
                    onHold: 0,
                    totalTime: 0
                },
                projectCount: 0
            };

            try {
                let teamMembersQuery;
                if (teamName === 'techLeads') {
                    // For techLeads team: query by role (teamName is null for tech-leads)
                    teamMembersQuery = query(
                        collection(db, 'users'),
                        where('role', '==', 'tech-lead')
                    );
                } else {
                    // For regular teams: query by teamName and role
                    teamMembersQuery = query(
                        collection(db, 'users'),
                        where('teamName', '==', teamName),
                        where('role', 'in', ['track-lead', 'employee'])
                    );
                }
                const teamMembersSnapshot = await getDocs(teamMembersQuery);
                teamStats.employeeCount = teamMembersSnapshot.size;

                // Get team projects from dropdownData (static)
                const projDoc = await getDoc(doc(db, 'teams', teamName, 'dropdownData', 'projects'));
                teamStats.projectCount = projDoc.exists() ? (projDoc.data().values || []).length : 0;
                stats.totalProjects += teamStats.projectCount;

                // Calculate team-specific stats for the date range
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const date = format(d, 'yyyy-MM-dd');
                    try {
                        const dateEmployeesSnapshot = await getDocs(
                            collection(db, 'teams', teamName, 'dates', date, 'employees')
                        );

                        let teamHours = 0;
                        let teamCompleted = 0;
                        let teamInProgress = 0;
                        let teamOnHold = 0;

                        for (const empDoc of dateEmployeesSnapshot.docs) {
                            const empId = empDoc.id;
                            const tasksSnapshot = await getDocs(
                                collection(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks')
                            );

                            const empTaskCount = tasksSnapshot.size;
                            teamStats.tasksTotal += empTaskCount;

                            tasksSnapshot.docs.forEach(taskDoc => {
                                const task = taskDoc.data();
                                let hours = 0;
                                if (task.workType === 'Full-day') hours = 8;
                                else if (task.workType === 'Half-day') hours = 4;
                                else if (task.workType === 'Relaxation') hours = 0;

                                teamHours += hours;

                                if (task.status === 'Completed') teamCompleted++;
                                else if (task.status === 'In Progress') teamInProgress++;
                                else if (task.status === 'On Hold') teamOnHold++;
                            });
                        }

                        teamStats.projects.totalTime += teamHours;
                        teamStats.projects.completed += teamCompleted;
                        teamStats.projects.inProgress += teamInProgress;
                        teamStats.projects.onHold += teamOnHold;

                    } catch (dateError) {
                        console.warn(`No data for ${teamName} on ${date}:`, dateError.message);
                    }
                }

            } catch (error) {
                console.warn(`Error processing team breakdown for ${teamName}:`, error.message);
            }

            stats.teamBreakdown.push(teamStats);
        }

        // Sort top performers by tasks descending
        stats.topPerformers.sort((a, b) => b.tasks - a.tasks);

        console.log(`Dashboard stats loaded for ${startDate} to ${endDate}:`, {
            totalTasks: stats.totalTasks,
            totalProjects: stats.totalProjects,
            totalHours: stats.recentActivity.reduce((sum, activity) => sum + parseFloat(activity.hours), 0)
        });

        return stats;
    } catch (error) {
        console.error('Error getting admin dashboard stats:', error);
        throw error;
    }
};

// Updated getTeamInsights with date range support
export const getTeamInsights = async (teamName, startDate, endDate) => {
    try {
        const insights = {
            teamName,
            employeeCount: 0,
            totalTasks: 0,
            totalHours: 0,
            projects: {
                total: 0,
                completed: 0,
                inProgress: 0,
                onHold: 0
            },
            timeByProject: {},
            topPerformers: [],
            dateRange: {
                start: startDate,
                end: endDate
            }
        };

        // Get static employee count
        const empDoc = await getDoc(doc(db, 'teams', teamName, 'dropdownData', 'employees'));
        insights.employeeCount = empDoc.exists() ? (empDoc.data().values || []).length : 0;

        // Get static project count
        const projDoc = await getDoc(doc(db, 'teams', teamName, 'dropdownData', 'projects'));
        insights.projects.total = projDoc.exists() ? (projDoc.data().values || []).length : 0;

        // Process date range
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const date = format(d, 'yyyy-MM-dd');

            try {
                const dateEmployeesSnapshot = await getDocs(
                    collection(db, 'teams', teamName, 'dates', date, 'employees')
                );

                for (const empDoc of dateEmployeesSnapshot.docs) {
                    const empId = empDoc.id;
                    const empData = empDoc.data();
                    const empName = empData.name || empId;

                    const tasksSnapshot = await getDocs(
                        collection(db, 'teams', teamName, 'dates', date, 'employees', empId, 'tasks')
                    );

                    const empTaskCount = tasksSnapshot.size;
                    insights.totalTasks += empTaskCount;

                    let empHours = 0;

                    tasksSnapshot.docs.forEach(taskDoc => {
                        const task = taskDoc.data();
                        let hours = 0;
                        if (task.workType === 'Full-day') hours = 8;
                        else if (task.workType === 'Half-day') hours = 4;
                        else if (task.workType === 'Relaxation') hours = 0;

                        empHours += hours;
                        insights.totalHours += hours;

                        const projectKey = `${task.projectName || 'Unknown'}-${task.projectId || 'Unknown'}`;
                        insights.timeByProject[projectKey] = (insights.timeByProject[projectKey] || 0) + hours;

                        if (task.status === 'Completed') insights.projects.completed++;
                        else if (task.status === 'In Progress') insights.projects.inProgress++;
                        else if (task.status === 'On Hold') insights.projects.onHold++;
                    });

                    const existingPerformer = insights.topPerformers.find(performer => performer.empId === empId);
                    if (existingPerformer) {
                        existingPerformer.tasks += empTaskCount;
                        existingPerformer.hours += empHours;
                    } else if (empTaskCount > 0) {
                        insights.topPerformers.push({
                            empId,
                            empName,
                            tasks: empTaskCount,
                            hours: empHours
                        });
                    }
                }
            } catch (dateError) {
                console.warn(`No data for ${teamName} on ${date}:`, dateError.message);
            }
        }

        // Sort top performers
        insights.topPerformers.sort((a, b) => b.tasks - a.tasks);

        console.log(`Team insights loaded for ${teamName} (${startDate} to ${endDate}):`, {
            totalTasks: insights.totalTasks,
            totalHours: insights.totalHours.toFixed(1)
        });

        return insights;
    } catch (error) {
        console.error(`Error getting insights for team ${teamName}:`, error);
        throw error;
    }
};

// Helper function to get date range from string
export const getDateRange = (range) => {
    const today = new Date();
    const startDate = new Date(today);
    const endDate = new Date(today);

    switch (range) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return {
                start: format(startDate, 'yyyy-MM-dd'),
                end: format(endDate, 'yyyy-MM-dd')
            };
        case '7days':
            startDate.setDate(today.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return {
                start: format(startDate, 'yyyy-MM-dd'),
                end: format(endDate, 'yyyy-MM-dd')
            };
        case '30days':
            startDate.setDate(today.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return {
                start: format(startDate, 'yyyy-MM-dd'),
                end: format(endDate, 'yyyy-MM-dd')
            };
        case '90days':
            startDate.setDate(today.getDate() - 89);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return {
                start: format(startDate, 'yyyy-MM-dd'),
                end: format(endDate, 'yyyy-MM-dd')
            };
        default:
            return {
                start: format(today, 'yyyy-MM-dd'),
                end: format(today, 'yyyy-MM-dd')
            };
    }
};


export const canUserAccessEmployee = async (userProfile, teamName, targetEmpId) => {
    if (!userProfile) return false;

    if (userProfile.role === 'admin') {
        return true;
    }

    // Own data access
    if (userProfile.empId === targetEmpId) return true;

    switch (userProfile.role) {
        case 'tech-lead':
            // Can access subordinates in managed teams (not other tech-leads)
            if (teamName === 'techLeads') {
                return targetEmpId === userProfile.empId; // Only own data from techLeads team
            }
            return userProfile.managedTeams?.includes(teamName);

        case 'team-leader':
            if (userProfile.teamName !== teamName) return false;

            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('empId', '==', targetEmpId)
                );
                const snapshot = await getDocs(usersQuery);
                if (snapshot.empty) return false;

                const targetUser = snapshot.docs[0].data();
                // Can access track-leads and employees, not other team-leaders
                return ['track-lead', 'employee'].includes(targetUser.role);
            } catch (error) {
                console.error('Error checking employee access:', error);
                return false;
            }

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
                // Can access only employees who report to them
                return targetUser.role === 'employee' && targetUser.reportsTo === userProfile.empId;
            } catch (error) {
                console.error('Error checking employee access:', error);
                return false;
            }

        case 'employee':
            return false; // Employees can only see own data

        default:
            return false;
    }
};


// Get accessible teams for current user
export const getAccessibleTeams = (userProfile) => {
    if (!userProfile) return [];

    switch (userProfile.role) {
        case 'admin':
            // Admin gets all teams - this function returns empty, but getTeams handles admin separately
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



// --------------------Working FILTER BASED ON ROLES --------------------


// export const getFilterOptions = async (userProfile) => {
//     try {
//         const options = {
//             techLeads: [],
//             teamLeaders: [],
//             trackLeads: [],
//             employees: [],
//             teams: []
//         };

//         if (!userProfile) return options;

//         if (userProfile.role === 'tech-lead') {
//             options.teams = userProfile.managedTeams || [];

//             const techLeadsSet = new Set();
//             const teamLeadersSet = new Set();
//             const trackLeadsSet = new Set();
//             const employeesSet = new Set();

//             // Add current tech-lead to options
//             const currentTechLead = {
//                 empId: userProfile.empId,
//                 empName: userProfile.empName || userProfile.name,
//                 teamName: 'techLeads'
//             };
//             techLeadsSet.add(JSON.stringify(currentTechLead));

//             for (const teamName of userProfile.managedTeams) {
//                 try {
//                     const usersQuery = query(
//                         collection(db, 'users'),
//                         where('teamName', '==', teamName)
//                     );
//                     const usersSnapshot = await getDocs(usersQuery);

//                     usersSnapshot.forEach(doc => {
//                         const data = doc.data();
//                         const userData = {
//                             empId: data.empId,
//                             empName: data.empName || data.name,
//                             teamName: data.teamName
//                         };

//                         const key = `${data.role}-${data.empId}`;

//                         switch (data.role) {
//                             case 'team-leader':
//                                 if (!teamLeadersSet.has(key)) {
//                                     teamLeadersSet.add(JSON.stringify(userData));
//                                 }
//                                 break;
//                             case 'track-lead':
//                                 if (!trackLeadsSet.has(key)) {
//                                     trackLeadsSet.add(JSON.stringify(userData));
//                                 }
//                                 break;
//                             case 'employee':
//                                 if (!employeesSet.has(key)) {
//                                     employeesSet.add(JSON.stringify(userData));
//                                 }
//                                 break;
//                         }
//                     });
//                 } catch (error) {
//                     console.error(`Error fetching data for team ${teamName}:`, error);
//                 }
//             }

//             options.techLeads = Array.from(techLeadsSet).map(JSON.parse);
//             options.teamLeaders = Array.from(teamLeadersSet).map(JSON.parse);
//             options.trackLeads = Array.from(trackLeadsSet).map(JSON.parse);
//             options.employees = Array.from(employeesSet).map(JSON.parse);
//         } else if (userProfile.role === 'team-leader') {
//             // Team leaders can filter by track-leads and employees in their team
//             options.teams = [userProfile.teamName];

//             try {
//                 // Get track-leads - Use Set for consistency
//                 const trackLeadsSet = new Set();
//                 const trackLeadsQuery = query(
//                     collection(db, 'users'),
//                     where('role', '==', 'track-lead'),
//                     where('teamName', '==', userProfile.teamName)
//                 );
//                 const trackLeadsSnapshot = await getDocs(trackLeadsQuery);
//                 trackLeadsSnapshot.forEach(doc => {
//                     const data = doc.data();
//                     const userData = {
//                         empId: data.empId,
//                         empName: data.empName,
//                         teamName: data.teamName
//                     };
//                     const key = `${data.role}-${data.empId}`;
//                     if (!trackLeadsSet.has(key)) {
//                         trackLeadsSet.add(JSON.stringify(userData));
//                     }
//                 });
//                 options.trackLeads = Array.from(trackLeadsSet).map(JSON.parse);

//                 // Get employees - Use Set for consistency
//                 const employeesSet = new Set();
//                 const employeesQuery = query(
//                     collection(db, 'users'),
//                     where('role', '==', 'employee'),
//                     where('teamName', '==', userProfile.teamName)
//                 );
//                 const employeesSnapshot = await getDocs(employeesQuery);
//                 employeesSnapshot.forEach(doc => {
//                     const data = doc.data();
//                     const userData = {
//                         empId: data.empId,
//                         empName: data.empName,
//                         teamName: data.teamName
//                     };
//                     const key = `${data.role}-${data.empId}`;
//                     if (!employeesSet.has(key)) {
//                         employeesSet.add(JSON.stringify(userData));
//                     }
//                 });
//                 options.employees = Array.from(employeesSet).map(JSON.parse);

//             } catch (error) {
//                 console.error('Error fetching team-leader filter options:', error);
//                 options.trackLeads = [];
//                 options.employees = [];
//             }

//         } else if (userProfile.role === 'track-lead') {
//             // Track leads can filter by their direct reports (employees)
//             options.teams = [userProfile.teamName];

//             try {
//                 // Get employees who report to this track-lead - hierarchy-aware
//                 const employeesSet = new Set();
//                 const employeesQuery = query(
//                     collection(db, 'users'),
//                     where('role', '==', 'employee'),
//                     where('teamName', '==', userProfile.teamName),
//                     where('reportsTo', '==', userProfile.empId)
//                 );
//                 const employeesSnapshot = await getDocs(employeesQuery);
//                 employeesSnapshot.forEach(doc => {
//                     const data = doc.data();
//                     const userData = {
//                         empId: data.empId,
//                         empName: data.empName,
//                         teamName: data.teamName
//                     };
//                     const key = `${data.role}-${data.empId}`;
//                     if (!employeesSet.has(key)) {
//                         employeesSet.add(JSON.stringify(userData));
//                     }
//                 });
//                 options.employees = Array.from(employeesSet).map(JSON.parse);
//             } catch (error) {
//                 console.error('Error fetching track-lead filter options:', error);
//                 options.employees = [];
//             }

//         } else if (userProfile.role === 'employee') {
//             // Employees can only filter by themselves
//             options.teams = [userProfile.teamName];
//             options.employees = [{
//                 empId: userProfile.empId,
//                 empName: userProfile.empName,
//                 teamName: userProfile.teamName
//             }];
//         }

//         return options;
//     } catch (error) {
//         console.error('Error getting filter options:', error);
//         return {
//             techLeads: [],
//             teamLeaders: [],
//             trackLeads: [],
//             employees: [],
//             teams: []
//         };
//     }
// };


// --------------------New(With Admin) FILTER BASED ON ROLES --------------------
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

        // ADMIN - Gets ALL users and teams
        if (userProfile.role === 'admin') {
            try {
                // Get all teams
                const teamsSnapshot = await getDocs(collection(db, 'teams'));
                options.teams = teamsSnapshot.docs.map(doc => doc.id);

                // Get all users
                const usersSnapshot = await getDocs(collection(db, 'users'));

                const techLeadsSet = new Set();
                const teamLeadersSet = new Set();
                const trackLeadsSet = new Set();
                const employeesSet = new Set();

                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    const userData = {
                        empId: data.empId,
                        empName: data.empName || data.name,
                        teamName: data.teamName,
                        role: data.role
                    };

                    // FIXED: Use empId as the unique identifier for all roles
                    const uniqueKey = data.empId;

                    switch (data.role) {
                        case 'tech-lead':
                            if (!techLeadsSet.has(uniqueKey)) {
                                techLeadsSet.add(uniqueKey);
                                techLeadsSet.add(JSON.stringify(userData)); // Store both key and data
                            }
                            break;
                        case 'team-leader':
                            if (!teamLeadersSet.has(uniqueKey)) {
                                teamLeadersSet.add(uniqueKey);
                                teamLeadersSet.add(JSON.stringify(userData));
                            }
                            break;
                        case 'track-lead':
                            if (!trackLeadsSet.has(uniqueKey)) {
                                trackLeadsSet.add(uniqueKey);
                                trackLeadsSet.add(JSON.stringify(userData));
                            }
                            break;
                        case 'employee':
                            if (!employeesSet.has(uniqueKey)) {
                                employeesSet.add(uniqueKey);
                                employeesSet.add(JSON.stringify(userData));
                            }
                            break;
                    }
                });

                // Extract only the userData objects
                options.techLeads = Array.from(techLeadsSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);
                options.teamLeaders = Array.from(teamLeadersSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);
                options.trackLeads = Array.from(trackLeadsSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);
                options.employees = Array.from(employeesSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);

            } catch (error) {
                console.error('Error fetching admin filter options:', error);
            }
            return options;
        }

        // TECH-LEAD - FIXED to maintain original logic
        if (userProfile.role === 'tech-lead') {
            options.teams = userProfile.managedTeams || [];

            const techLeadsSet = new Set();
            const teamLeadersSet = new Set();
            const trackLeadsSet = new Set();
            const employeesSet = new Set();

            // Add current tech-lead to options
            const currentTechLead = {
                empId: userProfile.empId,
                empName: userProfile.empName || userProfile.name,
                teamName: 'techLeads'
            };
            const currentTechLeadKey = userProfile.empId;
            if (!techLeadsSet.has(currentTechLeadKey)) {
                techLeadsSet.add(currentTechLeadKey);
                techLeadsSet.add(JSON.stringify(currentTechLead));
            }

            for (const teamName of userProfile.managedTeams) {
                try {
                    const usersQuery = query(
                        collection(db, 'users'),
                        where('teamName', '==', teamName)
                    );
                    const usersSnapshot = await getDocs(usersQuery);

                    usersSnapshot.forEach(doc => {
                        const data = doc.data();
                        const userData = {
                            empId: data.empId,
                            empName: data.empName || data.name,
                            teamName: data.teamName
                        };

                        // FIXED: Use empId as unique identifier
                        const uniqueKey = data.empId;

                        switch (data.role) {
                            case 'team-leader':
                                if (!teamLeadersSet.has(uniqueKey)) {
                                    teamLeadersSet.add(uniqueKey);
                                    teamLeadersSet.add(JSON.stringify(userData));
                                }
                                break;
                            case 'track-lead':
                                if (!trackLeadsSet.has(uniqueKey)) {
                                    trackLeadsSet.add(uniqueKey);
                                    trackLeadsSet.add(JSON.stringify(userData));
                                }
                                break;
                            case 'employee':
                                if (!employeesSet.has(uniqueKey)) {
                                    employeesSet.add(uniqueKey);
                                    employeesSet.add(JSON.stringify(userData));
                                }
                                break;
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching data for team ${teamName}:`, error);
                }
            }

            // FIXED: Extract only userData objects
            options.techLeads = Array.from(techLeadsSet)
                .filter(item => typeof item === 'string' && item.startsWith('{'))
                .map(JSON.parse);
            options.teamLeaders = Array.from(teamLeadersSet)
                .filter(item => typeof item === 'string' && item.startsWith('{'))
                .map(JSON.parse);
            options.trackLeads = Array.from(trackLeadsSet)
                .filter(item => typeof item === 'string' && item.startsWith('{'))
                .map(JSON.parse);
            options.employees = Array.from(employeesSet)
                .filter(item => typeof item === 'string' && item.startsWith('{'))
                .map(JSON.parse);

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
                    // FIXED: Use empId as unique key
                    const uniqueKey = data.empId;
                    if (!trackLeadsSet.has(uniqueKey)) {
                        trackLeadsSet.add(uniqueKey);
                        trackLeadsSet.add(JSON.stringify(userData));
                    }
                });
                options.trackLeads = Array.from(trackLeadsSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);

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
                    // FIXED: Use empId as unique key
                    const uniqueKey = data.empId;
                    if (!employeesSet.has(uniqueKey)) {
                        employeesSet.add(uniqueKey);
                        employeesSet.add(JSON.stringify(userData));
                    }
                });
                options.employees = Array.from(employeesSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);

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
                    // FIXED: Use empId as unique key
                    const uniqueKey = data.empId;
                    if (!employeesSet.has(uniqueKey)) {
                        employeesSet.add(uniqueKey);
                        employeesSet.add(JSON.stringify(userData));
                    }
                });
                options.employees = Array.from(employeesSet)
                    .filter(item => typeof item === 'string' && item.startsWith('{'))
                    .map(JSON.parse);
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

export const getWeeklyTasks = async (userProfile, startDate, endDate, showOwnOnly = true) => {
    try {

        // Admin gets all data, others get filtered data
        if (userProfile.role === 'admin') {
            return await getTasksForDateRange(userProfile, startDate, endDate);
        }

        // Load tasks for the date range
        let weeklyTasks = await getTasksForDateRange(userProfile, startDate, endDate);

        // Apply own data filter by default
        if (showOwnOnly) {
            weeklyTasks = weeklyTasks.filter(task => task.empId === userProfile.empId);
        } else {
            // Apply role-based filtering for team data (same logic as in applyClientSideFilters)
            switch (userProfile.role) {
                case 'tech-lead':
                    weeklyTasks = weeklyTasks.filter(task => {
                        // Exclude other tech-leads data, include own data and subordinates
                        if (task.teamName === 'techLeads' && task.empId !== userProfile.empId) {
                            return false;
                        }
                        if (task.empId === userProfile.empId) return true;
                        return userProfile.managedTeams?.includes(task.teamName) && task.teamName !== 'techLeads';
                    });
                    break;

                case 'team-leader':
                    weeklyTasks = weeklyTasks.filter(task => {
                        if (task.empId === userProfile.empId) return true;
                        if (task.teamName !== userProfile.teamName) return false;
                        // Only include track-leads and employees from same team
                        return true; // Will be further filtered by role-based access in getTasksForDateRange
                    });
                    break;

                case 'track-lead':
                    weeklyTasks = weeklyTasks.filter(task => {
                        if (task.empId === userProfile.empId) return true;
                        if (task.teamName !== userProfile.teamName) return false;
                        // Only include direct reports
                        return true; // Will be further filtered by role-based access in getTasksForDateRange
                    });
                    break;

                case 'employee':
                    weeklyTasks = weeklyTasks.filter(task => task.empId === userProfile.empId);
                    break;

                default:
                    weeklyTasks = weeklyTasks.filter(task => task.empId === userProfile.empId);
            }
        }

        return weeklyTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
        console.error('Error getting weekly tasks:', error);
        throw error;
    }
};


// -------------------- Get The Tasks For Date Range--------------------
export const getTasksForDateRange = async (userProfile, startDate, endDate, teamFilter = null, empIdFilter = null) => {
    try {
        if (!userProfile) {
            throw new Error('User profile is required');
        }

        let allTasks = [];

        // Determine which teams user can access
        let accessibleTeams;
        switch (userProfile.role) {
            case 'admin':
                // Admin can access ALL teams
                const teamsSnapshot = await getDocs(collection(db, 'teams'));
                accessibleTeams = teamsSnapshot.docs.map(doc => doc.id);
                break;
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
        if (teamFilter && teamFilter !== 'all') {
            if (userProfile.role === 'admin' || accessibleTeams.includes(teamFilter)) {
                accessibleTeams = [teamFilter];
            } else {
                return []; // Invalid team filter
            }
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

                        /* For admin, skip permission check - they see everything*/
                        if (userProfile.role !== 'admin') {
                            // Check access for non-admin users
                            const canAccess = await canUserAccessEmployee(userProfile, teamName, empId);
                            if (!canAccess) {
                                continue;
                            }
                        }

                        // Check access
                        // const canAccess = await canUserAccessEmployee(userProfile, teamName, empId);

                        // if (!canAccess) {
                        //     continue;
                        // }

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

    // Team filter (only for tech leads and admin)
    if (filters.team && (userProfile.role === 'tech-lead' || userProfile.role === 'admin')) {
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
        // Check if user can access this team (Admin can access all)
        if (userProfile.role !== 'admin' && !canUserAccessTeam(userProfile, teamName)) {
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

        // Admin cannot modify dropdown data
        if (userProfile.role === 'admin') {
            throw new Error('Admin users cannot modify team data');
        }

        // Check if user can modify this team data
        if (!canUserAccessTeam(userProfile, teamName)) {
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
        // Admin can access all team projects
        if (userProfile.role !== 'admin' && !canUserAccessTeam(userProfile, teamName)) {
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

        // Admin cannot add projects
        if (userProfile.role === 'admin') {
            return; // Silently fail
        }

        if (!projectId || !projectName) return;

        // Check if user can access this team
        if (!canUserAccessTeam(userProfile, teamName)) {
            return;
        }

        const projects = await getTeamProjects(teamName, userProfile);

        // Check for existing project by ID or name (case-insensitive)
        const existsById = projects.find(p => p.id === projectId);
        const existsByName = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());

        if (!existsById && !existsByName) {
            const newProjects = [...projects, { id: projectId, name: projectName }];
            await saveTeamDropdownData(teamName, 'projects', newProjects, userProfile);
            console.log(`Added new project: ${projectName} (${projectId}) to team ${teamName}`);
        } else if (existsById && existsById.name !== projectName) {
            // Update existing project name if it's different
            const updatedProjects = projects.map(p =>
                p.id === projectId ? { ...p, name: projectName } : p
            );
            await saveTeamDropdownData(teamName, 'projects', updatedProjects, userProfile);
            console.log(`Updated project name for ${projectId}: ${existsById.name} -> ${projectName}`);
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
        if (userProfile.role !== 'admin' && !canUserAccessTeam(userProfile, teamName)) {
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

        // Admin cannot add employees
        if (userProfile.role === 'admin') {
            return; // Silently fail
        }

        if (!empId || !empName) return;

        // Check if user can access this team
        if (!canUserAccessTeam(userProfile, teamName)) {
            return; // Silently fail if user can't access team
        }

        const employees = await getTeamEmployees(teamName, userProfile);

        // Check for existing employee by ID or name (case-insensitive)
        const existsById = employees.find(e => e.id === empId);
        const existsByName = employees.find(e => e.name.toLowerCase() === empName.toLowerCase());

        if (!existsById && !existsByName) {
            const newEmployees = [...employees, { id: empId, name: empName }];
            await saveTeamDropdownData(teamName, 'employees', newEmployees, userProfile);
            console.log(`Added new employee: ${empName} (${empId}) to team ${teamName}`);
        } else if (existsById && existsById.name !== empName) {
            const updatedEmployees = employees.map(e =>
                e.id === empId ? { ...e, name: empName } : e
            );
            await saveTeamDropdownData(teamName, 'employees', updatedEmployees, userProfile);
            console.log(`Updated employee name for ${empId}: ${existsById.name} -> ${empName}`);
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
        // Admin can access all team clients
        if (userProfile.role !== 'admin' && !canUserAccessTeam(userProfile, teamName)) {
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

        // Admin cannot add clients
        if (userProfile.role === 'admin') {
            return; // Silently fail
        }

        if (!clientId || !clientName) return;

        // Check if user can access this team
        if (!canUserAccessTeam(userProfile, teamName)) {
            return; // Silently fail if user can't access team
        }

        const clients = await getTeamClients(teamName, userProfile);

        // Check for existing client by ID or name (case-insensitive)
        const existsById = clients.find(c => c.id === clientId);
        const existsByName = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

        if (!existsById && !existsByName) {
            const newClients = [...clients, { id: clientId, name: clientName }];
            await saveTeamDropdownData(teamName, 'clients', newClients, userProfile);
            console.log(`Added new client: ${clientName} (${clientId}) to team ${teamName}`);
        } else if (existsById && existsById.name !== clientName) {
            // Update existing client name if it's different
            const updatedClients = clients.map(c =>
                c.id === clientId ? { ...c, name: clientName } : c
            );
            await saveTeamDropdownData(teamName, 'clients', updatedClients, userProfile);
            console.log(`Updated client name for ${clientId}: ${existsById.name} -> ${clientName}`);
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