import express from 'express';
import mysql from 'mysql';

const app = express();

const db = mysql.createPool({
    connectionLimit: 100,
    host: "127.0.0.1",
    user: "testing",
    password: "39f8#Hhfk93f3l23@",
    database: "se_site_users",
    port: "3306"
});

db.getConnection((err, connection)=> {
    if(err) throw (err);
    console.log("yeaaaaa" + connection.threadId);
});
