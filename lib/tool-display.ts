import type { GlyphTone } from "@/components/ui";
import type { Tool, ToolType } from "@/lib/types";

export function toolParamCount(tool: Tool): number {
  const properties = tool.parameter_schema?.properties;
  return properties && typeof properties === "object" && !Array.isArray(properties)
    ? Object.keys(properties).length
    : 0;
}

/**
 * Icon and accent colour per tool type.
 *
 * Keyed by type alone rather than derived from a Tool, so the type picker in
 * tool-form.tsx can show the same mark as the library list -- when creating a
 * tool there is no row yet to read it from. One source for both is the point:
 * a type that looks different in the picker than in the list is worse than no
 * icon at all.
 *
 * Colours are semantic where a type has an obvious reading -- green for capture,
 * blue for routing, amber and red for the two that end calls -- and the pair of
 * detectors are deliberately different from each other, since "an automated
 * system answered" and "a human is selling to us" are different problems.
 */
export const TOOL_TYPE_GLYPHS: Record<ToolType, { icon: string; tone: GlyphTone }> = {
  function: { icon: "ƒ", tone: "brand" },
  transfer_call: { icon: "↪", tone: "blue" },
  record_lead_info: { icon: "◔", tone: "green" },
  record_callback_number: { icon: "☏", tone: "neutral" },
  detect_bot_call: { icon: "☰", tone: "amber" },
  detect_sales_call: { icon: "⊘", tone: "red" },
  end_call: { icon: "⏻", tone: "neutral" },
};

/** Icon, accent and one-line badge text per tool, shared by the agent's Tools tab
 * (sections.tsx's AgentToolsPanel) and the global library (tools/tools-library-panel.tsx). */
export function toolTypeMeta(tool: Tool): { icon: string; tone: GlyphTone; badge: string } {
  const glyph = TOOL_TYPE_GLYPHS[tool.tool_type] ?? TOOL_TYPE_GLYPHS.function;

  switch (tool.tool_type) {
    case "transfer_call":
      return { ...glyph, badge: tool.destination_number ?? "transfer call" };
    case "record_lead_info":
      return { ...glyph, badge: "record lead info" };
    case "record_callback_number":
      return { ...glyph, badge: "record callback number" };
    case "end_call":
      return { ...glyph, badge: "end call" };
    case "detect_bot_call":
    case "detect_sales_call": {
      const count = tool.detector_statements?.length ?? 0;
      const kind = tool.tool_type === "detect_bot_call" ? "bot" : "sales";
      return { ...glyph, badge: `detect ${kind} · ${count} statement${count === 1 ? "" : "s"}` };
    }
    case "function":
    default: {
      const count = toolParamCount(tool);
      return { ...glyph, badge: `function · ${count} param${count === 1 ? "" : "s"}` };
    }
  }
}
