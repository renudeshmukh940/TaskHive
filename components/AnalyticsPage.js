// import React, { useState, useEffect } from 'react';
// import {
//     LineChart, Line,
//     BarChart, Bar,
//     AreaChart, Area,
//     XAxis, YAxis,
//     CartesianGrid,
//     Tooltip,
//     Legend,
//     ResponsiveContainer,
//     PieChart,
//     Pie,
//     Cell,
//     ScatterChart,
//     Scatter,
//     ZAxis
// } from 'recharts';
// import {
//     Calendar,
//     Users,
//     Briefcase,
//     Activity,
//     TrendingUp,
//     Clock,
//     CheckCircle,
//     AlertCircle,
//     BarChart3,
//     Download,
//     Filter,
//     Search,
//     Bell,
//     Settings,
//     User,
//     Menu,
//     Home,
//     Target,
//     FileText,
//     Building2,
//     Zap,
//     Timer,
//     Award,
//     CalendarDays,
//     TrendingDown,
//     Eye,
//     File,
//     ChartBar,
//     ChartLine,
//     ChartPie,
//     Table
// } from 'lucide-react';
// import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
// import {
//     getAdminDashboardStats,
//     getTeamInsights,
//     getDateRange,
//     getTasksForDateRange,
//     getTeams,
//     getUserProfile,
//     getFilteredTasks
// } from '../lib/firebase';
// import { useAuth } from '../contexts/AuthContext';

// const AnalyticsPage = ({ userProfile, integrated = false }) => {
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState('');
//     const [dateRange, setDateRange] = useState('30days');
//     const [activeTab, setActiveTab] = useState('overview');
//     const [selectedTeam, setSelectedTeam] = useState('all');
//     const [selectedUser, setSelectedUser] = useState(null);
//     const [selectedProject, setSelectedProject] = useState(null);
//     const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

//     // Data states
//     const [dashboardStats, setDashboardStats] = useState(null);
//     const [allTasks, setAllTasks] = useState([]);
//     const [teams, setTeams] = useState([]);
//     const [teamInsights, setTeamInsights] = useState(null);
//     const [userProfiles, setUserProfiles] = useState({});
//     const [filters, setFilters] = useState({
//         status: '',
//         workType: '',
//         percentageCompletion: '',
//         team: '',
//         project: ''
//     });

//     const dateRanges = [
//         { value: 'today', label: 'Today', icon: Calendar },
//         { value: '7days', label: 'Last 7 Days', icon: CalendarDays },
//         { value: '30days', label: 'Last 30 Days', icon: CalendarDays },
//         { value: '90days', label: 'Last 90 Days', icon: CalendarDays },
//         { value: 'custom', label: 'Custom Range', icon: CalendarDays }
//     ];

//     const currentDateRange = getDateRange(dateRange);
//     const currentDateLabel = dateRange === 'today'
//         ? 'Today'
//         : `${format(new Date(currentDateRange.start), 'MMM dd')} - ${format(new Date(currentDateRange.end), 'MMM dd')}`;

//     useEffect(() => {
//         loadAnalyticsData();
//     }, [dateRange, filters]);

//     useEffect(() => {
//         if (selectedTeam !== 'all') {
//             loadTeamInsights(selectedTeam);
//         } else {
//             setTeamInsights(null);
//         }
//     }, [selectedTeam, dateRange]);

//     const loadAnalyticsData = async () => {
//         try {
//             setLoading(true);
//             setError('');

//             // Load dashboard stats
//             const stats = await getAdminDashboardStats(
//                 currentDateRange.start,
//                 currentDateRange.end
//             );
//             setDashboardStats(stats);

//             // Load all tasks with filters
//             const tasks = await getFilteredTasks(userProfile, filters);
//             setAllTasks(tasks);

//             // Load teams
//             const teamsData = await getTeams(userProfile);
//             setTeams(teamsData);

//         } catch (err) {
//             setError('Error loading analytics data: ' + err.message);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const loadTeamInsights = async (teamName) => {
//         if (teamName === 'all') {
//             setTeamInsights(null);
//             return;
//         }

//         try {
//             const insights = await getTeamInsights(
//                 teamName,
//                 currentDateRange.start,
//                 currentDateRange.end
//             );
//             setTeamInsights(insights);
//         } catch (err) {
//             setError('Error loading team insights: ' + err.message);
//         }
//     };

//     // Analytics Calculations
//     const calculateUserPerformance = () => {
//         if (!allTasks.length) return [];

//         const userStats = {};

//         allTasks.forEach(task => {
//             const empId = task.empId;
//             if (!userStats[empId]) {
//                 userStats[empId] = {
//                     empId,
//                     empName: task.empName || `User ${empId}`,
//                     teamName: task.teamName,
//                     totalTasks: 0,
//                     completed: 0,
//                     inProgress: 0,
//                     onHold: 0,
//                     totalHours: 0,
//                     avgCompletion: 0,
//                     projects: new Set(),
//                     workTypes: {}
//                 };
//             }

//             const user = userStats[empId];
//             user.totalTasks++;

//             // Status tracking
//             switch (task.status) {
//                 case 'Completed':
//                     user.completed++;
//                     break;
//                 case 'In Progress':
//                     user.inProgress++;
//                     break;
//                 case 'On Hold':
//                     user.onHold++;
//                     break;
//             }

//             // Hours calculation
//             if (task.timeSpent) {
//                 const [h, m] = task.timeSpent.split(':').map(Number);
//                 user.totalHours += h + m / 60;
//             }

//             // Projects
//             if (task.projectName) {
//                 user.projects.add(task.projectName);
//             }

//             // Work types
//             if (task.workType) {
//                 user.workTypes[task.workType] = (user.workTypes[task.workType] || 0) + 1;
//             }

//             // Completion rate
//             if (task.percentageCompletion) {
//                 user.avgCompletion += parseInt(task.percentageCompletion);
//             }
//         });

