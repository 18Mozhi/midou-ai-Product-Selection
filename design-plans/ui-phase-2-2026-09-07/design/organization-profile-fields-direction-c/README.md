# P29 六字段状态 · C 方向待审稿

[中文图册](gallery.html) · [可交互稿](index.html) · [源码对应](../../ORGANIZATION-PROFILE-SEMANTIC-REVIEW.md)

本包是待审提案，不是已挂载 Vue、生产验收或用户批准。沿用原 C 布局，原74张整页和170张按钮图未改。依据当前 OrganizationAdminCenter 的六字段；不造时区枚举、上传能力、工作区过滤或新的保存规则。

## 本批细化

六字段共47个代表状态，1440/390双端94张图；另有8个完整表单组合双端16张，共110张永久审核图。

- 名称、Logo、时区、保留天数、原因：默认、悬停、键盘焦点、按下、留空、校验失败、修正后、保存中仍可编辑。
- 默认工作区不截图浏览器原生选项弹出层、不虚构pressed状态，保留其余七态。
- 组合：最大字符数、保存中、版本冲突、写成功但重读失败、保存结果未确认、工作区缺失、无选项、返回归档选项。

按 UI / accessibility 技能增强本子稿输入边框与蓝色焦点对比，错误提示关联 polite live region，四个限长字段显示字符计数但不逐键播报。输入/错误正文16px，交互区域至少44px。原父稿和生产样式均不变。

名称120、可空HTTPS Logo2048、自由时区64、保留天数30–3650、必填默认工作区、原因500沿用源约束。保存按钮禁用时字段仍可编辑；不把图稿保护当生产修复。单选夹具只有一个真实返回选项，只证明保存中select可用，不能声称已验证切换第二个工作区。OG-G02、成功重读覆盖草稿、跨路由共享原因窗、真实软键盘/主题/角色/全部组合仍待。

## 验证与使用

打开图册按中文字段/状态审核；点图片看原尺寸，交互稿只模拟本地状态，不请求服务或保存业务数据。

```sh
node scripts/verify-ui-phase2-organization-profile-fields-c.mjs --smoke
node scripts/verify-ui-phase2-organization-profile-fields-c.mjs --capture
node scripts/verify-ui-phase2-organization-profile-fields-c.mjs
node --test tests/unit/ui-phase2-organization-profile-fields.test.mjs tests/unit/ui-phase2-organization-profile-review.test.mjs
```

smoke为24检查；完整为94检查，验证真实Tab/focus/hover/active、原生约束/纠错、保存时编辑、字符上限、标签描述、对比及无横向溢出。capture生成110图和源/图指纹；无参数只读复验。HTTP请求、cookie及storage均应为0，浏览器finally退出。五个永久单测验证来源、图片、状态数量、登记完整性及不虚增批准。

仅新增审核资产/验证与登记文档；API、OpenAPI、env、数据库、权限、依赖与运行服务不变，无新增参数、无需重启、未部署。110图是交付物，不是临时截图。P16布局批准不外推本页；结果未确认时禁重复保存仍待用户确认。
