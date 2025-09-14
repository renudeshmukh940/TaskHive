// pages/Home.js - Updated to match TaskForm's elaborate UI style
import { useState, useEffect } from 'react';
import {
  Container, Typography, Alert, CircularProgress, Box,
  TextField, MenuItem, Paper, Chip, AppBar, Toolbar, Button, Avatar
} from '@mui/material';
import { Dashboard, FilterList, Logout, Person } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import TaskForm from '../components/TaskForm';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import {
  getTasks,
  updateTask,
  deleteTask,
  getAccessibleTeams,
  applyTaskFilters
} from '../lib/firebase';

export default function Home() {
  const { userProfile, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [accessibleTeams, setAccessibleTeams] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});

  useEffect(() => {
    if (userProfile) {
      loadAccessibleTeams();
      loadTasks();
    }
  }, [userProfile, selectedTeam]);

  // Apply filters whenever tasks or filters change
  useEffect(() => {
    if (tasks.length > 0) {
      let filtered = selectedTeam === 'all' ? tasks : tasks.filter(task => task.teamName === selectedTeam);

      // Apply additional filters from TaskFilter component
      if (Object.keys(activeFilters).some(key => activeFilters[key])) {
        filtered = applyTaskFilters(filtered, activeFilters, userProfile);
      }

      setFilteredTasks(filtered);
    } else {
      setFilteredTasks([]);
    }
  }, [tasks, selectedTeam, activeFilters, userProfile]);

  const loadAccessibleTeams = async () => {
    try {
      const teams = getAccessibleTeams(userProfile);
      setAccessibleTeams(teams);
    } catch (error) {
      showAlert('Error loading teams', 'error');
    }
  };

  const loadTasks = async () => {
    try {
      if (!userProfile) return;

      const teamFilter = selectedTeam === 'all' ? null : selectedTeam;
      const tasksData = await getTasks(userProfile, teamFilter);
      setTasks(tasksData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      showAlert('Error loading tasks: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'success' }), 5000);
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
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

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'tech-lead': return 'Tech Lead';
      case 'team-leader': return 'Team Leader';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'tech-lead': return 'error';
      case 'team-leader': return 'warning';
      case 'employee': return 'primary';
      default: return 'default';
    }
  };

  const getActiveFilterCount = () => {
    let count = Object.keys(activeFilters).filter(key => activeFilters[key] && activeFilters[key] !== '').length;
    if (selectedTeam !== 'all') count++; // Add team filter to count
    return count;
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
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
        <Box sx={{
          padding: 4,
          borderRadius: 4,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <CircularProgress
            size={60}
            thickness={4}
            sx={{
              color: '#1976d2',
              filter: 'drop-shadow(0 0 8px rgba(25, 118, 210, 0.3))'
            }}
          />
          <Typography variant="h6" sx={{
            mt: 2,
            color: '#1976d2',
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            Loading your workspace...
          </Typography>
        </Box>
      </Box>
    );
  }

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
      {/* App Bar with Gradient and Enhanced Styling */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Avatar sx={{
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            width: 40,
            height: 40,
            mr: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <Dashboard sx={{ color: 'white' }} />
          </Avatar>
          <Typography variant="h5" component="div" sx={{
            flexGrow: 1,
            fontWeight: 700,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            background: 'linear-gradient(45deg, #ffffff 30%, rgba(255, 255, 255, 0.8) 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Daily Task Tracker
          </Typography>

          {/* Enhanced User Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                boxShadow: '0 4px 12px rgba(238, 90, 36, 0.3)',
                fontWeight: 600
              }}>
                {userProfile?.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="subtitle2" sx={{
                  color: 'white',
                  lineHeight: 1,
                  fontWeight: 600,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                }}>
                  {userProfile?.name}
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  lineHeight: 1,
                  fontWeight: 500
                }}>
                  {getRoleDisplayName(userProfile?.role)} • {userProfile?.empId}
                </Typography>
              </Box>
            </Box>

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
            <Button
              color="inherit"
              startIcon={<Logout />}
              onClick={handleLogout}
              sx={{
                ml: 1,
                fontWeight: 600,
                borderRadius: 2,
                px: 2,
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
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

        {/* Enhanced User Info Card */}
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
              background: 'linear-gradient(90deg, #1976d2 0%, #ff6b6b 50%, #00d2ff 100%)'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{
                bgcolor: '#1976d2',
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                boxShadow: '0 8px 16px rgba(25, 118, 210, 0.3)'
              }}>
                <Person sx={{ fontSize: 24 }} />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{
                  color: '#1976d2',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Welcome, {userProfile?.empName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {userProfile?.role === 'tech-lead'
                    ? `Managing ${userProfile?.managedTeams?.length} teams: ${userProfile?.managedTeams?.join(', ')}`
                    : `${getRoleDisplayName(userProfile?.role)} • ${userProfile?.teamName}`
                  }
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip
                label={`Employee ID: ${userProfile?.empId}`}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)'
                }}
              />
              {/* <Chip
                label={userProfile?.email}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)'
                }}
              /> */}
            </Box>
          </Box>
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

        {/* Task Filters - Enhanced styling */}
        <TaskFilter
          userProfile={userProfile}
          onFilterChange={handleFilterChange}
          currentFilters={activeFilters}
        />

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
                    ? "No tasks found across all your managed teams."
                    : `No tasks found for ${selectedTeam} team.`
                  : userProfile?.role === 'team-leader'
                    ? `No tasks found for your team (${userProfile.teamName}). Start by adding your first task above.`
                    : "You have no tasks recorded yet. Add one above!"
              }
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  );
}