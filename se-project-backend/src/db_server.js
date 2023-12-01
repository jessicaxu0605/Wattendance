import express from 'express';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import cors from 'cors';
import cron from 'node-cron';

const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
}));
const port = 3600;
dotenv.config();
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    authPlugin: 'mysql_native_password'
});

//-----------------------------------------
//Log in and sign up support

function findUser(pool, query, found_func, fail_func) {
    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);

        //search
        await connection.query(query,
            async (err, result) => {
                connection.release()
                if (err) throw (err)

                if (result.length > 0) {
                    found_func(result);
                } else {
                    fail_func(result);
                }
            }
        );
    });
}


app.post("/signup", async(req,res) => {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const hashedPW = await bcrypt.hash(req.body.password, 10); //stores hashed password
    const email = req.body.email;

    const find_query = mysql.format("SELECT email FROM users WHERE email = ? LIMIT 1", [email]);
    const insert_query = mysql.format ("INSERT INTO users VALUES (0, ?, ?, ?, ?)", [firstName, lastName, email, hashedPW]);

    findUser(pool, find_query,
        //if user found:
        (result)=> {
            console.log("Account already exists for email:")
            console.log(result[0].email)
            res.send({
                'status': 'unsuccessful',
                'erorr': 'existing user'
            });
        },
        //if user not found:
        (result) => {
            pool.getConnection(async(err, connection)=> {
            await connection.query(insert_query,
                async (err, result) => {
                    connection.release();
                    if (err) throw (err);

                    const id = result.insertId;
                    res.send({
                        'status': 'successful',
                        'user': {
                            'id': id,
                            'firstName': firstName,
                            'lastName': lastName,
                            'email': email,
                        }
                    });
                }
            )
            })
        }
    )
});

app.put("/login", async(req,res) => {
    const email = req.body.email;
    const password = req.body.password;
    console.log(req.body);

    const find_query = mysql.format("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    findUser(pool, find_query,
        //if user found:
        (result) => {
            const hashedPW = result[0].password
            pool.getConnection(async(err, connection) => {

                const hashedPassword = result[0].password;
                if (await bcrypt.compare(password, hashedPassword)) {
                    console.log("Login Successful");

                    res.send({
                        'status': 'successful',
                        'user': {
                            'id': result[0].idusers,
                            'firstName': result[0].firstName,
                            'lastName': result[0].lastName,
                            'email': result[0].email,
                        }
                    });
                } 
                else {
                    console.log("Password Incorrect");
                    res.send(JSON.stringify({
                        'status': 'unsuccessful',
                        'error': 'password incorrect'
                    }))
                }
            })
        },
        //if user not found:
        (result) => {
            console.log("User Does Not Exist");
            res.send(JSON.stringify({
                'status': 'unsuccessful',
                'error': 'no user',
            }));
        }
    )
});

//-----------------------------------------
//Attendence recording

