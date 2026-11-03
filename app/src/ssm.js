const { SSMClient, GetParametersByPathCommand, GetParameterCommand } = require('@aws-sdk/client-ssm');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const SSM_PREFIX = process.env.SSM_PREFIX || '/hospital-portal/';

let ssmClient = null;

try {
  ssmClient = new SSMClient({ region: AWS_REGION });
} catch (err) {
  console.warn('SSM Client initialization warning:', err.message);
}

// In-memory cached configuration loaded from AWS SSM
const appConfig = {
  source: 'local-defaults',
  environment: process.env.NODE_ENV || 'development',
  hospitalName: process.env.HOSPITAL_NAME || 'General Hospital & Trauma Center',
  maintenanceContact: process.env.MAINTENANCE_CONTACT || 'facilities@hospital.org',
  enableAuditLog: true,
  lastLoadedAt: new Date().toISOString()
};

/**
 * Fetch configuration parameters from AWS Systems Manager Parameter Store.
 * Gracefully falls back to environment variables or defaults when running outside AWS.
 */
async function loadSsmParameters() {
  if (!ssmClient) return appConfig;

  try {
    console.log(`[SSM] Attempting to fetch parameters with prefix: ${SSM_PREFIX} in region ${AWS_REGION}`);
    const command = new GetParametersByPathCommand({
      Path: SSM_PREFIX,
      WithDecryption: true,
      Recursive: true
    });

    const response = await ssmClient.send(command);

    if (response.Parameters && response.Parameters.length > 0) {
      console.log(`[SSM] Successfully loaded ${response.Parameters.length} parameters from AWS Systems Manager:`);
      response.Parameters.forEach(param => {
        const key = param.Name.replace(SSM_PREFIX, '');
        console.log(`   - ${param.Name} = ${param.Value}`);
        
        if (key === 'environment') appConfig.environment = param.Value;
        if (key === 'hospital-name') appConfig.hospitalName = param.Value;
        if (key === 'maintenance-contact') appConfig.maintenanceContact = param.Value;
      });
      appConfig.source = 'AWS Systems Manager Parameter Store';
      appConfig.lastLoadedAt = new Date().toISOString();
    } else {
      console.log('[SSM] No parameters found under prefix. Using environment/defaults.');
    }
  } catch (error) {
    // Expected when running locally or IAM role doesn't have SSM permissions
    console.log(`[SSM] Falling back to local configuration (${error.message})`);
  }

  return appConfig;
}

module.exports = {
  loadSsmParameters,
  getConfig: () => appConfig
};
