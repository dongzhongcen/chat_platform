CREATE DATABASE IF NOT EXISTS socketio_chat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE socketio_chat;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires BIGINT UNSIGNED NOT NULL,
  data MEDIUMTEXT
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(32) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_online BOOLEAN DEFAULT TRUE,
  last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
  id CHAR(36) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(32) UNIQUE,
  type ENUM('public', 'private') NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  from_user CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  content TEXT,
  INDEX idx_messages_channel_id (channel_id),
  CONSTRAINT fk_messages_from_user FOREIGN KEY (from_user) REFERENCES users (id),
  CONSTRAINT fk_messages_channel_id FOREIGN KEY (channel_id) REFERENCES channels (id)
);

CREATE TABLE IF NOT EXISTS user_channels (
  user_id CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  client_offset BIGINT UNSIGNED NULL,
  UNIQUE KEY idx_user_channels_user_id_channel_id (user_id, channel_id),
  INDEX idx_user_channels_channel_id (channel_id),
  CONSTRAINT fk_user_channels_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_user_channels_channel_id FOREIGN KEY (channel_id) REFERENCES channels (id),
  CONSTRAINT fk_user_channels_client_offset FOREIGN KEY (client_offset) REFERENCES messages (id)
);

CREATE TABLE IF NOT EXISTS deleted_user_channels (
  user_id CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, channel_id),
  INDEX idx_deleted_user_channels_channel_id (channel_id),
  CONSTRAINT fk_deleted_user_channels_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_deleted_user_channels_channel_id FOREIGN KEY (channel_id) REFERENCES channels (id)
);

INSERT IGNORE INTO channels (id, name, type)
VALUES (UUID(), 'General', 'public');
