import { useI18n } from "vue-i18n";

export type Crumb = { label: string; to?: string };

const usePageHeaderOverride = () => useState<{ path: string; crumbs: Crumb[] } | null>("page-header", () => null);

/**
 * Sets the breadcrumb shown in the panel header for the current page, e.g.
 * `usePageHeader(() => [{ label: "Places", to: "/locations" }, { label: place.name }])`.
 * Pages that don't call it get a default from their route.
 */
export function usePageHeader(crumbs: MaybeRefOrGetter<Crumb[]>) {
  const route = useRoute();
  const state = usePageHeaderOverride();
  watchEffect(() => {
    state.value = { path: route.path, crumbs: toValue(crumbs) };
  });
}

/** What the layout renders: the page's own crumbs, or a default for the route. */
export function usePageHeaderState() {
  const { t } = useI18n();
  const route = useRoute();
  const state = usePageHeaderOverride();

  const defaults: [RegExp, () => Crumb[]][] = [
    [/^\/home/, () => [{ label: t("menu.home") }]],
    [/^\/(items|search)/, () => [{ label: t("shell.items") }]],
    [/^\/item\//, () => [{ label: t("shell.items"), to: "/items" }]],
    [/^\/locations/, () => [{ label: t("shell.places") }]],
    [/^\/location\//, () => [{ label: t("shell.places"), to: "/locations" }]],
    [/^\/tags/, () => [{ label: t("global.tags") }]],
    [/^\/tag\//, () => [{ label: t("global.tags"), to: "/tags" }]],
    [/^\/templates/, () => [{ label: t("menu.templates") }]],
    [/^\/template\//, () => [{ label: t("menu.templates"), to: "/templates" }]],
    [/^\/label-templates/, () => [{ label: t("menu.label_templates") }]],
    [/^\/maintenance/, () => [{ label: t("menu.maintenance") }]],
    [/^\/profile/, () => [{ label: t("profile.user_profile") }]],
    [/^\/collection/, () => [{ label: t("shell.collection_settings") }]],
    [/^\/reports/, () => [{ label: t("menu.label_templates"), to: "/label-templates" }]],
  ];

  return reactive({
    crumbs: computed<Crumb[]>(() => {
      if (state.value && state.value.path === route.path) return state.value.crumbs;
      return defaults.find(([re]) => re.test(route.path))?.[1]() ?? [];
    }),
  });
}
