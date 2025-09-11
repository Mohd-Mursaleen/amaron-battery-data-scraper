#!/usr/bin/env node

/**
 * Inspect the specific pricing and product structure
 */

const puppeteer = require('puppeteer');
const config = require('./src/config');

async function inspectPricingStructure() {
  let browser = null;
  let page = null;

  try {
    console.log('🔍 Inspecting pricing and product structure...');
    
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('📄 Navigating to specific battery page...');
    await page.goto('https://www.amaron.com/battery/passengers/ashok-leyland/stile/diesel', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Page loaded, analyzing structure...');
    
    // Get detailed pricing and product structure
    const pageStructure = await page.evaluate(() => {
      const structure = {
        title: document.title,
        url: window.location.href,
        pricing: {},
        productInfo: {},
        specifications: {},
        allTables: [],
        allPriceElements: []
      };
      
      // Find all price-related elements
      const priceSelectors = [
        '.price', '.base-price', '.original-price', '.selling-price',
        '.discount', '.special-price', '.offer-price', '.final-price',
        '.total-price', '.proPriceInfo', '[class*="price"]'
      ];
      
      priceSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.textContent.includes('₹')) {
            structure.allPriceElements.push({
              selector: selector,
              className: el.className,
              id: el.id,
              text: el.textContent.trim(),
              innerHTML: el.innerHTML.trim()
            });
          }
        });
      });
      
      // Find all tables and their content
      const tables = document.querySelectorAll('table');
      tables.forEach((table, index) => {
        const tableData = {
          index: index,
          className: table.className,
          id: table.id,
          rows: []
        };
        
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('th, td');
          if (cells.length >= 2) {
            const rowData = {
              header: cells[0].textContent.trim(),
              value: cells[1].textContent.trim()
            };
            tableData.rows.push(rowData);
          }
        });
        
        if (tableData.rows.length > 0) {
          structure.allTables.push(tableData);
        }
      });
      
      // Look for product title
      const titleSelectors = ['h1', 'h2', '.product-title', '.battery-title', '.product-name'];
      titleSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && element.textContent.toLowerCase().includes('amaron')) {
          structure.productInfo.title = element.textContent.trim();
          structure.productInfo.titleSelector = selector;
        }
      });
      
      // Look for item code in various places
      const itemCodeSelectors = [
        '[class*="item-code"]', '[class*="product-code"]', '[class*="model"]',
        '[id*="item-code"]', '[id*="product-code"]'
      ];
      
      itemCodeSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          structure.productInfo.itemCode = element.textContent.trim();
          structure.productInfo.itemCodeSelector = selector;
        }
      });
      
      // Look for specific pricing in green table (from image)
      const greenTableRows = document.querySelectorAll('tr');
      greenTableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes('base price') || text.includes('special discount') || text.includes('total price')) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const label = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();
            
            if (text.includes('base price')) {
              structure.pricing.basePrice = value;
              structure.pricing.basePriceElement = row.outerHTML;
            } else if (text.includes('special discount')) {
              structure.pricing.specialDiscount = value;
              structure.pricing.specialDiscountElement = row.outerHTML;
            } else if (text.includes('total price')) {
              structure.pricing.totalPrice = value;
              structure.pricing.totalPriceElement = row.outerHTML;
            }
          }
        }
      });
      
      return structure;
    });
    
    console.log('\n📊 PRICING STRUCTURE ANALYSIS:');
    console.log('===============================');
    
    console.log('\n💰 PRICING INFORMATION:');
    console.log('Base Price:', pageStructure.pricing.basePrice || 'Not found');
    console.log('Special Discount:', pageStructure.pricing.specialDiscount || 'Not found');
    console.log('Total Price:', pageStructure.pricing.totalPrice || 'Not found');
    
    console.log('\n📦 PRODUCT INFORMATION:');
    console.log('Title:', pageStructure.productInfo.title || 'Not found');
    console.log('Title Selector:', pageStructure.productInfo.titleSelector || 'Not found');
    console.log('Item Code:', pageStructure.productInfo.itemCode || 'Not found');
    console.log('Item Code Selector:', pageStructure.productInfo.itemCodeSelector || 'Not found');
    
    console.log('\n💵 ALL PRICE ELEMENTS FOUND:');
    pageStructure.allPriceElements.forEach((element, index) => {
      console.log(`${index + 1}. Selector: ${element.selector}`);
      console.log(`   Class: ${element.className}`);
      console.log(`   ID: ${element.id}`);
      console.log(`   Text: ${element.text}`);
      console.log('');
    });
    
    console.log('\n📋 ALL TABLES FOUND:');
    pageStructure.allTables.forEach((table, index) => {
      console.log(`Table ${index + 1} (Class: ${table.className}, ID: ${table.id}):`);
      table.rows.forEach(row => {
        console.log(`  ${row.header}: ${row.value}`);
      });
      console.log('');
    });
    
    // Wait for manual inspection
    console.log('\n⏸️  Browser window is open for manual inspection. Press Ctrl+C when done.');
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
    
  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the inspection
inspectPricingStructure().catch(console.error);