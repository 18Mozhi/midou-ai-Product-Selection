# ai选品浏览器助手

用途只有两个：按用户在 ai选品 中明确选择的来源域名读取 Cookie；从已登录的米豆 ERP 商品列表读取商品数据。ERP 登录令牌只在扩展后台用于请求 ERP，不上传到 ai选品。

安装步骤：

1. 在“凭证与档案”下载 `scoutops-browser-helper.zip` 并解压。
2. Chrome 打开 `chrome://extensions`，启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择解压后的 `scoutops-browser-helper` 文件夹。
4. 返回 ai选品，点击“从当前浏览器读取 Cookie”或“从 ERP 导入”。

扩展按操作动态申请目标网站权限，不读取浏览历史，不上传密码，不把 ERP 登录令牌交给 ai选品页面。桥接入口只注入 `https://midouai.medouai.com`、`http://127.0.0.1` 和 `http://localhost`，扩展后台还会再次校验发送页面来源。

Cookie 上传另支持 Playwright `storageState`（`{"cookies":[...]}`）、浏览器 Cookie JSON 数组和 Netscape `cookies.txt` 七列格式。完整浏览器档案仅接受 `.tar.gz`，与 Cookie JSON 是两种不同档案。
