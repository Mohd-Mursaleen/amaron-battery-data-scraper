#!/usr/bin/env node

/**
 * Test specific URLs mentioned by the user
 */

const DirectUrlScraper = require('../src/directUrlScraper');

async function testSpecificUrls() {
  let scraper = null;
  
  try {
    console.log('🧪 Testing specific battery URLs...');
    
    scraper = new DirectUrlScraper();
    
    // Initialize browser and CSV
    await scraper.initializeBrowser();
    await scraper.initializeCSVExporter();
    
    console.log('✅ Browser initialized');
    
    // Test the specific URLs mentioned by the user
    const testUrls = [
      {
        url: 'https://www.amaron.com/battery/two-wheelers/bajaj/byk-92-ks/petrol',
        combination: {
          vehicleType: 'Two Wheelers',
          brand: 'BAJAJ',
          model: 'BYK 92 (KS)',
          fuelType: 'Petrol'
        }
      },
      {
        url: 'https://www.amaron.com/battery/two-wheelers/bajaj/caliber-ks/petrol',
        combination: {
          vehicleType: 'Two Wheelers',
          brand: 'BAJAJ',
          model: 'Caliber (KS)',
          fuelType: 'Petrol'
        }
      },
      {
        url: 'https://www.amaron.com/battery/three-wheelers/force/minidor/diesel',
        combination: {
          vehicleType: 'Three Wheelers',
          brand: 'FORCE',
          model: 'Minidor',
          fuelType: 'Diesel'
        }
      }
    ];
    
    const results = [];
    
    for (let i = 0; i < testUrls.length; i++) {
      const test = testUrls[i];
      console.log(`\n🔄 Testing URL ${i + 1}: ${test.url}`);
      
      // Test the URL and extract data
      const batteryData = await scraper.testBatteryPageUrl(test.url, test.combination);
      
      if (batteryData && batteryData.length > 0) {
        const battery = batteryData[0];
        console.log(`🔋 Battery Data Found:`);
        console.log(`   Vehicle: ${battery.vehicleType} ${battery.brand} ${battery.model} ${battery.fuelType}`);
        console.log(`   Battery Model: ${battery.batteryModel}`);
        console.log(`   Voltage: ${battery.voltage}`);
        console.log(`   Ampere Hour: ${battery.ampereHour}`);
        console.log(`   Total Warranty: ${battery.totalWarranty} months`);
        console.log(`   Free Warranty: ${battery.freeWarranty} months`);
        console.log(`   Pro-rata Warranty: ${battery.proRataWarranty} months`);
        console.log(`   Rebate: ${battery.rebate}`);
        console.log(`   Terminal Image: ${battery.terminalLayoutImageUrl}`);
        
        // Save to CSV
        await scraper.csvExporter.appendBatteryRecord(battery);
        scraper.scrapedCount++;
        
        results.push({
          url: test.url,
          success: true,
          batteryModel: battery.batteryModel,
          voltage: battery.voltage,
          ampereHour: battery.ampereHour,
          warranty: battery.totalWarranty,
          rebate: battery.rebate
        });
      } else {
        console.log('❌ No battery data found at this URL');
        results.push({
          url: test.url,
          success: false,
          batteryModel: 'N/A',
          voltage: 'N/A',
          ampereHour: 'N/A',
          warranty: 'N/A',
          rebate: 'N/A'
        });
      }
    }
    
    console.log('\n📊 Results Summary:');
    results.forEach((result, index) => {
      console.log(`\nURL ${index + 1}: ${result.url}`);
      console.log(`  Success: ${result.success ? '✅' : '❌'}`);
      console.log(`  Battery Model: ${result.batteryModel}`);
      console.log(`  Voltage: ${result.voltage}`);
      console.log(`  Ampere Hour: ${result.ampereHour}`);
      console.log(`  Warranty: ${result.warranty}`);
      console.log(`  Rebate: ${result.rebate}`);
    });
    
    // Finalize CSV
    if (scraper.scrapedCount > 0) {
      const csvSummary = await scraper.csvExporter.finalizeCSV();
      console.log(`\n💾 CSV saved: ${csvSummary.filePath}`);
      console.log(`📊 Records: ${csvSummary.recordCount}`);
    }
    
    // Check if we got different data for different URLs
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 1) {
      const uniqueVoltages = [...new Set(successfulResults.map(r => r.voltage))];
      const uniqueAmpereHours = [...new Set(successfulResults.map(r => r.ampereHour))];
      
      console.log('\n🔍 Data Variation Analysis:');
      console.log(`Unique Voltages: ${uniqueVoltages.join(', ')}`);
      console.log(`Unique Ampere Hours: ${uniqueAmpereHours.join(', ')}`);
      
      if (uniqueVoltages.length > 1 || uniqueAmpereHours.length > 1) {
        console.log('✅ SUCCESS: Battery data varies between URLs - Direct URL approach is working perfectly!');
      } else {
        console.log('⚠️  All batteries have same specs - this might be expected for similar vehicle types');
      }
    }
    
    console.log('\n🎉 Direct URL testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (scraper) {
      await scraper.closeBrowser();
    }
  }
}

// Run the test
testSpecificUrls().catch(console.error);