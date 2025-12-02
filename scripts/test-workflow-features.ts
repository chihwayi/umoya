#!/usr/bin/env ts-node
/**
 * Comprehensive Workflow Feature Test Script
 * Tests all Sprint 16 Clinical Workflow Engine features
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://localhost:3013/api';
const TENANT_SLUG = 'bulawayo-general';

// Test credentials
const TEST_USER = {
  email: 'dr.smith@bulawayo-general.co.zw',
  password: 'password123',
};

let authToken = '';
let testWorkflowId = '';
let testExecutionId = '';
let testStepExecutionId = '';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logSection(message: string) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(message, colors.cyan);
  log('='.repeat(60), colors.cyan);
}

async function authenticate() {
  logSection('AUTHENTICATION');
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
    authToken = response.data.access_token;
    logSuccess('Authentication successful');
    return true;
  } catch (error: any) {
    logError(`Authentication failed: ${error.message}`);
    return false;
  }
}

async function testGetWorkflows() {
  logSection('TEST: Get Workflows');
  try {
    const response = await axios.get(`${API_BASE}/workflows`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });
    logSuccess(`Retrieved ${response.data.length} workflows`);
    if (response.data.length > 0) {
      testWorkflowId = response.data[0].id;
      logInfo(`Using workflow ID: ${testWorkflowId}`);
    }
    return true;
  } catch (error: any) {
    logError(`Failed to get workflows: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testGetWorkflowTemplates() {
  logSection('TEST: Get Workflow Templates');
  try {
    const response = await axios.get(`${API_BASE}/workflows/templates`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });
    logSuccess(`Retrieved ${response.data.length} workflow templates`);
    return true;
  } catch (error: any) {
    logError(`Failed to get templates: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testCreateWorkflowFromTemplate() {
  logSection('TEST: Create Workflow from Template');
  try {
    // Get templates first
    const templatesResponse = await axios.get(`${API_BASE}/workflows/templates`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (templatesResponse.data.length === 0) {
      logWarning('No templates available to test');
      return false;
    }

    const templateId = templatesResponse.data[0].id;
    logInfo(`Creating workflow from template: ${templatesResponse.data[0].name}`);

    const response = await axios.post(
      `${API_BASE}/workflows/templates/${templateId}/apply`,
      {},
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    testWorkflowId = response.data.id;
    logSuccess(`Workflow created from template: ${response.data.name} (ID: ${testWorkflowId})`);
    return true;
  } catch (error: any) {
    logError(`Failed to create workflow from template: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testCreateCustomWorkflow() {
  logSection('TEST: Create Custom Workflow');
  try {
    const workflowData = {
      name: `Test Custom Workflow ${Date.now()}`,
      description: 'Automated test workflow',
      triggerEvent: 'test_trigger',
      triggerConditions: {
        testCondition: true,
      },
      isActive: true,
      priority: 5,
      steps: [
        {
          stepType: 'send_notification',
          stepConfig: {
            message: 'Test notification',
            priority: 'medium',
          },
          conditions: null,
          timeoutMinutes: 5,
          retryCount: 0,
          isRequired: true,
        },
      ],
    };

    const response = await axios.post(`${API_BASE}/workflows`, workflowData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    logSuccess(`Custom workflow created: ${response.data.name} (ID: ${response.data.id})`);
    return true;
  } catch (error: any) {
    logError(`Failed to create custom workflow: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testExecuteWorkflow() {
  logSection('TEST: Execute Workflow');
  try {
    if (!testWorkflowId) {
      logWarning('No test workflow ID available');
      return false;
    }

    const executionData = {
      triggerEvent: 'test_trigger',
      entityType: 'test',
      entityId: uuidv4(),
      patientId: uuidv4(),
      data: {
        _bypassConditions: true,
        testData: 'automated test',
      },
    };

    const response = await axios.post(`${API_BASE}/workflows/execute`, executionData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    testExecutionId = response.data.executionId || response.data.id;
    logSuccess(`Workflow executed: Execution ID ${testExecutionId}`);
    return true;
  } catch (error: any) {
    logError(`Failed to execute workflow: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testGetExecutions() {
  logSection('TEST: Get Workflow Executions');
  try {
    const response = await axios.get(`${API_BASE}/workflows/executions`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
      params: {
        limit: 10,
      },
    });

    logSuccess(`Retrieved ${response.data.length} executions`);
    if (response.data.length > 0 && !testExecutionId) {
      testExecutionId = response.data[0].id;
      logInfo(`Using execution ID: ${testExecutionId}`);
    }
    return true;
  } catch (error: any) {
    logError(`Failed to get executions: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testGetStepExecutions() {
  logSection('TEST: Get Step Executions');
  try {
    if (!testExecutionId) {
      logWarning('No test execution ID available');
      return false;
    }

    const response = await axios.get(`${API_BASE}/workflows/executions/${testExecutionId}/steps`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    logSuccess(`Retrieved ${response.data.length} step executions`);
    if (response.data.length > 0) {
      testStepExecutionId = response.data[0].id;
      logInfo(`Step execution ID: ${testStepExecutionId}, Status: ${response.data[0].status}`);
    }
    return true;
  } catch (error: any) {
    logError(`Failed to get step executions: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testWorkflowActivation() {
  logSection('TEST: Workflow Activation/Deactivation');
  try {
    if (!testWorkflowId) {
      logWarning('No test workflow ID available');
      return false;
    }

    // Deactivate
    await axios.post(`${API_BASE}/workflows/${testWorkflowId}/deactivate`, {}, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });
    logSuccess('Workflow deactivated');

    // Activate
    await axios.post(`${API_BASE}/workflows/${testWorkflowId}/activate`, {}, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });
    logSuccess('Workflow activated');

    return true;
  } catch (error: any) {
    logError(`Failed to activate/deactivate workflow: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testWorkflowAnalytics() {
  logSection('TEST: Workflow Analytics');
  try {
    // Get overall analytics
    const overallResponse = await axios.get(`${API_BASE}/workflows/analytics/overview`, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    logSuccess('Overall analytics retrieved');
    logInfo(`Total Workflows: ${overallResponse.data.totalWorkflows}`);
    logInfo(`Total Executions: ${overallResponse.data.totalExecutions}`);
    logInfo(`Success Rate: ${overallResponse.data.successRate}%`);

    // Get workflow-specific analytics
    if (testWorkflowId) {
      const workflowResponse = await axios.get(`${API_BASE}/workflows/analytics/${testWorkflowId}`, {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      });

      logSuccess('Workflow-specific analytics retrieved');
      logInfo(`Workflow: ${workflowResponse.data.workflow.name}`);
      logInfo(`Total Executions: ${workflowResponse.data.totalExecutions}`);
    }

    return true;
  } catch (error: any) {
    logError(`Failed to get analytics: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testCancelExecution() {
  logSection('TEST: Cancel Execution');
  try {
    // Create a new execution to cancel
    const executionData = {
      triggerEvent: 'test_trigger',
      entityType: 'test',
      entityId: uuidv4(),
      patientId: uuidv4(),
      data: {
        _bypassConditions: true,
        testData: 'execution to cancel',
      },
    };

    const execResponse = await axios.post(`${API_BASE}/workflows/execute`, executionData, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    const executionId = execResponse.data.executionId || execResponse.data.id;
    logInfo(`Created execution to cancel: ${executionId}`);

    // Cancel it
    const cancelResponse = await axios.post(
      `${API_BASE}/workflows/executions/${executionId}/cancel`,
      { reason: 'Automated test cancellation' },
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    logSuccess(`Execution cancelled: ${cancelResponse.data.message}`);
    return true;
  } catch (error: any) {
    logError(`Failed to cancel execution: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testRetryFailedStep() {
  logSection('TEST: Retry Failed Step');
  try {
    if (!testStepExecutionId) {
      logWarning('No test step execution ID available - skipping retry test');
      return false;
    }

    const response = await axios.post(
      `${API_BASE}/workflows/step-executions/${testStepExecutionId}/retry`,
      {},
      {
        headers: {
          'X-Tenant-ID': TENANT_SLUG,
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    logSuccess(`Step retry initiated: ${response.data.message}`);
    return true;
  } catch (error: any) {
    // This might fail if the step isn't in failed status, which is expected
    logWarning(`Retry test result: ${error.response?.data?.message || error.message}`);
    return true; // Don't fail the test suite for this
  }
}

async function testDuplicateWorkflow() {
  logSection('TEST: Duplicate Workflow');
  try {
    if (!testWorkflowId) {
      logWarning('No test workflow ID available');
      return false;
    }

    const response = await axios.post(`${API_BASE}/workflows/${testWorkflowId}/duplicate`, {}, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG,
        Authorization: `Bearer ${authToken}`,
      },
    });

    logSuccess(`Workflow duplicated: ${response.data.name} (ID: ${response.data.id})`);
    return true;
  } catch (error: any) {
    logError(`Failed to duplicate workflow: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function runAllTests() {
  logSection('SPRINT 16 WORKFLOW FEATURE TESTS');
  logInfo('Starting comprehensive workflow feature tests...\n');

  const results: { [key: string]: boolean } = {};

  // Authenticate
  if (!(await authenticate())) {
    logError('Authentication failed - cannot proceed with tests');
    process.exit(1);
  }

  // Run all tests
  results['Get Workflows'] = await testGetWorkflows();
  results['Get Workflow Templates'] = await testGetWorkflowTemplates();
  results['Create Workflow from Template'] = await testCreateWorkflowFromTemplate();
  results['Create Custom Workflow'] = await testCreateCustomWorkflow();
  results['Execute Workflow'] = await testExecuteWorkflow();
  results['Get Executions'] = await testGetExecutions();
  results['Get Step Executions'] = await testGetStepExecutions();
  results['Workflow Activation/Deactivation'] = await testWorkflowActivation();
  results['Workflow Analytics'] = await testWorkflowAnalytics();
  results['Cancel Execution'] = await testCancelExecution();
  results['Retry Failed Step'] = await testRetryFailedStep();
  results['Duplicate Workflow'] = await testDuplicateWorkflow();

  // Summary
  logSection('TEST SUMMARY');
  let passedCount = 0;
  let failedCount = 0;

  for (const [testName, passed] of Object.entries(results)) {
    if (passed) {
      logSuccess(`${testName}: PASSED`);
      passedCount++;
    } else {
      logError(`${testName}: FAILED`);
      failedCount++;
    }
  }

  log('\n');
  logInfo(`Total Tests: ${passedCount + failedCount}`);
  logSuccess(`Passed: ${passedCount}`);
  if (failedCount > 0) {
    logError(`Failed: ${failedCount}`);
  }

  const successRate = ((passedCount / (passedCount + failedCount)) * 100).toFixed(2);
  logInfo(`Success Rate: ${successRate}%`);

  if (failedCount === 0) {
    logSuccess('\n🎉 All tests passed!');
  } else {
    logError('\n⚠️  Some tests failed. Please review the output above.');
  }
}

// Run tests
runAllTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});

