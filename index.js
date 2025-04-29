// index.js 
require('dotenv').config(); 
const puppeteer = require('puppeteer'); 
const Tesseract = require('tesseract.js');
const axios = require('axios'); 
const fs = require('fs');

async function loginAndRenew() { const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }); const page = await browser.newPage();

try {
    console.log('Opening login page...');
    await page.goto('https://lemehost.com/site/login', { waitUntil: 'networkidle2' });

    // Find captcha image
    const captchaSelector = '#loginform-captcha-image > img';
    await page.waitForSelector(captchaSelector);

    const captchaImageBuffer = await page.$eval(captchaSelector, img => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
    });

    // Decode base64 image
    const base64Data = captchaImageBuffer.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Solve captcha using Tesseract
    console.log('Solving captcha...');
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    const captchaSolved = text.replace(/[^a-zA-Z0-9]/g, '').trim();
    console.log('Captcha solved:', captchaSolved);

    // Fill login form
    await page.type('#loginform-email', process.env.EMAIL);
    await page.type('#loginform-password', process.env.PASSWORD);
    await page.type('#loginform-verifycode', captchaSolved);

    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const currentUrl = page.url();
    if (currentUrl.includes('/site/login')) {
        console.error('Login failed. Captcha might be wrong.');
        await browser.close();
        return;
    }

    console.log('Login successful!');

    // Renew free plan using axios (with cookies)
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const renewUrl = `https://lemehost.com/server/${process.env.SERVER_ID}/free_plan`;

    console.log('Sending renew request...');
    await axios.get(renewUrl, {
        headers: {
            Cookie: cookieString,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    });

    console.log('Server renewed successfully!');

} catch (err) {
    console.error('Error:', err.message);
} finally {
    await browser.close();
}

}

// Run once and repeat every 25 minutes 
loginAndRenew(); 
setInterval(loginAndRenew, 25 * 60 * 1000);

          
