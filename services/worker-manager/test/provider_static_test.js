const taskcluster = require('taskcluster-client');
const assert = require('assert');
const helper = require('./helper');
const {StaticProvider} = require('../src/providers/static');
const testing = require('taskcluster-lib-testing');

helper.secrets.mockSuite(testing.suiteName(), ['azure'], function(mock, skipping) {
  helper.withEntities(mock, skipping);
  helper.withPulse(mock, skipping);
  helper.withFakeQueue(mock, skipping);
  helper.withFakeNotify(mock, skipping);

  let provider;
  let workerPool;
  let providerId = 'stat';
  let workerPoolId = 'foo/bar';

  setup(async function() {
    provider = new StaticProvider({
      providerId,
      notify: await helper.load('notify'),
      monitor: (await helper.load('monitor')).childMonitor('google'),
      estimator: await helper.load('estimator'),
      fakeCloudApis: {},
      rootUrl: helper.rootUrl,
      Worker: helper.Worker,
      WorkerPool: helper.WorkerPool,
      WorkerPoolError: helper.WorkerPoolError,
      providerConfig: {},
    });
    workerPool = await helper.WorkerPool.create({
      workerPoolId,
      providerId,
      description: 'none',
      previousProviderIds: [],
      created: new Date(),
      lastModified: new Date(),
      config: {
        lifecycle: {
          reregistrationTimeout: 3600,
        },
      },
      owner: 'whatever@example.com',
      providerData: {},
      emailOnError: false,
    });
    await provider.setup();
  });

  suite('registerWorker', function() {
    const workerGroup = providerId;
    const workerId = 'abc123';

    const defaultWorker = {
      workerPoolId,
      workerGroup,
      workerId,
      providerId,
      created: taskcluster.fromNow('0 seconds'),
      lastModified: taskcluster.fromNow('0 seconds'),
      lastChecked: taskcluster.fromNow('0 seconds'),
      capacity: 1,
      expires: taskcluster.fromNow('90 seconds'),
      state: 'requested',
      providerData: {
        staticSecret: 'good',
      },
    };

    test('no token', async function() {
      const worker = await helper.Worker.create({
        ...defaultWorker,
      });
      const workerIdentityProof = {};
      await assert.rejects(() =>
        provider.registerWorker({workerPool, worker, workerIdentityProof}),
      /missing staticSecret/);
    });

    test('invalid token', async function() {
      const worker = await helper.Worker.create({
        ...defaultWorker,
      });
      const workerIdentityProof = {staticSecret: 'invalid'};
      await assert.rejects(() =>
        provider.registerWorker({workerPool, worker, workerIdentityProof}),
      /bad staticSecret/);
    });

    test('successful registration', async function() {
      const worker = await helper.Worker.create({
        ...defaultWorker,
      });
      const workerIdentityProof = {staticSecret: 'good'};
      const res = await provider.registerWorker({workerPool, worker, workerIdentityProof});
      const expectedExpires = new Date(Date.now() + 3600 * 1000);
      // allow +- 10 seconds since time passes while the test executes
      assert(Math.abs(res.expires - expectedExpires) < 10000,
        `${res.expires}, ${expectedExpires}, diff = ${res.expires - expectedExpires} ms`);
    });
  });
});
