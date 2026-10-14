// index.js
// The entry point: `npm start` and `npm run dev` run this file.
// Its only job is to start the server. The app itself is built in app.js.

const app = require('./app');
const { seedOnStartup } = require('./scripts/seed');
const { createAdminOnStartup } = require('./scripts/create-admin');

// Add the made-up students first, but only if SEED_DEMO_DATA is 'true'.
// This lives here and not in app.js, because the tests load app.js and
// must never seed by accident.
if (seedOnStartup(process.env)) {
  console.log('SEED_DEMO_DATA is on: the made-up students have been added.');
}

// Create the first admin, but only if ADMIN_EMAIL and ADMIN_PASSWORD are set.
// try/catch: if the details are wrong (for example the password is too
// short), print why and carry on starting. One wrong setting should not
// take the whole site down.
try {
  const adminResult = createAdminOnStartup(process.env);
  if (adminResult) {
    console.log(`ADMIN_EMAIL is set: admin ${adminResult}. Remove the ADMIN_ variables now.`);
  }
} catch (error) {
  console.error(`Could not create the admin: ${error.message}`);
}

const PORT = process.env.PORT || 3000;

// Start listening
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
