const db = require('./index');

const count = db.prepare('SELECT COUNT(*) AS n FROM doctors').get().n;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO doctors (name, specialty, governorate, city, phone) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run('Dr. Sami Ben Ali', 'Cardiologue', 'Tunis', 'Tunis', '71 000 001');
  insert.run('Dr. Leila Trabelsi', 'Dentiste', 'Sfax', 'Sfax', '74 000 002');
  insert.run('Dr. Karim Gharbi', 'Pédiatre', 'Tataouine', 'Tataouine', '75 000 003');
  console.log('Médecins ajoutés');
} else {
  console.log('La table doctors contient déjà des données');
}