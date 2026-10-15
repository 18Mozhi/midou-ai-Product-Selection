const allowedVariables = new Set([
  "PSEUDO_SLAVE_MODE",
  "OLD_COMPLETION_TYPE",
  "COMPLETION_TYPE",
  "SQL_LOG_BIN",
  "OLD_SQL_LOG_BIN",
  "GTID_NEXT",
  "TIMESTAMP",
  "PSEUDO_THREAD_ID",
  "FOREIGN_KEY_CHECKS",
  "SQL_AUTO_IS_NULL",
  "UNIQUE_CHECKS",
  "AUTOCOMMIT",
  "SQL_MODE",
  "AUTO_INCREMENT_INCREMENT",
  "AUTO_INCREMENT_OFFSET",
  "CHARACTER_SET_CLIENT",
  "COLLATION_CONNECTION",
  "COLLATION_SERVER",
  "TIME_ZONE",
  "LC_TIME_NAMES",
  "COLLATION_DATABASE",
]);
const fail = () => {
  throw Object.assign(new Error("Isolated PITR SQL boundary rejected"), {
    code: "backup_pitr_sql_unsafe",
  });
};

export function verifyPitrMarker(marker, expected) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(expected) || marker !== expected) {
    throw Object.assign(
      new Error("Post-snapshot probe was not restored by isolated binlog replay"),
      { code: "backup_pitr_replay_unverified" },
    );
  }
}

function normalizeSql(source) {
  let result = "";
  for (let i = 0; i < source.length;) {
    if (source[i] === "'") {
      const end = source.indexOf("'", i + 1);
      if (end < 0) fail();
      const literal = source.slice(i + 1, end);
      if (/[;\\#]/.test(literal) || literal.includes("/*")) fail();
      result += source.slice(i, end + 1);
      i = end + 1;
    } else if (source[i] === "#") {
      const end = source.indexOf("\n", i);
      i = end < 0 ? source.length : end;
    } else if (source.startsWith("/*!*/;", i)) {
      result += ";";
      i += 6;
    } else if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) fail();
      const comment = source.slice(i + 2, end);
      if (comment.startsWith("!")) {
        if (/^!\\C [A-Za-z0-9_]+ $/.test(comment)) {
          /* mysql client charset directive */
        } else if (/^!\d{5}\s/.test(comment)) result += normalizeSql(comment.slice(6));
        else fail();
      }
      i = end + 2;
    } else {
      result += source[i];
      i += 1;
    }
  }
  return result.replace(/^DELIMITER ;\s*$/gm, "");
}

// mysqlbinlog --rewrite-db rewrites row-event table maps, not arbitrary SQL.
// Validate both the executable SQL and binary event targets before using root.
export function validatePitrSql(source, restoreDatabase) {
  if (!/^product_scout_restore_m0704_[a-f0-9]{12}$/.test(restoreDatabase)) fail();
  const sql = normalizeSql(source);
  const tableMaps = new Set();
  let rowEvents = 0,
    mapEvents = 0;
  for (const raw of sql.split(";")) {
    const statement = raw.trim();
    if (!statement) continue;
    if (/^(?:BEGIN|COMMIT|ROLLBACK)$/i.test(statement)) continue;
    if (statement === `use \`${restoreDatabase}\`` || statement === `USE \`${restoreDatabase}\``)
      continue;
    if (/^SET\s/i.test(statement)) {
      for (const assignment of statement.slice(3).split(",")) {
        const match = assignment.trim().match(/^(?:@@(?:SESSION\.)?|@)?([A-Z_]+)\s*=\s*(.+)$/i);
        if (!match || !allowedVariables.has(match[1].toUpperCase())) fail();
        if (
          !/^(?:-?\d+(?:\.\d+)?|0x[0-9a-f]+|DEFAULT|NULL|@[A-Z_]+|@@(?:SESSION\.)?[A-Z_]+|'[^'\\;]*')$/i.test(
            match[2],
          )
        )
          fail();
      }
      continue;
    }
    const binary = statement.match(/^BINLOG\s+'([A-Za-z0-9+/=\s]+)'$/);
    if (!binary) fail();
    const encoded = binary[1].replace(/\s/g, "");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) fail();
    let offset = 0;
    while (offset < bytes.length) {
      if (offset + 19 > bytes.length) fail();
      const type = bytes[offset + 4],
        size = bytes.readUInt32LE(offset + 9);
      if (size < 19 || offset + size > bytes.length) fail();
      const event = bytes.subarray(offset, offset + size);
      if (type === 19) {
        if (size < 30) fail();
        const schemaLength = event[27];
        if (28 + schemaLength >= size || event[28 + schemaLength] !== 0) fail();
        if (event.subarray(28, 28 + schemaLength).toString("utf8") !== restoreDatabase) fail();
        tableMaps.add(event.subarray(19, 25).toString("hex"));
        mapEvents += 1;
      } else if ([23, 24, 25, 30, 31, 32].includes(type)) {
        if (size < 27 || !tableMaps.has(event.subarray(19, 25).toString("hex"))) fail();
        rowEvents += 1;
      } else if (type !== 15) fail();
      offset += size;
    }
  }
  if (!mapEvents || !rowEvents) fail();
  return { mapEvents, rowEvents, targetDatabase: restoreDatabase };
}
