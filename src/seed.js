// One-off import of the sample directory that used to be compiled into
// the app (mobile/src/data/records.js) into MongoDB.
//
//   node src/seed.js          insert members that are not there yet
//   node src/seed.js --reset  delete every member first, then insert
//
// Re-running without --reset is safe: existing memberIds are skipped, so
// members added through the app are never clobbered.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const Member = require('./models/Member');
const SAMPLE_MEMBERS = require('./seedData');

async function seed() {
  await connectDB();

  const reset = process.argv.includes('--reset');
  if (reset) {
    const { deletedCount } = await Member.deleteMany({});
    console.log(`--reset: removed ${deletedCount} existing members`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const record of SAMPLE_MEMBERS) {
    const exists = await Member.findOne({ memberId: record.memberId });
    if (exists) {
      skipped += 1;
      continue;
    }
    // `id` is derived from memberId at read time and `photo` only ever
    // holds a bucket key, so neither is taken from the sample data.
    const { id, photo, ...fields } = record;
    await Member.create({ ...fields, photo: null });
    inserted += 1;
  }

  console.log(`Seed complete: ${inserted} inserted, ${skipped} already present.`);
  console.log(`Total members now: ${await Member.countDocuments()}`);
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