//         return Object.values(userStats).map(user => ({
//             ...user,
//             avgCompletion: user.totalTasks > 0 ? Math.round(user.avgCompletion / user.totalTasks) : 0,
//             avgHoursPerTask: user.totalTasks > 0 ? (user.totalHours / user.totalTasks).toFixed(1) : 0,
//             completionRate: user.totalTasks > 0 ? Math.round((user.completed / user.totalTasks) * 100) : 0,
//             numProjects: user.projects.size
//         })).sort((a, b) => b.totalTasks - a.totalTasks);
//     };

//     const calculateProjectPerformance = () => {
//         if (!allTasks.length) return [];

//         const projectStats = {};

//         allTasks.forEach(task => {
//             const projectName = task.projectName;
//             if (!projectName || !projectStats[projectName]) {
//                 projectStats[projectName] = {
//                     projectName,
//                     totalTasks: 0,
//                     completed: 0,
//                     inProgress: 0,
//                     onHold: 0,
//                     totalHours: 0,
//                     users: new Set(),
//                     teams: new Set(),
//                     avgCompletion: 0
//                 };
//             }

//             const project = projectStats[projectName];
//             project.totalTasks++;

//             switch (task.status) {
//                 case 'Completed':
//                     project.completed++;
//                     break;
//                 case 'In Progress':
//                     project.inProgress++;
//                     break;
//                 case 'On Hold':
//                     project.onHold++;
//                     break;
//             }

//             if (task.timeSpent) {
//                 const [h, m] = task.timeSpent.split(':').map(Number);
//                 project.totalHours += h + m / 60;
//             }

//             project.users.add(task.empId);
//             project.teams.add(task.teamName);

//             if (task.percentageCompletion) {
//                 project.avgCompletion += parseInt(task.percentageCompletion);
//             }
//         });

//         return Object.values(projectStats).map(project => ({
//             ...project,
//             avgCompletion: project.totalTasks > 0 ? Math.round(project.avgCompletion / project.totalTasks) : 0,
//             avgHoursPerTask: project.totalTasks > 0 ? (project.totalHours / project.totalTasks).toFixed(1) : 0,
//             completionRate: project.totalTasks > 0 ? Math.round((project.completed / project.totalTasks) * 100) : 0,
//             numUsers: project.users.size,
//             numTeams: project.teams.size
//         })).sort((a, b) => b.totalTasks - a.totalTasks);
//     };

//     const calculateDailyTrends = () => {
//         if (!allTasks.length) return [];

//         const dailyData = {};

//         allTasks.forEach(task => {
//             const date = format(new Date(task.date), 'yyyy-MM-dd');
//             if (!dailyData[date]) {
//                 dailyData[date] = {
//                     date,
//                     totalTasks: 0,
//                     completed: 0,
//                     hours: 0,
//                     avgCompletion: 0
//                 };
//             }

//             const day = dailyData[date];
//             day.totalTasks++;

//             if (task.status === 'Completed') {
//                 day.completed++;
//             }

//             if (task.timeSpent) {
//                 const [h, m] = task.timeSpent.split(':').map(Number);
//                 day.hours += h + m / 60;
//             }

//             if (task.percentageCompletion) {
//                 day.avgCompletion += parseInt(task.percentageCompletion);
//             }
//         });

//         return Object.values(dailyData).map(day => ({
//             ...day,
//             avgCompletion: day.totalTasks > 0 ? Math.round(day.avgCompletion / day.totalTasks) : 0,
//             formattedDate: format(new Date(day.date), 'MMM dd'),
//             week: format(new Date(day.date), 'wo week')
//         })).sort((a, b) => new Date(a.date) - new Date(b.date));
//     };

//     const userPerformance = calculateUserPerformance();
//     const projectPerformance = calculateProjectPerformance();
//     const dailyTrends = calculateDailyTrends();

//     const getWorkTypeDistribution = () => {
//         const workTypes = {};
//         allTasks.forEach(task => {
//             if (task.workType) {
//                 workTypes[task.workType] = (workTypes[task.workType] || 0) + 1;
//             }
//         });
//         return Object.entries(workTypes).map(([name, value]) => ({ name, value }));
//     };

//     const workTypeData = getWorkTypeDistribution();

//     // Charts Components
//     const DailyPerformanceChart = () => (
//         <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//             <div className="flex items-center justify-between mb-6">
//                 <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                     <ChartLine className="w-5 h-5 mr-2 text-blue-600" />
//                     Daily Performance Trends
//                 </h3>
//                 <span className="text-sm text-gray-500">{currentDateLabel}</span>
//             </div>
//             <ResponsiveContainer width="100%" height={300}>
//                 <LineChart data={dailyTrends.slice(-15)}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                     <XAxis
//                         dataKey="formattedDate"
//                         tick={{ fontSize: 11 }}
//                         angle={-45}
//                         textAnchor="end"
//                         height={70}
//                     />
//                     <YAxis />
//                     <Tooltip
//                         labelStyle={{ color: '#666' }}
//                         formatter={(value) => [value, 'Tasks']}
//                     />
//                     <Legend />
//                     <Line
//                         type="monotone"
//                         dataKey="completed"
//                         stroke="#10B981"
//                         strokeWidth={3}
//                         name="Completed"
//                         dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
//                     />
//                     <Line
//                         type="monotone"
//                         dataKey="totalTasks"
//                         stroke="#3B82F6"
//                         strokeWidth={3}
//                         name="Total"
//                         dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
//                     />
//                 </LineChart>
//             </ResponsiveContainer>
//         </div>
//     );

