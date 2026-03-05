#!/usr/bin/env ts-node
import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('url', {
    type: 'string',
    describe: 'Full nurse outcome analytics endpoint URL',
    demandOption: true,
  })
  .option('token', {
    type: 'string',
    describe: 'Bearer token',
    demandOption: true,
  })
  .option('days', {
    type: 'number',
    describe: 'Analytics window (days)',
    default: 30,
  })
  .help()
  .alias('help', 'h').argv as unknown as {
  url: string;
  token: string;
  days: number;
};

function assertCondition(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const response = await axios.get(argv.url, {
    headers: {
      Authorization: `Bearer ${argv.token}`,
    },
    params: {
      days: argv.days,
    },
    timeout: 20000,
  });

  const data = response.data || {};
  assertCondition(data.window, 'Missing window object');
  assertCondition(data.crossModuleQueue, 'Missing crossModuleQueue object');
  assertCondition(data.hivRecommendationExecution, 'Missing hivRecommendationExecution object');
  assertCondition(data.maternityEscalationSla, 'Missing maternityEscalationSla object');

  assertCondition(typeof data.crossModuleQueue.totalItems === 'number', 'crossModuleQueue.totalItems must be numeric');
  assertCondition(
    typeof data.hivRecommendationExecution.executedActionsTotal === 'number',
    'hivRecommendationExecution.executedActionsTotal must be numeric',
  );
  assertCondition(
    typeof data.maternityEscalationSla.unresolvedTasks === 'number',
    'maternityEscalationSla.unresolvedTasks must be numeric',
  );

  console.log('Nurse outcome analytics smoke check passed.');
  console.log(
    JSON.stringify(
      {
        window: data.window,
        queue: data.crossModuleQueue,
        hivExecution: data.hivRecommendationExecution,
        maternitySla: data.maternityEscalationSla,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('Nurse outcome analytics smoke check failed:', error?.message || error);
  process.exit(1);
});
