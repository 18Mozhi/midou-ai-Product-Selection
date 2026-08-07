import { test, expect } from '@playwright/test';

test('M01-02.A07/A15 MFA security center is visually stable',async({page})=>{await page.goto('/?view=local-identity&mode=mfa');await expect(page.getByRole('heading',{name:'多因素认证'})).toBeVisible();await expect(page.getByTestId('mfa')).toContainText('认证器 TOTP');await expect(page).toHaveScreenshot('m01-02-mfa.png',{fullPage:true});});

test('M01-02.A08/A15 MFA login challenge is keyboard accessible at desktop and 390px',async({page})=>{await page.goto('/?view=local-identity&mode=mfa-challenge');const code=page.getByLabel('认证器验证码或恢复码');await code.focus();await code.fill('123456');await expect(page.getByRole('button',{name:'验证并登录'})).toBeEnabled();await expect(page).toHaveScreenshot('m01-02-challenge.png',{fullPage:true});});
