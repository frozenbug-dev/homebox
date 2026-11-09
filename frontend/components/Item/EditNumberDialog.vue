<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";

  /** Change one item's quantity or purchase price (opened from a row's context menu). */
  const { t } = useI18n();
  const { closeDialog, registerOpenDialogCallback } = useDialog();
  const { mutate: patch } = usePatchEntity();

  const item = ref<EntitySummary>();
  const field = ref<"quantity" | "purchasePrice">("quantity");
  const draft = ref("");

  const title = computed(() =>
    field.value === "quantity" ? t("shell.resource.change_quantity") : t("shell.resource.change_price")
  );
  const parsed = computed(() => Number(draft.value.replace(",", ".")));
  const valid = computed(() => draft.value.trim() !== "" && Number.isFinite(parsed.value) && parsed.value >= 0);

  onMounted(() => {
    const cleanup = registerOpenDialogCallback(DialogID.ItemEditNumber, params => {
      item.value = params.item;
      field.value = params.field;
      const current = params.item[params.field];
      draft.value = params.field === "purchasePrice" && !current ? "" : String(current);
    });
    onUnmounted(cleanup);
  });

  function save() {
    if (!item.value || !valid.value) return;
    const value = field.value === "quantity" ? Math.round(parsed.value) : parsed.value;
    if (value !== item.value[field.value]) {
      patch({ patch: { id: item.value.id, [field.value]: value }, optimistic: { [field.value]: value } });
    }
    closeDialog(DialogID.ItemEditNumber, true);
  }
</script>

<template>
  <Dialog :dialog-id="DialogID.ItemEditNumber">
    <DialogContent class="sm:max-w-xs">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <Input
          v-model="draft"
          type="text"
          :inputmode="field === 'quantity' ? 'numeric' : 'decimal'"
          :aria-label="title"
          :placeholder="item?.name"
          autofocus
          class="tabular-nums"
        />
        <DialogFooter>
          <Button type="submit" :disabled="!valid">{{ $t("global.save") }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
