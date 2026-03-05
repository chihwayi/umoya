#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type Scenario = {
  id: string;
  title: string;
  modules: string[];
  prerequisites: Record<string, any>;
  steps: string[];
  expected: string[];
  automation: {
    type: string;
    status: string;
    owner: string;
  };
};

const argv = yargs(hideBin(process.argv))
  .option('tenant', {
    type: 'string',
    describe: 'Tenant slug to reference when running API flows',
  })
  .option('token', {
    type: 'string',
    describe: 'Bearer token for EHR API (optional for listing)',
  })
  .option('scenario', {
    type: 'string',
    describe: 'Filter by scenario ID (e.g., S3)',
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  tenant?: string;
  token?: string;
  scenario?: string;
};

function resolveFixturesPath() {
  const fromRepoRoot = path.resolve(process.cwd(), 'qa/fixtures/scenarios.json');
  if (fs.existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }
  return path.resolve(process.cwd(), '../fixtures/scenarios.json');
}

const fixturesPath = resolveFixturesPath();
const scenarios: Scenario[] = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

async function main() {
  const filtered = argv.scenario
    ? scenarios.filter((scenario) => scenario.id.toLowerCase() === argv.scenario!.toLowerCase())
    : scenarios;

  if (filtered.length === 0) {
    console.error('No scenarios matched the provided filter.');
    process.exit(1);
  }

  console.log(`QA Scenario Runbook (${filtered.length} scenario${filtered.length > 1 ? 's' : ''})`);
  console.log(`Tenant: ${argv.tenant ?? 'n/a'} | Token provided: ${argv.token ? 'yes' : 'no'}`);
  console.log('='.repeat(80));

  for (const scenario of filtered) {
    renderScenario(scenario);
  }

  // Placeholder: in the future we will execute HTTP calls here.
  console.log('\nAutomation placeholder: actual API calls not yet implemented.');
  if (!argv.token) {
    console.log('Tip: pass --token <bearer> to enable real API execution when implemented.');
  }
}

function renderScenario(scenario: Scenario) {
  console.log(`\n[${scenario.id}] ${scenario.title}`);
  console.log(`Modules: ${scenario.modules.join(', ')}`);
  console.log(`Automation: ${scenario.automation.type} (${scenario.automation.status}) → ${scenario.automation.owner}`);

  console.log('\nPrerequisites:');
  console.log(JSON.stringify(scenario.prerequisites, null, 2));

  console.log('\nSteps:');
  scenario.steps.forEach((step, idx) => {
    console.log(`  ${idx + 1}. ${step}`);
  });

  console.log('\nExpected Outcomes:');
  scenario.expected.forEach((item, idx) => {
    console.log(`  - [E${idx + 1}] ${item}`);
  });

  console.log('-'.repeat(80));
}

main().catch((error) => {
  console.error('Failed to process scenarios:', error);
  process.exit(1);
});
