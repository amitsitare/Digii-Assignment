import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Modal, Alert } from 'react-bootstrap';
import Sidebar from '../components/common/Sidebar';
import TimetableCalendar from '../components/TimetableCalendar';
import { useLocation } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { timetableService } from '../services/timetableService';
import { DAYS_OF_WEEK, formatTime, formatDate, getDayLabel, ALLOWED_DEPARTMENTS, BATCH_OPTIONS, TIMETABLE_TIME_OPTIONS } from '../utils/constants';

const AdminDashboard = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [stats, setStats] = useState({
    total_students: 0,
    total_professors: 0,
    total_classes: 0,
    total_departments: 0,
  });
  const [timetable, setTimetable] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [auditoriumBookings, setAuditoriumBookings] = useState([]);
  const [filters, setFilters] = useState({
    department_id: '',
    batch: '',
    day_of_week: '',
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [professors, setProfessors] = useState([]);
  const [csvUploadType, setCsvUploadType] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploadResults, setCsvUploadResults] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ timetable_date: '', start_time: '', end_time: '', classroom_id: '' });

  // Filters for various sections
  const [studentFilters, setStudentFilters] = useState({
    department_id: '',
    batch: '',
  });
  const [studentSortBy, setStudentSortBy] = useState('department');

  const [professorFilters, setProfessorFilters] = useState({
    department_id: '',
  });
  const [professorSortBy, setProfessorSortBy] = useState('department');

  const [timetableSortBy] = useState('department_batch');

  // Selected date for timetable view (YYYY-MM-DD). When on timetable page, day_of_week is derived from this.
  const getTodayDateStr = () => {
    const t = new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  const [timetableSelectedDate, setTimetableSelectedDate] = useState(getTodayDateStr);
  const [todayTimetable, setTodayTimetable] = useState([]);

  const fetchTimetable = useCallback(async () => {
    try {
      const data = await timetableService.getTimetable(filters);
      setTimetable(data.timetable);
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  // When on Manage Timetable page, sync day_of_week filter from selected date (0=Mon .. 6=Sun)
  useEffect(() => {
    if (currentPath.startsWith('/admin/timetable') && timetableSelectedDate) {
      const d = new Date(timetableSelectedDate + 'T12:00:00');
      const dayOfWeek = (d.getDay() + 6) % 7;
      setFilters((prev) => ({ ...prev, day_of_week: dayOfWeek }));
    }
  }, [currentPath, timetableSelectedDate]);

  // Fetch today's timetable for dashboard home
  useEffect(() => {
    if (currentPath !== '/admin') return;
    const dayOfWeek = (new Date().getDay() + 6) % 7;
    timetableService.getTimetable({ day_of_week: dayOfWeek })
      .then((data) => setTodayTimetable(data.timetable || []))
      .catch((err) => console.error('Failed to fetch today timetable:', err));
  }, [currentPath]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const requests = [
      { key: 'stats', fn: () => adminService.getStats() },
      { key: 'departments', fn: () => adminService.getDepartments() },
      { key: 'classrooms', fn: () => adminService.getClassrooms() },
      { key: 'professors', fn: () => adminService.getUsers({ role: 'professor' }) },
      { key: 'students', fn: () => adminService.getUsers({ role: 'student' }) },
      { key: 'auditorium', fn: () => adminService.getAuditoriumBookings() },
    ];
    const results = await Promise.allSettled(requests.map((r) => r.fn()));
    const failures = [];
    results.forEach((result, i) => {
      const { key } = requests[i];
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (key === 'stats') setStats(data);
        else if (key === 'departments') setDepartments(data.departments || []);
        else if (key === 'classrooms') setClassrooms(data.classrooms || []);
        else if (key === 'professors') setProfessors(data.users || []);
        else if (key === 'students') setStudents(data.users || []);
        else if (key === 'auditorium') setAuditoriumBookings(data.bookings || []);
      } else {
        console.error(`Admin fetch failed (${key}):`, result.reason);
        failures.push(key);
      }
    });
    if (failures.length > 0) {
      setError(`Could not load: ${failures.join(', ')}. Check console or try again.`);
    }
    setLoading(false);
  };

  // Filter departments to only show allowed ones (by matching code)
  const allowedDepartments = useMemo(() => {
    const allowedCodes = ALLOWED_DEPARTMENTS.map(d => d.code);
    return departments.filter(dept => allowedCodes.includes(dept.code));
  }, [departments]);

  // For Add Timetable: only regular classrooms (exclude auditorium/lab)
  const timetableClassrooms = useMemo(
    () => classrooms.filter(c => c.room_type === 'classroom'),
    [classrooms]
  );

  const handleStudentFilterChange = (e) => {
    setStudentFilters({
      ...studentFilters,
      [e.target.name]: e.target.value,
    });
  };

  const handleProfessorFilterChange = (e) => {
    setProfessorFilters({
      ...professorFilters,
      [e.target.name]: e.target.value,
    });
  };

  const openModal = (type, data = {}) => {
    setModalType(type);
    setFormData(data);
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const next = { ...formData, [e.target.name]: e.target.value };
    if (modalType === 'timetable' && e.target.name === 'department_id') {
      next.professor_id = '';
    }
    setFormData(next);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    try {
      if (modalType === 'student') {
        await adminService.addStudent(formData);
        setSuccess('Student added successfully! Credentials sent via email.');
        fetchData();
      } else if (modalType === 'professor') {
        await adminService.addProfessor(formData);
        setSuccess('Professor added successfully! Credentials sent via email.');
        fetchData();
      } else if (modalType === 'timetable') {
        const { department_id, batch, classroom_id, professor_id, subject, timetable_date, start_time, end_time } = formData;
        if (!department_id || !batch || !classroom_id || !professor_id || !subject || !timetable_date || !start_time || !end_time) {
          setError('Please fill all required fields (Subject, Department, Batch, Professor, Date, Start time, End time, Classroom).');
          return;
        }
        if (end_time <= start_time) {
          setError('End time must be after start time.');
          return;
        }
        const dayOfWeek = (new Date(formData.timetable_date + 'T12:00:00').getDay() + 6) % 7;
        await timetableService.createEntry({
          ...formData,
          day_of_week: dayOfWeek,
          department_id: parseInt(formData.department_id),
          classroom_id: parseInt(formData.classroom_id),
          professor_id: parseInt(formData.professor_id),
        });
        setSuccess('Timetable entry created successfully!');
        fetchTimetable();
        fetchData();
      } else if (modalType === 'auditorium') {
        if (!formData.classroom_id || !formData.event_name || !formData.booking_date || !formData.start_time || !formData.end_time) {
          setError('All fields are required');
          return;
        }
        await adminService.bookAuditorium({
          classroom_id: parseInt(formData.classroom_id, 10),
          event_name: formData.event_name,
          booking_date: formData.booking_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
        });
        setSuccess('Auditorium booked successfully!');
        const updated = await adminService.getAuditoriumBookings();
        setAuditoriumBookings(updated.bookings || []);
      } else if (modalType === 'classroom') {
        if (!formData.room_no) {
          setError('Room number is required');
          return;
        }
        await adminService.addClassroom({
          room_no: formData.room_no,
          capacity: formData.capacity,
          room_type: formData.room_type || 'classroom',
        });
        const updated = await adminService.getClassrooms();
        setClassrooms(updated.classrooms);
        setSuccess('Classroom added successfully');
      } else if (modalType === 'csv-upload') {
        if (!csvFile) {
          setError('Please select a CSV file');
          return;
        }
        if (!csvUploadType) {
          setError('Please select upload type (Students or Professors)');
          return;
        }
        
        let result;
        if (csvUploadType === 'students') {
          result = await adminService.uploadStudentsCSV(csvFile);
        } else {
          result = await adminService.uploadProfessorsCSV(csvFile);
        }
        
        setCsvUploadResults(result.results);
        setSuccess(result.message);
        fetchData();
        
        // Reset file after successful upload
        setTimeout(() => {
          setCsvFile(null);
          setCsvUploadType('');
        }, 3000);
      }
      
      if (modalType !== 'csv-upload') {
        setTimeout(() => {
          setShowModal(false);
          setFormData({});
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
      if (modalType === 'csv-upload' && err.response?.data?.results) {
        setCsvUploadResults(err.response.data.results);
      }
    }
  };

  const handleDownloadStudentsTemplate = async () => {
    try {
      await adminService.downloadStudentsTemplate();
    } catch (err) {
      alert('Failed to download template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDownloadProfessorsTemplate = async () => {
    try {
      await adminService.downloadProfessorsTemplate();
    } catch (err) {
      alert('Failed to download template: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setCsvFile(file);
      setError('');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await timetableService.deleteEntry(id);
      setShowModal(false);
      setFormData({});
      setRescheduleForm({ timetable_date: '', start_time: '', end_time: '', classroom_id: '' });
      fetchTimetable();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleReschedule = async () => {
    const entry = formData;
    if (!entry?.id) return;
    const { timetable_date, start_time, end_time, classroom_id } = rescheduleForm;
    if (!timetable_date || !start_time || !end_time || !classroom_id) {
      setError('Please fill Date, Start time, End time and Room for reschedule.');
      return;
    }
    if (end_time <= start_time) {
      setError('End time must be after start time.');
      return;
    }
    setError('');
    try {
      const dayOfWeek = (new Date(timetable_date + 'T12:00:00').getDay() + 6) % 7;
      await timetableService.updateEntry(entry.id, { day_of_week: dayOfWeek, start_time, end_time, classroom_id: parseInt(classroom_id, 10) });
      setSuccess('Class rescheduled successfully.');
      setShowModal(false);
      setFormData({});
      setRescheduleForm({ timetable_date: '', start_time: '', end_time: '', classroom_id: '' });
      fetchTimetable();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reschedule');
    }
  };

  const openTimetableEntryDetail = (entry) => {
    setError('');
    setSuccess('');
    setModalType('timetable-entry-detail');
    setFormData(entry);
    setRescheduleForm({
      timetable_date: timetableSelectedDate || (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })(),
      start_time: entry.start_time?.slice?.(0, 5) || entry.start_time || '',
      end_time: entry.end_time?.slice?.(0, 5) || entry.end_time || '',
      classroom_id: entry.classroom_id ?? '',
    });
    setShowModal(true);
  };


  const handleDeleteClassroom = async (id) => {
    if (!window.confirm('Are you sure you want to delete this classroom permanently?')) return;

    try {
      await adminService.deleteClassroom(id);
      const updated = await adminService.getClassrooms();
      setClassrooms(updated.classrooms);
      setSuccess('Classroom deleted successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete classroom');
    }
  };

  // Note: classroom add handled via modal in handleSubmit

  const sortedStudents = useMemo(() => {
    let data = [...students];
    if (studentFilters.department_id) {
      data = data.filter(s => String(s.department_id) === String(studentFilters.department_id));
    }
    if (studentFilters.batch) {
      data = data.filter(s => String(s.batch) === String(studentFilters.batch));
    }
    data.sort((a, b) => {
      if (studentSortBy === 'batch') {
        return String(a.batch || '').localeCompare(String(b.batch || ''));
      }
      // default: department
      return String(a.department_name || '').localeCompare(String(b.department_name || ''));
    });
    return data;
  }, [students, studentFilters, studentSortBy]);

  const sortedProfessors = useMemo(() => {
    let data = [...professors];
    if (professorFilters.department_id) {
      data = data.filter(p => String(p.department_id) === String(professorFilters.department_id));
    }
    data.sort((a, b) => {
      if (professorSortBy === 'department') {
        return String(a.department_name || '').localeCompare(String(b.department_name || ''));
      }
      return String(a.first_name || '').localeCompare(String(b.first_name || ''));
    });
    return data;
  }, [professors, professorFilters, professorSortBy]);

  const sortedTimetable = useMemo(() => {
    let data = [...timetable];
    if (timetableSortBy === 'department_batch') {
      data.sort((a, b) => {
        const keyA = `${a.department_code || ''}-${a.batch || ''}`;
        const keyB = `${b.department_code || ''}-${b.batch || ''}`;
        return keyA.localeCompare(keyB);
      });
    }
    return data;
  }, [timetable, timetableSortBy]);

  const filteredTimetableForView = useMemo(() => {
    let data = [...sortedTimetable];
    if (filters.department_id) data = data.filter(e => String(e.department_id) === String(filters.department_id));
    if (filters.batch) data = data.filter(e => String(e.batch) === String(filters.batch));
    if (filters.day_of_week !== undefined && filters.day_of_week !== '') data = data.filter(e => e.day_of_week === parseInt(filters.day_of_week, 10));
    return data;
  }, [sortedTimetable, filters.department_id, filters.batch, filters.day_of_week]);

  // Short labels for timetable blocks: dept code as C.S.E, professor as J.S
  const formatDeptShort = (name, code) => {
    if (code && typeof code === 'string') return code.split('').join('.');
    if (name && typeof name === 'string') {
      const words = name.split(/\s+/).filter(Boolean);
      return words.map((w) => w[0]).join('.');
    }
    return '—';
  };
  const formatProfessorInitials = (firstName, lastName) => {
    const f = firstName && firstName[0] ? firstName[0] : '';
    const l = lastName && lastName[0] ? lastName[0] : '';
    return [f, l].filter(Boolean).join('.') || '—';
  };

  const WEEKLY_TIME_SLOTS = [
    { start: '09:00', nextStart: '10:00', label: '9:00 - 9:55' },
    { start: '10:00', nextStart: '11:00', label: '10:00 - 10:55' },
    { start: '11:00', nextStart: '12:00', label: '11:00 - 11:55' },
    { start: '12:00', nextStart: '13:00', label: '12:00 - 12:55' },
    { start: '13:00', nextStart: '14:00', label: '1:00 - 1:55' },
    { start: '14:00', nextStart: '15:00', label: '2:00 - 2:55' },
    { start: '15:00', nextStart: '16:00', label: '3:00 - 3:55' },
    { start: '16:00', nextStart: '17:00', label: '4:00 - 4:55' },
  ];

  const renderDashboardHome = () => (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-0">Admin Dashboard</h2>
        </Col>
        <Col className="text-end">
          <div className="d-flex justify-content-end gap-2 flex-wrap">
            <Button
              variant="outline-success"
              size="sm"
              onClick={handleDownloadStudentsTemplate}
            >
              Students Template
            </Button>
            <Button
              variant="outline-success"
              size="sm"
              onClick={handleDownloadProfessorsTemplate}
            >
              Professors Template
            </Button>
          </div>
        </Col>
      </Row>

      <Row className="g-3 mb-4 stat-cards-row">
        <Col xs={6} md={3}>
          <Card className="stat-card stat-card--students">
            <h3>{stats.total_students}</h3>
            <p>Total Students</p>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="stat-card stat-card--professors">
            <h3>{stats.total_professors}</h3>
            <p>Total Professors</p>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="stat-card stat-card--classrooms">
            <h3>{classrooms.filter((c) => c.room_type === 'classroom').length}</h3>
            <p>Classrooms</p>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="stat-card stat-card--departments">
            <h3>{stats.total_departments}</h3>
            <p>Departments</p>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              className="btn-primary-gradient"
              onClick={() => openModal('student')}
            >
              Add Student
            </Button>
            <Button
              className="btn-primary-gradient"
              onClick={() => openModal('professor')}
            >
              Add Professor
            </Button>
            <Button
              className="btn-primary-gradient"
onClick={() => {
                const today = new Date();
                const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                openModal('timetable', { timetable_date: dateStr });
              }}
            >
              Add Class
            </Button>
            <Button
              className="btn-primary-gradient"
              onClick={() => openModal('timetable', { timetable_date: getTodayDateStr() })}
            >
              Add Timetable Entry
            </Button>
            <Button
              variant="outline-primary"
              onClick={() => openModal('csv-upload')}
            >
              Upload CSV
            </Button>
          </div>
        </Col>
      </Row>

      <Card className="feature-card">
        <Card.Body>
          <h5 className="mb-3">Today&apos;s Timetable</h5>
          <p className="text-muted small mb-3">
            Room-wise schedule for {formatDate(getTodayDateStr())}
          </p>
          <div className="table-responsive timetable-room-grid-wrapper">
            <Table bordered className="mb-0 timetable-room-grid">
              <thead>
                <tr>
                  <th className="timetable-room-col bg-light">Room</th>
                  {WEEKLY_TIME_SLOTS.map((slot) => (
                    <th key={slot.start} className="text-center timetable-slot-col">
                      {slot.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classrooms.map((room) => (
                  <tr key={room.id}>
                    <td className="bg-light fw-medium timetable-room-col">
                      {room.room_no}
                    </td>
                    {WEEKLY_TIME_SLOTS.map((slot) => {
                      const normTimeToday = (t) => (t && typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : t);
                      const entries = todayTimetable.filter((entry) => {
                        const roomMatch = Number(entry.classroom_id) === Number(room.id);
                        const start = normTimeToday(entry.start_time);
                        const inSlot = start >= slot.start && start < slot.nextStart;
                        return roomMatch && inSlot;
                      });
                      return (
                        <td key={slot.start} className="timetable-room-cell p-2" style={{ verticalAlign: 'top' }}>
                          {entries.length === 0 ? (
                            <span className="text-muted small">—</span>
                          ) : (
                            entries.map((entry) => (
                              <div
                                key={entry.id}
                                className="timetable-room-block border rounded p-2 mb-1 small bg-white"
                                style={{ borderLeft: '3px solid var(--bs-primary)' }}
                              >
                                <div className="fw-semibold text-primary">{formatDeptShort(entry.department_name, entry.department_code)}</div>
                                {entry.batch && <span className="text-muted">{entry.batch}</span>}
                                <div className="text-muted mt-1">{entry.subject}</div>
                                {(entry.professor_first_name != null || entry.professor_last_name != null) && (
                                  <div className="text-muted small mt-1">{formatProfessorInitials(entry.professor_first_name, entry.professor_last_name)}</div>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {todayTimetable.length === 0 && (
            <p className="text-center text-muted mt-3 mb-0 small">
              No classes scheduled for today.
            </p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );

  const renderStudentsPage = () => (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-0">Students</h2>
          <small className="text-muted">All registered students across departments and batches</small>
        </Col>
        <Col className="text-end">
          <Button className="btn-primary-gradient" onClick={() => openModal('student')}>
            Add Student
          </Button>
        </Col>
      </Row>

      <Card className="feature-card">
        <Card.Body>
          <Row className="mb-3">
            <Col md={3}>
              <Form.Select
                name="department_id"
                value={studentFilters.department_id}
                onChange={handleStudentFilterChange}
              >
                <option value="">All Departments</option>
                {allowedDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                name="batch"
                value={studentFilters.batch}
                onChange={handleStudentFilterChange}
              >
                <option value="">All Batches</option>
                {BATCH_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={studentSortBy}
                onChange={e => setStudentSortBy(e.target.value)}
              >
                <option value="department">Sort by Department</option>
                <option value="batch">Sort by Batch</option>
              </Form.Select>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table className="table-custom">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Batch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-4">
                      No students found
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map(s => (
                    <tr key={s.id}>
                      <td>{s.first_name} {s.last_name}</td>
                      <td>{s.email}</td>
                      <td>{s.department_name || '-'}</td>
                      <td>{s.batch || '-'}</td>
                      <td>{s.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );

  const renderProfessorsPage = () => (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-0">Professors</h2>
          <small className="text-muted">All professors with department-wise sorting</small>
        </Col>
        <Col className="text-end">
          <Button className="btn-primary-gradient" onClick={() => openModal('professor')}>
            Add Professor
          </Button>
        </Col>
      </Row>

      <Card className="feature-card">
        <Card.Body>
          <Row className="mb-3">
            <Col md={3}>
              <Form.Select
                name="department_id"
                value={professorFilters.department_id}
                onChange={handleProfessorFilterChange}
              >
                <option value="">All Departments</option>
                {allowedDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={professorSortBy}
                onChange={e => setProfessorSortBy(e.target.value)}
              >
                <option value="department">Sort by Department</option>
                <option value="name">Sort by Name</option>
              </Form.Select>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table className="table-custom">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedProfessors.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">
                      No professors found
                    </td>
                  </tr>
                ) : (
                  sortedProfessors.map(p => (
                    <tr key={p.id}>
                      <td>{p.first_name} {p.last_name}</td>
                      <td>{p.email}</td>
                      <td>{p.department_name || '-'}</td>
                      <td>{p.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );

  const renderTimetablePage = () => {
    const filteredTimetable = filteredTimetableForView;
    const normTime = (t) => (t && typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : t);
    // Rows = rooms, Columns = time slots. Cell = entries for that room at that time on selected day.
    const getEntriesForRoomSlot = (classroomId, slotStart, nextSlotStart) =>
      filteredTimetable.filter((entry) => {
        const roomMatch = Number(entry.classroom_id) === Number(classroomId);
        const start = normTime(entry.start_time);
        const inSlot = start >= slotStart && start < nextSlotStart;
        return roomMatch && inSlot;
      });

    const dayLabel = timetableSelectedDate
      ? formatDate(timetableSelectedDate)
      : (DAYS_OF_WEEK.find((d) => d.value === parseInt(filters.day_of_week, 10))?.label || 'Select date');

    return (
      <Container fluid>
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="mb-0">Manage Timetable</h2>
            <small className="text-muted">
              Room availability for <strong>{dayLabel}</strong> — select a date in the calendar
            </small>
          </Col>
          <Col className="text-end">
            <Button className="btn-primary-gradient" onClick={() => openModal('timetable', { timetable_date: timetableSelectedDate })}>
              Add Timetable Entry
            </Button>
          </Col>
        </Row>

        <Card className="feature-card">
          <Card.Body>
            <div className="table-responsive timetable-room-grid-wrapper">
              <Table bordered className="mb-0 timetable-room-grid">
                <thead>
                  <tr>
                    <th className="timetable-room-col bg-light">Room</th>
                    {WEEKLY_TIME_SLOTS.map((slot) => (
                      <th key={slot.start} className="text-center timetable-slot-col">
                        {slot.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classrooms.map((room) => (
                    <tr key={room.id}>
                      <td className="bg-light fw-medium timetable-room-col">
                        {room.room_no}
                      </td>
                      {WEEKLY_TIME_SLOTS.map((slot) => {
                        const entries = getEntriesForRoomSlot(room.id, slot.start, slot.nextStart);
                        return (
                          <td key={slot.start} className="timetable-room-cell p-2" style={{ verticalAlign: 'top' }}>
                            {entries.length === 0 ? (
                              <span className="text-muted small">—</span>
                            ) : (
                              entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  role="button"
                                  tabIndex={0}
                                  className="timetable-room-block border rounded p-2 mb-1 small bg-white timetable-room-block-clickable"
                                  style={{ borderLeft: '3px solid var(--bs-primary)' }}
                                  onClick={() => openTimetableEntryDetail(entry)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTimetableEntryDetail(entry); } }}
                                >
                                  <div className="fw-semibold text-primary">{formatDeptShort(entry.department_name, entry.department_code)}</div>
                                  {entry.batch && <span className="text-muted">{entry.batch}</span>}
                                  <div className="text-muted mt-1">{entry.subject}</div>
                                  {(entry.professor_first_name != null || entry.professor_last_name != null) && (
                                    <div className="text-muted small mt-1">{formatProfessorInitials(entry.professor_first_name, entry.professor_last_name)}</div>
                                  )}
                                </div>
                              ))
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {filteredTimetable.length === 0 && (
              <p className="text-center text-muted mt-3 mb-0">
                No classes for this day. Use the calendar to pick a date or &quot;Add Timetable Entry&quot; to add classes.
              </p>
            )}
          </Card.Body>
        </Card>
      </Container>
    );
  };

  const renderAuditoriumPage = () => {
    return (
      <Container fluid>
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="mb-0">Auditorium Bookings</h2>
            <small className="text-muted">All confirmed auditorium booking details</small>
          </Col>
          <Col className="text-end">
            <Button className="btn-primary-gradient" onClick={() => openModal('auditorium')}>
              Book Auditorium
            </Button>
          </Col>
        </Row>

        <Card className="feature-card">
          <Card.Body>
            <div className="table-responsive">
              <Table className="table-custom">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Booked By</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriumBookings.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No bookings found
                      </td>
                    </tr>
                  ) : (
                    auditoriumBookings.map(b => (
                      <tr key={b.id}>
                        <td>{b.room_no}</td>
                        <td>{b.event_name}</td>
                        <td>{b.booking_date}</td>
                        <td>{formatTime(b.start_time)} - {formatTime(b.end_time)}</td>
                        <td>{b.first_name} {b.last_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  };

  const renderDepartmentsPage = () => (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-0">Departments</h2>
        </Col>
      </Row>

      <Card className="feature-card">
        <Card.Body>
          <div className="table-responsive">
            <Table className="table-custom">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="text-center text-muted py-4">
                      No departments found
                    </td>
                  </tr>
                ) : (
                  departments.map(d => (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>{d.code}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );

  const renderClassroomsPage = () => {
    const totalClassrooms = classrooms.length;

    return (
      <Container fluid>
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="mb-0">Classrooms</h2>
            <small className="text-muted">
              Total classrooms available: {totalClassrooms}
            </small>
          </Col>
          <Col className="text-end">
            <Button className="btn-primary-gradient" onClick={() => openModal('classroom')}>
              Add Classroom
            </Button>
          </Col>
        </Row>

        <Card className="feature-card">
          <Card.Body>
            <h5 className="mb-3">Classroom List</h5>
            <div className="table-responsive">
              <Table className="table-custom">
                <thead>
                  <tr>
                    <th>Room No</th>
                    <th>Capacity</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No classrooms found
                      </td>
                    </tr>
                  ) : (
                    classrooms.map(c => (
                      <tr key={c.id}>
                        <td>{c.room_no}</td>
                        <td>{c.capacity || '-'}</td>
                        <td>{c.room_type}</td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteClassroom(c.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="dashboard-content">
          <div className="loading-spinner">Loading...</div>
        </div>
      );
    }

    let pageContent;
    if (currentPath.startsWith('/admin/students')) {
      pageContent = renderStudentsPage();
    } else if (currentPath.startsWith('/admin/professors')) {
      pageContent = renderProfessorsPage();
    } else if (currentPath.startsWith('/admin/timetable')) {
      pageContent = renderTimetablePage();
    } else if (currentPath.startsWith('/admin/auditorium')) {
      pageContent = renderAuditoriumPage();
    } else if (currentPath.startsWith('/admin/departments')) {
      pageContent = renderDepartmentsPage();
    } else if (currentPath.startsWith('/admin/classrooms')) {
      pageContent = renderClassroomsPage();
    } else {
      pageContent = renderDashboardHome();
    }

    return (
      <div className="dashboard-content">
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-3">
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess('')} className="mb-3">
            {success}
          </Alert>
        )}
        {pageContent}
      </div>
    );
  };

  const isTimetablePage = currentPath.startsWith('/admin/timetable');

  return (
    <div className="dashboard-container">
      {isTimetablePage ? (
        <TimetableCalendar
          selectedDate={timetableSelectedDate}
          onSelectDate={setTimetableSelectedDate}
        />
      ) : (
        <Sidebar />
      )}
      {renderContent()}

      {/* Modal for Adding */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalType === 'student' && 'Add Student'}
            {modalType === 'professor' && 'Add Professor'}
            {modalType === 'timetable' && 'Add Timetable Entry'}
            {modalType === 'timetable-entry-detail' && 'Class Details'}
            {modalType === 'auditorium' && 'Book Auditorium'}
            {modalType === 'classroom' && 'Add Classroom'}
            {modalType === 'csv-upload' && 'Upload CSV File'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          {(modalType === 'student' || modalType === 'professor') && (
            <Form>
              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleFormChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleFormChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select
                  name="department_id"
                  value={formData.department_id || ''}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Department</option>
                  {allowedDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              {modalType === 'student' && (
                <Form.Group className="mb-3">
                  <Form.Label>Batch</Form.Label>
                  <Form.Select
                    name="batch"
                    value={formData.batch || ''}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select Batch</option>
                    {BATCH_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}
            </Form>
          )}

          {modalType === 'auditorium' && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Auditorium</Form.Label>
                <Form.Select
                  name="classroom_id"
                  value={formData.classroom_id || ''}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Auditorium</option>
                  {classrooms
                    .filter(c => c.room_type === 'auditorium')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.room_no}
                      </option>
                    ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Event Name</Form.Label>
                <Form.Control
                  type="text"
                  name="event_name"
                  placeholder="Event name"
                  value={formData.event_name || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  name="booking_date"
                  value={formData.booking_date || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Time</Form.Label>
                    <Form.Control
                      type="time"
                      name="start_time"
                      value={formData.start_time || ''}
                      onChange={handleFormChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>End Time</Form.Label>
                    <Form.Control
                      type="time"
                      name="end_time"
                      value={formData.end_time || ''}
                      onChange={handleFormChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          )}

          {modalType === 'classroom' && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Room Number</Form.Label>
                <Form.Control
                  type="text"
                  name="room_no"
                  placeholder="Room No"
                  value={formData.room_no || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Capacity</Form.Label>
                <Form.Control
                  type="number"
                  name="capacity"
                  placeholder="Capacity"
                  value={formData.capacity || ''}
                  onChange={handleFormChange}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Room Type</Form.Label>
                <Form.Select
                  name="room_type"
                  value={formData.room_type || 'classroom'}
                  onChange={handleFormChange}
                >
                  <option value="classroom">Classroom</option>
                  <option value="auditorium">Auditorium</option>
                </Form.Select>
              </Form.Group>
            </Form>
          )}

          {modalType === 'csv-upload' && (
            <div>
              <Alert variant="info" className="mb-3">
                <strong>Instructions:</strong>
                <ul className="mb-0 mt-2">
                  <li>Download the appropriate CSV template using the buttons above</li>
                  <li>Fill in the required information</li>
                  <li>Select the upload type and choose your CSV file</li>
                  <li>Click Upload to process the file</li>
                </ul>
              </Alert>
              
              <Form.Group className="mb-3">
                <Form.Label>Upload Type</Form.Label>
                <Form.Select
                  value={csvUploadType}
                  onChange={(e) => {
                    setCsvUploadType(e.target.value);
                    setCsvFile(null);
                    setError('');
                    setCsvUploadResults(null);
                  }}
                  required
                >
                  <option value="">Select Upload Type</option>
                  <option value="students">Students</option>
                  <option value="professors">Professors</option>
                </Form.Select>
              </Form.Group>

              {csvUploadType && (
                <Form.Group className="mb-3">
                  <Form.Label>CSV File</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    required
                  />
                  {csvFile && (
                    <Form.Text className="text-muted">
                      Selected: {csvFile.name}
                    </Form.Text>
                  )}
                </Form.Group>
              )}

              {csvUploadResults && (
                <div className="mt-3">
                  <h6>Upload Results:</h6>
                  <Alert variant={csvUploadResults.errors.length === 0 ? 'success' : 'warning'}>
                    <strong>Total:</strong> {csvUploadResults.total} rows<br />
                    <strong>Successful:</strong> {csvUploadResults.success.length}<br />
                    <strong>Errors:</strong> {csvUploadResults.errors.length}
                  </Alert>
                  
                  {csvUploadResults.errors.length > 0 && (
                    <div className="mt-3">
                      <h6>Errors:</h6>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <Table striped bordered size="sm">
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Email</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvUploadResults.errors.map((err, idx) => (
                              <tr key={idx}>
                                <td>{err.row}</td>
                                <td>{err.email}</td>
                                <td className="text-danger">{err.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {modalType === 'timetable-entry-detail' && formData?.id && (
            <>
              <div className="mb-4">
                <h6 className="text-muted mb-3">Details</h6>
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr><td className="text-muted">Subject</td><td>{formData.subject}</td></tr>
                    <tr><td className="text-muted">Department</td><td>{formData.department_name || formData.department_code}</td></tr>
                    <tr><td className="text-muted">Batch</td><td>{formData.batch}</td></tr>
                    <tr><td className="text-muted">Professor</td><td>{formData.professor_first_name} {formData.professor_last_name}</td></tr>
                    <tr><td className="text-muted">Day</td><td>{getDayLabel(formData.day_of_week)}</td></tr>
                    <tr><td className="text-muted">Time</td><td>{formatTime(formData.start_time)} – {formatTime(formData.end_time)}</td></tr>
                    <tr><td className="text-muted">Room</td><td>{formData.room_no}</td></tr>
                  </tbody>
                </table>
              </div>
              <hr />
              <h6 className="text-muted mb-3">Reschedule (pick another day when room is available)</h6>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>New Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={rescheduleForm.timetable_date || ''}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, timetable_date: e.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Room</Form.Label>
                      <Form.Select
                        value={rescheduleForm.classroom_id ?? ''}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, classroom_id: e.target.value }))}
                      >
                        <option value="">Select Room</option>
                        {timetableClassrooms.map(c => (
                          <option key={c.id} value={c.id}>{c.room_no}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Start Time</Form.Label>
                      <Form.Select
                        value={rescheduleForm.start_time || ''}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                      >
                        <option value="">Select</option>
                        {TIMETABLE_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>End Time</Form.Label>
                      <Form.Select
                        value={rescheduleForm.end_time || ''}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                      >
                        <option value="">Select</option>
                        {TIMETABLE_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Button variant="primary" className="me-2" onClick={handleReschedule}>Reschedule</Button>
              </Form>
            </>
          )}
          {modalType === 'timetable' && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Subject</Form.Label>
                <Form.Control
                  type="text"
                  name="subject"
                  value={formData.subject || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Department</Form.Label>
                    <Form.Select
                      name="department_id"
                      value={formData.department_id || ''}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Select Department</option>
                      {allowedDepartments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Batch</Form.Label>
                    <Form.Select
                      name="batch"
                      value={formData.batch || ''}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Select Batch</option>
                      {BATCH_OPTIONS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Professor</Form.Label>
                <Form.Select
                  name="professor_id"
                  value={formData.professor_id || ''}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">{formData.department_id ? 'Select Professor' : 'Select Department first'}</option>
                  {(formData.department_id
                    ? professors.filter(p => Number(p.department_id) === Number(formData.department_id))
                    : professors
                  ).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  name="timetable_date"
                  value={formData.timetable_date || ''}
                  onChange={handleFormChange}
                  required
                />
              </Form.Group>
              <Row>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Time</Form.Label>
                    <Form.Select
                      name="start_time"
                      value={formData.start_time || ''}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Select</option>
                      {TIMETABLE_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group className="mb-3">
                    <Form.Label>End Time</Form.Label>
                    <Form.Select
                      name="end_time"
                      value={formData.end_time || ''}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Select</option>
                      {TIMETABLE_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Classroom</Form.Label>
                <Form.Select
                  name="classroom_id"
                  value={formData.classroom_id || ''}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Room</option>
                  {timetableClassrooms.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.room_no}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowModal(false);
            setFormData({});
            setRescheduleForm({ timetable_date: '', start_time: '', end_time: '', classroom_id: '' });
            setCsvFile(null);
            setCsvUploadType('');
            setCsvUploadResults(null);
          }}>
            {modalType === 'csv-upload' && csvUploadResults ? 'Close' : (modalType === 'timetable-entry-detail' ? 'Close' : 'Cancel')}
          </Button>
          {modalType === 'timetable-entry-detail' && (
            <Button variant="danger" onClick={() => handleDelete(formData.id)}>Delete</Button>
          )}
          {modalType !== 'csv-upload' || !csvUploadResults ? (
            modalType !== 'timetable-entry-detail' ? (
              <Button className="btn-primary-gradient" onClick={handleSubmit}>
                {modalType === 'csv-upload' ? 'Upload' : 'Save'}
              </Button>
            ) : null
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
