const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Test server is running on localhost!');
});

const PORT = process.env.TEST_PORT || 3002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
