require('dotenv').config();
const scheduler = require('../backend/src/services/scheduler');
const pool = require('../backend/src/db/pool');
(async () => {
  try {
    const result = await scheduler.runDueSchedules(100);
    console.log(JSON.stringify(result, null, 2));
    if (result.processed.some(item => item.status === 'failed')) process.exitCode = 2;
  } catch (error) {
    console.error('Falha ao executar dispatcher:', error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
