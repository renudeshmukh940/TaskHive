import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Users, Briefcase, Activity, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3, Download, Filter, Search, Bell, Settings, User, Menu, Home, Target, FileText, Building2, Zap, Timer, Award } from 'lucide-react';

// Import your actual Firebase functions
import { getAdminDashboardStats, getTeamInsights } from '../lib/firebase';

const AdminDashboard = ({ userProfile }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [teamInsights, setTeamInsights] = useState(null);
    const [dateRange, setDateRange] = useState('7days');
    const [activeView, setActiveView] = useState('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const dateRanges = [
        { value: 'today', label: 'Today' },
        { value: '7days', label: 'Last 7 Days' },
        { value: '30days', label: 'Last 30 Days' },
        { value: '90days', label: 'Last 3 Months' }
    ];

    useEffect(() => {
        loadDashboardData();
    }, [dateRange]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            setError('');
            const dashboardStats = await getAdminDashboardStats();
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
            const insights = await getTeamInsights(teamName);
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
    }, [selectedTeam]);

    const exportToExcel = async () => {
        if (!stats) return;

        try {
            // Dynamic import to avoid bundling issues
            const XLSX = await import('xlsx');
            const { format } = await import('date-fns');

            const exportData = {
                'Dashboard Summary': [
                    ['Total Teams', stats.totalTeams],
                    ['Total Employees', stats.totalEmployees],
                    ['Total Tasks', stats.totalTasks],
                    ['Total Projects', stats.totalProjects]
                ],
                'Project Status': [
                    ['Status', 'Count'],
                    ['Completed', stats.projectStatus.completed],
                    ['In Progress', stats.projectStatus.inProgress],
                    ['On Hold', stats.projectStatus.onHold]
                ],
                'Team Breakdown': stats.teamBreakdown.map(team => [
                    team.name,
                    team.employeeCount,
                    team.tasksToday,
                    team.projects.completed,
                    team.projects.inProgress,
                    team.projects.onHold,
                    team.projects.totalTime
                ])
            };

            const workbook = XLSX.utils.book_new();
            Object.entries(exportData).forEach(([sheetName, data]) => {
                const worksheet = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });

            XLSX.writeFile(workbook, `MpOnline_Admin_Dashboard_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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

    // Calculate derived metrics
    const calculateInsights = () => {
        if (!stats) return {};

        const totalProjects = stats.totalProjects || 1;
        const completionRate = Math.round((stats.projectStatus.completed / totalProjects) * 100);
        const progressRate = Math.round((stats.projectStatus.inProgress / totalProjects) * 100);
        const avgTasksPerEmployee = Math.round(stats.totalTasks / stats.totalEmployees);
        const totalHoursToday = stats.recentActivity.reduce((sum, activity) => sum + parseFloat(activity.hours), 0);

        return {
            completionRate,
            progressRate,
            avgTasksPerEmployee,
            totalHoursToday: totalHoursToday.toFixed(1)
        };
    };

    const insights = calculateInsights();

    const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle }) => (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-${color}-50 flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${color}-600`} />
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
        <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedTeam(team.name)}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{team.name}</h3>
                        <p className="text-sm text-gray-500">{team.employeeCount} members</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Tasks Today</p>
                    <p className="text-lg font-bold text-blue-600">{team.tasksToday}</p>
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
                            width: `${(team.projects.completed / (team.projects.completed + team.projects.inProgress + team.projects.onHold || 1)) * 100}%`
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
            hours: parseFloat(activity.hours)
        }));

        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    Team Activity Overview
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="team" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="tasks" fill="#3B82F6" name="Tasks" radius={4} />
                        <Bar yAxisId="right" dataKey="hours" fill="#10B981" name="Hours" radius={4} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const ProjectTimeChart = () => {
        if (!stats?.timeByProject) return null;

        const chartData = Object.entries(stats.timeByProject)
            .map(([project, hours]) => ({
                project: project.split('-')[0].substring(0, 15) + '...',
                hours: parseFloat(hours),
                fullName: project.split('-')[0]
            }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 8);

        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Timer className="w-5 h-5 mr-2 text-purple-600" />
                    Project Time Distribution
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
                        <Tooltip formatter={(value, name) => [`${value} hours`, 'Time Spent']} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const TopPerformersTable = ({ performers }) => (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-yellow-600" />
                Top Performers
            </h3>
            <div className="space-y-3">
                {performers?.slice(0, 5).map((performer, index) => (
                    <div key={performer.empId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-500'
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading MpOnline Dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={loadDashboardData}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <div className={`fixed left-0 top-0 h-full bg-white shadow-lg z-50 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'
                }`}>
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        {!sidebarCollapsed && (
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">MpOnline</h1>
                                <p className="text-sm text-gray-500">Admin Portal</p>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="mt-6">
                    {sidebarItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`w-full flex items-center px-6 py-3 text-left hover:bg-blue-50 transition-colors ${activeView === item.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-600'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="flex items-center justify-between px-8 py-6">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                                <p className="text-gray-500">{currentDate}</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {dateRanges.map(range => (
                                    <option key={range.value} value={range.value}>{range.label}</option>
                                ))}
                            </select>

                            <button
                                onClick={exportToExcel}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </button>

                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                        {userProfile?.empName?.charAt(0).toUpperCase() || 'A'}
                                    </span>
                                </div>
                                <span className="text-gray-700 font-medium">{userProfile?.empName || 'Admin'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <main className="p-8">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="Total Tasks"
                            value={stats?.totalTasks || 0}
                            change="+12.5%"
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
                            title="Active Projects"
                            value={stats?.totalProjects || 0}
                            change="-1.8%"
                            changeType="negative"
                            icon={Briefcase}
                            color="purple"
                            subtitle="In progress + completed"
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

                    {/* Project Status Overview */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status Overview</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-green-50 rounded-xl">
                                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-green-600">{stats?.projectStatus.completed || 0}</h3>
                                        <p className="text-sm text-green-600">Completed</p>
                                        <p className="text-xs text-gray-500 mt-1">{insights.completionRate}% of total</p>
                                    </div>
                                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                                        <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-blue-600">{stats?.projectStatus.inProgress || 0}</h3>
                                        <p className="text-sm text-blue-600">In Progress</p>
                                        <p className="text-xs text-gray-500 mt-1">{insights.progressRate}% of total</p>
                                    </div>
                                    <div className="text-center p-4 bg-orange-50 rounded-xl">
                                        <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                                        <h3 className="text-2xl font-bold text-orange-600">{stats?.projectStatus.onHold || 0}</h3>
                                        <p className="text-sm text-orange-600">On Hold</p>
                                        <p className="text-xs text-gray-500 mt-1">Need attention</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Today's Productivity</h3>
                                <p className="text-3xl font-bold text-blue-600">{insights.totalHoursToday}h</p>
                                <p className="text-sm text-gray-500">Total hours logged</p>
                            </div>
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Tasks/Employee</h3>
                                <p className="text-3xl font-bold text-green-600">{insights.avgTasksPerEmployee}</p>
                                <p className="text-sm text-gray-500">Per team member</p>
                            </div>
                        </div>
                    </div>

                    {/* Team Filter */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Team</label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Teams</option>
                            {stats?.teamBreakdown?.map(team => (
                                <option key={team.name} value={team.name}>
                                    {team.name} ({team.employeeCount} members)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Team Overview or Detailed View */}
                    {selectedTeam === 'all' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {stats?.teamBreakdown?.map((team) => (
                                    <TeamCard key={team.name} team={team} />
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ActivityChart />
                                <ProjectTimeChart />
                            </div>
                        </>
                    ) : teamInsights ? (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Team: {teamInsights.teamName}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <TopPerformersTable performers={teamInsights.topPerformers} />

                                {Object.keys(teamInsights.timeByProject).length > 0 && (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Time Distribution</h3>
                                        <div className="space-y-3">
                                            {Object.entries(teamInsights.timeByProject)
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 6)
                                                .map(([project, hours]) => (
                                                    <div key={project} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                        <span className="font-medium text-gray-900 truncate">
                                                            {project.split('-')[0].substring(0, 20)}...
                                                        </span>
                                                        <span className="text-blue-600 font-semibold">{parseFloat(hours).toFixed(1)}h</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Team</h3>
                            <p className="text-gray-500">Choose a team from the dropdown to view detailed insights</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;