import { computed, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { ProviderSourceItem as SourceItem } from "../components/provider-source-types";

const pageSize = 20;
const purposeDefinitions = [
  {
    key: "market_signals",
    label: "市场热点与消费者信号",
    description: "用于发现新闻、搜索趋势和社区讨论。",
  },
  {
    key: "product_competition",
    label: "商品与竞品观察",
    description: "用于观察商品、榜单和电商平台变化。",
  },
  {
    key: "supply_sourcing",
    label: "供应链找货",
    description: "用于查找供应商和货源线索。",
  },
] as const;

type SourcePurpose = (typeof purposeDefinitions)[number]["key"];

interface UseProviderSourceDirectoryOptions {
  route: RouteLocationNormalizedLoaded;
  router: Router;
  items: { value: SourceItem[] };
  effectiveAvailability: (item: SourceItem) => SourceItem["availability"];
}

export function useProviderSourceDirectory({
  route,
  router,
  items,
  effectiveAvailability,
}: UseProviderSourceDirectoryOptions) {
  const queryParam = (key: string) =>
    typeof route.query[key] === "string" ? route.query[key].toString() : "";
  const query = ref(queryParam("q"));
  const category = ref(queryParam("category"));
  const availability = ref(queryParam("availability"));
  const market = ref(queryParam("market"));
  const language = ref(queryParam("language"));
  const accessMode = ref(queryParam("access_mode"));
  const sort = ref(
    ["business", "attention", "name", "recent"].includes(queryParam("sort"))
      ? queryParam("sort")
      : "business",
  );
  const initialPage = Number.parseInt(queryParam("page"), 10);
  const page = ref(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
  const linkedProviderId = computed(() =>
    typeof route.query.provider_id === "string" ? route.query.provider_id : "",
  );
  const filtered = computed(() =>
    items.value.filter((item) => {
      const term = query.value.trim().toLowerCase();
      return (
        (!linkedProviderId.value || item.provisioned?.id === linkedProviderId.value) &&
        (!term ||
          `${item.name} ${item.code} ${item.markets.join(" ")} ${item.target_url}`
            .toLowerCase()
            .includes(term)) &&
        (!category.value || item.category === category.value) &&
        (!availability.value || effectiveAvailability(item) === availability.value) &&
        (!market.value || item.markets.includes(market.value)) &&
        (!language.value || item.languages.includes(language.value)) &&
        (!accessMode.value || item.access_mode === accessMode.value)
      );
    }),
  );
  const sourcePurpose = (item: SourceItem): SourcePurpose =>
    item.category === "product_supply"
      ? "supply_sourcing"
      : item.category === "ecommerce"
        ? "product_competition"
        : "market_signals";
  const availabilityPriority = (item: SourceItem) =>
    effectiveAvailability(item) === "setup_required"
      ? 0
      : effectiveAvailability(item) === "automatic" && item.provisioned?.status !== "enabled"
        ? 1
        : effectiveAvailability(item) === "automatic"
          ? 2
          : 3;
  const sorted = computed(() =>
    [...filtered.value].sort((left, right) => {
      if (sort.value === "attention")
        return (
          availabilityPriority(left) - availabilityPriority(right) ||
          left.name.localeCompare(right.name, "zh-CN")
        );
      if (sort.value === "name") return left.name.localeCompare(right.name, "zh-CN");
      if (sort.value === "recent")
        return (
          (right.provisioned?.last_success?.finished_at ?? "").localeCompare(
            left.provisioned?.last_success?.finished_at ?? "",
          ) || left.name.localeCompare(right.name, "zh-CN")
        );
      return 0;
    }),
  );
  const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)));
  const pageItems = computed(() =>
    sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  );
  const groupedSources = computed(() =>
    purposeDefinitions
      .map((definition) => ({
        ...definition,
        items: pageItems.value.filter((item) => sourcePurpose(item) === definition.key),
        total: filtered.value.filter((item) => sourcePurpose(item) === definition.key).length,
      }))
      .filter((group) => group.items.length > 0),
  );
  const resultRange = computed(() => ({
    start: sorted.value.length ? (page.value - 1) * pageSize + 1 : 0,
    end: Math.min(page.value * pageSize, sorted.value.length),
  }));
  const counts = computed(() => ({
    all: items.value.length,
    automatic: items.value.filter((item) => effectiveAvailability(item) === "automatic").length,
    nonGoogle: items.value.filter(
      (item) =>
        effectiveAvailability(item) === "automatic" && !item.target_url.includes("news.google.com"),
    ).length,
    markets: new Set(items.value.flatMap((item) => item.markets)).size,
  }));
  const marketOptions = computed(() =>
    [...new Set(items.value.flatMap((item) => item.markets))].sort(),
  );
  const languageOptions = computed(() =>
    [...new Set(items.value.flatMap((item) => item.languages))].sort(),
  );

  function syncUrlState() {
    const next = {
      ...route.query,
      q: query.value || undefined,
      category: category.value || undefined,
      availability: availability.value || undefined,
      market: market.value || undefined,
      language: language.value || undefined,
      access_mode: accessMode.value || undefined,
      sort: sort.value === "business" ? undefined : sort.value,
      page: page.value === 1 ? undefined : String(page.value),
    };
    void router.replace({ query: next });
  }

  watch([query, category, availability, market, language, accessMode, sort], () => {
    if (page.value !== 1) page.value = 1;
    else syncUrlState();
  });
  watch(page, syncUrlState);
  watch(totalPages, (value) => {
    if (page.value > value) page.value = value;
  });

  function resetFilters() {
    query.value = "";
    category.value = "";
    availability.value = "";
    market.value = "";
    language.value = "";
    accessMode.value = "";
    sort.value = "business";
  }

  function changePage(next: number) {
    page.value = Math.min(totalPages.value, Math.max(1, next));
    window.requestAnimationFrame(() => {
      document.getElementById("source-results")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return {
    linkedProviderId,
    query,
    category,
    availability,
    market,
    language,
    accessMode,
    sort,
    page,
    filtered,
    totalPages,
    groupedSources,
    resultRange,
    counts,
    marketOptions,
    languageOptions,
    resetFilters,
    changePage,
  };
}
