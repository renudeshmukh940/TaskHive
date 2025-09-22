import { useState, useEffect } from 'react';
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
    const [refreshKey, setRefreshKey] = useState(0);
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
    }, [formData.date, formData.empId, formData.teamName, editTask, refreshKey]);

    const [dailyHoursTracking, setDailyHoursTracking] = useState({
        normalHours: 0,
        extraHours: 0,
        totalHours: 0
    });
    const [timeValidationMessage, setTimeValidationMessage] = useState('');
    const [validationTrigger, setValidationTrigger] = useState(0);


    const initializeUserData = async () => {
        try {
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

            if (teamName && canUserAccessTeam(userProfile, teamName)) {
                await loadTeamData(teamName);
                setIsTeamSelected(true);
            } else {
                setIsTeamSelected(false);
            }

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

            const projectsData = await getTeamProjects(teamName, userProfile);
            setProjects(projectsData);

            const employeesData = await getTeamEmployees(teamName, userProfile);
            setEmployees(employeesData);

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

        let existingTasks = [];
        try {
            existingTasks = await getTasksForEmployee(formData.teamName, formData.empId, formData.date) || [];
        } catch (err) {
            existingTasks = [];
        }

        let totalDailyHours = 0;

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

        const projectedDailyTotal = totalDailyHours + currentTaskHours;

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
                if (projectedDailyTotal < 9) {
                    const shortfall = 9 - projectedDailyTotal;
                    const shortHours = Math.floor(shortfall);
                    const shortMinutes = Math.round((shortfall - shortHours) * 60);
                    const errorMsg = `Over Time requires daily total ≥ 9h. Current: ${totalDailyHours.toFixed(1)}h + ${currentTaskHours.toFixed(1)}h = ${projectedDailyTotal.toFixed(1)}h. Need ${shortHours}:${shortMinutes.toString().padStart(2, '0')} more.`;
                    setTimeValidationMessage(errorMsg);
                    return errorMsg;
                }
                minHours = 0;
                maxHours = null;
                break;
        }

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

        let normalHours = 0;
        let extraHours = 0;

        if (projectedDailyTotal <= 9) {
            normalHours = projectedDailyTotal;
            extraHours = 0;
        } else {
            normalHours = 9;
            extraHours = projectedDailyTotal - 9;
        }

        setDailyHoursTracking({
            normalHours: normalHours,
            extraHours: extraHours,
            totalHours: projectedDailyTotal
        });

        let message = '';
        if (isEdit) {
            message = `[EDIT MODE] `;
        }

        if (extraHours > 0) {
            const extraHoursInt = Math.floor(extraHours);
            const extraMinutes = Math.round((extraHours - extraHoursInt) * 60);

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

            if (field === 'projectId' && value) {
                const selectedProject = projects.find(p => p.id === value);
                if (selectedProject) {
                    newData.projectName = selectedProject.name;
                }
            }

            if (field === 'projectName' && value) {
                const selectedProject = projects.find(p => p.name === value);
                if (selectedProject) {
                    newData.projectId = selectedProject.id;
                }
            }

            if (field === 'empId' && value) {
                const selectedEmployee = employees.find(e => e.id === value);
                if (selectedEmployee) {
                    newData.empName = selectedEmployee.name;
                }
            }

            if (field === 'empName' && value) {
                const selectedEmployee = employees.find(e => e.name === value);
                if (selectedEmployee) {
                    newData.empId = selectedEmployee.id;
                }
            }

            if (field === 'clientId' && value) {
                const selectedClient = clients.find(c => c.id === value);
                if (selectedClient) {
                    newData.clientName = selectedClient.name;
                }
            }

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

            let totalMinutes = 0;
            const timePattern = /^(\d{1,2}):(\d{2})$/;

            existingTasks.forEach(task => {
                if (editTask && task.id === editTask.id) return;

                const match = task.timeSpent?.match(timePattern);
                if (match) {
                    const h = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    totalMinutes += (h * 60) + m;
                }
            });

            const totalHours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes % 60;
            const totalDecimalHours = totalMinutes / 60;

            let remaining = 0;
            let overTime = 0;

            if (totalMinutes <= 540) {
                remaining = (540 - totalMinutes) / 60;
            } else {
                overTime = (totalMinutes - 540) / 60;
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

            const timeValidationError = await validateTimeForWorkType(
                formData.workType,
                formData.timeSpent,
                !!editTask,
                editTask?.id
            );

            if (timeValidationError) {
                alert(timeValidationError);
                return;
            }

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
            }

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
                setRefreshKey(prev => prev + 1);
            } else {
                onCancel();
            }
        } catch (error) {
            console.error('Error saving task:', error);
            alert(error.message || 'Error saving task');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-full mx-auto p-2">
                {/* Permission Alert */}
                {permissionAlert && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="text-yellow-800">{permissionAlert}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic & Employee Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Basic Information */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => handleChange('date', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                                    <input
                                        type="text"
                                        value={formData.teamName === 'techLeads' ? 'Tech Lead (Personal)' : formData.teamName || 'N/A'}
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formData.teamName === 'techLeads' ? 'Your personal/administrative tasks' : 'Assigned team'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Employee Information */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Employee Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                                    <input
                                        type="text"
                                        value={formData.empId}
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Your employee ID</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                                    <input
                                        type="text"
                                        value={formData.empName}
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Your name</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Team Selection Notice */}
                    {!formData.teamName?.trim() && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-blue-800">Please enter a team name to access team-specific options.</span>
                            </div>
                        </div>
                    )}

                    {/* Client & Project Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center mb-6">
                            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Client & Project Information</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Client ID & Name */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                    <select
                                        value={formData.clientId}
                                        onChange={(e) => handleChange('clientId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Client ID</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Or enter new Client ID"
                                        value={formData.clientId}
                                        onChange={(e) => handleChange('clientId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                                    <select
                                        value={formData.clientName}
                                        onChange={(e) => handleChange('clientName', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Client Name</option>
                                        {clients.map((client) => (
                                            <option key={client.name} value={client.name}>
                                                {client.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Or enter new Client Name"
                                        value={formData.clientName}
                                        onChange={(e) => handleChange('clientName', e.target.value)}
                                        onBlur={() => handleClientSave(formData.clientId, formData.clientName)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Project ID & Name */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                                    <select
                                        value={formData.projectId}
                                        onChange={(e) => handleChange('projectId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Project ID</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>
                                                {project.id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Or enter new Project ID"
                                        value={formData.projectId}
                                        onChange={(e) => handleChange('projectId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                    <select
                                        value={formData.projectName}
                                        onChange={(e) => handleChange('projectName', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select Project Name</option>
                                        {projects.map((project) => (
                                            <option key={project.name} value={project.name}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Or enter new Project Name"
                                        value={formData.projectName}
                                        onChange={(e) => handleChange('projectName', e.target.value)}
                                        onBlur={() => handleProjectSave(formData.projectId, formData.projectName)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Phase */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                                    <input
                                        type="text"
                                        value={formData.phase}
                                        onChange={(e) => handleChange('phase', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter project phase"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task Details */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center mb-6">
                            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Task Details</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Task Description *</label>
                                <textarea
                                    value={formData.taskDescription}
                                    onChange={(e) => handleChange('taskDescription', e.target.value)}
                                    rows={4}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.taskDescription ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Describe the task in detail..."
                                />
                                {errors.taskDescription && (
                                    <p className="text-red-500 text-sm mt-1">{errors.taskDescription}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => handleChange('startDate', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.startDate ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.startDate && (
                                    <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => handleChange('endDate', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {errors.endDate && (
                                    <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status & Progress */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Status & Time Tracking */}
                        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center mb-6">
                                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Status & Progress</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Spent (HH:MM)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.timeSpent}
                                            onChange={(e) => handleChange('timeSpent', e.target.value)}
                                            placeholder="08:30"
                                            className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.timeSpent ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>
                                    {(errors.timeSpent || timeValidationMessage) && (
                                        <p className={`text-sm mt-1 ${errors.timeSpent ? 'text-red-500' :
                                            dailyHoursTracking.extraHours > 0 && formData.workType?.toLowerCase() !== 'over time' ? 'text-orange-600' :
                                                dailyHoursTracking.extraHours > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                            {errors.timeSpent || timeValidationMessage}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.status ? 'border-red-500' : 'border-gray-300'}`}
                                    >
                                        <option value="">Select Status</option>
                                        {dropdownOptions.status?.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.status && (
                                        <p className="text-red-500 text-sm mt-1">{errors.status}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Select from predefined values only</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Type *</label>
                                    <select
                                        value={formData.workType}
                                        onChange={(e) => handleChange('workType', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.workType ? 'border-red-500' : 'border-gray-300'}`}
                                    >
                                        <option value="">Select Work Type</option>
                                        {dropdownOptions.workType?.map((workType) => (
                                            <option key={workType} value={workType}>
                                                {workType}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.workType && (
                                        <p className="text-red-500 text-sm mt-1">{errors.workType}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Select from predefined values only</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Percentage Completion</label>
                                    <select
                                        value={formData.percentageCompletion}
                                        onChange={(e) => handleChange('percentageCompletion', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.percentageCompletion ? 'border-red-500' : 'border-gray-300'}`}
                                    >
                                        <option value="">Select Completion %</option>
                                        {dropdownOptions.percentageCompletion?.map((percentage) => (
                                            <option key={percentage} value={percentage}>
                                                {percentage}%
                                            </option>
                                        ))}
                                    </select>
                                    {errors.percentageCompletion && (
                                        <p className="text-red-500 text-sm mt-1">{errors.percentageCompletion}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Select from predefined values only</p>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                                    <textarea
                                        value={formData.remarks}
                                        onChange={(e) => handleChange('remarks', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Additional notes or remarks..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Daily Time Summary */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h4 className="text-sm font-semibold text-gray-900">Daily Summary</h4>
                            </div>

                            <div className="space-y-3">
                                <div className="text-xs text-gray-500">
                                    {formData.date || 'Select date'}
                                </div>

                                {dailyTimeSummary.isLoaded ? (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Used:</span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {dailyTimeSummary.totalHours}h {dailyTimeSummary.totalMinutes}m
                                                </span>
                                            </div>

                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${dailyTimeSummary.overTime > 0 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min((dailyTimeSummary.totalUsed / 9) * 100, 100)}%` }}
                                                ></div>
                                            </div>

                                            <div className="text-xs text-center text-gray-500">
                                                / 9h standard
                                            </div>
                                        </div>

                                        {dailyTimeSummary.remaining > 0 ? (
                                            <div className="bg-green-50 rounded-lg p-3">
                                                <div className="text-xs font-medium text-green-800">Remaining</div>
                                                <div className="text-sm font-semibold text-green-900">
                                                    {Math.floor(dailyTimeSummary.remaining)}h {Math.round((dailyTimeSummary.remaining % 1) * 60)}m
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-orange-50 rounded-lg p-3">
                                                <div className="text-xs font-medium text-orange-800">Over Time</div>
                                                <div className="text-sm font-semibold text-orange-900">
                                                    +{Math.floor(dailyTimeSummary.overTime)}h {Math.round((dailyTimeSummary.overTime % 1) * 60)}m
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        Loading summary...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-end space-x-4">
                            {editTask && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="px-6 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
                            >
                                {editTask ? 'Update Task' : 'Create Task'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskForm;