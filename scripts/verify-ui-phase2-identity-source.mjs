import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { ref, shallowRef, computed } from "vue";

// Execute actual setup scripts with isolated transport/router; no HTTP, cookies or SQL.
export async function verifyIdentitySource() {
  const checks = [];
  class ApiClientError extends Error {
    constructor(kind, code = "fixture_error") {
      super(code);
      Object.assign(this, {
        kind,
        code,
        userMessage: "合成失败",
        actionHint: "合成提示",
        requestId: "fixture-request",
        traceId: "fixture-trace",
      });
    }
  }
  async function setup(component, expose, location = "/login", query = {}) {
    const source = await readFile(`apps/web/src/components/${component}.vue`, "utf8");
    let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
    for (const s of [...ast.statements].reverse())
      if (ts.isImportDeclaration(s)) script = script.slice(0, s.pos) + script.slice(s.end);
    const calls = [],
      targets = [],
      mounted = [],
      replies = [];
    const request = async (url, options) => {
      calls.push({ url, options });
      assert.ok(replies.length, "Unexpected request: " + url);
      const result = replies.shift();
      if (result instanceof Error) throw result;
      return typeof result === "function" ? result() : result;
    };
    const url = new URL(location, "https://fixture.invalid");
    const env = {
      ref,
      shallowRef,
      computed,
      nextTick: async () => {},
      useTemplateRef: () => ref(null),
      onMounted: (f) => mounted.push(f),
      useRoute: () => ({ query }),
      useRouter: () => ({ replace: async (to) => targets.push(to) }),
      createApiClient: () => request,
      publicConfig: { apiBaseUrl: "isolated-no-network" },
      ApiClientError,
      window: { location: { pathname: url.pathname, search: url.search } },
      defineProps: () => ({ apiBaseUrl: "isolated-no-network" }),
      getLastMemberRoute: () => "/tasks",
      getRecentOrganizationIds: () => [],
      rememberOrganization: (id) => [id],
      onboardingSteps: [{ number: 1 }, { number: 2 }, { number: 3 }],
      resolveOnboardingStep: (search) => {
        const value = Number(new URLSearchParams(search).get("step"));
        if (!Number.isFinite(value) || !Number.isInteger(value)) return 1;
        return Math.min(3, Math.max(1, value));
      },
    };
    const js = ts.transpileModule(script + `\nreturn {${expose}};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const state = new Function(...Object.keys(env), js)(...Object.values(env));
    return { ...state, calls, targets, mounted, replies };
  }
  const envelope = (data) => ({ data, request_id: "fixture-request", trace_id: "fixture-trace" });
  const identity = (url) =>
    setup(
      "LocalIdentity",
      "mode,requestState,email,identifier,password,confirmPassword,mfaCode,mfaEnabled,mfaSecret,recoveryCodes,currentPassword,newPassword,securitySetup,message,submit,switchMode,confirmEmail,loadMfa,startMfa,confirmMfa,disableMfa,changeSeedPassword",
      url,
    );
  let s = await identity("/login?redirect=/tasks");
  s.identifier.value = "fixture-user";
  s.password.value = "synthetic-only-password";
  s.replies.push(envelope({}));
  await s.submit();
  assert.deepEqual(s.calls, [
    {
      url: "/auth/login",
      options: {
        method: "POST",
        body: { identifier: "fixture-user", password: "synthetic-only-password" },
      },
    },
  ]);
  assert.deepEqual(s.targets, ["/tasks"]);
  checks.push("login exact payload; relative redirect bypasses landing");
  s = await identity("/login?redirect=//foreign.invalid");
  s.replies.push(envelope({}), envelope({ route: "/platform-admin" }));
  await s.submit();
  assert.equal(s.calls[1].url, "/me/landing");
  assert.deepEqual(s.targets, ["/platform-admin"]);
  checks.push(
    "non-relative redirect falls back to actual landing; no claim of complete redirect security",
  );
  s = await identity("/login");
  s.replies.push(envelope({ mfa_required: true }));
  await s.submit();
  assert.equal(s.mode.value, "mfa-challenge");
  assert.deepEqual(s.targets, []);
  s.mfaCode.value = "fixture-recovery";
  s.replies.push(new ApiClientError("expired", "mfa_challenge_invalid"));
  await s.submit();
  assert.equal(s.mode.value, "login");
  assert.equal(s.mfaCode.value, "");
  checks.push("challenge branch and invalid challenge clears code and returns login");
  s = await identity("/login");
  s.password.value = "synthetic-only-password";
  s.replies.push(
    envelope({
      security_setup: { required: true, must_change_password: true, must_enroll_mfa: true },
    }),
  );
  await s.submit();
  assert.equal(s.mode.value, "security-setup");
  s.newPassword.value = "new-synthetic-password";
  s.replies.push(envelope(undefined));
  await s.changeSeedPassword();
  assert.equal(s.calls[1].url, "/me/password");
  assert.equal(s.mode.value, "login");
  assert.deepEqual(s.targets, []);
  assert.equal(s.currentPassword.value, "");
  checks.push("seed password 204 returns login before MFA; does not auto-enter business");
  s = await identity("/register");
  s.email.value = "synthetic@example.invalid";
  s.password.value = "synthetic-only-password";
  s.confirmPassword.value = "different";
  await s.submit();
  assert.equal(s.calls.length, 0);
  s.confirmPassword.value = s.password.value;
  s.replies.push(envelope({}));
  await s.submit();
  assert.deepEqual(s.calls[0].options.body, { email: s.email.value, password: s.password.value });
  assert.equal(s.mode.value, "verify");
  assert.deepEqual(s.targets, []);
  checks.push(
    "register mismatch zero request; exact body excludes confirmation; inline verify without navigation",
  );
  s = await identity("/forgot-password");
  s.email.value = "synthetic@example.invalid";
  s.replies.push(envelope({}));
  await s.submit();
  assert.match(s.message.value, /如账号存在/);
  checks.push("forgot generic acceptance does not confirm account or delivery");
  s = await identity("/verify-email");
  await s.confirmEmail();
  assert.equal(s.calls.length, 0);
  s = await identity("/verify-email?token=synthetic-not-valid");
  s.replies.push(envelope({ status: "verified" }));
  await s.confirmEmail();
  assert.deepEqual(s.calls[0].options.body, { token: "synthetic-not-valid" });
  assert.match(s.message.value, /验证完成/);
  checks.push(
    "verify no-token zero request; data-bearing response success (transport status not simulated)",
  );
  s = await identity("/reset-password");
  s.password.value = "synthetic-only-password";
  s.replies.push(new ApiClientError("error"));
  await s.submit();
  assert.deepEqual(s.calls[0].options.body, { token: "", new_password: "synthetic-only-password" });
  s.replies.push(envelope(undefined));
  await s.submit();
  assert.match(s.message.value, /重新登录/);
  assert.deepEqual(s.targets, []);
  checks.push(
    "reset missing token still submitted by current source; 204 no automatic navigation, only one new password",
  );
  s = await identity("/security/mfa");
  s.replies.push(new ApiClientError("blocked"));
  await s.loadMfa();
  assert.equal(s.mfaEnabled.value, false);
  assert.equal(s.requestState.value, "blocked");
  checks.push(
    "known source gap: false initial MFA flag survives read failure; draft must show unknown",
  );
  s.currentPassword.value = "synthetic-only-password";
  s.replies.push(envelope({ secret: "SYNTHETIC-NOT-A-SECRET" }));
  await s.startMfa();
  assert.deepEqual(s.calls.at(-1), {
    url: "/me/mfa/totp/enrollment",
    options: { method: "POST", body: { current_password: "synthetic-only-password" } },
  });
  s.mfaCode.value = "000000";
  s.replies.push(envelope({ recovery_codes: ["SYNTHETIC-NOT-A-CODE"] }));
  await s.confirmMfa();
  assert.deepEqual(s.calls.at(-1), {
    url: "/me/mfa/totp/confirm",
    options: { method: "POST", body: { code: "000000" } },
  });
  assert.equal(s.mfaEnabled.value, true);
  s.replies.push(envelope(undefined));
  await s.disableMfa();
  assert.equal(s.calls.at(-1).options.method, "DELETE");
  assert.deepEqual(s.calls.at(-1).options.body, {
    current_password: "synthetic-only-password",
    code: "000000",
  });
  assert.deepEqual(s.targets, []);
  assert.equal(s.mfaSecret.value, "SYNTHETIC-NOT-A-SECRET");
  checks.push(
    "MFA enrollment/confirm/disable exact methods and bodies; source retains materials after disable, no cookie proof",
  );
  s.switchMode("register");
  assert.equal(s.currentPassword.value, "synthetic-only-password");
  checks.push("source mode switch retains sensitive refs; draft is not a lifecycle/security fix");
  const chooser = (query) =>
    setup(
      "TenancyChooser",
      "state,organizations,workspaces,teams,selectedOrganization,selectedWorkspace,organizationQuery,filteredOrganizations,selectedContext,safeReturnTo,loadOrganizations,chooseOrganization,chooseWorkspace,createPersonalWorkspace",
      "/select-context",
      query,
    );
  s = await chooser({});
  s.replies.push(envelope([]));
  await s.loadOrganizations();
  assert.equal(s.state.value, "empty");
  s.replies.push(envelope({ organization: { name: "合成组织" }, workspace: { name: "合成空间" } }));
  await s.createPersonalWorkspace();
  assert.deepEqual(s.calls.at(-1), { url: "/me/personal-workspace", options: { method: "POST" } });
  assert.deepEqual(s.targets, ["/home"]);
  checks.push(
    "empty organizations provision no body; default onboarding return replaced with home",
  );
  s = await chooser({ return_to: "/tasks" });
  s.replies.push(envelope({}));
  await s.createPersonalWorkspace();
  assert.deepEqual(s.targets, ["/tasks"]);
  const org = {
    id: "synthetic-org",
    name: "合成组织",
    slug: "sample-org",
    timezone: "Asia/Shanghai",
  };
  s.replies.push(
    envelope([
      { id: "synthetic-ws", organization_id: org.id, name: "合成工作区", status: "active" },
    ]),
    envelope([]),
  );
  await s.chooseOrganization(org);
  assert.equal(s.calls.at(-2).url, "/org/synthetic-org/workspaces");
  assert.equal(s.calls.at(-1).url, "/org/synthetic-org/teams");
  const before = s.calls.length;
  await s.chooseWorkspace({ status: "archived" });
  assert.equal(s.calls.length, before);
  s.replies.push(envelope({ organization: org, workspace: { name: "合成工作区" } }));
  await s.chooseWorkspace(s.workspaces.value[0]);
  assert.deepEqual(s.calls.at(-1).options.body, {
    organization_id: "synthetic-org",
    workspace_id: "synthetic-ws",
  });
  assert.equal(s.state.value, "selected");
  assert.equal(s.targets.length, 1);
  checks.push(
    "workspace/team reads, archived zero write, exact context body and explicit continue boundary",
  );
  s = await chooser({});
  let releaseOldMembership;
  s.replies.push(() => new Promise((resolve) => (releaseOldMembership = resolve)));
  const oldMembershipLoad = s.loadOrganizations();
  await Promise.resolve();
  await Promise.resolve();
  s.replies.push(envelope([org]));
  await s.loadOrganizations();
  releaseOldMembership?.(envelope([]));
  await oldMembershipLoad;
  assert.deepEqual(s.organizations.value, [org]);
  assert.equal(s.state.value, "ready");
  checks.push("superseded membership response cannot replace current organization directory");
  s = await chooser({});
  s.selectedOrganization.value = org;
  s.state.value = "ready";
  s.replies.push(() => new Promise((resolve) => (releaseOldMembership = resolve)));
  const oldContextWrite = s.chooseWorkspace({
    id: "synthetic-ws",
    organization_id: org.id,
    status: "active",
  });
  await Promise.resolve();
  await Promise.resolve();
  s.replies.push(envelope([]));
  await s.loadOrganizations();
  releaseOldMembership?.(
    envelope({ organization: org, workspace: { id: "synthetic-ws", name: "旧范围" } }),
  );
  await oldContextWrite;
  assert.equal(s.selectedContext.value, null);
  assert.equal(s.state.value, "empty");
  checks.push(
    "superseded context write cannot restore a selected workspace after returning to scope list",
  );
  for (const [kind, expected] of [
    ["expired", "expired"],
    ["forbidden", "forbidden"],
    ["blocked", "error"],
  ]) {
    s = await chooser({});
    s.replies.push(new ApiClientError(kind));
    await s.loadOrganizations();
    assert.equal(s.state.value, expected);
  }
  checks.push("chooser expiry/forbidden/other failure separated");
  s = await setup("LandingRedirect", "state,resolveLanding", "/");
  s.replies.push(envelope({ route: "/home" }));
  await s.resolveLanding();
  assert.deepEqual(s.targets, ["/tasks"]);
  s.replies.push(envelope({}));
  await s.resolveLanding();
  assert.equal(s.state.value, "blocked");
  s.replies.push(new ApiClientError("expired"));
  await s.resolveLanding();
  assert.equal(s.targets.at(-1), "/login");
  checks.push("root restores member path, blocks missing route, redirects expiry");
  s = await setup("OnboardingGuide", "step,currentStep,next,previous", "/onboarding?step=2");
  assert.equal(s.step.value, 2);
  s.next();
  assert.equal(s.step.value, 3);
  s.next();
  assert.equal(s.step.value, 3);
  s.previous();
  assert.equal(s.step.value, 2);
  s = await setup("OnboardingGuide", "step,currentStep", "/onboarding?step=1.5");
  assert.equal(s.currentStep.value.number, 1);
  checks.push("guide legal steps and fractional query safely resolves to the first step");
  return {
    checks,
    count: checks.length,
    scope:
      "actual Vue setup functions with isolated transport/router; P08 membership/context stale-response guards are exercised, but this is not a Vue mount, cookie, auth, SQL, or production proof",
  };
}
if (process.argv[1]?.endsWith("verify-ui-phase2-identity-source.mjs"))
  console.log(JSON.stringify(await verifyIdentitySource(), null, 2));
