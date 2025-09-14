// components/TaskFilter.js - Enhanced UI
import React, { useState, useEffect } from 'react';
import {
    Box, Paper, TextField, MenuItem, Button, Typography, Grid,
    Chip, FormControl, InputLabel, Select, Collapse, IconButton,
    Card, CardContent, Divider, Badge
} from '@mui/material';
import {
    FilterList, Clear, CalendarToday, Person, Group, Business,
    ExpandMore, ExpandLess, FilterAlt
} from '@mui/icons-material';
import { getFilterOptions } from '../lib/firebase';

const TaskFilter = ({ userProfile, onFilterChange, currentFilters = {} }) => {
    const [filters, setFilters] = useState({
        dateFrom: currentFilters.dateFrom || '',
        dateTo: currentFilters.dateTo || '',
        teamLeader: currentFilters.teamLeader || '',
        employee: currentFilters.employee || '',
        team: currentFilters.team || '',
        ...currentFilters
    });

    const [filterOptions, setFilterOptions] = useState({
        teamLeaders: [],
        employees: [],
        teams: []
    });

    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Load filter options based on user role
    useEffect(() => {
        if (userProfile) {
            loadFilterOptions();
        }
    }, [userProfile]);

    const loadFilterOptions = async () => {
        setLoading(true);
        try {
            const options = await getFilterOptions(userProfile);
            setFilterOptions(options);
        } catch (error) {
            console.error('Error loading filter options:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        const newFilters = { ...filters, [field]: value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const clearAllFilters = () => {
        const clearedFilters = {
            dateFrom: '',
            dateTo: '',
            teamLeader: '',
            employee: '',
            team: ''
        };
        setFilters(clearedFilters);
        onFilterChange(clearedFilters);
    };

    const clearSpecificFilter = (field) => {
        handleFilterChange(field, '');
    };

    const getActiveFiltersCount = () => {
        return Object.values(filters).filter(value => value && value !== '').length;
    };

    const renderFilterChips = () => {
        const activeFilters = [];

        if (filters.dateFrom || filters.dateTo) {
            const dateRange = filters.dateFrom && filters.dateTo
                ? `${filters.dateFrom} to ${filters.dateTo}`
                : filters.dateFrom
                    ? `From ${filters.dateFrom}`
                    : `To ${filters.dateTo}`;
            activeFilters.push(
                <Chip
                    key="date"
                    label={dateRange}
                    onDelete={() => {
                        handleFilterChange('dateFrom', '');
                        handleFilterChange('dateTo', '');
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

        if (filters.teamLeader) {
            const tl = filterOptions.teamLeaders.find(tl => tl.empId === filters.teamLeader);
            activeFilters.push(
                <Chip
                    key="teamLeader"
                    label={`Leader: ${tl?.empName || filters.teamLeader}`}
                    onDelete={() => clearSpecificFilter('teamLeader')}
                    color="info"
                    variant="filled"
                    icon={<Group />}
                    sx={{
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

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
                        fontWeight: 500,
                        '& .MuiChip-deleteIcon': { fontSize: '1.1rem' }
                    }}
                />
            );
        }

        return activeFilters;
    };

    return (
        <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent sx={{ pb: '16px !important' }}>
                {/* Header with Toggle */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2,
                    }}
                >
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
                                onClick={() => setExpanded(!expanded)}
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
                                Filters
                            </Button>
                        </Badge>

                        {getActiveFiltersCount() > 0 && (
                            <Button
                                startIcon={<Clear />}
                                onClick={clearAllFilters}
                                variant="outlined"
                                color="error"
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

                    {/* Active Filters Count */}
                    {getActiveFiltersCount() > 0 && (
                        <Typography variant="body2" color="primary" fontWeight={600}>
                            {getActiveFiltersCount()} active filter
                            {getActiveFiltersCount() > 1 ? 's' : ''}
                        </Typography>
                    )}
                </Box>

                {/* Active Filters Display */}
                {getActiveFiltersCount() > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            gutterBottom
                            fontWeight={500}
                        >
                            Active Filters:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {renderFilterChips()}
                        </Box>
                        <Divider sx={{ mt: 2 }} />
                    </Box>
                )}

                {/* Collapsible Filter Content */}
                <Collapse in={expanded} timeout="auto">
                    <Box sx={{ pt: 2 }}>
                        <Grid container spacing={3}>
                            {/* Date Filters */}
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="From Date"
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                        startAdornment: (
                                            <CalendarToday sx={{ mr: 1, color: 'action.active' }} />
                                        ),
                                    }}
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
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
                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                    }}
                                />
                            </Grid>

                            {/* Team Filter - Tech Leads only */}
                            {userProfile?.role === 'tech-lead' && (
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Filter by Team</InputLabel>
                                        <Select
                                            value={filters.team}
                                            onChange={(e) => handleFilterChange("team", e.target.value)}
                                            label="Filter by Team"
                                            displayEmpty
                                            startAdornment={<Business sx={{ mr: 1, color: "action.active" }} />}
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

                            {/* Team Leader Filter - Tech Leads only */}
                            {userProfile?.role === 'tech-lead' && (
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth variant="outlined">
                                        <InputLabel>Filter by Team Leader</InputLabel>
                                        <Select
                                            value={filters.teamLeader}
                                            onChange={(e) => handleFilterChange("teamLeader", e.target.value)}
                                            label="Filter by Team Leader"
                                            displayEmpty
                                            startAdornment={<Group sx={{ mr: 1, color: "action.active" }} />}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            <MenuItem value="">All Team Leaders</MenuItem>
                                            {filterOptions.teamLeaders.map((tl) => (
                                                <MenuItem key={tl.empId} value={tl.empId}>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {tl.empName}
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {tl.empId} • {tl.teamName}
                                                        </Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            )}

                            {/* Employee Filter - Tech Leads + Team Leaders */}
                            {(userProfile?.role === 'tech-lead' ||
                                userProfile?.role === 'team-leader') && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth variant="outlined">
                                            <InputLabel>Filter by Employee</InputLabel>
                                            <Select
                                                value={filters.employee}
                                                onChange={(e) => handleFilterChange("employee", e.target.value)}
                                                label="Filter by Employee"
                                                displayEmpty
                                                startAdornment={<Person sx={{ mr: 1, color: "action.active" }} />}
                                                sx={{ borderRadius: 2 }}
                                            >
                                                <MenuItem value="">All Employees</MenuItem>
                                                {filterOptions.employees.map((emp) => (
                                                    <MenuItem key={emp.empId} value={emp.empId}>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={500}>
                                                                {emp.empName}
                                                            </Typography>
                                                            <Typography variant="caption" color="textSecondary">
                                                                {emp.empId}
                                                                {userProfile?.role === "tech-lead" && ` • ${emp.teamName}`}
                                                            </Typography>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
                        </Grid>

                        {/* Help text */}
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                fontWeight={500}
                            >
                                <FilterList
                                    sx={{
                                        fontSize: '1rem',
                                        mr: 0.5,
                                        verticalAlign: 'middle',
                                    }}
                                />
                                {userProfile?.role === 'tech-lead' &&
                                    'Filter by date range, teams, team leaders, and employees across your managed teams.'}
                                {userProfile?.role === 'team-leader' &&
                                    'Filter by date range and employees within your team.'}
                                {userProfile?.role === 'employee' &&
                                    'Filter your tasks by date range.'}
                            </Typography>
                        </Box>
                    </Box>
                </Collapse>
            </CardContent>

        </Card>
    );
};

export default TaskFilter;