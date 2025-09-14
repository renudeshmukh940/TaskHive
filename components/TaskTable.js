import React, { useMemo, useState, useEffect } from "react";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, IconButton, Typography, Box, Chip, Button,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControl, InputLabel, Select, MenuItem, Grid, Divider
} from "@mui/material";
import { Edit, Delete, Download, FilterList, Person, Group, Business } from "@mui/icons-material";
import * as XLSX from "xlsx";
import { getFilterOptions } from '../lib/firebase';

const TaskTable = ({ tasks, userProfile, onEdit, onDelete }) => {
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [downloadFilters, setDownloadFilters] = useState({
        date: "",
        team: "",
        teamLeader: "",
        employee: "",
        onlyMyData: false
    });
    const [filterOptions, setFilterOptions] = useState({
        teamLeaders: [],
        employees: [],
        teams: []
    });

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case "completed": return "success";
            case "in progress": return "primary";
            case "on hold": return "warning";
            default: return "default";
        }
    };

    // Group tasks by date
    const groupedTasks = useMemo(() => {
        const grouped = tasks.reduce((acc, task) => {
            if (!acc[task.date]) acc[task.date] = [];
            acc[task.date].push(task);
            return acc;
        }, {});

        return Object.keys(grouped)
            .sort((a, b) => new Date(b) - new Date(a)) // newest first
            .reduce((acc, date) => {
                acc[date] = grouped[date];
                return acc;
            }, {});
    }, [tasks]);

    // Load filter options when download dialog opens
    useEffect(() => {
        if (downloadDialogOpen && userProfile) {
            loadFilterOptions();
        }
    }, [downloadDialogOpen, userProfile]);

    const loadFilterOptions = async () => {
        try {
            const options = await getFilterOptions(userProfile);
            setFilterOptions(options);
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    };

    const handleDownloadFilterChange = (field, value) => {
        setDownloadFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const getFilteredDownloadData = () => {
        if (!downloadFilters.date) return [];

        let filteredTasks = groupedTasks[downloadFilters.date] || [];

        // Apply role-based filtering
        if (downloadFilters.onlyMyData) {
            filteredTasks = filteredTasks.filter(task => task.empId === userProfile.empId);
        }

        // Team filter (for tech leads)
        if (downloadFilters.team && userProfile.role === 'tech-lead') {
            filteredTasks = filteredTasks.filter(task => task.teamName === downloadFilters.team);
        }

        // Team leader filter (for tech leads)
        if (downloadFilters.teamLeader && userProfile.role === 'tech-lead') {
            filteredTasks = filteredTasks.filter(task => task.empId === downloadFilters.teamLeader);
        }

        // Employee filter (for tech leads and team leaders)
        if (downloadFilters.employee && (userProfile.role === 'tech-lead' || userProfile.role === 'team-leader')) {
            filteredTasks = filteredTasks.filter(task => task.empId === downloadFilters.employee);
        }

        return filteredTasks;
    };

    const handleDownloadExcel = () => {
        if (!downloadFilters.date) {
            alert("Please select a date");
            return;
        }

        const filteredData = getFilteredDownloadData();

        if (filteredData.length === 0) {
            alert("No data found for the selected filters");
            return;
        }

        const excelData = filteredData.map(task => ({
            Date: task.date,
            "Employee ID": task.empId,
            "Employee Name": task.empName,
            "Team Name": task.teamName || "",
            "Client ID": task.clientId || "",
            "Client Name": task.clientName || "",
            "Project ID": task.projectId || "",
            "Project Name": task.projectName || "",
            Phase: task.phase || "",
            "Task Description": task.taskDescription,
            "Start Date": task.startDate,
            "End Date": task.endDate,
            "Time Spent": task.timeSpent || "",
            Status: task.status,
            "Percentage Completion": task.percentageCompletion || "",
            Remarks: task.remarks || "",
            "Work Type": task.workType,
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        const columnWidths = Object.keys(excelData[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...excelData.map(row => String(row[key] || "").length)
            ),
        }));
        worksheet["!cols"] = columnWidths;

        // Generate filename based on filters
        let filename = `Task_Report_${downloadFilters.date}`;
        if (downloadFilters.onlyMyData) {
            filename += `_${userProfile.empId}`;
        } else if (downloadFilters.team) {
            filename += `_${downloadFilters.team}`;
        } else if (downloadFilters.employee) {
            filename += `_${downloadFilters.employee}`;
        }
        filename += '.xlsx';

        XLSX.utils.book_append_sheet(workbook, worksheet, `Tasks_${downloadFilters.date}`);
        XLSX.writeFile(workbook, filename);

        setDownloadDialogOpen(false);
        resetDownloadFilters();
    };

    const resetDownloadFilters = () => {
        setDownloadFilters({
            date: "",
            team: "",
            teamLeader: "",
            employee: "",
            onlyMyData: false
        });
    };

    const handleDownloadDialogClose = () => {
        setDownloadDialogOpen(false);
        resetDownloadFilters();
    };

    const getPreviewCount = () => {
        if (!downloadFilters.date) return 0;
        return getFilteredDownloadData().length;
    };

    if (tasks.length === 0) {
        return (
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="h6" color="textSecondary">
                    No tasks found. Add your first task above!
                </Typography>
            </Paper>
        );
    }

    const totalTasks = Object.values(groupedTasks).reduce(
        (sum, dateTasks) => sum + dateTasks.length,
        0
    );

    return (
        <>
            <Paper elevation={3}>
                {/* Header */}
                <Box
                    sx={{
                        p: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Typography variant="h6">Task List ({totalTasks} tasks)</Typography>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        onClick={() => setDownloadDialogOpen(true)}
                        sx={{
                            px: 3,
                            py: 1,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                        }}
                    >
                        Export Excel
                    </Button>
                </Box>

                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Employee</TableCell>
                                <TableCell>Project</TableCell>
                                <TableCell>Task</TableCell>
                                <TableCell>Duration</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Progress</TableCell>
                                <TableCell>Work Type</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(groupedTasks).map(([date, dateTasks]) => (
                                <React.Fragment key={date}>
                                    {/* Date Header Row */}
                                    <TableRow sx={{ backgroundColor: "primary.main" }}>
                                        <TableCell colSpan={9} sx={{ color: "white", fontWeight: "bold" }}>
                                            {date} ({dateTasks.length} tasks)
                                        </TableCell>
                                    </TableRow>

                                    {/* Task Rows */}
                                    {dateTasks.map((task) => (
                                        <TableRow hover key={task.id}>
                                            <TableCell>{task.date}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <div>{task.empName}</div>
                                                    <Typography variant="caption" color="textSecondary">
                                                        ID: {task.empId}
                                                    </Typography>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div>{task.projectName}</div>
                                                    {task.clientName && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            Client: {task.clientName}
                                                        </Typography>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 200 }}>
                                                <Typography variant="body2" noWrap title={task.taskDescription}>
                                                    {task.taskDescription}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {task.startDate} to {task.endDate}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{task.timeSpent}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={task.status}
                                                    color={getStatusColor(task.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{task.percentageCompletion}%</TableCell>
                                            <TableCell>
                                                <Chip label={task.workType} variant="outlined" size="small" />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    onClick={() => onEdit(task)}
                                                    size="small"
                                                    color="primary"
                                                >
                                                    <Edit />
                                                </IconButton>
                                                <IconButton
                                                    onClick={() =>
                                                        onDelete(task.teamName, task.date, task.empId, task.id)
                                                    }
                                                    size="small"
                                                    color="error"
                                                >
                                                    <Delete />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Enhanced Download Dialog */}
            <Dialog
                open={downloadDialogOpen}
                onClose={handleDownloadDialogClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Download color="primary" />
                        Download Excel Report
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography
                        variant="body2"
                        sx={{ mb: 3, color: "text.secondary" }}
                    >
                        Configure your download filters below. You can download all data
                        for a date or apply role-specific filters.
                    </Typography>

                    <Grid container spacing={3}>
                        {/* Date Selection - Required */}
                        <Grid item xs={12}>
                            <FormControl fullWidth required variant="outlined">
                                <InputLabel shrink>Select Date</InputLabel>
                                <Select
                                    value={downloadFilters.date}
                                    onChange={(e) =>
                                        handleDownloadFilterChange("date", e.target.value)
                                    }
                                    label="Select Date"
                                    displayEmpty
                                >
                                    <MenuItem value="">
                                        <em>Choose a date...</em>
                                    </MenuItem>
                                    {Object.keys(groupedTasks).map((date) => {
                                        const taskCount = groupedTasks[date]?.length || 0;
                                        return (
                                            <MenuItem key={date} value={date}>
                                                {date} ({taskCount} tasks)
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* My Data Only */}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel shrink>Data Scope</InputLabel>
                                <Select
                                    value={downloadFilters.onlyMyData}
                                    onChange={(e) =>
                                        handleDownloadFilterChange("onlyMyData", e.target.value)
                                    }
                                    label="Data Scope"
                                    displayEmpty
                                >
                                    <MenuItem value={false}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Group fontSize="small" />
                                            All accessible data
                                        </Box>
                                    </MenuItem>
                                    <MenuItem value={true}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Person fontSize="small" />
                                            Only my data ({userProfile.empName})
                                        </Box>
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Role-specific filters */}
                        {!downloadFilters.onlyMyData && (
                            <>
                                {userProfile?.role === "tech-lead" && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel shrink>Filter by Team</InputLabel>
                                            <Select
                                                value={downloadFilters.team}
                                                onChange={(e) =>
                                                    handleDownloadFilterChange("team", e.target.value)
                                                }
                                                label="Filter by Team"
                                                displayEmpty
                                            >
                                                <MenuItem value="">All Teams</MenuItem>
                                                {filterOptions.teams.map((team) => (
                                                    <MenuItem key={team} value={team}>
                                                        {team}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}

                                {userProfile?.role === "tech-lead" && !downloadFilters.team && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel shrink>Filter by Team Leader</InputLabel>
                                            <Select
                                                value={downloadFilters.teamLeader}
                                                onChange={(e) =>
                                                    handleDownloadFilterChange("teamLeader", e.target.value)
                                                }
                                                label="Filter by Team Leader"
                                                displayEmpty
                                            >
                                                <MenuItem value="">All Team Leaders</MenuItem>
                                                {filterOptions.teamLeaders.map((tl) => (
                                                    <MenuItem key={tl.empId} value={tl.empId}>
                                                        {tl.empName} ({tl.empId}) - {tl.teamName}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}

                                {(userProfile?.role === "tech-lead" ||
                                    userProfile?.role === "team-leader") && (
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth variant="outlined">
                                                <InputLabel shrink>Filter by Employee</InputLabel>
                                                <Select
                                                    value={downloadFilters.employee}
                                                    onChange={(e) =>
                                                        handleDownloadFilterChange("employee", e.target.value)
                                                    }
                                                    label="Filter by Employee"
                                                    displayEmpty
                                                >
                                                    <MenuItem value="">All Employees</MenuItem>
                                                    {filterOptions.employees.map((emp) => (
                                                        <MenuItem key={emp.empId} value={emp.empId}>
                                                            <Box
                                                                sx={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 1,
                                                                }}
                                                            >
                                                                {emp.isCurrentUser && (
                                                                    <Chip
                                                                        label="Me"
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="filled"
                                                                    />
                                                                )}
                                                                {emp.empName} ({emp.empId})
                                                                {userProfile?.role === "tech-lead" &&
                                                                    ` - ${emp.teamName}`}
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    )}
                            </>
                        )}
                    </Grid>

                    {/* Preview Count */}
                    {downloadFilters.date && (
                        <Box
                            sx={{
                                mt: 3,
                                p: 2,
                                bgcolor: "grey.50",
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Typography variant="body2" color="primary">
                                <strong>Preview:</strong> {getPreviewCount()} tasks will be
                                downloaded
                                {downloadFilters.onlyMyData === true &&
                                    ` (only your data: ${userProfile.empName})`}
                                {downloadFilters.onlyMyData === "team-leaders" &&
                                    ` (only team leaders data)`}
                                {downloadFilters.onlyMyData === "employees" &&
                                    ` (only employees data, excluding leaders)`}
                            </Typography>
                        </Box>
                    )}

                    {/* Help text */}
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            {userProfile?.role === "tech-lead" &&
                                "As a Tech Lead, you can download: all accessible data, only your data, only team leaders data, only employees data, or apply specific filters."}
                            {userProfile?.role === "team-leader" &&
                                "As a Team Leader, you can download all team data, your own data only, or filter by specific employees in your team."}
                            {userProfile?.role === "employee" &&
                                "As an Employee, you can download all accessible data or filter to download only your own tasks."}
                        </Typography>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 3, gap: 2 }}>
                    <Button
                        onClick={handleDownloadDialogClose}
                        variant="outlined"
                        size="large"
                        sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 600,
                            minHeight: 48
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDownloadExcel}
                        variant="contained"
                        disabled={!downloadFilters.date}
                        startIcon={<Download sx={{ fontSize: '1.2rem' }} />}
                        size="large"
                        sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 700,
                            minHeight: 48,
                            boxShadow: 2,
                            '&:hover': {
                                boxShadow: 4
                            }
                        }}
                    >
                        Download ({getPreviewCount()} tasks)
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default TaskTable;