//This endpoint is hit by the raspberry pi every time it detects a known person
//Handles logic for if the person is late or on time
app.post("/attendance-present", async(req,res) => {
    const userID = req.body.user;

    const datetime = new Date();
    const sqlDatetime= datetime.toISOString().slice(0, 19).replace('T', ' ');

    //check if there is an UPCOMING class that the detected user is enrolled in
    const find_present_class = mysql.format(
        "SELECT cl.idclasses, cl.courseID \
        FROM users u \
        JOIN `courses-users` cu ON cu.userID = u.idusers \
        JOIN classes cl ON cl.courseID = cu.courseID \
        WHERE TIMESTAMPDIFF(MINUTE, ?, cl.startTime) BETWEEN -1 AND 15 \
        LIMIT 1;",
        [sqlDatetime]);
        console.log(sqlDatetime);
    //check if there is an ONGOING class that the detected user is enrolled in
    const find_late_class = mysql.format(
        "SELECT cl.idclasses, cl.courseID \
        FROM users u \
        JOIN `courses-users` cu ON cu.userID = u.idusers \
        JOIN classes cl ON cl.courseID = cu.courseID \
        WHERE '2023-11-25 03:03:11' > cl.startTime AND '2023-11-25 03:03:11' < cl.endTime \
        LIMIT 1;",
        [sqlDatetime, sqlDatetime]);

    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);
        try{
            await connection.query(find_present_class,
            async(err, result)=> {
                console.log(result);
                //if present class found:
                if (result.length > 0) {
                    const classID = result[0].idclasses;
                    const insert_query = mysql.format(
                        "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 0, ?)", 
                        [classID, userID, sqlDatetime]);
                    await connection.query(insert_query);
                    const courseID = result[0].courseID;
                                const update_course = mysql.format(
                                    "UPDATE courses SET totalAttendance = totalAttendance + 1 WHERE idcourses = ?",
                                    [courseID]
                                )
                                await connection.query(update_course);
                    console.log(insert_query);
                    console.log(find_present_class);
                    console.log("present");
                //no present class found; search for late classes:
                } else {
                    await connection.query(find_late_class,
                        async(err, lateResult)=> {
                            if (lateResult.length > 0) {
                                const classID = lateResult[0].idclasses;
                                console.log(lateResult[0]);
                                const insert_query = mysql.format(
                                    "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 1, ?)", 
                                    [classID, userID, sqlDatetime]);
                                await connection.query(insert_query);
                                const courseID = lateResult[0].courseID;
                                const update_course = mysql.format(
                                    "UPDATE courses SET totalAttendance = totalAttendance + 1 WHERE idcourses = ?",
                                    [courseID]
                                )
                                await connection.query(update_course);
                                console.log(update_course);
                                console.log("late");
                            } else {
                                console.log("no classes");
                            }
                        }
                    );
                }
            });
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }
    });
})

//cron automated to hit this endpoint every time a scheduled class ends
app.post("/attendance-absent", async(req,res) => {
    const classID = req.body.class;

    //get the courseID of the class
    function get(query) {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    connection.release();
                    reject(err);
                } else {
                    connection.query(query, (err, result) => {
                        connection.release();
                        if (err) {
                            reject(err);
                        } else {
                            console.log("\n\n");
                            console.log(result);
                            resolve(result);
                        }
                    });
                }
            });
        });
    }
    const find_courseID = mysql.format("SELECT courseID FROM classes WHERE idclasses = ? LIMIT 1", [classID]);
    
    //mark all users not marked late or present as absent
    try {
        const courses = await get(find_courseID);
        const courseID = courses[0].courseID;
        console.log(courseID);
        const find_absent = mysql.format(
            "SELECT userID FROM `courses-users` WHERE courseID = ?\
            AND userID NOT IN (SELECT userID FROM attendance WHERE classID = ?)",
            [courseID, classID]);
        console.log(find_absent);
        const absent = await get(find_absent);
        pool.getConnection(async(err, connection)=>{
            for (let user in absent) {
                const userID = absent[user].userID;
                console.log(userID);
                const insert_query = mysql.format(
                    "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 2, NULL)", 
                    [classID, userID]);
                await connection.query(insert_query);
            }
        })
    } catch (err) {
        throw (err);
    }
});

//-----------------------------------------
//data fetching

//get attendance/date pair per user--used by github-style display on front-end
app.put("/get-attendance-batched", async(req,res) => {
    const userID = req.body.userID;
    console.log(req.body);
    const find_attendance = mysql.format(
        "SELECT DATE(datetime) AS `date`, classID FROM attendance\
         WHERE `datetime` IS NOT NULL AND userID = ?\
         ORDER BY `date`",
        [userID]
    );
    console.log(find_attendance);
    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);
        try{
            await connection.query(find_attendance,
            async(err, result)=> {
                const attendance = [];
                if (result.length == 0) {
                    res.send(attendance);
                } else {
                    console.log(result[0]);
                    let curDate = result[0].date;
                    let count = 1;
                    let i = 1;
                    while (i < result.length) {

                        if (result[i].date != curDate) {
                            attendance.push({'date': curDate, 'count': count})
                            curDate = result[i].date;
                            count = 0;
                        }
                        count++;
                        i++;
                        console.log(curDate);
                    }
                    attendance.push({'date': curDate, 'count': count});
                    console.log(attendance);
                    res.send(attendance)
                }
            });
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }
    });
})

