import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Exact Git sources for archived review images. They are not current-UI acceptance.
export const sharedReviewRevisions = Object.freeze({
  "apps/web/src/components/OrganizationAdminCenter.vue": {
    baseline: "df4b7263b1684e94e4ecc8d46c856c202fd9ee7b",
    captured: "3a7cb53678305b9699614f67e180d3c75f283f60e1831f3f7cf748a1577fec93",
    current: "32fc333d3b6906c762e51f1a453c5799a155c081beea6fc6ee13e5b494d74eba",
  },
  "apps/web/src/components/AuditedReasonDialog.vue": {
    baseline: "4a6368ef1178908688cd6519c5cafafb25c1afcb",
    captured: "b58a89ec1f0fcc2ce6b8e8209e92c1b30450f8920e629718e1e03d74a9b2d5cb",
    current: "3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a",
  },
  "apps/web/src/components/ResponsiveDataView.vue": {
    baseline: "54ec47364b3422b1d49a6eea18f070229af56a59",
    captured: "b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99",
    current: "64fb30168156d1656fc13699d499652c4b3017d497fe48d8f89591d3c2e1d701",
  },
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs": {
    baseline: "54ec47364b3422b1d49a6eea18f070229af56a59",
    captured: "a664a9f5b17f53abd0673150e475025dd6d1accdcc7f809bdad8fd0cbb3596a4",
    current: "cf120ce244300ab3ea15358bf4d1fa3d297e6f0286f28128f550aee2842e4f3a",
  },
  "apps/web/src/components/ConfirmDialog.vue": {
    baseline: "060e0b591af732c4c69060a468f526c45cc1330c",
    captured: "6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b",
    current: "3fbdb1841fe1426ecb6a4d808d05d9da8216e501c251b5bf3704b5680af35424",
  },
  "apps/web/src/components/DataQualityCenter.vue": {
    baseline: "cd54af437d149d569fb13ec0c905c1e4bc81bdbd",
    captured: "92bfec2ad010bc6f6b0c82571a911a0107075acba1c3b5643376f86716b94d2c",
    current: "2c523882706ad74b43905b29a9d3ee6396b1bdbd676bef32089edcf311be9120",
  },
  "apps/web/src/components/NavigationShell.vue": {
    baseline: "243941a0620cd7444bd494a0242d471b343e58c5",
    captured: "4490c21cd477e2874dd9f2eb3c0cafafa2e88baf46620d2a0eb31a3f4e53d2bc",
    current: "0819cf432ed5432267631555c156d47be7487140b5ae8650adcfb327f68832eb",
  },
  "apps/web/src/components/OrganizationApprovalPanel.vue": {
    baseline: "d77ce47ba93ed91c2aaff4263f398e13cdfbfff9",
    captured: "16d86905c07d49050cb10a707d0d3f0157fd2dc837039cab425f8a85bc3ab1cf",
    current: "332425d1b75e66f4f313f949eac92b4a635b2fb544ac6ea746e2ab32ebb8d22b",
  },
  "apps/web/src/components/PlatformManagementCenter.vue": {
    baseline: "48f61a5290236cb0de76fd010d775a00d2bce67c",
    captured: "57c60bbdc5e61f63762057c3c217016e4fa1a0594ab3c368ffee003e748d9615",
    current: "471e940d9f254ade77f69cbe47ad3f80d6a3b722189f7dca8c252094013aa6f1",
  },
  "tests/e2e/m06-02-platform-dashboard.spec.ts": {
    baseline: "ff46bfe9c620a422d95cab9689489b07fb6b95ea",
    captured: "7d0f9118b740aa7844bd63796e5cf5ede3ebefda1f88d58419257b962e68cd58",
    current: "d4f205c4abd85dd76caab7a8a8de83b27999cd4238afa387b6cce9cf7e023019",
  },
  "tests/e2e/m03-06-evidence-data-quality.spec.ts": {
    baseline: "d99f047c95a15508066cdd191275344d3086f46a",
    captured: "e5a582642e3b35d2ccfa82872cc91bc00412a1521893508433c31cfaad3b45cb",
    current: "e5b9b8ea389ca406d6a9e18f0794d243b6ba1843b41570197a19d4e7a0c13ece",
  },
  "scripts/lib/ui-phase2-members-design-data.mjs": {
    baseline: "b72725feaacaa4523e2bb2cd7c0dc271b4fb4c9e",
    captured: "9a7089274376dabacb9854d71234ab2e989ee49ab7f26b2387ee8ae70e697e8e",
    current: "fe4bd67e00f1b293fabcc8adb116e20e692a8763bf7e3b61e7387083b58a2c2e",
  },
  "apps/web/src/components/PlatformManagementFilter.vue": {
    baseline: "6fe2178855964865e12f324e0a411d63ed7d3a5e",
    captured: "b1e608502ee29df66c4f813c38a6593ffc4c8bc5770183cfdfafbf968db689d9",
    current: "58ed6c796cffa780c81b565b8081b40e3cf006feb238ed15758b4c3cf9ed7f2f",
  },
  "apps/web/src/components/PlatformDataCenter.vue": {
    baseline: "b4bdcf11059aa414419d4002303e973b7e126eb8",
    captured: "bfeead63eec768c7b20bb5cc2fdd0279e9c4ccffa70c5d5dfbe41afc0f28cd2a",
    current: "cea9e38609e58f56c93bdbf1311c035f176640b5fc1829709c5f1acedb69ba61",
  },
});

