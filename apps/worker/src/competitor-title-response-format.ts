/** Transport grammar only; evidence binding, completeness and semantic checks remain authoritative. */
export const competitorTitleResponseFormat = (sourceRefs: string[]) => ({
  type: "json_schema",
  json_schema: {
    name: "competitor_title_relations",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["classifications"],
      properties: {
        classifications: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["source_ref", "relation", "rationale"],
            properties: {
              source_ref: { type: "string", ...(sourceRefs.length ? { enum: sourceRefs } : {}) },
              relation: {
                type: "string",
                enum: ["substitute", "different_use", "accessory", "uncertain"],
              },
              rationale: { type: "string" },
            },
          },
        },
      },
    },
  },
});
