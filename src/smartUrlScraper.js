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
    this.seenBatteries = new Set(); // Track duplicates
    this.duplicateCount = 0;
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
   * Extract enhanced battery data from the current page state
   */
  async extractBatteryData(combination) {
    try {
      // Wait for results to load
      await utils.delay(2000);
      
      // Extract battery data using enhanced page structure analysis
      const batteryData = await this.page.evaluate((combo) => {
        const batteries = [];
        
        // Helper function to extract text from various selectors
        const extractText = (selectors) => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.textContent.trim();
            }
          }
          return '';
        };
        
        // Helper function to extract table row data
        const extractTableData = (searchTexts) => {
          for (const searchText of searchTexts) {
            const row = Array.from(document.querySelectorAll('tr')).find(tr => 
              tr.textContent.toLowerCase().includes(searchText.toLowerCase())
            );
            if (row) {
              const cell = row.querySelector('td:last-child') || row.querySelector('td:nth-child(2)');
              if (cell) {
                return cell.textContent.trim();
              }
            }
          }
          return '';
        };
        
        // Helper function to extract price information
        const extractPrice = (text) => {
          const priceMatch = text.match(/₹[\d,]+(?:\.\d{2})?/);
          return priceMatch ? priceMatch[0] : '';
        };
        
        // Check if page has battery data
        const pageText = document.body.textContent.toLowerCase();
        const hasBatteryData = pageText.includes('voltage') || 
                              pageText.includes('ampere') || 
                              pageText.includes('warranty') ||
                              pageText.includes('battery') ||
                              pageText.includes('amaron');
        
        if (hasBatteryData) {
          const battery = {
            vehicleType: combo.vehicleType,
            brand: combo.brand,
            model: combo.model,
            fuelType: combo.fuelType,
            batteryBrand: 'Amaron',
            series: '',
            itemCode: '',
            batteryModel: '',
            batteryTitle: '',
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
          
          // Extract battery title - look for the specific pattern in table cells
          const tableCells = document.querySelectorAll('table.comparisionTable td');
          for (const cell of tableCells) {
            const text = cell.textContent.trim();
            // Look for the exact pattern: "AMARON FLO Automotive Battery - BH90D23L (AAM-FL-0BH90D23L)"
            if (text.includes('AMARON') && text.includes('Automotive Battery') && text.includes('(AAM-')) {
              // Extract just the title line, not the entire cell content
              const lines = text.split('\n').map(line => line.trim()).filter(line => line);
              for (const line of lines) {
                if (line.includes('AMARON') && line.includes('Automotive Battery') && line.includes('(AAM-')) {
                  battery.batteryTitle = line;
                  break;
                }
              }
              if (battery.batteryTitle) break;
            }
          }
          

          
          // Extract item code from table
          battery.itemCode = extractTableData([
            'Item Code',
            'Model Code', 
            'Product Code',
            'Battery Code',
            'Part Number',
            'SKU'
          ]);
          
          // Extract battery series
          battery.series = extractTableData([
            'Series',
            'Battery Series',
            'Product Series'
          ]);
          
          // Extract battery model
          battery.batteryModel = extractTableData([
            'Model',
            'Battery Model',
            'Product Model'
          ]);
          
          // Extract voltage
          battery.voltage = extractTableData([
            'Voltage (V)',
            'Voltage',
            'Nominal Voltage'
          ]);
          
          // Extract ampere hour
          battery.ampereHour = extractTableData([
            'Ref. Amphere Hour (AH)',
            'Ampere Hour',
            'AH',
            'Capacity (AH)',
            'Amp Hour'
          ]);
          
          // Extract CCA (Cold Cranking Amps)
          battery.cca = extractTableData([
            'Cold Cranking Ability (CCA)',
            'CCA',
            'Cold Cranking Amps',
            'Cranking Amps'
          ]);
          
          // Extract dimensions with specific format from Amaron
          battery.dimensions = extractTableData([
            'Product Dimensions (LxBxH) (mm)',
            'Dimensions (L x W x H)',
            'Dimensions',
            'Size',
            'Battery Dimensions'
          ]);
          
          // Extract product dimensions (alternative field)
          battery.productDimensions = extractTableData([
            'Product Dimensions',
            'Overall Dimensions',
            'External Dimensions'
          ]);
          
          // Use whichever dimension field has data
          if (!battery.dimensions && battery.productDimensions) {
            battery.dimensions = battery.productDimensions;
          }
          

          
          // Extract warranties
          battery.totalWarranty = extractTableData([
            'Total Warranty (Months)',
            'Total Warranty',
            'Warranty Period'
          ]);
          
          battery.freeWarranty = extractTableData([
            'Free Warranty (Months)',
            'Free Warranty',
            'Free Service Period'
          ]);
          
          battery.proRataWarranty = extractTableData([
            'Pro-rata Warranty (Months)',
            'Pro-rata Warranty',
            'Prorata Warranty'
          ]);
          
          // Extract country of origin
          battery.countryOfOrigin = extractTableData([
            'Country of Origin',
            'Made in',
            'Origin'
          ]);
          
          // Extract pricing information using table data and specific selectors
          battery.basePrice = extractTableData([
            'Base Price (Inclusive of GST)',
            'Base Price',
            'Original Price',
            'MRP'
          ]);
          
          battery.specialDiscount = extractTableData([
            'Special Discount (Till 18th Sep)',
            'Special Discount',
            'Discount',
            'Offer Price'
          ]);
          
          battery.totalPrice = extractTableData([
            'Total Price (Inclusive of GST)',
            'Total Price',
            'Final Price',
            'Selling Price'
          ]);
          
          // If table extraction fails, try specific proPriceInfo elements
          if (!battery.basePrice || !battery.specialDiscount || !battery.totalPrice) {
            const priceElements = document.querySelectorAll('.proPriceInfo');
            
            priceElements.forEach(element => {
              const text = element.textContent.trim();
              const className = element.className;
              
              // Base price usually has 's-bold font-15' class and higher amount
              if (className.includes('s-bold font-15') && text.includes('₹')) {
                battery.basePrice = extractPrice(text);
              }
              // Total price usually has 'bold-font font-18' class
              else if (className.includes('bold-font font-18') && text.includes('₹')) {
                battery.totalPrice = extractPrice(text);
              }
              // Special discount is usually the middle amount with just 'proPriceInfo' class
              else if (className === 'proPriceInfo' && text.includes('₹') && !text.includes('rebate')) {
                battery.specialDiscount = extractPrice(text);
              }
            });
          }
          
          // Extract rebate
          battery.rebate = extractTableData([
            'Rebate on Return of old battery',
            'Rebate',
            'Exchange Value',
            'Old Battery Value'
          ]);
          
          // If rebate not found in table, look for it in text
          if (!battery.rebate) {
            const rebateMatch = priceText.match(/rebate[^₹]*₹[\d,]+/i);
            if (rebateMatch) {
              battery.rebate = extractPrice(rebateMatch[0]);
            }
          }
          
          // Extract terminal layout image
          const terminalImg = document.querySelector([
            'img[src*="terminal"]',
            'img[alt*="terminal"]', 
            'img[title*="terminal"]',
            'img[src*="layout"]',
            '.terminal-image img',
            '.battery-image img'
          ].join(', '));
          
          if (terminalImg) {
            battery.terminalLayoutImageUrl = terminalImg.src;
          }
          
          // Generate battery model if not found
          if (!battery.batteryModel) {
            if (battery.voltage && battery.ampereHour) {
              battery.batteryModel = `${battery.voltage}V ${battery.ampereHour}AH`;
            } else if (battery.batteryTitle) {
              battery.batteryModel = battery.batteryTitle;
            } else if (battery.itemCode) {
              battery.batteryModel = battery.itemCode;
            }
          }
          
          // Generate battery title if not found (do this at the end when all data is available)
          if (!battery.batteryTitle) {
            if (battery.series && battery.batteryModel && battery.itemCode) {
              battery.batteryTitle = `AMARON ${battery.series.toUpperCase()} Automotive Battery - ${battery.batteryModel} (${battery.itemCode})`;
            }
          }
          
          // Data validation and cleaning
          const cleanData = (obj) => {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
              // Clean and validate data
              let cleanValue = typeof value === 'string' ? value.trim() : value;
              
              // Remove extra whitespace and newlines
              if (typeof cleanValue === 'string') {
                cleanValue = cleanValue.replace(/\s+/g, ' ').trim();
                
                // Remove common unwanted text
                cleanValue = cleanValue.replace(/^[-:]\s*/, '');
                cleanValue = cleanValue.replace(/\s*[-:]\s*$/, '');
              }
              
              cleaned[key] = cleanValue;
            }
            return cleaned;
          };
          
          const cleanedBattery = cleanData(battery);
          
          // Only add battery if we found meaningful data
          const hasValidData = cleanedBattery.voltage || 
                              cleanedBattery.ampereHour || 
                              cleanedBattery.totalWarranty ||
                              cleanedBattery.itemCode ||
                              cleanedBattery.batteryTitle ||
                              cleanedBattery.dimensions;
          
          if (hasValidData) {
            batteries.push(cleanedBattery);
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
   * Remove duplicate batteries based on multiple criteria
   */
  deduplicateBatteries(batteries) {
    const uniqueBatteries = [];
    
    for (const battery of batteries) {
      // Create a unique identifier for the battery
      const identifier = this.createBatteryIdentifier(battery);
      
      // Skip if we've already seen this battery
      if (this.seenBatteries.has(identifier)) {
        continue;
      }
      
      // Add to seen set and unique list
      this.seenBatteries.add(identifier);
      uniqueBatteries.push(battery);
    }
    
    return uniqueBatteries;
  }

  /**
   * Create a unique identifier for a battery based on key characteristics
   */
  createBatteryIdentifier(battery) {
    // Use multiple fields to create a unique identifier
    const keyFields = [
      battery.itemCode || '',
      battery.batteryTitle || '',
      battery.voltage || '',
      battery.ampereHour || '',
      battery.dimensions || '',
      battery.vehicleType || '',
      battery.brand || '',
      battery.model || ''
    ];
    
    // Clean and normalize the fields
    const normalizedFields = keyFields.map(field => 
      field.toString().toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
    );
    
    // Create identifier - prioritize item code if available
    if (battery.itemCode && battery.itemCode.trim()) {
      return `itemcode_${normalizedFields[0]}`;
    }
    
    // If no item code, use combination of other fields
    return normalizedFields.filter(field => field).join('_');
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
          
          // Process and deduplicate battery data
          const uniqueBatteries = this.deduplicateBatteries(batteryData);
          
          // Save unique battery data to CSV
          for (const battery of uniqueBatteries) {
            try {
              await this.csvExporter.appendBatteryRecord(battery);
              this.scrapedCount++;
            } catch (error) {
              utils.logProgress(`Failed to save battery data: ${error.message}`, 'warn');
            }
          }
          
          const duplicatesFound = batteryData.length - uniqueBatteries.length;
          if (duplicatesFound > 0) {
            this.duplicateCount += duplicatesFound;
            utils.logProgress(`        ✅ Found ${batteryData.length} batteries, ${uniqueBatteries.length} unique (${duplicatesFound} duplicates) (Total: ${this.scrapedCount})`);
          } else {
            utils.logProgress(`        ✅ Found ${uniqueBatteries.length} unique batteries (Total: ${this.scrapedCount})`);
          }
        }
        
        // Add small delay between requests to be respectful
        await utils.delay(500);
      }
      
      utils.logProgress(`\n🎉 Processing completed! Processed ${this.processedCombinations} valid combinations, found ${this.scrapedCount} unique batteries from ${this.successfulCombinations} successful combinations`);
      
      if (this.duplicateCount > 0) {
        utils.logProgress(`🔄 Duplicate removal: ${this.duplicateCount} duplicate batteries were filtered out`);
      }
      
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