//     const WorkTypeDistributionChart = () => (
//         <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//             <div className="flex items-center justify-between mb-6">
//                 <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                     <ChartPie className="w-5 h-5 mr-2 text-purple-600" />
//                     Work Type Distribution
//                 </h3>
//                 <span className="text-sm text-gray-500">{allTasks.length} total tasks</span>
//             </div>
//             <ResponsiveContainer width="100%" height={300}>
//                 <PieChart>
//                     <Pie
//                         data={workTypeData}
//                         cx="50%"
//                         cy="50%"
//                         labelLine={false}
//                         label={({ name, percent }) => `${name}\n${((percent || 0) * 100).toFixed(0)}%`}
//                         outerRadius={100}
//                         fill="#8884d8"
//                         dataKey="value"
//                     >
//                         {workTypeData.map((entry, index) => (
//                             <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][index % 5]} />
//                         ))}
//                     </Pie>
//                     <Tooltip />
//                 </PieChart>
//             </ResponsiveContainer>
//         </div>
//     );

//     const UserPerformanceTable = () => {
//         const topUsers = userPerformance.slice(0, 10);
//         return (
//             <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
//                 <div className="p-6 border-b border-gray-100">
//                     <div className="flex items-center justify-between">
//                         <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                             <Users className="w-5 h-5 mr-2 text-green-600" />
//                             User Performance Ranking
//                         </h3>
//                         <span className="text-sm text-gray-500">{userPerformance.length} total users</span>
//                     </div>
//                 </div>
//                 <div className="overflow-x-auto">
//                     <table className="w-full">
//                         <thead className="bg-gray-50">
//                             <tr>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completion %</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
//                             </tr>
//                         </thead>
//                         <tbody className="bg-white divide-y divide-gray-200">
//                             {topUsers.map((user, index) => (
//                                 <tr
//                                     key={user.empId}
//                                     className={`hover:bg-gray-50 cursor-pointer transition-colors ${index === 0 ? 'bg-green-50' : ''}`}
//                                     onClick={() => setSelectedUser(user)}
//                                 >
//                                     <td className="px-6 py-4 whitespace-nowrap">
//                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${index === 0 ? 'bg-green-500' :
//                                             index === 1 ? 'bg-gray-400' :
//                                                 index === 2 ? 'bg-orange-400' : 'bg-blue-500'
//                                             }`}>
//                                             {index + 1}
//                                         </div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap">
//                                         <div>
//                                             <div className="text-sm font-medium text-gray-900">{user.empName}</div>
//                                             <div className="text-sm text-gray-500">{user.empId}</div>
//                                         </div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap">
//                                         <div className="text-sm text-gray-900">{user.teamName}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{user.totalTasks}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm font-medium text-green-600">{user.completed}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{user.totalHours.toFixed(1)}h</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className={`text-sm font-medium ${user.completionRate >= 80 ? 'text-green-600' :
//                                             user.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
//                                             }`}>
//                                             {user.completionRate}%
//                                         </div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{user.numProjects}</div>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         );
//     };

//     const ProjectPerformanceTable = () => {
//         const topProjects = projectPerformance.slice(0, 10);

//         return (
//             <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
//                 <div className="p-6 border-b border-gray-100">
//                     <div className="flex items-center justify-between">
//                         <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                             <Briefcase className="w-5 h-5 mr-2 text-purple-600" />
//                             Project Performance Overview
//                         </h3>
//                         <span className="text-sm text-gray-500">{projectPerformance.length} total projects</span>
//                     </div>
//                 </div>
//                 <div className="overflow-x-auto">
//                     <table className="w-full">
//                         <thead className="bg-gray-50">
//                             <tr>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Teams</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Completion %</th>
//                             </tr>
//                         </thead>
//                         <tbody className="bg-white divide-y divide-gray-200">
//                             {topProjects.map((project, index) => (
//                                 <tr
//                                     key={project.projectName}
//                                     className="hover:bg-gray-50 cursor-pointer transition-colors"
//                                     onClick={() => setSelectedProject(project)}
//                                 >
//                                     <td className="px-6 py-4">
//                                         <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
//                                             {project.projectName}
//                                         </div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{project.totalTasks}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm font-medium text-green-600">{project.completed}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{project.totalHours.toFixed(1)}h</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{project.numUsers}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className="text-sm text-gray-900">{project.numTeams}</div>
//                                     </td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right">
//                                         <div className={`text-sm font-medium ${project.completionRate >= 80 ? 'text-green-600' :
//                                             project.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
//                                             }`}>
//                                             {project.completionRate}%
//                                         </div>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         );
//     };

//     const TeamPerformanceChart = () => {
//         if (!dashboardStats?.teamBreakdown?.length) return null;

//         const chartData = dashboardStats.teamBreakdown.map(team => ({
//             team: team.name,
//             tasks: team.tasksTotal,
//             hours: team.projects.totalTime,
//             completed: team.projects.completed
//         })).slice(0, 8);

//         return (
//             <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                 <div className="flex items-center justify-between mb-6">
//                     <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                         <Building2 className="w-5 h-5 mr-2 text-orange-600" />
//                         Team Performance Comparison
//                     </h3>
//                     <select
//                         value={selectedTeam}
//                         onChange={(e) => setSelectedTeam(e.target.value)}
//                         className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     >
//                         <option value="all">All Teams</option>
//                         {dashboardStats.teamBreakdown.map(team => (
//                             <option key={team.name} value={team.name}>
//                                 {team.name}
//                             </option>
//                         ))}
//                     </select>
//                 </div>
//                 <ResponsiveContainer width="100%" height={300}>
//                     <BarChart data={chartData}>
//                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                         <XAxis dataKey="team" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
//                         <YAxis />
//                         <Tooltip />
//                         <Legend />
//                         <Bar dataKey="tasks" fill="#3B82F6" name="Tasks" radius={4} />
//                         <Bar dataKey="hours" fill="#10B981" name="Hours" radius={4} />
//                         <Bar dataKey="completed" fill="#F59E0B" name="Completed" radius={4} />
//                     </BarChart>
//                 </ResponsiveContainer>
//             </div>
//         );
//     };

