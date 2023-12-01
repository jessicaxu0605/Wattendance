const get_course_attendance = mysql.format(
        //     "SELECT c.courseID FROM attendance a\
        //     JOIN classes c ON c.idclasses = a.classID\
        //     WHERE c.courseID = ?"
        //     [courseID]
        // );