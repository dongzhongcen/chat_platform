import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

function escapeLike(str) {
  return str.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    isOnline: Boolean(row.is_online),
  };
}

function mapChannel(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    users: row.users ? row.users.split(",").filter(Boolean) : [],
    userCount: Number(row.user_count),
    unreadCount: Number(row.unread_count),
  };
}

function limit(size, extra = 0) {
  return Math.max(1, Math.min(Number(size) + extra, 101));
}

async function inTransaction(pool, fn) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getChannel(conn, userId, channelId) {
  const [rows] = await conn.execute(
    `
    SELECT
      c.id,
      c.name,
      c.type,
      (
        SELECT COUNT(*) FROM user_channels WHERE channel_id = c.id
      ) AS user_count,
      (
        CASE WHEN c.type = 'public'
        THEN ''
        ELSE COALESCE((
          SELECT GROUP_CONCAT(uc2.user_id)
          FROM user_channels uc2
          WHERE uc2.channel_id = c.id
          AND uc2.user_id <> ?
        ), '')
        END
      ) AS users,
      (
        SELECT COUNT(*) FROM messages WHERE channel_id = c.id AND id > COALESCE(uc.client_offset, 0)
      ) AS unread_count
    FROM channels c
    JOIN user_channels uc ON uc.channel_id = c.id
    WHERE
      uc.user_id = ?
      AND c.id = ?
    `,
    [userId, userId, channelId],
  );

  return rows.length === 1 ? mapChannel(rows[0]) : undefined;
}

export class DB {
  static createPool(config) {
    return mysql.createPool({
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
      database: "socketio_chat",
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      ...config,
    });
  }

  constructor(mysqlPool) {
    this.mysqlPool = mysqlPool;
  }

  async findUserByUsername(username) {
    const [rows] = await this.mysqlPool.execute(
      "SELECT id, password FROM users WHERE username = ?",
      [username],
    );

    return rows[0];
  }

  createUser({ username, hashedPassword }) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const userId = randomUUID();
      await conn.execute(
        "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
        [userId, username, hashedPassword],
      );

      const [channels] = await conn.execute(
        "SELECT id FROM channels WHERE name = 'General'",
      );
      const channelId = channels[0].id;

      await conn.execute(
        "INSERT INTO user_channels (user_id, channel_id) VALUES (?, ?)",
        [userId, channelId],
      );

