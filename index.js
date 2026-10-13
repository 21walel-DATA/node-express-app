// index.js
// The entry point: `npm start` and `npm run dev` run this file.
// Its only job is to start the server. The app itself is built in app.js.

const app = require('./app');

const PORT = process.env.PORT || 3000;

// Start listening
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