//     const StatusDistributionChart = () => {
//         const statusData = [
//             { name: 'Completed', value: dashboardStats?.projectStatus?.completed || 0, fill: '#10B981' },
//             { name: 'In Progress', value: dashboardStats?.projectStatus?.inProgress || 0, fill: '#3B82F6' },
//             { name: 'On Hold', value: dashboardStats?.projectStatus?.onHold || 0, fill: '#F59E0B' }
//         ];

//         return (
//             <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                 <div className="flex items-center justify-between mb-6">
//                     <h3 className="text-lg font-semibold text-gray-900 flex items-center">
//                         <ChartBar className="w-5 h-5 mr-2 text-indigo-600" />
//                         Task Status Distribution
//                     </h3>
//                     <span className="text-sm text-gray-500">{allTasks.length} total tasks</span>
//                 </div>
//                 <ResponsiveContainer width="100%" height={300}>
//                     <BarChart data={statusData} layout="horizontal">
//                         <XAxis type="number" />
//                         <YAxis dataKey="name" type="category" width={150} />
//                         <Bar dataKey="value" />
//                         <Tooltip />
//                     </BarChart>
//                 </ResponsiveContainer>
//             </div>
//         );
//     };

//     const UserDetailModal = ({ user, onClose }) => {
//         if (!user) return null;

//         const userTasks = allTasks.filter(t => t.empId === user.empId);
//         const userDailyData = userTasks.reduce((acc, task) => {
//             const date = format(new Date(task.date), 'yyyy-MM-dd');
//             if (!acc[date]) {
//                 acc[date] = { date, completed: 0, total: 0, hours: 0 };
//             }
//             acc[date].total++;
//             if (task.status === 'Completed') acc[date].completed++;
//             if (task.timeSpent) {
//                 const [h, m] = task.timeSpent.split(':').map(Number);
//                 acc[date].hours += h + m / 60;
//             }
//             return acc;
//         }, {});

//         const dailyChartData = Object.values(userDailyData).sort((a, b) => new Date(a.date) - new Date(b.date));

//         return (
//             <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
//                 <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//                     <div className="sticky top-0 bg-white/100 backdrop-blur-sm border-b border-gray-200 p-6 z-10">
//                         <div className="flex items-center justify-between">
//                             <div className="flex items-center space-x-4">
//                                 <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
//                                     <Award className="w-6 h-6 text-white" />
//                                 </div>
//                                 <div>
//                                     <h2 className="text-xl font-bold text-gray-900">{user.empName}</h2>
//                                     <p className="text-sm text-gray-500">{user.empId} • {user.teamName}</p>
//                                 </div>
//                             </div>
//                             <button
//                                 onClick={onClose}
//                                 className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
//                             >
//                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                                 </svg>
//                             </button>
//                         </div>
//                     </div>

//                     <div className="p-6 space-y-6">
//                         {/* Performance Summary */}
//                         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
//                             <div className="text-center p-4 bg-green-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-green-600">{user.totalTasks}</div>
//                                 <div className="text-sm text-green-600">Total Tasks</div>
//                             </div>
//                             <div className="text-center p-4 bg-blue-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-blue-600">{user.completed}</div>
//                                 <div className="text-sm text-blue-600">Completed</div>
//                             </div>
//                             <div className="text-center p-4 bg-purple-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-purple-600">{user.totalHours.toFixed(1)}h</div>
//                                 <div className="text-sm text-purple-600">Total Hours</div>
//                             </div>
//                             <div className="text-center p-4 bg-orange-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-orange-600">{user.completionRate}%</div>
//                                 <div className="text-sm text-orange-600">Completion Rate</div>
//                             </div>
//                         </div>

//                         {/* Daily Performance Chart */}
//                         {dailyChartData.length > 0 && (
//                             <div className="bg-gray-50 rounded-xl p-4">
//                                 <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance</h3>
//                                 <ResponsiveContainer width="100%" height={250}>
//                                     <AreaChart data={dailyChartData}>
//                                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                                         <XAxis
//                                             dataKey="date"
//                                             tickFormatter={(date) => format(new Date(date), 'MMM dd')}
//                                             tick={{ fontSize: 11 }}
//                                         />
//                                         <YAxis />
//                                         <Tooltip
//                                             labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
//                                         />
//                                         <Area
//                                             type="monotone"
//                                             dataKey="completed"
//                                             stackId="1"
//                                             stroke="#10B981"
//                                             fill="#10B981"
//                                             name="Completed"
//                                         />
//                                         <Area
//                                             type="monotone"
//                                             dataKey="total"
//                                             stackId="1"
//                                             stroke="#3B82F6"
//                                             fill="#3B82F6"
//                                             name="Total"
//                                         />
//                                     </AreaChart>
//                                 </ResponsiveContainer>
//                             </div>
//                         )}

//                         {/* Recent Tasks */}
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>
//                             <div className="space-y-3 max-h-96 overflow-y-auto">
//                                 {userTasks.slice(-10).reverse().map(task => (
//                                     <div key={task.id} className="flex items-center p-4 bg-white rounded-lg border border-gray-200">
//                                         <div className="flex-1 min-w-0">
//                                             <div className="flex items-center justify-between">
//                                                 <h4 className="text-sm font-medium text-gray-900 truncate">{task.taskDescription}</h4>
//                                                 <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'Completed' ? 'bg-green-100 text-green-800' :
//                                                     task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
//                                                     }`}>
//                                                     {task.status}
//                                                 </span>
//                                             </div>
//                                             <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
//                                                 <span>{format(new Date(task.date), 'MMM dd')}</span>
//                                                 {task.projectName && <span>• {task.projectName}</span>}
//                                                 {task.timeSpent && <span>• {task.timeSpent}</span>}
//                                                 {task.workType && <span>• {task.workType}</span>}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     };

