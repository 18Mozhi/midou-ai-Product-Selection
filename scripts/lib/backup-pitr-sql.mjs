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

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ value) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

// Native 5.7 --rewrite-db can leave stale checksums. Accept only verified
// original events, rewrite the table-map namespace and recalculate its CRC.
function processPitrSql(source, inputDatabase, outputDatabase) {
  const sql = normalizeSql(source);
  const tableMaps = new Set();
  const output = [];
  let formatSeen = false;
  let inTransaction = false;
  let savepoints = [];
  let rowEvents = 0,
    mapEvents = 0;
  for (const raw of sql.split(";")) {
    const statement = raw.trim();
    if (!statement) continue;
    if (/^(?:BEGIN|COMMIT|ROLLBACK)$/i.test(statement)) {
      inTransaction = /^BEGIN$/i.test(statement);
      savepoints = [];
      output.push(statement);
      continue;
    }
    const savepoint = statement.match(
      /^(SAVEPOINT|ROLLBACK TO(?: SAVEPOINT)?|RELEASE SAVEPOINT)\s+(?:`([A-Za-z_][A-Za-z0-9_]{0,63})`|([A-Za-z_][A-Za-z0-9_]{0,63}))$/i,
    );
    if (savepoint) {
      if (!inTransaction) fail();
      const name = (savepoint[2] ?? savepoint[3]).toLowerCase();
      const index = savepoints.indexOf(name);
      if (savepoint[1].toUpperCase() === "SAVEPOINT") {
        if (index >= 0) savepoints.splice(index, 1);
        if (savepoints.length >= 1024) fail();
        savepoints.push(name);
      } else {
        if (index < 0) fail();
        if (/^ROLLBACK/i.test(savepoint[1])) savepoints = savepoints.slice(0, index + 1);
        else savepoints.splice(index, 1);
      }
      output.push(statement);
      continue;
    }
    if (/^SET TRANSACTION ISOLATION LEVEL READ COMMITTED$/i.test(statement)) {
      output.push(statement);
      continue;
    }
    if (statement === `use \`${inputDatabase}\`` || statement === `USE \`${inputDatabase}\``) {
      output.push(`USE \`${outputDatabase}\``);
      continue;
    }
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
      output.push(statement);
      continue;
    }
    const binary = statement.match(/^BINLOG\s+'([A-Za-z0-9+/=\s]+)'$/);
    if (!binary) fail();
    const encoded = binary[1].replace(/\s/g, "");
    // mysqlbinlog may encode events separately inside one BINLOG literal;
    // padding therefore can occur between events, not only at the very end.
    const segments = encoded.match(/[A-Za-z0-9+/]+={0,2}/g) || [];
    if (segments.join("") !== encoded) fail();
    const bytes = Buffer.concat(
      segments.map((segment) => {
        const decoded = Buffer.from(segment, "base64");
        if (decoded.toString("base64") !== segment) fail();
        return decoded;
      }),
    );
    const events = [];
    let offset = 0;
    while (offset < bytes.length) {
      if (offset + 19 > bytes.length) fail();
      const type = bytes[offset + 4],
        size = bytes.readUInt32LE(offset + 9);
      if (size < 23 || offset + size > bytes.length) fail();
      const event = bytes.subarray(offset, offset + size);
      if (event.readUInt32LE(size - 4) !== crc32(event.subarray(0, size - 4))) fail();
      let rewritten = event;
      if (type === 15) {
        if (
          size < 100 ||
          event.readUInt16LE(19) !== 4 ||
          event[75] !== 19 ||
          event[94] !== 8 ||
          event[size - 5] !== 1
        )
          fail();
        formatSeen = true;
        tableMaps.clear();
      } else if (type === 19) {
        if (!formatSeen || size < 34) fail();
        const schemaLength = event[27];
        if (28 + schemaLength >= size - 4 || event[28 + schemaLength] !== 0) fail();
        if (event.subarray(28, 28 + schemaLength).toString("utf8") !== inputDatabase) fail();
        tableMaps.add(event.subarray(19, 25).toString("hex"));
        mapEvents += 1;
        if (inputDatabase !== outputDatabase) {
          const name = Buffer.from(outputDatabase, "utf8");
          rewritten = Buffer.concat([
            event.subarray(0, 27),
            Buffer.from([name.length]),
            name,
            event.subarray(28 + schemaLength, size - 4),
            Buffer.alloc(4),
          ]);
          rewritten.writeUInt32LE(rewritten.length, 9);
          rewritten.writeUInt32LE(crc32(rewritten.subarray(0, -4)), rewritten.length - 4);
        }
      } else if ([23, 24, 25, 30, 31, 32].includes(type)) {
        if (size < 27 || !tableMaps.has(event.subarray(19, 25).toString("hex"))) fail();
        rowEvents += 1;
      } else fail();
      events.push(rewritten);
      offset += size;
    }
    output.push(`BINLOG '${Buffer.concat(events).toString("base64")}'`);
  }
  if (!mapEvents || !rowEvents) fail();
  return {
    sql: output.join(";\n") + ";\n",
    boundary: {
      mapEvents,
      rowEvents,
      targetDatabase: outputDatabase,
      eventChecksumsVerified: true,
    },
  };
}

export function validatePitrSql(source, restoreDatabase) {
  if (!/^product_scout_restore_m0704_[a-f0-9]{12}$/.test(restoreDatabase)) fail();
  return processPitrSql(source, restoreDatabase, restoreDatabase).boundary;
}

export function rewritePitrSql(source, sourceDatabase, restoreDatabase) {
  if (
    sourceDatabase !== "product_scout" ||
    !/^product_scout_restore_m0704_[a-f0-9]{12}$/.test(restoreDatabase)
  )
    fail();
  const result = processPitrSql(source, sourceDatabase, restoreDatabase);
  validatePitrSql(result.sql, restoreDatabase);
  return result;
}
