const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());


app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // login verification test
    if (username === 'admin' && password === 'password123') {
        res.json({ success: true, message: 'Login successful!' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.listen(5000, () => {
    console.log('Backend server running on http://localhost:5000');
});