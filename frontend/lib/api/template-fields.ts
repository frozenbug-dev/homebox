import type { TemplateField } from "./types/data-contracts";

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// The backend decodes timeValue into a Go time.Time, so an empty string would
// fail to parse. This is Go's zero time, which is what an omitted value becomes.
const ZERO_TIME = "0001-01-01T00:00:00Z";

/**
 * Builds a complete TemplateField. The UI only edits name/textValue, but the
 * API type requires every value, and copying a field must keep its
 * number/boolean/time values rather than silently resetting them.
 */
export function templateField(field: Partial<TemplateField> = {}): TemplateField {
  return {
    id: NIL_UUID,
    name: "",
    type: "text",
    textValue: "",
    numberValue: 0,
    booleanValue: false,
    timeValue: ZERO_TIME,
    ...field,
  };
}
