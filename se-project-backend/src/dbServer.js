import express from 'express';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

const app = express();
app.use(express.json());
const port = "3600"

const db = mysql.createPool({
    connectionLimit: 100,
    host: "database-1.cmxjvvdu8k9n.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "teamcircus",
    database: "se_site",
    port: "3306"
});

//-----------------------------------------



app.put("/find", (req,res) => {
    const search = "SELECT * FROM users WHERE email = ?";
    const email = req.body.email;
    const sql_query = mysql.format(search, [email])

    db.getConnection(async(err, connection)=> {
        connection.release();

        if(err) throw (err);

        await connection.query(sql_query,
            async (err, result) => {
                if (err) throw (err)
                console.log("Search Results:")
                console.log(result[0].email);
                res.send("Search Results: "+ result[0].email);
                found = result.length;
            }
        );
    });
});




app.put("/create", async(req,res) => {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const hashedPW = await bcrypt.hash(req.body.password, 10); //stores hashed password
    const email = req.body.email;

    const find_query = mysql.format("SELECT * FROM users WHERE email = ?", [email]);
    const insert_query = mysql.format ("INSERT INTO users VALUES (0, ?, ?, ?, ?)", [firstName, lastName, email, hashedPW]);

    db.getConnection(async(err, connection)=> {
        if(err) throw (err);

        //search for users registered under the email
        await connection.query(find_query,
            async (err, result) => {
                if (err) throw (err)

                //if there are no accounts registered under the email,
                if (result.length == 0) {
                    if(err) throw (err);
                    
                    //register the account
                    await connection.query(insert_query,
                        async (err, result) => {
                            connection.release();
                            if (err) throw (err)
                            res.send("user created");
                        }
                    );

                } 

                //otherwise, don't register new account, alert client
                else {
                    console.log("Search Results:")
                    console.log(result[0].firstName);
                    res.send(email +" already has an account")
                }
            }
        );
    });
});






