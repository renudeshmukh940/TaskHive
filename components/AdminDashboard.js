import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Users, Briefcase, Activity, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3, Download, Filter, Search, Bell, Settings, User, Menu, Home, Target, FileText, Building2, Zap, Timer, Award, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { getAdminDashboardStats, getTeamInsights, getDateRange } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = ({ userProfile }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [teamInsights, setTeamInsights] = useState(null);
    const [dateRange, setDateRange] = useState('7days');
    const [activeView, setActiveView] = useState('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { logout } = useAuth();

    const dateRanges = [
        { value: 'today', label: 'Today', icon: Calendar },
        { value: '7days', label: 'Last 7 Days', icon: CalendarDays },
        { value: '30days', label: 'Last 30 Days', icon: CalendarDays },
        { value: '90days', label: 'Last 90 Days', icon: CalendarDays }
    ];

    // Get current date range dates
    const currentDateRange = getDateRange(dateRange);
    const currentDateLabel = dateRange === 'today'
        ? 'Today'
        : `${format(new Date(currentDateRange.start), 'MMM dd')} - ${format(new Date(currentDateRange.end), 'MMM dd')}`;

    useEffect(() => {
        loadDashboardData();
    }, [dateRange]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            setError('');
            const dashboardStats = await getAdminDashboardStats(
                currentDateRange.start,
                currentDateRange.end
            );
            setStats(dashboardStats);
        } catch (err) {
            setError('Error loading dashboard data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadTeamInsights = async (teamName) => {
        if (teamName === 'all') {
            setTeamInsights(null);
            return;
        }

        try {
            setLoading(true);
            const insights = await getTeamInsights(
                teamName,
                currentDateRange.start,
                currentDateRange.end
            );
            setTeamInsights(insights);
        } catch (err) {
            setError('Error loading team insights: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedTeam !== 'all') {
            loadTeamInsights(selectedTeam);
        } else {
            setTeamInsights(null);
        }
    }, [selectedTeam, dateRange]);

    const exportToExcel = async () => {
        if (!stats) return;

        try {
            const XLSX = await import('xlsx');
            const { format } = await import('date-fns');

            const exportData = {
                'Dashboard Summary': [
                    ['Date Range', `${currentDateRange.start} to ${currentDateRange.end}`],
                    ['Total Teams', stats.totalTeams],
                    ['Total Employees', stats.totalEmployees],
                    ['Total Tasks', stats.totalTasks],
                    ['Total Projects', stats.totalProjects]
                ],
                'Task Status': [
                    ['Status', 'Count'],
                    ['Completed', stats.projectStatus.completed],
                    ['In Progress', stats.projectStatus.inProgress],
                    ['On Hold', stats.projectStatus.onHold]
                ],
                'Team Breakdown': [
                    ['Team', 'Employees', 'Tasks', 'Completed', 'In Progress', 'On Hold', 'Total Hours']
                    , ...stats.teamBreakdown.map(team => [
                        team.name,
                        team.employeeCount,
                        team.tasksTotal,
                        team.projects.completed,
                        team.projects.inProgress,
                        team.projects.onHold,
                        team.projects.totalTime.toFixed(1)
                    ])
                ]
            };

            const workbook = XLSX.utils.book_new();
            Object.entries(exportData).forEach(([sheetName, data]) => {
                const worksheet = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });

            XLSX.writeFile(workbook, `Admin_Dashboard_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const sidebarItems = [
        { id: 'overview', icon: Home, label: 'Dashboard', active: true },
        { id: 'projects', icon: Briefcase, label: 'Projects' },
        { id: 'tracking', icon: Clock, label: 'Tracking' },
        { id: 'customers', icon: Users, label: 'Customers' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        { id: 'tasks', icon: Target, label: 'Tasks' }
    ];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    // Updated insights calculation
    const calculateInsights = () => {
        if (!stats) return {};

        const totalTasksByStatus = stats.projectStatus.completed + stats.projectStatus.inProgress + stats.projectStatus.onHold || 1;
        const completionRate = Math.round((stats.projectStatus.completed / totalTasksByStatus) * 100);
        const progressRate = Math.round((stats.projectStatus.inProgress / totalTasksByStatus) * 100);
        const avgTasksPerEmployee = stats.totalEmployees > 0
            ? Math.round(stats.totalTasks / stats.totalEmployees)
            : 0;
        const totalHoursPeriod = stats.recentActivity.reduce((sum, activity) => sum + parseFloat(activity.hours || 0), 0);
        const avgHoursPerDay = stats.dateRange?.days > 0
            ? (totalHoursPeriod / stats.dateRange.days).toFixed(1)
            : totalHoursPeriod.toFixed(1);

        return {
            completionRate,
            progressRate,
            avgTasksPerEmployee,
            totalHoursPeriod: totalHoursPeriod.toFixed(1),
            avgHoursPerDay,
            dateRangeLabel: currentDateLabel
        };
    };

    const insights = calculateInsights();

    const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle }) => (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl hover:bg-white/95 transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r from-${color}-500 to-${color}-600 flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {change && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${changeType === 'positive'
                        ? 'bg-green-50 text-green-600'
                        : changeType === 'negative'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-50 text-gray-600'
                        }`}>
                        {change}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
                <p className="text-gray-500 text-sm">{title}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            </div>
        </div>
    );

    const TeamCard = ({ team }) => (
        <div
            className="bg-white/90 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:shadow-xl hover:bg-white/95 transition-all cursor-pointer group transform hover:scale-105 duration-300"
            onClick={() => setSelectedTeam(team.name)}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {team.name}
                        </h3>
                        <p className="text-sm text-gray-500">{team.employeeCount} members</p>
                    </div>
                </div>
                <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    {currentDateLabel}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Tasks</p>
                    <p className="text-lg font-bold text-blue-600">{team.tasksTotal}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Hours</p>
                    <p className="text-lg font-bold text-green-600">{team.projects.totalTime.toFixed(1)}h</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Projects</p>
                    <p className="text-lg font-bold text-purple-600">{team.projectCount || 0}</p>
                </div>
            </div>

            <div className="flex space-x-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
                        style={{
                            width: `${(team.projects.completed /
                                (team.projects.completed + team.projects.inProgress + team.projects.onHold || 1)) * 100
                                }%`
                        }}
                    />
                </div>
            </div>

            <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Completed: {team.projects.completed}</span>
                <span>In Progress: {team.projects.inProgress}</span>
                <span>On Hold: {team.projects.onHold}</span>
            </div>
        </div>
    );

    const ActivityChart = () => {
        if (!stats?.recentActivity?.length) return null;

        const chartData = stats.recentActivity.map(activity => ({
            team: activity.team,
            tasks: activity.tasks,
            hours: activity.hours
        })).sort((a, b) => b.tasks - a.tasks).slice(0, 8);

        return (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    Team Activity ({currentDateLabel})
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="team" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={70} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip
                            formatter={(value, name, props) => [
                                props.dataKey === 'tasks' ? `${value} tasks` : `${value} hours`,
                                props.dataKey === 'tasks' ? 'Tasks' : 'Hours'
                            ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="tasks" fill="#3B82F6" name="Tasks" radius={4} />
                        <Bar yAxisId="right" dataKey="hours" fill="#10B981" name="Hours" radius={4} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const ProjectTimeChart = () => {
        if (!stats?.timeByProject || Object.keys(stats.timeByProject).length === 0) return null;

        const chartData = Object.entries(stats.timeByProject)
            .map(([project, hours]) => ({
                project: project.split('-')[0].substring(0, 15) + (project.split('-')[0].length > 15 ? '...' : ''),
                hours: parseFloat(hours),
                fullName: project.split('-')[0]
            }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 8);

        return (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Timer className="w-5 h-5 mr-2 text-purple-600" />
                    Project Time Distribution ({currentDateLabel})
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ project, percent }) => `${project}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="hours"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, name, props) => [
                                `${value.toFixed(1)} hours`,
                                props.payload.fullName
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const TopPerformersTable = ({ performers }) => (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-yellow-600" />
                Top Performers ({currentDateLabel})
            </h3>
            <div className="space-y-3">
                {performers?.slice(0, 5).map((performer, index) => (
                    <div key={performer.empId} className="flex items-center justify-between p-3 bg-gray-50/90 rounded-lg backdrop-blur-sm">
                        <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                                index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                                    index === 2 ? 'bg-gradient-to-r from-orange-300 to-orange-400' : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                }`}>
                                {index + 1}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{performer.empName}</p>
                                <p className="text-sm text-gray-500">{performer.empId}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold text-gray-900">{performer.tasks} tasks</p>
                            <p className="text-sm text-green-600">{performer.hours.toFixed(1)}h</p>
                        </div>
                    </div>
                )) || (
                        <p className="text-center text-gray-500 py-8">No performance data available</p>
                    )}
            </div>
        </div>
    );

    // Enhanced Loading Screen Component - Transparent overlay with dashboard visible
    const LoadingScreen = () => (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/30 max-w-md w-full mx-4 transform scale-100 animate-pulse">
                {/* Animated Logo */}
                <div className="w-20 h-20 mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 rounded-2xl animate-spin-slow"></div>
                    <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
                        <Zap className="w-8 h-8 text-blue-600 animate-bounce" />
                    </div>
                </div>

                {/* Animated Data Particles */}
                <div className="flex justify-center space-x-1 mb-6">
                    {[...Array(7)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1.5 h-8 bg-gradient-to-b from-blue-400 via-purple-400 to-indigo-500 rounded-full animate-bounce"
                            style={{
                                animationDelay: `${i * 0.1}s`,
                                animationDuration: '1.2s'
                            }}
                        />
                    ))}
                </div>

                {/* Loading Text */}
                <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center justify-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-green-500 animate-pulse" />
                        <span>Loading Admin Dashboard</span>
                    </h3>
                    <p className="text-gray-600 mb-1">Analyzing {stats?.totalTeams || 'teams'} teams & {stats?.totalEmployees || 'employees'} members</p>
                    <p className="text-sm text-blue-600 mb-6">Processing data for {currentDateLabel}</p>

                    {/* Animated Progress Bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 rounded-full animate-pulse w-3/4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                        </div>
                    </div>
                </div>

                {/* Floating Analytics Icons */}
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-green-400/20 rounded-full flex items-center justify-center animate-float">
                    <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="absolute -bottom-4 -left-4 w-10 h-10 bg-purple-400/20 rounded-full flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
                    <Briefcase className="w-5 h-5 text-purple-600" />
                </div>
                <div className="absolute top-1/2 -left-6 w-8 h-8 bg-blue-400/20 rounded-full flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                    <Activity className="w-4 h-4 text-blue-600" />
                </div>
            </div>
        </div>
    );

    // Add CSS for custom animations
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin-slow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            .animate-spin-slow { animation: spin-slow 2s linear infinite; }
            .animate-shimmer { animation: shimmer 1.5s infinite; }
            .animate-float { animation: float 3s ease-in-out infinite; }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={loadDashboardData}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105"
                    >
                        <TrendingUp className="w-4 h-4 inline mr-2" />
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex">
            {/* Sidebar */}
            <div className={`bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-300 fixed h-full z-40 border-r border-white/20 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
                <div className="p-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        {!sidebarCollapsed && (
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">TaskHive</h1>
                                <p className="text-sm text-gray-500">Admin Portal</p>
                            </div>
                        )}
                    </div
                </div>

                <nav className="mt-6">
                    {sidebarItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`w-full flex items-center px-6 py-3 text-left hover:bg-blue-50/80 transition-all duration-200 ${activeView === item.id
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600 border-r-2 border-blue-600'
                                : 'text-gray-600 hover:text-blue-600'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className={`transition-all duration-300 flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-white/20 sticky top-0 z-30">
                    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">Admin Dashboard</h1>
                                <p className="text-gray-500 flex items-center space-x-2">
                                    <CalendarDays className="w-4 h-4" />
                                    <span>{currentDate}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Enhanced Date Range Selector */}
                            <div className="relative">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    className="px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90 backdrop-blur-sm appearance-none hover:bg-white transition-all"
                                >
                                    {dateRanges.map(range => (
                                        <option key={range.value} value={range.value}>
                                            {range.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </div>
                            </div>

                            <button
                                onClick={exportToExcel}
                                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 shadow-lg"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export ({dateRange})
                            </button>

                            {/* User Profile with Logout */}
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                    <span className="text-white text-sm font-medium">
                                        {userProfile?.empName?.charAt(0).toUpperCase() || 'A'}
                                    </span>
                                </div>
                                <span className="text-gray-700 font-medium hidden md:block">{userProfile?.empName || 'Admin'}</span>
                                <button
                                    onClick={logout}
                                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all transform hover:scale-105 text-sm font-medium ml-2"
                                    title="Logout"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <main className="p-4 sm:p-6 lg:p-8 w-full">
                    {/* Date Range Info Banner */}
                    <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 backdrop-blur-sm border border-blue-100 rounded-xl p-4 mb-6 shadow-lg w-full">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <CalendarDays className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Data Period</h3>
                                    <p className="text-sm text-gray-600">{currentDateLabel}</p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500">
                                {stats?.dateRange?.days || 1} {stats?.dateRange?.days === 1 ? 'day' : 'days'} of data
                            </div>
                        </div>
                    </div>

                    {/* Key Metrics - Full width responsive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
                        <StatCard
                            title={`Total Tasks (${currentDateLabel})`}
                            value={stats?.totalTasks || 0}
                            change={stats?.dateRange?.days > 1 ? `+${Math.round((stats.totalTasks / stats.dateRange.days) * 100) / 100} avg/day` : null}
                            changeType="positive"
                            icon={Target}
                            color="blue"
                            subtitle="Across all teams"
                        />
                        <StatCard
                            title="Team Members"
                            value={stats?.totalEmployees || 0}
                            change="+2.3%"
                            changeType="positive"
                            icon={Users}
                            color="green"
                            subtitle="Active employees"
                        />
                        <StatCard
                            title="Total Projects"
                            value={stats?.totalProjects || 0}
                            change="-1.8%"
                            changeType="negative"
                            icon={Briefcase}
                            color="purple"
                            subtitle="Available projects"
                        />
                        <StatCard
                            title="Teams"
                            value={stats?.totalTeams || 0}
                            change="+0.5%"
                            changeType="positive"
                            icon={Building2}
                            color="orange"
                            subtitle="Department teams"
                        />
                    </div>

                    {/* Task Status Overview - Full width responsive */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 w-full">
                        <div className="lg:col-span-2">
                            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    Task Status Overview ({currentDateLabel})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-green-50/90 rounded-xl backdrop-blur-sm">
                                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-green-600">{stats?.projectStatus.completed || 0}</h3>
                                        <p className="text-sm text-green-600">Completed Tasks</p>
                                        <p className="text-xs text-gray-500 mt-1">{insights.completionRate}% of total</p>
                                    </div>
                                    <div className="text-center p-4 bg-blue-50/90 rounded-xl backdrop-blur-sm">
                                        <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-blue-600">{stats?.projectStatus.inProgress || 0}</h3>
                                        <p className="text-sm text-blue-600">In Progress Tasks</p>
                                        <p className="text-xs text-gray-500 mt-1">{insights.progressRate}% of total</p>
                                    </div>
                                    <div className="text-center p-4 bg-orange-50/90 rounded-xl backdrop-blur-sm">
                                        <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-orange-600">{stats?.projectStatus.onHold || 0}</h3>
                                        <p className="text-sm text-orange-600">On Hold Tasks</p>
                                        <p className="text-xs text-gray-500 mt-1">Need attention</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 lg:space-y-6">
                            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Productivity</h3>
                                <p className="text-3xl font-bold text-blue-600">{insights.totalHoursPeriod}h</p>
                                <p className="text-sm text-gray-500">
                                    {stats?.dateRange?.days > 1
                                        ? `${insights.avgHoursPerDay}h avg/day`
                                        : 'Total hours logged'
                                    }
                                </p>
                            </div>
                            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Tasks/Employee</h3>
                                <p className="text-3xl font-bold text-green-600">{insights.avgTasksPerEmployee}</p>
                                <p className="text-sm text-gray-500">
                                    {stats?.dateRange?.days > 1
                                        ? `Per team member (${currentDateLabel})`
                                        : 'Per team member'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Team Filter - Full width */}
                    <div className="mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filter by Team ({currentDateLabel})
                        </label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90 backdrop-blur-sm"
                        >
                            <option value="all">All Teams</option>
                            {stats?.teamBreakdown?.map(team => (
                                <option key={team.name} value={team.name}>
                                    {team.name} ({team.employeeCount} members, {team.tasksTotal} tasks)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Team Overview or Detailed View - Full width responsive */}
                    {selectedTeam === 'all' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 w-full">
                                {stats?.teamBreakdown?.map((team) => (
                                    <TeamCard key={team.name} team={team} />
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                                <ActivityChart />
                                <ProjectTimeChart />
                            </div>
                        </>
                    ) : teamInsights ? (
                        <div className="space-y-6 w-full">
                            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                    Team: {teamInsights.teamName} ({currentDateLabel})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold text-blue-600">{teamInsights.employeeCount}</h3>
                                        <p className="text-gray-500">Team Members</p>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold text-green-600">{teamInsights.totalTasks}</h3>
                                        <p className="text-gray-500">Total Tasks</p>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold text-purple-600">{teamInsights.totalHours.toFixed(1)}h</h3>
                                        <p className="text-gray-500">Total Hours</p>
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-2xl font-bold text-orange-600">{teamInsights.projects.total}</h3>
                                        <p className="text-gray-500">Projects</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                                <TopPerformersTable performers={teamInsights.topPerformers} />

                                {Object.keys(teamInsights.timeByProject).length > 0 && (
                                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Project Time Distribution ({currentDateLabel})
                                        </h3>
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {Object.entries(teamInsights.timeByProject)
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 6)
                                                .map(([project, hours]) => (
                                                    <div key={project} className="flex justify-between items-center p-3 bg-gray-50/90 rounded-lg backdrop-blur-sm hover:bg-gray-100 transition-colors">
                                                        <span className="font-medium text-gray-900 truncate max-w-[70%]">
                                                            {project.split('-')[0].substring(0, 20)}...
                                                        </span>
                                                        <span className="text-blue-600 font-semibold">
                                                            {parseFloat(hours).toFixed(1)}h
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-12 shadow-lg border border-white/20 text-center w-full">
                            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Team</h3>
                            <p className="text-gray-500">Choose a team from the dropdown to view detailed insights for {currentDateLabel}</p>
                        </div>
                    )}

                    {/* Loading overlay for data updates */}
                    {loading && <LoadingScreen />}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
