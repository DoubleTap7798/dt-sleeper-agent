import { db } from "./db"; // Make sure to import the DB client properly
import { sql } from "drizzle-orm"; // Using drizzle for queries

async function processJob(job: any) {
  try {
    // Simulate job processing logic
    console.log(`Processing job: ${job.id}, Type: ${job.type}`);

    // Here you would add actual job logic for specific job types
    // For example, running a full pipeline job or syncing Stripe data

    // After processing, update the job status to 'completed'
    await db
      .update("jobs") // Assuming 'jobs' is the table name
      .set({ status: "completed", updated_at: new Date() })
      .where(sql`id = ${job.id}`);

    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Error processing job ${job.id}: ${error.message}`);

    // If the job failed, update the status to 'failed'
    await db
      .update("jobs")
      .set({ status: "failed", updated_at: new Date() })
      .where(sql`id = ${job.id}`);
  }
}

async function fetchAndProcessJobs() {
  // Fetch jobs with 'pending' status
  const pendingJobs = await db
    .select()
    .from("jobs")
    .where(sql`status = 'pending'`)
    .limit(10); // Limit the number of jobs to process at once

  // Process each job
  for (const job of pendingJobs) {
    await processJob(job);
  }

  console.log(`Processed ${pendingJobs.length} jobs.`);
}

// Run the job processing in intervals (e.g., every 30 seconds)
setInterval(fetchAndProcessJobs, 30 * 1000); // 30 seconds interval
