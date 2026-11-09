import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

/**
 * TanStack Query for the redesigned screens (items list, item page, places).
 * Older pages keep using useAsyncData; server events invalidate both (see
 * layouts/default.vue).
 */
export default defineNuxtPlugin(nuxtApp => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
