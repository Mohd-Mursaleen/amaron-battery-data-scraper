#!/usr/bin/env node
/**
 * Test the complete SmartUrlScraper flow - Phase 1 + Phase 2
 * Limited scope test to verify both discovery and API testing work
 */

const SmartUrlScraper = require('../src/smartUrlScraper');
const utils = require('../src/utils');

class LimitedSmartUrlScraper extends SmartUrlScraper {
  /**
   * Override discovery to limit scope for testing
   * Only test first 2 vehicle types and first 2 brands per vehicle type
   */
  async discoverValidCombinations() {
    try {
      utils.logProgress('🧪 TEST MODE: Limited discovery for full flow testing...');
      
      // Navigate to main page
      await this.navigateToMainPage();
      
      // Get initial vehicle types (limit to first 2)
      const allVehicleTypes = await this.getDropdownOptions('#edit-select-vehicle, select[name="select-vehicle"]');
      const vehicleTypes = allVehicleTypes.slice(0, 2); // Only test first 2 vehicle types
      utils.logProgress(`🔬 Testing ${vehicleTypes.length} vehicle types (limited from ${allVehicleTypes.length})`);
      
      const validCombinations = [];
      
      for (const vehicleType of vehicleTypes) {
        utils.logProgress(`\n🚗 Testing vehicle type: ${vehicleType.text}`);
        
        // Select vehicle type
        const vehicleSelected = await this.selectDropdownOption(
          '#edit-select-vehicle, select[name="select-vehicle"]', 
          vehicleType.value, 
          'vehicle type'
        );
        
        if (!vehicleSelected) continue;
        
        // Get brands available for this vehicle type (limit to first 2)
        const allBrands = await this.getDropdownOptions('#edit-vehicle-make, select[name="vehicle-make"]');
        const brands = allBrands.slice(0, 2); // Only test first 2 brands
        utils.logProgress(`  🔬 Testing ${brands.length} brands (limited from ${allBrands.length})`);
        
        for (const brand of brands) {
          utils.logProgress(`    🏭 Testing brand: ${brand.text}`);
          
          // Select brand
          const brandSelected = await this.selectDropdownOption(
            '#edit-vehicle-make, select[name="vehicle-make"]', 
            brand.value, 
            'brand'
          );
          
          if (!brandSelected) continue;
          
          // Get models available for this brand (limit to first 3)
          const allModels = await this.getDropdownOptions('#edit-model, select[name="model"]');
          const models = allModels.slice(0, 3); // Only test first 3 models
          utils.logProgress(`      🔬 Testing ${models.length} models (limited from ${allModels.length})`);
          
          for (const model of models) {
            // Select model
            const modelSelected = await this.selectDropdownOption(
              '#edit-model, select[name="model"]', 
              model.value, 
              'model'
            );
            
            if (!modelSelected) continue;
            
            // Get fuel types available for this specific model
            const fuelTypes = await this.getDropdownOptions('#edit-fuel, select[name="fuel"]');
            
            if (fuelTypes.length > 0) {
              utils.logProgress(`        ⛽ Found ${fuelTypes.length} fuel types for ${model.text}: ${fuelTypes.map(f => f.text).join(', ')}`);
              
              // Add all valid combinations for this model
              for (const fuelType of fuelTypes) {
                validCombinations.push({
                  vehicleType: vehicleType.text,
                  brand: brand.text,
                  model: model.text,
                  fuelType: fuelType.text
                });
              }
            }
          }
          
          // Navigate back to main page to reset dropdowns for next brand
          await this.navigateToMainPage();
          
          // Re-select vehicle type for next brand
          await this.selectDropdownOption(
            '#edit-select-vehicle, select[name="select-vehicle"]', 
            vehicleType.value, 
            'vehicle type'
          );
        }
      }
      
      this.validCombinations = validCombinations;
      utils.logProgress(`\n🎯 LIMITED DISCOVERY COMPLETED! Found ${validCombinations.length} valid combinations for testing`);
      
      // Log summary
      const summaryByVehicleType = {};
      validCombinations.forEach(combo => {
        if (!summaryByVehicleType[combo.vehicleType]) {
          summaryByVehicleType[combo.vehicleType] = { count: 0, fuelTypes: new Set() };
        }
        summaryByVehicleType[combo.vehicleType].count++;
        summaryByVehicleType[combo.vehicleType].fuelTypes.add(combo.fuelType);
      });
      
      utils.logProgress('\n📊 Test Discovery Summary:');
      Object.entries(summaryByVehicleType).forEach(([vehicleType, data]) => {
        utils.logProgress(`  ${vehicleType}: ${data.count} combinations, Fuel types: ${Array.from(data.fuelTypes).join(', ')}`);
      });
      
      return validCombinations;
      
    } catch (error) {
      throw new Error(`Failed to discover valid combinations: ${error.message}`);
    }
  }
}

async function testFullFlow() {
  let scraper = null;
  
  try {
    console.log('🧪 TESTING COMPLETE SMARTURLSCRAPER FLOW');
    console.log('=====================================');
    console.log('This test will run both phases with limited scope:');
    console.log('📋 Phase 1: Discovery (first 2 vehicle types, 2 brands each)');
    console.log('🎯 Phase 2: API Testing (test all discovered combinations)');
    console.log('📊 Phase 3: CSV Export (save results to file)');
    console.log('');
    
    // Initialize limited scraper
    scraper = new LimitedSmartUrlScraper();
    
    // Run the complete flow
    const startTime = Date.now();
    const summary = await scraper.scrape();
    const endTime = Date.now();
    
    // Display results
    console.log('\n🎉 FULL FLOW TEST COMPLETED!');
    console.log('============================');
    console.log(`✅ Success: ${summary.success}`);
    console.log(`⏱️  Duration: ${summary.duration}s`);
    console.log(`🔍 Total combinations tested: ${summary.totalCombinations}`);
    console.log(`✅ Successful combinations: ${summary.successfulCombinations}`);
    console.log(`❌ Failed combinations: ${summary.failedCombinations}`);
    console.log(`🔋 Total batteries found: ${summary.totalBatteriesFound}`);
    console.log(`📁 CSV file: ${summary.csvFilePath}`);
    
    if (summary.totalBatteriesFound > 0) {
      console.log('\n🎯 SUCCESS: Both phases worked!');
      console.log('  ✅ Phase 1: Discovery found valid combinations');
      console.log('  ✅ Phase 2: API testing extracted battery data');
      console.log('  ✅ Phase 3: CSV export saved results');
    } else {
      console.log('\n⚠️  WARNING: No battery data found');
      console.log('  ✅ Phase 1: Discovery worked (found combinations)');
      console.log('  ❓ Phase 2: API testing ran but found no data');
      console.log('  This could mean the URL generation needs adjustment');
    }
    
    // Show efficiency comparison
    console.log('\n📈 EFFICIENCY ANALYSIS:');
    console.log(`  🔬 Test scope: ${summary.totalCombinations} combinations`);
    console.log(`  🎯 Success rate: ${summary.totalCombinations > 0 ? ((summary.successfulCombinations / summary.totalCombinations) * 100).toFixed(1) : 0}%`);
    console.log(`  ⚡ Speed: ${summary.totalCombinations > 0 ? (summary.totalCombinations / summary.duration).toFixed(1) : 0} combinations/second`);
    
    if (summary.errors && summary.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      summary.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ FULL FLOW TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   This indicates an issue in the scraper logic`);
  } finally {
    if (scraper) {
      await scraper.closeBrowser();
    }
  }
}

// Run the full flow test
console.log('Starting full flow test...\n');
testFullFlow().catch(console.error);