//get
app.put("/get-course-attendance", async(req,res) => {
    const courseID = req.body.courseID;
    const find_attendance = mysql.format(
        "SELECT courseName, courseCode, totalAttendance FROM courses WHERE idcourses = ? LIMIT 1",
        [courseID]
    );
    console.log(find_attendance);
    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);
        try{
            await connection.query(find_attendance,
            async(err, result)=> {
                res.send({
                    'course': result[0].courseName,
                    'code': result[0].courseCode,
                    'attendance': result[0].totalAttendance
                })
            });
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }
    });
})

// app.put("/get-scatter-points", async(req,res) => {
//     const courseID = req.body.courseID;
//     const getSurvey_query = mysql.format(
//         "SELECT cu.courseID, cu.userID, sr.`avg` FROM `courses-users` cu\
//         LEFT JOIN `survey-results` sr ON sr.userID = cu.userID\
//         WHERE cu.courseID = ? AND sr.courseID = ?\
//         ORDER BY cu.userID",
//         [courseID, courseID]
//         );
//     console.log(getSurvey_query);
//     function getSurveyResults() {
//         return new Promise((resolve, reject) => {
//             pool.getConnection((err, connection) => {
//                 if (err) {
//                     connection.release();
//                     reject(err);
//                 } else {
//                     connection.query(getSurvey_query, (err, result) => {
//                         connection.release();
//                         if (err) {
//                             reject(err);
//                         } else {
//                             resolve(result);
//                         }
//                     });
//                 }
//             });
//         });
//     }

//     try{
//         const surveyResults = await getSurveyResults();
//         console.log(surveyResults);

//         const get_all_attendance = mysql.format(
//             "SELECT a.userID\
//             FROM attendance a\
//             LEFT JOIN classes c ON c.idclasses = a.classID\
//             JOIN `courses-users` cu ON cu.userID = a.userID\
//             WHERE cu.courseID = ?\
//             ORDER BY a.userID",
//             [courseID]
//         );
//         console.log(get_all_attendance);
//         pool.getConnection(async(err, connection)=> {
//             if(err) throw (err);
//             try{
//                 await connection.query(get_all_attendance,
//                 async(err, result)=> {
//                     console.log(result);
//                     let attendance = [];
//                     let curUser = result[0].userID;
//                     let count = 1;
//                     let i = 1;
//                     let j = 0;
//                     while (i < result.length) {
    
//                         if (result[i].userID != curUser) {
//                             console.log(j);
//                             if(surveyResults[j].avg != null) {
//                             attendance.push({
//                                 'surveyAverage':surveyResults[j].avg,
//                                 'courseID':surveyResults[j].courseID,
//                                 'attendance': count})
//                             }
//                             curUser = result[i].userID;
//                             count = 0;
//                             j++;
//                         }
//                         count++;
//                         i++;
//                         console.log(curUser);
//                     }
//                     if(surveyResults[j].avg != null) {
//                         attendance.push({
//                             'surveyAverage':surveyResults[j].avg,
//                             'attendance': count})
//                         }

//                     console.log(attendance);
//                     res.send(attendance)
//                 });
//             } catch (err) {
//                 throw (err);
//             } finally {
//                 connection.release();
//             }
//         });
//     } catch (err) {
//         throw (err);
//     }

    
// })

