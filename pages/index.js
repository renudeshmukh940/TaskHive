// pages/Home.js - Updated to match TaskForm's elaborate UI style
import { useState, useEffect } from 'react';
import Image from "next/image";
import {
  Container, Typography, Alert, CircularProgress, Box, Badge,
  TextField, MenuItem, Paper, Chip, AppBar, Toolbar, Button, Avatar
} from '@mui/material';

import { Dashboard, FilterList, Logout, Person, CalendarToday } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import TaskForm from '../components/TaskForm';
import TaskTable from '../components/TaskTable';

import {
  getTasks,
  getTasksForDateRange,
  updateTask,
  deleteTask,
  getAccessibleTeams,
  applyTaskFilters,
  getFilterOptions
} from '../lib/firebase';

import WeeklyReport from '../components/WeeklyReport';
import { format, startOfToday, addDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import AdminDashboard from '../components/AdminDashboard'

export default function Home() {
  const { userProfile, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [accessibleTeams, setAccessibleTeams] = useState([]);
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    dateFrom: format(startOfToday(), 'yyyy-MM-dd'),
    dateTo: format(startOfToday(), 'yyyy-MM-dd'),
    showOwnOnly: true,
  });
  const dateRangeOptions = [
    { value: 'today', label: 'Today', from: format(startOfToday(), 'yyyy-MM-dd'), to: format(startOfToday(), 'yyyy-MM-dd') },
    { value: 'yesterday', label: 'Yesterday', from: format(addDays(startOfToday(), -1), 'yyyy-MM-dd'), to: format(addDays(startOfToday(), -1), 'yyyy-MM-dd') },
    {
      value: 'thisWeek',
      label: `This Week`,
      from: format(startOfWeek(startOfToday()), 'yyyy-MM-dd'),
      to: format(endOfWeek(startOfToday()), 'yyyy-MM-dd')
    },
    {
      value: 'lastWeek',
      label: `Last Week`,
      from: format(startOfWeek(subWeeks(startOfToday(), 1)), 'yyyy-MM-dd'),
      to: format(endOfWeek(subWeeks(startOfToday(), 1)), 'yyyy-MM-dd')
    }
  ];
  const [filterOptions, setFilterOptions] = useState({
    techLeads: [],
    teamLeaders: [],
    trackLeads: [],
    employees: [],
    teams: []
  });

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


  // Replace the applyClientSideFilters function in Home.js with this corrected version:

  const applyClientSideFilters = () => {
    if (tasks.length === 0) {
      setFilteredTasks([]);
      return;
    }

    let filtered = [...tasks];

    // Apply role-based filtering
    if (activeFilters.showOwnOnly) {
      // Show only current user's own data
      filtered = filtered.filter(task => task.empId === userProfile.empId);
    } else {
      // Team data mode - apply hierarchy-specific filters

      // If specific person filter is selected, show only that person's data
      if (activeFilters.techLead) {
        filtered = filtered.filter(task => task.empId === activeFilters.techLead);
      } else if (activeFilters.teamLeader) {
        filtered = filtered.filter(task => task.empId === activeFilters.teamLeader);
      } else if (activeFilters.trackLead) {
        filtered = filtered.filter(task => task.empId === activeFilters.trackLead);
      } else if (activeFilters.employee) {
        filtered = filtered.filter(task => task.empId === activeFilters.employee);
      } else {
        // No specific filter - apply role-based default filtering
        switch (userProfile.role) {
          case 'tech-lead':
            // Tech-leads can see subordinates data (exclude other tech-leads)
            filtered = filtered.filter(task => {
              // Exclude other tech-leads data (from techLeads team, but not current user)
              if (task.teamName === 'techLeads' && task.empId !== userProfile.empId) {
                return false;
              }

              // Include own data and subordinates from managed teams
              if (task.empId === userProfile.empId) return true;

              // Include subordinates from managed teams
              return userProfile.managedTeams?.includes(task.teamName) && task.teamName !== 'techLeads';
            });
            break;

          case 'team-leader':
            // Team leaders see track-leads and employees in their team + own data
            filtered = filtered.filter(task => {
              if (task.empId === userProfile.empId) return true;
              if (task.teamName !== userProfile.teamName) return false;

              // Include track-leads and employees, exclude other team-leaders
              const isTrackLead = filterOptions.trackLeads.some(tl => tl.empId === task.empId);
              const isEmployee = filterOptions.employees.some(emp => emp.empId === task.empId);

              return isTrackLead || isEmployee;
            });
            break;

          case 'track-lead':
            // Track leads see their direct reports + own data
            filtered = filtered.filter(task => {
              if (task.empId === userProfile.empId) return true;
              if (task.teamName !== userProfile.teamName) return false;

              return filterOptions.employees.some(emp =>
                emp.empId === task.empId && emp.reportsTo === userProfile.empId
              );
            });
            break;

          case 'employee':
            // Employees see only own data
            filtered = filtered.filter(task => task.empId === userProfile.empId);
            break;

          default:
            filtered = [];
        }
      }
    }

    // Apply team filter for tech-leads
    if (!activeFilters.showOwnOnly && selectedTeam !== 'all' && userProfile.role === 'tech-lead') {
      filtered = filtered.filter(task => task.teamName === selectedTeam);
    }

    // Apply other filters (status, workType, etc.)
    if (activeFilters.status) {
      filtered = filtered.filter(task => task.status === activeFilters.status);
    }
    if (activeFilters.workType) {
      filtered = filtered.filter(task => task.workType === activeFilters.workType);
    }
    if (activeFilters.percentageCompletion) {
      const [min, max] = activeFilters.percentageCompletion.split('-').map(Number);
      filtered = filtered.filter(task => {
        const progress = parseInt(task.percentageCompletion) || 0;
        return progress >= min && progress <= max;
      });
    }
    if (activeFilters.client) {
      filtered = filtered.filter(task => task.client === activeFilters.client);
    }

    setFilteredTasks(filtered);
  };


  const loadAccessibleTeams = async () => {
    try {
      const teams = getAccessibleTeams(userProfile);
      setAccessibleTeams(teams);

      // Auto-select user's own team if available
      if (teams.length > 0 && !activeFilters.showOwnOnly) {
        setSelectedTeam(teams[0]);
      }
    } catch (error) {
      showAlert('Error loading teams', 'error');
    }
  };

  const loadTasks = async () => {
    await loadTasksForDateRange(activeFilters);
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'success' }), 5000);
  };

  const handleFilterChange = (filters) => {
    // Handle date range changes
    if (filters.dateRange && filters.dateRange !== activeFilters.dateRange) {
      const selectedRange = dateRangeOptions.find(range => range.value === filters.dateRange);
      if (selectedRange) {
        const updatedFilters = {
          ...activeFilters,
          ...filters,
          dateFrom: selectedRange.from,
          dateTo: selectedRange.to
        };
        setActiveFilters(updatedFilters);
        setTimeout(() => loadTasksForDateRange(updatedFilters), 0);
        return;
      }
    }
    const updatedFilters = { ...activeFilters, ...filters };
    setActiveFilters(updatedFilters);
  };

  const loadTasksForDateRange = async (filters) => {
    try {
      if (!userProfile) return;

      let allTasks = [];

      if (filters.showOwnOnly) {
        // Load only current user's data
        let teamToLoad, empIdFilter;

        if (userProfile.role === 'tech-lead') {
          teamToLoad = 'techLeads';
          empIdFilter = userProfile.empId;
        } else {
          teamToLoad = userProfile.teamName;
          empIdFilter = userProfile.empId;
        }

        let tasksData;
        if (filters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') &&
          filters.dateTo === format(startOfToday(), 'yyyy-MM-dd')) {
          tasksData = await getTasks(userProfile, teamToLoad);
          tasksData = tasksData.filter(task => task.empId === userProfile.empId);
        } else {
          tasksData = await getTasksForDateRange(
            userProfile,
            filters.dateFrom,
            filters.dateTo,
            teamToLoad,
            empIdFilter
          );
        }

        allTasks = tasksData;

      } else {
        // Team mode - load data for role-based filtering
        const teamsToLoad = new Set();

        switch (userProfile.role) {
          case 'tech-lead':
            teamsToLoad.add('techLeads'); // For own data
            if (selectedTeam !== 'all') {
              if (userProfile.managedTeams?.includes(selectedTeam)) {
                teamsToLoad.add(selectedTeam);
              }
            } else {
              userProfile.managedTeams?.forEach(team => teamsToLoad.add(team));
            }
            break;

          case 'team-leader':
          case 'track-lead':
          case 'employee':
            teamsToLoad.add(userProfile.teamName);
            break;
        }

        for (const teamName of teamsToLoad) {
          try {
            let teamTasks = [];
            if (filters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') &&
              filters.dateTo === format(startOfToday(), 'yyyy-MM-dd')) {
              teamTasks = await getTasks(userProfile, teamName);
            } else {
              teamTasks = await getTasksForDateRange(
                userProfile,
                filters.dateFrom,
                filters.dateTo,
                teamName,
                null
              );
            }
            allTasks = [...allTasks, ...teamTasks];
          } catch (error) {
            console.error(`Error loading data from team ${teamName}:`, error);
          }
        }
      }

      setTasks(allTasks.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      console.error('Error loading tasks for date range:', error);
      showAlert('Error loading tasks: ' + error.message, 'error');
    }
  };


  const handleAddTask = async () => {
    try {
      await loadTasks();
      await loadAccessibleTeams();
      showAlert('Task added successfully!');
    } catch (error) {
      showAlert('Error adding task: ' + error.message, 'error');
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      await updateTask(
        editingTask.teamName,
        editingTask.date,
        editingTask.empId,
        editingTask.id,
        taskData,
        userProfile
      );
      await loadTasks();
      setEditingTask(null);
      showAlert('Task updated successfully!');
    } catch (error) {
      showAlert('Error updating task: ' + error.message, 'error');
    }
  };

  const handleDeleteTask = async (teamName, date, empId, taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(teamName, date, empId, taskId, userProfile);
        await loadTasks();
        showAlert('Task deleted successfully!');
      } catch (error) {
        showAlert('Error deleting task: ' + error.message, 'error');
      }
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logout();
      } catch (error) {
        showAlert('Error logging out', 'error');
      }
    }
  };

  useEffect(() => {
    if (userProfile) {
      loadAccessibleTeams();
      loadFilterOptions();
      loadTasks();
    }
  }, [userProfile]);

  useEffect(() => {
    applyClientSideFilters();
  }, [tasks, activeFilters, userProfile, filterOptions]);

  if (userProfile?.role === 'admin') {
    console.log('Admin detected, redirecting to AdminDashboard');
    return <AdminDashboard userProfile={userProfile} />;
  }

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'tech-lead': return 'Tech Lead';
      case 'team-leader': return 'Team Leader';
      case 'track-lead': return 'Track Lead';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'tech-lead': return 'error';
      case 'team-leader': return 'warning';
      case 'track-lead': return 'info';
      case 'employee': return 'primary';
      default: return 'default';
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (activeFilters.dateFrom && activeFilters.dateFrom !== format(startOfToday(), 'yyyy-MM-dd')) count++;
    if (activeFilters.dateTo && activeFilters.dateTo !== format(startOfToday(), 'yyyy-MM-dd')) count++;
    if (!activeFilters.showOwnOnly) count++;
    if (selectedTeam !== 'all' && !activeFilters.showOwnOnly) count++;

    // Count hierarchy filters
    if (activeFilters.team) count++;
    if (activeFilters.techLead) count++;
    if (activeFilters.teamLeader) count++;
    if (activeFilters.trackLead) count++;
    if (activeFilters.employee) count++;
    if (activeFilters.status) count++;
    if (activeFilters.workType) count++;
    if (activeFilters.percentageCompletion) count++;
    return count;
  };
  return (
    <Box sx={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
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
      {/* Professional App Bar */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Toolbar sx={{ py: 1.5, px: { xs: 2, md: 3 } }}>
          {/* Left Section - Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Avatar sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              width: 40,
              height: 40,
              mr: 2,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <Dashboard sx={{ color: 'white' }} />
            </Avatar>
            <Typography
              variant="h4"
              component="div"
              sx={{
                fontWeight: 700,
                fontFamily: "'Times New Roman', serif",
                display: "flex",
                alignItems: "center",
                color: "#333", // dark gray for "MPOnline"
                letterSpacing: "0.5px",
                position: "relative",
              }}
            >
              <Box
                component="span"
                sx={{
                  color: "#000", // dark black for "MP"
                  mr: 0.5,
                }}
              >
                Task
              </Box>
              <Box
                component="span"
                sx={{
                  color: "#000",
                  position: "relative",
                }}
              >
                Hlve
                {/* Orange Circle */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "-30px",
                    left: "30%",
                    width: "25px",
                    height: "25px",
                    backgroundColor: "#f7931e", // orange
                    borderRadius: "50%",
                    zIndex: 1,
                  }}
                />
                {/* Red Arc */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "-45px",
                    left: "10%",
                    width: "120px",
                    height: "60px",
                    borderTop: "6px solid #e53935", // red arc
                    borderRadius: "50%/100%",
                    transform: "rotate(-5deg)",
                    zIndex: 0,
                  }}
                />
              </Box>
            </Typography>

            <Typography variant="h6" component="div" sx={{
              fontWeight: 700,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              background: 'linear-gradient(45deg, #ffffff 30%, rgba(255, 255, 255, 0.8) 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: { xs: 'block', sm: 'none' }
            }}>
              DTT
            </Typography>
          </Box>
          {/* Right Section - User Info and Actions */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            ml: 'auto',
            flexShrink: 0
          }}>
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                color="inherit"
                startIcon={<CalendarToday sx={{ fontSize: '18px' }} />}
                onClick={() => setWeeklyReportOpen(true)}
                sx={{
                  fontWeight: 600,
                  borderRadius: 2,
                  px: { xs: 1.5, sm: 2 },
                  minWidth: 'auto',
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  },
                  transition: 'all 0.2s ease',
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0, sm: '8px' }
                  }
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Weekly Report
                </Box>
              </Button>

              <Button
                color="inherit"
                startIcon={<Logout sx={{ fontSize: '18px' }} />}
                onClick={handleLogout}
                sx={{
                  fontWeight: 600,
                  borderRadius: 2,
                  px: { xs: 1.5, sm: 2 },
                  minWidth: 'auto',
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                  },
                  transition: 'all 0.2s ease',
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0, sm: '8px' }
                  }
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Logout
                </Box>
              </Button>
            </Box>

            {/* Divider */}
            {/* <Box sx={{
              width: '1px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.2)',
              mx: 1,
              display: { xs: 'none', sm: 'block' }
            }} /> */}

            {/* User Profile Section */}
            {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                  boxShadow: '0 4px 12px rgba(238, 90, 36, 0.3)',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  {userProfile?.name?.charAt(0)?.toUpperCase()}
                </Avatar>

                <Box sx={{
                  display: { xs: 'none', lg: 'block' },
                  textAlign: 'left',
                  minWidth: 0
                }}>
                  <Typography variant="subtitle2" sx={{
                    color: 'white',
                    lineHeight: 1.2,
                    fontWeight: 600,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '120px'
                  }}>
                    {userProfile?.name}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.2,
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {getRoleDisplayName(userProfile?.role)} • {userProfile?.empId}
                  </Typography>
                </Box>
              </Box>
            </Box> */}
          </Box>
        </Toolbar>

        {/* Mobile Status Bar - Shows on small screens */}
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          pb: 1.5,
          px: 2
        }}>
          <Chip
            label={`${filteredTasks.length} Tasks`}
            sx={{
              fontWeight: 600,
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(238, 90, 36, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            size="small"
          />
          {getActiveFilterCount() > 0 && (
            <Chip
              label={`${getActiveFilterCount()} Filters`}
              sx={{
                fontWeight: 600,
                background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(58, 123, 213, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              size="small"
            />
          )}
          <Chip
            label={getRoleDisplayName(userProfile?.role)}
            color={getRoleColor(userProfile?.role)}
            size="small"
            sx={{
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          />
        </Box>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
        {/* Enhanced Alert */}
        {alert.show && (
          <Alert
            severity={alert.severity}
            sx={{
              mb: 3,
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontWeight: 500
            }}
            onClose={() => setAlert({ ...alert, show: false })}
          >
            {alert.message}
          </Alert>
        )}

        {/* Compact User Info Card */}
        <Paper
          elevation={3}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            background: '#ffffff',
            border: '1px solid #e0e7ff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: '#1976d2',
              borderRadius: '12px 12px 0 0'
            }
          }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}>
            {/* Left Section - User Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
              <Avatar sx={{
                bgcolor: '#1976d2',
                width: 44,
                height: 44,
                fontSize: '1.1rem',
                fontWeight: 600
              }}>
                <Person sx={{ fontSize: 20 }} />
              </Avatar>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" sx={{
                  color: '#1a202c',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  lineHeight: 1.3,
                  mb: 0.5
                }}>
                  {userProfile?.name}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{
                    color: '#64748b',
                    fontWeight: 500,
                    fontSize: '0.875rem'
                  }}>
                    {userProfile?.role === 'tech-lead'
                      ? `Tech Lead • Managing ${userProfile?.managedTeams?.length} teams`
                      : `${getRoleDisplayName(userProfile?.role)}`
                    }
                  </Typography>

                  {userProfile?.teamName && userProfile?.role !== 'tech-lead' && (
                    <>
                      <Box sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: '#cbd5e1'
                      }} />
                      <Typography variant="body2" sx={{
                        color: '#64748b',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                      }}>
                        {userProfile?.teamName}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Right Section - Employee ID and Status */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexShrink: 0
            }}>
              {/* Employee ID */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.75,
                borderRadius: 2,
                backgroundColor: '#FFB74D',
                border: '1px solid #e2e8f0'
              }}>
                <Badge sx={{ fontSize: 16, color: '#64768b' }} />
                <Typography variant="body2" sx={{
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  letterSpacing: '0.5px'
                }}>
                  {userProfile?.empId}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Team Management Section for Tech Leads */}
          {userProfile?.role === 'tech-lead' && userProfile?.managedTeams?.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f1f5f9' }}>
              <Typography variant="caption" sx={{
                color: '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.7rem',
                mb: 1,
                display: 'block'
              }}>
                Managing Teams
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {userProfile?.managedTeams?.map((team, index) => (
                  <Chip
                    key={index}
                    label={team}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.75rem',
                      height: 24,
                      borderColor: '#d1d5db',
                      color: '#374151',
                      backgroundColor: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#f9fafb'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Task Form */}
        <TaskForm
          onSubmit={editingTask ? handleUpdateTask : handleAddTask}
          editTask={editingTask}
          onCancel={handleCancelEdit}
          userProfile={userProfile}
        />

        {/* Enhanced Team Filter for Tech Leads */}
        {userProfile?.role === 'tech-lead' && accessibleTeams.length > 1 && (
          <Paper
            elevation={20}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, #ff6b6b 0%, #00d2ff 50%, #1976d2 100%)'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{
                  bgcolor: '#ff6b6b',
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                  boxShadow: '0 8px 16px rgba(255, 107, 107, 0.3)'
                }}>
                  <FilterList sx={{ fontSize: 20 }} />
                </Avatar>
                <Typography variant="h6" sx={{
                  color: '#ff6b6b',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Team Selection
                </Typography>
              </Box>
              <TextField
                select
                label="Team"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                sx={{
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    '&:hover fieldset': {
                      borderColor: '#ff6b6b',
                      boxShadow: '0 0 0 2px rgba(255, 107, 107, 0.1)'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#ff6b6b',
                      boxShadow: '0 0 0 3px rgba(255, 107, 107, 0.15)'
                    }
                  }
                }}
                size="small"
              >
                <MenuItem value="all">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label="All"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                    All Teams ({tasks.length})
                  </Box>
                </MenuItem>
                {accessibleTeams.map((team) => {
                  const teamTaskCount = tasks.filter(task => task.teamName === team).length;
                  return (
                    <MenuItem key={team} value={team}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={teamTaskCount}
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                            color: 'white',
                            fontWeight: 600
                          }}
                        />
                        {team}
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>

              {/* Enhanced Team Statistics */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', ml: 'auto' }}>
                <Chip
                  label={`Accessible Teams: ${accessibleTeams.length}`}
                  sx={{
                    background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                    color: 'white',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(58, 123, 213, 0.3)'
                  }}
                  size="small"
                />
                <Chip
                  label={`Active Tasks: ${filteredTasks.filter(t => t.status === 'In Progress').length}`}
                  sx={{
                    background: 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
                    color: 'white',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(255, 167, 38, 0.3)'
                  }}
                  size="small"
                />
                <Chip
                  label={`Completed: ${filteredTasks.filter(t => t.status === 'Completed').length}`}
                  sx={{
                    background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
                    color: 'white',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(102, 187, 106, 0.3)'
                  }}
                  size="small"
                />
              </Box>
            </Box>
          </Paper>
        )}

        <Paper
          elevation={0}
          sx={{
            mb: 3,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          {/* Filter Header Bar */}
          <Box sx={{
            backgroundColor: '#f8fafc',
            px: 3,
            py: 1.5,
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#475569', fontWeight: 600 }}>
                Filters
              </Typography>

              {/* Quick Date Range Pills */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {dateRangeOptions.map((range) => (
                  <Chip
                    key={range.value}
                    label={range.label}
                    size="small"
                    clickable
                    onClick={() => handleFilterChange({ dateRange: range.value })}
                    sx={{
                      height: 24,
                      fontSize: '0.75rem',
                      backgroundColor: activeFilters.dateRange === range.value ? '#1e40af' : 'transparent',
                      color: activeFilters.dateRange === range.value ? 'white' : '#64748b',
                      border: activeFilters.dateRange === range.value ? 'none' : '1px solid #d1d5db',
                      '&:hover': {
                        backgroundColor: activeFilters.dateRange === range.value ? '#1d4ed8' : '#f1f5f9'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Filter Toggle & Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Active Filter Count */}
              {getActiveFilterCount() > 0 && (
                <Chip
                  label={`${getActiveFilterCount()} active`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    backgroundColor: '#fef3c7',
                    color: '#f59e0b',
                    border: 'none'
                  }}
                />
              )}

              {/* Own/Team Toggle */}
              <Box sx={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 1, overflow: 'hidden' }}>
                <Button
                  size="small"
                  onClick={() => {
                    if (!activeFilters.showOwnOnly) {
                      const newShowOwnOnly = true;
                      setActiveFilters(prev => ({
                        ...prev,
                        showOwnOnly: newShowOwnOnly,
                        team: '',
                        techLead: '',
                        teamLeader: '',
                        trackLead: '',
                        employee: ''
                      }));
                      loadTasks();
                    }
                  }}
                  sx={{
                    minWidth: 60,
                    py: 0.5,
                    px: 1.5,
                    fontSize: '0.75rem',
                    backgroundColor: activeFilters.showOwnOnly ? '#1e40af' : 'transparent',
                    color: activeFilters.showOwnOnly ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: 0,
                    '&:hover': {
                      backgroundColor: activeFilters.showOwnOnly ? '#1d4ed8' : '#f1f5f9',
                      border: 'none'
                    }
                  }}
                >
                  My Tasks
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    if (activeFilters.showOwnOnly) {
                      const newShowOwnOnly = false;
                      setActiveFilters(prev => ({
                        ...prev,
                        showOwnOnly: newShowOwnOnly,
                        team: '',
                        techLead: '',
                        teamLeader: '',
                        trackLead: '',
                        employee: ''
                      }));
                      loadTasks();
                    }
                  }}
                  sx={{
                    minWidth: 60,
                    py: 0.5,
                    px: 1.5,
                    fontSize: '0.75rem',
                    backgroundColor: !activeFilters.showOwnOnly ? '#1e40af' : 'transparent',
                    color: !activeFilters.showOwnOnly ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: 0,
                    borderLeft: '1px solid #d1d5db',
                    '&:hover': {
                      backgroundColor: !activeFilters.showOwnOnly ? '#1d4ed8' : '#f1f5f9',
                      border: 'none',
                      borderLeft: '1px solid #d1d5db'
                    }
                  }}
                >
                  Team
                </Button>
              </Box>

              {/* Advanced Filters Dropdown */}
              <TextField
                select
                size="small"
                value="Filters"
                displayEmpty
                sx={{
                  minWidth: 140,
                  '& .MuiOutlinedInput-root': {
                    height: 32,
                    backgroundColor: 'white',
                    '& fieldset': { borderColor: '#d1d5db' },
                    '&:hover fieldset': { borderColor: '#3b82f6' }
                  },
                  '& .MuiSelect-select': {
                    fontSize: '0.75rem',
                    color: '#374151'
                  }
                }}
              >
                <MenuItem value="Filters">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
                    <FilterList sx={{ fontSize: 16 }} />
                    Advanced Filters
                  </Box>
                </MenuItem>

                {/* Status Filter */}
                <MenuItem>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                      Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {['In Progress', 'Completed', 'On Hold', 'Cancelled'].map((status) => (
                        <Chip
                          key={status}
                          label={status}
                          size="small"
                          clickable
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterChange({ status: activeFilters.status === status ? '' : status });
                          }}
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            backgroundColor: activeFilters.status === status ? '#1e40af' : '#f1f5f9',
                            color: activeFilters.status === status ? 'white' : '#64748b',
                            border: 'none',
                            '&:hover': {
                              backgroundColor: activeFilters.status === status ? '#1d4ed8' : '#e2e8f0'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </MenuItem>

                {/* Work Type Filter */}
                <MenuItem>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                      Work Type
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {['Full-day', 'Half-day', 'Over Time', 'Relaxation'].map((type) => (
                        <Chip
                          key={type}
                          label={type}
                          size="small"
                          clickable
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterChange({ workType: activeFilters.workType === type ? '' : type });
                          }}
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            backgroundColor: activeFilters.workType === type ? '#1e40af' : '#f1f5f9',
                            color: activeFilters.workType === type ? 'white' : '#64748b',
                            border: 'none',
                            '&:hover': {
                              backgroundColor: activeFilters.workType === type ? '#1d4ed8' : '#e2e8f0'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </MenuItem>

                {/* Team Hierarchy Filters (when not showing own only) */}
                {!activeFilters.showOwnOnly && (
                  <>
                    {userProfile?.role === 'tech-lead' && filterOptions.teamLeaders?.length > 0 && (
                      <MenuItem>
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                            Team Leaders
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {filterOptions.teamLeaders.map((leader) => (
                              <Chip
                                key={leader.empId}
                                label={leader.empName || leader.name} // Fixed: use empName consistently
                                size="small"
                                clickable
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterChange({
                                    teamLeader: activeFilters.teamLeader === leader.empId ? '' : leader.empId
                                  });
                                }}
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  backgroundColor: activeFilters.teamLeader === leader.empId ? '#1e40af' : '#f1f5f9',
                                  color: activeFilters.teamLeader === leader.empId ? 'white' : '#64748b', // Fixed: consistent color
                                  border: 'none',
                                  '&:hover': {
                                    backgroundColor: activeFilters.teamLeader === leader.empId ? '#1d4ed8' : '#e2e8f0'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </MenuItem>
                    )}

                    {/* Fixed: Show Track Leads for both tech-lead and team-leader */}
                    {(userProfile?.role === 'tech-lead' || userProfile?.role === 'team-leader') && filterOptions.trackLeads?.length > 0 && (
                      <MenuItem>
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                            Track Leads
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {filterOptions.trackLeads.map((lead) => (
                              <Chip
                                key={lead.empId}
                                label={lead.empName || lead.name} // Fixed: use empName consistently
                                size="small"
                                clickable
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterChange({
                                    trackLead: activeFilters.trackLead === lead.empId ? '' : lead.empId
                                  });
                                }}
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  backgroundColor: activeFilters.trackLead === lead.empId ? '#1e40af' : '#f1f5f9',
                                  color: activeFilters.trackLead === lead.empId ? 'white' : '#64748b', // Fixed: was 'blue'
                                  border: 'none',
                                  '&:hover': {
                                    backgroundColor: activeFilters.trackLead === lead.empId ? '#1d4ed8' : '#e2e8f0'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </MenuItem>
                    )}

                    {/* Fixed: Show Employees for all roles except when showing own only */}
                    {(!activeFilters.showOwnOnly) && filterOptions.employees?.length > 0 && (
                      <MenuItem>
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                            Employees
                          </Typography>
                          <Box sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            maxHeight: 120,
                            overflow: 'auto'
                          }}>
                            {filterOptions.employees.map((emp) => (
                              <Chip
                                key={emp.empId}
                                label={emp.empName || emp.name} // Fixed: use empName consistently
                                size="small"
                                clickable
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterChange({
                                    employee: activeFilters.employee === emp.empId ? '' : emp.empId
                                  });
                                }}
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  backgroundColor: activeFilters.employee === emp.empId ? '#1e40af' : '#f1f5f9',
                                  color: activeFilters.employee === emp.empId ? 'white' : '#64748b',
                                  border: 'none',
                                  '&:hover': {
                                    backgroundColor: activeFilters.employee === emp.empId ? '#1d4ed8' : '#e2e8f0'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </MenuItem>
                    )}
                  </>
                )}

                {/* Custom Date Range */}
                <MenuItem>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 1, display: 'block' }}>
                      Custom Date Range
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        type="date"
                        size="small"
                        value={activeFilters.dateFrom}
                        onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            height: 28,
                            fontSize: '0.75rem'
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Typography variant="caption" sx={{ color: '#64748b' }}>to</Typography>
                      <TextField
                        type="date"
                        size="small"
                        value={activeFilters.dateTo}
                        onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            height: 28,
                            fontSize: '0.75rem'
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                  </Box>
                </MenuItem>
              </TextField>

              {/* Clear Filters */}
              {getActiveFilterCount() > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    setActiveFilters({
                      dateFrom: format(startOfToday(), 'yyyy-MM-dd'),
                      dateTo: format(startOfToday(), 'yyyy-MM-dd'),
                      showOwnOnly: true,
                    });
                    loadTasks();
                  }}
                  sx={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    border: '1px solid #d1d5db',
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    height: 32,
                    '&:hover': {
                      backgroundColor: '#f1f5f9',
                      borderColor: '#9ca3af'
                    }
                  }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Box>

          {/* Active Filters Display (only show if filters are active) */}
          {getActiveFilterCount() > 0 && (
            <Box sx={{ px: 3, py: 1.5, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Active:
                </Typography>

                {/* Date Range Chips */}
                {(activeFilters.dateFrom !== format(startOfToday(), 'yyyy-MM-dd') ||
                  activeFilters.dateTo !== format(startOfToday(), 'yyyy-MM-dd')) && (
                    <Chip
                      label={`${activeFilters.dateFrom} to ${activeFilters.dateTo}`}
                      size="small"
                      onDelete={() => handleFilterChange({
                        dateFrom: format(startOfToday(), 'yyyy-MM-dd'),
                        dateTo: format(startOfToday(), 'yyyy-MM-dd')
                      })}
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af'
                      }}
                    />
                  )}

                {!activeFilters.showOwnOnly && (
                  <Chip
                    label="Team View"
                    size="small"
                    onDelete={() => {
                      const newShowOwnOnly = true;
                      setActiveFilters(prev => ({
                        ...prev,
                        showOwnOnly: newShowOwnOnly,
                        team: '',
                        techLead: '',
                        teamLeader: '',
                        trackLead: '',
                        employee: ''
                      }));
                      loadTasks();
                    }}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      backgroundColor: '#fef3c7',
                      color: '#f59e0b'
                    }}
                  />
                )}

                {activeFilters.status && (
                  <Chip
                    label={`Status: ${activeFilters.status}`}
                    size="small"
                    onDelete={() => handleFilterChange({ status: '' })}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      backgroundColor: '#dcfce7',
                      color: '#059669'
                    }}
                  />
                )}

                {activeFilters.workType && (
                  <Chip
                    label={`Type: ${activeFilters.workType}`}
                    size="small"
                    onDelete={() => handleFilterChange({ workType: '' })}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      backgroundColor: '#fce7f3',
                      color: '#be185d'
                    }}
                  />
                )}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Tasks Table */}
        <TaskTable
          tasks={filteredTasks}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          userProfile={userProfile}
        />
        {/* Enhanced Empty State */}
        {filteredTasks.length === 0 && (
          <Paper
            elevation={20}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, #1976d2 0%, #ff6b6b 50%, #00d2ff 100%)'
              }
            }}
          >
            <Typography variant="h6" sx={{
              color: '#1976d2',
              fontWeight: 600,
              mb: 2,
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              No tasks found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {getActiveFilterCount() > 0
                ? "No tasks match your current filters. Try adjusting your filter criteria."
                : userProfile?.role === 'tech-lead'
                  ? selectedTeam === 'all'
                    ? `No tasks found across all your managed teams for ${activeFilters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') ? 'today' : `${activeFilters.dateFrom} to ${activeFilters.dateTo}`}.`
                    : `No tasks found for ${selectedTeam} team for ${activeFilters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') ? 'today' : `${activeFilters.dateFrom} to ${activeFilters.dateTo}`}.`
                  : userProfile?.role === 'team-leader'
                    ? `No tasks found for your team (${userProfile.teamName}) for ${activeFilters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') ? 'today' : `${activeFilters.dateFrom} to ${activeFilters.dateTo}`}. Start by adding your first task above.`
                    : `You have no tasks recorded for ${activeFilters.dateFrom === format(startOfToday(), 'yyyy-MM-dd') ? 'today' : `${activeFilters.dateFrom} to ${activeFilters.dateTo}`}. Add one above!`
              }
            </Typography>
          </Paper>
        )}

        {/* Weekly Report Dialog */}
        <WeeklyReport
          open={weeklyReportOpen}
          onClose={() => setWeeklyReportOpen(false)}
          userProfile={userProfile}
        />
      </Container>
    </Box>
  );
}
