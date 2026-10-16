import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Archived-review reconstruction only, including the current workspace shell.
// Current runtime assertions must use raw
// files. Exact published presentation revisions may enter the older inverse
// chain; neither captured hashes nor images nor approvals are rebound.
const baseline = "8516f8b435529b51552a1c37705b1a07dcef3cd4";
export const publishedPresentationRevisions = Object.freeze({
  "apps/web/src/design/platform-overlay-tokens.css": {
    current: "eb00768ad144315547668d595ef081e216729e6c36ab81aed5e86beff339bf90",
    before: "1ac279a72962b120c1f5153a9abb30e258e84be9c1519df1b7944f7190dd69b5",
  },
  "apps/web/src/components/PlatformAccountCenter.vue": {
    current: "d1dd7edb1a0551a88b1fb250e7b8b1e2d23cfbae8d2228cb6f62553e8e2904aa",
    before: "ec1f396132c0c7376b4e69290ca4198e64533fd93522fcafb55d3b5fcc36cb4a",
  },
  "apps/web/src/components/ProviderAdapterCenter.vue": {
    current: "73d59ce92d9800e51a8c74ac95f3fbac001cd1140e4799227ba2eea90b5a5df4",
    before: "1a98c8463bf4922f42c2376294e830cce83d7dbfb6f8e0a15a793c520ac69c9b",
  },
  "apps/web/src/design/provider-adapter-tokens.css": {
    current: "7bd92e39536ed603588d4993e375ee5b50ca2cca369d968f951480fd445f6871",
    before: "3f698489b5c23cd4b634655959c976c336e55d3b0fcc7d491bb56b999f71cdad",
  },
  "apps/web/src/App.vue": {
    current: "df9ff52c97017408361f35cb947ee6a2935ecba89d38818ce12e1cdf2b12fea2",
    before: "e8ed64e10e641a7988c999c3965c917d4640cd3a4eab213b8f23131641bac531",
  },
  "apps/web/src/approval-workspace.css": {
    current: "5507a5149059a6ee5735b14310299785edc29c0e4b0298e948a6ec4aa6eea056",
    before: "49e264307b8c2f92fca2a79efa4777fa7ff3f91ab93695930c5c4c367f3bc2ec",
  },
  "apps/web/src/backup-recovery-center-c.css": {
    current: "ed21aa77ad01ee61c546e83051bf478aa19db8a56e1f7dc9c304573e4bac3cd9",
    before: "f5c71b01cdd07dc2d7cb90f896377db74f14dc607fc56945f3377b3a79d43450",
  },
  "apps/web/src/capacity-boundary-c.css": {
    current: "c1e2f070f586164cc1cb4ced621f423169761bf477c426973aba162eb195a03f",
    before: "7279164c4b6e4aa7b385035c61a2c7b2425a71994e006db07a45d715e44c5314",
  },
  "apps/web/src/components/AccountShell.vue": {
    current: "2dce02f4df060836b057ad539d4c0850d7dff06b841375cbfab2d7defdb7f869",
    before: "f436ac84b9f3859a147afe8a0074bc14f892068d01a8655334eae74749b9ac39",
  },
  "apps/web/src/components/Alibaba1688AcceptanceCenter.vue": {
    current: "6ab9d0e32c1a66d2ff752c2bca3ae39e5c565b85eeb02424a83ef1e2ba815407",
    before: "f749b3fd435a0475ff15f77f7969d4beeaa37588fe164474d00023f8a1ea77da",
  },
  "apps/web/src/components/ApiCoverageDashboard.vue": {
    current: "6fefccdff4d459c6bedd546db6483953293ab7d1f7efb8617bd61a3f70b8ce06",
    before: "4290ac0831f3e231323f7f7eb4a5a0ee8f5f14d3d1ff2b4fb19fc213eda990de",
  },
  "apps/web/src/components/ApprovalWorkspace.vue": {
    current: "82378c6727991e5ef950bddff7ddede2a5a10651345c29348c28a1b378102fa1",
    before: "acf305210c6ccdace8a9929fcde398e1cc45d9cc20f46f4516841c329db8bfd4",
  },
  "apps/web/src/components/AuditSecurityCenter.vue": {
    current: "24a7afb0f57338733d49b69b7885c24c0295bf9db0213f286c137c1e8f5bec52",
    before: "49e2dfcdc9e12cd7efcc7311b259daffb4fbb703187f2c1a026acabcb5a87a80",
  },
  "apps/web/src/components/AuthorizationCenter.vue": {
    current: "7268df0ab334cf8b1b86e06443c9814bd25a83c5dea7ed5aa1c6c3a1f305ee92",
    before: "accb7cbfe2f0dc35466a81de506d0ca60223db49f13fa32ebd40ba38ee038920",
  },
  "apps/web/src/components/AutomationRuleCenter.vue": {
    current: "fa96f7ea19167faf2c3648b9410fc0d9385298c5993db181c39cb936133d4063",
    before: "44d23536f20a370d29b62fe89a463464a6bc5dbe5e298b3f0806e2cf82494d35",
  },
  "apps/web/src/components/BackupRecoveryCenter.vue": {
    current: "8e9638859947e9a147f68d9a03c2f8dc7d5209277620f1295bf542e1bb489452",
    before: "f84cc90e5fdfd3d0cb1f88a1308c55bad282718ba7e9e4c51d3a17dabde761de",
  },
  "apps/web/src/components/CapacityBoundaryCenter.vue": {
    current: "4bd5bc4283d2621bdd66b90e465243e823a7e38d237d1e3ab83b5eb013fa317f",
    before: "b03af4791efd1ebd97a954285eaf067f0aafd8e8d782cf5ac367a186e1ec61f2",
  },
  "apps/web/src/components/CapacityBoundaryEvidence.vue": {
    current: "232b4525bfabd64f08239ebdb5350570dc36acde12cba15171b4578fca96828b",
    before: "b815e48915ae9a72d1972d7ef7eebda8b91f5299041ca3028b8af65ef933fbd9",
  },
  "apps/web/src/components/CollectionOperationsConsole.vue": {
    current: "8882cc3b58271a95b39dab4f72d11beb769db478c589155b22c7a88aabb9d252",
    before: "2072fc208c456f08f3c325c36eae87413048ba93c0b2e50c07dad438eb69e01f",
  },
  "apps/web/src/components/CollectionRuntimeCenter.vue": {
    current: "c701d060832d9bae60976657890b9f6c58376b077dd6725517df684255aee5e9",
    before: "7ac6860fe5860c5b27d764e38567320440c67c726b99ff22dec685b03cf61381",
  },
  "apps/web/src/components/CollectionTaskCenter.vue": {
    current: "333d58152ca4dac7b548951d6fdc3a97c3ae791c13bbd9c1688096d266f7744b",
    before: "02b210d183bff5db344f33551cf1405ba7b5a912e026126c172ed8f1838623d8",
  },
  "apps/web/src/components/CommercialOperationsCenter.vue": {
    current: "773e7f7691d6d1b30432690d13a52d57df92c881fb08af2ac044149833705e63",
    before: "48c2b61c9649e267b0b591dfc6652d5a5aefc98a9f12b9d15a38e5fcbcd765ec",
  },
  "apps/web/src/components/CompetitorMonitor.vue": {
    current: "10a10471733a0457f30be20e179c4f29187ad8519b436c87e0ff8e74ecdf6987",
    before: "a68905d1b5d9811eb6fdcad646ec61b67cbcfc5ed8ce1d6ee1088351d752edcb",
  },
  "apps/web/src/components/CostRuleConsole.vue": {
    current: "f132630134363996555dcefba50158704eb5c427ab98c55719af59311fb6a1f5",
    before: "c08edf5c70df4534d340fb78923149b9ff11d34068105eed0e2b07993f23660b",
  },
  "apps/web/src/components/CrawlerSchedulerCenter.vue": {
    current: "ec684afdbd6d747231431cfa8d97152481f6bc4431f41cfdd494944e356d62f6",
    before: "93ab861fd025a9cf3e0ce77b49d9e7c60b506b5ae03ba3ab339c5ed9681c50ea",
  },
  "apps/web/src/components/CredentialAssetCenter.vue": {
    current: "6b249a07af6f66fb0eaf7fbe16e290699bbb85693756b429affbe59162687c4f",
    before: "26e415ad7bd0a1222397868648340c53f86faaa756025e32026d1c75797381c9",
  },
  "apps/web/src/components/DataQualityCenter.vue": {
    current: "3418bc286cc612e05f7ad82a1ff7ff281fb171ed80919f4ca2a3daf465635a0f",
    before: "dedfc36642f22b0a510c8751e9814dfab07ea3d973a604b664268e353f3cb536",
  },
  "apps/web/src/components/DiscoveryOverlay.vue": {
    current: "860b7a4c690470b071e4252fbc6d05da0f95c8c95006c2e378cf07e76c886fe5",
    before: "de8af2e6f38f14eddc590079353b146bfe412bb4831d1f9f948c35887b762ff5",
  },
  "apps/web/src/components/FileResilienceCenter.vue": {
    current: "87e6a567fc98be634a6205a62f5e69f931d53ba3501a2cc5b5e83f724d957578",
    before: "7c0d6cb0ca68698eb1acd1336b68d47fe538c2210d81c750d53c91b66b0a4914",
  },
  "apps/web/src/components/HomeDashboard.vue": {
    current: "0161f338f31f909cf116f0e11e116ec2b1e6e74e78d4d201a40364e904773355",
    before: "e54608bcb9d3b72b2f482b1f47d8559eb7d44b1649f0898a74bb1825e3eacad5",
  },
  "apps/web/src/components/LandingRedirectSurface.vue": {
    current: "fb2b7e4ae3456472c9313145b7da17716c8cb3b42dd7b2639b6035a904fcb241",
    before: "754c42fa9e95c98ae2e1086e74c2326507370e4a14e70e45ade38f11aaf2827d",
  },
  "apps/web/src/components/LocalIdentity.vue": {
    current: "a5313a00020009bbd0ed2d5bb92cb978cd2c8240f0d3c66feaae8162e9f450f3",
    before: "93bae79f7b253564e9c031189f5b57a891d571fc3c353e53c33d11d28c4f5eaf",
  },
  "apps/web/src/components/MySqlResilienceCenter.vue": {
    current: "032a6765f02f5199c9ef58f5dd07f6801dd1e77811af8275717a097d855bd6d1",
    before: "5a8749d5b26ef92d211314de1b53d4065d339e6cba6c710126bd6d42336ff1b6",
  },
  "apps/web/src/components/NavigationShell.vue": {
    current: "596cef4389d9ecf77b4eb433d0954031880a962ec0346c9455cc0c4790c5f933",
    before: "6ff17f60af1ebfd7f3edf3f3f8e679c812f8fb9c7f07218e9138df9cb811e86b",
  },
  "apps/web/src/components/NotFoundPage.vue": {
    current: "e6b8d95f372ee528239951cae2a845107841b39c73dfa11164585b53115b35a8",
    before: "51ebcf498abcd75376734fa4c93084d4a2588f25496c91ffa271d711bdc9499d",
  },
  "apps/web/src/components/NotificationCenter.vue": {
    current: "855d144c307cf290d55a66c4df86e933efb3afa4550be6ee553e1218c2c40f32",
    before: "4a3233cb6d570e3f2d68d0b399c25bba188dce1f7d7a3e40c9b17120938d4aa3",
  },
  "apps/web/src/components/OpenCreateDialog.vue": {
    current: "1187062d632b4181d6d8260f056a2c2dfe50fc859340bef8156340961fde0fc2",
    before: "165d6b784316b4a9ff88d0e8490d0abc21103c1fe7ec9c03e321d74f892b1261",
  },
  "apps/web/src/components/OpenPlatformCenter.vue": {
    current: "19ea6965bcc5c1f3ae8d80f99831615da9c14198d2fa809fce0beb92bc70c810",
    before: "f5d9611a732b6c1d360b23d039c3c307876e36637a12130eb76db0db57041859",
  },
  "apps/web/src/components/OpportunityAiPanel.vue": {
    current: "e2305542ce5c56c7f8de07a57222762837b67f6330fb92f38fc042c2ff1d14a1",
    before: "a6b4ed5eb74239b341fd84fc988c66f335dac58698ee5f0a261d9d1764140b8f",
  },
  "apps/web/src/components/OpportunityDetailInsights.vue": {
    current: "a5fc139e5ce02ef60ed45c900b5ed9481c88ca13c1171fad6c79a19523a0a0fa",
    before: "41b89271764a966ce1ad822266aa8c5e26d6ddceac5cbb8683e4a4ab7c20d6d0",
  },
  "apps/web/src/components/OpportunityDetailNavigation.vue": {
    current: "c7e13675b2407b12bb3829ba3be75884ae0eac2690364831eb896f6c8d7336be",
    before: "bc672394516d76821e73b3d2ee94bd3e13d5ff961ddd8a741391b51f8dceb5b7",
  },
  "apps/web/src/components/OpportunityFeedbackPanel.vue": {
    current: "f7c4f05d6c7edbec9700a4e13e2306a7b018f6281fd4401064dcfc59e0c56b47",
    before: "516ac55d7344024545c6be96d9a14f5c3aac68a51079e457aa629c04cb8aaf1f",
  },
  "apps/web/src/components/OpportunityLineagePanel.vue": {
    current: "e75d95e5706858952e4a0f3ac9769094bd4a40aedacdbffc0b3ba3d93b2d9cfe",
    before: "11bb90b95be0f5b501f75e6d4c89fb38c145bb1702eab5ba8bcec0a3922ea225",
  },
  "apps/web/src/components/OpportunityLineageSummary.vue": {
    current: "d695c0092411b3a6a80baf744162b1e95d57bd3a06872cc0d6b85404598d772e",
    before: "86de7931f3c1cc11d3d4eb0d4ed7005bfd2285d6169bb07d894e417892d4b331",
  },
  "apps/web/src/components/OpportunityMobileShell.vue": {
    current: "2f516d0e6c2d01f806531894db5c211f3b9c368bc73e2073f7e0460322959b62",
    before: "093aafdd1b27c39b89b8fac76aa90f9ac61337bd062607a51800b82c3938f934",
  },
  "apps/web/src/components/OpportunityProfitPanel.vue": {
    current: "6026b558f0947a1ed83fe35da044d6fbbccd8d171a2befeee253802a556a86de",
    before: "c1d0e8d44af82ed7305481a9d8299c05fd0737e65ded0987a412aa36b5334dd6",
  },
  "apps/web/src/components/OpportunityWorkspace.vue": {
    current: "c51baa24600901da9bce5386fca3197db2e738939f0738cb6ce5d3cb406be60b",
    before: "90f39a67adf8e3606d402dc389b729f6ca03fc44313ebb20fc1260239c889cac",
  },
  "apps/web/src/components/OpportunityWorkspaceDialogs.vue": {
    current: "d71246ec6894ba4346d332a0073ab758a884c85dc1596a1141d9c8b33d614bdb",
    before: "b132ab04c3ed0179b7fd1256314334ce5c53bdf1dad4caf68d51c275c863a5ce",
  },
  "apps/web/src/components/OrganizationAdminCenter.vue": {
    current: "d26940620e9f41bac3f405cf6c1473458701aefce11cf3daef3dd4b861881489",
    before: "08ca45c702c440b88d10157e3695e74fcffcde236833db43e534db72df0598b2",
  },
  "apps/web/src/components/OrganizationApprovalPanel.vue": {
    current: "16736108ab97e26b4a37e59b68a04648f8a6f1412b4d3e52f21052e33f03f004",
    before: "332425d1b75e66f4f313f949eac92b4a635b2fb544ac6ea746e2ab32ebb8d22b",
  },
  "apps/web/src/components/OrganizationAuditPanel.vue": {
    current: "c5ee576bcafa09216e7dbab602d1debd48ee52f1385b7e10f9bc6bf353126ef5",
    before: "e05b6fb1071f3cb99fedd815346b91522e02dde284d3c146548c59c24ea76b9d",
  },
  "apps/web/src/components/OrganizationDataPanel.vue": {
    current: "bfb7f0f4360642e247db0640696c113678bb00309b36fd0c361f447297424969",
    before: "00532c5cc3f421f67d4792baee6fa2c75c965fce93f3ec69d86c673edb238270",
  },
  "apps/web/src/components/OrganizationRolePanel.vue": {
    current: "abe9097a581c2bf16f179405dbafa393f5ca775c91c06e33ad11c0925491aac2",
    before: "4afab8dcf5373036556f8f0c127422fd728c265e82f32d00b89e614316877809",
  },
  "apps/web/src/components/OrganizationTeamPanel.vue": {
    current: "18d06e5aad5b485ee277ef457f2e58de10c50ff1be922417033572cf33510eea",
    before: "2135e9325188348639af75445aa5b8d4066ed401f9fda3663c096aa915c97eee",
  },
  "apps/web/src/components/OrganizationTokenPanel.vue": {
    current: "9cbca41698db90eac2ede64e0e064acbe2aad656476e5ee0448180dafbd29011",
    before: "f1e3167ae749d8e7c3469fe6a3b766793f68838feda467eb5010bb8bf4c4669c",
  },
  "apps/web/src/components/OrganizationWorkspacePanel.vue": {
    current: "cd8fd06e5b939435c74aa1406ade6cbe6bfaf3724cd3676bcd1598c2e28c3b93",
    before: "6fd890d68d970d4012289c4c590b40dbc446499c93fbb2ea572d0c7dae31d65e",
  },
  "apps/web/src/components/PersonalCenter.vue": {
    current: "7f03b0170d0e5a8ae00840b31f8df29fb4e48f37d1c04d836af46954319d34c8",
    before: "5fb05c5704d0e07613489d368603986455453868912edd7616f2c4f0490de1ee",
  },
  "apps/web/src/components/PlatformAccountDialogs.css": {
    current: "4181de5e2b09973b12e2a36223cb551d0439ed73b09e705126bc14be3ba4c7ac",
    before: "7428f9db83ea14e15742d6162eea70bd61140dbfe6257c9e2bef7009da0aeca5",
  },
  "apps/web/src/components/PlatformAccountDirectoryFilters.vue": {
    current: "6fcae623a9d39e389662185204fd43a38ccf9b30db06d2fcbc1490ef0420062f",
    before: "0f790cd1b71f949663df7ae516f6fd0811c2199643737cd713bfb10598ea63e8",
  },
  "apps/web/src/components/PlatformAdminComparisonMobile.css": {
    current: "49f3822fd8716bd5905f5a29fb877c897a6a29d77cab1a7a4e3c2fe361f6d5f6",
    before: "03de4183b646dcb09140a4b9028c0e3d0a6f1d8b05f2dad43f5d6790e51cf3ae",
  },
  "apps/web/src/components/PlatformAdminDirectoryMobile.css": {
    current: "624273e72a9af1c981c5e26f1ba6526ec603266a77002e35ceceffd2bc6cf273",
    before: "ad2e47e9e4030dd65c40c6567b0443c5fd809d31eadd0768f3e5e277766982ea",
  },
  "apps/web/src/components/PlatformContentCenter.vue": {
    current: "6312bb4c36b55b9c30675c774686c457c67ad6d8edf600087d4312b75d61bb49",
    before: "f365a97c14c6d5420e908982ff96c008866e369fcb2e609ddf7ce0c3ab533993",
  },
  "apps/web/src/components/PlatformContentReviewDialog.vue": {
    current: "a4e0f2c82b225f33eabb7bd7201fefc3ad6bac2670a894a430686c4c40e76389",
    before: "7183474efd2f6fdb6080d3273855b69c742675b5aa36ae026d9cd82f6a6726f4",
  },
  "apps/web/src/components/PlatformDashboard.vue": {
    current: "dd3fee43d66fe14bbd83c66bd3b1b4f369468ef15f4da66210faa526c9742d3a",
    before: "902ade12da39276dd7151410ba8bc1058fc4deef3bf941c8c6e502769028391e",
  },
  "apps/web/src/components/PlatformDataCenter.vue": {
    current: "8d4b3e6d3c660d48e759c7e69dd51df6ebd84b170556cc600c161d228a814b38",
    before: "904a2a43131dc1ba2e92a21ae973b83f7a13d7ec4c3fdeb041c7fed0943b5e08",
  },
  "apps/web/src/components/PlatformGovernanceCenter.vue": {
    current: "a19e66b55b001c86a36e4ff124574f7d2007a4f06bd18d9ca9fb8472fba10c63",
    before: "65b3075c9cf1def3934540fbf792721419d5b3764873d473860e5ec8c1cd00f9",
  },
  "apps/web/src/components/PlatformLogCenter.vue": {
    current: "34d1b8cb21e3a1fdcaf720ff05edf6e76e76e25b955cc5333df888dc26b1d7b5",
    before: "029d06e79ebde16ed4268dd57a0f7cdfe0713a2d90e62c6606e6deb0709dd518",
  },
  "apps/web/src/components/PlatformLogWorkspace.vue": {
    current: "8d6387e64e1519264ab75396ed8b68d160485b3a590e4ae75606365b80c074ba",
    before: "7d85fd1776991284de17d06f6f3f9350888a988f00fd9ee61210bf409b1a8a9a",
  },
  "apps/web/src/components/PlatformManagementCenter.vue": {
    current: "6835fcf831099e531e9d86c3e9a39ed2c8ef827e28c000d964a83fa71398baeb",
    before: "33eeaae57a3d16bbaabd216b90fbb49fad17e4e4a48be7c6c479ee464a008b00",
  },
  "apps/web/src/components/PlatformMessageEditor.vue": {
    current: "59da5cc2554778c81bf065c36418b623d12dca3ccb6f0fabca2ecb5e5530ee6e",
    before: "299031770711240b20ded18c86d6eb2dae9081fb44a732e06efa3317b540041a",
  },
  "apps/web/src/components/PlatformMessageWorkbench.vue": {
    current: "169ebe30b870f932fd49e108c876eb98e50a61f995eabefdef5371bc1555fe33",
    before: "689531d215e8878405c53ae55a4b157066cde2e9a1455242da7262079e27b2a5",
  },
  "apps/web/src/components/PlatformNotificationCenter.vue": {
    current: "bb33ae7996b077f7c0c4add737ccaa75296be9197c185c147a99db9704380060",
    before: "8dd089c006eeb5c731f0d040da20436e2958613657776373b2872fe6adde52b4",
  },
  "apps/web/src/components/PlatformNotificationFacts.vue": {
    current: "0b9ad7084f4d4fa94143634a692820ec830caa90a6a314249213cc49e2a93ad7",
    before: "35db0f9393a0d21154ddd3a0b3d6da4077fe1c47d3408c878cdd1d53ff7ebd6e",
  },
  "apps/web/src/components/PlatformNotificationManagement.vue": {
    current: "3529c6d00aa8a61ff693eb08c745f75fd403a18d2323356fe2e9324b868590ea",
    before: "7cced021643a3af6a23a07f8afca71d943cabcd13cf963d97ac3b698a3dfe2e8",
  },
  "apps/web/src/components/PlatformOrganizationDetailDialog.vue": {
    current: "fa73cec1f1bd78462a06a87e6c55cc575e05c491a258da661f8c985c152d7a57",
    before: "47bf733f5e1afde00cf58d569b5f6cf1132926f96d94be21b8d4cbb95b0f7e43",
  },
  "apps/web/src/components/PlatformRoleComparison.vue": {
    current: "510cc00985908fbb541961c303bee3a9934f59a1be99c561ed87082899dff54c",
    before: "a043421e37ecc7d82f87854b06874bf4874cf1f3786e8917b9a85b4166268309",
  },
  "apps/web/src/components/PlatformUserDetailDialog.vue": {
    current: "efccee8bdf9b4fdb1e8b1b9e2386a049bfbcd38bed1d3cae718be980a6eb63e6",
    before: "43637fe74837f2c979960a198c1419c13d2d8895c83ab1e8bde7b67c3079e32b",
  },
  "apps/web/src/components/ProviderAcceptanceEvidence.vue": {
    current: "8b1f41427ef210256adc72f1e4c1bdc904afe5dc7b80f8479678db89a72651a4",
    before: "e995ed90bb6a729d94495c72f1db401340ea77b0a906b0a8c60f63a2c710d669",
  },
  "apps/web/src/components/ProviderAcceptanceExecution.vue": {
    current: "1491d9aa903ab874ec12c0c9641be21f8ad704ece6b5822d68b657cacb9dedfc",
    before: "8845f961637e96dedb38d9aa362560410eabffea7ab97f80ca64ff9d54fb2422",
  },
  "apps/web/src/components/ProviderAcceptanceOperations.vue": {
    current: "c58ffae170ea357cbf161bfbd798b45aef4567a78bd02fb2178f9d1a2e398a14",
    before: "12724a3fa2359a87e48748313448f7eece817fa3f8d6423f9faf409fd4a99f8f",
  },
  "apps/web/src/components/ProviderRegistry.vue": {
    current: "4bf02f190f890a3be639e0104a050bc193198e624c46a2624e49f4145e2848e6",
    before: "c97497796c891fe8d11219c1678db0bfb692b0a7642cb5ecb74abbb12f012d22",
  },
  "apps/web/src/components/ProviderSourceCenter.vue": {
    current: "d7dce7fd0fb0f4bb6d31113b33cfa9101273539bbddb6675d09987140be174c3",
    before: "c99c8671786fbb677426da9bb415c9a367568079143263c8c20fc7e549b131e0",
  },
  "apps/web/src/components/RedisResilienceCenter.vue": {
    current: "635b042e419377c89248eaa2e1999095eb58f2391e00a7abb6f113603c63aa2f",
    before: "72e0d8cdf041d84d6b83052348dda3c8045b4eb7cc037dfc94865f65d91f40ec",
  },
  "apps/web/src/components/ReleaseRolloutCenter.vue": {
    current: "6a4ddb8162142712f5eebad9421da1b811fa73fef5b02d0db5c1db98d850ce27",
    before: "2975ec8768a231086a2e15a3723c31e82dafca786eadc2c245c1a993d7c1e91e",
  },
  "apps/web/src/components/ReportCenter.vue": {
    current: "c3528d45365a2b13b62e2bf85ac89b773ce3a00c5ba6ed286bd184a2abed9661",
    before: "9eaa7ae589fb1158a2cfe872641c2bb2a570d0ccf50c27f18d7fd0b3edc3691f",
  },
  "apps/web/src/components/ResourceGrantCenter.vue": {
    current: "420948e6e4028d4f84c2995e7d92ec5127b09a7bf1a00cb917ffbd34d5739f18",
    before: "80a3164ccef4a3c2f0e547f01ea0789c7f0c6b50f07858e07a2721ca8e196970",
  },
  "apps/web/src/components/RuntimeTopologyCenter.vue": {
    current: "30811effde28c40a5eda285ad50dc053aa500e81cb1f321b9abcdaf18ed2a58f",
    before: "d3f1ba56a9d303e2c40d09fb8c07caaaddf80bb4d4207f69185539aae61125dd",
  },
  "apps/web/src/components/ScoreRuleConsole.vue": {
    current: "a5f4416c8947948cea7a81b078e3e7024083954fd63f56cefa7429039182f933",
    before: "350c6492eda6a7695cdb3423ab44481962877f046921cb61c658029207f34b4d",
  },
  "apps/web/src/components/SecurityOperationsCenter.vue": {
    current: "a19263fe198eedc039ffe25a6e59917c8b12d27c0b89fca43b02773c89c1bd6f",
    before: "24082cc2a1e1dcaacba3c35825592f778964e655e686d23297d0ce2199fad5f4",
  },
  "apps/web/src/components/SelectionJourney.vue": {
    current: "43ce7f22d60f5782222bde709efadc0d73a4d06d51aa0a314c6824318c09c845",
    before: "ee3863173db351cdf6d434d6509f729c4b84775ae5273d89e319dd7c2a9eae00",
  },
  "apps/web/src/components/SourcingWorkspace.vue": {
    current: "91f643ad51b005dee32301b21671f7792961610aeee8c81857e8068a93a3b78b",
    before: "382b000c5bbcc5adfadab36170b7fa8bb6a636bc4f2047e493e6c807af847346",
  },
  "apps/web/src/components/TaskActionDialog.vue": {
    current: "42c2054cacb579a7d29855fc23b09eb71d5980025d54235b9410ebae3472b9f2",
    before: "3b46e617a01c51ccc8610d7226c9fe40bb605791636458cff150ba23deaaab1d",
  },
  "apps/web/src/components/TaskDetailPanel.vue": {
    current: "4ee570c9b73c56e5e6adb651e095319bedbdc231624214f5212b235e345f16db",
    before: "23bac3d8403d605eb2aaf71225f163114ee3f9d7d65e2bc4fc7bda050286b985",
  },
  "apps/web/src/components/TaskWorkspace.vue": {
    current: "5d5eb4c4fda461aecfd9dd5beaf4481d6ba1c41cb6d9b510379be6c936f84045",
    before: "d6841151cac4bf227b335a3253dff1dea1138712e6afc95de97d993672f77c25",
  },
  "apps/web/src/components/TenancyChooser.vue": {
    current: "8ba690dfe3ce645883978d5176e1cb6c47a2428a0d59c5934dc9d7e87fa23f4d",
    before: "db6e49a67a016a4c40f0adde2495212d3a4bec82656100e4abb0f3e17d328b18",
  },
  "apps/web/src/components/ThemeStudio.vue": {
    current: "40a04a354a6ea28521cd248b6d86f9d43e4b2ee4227b9bdeb24d244304d9f2cb",
    before: "fa5220912b53c97cd597ec4b0b629055033d3fa8e20a4f9303ea9ed053c9d06f",
  },
  "apps/web/src/components/TrendMetricExplainer.vue": {
    current: "07cf4bed20da4050327bc0911369ea5e42b08ebae8374dc2492d02f96d486d05",
    before: "c01bec9a20233b4508698f6c92d71005fa0816163f2200c0a0c02eec3d091af2",
  },
  "apps/web/src/components/UiStatePanel.vue": {
    current: "2969566dd1069b24e474fc729eeef7c06907dc6a06c398af12cc9b1c8b6e705c",
    before: "54bc7c9b64af8a2968c63c901ad82b398f0751d36a4c79a99c389a1a289292de",
  },
  "apps/web/src/components/file-resilience/FileResilienceDirectoryLedger.vue": {
    current: "beba6c631c67b7f4569b82fea7b49dec6ec1588f692208829df2dddcc41120ce",
    before: "386eed164bc6b225f4dd57cbc7c4d4afb43606fc7d605c9e8ac6771ede2e31ad",
  },
  "apps/web/src/components/file-resilience/FileResilienceSnapshot.vue": {
    current: "04ff7b2086cbe219debf9849eebe582cf4f25ea812a509f050e76896f6bf90ce",
    before: "35c14452ed8eab500d37d0a8c9584fa17601372303c6a18634d045fcc9d4eb0b",
  },
  "apps/web/src/components/local-identity-mfa.css": {
    current: "18e7071effb406413e46e218045455acc54b543617b688a9e848cbc1b1cbbb66",
    before: "2d23bb1bda0f574150c2842836985d23bec550fdb6cb46d57b8cc009b8a83b34",
  },
  "apps/web/src/components/navigation-surface-registry.ts": {
    current: "ab6fa8d9bfac58f1b3da4c004bc1c29048cbe465ba3fb7af1edc7ab34d03dbf4",
    before: "e0f1161dd5da43df09b2710972ac431d746eb32fc7020c55502d020ef501486d",
  },
  "apps/web/src/components/onboarding-guide/OnboardingStepPanel.vue": {
    current: "d0d6e38ba5ab0d64e6d64994fb001007914115206051d8b44edecc25dc9489bb",
    before: "eb1a29acbe8027d4e01ac226c4d33ca9132fb28b13e50c88681f746ee24876a3",
  },
  "apps/web/src/components/personal-center/PersonalNotificationsPanel.vue": {
    current: "42c5c2da6718fd13ad056c349df42908f80a02672216a7ade522f156a3d03fc1",
    before: "1cfaa3f20d85c1d895e48ce7f535318662a8dbf375417ba55cb55b891b5f8e86",
  },
  "apps/web/src/components/personal-center/PersonalPermissionsPanel.vue": {
    current: "20c6d93089709b9783354e223b90a05660697c302cfdd3cf196848193b4020ad",
    before: "8502b930452a500af44b0e3762732f2d00a879886ae075294d107dd80996a2bb",
  },
  "apps/web/src/components/personal-center/PersonalProfilePanel.vue": {
    current: "09de3d84ed5c17072838183399084a31eb076a349cf25767c9b474b27b85bb4f",
    before: "5342047bd8fe79d5756cf13b86d2481bc329f279d0900da69a067845bd2cccf5",
  },
  "apps/web/src/components/redis-resilience/RedisResilienceSummary.vue": {
    current: "f7b657eab10514850ba1137175837bcde8140ae43bc202a977211998a8bdb0ff",
    before: "de1dc93ee710a96d965d295a6e2f1b3d8d8da07f61344a743e29bae743af2a00",
  },
  "apps/web/src/components/redis-resilience/RedisResourceEvidence.vue": {
    current: "0baf27bad85f9b7c261560398a360bf8fc754686c53adacdaf0055196ab8a6d3",
    before: "3ded48c9a122e981d6adeb1dac644247da7ef968f0aba378341983633ddc8f9e",
  },
  "apps/web/src/components/use-platform-content-review.ts": {
    current: "f1335c086e3d429f3661f0bf63f32628a8366e324b3fd6b46f5b588ad08017af",
    before: "04a83f402bc5b98ede50e7b7ac2d05da0580d47aee638b04915917993d1436e6",
  },
  "apps/web/src/composables/useProviderSourceConfigurationVersions.ts": {
    current: "03aeadee4b3552ae30e6ab8753543f5a9f80d0b9b7257bba670ef2b2e952aa0d",
    before: "635e798746d4df20e99fa25668429787e1c982111e105537282dc55e4f70a259",
  },
  "apps/web/src/crawler-scheduler-c.css": {
    current: "48fda3870c9918a81b13c9ebc7851679944edd8b6ef2460b157d84cc39785c7d",
    before: "999d22ba96d4dcc4473a2d3f68394fa45a3ef4b8b2d2cabea46173b3e01aed54",
  },
  "apps/web/src/design/acceptance-1688-tokens.css": {
    current: "a03b11cd5dbb268403c90cbef9e89206e3d741440483ced59ea9cecc8f096345",
    before: "752f6dc57757a03340982843870994bf12a365f6bd88b361462ec9d5d7927ecb",
  },
  "apps/web/src/design/account-center-tokens.css": {
    current: "80b203397c88daba7ea61b36c94802d1cf2d8e2f38f4ecc2ad2cdfd5585c9c16",
    before: "0c4eee906b1bf87012bf58684c928ab611ce661c92d0400d83e12b7e0572423e",
  },
  "apps/web/src/design/api-coverage-tokens.css": {
    current: "1cb54eb36829c9ee67619af5516c6f590697470cd96802e3bd19167e2f665097",
    before: "62172c3cfdeba95090094cbd6f02c9213eae8c9f7c2e93cedd0e1f6fc066a264",
  },
  "apps/web/src/design/approval-filter-tokens.css": {
    current: "c9b14d85f7ac5c5719432f57e431e521682d177d6b4f43522e836b45ad9fdeb9",
    before: "65a96d723f5aa5e98122d73ae58c8decdc7cb89e721c194c591eb7948fe6c4bc",
  },
  "apps/web/src/design/approval-read-failure-tokens.css": {
    current: "fa0f67e5a4eb4622ab258ec3de52b43b562fe07b51a8459cd71d532ea64d36c2",
    before: "bd13bd68c498bd64b2bb29cba882d09fb324b0fbacf5cab1812fd52abbdb6692",
  },
  "apps/web/src/design/approval-read-feedback-tokens.css": {
    current: "966e6f6de10577d6c0dbf985c66a2d3ef1fb0369cc2e01188a75499ea8f20b8f",
    before: "eba4838c08c72e55ec45d34bb58d9a53a396669a516d4fa5ee23f32b929912d7",
  },
  "apps/web/src/design/approval-workspace-tokens.css": {
    current: "df011fb10286e03a67a59d815c262886b3ae04a5e74e2366b05ff37c15f6ae38",
    before: "9d623451f3191e468baed76998e656c304b609d12fe71ce288b899f92c2a4550",
  },
  "apps/web/src/design/automation-rule-tokens.css": {
    current: "5d0b7db0d1fd7d7f75777fa692431949096001fe5d4764c4ce66e79d4e54c86f",
    before: "aa3438d16adeeab68c4343d7b3375fe0f88361435871c6d045b95394b0019b51",
  },
  "apps/web/src/design/backup-recovery-tokens.css": {
    current: "8c68fba0c898aa7376601a9a64a1d9326da7447ed9b16e030a7cb835ed5aab4f",
    before: "472ee4d62c392a91a7cffc6b68782dba7c9c3aecbd7a069182b47ad56d798c26",
  },
  "apps/web/src/design/capacity-boundary-tokens.css": {
    current: "8d0d8a1759406491e825928d42f30a978992dddb492b59110749ade7d3f45196",
    before: "e03a845308e5d3408d64f0b0e9140984c51f570c0ad8bdc7a4455c3d1ac1f9bb",
  },
  "apps/web/src/design/collection-ops-tokens.css": {
    current: "84ab86a2ee8f8d1196278f970f93962b502f485fa59e94112117588b75274637",
    before: "8ffb4b6c580216a748e3d541722a08e8d17d3c98bd0c9888a20bab25675b34f6",
  },
  "apps/web/src/design/commercial-review-tokens.css": {
    current: "49352aab8edaccfbaf3fb08b8830f1518f6361e53b0a7494e503b9cec2fb306c",
    before: "991ebbdf70982008d3e18cae18790e8c50c1e46fafbcf127f6d4d9873e29c03b",
  },
  "apps/web/src/design/competitor-review-tokens.css": {
    current: "b743175269e1c1fe370ceb5a46f3885d5198319880fa337690b121244551ab80",
    before: "b0ad536c740a5a2c6a9fd52e6964c6108c9efd42129000879be1f863ad9eac28",
  },
  "apps/web/src/design/content-tokens.css": {
    current: "09157ca3ac382be4544cf2c43e3e9fa05cc1d538d6f259690ae43e0d181b570a",
    before: "e783fb9d9c7377450d217b039b91f54a562a0e10559cb4b53cd0eaa8ce6f07fd",
  },
  "apps/web/src/design/cost-rule-tokens.css": {
    current: "faee0624a82f336c68360c3aae04f9a860748f8c1a21820d93b2d376333e74dd",
    before: "3991cef0ebc2409be7b7b483d1b0883f28430d17203c9ea73c5ecb70df49fc6b",
  },
  "apps/web/src/design/crawler-runtime-tokens.css": {
    current: "0c386ce877d7618b22b518ec782b50caa40154b597f0417ba7683c875e45cdc4",
    before: "dfcfab7a96c6c7a001892372da35f5769b727aecf18fa8e7af37b89f31c7b0ed",
  },
  "apps/web/src/design/crawler-scheduler-tokens.css": {
    current: "b81b4ee8fa3bafe51af1879e76eb6e2998f8761be558417c2aff112fa11daac0",
    before: "d3d73deb0fff9cc2d9cf5c8bdbb919b6f02a093f9c222434a4a41c3800982a1b",
  },
  "apps/web/src/design/credential-assets-tokens.css": {
    current: "adba71253aebe2a3cf82bc7416241b433bab7abaae05234d700b3445a575d296",
    before: "0641ea498bb0ff6b60aaeff07ea9b2c5503f48895262ade9f90c25fa0c15a7d3",
  },
  "apps/web/src/design/discovery-c-tokens.css": {
    current: "46708cacadb45b44c0f4d01be69e5580ad071204cdde59bce6ebcbfd33427232",
    before: "3b0e2f8bd1fab77d033edbaafd29fd5b13554b8dd45633d12ed5b991715141df",
  },
  "apps/web/src/design/export-detail-tokens.css": {
    current: "79e0e39d121567fb0329e34fb468ae657613a81fc0e5c36986bd2c15675da240",
    before: "d0dc62dff48590e983d06a8960bd74bbadc7d7f78daa31237df45214b7ee513a",
  },
  "apps/web/src/design/file-resilience-tokens.css": {
    current: "5f9384db66d2dd4b11a7675402bed6f75848764b5bf7f4f727f0d3236a6cdc77",
    before: "3db55e39d905ab73d642e2c10a3a1c01425288a5c5240d5a524f6c86a0eb6862",
  },
  "apps/web/src/design/governance-tokens.css": {
    current: "8f58f30259af784ffa75e9fc057c275663dc43cdf40f952786e562a5a632fb0b",
    before: "d03d1a8489b2143c6a18a4881304792e0b8208ef21540d9a3f4bf70a03058642",
  },
  "apps/web/src/design/identity-mfa-tokens.css": {
    current: "df5968eb07e1da3a42f8f06128fb7d9f22a6063ce156c20e62309cc66b7b6f8d",
    before: "ff027a7082f9828159dad41fcd0b404cca3e7aca7da9c4a095a90f3d1036c184",
  },
  "apps/web/src/design/identity-recovery-tokens.css": {
    current: "239c173911ddc32b97b6800e11835cfc55ffd839c720dd40eb20edf218047b50",
    before: "58424e7aa9e818037736126035642feb1076214667efba1df5493042d71cd560",
  },
  "apps/web/src/design/identity-registration-tokens.css": {
    current: "f61e85b40eacf34eeffa26fca7bed63163021b5cf8b44aa56d89078502e79a91",
    before: "5db7614507834e9f70e69769b183f4a82d49748132091476db13e6a3fe76214a",
  },
  "apps/web/src/design/identity-reset-tokens.css": {
    current: "c70a9ebff2cfa3a0e4a560d3a6f7965222427319f8ebf0c637e16ae15acab82f",
    before: "e7e2bb1eee15027a43899fdb615f8793a0d861219bf9762ed2fd241b33a06b4c",
  },
  "apps/web/src/design/identity-verification-tokens.css": {
    current: "7ed8505ca564d1839aa1576048b961652d0f7066e417c508fc17f410b958272a",
    before: "7edd1178ed83f3fb4556575923e5c2622b41aeb3dea96ee788ae5b7b17fc5108",
  },
  "apps/web/src/design/landing-redirect-tokens.css": {
    current: "9cc27723e98501ee0947dfd6ab6cd9ad923ca01bf5a686c0f25e5833b5a22e26",
    before: "db59714db161e028dc70a8e68a3e810b0ea7062d7391eb101b10d4a7fcf3a076",
  },
  "apps/web/src/design/local-identity-login-tokens.css": {
    current: "a19cd7c46c0478994dd5009c032143bb93652ca01898ac15b211e7e7de797611",
    before: "3f97a7eccfa4fc5690cd464f657526b0eb112a3ee5b4ee35071a7a0722875598",
  },
  "apps/web/src/design/mysql-resilience-tokens.css": {
    current: "e30ca43c65ee62fa646f68f709cf9fb03982d4c8a9403c361e87166482158c45",
    before: "35ea642cb163c8b6deb61953915950c9abd05c3b22427979aa25760a0ae3578d",
  },
  "apps/web/src/design/navigation-shell-c-tokens.css": {
    current: "413b6fb1b9096b1d6da4b858c67e5591745df126a5d9bc2df8a60ef36ef4eb2d",
    before: "1fab32076ee17b590d8912e71da664d59a8b41d2687d7f6fd5515559af230ef1",
  },
  "apps/web/src/design/not-found-tokens.css": {
    current: "8b728b7a2c283de8f8e3d2ef2b45656ca367bae9ea8ed3052c6776e570967e6e",
    before: "a046ab84923d643da70d7da148a5a39c51d8c9e34f23dc439d28e23ffc392fc6",
  },
  "apps/web/src/design/notification-inbox-tokens.css": {
    current: "a589c1062317cbdd1f4c666248c9c339623992ca39932a8e853151aa8260bc76",
    before: "5011782a982d7276adb7fece556f1215cbc08c514642204bbba3809578d8d99a",
  },
  "apps/web/src/design/open-platform-tokens.css": {
    current: "311ca8e3fcdf489ebf2dbe2a5f697a74a9d64ec294098e11faae815c1e78bf84",
    before: "ea60f06ebc7f2e542e4663b5e97ad2529c7e0f6fc95c0854afd6e9744200ebaf",
  },
  "apps/web/src/design/opportunity-ai-tokens.css": {
    current: "40850684628eb0e5d285eb965a611a947a3773572bd8006e19fcf69d98457bb6",
    before: "6b63d0e84ebd13606fbc33e222f6176028620f8468ef66c6d291009f6f0050e4",
  },
  "apps/web/src/design/opportunity-p18-workfaces-tokens.css": {
    current: "46824a9b84b198204a8dceca5da655e42213c8bd865f490141ee2e6783ac9e98",
    before: "ba5bd7acf7bce8b6b1050589195df860b005073fde95cc67daf0c5d2dbdbba79",
  },
  "apps/web/src/design/opportunity-review-tokens.css": {
    current: "09e39046f640f30d244cfecf7094cfef2cdfffdaa895ed963c07b775c54682ea",
    before: "a5ee90e8466c5f592ae21f7771a9c7622fb0e2453501e5f4d42ed2dad6c5ae65",
  },
  "apps/web/src/design/organization-admin-tokens.css": {
    current: "5a402d7ab084b78dde3473d708f293fe831a110e5deec7da1f2dbe5d59133407",
    before: "0eb9dde0342b1b3d265706569cbad84175c06d139c4510e8ed536501d366c493",
  },
  "apps/web/src/design/organization-audit-tokens.css": {
    current: "7b2c3693dc96828862b86ebe4832c394a8749b98b06c1487366518cd00807eef",
    before: "ae83f4ed704bbeff9c92ffe1307a9ee7cbf92ca7f721cb48390e941ec05fdb7f",
  },
  "apps/web/src/design/organization-wizard-tokens.css": {
    current: "149543cf1ab82aef67cd15b6be4fcd9d89fc8dd563eb8c2d88da818223ded648",
    before: "b6c896bab816a29ac8c436a20311b2af1e44e4b75045179dafd0ce7417762cb9",
  },
  "apps/web/src/design/platform-admin-mobile-tokens.css": {
    current: "743fb75106f17d85714bfdb0f066c1213bc6726c765ee71a547a7e83cfddcc8e",
    before: "3c878a3060007abd8bb51a0bf626833a9e8ac7ab4a62c3fcbcd587e9c52b7e68",
  },
  "apps/web/src/design/platform-dashboard-tokens.css": {
    current: "5d3ddd852b95dbd5577486efb9455a5948046583fadea63e7581fa169fc2f3f5",
    before: "b155274effec86b3e6b12232b3c0143fe30839fc006dac48bef81310d3ef3ecb",
  },
  "apps/web/src/design/platform-data-tokens.css": {
    current: "ef0557ea63f35e05f735f27e336ea1a1fc0a191e68bf8fff019125fd8566ddef",
    before: "add319c74e7ffd01bcf2ff247168e5717aa08b271ffc4cd65ad1dfb6acc1a039",
  },
  "apps/web/src/design/platform-log-center-tokens.css": {
    current: "34af8c16b0c6b76907e08d093f8a0b6abbe23f302c2584cf23abb17da6e1d222",
    before: "68db94e311f029d5bdaf6631bbc792cbf62b0fe6ce9b7fe786c1b62a47fe3382",
  },
  "apps/web/src/design/platform-notification-tokens.css": {
    current: "398bb78082edea4978e4c74031b1c9c8314d481790d432e0721e465e665baa3b",
    before: "fe07118706b8b6c7edea01d5839a3c25bd700995a2af925f336ced875fd5cd7f",
  },
  "apps/web/src/design/platform-status-center-tokens.css": {
    current: "e74a874115f5fd6a9e19787733295e8803a6f2a3ae81e3d45c12d5bb5a490734",
    before: "d0ae158d5c45bf792790c67a7c3b1eac90815334b786f58972a12e35aa801f63",
  },
  "apps/web/src/design/provider-compatibility-tokens.css": {
    current: "74ae84eee37c2e29ad0d23b5cdd906ca065fbe98e5f95bd7992aa5fbfb660d88",
    before: "c30c1c1034df033d7c196fca7488935d9dbcfdc89ed0fc484f4593f4f1e49f6a",
  },
  "apps/web/src/design/provider-registry-tokens.css": {
    current: "ff1c495cb5056821b13ef4d504e040ac724506abdb73c768ec2ee6619b1cae91",
    before: "8be200080d45599729d9efe59cbfc62cd619bd89ab03bc17e7ec7477cba64255",
  },
  "apps/web/src/design/provider-source-filters-tokens.css": {
    current: "077ca1cd90f25d40ef34796272dbd0ed7b25c96ac11d3e90c33129a936f1fe78",
    before: "e16e62ff362b4d0661f95c914700e9c580a6428a6dd3acce5f3c19c329aa85d7",
  },
  "apps/web/src/design/provider-source-tokens.css": {
    current: "31e298ffc15531ae8a7957266cf6d7295b6889d12e1aa9090ac08b49a01b2a36",
    before: "15f2f505819506be3508ca574277863576e19b24b04caddd2ba01fd4a6e30178",
  },
  "apps/web/src/design/redis-resilience-tokens.css": {
    current: "61aa3d9cc4d02ee0b207e1538de894ca53a75b260cfe610bd9f3ff1c20a62cf3",
    before: "ef8622840b7aebbf461d82b3b27135ba706d0b35af75f57a722189094721508e",
  },
  "apps/web/src/design/report-center-tokens.css": {
    current: "8c530b820e4e5214276a734783a2c57655142d246407bcc277fbee33d6f9c294",
    before: "cd100e6ba1b1c46d0eff5d0d3617cef65ab4f8c3a2871611f3dd16844dfc4c85",
  },
  "apps/web/src/design/roles-tokens.css": {
    current: "2570896141dd043a5407073bf10ade34873b8a6885850f0699528b63604d0984",
    before: "6d221a20b1f308603d1166c5af01df233906e32f1e08ecb5e7f7f119ff8a60eb",
  },
  "apps/web/src/design/runtime-topology-tokens.css": {
    current: "3a2ac117a08e99c93e2f84c42934e118fb94335763a90f41f45398bc84923c87",
    before: "c115f2194aab1ede69098b8eef10fdd406bb08e2d45110bcbd0784e199a3925b",
  },
  "apps/web/src/design/scoring-tokens.css": {
    current: "6d2b33602f4b52012db88e08bbb2aa81d284290bf4d31225ef371a7d87c2a845",
    before: "2031d93ad988598ca8e4a3332e19ce0bc73054d9abd5a3c0683c5572bf412bbd",
  },
  "apps/web/src/design/security-operations-tokens.css": {
    current: "7a7f2577e6360250fea90c03b95b4f434f7f96ae5eacc7948ed099a89606ea3a",
    before: "06d87acc5f74de55a104632af60cec935df79a80021df925d591576e75d4fc0b",
  },
  "apps/web/src/design/selection-tokens.css": {
    current: "e82de76f015e8c1c34b69eef8d3609fe801e211f4668e2a6339e48beea65ff54",
    before: "c231efe624ed656a3e43f81c4069577634d57d20544b1e45fe5a99f8092232de",
  },
  "apps/web/src/design/sourcing-tokens.css": {
    current: "2150a9465e4ba789daeaab383799fcf1b9c19e497a0dc2a5cc6fa362ceae9809",
    before: "f7c527ba52245cb852dbcffb3d106ba3898f08ad5a15b24ed2a9faf27290f291",
  },
  "apps/web/src/design/task-workspace-tokens.css": {
    current: "fa663bb7db53a8e00541eaf759abac22f3cd9ae4a83b5cb7b83158a701535027",
    before: "fc1bf18cda932b1d8d842857e0bc4b7f715f00474e24163c8ade85cb260ea7ce",
  },
  "apps/web/src/design/tenancy-tokens.css": {
    current: "f703737674e12f4e62176de0b6fd67cfe614871a8d2ed2ccfb5f2746e9981e43",
    before: "b73837aa35471c69065ad0227b52a9c8a0eb45b9348c4dafb2e1e4cd6c2083ca",
  },
  "apps/web/src/design/theme.ts": {
    current: "fcea1285bf7215e8e2c08c1ab66ac6b7359caba68850b66c2a588e7e2f73139d",
    before: "0a356b3505c576b0db1a46e406dae9018b3ddba883da8a4c77836f3101cde285",
  },
  "apps/web/src/design/token-filter-tokens.css": {
    current: "2439afbf31dc4fea103d4e8e43bd6de27bd0aa69354da6dd2c3ee515fee65e79",
    before: "6a2b9871858d0c1a5d7ee2a052b5b1d5043331f414685525d561d8ae6d366710",
  },
  "apps/web/src/design/tokens.css": {
    current: "e519e16a6983f5cb1eb67cdb939efabe429a4dbbed4fe07b0f13a69bd3ce4278",
    before: "47c568bd3a9e52e838a07200c05450eb4fdee5528a27b0be46fefd5f6aafa19a",
  },
  "apps/web/src/design/trend-dashboard-tokens.css": {
    current: "7be8fb039baf311aa14869c7efd6ea90011ab1cb4ebca5bb571026d2799b69a7",
    before: "d2b22265db9c319f0b1c935bf3fa3b2869cc43a520966fb27525966800c53ff1",
  },
  "apps/web/src/design/workspace-restore-tokens.css": {
    current: "bcfa47faa6f198963532c618f02a2a825f9480a798af07815ea1ff3bf905b0da",
    before: "65f8a33413cc0f3669858731f868d579b8c90152926e387adcee4b7ca5925019",
  },
  "apps/web/src/main.ts": {
    current: "33598925c7d12382152f1398ae48dcc27297afbef339aba6dd8dcc49770ba2f2",
    before: "adb50f723b75b22d7bf959f6d956a0e08e6afba952f118f354a2a86ec88b9671",
  },
  "apps/web/src/mysql-resilience-c.css": {
    current: "2ef90fd9f8883a94d6ea19ec3e368e089ae8b78af730961ffcec308455652c75",
    before: "9d51865f41fccf84627556bb46acd59689f56446de1a9689e3567e8e75a44cd7",
  },
  "apps/web/src/platform-content.css": {
    current: "9d6ec4e57d0af856c2dfdc9ebc5104ca6fd439b7c15f61323769a9e1219967a2",
    before: "beaa924acf8d99b8f553b70a3e3a7548233754fcac75c36869ad38c3807ace66",
  },
  "apps/web/src/platform-governance.css": {
    current: "8ab4c694d0483ed95ed635f571b4c7f5a1f2423c30ff062c476bf419438844a4",
    before: "faf3a503b79dde9c5767982d3657e2f7fa8410c8b38e3b7419cb33095804811b",
  },
  "apps/web/src/provider-adapters-c-page.css": {
    current: "d21f144be407405de8b4ad118c3fd38b1112495cd7b00c10bf2a04fadf219a32",
    before: "48f30865c89f8a42b5acbb3b132a4e7c8a59728d54e0e09761316c169a5b430e",
  },
  "apps/web/src/redis-resilience.css": {
    current: "c24fb3653f13c24d5b40989b29920c2e8024866822e2963877c3e4e5dae82647",
    before: "c2d15ef2bbeef18d74256b1ca9259f4539604b2f7db25c33f56e5cf9788d3fe2",
  },
  "apps/web/src/runtime-topology-c.css": {
    current: "74f4db85462dba24b4e285db1b63d51ac3345ec3a89e33ca903546de9d7d6c3a",
    before: "21ca18f2e2c9c51748834e41e9bfa8dccfebc5ff83d0e7f9987d94a6a8502fff",
  },
  "apps/web/src/signal-ledger-workflows.css": {
    current: "eafb4ebcea590ba73a5fa5bfe78d291dff4273efa0dd8a34ef78df448d124c04",
    before: "3a3bcb8ca4aa2c0b7dae11218223aaa9de25db45eb0704a2670ea156bf06229b",
  },
  "apps/web/src/styles.css": {
    current: "c881ac3d5e718bcd59272210d703991150556406ad09a90cd7d9c35742d97586",
    before: "4b8ffc6064ffe512f88b64fcb50df01b5f0ca1c66633fecb1e6c8f928b830016",
  },
  "apps/web/src/styles/provider-approved-feedback.css": {
    current: "a7e33a54500fa006bef8d8fbd27892914d0f47fc774c540a7595e1d5f50a08dc",
    before: "5e0a2f2d43cc7325395aef61924d60d510f0f1b03b41141b15df6426c98fd1ef",
  },
  "apps/web/src/styles/provider-approved-structure.css": {
    current: "e2b12f7986849e73776e7a10ad631791a0a376aedc0aaf6139b772c8052e87d1",
    before: "44c4c966d56fb60db060afcd67f192795693a422eb796adae61c7eb6d6129849",
  },
  "apps/web/src/ui/state-contract.ts": {
    current: "913cf51719f372302e1900ac99c4b46c1baaa3632d7bcca7e234700f483d2ac8",
    before: "9c912b4c0507506484cf04b623839869022fdc68eb6ee332e3cb638dee3b267a",
  },
  "scripts/lib/ui-phase2-shell-vue-preview.mjs": {
    current: "37638386f7c7613b46caf7dba3bede5c56e8776ff49b171a43e7f37ae5e8f199",
    before: "d7729481848240cde71062ecd1507f725a24dfb626e2197ebbc6bed5441ff5ed",
  },
  "apps/web/src/use-navigation-shell-drawer.ts": {
    current: "acb8f22f0c4b8edea49df63b368bcc6f736356234f3e8096252f70adbb87f4ee",
    before: "894634809088c8ce2a43c2a655d0c12bf30bbe46b338925f31f9db756b661ff3",
  },
  "scripts/lib/capacity-page-preview.mjs": {
    current: "6089c46593798fa18e45ecc7aa4acd28973af8d3864bac261a0fca85c0c88d40",
    before: "c44f5e08cfcc49bd99f454ab3e92219a093e1dd4653952f9ed7b17627a8bf3cb",
  },
  "scripts/lib/mysql-page-preview.mjs": {
    current: "de172068609e10af57ade23c3b4aecfd47de3a08400d8ee19b09439bfa52cd37",
    before: "432e78b5c1a0a537abe1977631394efa34abfd326bbc848a3d106533bf66e8a0",
  },
  "scripts/lib/not-found-page-preview.mjs": {
    current: "b2f38b673f7c39ac12a9dc24781f8b635b9c65d425024fe40b51013cdd024a60",
    before: "6267293bb464fe8352acd8f23aecf0856f477cabe1911f8a56d778c2468313cf",
  },
  "scripts/lib/platform-commercial-page-preview.mjs": {
    current: "e91e5438ec01a581fd407caedee1e3caae8f675e117f0a69267ef849985fc58d",
    before: "42cc04a480bda819dc82ee5b141a4dc6d1dac7c941dd3b801022f50763cc0eba",
  },
  "scripts/lib/platform-notification-shell-preview.mjs": {
    current: "3414e7b4042cc53205d69d194573241a6feb4b7e851a0c26530865a4d5d84bb6",
    before: "ada34ada484bdc6e5e204f2232fb11629818fcb110fdb4d5850e918e243d2dbf",
  },
  "scripts/lib/platform-open-page-preview.mjs": {
    current: "7ce4c5c2d7b961bcbcd7da163bcaaea33108939fe9d101b50b0bfc6e85d8b792",
    before: "fbcd7fe7fb25692c0d4dfb60c7afbe667ab0b7a498cf134c57520631f7e94476",
  },
  "scripts/lib/platform-security-page-preview.mjs": {
    current: "4c3805b9acd503a5fe6978c6d0bd7ddc2c4dbcf5fb62babfc3dfdfb53b0c8309",
    before: "0cd92aecba13a73cb7523e6ee8378874809ac1e3c8f7cc6d4f03a383b0d0bb86",
  },
  "scripts/lib/scheduler-page-preview.mjs": {
    current: "299dc460eb7fb3a88a6bc12c3aa5e31639dd847fce52b63402ac08da62a5bd9b",
    before: "f0c920882de2a0b8017ad99099ab87db263b26c46c30cd1e23f28d0d8a14665b",
  },
  "scripts/lib/ui-phase2-account-pair-lifecycle-preview.mjs": {
    current: "965c852553fbe6e92bc4e6d2ae69f7f1e165e098f0defc1eca212eb0c14dc62c",
    before: "79ee8c511afb90dda3b46378b1060f1018c44595fa515a3c92243fa35b94991c",
  },
  "scripts/lib/ui-phase2-adapter-current-state-preview.mjs": {
    current: "97471fa6d087778110ed24d3d858025f75473d913346ad89e6dad6df3023634a",
    before: "fbee110829bd1e2d5b23da798e1cf77a217712cd19160a3b03750e0bf40385fb",
  },
  "scripts/lib/ui-phase2-adapter-historical-source.mjs": {
    current: "144fca4126139bea25f5f3ed636bdc636d3f9ddb4c72b587d729a97703903dd5",
    before: "cd99a2870a30024405cac917a4d736f1544975de8103bdc2afcce567931cb83a",
  },
  "scripts/lib/ui-phase2-adapter-read-error-baseline.mjs": {
    current: "96e6d294fc5336b2087061d1728dcaa6e6ff013f909fc2dd5168c77be70dace2",
    before: "0cc3afcd1d43ce9e781a7448e0fd957e0cfcb55c9b67a30833736fecae6c2dd4",
  },
  "scripts/lib/ui-phase2-admin-controls-baseline.mjs": {
    current: "2610ed88bef67d26bb3ddcd122d9d64eac75e23a01ff63869bd3bf77d0d46968",
    before: "c3955321f531747d5a1c3ea39426695f13b2b47bbf7f5ad5f80ba621456373da",
  },
  "scripts/lib/ui-phase2-admin-directory-baseline.mjs": {
    current: "702154cd8d10ab4c2c84d0ee1628f8a7429668205f2631e8a25d66c386296f6d",
    before: "c2b6a90174caa8e5a9b1344bc7026f6103c918677993b5dc2443c71c04146761",
  },
  "scripts/lib/ui-phase2-capture-source-compatibility.mjs": {
    current: "c47f03fcc04b67154c2ef1d32a938f345d640b9d84580317974a53450fc55af3",
    before: "34a57613fd46ea0d37d812847ee3a1ceec4244a618b9d61c927a743ff9e610f0",
  },
  "scripts/lib/ui-phase2-journey-controls-history.mjs": {
    current: "fcab3dc489a4cc714942e4ed14bf06fd07a592062352ca505bcc793f24ff543c",
    before: "cc75b05b96e0348c4f8ed96d01b44fece3328e25ba729fd1c47ad20836543035",
  },
  "scripts/lib/ui-phase2-journey-fields-history.mjs": {
    current: "3148e71a33d32c4f584186abfde373b6b367f41eb98767f9540d683a6bfd02ea",
    before: "835561bafa0e33c7b0abc7206bf6a60ddc29decf79a3996d2a8eb63680249533",
  },
  "scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs": {
    current: "b9b19d0365b3023b9dbdac214e302b561842983fb25624ba3eb7d2964e6d2cb6",
    before: "e3b155222bd313d412faacd7f221c2eba574c655209bc68ab88ed05a656274b6",
  },
  "scripts/lib/ui-phase2-provider-terms-history.mjs": {
    current: "fd4521e7a8c5e1db409c66378465707909425e17cff29c33ea25ad9d1c30c7a9",
    before: "bd92051b8840b775e4b81b4ace568c5cdda143fe44c2060a12218488461e87f3",
  },
  "scripts/lib/ui-phase2-redis-review-baseline.mjs": {
    current: "8530c148f793cbdcc297c4fef43a49d443b4c68bc61791984c6c488352045f08",
    before: "7a371088aad4c3b6d6fdae6d3b4a2daa597cf957279b6f901f4eb9214c5b6ec3",
  },
  "scripts/lib/ui-phase2-responsive-focus-contract.mjs": {
    current: "2668dce369f9969ecb051bae830f0702a7a6c267ad24949b55a513ff2f2d0936",
    before: "d0a787596a1c495f402ba7e641621e0c3f7e598dddf8f27272c7947ff1eb56be",
  },
  "scripts/lib/ui-phase2-shared-review-baseline.mjs": {
    current: "9ed9db533821325acf6ced41d6d9d31c27432669e4a22758c38df593331cd01c",
    before: "bb9d553f0059963f45f60536616473a562c05bc2a0f80962b79b32aba8e8ca95",
  },
  "scripts/lib/ui-phase2-teams-historical-capture.mjs": {
    current: "56cb5d670548c8a46a74a1dc33db4eede3b7f03f13f12430eb0d68d3a70faf71",
    before: "99ef364d1e85567523b432d377e5acf6fb29be2628fb3a26f3ffb7b88ba24353",
  },
  "scripts/lib/ui-phase2-token-copy-baseline.mjs": {
    current: "7a6fb1b58714493b42d240f211ec8b88ec6e7d88906e59590f328708c4dea2b2",
    before: "56d8020215362fdebdaf5c6582d81db0f41116449952c690c0ae1f4c1740e23d",
  },
  "tests/e2e/helpers/p23-pagination-review-images.ts": {
    current: "aee2c7dc6ae9290dfd1fda85277445664e4beb3169b78b2e7a79d6ff501c66a9",
    before: "845a744ff8134e909e3eccd46ff18dfa96c60f9672eae2345c29d41e60e3609e",
  },
  "tests/e2e/m00-01-runtime.spec.ts": {
    current: "bfcda3532c4fd0faa2b8911db79dc6db5d51085d784fdbc9c0406101f0988d2c",
    before: "7e56ab6683b02de4cf49e3c7ba946243746d13e0b3641a8b9b2d9b579161f4ac",
  },
  "tests/e2e/m01-01-local-identity.spec.ts": {
    current: "d50aab3d52b75ecbf83a36ec095bf51258efa67cb6df7232f27d8b1eec6541f9",
    before: "ad9f7a41a002988cd4c12a9e1dccc98ffd953a77a721b55fec794c5605255a10",
  },
  "tests/e2e/m01-02-mfa.spec.ts": {
    current: "e61ad5aa015f1c2150d4f1a2d04ec991233abdf9a70ced4ce61239e3a0f8a44d",
    before: "1a9d11a1b965ec9a296becef587b1beec1fd601106b5693ad0bbdbe6757ef970",
  },
  "tests/e2e/m01-03-tenancy.spec.ts": {
    current: "26b96200276a243444133d6ba0125db7439d864e9c8b044170a0afb8558f28c9",
    before: "f20ff69ae5f84f544f58f359937587bb5745494521c7d8fce30766fca6f12482",
  },
  "tests/e2e/m01-04-rbac.spec.ts": {
    current: "3a6e0dcdc1efeba09d24a485e075ef69973282c4690ce74ad77942d90f097ab2",
    before: "eb457bc42adb8a71974cbbf88c046a9aabdee03f58d640436ea124866c252a90",
  },
  "tests/e2e/m01-05-resource-grants.spec.ts": {
    current: "f525552d8ca65cf712d3eb759df2466f968faef6729e957ccc0c8827f53d0c1b",
    before: "81ffe4bc837f13a9066143d4eb6a0f0f8eedebdb5e04350376d165a0a9aaeb42",
  },
  "tests/e2e/m02-01-theme-studio.spec.ts": {
    current: "bfd1dd8cbfdf7bfe0a88aad6fd5d0240ce849919dec46a831b4d4e8fb020636c",
    before: "cc9672a2b34d27ff4b6396ac63931b00253ec1c6ccf3b904d0e33ad117defa64",
  },
  "tests/e2e/m02-02-auth-onboarding.spec.ts": {
    current: "1da816bf29ede5801154e42d75c83a3542c88cb5eb1b18cef1fb3a02b01fa698",
    before: "08067a13be829d73f0dbf40832ae4fa15cf4c0c6834b6c624dab681faecda8d4",
  },
  "tests/e2e/m02-03-navigation-shell.spec.ts": {
    current: "bc708c8279502835467adbbec7ca39d17c3a3765d5a8a5beb264f1294f8d4836",
    before: "41a12d465364ffe8a5484c795ddb9c1837d5dc6762b9ef4ff049f8feecb82e89",
  },
  "tests/e2e/m02-04-not-found.spec.ts": {
    current: "b6ae9a293ba5e1f2543bf165d41a8f097b7a7289d8b76d76f2edd986c45bff25",
    before: "2b29208c9d8e90c8a9777798efd5e7e7b5e7bd00645914ce4b6c24145be49c15",
  },
  "tests/e2e/m02-06-home-mobile.spec.ts": {
    current: "8c6526fb5d30c05b8bac86b0b125425960f9d2d0780453fe887f13300dcf984c",
    before: "c5bf73d3a6e48c32dd4dd11e1234667b66dd0a4fb18176de1e662061c22eb905",
  },
  "tests/e2e/m03-02-credential-assets.spec.ts": {
    current: "62455844c41f0d5bc0709d8b4894d840878d40f098676936ad30e26cbbc3bca3",
    before: "8ac8cdfb0c956b266029b2a10b412de1011b56fab962661ad83bf0e970b14cf4",
  },
  "tests/e2e/m03-03-provider-adapter.spec.ts": {
    current: "9700f27be03400e515ba70aa9ced2f40fff3ae65f127e6618b18f87c1b2b7f38",
    before: "e3227abe3a07929c9b5c048c0b1f4d5a9adfade1ef78cc40103d26dd3e0d1e7f",
  },
  "tests/e2e/m03-05-collection-tasks.spec.ts": {
    current: "c4d07657ceccaba49f86cfa72a19c8ec27ae4ace9d1a431601ce2031994e590b",
    before: "2e06746abec5ac8e41ff68629eed8700d726939097e0ce82501d5cbaf6e88a98",
  },
  "tests/e2e/m03-07-provider-sources.spec.ts": {
    current: "34b1ca618abd0213dcd380bff8aea39131715de1d181309479ab70e4f4d7fbd3",
    before: "5d865c185a67fe0d529fb131f8244f96c30c5383587ac4b146230704e6fa6d96",
  },
  "tests/e2e/m04-02-opportunities.spec.ts": {
    current: "86199c082e92e08269d90e4504ab36db2370df7e5ab47d20db36307d3e2718bf",
    before: "3d6bc507e1cc73e70bcc2c4d80833063f0916c2aa8cc42a0a1b6cdbf85a9e9e0",
  },
  "tests/e2e/m04-03-scoring.spec.ts": {
    current: "df9c6455e4cbbd0c51c9054755ff227a473b36d37980082d866ea6e0434eb78c",
    before: "645a75997ee7af5061fe4726c0713db000199c322adf1b89f9026585040251af",
  },
  "tests/e2e/m04-05-competitors.spec.ts": {
    current: "eda3dfecce4882ddba4d99baced6c088326bf3c6ca6f75e9dd1ae76298e77fbe",
    before: "702ef699834489dca316a44f7be4f42c283919d7e0ee629dafb084719302e2a8",
  },
  "tests/e2e/m04-06-sourcing.spec.ts": {
    current: "a3bcd66b3a7bf34b19d8953c38d16f3d09520e0db18bda4456828c294e0118c5",
    before: "c322e500f2fb2255796ff7916a76c7cd434c9f192af79f62fa0d5f6e3e491c65",
  },
  "tests/e2e/m04-07-ai-analysis.spec.ts": {
    current: "b0dec37d586b5af037e336f3af08c3c8382c36de9166ef9614bb2235f496e72a",
    before: "08d18e447b8aae2714715da2cb7cdca5697c2ff6db2e724f899617462f855a18",
  },
  "tests/e2e/m05-01-business-tasks.spec.ts": {
    current: "7c468e31c19be22d40c70a5b80cb3cbe9efa217775e784f5e69b9c87e077cbeb",
    before: "0364b66a66a014d79dd1b6838cdf9331f37b921fbdd62a280d1d71b01f4a4858",
  },
  "tests/e2e/m05-03-notifications.spec.ts": {
    current: "c77a91b268e89e97c1aa6c3fb7fc8e6418f74f3440638869f1f103b4a8d6d6ba",
    before: "fc6778a80ff649b1bdbb877b58d4e7e61289581174908b6a7e6f5dfb9972a906",
  },
  "tests/e2e/m05-05-automation-rules.spec.ts": {
    current: "289e0b691f8172d4000eb61fee535152a229b3944431c7b2baaf7cf19447a43c",
    before: "dff352e3d24fd6b5f42d3ae163b5a594125c11dcc101b3e74931b96aabe31ac8",
  },
  "tests/e2e/m06-01-organization-admin.spec.ts": {
    current: "5e04bf6dab3ab40677e0baeeb2af069809d72b99172126cc5cfd9107d59708ea",
    before: "5c536fabd9fe94c9a51127ab3972fe475f6b8e6c9d8cecea4ab6cc9cb50ea465",
  },
  "tests/e2e/m06-01-platform-accounts.spec.ts": {
    current: "a5fadceb584a094ff8a0eed26b3338bb3886edd0709d173725cdb4b2b9964cd7",
    before: "b07420e3a9436f4e800060a2d4cc17ef63349eba4630e84f897d1a7ca22c5665",
  },
  "tests/e2e/m06-02-platform-dashboard.spec.ts": {
    current: "0ded01e427dc564079b011808162bef3f319a82c3665a6fa8f4e5bfbc25fcfaf",
    before: "8c08f87ecf170e26828d95c8cdd64880a27987997dabb9617d7eb4376a8fb7da",
  },
  "tests/e2e/m06-03-collection-console.spec.ts": {
    current: "75a977d882946a0238a369a6033323b3ac8be9b5ac5f538e1cd548bad1bc567f",
    before: "c119e6da514b40d3a01ab78be6a49a9f9b76fed130237914afd95cc7ce8c3235",
  },
  "tests/e2e/m06-06-commercial.spec.ts": {
    current: "d9184c8821835272bcf71e39cf1e3019d636a88527df706d49aac19e590a4425",
    before: "b9fb68bdf65b61fa634b3c6fcd28ffc400e04233f54190f3d4c1a94e12a71e80",
  },
  "tests/e2e/m07-05-release-rollout.spec.ts": {
    current: "307d166d0d7f8e0f37dcf7119a5b87f5515200e545969275f7988aac4e80821d",
    before: "783bc7cb2af831e7d6f7564b2598b5d57b64c798fc6fe851fbd5f44008e13aa8",
  },
  "tests/e2e/m08-02-redis-resilience.spec.ts": {
    current: "e7a386b67ae0fb793877dce5f8a793c17f3ed2cba36b7af4ad3726a537c61063",
    before: "1f0f3dab7223a328c86966e14725c8d032cbdda214a917313a12bc06361bd5ba",
  },
  "tests/e2e/m08-03-mysql-resilience.spec.ts": {
    current: "f19218a2dba4f12b837774d1d79678ff6c4d347559a74ca2ce3d80993710a768",
    before: "26d66cee7400939369baa77fd8a292a5a99fbc37b178a95672d27abcdfa4df07",
  },
  "tests/e2e/m08-04-file-resilience.spec.ts": {
    current: "2bec423c747241a4009f2d9b682e57a749dc5be8105d04ad4079740e9903424c",
    before: "5bf10bb3a91ff41a34f77e26126d0bf4b68170b78b5c575dbf9b4d53c43bc86f",
  },
  "tests/e2e/m08-05-crawler-scheduler.spec.ts": {
    current: "899b67f7b15c62aa767a89d1f56d15258ebc1fe498624e85e7fe9c386506df7a",
    before: "96f28735d4d6aacd9dd1d004ea814568b5ef42d48ff32ef1fc7f3bdc02888efe",
  },
  "tests/e2e/m08-06-capacity-boundary.spec.ts": {
    current: "9d095752f98a9602e83c5ebc37066143f6630154ffe52082b81894b9ff710ee5",
    before: "bf7dc863ac4a748ec5349f1bcece8a93ff1223a9cc18d08fde2939084181a9c9",
  },
  "tests/e2e/ui-phase2-account-contracts.spec.ts": {
    current: "ebdc7138b7e4da6233a216e32238113efc319aeae70e8ce39f4506c063a217d2",
    before: "4819871da86bf5680b54467ef2dabefd95d2301d7e73a9c80fa9baea2b09a571",
  },
  "scripts/lib/ui-phase2-org-approvals-vue-preview.mjs": {
    current: "e41bbb56fe7f5a402ec5f9630871dd1449514c7d7962b518e306927814b20049",
    before: "86c782cd9379c31edbdc7d2fcb097e09e2f90c40e7e866b23355875f152208b7",
  },
  "design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json": {
    current: "14c0a318af1f3161fd2a9ef795626c970c6c00e32b41ffa060e4d32d6436d263",
    before: "0a96c4ac83e8bd5041709dcd8767f38fc75c6adfe5e3d94a3b250ca4b08adc8f",
  },
  "scripts/lib/ui-phase2-organization-profile-design-data.mjs": {
    current: "50abc2b70c6fffc4068aaa9ec62b9335368fb8786ffa694c92347782e8de49a7",
    before: "0791e557e69969870a6220caf8ab2c7e8e1432c9c685797dd49cbc131cb93795",
  },
  "config/route-catalog.json": {
    current: "b7a590249385ae35adbd413ef72e1be03b88b09cbee90ad82ca5bbf0604dfa93",
    before: "eb7071f2a0ced2733110ff51e4852757a8eea5757fe31d399003be5e63e6917b",
  },
  "apps/web/src/route-catalog.generated.json": {
    current: "08435da96bb0dc90b2a91a394ac5caf9be5f2746b280322dd4f2ad6fb11ad1e4",
    before: "aa448640ac7c70e9fb0587c25e840305555c7ff69620ad80aab48e4f2390253c",
  },
  "scripts/verify-production-product.mjs": {
    current: "7c289f231c2cf03bffc07d8a34f56d46ab138e55c530b41da719c847ec3ac114",
    before: "6e1a15ebcc7b14240891818ad391d63bcfaa539ab46cce5f3ae6f7284303ebd1",
  },
});
const hash = (source) => createHash("sha256").update(source).digest("hex");
const cache = new Map();
export function beforePublishedPresentation(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = publishedPresentationRevisions[file];
  if (!revision || hash(source) !== revision.current) return source;
  if (!cache.size) {
    const paths = Object.keys(publishedPresentationRevisions);
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((path) => `${baseline}:${path}\n`).join(""),
        maxBuffer: 32 * 1024 * 1024,
      }),
      paths,
    );
    const verified = new Map();
    for (const path of paths) {
      const previous = blobs.get(path).toString("utf8").replaceAll("\r\n", "\n");
      assert.equal(
        hash(previous),
        publishedPresentationRevisions[path].before,
        `Published presentation baseline changed: ${path}`,
      );
      verified.set(path, previous);
    }
    for (const [path, previous] of verified) cache.set(path, previous);
  }
  return cache.get(file);
}