//     const ProjectDetailModal = ({ project, onClose }) => {
//         if (!project) return null;

//         const projectTasks = allTasks.filter(t => t.projectName === project.projectName);
//         const usersInProject = [...new Set(projectTasks.map(t => t.empId))];

//         return (
//             <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
//                 <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//                     <div className="sticky top-0 bg-white/100 backdrop-blur-sm border-b border-gray-200 p-6 z-10">
//                         <div className="flex items-center justify-between">
//                             <div className="flex items-center space-x-4">
//                                 <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
//                                     <Briefcase className="w-6 h-6 text-white" />
//                                 </div>
//                                 <div>
//                                     <h2 className="text-xl font-bold text-gray-900">{project.projectName}</h2>
//                                     <p className="text-sm text-gray-500">{project.numUsers} users • {project.numTeams} teams</p>
//                                 </div>
//                             </div>
//                             <button
//                                 onClick={onClose}
//                                 className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
//                             >
//                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                                 </svg>
//                             </button>
//                         </div>
//                     </div>

//                     <div className="p-6 space-y-6">
//                         {/* Project Summary */}
//                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                             <div className="text-center p-4 bg-purple-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-purple-600">{project.totalTasks}</div>
//                                 <div className="text-sm text-purple-600">Total Tasks</div>
//                             </div>
//                             <div className="text-center p-4 bg-green-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-green-600">{project.completed}</div>
//                                 <div className="text-sm text-green-600">Completed</div>
//                             </div>
//                             <div className="text-center p-4 bg-blue-50 rounded-xl">
//                                 <div className="text-2xl font-bold text-blue-600">{project.totalHours.toFixed(1)}h</div>
//                                 <div className="text-sm text-blue-600">Total Hours</div>
//                             </div>
//                         </div>

//                         {/* Team & User Distribution */}
//                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                             <div className="bg-gray-50 rounded-xl p-4">
//                                 <h4 className="text-sm font-medium text-gray-900 mb-2">Teams Involved</h4>
//                                 <div className="space-y-1">
//                                     {[...new Set(projectTasks.map(t => t.teamName))].map(team => (
//                                         <div key={team} className="flex items-center justify-between text-xs">
//                                             <span className="text-gray-600">{team}</span>
//                                             <span className="text-gray-900">
//                                                 {projectTasks.filter(t => t.teamName === team).length} tasks
//                                             </span>
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                             <div className="bg-gray-50 rounded-xl p-4">
//                                 <h4 className="text-sm font-medium text-gray-900 mb-2">Top Contributors</h4>
//                                 <div className="space-y-1">
//                                     {usersInProject.slice(0, 5).map(empId => {
//                                         const tasksByUser = projectTasks.filter(t => t.empId === empId);
//                                         return (
//                                             <div key={empId} className="flex items-center justify-between text-xs">
//                                                 <span className="text-gray-600 truncate">{empId}</span>
//                                                 <span className="text-gray-900">{tasksByUser.length} tasks</span>
//                                             </div>
//                                         );
//                                     })}
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Recent Tasks */}
//                         <div>
//                             <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>
//                             <div className="space-y-3 max-h-96 overflow-y-auto">
//                                 {projectTasks.slice(-8).reverse().map(task => (
//                                     <div key={task.id} className="flex items-center p-4 bg-white rounded-lg border border-gray-200">
//                                         <div className="flex-1 min-w-0">
//                                             <div className="flex items-center justify-between">
//                                                 <h4 className="text-sm font-medium text-gray-900 truncate">{task.taskDescription}</h4>
//                                                 <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'Completed' ? 'bg-green-100 text-green-800' :
//                                                     task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
//                                                     }`}>
//                                                     {task.status}
//                                                 </span>
//                                             </div>
//                                             <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
//                                                 <span>{format(new Date(task.date), 'MMM dd')}</span>
//                                                 <span>{task.empId}</span>
//                                                 {task.timeSpent && <span>• {task.timeSpent}</span>}
//                                                 {task.workType && <span>• {task.workType}</span>}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     };

//     // INTEGRATED MODE - Only render main content and modals (no sidebar/header)
//     if (integrated) {
//         if (loading) {
//             return (
//                 <div className="flex items-center justify-center min-h-[400px]">
//                     <div className="text-center">
//                         <div className="relative">
//                             <div className="w-24 h-24 mx-auto mb-6 relative">
//                                 <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl animate-pulse"></div>
//                                 <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
//                                     <BarChart3 className="w-10 h-10 text-blue-600 animate-spin" />
//                                 </div>
//                             </div>
//                             <h3 className="text-2xl font-bold text-gray-800 mb-2">Loading Analytics</h3>
//                             <p className="text-gray-600">Processing performance data...</p>
//                         </div>
//                     </div>
//                 </div>
//             );
//         }

//         if (error) {
//             return (
//                 <div className="flex items-center justify-center min-h-[400px]">
//                     <div className="text-center max-w-md">
//                         <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
//                         <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
//                         <p className="text-gray-600 mb-4">{error}</p>
//                         <button
//                             onClick={loadAnalyticsData}
//                             className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105"
//                         >
//                             Reload Data
//                         </button>
//                     </div>
//                 </div>
//             );
//         }

//         return (
//             <>
//                 {/* Analytics Header (simplified for integrated mode) */}
//                 <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-white/20 mb-6">
//                     <div className="flex items-center justify-between px-6 py-4">
//                         <div className="flex items-center space-x-4">
//                             <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
//                                 Analytics Dashboard
//                             </h1>
//                             <p className="text-gray-500 flex items-center space-x-2">
//                                 <CalendarDays className="w-4 h-4" />
//                                 <span>{currentDateLabel}</span>
//                                 <span>• {allTasks.length} tasks analyzed</span>
//                             </p>
//                         </div>

