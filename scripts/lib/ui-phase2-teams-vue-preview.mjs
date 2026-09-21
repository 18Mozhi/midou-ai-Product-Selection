import assert from "node:assert/strict";

export const teamsVueFile = "apps/web/src/components/OrganizationTeamPanel.vue";
export const teamsVueCss = "design-plans/ui-phase-2-2026-09-07/implementation/teams-vue-c.css";
export const teamsVueChanges = [
  ["<h3>团队治理台</h3>", "<h2>团队与协作</h2>"],
  [
    '<section class="org-team-panel" aria-label="团队治理台">',
    '<section class="org-team-panel" aria-label="团队治理台">\n' +
      '<nav class="teams-c-index" aria-label="团队页内导航"><p>组织协作</p><strong>团队工作台</strong>' +
      '<a href="#p33-directory">01 团队目录</a><a href="#p33-collaboration">02 协作关系</a>' +
      '<small>先选择团队，再维护成员归属。</small></nav><div class="teams-c-main">',
  ],
  [
    'class="org-admin-card org-team-directory"',
    'id="p33-directory" class="org-admin-card org-team-directory"',
  ],
  [
    'class="org-admin-card org-team-detail"',
    'id="p33-collaboration" class="org-admin-card org-team-detail"',
  ],
  [
    '<div v-if="pageItems.length" class="org-team-list" role="list">\n          <button\n            v-for="team in pageItems"\n            :key="team.id"\n            type="button"\n            role="listitem"',
    '<ul v-if="pageItems.length" class="org-team-list">\n          <li v-for="team in pageItems" :key="team.id"><button\n            type="button"',
  ],
  [
    '          </button>\n        </div>\n        <div v-else class="org-team-empty"',
    '          </button></li>\n        </ul>\n        <div v-else class="org-team-empty"',
  ],
  ["    </section>\n  </section>\n</template>", "    </section>\n  </div></section>\n</template>"],
];

// New composition of the actual team component. Its script, events and models are untouched.
export function previewTeamsVue(source) {
  let result = source.replaceAll("\r\n", "\n");
  for (const [before, after] of teamsVueChanges) {
    assert.equal(result.split(before).length, 2, `Inspect P33 Vue anchor: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
