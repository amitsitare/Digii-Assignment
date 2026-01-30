export const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

// For timetable grid (room × time)
export const WEEKLY_TIME_SLOTS = [
  { start: '09:00', nextStart: '10:00', label: '9:00 - 9:55' },
  { start: '10:00', nextStart: '11:00', label: '10:00 - 10:55' },
  { start: '11:00', nextStart: '12:00', label: '11:00 - 11:55' },
  { start: '12:00', nextStart: '13:00', label: '12:00 - 12:55' },
  { start: '13:00', nextStart: '14:00', label: '1:00 - 1:55' },
  { start: '14:00', nextStart: '15:00', label: '2:00 - 2:55' },
  { start: '15:00', nextStart: '16:00', label: '3:00 - 3:55' },
  { start: '16:00', nextStart: '17:00', label: '4:00 - 4:55' },
];

// 30-min steps for timetable start/end dropdowns (08:00–18:00)
export const TIMETABLE_TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 9; h <= 17; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 18) opts.push(`${String(h).padStart(2, '0')}:30`);
  }
  return opts;
})();

export const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'lab', label: 'Laboratory' },
];

export const USER_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'professor', label: 'Professor' },
  { value: 'student', label: 'Student' },
];

export const MESSAGE_TYPES = [
  { value: 'direct', label: 'Direct Message' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'department', label: 'Department' },
  { value: 'batch', label: 'Batch' },
];

// Batch options for dropdowns (instead of free text)
export const BATCH_OPTIONS = ['2026', '2027', '2028', '2029'];

// Allowed departments - only these can be selected
export const ALLOWED_DEPARTMENTS = [
  { name: 'Computer Science Engineering', code: 'CSE' },
  { name: 'Electronics and Communication', code: 'ECE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Information Technology', code: 'IT' },
];

export const getDayLabel = (dayOfWeek) => {
  const day = DAYS_OF_WEEK.find(d => d.value === dayOfWeek);
  return day ? day.label : '';
};

export const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDeptShort = (name, code) => {
  if (code && typeof code === 'string') return code.split('').join('.');
  if (name && typeof name === 'string') {
    const words = name.split(/\s+/).filter(Boolean);
    return words.map((w) => w[0]).join('.');
  }
  return '—';
};

export const formatProfessorInitials = (firstName, lastName) => {
  const f = firstName && firstName[0] ? firstName[0] : '';
  const l = lastName && lastName[0] ? lastName[0] : '';
  return [f, l].filter(Boolean).join('.') || '—';
};

export const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(dateString);
};
