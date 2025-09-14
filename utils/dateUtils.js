// 📅 Format date for display (e.g., "Jan 15, 2024")
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// 🕒 Format date and time for display (e.g., "Jan 15, 2024, 10:30 AM")
export const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ✅ Validate time format (checks if time is in HH:MM format)
export const isValidTimeFormat = (timeString) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
};

// 📊 Calculate working days between two dates (excluding weekends)
export const calculateWorkingDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;

    while (start <= end) {
        const dayOfWeek = start.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
            count++;
        }
        start.setDate(start.getDate() + 1);
    }

    return count;
};

// 🔄 Convert time spent format (e.g., "8.5" hours to "08:30")
export const hoursToTimeFormat = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// ⏱️ Convert time format to hours (e.g., "08:30" to 8.5 hours)
export const timeFormatToHours = (timeString) => {
    if (!timeString || !isValidTimeFormat(timeString)) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
};

// 📈 Get week number from date
export const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};