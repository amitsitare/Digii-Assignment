import React from 'react';
import { NavLink } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const toDate = (str) => (str ? new Date(str + 'T12:00:00') : new Date());

const toDateStr = (date) => {
  if (!date || !(date instanceof Date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const TimetableCalendar = ({ selectedDate, onSelectDate, menuHref = '/admin', menuLabel = 'Menu' }) => {
  const value = toDate(selectedDate);

  const handleChange = (nextValue) => {
    const str = toDateStr(nextValue);
    if (str) onSelectDate(str);
  };

  return (
    <div className="timetable-calendar-panel">
      <div className="timetable-calendar-header">
        <NavLink to={menuHref} className="timetable-calendar-menu-link">
          ← {menuLabel}
        </NavLink>
        <span className="timetable-calendar-title">Calendar</span>
      </div>
      <div className="timetable-calendar-wrapper">
        <Calendar
          value={value}
          onChange={handleChange}
          locale="en-US"
          formatShortWeekday={(_, date) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
          next2Label={null}
          prev2Label={null}
          showNeighboringMonth={true}
          tileClassName={({ date }) => {
            const str = toDateStr(date);
            const todayStr = toDateStr(new Date());
            const classes = [];
            if (str === selectedDate) classes.push('react-calendar__tile--selected');
            if (str === todayStr) classes.push('react-calendar__tile--today');
            return classes.length ? classes.join(' ') : null;
          }}
        />
      </div>
      <div className="timetable-calendar-actions">
        <button
          type="button"
          className="timetable-calendar-today-btn"
          onClick={() => onSelectDate(toDateStr(new Date()))}
        >
          Today
        </button>
      </div>
    </div>
  );
};

export default TimetableCalendar;
