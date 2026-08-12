<script setup>
import { useMainStore } from "@/stores/main";
import BackendService from "@/BackendService";
import { useRouter } from "vue-router";
import VBtn from "@/components/common/VBtn.vue";
import PublicChannelLabel from "@/components/ChannelView/PublicChannelLabel.vue";
import PrivateChannelLabel from "@/components/ChannelView/PrivateChannelLabel.vue";
import { useI18nStore } from "@/stores/i18n";

const store = useMainStore();
const i18n = useI18nStore();
const router = useRouter();

async function logOut() {
  await BackendService.logOut();
  store.clear();
  await router.push({ name: "login" });
}

async function deleteConversation(channel) {
  if (!confirm(i18n.t("confirmDeleteConversation"))) {
    return;
  }

  let res;

  try {
    res = await store.deleteChannel(channel.id);
  } catch (_) {
    alert(i18n.t("deleteConversationFailed"));
    return;
  }

  if (res.status !== "OK") {
    alert(i18n.t("deleteConversationFailed"));
    return;
  }

  if (store.selectedChannelId) {
    await router.push({
      name: "channel",
      params: { channelId: store.selectedChannelId },
    });
  }
}
</script>

<template>
  <div class="d-flex flex-column flex-shrink-0 p-3" style="width: 280px">
    <a
      href="/"
      class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-black text-decoration-none"
    >
      <img
        class="bi pe-none me-2"
        src="@/assets/app-logo.png"
        width="40"
        height="40"
      />
      <span class="fs-4">{{ i18n.t("appName") }}</span>
    </a>

    <h6 class="mt-4">{{ i18n.t("channels") }}</h6>

    <ul class="nav nav-pills d-block overflow-auto mh-40">
      <li v-if="!store.isInitialized" v-for="_ in 4" class="nav-item">
        <div class="placeholder-glow channel-placeholder">
          <span class="placeholder w-75"></span>
        </div>
      </li>

      <li
        class="nav-item"
        v-for="channel in store.publicChannels"
        :key="channel.id"
      >
        <div class="nav-row">
          <router-link
            class="nav-link d-flex flex-grow-1 min-w-0"
            :to="{ params: { channelId: channel.id } }"
            :class="
              store.isChannelSelected(channel.id) ? 'active' : 'text-black'
            "
          >
            <PublicChannelLabel :channel="channel" class="flex-grow-1" />

            <span
              class="badge text-bg-primary"
              v-if="channel.unreadCount > 0"
              >{{ channel.unreadCount }}</span
            >
          </router-link>

          <button
            class="delete-btn"
            :title="i18n.t('deleteConversation')"
            @click.prevent.stop="deleteConversation(channel)"
            v-if="channel.name !== 'General'"
          >
            <svg class="bi pe-none" width="14" height="14">
              <use href="#trash" />
            </svg>
          </button>
        </div>
      </li>

      <li>
        <v-btn
          color="primary"
          outlined
          class="mt-1"
          icon="plus"
          :disabled="!store.isInitialized"
          @click="store.showJoinOrCreateChannelModel = true"
        >
          {{ i18n.t("addChannel") }}
        </v-btn>
      </li>
    </ul>

    <h6 class="mt-4">{{ i18n.t("directMessages") }}</h6>

    <ul class="nav nav-pills d-block overflow-auto mh-40">
      <li v-if="!store.isInitialized" v-for="_ in 4" class="nav-item">
        <div class="placeholder-glow channel-placeholder">
          <span class="placeholder w-75"></span>
        </div>
      </li>

      <li
        class="nav-item"
        v-for="channel in store.privateChannels"
        :key="channel.id"
      >
        <div class="nav-row">
          <router-link
            class="nav-link d-flex flex-grow-1 min-w-0"
            :to="{ params: { channelId: channel.id } }"
            :class="
              store.isChannelSelected(channel.id) ? 'active' : 'text-black'
            "
          >
            <PrivateChannelLabel :channel="channel" class="flex-grow-1" />

            <span
              class="badge text-bg-primary"
              v-if="channel.unreadCount > 0"
              >{{ channel.unreadCount }}</span
            >
          </router-link>

          <button
            class="delete-btn"
            :title="i18n.t('deleteConversation')"
            @click.prevent.stop="deleteConversation(channel)"
          >
            <svg class="bi pe-none" width="14" height="14">
              <use href="#trash" />
            </svg>
          </button>
        </div>
      </li>

      <li>
        <v-btn
          color="primary"
          outlined
          class="mt-1"
          icon="plus"
          @click="store.showSearchUserModal = true"
          :disabled="!store.isInitialized"
        >
          {{ i18n.t("addUser") }}
        </v-btn>
      </li>
    </ul>

    <hr class="mt-auto" />

    <div class="btn-group mb-2" role="group">
      <button
        type="button"
        class="btn btn-sm"
        :class="i18n.locale === 'zh' ? 'btn-primary' : 'btn-outline-primary'"
        @click="i18n.setLocale('zh')"
      >
        中文
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :class="i18n.locale === 'en' ? 'btn-primary' : 'btn-outline-primary'"
        @click="i18n.setLocale('en')"
      >
        EN
      </button>
    </div>

    <div>
      <v-btn
        color="primary"
        outlined
        icon="box-arrow-right"
        @click="logOut"
        :disabled="!store.isInitialized"
      >
        {{ i18n.t("logOut") }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.mh-40 {
  max-height: 40%;
}

.channel-placeholder {
  height: 40px;
  padding-top: 8px;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.min-w-0 {
  min-width: 0;
}

.delete-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 0;
  color: #6c757d;
  background: transparent;
  border-radius: 4px;
}

.delete-btn:hover {
  color: #dc3545;
  background: #f8d7da;
}
</style>
