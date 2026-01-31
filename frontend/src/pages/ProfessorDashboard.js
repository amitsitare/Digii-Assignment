import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Button, Form, Modal, Alert } from 'react-bootstrap';
import Sidebar from '../components/common/Sidebar';
import TimetableCalendar from '../components/TimetableCalendar';
import { useAuth } from '../context/AuthContext';
import { timetableService } from '../services/timetableService';
import { adminService } from '../services/adminService';
import {
  DAYS_OF_WEEK,
  getDayLabel,
  formatTime,
  formatDate,
  WEEKLY_TIME_SLOTS,
  formatDeptShort,
  formatProfessorInitials,
} from '../utils/constants';

/** Get next occurrence of weekday (our scheme: 0=Mon, 6=Sun) as YYYY-MM-DD (local) */
function getNextDateForDayOfWeek(ourDayOfWeek) {
  const d = new Date();
  const todayJs = d.getDay();
  const ourToday = (todayJs + 6) % 7;
  let diff = ourDayOfWeek - ourToday;
  if (diff < 0) diff += 7;
  if (diff !== 0) d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** From date string YYYY-MM-DD get our day_of_week (0=Mon, 6=Sun) */
function getDayOfWeekFromDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return (d.getDay() + 6) % 7;
}

function getTodayDateStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const ProfessorDashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;

  const [classes, setClasses] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState(getTodayDateStr);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;
  const professorId = user?.id ? parseInt(user.id, 10) : null;

  const fetchData = useCallback(async () => {
    try {
      const [classesData, classroomData] = await Promise.all([
        timetableService.getMyClasses(),
        adminService.getClassrooms(),
      ]);
      setClasses(classesData.classes);
      setClassrooms(classroomData.classrooms);
      const todayFiltered = classesData.classes.filter(c => c.day_of_week === todayIndex);
      setTodayClasses(todayFiltered);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [todayIndex]);

  const [rescheduledClasses, setRescheduledClasses] = useState([]);
  const fetchRescheduledClasses = useCallback(async () => {
    try {
      const data = await timetableService.getMyClasses(undefined, true);
      setRescheduledClasses(data.classes || []);
    } catch (err) {
      console.error('Failed to fetch rescheduled classes:', err);
      setRescheduledClasses([]);
    }
  }, []);

  useEffect(() => {
    if (currentPath.startsWith('/professor/reschedule')) fetchRescheduledClasses();
  }, [currentPath, fetchRescheduledClasses]);

  const fetchTimetableForSchedule = useCallback(async () => {
    if (!currentPath.startsWith('/professor/schedule')) return;
    const dayOfWeek = getDayOfWeekFromDate(scheduleSelectedDate);
    try {
      const data = await timetableService.getTimetable({ day_of_week: dayOfWeek });
      setTimetable(data.timetable || []);
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
      setTimetable([]);
    }
  }, [currentPath, scheduleSelectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchTimetableForSchedule();
  }, [fetchTimetableForSchedule]);

  const openRescheduleModal = (classEntry) => {
    setSelectedClass(classEntry);
    const classroomRooms = classrooms.filter(c => c.room_type === 'classroom');
    const defaultRoomId = classroomRooms.some(c => c.id === classEntry.classroom_id)
      ? classEntry.classroom_id
      : (classroomRooms[0]?.id ?? classEntry.classroom_id);
    setRescheduleData({
      date: getNextDateForDayOfWeek(classEntry.day_of_week),
      start_time: classEntry.start_time,
      end_time: classEntry.end_time,
      classroom_id: defaultRoomId,
    });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleRescheduleChange = (e) => {
    setRescheduleData({
      ...rescheduleData,
      [e.target.name]: e.target.value,
    });
  };

  const handleReschedule = async () => {
    setError('');
    setSuccess('');
    const day_of_week = getDayOfWeekFromDate(rescheduleData.date);
    try {
      await timetableService.rescheduleClass(selectedClass.id, {
        day_of_week,
        start_time: rescheduleData.start_time,
        end_time: rescheduleData.end_time,
        classroom_id: parseInt(rescheduleData.classroom_id, 10),
      });
      setSuccess('Class rescheduled successfully! Room availability was checked. Students have been notified.');
      fetchData();
      if (currentPath.startsWith('/professor/schedule')) fetchTimetableForSchedule();
      if (currentPath.startsWith('/professor/reschedule')) fetchRescheduledClasses();
      setTimeout(() => setShowModal(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reschedule class');
    }
  };

  const groupedClasses = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.value] = classes.filter(c => c.day_of_week === day.value);
    return acc;
  }, {});

  /** Only classrooms (no auditorium) for reschedule room dropdown */
  const classroomOnlyRooms = useMemo(
    () => classrooms.filter(c => c.room_type === 'classroom'),
    [classrooms]
  );

  const isSchedulePage = currentPath.startsWith('/professor/schedule');
  const isReschedulePage = currentPath.startsWith('/professor/reschedule');

  const normTime = (t) => (t && typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : t);
  const getEntriesForRoomSlot = (classroomId, slotStart, nextSlotStart) =>
    timetable.filter((entry) => {
      const roomMatch = Number(entry.classroom_id) === Number(classroomId);
      const start = normTime(entry.start_time);
      const inSlot = start >= slotStart && start < nextSlotStart;
      return roomMatch && inSlot;
    });

  const renderDashboardHome = () => (
    <Container fluid>
      <header className="professor-dashboard-header">
        <h1>Professor Dashboard</h1>
        <p>View today&apos;s classes and your weekly schedule. Click any class to reschedule.</p>
      </header>
      <section className="professor-dashboard-section">
        <Card className="professor-card professor-card--today">
          <Card.Body className="p-0">
            <div className="professor-card__header professor-card__header--today">
              <span className="professor-card__badge">Today</span>
              <h2>{getDayLabel(todayIndex)}</h2>
            </div>
            <div className="professor-card__body">
              {todayClasses.length === 0 ? (
                <div className="professor-empty">
                  <p>No classes scheduled for today.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="professor-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Room</th>
                        <th>Department · Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayClasses.map(entry => (
                        <tr key={entry.id}>
                          <td className="professor-table__time">
                            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                          </td>
                          <td><strong>{entry.subject}</strong></td>
                          <td><span className="professor-room">{entry.room_no}</span></td>
                          <td className="text-secondary">{entry.department_code} · {entry.batch}</td>
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
      <section className="professor-dashboard-section">
        <Card className="professor-card professor-card--weekly">
          <Card.Body>
            <div className="professor-weekly-header">
              <h2>Weekly Schedule</h2>
              <p>Click a class to reschedule</p>
            </div>
            <Row className="g-3 professor-weekly-grid">
              {DAYS_OF_WEEK.slice(0, 6).map(day => (
                <Col xs={6} md={4} lg={2} key={day.value}>
                  <div
                    className={`professor-day-card ${day.value === todayIndex ? 'professor-day-card--today' : ''}`}
                  >
                    <div className="professor-day-card__header">
                      <span className="professor-day-card__label">{day.label.slice(0, 3)}</span>
                    </div>
                    <div className="professor-day-card__body">
                      {!groupedClasses[day.value]?.length ? (
                        <p className="professor-day-card__empty">No classes</p>
                      ) : (
                        groupedClasses[day.value].map(entry => (
                          <div
                            key={entry.id}
                            className="professor-class-block"
                            role="button"
                            tabIndex={0}
                            onClick={() => openRescheduleModal(entry)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRescheduleModal(entry); } }}
                          >
                            <span className="professor-class-block__subject">{entry.subject}</span>
                            <span className="professor-class-block__time">{formatTime(entry.start_time)}</span>
                            <span className="professor-class-block__room">{entry.room_no}</span>
                            <span className="professor-class-block__action">Reschedule</span>
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

  const dayLabelSchedule = scheduleSelectedDate
    ? formatDate(scheduleSelectedDate)
    : (DAYS_OF_WEEK.find((d) => d.value === getDayOfWeekFromDate(scheduleSelectedDate))?.label || 'Select date');

  const renderSchedulePage = () => (
    <Container fluid>
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-0">My Schedule</h2>
          <small className="text-muted">
            Full timetable for <strong>{dayLabelSchedule}</strong>. Only your classes are clickable to reschedule.
          </small>
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
                            entries.map((entry) => {
                              const isMine = professorId != null && Number(entry.professor_id) === professorId;
                              return (
                                <div
                                  key={entry.id}
                                  role={isMine ? 'button' : undefined}
                                  tabIndex={isMine ? 0 : undefined}
                                  className={`timetable-room-block border rounded p-2 mb-1 small ${isMine ? 'timetable-room-block-mine timetable-room-block-clickable' : 'bg-white'}`}
                                  style={{ borderLeft: `3px solid ${isMine ? 'var(--primary-blue)' : '#dee2e6'}` }}
                                  onClick={isMine ? () => openRescheduleModal(entry) : undefined}
                                  onKeyDown={isMine ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRescheduleModal(entry); } } : undefined}
                                >
                                  <div className="fw-semibold text-primary">{formatDeptShort(entry.department_name, entry.department_code)}</div>
                                  {entry.batch && <span className="text-muted">{entry.batch}</span>}
                                  <div className="text-muted mt-1">{entry.subject}</div>
                                  {(entry.professor_first_name != null || entry.professor_last_name != null) && (
                                    <div className="text-muted small mt-1">{formatProfessorInitials(entry.professor_first_name, entry.professor_last_name)}</div>
                                  )}
                                  {isMine && <div className="small mt-1 text-primary">Click to reschedule</div>}
                                </div>
                              );
                            })
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {timetable.length === 0 && (
            <p className="text-center text-muted mt-3 mb-0">
              No classes for this day. Use the calendar to pick a date.
            </p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );

  const renderReschedulePage = () => (
    <Container fluid>
      <header className="professor-dashboard-header">
        <h1>Rescheduled Class</h1>
        <p>Only classes you have rescheduled. Click Reschedule to change date, time, or room again.</p>
      </header>
      <section className="professor-dashboard-section">
        <Card className="professor-card professor-card--weekly">
          <Card.Body>
            {rescheduledClasses.length === 0 ? (
              <div className="professor-empty">
                <p>No rescheduled classes yet. Reschedule a class from Dashboard or My Schedule to see it here.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="professor-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Subject</th>
                      <th>Room</th>
                      <th>Department · Batch</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rescheduledClasses.map(entry => (
                      <tr key={entry.id}>
                        <td>{getDayLabel(entry.day_of_week)}</td>
                        <td className="professor-table__time">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</td>
                        <td><strong>{entry.subject}</strong></td>
                        <td><span className="professor-room">{entry.room_no}</span></td>
                        <td className="text-secondary">{entry.department_code} · {entry.batch}</td>
                        <td>
                          <Button size="sm" className="btn-primary-gradient" onClick={() => openRescheduleModal(entry)}>
                            Reschedule
                          </Button>
                        </td>
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
    if (isReschedulePage) return renderReschedulePage();
    if (isSchedulePage) return renderSchedulePage();
    return renderDashboardHome();
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <div className="dashboard-content professor-dashboard">
          <div className="professor-dashboard-loading">
            <div className="professor-dashboard-spinner" />
            <p>Loading your schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {isSchedulePage ? (
        <TimetableCalendar
          selectedDate={scheduleSelectedDate}
          onSelectDate={setScheduleSelectedDate}
          menuHref="/professor"
          menuLabel="Menu"
        />
      ) : (
        <Sidebar />
      )}
      <div className="dashboard-content professor-dashboard">
        {renderContent()}
      </div>

      {/* Reschedule Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="professor-modal">
        <Modal.Header closeButton className="professor-modal__header">
          <Modal.Title>Reschedule Class</Modal.Title>
        </Modal.Header>
        <Modal.Body className="professor-modal__body">
          {error && <Alert variant="danger" className="professor-modal__alert">{error}</Alert>}
          {success && <Alert variant="success" className="professor-modal__alert">{success}</Alert>}

          {selectedClass && (
            <>
              <div className="professor-modal__summary">
                <p className="professor-modal__summary-subject">{selectedClass.subject}</p>
                <p className="professor-modal__summary-current">
                  Current: {getDayLabel(selectedClass.day_of_week)} · {formatTime(selectedClass.start_time)} – {selectedClass.room_no}
                </p>
              </div>

              <Form>
                <Form.Group className="professor-form-group">
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="date"
                    value={rescheduleData.date || ''}
                    onChange={handleRescheduleChange}
                    className="professor-form-control"
                    min={(() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    })()}
                  />
                </Form.Group>

                <Row>
                  <Col>
                    <Form.Group className="professor-form-group">
                      <Form.Label>Start time</Form.Label>
                      <Form.Control
                        type="time"
                        name="start_time"
                        value={rescheduleData.start_time}
                        onChange={handleRescheduleChange}
                        className="professor-form-control"
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="professor-form-group">
                      <Form.Label>End time</Form.Label>
                      <Form.Control
                        type="time"
                        name="end_time"
                        value={rescheduleData.end_time}
                        onChange={handleRescheduleChange}
                        className="professor-form-control"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="professor-form-group">
                  <Form.Label>Room (classrooms only)</Form.Label>
                  <Form.Select
                    name="classroom_id"
                    value={rescheduleData.classroom_id}
                    onChange={handleRescheduleChange}
                    className="professor-form-control"
                  >
                    {classroomOnlyRooms.length === 0 ? (
                      <option value="">No classrooms available</option>
                    ) : (
                      classroomOnlyRooms.map(c => (
                        <option key={c.id} value={c.id}>{c.room_no}</option>
                      ))
                    )}
                  </Form.Select>
                </Form.Group>
              </Form>

              <Alert variant="info" className="professor-modal__info">
                Only classrooms are listed. Room availability is checked when you submit—if the room is already booked for that date and time, you&apos;ll see an error. Students will be notified after a successful reschedule.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="professor-modal__footer">
          <Button variant="outline-secondary" onClick={() => setShowModal(false)} className="professor-modal__btn-cancel">
            Cancel
          </Button>
          <Button className="btn-primary-gradient professor-modal__btn-submit" onClick={handleReschedule}>
            Reschedule
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProfessorDashboard;
