"""
Seed timetable via command line: dummy entries for all departments,
weekdays only (Mon–Fri), Jan 26–30 2026 pattern; repeats automatically every week.
No overlapping classes in the same classroom; some blocks left empty.

Run from backend directory: python scripts/seed_timetable_cli.py
"""
import sys
import os

# Ensure backend/app is importable when run from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.db import query_db, insert_db

# Weekdays: 0=Monday .. 4=Friday (Jan 26 2026 = Monday)
WEEKDAYS = [0, 1, 2, 3, 4]

# Time slots (start, end) — same style as frontend; some slots left empty per day
SLOTS = [
    ('09:00', '10:00'),
    ('10:00', '11:00'),
    ('11:00', '12:00'),
    ('12:00', '13:00'),
    ('14:00', '15:00'),
    ('15:00', '16:00'),
]

SAMPLE_SUBJECTS = [
    'Data Structures', 'Algorithms', 'DBMS', 'Computer Networks', 'Operating Systems',
    'Software Engineering', 'Calculus', 'Signals & Systems', 'Digital Electronics',
    'Control Systems', 'Thermodynamics', 'Fluid Mechanics', 'Communication & Ethics',
    'Data Handling in Python', 'Mathematical Foundations',
]

BATCHES = ['2026', '2027']


def main():
    app = create_app()
    with app.app_context():
        departments = query_db(
            "SELECT id, code, name FROM departments ORDER BY id"
        )
        classrooms = query_db(
            "SELECT id, room_no FROM classrooms WHERE room_type = 'classroom' ORDER BY id"
        )
        professors = query_db(
            "SELECT id, department_id, first_name, last_name FROM users "
            "WHERE role = 'professor' AND is_active = TRUE ORDER BY department_id, id"
        )
        admin = query_db(
            "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1",
            one=True
        )

        if not departments:
            print("No departments found. Run schema.sql first.")
            return 1
        if not classrooms:
            print("No classrooms found. Run schema.sql first.")
            return 1
        if not professors:
            print("No professors found. Add professors (e.g. from test_professors.csv) first.")
            return 1
        created_by = admin['id'] if admin else None

        # Professors by department
        prof_by_dept = {}
        for p in professors:
            did = p['department_id']
            if did is not None:
                prof_by_dept.setdefault(did, []).append(p)

        # Build list of (day, start, end) for weekdays; only use a subset of slots per day so some blocks stay empty
        slot_indices_to_use = [0, 1, 3, 4]  # e.g. 9–10, 10–11, 12–1, 2–3 (leave 11–12 and 3–4 empty for some days)
        used_room_slots = set()  # (room_id, day, start_time)
        created = 0
        subject_idx = 0
        dept_idx = 0

        for day in WEEKDAYS:
            for si in slot_indices_to_use:
                if si >= len(SLOTS):
                    continue
                start_time, end_time = SLOTS[si]
                # Pick a room not yet used for this (day, start_time)
                for room in classrooms:
                    key = (room['id'], day, start_time)
                    if key in used_room_slots:
                        continue
                    dept = departments[dept_idx % len(departments)]
                    dept_profs = prof_by_dept.get(dept['id'], [])
                    if not dept_profs:
                        dept_profs = professors  # fallback
                    prof = dept_profs[created % len(dept_profs)]
                    batch = BATCHES[created % len(BATCHES)]
                    subject = SAMPLE_SUBJECTS[subject_idx % len(SAMPLE_SUBJECTS)]

                    # Double-check no conflict (room + day + time)
                    conflict = query_db("""
                        SELECT id FROM timetable
                        WHERE classroom_id = %s AND day_of_week = %s
                        AND (
                            (start_time <= %s AND end_time > %s) OR
                            (start_time < %s AND end_time >= %s) OR
                            (start_time >= %s AND end_time <= %s)
                        )
                    """, (
                        room['id'], day,
                        start_time, start_time,
                        end_time, end_time,
                        start_time, end_time
                    ), one=True)

                    if conflict:
                        continue
                    # Professor conflict check
                    prof_conflict = query_db("""
                        SELECT id FROM timetable
                        WHERE professor_id = %s AND day_of_week = %s
                        AND (
                            (start_time <= %s AND end_time > %s) OR
                            (start_time < %s AND end_time >= %s)
                        )
                    """, (prof['id'], day, start_time, start_time, end_time, end_time), one=True)
                    if prof_conflict:
                        continue

                    try:
                        insert_db("""
                            INSERT INTO timetable
                            (department_id, batch, classroom_id, professor_id, subject, day_of_week, start_time, end_time, created_by)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            dept['id'], batch, room['id'], prof['id'], subject,
                            day, start_time, end_time, created_by
                        ))
                        used_room_slots.add(key)
                        created += 1
                        subject_idx += 1
                        dept_idx += 1
                    except Exception as e:
                        print(f"Skip insert: {e}")
                    break  # one entry per (day, slot index)

        print(f"Timetable seed done: {created} entries added (weekdays Mon–Fri, no room overlap, some blocks left empty).")
        print("Same schedule repeats every week (including through June).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
