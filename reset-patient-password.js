// Quick script to generate bcrypt hash for Password1#
const bcrypt = require('bcrypt');

const password = 'Password1#';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('');
  console.log('SQL UPDATE:');
  console.log(`UPDATE patients SET portal_password_hash = '${hash}', portal_access_enabled = true, portal_email_verified = true WHERE email = 'mkize@example.com';`);
  process.exit(0);
});