      return userId;
    });
  }

  async setUserIsConnected(userId) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const [rows] = await conn.execute(
        "SELECT is_online FROM users WHERE id = ? FOR UPDATE",
        [userId],
      );

      const wasOnline = rows.length === 1 ? Boolean(rows[0].is_online) : false;

      await conn.execute(
        "UPDATE users SET is_online = TRUE, last_ping = CURRENT_TIMESTAMP WHERE id = ?",
        [userId],
      );

      return wasOnline;
    });
  }

  async setUserIsDisconnected(userId) {
    await this.mysqlPool.execute(
      "UPDATE users SET is_online = FALSE WHERE id = ?",
      [userId],
    );
  }

  async cleanupZombieUsers() {
    const [rows] = await this.mysqlPool.execute(
      `
      SELECT id
      FROM users
      WHERE is_online = TRUE
      AND last_ping < CURRENT_TIMESTAMP - INTERVAL 1 DAY
      `,
    );

    if (rows.length) {
      await this.mysqlPool.query(
        "UPDATE users SET is_online = FALSE WHERE id IN (?)",
        [rows.map((row) => row.id)],
      );
    }

    return rows.map((row) => row.id);
  }

  async isUserInChannel(userId, channelId) {
    const [rows] = await this.mysqlPool.execute(
      "SELECT 1 FROM user_channels WHERE channel_id = ? AND user_id = ?",
      [channelId, userId],
    );

    return rows.length === 1;
  }

  async getUser(userId) {
    const [rows] = await this.mysqlPool.execute(
      "SELECT id, username, is_online FROM users WHERE id = ?",
      [userId],
    );

    return rows.length === 1 ? mapUser(rows[0]) : undefined;
  }

  async searchUsers(userId, { q, size }) {
    const limitSize = limit(size);
    const [rows] = await this.mysqlPool.execute(
      `
      SELECT
        id,
        username
      FROM users
      WHERE
        username LIKE ? ESCAPE '\\\\'
        AND id <> ?
        AND id NOT IN (
          SELECT DISTINCT user_id
          FROM user_channels
          WHERE channel_id IN (
            SELECT channel_id
            FROM channels c
            JOIN user_channels uc ON uc.channel_id = c.id
            WHERE
              uc.user_id = ?
              AND c.type = 'private'
          )
        )
        AND id NOT IN (
          SELECT uc.user_id
          FROM user_channels uc
          JOIN deleted_user_channels duc ON duc.channel_id = uc.channel_id
          JOIN channels c ON c.id = uc.channel_id
          WHERE
            duc.user_id = ?
            AND c.type = 'private'
        )
      LIMIT ${limitSize}
      `,
      [escapeLike(q) + "%", userId, userId, userId],
    );

    return rows;
  }

  async createPublicChannel(userId, { name }) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const channelId = randomUUID();
      await conn.execute(
        "INSERT INTO channels (id, name, type) VALUES (?, ?, ?)",
        [channelId, name, "public"],
      );

      await conn.execute(
        "INSERT INTO user_channels(user_id, channel_id) VALUES (?, ?)",
        [userId, channelId],
      );

      return getChannel(conn, userId, channelId);
    });
  }

  async createPrivateChannel(userId, userIds) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const channelId = randomUUID();
      await conn.execute(
        "INSERT INTO channels (id, type) VALUES (?, 'private')",
        [channelId],
      );

      await conn.execute(
        "INSERT INTO user_channels(user_id, channel_id) VALUES (?, ?), (?, ?)",
        [userId, channelId, userIds[0], channelId],
      );

      return getChannel(conn, userId, channelId);
    });
  }

  async joinChannel(userId, channelId) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const [deletedRows] = await conn.execute(
        "SELECT 1 FROM deleted_user_channels WHERE user_id = ? AND channel_id = ?",
        [userId, channelId],
      );

      if (deletedRows.length) {
        throw new Error("channel was deleted by user");
      }

      await conn.execute(
        "INSERT INTO user_channels (user_id, channel_id) VALUES (?, ?)",
        [userId, channelId],
      );

      return getChannel(conn, userId, channelId);
    });
  }

  async deleteUserChannel(userId, channelId) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const [rows] = await conn.execute(
        "SELECT type FROM channels WHERE id = ?",
        [channelId],
      );

      if (!rows.length) {
        return;
      }

      await conn.execute(
        "INSERT IGNORE INTO deleted_user_channels (user_id, channel_id) VALUES (?, ?)",
        [userId, channelId],
      );

      await conn.execute(
        "DELETE FROM user_channels WHERE user_id = ? AND channel_id = ?",
        [userId, channelId],
      );

      if (rows[0].type === "private") {
        const [members] = await conn.execute(
          "SELECT COUNT(*) AS count FROM user_channels WHERE channel_id = ?",
          [channelId],
        );

        if (Number(members[0].count) === 0) {
          await conn.execute("DELETE FROM deleted_user_channels WHERE channel_id = ?", [
            channelId,
          ]);
          await conn.execute("DELETE FROM messages WHERE channel_id = ?", [
            channelId,
          ]);
          await conn.execute("DELETE FROM channels WHERE id = ?", [channelId]);
        }
      }
    });
  }

  async listChannels(userId, query) {
    const limitSize = limit(query.size, 1);
    const [rows] = await this.mysqlPool.execute(
      `
      SELECT
        c.id,
        c.name,
        c.type,
        (
          SELECT COUNT(*) FROM user_channels WHERE channel_id = c.id
        ) AS user_count,
        (
          CASE WHEN c.type = 'public'
          THEN ''
          ELSE COALESCE((
            SELECT GROUP_CONCAT(uc2.user_id)
            FROM user_channels uc2
            WHERE uc2.channel_id = c.id
            AND uc2.user_id <> ?
          ), '')
          END
        ) AS users,
        (
          SELECT COUNT(*) FROM messages WHERE channel_id = c.id AND id > COALESCE(uc.client_offset, 0)
        ) AS unread_count
      FROM channels c
      JOIN user_channels uc ON uc.channel_id = c.id
      WHERE uc.user_id = ?
      ORDER BY c.name ASC
      LIMIT ${limitSize}
      `,
      [userId, userId],
    );

    const hasMore = rows.length > query.size;

    if (hasMore) {
      rows.pop();
    }

    return {
      data: rows.map(mapChannel),
      hasMore,
    };
  }

  async searchChannels(userId, { q, size }) {
    const limitSize = limit(size);
    const [rows] = await this.mysqlPool.execute(
      `
      SELECT
        c.id,
        c.name,
        c.type,
        COALESCE((
          SELECT GROUP_CONCAT(uc.user_id)
          FROM user_channels uc
          WHERE uc.channel_id = c.id
          AND uc.user_id <> ?
        ), '') AS users,
        (
          SELECT COUNT(*) FROM user_channels WHERE channel_id = c.id
        ) AS user_count,
        0 AS unread_count
      FROM channels c
      WHERE
        c.name LIKE ? ESCAPE '\\\\'
        AND c.id NOT IN (
          SELECT channel_id FROM user_channels WHERE user_id = ?
        )
        AND c.id NOT IN (
          SELECT channel_id FROM deleted_user_channels WHERE user_id = ?
        )
      LIMIT ${limitSize}
      `,
      [userId, escapeLike(q) + "%", userId, userId],
    );

    return rows.map(mapChannel);
  }

  async fetchUserChannels(userId) {
    const [rows] = await this.mysqlPool.execute(
      "SELECT channel_id FROM user_channels WHERE user_id = ?",
      [userId],
    );

    return rows.map((row) => row.channel_id);
  }

  insertMessage(message) {
    return inTransaction(this.mysqlPool, async (conn) => {
      const [result] = await conn.execute(
        "INSERT INTO messages (from_user, channel_id, content) VALUES (?, ?, ?)",
        [message.from, message.channelId, message.content],
      );

      const messageId = String(result.insertId);

      await conn.execute(
        `
        UPDATE user_channels
        SET client_offset = ?
        WHERE
          user_id = ?
          AND channel_id = ?
        `,
        [messageId, message.from, message.channelId],
      );

      return messageId;
    });
  }

  async listMessages(query) {
    const limitSize = limit(query.size, 1);
    const params = [query.channelId];
    let afterClause = "";
    let orderClause = "ORDER BY id ASC";

    if (query.orderBy === "id:desc") {
      orderClause = "ORDER BY id DESC";
      if (query.after) {
        afterClause = "AND id < ?";
        params.push(query.after);
      }
    } else if (query.after) {
      afterClause = "AND id > ?";
      params.push(query.after);
    }

    const [rows] = await this.mysqlPool.execute(
      `
      SELECT id, from_user, channel_id, content
      FROM messages
      WHERE channel_id = ?
      ${afterClause}
      ${orderClause}
      LIMIT ${limitSize}
      `,
      params,
    );

    const hasMore = rows.length > query.size;

    if (hasMore) {
      rows.pop();
    }

    return {
      data: rows.map((row) => ({
        id: String(row.id),
        channelId: row.channel_id,
        from: row.from_user,
        content: row.content,
      })),
      hasMore,
    };
  }

  ackMessage(userId, { channelId, messageId }) {
    return this.mysqlPool.execute(
      `
      UPDATE user_channels
      SET client_offset = ?
      WHERE
        user_id = ?
        AND channel_id = ?
        AND (client_offset IS NULL OR client_offset < ?)
      `,
      [messageId, userId, channelId, messageId],
    );
  }
}