//                         <div className="flex items-center space-x-4">
//                             {/* Date Range Selector */}
//                             <div className="relative">
//                                 <select
//                                     value={dateRange}
//                                     onChange={(e) => setDateRange(e.target.value)}
//                                     className="px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90 backdrop-blur-sm appearance-none hover:bg-white transition-all"
//                                 >
//                                     {dateRanges.map(range => (
//                                         <option key={range.value} value={range.value}>
//                                             {range.label}
//                                         </option>
//                                     ))}
//                                 </select>
//                                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
//                                     <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
//                                         <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
//                                     </svg>
//                                 </div>
//                             </div>

//                             {/* Filters */}
//                             <div className="flex items-center space-x-2">
//                                 <div className="relative">
//                                     <select
//                                         value={filters.status}
//                                         onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
//                                         className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
//                                     >
//                                         <option value="">All Status</option>
//                                         <option value="Completed">Completed</option>
//                                         <option value="In Progress">In Progress</option>
//                                         <option value="On Hold">On Hold</option>
//                                     </select>
//                                 </div>
//                                 <div className="relative">
//                                     <select
//                                         value={filters.workType}
//                                         onChange={(e) => setFilters(prev => ({ ...prev, workType: e.target.value }))}
//                                         className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
//                                     >
//                                         <option value="">All Work Types</option>
//                                         <option value="Full-day">Full-day</option>
//                                         <option value="Half-day">Half-day</option>
//                                         <option value="Relaxation">Relaxation</option>
//                                         <option value="Over Time">Over Time</option>
//                                     </select>
//                                 </div>
//                             </div>

//                             <button
//                                 onClick={loadAnalyticsData}
//                                 className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center space-x-2"
//                             >
//                                 <Filter className="w-4 h-4" />
//                                 <span>Refresh</span>
//                             </button>

//                             <button
//                                 onClick={() => {
//                                     // Export logic here
//                                     console.log('Export analytics data');
//                                 }}
//                                 className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all transform hover:scale-105 flex items-center space-x-2"
//                             >
//                                 <Download className="w-4 h-4" />
//                                 <span>Export</span>
//                             </button>
//                         </div>
//                     </div>
//                 </header>

//                 {/* Main Content */}
//                 <main className="p-6 space-y-8">
//                     {/* Analytics Tab Navigation */}
//                     <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
//                         <div className="p-6 border-b border-gray-200">
//                             <div className="flex space-x-1">
//                                 {[
//                                     { id: 'overview', label: 'Overview', icon: ChartBar },
//                                     { id: 'users', label: 'User Performance', icon: Users },
//                                     { id: 'projects', label: 'Project Analytics', icon: Briefcase },
//                                     { id: 'teams', label: 'Team Performance', icon: Building2 }
//                                 ].map((tab) => (
//                                     <button
//                                         key={tab.id}
//                                         onClick={() => setActiveTab(tab.id)}
//                                         className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${activeTab === tab.id
//                                                 ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
//                                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
//                                             }`}
//                                     >
//                                         <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`} />
//                                         <span>{tab.label}</span>
//                                     </button>
//                                 ))}
//                             </div>
//                         </div>
//                     </div>

//                     {/* Overview Tab */}
//                     {activeTab === 'overview' && (
//                         <div className="space-y-8">
//                             {/* Key Metrics */}
//                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
//                                             <CheckCircle className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.completed || 0}</p>
//                                             <p className="text-xs text-gray-500">Completed</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-green-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.completed / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
//                                             <Clock className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.inProgress || 0}</p>
//                                             <p className="text-xs text-gray-500">In Progress</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-blue-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.inProgress / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
//                                             <AlertCircle className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.onHold || 0}</p>
//                                             <p className="text-xs text-gray-500">On Hold</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-orange-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.onHold / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
//                                             <Activity className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{allTasks.length}</p>
//                                             <p className="text-xs text-gray-500">Total Tasks</p>
//                                         </div>
//                                     </div>
//                                     <div className="text-center mt-4">
//                                         <p className="text-sm font-medium text-gray-900">
//                                             {Math.round((dashboardStats?.projectStatus?.completed / (allTasks.length || 1)) * 100)}% Complete
//                                         </p>
//                                     </div>
//                                 </div>
//                             </div>

//                             {/* Charts Grid */}
//                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                                 <DailyPerformanceChart />
//                                 <WorkTypeDistributionChart />
//                             </div>

//                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                                 <StatusDistributionChart />
//                                 <TeamPerformanceChart />
//                             </div>
//                         </div>
//                     )}

//                     {/* User Performance Tab */}
//                     {activeTab === 'users' && (
//                         <div className="space-y-8">
//                             <UserPerformanceTable />
//                             {userPerformance.length > 10 && (
//                                 <div className="text-center py-8">
//                                     <p className="text-gray-500">
//                                         Showing top {userPerformance.length} users.
//                                         <button
//                                             onClick={() => setActiveTab('overview')}
//                                             className="text-purple-600 hover:text-purple-700 font-medium ml-1"
//                                         >
//                                             View all metrics →
//                                         </button>
//                                     </p>
//                                 </div>
//                             )}
//                         </div>
//                     )}

//                     {/* Project Analytics Tab */}
//                     {activeTab === 'projects' && (
//                         <div className="space-y-8">
//                             <ProjectPerformanceTable />
//                             {projectPerformance.length > 10 && (
//                                 <div className="text-center py-8">
//                                     <p className="text-gray-500">
//                                         Showing top {projectPerformance.length} projects.
//                                         <button
//                                             onClick={() => setActiveTab('overview')}
//                                             className="text-purple-600 hover:text-purple-700 font-medium ml-1"
//                                         >
//                                             View all metrics →
//                                         </button>
//                                     </p>
//                                 </div>
//                             )}
//                         </div>
//                     )}

