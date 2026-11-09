<script setup lang="ts">
  import { QrCode } from "@lucide/vue";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { route } from "~/lib/api/base";
  import { Button } from "@/components/ui/button";
  import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
  import { useDialog } from "@/components/ui/dialog-provider";

  const props = withDefaults(
    defineProps<{
      variant?: "default" | "outline" | "ghost";
      /** Only render the dialog; something else opens it via DialogID.PageQRCode. */
      buttonless?: boolean;
    }>(),
    { variant: "default", buttonless: false }
  );

  const { openDialog } = useDialog();

  function getQRCodeUrl(): string {
    const currentURL = window.location.href;
    // Adjust route import as needed
    return route(`/qrcode`, { data: encodeURIComponent(currentURL) });
  }
</script>

<template>
  <Dialog :dialog-id="DialogID.PageQRCode">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{ $t("components.global.page_qr_code.page_url") }}
        </DialogTitle>
      </DialogHeader>
      <img :src="getQRCodeUrl()" />
    </DialogContent>
  </Dialog>

  <Tooltip v-if="!buttonless">
    <TooltipTrigger as-child>
      <Button size="icon" :variant="props.variant" @click="openDialog(DialogID.PageQRCode)">
        <QrCode name="mdi-qrcode" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {{ $t("components.global.page_qr_code.qr_tooltip") }}
    </TooltipContent>
  </Tooltip>
</template>
