import type { Ref } from "vue";

type OrganizationForm = {
  name: string;
  timezone: string;
  data_retention_days: number;
};

export function usePlatformOrganizationDetailState(options: {
  selected: Ref<any>;
  data: Ref<{ organizations: any[] } | null>;
  detailOpen: Ref<boolean>;
  missing: Ref<boolean>;
  createOpen: Ref<boolean>;
  form: OrganizationForm;
  routePath: () => string;
  organizationId: () => string;
}) {
  function showOrganization(item: any) {
    options.selected.value = item;
    options.missing.value = false;
    options.form.name = item.name;
    options.form.timezone = item.timezone || "Asia/Shanghai";
    options.form.data_retention_days = Number(item.data_retention_days || 365);
    options.detailOpen.value = true;
  }

  function syncOrganizationRoute() {
    if (options.routePath().endsWith("/new")) {
      options.createOpen.value = true;
      options.detailOpen.value = false;
      options.missing.value = false;
      return;
    }
    options.createOpen.value = false;
    const organizationId = options.organizationId();
    if (organizationId && options.data.value) {
      const organization = options.data.value.organizations.find(
        (item) => item.id === organizationId,
      );
      if (organization) showOrganization(organization);
      else if (options.selected.value?.id === organizationId)
        showOrganization(options.selected.value);
      else {
        options.selected.value = null;
        options.missing.value = true;
        options.detailOpen.value = true;
      }
      return;
    }
    options.detailOpen.value = false;
    options.missing.value = false;
  }

  return { showOrganization, syncOrganizationRoute };
}
