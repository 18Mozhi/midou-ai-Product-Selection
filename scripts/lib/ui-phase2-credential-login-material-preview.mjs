import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export function previewCredentialLoginMaterial(source) {
  let review = once(
    source,
    `            </button>
          </header>
          <aside class="login-guide">`,
    `            </button>
          </header>
          <div class="p50-login-material-scroll">
          <aside class="login-guide">`,
    "login scroll start must be unique",
  );
  review = once(
    review,
    `          <p v-if="message" role="status">{{ message }}</p>`,
    `          <p
            v-if="message"
            role="status"
            :data-tone="
              saving || loginMaterialBusy
                ? 'pending'
                : loginPayload && loginSaveStage === 'idle'
                  ? 'ready'
                  : 'warning'
            "
          >
            {{ message }}
          </p>`,
    "login message must be unique",
  );
  review = once(
    review,
    `          <footer>
            <button type="button" :disabled="saving" @click="closeEditor()">取消</button`,
    `          </div>
          <footer>
            <button type="button" :disabled="saving" @click="closeEditor()">取消</button`,
    "login scroll end must be unique",
  );
  return review;
}
