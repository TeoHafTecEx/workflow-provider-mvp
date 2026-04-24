// config.js
// Define global configuration for API endpoints used throughout the CRM. Update these values
// to point at your own backend services. The POSTGRES_API_BASE should point to your
// REST API for PostgreSQL (for example an Express/PostgREST endpoint) and the
// KNIME_QUOTE_ENDPOINT should point at your KNIME workflow for quote submissions.

window.APP_CONFIG = {
  // Base URL for all CRUD operations against your PostgreSQL database. Do not include a trailing slash.
  POSTGRES_API_BASE: "http://localhost:3000/api",
  // Endpoint for submitting quotes to KNIME. Replace with your actual KNIME webhook URL.
  KNIME_QUOTE_ENDPOINT: "https://your-knime-endpoint/quote"
};