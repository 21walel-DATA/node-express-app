// index.js
// The entry point: `npm start` and `npm run dev` run this file.
// Its only job is to start the server. The app itself is built in app.js.

const app = require('./app');
const { seedOnStartup } = require('./scripts/seed');

// Add the made-up students first, but only if SEED_DEMO_DATA is 'true'.
// This lives here and not in app.js, because the tests load app.js and
// must never seed by accident.
if (seedOnStartup(process.env)) {
  console.log('SEED_DEMO_DATA is on: the made-up students have been added.');
}

const PORT = process.env.PORT || 3000;

// Start listening
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
