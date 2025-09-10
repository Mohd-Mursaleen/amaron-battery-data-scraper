/**
 * Smart URL Amaron Battery Scraper
 * Discovers valid combinations dynamically, then tests only those URLs
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const utils = require('./utils');
const CSVExporter = require('./csvExporter');

class SmartUrlScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.csvExporter = null;
    this.scrapedCount = 0;
    this.processedCombinations = 0;
    this.successfulCombinations = 0;
    this.validCombinations = [];
  }

  /**
   * Initialize CSV exporter for data export
   */
  async initializeCSVExporter() {
    try {
      utils.logProgress('Initializing CSV exporter...');
      this.csvExporter = new CSVExporter();
      await this.csvExporter.initializeCSV();
      utils.logProgress('CSV exporter initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize CSV exporter: ${error.message}`);
    }
  }

  /**
   * Initialize browser with error handling
   */
  async initializeBrowser() {
    try {
      utils.logProgress('Initializing browser...');
      this.browser = await puppeteer.launch(config.browser.launchOptions);
      this.page = await this.browser.newPage();
      
      await this.page.setViewport(config.browser.pageOptions.viewport);
      await this.page.setUserAgent(config.browser.pageOptions.userAgent);
      
      // Set up request interception to block unnecessary resources
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'stylesheet' || resourceType === 'image') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      utils.logProgress('Browser initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  /**
   * Navigate to the main Amaron page to discover valid combinations
   */
  async navigateToMainPage() {
    try {
      utils.logProgress('Navigating to Amaron main page for discovery...');
      await this.page.goto(config.baseUrl, { waitUntil: 'networkidle2' });
      await utils.delay(3000); // Wait for page to fully load
      utils.logProgress('Successfully navigated to main page');
    } catch (error) {
      throw new Error(`Failed to navigate to main page: ${error.message}`);
    }
  }

  /**
   * Get available options from a dropdown
   */
  async getDropdownOptions(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      
      const options = await this.page.evaluate((sel) => {
        const dropdown = document.querySelector(sel);
        if (!dropdown) return [];
        
        return Array.from(dropdown.options)
          .filter(opt => opt.value && opt.value !== '' && opt.value !== 'default')
          .map(opt => ({ value: opt.value, text: opt.textContent.trim() }));
      }, selector);
      
      return options;
    } catch (error) {
      utils.logProgress(`Failed to get dropdown options for ${selector}: ${error.message}`, 'warn');
      return [];
    }
  }

  /**
   * Select an option in a dropdown and wait for page update
   */
  async selectDropdownOption(selector, value, optionName) {
    try {
      utils.logProgress(`Selecting ${optionName}: ${value}`);
      await this.page.select(selector, value);
      await utils.delay(2000); // Wait for AJAX to update dependent dropdowns
      return true;
    } catch (error) {
      utils.logProgress(`Failed to select ${optionName} ${value}: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * Discover all valid combinations by navigating through dependent dropdowns
   */
  async discoverValidCombinations() {
    try {
      utils.logProgress('🔍 Starting intelligent combination discovery...');
      
      // Navigate to main page
      await this.navigateToMainPage();
      
      // Get initial vehicle types
      const vehicleTypes = await this.getDropdownOptions('#edit-select-vehicle, select[name="select-vehicle"]');
      utils.logProgress(`Found ${vehicleTypes.length} vehicle types`);
      
      const validCombinations = [];
      
      for (const vehicleType of vehicleTypes) {
        utils.logProgress(`\n🚗 Discovering combinations for: ${vehicleType.text}`);
        
        // Select vehicle type
        const vehicleSelected = await this.selectDropdownOption(
          '#edit-select-vehicle, select[name="select-vehicle"]', 
          vehicleType.value, 
          'vehicle type'
        );
        
        if (!vehicleSelected) continue;
        
        // Get brands available for this vehicle type
        const brands = await this.getDropdownOptions('#edit-vehicle-make, select[name="vehicle-make"]');
        utils.logProgress(`  Found ${brands.length} brands for ${vehicleType.text}`);
        
        for (const brand of brands) {
          utils.logProgress(`    🏭 Discovering models for: ${brand.text}`);
          
          // Select brand
          const brandSelected = await this.selectDropdownOption(
            '#edit-vehicle-make, select[name="vehicle-make"]', 
            brand.value, 
            'brand'
          );
          
          if (!brandSelected) continue;
          
          // Get models available for this brand
          const models = await this.getDropdownOptions('#edit-model, select[name="model"]');
          utils.logProgress(`      Found ${models.length} models for ${brand.text}`);
          
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
      utils.logProgress(`\n🎉 Discovery completed! Found ${validCombinations.length} valid combinations`);
      
      // Log summary by vehicle type
      const summaryByVehicleType = {};
      validCombinations.forEach(combo => {
        if (!summaryByVehicleType[combo.vehicleType]) {
          summaryByVehicleType[combo.vehicleType] = { count: 0, fuelTypes: new Set() };
        }
        summaryByVehicleType[combo.vehicleType].count++;
        summaryByVehicleType[combo.vehicleType].fuelTypes.add(combo.fuelType);
      });
      
      utils.logProgress('\n📊 Discovery Summary:');
      Object.entries(summaryByVehicleType).forEach(([vehicleType, data]) => {
        utils.logProgress(`  ${vehicleType}: ${data.count} combinations, Fuel types: ${Array.from(data.fuelTypes).join(', ')}`);
      });
      
      return validCombinations;
      
    } catch (error) {
      throw new Error(`Failed to discover valid combinations: ${error.message}`);
    }
  }

  /**
   * Generate battery page URL for a specific combination
   */
  generateBatteryPageUrl(vehicleType, brand, model, fuelType) {
    // Convert text to URL-friendly format
    const urlify = (text) => text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    const vehicleTypeUrl = urlify(vehicleType);
    const brandUrl = urlify(brand);
    const modelUrl = urlify(model);
    const fuelTypeUrl = urlify(fuelType);
    
    return `https://www.amaron.com/battery/${vehicleTypeUrl}/${brandUrl}/${modelUrl}/${fuelTypeUrl}`;
  }

  /**
   * Test if a battery page URL exists and has data
   */
  async testBatteryPageUrl(url, combination) {
    try {
      utils.logProgress(`Testing URL: ${url}`);
      
      const response = await this.page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 10000 
      });
      
      if (!response.ok()) {
        utils.logProgress(`URL returned ${response.status()}: ${url}`, 'warn');
        return null;
      }
      
      await utils.delay(2000); // Wait for page to fully load
      
      // Extract battery data
      const batteryData = await this.extractBatteryData(combination);
      
      if (batteryData.length > 0) {
        utils.logProgress(`✅ Found ${batteryData.length} batteries at ${url}`);
        return batteryData;
      } else {
        utils.logProgress(`○ No battery data found at ${url}`);
        return null;
      }
      
    } catch (error) {
      utils.logProgress(`Failed to test ${url}: ${error.message}`, 'warn');
      return null;
    }
  }

  /**
   * Extract battery data from the current page state
   */
  async extractBatteryData(combination) {
    try {
      // Wait for results to load
      await utils.delay(1000);
      
      // Extract battery data using the actual page structure
      const batteryData = await this.page.evaluate((combo) => {
        const batteries = [];
        
        // Check using text content
        const pageText = document.body.textContent;
        const hasVoltage = pageText.includes('Voltage (V)');
        const hasAmpere = pageText.includes('Amphere Hour') || pageText.includes('AH');
        const hasWarranty = pageText.includes('Warranty (Months)');
        
        if (hasVoltage || hasAmpere || hasWarranty) {
          const battery = {
            vehicleType: combo.vehicleType,
            brand: combo.brand,
            model: combo.model,
            fuelType: combo.fuelType,
            batteryBrand: 'Amaron', // Default brand
            series: '',
            itemCode: '',
            batteryModel: '',
            dimensions: '',
            voltage: '',
            ampereHour: '',
            cca: '',
            totalWarranty: '',
            freeWarranty: '',
            proRataWarranty: '',
            terminalLayoutImageUrl: '',
            countryOfOrigin: '',
            basePrice: '',
            specialDiscount: '',
            totalPrice: '',
            rebate: ''
          };
          
          // Extract voltage
          const voltageRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Voltage (V)')
          );
          if (voltageRow) {
            const voltageCell = voltageRow.querySelector('td');
            if (voltageCell) {
              battery.voltage = voltageCell.textContent.trim();
            }
          }
          
          // Extract ampere hour
          const ampereRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Ref. Amphere Hour (AH)')
          );
          if (ampereRow) {
            const ampereCell = ampereRow.querySelector('td');
            if (ampereCell) {
              battery.ampereHour = ampereCell.textContent.trim();
            }
          }
          
          // Extract total warranty
          const totalWarrantyRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Total Warranty (Months)')
          );
          if (totalWarrantyRow) {
            const warrantyCell = totalWarrantyRow.querySelector('td');
            if (warrantyCell) {
              battery.totalWarranty = warrantyCell.textContent.trim();
            }
          }
          
          // Extract free warranty
          const freeWarrantyRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Free Warranty (Months)')
          );
          if (freeWarrantyRow) {
            const freeWarrantyCell = freeWarrantyRow.querySelector('td');
            if (freeWarrantyCell) {
              battery.freeWarranty = freeWarrantyCell.textContent.trim();
            }
          }
          
          // Extract pro-rata warranty
          const proRataRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Pro-rata Warranty (Months)')
          );
          if (proRataRow) {
            const proRataCell = proRataRow.querySelector('td');
            if (proRataCell) {
              battery.proRataWarranty = proRataCell.textContent.trim();
            }
          }
          
          // Extract rebate
          const rebateRow = Array.from(document.querySelectorAll('tr')).find(tr => 
            tr.textContent.includes('Rebate on Return of old battery')
          );
          if (rebateRow) {
            const rebateCell = rebateRow.querySelector('td');
            if (rebateCell) {
              const rebateText = rebateCell.textContent.trim();
              const rebateMatch = rebateText.match(/₹[\d,]+/);
              if (rebateMatch) {
                battery.rebate = rebateMatch[0];
              }
            }
          }
          
          // Extract terminal layout image
          const terminalImg = document.querySelector('img[src*="terminal"], img[alt*="terminal"], img[title*="terminal"]');
          if (terminalImg) {
            battery.terminalLayoutImageUrl = terminalImg.src;
          }
          
          // Generate a battery model based on specifications
          if (battery.voltage && battery.ampereHour) {
            battery.batteryModel = `${battery.voltage}V ${battery.ampereHour}AH`;
          }
          
          // Only add battery if we found meaningful data
          if (battery.voltage || battery.ampereHour || battery.totalWarranty) {
            batteries.push(battery);
          }
        }
        
        return batteries;
      }, combination);
      
      return batteryData;
      
    } catch (error) {
      utils.logProgress(`Failed to extract battery data: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Process all valid combinations by testing their URLs
   */
  async processValidCombinations() {
    try {
      utils.logProgress('🚀 Starting to process valid combinations...');
      
      if (this.validCombinations.length === 0) {
        throw new Error('No valid combinations found. Run discovery first.');
      }
      
      this.processedCombinations = 0;
      
      for (const combination of this.validCombinations) {
        this.processedCombinations++;
        const progress = `${this.processedCombinations}/${this.validCombinations.length}`;
        const percentage = ((this.processedCombinations / this.validCombinations.length) * 100).toFixed(1);
        
        utils.logProgress(`\n🔄 Processing ${progress} (${percentage}%): ${combination.vehicleType} → ${combination.brand} → ${combination.model} → ${combination.fuelType}`);
        
        // Generate the battery page URL
        const batteryPageUrl = this.generateBatteryPageUrl(
          combination.vehicleType,
          combination.brand,
          combination.model,
          combination.fuelType
        );
        
        // Test the URL and extract data if available
        const batteryData = await this.testBatteryPageUrl(batteryPageUrl, combination);
        
        if (batteryData && batteryData.length > 0) {
          this.successfulCombinations++;
          
          // Save battery data to CSV
          for (const battery of batteryData) {
            try {
              await this.csvExporter.appendBatteryRecord(battery);
              this.scrapedCount++;
            } catch (error) {
              utils.logProgress(`Failed to save battery data: ${error.message}`, 'warn');
            }
          }
          
          utils.logProgress(`        ✅ Found ${batteryData.length} batteries (Total: ${this.scrapedCount})`);
        }
        
        // Add small delay between requests to be respectful
        await utils.delay(500);
      }
      
      utils.logProgress(`\n🎉 Processing completed! Processed ${this.processedCombinations} valid combinations, found ${this.scrapedCount} batteries from ${this.successfulCombinations} successful combinations`);
      
    } catch (error) {
      throw new Error(`Processing failed: ${error.message}`);
    }
  }

  /**
   * Main scraping method
   */
  async scrape() {
    const startTime = Date.now();
    let summary = {
      success: false,
      totalCombinations: 0,
      successfulCombinations: 0,
      failedCombinations: 0,
      totalBatteriesFound: 0,
      csvFilePath: null,
      duration: 0,
      errors: []
    };

    try {
      utils.logProgress('Starting smart Amaron battery scraping...');
      
      // Initialize components
      await this.initializeBrowser();
      await this.initializeCSVExporter();
      
      // Phase 1: Discover valid combinations
      await this.discoverValidCombinations();
      
      // Phase 2: Process only valid combinations
      await this.processValidCombinations();
      
      // Finalize CSV
      const csvSummary = await this.csvExporter.finalizeCSV();
      summary.csvFilePath = csvSummary.filePath;
      summary.totalBatteriesFound = this.scrapedCount;
      summary.totalCombinations = this.processedCombinations;
      summary.successfulCombinations = this.successfulCombinations;
      summary.failedCombinations = this.processedCombinations - this.successfulCombinations;
      summary.success = true;
      
      const endTime = Date.now();
      summary.duration = Math.round((endTime - startTime) / 1000);
      
      utils.logProgress(`✅ Scraping completed successfully in ${summary.duration}s`);
      utils.logProgress(`📊 Results: ${summary.totalBatteriesFound} batteries found from ${summary.successfulCombinations}/${summary.totalCombinations} valid combinations`);
      utils.logProgress(`📁 CSV file: ${summary.csvFilePath}`);
      
      return summary;
      
    } catch (error) {
      summary.errors.push(error.message);
      utils.logProgress(`❌ Scraping failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.closeBrowser();
      const endTime = Date.now();
      summary.duration = Math.round((endTime - startTime) / 1000);
    }
  }

  /**
   * Clean up browser resources
   */
  async closeBrowser() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      utils.logProgress('Browser closed successfully');
    } catch (error) {
      utils.logProgress(`Error closing browser: ${error.message}`, 'warn');
    }
  }
}

module.exports = SmartUrlScraper;