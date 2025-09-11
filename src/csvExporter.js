/**
 * CSV Exporter Module for Amaron Battery Scraper
 * Handles CSV file operations including initialization, data formatting, and file saving
 */

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

class CSVExporter {
  constructor(fileName = null, headers = null) {
    this.fileName = fileName || config.output.csvFileName;
    this.headers = headers || config.output.csvHeaders;
    this.outputDirectory = config.output.outputDirectory;
    this.csvWriter = null;
    this.filePath = null;
    this.recordCount = 0;
    this.isInitialized = false;
  }

  /**
   * Initialize CSV file with headers
   * Creates output directory if it doesn't exist and sets up CSV writer
   */
  async initializeCSV() {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Initializing CSV file (attempt ${attempt}/${maxRetries})...`);
        
        // Validate configuration
        if (!this.fileName || typeof this.fileName !== 'string') {
          throw new Error('Invalid CSV file name provided');
        }
        
        if (!this.headers || !Array.isArray(this.headers) || this.headers.length === 0) {
          throw new Error('Invalid or empty CSV headers provided');
        }

        // Ensure output directory exists with error handling
        await this.ensureOutputDirectory();
        
        // Set up file path with validation
        this.filePath = path.join(this.outputDirectory, this.fileName);
        
        // Validate file path
        if (!this.filePath || this.filePath === this.outputDirectory) {
          throw new Error('Invalid file path generated');
        }

        // Check if file already exists and handle appropriately
        try {
          await fs.access(this.filePath);
          console.log(`Warning: CSV file already exists and will be overwritten: ${this.filePath}`);
        } catch (accessError) {
          // File doesn't exist, which is fine
        }
        
        // Create CSV header configuration with validation
        const headerConfig = this.headers.map((header, index) => {
          if (!header || typeof header !== 'string') {
            throw new Error(`Invalid header at index ${index}: ${header}`);
          }
          
          const id = this.convertHeaderToId(header);
          if (!id) {
            throw new Error(`Could not generate valid ID for header: ${header}`);
          }
          
          return {
            id: id,
            title: header
          };
        });

        // Validate header configuration
        const duplicateIds = headerConfig
          .map(h => h.id)
          .filter((id, index, arr) => arr.indexOf(id) !== index);
        
        if (duplicateIds.length > 0) {
          throw new Error(`Duplicate header IDs found: ${duplicateIds.join(', ')}`);
        }

        // Initialize CSV writer with error handling
        try {
          this.csvWriter = createCsvWriter({
            path: this.filePath,
            header: headerConfig,
            encoding: 'utf8'
          });
        } catch (writerError) {
          throw new Error(`Failed to create CSV writer: ${writerError.message}`);
        }

        if (!this.csvWriter) {
          throw new Error('CSV writer is null after initialization');
        }

        // Test write permissions by creating an empty file
        try {
          await fs.writeFile(this.filePath, '', 'utf8');
        } catch (writeError) {
          throw new Error(`Cannot write to CSV file path: ${writeError.message}`);
        }

        this.isInitialized = true;
        this.recordCount = 0;
        
        console.log(`CSV file initialized successfully: ${this.filePath}`);
        console.log(`Headers configured: ${this.headers.length} columns`);
        return true;
        
      } catch (error) {
        lastError = error;
        console.error(`CSV initialization attempt ${attempt} failed: ${error.message}`);
        
        // Clean up on failure
        this.isInitialized = false;
        this.csvWriter = null;
        this.filePath = null;
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to initialize CSV file after ${maxRetries} attempts. Last error: ${lastError.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Append a battery record to the CSV file with comprehensive error handling
   * @param {Object} batteryData - Raw battery data object
   */
  async appendBatteryRecord(batteryData) {
    const maxRetries = 3;
    let lastError = null;

    // Pre-validation checks
    if (!this.isInitialized) {
      throw new Error('CSV exporter not initialized. Call initializeCSV() first.');
    }

    if (!this.csvWriter) {
      throw new Error('CSV writer is not available');
    }

    if (!batteryData || typeof batteryData !== 'object') {
      throw new Error('Invalid battery data provided - must be an object');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Format the data for CSV output with error handling
        let formattedData;
        try {
          formattedData = this.formatBatteryData(batteryData);
        } catch (formatError) {
          throw new Error(`Data formatting failed: ${formatError.message}`);
        }
        
        if (!formattedData || typeof formattedData !== 'object') {
          throw new Error('Formatted data is invalid');
        }
        
        // Validate the formatted data
        try {
          this.validateBatteryData(formattedData);
        } catch (validationError) {
          console.warn(`Data validation warning: ${validationError.message}`);
          // Continue with warning, don't fail completely
        }
        
        // Check file system availability before writing
        try {
          await fs.access(path.dirname(this.filePath), fs.constants.W_OK);
        } catch (accessError) {
          throw new Error(`Cannot write to output directory: ${accessError.message}`);
        }
        
        // Write the record to CSV with timeout
        try {
          await Promise.race([
            this.csvWriter.writeRecords([formattedData]),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('CSV write operation timed out')), 10000);
            })
          ]);
        } catch (writeError) {
          throw new Error(`CSV write failed: ${writeError.message}`);
        }
        
        this.recordCount++;
        
        if (config.logging.showProgress && this.recordCount % 10 === 0) {
          console.log(`Records written: ${this.recordCount}`);
        }
        
        // Verify the write was successful by checking file size
        if (this.recordCount % 50 === 0) {
          try {
            const stats = await fs.stat(this.filePath);
            if (stats.size === 0) {
              throw new Error('CSV file is empty after write operations');
            }
          } catch (statError) {
            console.warn(`Could not verify CSV file: ${statError.message}`);
          }
        }
        
        return true;
        
      } catch (error) {
        lastError = error;
        console.error(`CSV append attempt ${attempt} failed: ${error.message}`);
        
        // Log problematic data for debugging
        if (batteryData) {
          console.error(`Problematic data: ${JSON.stringify(batteryData, null, 2).substring(0, 500)}...`);
        }
        
        // Check for non-retryable errors
        if (error.message.includes('not initialized') || 
            error.message.includes('Invalid battery data') ||
            error.message.includes('Data formatting failed')) {
          throw error; // Don't retry these errors
        }
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to append battery record after ${maxRetries} attempts. Last error: ${lastError.message}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(`Retrying CSV append in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Format raw battery data for CSV output
   * @param {Object} rawData - Raw battery data from scraper
   * @returns {Object} Formatted data object matching CSV headers
   */
  formatBatteryData(rawData) {
    const formatted = {};
    
    // Map each header to corresponding data field
    this.headers.forEach(header => {
      const fieldId = this.convertHeaderToId(header);
      let value = '';
      
      switch (header) {
        case 'Vehicle Type':
          value = rawData.vehicleType || '';
          break;
        case 'Brand':
          value = rawData.brand || '';
          break;
        case 'Model':
          value = rawData.model || '';
          break;
        case 'Fuel Type':
          value = rawData.fuelType || '';
          break;
        case 'Battery Brand':
          value = rawData.batteryBrand || '';
          break;
        case 'Series':
          value = rawData.series || '';
          break;
        case 'Item Code':
          value = rawData.itemCode || '';
          break;
        case 'Battery Model':
          value = rawData.batteryModel || '';
          break;
        case 'Battery Title':
          value = rawData.batteryTitle || '';
          break;
        case 'Dimensions':
          value = rawData.dimensions || '';
          break;
        case 'Voltage':
          value = this.formatNumericValue(rawData.voltage);
          break;
        case 'Ampere Hour':
          value = this.formatNumericValue(rawData.ampereHour);
          break;
        case 'CCA':
          value = this.formatNumericValue(rawData.cca);
          break;
        case 'Total Warranty':
          value = this.formatNumericValue(rawData.totalWarranty);
          break;
        case 'Free Warranty':
          value = this.formatNumericValue(rawData.freeWarranty);
          break;
        case 'Pro-rata Warranty':
          value = this.formatNumericValue(rawData.proRataWarranty);
          break;
        case 'Terminal Layout Image URL':
          value = rawData.terminalLayoutImageUrl || '';
          break;
        case 'Country of Origin':
          value = rawData.countryOfOrigin || '';
          break;
        case 'Base Price':
          value = rawData.basePrice || '';
          break;
        case 'Special Discount':
          value = rawData.specialDiscount || '';
          break;
        case 'Total Price':
          value = rawData.totalPrice || '';
          break;
        case 'Rebate':
          value = rawData.rebate || '';
          break;
        default:
          value = '';
      }
      
      formatted[fieldId] = this.sanitizeValue(value);
    });
    
    return formatted;
  }

  /**
   * Finalize CSV file and perform cleanup
   * @returns {Object} Summary of CSV export
   */
  async finalizeCSV() {
    if (!this.isInitialized) {
      throw new Error('CSV exporter not initialized.');
    }

    try {
      // Verify file exists and get stats
      const stats = await fs.stat(this.filePath);
      
      const summary = {
        filePath: this.filePath,
        recordCount: this.recordCount,
        fileSize: stats.size,
        fileName: this.fileName,
        completed: true
      };
      
      console.log(`CSV export completed: ${this.recordCount} records written to ${this.filePath}`);
      console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      return summary;
    } catch (error) {
      console.error('Error finalizing CSV file:', error);
      throw new Error(`Failed to finalize CSV file: ${error.message}`);
    }
  }

  /**
   * Ensure output directory exists, create if necessary
   */
  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDirectory);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.outputDirectory, { recursive: true });
      console.log(`Created output directory: ${this.outputDirectory}`);
    }
  }

  /**
   * Convert header string to valid field ID
   * @param {string} header - Header string
   * @returns {string} Field ID
   */
  convertHeaderToId(header) {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Format numeric values for CSV output
   * @param {*} value - Value to format
   * @returns {string} Formatted numeric value or empty string
   */
  formatNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const numValue = parseFloat(value);
    return isNaN(numValue) ? '' : numValue.toString();
  }

  /**
   * Sanitize value for CSV output
   * @param {*} value - Value to sanitize
   * @returns {string} Sanitized value
   */
  sanitizeValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    let sanitized = value.toString().trim();
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // Limit field length if configured
    if (config.validation.maxFieldLength && sanitized.length > config.validation.maxFieldLength) {
      sanitized = sanitized.substring(0, config.validation.maxFieldLength);
    }
    
    return sanitized;
  }

  /**
   * Validate battery data before writing to CSV
   * @param {Object} data - Formatted battery data
   */
  validateBatteryData(data) {
    // Check for required fields
    const requiredFields = ['vehicle_type', 'brand', 'model', 'fuel_type'];
    
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        console.warn(`Missing required field: ${field}`);
      }
    }
    
    // Validate numeric fields
    const numericFields = ['voltage', 'ampere_hour', 'cca', 'total_warranty', 'free_warranty', 'pro_rata_warranty'];
    
    for (const field of numericFields) {
      if (data[field] && data[field] !== '') {
        const numValue = parseFloat(data[field]);
        if (isNaN(numValue)) {
          console.warn(`Invalid numeric value for field ${field}: ${data[field]}`);
        }
      }
    }
  }

  /**
   * Get current record count
   * @returns {number} Number of records written
   */
  getRecordCount() {
    return this.recordCount;
  }

  /**
   * Get file path
   * @returns {string} Full file path
   */
  getFilePath() {
    return this.filePath;
  }

  /**
   * Check if CSV exporter is initialized
   * @returns {boolean} Initialization status
   */
  isReady() {
    return this.isInitialized;
  }
}

module.exports = CSVExporter;