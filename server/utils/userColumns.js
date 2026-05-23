let cachedContactColumn = null;
let cachedUserColumns = null;

async function getUserColumns(pool) {
  if (cachedUserColumns) return cachedUserColumns;
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  cachedUserColumns = new Set(rows.map((row) => row.Field));
  return cachedUserColumns;
}

async function hasUserColumn(pool, column) {
  const columns = await getUserColumns(pool);
  return columns.has(column);
}

async function getUserContactColumn(pool) {
  if (cachedContactColumn) return cachedContactColumn;

  if (await hasUserColumn(pool, 'mobile')) {
    cachedContactColumn = 'mobile';
    return cachedContactColumn;
  }

  if (await hasUserColumn(pool, 'phone')) {
    cachedContactColumn = 'phone';
    return cachedContactColumn;
  }

  cachedContactColumn = 'mobile';
  return cachedContactColumn;
}

module.exports = { getUserColumns, hasUserColumn, getUserContactColumn };
