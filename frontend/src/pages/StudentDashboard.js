import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Table } from 'react-bootstrap';
import Sidebar from '../components/common/Sidebar';
import TimetableCalendar from '../components/TimetableCalendar';
import { timetableService } from '../services/timetableService';
import { useAuth } from '../context/AuthContext';
import {
  DAYS_OF_WEEK,
  getDayLabel,
  formatTime,
  formatDate,
  WEEKLY_TIME_SLOTS,
  formatDeptShort,
  formatProfessorInitials,
} from '../utils/constants';
import api from '../services/api';

const getTodayDateStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const StudentDashboard = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();

  const [timetable, setTimetable] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [auditoriumBookings, setAuditoriumBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // For My Timetable page: selected date and full-day timetable (all depts, like admin)
  const [timetableSelectedDate, setTimetableSelectedDate] = useState(getTodayDateStr);
  const [dayTimetable, setDayTimetable] = useState([]);

  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  const fetchDashboardData = useCallback(async () => {
    try {
      const [timetableData, todayData, auditoriumData] = await Promise.all([
        timetableService.getMyTimetable(),
        timetableService.getTodayClasses(),
        api.get('/student/auditorium'),
      ]);
      setTimetable(timetableData.timetable);
      setTodayClasses(todayData.classes);
      setAuditoriumBookings(auditoriumData.data.bookings);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // When on My Timetable page, fetch only this student's batch timetable for selected date
  const dayOfWeekFromDate = useMemo(() => {
    if (!timetableSelectedDate) return (new Date().getDay() + 6) % 7;
    const d = new Date(timetableSelectedDate + 'T12:00:00');
    return (d.getDay() + 6) % 7;
  }, [timetableSelectedDate]);

  const fetchDayTimetable = useCallback(async () => {
    if (!currentPath.startsWith('/student/timetable')) return;
    try {
      // Use student's own timetable API so only their batch (e.g. 2027) is shown
      const data = await timetableService.getMyTimetable(dayOfWeekFromDate);
      setDayTimetable(data.timetable || []);
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
      setDayTimetable([]);
    }
  }, [currentPath, dayOfWeekFromDate]);

  useEffect(() => {
    fetchDayTimetable();
  }, [fetchDayTimetable]);

  // Derive unique classrooms from day timetable (student has no classrooms API)
  const classroomsFromTimetable = useMemo(() => {
    const seen = new Map();
    (dayTimetable || []).forEach((entry) => {
      if (entry.classroom_id != null && !seen.has(entry.classroom_id)) {
        seen.set(entry.classroom_id, { id: entry.classroom_id, room_no: entry.room_no || `Room ${entry.classroom_id}` });
      }
    });
    return Array.from(seen.values()).sort((a, b) => String(a.room_no).localeCompare(String(b.room_no)));
  }, [dayTimetable]);

  const normTime = (t) => (t && typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : t);
  const getEntriesForRoomSlot = (classroomId, slotStart, nextSlotStart) =>
    (dayTimetable || []).filter((entry) => {
      const roomMatch = Number(entry.classroom_id) === Number(classroomId);
      const start = normTime(entry.start_time);
      return roomMatch && start >= slotStart && start < nextSlotStart;
    });

  const groupedClasses = useMemo(
    () =>
      DAYS_OF_WEEK.reduce((acc, day) => {
        acc[day.value] = timetable.filter((c) => c.day_of_week === day.value);
        return acc;
      }, {}),
    [timetable]
  );

  const renderDashboardHome = () => (
    <Container fluid>
      <header className="student-dashboard-header">
        <h1>Student Dashboard</h1>
        <p>View today&apos;s classes and your weekly timetable.</p>
        {user && (user.department_name || user.batch) && (
          <div className="student-dashboard-info">
            <span className="student-dashboard-info__dept">{user.department_name || '—'}</span>
            <span className="student-dashboard-info__divider">·</span>
            <span className="student-dashboard-info__batch">Batch {user.batch || '—'}</span>
          </div>
        )}
      </header>

      <section className="student-dashboard-section">
        <Card className="student-card student-card--today">
          <Card.Body className="p-0">
            <div className="student-card__header student-card__header--today">
              <span className="student-card__badge">Today</span>
              <h2>{getDayLabel(todayIndex)}</h2>
            </div>
            <div className="student-card__body">
              {todayClasses.length === 0 ? (
                <div className="student-empty">
                  <p>No classes scheduled for today.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="student-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Room</th>
                        <th>Professor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayClasses.map((entry) => (
                        <tr key={entry.id}>
                          <td className="student-table__time">
                            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                          </td>
                          <td><strong>{entry.subject}</strong></td>
                          <td><span className="student-room">{entry.room_no}</span></td>
                          <td className="text-secondary">
                            {entry.professor_first_name} {entry.professor_last_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </section>

      <section className="student-dashboard-section">
        <Card className="student-card student-card--weekly">
          <Card.Body>
            <div className="student-weekly-header">
              <h2>My Weekly Timetable</h2>
              <p>View only · Mon – Sat</p>
            </div>
            <Row className="g-3 student-weekly-grid">
              {DAYS_OF_WEEK.slice(0, 6).map((day) => (
                <Col xs={6} md={4} lg={2} key={day.value}>
                  <div
                    className={`student-day-card ${day.value === todayIndex ? 'student-day-card--today' : ''}`}
                  >
                    <div className="student-day-card__header">
                      <span className="student-day-card__label">{day.label.slice(0, 3)}</span>
                    </div>
                    <div className="student-day-card__body">
                      {!groupedClasses[day.value]?.length ? (
                        <p className="student-day-card__empty">No classes</p>
                      ) : (
                        groupedClasses[day.value].map((entry) => (
                          <div key={entry.id} className="student-class-block">
                            <span className="student-class-block__subject">{entry.subject}</span>
                            <span className="student-class-block__time">
                              {formatTime(entry.start_time)}
                            </span>
                            <span className="student-class-block__room">R: {entry.room_no}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      </section>
    </Container>
  );

  const renderTimetablePage = () => {
    const dayLabel = timetableSelectedDate
      ? formatDate(timetableSelectedDate)
      : getDayLabel(dayOfWeekFromDate) || 'Select date';
    return (
      <Container fluid>
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="mb-0">My Timetable</h2>
            <small className="text-muted">
              Your batch {user?.batch ? `(${user.batch})` : ''} for <strong>{dayLabel}</strong> — select a date in the calendar
            </small>
          </Col>
        </Row>
        <Card className="feature-card student-timetable-card">
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
                  {classroomsFromTimetable.length === 0 ? (
                    <tr>
                      <td colSpan={WEEKLY_TIME_SLOTS.length + 1} className="text-center text-muted py-4">
                        No classes for this day. Pick another date in the calendar.
                      </td>
                    </tr>
                  ) : (
                    classroomsFromTimetable.map((room) => (
                      <tr key={room.id}>
                        <td className="bg-light fw-medium timetable-room-col">{room.room_no}</td>
                        {WEEKLY_TIME_SLOTS.map((slot) => {
                          const entries = getEntriesForRoomSlot(room.id, slot.start, slot.nextStart);
                          return (
                            <td
                              key={slot.start}
                              className="timetable-room-cell p-2"
                              style={{ verticalAlign: 'top' }}
                            >
                              {entries.length === 0 ? (
                                <span className="text-muted small">—</span>
                              ) : (
                                entries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="student-timetable-room-block border rounded p-2 mb-1 small bg-white"
                                    style={{ borderLeft: '3px solid #6366f1' }}
                                  >
                                    <div className="fw-semibold text-primary">
                                      {formatDeptShort(entry.department_name, entry.department_code)}
                                    </div>
                                    {entry.batch && <span className="text-muted">{entry.batch}</span>}
                                    <div className="text-muted mt-1">{entry.subject}</div>
                                    {(entry.professor_first_name != null || entry.professor_last_name != null) && (
                                      <div className="text-muted small mt-1">
                                        {formatProfessorInitials(entry.professor_first_name, entry.professor_last_name)}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </td>
                          );
                        })}
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

  const renderAuditoriumPage = () => (
    <Container fluid>
      <header className="student-dashboard-header">
        <h1>Auditorium Schedule</h1>
        <p>Upcoming events and bookings</p>
      </header>
      <section className="student-dashboard-section">
        <Card className="student-card student-card--auditorium">
          <Card.Body>
            {auditoriumBookings.length === 0 ? (
              <div className="student-empty">
                <p>No upcoming auditorium bookings.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="student-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Time</th>
                      <th>Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoriumBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="student-table__date">{formatDate(booking.booking_date)}</td>
                        <td><strong>{booking.event_name}</strong></td>
                        <td className="student-table__time">
                          {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                        </td>
                        <td><span className="student-room">{booking.room_no}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </section>
    </Container>
  );

  const renderContent = () => {
    if (currentPath.startsWith('/student/timetable')) return renderTimetablePage();
    if (currentPath.startsWith('/student/auditorium')) return renderAuditoriumPage();
    return renderDashboardHome();
  };

  const isTimetablePage = currentPath.startsWith('/student/timetable');

  if (loading && !isTimetablePage) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <div className="dashboard-content student-dashboard">
          <div className="student-dashboard-loading">
            <div className="student-dashboard-spinner" />
            <p>Loading your schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {isTimetablePage ? (
        <TimetableCalendar
          selectedDate={timetableSelectedDate}
          onSelectDate={setTimetableSelectedDate}
          menuHref="/student"
          menuLabel="Dashboard"
        />
      ) : (
        <Sidebar />
      )}
      <div className="dashboard-content student-dashboard">{renderContent()}</div>
    </div>
  );
};

export default StudentDashboard;