app.put("/get-scatter-points", async(req,res) => {
    const courseID = req.body.courseID;


    const get_all_attendance = mysql.format(
        "SELECT sr.`avg` AS average, sr.userID\
        FROM `courses-users` cu\
        LEFT JOIN `survey-results` sr ON sr.userID = cu.userID\
        LEFT JOIN attendance a ON a.userID = cu.userID\
        WHERE cu.courseID = ? AND sr.courseID = ? AND NOT a.attendanceStatus =3\
        ORDER BY cu.userID",
        [courseID, courseID]
    );
    
    console.log(get_all_attendance);
    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);
        try{
            await connection.query(get_all_attendance,
            async(err, result)=> {
                let attendance = [];
                if (result.length > 0) {
                console.log(result);
                
                let curUser = result[0].userID;
                let count = 1;
                let i = 1;
                while (i < result.length) {
                    if (result[i].userID != curUser) {
                        console.log(j);
                        attendance.push({
                            'y':result[i].average,
                            'x': count,
                            'id':i
                        })
                        curUser = result[i].userID;
                        console.log(i);
                        count = 0;
                    }
                    count++;
                    i++;
                }

                attendance.push({
                    'y': result[i-1].average,
                    'x': count,
                    'id':i
                })
                console.log(attendance);
                }
                res.send(attendance)
            });
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }
    });
    
})

// app.put("/get-course-attendance", async(req,res) => {
//     const courseID = req.body.courseID;

//     const get_course_info = mysql.format(
//         "SELECT courseName, courseCode FROM courses\
//         WHERE idcourses = ? LIMIT 1",
//         [courseID]
//     );
//     function getCourseInfo() {
//         return new Promise((resolve, reject) => {
//             pool.getConnection((err, connection) => {
//                 if (err) {
//                     connection.release();
//                     reject(err);
//                 } else {
//                     connection.query(get_course_info, (err, result) => {
//                         connection.release();
//                         if (err) {
//                             reject(err);
//                         } else {
//                             resolve(result);
//                         }
//                     });
//                 }
//             });
//         });
//     }
//     try{
//         const course_info = await getCourseInfo();

//         const get_course_attendance = mysql.format(
//             "SELECT c.courseID FROM attendance a\
//             JOIN classes c ON c.idclasses = a.classID\
//             WHERE c.courseID = ?",
//             [courseID]
//         );
//         pool.getConnection(async(err, connection) => {
//             connection.release();

//             await connection.query(get_course_attendance,
//                 async(err, result)=> {
//                     const length = result.length;
//                     const { courseName, courseCode } = course_info[0];
//                     res.send({
//                         'course': courseName,
//                         'code': courseCode,
//                         'attendance': length,
//                     })
//                 });
//         });
//     } catch (err) {
//         throw (err);
//     }
    
// })


app.put("/get-user-course-attendance", async(req,res) => {
    const courseID = req.body.courseID;
    const userID = req.body.userID;

    const get_course_info = mysql.format(
        "SELECT courseName, courseCode FROM courses\
        WHERE idcourses = ? LIMIT 1",
        [courseID]
    );
    function getCourseInfo() {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    connection.release();
                    reject(err);
                } else {
                    connection.query(get_course_info, (err, result) => {
                        connection.release();
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                }
            });
        });
    }
    try{
        const course_info = await getCourseInfo();

        const get_course_attendance = mysql.format(
            "SELECT c.courseID FROM attendance a\
            JOIN classes c ON c.idclasses = a.classID\
            WHERE c.courseID = ? AND a.userID = ?",
            [courseID, userID]
        );
        pool.getConnection(async(err, connection) => {
            connection.release();

            await connection.query(get_course_attendance,
                async(err, result)=> {
                    const length = result.length;
                    const { courseName, courseCode } = course_info[0];
                    res.send({
                        'course': courseName,
                        'code': courseCode,
                        'attendance': length,
                    })
                });
        });
    } catch (err) {
        throw (err);
    }
    
})

