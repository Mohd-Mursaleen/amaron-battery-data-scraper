#!/usr/bin/env node
/**
 * Test the fixed enhanced battery data extraction
 */

const SmartUrlScraper = require('./src/smartUrlScraper');

class FixedExtractionTester extends SmartUrlScraper {
  async testFixedExtraction() {
    try {
      console.log('🧪 TESTING FIXED ENHANCED EXTRACTION');
      console.log('===================================');
      
      // Initialize browser and CSV
      await this.initializeBrowser();
      await this.initializeCSVExporter();
      
      // Test with the known working URL
      const testUrl = 'https://www.amaron.com/battery/passengers/ashok-leyland/stile/diesel';
      const testCombination = {
        vehicleType: 'Passengers',
        brand: 'ASHOK LEYLAND',
        model: 'Stile',
        fuelType: 'Diesel'
      };
      
      console.log(`\n🔍 Testing URL: ${testUrl}`);
      console.log(`🔍 Combination: ${testCombination.vehicleType} → ${testCombination.brand} → ${testCombination.model} → ${testCombination.fuelType}`);
      
      // Navigate to the URL
      const response = await this.page.goto(testUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
      
      if (!response.ok()) {
        throw new Error(`URL returned ${response.status()}`);
      }
      
      console.log('✅ Page loaded successfully');
      
      // Extract battery data
      const batteryData = await this.extractBatteryData(testCombination);
      
      if (batteryData && batteryData.length > 0) {
        console.log(`\n🎉 Found ${batteryData.length} batteries!`);
        
        batteryData.forEach((battery, index) => {
          console.log(`\n📋 Battery ${index + 1} Details:`);
          console.log(`   Title: ${battery.batteryTitle || 'N/A'}`);
          console.log(`   Item Code: ${battery.itemCode || 'N/A'}`);
          console.log(`   Series: ${battery.series || 'N/A'}`);
          console.log(`   Model: ${battery.batteryModel || 'N/A'}`);
          console.log(`   Dimensions: ${battery.dimensions || 'N/A'}`);
          console.log(`   Voltage: ${battery.voltage || 'N/A'}`);
          console.log(`   Ampere Hour: ${battery.ampereHour || 'N/A'}`);
          console.log(`   CCA: ${battery.cca || 'N/A'}`);
          console.log(`   Total Warranty: ${battery.totalWarranty || 'N/A'}`);
          console.log(`   Free Warranty: ${battery.freeWarranty || 'N/A'}`);
          console.log(`   Pro-rata Warranty: ${battery.proRataWarranty || 'N/A'}`);
          console.log(`   Country of Origin: ${battery.countryOfOrigin || 'N/A'}`);
          console.log(`   Base Price: ${battery.basePrice || 'N/A'}`);
          console.log(`   Special Discount: ${battery.specialDiscount || 'N/A'}`);
          console.log(`   Total Price: ${battery.totalPrice || 'N/A'}`);
          console.log(`   Rebate: ${battery.rebate || 'N/A'}`);
        });
        
        // Test deduplication
        const uniqueBatteries = this.deduplicateBatteries(batteryData);
        const duplicates = batteryData.length - uniqueBatteries.length;
        
        console.log(`\n🔄 Deduplication Test:`);
        console.log(`   Original: ${batteryData.length} batteries`);
        console.log(`   Unique: ${uniqueBatteries.length} batteries`);
        console.log(`   Duplicates removed: ${duplicates}`);
        
        // Save to CSV
        for (const battery of uniqueBatteries) {
          await this.csvExporter.appendBatteryRecord(battery);
        }
        
        const csvSummary = await this.csvExporter.finalizeCSV();
        
        console.log(`\n📁 CSV Results:`);
        console.log(`   File: ${csvSummary.filePath}`);
        console.log(`   Records: ${csvSummary.recordCount}`);
        
        // Validate key fields
        const sample = uniqueBatteries[0];
        const validationResults = {
          hasTitle: !!sample.batteryTitle,
          hasItemCode: !!sample.itemCode,
          hasDimensions: !!sample.dimensions,
          hasBasePrice: !!sample.basePrice,
          hasSpecialDiscount: !!sample.specialDiscount,
          hasTotalPrice: !!sample.totalPrice,
          hasVoltage: !!sample.voltage,
          hasAmpereHour: !!sample.ampereHour
        };
        
        console.log(`\n✅ Field Validation:`);
        Object.entries(validationResults).forEach(([field, isValid]) => {
          console.log(`   ${field}: ${isValid ? '✅ Found' : '❌ Missing'}`);
        });
        
        const validFields = Object.values(validationResults).filter(v => v).length;
        const totalFields = Object.keys(validationResults).length;
        
        console.log(`\n📊 Extraction Success Rate: ${validFields}/${totalFields} (${((validFields/totalFields)*100).toFixed(1)}%)`);
        
        if (validFields >= 6) {
          console.log('\n🎉 ENHANCED EXTRACTION WORKING WELL!');
        } else {
          console.log('\n⚠️  Some fields missing - may need selector adjustments');
        }
        
      } else {
        console.log('\n❌ No battery data found');
      }
      
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error.message);
    } finally {
      await this.closeBrowser();
    }
  }
}

async function runFixedTest() {
  const tester = new FixedExtractionTester();
  await tester.testFixedExtraction();
}

console.log('Starting fixed enhanced extraction test...\n');
runFixedTest().catch(console.error);