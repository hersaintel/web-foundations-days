# School Database Design

This database keeps track of students, the courses they can take, and which student is enrolled on which course (with their grade). It is built in SQLite and the SQL is in `school.sql`.

## Tables

### `students`
- Holds one row per student.
- `student_id` is the primary key.
- `name` is required (`NOT NULL`).
- `email` is required and `UNIQUE`, so two students can never share an email address.

### `courses`
- Holds one row per course the school offers.
- `course_id` is the primary key.
- `code` (for example `WEB101`) is required and `UNIQUE`.
- `title` is required, and `credits` is a positive whole number.

### `enrolments`
- Holds one row for each time a student enrols on a course.
- `enrolment_id` is the primary key.
- `student_id` and `course_id` are foreign keys pointing at `students` and `courses`, and both are required.
- `enrolled_on` records the date, and `grade` (0 to 100) stays empty (`NULL`) until the student has been graded.
- `UNIQUE (student_id, course_id)` stops the same student enrolling on the same course twice.

## Relationships

- **One-to-many: students to enrolments.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **One-to-many: courses to enrolments.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **Many-to-many: students to courses.** One student can take many courses, and one course has many students. This is the relationship the school really cares about.

### Why a join table is needed

- A relational table cannot hold a list in one cell. Putting several course ids into a `courses` column on `students` (or a list of students on `courses`) breaks the rule that each cell holds one value, and it makes searching, counting and updating messy.
- Copying student details onto every course row would repeat data, and one change (such as a new email) would have to be made in many places.
- The `enrolments` table solves this by turning one many-to-many relationship into two one-to-many relationships. It has one row per pairing.
- It is also the natural home for the **grade**, because a grade belongs to the pairing of a student and a course, not to the student alone or the course alone.

## Index I would add

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

- **Reason:** The `UNIQUE (student_id, course_id)` rule already creates an index that makes lookups by `student_id` fast, but it does not help when searching by `course_id` alone.
- Without the new index, SQLite has to scan the whole `enrolments` table to find "all students on one course" or to count students per course. I checked the query plan and it showed a full scan. With the index it does a direct search.
- This does not matter with 7 rows, but a real school would have thousands of enrolments, and these course queries run often.
- The trade-off is a little extra storage and slightly slower inserts, which is worth it for a table that is read much more often than it is written.

## SQL or NoSQL?

I would choose SQL for this system. The data is naturally structured and connected: students, courses and enrolments always have the same fields, and the main questions are about relationships, such as "which courses is this student on?", "how many students are on each course?" and "who has no enrolments?". Relational databases answer those with `JOIN` and `GROUP BY`. SQL also lets the database itself enforce the rules that matter here: unique emails, no double enrolment, and no enrolment for a student or course that does not exist. These rules protect the data even if the app has a bug. Enrolling a student is also something that must either fully succeed or not happen at all, which SQL transactions handle well. A school's data is also fairly small and does not need a NoSQL system's ability to spread across many servers. NoSQL would be a better fit for other parts of a school platform, such as storing flexible, differently shaped documents like lesson content or activity logs, but not for the core records of who is enrolled where.
