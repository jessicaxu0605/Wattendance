import express from 'express';

const app = express();
app.use(express.json()); //if server recieves request with JSON body, automatically parse it and make available at req.body

app.get('/get', (req, res)=>{
    res.send('Hello');
});

app.post('/post', (req, res)=>{
    res.send(`Hello ${req.body.name}`);
});

app.listen (8000, ()=> {
    console.log('sdfsdfs');
});