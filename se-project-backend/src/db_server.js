import express from 'express';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import cors from 'cors';
import util from 'util';

const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
}));
const port = 80;

const pool = mysql.createPool({
    connectionLimit: 100,
    host: "database-1.cmxjvvdu8k9n.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "teamcircus",
    database: "se_site",
    port: "3306"
});

//-----------------------------------------

//password for testing accounts is: 39fji3jifdjf

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

                //temp: DELETE LATER!!!
                'user': {
                    'id': '1',
                    'firstName': 'wow',
                    'lastName': 'wowow',
                    'email': 'wow@sf.com',
                }
            }));
        }
    )
});

app.post("/attendance-present", async(req,res) => {
    const userID = req.body.user;

    const datetime = new Date();
    const sqlDatetime= datetime.toISOString().slice(0, 19).replace('T', ' ');

    const find_present_class = mysql.format(
        "SELECT idclasses FROM classes WHERE TIMESTAMPDIFF(15 MINUTE, '?', startTime) LIMIT 1", 
        [sqlDatetime]);
        console.log(sqlDatetime);
    const find_late_class = mysql.format(
        "SELECT idclasses FROM classes WHERE ? > startTime AND ? < endTime LIMIT 1", 
        [sqlDatetime, sqlDatetime]);

    pool.getConnection(async(err, connection)=> {
        if(err) throw (err);

        try{
            await connection.query(find_present_class,
            async(err, result)=> {
                if (result.length > 0) {
                    const classID = result[0].idclasses;
                    const insert_query = mysql.format(
                        "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 0, ?)", 
                        [classID, userID, sqlDatetime]);
                    await connection.query(insert_query);
                    console.log("present");
                } else {
                    await connection.query(find_late_class,
                        async(err, lateResult)=> {
                            if (lateResult.length > 0) {
                                const classID = lateResult[0].idclasses;
                                const insert_query = mysql.format(
                                    "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 1, ?)", 
                                    [classID, userID, sqlDatetime]);
                                await connection.query(insert_query);
                                console.log("late");
                            } else {
                                console.log("no classes");
                            }
                        }
                    );
                }
            });
            res.send("yeek");
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }
    });
})

app.post("/attendance-absent", async(req,res) => {
    const userIDs = req.body.users;

    const datetime = new Date();
    const sqlDatetime= datetime.toISOString().slice(0, 19).replace('T', ' ');

    const find_class = mysql.format("SELECT idclasses WHERE ABS(TIMESTAMPDIFF(MINUTE, endTime, '?'))", [sqlDatetime]);

    pool.getConnection(async(err, connection)=>{
        if(err) throw (err);

        try{
            for (let userID in userIDs) {
                const insert_query = mysql.format(
                    "INSERT INTO attendance (`classID`, `userID`, `attendanceStatus`, `datetime`) VALUES (?, ?, 2, ?)", 
                    [classID, userID, sqlDatetime]);
                await connection.query(insert_query);
                console.log("absent");
            }
            res.send("ffff");
        } catch (err) {
            throw (err);
        } finally {
            connection.release();
        }

    })

});

app.listen (port, ()=> {
    console.log('sdfsdfs');
});