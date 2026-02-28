import puppeteer from 'puppeteer';

export async function generatePdf(htmlContent) {
  let browser;
  try {
    const launchArgs = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchArgs.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchArgs);
    const page = await browser.newPage();
    
    // Set content and wait for network/fonts to load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Falha ao gerar PDF do orçamento.');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
