import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, Typography, Box, Card, CardContent, Chip,
    Alert, CircularProgress, TextareaAutosize, IconButton
} from '@mui/material';
import {
    CalendarToday, Download, Edit, Save, Close
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    getWeeklyTasks
} from '../lib/firebase';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

const WeeklyReport = ({ open, onClose, userProfile }) => {
    const [weekStart, setWeekStart] = useState(new Date().toISOString().split('T')[0]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [reportText, setReportText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');

    const calculateEndDate = (startDate) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + 6);
        return date.toISOString().split('T')[0];
    };

    const handleGenerateReport = async () => {
        if (!tasks.length) {
            setError('No tasks found for the selected week. Please select a different week.');
            return;
        }

        setGenerating(true);
        setError('');

        try {
            // Summarize data for LLM
            const clients = [...new Set(tasks.map(t => t.clientName).filter(Boolean))];
            const projects = [...new Set(tasks.map(t => t.projectName).filter(Boolean))];

            // Group hours by project
            const projectHours = {};
            tasks.forEach(task => {
                if (task.projectName && task.timeSpent) {
                    const hours = parseFloat(task.timeSpent) || 0;
                    projectHours[task.projectName] = (projectHours[task.projectName] || 0) + hours;
                }
            });

            // Activities summary
            const activities = tasks.map(task => ({
                date: task.date,
                description: task.taskDescription,
                project: task.projectName,
                client: task.clientName,
                hours: task.timeSpent,
                status: task.status
            }));

            const prompt = `
            Generate a professional weekly report based on the following data for employee ${userProfile.empName} (${userProfile.empId}):

            Week: ${weekStart} to ${calculateEndDate(weekStart)}

            Activities:
            ${JSON.stringify(activities, null, 2)}

            Clients worked with: ${clients.join(', ') || 'None'}

            Projects: ${projects.join(', ') || 'None'}

            Hours per project:
            ${Object.entries(projectHours).map(([proj, hrs]) => `- ${proj}: ${hrs} hours`).join('\n') || 'None'}

            Make it concise, professional, and narrative. Structure as:
            - Introduction (week summary)
            - Key Activities
            - Clients and Projects
            - Time Investment
            - Conclusion
            `;

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const generatedText = await result.response.text();

            setReportText(generatedText);
            setEditing(true);
        } catch (err) {
            setError('Error generating report: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveEdits = () => {
        setEditing(false);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Weekly Task Report', 20, 20);
        doc.setFontSize(12);
        doc.text(`Employee: ${userProfile.empName} (${userProfile.empId})`, 20, 35);
        doc.text(`Week: ${weekStart} - ${calculateEndDate(weekStart)}`, 20, 45);

        // Split text into lines
        const splitText = doc.splitTextToSize(reportText, 170);
        doc.text(splitText, 20, 60);

        const filename = `Weekly_Report_${userProfile.empId}_${weekStart}.pdf`;
        doc.save(filename);
    };

    const handleLoadTasks = async () => {
        setLoading(true);
        setError('');
        try {
            const endDate = calculateEndDate(weekStart);
            const weeklyTasks = await getWeeklyTasks(userProfile, weekStart, endDate);
            setTasks(weeklyTasks);

            if (weeklyTasks.length === 0) {
                setError('No tasks found for this week.');
            }
        } catch (err) {
            setError('Error loading tasks: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleWeekChange = (e) => {
        setWeekStart(e.target.value);
        setTasks([]);
        setReportText('');
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Generate Weekly Report</Typography>
                    <IconButton onClick={onClose}><Close /></IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        label="Week Start Date"
                        type="date"
                        value={weekStart}
                        onChange={handleWeekChange}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2 }}
                    />
                    <Button
                        variant="outlined"
                        startIcon={<CalendarToday />}
                        onClick={handleLoadTasks}
                        disabled={loading}
                        fullWidth
                    >
                        {loading ? <CircularProgress size={20} /> : 'Load Tasks for Week'}
                    </Button>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {tasks.length > 0 && (
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="subtitle1" gutterBottom>Summary</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                <Chip label={`Tasks: ${tasks.length}`} color="primary" />
                                <Chip label={`Projects: ${new Set(tasks.map(t => t.projectName)).size}`} color="secondary" />
                                <Chip label={`Clients: ${new Set(tasks.map(t => t.clientName)).size}`} color="info" />
                                <Chip label={`Total Hours: ${tasks.reduce((sum, t) => sum + (parseFloat(t.timeSpent) || 0), 0).toFixed(1)}`} color="success" />
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {tasks.length > 0 && !generating && (
                    <Button
                        variant="contained"
                        startIcon={<Edit />}
                        onClick={handleGenerateReport}
                        fullWidth
                        sx={{ mb: 3 }}
                    >
                        Generate Report with AI
                    </Button>
                )}

                {generating && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Generating report...</Typography>
                    </Box>
                )}

                {reportText && (
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">Report Preview</Typography>
                                {editing ? (
                                    <Button startIcon={<Save />} onClick={handleSaveEdits} size="small">
                                        Save Edits
                                    </Button>
                                ) : (
                                    <Button startIcon={<Edit />} onClick={() => setEditing(true)} size="small">
                                        Edit
                                    </Button>
                                )}
                            </Box>
                            {editing ? (
                                <TextareaAutosize
                                    minRows={10}
                                    style={{ width: '100%', padding: 12, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
                                    value={reportText}
                                    onChange={(e) => setReportText(e.target.value)}
                                />
                            ) : (
                                <Box sx={{ whiteSpace: 'pre-wrap', p: 2, bgcolor: 'grey.50', borderRadius: 1, minHeight: 200 }}>
                                    {reportText}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                )}
            </DialogContent>
            <DialogActions>
                {reportText && (
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        onClick={handleDownloadPDF}
                        disabled={!reportText.trim()}
                    >
                        Download PDF
                    </Button>
                )}
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default WeeklyReport;