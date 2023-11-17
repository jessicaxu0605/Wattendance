import express from 'express';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
}));
const port = 3600;

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

    const find_query = mysql.format("SELECT * FROM users WHERE email = ?", [email]);
    const insert_query = mysql.format ("INSERT INTO users VALUES (0, ?, ?, ?, ?)", [firstName, lastName, email, hashedPW]);

    findUser(pool, find_query,
        //if user found:
        (result)=> {
            console.log("Account already exists for email:")
            console.log(result[0].email)
            res.send(`There is already an account registered under ${email}`)
        },
        //if user not found:
        (result) => {
            pool.getConnection(async(err, connection)=> {
            await connection.query(insert_query,
                async (err, result) => {
                    connection.release();
                    if (err) throw (err);
                    res.send("user created");
                }
            )
            })
        }
    )
});

app.put("/test", (req, res) => {
    console.log("ok");
})

app.put("/login", async(req,res) => {
    const email = req.body.email;
    const password = req.body.password;

    const find_query = mysql.format("SELECT * FROM users WHERE email = ?", [email]);
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
                        'user': result[0],
                    });
                } 
                else {
                    console.log("Password Incorrect");
                    res.send(JSON.stringify({
                        'status': 'unsuccessful',
                        'error': 'passwordIncorrect'
                    }))
                }
            })
        },
        //if user not found:
        (result) => {
            console.log("User Does Not Exist");
            res.send(JSON.stringify({
                'status': 'unsuccessful',
                'error': 'noUser'
            }));
        }
    )
});


//-----------------------------------------

app.listen (port, ()=> {
    console.log('sdfsdfs');
});