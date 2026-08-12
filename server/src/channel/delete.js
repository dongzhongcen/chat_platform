import { ajv, logger, userRoom, channelRoom } from "../util.js";

const validate = ajv.compile({
  type: "object",
  properties: {
    channelId: { type: "string", format: "uuid" },
  },
  required: ["channelId"],
  additionalProperties: false,
});

export function deleteChannel({ io, socket, db }) {
  return async (payload, callback) => {
    if (typeof callback !== "function") {
      return;
    }

    if (!validate(payload)) {
      return callback({
        status: "ERROR",
        errors: validate.errors,
      });
    }

    try {
      await db.deleteUserChannel(socket.userId, payload.channelId);
    } catch (e) {
      return callback({
        status: "ERROR",
      });
    }

    logger.info(
      "conversation [%s] was deleted by user [%s]",
      payload.channelId,
      socket.userId,
    );

    io.in(userRoom(socket.userId)).socketsLeave(channelRoom(payload.channelId));
    socket.to(userRoom(socket.userId)).emit("channel:deleted", payload);

    callback({
      status: "OK",
    });
  };
}
