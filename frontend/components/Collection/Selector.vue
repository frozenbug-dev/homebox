<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        role="combobox"
        :aria-expanded="open"
        :size="sidebar.state.value === 'collapsed' ? 'icon' : undefined"
        :class="
          sidebar.state.value === 'collapsed'
            ? 'size-10'
            : 'h-9 w-full justify-between px-1.5 font-semibold hover:bg-sidebar-accent'
        "
        :aria-label="t('components.collection.selector.select_collection')"
        :title="t('components.collection.selector.select_collection')"
      >
        <template v-if="sidebar.state.value === 'collapsed'">
          <House class="size-5" />
        </template>
        <template v-else>
          <span class="flex items-center gap-2 truncate">
            <span
              class="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {{ (selectedCollection?.name || "?").charAt(0).toUpperCase() }}
            </span>
            <span class="truncate">
              {{
                selectedCollection && selectedCollection.name
                  ? selectedCollection.name
                  : t("components.collection.selector.select_collection")
              }}
            </span>
          </span>

          <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :class="[sidebar.state.value === 'collapsed' ? 'min-w-48 p-0' : 'w-(--reka-popper-anchor-width) p-0']"
    >
      <Command :ignore-filter="true">
        <CommandGroup>
          <CommandItem
            value="create-collection"
            @select="
              () => {
                open = false;
                openDialog(DialogID.CreateCollection);
              }
            "
          >
            <Plus class="mr-2 size-4" />
            {{ t("components.collection.selector.create_collection") }}
          </CommandItem>
          <CommandItem
            value="join-collection"
            @select="
              () => {
                open = false;
                openDialog(DialogID.JoinCollection);
              }
            "
          >
            <UserPlus class="mr-2 size-4" />
            {{ t("components.collection.selector.join_collection") }}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandList>
          <CommandGroup :heading="t('components.collection.selector.your_collections')">
            <CommandItem
              v-for="collection in collections"
              :key="collection.id"
              :value="collection.id"
              @select="selectCollection(collection)"
            >
              <Check
                :class="cn('mr-2 size-4', selectedCollection?.id === collection.id ? 'opacity-100' : 'opacity-0')"
              />
              <div class="flex w-full items-center justify-between gap-2">
                {{ collection.name }}
                <div class="flex items-center gap-2"></div>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
  import { Check, ChevronsUpDown, House, Plus, UserPlus } from "@lucide/vue";
  import { Button } from "~/components/ui/button";
  import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "~/components/ui/command";
  import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
  import { cn } from "~/lib/utils";
  import { ref, onMounted } from "vue";
  import { useSidebar } from "@/components/ui/sidebar/utils";
  import { useI18n } from "vue-i18n";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { useDialog } from "~/components/ui/dialog-provider";

  const { openDialog } = useDialog();

  const { t } = useI18n();

  const open = ref(false);

  const { collections, selectedCollection, load, set } = useCollections();

  function selectCollection(collection: CollectionSummary) {
    if (selectedCollection.value?.id !== collection.id) {
      set(collection.id);
      window.location.reload();
    }
    open.value = false;
  }

  const sidebar = useSidebar();

  onMounted(() => {
    load();
  });
</script>
