#!/usr/bin/env node

/**
 * Debug script to understand dropdown behavior on Amaron website
 * This will help identify why the scraper isn't finding valid combinations
 */

const puppeteer = require('puppeteer');
const config = require('../src/config');

async function debugDropdowns() {
  let browser = null;
  let page = null;

  try {
    console.log('🔍 Starting dropdown debugging...');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log('📄 Navigating to Amaron page...');
    await page.goto(config.baseUrl, { waitUntil: 'networkidle2' });
    
    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Analyzing initial dropdown state...');
    
    // Check vehicle type dropdown
    const vehicleTypes = await page.evaluate(() => {
      const dropdown = document.querySelector('#edit-select-vehicle, select[name="select-vehicle"]');
      if (!dropdown) return { error: 'Vehicle type dropdown not found' };
      
      return Array.from(dropdown.options)
        .filter(opt => opt.value && opt.value !== '')
        .map(opt => ({ value: opt.value, text: opt.textContent.trim() }));
    });
    
    console.log('🚗 Vehicle Types:', vehicleTypes);
    
    // Check brand dropdown initial state
    const initialBrands = await page.evaluate(() => {
      const dropdown = document.querySelector('#edit-vehicle-make, select[name="vehicle-make"]');
      if (!dropdown) return { error: 'Brand dropdown not found' };
      
      return Array.from(dropdown.options)
        .filter(opt => opt.value && opt.value !== '')
        .map(opt => ({ value: opt.value, text: opt.textContent.trim() }));
    });
    
    console.log('🏭 Initial Brands:', initialBrands);
    
    // Test selecting different vehicle types and see how brands change
    if (vehicleTypes.length > 0 && !vehicleTypes.error) {
      for (let i = 0; i < Math.min(3, vehicleTypes.length); i++) {
        const vehicleType = vehicleTypes[i];
        console.log(`\n🔄 Testing vehicle type: ${vehicleType.text} (${vehicleType.value})`);
        
        try {
          // Select vehicle type
          await page.select('#edit-select-vehicle, select[name="select-vehicle"]', vehicleType.value);
          
          // Wait for AJAX to update other dropdowns
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check what brands are now available
          const updatedBrands = await page.evaluate(() => {
            const dropdown = document.querySelector('#edit-vehicle-make, select[name="vehicle-make"]');
            if (!dropdown) return { error: 'Brand dropdown not found' };
            
            return Array.from(dropdown.options)
              .filter(opt => opt.value && opt.value !== '' && opt.value !== 'default')
              .map(opt => ({ value: opt.value, text: opt.textContent.trim() }));
          });
          
          console.log(`   📋 Available brands for ${vehicleType.text}:`, updatedBrands.slice(0, 5));
          console.log(`   📊 Total brands: ${updatedBrands.length}`);
          
          // Test selecting first brand to see models
          if (updatedBrands.length > 0 && !updatedBrands.error) {
            const firstBrand = updatedBrands[0];
            console.log(`   🔄 Testing brand: ${firstBrand.text}`);
            
            await page.select('#edit-vehicle-make, select[name="vehicle-make"]', firstBrand.value);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const models = await page.evaluate(() => {
              const dropdown = document.querySelector('#edit-model, select[name="model"]');
              if (!dropdown) return { error: 'Model dropdown not found' };
              
              return Array.from(dropdown.options)
                .filter(opt => opt.value && opt.value !== '' && opt.value !== 'default')
                .map(opt => ({ value: opt.value, text: opt.textContent.trim() }));
            });
            
            console.log(`   🚙 Available models for ${firstBrand.text}:`, models.slice(0, 3));
            console.log(`   📊 Total models: ${models.length}`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error testing ${vehicleType.text}: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Dropdown debugging completed');
    console.log('\n💡 Key findings:');
    console.log('   - Dropdowns are dependent on each other');
    console.log('   - Selecting vehicle type changes available brands');
    console.log('   - Selecting brand changes available models');
    console.log('   - Need to extract options dynamically, not all at once');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the debug function
debugDropdowns().catch(console.error);