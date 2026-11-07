<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { CalendarClock, Check, CircleCheck, Copy, ExternalLink, Pencil, Trash2 } from "@lucide/vue";
  import type { MaintenanceEntry, MaintenanceEntryWithDetails } from "~/lib/api/types/data-contracts";
  import ResourceRow from "./Row.vue";
  import { useResourceListContext } from "./context";
  import Currency from "~/components/global/Currency.vue";
  import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

  export type MaintenanceRow = MaintenanceEntry & Partial<Pick<MaintenanceEntryWithDetails, "itemID" | "itemName">>;

  /**
   * A maintenance entry as a list row: status, item and name on the left;
   * due or completed date and cost on the right. Overdue dates are red.
   */
  const props = defineProps<{ entry: MaintenanceRow; showItem?: boolean }>();
  const emit = defineEmits<{
    edit: [entry: MaintenanceRow];
    duplicate: [entry: MaintenanceRow];
    complete: [entries: MaintenanceRow[]];
    delete: [entries: MaintenanceRow[]];
  }>();

  const { t, locale } = useI18n();
  const list = useResourceListContext();
  const asEntries = (targets: unknown[]) => targets as MaintenanceRow[];

  const completed = computed(() => validDate(props.entry.completedDate));
  const date = computed(() => (completed.value ? props.entry.completedDate : props.entry.scheduledDate));
  const overdue = computed(
    () => !completed.value && validDate(props.entry.scheduledDate) && new Date(props.entry.scheduledDate) < new Date()
  );
  const shortDate = computed(() => {
    if (!validDate(date.value)) return "";
    const d = new Date(date.value);
    const thisYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(locale.value, {
      month: "short",
      day: "numeric",
      year: thisYear ? undefined : "numeric",
      timeZone: "UTC",
    });
  });
  const cost = computed(() => Number.parseFloat(props.entry.cost) || 0);
  const notDone = (targets: unknown[]) => asEntries(targets).filter(e => !validDate(e.completedDate));
</script>

<template>
  <ResourceRow :id="entry.id">
    <template #left>
      <CircleCheck
        v-if="completed"
        class="size-4 shrink-0 text-primary"
        :aria-label="t('maintenance.filter.completed')"
      />
      <CalendarClock
        v-else
        class="size-4 shrink-0"
        :class="overdue ? 'text-destructive' : 'text-muted-foreground'"
        :aria-label="t('maintenance.filter.scheduled')"
      />
      <NuxtLink
        v-if="showItem && entry.itemID"
        :to="`/item/${entry.itemID}`"
        class="max-w-48 shrink-0 truncate text-muted-foreground hover:text-foreground hover:underline"
      >
        {{ entry.itemName }}
      </NuxtLink>
      <span class="truncate font-medium">{{ entry.name }}</span>
      <span v-if="entry.description" class="hidden truncate text-[13px] text-muted-foreground lg:inline">
        {{ entry.description }}
      </span>
    </template>

    <template #right>
      <span
        class="w-24 text-right text-xs whitespace-nowrap"
        :class="{ 'font-medium text-destructive': overdue }"
        :title="overdue ? t('shell.maintenance_page.overdue') : undefined"
      >
        {{ shortDate }}
      </span>
      <span class="w-20 text-right tabular-nums">
        <Currency v-if="cost" :amount="cost" />
      </span>
    </template>

    <template #menu="{ targets }">
      <template v-if="asEntries(targets).length === 1">
        <ContextMenuItem @select="emit('edit', asEntries(targets)[0]!)">
          <Pencil /> {{ t("maintenance.list.edit") }}
        </ContextMenuItem>
        <ContextMenuItem @select="emit('duplicate', asEntries(targets)[0]!)">
          <Copy /> {{ t("maintenance.list.duplicate") }}
        </ContextMenuItem>
        <ContextMenuItem
          v-if="showItem && asEntries(targets)[0]!.itemID"
          @select="navigateTo(`/item/${asEntries(targets)[0]!.itemID}`)"
        >
          <ExternalLink /> {{ t("shell.maintenance_page.open_item") }}
        </ContextMenuItem>
      </template>
      <ContextMenuItem v-if="notDone(targets).length" @select="(emit('complete', notDone(targets)), list.clear())">
        <Check /> {{ t("shell.maintenance_page.complete", { n: notDone(targets).length }) }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        class="text-destructive focus:text-destructive"
        @select="(emit('delete', asEntries(targets)), list.clear())"
      >
        <Trash2 /> {{ t("shell.maintenance_page.delete", { n: targets.length }) }}
      </ContextMenuItem>
    </template>
  </ResourceRow>
</template>
