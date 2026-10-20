import assert from "node:assert/strict";
import test from "node:test";
import { iphoneCaseDeviceFit } from "../../apps/worker/dist/phone-case-device-fit.js";
import {
  productIdentityConfidence,
  selectConservativeSupplyMatch,
} from "../../apps/worker/dist/automatic-selection-evaluation.js";
import { automaticSupplyCompletionQuoteValid } from "../../apps/worker/dist/automatic-supply-completion-guard.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import { retireUnmatchedAutomaticSupplyQuotes } from "../../apps/worker/dist/automatic-supply-quote-retirement.js";
import {
  recoverDeviceFitEvaluations,
  deviceFitRecoveryCandidatesSql,
  deviceFitRecoveryUpdateSql,
  SUPPLY_DEVICE_FIT_REVISION,
} from "../../apps/worker/dist/automatic-selection-device-fit-recovery.js";

const main =
  'Miracase for iPhone 17 Pro Max Case 6.9" Full-Body Camera Protector Drop Proof 17 ProMax Cover';
const wrong = "肤感磁吸精孔苹果18PROMAX手机壳樱桃红18PRO防摔苹果17PRO保护套";
for (const title of [
  wrong,
  "适用苹果17Promax手机壳16Pro带拍照按键磁吸保护壳",
  "苹果17手机壳",
  "苹果17Pro手机壳",
  "苹果17Pro/Max手机壳",
  "苹果17PM手机壳",
  "苹果18ProMax手机壳",
]) {
  test(`wrong or SKU-ambiguous source cannot establish the 17 Pro Max quote: ${title}`, () => {
    assert.equal(iphoneCaseDeviceFit(main, title), false);
    assert.equal(productIdentityConfidence(main, title), 0);
  });
}
for (const title of [
  "适用苹果17ProMax透明磁吸手机壳",
  "适用 iPhone 17 Pro Max 磁吸保护套",
  "苹果１７ＰｒｏＭａｘ手机壳",
]) {
  test(`actual coupled device survives formatting: ${title}`, () => {
    assert.equal(iphoneCaseDeviceFit(main, title), true);
    assert.ok(productIdentityConfidence(main, title) >= 80);
  });
}
test("identical explicit multi-device declarations remain supported without borrowing a suffix", () => {
  assert.equal(iphoneCaseDeviceFit("ESR iPhone 14/13 Case", "适用苹果13/14手机壳"), true);
  assert.equal(iphoneCaseDeviceFit("ESR iPhone 14/13 Case", "适用苹果13Pro/14手机壳"), false);
  assert.equal(iphoneCaseDeviceFit("iPhone 17 Pro Max Case [15FT]", "苹果17ProMax手机壳"), true);
});
const row = (id, title, price) => ({
  raw_evidence_id: `raw-${id}`,
  created_at: new Date("2026-10-20T00:00:00Z"),
  payload_json: { title, price, currency: "CNY", external_id: String(id) },
});
const validRows = [
  row(1, "苹果17ProMax手机壳", 5),
  row(2, "苹果17ProMax手机壳", 7),
  row(3, "苹果17ProMax手机壳", 9),
];
const proof = {
  purchase_source_type: "automatic_crawler_evidence",
  purchase_confirmation_mode: "automatic_evidence",
  purchase_source_ref_id: "1688:3:p75:3",
  supply_evidence_id: "raw-3",
  supply_offer_id: "3",
  purchase_price: 9,
};
const scope = { opportunityId: "op", organizationId: "org", workspaceId: "ws" };
const params = ["op", "org", "ws"];
function db(rows, primaryTitle = main) {
  return {
    query: async (sql, values) => {
      assert.deepEqual(values, params);
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              payload_json: { title: primaryTitle, price: 30, currency: "USD" },
              observed_at: new Date(),
            },
          ],
        ];
      if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
      assert.equal(sql, automaticSupplyEvidenceSql);
      return [rows];
    },
  };
}
test("completion rechecks the same scoped primary, independent cohort and exact selected evidence/price", async () => {
  assert.equal(await automaticSupplyCompletionQuoteValid(db(validRows), params, proof), true);
  for (const rows of [
    validRows.slice(0, 2),
    validRows.map((r) => ({ ...r, payload_json: { ...r.payload_json, title: wrong } })),
    [],
  ])
    assert.equal(await automaticSupplyCompletionQuoteValid(db(rows), params, proof), false);
  for (const change of [
    { purchase_price: 7 },
    { supply_offer_id: "2" },
    { supply_evidence_id: "other" },
  ])
    assert.equal(
      await automaticSupplyCompletionQuoteValid(db(validRows), params, { ...proof, ...change }),
      false,
    );
  assert.equal(
    await automaticSupplyCompletionQuoteValid(
      db(validRows, "iPhone 16 Pro Max Case"),
      params,
      proof,
    ),
    false,
  );
});
test("manual and classified generic source costs do not enter the P75 title guard", async () => {
  const noRead = {
    query: () => {
      throw new Error("unexpected evidence read");
    },
  };
  assert.equal(
    await automaticSupplyCompletionQuoteValid(noRead, params, {
      ...proof,
      purchase_confirmation_mode: "human_review",
    }),
    true,
  );
  assert.equal(
    await automaticSupplyCompletionQuoteValid(noRead, params, {
      ...proof,
      purchase_source_ref_id: "1688:3:classified-title:v1",
    }),
    true,
  );
});
test("mixed models cannot fill the three independent samples or alter the surviving P75 price", () => {
  const supplies = validRows.map((r) => ({
    ...r.payload_json,
    externalId: r.payload_json.external_id,
    evidenceId: r.raw_evidence_id,
    observedAt: r.created_at,
  }));
  assert.equal(
    selectConservativeSupplyMatch(
      main,
      supplies.slice(0, 2).concat({ ...supplies[2], title: wrong }),
    ),
    null,
  );
  assert.equal(
    selectConservativeSupplyMatch(
      main,
      supplies.concat({ ...supplies[2], externalId: "4", title: wrong, price: 100 }),
    ).conservativePrice,
    9,
  );
});
test("retirement keeps history and excludes manual, other scopes and classified costs in both locked read and update", async () => {
  const calls = [];
  const retired = await retireUnmatchedAutomaticSupplyQuotes(
    {
      query: async (sql, values) => {
        calls.push(sql);
        assert.deepEqual(values, params);
        for (const boundary of [
          "opportunity_id=? AND organization_id=? AND workspace_id=?",
          "confirmation_mode='automatic_evidence'",
          "source_type='automatic_crawler_evidence'",
          "is_current=1",
          "^1688:[0-9]{1,40}:p75:[0-9]+$",
        ])
          assert.ok(sql.includes(boundary));
        assert.doesNotMatch(sql, /DELETE|amount_value=/);
        return sql.startsWith("SELECT")
          ? [[{ id: "ci", evidence_id: "raw", source_ref_id: "1688:1:p75:3" }]]
          : [{ affectedRows: 1 }];
      },
    },
    scope,
  );
  assert.equal(retired[0].input_id, "ci");
  assert.match(calls[0], /FOR UPDATE$/);
  assert.match(calls[1], /SET is_current=0/);
  await assert.rejects(
    retireUnmatchedAutomaticSupplyQuotes(
      {
        query: async (sql) => (sql.startsWith("SELECT") ? [[{ id: "ci" }]] : [{ affectedRows: 0 }]),
      },
      scope,
    ),
    /retirement_conflict/,
  );
});
test("device-fit recovery atomically rechecks active pending scope, unleased P75 costs and a once-only revision", async () => {
  let updated = false;
  const pool = {
    query: async (sql, values) => {
      if (sql === deviceFitRecoveryCandidatesSql) {
        assert.deepEqual(values, [SUPPLY_DEVICE_FIT_REVISION]);
        return [
          updated ? [] : [{ opportunity_id: "op", organization_id: "org", workspace_id: "ws" }],
        ];
      }
      assert.equal(sql, deviceFitRecoveryUpdateSql);
      assert.deepEqual(values.slice(3, 6), params);
      updated = true;
      return [{ affectedRows: 1 }];
    },
  };
  assert.equal(await recoverDeviceFitEvaluations(pool, new Date()), 1);
  assert.equal(await recoverDeviceFitEvaluations(pool, new Date()), 0);
  for (const sql of [deviceFitRecoveryCandidatesSql, deviceFitRecoveryUpdateSql]) {
    assert.match(sql, /e.status IN \('succeeded','waiting_evidence'\)/);
    assert.match(sql, /o.decision_status='pending'/);
    assert.match(sql, /g.status='active'/);
    assert.match(sql, /w.status='active'/);
    assert.match(sql, /supply_device_fit_revision/);
    assert.match(sql, /confirmation_mode='automatic_evidence'/);
  }
});
