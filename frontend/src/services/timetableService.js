import api from './api';

export const timetableService = {
  // Get timetable with filters
  getTimetable: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.department_id) params.append('department_id', filters.department_id);
    if (filters.batch) params.append('batch', filters.batch);
    if (filters.day_of_week !== undefined) params.append('day_of_week', filters.day_of_week);
    if (filters.professor_id) params.append('professor_id', filters.professor_id);
    
    const response = await api.get(`/timetable?${params.toString()}`);
    return response.data;
  },

  // Create timetable entry (admin only)
  createEntry: async (data) => {
    const response = await api.post('/timetable', data);
    return response.data;
  },

  // Seed sample timetable (admin only) - uses available classrooms and departments
  seedTimetable: async () => {
    const response = await api.post('/timetable/seed');
    return response.data;
  },

  // Update timetable entry (admin only)
  updateEntry: async (id, data) => {
    const response = await api.put(`/timetable/${id}`, data);
    return response.data;
  },

  // Delete timetable entry (admin only)
  deleteEntry: async (id) => {
    const response = await api.delete(`/timetable/${id}`);
    return response.data;
  },

  // Get available rooms
  getAvailableRooms: async (day_of_week, start_time, end_time) => {
    const response = await api.get('/timetable/available-rooms', {
      params: { day_of_week, start_time, end_time },
    });
    return response.data;
  },

  // Student: Get my timetable
  getMyTimetable: async (day_of_week) => {
    const params = day_of_week !== undefined ? `?day_of_week=${day_of_week}` : '';
    const response = await api.get(`/student/timetable${params}`);
    return response.data;
  },

  // Student: Get today's classes
  getTodayClasses: async () => {
    const response = await api.get('/student/today');
    return response.data;
  },

  // Professor: Get my classes (rescheduled_only: true = only classes that were rescheduled)
  getMyClasses: async (day_of_week, rescheduled_only = false) => {
    const params = new URLSearchParams();
    if (day_of_week !== undefined) params.append('day_of_week', day_of_week);
    if (rescheduled_only) params.append('rescheduled_only', '1');
    const qs = params.toString();
    const response = await api.get(`/professor/my-classes${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  // Professor: Reschedule class
  rescheduleClass: async (id, data) => {
    const response = await api.put(`/professor/reschedule/${id}`, data);
    return response.data;
  },
};
