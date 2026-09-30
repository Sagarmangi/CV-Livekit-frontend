"use server";

import { revalidatePath } from "next/cache";

import { fail, guard, isE164, isIdentifier, ok, optionalStr, str, type ActionState } from "@/lib/forms";
import { db } from "@/lib/supabase";
import {
  DETECTOR_LLMS,
  TOOL_TYPES,
  isDetectorTool,
  type DetectorLLM,
  type ToolType,
} from "@/lib/types";

/**
 * Tools are a shared library now (see 0014_global_tools.sql) -- creating or
 * editing one here can affect every agent that's selected it, so this
 * revalidates the whole /agents subtree, not just one agent's page.
 */
export async function saveTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const name = str(form, "name");
    if (!isIdentifier(name)) {
      return fail(
        "Tool name must be letters, digits and underscores, starting with a letter — it's passed straight to the model's function-calling interface.",
      );
    }

    const description = str(form, "description");
    if (!description) {
      return fail("Describe when the agent should use this tool — the model reads this to decide.");
    }

    const toolType = str(form, "tool_type") as ToolType;
    if (!TOOL_TYPES.includes(toolType)) return fail("Unknown tool type.");

    // Each type only fills in the columns it actually uses -- e.g. a Transfer
    // call tool has no webhook, a Function tool has no destination number.
    let webhookUrl: string | null = null;
    let destinationNumber: string | null = null;
    let parameterSchema: Record<string, unknown> = {};
    let detectorStatements: string[] = [];
    let detectorLlm: DetectorLLM | null = null;

    if (toolType === "function") {
      webhookUrl = optionalStr(form, "webhook_url");
      if (!webhookUrl) {
        return fail("Function tools run by calling an n8n webhook, so a webhook URL is required.");
      }
      if (!/^https?:\/\//.test(webhookUrl)) {
        return fail("Webhook URL must start with http:// or https://.");
      }

      // Stored as JSON Schema. Parsed here rather than at call time so a typo
      // surfaces to the admin now, not to a caller mid-conversation.
      const rawSchema = str(form, "parameter_schema") || "{}";
      try {
        const parsed = JSON.parse(rawSchema);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return fail("Parameter schema must be a JSON object.");
        }
        parameterSchema = parsed as Record<string, unknown>;
      } catch (error) {
        return fail(
          `Parameter schema isn't valid JSON: ${error instanceof Error ? error.message : "parse error"}`,
        );
      }
    } else if (toolType === "transfer_call") {
      destinationNumber = optionalStr(form, "destination_number");
      if (!destinationNumber || !isE164(destinationNumber)) {
        return fail("Transfer call tools need a destination number in E.164 format, e.g. +15105550100.");
      }
    } else if (isDetectorTool(toolType)) {
      // One statement per line in the textarea. Blank lines are dropped rather
      // than stored: an empty statement is contained in every utterance, so it
      // would match — and silently hang up on — every single caller.
      detectorStatements = str(form, "detector_statements")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (detectorStatements.length === 0) {
        return fail(
          "Add at least one example statement. Without any, there's nothing to match and nothing to show the classifier what spam looks like — so the detector is skipped rather than guessing.",
        );
      }

      const llm = optionalStr(form, "detector_llm");
      if (llm && !DETECTOR_LLMS.includes(llm as DetectorLLM)) {
        return fail("Detector LLM must be Gemini or DeepSeek.");
      }
      detectorLlm = (llm as DetectorLLM | null) || null;
    }
    // record_lead_info / record_callback_number: fixed native behavior, no
    // extra columns beyond name/description.

    const toolId = optionalStr(form, "tool_id");
    const payload = {
      name,
      description,
      tool_type: toolType,
      parameter_schema: parameterSchema,
      webhook_url: webhookUrl,
      destination_number: destinationNumber,
      detector_statements: detectorStatements,
      detector_llm: detectorLlm,
    };

    // is_builtin is set on create and never touched on update. Editing is the
    // expected way to use the seeded detectors -- adjusting their statements
    // shouldn't quietly reclassify them as hand-made rows.
    const { error } = toolId
      ? await db().from("tools").update(payload).eq("tool_id", toolId)
      : await db().from("tools").insert({ ...payload, is_builtin: false });

    if (error) return fail(`Could not save tool: ${error.message}`);

    revalidatePath("/tools");
    revalidatePath("/agents/[agentId]", "layout");
    return ok(toolId ? "Tool updated." : "Tool added.");
  });
}

/**
 * The on/off switch in the library list.
 *
 * Separate from saveTool so switching a tool off is one click rather than
 * opening the edit form and re-passing every field — and so it can be done
 * without re-validating configuration that isn't changing. Off takes the tool
 * out of every agent at once; `agent_tools` is left alone, so switching it back
 * on restores exactly the agents that had it.
 */
export async function toggleTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const toolId = str(form, "tool_id");
    if (!toolId) return fail("Missing tool id.");

    // The desired state is sent explicitly rather than read-then-flipped: two
    // admins on the page at once would otherwise toggle each other's change
    // back, and the button already knows which way it's pointing.
    const enable = str(form, "is_enabled") === "true";

    const { error } = await db()
      .from("tools")
      .update({ is_enabled: enable })
      .eq("tool_id", toolId);
    if (error) return fail(`Could not update tool: ${error.message}`);

    revalidatePath("/tools");
    revalidatePath("/agents/[agentId]", "layout");
    return ok(enable ? "Tool switched on." : "Tool switched off for every agent.");
  });
}

export async function deleteTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const toolId = str(form, "tool_id");
    if (!toolId) return fail("Missing tool id.");

    // agent_tools rows for this tool cascade automatically (see the migration).
    const { error } = await db().from("tools").delete().eq("tool_id", toolId);
    if (error) return fail(`Could not delete tool: ${error.message}`);

    revalidatePath("/tools");
    revalidatePath("/agents/[agentId]", "layout");
    return ok("Tool deleted.");
  });
}