// A file can legitimately underpin multiple archived review packets.
// The expected captured hash is part of the key, so packets cannot cross-bind.
export const sharedReviewVariants = Object.freeze({
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs#c1095b828706864ee9eb2be430e08e0277522f4e4cf3d1beb084499265fcd457":
    {
      baseline: "af239b08b69f7d97cd0372f9840a70009eeef0c7",
      captured: "c1095b828706864ee9eb2be430e08e0277522f4e4cf3d1beb084499265fcd457",
      current: "cf120ce244300ab3ea15358bf4d1fa3d297e6f0286f28128f550aee2842e4f3a",
    },
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs#86e109870bed9731f32a5beae9a5f8a316d31dcb5c5b163681e8523a8b79fde8":
    {
      baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
      captured: "86e109870bed9731f32a5beae9a5f8a316d31dcb5c5b163681e8523a8b79fde8",
      current: "cf120ce244300ab3ea15358bf4d1fa3d297e6f0286f28128f550aee2842e4f3a",
    },
  "apps/web/src/components/SelectionJourney.vue#107a289ca488e7dfa6e7b6a2d1fa50b740294e5223fd3ab316653c3faf89685f":
    {
      baseline: "7beac32e8309830c99d09eb5eb1d6197a4b84371",
      captured: "107a289ca488e7dfa6e7b6a2d1fa50b740294e5223fd3ab316653c3faf89685f",
      current: "08e6c860cb5ebfec8f8a7999c9dcd32d6aaa8918b9e48c172507afff17965573",
    },
  "apps/web/src/components/use-platform-notification-list.ts#2e697d3a5f53cdfded5335bc693fcd9f7ed1a7d9f8b2dc0a543708269bfdc61b":
    {
      baseline: "6fe2178855964865e12f324e0a411d63ed7d3a5e",
      captured: "2e697d3a5f53cdfded5335bc693fcd9f7ed1a7d9f8b2dc0a543708269bfdc61b",
      current: "bf58bd0ad7921c3930610bc3e685dff95c79ad93a8a7cd20489633322606e6d6",
    },
  "apps/web/src/components/ResponsiveFilterDrawer.vue#a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011":
    {
      baseline: "01af02620bdbb751cc846e6a02081d4a0b735784",
      captured: "a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011",
      current: "5eff0a117552e22bf31a0d3761b0613428c777721b8e230b10e76bab39ee0a5f",
    },
  "apps/web/src/components/use-platform-content-list.ts#48005b5d0b70e22358f7aba27048717b980701ae2fcaaab52b32943a65770ff9":
    {
      baseline: "dcc76b172b88541cd11de3d3fca2885fe55df053",
      captured: "48005b5d0b70e22358f7aba27048717b980701ae2fcaaab52b32943a65770ff9",
      current: "ff5e74901f493bfcdd9d2022e9f400382038cda38e63f2f75284b9a6d1837535",
    },
  "design-plans/ui-phase-2-2026-09-07/design/data-quality-direction-c/evidence.json#94b41cb5ff8f45a3a3eb2acf454f8a6b922852b323a9918bf76db010546dd9d4":
    {
      baseline: "54ec47364b3422b1d49a6eea18f070229af56a59",
      captured: "94b41cb5ff8f45a3a3eb2acf454f8a6b922852b323a9918bf76db010546dd9d4",
      current: "495d1e383baa6664c4debc54a40a0152fe005cf8aec5361309af0a503ec1878b",
    },
  "design-plans/ui-phase-2-2026-09-07/design/data-records-direction-c/data.js#3574af7d7e45cd5f0b89ccb0cb62bef9557ac3e73906031da00a24a81f9acf66":
    {
      baseline: "6b4d772c15b555de27fa64f79c880a058295caac",
      captured: "3574af7d7e45cd5f0b89ccb0cb62bef9557ac3e73906031da00a24a81f9acf66",
      current: "a9a8474aa98a95bef46f207bc6d6c3abcc84d404db51c921ae90d63a4bed4856",
    },
  "design-plans/ui-phase-2-2026-09-07/design/data-records-direction-c/evidence.json#aaa70e82a4f6d32ad36f0f9b8566d0335c5d0dc7eba2658b0454e672d27c7dd3":
    {
      baseline: "54ec47364b3422b1d49a6eea18f070229af56a59",
      captured: "aaa70e82a4f6d32ad36f0f9b8566d0335c5d0dc7eba2658b0454e672d27c7dd3",
      current: "8b62d3a808f5b303561f666ad45d8fc5a42a3ae5811a44d01e2ef70e486dd8ac",
    },
  "design-plans/ui-phase-2-2026-09-07/design/data-records-direction-c/records.js#68f39dfaad92b89d3511943d409f693b7c6b3e88b08bafcdaa63e33390471d98":
    {
      baseline: "6b4d772c15b555de27fa64f79c880a058295caac",
      captured: "68f39dfaad92b89d3511943d409f693b7c6b3e88b08bafcdaa63e33390471d98",
      current: "b2a49083d5ea0b20397ae3942db207826951a6a78c05ea807abc86d343c1c48d",
    },
  "design-plans/ui-phase-2-2026-09-07/design/data-records-direction-c/source-logic.js#4c0cf7c3bdcbbfd93fb9e7f1d38b07cb8110cdecc98557971b5e9922b3527f8a":
    {
      baseline: "4a6368ef1178908688cd6519c5cafafb25c1afcb",
      captured: "4c0cf7c3bdcbbfd93fb9e7f1d38b07cb8110cdecc98557971b5e9922b3527f8a",
      current: "bcbbefcd0883ec88d085fabf379cdd2e484564776ca4ada0a638f974176cd333",
    },
  "scripts/lib/ui-phase2-data-quality-design-data.mjs#91fdcbbadc6f12c20f8d6ebea9f72b7dee390ccca618324d0e0c4b709157462a":
    {
      baseline: "ce50835aa9972dd2b50b1977270cc998b09ba5fd",
      captured: "91fdcbbadc6f12c20f8d6ebea9f72b7dee390ccca618324d0e0c4b709157462a",
      current: "cc334c54de7a2ea1cba48898bd572b5385add437e09f90cbb644f9bf8ebdfc1f",
    },
  "scripts/lib/ui-phase2-data-records-design-data.mjs#bd6b951fdc438690d3206314aae3d572ee0954b6db4e47af26e1d0f0e7dc408e":
    {
      baseline: "6b4d772c15b555de27fa64f79c880a058295caac",
      captured: "bd6b951fdc438690d3206314aae3d572ee0954b6db4e47af26e1d0f0e7dc408e",
      current: "baaead84e21d4caaea3fd7b7698bb9560d9c74322d684d188fd861146e0218b1",
    },
  "scripts/verify-ui-phase2-data-quality-c.mjs#5ecc5635ec030d6e1000145b0f2e5e99283fb9d7e4a0a87444eea3caad24ed66":
    {
      baseline: "e845daca4bc601a3c3bb5baa893203d73083fbea",
      captured: "5ecc5635ec030d6e1000145b0f2e5e99283fb9d7e4a0a87444eea3caad24ed66",
      current: "a5022038047c8914578a74310af96cbe4063229dbf72a81f0f3d82a6056fb8ae",
    },
  "scripts/verify-ui-phase2-data-records-c.mjs#53e4d63125bc3f3aa69f18f13bd39a98e77ec496766bd623d0a5039dbd3bfdd9":
    {
      baseline: "e845daca4bc601a3c3bb5baa893203d73083fbea",
      captured: "53e4d63125bc3f3aa69f18f13bd39a98e77ec496766bd623d0a5039dbd3bfdd9",
      current: "40e627cc2688d1159442b8c1374569c8818f746ef18a97b87eb812a1314750a0",
    },
  "apps/web/src/components/BackupRecoveryCenter.vue#6da8b11e02114158f6189148d4edfb824179446794e4d20b798e5356a030cd02":
    {
      baseline: "dd31af05629215a4863f7a6a14bf973f43f6f10a",
      captured: "6da8b11e02114158f6189148d4edfb824179446794e4d20b798e5356a030cd02",
      current: "969cd10fc0a99f35243278bbbc3b5896b10ea4627722f295911fc9ffb0d45100",
    },
  "apps/web/src/components/CollectionTaskCenter.vue#1e2c3b8ae78152dc01991641730fcfe5f8e835395c6919bb674875e7c6fa79ed":
    {
      baseline: "5ad7b7b9c08697873b3f66d52fe53ebe6f133184",
      captured: "1e2c3b8ae78152dc01991641730fcfe5f8e835395c6919bb674875e7c6fa79ed",
      current: "509341da51ee51234bbf27de21e14c7943d409efb0339bcd59b6dbf047ff6160",
    },
  "apps/web/src/components/CommercialOperationsCenter.vue#4588f387404e14d4ab62ee30b1160d6f38e7978fcc4701a877700ca307be0e33":
    {
      baseline: "66bea9b6dfa514c19df8607daa173efddd26de74",
      captured: "4588f387404e14d4ab62ee30b1160d6f38e7978fcc4701a877700ca307be0e33",
      current: "999f556ad6e719bbaed086c31bafb63a6a2e36d1cce674d29d4ab9f7f57cd5ed",
    },
  "apps/web/src/components/CredentialAssetCenter.vue#4c4064c119242a6d7023767f796e70634f71fd0832eca1b2ddd62de56206e1be":
    {
      baseline: "a728f810feefe11706579903b86f0e6e1b165dda",
      captured: "4c4064c119242a6d7023767f796e70634f71fd0832eca1b2ddd62de56206e1be",
      current: "e969248a6726fffb7480ddb1919b36dfe6cb10438d1c02a204e1a7e3b7f48835",
    },
  "apps/web/src/components/OpenPlatformCenter.vue#5bc93ec6671395ad0e4319b4fb36aca0eba29dceb5d47a777d09fbb9ccd416d5":
    {
      baseline: "66bea9b6dfa514c19df8607daa173efddd26de74",
      captured: "5bc93ec6671395ad0e4319b4fb36aca0eba29dceb5d47a777d09fbb9ccd416d5",
      current: "81dad2d4a82e49b089d97dba8ed28a1eee23b5597446d3e460febea341f3b97b",
    },
  "apps/web/src/components/PlatformContentPagination.vue#2c59ac9fa920dd095d36718eb86638a58abaebc6dd99bd8b73e869af5a0e6402":
    {
      baseline: "dcc76b172b88541cd11de3d3fca2885fe55df053",
      captured: "2c59ac9fa920dd095d36718eb86638a58abaebc6dd99bd8b73e869af5a0e6402",
      current: "2a96546fb88ebc4eacf279b868d620e27c550c990ab6ef129c60803f69c7d244",
    },
  "apps/web/src/components/PlatformDataCenter.vue#10f653d56272859493121550b668ec02a88e7a2586aa9590e9cf31659115ccf4":
    {
      baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
      captured: "10f653d56272859493121550b668ec02a88e7a2586aa9590e9cf31659115ccf4",
      current: "cea9e38609e58f56c93bdbf1311c035f176640b5fc1829709c5f1acedb69ba61",
    },
  "apps/web/src/components/PlatformGovernanceCenter.vue#76eae80f51225c3af676a17ab9c4ec94369262cc5e8c968be7fd62ef5f2280db":
    {
      baseline: "b4bdcf11059aa414419d4002303e973b7e126eb8",
      captured: "76eae80f51225c3af676a17ab9c4ec94369262cc5e8c968be7fd62ef5f2280db",
      current: "aaf41ff99d80d1e7055adf23c3abc3db7e256e54c06e54301735747db2e6a048",
    },
  "apps/web/src/components/PlatformLogCenter.vue#4929b467cd1c7922db86e0f191fb922b2dacdbc271aec9b6b4cde3c2842c8e4d":
    {
      baseline: "9c1f755acc559cd17446dcabd775a3eb39646de0",
      captured: "4929b467cd1c7922db86e0f191fb922b2dacdbc271aec9b6b4cde3c2842c8e4d",
      current: "caaf302bb0218ee1dc90117a77f558999d5765b9c7044408431b4a673231945a",
    },
  "apps/web/src/components/PlatformManagementRecordList.vue#3ec74f90ff5740a58f70ea98fdc9c76835da9d223f01dd31d23ffd6a7cf78bfc":
    {
      baseline: "dcc76b172b88541cd11de3d3fca2885fe55df053",
      captured: "3ec74f90ff5740a58f70ea98fdc9c76835da9d223f01dd31d23ffd6a7cf78bfc",
      current: "46b8b786a5aa6edbd2adc7c835a8e4d9a00257ff363b1888f77b5d4bb45f98ad",
    },
  "apps/web/src/components/PlatformMessageEditor.vue#8bafb3374f744389257c36a27580dbf768a9b4a0991fa0ce748889bb2c093cea":
    {
      baseline: "3a0c866b47c1ec0bdc951ab8d23488fd654cefbe",
      captured: "8bafb3374f744389257c36a27580dbf768a9b4a0991fa0ce748889bb2c093cea",
      current: "299031770711240b20ded18c86d6eb2dae9081fb44a732e06efa3317b540041a",
    },
  "apps/web/src/components/PlatformMessageWorkbench.vue#7863a19cace6a921628b2e33e66434a5662868d8a33351abc1ef3d129a7382c2":
    {
      baseline: "965ce9f95f620d7c3c2d140e5ba9ca25cab4146b",
      captured: "7863a19cace6a921628b2e33e66434a5662868d8a33351abc1ef3d129a7382c2",
      current: "689531d215e8878405c53ae55a4b157066cde2e9a1455242da7262079e27b2a5",
    },
  "apps/web/src/components/PlatformNotificationManagement.vue#a91ffa14ffdbd1f17b01f0877b745288d96c4ea8574449721edbc61883f1cb18":
    {
      baseline: "6fe2178855964865e12f324e0a411d63ed7d3a5e",
      captured: "a91ffa14ffdbd1f17b01f0877b745288d96c4ea8574449721edbc61883f1cb18",
      current: "7cced021643a3af6a23a07f8afca71d943cabcd13cf963d97ac3b698a3dfe2e8",
    },
  "apps/web/src/components/PlatformNotificationOperations.vue#18c8b856cc26ed7aa7bf45f7375645ea23a5914b50425d84ee03efc17268cc6c":
    {
      baseline: "462c6eae01e9c7f2582d1338b7275dd80459fb6d",
      captured: "18c8b856cc26ed7aa7bf45f7375645ea23a5914b50425d84ee03efc17268cc6c",
      current: "73bfa7089471ce53ea44f747727211684cb840df62a22a86b70dbaa4c9ba5e07",
    },
  "apps/web/src/components/PlatformNotificationPagination.vue#6116c32da6df91e40433fd5f4e4f9cc82c59d20b5726df52ebfdafcaf08b1606":
    {
      baseline: "6fe2178855964865e12f324e0a411d63ed7d3a5e",
      captured: "6116c32da6df91e40433fd5f4e4f9cc82c59d20b5726df52ebfdafcaf08b1606",
      current: "56968271bcfcf600901782eea6601eaae49a5a84bc5d3ab7bc0a9618596f0849",
    },
  "apps/web/src/components/ProviderAdapterCenter.vue#0ef775e4638ffdee87eb12caf959891d30b52932f4b5eb6b9b96ebec88851075":
    {
      baseline: "ed4e8edfd358e4d7ab36e71007bff15a859f5854",
      captured: "0ef775e4638ffdee87eb12caf959891d30b52932f4b5eb6b9b96ebec88851075",
      current: "24a3b27fca62f5331bd19c58ba501e2b6b9777d7e59a7b03248286d82a4962a2",
    },
  "apps/web/src/components/ProviderRegistry.vue#e98ec358ce10015bca5cac1ff9e5b433411bcdc49cb60654458ebed31e4c2a2e":
    {
      baseline: "7b86e25d7ed1f3a75400887b4ab6efa7f0585031",
      captured: "e98ec358ce10015bca5cac1ff9e5b433411bcdc49cb60654458ebed31e4c2a2e",
      current: "9822fd9a882dd61409420d414e1fcdaae4c8ce513d53c853c9bda9741c609c2c",
    },
  "apps/web/src/components/ReleaseRolloutCenter.vue#0fcdd0f1eb7e16423188350bbc1dee13fc036d7b51b0ee248a25f2edd54537d1":
    {
      baseline: "66bea9b6dfa514c19df8607daa173efddd26de74",
      captured: "0fcdd0f1eb7e16423188350bbc1dee13fc036d7b51b0ee248a25f2edd54537d1",
      current: "b5344202cf358e7a5f61d8b0d73f4086c59157e395d12eda5f719a532bf79e63",
    },
  "apps/web/src/components/ResponsiveDataView.vue#28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa":
    {
      baseline: "d99f047c95a15508066cdd191275344d3086f46a",
      captured: "28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa",
      current: "64fb30168156d1656fc13699d499652c4b3017d497fe48d8f89591d3c2e1d701",
    },
  "apps/web/src/components/ResponsiveDataView.vue#52738f13651a70aab3601928e163fe32fb88cc992d0b09dfe67297754e44b39c":
    {
      baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
      captured: "52738f13651a70aab3601928e163fe32fb88cc992d0b09dfe67297754e44b39c",
      current: "64fb30168156d1656fc13699d499652c4b3017d497fe48d8f89591d3c2e1d701",
    },
  "apps/web/src/components/ResponsiveDataView.vue#6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac":
    {
      baseline: "af239b08b69f7d97cd0372f9840a70009eeef0c7",
      captured: "6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac",
      current: "64fb30168156d1656fc13699d499652c4b3017d497fe48d8f89591d3c2e1d701",
    },
  "apps/web/src/components/RuntimeTopologyCenter.vue#457ff21b3b62967c1cf4b0d19c4eab3aa83d9d1308a9cf9b6b7ef2dfab2a4f79":
    {
      baseline: "c8318852f498fc72ca863dbbdae8244a5879a686",
      captured: "457ff21b3b62967c1cf4b0d19c4eab3aa83d9d1308a9cf9b6b7ef2dfab2a4f79",
      current: "aedf6a1e9a83b11ba8376aad116fe6e048261b79c6bbe92063e185d76cd3a7a3",
    },
  "apps/web/src/components/SecurityOperationsCenter.vue#1674fd35baca05708781a57093690b77511b7439cfad621c122db5f82bf472f3":
    {
      baseline: "5695ae753d1d8e821dff9871d7a4dc00865bbb3f",
      captured: "1674fd35baca05708781a57093690b77511b7439cfad621c122db5f82bf472f3",
      current: "a583e75d6491fedc7ae94e449c5a31f421055587168101c81bf4922ffd4c2ba3",
    },
  "apps/web/src/components/use-platform-content-review.ts#e700d67e95e44859d7283b7370ad4690fd13cf341cb87a1e556a414ede9dbfe2":
    {
      baseline: "66bea9b6dfa514c19df8607daa173efddd26de74",
      captured: "e700d67e95e44859d7283b7370ad4690fd13cf341cb87a1e556a414ede9dbfe2",
      current: "04a83f402bc5b98ede50e7b7ac2d05da0580d47aee638b04915917993d1436e6",
    },
  "apps/web/src/components/use-platform-status.ts#735f0c250153e075fdf39ca40c5c47b63b7aa30dfe85e1c9f9381bc7e56d068a":
    {
      baseline: "ca1cbc697d8f3dc6d1a2440c20803270fc7ea215",
      captured: "735f0c250153e075fdf39ca40c5c47b63b7aa30dfe85e1c9f9381bc7e56d068a",
      current: "3866ef2b8c4d1031386356f870e413870184e5c087599da0946c391a704ec855",
    },
  "apps/web/src/runtime-topology.css#951a21caa2251c3fb136a3197a432d28ed13cc0f586b5cf5ce7574494fedfbb8":
    {
      baseline: "d022499143cbd6c35400922a77c4191f3be0bda9",
      captured: "951a21caa2251c3fb136a3197a432d28ed13cc0f586b5cf5ce7574494fedfbb8",
      current: "1f1bb535e78927aa2991e745478d9fe0271234231cfee55b2d83b93842055eb4",
    },
  "apps/web/src/signal-ledger.css#b4ff3916aa2916ea4ecd1ea52ceea0a04c6cdb9f37562c1543f08d6f7052a59b":
    {
      baseline: "0c5c48ee4959d24238af106ae6d2610a48aa9b9c",
      captured: "b4ff3916aa2916ea4ecd1ea52ceea0a04c6cdb9f37562c1543f08d6f7052a59b",
      current: "09ffcb57f34b375199256ce031309f1062204a2c27cdf8200050f0da333b7da1",
    },
  "scripts/lib/ui-phase2-api-coverage-design-data.mjs#34ad1d77eeb70a6297aadc2a6322a377aa8b7025765d6c07aa29a2193e3a272d":
    {
      baseline: "b5c39aab2f46fabf59ac3a78f135a99febdc0a28",
      captured: "34ad1d77eeb70a6297aadc2a6322a377aa8b7025765d6c07aa29a2193e3a272d",
      current: "977bfcdb2a53cad8828ee9bb7e1ccc4eaee268ff53bf83dc8ec6cd5833ca8073",
    },
  "tests/e2e/m07-04-backup-recovery.spec.ts#f9c712921c576a00c0ef4f9f4c24721f06a38d609514ee924557316259f17f53":
    {
      baseline: "dd31af05629215a4863f7a6a14bf973f43f6f10a",
      captured: "f9c712921c576a00c0ef4f9f4c24721f06a38d609514ee924557316259f17f53",
      current: "f66b07ceb740f84724badbb74e4e5da2c7f351273bdfdcafaa849171641ba1b6",
    },
  "tests/e2e/m03-05-collection-tasks.spec.ts#9218c2552339e5c25f2920f9fc340d9b546e89621c0978f4208179ae66151afd":
    {
      baseline: "5ad7b7b9c08697873b3f66d52fe53ebe6f133184",
      captured: "9218c2552339e5c25f2920f9fc340d9b546e89621c0978f4208179ae66151afd",
      current: "66bcb37988f1c064cff418506013a45b0b44c2d7eed6fa2d38e6a1420964fe96",
    },
  "tests/e2e/m03-02-credential-assets.spec.ts#0b735d56167c0c9e86b4bc7a3f3f8e8c3b6bc04106c0286bb9b1d05353c16929":
    {
      baseline: "a728f810feefe11706579903b86f0e6e1b165dda",
      captured: "0b735d56167c0c9e86b4bc7a3f3f8e8c3b6bc04106c0286bb9b1d05353c16929",
      current: "98b997aa88f7678f38fa28f7385e0e718341bd3f9c7b4f87417df5250f472c88",
    },
  "tests/e2e/m06-02-platform-dashboard.spec.ts#ad45253b01418096d7df00f364d8b820c99f7285ff961798c7749211bb2f1bb0":
    {
      baseline: "3d297b78d6e26abe803a10bd1a688fc4254d38bb",
      captured: "ad45253b01418096d7df00f364d8b820c99f7285ff961798c7749211bb2f1bb0",
      current: "d4f205c4abd85dd76caab7a8a8de83b27999cd4238afa387b6cce9cf7e023019",
    },
  "tests/unit/platform-notification-operations.test.mjs#366dc7309b7def6692fb8edd0861d37e3da3a82b3a713a9b0aa7004e2e3d2f75":
    {
      baseline: "6fe2178855964865e12f324e0a411d63ed7d3a5e",
      captured: "366dc7309b7def6692fb8edd0861d37e3da3a82b3a713a9b0aa7004e2e3d2f75",
      current: "ae983ba8987ee41a41e03887caab254b9d0315b8ea9d0ced98ed23ca6bd97370",
    },
  "tests/e2e/platform-message-management.spec.ts#ed45f8df2572d35492fe289a6de397b861dacee8d552fd9b77bc6bf0934c2dad":
    {
      baseline: "ff46bfe9c620a422d95cab9689489b07fb6b95ea",
      captured: "ed45f8df2572d35492fe289a6de397b861dacee8d552fd9b77bc6bf0934c2dad",
      current: "7111e8e7831a20b9a05030018384daa5000d632c9e488330d3cac1ff54d5d239",
    },
  "tests/e2e/m03-03-provider-adapter.spec.ts#f189c28a32f3d25bd0686379f9cfa978bd260df6085ea3650b0f1f5bedf28e74":
    {
      baseline: "ed4e8edfd358e4d7ab36e71007bff15a859f5854",
      captured: "f189c28a32f3d25bd0686379f9cfa978bd260df6085ea3650b0f1f5bedf28e74",
      current: "f5c6bd4e0d265e83dbb3179f732ff4db18409f79e87568248767827230ef1452",
    },
});

const hash = (source) => createHash("sha256").update(source).digest("hex");
const cached = new Map();

export function historicalSharedReviewSource(file, source) {
  file = file.replaceAll("\\", "/");
  source = source.replaceAll("\r\n", "\n");
  const revision = sharedReviewRevisions[file];
  if (!revision || hash(source) === revision.captured) return source;
  assert.equal(hash(source), revision.current, "Unreviewed shared review source: " + file);
  if (!cached.has(file)) {
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(captured), revision.captured, "Historical shared source drift: " + file);
    cached.set(file, captured);
  }
  return cached.get(file);
}

export function historicalSharedReviewVariantSource(file, expected, source) {
  file = file.replaceAll("\\", "/");
  source = source.replaceAll("\r\n", "\n");
  const revision = sharedReviewVariants[file + "#" + expected];
  if (!revision || hash(source) === revision.captured) return source;
  assert.equal(hash(source), revision.current, "Unreviewed shared review variant: " + file);
  const key = file + "#" + expected;
  if (!cached.has(key)) {
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(captured), revision.captured, "Historical shared variant drift: " + file);
    cached.set(key, captured);
  }
  return cached.get(key);
}
