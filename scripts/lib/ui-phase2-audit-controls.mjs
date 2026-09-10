const regular = ["default", "hover", "focus", "pressed"];
const entry = (id, selector, scene, source, extra = {}) => ({
  id,
  selector,
  scene,
  source,
  states: regular,
  ...extra,
});
export const auditControls = [
  entry("apply", "#apply", "normal", "child:submitFilters", {
    states: [...regular, "disabled"],
    disabledScene: "filter_busy",
    filters: true,
  }),
  entry("reset", "#reset", "exact_draft", "child:resetFilters", {
    states: [...regular, "disabled"],
    disabledScene: "filter_busy",
    filters: true,
  }),
  entry("advanced-closed", "#advanced summary", "normal", "child:native advanced details", {
    filters: true,
  }),
  entry("advanced-open", "#advanced summary", "advanced", "child:native advanced details", {
    filters: true,
  }),
  entry("system-closed", "#system", "system_collapsed", "child:systemEventsExpanded toggle"),
  entry("system-open", "#system", "system_expanded", "child:systemEventsExpanded toggle"),
  entry("event-selected", ".event-row[aria-pressed=true]", "normal", "child:choose(event)"),
  entry("event-unselected", ".event-row[aria-pressed=false]", "normal", "child:choose(event)"),
  entry("more", "#more", "normal", "child:loadMore prop", {
    states: [...regular, "disabled"],
    disabledScene: "more_busy",
  }),
  entry("refresh", "#refresh", "normal", "parent:load({background:true})", {
    states: [...regular, "disabled"],
    disabledScene: "refreshing",
  }),
  entry("retry", "#retry", "error", "parent:load()"),
  entry("copy-request", '[data-copy="request"]', "normal", "child:copy(request_id,request)", {
    states: [...regular, "disabled"],
    disabledScene: "missing_ids",
    disabledProposalOnly: true,
  }),
  entry("copy-trace", '[data-copy="trace"]', "normal", "child:copy(trace_id,trace)", {
    states: [...regular, "disabled"],
    disabledScene: "missing_ids",
    disabledProposalOnly: true,
  }),
  entry("technical-closed", ".technical summary", "normal", "child:native technical details"),
  entry("technical-open", ".technical summary", "technical", "child:native technical details"),
  entry("clear-query", "#clear-query", "local_failed", "proposal:local search clear"),
  entry("filters-closed", "#filters-toggle", "normal", "proposal:mobile filter disclosure", {
    mobile: true,
  }),
  entry("filters-open", "#filters-toggle", "advanced", "proposal:mobile filter disclosure", {
    mobile: true,
  }),
  entry("back", "#back-to-list", "normal", "proposal:mobile focus return", { mobile: true }),
];
export const auditCompositions = [
  ["detail-normal", "normal", ".detail"],
  ["detail-selected", "selected", ".detail"],
  ["detail-technical", "technical", ".detail"],
  ["detail-long", "long_ids", ".detail"],
  ["detail-missing", "missing_ids", ".detail"],
  ["detail-empty", "empty", ".detail"],
];
