#!/usr/bin/env node

/**
 * Test script to check battery data extraction
 * This will help identify if batteries are available and how to extract them
 */

const puppeteer = require('puppeteer');
const config = require('../src/config');

async function testBatteryExtraction() {
  let browser = null;
  let page = null;

  try {
    console.log('🔋 Testing battery data extraction...');
    
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('📄 Navigating to Amaron page...');
    await page.goto(config.baseUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try a known working combination: Passengers -> ASHOK LEYLAND -> Stile -> Diesel
    console.log('🔄 Testing known working combination: Passengers -> ASHOK LEYLAND -> Stile -> Diesel');
    
    // Select Passengers
    await page.select('#edit-select-vehicle, select[name="select-vehicle"]', '5618');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Select ASHOK LEYLAND
    await page.select('#edit-vehicle-make, select[name="vehicle-make"]', '70058');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Select Stile
    await page.select('#edit-model, select[name="model"]', '70059');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Select Diesel
    await page.select('#edit-fuel, select[name="fuel"]', '70060');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Combination selected, checking for battery results...');
    
    // Check page content for battery data
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        hasResults: false,
        resultContainers: [],
        allText: '',
        possibleSelectors: []
      };
      
      // Get all text content
      analysis.allText = document.body.textContent.substring(0, 1000);
      
      // Look for various container types
      const containerSelectors = [
        '.battery-card',
        '.battery-item', 
        '.product-item',
        '.result-item',
        '.view-content .views-row',
        '.views-row',
        '.product',
        '.battery',
        '[class*="battery"]',
        '[class*="product"]',
        '[class*="result"]'
      ];
      
      containerSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.push({
            selector: selector,
            count: elements.length,
            firstElementText: elements[0].textContent.substring(0, 200)
          });
        }
      });
      
      // Check if there are any results
      analysis.hasResults = analysis.possibleSelectors.length > 0;
      
      return analysis;
    });
    
    console.log('📊 Page Analysis Results:');
    console.log('Has Results:', pageAnalysis.hasResults);
    console.log('Possible Selectors:', pageAnalysis.possibleSelectors);
    console.log('Page Text Sample:', pageAnalysis.allText.substring(0, 300));
    
    if (pageAnalysis.possibleSelectors.length > 0) {
      console.log('\n🎯 Found potential battery containers! Testing extraction...');
      
      // Test extraction with the most promising selector
      const bestSelector = pageAnalysis.possibleSelectors[0];
      console.log(`Using selector: ${bestSelector.selector}`);
      
      const extractedData = await page.evaluate((selector) => {
        const containers = document.querySelectorAll(selector);
        const batteries = [];
        
        containers.forEach((container, index) => {
          const battery = {
            index: index,
            fullText: container.textContent.trim(),
            innerHTML: container.innerHTML.substring(0, 500)
          };
          
          // Try to extract specific fields
          const textContent = container.textContent.toLowerCase();
          
          if (textContent.includes('volt') || textContent.includes('v')) {
            battery.hasVoltage = true;
          }
          if (textContent.includes('ah') || textContent.includes('ampere')) {
            battery.hasAmpereHour = true;
          }
          if (textContent.includes('warranty')) {
            battery.hasWarranty = true;
          }
          if (textContent.includes('price') || textContent.includes('₹') || textContent.includes('rs')) {
            battery.hasPrice = true;
          }
          
          batteries.push(battery);
        });
        
        return batteries;
      }, bestSelector.selector);
      
      console.log(`\n🔋 Extracted ${extractedData.length} potential batteries:`);
      extractedData.forEach((battery, index) => {
        console.log(`\nBattery ${index + 1}:`);
        console.log(`  Text: ${battery.fullText.substring(0, 200)}...`);
        console.log(`  Has Voltage: ${battery.hasVoltage}`);
        console.log(`  Has Ampere Hour: ${battery.hasAmpereHour}`);
        console.log(`  Has Warranty: ${battery.hasWarranty}`);
        console.log(`  Has Price: ${battery.hasPrice}`);
      });
    } else {
      console.log('❌ No battery containers found. The page might not have results for this combination.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testBatteryExtraction().catch(console.error);