//                     {/* Team Performance Tab */}
//                     {activeTab === 'teams' && (
//                         <div className="space-y-8">
//                             <TeamPerformanceChart />
//                             {teamInsights && (
//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                                         Detailed Team Insights: {teamInsights.teamName}
//                                     </h3>
//                                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-blue-600">{teamInsights.employeeCount}</div>
//                                             <div className="text-sm text-gray-500">Team Members</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-green-600">{teamInsights.totalTasks}</div>
//                                             <div className="text-sm text-gray-500">Total Tasks</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-purple-600">{teamInsights.totalHours.toFixed(1)}h</div>
//                                             <div className="text-sm text-gray-500">Total Hours</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-orange-600">{teamInsights.projects.total}</div>
//                                             <div className="text-sm text-gray-500">Projects</div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}
//                         </div>
//                     )}
//                 </main>

//                 {/* Modals */}
//                 {selectedUser && (
//                     <UserDetailModal
//                         user={selectedUser}
//                         onClose={() => setSelectedUser(null)}
//                     />
//                 )}

//                 {selectedProject && (
//                     <ProjectDetailModal
//                         project={selectedProject}
//                         onClose={() => setSelectedProject(null)}
//                     />
//                 )}
//             </>
//         );
//     }

//     // STANDALONE MODE - Original full page render
//     if (loading) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
//                 <div className="text-center">
//                     <div className="relative">
//                         <div className="w-24 h-24 mx-auto mb-6 relative">
//                             <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl animate-pulse"></div>
//                             <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
//                                 <BarChart3 className="w-10 h-10 text-blue-600 animate-spin" />
//                             </div>
//                         </div>
//                         <h3 className="text-2xl font-bold text-gray-800 mb-2">Loading Analytics</h3>
//                         <p className="text-gray-600">Processing performance data...</p>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     if (error) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
//                 <div className="text-center max-w-md">
//                     <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
//                     <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
//                     <p className="text-gray-600 mb-4">{error}</p>
//                     <button
//                         onClick={loadAnalyticsData}
//                         className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105"
//                     >
//                         Reload Data
//                     </button>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
//             {/* Sidebar */}
//             <div className={`bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-300 fixed h-full z-40 border-r border-white/20 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
//                 <div className="p-4">
//                     <div className="flex items-center space-x-3">
//                         <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
//                             <BarChart3 className="w-6 h-6 text-white" />
//                         </div>
//                         {!sidebarCollapsed && (
//                             <div>
//                                 <h1 className="text-lg font-bold text-gray-900">Analytics Hub</h1>
//                                 <p className="text-sm text-gray-500">Performance Insights</p>
//                             </div>
//                         )}
//                     </div>
//                 </div>

//                 <nav className="mt-6">
//                     <div className={`space-y-1 px-2 ${sidebarCollapsed ? 'px-1' : ''}`}>
//                         <button
//                             onClick={() => setActiveTab('overview')}
//                             className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'overview'
//                                 ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-r-2 border-purple-500'
//                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
//                                 }`}
//                         >
//                             <ChartBar className="w-4 h-4 mr-3 flex-shrink-0" />
//                             {!sidebarCollapsed && <span>Overview</span>}
//                         </button>

//                         <button
//                             onClick={() => setActiveTab('users')}
//                             className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'users'
//                                 ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-r-2 border-purple-500'
//                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
//                                 }`}
//                         >
//                             <Users className="w-4 h-4 mr-3 flex-shrink-0" />
//                             {!sidebarCollapsed && <span>User Performance</span>}
//                         </button>

//                         <button
//                             onClick={() => setActiveTab('projects')}
//                             className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'projects'
//                                 ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-r-2 border-purple-500'
//                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
//                                 }`}
//                         >
//                             <Briefcase className="w-4 h-4 mr-3 flex-shrink-0" />
//                             {!sidebarCollapsed && <span>Project Analytics</span>}
//                         </button>

//                         <button
//                             onClick={() => setActiveTab('teams')}
//                             className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'teams'
//                                 ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-r-2 border-purple-500'
//                                 : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
//                                 }`}
//                         >
//                             <Building2 className="w-4 h-4 mr-3 flex-shrink-0" />
//                             {!sidebarCollapsed && <span>Team Performance</span>}
//                         </button>
//                     </div>
//                 </nav>
//             </div>

//             {/* Main Content */}
//             <div className={`transition-all duration-300 flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
//                 {/* Header */}
//                 <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-white/20 sticky top-0 z-10">
//                     <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-6">
//                         <div className="flex items-center space-x-4">
//                             <button
//                                 onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
//                                 className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
//                             >
//                                 <Menu className="w-6 h-6" />
//                             </button>
//                             <div>
//                                 <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
//                                     Analytics Dashboard
//                                 </h1>
//                                 <p className="text-gray-500 flex items-center space-x-2 mt-1">
//                                     <CalendarDays className="w-4 h-4" />
//                                     <span>{currentDateLabel}</span>
//                                     <span>• {allTasks.length} tasks analyzed</span>
//                                 </p>
//                             </div>
//                         </div>

//                         <div className="flex items-center space-x-4">
//                             {/* Date Range Selector */}
//                             <div className="relative">
//                                 <select
//                                     value={dateRange}
//                                     onChange={(e) => setDateRange(e.target.value)}
//                                     className="px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90 backdrop-blur-sm appearance-none hover:bg-white transition-all"
//                                 >
//                                     {dateRanges.map(range => (
//                                         <option key={range.value} value={range.value}>
//                                             {range.label}
//                                         </option>
//                                     ))}
//                                 </select>
//                                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
//                                     <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
//                                         <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
//                                     </svg>
//                                 </div>
//                             </div>

