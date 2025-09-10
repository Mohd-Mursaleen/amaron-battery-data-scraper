/**
 * Direct URL Amaron Battery Scraper
 * Directly constructs and tests battery page URLs for all possible combinations
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const utils = require('./utils');
const CSVExporter = require('./csvExporter');

class DirectUrlScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.csvExporter = null;
    this.scrapedCount = 0;
    this.processedCombinations = 0;
    this.successfulCombinations = 0;
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
   * Generate all possible combinations to test
   */
  generateAllCombinations() {
    const combinations = [];
    
    // Define all possible combinations based on the website structure
    const vehicleTypes = [
      'Two Wheelers',
      'Three Wheelers', 
      'Passengers',
      'Commercial',
      'Farm Vehicles',
      'Earth Moving Equipment',
      'Genset'
    ];
    
    const brandsByVehicleType = {
      'Two Wheelers': [
        'BAJAJ', 'BENELLI', 'HERO', 'HONDA', 'IDEAL JAWA LTD', 'JAWA', 
        'KANDA', 'KINETIC', 'LML', 'MAHINDRA & MAHINDRA', 'PIAGGIO', 
        'ROYAL ENFIELD', 'SUZUKI', 'TVS', 'YAMAHA'
      ],
      'Three Wheelers': [
        'ATUL (ATUL AUTO)', 'BAJAJ', 'FORCE', 'KRANTI', 'KUMAR MOTORS',
        'LOTIA MOTORS', 'M&M', 'MLR MOTORS', 'PANCHNATH AUTO', 'PIAGGIO',
        'RASANDIK', 'TVS', 'VIKRAM'
      ],
      'Passengers': [
        'ASHOK LEYLAND', 'AUDI', 'BAJAJ', 'BMW', 'CHEVROLET (GENERAL MOTORS)',
        'DAEWOO', 'FIAT', 'FORCE', 'FORD', 'HINDUSTAN MOTORS', 'HONDA',
        'HYUNDAI', 'ICML', 'ISUZU', 'JAGUAR', 'JEEP', 'KIA', 'MAHINDRA & MAHINDRA',
        'MARUTI SUZUKI', 'MERCEDES BENZ', 'MG', 'NISSAN', 'OPEL (GENERAL MOTORS)',
        'PCA Automobiles India Private Limited', 'PORCHE', 'PREMIER', 'RENAULT',
        'SKODA', 'TATA', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO'
      ],
      'Commercial': [
        'ASHOK LEYLAND', 'BAJAJ', 'EICHER', 'FORCE', 'ISUZU', 'MAHINDRA & MAHINDRA',
        'TATA', 'VOLVO'
      ],
      'Farm Vehicles': [
        'EICHER', 'ESCORTS', 'FORCE', 'JOHN DEERE', 'MAHINDRA & MAHINDRA',
        'NEW HOLLAND', 'SONALIKA', 'SWARAJ', 'TAFE'
      ],
      'Earth Moving Equipment': [
        'BEML', 'CATERPILLAR', 'HITACHI', 'JCB', 'KOMATSU', 'L&T', 'TATA'
      ],
      'Genset': [
        'ASHOK LEYLAND', 'CATERPILLAR', 'CUMMINS', 'EICHER', 'KIRLOSKAR',
        'MAHINDRA & MAHINDRA', 'SIMPSON'
      ]
    };
    
    // Common models for each brand (simplified - we'll test common patterns)
    const commonModels = [
      // Two Wheeler models
      '4S Champion (KS)', 'Aspire (KS)', 'Avenger 150 (ES)', 'Avenger 160 Street (ES)',
      'Avenger 180 (ES)', 'Avenger 200 (ES)', 'Avenger 220 Cruise (ES)', 'BM 100 (ES)',
      'BM 100 (KS)', 'BM 125 (ES)', 'BM 125X (ES)', 'BM 150 Alloy (ES)', 'BM 150 F1 (ES)',
      'BM 150 FF Roade (ES)', 'BM 150 Spoke (KS)', 'BYK 92 (KS)', 'Boxer (KS)',
      'Boxer 100S Alloy (ES)', 'Boxer 101S Spoke (ES)', 'Bravo (ES)', 'CT 100 (KS)',
      'CT 100 Alloy (ES)', 'CT 100 Spoke (ES)', 'CT 100B (ES)', 'CT 110 (ES)',
      'CT 125 (ES)', 'Caliber (KS)', 'Chetak (KS)', 'Classic SL125 (KS)', 'Croma (KS)',
      'Discover (KS)', 'Discover 100 (ES)', 'Discover 125 Drum/Disc (ES)', 'Discover 135 (KS)',
      'Discover 150 F Disc (ES)', 'Discover 150S Drum/Disc (ES)', 'Dominar 250 (ES)',
      'Dominar 400 (ES)', 'Dominar K10 (ES)', 'Eliminator (ES)', 'Freedom CNG',
      'KB 125/4S (KS)', 'KTM 125 (ES)', 'KTM 200 (ES)', 'KTM 250 (ES)', 'KTM 390 (ES)',
      'KTM Duke 200 (ES)', 'Kristal (ES)', 'Platina (KS)', 'Platina 100 (KS)',
      'Platina 1000 UG (ES)', 'Platina 1000B LES (ES)', 'Platina 110H Gear (ES)',
      'Pulsar 125 (ES)', 'Pulsar 125 Neon (ES)', 'Pulsar 135 LS (ES)', 'Pulsar 150 (ES)',
      'Pulsar 150 Neon (ES)', 'Pulsar 150 Twin Disc (ES)', 'Pulsar 180F Neon (ES)',
      'Pulsar 220 F (ES)', 'Pulsar 250', 'Pulsar N125', 'Pulsar NS 160 (ES)',
      'Pulsar NS 200 (ES)', 'Pulsar NS 400Z(ES)', 'Pulsar RS 200 (ES)', 'RTZ125 (KS)',
      'Saffire (ES)', 'Sonic 110 (KS)', 'Spirit (ES)', 'V12 Drum/Disc (ES)', 'V15 (ES)',
      'Wave (ES)', 'Wind 125 (KS)', 'XCD135 (KS)',
      
      // Passenger car models
      'Stile', 'A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'X1', 'X3', 'X5', 'X6',
      'Beat', 'Cruze', 'Sail', 'Spark', 'Tavera', 'Matiz', 'Nexia', 'Cielo',
      'Linea', 'Palio', 'Punto', 'Uno', 'Trax', 'Ecosport', 'Endeavour', 'Fiesta',
      'Figo', 'Ikon', 'Ambassador', 'Contessa', 'Accord', 'Amaze', 'Brio', 'City',
      'Civic', 'CR-V', 'Jazz', 'Accent', 'Creta', 'Elite i20', 'Eon', 'Elantra',
      'Fluidic Verna', 'Getz', 'Grand i10', 'i10', 'i20', 'Santro', 'Sonata',
      'Tucson', 'Verna', 'Xcent', 'Carens', 'Rio', 'Seltos', 'Sonet', 'Bolero',
      'KUV100', 'Logan', 'Marazzo', 'Quanto', 'Scorpio', 'TUV300', 'Verito', 'XUV300',
      'XUV500', 'Xylo', 'Alto', 'Alto 800', 'Alto K10', 'Baleno', 'Celerio', 'Ciaz',
      'Dzire', 'Ertiga', 'Esteem', 'Ignis', 'Omni', 'Ritz', 'S-Cross', 'Swift',
      'Vitara Brezza', 'Wagon R', 'Zen', 'A-Class', 'B-Class', 'C-Class', 'CLA',
      'CLS', 'E-Class', 'G-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'ML-Class', 'S-Class',
      'Hector', 'ZS EV', 'Micra', 'Sunny', 'Terrano', 'Corsa', 'Duster', 'Fluence',
      'Koleos', 'Kwid', 'Pulse', 'Triber', 'Fabia', 'Laura', 'Octavia', 'Rapid',
      'Superb', 'Yeti', 'Aria', 'Bolt', 'Harrier', 'Hexa', 'Indica', 'Indigo',
      'Manza', 'Nano', 'Nexon', 'Safari', 'Sumo', 'Tiago', 'Tigor', 'Zest',
      'Camry', 'Corolla', 'Etios', 'Fortuner', 'Innova', 'Prius', 'Yaris',
      'Ameo', 'Beetle', 'Jetta', 'Passat', 'Polo', 'Tiguan', 'Touareg', 'Vento',
      'S60', 'S80', 'S90', 'V40', 'V60', 'V90', 'XC40', 'XC60', 'XC90',
      
      // Three Wheeler models
      'Atul Shakti - Pick up van standard', 'GEM Cargo/CargoXL', 'GEM PAXX', 'GEMI Pass',
      'RIK +', 'Shakti Chicken Carrier', 'Shakti Delivery Van', 'Shakti Passenger Carrier',
      'Shakti Pick up van standard', 'Shakti Pick up-Highdesk', 'Shakti Pick-up Highdesk',
      'Shakti Soft  Drink Carrier', 'Shakti Tipper', 'Shakti Water tank Carrier',
      'Shakti smart Pick up van', 'RE Compact', 'RE Maxima', 'RE Maxima C', 'Minidor',
      'Trax Cruiser', 'Trax Toofan'
    ];
    
    const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric'];
    
    // Generate combinations
    let combinationId = 1;
    for (const vehicleType of vehicleTypes) {
      const brands = brandsByVehicleType[vehicleType] || [];
      
      for (const brand of brands) {
        for (const model of commonModels) {
          for (const fuelType of fuelTypes) {
            combinations.push({
              id: combinationId++,
              vehicleType,
              brand,
              model,
              fuelType
            });
          }
        }
      }
    }
    
    utils.logProgress(`Generated ${combinations.length} URL combinations to test`);
    return combinations;
  }

  /**
   * Process all combinations by testing direct URLs
   */
  async processAllCombinations() {
    try {
      utils.logProgress('Starting direct URL combination processing...');
      
      const combinations = this.generateAllCombinations();
      this.processedCombinations = 0;
      
      for (const combination of combinations) {
        this.processedCombinations++;
        const progress = `${this.processedCombinations}/${combinations.length}`;
        const percentage = ((this.processedCombinations / combinations.length) * 100).toFixed(1);
        
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
      
      utils.logProgress(`\n🎉 Direct URL processing completed! Processed ${this.processedCombinations} combinations, found ${this.scrapedCount} batteries from ${this.successfulCombinations} successful combinations`);
      
    } catch (error) {
      throw new Error(`Direct URL processing failed: ${error.message}`);
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
      utils.logProgress('Starting direct URL Amaron battery scraping...');
      
      // Initialize components
      await this.initializeBrowser();
      await this.initializeCSVExporter();
      
      // Process all combinations using direct URLs
      await this.processAllCombinations();
      
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
      utils.logProgress(`📊 Results: ${summary.totalBatteriesFound} batteries found from ${summary.successfulCombinations}/${summary.totalCombinations} combinations`);
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

module.exports = DirectUrlScraper;