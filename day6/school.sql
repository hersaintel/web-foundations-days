-- Day 6: A School Database (SQLite)
-- Run the whole script first, then run each query on its own
-- (select one query and click Run) to see its result.

PRAGMA foreign_keys = ON;

-- Start clean so the script can be run again and again.
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ---------- Tables ----------

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  title     TEXT NOT NULL,
  credits   INTEGER NOT NULL CHECK (credits > 0)
);

-- Join table: one row = one student enrolled on one course.
-- The grade belongs to the enrolment, so it lives here. It stays NULL until graded.
CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL,
  course_id    INTEGER NOT NULL,
  enrolled_on  TEXT NOT NULL DEFAULT (date('now')),
  grade        INTEGER CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses (course_id)   ON DELETE CASCADE,
  -- The same student cannot enrol on the same course twice.
  UNIQUE (student_id, course_id)
);

-- Speeds up "who is on this course?" lookups (see school-design.md).
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);

-- ---------- Sample data ----------

INSERT INTO students (student_id, name, email) VALUES
  (1, 'Amara Okafor',  'amara.okafor@school.example'),
  (2, 'Daniel Mensah', 'daniel.mensah@school.example'),
  (3, 'Grace Wanjiru', 'grace.wanjiru@school.example'),
  (4, 'Kofi Boateng',  'kofi.boateng@school.example'),
  (5, 'Lina Haddad',   'lina.haddad@school.example');

INSERT INTO courses (course_id, code, title, credits) VALUES
  (1, 'WEB101', 'Web Foundations',  3),
  (2, 'DB101',  'Databases',        4),
  (3, 'JS101',  'JavaScript Basics', 3);

INSERT INTO enrolments (student_id, course_id, enrolled_on, grade) VALUES
  (1, 1, '2026-09-01', 85),
  (1, 2, '2026-09-01', 78),
  (2, 1, '2026-09-02', 92),
  (2, 2, '2026-09-02', NULL),
  (3, 1, '2026-09-03', 74),
  (3, 3, '2026-09-03', 81),
  (4, 3, '2026-09-04', NULL);

-- ---------- Queries ----------

-- QUERY 1: All courses for one student (by name)
SELECT c.code, c.title, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Amara Okafor'
ORDER BY c.title;

-- QUERY 2: All students on one course
SELECT s.name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.title = 'Web Foundations'
ORDER BY s.name;

-- QUERY 3: Number of students per course
-- LEFT JOIN keeps courses that nobody has joined yet (they show 0).
SELECT c.title, COUNT(e.enrolment_id) AS number_of_students
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.title
ORDER BY number_of_students DESC, c.title;

-- QUERY 4: Students who have no enrolments
-- LEFT JOIN keeps every student; the ones with no match have NULL on the enrolment side.
SELECT s.name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- QUERY 5: Update one enrolment's grade (Daniel Mensah, Databases)
UPDATE enrolments
SET grade = 88
WHERE student_id = (SELECT student_id FROM students WHERE name = 'Daniel Mensah')
  AND course_id  = (SELECT course_id FROM courses WHERE code = 'DB101');

-- Check the update worked
SELECT s.name, c.title, e.grade
FROM enrolments AS e
JOIN students AS s ON s.student_id = e.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Daniel Mensah'
ORDER BY c.title;
