import api from './api';

export const adminService = {
  // Add student
  addStudent: async (data) => {
    const response = await api.post('/admin/students', data);
    return response.data;
  },

  // Add professor
  addProfessor: async (data) => {
    const response = await api.post('/admin/professors', data);
    return response.data;
  },

  // Get users
  getUsers: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.department_id) params.append('department_id', filters.department_id);
    if (filters.batch) params.append('batch', filters.batch);
    if (filters.search) params.append('search', filters.search);
    
    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data;
  },

  // Deactivate user
  deactivateUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  // Get departments
  getDepartments: async () => {
    const response = await api.get('/admin/departments');
    return response.data;
  },

  // Add department
  addDepartment: async (data) => {
    const response = await api.post('/admin/departments', data);
    return response.data;
  },

  // Get classrooms
  getClassrooms: async (roomType) => {
    const params = roomType ? `?room_type=${roomType}` : '';
    const response = await api.get(`/admin/classrooms${params}`);
    return response.data;
  },

  // Add classroom
  addClassroom: async (data) => {
    const response = await api.post('/admin/classrooms', data);
    return response.data;
  },

  // Delete classroom
  deleteClassroom: async (classroomId) => {
    const response = await api.delete(`/admin/classrooms/${classroomId}`);
    return response.data;
  },

  // Book auditorium
  bookAuditorium: async (data) => {
    const response = await api.post('/admin/auditorium/book', data);
    return response.data;
  },

  // Get auditorium bookings
  getAuditoriumBookings: async () => {
    const response = await api.get('/admin/auditorium/bookings');
    return response.data;
  },

  // Get stats
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // Upload students CSV
  uploadStudentsCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/students/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload professors CSV
  uploadProfessorsCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/professors/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download students CSV template
  downloadStudentsTemplate: async () => {
    const response = await api.get('/admin/students/template', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Download professors CSV template
  downloadProfessorsTemplate: async () => {
    const response = await api.get('/admin/professors/template', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'professors_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
