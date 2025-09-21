import { useState, useEffect } from 'react';
import {
    Paper, TextField, Button, Grid, Typography, MenuItem, Box, Card, CardContent,
    Chip, InputAdornment, Alert, Divider, CardHeader, Avatar
} from '@mui/material';
import {
    Person, Business, Assignment, DateRange, Schedule, Assessment,
    AccessTime, TrendingUp, Work, Description, Group, AccountTree
} from '@mui/icons-material';
import {
    getTeamDropdownData,
    saveTeamDropdownData,
    getTeams,
    getTeamProjects,
    addTeamProject,
    initializeTeamDefaults,
    addTask,
    updateTask,
    getTeamEmployees,
    addTeamEmployee,
    getTeamClients,
    addTeamClient,
    getPredefinedValues,
    isPredefinedField,
    canUserAccessTeam,
    getTasksForEmployee
} from '../lib/firebase';

const TaskForm = ({ onSubmit, editTask, onCancel, userProfile }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        teamName: '',
        empId: '',
        empName: '',
        clientId: '',
        clientName: '',
        projectName: '',
        projectId: '',
        phase: '',
        taskDescription: '',
        startDate: '',
        endDate: '',
        timeSpent: '',
        status: '',
        percentageCompletion: '',
        remarks: '',
        workType: ''
    });

    const [dropdownOptions, setDropdownOptions] = useState({});
    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [clients, setClients] = useState([]);
    const [accessibleTeams, setAccessibleTeams] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [errors, setErrors] = useState({});
    const [isTeamSelected, setIsTeamSelected] = useState(false);
    const [permissionAlert, setPermissionAlert] = useState('');
    const [dailyTasksState, setDailyTasksState] = useState([]);
    const [dailyTimeSummary, setDailyTimeSummary] = useState({
        totalUsed: 0,
        totalHours: 0,
        totalMinutes: 0,
        remaining: 9,
        overTime: 0,
        isLoaded: false
    });

    useEffect(() => {
        if (userProfile) {
            initializeUserData();
            if (editTask) {
                setFormData(editTask);
                if (editTask.teamName) {
                    loadTeamData(editTask.teamName);
                    setIsTeamSelected(true);
                }
            }
        }
    }, [editTask, userProfile]);

    useEffect(() => {
        if (formData.date && formData.empId && formData.teamName) {
            loadDailyTimeSummary();
        }
    }, [formData.date, formData.empId, formData.teamName, dailyTasksState, editTask]);

    const [dailyHoursTracking, setDailyHoursTracking] = useState({
        normalHours: 0,
        extraHours: 0,
        totalHours: 0
    });
    const [timeValidationMessage, setTimeValidationMessage] = useState('');
    const [validationTrigger, setValidationTrigger] = useState(0);

    const initializeUserData = async () => {
        try {
            // Auto-fill based on role — NO CHOICES FOR ANYONE
            let teamName = '';
            let empId = userProfile.empId || '';
            let empName = userProfile.empName || '';

            if (userProfile.role === 'tech-lead') {
                teamName = 'techLeads';
            } else {
                teamName = userProfile.teamName;
            }

            setFormData({
                date: new Date().toISOString().split('T')[0],
                teamName,
                empId,
                empName,
                clientId: '',
                clientName: '',
                projectName: '',
                projectId: '',
                phase: '',
                taskDescription: '',
                startDate: '',
                endDate: '',
                timeSpent: '',
                status: '',
                percentageCompletion: '',
                remarks: '',
                workType: ''
            });

            // Load team data ONLY if teamName is valid and accessible
            if (teamName && canUserAccessTeam(userProfile, teamName)) {
                await loadTeamData(teamName);
                setIsTeamSelected(true);
            } else {
                setIsTeamSelected(false);
            }

            // Hide all team selection UI — no dropdowns, no inputs
            setAccessibleTeams([]);
            setAllTeams([]);

        } catch (error) {
            console.error('Error initializing user data:', error);
        }
    };

    const loadTeamData = async (teamName) => {
        if (!teamName || !canUserAccessTeam(userProfile, teamName)) {
            setPermissionAlert('You do not have permission to access this team data');
            return;
        }

        try {
            setPermissionAlert('');
            await initializeTeamDefaults(teamName);

            const fields = ['status', 'percentageCompletion', 'workType'];
            const options = {};

            for (const field of fields) {
                options[field] = await getTeamDropdownData(teamName, field, userProfile);
            }

            setDropdownOptions(options);

            // Load team projects
            const projectsData = await getTeamProjects(teamName, userProfile);
            setProjects(projectsData);

            // Load team employees
            const employeesData = await getTeamEmployees(teamName, userProfile);
            setEmployees(employeesData);

            // Load team clients
            const clientsData = await getTeamClients(teamName, userProfile);
            setClients(clientsData);

            setIsTeamSelected(true);
        } catch (error) {
            console.error('Error loading team data:', error);
            setPermissionAlert('Error loading team data: ' + error.message);
        }
    };

    const refreshTeamData = async (teamName) => {
        if (!teamName || !canUserAccessTeam(userProfile, teamName)) return;

        try {
            const updatedProjects = await getTeamProjects(teamName, userProfile);
            const updatedEmployees = await getTeamEmployees(teamName, userProfile);
            const updatedClients = await getTeamClients(teamName, userProfile);

            setProjects(updatedProjects);
            setEmployees(updatedEmployees);
            setClients(updatedClients);

            // Refresh all teams list if user is manager/admin
            if (userProfile.role === 'manager' || userProfile.role === 'admin') {
                const allTeamsData = await getTeams();
                setAllTeams(allTeamsData);
            }
        } catch (error) {
            console.error('Error refreshing team data:', error);
        }
    };

    const validateTimeForWorkType = async (workType, timeSpent, isEdit = false, editTaskId = null) => {
        if (!workType || !timeSpent || !formData.date || !formData.empId) return null;

        const timePattern = /^(\d{1,2}):(\d{2})$/;
        const match = timeSpent.match(timePattern);
        if (!match) {
            setTimeValidationMessage("Invalid time format (HH:MM)");
            return "Invalid time format (HH:MM)";
        }

        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const currentTaskHours = hours + minutes / 60;

        // Get existing tasks for daily tracking FIRST
        let existingTasks = [];
        try {
            existingTasks = await getTasksForEmployee(formData.teamName, formData.empId, formData.date) || [];
        } catch (err) {
            existingTasks = [];
        }

        const dailyTasks = dailyTasksState || [];
        let totalDailyHours = 0;

        // Calculate existing backend tasks (EXCLUDE current task being edited)
        existingTasks.forEach(task => {
            if (isEdit && task.id === editTaskId) return;

            const match = task.timeSpent?.match(timePattern);
            if (match) {
                const h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const taskHours = h + m / 60;
                totalDailyHours += taskHours;
            }
        });

        // Add frontend unsaved tasks (only for new tasks, not for edit)
        if (!isEdit) {
            dailyTasks.forEach(task => {
                const match = task.timeSpent?.match(timePattern);
                if (match) {
                    const h = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    const taskHours = h + m / 60;
                    totalDailyHours += taskHours;
                }
            });
        }

        // Calculate what the total will be with current task
        const projectedDailyTotal = totalDailyHours + currentTaskHours;

        // Determine required hours based on work type - UPDATED LOGIC
        let minHours = 0;
        let maxHours = null;

        switch (workType.toLowerCase()) {
            case "full-day":
                minHours = 0;
                maxHours = 9;
                break;
            case "half-day":
                minHours = 0;
                maxHours = 4.5;
                break;
            case "relaxation":
                minHours = 0;
                maxHours = 7;
                break;
            case "over time":
                // For Over Time: Check if projected daily total will be >= 9
                if (projectedDailyTotal < 9) {
                    const shortfall = 9 - projectedDailyTotal;
                    const shortHours = Math.floor(shortfall);
                    const shortMinutes = Math.round((shortfall - shortHours) * 60);
                    const errorMsg = `Over Time requires daily total ≥ 9h. Current: ${totalDailyHours.toFixed(1)}h + ${currentTaskHours.toFixed(1)}h = ${projectedDailyTotal.toFixed(1)}h. Need ${shortHours}:${shortMinutes.toString().padStart(2, '0')} more.`;
                    setTimeValidationMessage(errorMsg);
                    return errorMsg;
                }
                minHours = 0; // Individual task can be any amount
                maxHours = null; // No upper limit
                break;
        }

        // Validate individual task time against work type requirements (for non-overtime)
        if (workType.toLowerCase() !== "over time") {
            if (currentTaskHours < minHours) {
                const diff = minHours - currentTaskHours;
                const diffHours = Math.floor(diff);
                const diffMinutes = Math.round((diff - diffHours) * 60);
                const errorMsg = `${workType} requires minimum ${minHours}h. You are short by ${diffHours}:${diffMinutes.toString().padStart(2, '0')} hours.`;
                setTimeValidationMessage(errorMsg);
                return errorMsg;
            }

            if (maxHours && currentTaskHours > maxHours) {
                const diff = currentTaskHours - maxHours;
                const diffHours = Math.floor(diff);
                const diffMinutes = Math.round((diff - diffHours) * 60);
                const errorMsg = `${workType} allows maximum ${maxHours}h. Exceeded by ${diffHours}:${diffMinutes.toString().padStart(2, '0')} hours. Task cannot be saved.`;
                setTimeValidationMessage(errorMsg);
                return errorMsg;
            }
        }

        // Calculate normal vs extra hours distribution
        let normalHours = 0;
        let extraHours = 0;

        if (projectedDailyTotal <= 9) {
            normalHours = projectedDailyTotal;
            extraHours = 0;
        } else {
            normalHours = 9;
            extraHours = projectedDailyTotal - 9;
        }

        // Update tracking state
        setDailyHoursTracking({
            normalHours: normalHours,
            extraHours: extraHours,
            totalHours: projectedDailyTotal
        });

        // Generate validation message
        let message = '';
        if (isEdit) {
            message = `[EDIT MODE] `;
        }

        if (extraHours > 0) {
            const extraHoursInt = Math.floor(extraHours);
            const extraMinutes = Math.round((extraHours - extraHoursInt) * 60);

            // Check if daily total exceeds 9 hours and it's not "Over Time"
            if (workType.toLowerCase() !== "over time") {
                message += `Daily limit exceeded! ${normalHours}h normal + ${extraHoursInt}:${extraMinutes.toString().padStart(2, '0')} extra. Use "Over Time" work type for extra hours.`;
                setTimeValidationMessage(message);
                return "Daily 9-hour limit exceeded. Please use 'Over Time' work type for additional hours or reduce time.";
            } else {
                message += `Daily: ${normalHours}h normal + ${extraHoursInt}:${extraMinutes.toString().padStart(2, '0')} over time`;
            }
        } else {
            const remainingHours = 9 - normalHours;
            if (remainingHours > 0) {
                const remainingHoursInt = Math.floor(remainingHours);
                const remainingMinutes = Math.round((remainingHours - remainingHoursInt) * 60);
                message += `${normalHours.toFixed(1)}/9h used. ${remainingHoursInt}:${remainingMinutes.toString().padStart(2, '0')} remaining`;
            } else {
                message += `9/9h normal time used. Use "Over Time" work type for additional hours.`;
            }
        }

        setTimeValidationMessage(message);
        return null;
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };

            // Auto-fill project name when project ID is selected
            if (field === 'projectId' && value) {
                const selectedProject = projects.find(p => p.id === value);
                if (selectedProject) {
                    newData.projectName = selectedProject.name;
                }
            }

            // Auto-fill project ID when project name is selected
            if (field === 'projectName' && value) {
                const selectedProject = projects.find(p => p.name === value);
                if (selectedProject) {
                    newData.projectId = selectedProject.id;
                }
            }

            // Auto-fill employee name when emp ID is selected
            if (field === 'empId' && value) {
                const selectedEmployee = employees.find(e => e.id === value);
                if (selectedEmployee) {
                    newData.empName = selectedEmployee.name;
                }
            }

            // Auto-fill emp ID when employee name is selected
            if (field === 'empName' && value) {
                const selectedEmployee = employees.find(e => e.name === value);
                if (selectedEmployee) {
                    newData.empId = selectedEmployee.id;
                }
            }

            // Auto-fill client name when client ID is selected
            if (field === 'clientId' && value) {
                const selectedClient = clients.find(c => c.id === value);
                if (selectedClient) {
                    newData.clientName = selectedClient.name;
                }
            }

            // Auto-fill client ID when client name is selected
            if (field === 'clientName' && value) {
                const selectedClient = clients.find(c => c.name === value);
                if (selectedClient) {
                    newData.clientId = selectedClient.id;
                }
            }
            if (field === "workType" && value && !newData.timeSpent) {
                switch (value) {
                    case "Full-day": newData.timeSpent = "9:00"; break;
                    case "Half-day": newData.timeSpent = "4:30"; break;
                    case "Relaxation": newData.timeSpent = "7:00"; break;
                    case "Over Time": newData.timeSpent = "10:00"; break;
                    default: break;
                }
            }

            return newData;
        });

        if ((field === 'timeSpent' || field === 'workType') && formData.date && formData.empId) {
            const timeSpentValue = field === 'timeSpent' ? value : formData.timeSpent;
            const workTypeValue = field === 'workType' ? value : formData.workType;

            if (timeSpentValue && workTypeValue) {
                // Trigger validation after state update
                setValidationTrigger(prev => prev + 1);
            }
        }

        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    }

    const handleSaveOption = async (field, options) => {
        if (formData.teamName && !isPredefinedField(field)) {
            try {
                await saveTeamDropdownData(formData.teamName, field, options, userProfile);
                setDropdownOptions(prev => ({ ...prev, [field]: options }));
            } catch (error) {
                console.error('Error saving dropdown data:', error);
            }
        }
    };

    const loadDailyTimeSummary = async () => {
        if (!formData.date || !formData.empId || !formData.teamName) {
            setDailyTimeSummary({ totalUsed: 0, totalHours: 0, totalMinutes: 0, remaining: 9, overTime: 0, isLoaded: false });
            return;
        }

        try {
            const existingTasks = await getTasksForEmployee(formData.teamName, formData.empId, formData.date) || [];
            const dailyTasks = dailyTasksState || [];

            let totalMinutes = 0; // Use minutes for accurate calculation
            const timePattern = /^(\d{1,2}):(\d{2})$/;

            // Calculate existing backend tasks (exclude current task if editing)
            existingTasks.forEach(task => {
                if (editTask && task.id === editTask.id) return;

                const match = task.timeSpent?.match(timePattern);
                if (match) {
                    const h = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    totalMinutes += (h * 60) + m; // Convert to total minutes
                }
            });

            // Add frontend unsaved tasks (only for new tasks, not for edit)
            if (!editTask) {
                dailyTasks.forEach(task => {
                    const match = task.timeSpent?.match(timePattern);
                    if (match) {
                        const h = parseInt(match[1], 10);
                        const m = parseInt(match[2], 10);
                        totalMinutes += (h * 60) + m; // Convert to total minutes
                    }
                });
            }

            // Convert total minutes back to hours and minutes
            const totalHours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes % 60;
            const totalDecimalHours = totalMinutes / 60; // For calculations

            // Calculate remaining/overtime using minutes for precision
            let remaining = 0;
            let overTime = 0;

            if (totalMinutes <= 540) { // 540 minutes = 9 hours
                remaining = (540 - totalMinutes) / 60; // Convert back to hours
            } else {
                overTime = (totalMinutes - 540) / 60; // Convert back to hours
            }

            setDailyTimeSummary({
                totalUsed: totalDecimalHours,
                totalHours: totalHours,
                totalMinutes: remainingMinutes,
                remaining: remaining,
                overTime: overTime,
                isLoaded: true
            });
        } catch (error) {
            console.error('Error loading daily time summary:', error);
            setDailyTimeSummary({ totalUsed: 0, totalHours: 0, totalMinutes: 0, remaining: 9, overTime: 0, isLoaded: false });
        }
    };

    const handleProjectSave = async (projectId, projectName) => {
        if (projectId && projectName && formData.teamName) {
            try {
                await addTeamProject(formData.teamName, projectId, projectName, userProfile);
                await refreshTeamData(formData.teamName);
            } catch (error) {
                console.error('Error saving project:', error);
            }
        }
    };

    const handleEmployeeSave = async (empId, empName) => {
        if (empId && empName && formData.teamName) {
            try {
                await addTeamEmployee(formData.teamName, empId, empName, userProfile);
                await refreshTeamData(formData.teamName);
            } catch (error) {
                console.error('Error saving employee:', error);
            }
        }
    };

    const handleClientSave = async (clientId, clientName) => {
        if (clientId && clientName && formData.teamName) {
            try {
                await addTeamClient(formData.teamName, clientId, clientName, userProfile);
                await refreshTeamData(formData.teamName);
            } catch (error) {
                console.error('Error saving client:', error);
            }
        }
    };

    const validateForm = () => {
        const newErrors = {};
        const required = ['teamName', 'empId', 'empName', 'taskDescription', 'startDate', 'endDate', 'status', 'workType'];

        required.forEach(field => {
            if (!formData[field]) {
                newErrors[field] = 'This field is required';
            }
        });

        // Employee role validation - can only create tasks for themselves
        if (userProfile?.role === 'employee') {
            if (formData.teamName !== userProfile.teamName) {
                newErrors.teamName = 'You can only create tasks for your own team';
            }
            if (formData.empId !== userProfile.empId) {
                newErrors.empId = 'You can only create tasks for yourself';
            }
        }

        if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
            newErrors.endDate = 'End date must be after start date';
        }

        if (formData.timeSpent && !/^\d{1,2}:\d{2}$/.test(formData.timeSpent)) {
            newErrors.timeSpent = 'Time format should be HH:MM';
        }
        // Validate predefined fields
        const predefinedFields = ['status', 'percentageCompletion', 'workType'];
        predefinedFields.forEach(field => {
            if (formData[field] && isPredefinedField(field)) {
                const allowedValues = getPredefinedValues(field);
                if (!allowedValues.includes(formData[field])) {
                    newErrors[field] = `Please select from predefined values only`;
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const getResetFormData = (userProfile) => {
        const baseReset = {
            date: new Date().toISOString().split('T')[0],
            clientId: '',
            clientName: '',
            projectName: '',
            projectId: '',
            phase: '',
            taskDescription: '',
            startDate: '',
            endDate: '',
            timeSpent: '',
            status: '',
            percentageCompletion: '',
            remarks: '',
            workType: ''
        };

        if (userProfile?.role === 'tech-lead') {
            return {
                ...baseReset,
                teamName: 'techLeads',
                empId: userProfile.empId,
                empName: userProfile.empName
            };
        } else if (userProfile?.role === 'team-leader' || userProfile?.role === 'employee') {
            return {
                ...baseReset,
                teamName: userProfile.teamName,
                empId: userProfile.empId,
                empName: userProfile.empName
            };
        } else {
            return {
                ...baseReset,
                teamName: '',
                empId: '',
                empName: ''
            };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            if (!formData.teamName?.trim()) {
                throw new Error('Team name is required');
            }

            // Validate time tracking before submission and block if invalid
            const timeValidationError = await validateTimeForWorkType(
                formData.workType,
                formData.timeSpent,
                !!editTask,
                editTask?.id
            );

            if (timeValidationError) {
                alert(timeValidationError);
                return; // Block submission
            }

            // Create task data with time tracking info
            const taskDataWithTimeTracking = {
                ...formData,
                normalHours: dailyHoursTracking.normalHours,
                extraHours: dailyHoursTracking.extraHours,
                totalDailyHours: dailyHoursTracking.totalHours
            };

            await initializeTeamDefaults(formData.teamName);

            if (editTask) {
                await updateTask(
                    editTask.teamName,
                    editTask.date,
                    editTask.empId,
                    editTask.id,
                    {
                        ...taskDataWithTimeTracking,
                        teamName: editTask.teamName,
                        empId: editTask.empId,
                        date: editTask.date
                    },
                    userProfile
                );
            } else {
                await addTask(taskDataWithTimeTracking, userProfile);
                setDailyTasksState(prev => [...prev, taskDataWithTimeTracking]);
            }

            // Rest remains the same...
            await refreshTeamData(formData.teamName);
            onSubmit(formData);

            if (!editTask) {
                const resetData = getResetFormData(userProfile);
                setFormData(resetData);
                const shouldKeepTeamData = ['tech-lead', 'team-leader', 'employee'].includes(userProfile?.role);
                setIsTeamSelected(shouldKeepTeamData);
                if (!shouldKeepTeamData) {
                    setDropdownOptions({});
                    setProjects([]);
                    setEmployees([]);
                    setClients([]);
                }
            } else {
                onCancel();
            }
        } catch (error) {
            console.error('Error saving task:', error);
            alert(error.message || 'Error saving task');
        }
    };



    return (
        <Box sx={{
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            minHeight: '100vh',
            p: 2,
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 30% 20%, rgba(25, 118, 210, 0.05) 0%, transparent 50%)',
                pointerEvents: 'none'
            }
        }}>
            <Card elevation={20} sx={{
                maxWidth: 1200,
                mx: 'auto',
                borderRadius: 4,
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>

                <CardContent sx={{ p: 3 }}>
                    {permissionAlert && (
                        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                            {permissionAlert}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Basic Information & Employee Info - Side by Side */}
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            {/* Basic Information */}
                            <Grid item xs={12} md={6}>
                                <Card variant="outlined" sx={{ height: '100%', borderRadius: 3, border: '2px solid #e3f2fd' }}>
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Avatar sx={{ bgcolor: '#1976d2', width: 32, height: 32, mr: 1.5 }}>
                                                <DateRange sx={{ fontSize: 18 }} />
                                            </Avatar>
                                            <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 600 }}>
                                                Basic Information
                                            </Typography>
                                        </Box>

                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <TextField
                                                    label="Date"
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(e) => handleChange('date', e.target.value)}
                                                    fullWidth
                                                    size="small"
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 2,
                                                            '&:hover fieldset': { borderColor: '#1976d2' },
                                                            '&.Mui-focused fieldset': { borderColor: '#1976d2' }
                                                        }
                                                    }}
                                                />
                                            </Grid>

                                            <Grid item xs={12}>
                                                <TextField
                                                    label="Team"
                                                    value={
                                                        formData.teamName === 'techLeads'
                                                            ? 'Tech Lead (Personal)'
                                                            : formData.teamName || 'N/A'
                                                    }
                                                    fullWidth
                                                    size="small"
                                                    disabled
                                                    helperText={
                                                        formData.teamName === 'techLeads'
                                                            ? 'Your personal/administrative tasks'
                                                            : 'Assigned team'
                                                    }
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                                        backgroundColor: formData.teamName === 'techLeads' ? '#f0f7ff' : '#fafafa'
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Employee Information */}
                            <Grid item xs={12} md={6}>
                                <Card variant="outlined" sx={{ height: '100%', borderRadius: 3, border: '2px solid #e8f5e8' }}>
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Avatar sx={{ bgcolor: '#2e7d32', width: 32, height: 32, mr: 1.5 }}>
                                                <Person sx={{ fontSize: 18 }} />
                                            </Avatar>
                                            <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                                                Employee Information
                                            </Typography>
                                        </Box>

                                        <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                                <TextField
                                                    label="Employee ID"
                                                    value={formData.empId}
                                                    fullWidth
                                                    size="small"
                                                    disabled
                                                    helperText="Your employee ID"
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                                        backgroundColor: '#fafafa'
                                                    }}
                                                />
                                            </Grid>

                                            <Grid item xs={12}>
                                                <TextField
                                                    label="Employee Name"
                                                    value={formData.empName}
                                                    fullWidth
                                                    size="small"
                                                    disabled
                                                    helperText="Your name"
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                                        backgroundColor: '#fafafa'
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Team Selection Notice */}
                        {!formData.teamName?.trim() && (
                            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                                Please enter a team name to access team-specific options.
                            </Alert>
                        )}

                        {/* Client & Project Information */}
                        <Card variant="outlined" sx={{ mb: 3, borderRadius: 3, border: '2px solid #fff3e0' }}>
                            <CardContent sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: '#f57c00', width: 32, height: 32, mr: 1.5 }}>
                                        <AccountTree sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 600 }}>
                                        Client & Project Information
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    {/* Client ID & Name */}
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            select
                                            label="Client ID"
                                            value={formData.clientId}
                                            onChange={(e) => handleChange('clientId', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        >
                                            {clients.map((client) => (
                                                <MenuItem key={client.id} value={client.id}>
                                                    {client.id}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Or enter new Client ID"
                                            value={formData.clientId}
                                            onChange={(e) => handleChange('clientId', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            select
                                            label="Client Name"
                                            value={formData.clientName}
                                            onChange={(e) => handleChange('clientName', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        >
                                            {clients.map((client) => (
                                                <MenuItem key={client.name} value={client.name}>
                                                    {client.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Or enter new Client Name"
                                            value={formData.clientName}
                                            onChange={(e) => handleChange('clientName', e.target.value)}
                                            onBlur={() => handleClientSave(formData.clientId, formData.clientName)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    {/* Project ID & Name */}
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            select
                                            label="Project ID"
                                            value={formData.projectId}
                                            onChange={(e) => handleChange('projectId', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        >
                                            {projects.map((project) => (
                                                <MenuItem key={project.id} value={project.id}>
                                                    {project.id}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Or enter new Project ID"
                                            value={formData.projectId}
                                            onChange={(e) => handleChange('projectId', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            select
                                            label="Project Name"
                                            value={formData.projectName}
                                            onChange={(e) => handleChange('projectName', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        >
                                            {projects.map((project) => (
                                                <MenuItem key={project.name} value={project.name}>
                                                    {project.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            label="Or enter new Project Name"
                                            value={formData.projectName}
                                            onChange={(e) => handleChange('projectName', e.target.value)}
                                            onBlur={() => handleProjectSave(formData.projectId, formData.projectName)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    {/* Phase */}
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Phase"
                                            value={formData.phase}
                                            onChange={(e) => handleChange('phase', e.target.value)}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#f57c00' },
                                                    '&.Mui-focused fieldset': { borderColor: '#f57c00' }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Task Details */}
                        <Card variant="outlined" sx={{ mb: 3, borderRadius: 3, border: '2px solid #fce4ec' }}>
                            <CardContent sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: '#c2185b', width: 32, height: 32, mr: 1.5 }}>
                                        <Description sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 600 }}>
                                        Task Details
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Task Description"
                                            value={formData.taskDescription}
                                            onChange={(e) => handleChange('taskDescription', e.target.value)}
                                            fullWidth
                                            multiline
                                            rows={3}
                                            required
                                            error={!!errors.taskDescription}
                                            helperText={errors.taskDescription}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#c2185b' },
                                                    '&.Mui-focused fieldset': { borderColor: '#c2185b' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Start Date"
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => handleChange('startDate', e.target.value)}
                                            fullWidth
                                            required
                                            error={!!errors.startDate}
                                            helperText={errors.startDate}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#c2185b' },
                                                    '&.Mui-focused fieldset': { borderColor: '#c2185b' }
                                                }
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="End Date"
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => handleChange('endDate', e.target.value)}
                                            fullWidth
                                            required
                                            error={!!errors.endDate}
                                            helperText={errors.endDate}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#c2185b' },
                                                    '&.Mui-focused fieldset': { borderColor: '#c2185b' }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Status & Progress */}
                        <Card variant="outlined" sx={{ mb: 3, borderRadius: 3, border: '2px solid #e8f5e8' }}>
                            <CardContent sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: '#2e7d32', width: 32, height: 32, mr: 1.5 }}>
                                        <TrendingUp sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                                        Status & Progress
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    {/* Time Spent */}
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            label="Time Spent (HH:MM)"
                                            value={formData.timeSpent}
                                            onChange={(e) => handleChange('timeSpent', e.target.value)}
                                            fullWidth
                                            placeholder="08:30"
                                            error={!!errors.timeSpent}
                                            helperText={errors.timeSpent || timeValidationMessage}
                                            size="small"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <AccessTime sx={{ color: '#2e7d32', fontSize: 20 }} />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#2e7d32' },
                                                    '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
                                                },
                                                '& .MuiFormHelperText-root': {
                                                    color: errors.timeSpent
                                                        ? '#d32f2f'
                                                        : dailyHoursTracking.extraHours > 0 && formData.workType?.toLowerCase() !== 'over time'
                                                            ? '#f57c00'
                                                            : dailyHoursTracking.extraHours > 0
                                                                ? '#2e7d32'
                                                                : '#666',
                                                    fontWeight: dailyHoursTracking.extraHours > 0 ? 600 : 400
                                                }
                                            }}
                                        />
                                    </Grid>

                                    {/* Status */}
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            select
                                            label="Status"
                                            value={formData.status}
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            fullWidth
                                            required
                                            error={!!errors.status}
                                            helperText={errors.status || "Select from predefined values only"}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#2e7d32' },
                                                    '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
                                                }
                                            }}
                                        >
                                            {dropdownOptions.status?.map((status) => (
                                                <MenuItem key={status} value={status}>
                                                    <Chip
                                                        label={status}
                                                        size="small"
                                                        color={
                                                            status === 'Completed'
                                                                ? 'success'
                                                                : status === 'In Progress'
                                                                    ? 'primary'
                                                                    : 'warning'
                                                        }
                                                        variant="outlined"
                                                    />
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    {/* Work Type */}
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            select
                                            label="Work Type"
                                            value={formData.workType}
                                            onChange={(e) => handleChange('workType', e.target.value)}
                                            fullWidth
                                            required
                                            error={!!errors.workType}
                                            helperText={errors.workType || "Select from predefined values only"}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#2e7d32' },
                                                    '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
                                                }
                                            }}
                                        >
                                            {dropdownOptions.workType?.map((workType) => (
                                                <MenuItem key={workType} value={workType}>
                                                    <Chip
                                                        label={workType}
                                                        size="small"
                                                        color={
                                                            workType === 'Full-day'
                                                                ? 'success'
                                                                : workType === 'Half-day'
                                                                    ? 'primary'
                                                                    : 'secondary'
                                                        }
                                                        variant="outlined"
                                                    />
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    {/* Percentage Completion */}
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            select
                                            label="Percentage Completion"
                                            value={formData.percentageCompletion}
                                            onChange={(e) => handleChange('percentageCompletion', e.target.value)}
                                            fullWidth
                                            error={!!errors.percentageCompletion}
                                            helperText={errors.percentageCompletion || 'Select from predefined values only'}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#2e7d32' },
                                                    '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
                                                }
                                            }}
                                        >
                                            {dropdownOptions.percentageCompletion?.map((percentage) => (
                                                <MenuItem key={percentage} value={percentage}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                        <Typography sx={{ minWidth: 40 }}>{percentage}%</Typography>
                                                        <Box
                                                            sx={{
                                                                ml: 1,
                                                                flex: 1,
                                                                height: 6,
                                                                bgcolor: '#e0e0e0',
                                                                borderRadius: 1,
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: `${percentage}%`,
                                                                    height: '100%',
                                                                    bgcolor: '#2e7d32'
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    {/* Remarks */}
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Remarks"
                                            value={formData.remarks}
                                            onChange={(e) => handleChange('remarks', e.target.value)}
                                            fullWidth
                                            multiline
                                            rows={2}
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    '&:hover fieldset': { borderColor: '#2e7d32' },
                                                    '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                                {/* Time Remaining Display */}
                                <Grid item xs={12} md={6}>
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            width: '22%',
                                            mt: 5,
                                            p: 1.5,
                                            backgroundColor: dailyTimeSummary.overTime > 0 ? '#fff3e0' : '#f0f7ff',
                                            border: dailyTimeSummary.overTime > 0 ? '1px solid #f57c00' : '1px solid #1976d2'
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 0.5 }}>
                                            Daily Time Summary ({formData.date || 'Select date'})
                                        </Typography>
                                        {dailyTimeSummary.isLoaded ? (
                                            <>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: dailyTimeSummary.overTime > 0 ? '#f57c00' : '#1976d2'
                                                    }}
                                                >
                                                    Used: {dailyTimeSummary.totalHours}h {dailyTimeSummary.totalMinutes}m / 9h
                                                </Typography>
                                                {dailyTimeSummary.remaining > 0 ? (
                                                    <Typography variant="body2" sx={{ color: '#2e7d32' }}>
                                                        Remaining: {Math.floor(dailyTimeSummary.remaining)}h {Math.round((dailyTimeSummary.remaining % 1) * 60)}m
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="body2" sx={{ color: '#f57c00' }}>
                                                        Over Time: +{Math.floor(dailyTimeSummary.overTime)}h {Math.round((dailyTimeSummary.overTime % 1) * 60)}m
                                                    </Typography>
                                                )}
                                            </>
                                        ) : (
                                            <Typography variant="body2" sx={{ color: '#666' }}>
                                                Loading time summary...
                                            </Typography>
                                        )}
                                    </Card>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Action Buttons */}
                        <Box sx={{
                            display: 'flex',
                            gap: 2,
                            justifyContent: 'flex-end',
                            pt: 2,
                            borderTop: '1px solid #e0e0e0'
                        }}>
                            {editTask && (
                                <Button
                                    onClick={onCancel}
                                    variant="outlined"
                                    size="large"
                                    sx={{
                                        borderRadius: 2,
                                        px: 4,
                                        py: 1,
                                        borderColor: '#1976d2',
                                        color: '#1976d2',
                                        '&:hover': {
                                            borderColor: '#1565c0',
                                            backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                sx={{
                                    borderRadius: 2,
                                    px: 4,
                                    py: 1,
                                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                    boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                                    fontWeight: 600,
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                                        boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                                        transform: 'translateY(-2px)'
                                    },
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {editTask ? 'Update Task' : 'Create Task'}
                            </Button>
                        </Box>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
};

export default TaskForm;