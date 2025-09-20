// components/TaskFilter.js - No loading states, instant employee filtering
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
import {
    format,
    startOfWeek,
    endOfWeek,
    startOfToday
} from 'date-fns';

const TaskFilter = ({
    userProfile,
    onFilterChange,
    currentFilters = {},
    showOwnOnly = true,
    onToggleOwnOnly
}) => {
    const [filters, setFilters] = useState({
        dateFrom: currentFilters.dateFrom || format(startOfToday(), 'yyyy-MM-dd'),
        dateTo: currentFilters.dateTo || format(startOfToday(), 'yyyy-MM-dd'),
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

    // Load filter options once on mount - no loading state
    useEffect(() => {
        if (userProfile) {
            // Fire and forget - no loading state
            loadFilterOptions();
        }
    }, [userProfile]);

    // Sync local filters with parent when currentFilters change
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            dateFrom: currentFilters.dateFrom || format(startOfToday(), 'yyyy-MM-dd'),
            dateTo: currentFilters.dateTo || format(startOfToday(), 'yyyy-MM-dd'),
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

    // Load filter options - fire and forget, no loading state
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
            // Set empty arrays as fallback - no loading state shown
            setFilterOptions({
                techLeads: [],
                teamLeaders: [],
                trackLeads: [],
                employees: [],
                teams: []
            });
        }
    };

    // Instant filter change - no delay, direct response
    const handleFilterChange = (field, value) => {
        const newFilters = { ...filters, [field]: value };
        setFilters(newFilters);

        // Instant callback to parent - no loading
        if (typeof onFilterChange === 'function') {
            onFilterChange(newFilters);
        }
    };

    const clearAllFilters = () => {
        const clearedFilters = {
            dateFrom: format(startOfToday(), 'yyyy-MM-dd'),
            dateTo: format(startOfToday(), 'yyyy-MM-dd'),
            teamLeader: '',
            trackLead: '',
            employee: '',
            team: '',
            techLead: '',
            status: '',
            workType: '',
            percentageCompletion: '',
            client: ''
        };
        setFilters(clearedFilters);

        // Instant callback
        if (typeof onFilterChange === 'function') {
            onFilterChange(clearedFilters);
        }
    };

    const clearSpecificFilter = (field) => {
        const newValue = field === 'dateFrom' || field === 'dateTo'
            ? format(startOfToday(), 'yyyy-MM-dd')
            : '';
        handleFilterChange(field, newValue);
    };

    const getActiveFiltersCount = () => {
        return Object.values(filters).filter(value => value && value !== '').length;
    };

    // Filter employees based on hierarchy selection
    const getFilteredEmployees = () => {
        let filteredEmps = [...filterOptions.employees];

        // If track lead is selected, only show employees under that track lead
        if (filters.trackLead && userProfile?.role === 'team-leader') {
            // For team leaders, filter employees by selected track lead's reports
            // This would require additional logic to get employees under specific track lead
            console.log('Filtering employees by track lead:', filters.trackLead);
            // For now, we'll just show all - you can enhance this based on your data structure
        }

        // If employee filter is already set, show only that employee
        if (filters.employee) {
            filteredEmps = filteredEmps.filter(emp => emp.empId === filters.employee);
        }

        return filteredEmps;
    };

    const renderFilterChips = () => {
        const activeFilters = [];

        // Date Range Chip
        if (filters.dateFrom !== format(startOfToday(), 'yyyy-MM-dd') ||
            filters.dateTo !== format(startOfToday(), 'yyyy-MM-dd')) {
            const dateRange = filters.dateFrom && filters.dateTo
                ? `${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)}`
                : filters.dateFrom && filters.dateFrom !== format(startOfToday(), 'yyyy-MM-dd')
                    ? `From ${formatDate(filters.dateFrom)}`
                    : `To ${formatDate(filters.dateTo)}`;
            activeFilters.push(
                <Chip
                    key="date"
                    label={dateRange}
                    onDelete={() => {
                        handleFilterChange('dateFrom', format(startOfToday(), 'yyyy-MM-dd'));
                        handleFilterChange('dateTo', format(startOfToday(), 'yyyy-MM-dd'));
                    }}
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

        // Employee Filter Chip - Shows selected employee only
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
                        fontWeight: 600, // Bold for selected employee
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
                    color="secondary"
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

    // Helper function to format dates
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Date preset helper functions
    const getPresetDate = (preset, type) => {
        const today = startOfToday();

        switch (preset) {
            case 'today':
                return format(today, 'yyyy-MM-dd');
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return format(yesterday, 'yyyy-MM-dd');
            case 'this-week':
                if (type === 'from') {
                    return format(startOfWeek(today), 'yyyy-MM-dd');
                }
                return format(endOfWeek(today), 'yyyy-MM-dd');
            case 'last-week':
                const lastWeekStart = startOfWeek(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
                const lastWeekEnd = endOfWeek(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
                return type === 'from' ? format(lastWeekStart, 'yyyy-MM-dd') : format(lastWeekEnd, 'yyyy-MM-dd');
            case 'this-month':
                if (type === 'from') {
                    return format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
                }
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                return format(lastDay, 'yyyy-MM-dd');
            default:
                return format(today, 'yyyy-MM-dd');
        }
    };

    const applyDatePreset = (preset) => {
        const dateFrom = getPresetDate(preset, 'from');
        const dateTo = getPresetDate(preset, 'to');

        // Instant update - no loading
        handleFilterChange('dateFrom', dateFrom);
        handleFilterChange('dateTo', dateTo);
    };

    // Safe render - no loading fallback, just return null if no user
    if (!userProfile) {
        return null;
    }

    return (
        <Card elevation={3} sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent sx={{ pb: '16px !important' }}>
                {/* Header with Own/Team Toggle - Instant response */}
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        {/* Filter Toggle Button - Instant */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Badge
                                badgeContent={getActiveFiltersCount()}
                                color="primary"
                                sx={{
                                    '& .MuiBadge-badge': {
                                        fontWeight: 600,
                                        fontSize: '0.75rem',
                                    },
                                }}
                            >
                                <Button
                                    startIcon={<FilterAlt />}
                                    endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                                    onClick={() => setExpanded(!expanded)} // Instant toggle
                                    variant={getActiveFiltersCount() > 0 ? 'contained' : 'outlined'}
                                    sx={{
                                        px: 3,
                                        py: 1.5,
                                        borderRadius: 2,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        minWidth: 140,
                                    }}
                                    color={getActiveFiltersCount() > 0 ? 'primary' : 'inherit'}
                                >
                                    Filters ({getActiveFiltersCount()})
                                </Button>
                            </Badge>

                            {/* Own/Team View Toggle - Instant response */}
                            {(userProfile?.role === 'track-lead' ||
                                userProfile?.role === 'team-leader' ||
                                userProfile?.role === 'tech-lead') && (
                                    <ToggleButtonGroup
                                        value={showOwnOnly}
                                        exclusive
                                        onChange={(_, newValue) => {
                                            if (newValue !== undefined && typeof onToggleOwnOnly === 'function') {
                                                onToggleOwnOnly(); // Instant toggle
                                            }
                                        }}
                                        aria-label="task view"
                                        size="small"
                                        color="primary"
                                        sx={{ borderRadius: 2, height: 36 }}
                                    >
                                        <ToggleButton
                                            value={true}
                                            selected={showOwnOnly}
                                            sx={{
                                                borderRadius: '16px 0 0 16px !important',
                                                borderColor: showOwnOnly ? 'primary.main !important' : undefined,
                                                backgroundColor: showOwnOnly ? 'primary.50' : undefined,
                                                '&:hover': {
                                                    backgroundColor: showOwnOnly ? 'primary.100' : 'action.hover'
                                                }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Person sx={{ fontSize: 16 }} />
                                                <Typography variant="caption" sx={{ fontWeight: 600, ml: 0.5 }}>
                                                    My Tasks
                                                </Typography>
                                            </Box>
                                        </ToggleButton>
                                        <ToggleButton
                                            value={false}
                                            selected={!showOwnOnly}
                                            sx={{
                                                borderRadius: '0 16px 16px 0 !important',
                                                borderColor: !showOwnOnly ? 'primary.main !important' : undefined,
                                                backgroundColor: !showOwnOnly ? 'primary.50' : undefined,
                                                '&:hover': {
                                                    backgroundColor: !showOwnOnly ? 'primary.100' : 'action.hover'
                                                }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Group sx={{ fontSize: 16 }} />
                                                <Typography variant="caption" sx={{ fontWeight: 600, ml: 0.5 }}>
                                                    Team View
                                                </Typography>
                                                {!showOwnOnly && (
                                                    <Badge
                                                        badgeContent={filters.employee ? 1 : 0}
                                                        color="secondary"
                                                        sx={{ ml: 0.5 }}
                                                    />
                                                )}
                                            </Box>
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                )}
                        </Box>

                        {/* Action Buttons - Instant clear */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {getActiveFiltersCount() > 0 && (
                                <Button
                                    startIcon={<Clear />}
                                    onClick={clearAllFilters} // Instant clear
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    sx={{
                                        px: 2.5,
                                        py: 1,
                                        borderRadius: 2,
                                        textTransform: 'none',
                                        fontWeight: 500,
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Clear All
                                </Button>
                            )}
                        </Box>
                    </Box>

                    {/* View Mode Indicator - Instant update, no loading */}
                    <Box sx={{
                        mt: 1,
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: showOwnOnly ? 'success.50' : 'info.50',
                        border: `1px solid ${showOwnOnly ? 'success.main' : 'info.main'}`,
                        mb: 2
                    }}>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {showOwnOnly
                                ? `👤 Showing only your tasks for ${formatDate(filters.dateFrom)}`
                                : `👥 Team View: ${filterOptions.employees.length || 0} team members • ${filterOptions.trackLeads.length || 0} track leads`
                            }
                            {(!showOwnOnly && getActiveFiltersCount() > 0) && (
                                <>, {getActiveFiltersCount()} filters applied</>
                            )}
                        </Typography>
                    </Box>
                </Box>

                {/* Active Filters Display - Instant update */}
                {getActiveFiltersCount() > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            gutterBottom
                            fontWeight={500}
                        >
                            Active Filters:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {renderFilterChips()}
                        </Box>
                        <Divider />
                    </Box>
                )}

                {/* Collapsible Filter Content - Instant response, no loading */}
                <Collapse in={expanded} timeout="auto">
                    <Box sx={{ pt: 3 }}>
                        <Grid container spacing={3}>
                            {/* Date Range Filters - Instant response */}
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Date From"
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)} // Instant
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                        startAdornment: (
                                            <CalendarToday sx={{ mr: 1, color: 'action.active' }} />
                                        ),
                                    }}
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '& fieldset': { borderColor: 'divider' }
                                        },
                                    }}
                                    helperText={showOwnOnly ? "Your task date range" : "Team task date range"}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="To Date"
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                        startAdornment: (
                                            <CalendarToday sx={{ mr: 1, color: 'action.active' }} />
                                        ),
                                    }}
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '& fieldset': { borderColor: 'divider' }
                                        },
                                    }}
                                    helperText={showOwnOnly ? "Your task date range" : "Team task date range"}
                                />
                            </Grid>


                            {/* Quick Date Presets - Instant response */}
                            <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                                    {[
                                        { label: 'Today', value: 'today' },
                                        { label: 'Yesterday', value: 'yesterday' },
                                        { label: 'This Week', value: 'this-week' },
                                        { label: 'Last Week', value: 'last-week' },
                                    ].map((preset) => (
                                        <Button
                                            key={preset.value}
                                            variant={
                                                (filters.dateFrom === getPresetDate(preset.value, 'from') &&
                                                    filters.dateTo === getPresetDate(preset.value, 'to'))
                                                    ? 'contained' : 'outlined'
                                            }
                                            size="small"
                                            onClick={() => applyDatePreset(preset.value)} // Instant
                                            sx={{
                                                minWidth: 100,
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                fontWeight: 500
                                            }}
                                        >
                                            {preset.label}
                                        </Button>
                                    ))}
                                </Box>
                            </Grid>

                            {/* Hierarchy Filters - Only show when not in own-only mode, instant response */}
                            {!showOwnOnly && (
                                <>
                                    {/* Team Filter - Tech Leads only */}
                                    {userProfile?.role === 'tech-lead' && (
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth variant="outlined">
                                                <InputLabel shrink>Filter by Team</InputLabel>
                                                <Select
                                                    value={filters.team}
                                                    onChange={(e) => handleFilterChange("team", e.target.value)} // Instant
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

                                    {/* Tech Lead Filter - Tech Leads only */}
                                    {userProfile?.role === 'tech-lead' && filters.team === '' && (
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth variant="outlined">
                                                <InputLabel shrink>Filter by Tech Lead</InputLabel>
                                                <Select
                                                    value={filters.techLead || ''}
                                                    onChange={(e) => handleFilterChange("techLead", e.target.value)} // Instant
                                                    label="Filter by Tech Lead"
                                                    displayEmpty
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    <MenuItem value="">All Tech Leads</MenuItem>
                                                    {filterOptions.techLeads.map((tl) => (
                                                        <MenuItem key={tl.empId} value={tl.empId}>
                                                            {tl.empName} ({tl.empId})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    )}

                                    {/* Team Leader Filter - Tech Leads only */}
                                    {userProfile?.role === 'tech-lead' &&
                                        (filters.team === '' || filters.techLead === '') && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Filter by Team Leader</InputLabel>
                                                    <Select
                                                        value={filters.teamLeader}
                                                        onChange={(e) => handleFilterChange("teamLeader", e.target.value)} // Instant
                                                        label="Filter by Team Leader"
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

                                    {/* Track Lead Filter - Tech Leads and Team Leaders */}
                                    {(userProfile?.role === 'tech-lead' || userProfile?.role === 'team-leader') &&
                                        (filters.team === '' || filters.techLead === '' || filters.teamLeader === '') && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Filter by Track Lead</InputLabel>
                                                    <Select
                                                        value={filters.trackLead}
                                                        onChange={(e) => handleFilterChange("trackLead", e.target.value)} // Instant
                                                        label="Filter by Track Lead"
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

                                    {/* Employee Filter - Shows only selected employee data */}
                                    {(userProfile?.role === 'tech-lead' ||
                                        userProfile?.role === 'team-leader' ||
                                        userProfile?.role === 'track-lead') && (
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth variant="outlined">
                                                    <InputLabel shrink>Filter by Employee</InputLabel>
                                                    <Select
                                                        value={filters.employee}
                                                        onChange={(e) => handleFilterChange("employee", e.target.value)} // Instant employee filter
                                                        label="Filter by Employee"
                                                        displayEmpty
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        <MenuItem value="">
                                                            {showOwnOnly ? 'Only You' : 'All Employees'}
                                                        </MenuItem>
                                                        {/* Show only the selected employee or all available employees */}
                                                        {getFilteredEmployees().map((emp) => (
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
                                                                            {userProfile?.role === "tech-lead" && ` • ${emp.teamName}`}
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

                            {/* Task Status and Type Filters - Always available, instant */}
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel shrink>Status</InputLabel>
                                    <Select
                                        value={filters.status}
                                        onChange={(e) => handleFilterChange("status", e.target.value)} // Instant
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
                        </Grid>

                        {/* Help text - Always visible, no loading */}
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Typography variant="body2" color="textSecondary" fontWeight={500}>
                                <FilterList sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'middle' }} />
                                {showOwnOnly
                                    ? `Personal View: Filtering your own tasks by date range, status, and work type.`
                                    : userProfile?.role === 'tech-lead'
                                        ? `Team Management: Filter by hierarchy across your managed teams.`
                                        : userProfile?.role === 'team-leader'
                                            ? `Team Leadership: Filter by track leads and employees within your team.`
                                            : userProfile?.role === 'track-lead'
                                                ? `Track Management: Filter your direct reports.`
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