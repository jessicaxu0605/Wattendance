import express from 'express';
import mysql from 'mysql';

const app = express();
app.use(express.json()); //if server recieves request with JSON body, automatically parse it and make available at req.body

const db = mysql.createPool({
    connectionLimit: 100,
    host: "127.0.0.1",
    user: "nodeaccess",
    password: "20940f9$3F30f",
    database: "se_site_users",
    port: "3306"
});

db.getConnection((err, connection)=> {
    if(err) throw (err);
    console.log("yeaaaaa" + connection.threadId);
});


app.get('/get', (req, res)=>{
    res.send('Hello');
});

app.post('/post', (req, res)=>{
    res.send(`Hello ${req.body.name}`);
});

app.listen (8000, ()=> {
    console.log('sdfsdfs');
});