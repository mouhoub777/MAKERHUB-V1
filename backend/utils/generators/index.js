// Index file for all generators
// This file exports all generator functions for easy import

// Import all generators
const { generateSalesPageHTML } = require('./salesGenerator');
const { LeadGenerator } = require('./leadGenerator');
const { generateLiveEventPageHTML, LiveDateUtils, LiveEventValidator } = require('./liveGenerators');
const LandingPageGenerator = require('./landingGenerator');
const { ProfileGenerator } = require('./profileGenerator');
const SchedulerGenerator = require('./schedulerGenerator');
const { 
  generateCapturePageHTML, 
  generateCapturePageWithPaymentHTML, 
  generateTelegramLandingPageHTML,
  generateLeadPageHTML,
  generateLiveEventPageHTML: generateLiveHTML
} = require('./htmlGenerators');

// Create instances where needed
const schedulerGenerator = new SchedulerGenerator();
const leadGeneratorInstance = new LeadGenerator();
const landingGeneratorInstance = new LandingPageGenerator();
const profileGeneratorInstance = new ProfileGenerator();

// Export functions with consistent naming
module.exports = {
  // Main page generators (functions expected by publicRoutes)
  generateLeadPage: (data) => {
    return leadGeneratorInstance.generateLeadPageHTML(data);
  },
  generateLivePage: generateLiveEventPageHTML,
  generateLandingPage: (data) => {
    return landingGeneratorInstance.generateLandingPageHTML(data);
  },
  generateSalesPage: generateSalesPageHTML,
  generateProfilePage: (data) => {
    return profileGeneratorInstance.generateProfileHTML(data);
  },
  generateSchedulerPage: (config, userSlug, slug2) => {
    return schedulerGenerator.generateSchedulerHTML(config, userSlug, slug2);
  },
  
  // Additional generators from htmlGenerators
  generateCapturePageHTML,
  generateCapturePageWithPaymentHTML,
  generateTelegramLandingPageHTML,
  
  // Export original names too for compatibility
  generateSalesPageHTML,
  generateLeadPageHTML,
  generateLiveEventPageHTML,
  generateLandingPageHTML: (data) => landingGeneratorInstance.generateLandingPageHTML(data),
  generateProfileHTML: (data) => profileGeneratorInstance.generateProfileHTML(data),
  
  // Export utilities
  LiveDateUtils,
  LiveEventValidator,
  
  // Export classes for direct instantiation if needed
  LeadGenerator,
  LandingPageGenerator,
  ProfileGenerator,
  SchedulerGenerator
};