//                             {/* Filters */}
//                             <div className="flex items-center space-x-2">
//                                 <div className="relative">
//                                     <select
//                                         value={filters.status}
//                                         onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
//                                         className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
//                                     >
//                                         <option value="">All Status</option>
//                                         <option value="Completed">Completed</option>
//                                         <option value="In Progress">In Progress</option>
//                                         <option value="On Hold">On Hold</option>
//                                     </select>
//                                 </div>
//                                 <div className="relative">
//                                     <select
//                                         value={filters.workType}
//                                         onChange={(e) => setFilters(prev => ({ ...prev, workType: e.target.value }))}
//                                         className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
//                                     >
//                                         <option value="">All Work Types</option>
//                                         <option value="Full-day">Full-day</option>
//                                         <option value="Half-day">Half-day</option>
//                                         <option value="Relaxation">Relaxation</option>
//                                         <option value="Over Time">Over Time</option>
//                                     </select>
//                                 </div>
//                             </div>

//                             <button
//                                 onClick={loadAnalyticsData}
//                                 className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center space-x-2"
//                             >
//                                 <Filter className="w-4 h-4" />
//                                 <span>Refresh</span>
//                             </button>

//                             <button
//                                 onClick={() => {
//                                     // Export logic here
//                                     console.log('Export analytics data');
//                                 }}
//                                 className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all transform hover:scale-105 flex items-center space-x-2"
//                             >
//                                 <Download className="w-4 h-4" />
//                                 <span>Export</span>
//                             </button>
//                         </div>
//                     </div>
//                 </header>

//                 {/* Main Content */}
//                 <main className="p-6 space-y-8">
//                     {/* Overview Tab */}
//                     {activeTab === 'overview' && (
//                         <div className="space-y-8">
//                             {/* Key Metrics */}
//                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
//                                             <CheckCircle className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.completed || 0}</p>
//                                             <p className="text-xs text-gray-500">Completed</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-green-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.completed / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
//                                             <Clock className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.inProgress || 0}</p>
//                                             <p className="text-xs text-gray-500">In Progress</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-blue-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.inProgress / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
//                                             <AlertCircle className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{dashboardStats?.projectStatus?.onHold || 0}</p>
//                                             <p className="text-xs text-gray-500">On Hold</p>
//                                         </div>
//                                     </div>
//                                     <div className="w-full bg-gray-200 rounded-full h-2">
//                                         <div
//                                             className="h-2 bg-orange-500 rounded-full transition-all duration-300"
//                                             style={{ width: `${Math.min((dashboardStats?.projectStatus?.onHold / (allTasks.length || 1)) * 100, 100)}%` }}
//                                         ></div>
//                                     </div>
//                                 </div>

//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
//                                             <Activity className="w-6 h-6 text-white" />
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-2xl font-bold text-gray-900">{allTasks.length}</p>
//                                             <p className="text-xs text-gray-500">Total Tasks</p>
//                                         </div>
//                                     </div>
//                                     <div className="text-center mt-4">
//                                         <p className="text-sm font-medium text-gray-900">
//                                             {Math.round((dashboardStats?.projectStatus?.completed / (allTasks.length || 1)) * 100)}% Complete
//                                         </p>
//                                     </div>
//                                 </div>
//                             </div>

//                             {/* Charts Grid */}
//                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                                 <DailyPerformanceChart />
//                                 <WorkTypeDistributionChart />
//                             </div>

//                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//                                 <StatusDistributionChart />
//                                 <TeamPerformanceChart />
//                             </div>
//                         </div>
//                     )}

//                     {/* User Performance Tab */}
//                     {activeTab === 'users' && (
//                         <div className="space-y-8">
//                             <UserPerformanceTable />
//                             {userPerformance.length > 10 && (
//                                 <div className="text-center py-8">
//                                     <p className="text-gray-500">
//                                         Showing top {userPerformance.length} users.
//                                         <button
//                                             onClick={() => setActiveTab('overview')}
//                                             className="text-purple-600 hover:text-purple-700 font-medium ml-1"
//                                         >
//                                             View all metrics →
//                                         </button>
//                                     </p>
//                                 </div>
//                             )}
//                         </div>
//                     )}

//                     {/* Project Analytics Tab */}
//                     {activeTab === 'projects' && (
//                         <div className="space-y-8">
//                             <ProjectPerformanceTable />
//                             {projectPerformance.length > 10 && (
//                                 <div className="text-center py-8">
//                                     <p className="text-gray-500">
//                                         Showing top {projectPerformance.length} projects.
//                                         <button
//                                             onClick={() => setActiveTab('overview')}
//                                             className="text-purple-600 hover:text-purple-700 font-medium ml-1"
//                                         >
//                                             View all metrics →
//                                         </button>
//                                     </p>
//                                 </div>
//                             )}
//                         </div>
//                     )}

//                     {/* Team Performance Tab */}
//                     {activeTab === 'teams' && (
//                         <div className="space-y-8">
//                             <TeamPerformanceChart />
//                             {teamInsights && (
//                                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
//                                     <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                                         Detailed Team Insights: {teamInsights.teamName}
//                                     </h3>
//                                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-blue-600">{teamInsights.employeeCount}</div>
//                                             <div className="text-sm text-gray-500">Team Members</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-green-600">{teamInsights.totalTasks}</div>
//                                             <div className="text-sm text-gray-500">Total Tasks</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-purple-600">{teamInsights.totalHours.toFixed(1)}h</div>
//                                             <div className="text-sm text-gray-500">Total Hours</div>
//                                         </div>
//                                         <div className="text-center">
//                                             <div className="text-2xl font-bold text-orange-600">{teamInsights.projects.total}</div>
//                                             <div className="text-sm text-gray-500">Projects</div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}
//                         </div>
//                     )}
//                 </main>
//             </div>

//             {/* Modals */}
//             {selectedUser && (
//                 <UserDetailModal
//                     user={selectedUser}
//                     onClose={() => setSelectedUser(null)}
//                 />
//             )}

//             {selectedProject && (
//                 <ProjectDetailModal
//                     project={selectedProject}
//                     onClose={() => setSelectedProject(null)}
//                 />
//             )}
//         </div>
//     );
// };

// export default AnalyticsPage;