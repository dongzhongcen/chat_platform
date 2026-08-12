USE socketio_chat;

CREATE TABLE IF NOT EXISTS deleted_user_channels (
  user_id CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, channel_id),
  INDEX idx_deleted_user_channels_channel_id (channel_id),
  CONSTRAINT fk_deleted_user_channels_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_deleted_user_channels_channel_id FOREIGN KEY (channel_id) REFERENCES channels (id)
);
