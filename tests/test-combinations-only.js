#!/usr/bin/env node
/**
 * Quick test to see discovered combinations without running full scrape
 */

const SmartUrlScraper = require('../src/smartUrlScraper');

class DiscoveryOnlyTester extends SmartUrlScraper {
  async testDiscoveryOnly() {
    try {
      console.log('🔍 TESTING DISCOVERY PHASE ONLY');
      console.log('===============================');
      
      // Initialize browser
      await this.initializeBrowser();
      
      // Run discovery with limited scope (first 1 vehicle type, 2 brands)
      await this.navigateToMainPage();
      
      const vehicleTypes = await this.getDropdownOptions('#edit-select-vehicle, select[name="select-vehicle"]');
      console.log(`Found ${vehicleTypes.length} vehicle types. Testing first one: ${vehicleTypes[0]?.text}`);
      
      if (vehicleTypes.length === 0) {
        throw new Error('No vehicle types found');
      }
      
      // Test first vehicle type only
      const vehicleType = vehicleTypes[0];
      console.log(`\n🚗 Testing: ${vehicleType.text}`);
      
      await this.selectDropdownOption(
        '#edit-select-vehicle, select[name="select-vehicle"]', 
        vehicleType.value, 
        'vehicle type'
      );
      
      const brands = await this.getDropdownOptions('#edit-vehicle-make, select[name="vehicle-make"]');
      console.log(`  Found ${brands.length} brands. Testing first 2.`);
      
      const validCombinations = [];
      
      for (let i = 0; i < Math.min(2, brands.length); i++) {
        const brand = brands[i];
        console.log(`\n  🏭 Testing brand: ${brand.text}`);
        
        await this.selectDropdownOption(
          '#edit-vehicle-make, select[name="vehicle-make"]', 
          brand.value, 
          'brand'
        );
        
        const models = await this.getDropdownOptions('#edit-model, select[name="model"]');
        console.log(`    Found ${models.length} models. Testing first 3.`);
        
        for (let j = 0; j < Math.min(3, models.length); j++) {
          const model = models[j];
          
          await this.selectDropdownOption(
            '#edit-model, select[name="model"]', 
            model.value, 
            'model'
          );
          
          const fuelTypes = await this.getDropdownOptions('#edit-fuel, select[name="fuel"]');
          
          if (fuelTypes.length > 0) {
            console.log(`      ⛽ ${model.text}: ${fuelTypes.map(f => f.text).join(', ')}`);
            
            fuelTypes.forEach(fuelType => {
              validCombinations.push({
                vehicleType: vehicleType.text,
                brand: brand.text,
                model: model.text,
                fuelType: fuelType.text
              });
            });
          } else {
            console.log(`      ○ ${model.text}: No fuel types`);
          }
        }
        
        // Reset for next brand
        await this.navigateToMainPage();
        await this.selectDropdownOption(
          '#edit-select-vehicle, select[name="select-vehicle"]', 
          vehicleType.value, 
          'vehicle type'
        );
      }
      
      console.log(`\n📊 DISCOVERY RESULTS:`);
      console.log(`   Total combinations found: ${validCombinations.length}`);
      
      console.log(`\n🔍 SAMPLE COMBINATIONS:`);
      validCombinations.slice(0, 10).forEach((combo, index) => {
        console.log(`   ${index + 1}. ${combo.vehicleType} → ${combo.brand} → ${combo.model} → ${combo.fuelType}`);
      });
      
      if (validCombinations.length > 10) {
        console.log(`   ... and ${validCombinations.length - 10} more`);
      }
      
      // Test URL generation for first few combinations
      console.log(`\n🔗 SAMPLE GENERATED URLS:`);
      validCombinations.slice(0, 5).forEach((combo, index) => {
        const url = this.generateBatteryPageUrl(combo.vehicleType, combo.brand, combo.model, combo.fuelType);
        console.log(`   ${index + 1}. ${url}`);
      });
      
      return validCombinations;
      
    } catch (error) {
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }
}

async function runDiscoveryTest() {
  try {
    const tester = new DiscoveryOnlyTester();
    const combinations = await tester.testDiscoveryOnly();
    
    console.log('\n✅ DISCOVERY TEST COMPLETED SUCCESSFULLY!');
    console.log(`   Found ${combinations.length} valid combinations`);
    console.log('   Ready to test full flow with test-full-flow.js');
    
  } catch (error) {
    console.error('\n❌ DISCOVERY TEST FAILED:');
    console.error(`   ${error.message}`);
  }
}

runDiscoveryTest();