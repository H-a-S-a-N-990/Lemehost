
require('dotenv').config();
const axios = require('axios').default;
const tesseract = require('tesseract.js');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SERVER_ID = process.env.SERVER_ID;
const LOGIN_URL = 'https://lemehost.com/site/login';
const RENEW_URL = `https://lemehost.com/server/${SERVER_ID}/free_plan`;

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function solveCaptcha(imageBuffer) {
    const { data: { text } } = await tesseract.recognize(imageBuffer, 'eng', { logger: m => {} });
    return text.replace(/[^a-zA-Z0-9]/g, '').trim();
}

async function login() {
    console.log('[*] Getting login page...');
    const loginPage = await client.get(LOGIN_URL);
    const captchaMatch = loginPage.data.match(/<img src="(\/site\/captcha[^"]+)"/);

    let captchaCode = '';
    if (captchaMatch) {
        const captchaUrl = 'https://lemehost.com' + captchaMatch[1];
        console.log('[*] Captcha detected, downloading...');
        const captchaImage = await client.get(captchaUrl, { responseType: 'arraybuffer' });
        captchaCode = await solveCaptcha(captchaImage.data);
        console.log('[*] Captcha solved:', captchaCode);
    }

    console.log('[*] Submitting login...');
    const formData = new URLSearchParams();
    formData.append('LoginForm[email]', EMAIL);
    formData.append('LoginForm[password]', PASSWORD);
    if (captchaCode) formData.append('LoginForm[verifyCode]', captchaCode);
    formData.append('LoginForm[rememberMe]', '1');

    const loginResponse = await client.post(LOGIN_URL, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (loginResponse.data.includes('logout')) {
        console.log('[*] Login successful!');
        return true;
    } else {
        console.error('[!] Login failed.');
        return false;
    }
}

async function renewServer() {
    console.log('[*] Sending renew request...');
    const renewResponse = await client.get(RENEW_URL);
    if (renewResponse.status === 200) {
        console.log('[*] Server renewed successfully!');
    } else {
        console.error('[!] Failed to renew server.');
    }
}

async function start() {
    if (await login()) {
        await renewServer();
        setInterval(async () => {
            console.log('[*] Renewing again...');
            await renewServer();
        }, 28 * 60 * 1000); // 28 minutes
    } else {
        console.error('[!] Exiting...');
    }
}

start();
