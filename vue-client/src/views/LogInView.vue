<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BackendService from "@/BackendService";
import { useMainStore } from "@/stores/main";
import VBtn from "@/components/common/VBtn.vue";
import { useI18nStore } from "@/stores/i18n";

const router = useRouter();
const route = useRoute();
const store = useMainStore();
const i18n = useI18nStore();

const username = ref("");
const password = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const isValid = computed(() => {
  return username.value.length && password.value.length;
});

async function onSubmit() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const res = await BackendService.logIn({
      username: username.value,
      password: password.value,
    });

    if (res.status !== 200) {
      password.value = "";
      errorMessage.value = i18n.t("credentialsInvalid");
      isLoading.value = false;
      return;
    }

    const user = await res.json();
    store.setCurrentUser(user);

    const channelId = await store.init();

    if (route.query.returnTo) {
      await router.push(route.query.returnTo);
    } else {
      await router.push({ name: "channel", params: { channelId } });
    }
  } catch (_) {
    errorMessage.value = i18n.t("genericError");
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="d-flex align-items-center w-100">
    <div class="form m-auto">
      <form @submit.prevent="onSubmit">
        <img class="mb-4" src="@/assets/app-logo.png" width="72" height="72" />
        <h1 class="h3 mb-3 fw-normal">{{ i18n.t("loginTitle") }}</h1>

        <div class="form-floating">
          <input
            type="text"
            class="form-control"
            id="floatingInput"
            v-model="username"
            :placeholder="i18n.t('username')"
          />
          <label for="floatingInput">{{ i18n.t("username") }}</label>
        </div>

        <div class="form-floating">
          <input
            type="password"
            class="form-control"
            id="floatingPassword"
            v-model="password"
            :placeholder="i18n.t('password')"
          />
          <label for="floatingPassword">{{ i18n.t("password") }}</label>
        </div>

        <v-btn
          type="submit"
          color="primary"
          class="w-100 my-2 py-2"
          :loading="isLoading"
          :disabled="!isValid"
        >
          {{ i18n.t("login") }}
        </v-btn>

        <div v-if="errorMessage" class="text-danger">
          {{ errorMessage }}
        </div>
      </form>

      <p class="mt-2">
        {{ i18n.t("or") }}
        <router-link :to="{ name: 'signup' }">{{ i18n.t("signup") }}</router-link>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.form {
  max-width: 330px;
  padding: 1rem;
}

.form-floating:focus-within {
  z-index: 2;
}

#floatingInput {
  margin-bottom: -1px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

#floatingPassword {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
</style>
