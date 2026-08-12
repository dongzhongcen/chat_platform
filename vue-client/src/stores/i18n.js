import { acceptHMRUpdate, defineStore } from "pinia";
import en from "@/locales/en";
import zh from "@/locales/zh";

const messages = { en, zh };

export const useI18nStore = defineStore("i18n", {
  state: () => ({
    locale: localStorage.getItem("locale") || "zh",
  }),

  actions: {
    setLocale(locale) {
      if (!messages[locale]) {
        return;
      }

      this.locale = locale;
      localStorage.setItem("locale", locale);
    },

    t(key, params = {}) {
      let text = messages[this.locale]?.[key] ?? messages.en[key] ?? key;

      Object.entries(params).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, value);
      });

      return text;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useI18nStore, import.meta.hot));
}
