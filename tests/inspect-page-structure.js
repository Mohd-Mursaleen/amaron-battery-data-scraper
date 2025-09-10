#!/usr/bin/env node

/**
 * Inspect the actual page structure to find battery data
 */

const puppeteer = require('puppeteer');
const config = require('../src/config');

async function inspectPageStructure() {
  let browser = null;
  let page = null;

  try {
    console.log('🔍 Inspecting page structure for battery data...');
    
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('📄 Navigating to Amaron page...');
    await page.goto(config.baseUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Select the known working combination
    console.log('🔄 Selecting: Passengers -> ASHOK LEYLAND -> Stile -> Diesel');
    
    await page.select('#edit-select-vehicle, select[name="select-vehicle"]', '5618');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.select('#edit-vehicle-make, select[name="vehicle-make"]', '70058');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.select('#edit-model, select[name="model"]', '70059');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.select('#edit-fuel, select[name="fuel"]', '70060');
    await new Promise(resolve => setTimeout(resolve, 4000)); // Wait longer for results
    
    console.log('✅ Combination selected, analyzing page structure...');
    
    // Get detailed page structure
    const pageStructure = await page.evaluate(() => {
      const structure = {
        title: document.title,
        url: window.location.href,
        bodyClasses: document.body.className,
        mainContent: '',
        allElements: [],
        textContent: document.body.textContent.substring(0, 2000)
      };
      
      // Find main content area
      const mainSelectors = ['main', '#main', '.main-content', '.content', '#content'];
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          structure.mainContent = element.innerHTML.substring(0, 1000);
          break;
        }
      }
      
      // Get all elements with meaningful content
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 20 && text.length < 500) {
          const elementInfo = {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            text: text.substring(0, 200),
            hasVoltage: text.toLowerCase().includes('volt') || text.toLowerCase().includes('12v') || text.toLowerCase().includes('6v'),
            hasAmpere: text.toLowerCase().includes('ah') || text.toLowerCase().includes('ampere'),
            hasWarranty: text.toLowerCase().includes('warranty') || text.toLowerCase().includes('month'),
            hasPrice: text.includes('₹') || text.toLowerCase().includes('price') || text.toLowerCase().includes('rs'),
            hasBattery: text.toLowerCase().includes('battery') || text.toLowerCase().includes('amaron')
          };
          
          // Only include elements that seem battery-related
          if (elementInfo.hasVoltage || elementInfo.hasAmpere || elementInfo.hasWarranty || 
              (elementInfo.hasBattery && (elementInfo.hasPrice || elementInfo.hasVoltage))) {
            structure.allElements.push(elementInfo);
          }
        }
      });
      
      return structure;
    });
    
    console.log('\n📊 Page Structure Analysis:');
    console.log('Title:', pageStructure.title);
    console.log('URL:', pageStructure.url);
    console.log('Body Classes:', pageStructure.bodyClasses);
    
    console.log('\n🔋 Battery-related elements found:', pageStructure.allElements.length);
    
    pageStructure.allElements.forEach((element, index) => {
      console.log(`\nElement ${index + 1}:`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: ${element.className}`);
      console.log(`  ID: ${element.id}`);
      console.log(`  Text: ${element.text}`);
      console.log(`  Has Voltage: ${element.hasVoltage}`);
      console.log(`  Has Ampere: ${element.hasAmpere}`);
      console.log(`  Has Warranty: ${element.hasWarranty}`);
      console.log(`  Has Price: ${element.hasPrice}`);
    });
    
    console.log('\n📄 Page Text Sample:');
    console.log(pageStructure.textContent);
    
    // Wait for user to inspect the page
    console.log('\n⏸️  Browser window is open for manual inspection. Press Ctrl+C when done.');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the inspection
inspectPageStructure().catch(console.error);