app.put("/get-enrolled-courses", async(req,res) => {
    const userID = req.body.userID;
    
    const find_courses = mysql.format(
        "SELECT idcourses, courseName, courseCode FROM courses c\
        JOIN `courses-users` cu ON cu.courseID = c.idcourses\
        WHERE cu.userID = ?",
        [userID]
    )

    pool.getConnection(async(err, connection)=> {
        await connection.query(find_courses, 
            async(err, result)=> {
            
            res.send(result);
        });
    });
});

app.post("/set-survey-result", async(req,res) => {
    const userID = req.body.userID;
    const courseID = req.body.courseID;
    const q1 = req.body.q1;
    const q2 = req.body.q2;
    const q3 = req.body.q3;
    const q4 = req.body.q4;
    
    const find_query = mysql.format("SELECT userID FROM `survey-results` \
        WHERE userID = ? AND courseID = ? LIMIT 1", 
        [userID, courseID]);

    const insert_query = mysql.format ("INSERT INTO `survey-results` \
        (userID, courseID, q1, q2, q3, q4) VALUES (?, ?, ?, ?, ?, ?)", 
        [userID, courseID, q1, q2, q3, q4]);

    const update_query = mysql.format("UPDATE `survey-results` \
        SET q1 = ?, q2 = ?, q3 = ?, q4 = ?\
        WHERE userID = ? AND courseID = ?",
        [q1, q2, q3, q4, userID, courseID]);

        pool.getConnection(async(err, connection)=> {
            if(err) throw (err);
    
            try{
                await connection.query(find_query,
                async(err, result)=> {
                    console.log(find_query);
                    console.log(result);
                    if (result.length > 0) {
                        await connection.query(update_query);
                        console.log(update_query);
                        console.log("updated");
                    } else {
                        await connection.query(insert_query);
                        console.log(insert_query);
                        console.log("inserted");
                    }
                });
            } catch (err) {
                throw (err);
            } finally {
                connection.release();
            }
    });
});

// app.put("/get-user-survey-result", async(req,res) => {
//     const userID = req.body.userID;

//     const insert_query = mysql.format ("SELECT q1, q2, q3, q4 FROM `survey-results` \
//     WHERE userID = ? LIMIT 1", 
//     [userID]);

//     pool.getConnection(async(err, connection)=> {
//     await connection.query(insert_query, 
//         async(err, result)=> {
        
//         res.send({
//             'q1': result[0].q1,
//             'q2': result[0].q2,
//             'q3': result[0].q3,
//             'q4': result[0].q4,
//         })
//     });
//     });
// });

//scheduled calls for recording absences:
const absence = async(classID, time)=> {
    cron.schedule(time, async () => {
        try {
            const options = {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'class':classID
                }),
            }
            const response = fetch('http://18.223.107.181:3600/attendance-absent', options);
        } catch (error) {
            console.error('Error:', error);
        }
    });
}


// Not including tutorials or labs

// Monday
absence(2, '20 9 * * 1'); // math 115 - 9:20
absence(6, '20 10 * * 1'); // se 101 - 10:20
absence(4, '20 11 * * 1'); // math 117 - 11:20
absence(5, '20 14 * * 1'); // math 135 - 2:20

// Tuesday
absence(1, '50 9 * * 2'); // ece 105 - 9:50
absence(3, '20 11 * * 2'); // cs 137 - 11:20

// Wednesday
absence(2, '20 10 * * 3'); // math 115 - 10:20
absence(4, '20 11 * * 3'); // math 117 - 11:20
absence(6, '20 13 * * 3'); // se 101 - 1:20
absence(5, '20 14 * * 3'); // math 135 - 2:20

// Thursday
absence(1, '50 9 * * 4'); // ece 105 - 9:50
absence(3, '20 11 * * 4'); // cs 137 - 11:20
absence(2, '20 14 * * 4'); // math 115 - 2:20

// Friday
absence(4, '20 11 * * 5'); // math 117 - 11:20
absence(5, '20 14 * * 5'); // math 135 - 2:20


app.listen (port, ()=> {
    console.log('sdfsdfs');

});