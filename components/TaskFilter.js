// Updated components/TaskFilter.js - Add date range selection and optimize for today's data by default
import React, { useState, useEffect } from 'react';
import {
    Box, TextField, MenuItem, Button, Typography, Grid,
    Chip, FormControl, InputLabel, Select, Collapse, IconButton,
    Card, CardContent, Divider, Badge, ToggleButton, ToggleButtonGroup,
    Avatar
} from '@mui/material';
import {
    FilterList, Clear, CalendarToday, Person, Group, Business,
    ExpandMore, ExpandLess, FilterAlt, SupervisorAccount
} from '@mui/icons-material';
import { getFilterOptions } from '../lib/firebase';

const TaskFilter = ({
    userProfile,
    onFilterChange,
    currentFilters = {},
    dateRangeOptions = [],
    showOwnOnly = true,
    onToggleOwnOnly
}) => {
    const [filters, setFilters] = useState({
        dateRange: currentFilters.dateRange || 'today',
        teamLeader: currentFilters.teamLeader || '',
        trackLead: currentFilters.trackLead || '',
        employee: currentFilters.employee || '',
        team: currentFilters.team || '',
        techLead: currentFilters.techLead || '',
        status: currentFilters.status || '',
        workType: currentFilters.workType || '',
        percentageCompletion: currentFilters.percentageCompletion || '',
        client: currentFilters.client || ''
    });

    const [filterOptions, setFilterOptions] = useState({
        techLeads: [],
        teamLeaders: [],
        trackLeads: [],
        employees: [],
        teams: []
    });

    const [expanded, setExpanded] = useState(false);

    // Load filter options once on mount
    useEffect(() => {
        if (userProfile) {
            loadFilterOptions();
        }
    }, [userProfile]);

    // Sync local filters with parent when currentFilters change
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            dateRange: currentFilters.dateRange || 'today',
            teamLeader: currentFilters.teamLeader || '',
            trackLead: currentFilters.trackLead || '',
            employee: currentFilters.employee || '',
            team: currentFilters.team || '',
            techLead: currentFilters.techLead || '',
            status: currentFilters.status || '',
            workType: currentFilters.workType || '',
            percentageCompletion: currentFilters.percentageCompletion || '',
            client: currentFilters.client || ''
        }));
    }, [currentFilters]);

    const loadFilterOptions = async () => {
        try {
            const options = await getFilterOptions(userProfile);
            setFilterOptions({
                techLeads: options.techLeads || [],
                teamLeaders: options.teamLeaders || [],
                trackLeads: options.trackLeads || [],
                employees: options.employees || [],
                teams: options.teams || []
            });
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    };

    const handleFilterChange = (field, value) => {
        const newFilters = { ...filters, [field]: value };
        setFilters(newFilters);

        // Handle date range special logic
        if (field === 'dateRange') {
            const selectedRange = dateRangeOptions.find(range => range.value === value);
            if (selectedRange) {
                const dateFilters = {
                    ...newFilters,
                    dateFrom: selectedRange.from,
                    dateTo: selectedRange.to
                };
                // Instant callback to parent with date info
                if (typeof onFilterChange === 'function') {
                    onFilterChange(dateFilters);
                }
                return;
            }
        }

        // For all other filters, instant callback to parent
        if (typeof onFilterChange === 'function') {
            onFilterChange(newFilters);
        }
    };

    const clearAllFilters = () => {
        const clearedFilters = {
            dateRange: 'today',
            teamLeader: '',
            trackLead: '',
            employee: '',
            team: '',
            techLead: '',
            status: '',
            workType: '',
            percentageCompletion: '',
            client: '',
            // Add date info for today
            dateFrom: dateRangeOptions.find(range => range.value === 'today')?.from || format(startOfToday(), 'yyyy-MM-dd'),
            dateTo: dateRangeOptions.find(range => range.value === 'today')?.to || format(startOfToday(), 'yyyy-MM-dd')
        };
        setFilters(clearedFilters);

        if (typeof onFilterChange === 'function') {
            onFilterChange(clearedFilters);
        }
    };


    const clearSpecificFilter = (field) => {
        let newValue = field === 'dateRange' ? 'today' : '';
        let updatedFilters = { ...filters, [field]: newValue };

        // Handle date range clearing
        if (field === 'dateRange') {
            const todayRange = dateRangeOptions.find(range => range.value === 'today');
            if (todayRange) {
                updatedFilters = {
                    ...updatedFilters,
                    dateFrom: todayRange.from,
                    dateTo: todayRange.to
                };
            }
        }

        setFilters(updatedFilters);

        if (typeof onFilterChange === 'function') {
            onFilterChange(updatedFilters);
        }
    };

    const getActiveFiltersCount = () => {
        return Object.values(filters).filter(value => value && value !== 'today').length;
    };

    // Filter employees based on hierarchy selection
    const getFilteredEmployees = () => {
        let filteredEmps = [...filterOptions.employees];

        // Filter by tech lead if selected
        if (filters.techLead && userProfile?.role === 'tech-lead') {
            const selectedTechLead = filterOptions.techLeads.find(tl => tl.empId === filters.techLead);
            if (selectedTechLead && selectedTechLead.managedTeams) {
                filteredEmps = filteredEmps.filter(emp => selectedTechLead.managedTeams.includes(emp.teamName));
            }
        }

        // Filter by team leader if selected
        if (filters.teamLeader) {
            const selectedTeamLeader = filterOptions.teamLeaders.find(tl => tl.empId === filters.teamLeader);
            if (selectedTeamLeader) {
                filteredEmps = filteredEmps.filter(emp => emp.teamName === selectedTeamLeader.teamName);
            }
        }

        // Filter by track lead if selected
        if (filters.trackLead && (userProfile?.role === 'team-leader' || userProfile?.role === 'tech-lead')) {
            filteredEmps = filteredEmps.filter(emp => emp.reportsTo === filters.trackLead);
        }

        // If employee filter is set, show only that
        if (filters.employee) {
            filteredEmps = filteredEmps.filter(emp => emp.empId === filters.employee);
        }

        return filteredEmps;
    };

    const renderFilterChips = () => {
        const activeFilters = [];

        // Date Range Chip
        if (filters.dateRange !== 'today') {
            const selectedRange = dateRangeOptions.find(range => range.value === filters.dateRange);
            activeFilters.push(
                <Chip
                    key="dateRange"
                    label={`Period: ${selectedRange?.label}`}
                    onDelete={() => clearSpecificFilter('dateRange')}
                    color="primary"
                    variant="filled"
                    icon={<CalendarToday />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Team Filter Chip
        if (filters.team) {
            activeFilters.push(
                <Chip
                    key="team"
                    label={`Team: ${filters.team}`}
                    onDelete={() => clearSpecificFilter('team')}
                    color="secondary"
                    variant="filled"
                    icon={<Business />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Tech Lead Filter Chip
        if (filters.techLead && userProfile?.role === 'tech-lead') {
            const tl = filterOptions.techLeads.find(tl => tl.empId === filters.techLead);
            activeFilters.push(
                <Chip
                    key="techLead"
                    label={`Tech Lead: ${tl?.empName || filters.techLead}`}
                    onDelete={() => clearSpecificFilter('techLead')}
                    color="error"
                    variant="filled"
                    icon={<SupervisorAccount />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Team Leader Filter Chip
        if (filters.teamLeader) {
            const tl = filterOptions.teamLeaders.find(tl => tl.empId === filters.teamLeader);
            activeFilters.push(
                <Chip
                    key="teamLeader"
                    label={`Team Leader: ${tl?.empName || filters.teamLeader}`}
                    onDelete={() => clearSpecificFilter('teamLeader')}
                    color="warning"
                    variant="filled"
                    icon={<Group />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Track Lead Filter Chip
        if (filters.trackLead) {
            const tl = filterOptions.trackLeads.find(tl => tl.empId === filters.trackLead);
            activeFilters.push(
                <Chip
                    key="trackLead"
                    label={`Track Lead: ${tl?.empName || filters.trackLead}`}
                    onDelete={() => clearSpecificFilter('trackLead')}
                    color="info"
                    variant="filled"
                    icon={<SupervisorAccount />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Employee Filter Chip
        if (filters.employee) {
            const emp = filterOptions.employees.find(emp => emp.empId === filters.employee);
            activeFilters.push(
                <Chip
                    key="employee"
                    label={`Employee: ${emp?.empName || filters.employee}`}
                    onDelete={() => clearSpecificFilter('employee')}
                    color="success"
                    variant="filled"
                    icon={<Person />}
                    sx={{
                        fontWeight: 600,
                        backgroundColor: 'success.main',
                        '& .MuiChip-icon': { color: 'white' },
                        '& .MuiChip-deleteIcon': { color: 'white' },
                        '& .MuiChip-label': { color: 'white' }
                    }}
                />
            );
        }

        // Status Filter Chip
        if (filters.status) {
            activeFilters.push(
                <Chip
                    key="status"
                    label={`Status: ${filters.status}`}
                    onDelete={() => clearSpecificFilter('status')}
                    color={filters.status === 'Completed' ? 'success' :
                        filters.status === 'In Progress' ? 'primary' : 'warning'}
                    variant="outlined"
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Work Type Filter Chip
        if (filters.workType) {
            activeFilters.push(
                <Chip
                    key="workType"
                    label={`Type: ${filters.workType}`}
                    onDelete={() => clearSpecificFilter('workType')}
                    color="secondary"
                    variant="outlined"
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Progress Filter Chip
        if (filters.percentageCompletion) {
            activeFilters.push(
                <Chip
                    key="progress"
                    label={`Progress: ${filters.percentageCompletion}`}
                    onDelete={() => clearSpecificFilter('percentageCompletion')}
                    color="info"
                    variant="outlined"
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        // Client Filter Chip
        if (filters.client) {
            activeFilters.push(
                <Chip
                    key="client"
                    label={`Client: ${filters.client}`}
                    onDelete={() => clearSpecificFilter('client')}
                    color="default"
                    variant="outlined"
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        return activeFilters;
    };

    return (
        <Card elevation={8} sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
                {/* Filter Header */}
                <Box
                    sx={{
                        p: 3,
                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                            <FilterList />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight={600}>
                                Filters
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {getActiveFiltersCount()} active filters
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                            onClick={() => setExpanded(!expanded)}
                            sx={{ color: 'white' }}
                        >
                            {expanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                        <Button
                            onClick={clearAllFilters}
                            variant="outlined"
                            size="small"
                            sx={{
                                color: 'white',
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                '&:hover': { borderColor: 'white' }
                            }}
                        >
                            <Clear />
                        </Button>
                    </Box>
                </Box>

                {/* Filter Content */}
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 3 }}>
                        {/* Date Range Filter - Always visible, first position */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Date Range</InputLabel>
                                    <Select
                                        value={filters.dateRange}
                                        onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                                        label="Date Range"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {dateRangeOptions.map((range) => (
                                            <MenuItem key={range.value} value={range.value}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CalendarToday fontSize="small" />
                                                    {range.label}
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Own Data Toggle */}
                            <Grid item xs={12} md={8} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <ToggleButtonGroup
                                    value={showOwnOnly}
                                    exclusive
                                    onChange={(e, newValue) => {
                                        if (newValue !== null) {
                                            onToggleOwnOnly();
                                        }
                                    }}
                                    sx={{ borderRadius: 2, overflow: 'hidden' }}
                                >
                                    <ToggleButton
                                        value={true}
                                        sx={{
                                            borderRadius: 2,
                                            backgroundColor: showOwnOnly ? 'primary.main' : 'grey.100',
                                            color: showOwnOnly ? 'white' : 'text.primary',
                                            '&.Mui-selected': { backgroundColor: 'primary.main' }
                                        }}
                                    >
                                        <Person fontSize="small" sx={{ mr: 0.5 }} />
                                        My Data Only
                                    </ToggleButton>
                                    <ToggleButton
                                        value={false}
                                        sx={{
                                            borderRadius: 2,
                                            backgroundColor: !showOwnOnly ? 'secondary.main' : 'grey.100',
                                            color: !showOwnOnly ? 'white' : 'text.primary',
                                            '&.Mui-selected': { backgroundColor: 'secondary.main' }
                                        }}
                                    >
                                        <Group fontSize="small" sx={{ mr: 0.5 }} />
                                        Team Data
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Grid>
                        </Grid>

                        {/* Hierarchy Filters */}
                        {!showOwnOnly && (
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                {/* Team Filter - Tech Leads only */}
                                {userProfile?.role === 'tech-lead' && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel shrink>Filter by Team</InputLabel>
                                            <Select
                                                value={filters.team || ''}
                                                onChange={(e) => handleFilterChange("team", e.target.value)}
                                                label="Filter by Team"
                                                displayEmpty
                                                sx={{ borderRadius: 2 }}
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

                                {/* Tech Lead Role-based Filters */}
                                {userProfile?.role === 'tech-lead' && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth variant="outlined">
                                                <InputLabel shrink>View Specific Role</InputLabel>
                                                <Select
                                                    value={filters.viewRole || ''}
                                                    onChange={(e) => {
                                                        const role = e.target.value;
                                                        // Clear all hierarchy filters first
                                                        const clearedFilters = {
                                                            ...filters,
                                                            techLead: '',
                                                            teamLeader: '',
                                                            trackLead: '',
                                                            employee: '',
                                                            viewRole: role
                                                        };
                                                        setFilters(clearedFilters);
                                                        handleFilterChange("viewRole", role);
                                                    }}
                                                    label="View Specific Role"
                                                    displayEmpty
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    <MenuItem value="">All Subordinates</MenuItem>
                                                    <MenuItem value="team-leader">Team Leaders Only</MenuItem>
                                                    <MenuItem value="track-lead">Track Leads Only</MenuItem>
                                                    <MenuItem value="employee">Employees Only</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        {/* Specific Person Filter based on role selection */}
                                        {filters.viewRole === 'team-leader' && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Select Team Leader</InputLabel>
                                                    <Select
                                                        value={filters.teamLeader || ''}
                                                        onChange={(e) => handleFilterChange("teamLeader", e.target.value)}
                                                        label="Select Team Leader"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
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

                                        {filters.viewRole === 'track-lead' && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Select Track Lead</InputLabel>
                                                    <Select
                                                        value={filters.trackLead || ''}
                                                        onChange={(e) => handleFilterChange("trackLead", e.target.value)}
                                                        label="Select Track Lead"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        <MenuItem value="">All Track Leads</MenuItem>
                                                        {filterOptions.trackLeads.map((tl) => (
                                                            <MenuItem key={tl.empId} value={tl.empId}>
                                                                {tl.empName} ({tl.empId}) - {tl.teamName}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        )}

                                        {filters.viewRole === 'employee' && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Select Employee</InputLabel>
                                                    <Select
                                                        value={filters.employee || ''}
                                                        onChange={(e) => handleFilterChange("employee", e.target.value)}
                                                        label="Select Employee"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        <MenuItem value="">All Employees</MenuItem>
                                                        {filterOptions.employees.map((emp) => (
                                                            <MenuItem key={emp.empId} value={emp.empId}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Avatar
                                                                        sx={{
                                                                            width: 24,
                                                                            height: 24,
                                                                            fontSize: '0.7rem',
                                                                            bgcolor: 'primary.main'
                                                                        }}
                                                                    >
                                                                        {emp.empName.charAt(0).toUpperCase()}
                                                                    </Avatar>
                                                                    <Box>
                                                                        <Typography variant="body2" fontWeight={600}>
                                                                            {emp.empName}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            {emp.empId} • {emp.teamName}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        )}
                                    </>
                                )}

                                {/* Team Leader Role-based Filters */}
                                {userProfile?.role === 'team-leader' && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth variant="outlined">
                                                <InputLabel shrink>View Specific Role</InputLabel>
                                                <Select
                                                    value={filters.viewRole || ''}
                                                    onChange={(e) => {
                                                        const role = e.target.value;
                                                        const clearedFilters = {
                                                            ...filters,
                                                            trackLead: '',
                                                            employee: '',
                                                            viewRole: role
                                                        };
                                                        setFilters(clearedFilters);
                                                        handleFilterChange("viewRole", role);
                                                    }}
                                                    label="View Specific Role"
                                                    displayEmpty
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    <MenuItem value="">All Subordinates</MenuItem>
                                                    <MenuItem value="track-lead">Track Leads Only</MenuItem>
                                                    <MenuItem value="employee">Employees Only</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        {filters.viewRole === 'track-lead' && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Select Track Lead</InputLabel>
                                                    <Select
                                                        value={filters.trackLead || ''}
                                                        onChange={(e) => handleFilterChange("trackLead", e.target.value)}
                                                        label="Select Track Lead"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        <MenuItem value="">All Track Leads</MenuItem>
                                                        {filterOptions.trackLeads.map((tl) => (
                                                            <MenuItem key={tl.empId} value={tl.empId}>
                                                                {tl.empName} ({tl.empId})
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        )}

                                        {filters.viewRole === 'employee' && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Select Employee</InputLabel>
                                                    <Select
                                                        value={filters.employee || ''}
                                                        onChange={(e) => handleFilterChange("employee", e.target.value)}
                                                        label="Select Employee"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        <MenuItem value="">All Employees</MenuItem>
                                                        {filterOptions.employees.filter(emp => emp.teamName === userProfile.teamName).map((emp) => (
                                                            <MenuItem key={emp.empId} value={emp.empId}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Avatar
                                                                        sx={{
                                                                            width: 24,
                                                                            height: 24,
                                                                            fontSize: '0.7rem',
                                                                            bgcolor: 'primary.main'
                                                                        }}
                                                                    >
                                                                        {emp.empName.charAt(0).toUpperCase()}
                                                                    </Avatar>
                                                                    <Box>
                                                                        <Typography variant="body2" fontWeight={600}>
                                                                            {emp.empName}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            {emp.empId}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        )}
                                    </>
                                )}

                                {/* Track Lead Role-based Filters */}
                                {userProfile?.role === 'track-lead' && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel shrink>Select Employee</InputLabel>
                                            <Select
                                                value={filters.employee || ''}
                                                onChange={(e) => handleFilterChange("employee", e.target.value)}
                                                label="Select Employee"
                                                displayEmpty
                                                sx={{ borderRadius: 2 }}
                                            >
                                                <MenuItem value="">All My Reports</MenuItem>
                                                {filterOptions.employees
                                                    .filter(emp => emp.teamName === userProfile.teamName && emp.reportsTo === userProfile.empId)
                                                    .map((emp) => (
                                                        <MenuItem key={emp.empId} value={emp.empId}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Avatar
                                                                    sx={{
                                                                        width: 24,
                                                                        height: 24,
                                                                        fontSize: '0.7rem',
                                                                        bgcolor: 'primary.main'
                                                                    }}
                                                                >
                                                                    {emp.empName.charAt(0).toUpperCase()}
                                                                </Avatar>
                                                                <Box>
                                                                    <Typography variant="body2" fontWeight={600}>
                                                                        {emp.empName}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="textSecondary">
                                                                        {emp.empId}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                            </Grid>
                        )}

                        {/* Task Status and Type Filters - Always available, instant */}
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Status</InputLabel>
                                    <Select
                                        value={filters.status || ''}
                                        onChange={(e) => handleFilterChange("status", e.target.value)}
                                        label="Status"
                                        displayEmpty
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="">All Status</MenuItem>
                                        <MenuItem value="Completed">Completed</MenuItem>
                                        <MenuItem value="In Progress">In Progress</MenuItem>
                                        <MenuItem value="On Hold">On Hold</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Work Type</InputLabel>
                                    <Select
                                        value={filters.workType || ''}
                                        onChange={(e) => handleFilterChange("workType", e.target.value)}
                                        label="Work Type"
                                        displayEmpty
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="">All Types</MenuItem>
                                        <MenuItem value="Full-day">Full-day</MenuItem>
                                        <MenuItem value="Half-day">Half-day</MenuItem>
                                        <MenuItem value="Relaxation">Relaxation</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Progress</InputLabel>
                                    <Select
                                        value={filters.percentageCompletion || ''}
                                        onChange={(e) => handleFilterChange("percentageCompletion", e.target.value)}
                                        label="Progress"
                                        displayEmpty
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="">All Progress</MenuItem>
                                        <MenuItem value="0-25">0-25%</MenuItem>
                                        <MenuItem value="26-50">26-50%</MenuItem>
                                        <MenuItem value="51-75">51-75%</MenuItem>
                                        <MenuItem value="76-100">76-100%</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Client</InputLabel>
                                    <Select
                                        value={filters.client || ''}
                                        onChange={(e) => handleFilterChange("client", e.target.value)}
                                        label="Client"
                                        displayEmpty
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="">All Clients</MenuItem>
                                        <MenuItem value="Client A">Client A</MenuItem>
                                        <MenuItem value="Client B">Client B</MenuItem>
                                        <MenuItem value="Client C">Client C</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {/* Active Filter Chips */}
                        {getActiveFiltersCount() > 0 && (
                            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary', mb: 1, display: 'block' }}>
                                    Active Filters:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {renderFilterChips()}
                                </Box>
                            </Box>
                        )}

                        {/* Help text */}
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Typography variant="body2" color="textSecondary" fontWeight={500}>
                                <FilterList sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'middle' }} />
                                {showOwnOnly
                                    ? `Personal View: Showing your tasks for ${dateRangeOptions.find(range => range.value === filters.dateRange)?.label || 'today'}.`
                                    : userProfile?.role === 'tech-lead'
                                        ? `Team Management: Filter by hierarchy across your managed teams for ${dateRangeOptions.find(range => range.value === filters.dateRange)?.label || 'today'}.`
                                        : userProfile?.role === 'team-leader'
                                            ? `Team Leadership: Filter by track leads and employees within your team for ${dateRangeOptions.find(range => range.value === filters.dateRange)?.label || 'today'}.`
                                            : userProfile?.role === 'track-lead'
                                                ? `Track Management: Filter your direct reports for ${dateRangeOptions.find(range => range.value === filters.dateRange)?.label || 'today'}.`
                                                : 'Employee View: Filter your personal tasks by date and type.'
                                }
                            </Typography>
                        </Box>
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    );
};

export default TaskFilter;