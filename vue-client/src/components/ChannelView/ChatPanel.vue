<script setup>
import { computed, ref, watch } from "vue";
import { useMainStore } from "@/stores/main";
import Username from "@/components/Username.vue";
import { socket } from "@/BackendService";
import VBtn from "@/components/common/VBtn.vue";
import PublicChannelLabel from "@/components/ChannelView/PublicChannelLabel.vue";
import PrivateChannelLabel from "@/components/ChannelView/PrivateChannelLabel.vue";
import { useI18nStore } from "@/stores/i18n";

const store = useMainStore();
const i18n = useI18nStore();
const isLoading = ref(false);
const isTyping = ref(false);

function submit() {
  const content = store.selectedChannel.messageInput;

  if (!content) {
    return;
  }

  store.sendMessage(content);

  store.selectedChannel.messageInput = "";

  onInput();
}

function onInput() {
  if (isTyping.value && store.selectedChannel.messageInput.length === 0) {
    isTyping.value = false;
    socket.emit("message:typing", {
      channelId: store.selectedChannelId,
      isTyping: false,
    });
  } else if (!isTyping.value && store.selectedChannel.messageInput.length > 0) {
    isTyping.value = true;
    socket.emit("message:typing", {
      channelId: store.selectedChannelId,
      isTyping: true,
    });
  }
}

async function loadMore() {
  isLoading.value = true;

  await store.loadMessagesForSelectedChannel("backward", true);

  setTimeout(() => {
    isLoading.value = false;
  }, 200);
}

function shouldPrintHeader(message, index) {
  return index === 0 || store.messages[index - 1].from !== message.from;
}

const someoneIsTyping = computed(() => {
  if (store.selectedChannel?.typingUsers.size) {
    const usernames = [];

    store.selectedChannel?.typingUsers.forEach(({ username }) => {
      usernames.push(username);
    });

    return i18n.t("isTyping", { names: usernames.join(", ") });
  }
});

const statusUsers = computed(() => {
  const userIds = new Set();

  if (store.selectedChannel.type === "private") {
    store.selectedChannel.users.forEach((userId) => userIds.add(userId));
  } else {
    store.messages.forEach((message) => {
      if (message.from !== store.currentUser.id) {
        userIds.add(message.from);
      }
    });

    store.selectedChannel.typingUsers.forEach((_user, userId) => {
      if (userId !== store.currentUser.id) {
        userIds.add(userId);
      }
    });
  }

  return [...userIds].map((userId) => {
    const user = store.users.get(userId);
    const isTypingNow = store.selectedChannel.typingUsers.has(userId);

    return {
      id: userId,
      isTyping: isTypingNow,
      isOnline: Boolean(user?.isOnline),
      statusLabel: isTypingNow
        ? i18n.t("statusTyping")
        : user?.isOnline
          ? i18n.t("statusOnline")
          : i18n.t("statusOffline"),
    };
  });
});

watch(
  () => statusUsers.value.map((user) => user.id).join(","),
  () => {
    statusUsers.value.forEach((user) => {
      store.getUser(user.id);
    });
  },
);
</script>

<template>
  <div
    v-if="store.isInitialized && store.selectedChannel"
    class="d-flex flex-column w-100 p-3"
  >
    <div class="mb-3">
      <PublicChannelLabel
        v-if="store.selectedChannel.type === 'public'"
        :channel="store.selectedChannel"
      ></PublicChannelLabel>

      <PrivateChannelLabel
        v-else
        :channel="store.selectedChannel"
      ></PrivateChannelLabel>
    </div>

    <div class="mb-auto overflow-auto">
      <div class="text-center" v-if="store.selectedChannel.hasMore">
        <v-btn
          color="primary"
          outlined
          :loading="isLoading"
          @click="loadMore"
          icon="arrow-up"
        >
          {{ i18n.t("loadMore") }}
        </v-btn>
      </div>

      <p v-if="!store.messages.length">{{ i18n.t("noMessageYet") }}</p>

      <ol class="list-unstyled">
        <template v-for="(message, i) in store.messages" :key="message.id">
          <li class="mt-3" v-if="shouldPrintHeader(message, i)">
            <Username :id="message.from" class="fw-bold" />
          </li>
          <li>
            {{ message.content }}
          </li>
        </template>
      </ol>
    </div>

    <div class="composer-wrap">
      <div class="status-popover">
        <div class="status-title">{{ i18n.t("statusPanelTitle") }}</div>

        <p v-if="!statusUsers.length" class="status-empty">
          {{ i18n.t("statusNoUsers") }}
        </p>

        <ul v-else class="status-list">
          <li
            v-for="user in statusUsers"
            :key="user.id"
            class="status-user"
          >
            <span
              class="status-dot"
              :class="{
                typing: user.isTyping,
                online: !user.isTyping && user.isOnline,
              }"
            ></span>
            <Username :id="user.id" class="status-name" />
            <span class="status-label">{{ user.statusLabel }}</span>
          </li>
        </ul>
      </div>

      <span v-if="someoneIsTyping" class="blinking">{{ someoneIsTyping }}</span>

      <form @submit.prevent="submit" class="d-flex mt-1">
        <div class="w-100">
          <textarea
            class="form-control"
            v-model="store.selectedChannel.messageInput"
            @keydown.exact.enter.prevent="submit"
            @input="onInput"
            rows="5"
          ></textarea>

          <v-btn
            color="primary"
            outlined
            class="submit-btn"
            type="submit"
            icon="send"
            :disabled="store.selectedChannel.messageInput === ''"
          >
          </v-btn>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
textarea {
  resize: none;
}

.submit-btn {
  position: absolute;
  right: 20px;
  bottom: 20px;
  padding: 4px 8px;
}

.composer-wrap {
  position: relative;
}

.status-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 20;
  width: 240px;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transform: translateY(6px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.composer-wrap:hover .status-popover,
.composer-wrap:focus-within .status-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.status-title {
  margin-bottom: 8px;
  font-weight: 700;
}

.status-empty {
  margin: 0;
  color: #6c757d;
}

.status-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.status-user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #b44;
}

.status-dot.online {
  background: #4b4;
}

.status-dot.typing {
  background: #0d6efd;
}

.status-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-label {
  flex: 0 0 auto;
  color: #6c757d;
  font-size: 12px;
}

.blinking {
  animation: blink-frames 2s infinite;
}

@keyframes blink-frames {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
  100% {
    opacity: 1;
  }
}
</style>
